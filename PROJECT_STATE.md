# CrimsonBrief — Project State & Architecture

## Overview
Private, single-user legal and commercial intelligence platform designed for a prospective Harvard Law School LL.M. candidate.

## Running the Application
- **Development Server (Active)**: `npm run dev`
  - **Frontend UI**: http://localhost:5173
  - **Backend API**: http://localhost:3001
- **Live RSS Ingestion CLI**: `node server/ingestCli.js`
- **Verification Suite**: `npm run test:verify` (`node server/verify.js`)

## Completed Architecture & Milestones
- [x] **Stage 1 — Persistent SQLite Storage & Verified Registries**:
  - `server/db.js` using Node's built-in `node:sqlite` (`server/data/crimsonbrief.sqlite`).
  - `server/data/verifiedRegistries.js` defining the 7 categories, 15 leading US law firms (tracking **Vault Prestige Rank**, **Am Law Gross Revenue Rank**, and **Deal/Case Volume Tier** as distinct measures), 11 verified Harvard Law School faculty profiles & courses, verified peer US law school centers, and 11 public RSS sources.
  - `server/data/sampleBaseline.js` providing explicitly badged `[SAMPLE BASELINE]` reference articles for offline testing alongside 213+ real, verified live RSS articles in SQLite.
- [x] **Stage 2 — Intelligent Curation, Deduplication & Authorship Verification**:
  - `server/services/curationFilter.js` implementing multi-factor significance scoring, promotional/routine announcement rejection, URL + Jaccard token deduplication, chronological story clustering (`story_cluster_id`), and strict HLS faculty vs. guest practitioner vs. student authorship classification.
- [x] **Stage 3 — Google Gemini 6-Part Deep Analysis Pipeline**:
  - `server/services/prompts.js` and `server/services/llmProcessor.js` generating:
    - **A. Detailed Article Overview** (with explicit Epistemic Breakdown: *Verified Facts*, *Allegations & Disputes*, *Analytical Takeaway*)
    - **B. Foundational Concept Explainer** (with **Beginner / Intermediate / Advanced** depth toggles and **Progressive Learning** recognition)
    - **C. Commercial Implications** (Business Rationale, Structure & Financing, **How Law Firms & Practitioners Advise**, and Stakeholder Impact)
    - **D. Academic Synergies** (Substantive intellectual connection to verified HLS courses, centers, and peer institutions)
    - **E. Professor Connections** (Verified faculty scholarship & substantive seminar/research questions)
    - **F. Further Reading** (Primary/Regulatory Sources vs. Secondary Commentary)
- [x] **Stage 4 — Personal Learning & Research Suite**:
  - Personal Glossary with Progressive Learning encounter tracking & mastery levels (`new`, `familiar`, `mastered`).
  - Bookmarks, Read/Unread status, Reading History, Research Notebook, and Global Search.
- [x] **Stage 5 — Story Timelines, Faculty Spotlight & Weekly Intelligence Digest**:
  - Chronological Developing Story Timelines for linked developments.
  - Verified HLS Faculty Spotlight filter (excluding student-authored notes).
  - Weekly Intelligence Digest synthesizer reusing cached analyses.
- [x] **Stage 6 — Automated & Build Verification**:
  - All 6 automated test suites in `server/verify.js` passed (`0` errors).
  - Production bundle (`npm run build`) compiled cleanly (`960ms`).
  - Live RSS ingestion populated **213 verified live articles** across all 7 categories (`19` to `61` live articles per category).
