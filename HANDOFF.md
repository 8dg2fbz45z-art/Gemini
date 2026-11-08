# CrimsonBrief — Project Handoff Note

> **How to use this in a new chat**:
> This project already includes `AGENTS.md` (which Antigravity loads into memory automatically in every new chat). You can also start any new chat by saying:
> *"Read `HANDOFF.md` and help me with..."*

---

## 1. Current Status (Live in Production & Local)
- **Live Cloud App**: Hosted on **Render.com** (Free Web Service tier), automatically deployed from GitHub repo **`8dg2fbz45z-art/Gemini`** (`main` branch).
- **Permanent Cloud Database**: **Turso Cloud SQLite** (`libsql://crimsonbrief-8dg2fbz45z-art.aws-ap-south-1.turso.io`) storing all live articles, bookmarks, reading history, personal glossary concepts, research notes, and settings permanently at **$0.00/month**.
- **Local Development**:
  - Folder: `/Users/vir/Desktop/Antigravity`
  - Start command:
    ```bash
    export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
    npm run dev
    ```
  - Local URLs: `http://localhost:5173/` (Mac) and `http://192.168.68.54:5173/` (Phone on same Wi-Fi).

---

## 2. How to Deploy Future Changes to the Live Render App
Whenever you make any code changes in `/Users/vir/Desktop/Antigravity`, run:
```bash
git add .
git commit -m "Describe your update"
git push origin main
```
Render watches `8dg2fbz45z-art/Gemini` (`main` branch) and automatically builds and deploys the update in ~2 minutes.

---

## 3. Core Features Implemented
1. **Home Screen (`src/components/DashboardGrid.jsx`)**:
   - **Daily Spotlight Box** (top of home screen): Automatically selects the **#1 Global Geopolitical/Economic or Indian Law/Politics Story of the Day** (strictly excluding the Harvard column) + shows the **#1 Top Category Today** by significance score.
   - **Direct Insight Boxes**: **Harvard Insight** (verified HLS faculty & Corporate Governance Forum briefs) and **Law Firm Insight** (briefs involving the 15 watched elite US law firms).
   - **7 Core Topic Boxes**: Corporate & M&A, Banking & Finance, Capital Markets, Investment Funds, Technology & AI, Private Equity, and General Legal & International (capped at 15 briefs per category).
2. **One-Thing-at-a-Time Article Reader (`src/components/ArticleReader.jsx`)**:
   - **`1. Article`**: Why This Matters, Executive Summary, and Key Takeaways.
   - **`2. Concept`**: Plain-English legal/financial concept explainer with **`Beginner` / `Intermediate` / `Advanced`** depth buttons + a **"Save Concept"** bookmark button right next to them that saves the concept directly to your Personal Glossary.
   - **`3. Harvard Law`**: Relevant HLS courses, professors, seminar questions, and academic connections.
   - **`4. Law Firms`**: Commercial rationale, deal structuring, and how leading law firms advise on the matter.
3. **Top Navigation Bar (`src/components/Header.jsx`)**:
   - High-contrast Search bar, **Home** button (right next to the Dark Mode button for instant 1-tap return to the home screen), Dark Mode button, Live RSS Sync (`↻`) button, **Saved** library drawer (Bookmarked Articles, Personal Glossary, LL.M. Research Notes, Weekly Digest), and **Settings** button.
4. **Settings & Accessibility (`src/components/GeminiSettingsModal.jsx`)**:
   - Controls for Text Size (`Normal` / `Large` / `Extra Large`), Font Style (`Editorial Serif` / `Clean Sans-Serif`), High-Contrast Accessibility Mode, Dark Mode, Briefs-per-Category Cap (`10` / `15` / `20`), AI Model (`gemini-2.5-pro` default), optional Gemini API Key, and Live RSS / Turso Cloud status monitor.
