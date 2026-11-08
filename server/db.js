import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_LAW_FIRMS } from './data/verifiedRegistries.js';
import { SAMPLE_BASELINE_ARTICLES } from './data/sampleBaseline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crimsonbrief.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and durability
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT DEFAULT 'journalism',
      author TEXT DEFAULT '',
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      category_id TEXT NOT NULL,
      significance_score INTEGER DEFAULT 50,
      why_this_matters TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      content_raw TEXT DEFAULT '',
      is_sample INTEGER DEFAULT 0,
      is_faculty_authored INTEGER DEFAULT 0,
      contributor_type TEXT DEFAULT 'journalist',
      verified_professor_id TEXT DEFAULT NULL,
      story_cluster_id TEXT DEFAULT NULL,
      matched_firms_json TEXT DEFAULT '[]',
      read_status TEXT DEFAULT 'unread',
      last_read_at TEXT DEFAULT NULL,
      is_bookmarked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS article_analyses (
      article_id TEXT PRIMARY KEY,
      model_used TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      analysis_json TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS law_firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      vault_rank INTEGER,
      amlaw_revenue_rank INTEGER,
      deal_volume_tier TEXT DEFAULT '',
      headquarters TEXT DEFAULT '',
      core_strengths_json TEXT DEFAULT '[]',
      aliases_json TEXT DEFAULT '[]',
      is_watched INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS glossary_concepts (
      id TEXT PRIMARY KEY,
      term TEXT UNIQUE NOT NULL,
      category_id TEXT NOT NULL,
      short_definition TEXT NOT NULL,
      beginner_text TEXT DEFAULT '',
      intermediate_text TEXT DEFAULT '',
      advanced_text TEXT DEFAULT '',
      practical_example TEXT DEFAULT '',
      encounter_count INTEGER DEFAULT 1,
      mastery_level TEXT DEFAULT 'familiar',
      source_article_ids_json TEXT DEFAULT '[]',
      saved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_notes (
      id TEXT PRIMARY KEY,
      article_id TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      note_type TEXT DEFAULT 'academic_question',
      content TEXT NOT NULL,
      tags_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_digests (
      id TEXT PRIMARY KEY,
      week_label TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      digest_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed Law Firms if empty
  const firmCount = db.prepare('SELECT COUNT(*) as count FROM law_firms').get().count;
  if (firmCount === 0) {
    const insertFirm = db.prepare(`
      INSERT INTO law_firms (
        id, name, short_name, vault_rank, amlaw_revenue_rank,
        deal_volume_tier, headquarters, core_strengths_json, aliases_json, is_watched
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of INITIAL_LAW_FIRMS) {
      insertFirm.run(
        f.id,
        f.name,
        f.shortName,
        f.vaultRank,
        f.amLawRevenueRank,
        f.dealVolumeTier,
        f.headquarters,
        JSON.stringify(f.coreStrengths),
        JSON.stringify(f.aliases),
        f.isWatched ? 1 : 0
      );
    }
  }

  // Upsert Sample Baseline Articles and their Cached Analyses
  const upsertArticle = db.prepare(`
    INSERT INTO articles (
      id, title, url, source_name, source_type, author,
      published_at, fetched_at, category_id, significance_score,
      why_this_matters, summary, content_raw, is_sample,
      is_faculty_authored, contributor_type, verified_professor_id,
      story_cluster_id, matched_firms_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      significance_score = excluded.significance_score,
      why_this_matters = excluded.why_this_matters,
      summary = excluded.summary,
      matched_firms_json = excluded.matched_firms_json,
      story_cluster_id = excluded.story_cluster_id,
      verified_professor_id = excluded.verified_professor_id
  `);

  const upsertAnalysis = db.prepare(`
    INSERT INTO article_analyses (article_id, model_used, generated_at, analysis_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(article_id) DO UPDATE SET
      analysis_json = excluded.analysis_json
  `);

  const nowIso = new Date().toISOString();
  for (const item of SAMPLE_BASELINE_ARTICLES) {
    upsertArticle.run(
      item.id,
      item.title,
      item.url,
      item.sourceName,
      item.sourceType,
      item.author,
      item.publishedAt,
      nowIso,
      item.categoryId,
      item.significanceScore,
      item.whyThisMatters,
      item.summary,
      item.analysis.detailedOverview.narrative.join('\n\n'),
      item.isSample ? 1 : 0,
      item.isFacultyAuthored ? 1 : 0,
      item.isFacultyAuthored ? 'verified_hls_faculty' : 'regulatory_or_journalism',
      item.verifiedProfessorId || null,
      item.storyClusterId || null,
      JSON.stringify(item.matchedFirms || [])
    );

    if (item.analysis) {
      upsertAnalysis.run(
        item.id,
        item.analysis.modelUsed,
        item.analysis.generatedAt,
        JSON.stringify(item.analysis)
      );
    }
  }

  // Seed initial glossary concepts if empty so Progressive Learning is immediately demonstrable
  const glossaryCount = db.prepare('SELECT COUNT(*) as count FROM glossary_concepts').get().count;
  if (glossaryCount === 0) {
    const insertGlossary = db.prepare(`
      INSERT INTO glossary_concepts (
        id, term, category_id, short_definition, beginner_text,
        intermediate_text, advanced_text, practical_example,
        encounter_count, mastery_level, source_article_ids_json, saved_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const firstSample = SAMPLE_BASELINE_ARTICLES[0];
    const ce = firstSample.analysis.conceptExplainer;
    insertGlossary.run(
      'concept-mfw-entire-fairness',
      ce.conceptTerm,
      ce.categoryId,
      ce.shortDefinition,
      ce.beginner,
      ce.intermediate,
      ce.advanced,
      ce.practicalExample,
      2,
      'familiar',
      JSON.stringify([firstSample.id]),
      nowIso,
      nowIso
    );
  }

  // Seed a sample research note if empty
  const notesCount = db.prepare('SELECT COUNT(*) as count FROM research_notes').get().count;
  if (notesCount === 0) {
    db.prepare(`
      INSERT INTO research_notes (id, article_id, title, note_type, content, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'note-initial-1',
      'sample-corp-ma-1',
      'Controller Governance & Statutory Private Ordering (Match Group vs. DGCL § 122(18))',
      'academic_question',
      'Compare the Delaware Supreme Court’s strict insistence on 100% special committee independence and dual MFW cleansing in Match Group with the legislature’s rapid enactment of DGCL § 122(18) after Moelis. Key research theme for HLS Corporate Governance seminar: when should mandatory fiduciary baselines override bilateral stockholder contracts?',
      JSON.stringify(['Corporations', 'Lucian Bebchuk', 'Guhan Subramanian', 'Delaware Law']),
      nowIso,
      nowIso
    );
  }
}

export function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}
