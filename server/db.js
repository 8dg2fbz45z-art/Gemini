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

// Automatically load .env from project root if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

// ============================================================================
// TURSO CLOUD SQLITE CONFIGURATION (via Environment Variables)
// ============================================================================
const TURSO_DATABASE_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_AUTH_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();
export const isTursoConfigured = Boolean(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN);

function getTursoPipelineUrl() {
  if (!TURSO_DATABASE_URL) return null;
  const httpBase = TURSO_DATABASE_URL
    .replace(/^libsql:\/\//i, 'https://')
    .replace(/^wss:\/\//i, 'https://')
    .replace(/\/$/, '');
  return `${httpBase}/v2/pipeline`;
}

function encodeTursoArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'boolean') return { type: 'integer', value: val ? '1' : '0' };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { type: 'integer', value: String(val) }
      : { type: 'float', value: val };
  }
  return { type: 'text', value: String(val) };
}

function decodeTursoRows(result) {
  if (!result || !Array.isArray(result.cols) || !Array.isArray(result.rows)) return [];
  const colNames = result.cols.map((c) => c.name);
  return result.rows.map((rowCells) => {
    const obj = {};
    rowCells.forEach((cell, idx) => {
      const colName = colNames[idx];
      if (!cell || cell.type === 'null') {
        obj[colName] = null;
      } else if (cell.type === 'integer' || cell.type === 'float') {
        obj[colName] = Number(cell.value);
      } else {
        obj[colName] = String(cell.value ?? '');
      }
    });
    return obj;
  });
}

/**
 * Executes one or more SQL statements directly on Turso Cloud SQLite via Hrana v2 HTTP API.
 */
export async function executeTursoBatch(statements = []) {
  if (!isTursoConfigured || statements.length === 0) return [];
  const pipelineUrl = getTursoPipelineUrl();

  const requests = statements.map((s) => {
    if (typeof s === 'string') {
      return { type: 'execute', stmt: { sql: s } };
    }
    return {
      type: 'execute',
      stmt: {
        sql: s.sql,
        args: (s.args || []).map(encodeTursoArg),
      },
    };
  });
  requests.push({ type: 'close' });

  const response = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Turso HTTP error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return (data.results || []).map((r) => {
    if (r.type === 'error') {
      throw new Error(`Turso SQL error: ${r.error?.message || JSON.stringify(r.error)}`);
    }
    return r.response?.result ? decodeTursoRows(r.response.result) : [];
  });
}

export async function executeTursoSingle(sql, args = []) {
  const results = await executeTursoBatch([{ sql, args }]);
  return results[0] || [];
}

// ============================================================================
// LOCAL SQLITE ENGINE + AUTOMATIC REAL-TIME TURSO CLOUD MIRRORING
// ============================================================================
const dbPath = path.join(dataDir, 'crimsonbrief.sqlite');
const rawDb = new DatabaseSync(dbPath);

rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

const WRITE_SQL_REGEX = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i;

/**
 * Wrapped `db` interface:
 * - Reads execute in <0.5ms against local SQLite cache
 * - Writes (`run` / `exec`) execute locally AND immediately persist to Turso Cloud SQLite
 *   whenever `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.
 */
export const db = {
  exec(sql) {
    const res = rawDb.exec(sql);
    if (isTursoConfigured && WRITE_SQL_REGEX.test(sql)) {
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      executeTursoBatch(statements).catch((err) => {
        console.warn('[Turso Sync] Background exec warning:', err.message);
      });
    }
    return res;
  },

  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    const isWrite = WRITE_SQL_REGEX.test(sql);

    return {
      get(...args) {
        return stmt.get(...args);
      },
      all(...args) {
        return stmt.all(...args);
      },
      run(...args) {
        const result = stmt.run(...args);
        if (isTursoConfigured && isWrite) {
          executeTursoSingle(sql, args).catch((err) => {
            console.warn('[Turso Sync] Write mirror warning:', err.message);
          });
        }
        return result;
      },
    };
  },
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS articles (
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
    score_breakdown_json TEXT DEFAULT '{}',
    read_status TEXT DEFAULT 'unread',
    last_read_at TEXT DEFAULT NULL,
    is_bookmarked INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS article_analyses (
    article_id TEXT PRIMARY KEY,
    model_used TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS law_firms (
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
  )`,
  `CREATE TABLE IF NOT EXISTS glossary_concepts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS research_notes (
    id TEXT PRIMARY KEY,
    article_id TEXT DEFAULT NULL,
    title TEXT NOT NULL,
    note_type TEXT DEFAULT 'academic_question',
    content TEXT NOT NULL,
    tags_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS weekly_digests (
    id TEXT PRIMARY KEY,
    week_label TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    digest_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

// Immediately ensure local SQLite tables exist synchronously on module load
for (const stmt of SCHEMA_STATEMENTS) {
  rawDb.exec(stmt);
}
try {
  rawDb.exec(`ALTER TABLE articles ADD COLUMN score_breakdown_json TEXT DEFAULT '{}'`);
} catch {
  // Column already exists
}

/**
 * Pulls all permanent user state (bookmarks, glossary concepts, notes, settings, firms, articles)
 * from Turso Cloud into the local SQLite engine when the container boots up on Render.
 */
async function syncFromTursoCloudOnBoot() {
  if (!isTursoConfigured) return;

  console.log('[Turso Cloud] Connecting to Turso SQLite database...');
  await executeTursoBatch(SCHEMA_STATEMENTS);

  const [
    remoteArticles,
    remoteAnalyses,
    remoteFirms,
    remoteGlossary,
    remoteNotes,
    remoteDigests,
    remoteSettings,
  ] = await executeTursoBatch([
    'SELECT * FROM articles WHERE is_sample = 0',
    'SELECT * FROM article_analyses',
    'SELECT * FROM law_firms',
    'SELECT * FROM glossary_concepts',
    'SELECT * FROM research_notes',
    'SELECT * FROM weekly_digests',
    'SELECT * FROM app_settings',
  ]);

  // 1. Restore Law Firms
  if (remoteFirms.length > 0) {
    const upsertFirm = rawDb.prepare(`
      INSERT INTO law_firms (
        id, name, short_name, vault_rank, amlaw_revenue_rank,
        deal_volume_tier, headquarters, core_strengths_json, aliases_json, is_watched
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET is_watched = excluded.is_watched
    `);
    for (const f of remoteFirms) {
      upsertFirm.run(
        f.id,
        f.name,
        f.short_name,
        f.vault_rank,
        f.amlaw_revenue_rank,
        f.deal_volume_tier,
        f.headquarters,
        f.core_strengths_json,
        f.aliases_json,
        f.is_watched
      );
    }
  }

  // 2. Restore Articles (including Bookmarks & Read History)
  if (remoteArticles.length > 0) {
    const upsertArt = rawDb.prepare(`
      INSERT INTO articles (
        id, title, url, source_name, source_type, author,
        published_at, fetched_at, category_id, significance_score,
        why_this_matters, summary, content_raw, is_sample,
        is_faculty_authored, contributor_type, verified_professor_id,
        story_cluster_id, matched_firms_json, read_status, last_read_at, is_bookmarked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        read_status = excluded.read_status,
        last_read_at = excluded.last_read_at,
        is_bookmarked = excluded.is_bookmarked
    `);
    for (const a of remoteArticles) {
      upsertArt.run(
        a.id,
        a.title,
        a.url,
        a.source_name,
        a.source_type,
        a.author,
        a.published_at,
        a.fetched_at,
        a.category_id,
        a.significance_score,
        a.why_this_matters,
        a.summary,
        a.content_raw,
        a.is_faculty_authored,
        a.contributor_type,
        a.verified_professor_id,
        a.story_cluster_id,
        a.matched_firms_json,
        a.read_status,
        a.last_read_at,
        a.is_bookmarked
      );
    }
  }

  // 3. Restore Cached AI Analyses
  if (remoteAnalyses.length > 0) {
    const upsertAn = rawDb.prepare(`
      INSERT OR REPLACE INTO article_analyses (article_id, model_used, generated_at, analysis_json)
      VALUES (?, ?, ?, ?)
    `);
    for (const an of remoteAnalyses) {
      try {
        upsertAn.run(an.article_id, an.model_used, an.generated_at, an.analysis_json);
      } catch {
        // ignore if parent article was pruned
      }
    }
  }

  // 4. Restore Personal Glossary Concepts
  if (remoteGlossary.length > 0) {
    const upsertGloss = rawDb.prepare(`
      INSERT OR REPLACE INTO glossary_concepts (
        id, term, category_id, short_definition, beginner_text,
        intermediate_text, advanced_text, practical_example,
        encounter_count, mastery_level, source_article_ids_json, saved_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const g of remoteGlossary) {
      upsertGloss.run(
        g.id,
        g.term,
        g.category_id,
        g.short_definition,
        g.beginner_text,
        g.intermediate_text,
        g.advanced_text,
        g.practical_example,
        g.encounter_count,
        g.mastery_level,
        g.source_article_ids_json,
        g.saved_at,
        g.updated_at
      );
    }
  }

  // 5. Restore Research Notes
  if (remoteNotes.length > 0) {
    const upsertNote = rawDb.prepare(`
      INSERT OR REPLACE INTO research_notes (
        id, article_id, title, note_type, content, tags_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const n of remoteNotes) {
      upsertNote.run(
        n.id,
        n.article_id,
        n.title,
        n.note_type,
        n.content,
        n.tags_json,
        n.created_at,
        n.updated_at
      );
    }
  }

  // 6. Restore Weekly Digests
  if (remoteDigests.length > 0) {
    const upsertDigest = rawDb.prepare(`
      INSERT OR REPLACE INTO weekly_digests (id, week_label, generated_at, digest_json)
      VALUES (?, ?, ?, ?)
    `);
    for (const d of remoteDigests) {
      upsertDigest.run(d.id, d.week_label, d.generated_at, d.digest_json);
    }
  }

  // 7. Restore App Settings
  if (remoteSettings.length > 0) {
    const upsertSetting = rawDb.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
    `);
    for (const s of remoteSettings) {
      upsertSetting.run(s.key, s.value);
    }
  }

  // 8. If Turso Cloud is newly created (0 articles in Turso, but local DB has data), push local data up to Turso
  if (remoteArticles.length === 0) {
    const localFirms = rawDb.prepare('SELECT * FROM law_firms').all();
    const localArticles = rawDb.prepare('SELECT * FROM articles WHERE is_sample = 0').all();
    const localGlossary = rawDb.prepare('SELECT * FROM glossary_concepts').all();
    const localNotes = rawDb.prepare('SELECT * FROM research_notes').all();
    const localSettings = rawDb.prepare('SELECT * FROM app_settings').all();

    const uploadBatch = [];
    for (const f of localFirms) {
      uploadBatch.push({
        sql: `INSERT OR IGNORE INTO law_firms (id, name, short_name, vault_rank, amlaw_revenue_rank, deal_volume_tier, headquarters, core_strengths_json, aliases_json, is_watched) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [f.id, f.name, f.short_name, f.vault_rank, f.amlaw_revenue_rank, f.deal_volume_tier, f.headquarters, f.core_strengths_json, f.aliases_json, f.is_watched],
      });
    }
    for (const g of localGlossary) {
      uploadBatch.push({
        sql: `INSERT OR IGNORE INTO glossary_concepts (id, term, category_id, short_definition, beginner_text, intermediate_text, advanced_text, practical_example, encounter_count, mastery_level, source_article_ids_json, saved_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [g.id, g.term, g.category_id, g.short_definition, g.beginner_text, g.intermediate_text, g.advanced_text, g.practical_example, g.encounter_count, g.mastery_level, g.source_article_ids_json, g.saved_at, g.updated_at],
      });
    }
    for (const n of localNotes) {
      uploadBatch.push({
        sql: `INSERT OR IGNORE INTO research_notes (id, article_id, title, note_type, content, tags_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [n.id, n.article_id, n.title, n.note_type, n.content, n.tags_json, n.created_at, n.updated_at],
      });
    }
    for (const s of localSettings) {
      uploadBatch.push({
        sql: `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
        args: [s.key, s.value],
      });
    }
    for (const a of localArticles) {
      uploadBatch.push({
        sql: `INSERT OR IGNORE INTO articles (id, title, url, source_name, source_type, author, published_at, fetched_at, category_id, significance_score, why_this_matters, summary, content_raw, is_sample, is_faculty_authored, contributor_type, verified_professor_id, story_cluster_id, matched_firms_json, read_status, last_read_at, is_bookmarked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [a.id, a.title, a.url, a.source_name, a.source_type, a.author, a.published_at, a.fetched_at, a.category_id, a.significance_score, a.why_this_matters, a.summary, a.content_raw, a.is_faculty_authored, a.contributor_type, a.verified_professor_id, a.story_cluster_id, a.matched_firms_json, a.read_status, a.last_read_at, a.is_bookmarked],
      });
    }

    for (let i = 0; i < uploadBatch.length; i += 25) {
      await executeTursoBatch(uploadBatch.slice(i, i + 25));
    }
    console.log(
      `[Turso Cloud] Initialized new Turso database with ${localArticles.length} live articles, ${localFirms.length} firms, and ${localGlossary.length} glossary concepts.`
    );
  } else {
    console.log(
      `[Turso Cloud] Synced ${remoteArticles.length} articles, ${remoteGlossary.length} saved concepts, and ${remoteNotes.length} notes from Turso.`
    );
  }
}

export async function initializeDatabase() {
  for (const stmt of SCHEMA_STATEMENTS) {
    rawDb.exec(stmt);
  }

  // Ensure zero sample/synthetic articles exist — 100% of articles come from real live RSS feeds
  rawDb.prepare('DELETE FROM articles WHERE is_sample = 1').run();

  // If Turso Cloud is configured via env vars, hydrate state from Turso first
  if (isTursoConfigured) {
    try {
      await syncFromTursoCloudOnBoot();
    } catch (err) {
      console.error('[Turso Cloud] Initial sync error (falling back to local SQLite):', err.message);
    }
  }

  // Seed Law Firms if empty
  const firmCount = rawDb.prepare('SELECT COUNT(*) as count FROM law_firms').get().count;
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

  const nowIso = new Date().toISOString();

  // Seed initial glossary concept if empty
  const glossaryCount = rawDb.prepare('SELECT COUNT(*) as count FROM glossary_concepts').get().count;
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
      JSON.stringify([]),
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
