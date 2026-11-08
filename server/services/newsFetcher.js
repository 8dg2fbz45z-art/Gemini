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
} from './curationFilter.js';

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
      story_cluster_id, matched_firms_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
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

      const summaryText = cleanHtml(rawItem.contentSnippet || rawItem.summary || rawItem.content || '').slice(0, 520);
      const fullContent = cleanHtml(rawItem['content:encoded'] || rawItem.content || rawItem.summary || summaryText);
      const author = cleanHtml(rawItem.creator || rawItem.author || rawItem['dc:creator'] || source.name);
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

      // 4. Multi-factor Curation Score
      const significance = computeSignificanceScore(candidate, matchedFirmIds, authorshipInfo, source.credibilityWeight);
      if (!significance.eligible) {
        stats.lowImpactFiltered++;
        continue;
      }

      // 5. Classify into one of the 7 Categories
      const categoryId = classifyCategory(candidate, source.defaultCategory);

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
        JSON.stringify(matchedFirmIds)
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

  setSetting('last_rss_refresh', nowIso);
  setSetting('last_rss_stats', JSON.stringify(stats));
  pruneExcessArticlesPerCategory(15);
  return stats;
}

/**
 * Keeps at most `maxPerCategory` (default 15) unbookmarked articles per category
 * ordered by significance_score DESC and published_at DESC so feeds never become overwhelming.
 */
export function pruneExcessArticlesPerCategory(maxPerCategory = 15) {
  const categoryRows = db.prepare('SELECT DISTINCT category_id FROM articles').all();
  for (const { category_id } of categoryRows) {
    const excessRows = db
      .prepare(
        `SELECT id FROM articles
         WHERE category_id = ? AND is_bookmarked = 0
         ORDER BY significance_score DESC, published_at DESC
         LIMIT -1 OFFSET ?`
      )
      .all(category_id, maxPerCategory);

    if (excessRows.length > 0) {
      const delStmt = db.prepare('DELETE FROM articles WHERE id = ?');
      for (const r of excessRows) {
        delStmt.run(r.id);
      }
    }
  }
}
