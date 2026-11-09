import Parser from 'rss-parser';
import crypto from 'node:crypto';
import { db, setSetting } from '../db.js';
import { PUBLIC_RSS_SOURCES } from '../data/verifiedRegistries.js';
import {
  matchLawFirms,
  classifyAcademicAuthorship,
  classifyCategory,
  computeSignificanceScore,
  generateBaselineWhyThisMatters,
  deduplicateAndAssignCluster,
  normalizeUrl,
  isRoundupOrDirectoryPage,
  extractTokens,
} from './curationFilter.js';
import {
  cleanHtmlPreserveParagraphs,
  extractPublisherFromHeadline,
  enrichArticleContentIfNeeded,
  isPaywalledSource,
} from './articleExtractor.js';

const parser = new Parser({
  timeout: 8500,
  headers: {
    'User-Agent': 'CrimsonBrief/2.0 (Academic & Legal Research Intelligence Reader; +https://hls.harvard.edu)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
});

function cleanHtml(raw = '') {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function ingestLivePublicFeeds() {
  const allFirms = db.prepare('SELECT * FROM law_firms').all();
  const existingArticles = db
    .prepare('SELECT id, title, url, summary, story_cluster_id, is_sample FROM articles ORDER BY published_at DESC LIMIT 400')
    .all();

  const insertStmt = db.prepare(`
    INSERT INTO articles (
      id, title, url, source_name, source_type, author,
      published_at, fetched_at, category_id, significance_score,
      why_this_matters, summary, content_raw, is_sample,
      is_faculty_authored, contributor_type, verified_professor_id,
      story_cluster_id, matched_firms_json, score_breakdown_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const updateClusterStmt = db.prepare(`
    UPDATE articles SET story_cluster_id = ? WHERE id = ? AND story_cluster_id IS NULL
  `);

  const stats = {
    feedsAttempted: PUBLIC_RSS_SOURCES.length,
    feedsSucceeded: 0,
    itemsScanned: 0,
    itemsInserted: 0,
    duplicatesSkipped: 0,
    lowImpactFiltered: 0,
    newlyInsertedIds: [],
    feedErrors: [],
  };

  const results = await Promise.allSettled(
    PUBLIC_RSS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      return { source, items: (feed.items || []).slice(0, 18) };
    })
  );

  const nowIso = new Date().toISOString();

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const source = PUBLIC_RSS_SOURCES[i];
    if (res.status !== 'fulfilled') {
      stats.feedErrors.push({
        source: source.name,
        error: res.reason?.message || 'Feed unreachable',
      });
      continue;
    }

    stats.feedsSucceeded++;
    for (const rawItem of res.value.items) {
      stats.itemsScanned++;
      const title = cleanHtml(rawItem.title || '');
      const url = normalizeUrl(rawItem.link || rawItem.guid || '');
      if (!title || !url) continue;

      const summaryText = cleanHtml(rawItem.contentSnippet || rawItem.summary || rawItem.content || '').slice(0, 650);
      const fullContent =
        cleanHtmlPreserveParagraphs(rawItem['content:encoded'] || rawItem.content || rawItem.summary || '') ||
        summaryText;
      const { publisher: extractedPublisher } = extractPublisherFromHeadline(title);
      const rawCreator = cleanHtml(rawItem.creator || rawItem.author || rawItem['dc:creator'] || '');
      const author =
        rawCreator && rawCreator.toLowerCase() !== source.name.toLowerCase()
          ? rawCreator
          : extractedPublisher || '';
      const publishedAt = rawItem.isoDate || (rawItem.pubDate ? new Date(rawItem.pubDate).toISOString() : nowIso);

      const candidate = {
        title,
        url,
        sourceName: source.name,
        sourceType: source.sourceType,
        author,
        publishedAt,
        summary: summaryText || title,
        contentRaw: fullContent || summaryText || title,
      };

      // 1. Deduplication & Story Clustering
      const dedup = deduplicateAndAssignCluster(candidate, existingArticles);
      if (dedup.isDuplicate) {
        stats.duplicatesSkipped++;
        continue;
      }

      // 2. Match Watched Law Firms
      const matchedFirmIds = matchLawFirms(candidate, allFirms);

      // 3. Verify Academic / HLS Faculty Authorship
      const authorshipInfo = classifyAcademicAuthorship(candidate, matchedFirmIds);

      // 4. Classify into one of the 7 Categories (category-sensitive)
      const categoryId = classifyCategory(candidate, source.defaultCategory);

      // 5. 7-Criterion Substance Score (0–100)
      const significance = computeSignificanceScore(
        candidate,
        matchedFirmIds,
        authorshipInfo,
        source.credibilityWeight,
        categoryId
      );
      if (!significance.eligible) {
        stats.lowImpactFiltered++;
        continue;
      }

      // 6. Generate Baseline "Why This Matters"
      const whyThisMatters = generateBaselineWhyThisMatters(
        candidate,
        categoryId,
        matchedFirmIds,
        allFirms,
        authorshipInfo
      );

      const articleId = 'live-' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 14);

      if (dedup.linkedToArticleId && dedup.storyClusterId) {
        updateClusterStmt.run(dedup.storyClusterId, dedup.linkedToArticleId);
      }

      const info = insertStmt.run(
        articleId,
        title,
        url,
        source.name,
        source.sourceType,
        author,
        publishedAt,
        nowIso,
        categoryId,
        significance.score,
        whyThisMatters,
        candidate.summary,
        candidate.contentRaw,
        authorshipInfo.isFacultyAuthored ? 1 : 0,
        authorshipInfo.contributorType,
        authorshipInfo.verifiedProfessorId,
        dedup.storyClusterId,
        JSON.stringify(matchedFirmIds),
        JSON.stringify(significance.breakdown || {})
      );

      if (info.changes > 0) {
        stats.itemsInserted++;
        stats.newlyInsertedIds.push(articleId);
        existingArticles.unshift({
          id: articleId,
          title,
          url,
          summary: candidate.summary,
          story_cluster_id: dedup.storyClusterId,
          is_sample: 0,
        });
      }
    }
  }

  // Proactively enrich up to 8 newly inserted articles with full-text paragraphs & best reputed URL
  if (stats.newlyInsertedIds.length > 0) {
    const newRows = db
      .prepare(
        `SELECT * FROM articles WHERE id IN (${stats.newlyInsertedIds
          .slice(0, 8)
          .map(() => '?')
          .join(',')}) ORDER BY significance_score DESC`
      )
      .all(...stats.newlyInsertedIds.slice(0, 8));

    await Promise.allSettled(newRows.map((r) => enrichArticleContentIfNeeded(r)));
  }

  setSetting('last_rss_refresh', nowIso);
  setSetting('last_rss_stats', JSON.stringify(stats));
  pruneExcessArticlesPerCategory(8);
  return stats;
}

/**
 * Enforces a hard limit of 6–8 articles per category (maxPerCategory = 8):
 * 1. Purges any roundup/directory index pages, paywalled articles (NYT/WSJ/FT/Bloomberg),
 *    and removed primary Harvard blog items.
 * 2. Recomputes the 7-criterion (0–100) importance score and breakdown for all existing articles.
 * 3. Rejects weak articles (< 70) — never filling slots with weak articles merely to meet the target.
 * 4. Deduplicates underlying events and enforces diversity of companies/subtopics within each category.
 * 5. Prioritizes substantive developments from the preceding 24 hours without artificially inflating scores,
 *    and caps each category strictly at `maxPerCategory` (8) sorted by `significance_score DESC`.
 */
export function pruneExcessArticlesPerCategory(maxPerCategory = 8) {
  const hardLimit = Math.min(8, Math.max(6, Number(maxPerCategory) || 8));
  const allFirms = db.prepare('SELECT * FROM law_firms').all();
  const allRows = db.prepare('SELECT * FROM articles').all();
  const delStmt = db.prepare('DELETE FROM articles WHERE id = ?');
  const updateScoreStmt = db.prepare(
    'UPDATE articles SET category_id = ?, significance_score = ?, score_breakdown_json = ? WHERE id = ?'
  );

  for (const row of allRows) {
    const candidate = {
      title: row.title,
      url: row.url,
      sourceName: row.source_name,
      sourceType: row.source_type,
      author: row.author,
      publishedAt: row.published_at,
      summary: row.summary,
      contentRaw: row.content_raw,
    };

    const isHarvardBlog =
      (row.source_name || '').toLowerCase().includes('harvard law school forum') ||
      (row.url || '').toLowerCase().includes('corpgov.law.harvard.edu');

    if (
      isRoundupOrDirectoryPage(candidate) ||
      isPaywalledSource(row.url, row.source_name, row.title) ||
      (isHarvardBlog && !row.is_bookmarked)
    ) {
      delStmt.run(row.id);
      continue;
    }

    const matchedFirmIds = JSON.parse(row.matched_firms_json || '[]');
    const authorshipInfo = classifyAcademicAuthorship(candidate, matchedFirmIds);
    const newCategoryId = classifyCategory(candidate, row.category_id);
    const sig = computeSignificanceScore(candidate, matchedFirmIds, authorshipInfo, 9, newCategoryId);

    if (!sig.eligible && !row.is_bookmarked) {
      delStmt.run(row.id);
      continue;
    }

    const breakdownStr = JSON.stringify(sig.breakdown || {});
    if (
      newCategoryId !== row.category_id ||
      sig.score !== row.significance_score ||
      breakdownStr !== (row.score_breakdown_json || '{}')
    ) {
      updateScoreStmt.run(newCategoryId, sig.score, breakdownStr, row.id);
    }
  }

  const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const categoryRows = db.prepare('SELECT DISTINCT category_id FROM articles').all();

  for (const { category_id } of categoryRows) {
    const catArticles = db
      .prepare(
        `SELECT * FROM articles
         WHERE category_id = ?
         ORDER BY
           CASE WHEN significance_score >= 80 AND published_at >= ? THEN 2
                WHEN significance_score >= 80 THEN 1
                ELSE 0 END DESC,
           significance_score DESC,
           CASE WHEN published_at >= ? THEN 1 ELSE 0 END DESC,
           published_at DESC`
      )
      .all(category_id, twentyFourHoursAgoIso, twentyFourHoursAgoIso);

    const keptIds = new Set();
    const seenClusters = new Set();
    const entityCounts = new Map();

    for (const art of catArticles) {
      if (art.is_bookmarked) {
        keptIds.add(art.id);
        continue;
      }
      if (keptIds.size >= hardLimit) {
        continue;
      }

      // Deduplicate articles covering the same story cluster
      if (art.story_cluster_id && seenClusters.has(art.story_cluster_id)) {
        continue;
      }

      // Ensure diversity of companies/entities within the category (at most 2 articles led by the same primary token)
      const tokens = extractTokens(art.title || '').filter((t) => t.length >= 4);
      const leadEntity = tokens[0] || '';
      if (leadEntity && (entityCounts.get(leadEntity) || 0) >= 2) {
        continue;
      }

      keptIds.add(art.id);
      if (art.story_cluster_id) seenClusters.add(art.story_cluster_id);
      if (leadEntity) entityCounts.set(leadEntity, (entityCounts.get(leadEntity) || 0) + 1);
    }

    for (const art of catArticles) {
      if (!keptIds.has(art.id) && !art.is_bookmarked) {
        delStmt.run(art.id);
      }
    }
  }
}
