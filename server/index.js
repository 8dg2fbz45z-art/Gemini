import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initializeDatabase, getSetting, setSetting } from './db.js';
import {
  CATEGORIES,
  VERIFIED_HLS_FACULTY,
  VERIFIED_PEER_INSTITUTIONS,
  PUBLIC_RSS_SOURCES,
} from './data/verifiedRegistries.js';
import { ingestLivePublicFeeds, pruneExcessArticlesPerCategory } from './services/newsFetcher.js';
import {
  getGeminiConfig,
  getOrGenerateArticleAnalysis,
  generateWeeklyDigest,
} from './services/llmProcessor.js';

initializeDatabase();
pruneExcessArticlesPerCategory(15);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function formatArticleRow(row, allFirmsMap, analysisMap, clusterCountsMap) {
  const matchedFirmIds = JSON.parse(row.matched_firms_json || '[]');
  const matchedFirms = matchedFirmIds
    .map((id) => allFirmsMap.get(id))
    .filter(Boolean);

  const professor = row.verified_professor_id
    ? VERIFIED_HLS_FACULTY.find((p) => p.id === row.verified_professor_id) || null
    : null;

  const analysisMeta = analysisMap.get(row.id) || null;
  const clusterCount = row.story_cluster_id
    ? clusterCountsMap.get(row.story_cluster_id) || 1
    : 1;

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    sourceName: row.source_name,
    sourceType: row.source_type,
    author: row.author,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    categoryId: row.category_id,
    significanceScore: row.significance_score,
    whyThisMatters: row.why_this_matters,
    summary: row.summary,
    isSample: Boolean(row.is_sample),
    isFacultyAuthored: Boolean(row.is_faculty_authored),
    contributorType: row.contributor_type,
    verifiedProfessorId: row.verified_professor_id,
    verifiedProfessor: professor,
    storyClusterId: row.story_cluster_id,
    storyTimelineCount: clusterCount,
    matchedFirmIds,
    matchedFirms,
    readStatus: row.read_status || 'unread',
    lastReadAt: row.last_read_at,
    isBookmarked: Boolean(row.is_bookmarked),
    hasCachedAnalysis: Boolean(analysisMeta),
    analysisModelUsed: analysisMeta ? analysisMeta.modelUsed : null,
    isRuleGroundedFallback: analysisMeta ? analysisMeta.isRuleGroundedFallback : false,
  };
}

function getLookupMaps() {
  const firmRows = db.prepare('SELECT * FROM law_firms ORDER BY vault_rank ASC, amlaw_revenue_rank ASC').all();
  const allFirmsMap = new Map();
  for (const f of firmRows) {
    allFirmsMap.set(f.id, {
      id: f.id,
      name: f.name,
      shortName: f.short_name,
      vaultRank: f.vault_rank,
      amLawRevenueRank: f.amlaw_revenue_rank,
      dealVolumeTier: f.deal_volume_tier,
      headquarters: f.headquarters,
      coreStrengths: JSON.parse(f.core_strengths_json || '[]'),
      aliases: JSON.parse(f.aliases_json || '[]'),
      isWatched: Boolean(f.is_watched),
    });
  }

  const analysisRows = db.prepare('SELECT article_id, model_used, analysis_json FROM article_analyses').all();
  const analysisMap = new Map();
  for (const a of analysisRows) {
    let isFallback = false;
    try {
      const parsed = JSON.parse(a.analysis_json);
      isFallback = Boolean(parsed.isRuleGroundedFallback);
    } catch {
      // ignore
    }
    analysisMap.set(a.article_id, {
      modelUsed: a.model_used,
      isRuleGroundedFallback: isFallback,
    });
  }

  const clusterRows = db
    .prepare('SELECT story_cluster_id, COUNT(*) as cnt FROM articles WHERE story_cluster_id IS NOT NULL GROUP BY story_cluster_id')
    .all();
  const clusterCountsMap = new Map();
  for (const c of clusterRows) {
    clusterCountsMap.set(c.story_cluster_id, c.cnt);
  }

  return { allFirmsMap, analysisMap, clusterCountsMap };
}

/**
 * GET /api/bootstrap
 * Returns categories with counts, law firms watchlist, faculty registry, library stats, and AI status.
 */
app.get('/api/bootstrap', (req, res) => {
  try {
    const includeSamples = req.query.includeSamples !== 'false';
    const { allFirmsMap, analysisMap, clusterCountsMap } = getLookupMaps();

    const allArticlesRaw = db
      .prepare('SELECT * FROM articles ORDER BY significance_score DESC, published_at DESC')
      .all();

    const filteredArticles = includeSamples
      ? allArticlesRaw
      : allArticlesRaw.filter((a) => !a.is_sample);

    const formattedArticles = filteredArticles.map((r) =>
      formatArticleRow(r, allFirmsMap, analysisMap, clusterCountsMap)
    );

    const categoriesEnriched = CATEGORIES.map((cat) => {
      const catArticles = formattedArticles.filter((a) => a.categoryId === cat.id);
      const liveCount = catArticles.filter((a) => !a.isSample).length;
      const sampleCount = catArticles.filter((a) => a.isSample).length;
      const facultyCount = catArticles.filter((a) => a.isFacultyAuthored).length;
      const topStory = catArticles[0] || null;

      // Aggregate unique watched firms active in this category
      const activeFirmMap = new Map();
      for (const art of catArticles) {
        for (const f of art.matchedFirms) {
          if (f.isWatched) {
            activeFirmMap.set(f.id, f);
          }
        }
      }

      return {
        ...cat,
        totalCount: catArticles.length,
        liveCount,
        sampleCount,
        facultyCount,
        topStory,
        activeWatchedFirms: Array.from(activeFirmMap.values()).slice(0, 5),
      };
    });

    // Compute article counts per law firm
    const firmsList = Array.from(allFirmsMap.values()).map((f) => {
      const mentionCount = formattedArticles.filter((a) =>
        a.matchedFirmIds.includes(f.id)
      ).length;
      return { ...f, mentionCount };
    });

    const glossaryCount = db.prepare('SELECT COUNT(*) as count FROM glossary_concepts').get().count;
    const notesCount = db.prepare('SELECT COUNT(*) as count FROM research_notes').get().count;
    const bookmarkedCount = formattedArticles.filter((a) => a.isBookmarked).length;
    const readCount = formattedArticles.filter((a) => a.readStatus === 'read').length;

    const geminiConfig = getGeminiConfig();
    const lastRssRefresh = getSetting('last_rss_refresh', null);
    let lastRssStats = null;
    try {
      const rawStats = getSetting('last_rss_stats', null);
      if (rawStats) lastRssStats = JSON.parse(rawStats);
    } catch {
      // ignore
    }

    // Compute #1 Biggest Story of the Day (excluding Harvard column; prioritizing International Geopolitical/Economic or Indian Law/Politics)
    const nonHarvardArticles = formattedArticles.filter(
      (a) => !a.isFacultyAuthored && !(a.sourceName || '').toLowerCase().includes('harvard')
    );

    const scoreSpotlightPriority = (art) => {
      const blob = `${art.title || ''} ${art.summary || ''} ${art.whyThisMatters || ''} ${art.sourceName || ''}`;
      let priority = art.significanceScore || 50;

      const isIndianLawOrPolitics =
        /\b(India|Indian|Supreme Court of India|SEBI|Reserve Bank of India|RBI|Competition Commission of India|CCI|IBC|NCLT|New Delhi|Mumbai|Ministry of Corporate Affairs|Lok Sabha|Rajya Sabha)\b/i.test(
          blob
        );

      const isIntlGeopoliticalOrEcon =
        /\b(geopolit|international|cross-border|tariff|sanction|CFIUS|European Commission|EU\b|UK\b|sovereign|treaty|bilateral|global|macroeconomic|export control|world trade|WTO|IMF|central bank|Indo-Pacific|arbitration)\b/i.test(
          blob
        );

      if (isIndianLawOrPolitics && isIntlGeopoliticalOrEcon) {
        priority += 45;
      } else if (isIndianLawOrPolitics || isIntlGeopoliticalOrEcon) {
        priority += 32;
      }

      if (art.categoryId === 'general-international') {
        priority += 10;
      }

      return priority;
    };

    const spotlightStory =
      [...nonHarvardArticles].sort(
        (a, b) => scoreSpotlightPriority(b) - scoreSpotlightPriority(a)
      )[0] || null;

    const biggestCategoryOfDay = [...categoriesEnriched]
      .filter((c) => c.totalCount > 0)
      .sort((a, b) => {
        const topA = a.topStory?.significanceScore || 0;
        const topB = b.topStory?.significanceScore || 0;
        if (topB !== topA) return topB - topA;
        return b.totalCount - a.totalCount;
      })[0] || null;

    res.json({
      categories: categoriesEnriched,
      spotlight: {
        storyOfTheDay: spotlightStory,
        biggestCategory: biggestCategoryOfDay
          ? {
              id: biggestCategoryOfDay.id,
              name: biggestCategoryOfDay.name,
              peakScore: biggestCategoryOfDay.topStory?.significanceScore || 0,
              totalCount: biggestCategoryOfDay.totalCount,
            }
          : null,
      },
      lawFirms: firmsList,
      verifiedFaculty: VERIFIED_HLS_FACULTY,
      peerInstitutions: VERIFIED_PEER_INSTITUTIONS,
      publicRssSources: PUBLIC_RSS_SOURCES,
      stats: {
        totalArticles: formattedArticles.length,
        liveArticles: formattedArticles.filter((a) => !a.isSample).length,
        sampleArticles: formattedArticles.filter((a) => a.isSample).length,
        facultyArticles: formattedArticles.filter((a) => a.isFacultyAuthored).length,
        bookmarkedCount,
        readCount,
        glossaryCount,
        notesCount,
      },
      aiStatus: {
        provider: 'Google Gemini',
        model: geminiConfig.model,
        hasApiKey: geminiConfig.hasApiKey,
        lastRssRefresh,
        lastRssStats,
      },
    });
  } catch (err) {
    console.error('Error in /api/bootstrap:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/articles
 * Filtered and ranked feed endpoint.
 */
app.get('/api/articles', (req, res) => {
  try {
    const {
      categoryId,
      firmId,
      watchedFirmsOnly,
      facultyOnly,
      bookmarkedOnly,
      readStatus,
      includeSamples = 'true',
      storyClusterId,
      search,
    } = req.query;

    const { allFirmsMap, analysisMap, clusterCountsMap } = getLookupMaps();
    const rows = db
      .prepare('SELECT * FROM articles ORDER BY significance_score DESC, published_at DESC')
      .all();

    let articles = rows.map((r) =>
      formatArticleRow(r, allFirmsMap, analysisMap, clusterCountsMap)
    );

    if (includeSamples === 'false') {
      articles = articles.filter((a) => !a.isSample);
    }
    if (categoryId && categoryId !== 'all') {
      articles = articles.filter((a) => a.categoryId === categoryId);
    }
    if (firmId) {
      articles = articles.filter((a) => a.matchedFirmIds.includes(firmId));
    }
    if (watchedFirmsOnly === 'true') {
      articles = articles.filter((a) => a.matchedFirms.some((f) => f.isWatched));
    }
    if (facultyOnly === 'true') {
      articles = articles
        .filter(
          (a) =>
            a.contributorType !== 'student_author' &&
            (a.isFacultyAuthored ||
              Boolean(a.verifiedProfessorId) ||
              (a.sourceName || '').toLowerCase().includes('harvard law'))
        )
        .sort((a, b) => {
          if (a.isFacultyAuthored !== b.isFacultyAuthored) {
            return a.isFacultyAuthored ? -1 : 1;
          }
          return b.significanceScore - a.significanceScore;
        });
    }
    if (bookmarkedOnly === 'true') {
      articles = articles.filter((a) => a.isBookmarked);
    }
    if (readStatus === 'read' || readStatus === 'unread') {
      articles = articles.filter((a) => a.readStatus === readStatus);
    }
    if (storyClusterId) {
      articles = articles.filter((a) => a.storyClusterId === storyClusterId);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.summary || '').toLowerCase().includes(q) ||
          (a.whyThisMatters || '').toLowerCase().includes(q) ||
          (a.author || '').toLowerCase().includes(q) ||
          (a.sourceName || '').toLowerCase().includes(q) ||
          a.matchedFirms.some((f) => f.name.toLowerCase().includes(q) || f.shortName.toLowerCase().includes(q))
      );
    }

    res.json({
      count: articles.length,
      articles,
    });
  } catch (err) {
    console.error('Error in GET /api/articles:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/articles/:id
 * Returns full article, 6-part deep analysis, story timeline, progressive learning concept status, and research notes.
 */
app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Mark as read
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE articles SET read_status = ?, last_read_at = ? WHERE id = ?').run(
      'read',
      nowIso,
      id
    );
    row.read_status = 'read';
    row.last_read_at = nowIso;

    const { allFirmsMap, analysisMap, clusterCountsMap } = getLookupMaps();
    const analysisResult = await getOrGenerateArticleAnalysis(id);

    // Refresh lookup map entry if analysis was newly generated
    analysisMap.set(id, {
      modelUsed: analysisResult.modelUsed,
      isRuleGroundedFallback: Boolean(analysisResult.analysis?.isRuleGroundedFallback),
    });

    const formattedArticle = formatArticleRow(row, allFirmsMap, analysisMap, clusterCountsMap);

    // Progressive Learning check: Does the user already have this concept in their Personal Glossary?
    const conceptTerm = analysisResult.analysis?.conceptExplainer?.conceptTerm || '';
    let existingGlossaryConcept = null;
    if (conceptTerm) {
      existingGlossaryConcept = db
        .prepare('SELECT * FROM glossary_concepts WHERE LOWER(term) = LOWER(?)')
        .get(conceptTerm);

      if (existingGlossaryConcept) {
        // Increment encounter count and record article ID
        const sourceIds = JSON.parse(existingGlossaryConcept.source_article_ids_json || '[]');
        if (!sourceIds.includes(id)) {
          sourceIds.push(id);
        }
        const newCount = (existingGlossaryConcept.encounter_count || 1) + 1;
        db.prepare(`
          UPDATE glossary_concepts
          SET encounter_count = ?, source_article_ids_json = ?, updated_at = ?
          WHERE id = ?
        `).run(newCount, JSON.stringify(sourceIds), nowIso, existingGlossaryConcept.id);
        existingGlossaryConcept.encounter_count = newCount;
      }
    }

    // Fetch chronological Story Timeline if part of a cluster
    let storyTimeline = [];
    if (row.story_cluster_id) {
      const clusterRows = db
        .prepare('SELECT * FROM articles WHERE story_cluster_id = ? ORDER BY published_at ASC')
        .all(row.story_cluster_id);
      storyTimeline = clusterRows.map((r) =>
        formatArticleRow(r, allFirmsMap, analysisMap, clusterCountsMap)
      );
    }

    // Fetch research notes attached to this article
    const notesRows = db
      .prepare('SELECT * FROM research_notes WHERE article_id = ? ORDER BY created_at DESC')
      .all(id);
    const notes = notesRows.map((n) => ({
      id: n.id,
      articleId: n.article_id,
      title: n.title,
      noteType: n.note_type,
      content: n.content,
      tags: JSON.parse(n.tags_json || '[]'),
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    res.json({
      article: formattedArticle,
      analysis: analysisResult.analysis,
      analysisMeta: {
        modelUsed: analysisResult.modelUsed,
        generatedAt: analysisResult.generatedAt,
        fromCache: analysisResult.fromCache,
        isRuleGroundedFallback: Boolean(analysisResult.analysis?.isRuleGroundedFallback),
      },
      progressiveLearning: {
        isPreviouslyStudied: Boolean(existingGlossaryConcept),
        glossaryEntry: existingGlossaryConcept
          ? {
              id: existingGlossaryConcept.id,
              term: existingGlossaryConcept.term,
              encounterCount: existingGlossaryConcept.encounter_count,
              masteryLevel: existingGlossaryConcept.mastery_level,
              recommendedDefaultDepth:
                existingGlossaryConcept.mastery_level === 'mastered'
                  ? 'advanced'
                  : 'intermediate',
            }
          : null,
      },
      storyTimeline,
      notes,
    });
  } catch (err) {
    console.error('Error in GET /api/articles/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/articles/:id/analyze
 * Force fresh Gemini 6-part deep analysis on a specific article.
 */
app.post('/api/articles/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getOrGenerateArticleAnalysis(id, { forceRegenerate: true });
    res.json(result);
  } catch (err) {
    console.error('Error in POST /api/articles/:id/analyze:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/refresh
 * Triggers live RSS ingestion from public sources and proactively analyzes top flagship stories if Gemini key is set.
 */
app.post('/api/refresh', async (req, res) => {
  try {
    const stats = await ingestLivePublicFeeds();
    const { hasApiKey } = getGeminiConfig();
    const proactivelyAnalyzed = [];

    if (hasApiKey && stats.newlyInsertedIds.length > 0) {
      // Proactively analyze up to 2 highest-significance newly ingested articles to conserve quota
      const topNew = db
        .prepare(
          `SELECT id FROM articles WHERE id IN (${stats.newlyInsertedIds
            .map(() => '?')
            .join(',')}) AND significance_score >= 70 ORDER BY significance_score DESC LIMIT 2`
        )
        .all(...stats.newlyInsertedIds);

      for (const row of topNew) {
        try {
          await getOrGenerateArticleAnalysis(row.id, { forceRegenerate: true });
          proactivelyAnalyzed.push(row.id);
        } catch {
          // continue gracefully
        }
      }
    }

    res.json({
      success: true,
      stats,
      proactivelyAnalyzed,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in POST /api/refresh:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Law Firm Watchlist Management
 */
app.put('/api/firms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { isWatched } = req.body;
    db.prepare('UPDATE law_firms SET is_watched = ? WHERE id = ?').run(isWatched ? 1 : 0, id);
    res.json({ success: true, id, isWatched: Boolean(isWatched) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firms', (req, res) => {
  try {
    const {
      name,
      shortName,
      vaultRank = null,
      amLawRevenueRank = null,
      dealVolumeTier = 'Custom Watched Firm',
      headquarters = 'United States',
      coreStrengths = ['Corporate', 'Litigation'],
    } = req.body;
    if (!name || !shortName) {
      return res.status(400).json({ error: 'Name and shortName are required' });
    }
    const id = shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    db.prepare(`
      INSERT INTO law_firms (
        id, name, short_name, vault_rank, amlaw_revenue_rank,
        deal_volume_tier, headquarters, core_strengths_json, aliases_json, is_watched
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        short_name = excluded.short_name,
        is_watched = 1
    `).run(
      id,
      name,
      shortName,
      vaultRank ? Number(vaultRank) : null,
      amLawRevenueRank ? Number(amLawRevenueRank) : null,
      dealVolumeTier,
      headquarters,
      JSON.stringify(Array.isArray(coreStrengths) ? coreStrengths : [coreStrengths]),
      JSON.stringify([shortName.toLowerCase(), name.toLowerCase()])
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Bookmarks & Read Status
 */
app.post('/api/articles/:id/bookmark', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT is_bookmarked FROM articles WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Article not found' });
    const nextState = row.is_bookmarked ? 0 : 1;
    db.prepare('UPDATE articles SET is_bookmarked = ? WHERE id = ?').run(nextState, id);
    res.json({ id, isBookmarked: Boolean(nextState) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/articles/:id/read-status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const nextStatus = status === 'unread' ? 'unread' : 'read';
    db.prepare('UPDATE articles SET read_status = ?, last_read_at = ? WHERE id = ?').run(
      nextStatus,
      nextStatus === 'read' ? new Date().toISOString() : null,
      id
    );
    res.json({ id, readStatus: nextStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Personal Glossary & Progressive Learning CRUD
 */
app.get('/api/glossary', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM glossary_concepts ORDER BY updated_at DESC').all();
    res.json({
      concepts: rows.map((r) => ({
        id: r.id,
        term: r.term,
        categoryId: r.category_id,
        shortDefinition: r.short_definition,
        beginner: r.beginner_text,
        intermediate: r.intermediate_text,
        advanced: r.advanced_text,
        practicalExample: r.practical_example,
        encounterCount: r.encounter_count,
        masteryLevel: r.mastery_level,
        sourceArticleIds: JSON.parse(r.source_article_ids_json || '[]'),
        savedAt: r.saved_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/glossary', (req, res) => {
  try {
    const {
      term,
      categoryId = 'corporate-ma',
      shortDefinition = '',
      beginner = '',
      intermediate = '',
      advanced = '',
      practicalExample = '',
      articleId = null,
      masteryLevel = 'familiar',
    } = req.body;

    if (!term) return res.status(400).json({ error: 'Concept term is required' });
    const nowIso = new Date().toISOString();
    const existing = db
      .prepare('SELECT * FROM glossary_concepts WHERE LOWER(term) = LOWER(?)')
      .get(term);

    if (existing) {
      const sourceIds = JSON.parse(existing.source_article_ids_json || '[]');
      if (articleId && !sourceIds.includes(articleId)) sourceIds.push(articleId);
      db.prepare(`
        UPDATE glossary_concepts
        SET short_definition = ?, beginner_text = ?, intermediate_text = ?,
            advanced_text = ?, practical_example = ?, mastery_level = ?,
            source_article_ids_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        shortDefinition || existing.short_definition,
        beginner || existing.beginner_text,
        intermediate || existing.intermediate_text,
        advanced || existing.advanced_text,
        practicalExample || existing.practical_example,
        masteryLevel || existing.mastery_level,
        JSON.stringify(sourceIds),
        nowIso,
        existing.id
      );
      return res.json({ success: true, id: existing.id, updated: true });
    }

    const id = 'concept-' + crypto.randomBytes(6).toString('hex');
    db.prepare(`
      INSERT INTO glossary_concepts (
        id, term, category_id, short_definition, beginner_text,
        intermediate_text, advanced_text, practical_example,
        encounter_count, mastery_level, source_article_ids_json, saved_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(
      id,
      term,
      categoryId,
      shortDefinition,
      beginner,
      intermediate,
      advanced,
      practicalExample,
      masteryLevel,
      JSON.stringify(articleId ? [articleId] : []),
      nowIso,
      nowIso
    );
    res.json({ success: true, id, updated: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/glossary/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { masteryLevel } = req.body;
    db.prepare('UPDATE glossary_concepts SET mastery_level = ?, updated_at = ? WHERE id = ?').run(
      masteryLevel,
      new Date().toISOString(),
      id
    );
    res.json({ success: true, id, masteryLevel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/glossary/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM glossary_concepts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Research Notebook CRUD
 */
app.get('/api/notes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM research_notes ORDER BY updated_at DESC').all();
    res.json({
      notes: rows.map((n) => ({
        id: n.id,
        articleId: n.article_id,
        title: n.title,
        noteType: n.note_type,
        content: n.content,
        tags: JSON.parse(n.tags_json || '[]'),
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const {
      articleId = null,
      title,
      noteType = 'academic_question',
      content,
      tags = [],
    } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const id = 'note-' + crypto.randomBytes(6).toString('hex');
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO research_notes (id, article_id, title, note_type, content, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, articleId, title, noteType, content, JSON.stringify(tags), nowIso, nowIso);
    res.json({
      success: true,
      note: { id, articleId, title, noteType, content, tags, createdAt: nowIso, updatedAt: nowIso },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM research_notes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Weekly Intelligence Digest
 */
app.get('/api/digest', async (req, res) => {
  try {
    const digest = await generateWeeklyDigest({ forceRegenerate: false });
    res.json(digest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/digest/generate', async (req, res) => {
  try {
    const digest = await generateWeeklyDigest({ forceRegenerate: true });
    res.json(digest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Gemini API Settings
 */
app.post('/api/settings/gemini', (req, res) => {
  try {
    const { apiKey, model } = req.body;
    if (typeof apiKey === 'string') {
      setSetting('gemini_api_key', apiKey.trim());
    }
    if (model) {
      setSetting('gemini_model', model);
    }
    const updated = getGeminiConfig();
    res.json({
      success: true,
      hasApiKey: updated.hasApiKey,
      model: updated.model,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static production frontend bundle (`dist/`) for cloud deployment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Scheduled refresh at 07:00 daily and every 6 hours while the server is running
cron.schedule('0 */6 * * *', async () => {
  try {
    console.log('[CrimsonBrief Scheduler] Running scheduled RSS curation refresh...');
    await ingestLivePublicFeeds();
  } catch (err) {
    console.error('[CrimsonBrief Scheduler] Refresh error:', err.message);
  }
});

app.listen(PORT, async () => {
  console.log(`CrimsonBrief API Server listening on http://localhost:${PORT}`);
  // Automatically refresh on startup if database is empty, never refreshed, > 6 hours old, or new feeds were added
  const articleCount = db.prepare('SELECT COUNT(*) as cnt FROM articles').get().cnt;
  const lastRefresh = getSetting('last_rss_refresh');
  const rawStats = getSetting('last_rss_stats');
  let feedsAttemptedLast = 0;
  try {
    if (rawStats) feedsAttemptedLast = JSON.parse(rawStats).feedsAttempted || 0;
  } catch {
    // ignore
  }
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const isStale =
    articleCount === 0 ||
    feedsAttemptedLast < PUBLIC_RSS_SOURCES.length ||
    !lastRefresh ||
    Date.now() - new Date(lastRefresh).getTime() > sixHoursMs;

  if (isStale) {
    ingestLivePublicFeeds()
      .then((stats) => {
        console.log(
          `[CrimsonBrief Auto-Sync] ${stats.feedsSucceeded}/${stats.feedsAttempted} feeds fetched, ${stats.itemsInserted} live articles curated.`
        );
      })
      .catch((err) => {
        console.warn('[CrimsonBrief Auto-Sync] Offline or feed error:', err.message);
      });
  }
});
