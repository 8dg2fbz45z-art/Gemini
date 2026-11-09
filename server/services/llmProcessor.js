import { db, getSetting } from '../db.js';
import {
  CATEGORIES,
  VERIFIED_HLS_FACULTY,
  VERIFIED_PEER_INSTITUTIONS,
} from '../data/verifiedRegistries.js';
import {
  SYSTEM_INSTRUCTION_LEGAL_ANALYST,
  buildArticleAnalysisPrompt,
  buildWeeklyDigestPrompt,
} from './prompts.js';
import {
  enrichArticleContentIfNeeded,
  buildBoundedArticleSummary,
  buildCompactPracticeNote,
  countWords,
} from './articleExtractor.js';

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || getSetting('gemini_api_key', '');
  const model = getSetting('gemini_model', 'gemini-2.5-flash');
  return {
    apiKey: apiKey.trim(),
    hasApiKey: Boolean(apiKey && apiKey.trim().length > 10),
    model,
  };
}

async function callGeminiJson(promptText, systemInstruction = SYSTEM_INSTRUCTION_LEGAL_ANALYST) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error('NO_GEMINI_API_KEY');
  }

  // Prioritize fast, token-efficient gemini-2.5-flash by default, with automatic cascade
  const modelCascade = [
    model || 'gemini-2.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

  let lastError = null;
  for (const candidateModel of modelCascade) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      candidateModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API (${candidateModel}) HTTP ${response.status}: ${errBody.slice(0, 240)}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error(`Empty response candidate from Gemini API (${candidateModel})`);
      }

      return {
        parsed: JSON.parse(rawText),
        modelUsed:
          candidateModel === model
            ? `Google Gemini (${candidateModel})`
            : `Google Gemini (${candidateModel} • Free-Tier Auto-Fallback from ${model})`,
      };
    } catch (err) {
      lastError = err;
      // Continue to next model in cascade if Pro was blocked by free-tier quota/billing limits
    }
  }
  throw lastError;
}

/**
 * Grounded synthesis fallback when no external Gemini API key is configured yet.
 * Clearly badged as "Rule-Grounded Registry Synthesis" and strictly uses verified HLS registry data.
 */
function buildRuleGroundedAnalysis(article, matchedFirms = []) {
  const category = CATEGORIES.find((c) => c.id === article.category_id) || CATEGORIES[0];
  const prof =
    VERIFIED_HLS_FACULTY.find((p) => p.id === article.verified_professor_id) ||
    VERIFIED_HLS_FACULTY.find((p) => p.categories.includes(article.category_id)) ||
    VERIFIED_HLS_FACULTY[0];

  const firmListText = matchedFirms.length
    ? matchedFirms
        .map(
          (f) =>
            `${f.name} (Vault #${f.vault_rank}, AmLaw Revenue #${f.amlaw_revenue_rank}, ${f.deal_volume_tier})`
        )
        .join('; ')
    : `Leading ${category.shortName} practices (Vault 10 / AmLaw 50 counsel)`;

  const nowIso = new Date().toISOString();

  const sectorConcepts = {
    'corporate-ma': {
      term: 'Fiduciary Standard of Review, Deal Protection Devices & Regulatory Risk Allocation',
      shortDef:
        'The doctrinal and contractual mechanisms governing board duties, conditionality, and closing certainty in corporate M&A.',
      beginner:
        'When companies merge or negotiate major corporate actions, two sets of rules apply at once: corporate fiduciary law (which requires the board of directors to act loyally and carefully for shareholders) and the merger contract itself (which sets the price, closing conditions, and breakup fees if regulators block the deal).',
      intermediate:
        'Under Delaware corporate law, boards must navigate the spectrum between the deferential Business Judgment Rule, Unocal/Revlon enhanced scrutiny in change-of-control sales, and Entire Fairness in conflicted controller transactions. Simultaneously, M&A counsel draft Material Adverse Effect (MAE) clauses, regulatory antitrust covenants (hell-or-high-water vs. capped divestitures), and reverse termination fees.',
      advanced:
        'At an advanced transactional level, counsel calibrate the interaction between post-signing interim operating covenants (Burdick / AB Stable), specific performance remedies, and statutory validation of governance arrangements under DGCL § 122(18) and Match Group dual-cleansing principles.',
    },
    'banking-finance': {
      term: 'Syndicated Credit Architecture, Liability Management & Prudential Capital Regulation',
      shortDef:
        'The legal and regulatory framework governing institutional debt agreements, creditor priorities, and banking stability.',
      beginner:
        'Large corporate loans and banking rules revolve around risk and priority: who gets paid back first if a borrower runs into trouble, and how much capital banks must hold in reserve so financial stress doesn’t trigger a broader economic crisis.',
      intermediate:
        'Commercial credit markets are divided between Broadly Syndicated Loans (BSLs), investment-grade/high-yield bonds, and private credit direct lending. Credit agreements allocate risk through financial maintenance or incurrence covenants, collateral packages, and sacred-right voting thresholds.',
      advanced:
        'Practitioners focus on the boundary between permissible covenant flexibility and prohibited non-pro-rata priming (post-Serta Simmons Fifth Circuit precedent), alongside regulatory capital risk-weighting under Federal Reserve and Basel III Endgame standards.',
    },
    'capital-markets': {
      term: 'Mandatory Securities Disclosure, Gatekeeper Due Diligence & Offering Exemptions',
      shortDef:
        'The federal securities law regime governing public capital formation, private placements, and issuer/underwriter liability.',
      beginner:
        'Whenever a company raises money by selling stocks or bonds to investors, federal securities laws require full and truthful disclosure of its business risks. Underwriters (investment banks) and law firms act as "gatekeepers" who verify those disclosures.',
      intermediate:
        'The Securities Act of 1933 requires public offerings to be registered with the SEC (triggering strict Section 11 liability for the issuer and due diligence defenses for underwriters) unless an exemption applies—such as Rule 144A for Qualified Institutional Buyers (QIBs) or Regulation D private placements.',
      advanced:
        'Capital markets counsel navigate the interplay between Regulation S-K materiality standards, Exchange Act Rule 10b-5 scienter-based fraud litigation, forward-looking statement safe harbors under the PSLRA, and bespoke convertible/high-yield covenant packages.',
    },
    'investment-funds': {
      term: 'Limited Partnership Governance (LPAs), Fiduciary Conflicts & Continuation Vehicles',
      shortDef:
        'The contractual and regulatory architecture governing private investment funds, General Partners (GPs), and Limited Partners (LPs).',
      beginner:
        'Private investment funds pool billions of dollars from institutional investors like pension funds and university endowments ("Limited Partners") and entrust a fund manager ("General Partner") to invest that capital under a detailed partnership contract.',
      intermediate:
        'Exempt from retail registration under Investment Company Act §§ 3(c)(1) and 3(c)(7), private funds are governed by Limited Partnership Agreements (LPAs), side letters, and Most Favored Nation (MFN) clauses, subject to anti-fraud fiduciary oversight under Investment Advisers Act § 206.',
      advanced:
        'Following the Fifth Circuit’s vacatur of the SEC Private Fund Advisers Rule, conflict governance in GP-led secondary continuation funds, NAV credit facilities, and fee/expense allocations turns on granular LPA drafting, LPAC consent protocols, and pre-commitment PPM disclosures.',
    },
    'technology-ai': {
      term: 'Algorithmic & Foundation Model Governance, Digital Antitrust & IP Provenance',
      shortDef:
        'The emerging legal framework governing artificial intelligence deployment, compute/talent consolidation, and fiduciary duties.',
      beginner:
        'Rapid advances in artificial intelligence and frontier technology force courts and regulators to apply traditional rules—like copyright law, antitrust merger rules, and corporate board oversight—to entirely new business models.',
      intermediate:
        'Technology transactions and AI labs implicate Clayton Act Section 7 scrutiny of compute-for-equity partnerships, copyright fair-use doctrines over training datasets, export controls on advanced semiconductors, and Caremark board oversight of mission-critical technological risks.',
      advanced:
        'Advisors structuring frontier AI entities must reconcile pecuniary investor governance rights with hybrid corporate forms (such as Delaware Public Benefit Corporations under DGCL §§ 361–368) and multi-jurisdictional regulatory compliance (US antitrust, EU AI Act, and CFIUS).',
    },
    'private-equity': {
      term: 'Leveraged Buyout (LBO) Risk Allocation, Take-Private Contracting & Sponsor Financing',
      shortDef:
        'The transactional structure combining sponsor equity commitments, unitranche/syndicated debt, and limited remedies in buyouts.',
      beginner:
        'In a private equity buyout, an investment firm buys a company using a mix of its own fund’s cash ("equity") and borrowed money ("debt"), aiming to grow or restructure the business over several years before selling it or taking it public.',
      intermediate:
        'Take-private merger agreements utilize shell acquisition vehicles backed by an Equity Commitment Letter (ECL), Debt Commitment Letter, and Limited Guarantee, pairing conditional specific performance with a capped Reverse Termination Fee (RTF).',
      advanced:
        'Contemporary buyout execution integrates sovereign wealth co-investment syndicates, multi-billion-dollar private credit unitranche facilities (replacing syndicated bank bridges), and expanded HSR antitrust disclosures for serial roll-up strategies.',
    },
    'general-international': {
      term: 'Post-Loper Bright Administrative Review, Cross-Border Regulatory Clearance & Sovereign Risk',
      shortDef:
        'The public law and international legal framework governing judicial review of agency rules, CFIUS, sanctions, and cross-border disputes.',
      beginner:
        'Global businesses operate under rules set by administrative agencies (like the SEC, FTC, and Treasury) and international treaties. When agencies overstep the statutes written by Congress, companies can challenge those regulations in federal court.',
      intermediate:
        'After the Supreme Court’s landmark decision in Loper Bright overruling Chevron deference, federal courts independently interpret statutory text under APA § 706, fundamentally altering regulatory litigation across financial, antitrust, and trade agencies.',
      advanced:
        'Cross-border counsel coordinate domestic APA/constitutional defense (Loper Bright, Jarkesy, Major Questions Doctrine) with extra-territorial regulatory regimes including CFIUS national security reviews, OFAC sanctions, and ICSID/UNCITRAL international arbitration.',
    },
  };

  const cData = sectorConcepts[article.category_id] || sectorConcepts['corporate-ma'];

  const rawSourceParagraphs = (article.content_raw || article.summary || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const boundedNarrative = buildBoundedArticleSummary(
    rawSourceParagraphs,
    article,
    matchedFirms,
    150,
    300
  );
  const practiceNote = buildCompactPracticeNote(article, matchedFirms);

  return {
    modelUsed: 'Rule-Grounded Registry Synthesis (Add Gemini API Key for Live Neural Generation)',
    isRuleGroundedFallback: true,
    generatedAt: nowIso,
    whyThisMatters: article.why_this_matters,
    detailedOverview: {
      narrative: boundedNarrative,
      practiceNote,
      partiesAndCounsel: [
        `Source Attribution: ${article.source_name} (${article.source_type.replace('_', ' ')})`,
        `Tracked Law Firm Context: ${firmListText}`,
      ],
      dealValueAndStatus: `Curated Live Development (Significance Score: ${article.significance_score}/100) • Published ${new Date(
        article.published_at
      ).toLocaleDateString()}`,
      epistemicBreakdown: {
        verifiedFacts: [
          `Original report published by ${article.source_name} on ${new Date(article.published_at).toUTCString()}: "${article.title}".`,
          article.summary || 'Refer to primary source link for full documentary text.',
        ],
        allegationsAndDisputes: [
          'Distinguish primary regulatory filings or judicial holdings in the linked source document from market commentary or unadjudicated claims.',
        ],
        analyticalConsensus: [
          article.why_this_matters || `Material development within ${category.name}.`,
        ],
      },
    },
    conceptExplainer: {
      conceptTerm: cData.term,
      categoryId: article.category_id,
      shortDefinition: cData.shortDef,
      beginner: cData.beginner,
      intermediate: cData.intermediate,
      advanced: cData.advanced,
      practicalExample: `In advising clients on "${article.title}", counsel apply ${cData.term} to allocate legal and commercial risk between counterparties, investors, and regulators.`,
    },
    commercialImplications: {
      businessRationale: `Corporate boards, sponsors, and financial institutions track ${category.shortName} developments to price regulatory risk, optimize capital cost, and protect transaction certainty.`,
      structureAndFinancing: `Implicates covenant design, disclosure materiality, and risk-allocation provisions in ${category.shortName} documentation.`,
      lawFirmAdvisoryRole: `${firmListText} advise boards, special committees, underwriters, and institutional investors by translating doctrinal shifts into concrete contract language and regulatory filings.`,
      stakeholderImpact: `Affects corporate issuers, institutional capital allocators, and regulatory enforcement priorities in ${category.shortName}.`,
    },
    academicSynergies: {
      intellectualConnection: `Connects practical developments in ${category.name} with law-and-economics scholarship on agency costs, institutional design, and market efficiency.`,
      hlsCourses: prof.courses.map((courseTitle) => ({
        title: courseTitle,
        instructors: prof.name,
        connection: `Examines the doctrinal and policy foundations underlying ${category.shortName} developments such as "${article.title}".`,
      })),
      centersAndPeerPrograms: [
        ...prof.centers.map((c) => `Harvard Law School — ${c}`),
        ...VERIFIED_PEER_INSTITUTIONS.slice(0, 2).map((p) => `${p.school} — ${p.centers[0]}`),
      ],
    },
    professorConnections: {
      verifiedProfessor: prof.name,
      affiliationStatus: `${prof.title} (Verified HLS Registry)`,
      scholarshipContext: `Prof. ${prof.name}’s scholarship focuses on ${prof.researchInterests.slice(0, 2).join(' and ')}. Key works include: ${prof.keyWorks.join('; ')}.`,
      discussionQuestions: [
        `How does the development reported in "${article.title}" test the doctrinal and economic assumptions studied in Prof. ${prof.name}’s research on ${prof.researchInterests[0]}?`,
        `What contractual or regulatory adjustments should transactional and appellate counsel adopt in response to this development?`,
      ],
    },
    furtherReading: {
      primarySources: [
        {
          title: `${article.title} (${article.source_name})`,
          type: 'Original Source Link',
          url: article.url,
        },
      ],
      secondaryCommentary: [
        {
          title: 'Harvard Law School Forum on Corporate Governance',
          type: 'Academic & Practitioner Repository',
          url: 'https://corpgov.law.harvard.edu/',
        },
      ],
    },
  };
}

/**
 * Generates or retrieves the 6-part deep analysis for an article.
 * Persistently caches results in SQLite `article_analyses`.
 */
export async function getOrGenerateArticleAnalysis(articleId, { forceRegenerate = false } = {}) {
  let article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  // Always ensure the article has enriched paragraphs and the single best reputable URL
  article = await enrichArticleContentIfNeeded(article);

  if (!forceRegenerate) {
    const cached = db
      .prepare('SELECT * FROM article_analyses WHERE article_id = ?')
      .get(articleId);
    if (cached) {
      const parsed = JSON.parse(cached.analysis_json);
      const narrativeArr = parsed?.detailedOverview?.narrative || [];
      const joinedNarrative = narrativeArr.join(' ');
      const narrativeWords = countWords(joinedNarrative);
      const hasLegacyBoilerplate =
        joinedNarrative.includes('this development falls within CrimsonBrief’s') ||
        joinedNarrative.includes('From a practice perspective, developments of this profile directly implicate');

      if (!hasLegacyBoilerplate && narrativeWords >= 145 && narrativeWords <= 315 && parsed?.detailedOverview?.practiceNote) {
        return {
          articleId,
          modelUsed: cached.model_used,
          generatedAt: cached.generated_at,
          analysis: parsed,
          fromCache: true,
        };
      }
    }
  }

  const matchedFirmIds = JSON.parse(article.matched_firms_json || '[]');
  const allFirms = db.prepare('SELECT * FROM law_firms').all();
  const matchedFirms = allFirms.filter((f) => matchedFirmIds.includes(f.id));

  const glossaryRows = db.prepare('SELECT term FROM glossary_concepts').all();
  const knownGlossaryTerms = glossaryRows.map((g) => g.term);

  let analysisObj;
  let modelUsed;

  const { hasApiKey } = getGeminiConfig();
  if (hasApiKey) {
    try {
      const prompt = buildArticleAnalysisPrompt(article, matchedFirms, knownGlossaryTerms);
      const geminiResult = await callGeminiJson(prompt);
      const rawParsed = geminiResult.parsed || {};
      const geminiNarrative = Array.isArray(rawParsed?.detailedOverview?.narrative)
        ? rawParsed.detailedOverview.narrative
        : [];
      const geminiWordCount = countWords(geminiNarrative.join(' '));

      // Enforce 150-300 word bound on the article summary narrative
      const finalNarrative =
        geminiWordCount >= 145 && geminiWordCount <= 305
          ? geminiNarrative
          : buildBoundedArticleSummary(
              geminiNarrative.length
                ? geminiNarrative
                : (article.content_raw || article.summary || '').split(/\n\s*\n/),
              article,
              matchedFirms,
              150,
              300
            );

      const finalPracticeNote =
        rawParsed?.detailedOverview?.practiceNote || buildCompactPracticeNote(article, matchedFirms);

      analysisObj = {
        ...rawParsed,
        detailedOverview: {
          ...(rawParsed.detailedOverview || {}),
          narrative: finalNarrative,
          practiceNote: finalPracticeNote,
        },
        modelUsed: geminiResult.modelUsed,
        isRuleGroundedFallback: false,
        generatedAt: new Date().toISOString(),
      };
      modelUsed = geminiResult.modelUsed;

      if (analysisObj.whyThisMatters) {
        db.prepare('UPDATE articles SET why_this_matters = ? WHERE id = ?').run(
          analysisObj.whyThisMatters,
          articleId
        );
      }
    } catch (err) {
      console.warn(`Gemini analysis failed for ${articleId}, using rule-grounded fallback:`, err.message);
      analysisObj = buildRuleGroundedAnalysis(article, matchedFirms);
      modelUsed = analysisObj.modelUsed;
    }
  } else {
    analysisObj = buildRuleGroundedAnalysis(article, matchedFirms);
    modelUsed = analysisObj.modelUsed;
  }

  const generatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO article_analyses (article_id, model_used, generated_at, analysis_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(article_id) DO UPDATE SET
      model_used = excluded.model_used,
      generated_at = excluded.generated_at,
      analysis_json = excluded.analysis_json
  `).run(articleId, modelUsed, generatedAt, JSON.stringify(analysisObj));

  return {
    articleId,
    modelUsed,
    generatedAt,
    analysis: analysisObj,
    fromCache: false,
  };
}

/**
 * Generates or returns the Weekly Intelligence Digest reusing stored SQLite analyses.
 */
export async function generateWeeklyDigest({ forceRegenerate = false } = {}) {
  const now = new Date();
  const weekLabel = `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (!forceRegenerate) {
    const existing = db.prepare('SELECT * FROM weekly_digests ORDER BY generated_at DESC LIMIT 1').get();
    if (existing) {
      return {
        id: existing.id,
        weekLabel: existing.week_label,
        generatedAt: existing.generated_at,
        digest: JSON.parse(existing.digest_json),
        fromCache: true,
      };
    }
  }

  const topArticles = db
    .prepare('SELECT * FROM articles ORDER BY significance_score DESC, published_at DESC LIMIT 12')
    .all();
  const glossaryTerms = db
    .prepare('SELECT * FROM glossary_concepts ORDER BY updated_at DESC LIMIT 10')
    .all();

  let digestObj;
  const { hasApiKey } = getGeminiConfig();

  if (hasApiKey) {
    try {
      const prompt = buildWeeklyDigestPrompt(topArticles, glossaryTerms);
      const res = await callGeminiJson(prompt);
      digestObj = {
        ...res.parsed,
        modelUsed: res.modelUsed,
      };
    } catch (err) {
      console.warn('Weekly digest Gemini call failed, using deterministic synthesis:', err.message);
    }
  }

  if (!digestObj) {
    const facultyArticles = topArticles.filter((a) => a.is_faculty_authored);
    digestObj = {
      modelUsed: 'Cached Intelligence Synthesis',
      headlineSummary: `This week’s curated intelligence spans ${topArticles.length} high-significance developments across Corporate M&A, Leveraged Finance, Capital Markets, Investment Funds, AI Governance, and Post-Loper Bright Administrative Law, including ${facultyArticles.length} verified Harvard Law School faculty spotlight pieces.`,
      keyDevelopmentsByTheme: [
        {
          theme: 'Corporate Governance, Controller Transactions & M&A Contracting',
          synthesis:
            'Delaware corporate law continues to balance strict judicial policing of conflicted controller transactions (In re Match Group’s requirement of full MFW dual cleansing and 100% special committee independence) against statutory private ordering under newly enacted DGCL § 122(18).',
          relatedArticleTitles: topArticles
            .filter((a) => a.category_id === 'corporate-ma' || a.category_id === 'private-equity')
            .slice(0, 3)
            .map((a) => a.title),
        },
        {
          theme: 'Credit Markets, Liability Management & Private Fund Regulation',
          synthesis:
            'The Fifth Circuit’s rejection of the "open market purchase" uptier loophole in Serta Simmons and its vacatur of the SEC Private Fund Advisers Rule underscore a broader judicial return to strict textual enforcement of both commercial credit contracts and statutory agency boundaries.',
          relatedArticleTitles: topArticles
            .filter((a) => a.category_id === 'banking-finance' || a.category_id === 'investment-funds')
            .slice(0, 3)
            .map((a) => a.title),
        },
        {
          theme: 'AI Governance, Public Benefit Corporations & Post-Loper Bright Administrative Law',
          synthesis:
            'Frontier AI labs converting to Delaware Public Benefit Corporations and hyperscaler "acqui-hire" partnerships face simultaneous antitrust and fiduciary scrutiny, while Loper Bright empowers corporate challengers across federal regulatory regimes.',
          relatedArticleTitles: topArticles
            .filter((a) => a.category_id === 'technology-ai' || a.category_id === 'general-international')
            .slice(0, 3)
            .map((a) => a.title),
        },
      ],
      facultyAndAcademicHighlights: facultyArticles.map(
        (a) => `${a.title} — ${a.why_this_matters}`
      ),
      conceptMasteryReview: glossaryTerms.map((g) => ({
        term: g.term,
        synthesisQuestion: `How does "${g.term}" (${g.short_definition}) allocate risk between insiders/sponsors and minority investors or creditors in current market transactions?`,
      })),
    };
  }

  const id = `digest-${Date.now()}`;
  const generatedAt = now.toISOString();
  db.prepare(`
    INSERT INTO weekly_digests (id, week_label, generated_at, digest_json)
    VALUES (?, ?, ?, ?)
  `).run(id, weekLabel, generatedAt, JSON.stringify(digestObj));

  return {
    id,
    weekLabel,
    generatedAt,
    digest: digestObj,
    fromCache: false,
  };
}
