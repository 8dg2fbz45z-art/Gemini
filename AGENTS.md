# CrimsonBrief — Persistent Agent Memory & Handoff Context

Whenever starting a new chat in `/Users/vir/Desktop/Antigravity`, read this file (and `HANDOFF.md`) first before making changes.

## 1. Project Identity & User Preferences
- **Application**: **CrimsonBrief** — a private, single-user legal, geopolitical/macroeconomic, Indian law, and business intelligence platform tailored for a prospective Harvard Law School (HLS) LL.M. candidate.
- **Design Philosophy**:
  - **Calm, uncluttered, mobile-first reading experience** ("one thing at a time").
  - **No information overload & Unread Protection**: Keep each category capped around **15 briefs** (`pruneExcessArticlesPerCategory(15)`), while **protecting unread high-importance articles (`read_status = 'unread'`) across 6-hour refreshes until the user opens/reads them**, and sorting every category/insight feed strictly by **Importance Score (`significance_score DESC`, #1 Highest on top)**.
  - **100% Real Live Articles Only**: Never seed or display synthetic/sample articles (`is_sample = 1` rows are purged). All articles must come from real, live public RSS feeds with working original URLs.
  - **Spotlight Box Rule**: The `#1 Story of the Day` Spotlight Box at the top of the Home Screen must **never** pull from the Harvard column (`!isFacultyAuthored` and source not Harvard Forum). It must prioritize stories with **International Geopolitical / Economic value** or **Indian Law / Supreme Court of India / SEBI / RBI / CCI / Indian Politics value**.
  - **AI Model Preference**: Default to **Google Gemini 2.5 Pro** (`gemini-2.5-pro`) with automatic free-tier cascade (`gemini-2.5-pro` -> `gemini-2.5-flash` -> `gemini-2.0-flash`) and deterministic local registry fallback so the user never hits a billing error.
  - **100% Free Hosting Constraint**: User requires $0.00/month permanent hosting (Render Free Web Service + Turso Free Cloud SQLite). Do not deploy paid services on Railway.

## 2. Environment & Shell Notes (Mac)
- **Node & npm Path**: Homebrew Node `v26.10.0` is located at `/opt/homebrew/bin/node`. Always prefix shell commands with:
  ```bash
  export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
  ```
- **Local Dev Server**:
  - Run `npm run dev` (starts Express backend on `http://localhost:3001` and Vite frontend with `--host` on `http://localhost:5173` / local network Wi-Fi IP).

## 3. Cloud Deployment & Database Architecture
- **GitHub Repository**: `https://github.com/8dg2fbz45z-art/Gemini.git` (`main` branch).
  - Pushing to `origin main` automatically triggers a redeploy on **Render.com**.
- **Cloud Hosting**: **Render.com** Free Web Service (`render.yaml` + `.node-version` set to `22.14.0`).
  - Note: Keep `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, and `autoprefixer` inside `"dependencies"` in `package.json` so Render builds succeed when `NODE_ENV=production`.
- **Database (Dual-Layer Turso Cloud SQLite + Local SQLite Cache)**:
  - File: `server/db.js`
  - Uses Node's built-in `node:sqlite` (`DatabaseSync`) for `<0.5ms` local reads and mirrors all writes (`INSERT`, `UPDATE`, `DELETE`) in real time to **Turso Cloud SQLite** via Turso's Hrana v2 HTTP pipeline API (`/v2/pipeline`).
  - On startup (`initializeDatabase()`), `syncFromTursoCloudOnBoot()` restores all articles, bookmarks, read history, glossary concepts, research notes, law firm watchlist settings, and cached AI analyses from Turso Cloud.
  - Local `.env` (gitignored) and Render Environment Variables store `TURSO_DATABASE_URL` (`libsql://crimsonbrief-8dg2fbz45z-art.aws-ap-south-1.turso.io`) and `TURSO_AUTH_TOKEN`.

## 4. Key Codebase Map
- `server/index.js`: Express API server, `/api/bootstrap` (calculates Spotlight `#1 Story of the Day` & `Top Category Today`), `/api/articles`, `/api/glossary`, `/api/notes`, `/api/digest`, 6-hour `node-cron` RSS auto-sync, and static `dist/` serving.
- `server/db.js`: SQLite schema + Turso Cloud HTTP `/v2/pipeline` bidirectional sync engine.
- `server/data/verifiedRegistries.js`:
  - `CATEGORIES` (7 core categories: Corporate & M&A, Banking & Finance, Capital Markets, Investment Funds, Technology & AI, Private Equity, General Legal & International).
  - `INITIAL_LAW_FIRMS` (15 elite US law firms separating Vault Rank, AmLaw Revenue Rank, and Deal Volume Tier).
  - `VERIFIED_HLS_FACULTY` (11 verified Harvard Law School professors, courses, and centers).
  - `PUBLIC_RSS_SOURCES` (13 live official RSS feeds including SEC, Fed, NYT DealBook, CNBC, SCOTUSblog, HLS Forum, US Law Firms, PE, Funds, AI, Indian Law/SC/SEBI/RBI/CCI, and Global Geopolitics).
- `server/services/curationFilter.js`: Multi-factor significance scoring (`0–100`), promotional fluff filtering, strict HLS faculty vs. guest/student verification, and URL/Jaccard deduplication.
- `server/services/newsFetcher.js`: Live RSS ingestion and `pruneExcessArticlesPerCategory(15)`.
- `server/services/llmProcessor.js` & `server/services/prompts.js`: 6-part article analysis generator (Overview, 3-Depth Concept Explainer, Commercial Implications, Academic Synergies, Professor Connections, Further Reading).
- `src/App.jsx`: Main state & navigation (`Home Grid` -> `Category/Insight Feed` -> `Article Reader`), plus accessibility/font/theme persistence.
- `src/components/Header.jsx`: Top bar with Search, **Home** button (right next to Dark Mode toggle), Dark Mode toggle, Live Feed Refresh (`↻`), **Saved** drawer button, and **Settings** button.
- `src/components/DashboardGrid.jsx`: Home screen with **Spotlight Box (#1 Global & Indian Law/Econ Story + Top Category Today)** at the top, followed by **Harvard Insight**, **Law Firm Insight**, and the **7 Category Boxes**.
- `src/components/ArticleReader.jsx`: 4-tab progressive reader (`1. Article`, `2. Concept`, `3. Harvard Law`, `4. Law Firms`) with a **Save Concept** bookmark button right next to `Beginner / Intermediate / Advanced` inside `2. Concept`.
- `src/components/GeminiSettingsModal.jsx`: Settings & Accessibility control panel (Text Size, Font Style, Accessibility Mode, Dark Mode, Daily Briefs Cap, Gemini Model/Key, and Live Feed/Turso Status).
