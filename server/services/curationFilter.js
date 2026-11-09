import { CATEGORIES, VERIFIED_HLS_FACULTY } from '../data/verifiedRegistries.js';
import { isPaywalledSource, scoreSourceReputation } from './articleExtractor.js';

const ROUTINE_OR_PROMOTIONAL_PATTERNS = [
  /\bnamed\s+to\s+.*\blist\b/i,
  /\brecognized\s+in\s+chambers\b/i,
  /\blater[a]l\s+partner\s+joins\b/i,
  /\bregister\s+for\s+our\s+webinar\b/i,
  /\bsponsored\s+content\b/i,
  /\bcle\s+seminar\s+registration\b/i,
  /\bopens\s+new\s+office\s+in\b/i,
  /\bannounces\s+new\s+partner\s+class\b/i,
];

/**
 * Roundup, Directory, Digest & Table-of-Contents Blacklist
 * Prevents index/directory pages (e.g., "Weekly Roundup", "Supreme Court Round-Up") from appearing as articles.
 */
const ROUNDUP_OR_DIRECTORY_PATTERNS = [
  /\bweekly\s+round[\s-]?up\b/i,
  /\bmonthly\s+round[\s-]?up\b/i,
  /\bdaily\s+round[\s-]?up\b/i,
  /\bround[\s-]?up\s*[:(\-–—]/i,
  /\bround[\s-]?up\s+for\b/i,
  /\bdaily\s+(digest|briefing|wrap)\b/i,
  /\bnews\s+round[\s-]?up\b/i,
  /\bweek\s+in\s+review\b/i,
  /\btable\s+of\s+contents\b/i,
  /\/weekly-roundup-/i,
  /\bcontains\s+a\s+collection\s+of\s+the\s+posts\s+published\b/i,
];

export function isRoundupOrDirectoryPage(item = {}) {
  const blob = `${item.title || ''} ${item.url || ''} ${(item.summary || '').slice(0, 300)} ${(item.contentRaw || item.content_raw || '').slice(0, 400)}`;
  return ROUNDUP_OR_DIRECTORY_PATTERNS.some((rx) => rx.test(blob));
}

const STUDENT_INDICATORS = [
  /\bJ\.?D\.?\s*Candidate\b/i,
  /\bLL\.?M\.?\s*Candidate\b/i,
  /\bS\.?J\.?D\.?\s*Candidate\b/i,
  /\bStudent\s+(Fellow|Contributor|Editor|Note|Author)\b/i,
  /\bClass\s+of\s+202[5-9]\b/i,
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under',
  'after', 'before', 'about', 'amid', 'new', 'how', 'why', 'what', 'when', 'its',
  'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'could', 'should',
  'law', 'legal', 'court', 'case', 'report', 'news', 'update', 'analysis', 'post'
]);

export function normalizeUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl.trim());
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid'].forEach((p) =>
      parsed.searchParams.delete(p)
    );
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.trim();
  }
}

export function extractTokens(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Matches law firms from the database watchlist against article title, author, and summary.
 */
export function matchLawFirms(item, allFirms = []) {
  const blob = `${item.title || ''} ${item.author || ''} ${item.summary || ''} ${item.contentRaw || ''}`.toLowerCase();
  const matched = [];
  for (const firm of allFirms) {
    const aliases = Array.isArray(firm.aliases)
      ? firm.aliases
      : JSON.parse(firm.aliases_json || '[]');
    const searchTerms = [firm.short_name?.toLowerCase(), firm.name?.toLowerCase(), ...aliases.map((a) => a.toLowerCase())].filter(Boolean);
    if (searchTerms.some((term) => blob.includes(term))) {
      matched.push(firm.id);
    }
  }
  return [...new Set(matched)];
}

/**
 * Strict Academic & HLS Faculty Verification:
 * - Never assumes every HLS Forum on Corporate Governance post is written by Harvard faculty.
 * - Explicitly distinguishes Verified HLS Faculty, Law Firm Guest Contributors, Student Authors, and External Scholars.
 */
export function classifyAcademicAuthorship(item, matchedFirmIds = []) {
  const blob = `${item.title || ''} ${item.author || ''} ${item.summary || ''} ${item.contentRaw || ''}`;
  const lowerBlob = blob.toLowerCase();

  // 1. Check for student authorship indicators first
  if (STUDENT_INDICATORS.some((rx) => rx.test(blob))) {
    return {
      isFacultyAuthored: false,
      contributorType: 'student_author',
      verifiedProfessorId: null,
      verifiedProfessor: null,
      verificationNote: 'Student-authored piece (excluded from Faculty Spotlight; permitted in general feed if substantive).',
    };
  }

  // 2. Check against Verified HLS Faculty Registry
  for (const prof of VERIFIED_HLS_FACULTY) {
    const matchedAlias = prof.aliases.some((alias) => lowerBlob.includes(alias.toLowerCase()));
    if (matchedAlias) {
      const authorLower = (item.author || '').toLowerCase();
      const isDirectAuthor =
        prof.aliases.some((alias) => authorLower.includes(alias.toLowerCase())) ||
        lowerBlob.includes(`by ${prof.name.toLowerCase()}`) ||
        (item.sourceName || '').toLowerCase().includes('harvard law school forum');

      return {
        isFacultyAuthored: isDirectAuthor,
        contributorType: isDirectAuthor ? 'verified_hls_faculty' : 'faculty_research_referenced',
        verifiedProfessorId: prof.id,
        verifiedProfessor: prof,
        verificationNote: isDirectAuthor
          ? `Verified Harvard Law School Faculty publication (${prof.name})`
          : `Intersects scholarship of HLS Professor ${prof.name}`,
      };
    }
  }

  // 3. If published on HLS Forum on Corporate Governance but not matched to HLS Faculty
  if ((item.sourceName || '').toLowerCase().includes('harvard law school forum')) {
    if (matchedFirmIds.length > 0) {
      return {
        isFacultyAuthored: false,
        contributorType: 'law_firm_guest',
        verifiedProfessorId: null,
        verifiedProfessor: null,
        verificationNote: 'HLS Forum guest post authored by practicing law firm counsel (not HLS faculty).',
      };
    }
    return {
      isFacultyAuthored: false,
      contributorType: 'visiting_or_external_contributor',
      verifiedProfessorId: null,
      verifiedProfessor: null,
      verificationNote: 'HLS Forum contributor outside verified HLS faculty registry.',
    };
  }

  return {
    isFacultyAuthored: false,
    contributorType: item.sourceType === 'primary_regulatory' ? 'regulator' : 'journalist',
    verifiedProfessorId: null,
    verifiedProfessor: null,
    verificationNote: null,
  };
}

/**
 * Classifies an article into one of the 7 core categories based on weighted keyword matching
 * and category-sensitive context rules.
 */
export function classifyCategory(item, defaultCategoryId = 'general-international') {
  const blob = `${item.title || ''} ${item.summary || ''} ${item.contentRaw || ''}`.toLowerCase();

  // Prevent non-transactional lawsuits (defamation, libel, criminal, election/political suits) from landing in Corporate & M&A
  if (
    /\b(libel|defamation|slander|first amendment|criminal|murder|assault|immigration|asylum)\b/i.test(blob) &&
    !/\b(merger|acquisition|buyout|takeover|tender offer|delaware chancery)\b/i.test(blob)
  ) {
    return 'general-international';
  }

  let bestCategory = defaultCategoryId;
  let maxScore = 0;

  for (const cat of CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (blob.includes(kw.toLowerCase())) {
        // Title matches count double
        score += (item.title || '').toLowerCase().includes(kw.toLowerCase()) ? 4 : 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat.id;
    }
  }
  return bestCategory;
}

/**
 * 7-Criterion Substance-Based Importance Scoring Engine (0–100)
 *
 * Weighted Rubric:
 * 1. Significance and real-world impact: 25 points (0–25)
 * 2. Legal and regulatory importance: 20 points (0–20)
 * 3. Financial and economic materiality: 15 points (0–15)
 * 4. Relevance to the assigned category: 15 points (0–15)
 * 5. Novelty and substantive new developments: 10 points (0–10)
 * 6. Source credibility and factual evidence: 10 points (0–10)
 * 7. Long-term significance: 5 points (0–5)
 *
 * Total: 0–100 points.
 * - Prefer articles scoring >= 80, allow 70–79 when necessary to maintain useful coverage.
 * - Do NOT award points for sensational headlines, non-transactional damages claims, or merely being newer.
 */
export function computeSignificanceScore(
  item,
  matchedFirmIds = [],
  authorshipInfo = {},
  sourceCredibility = 9,
  assignedCategoryId = null
) {
  const title = item.title || '';
  const summary = item.summary || '';
  const contentRaw = item.contentRaw || item.content_raw || '';
  const blob = `${title} ${summary} ${contentRaw}`;

  // 1. Reject routine firm announcements, promotional fluff, roundup/directory pages, and paywalled sources
  if (ROUTINE_OR_PROMOTIONAL_PATTERNS.some((rx) => rx.test(blob))) {
    return {
      score: 15,
      eligible: false,
      rejectionReason: 'Routine announcement or promotional content',
      breakdown: null,
    };
  }

  if (isRoundupOrDirectoryPage(item)) {
    return {
      score: 10,
      eligible: false,
      rejectionReason: 'Roundup, digest, or directory index page (blacklisted)',
      breakdown: null,
    };
  }

  if (isPaywalledSource(item.url || '', item.sourceName || '', title)) {
    return {
      score: 0,
      eligible: false,
      rejectionReason: 'Paywalled source excluded',
      breakdown: null,
    };
  }

  const categoryId = assignedCategoryId || classifyCategory(item);
  const categoryObj = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];

  const isNonTransactionalSuit = /\b(libel|defamation|slander|personal injury)\b/i.test(blob);

  // Criterion 1: Significance and real-world impact (0–25 pts)
  let realWorldImpact = 15;
  if (
    /\b(acquires|acquisition|merger|buyout|take-private|approves|adopts|enacts|blocks|strikes down|invalidates|charges|settles|enforcement|sanctions|tariffs|ruling|judgment|final rule|amendments|central bank|interest rate|sovereign|cross-border)\b/i.test(
      blob
    )
  ) {
    realWorldImpact += 6;
  }
  if (
    /\b(global|industry-wide|market-wide|nationwide|systemic|institutional|multinational|landmark|major)\b/i.test(blob) ||
    matchedFirmIds.length > 0 ||
    (!isNonTransactionalSuit && /\$[0-9.]+\s*billion|\$[0-9]+B\b/i.test(blob))
  ) {
    realWorldImpact += 4;
  }
  if (isNonTransactionalSuit) {
    realWorldImpact = Math.min(12, realWorldImpact);
  }
  realWorldImpact = Math.min(25, realWorldImpact);

  // Criterion 2: Legal and regulatory importance (0–20 pts)
  let legalRegulatory = 11;
  if (
    /\b(Supreme Court|SCOTUS|Supreme Court of India|SEBI|Reserve Bank of India|RBI|Competition Commission of India|CCI|NCLT|IBC|Delaware Chancery|Delaware Supreme Court|SEC|CFTC|FTC|DOJ|Federal Reserve|CFIUS|European Commission|Fifth Circuit|Second Circuit|Basel III|Loper Bright|Chapter 11|Rule 14a-8|Rule 144A|DMA|DSA|EU AI Act|antitrust|fiduciary)\b/i.test(
      blob
    )
  ) {
    legalRegulatory += 7;
  }
  if (matchedFirmIds.length > 0 || item.sourceType === 'primary_regulatory' || authorshipInfo.isFacultyAuthored) {
    legalRegulatory += 2;
  }
  legalRegulatory = Math.min(20, legalRegulatory);

  // Criterion 3: Financial and economic materiality (0–15 pts)
  // Category-sensitive: Do not award financial materiality points to sensational libel/tort damages claims
  let financialMateriality = 8;
  if (!isNonTransactionalSuit) {
    if (/\$[0-9.]+\s*billion|\$[0-9]+B\b|\btrillion\b|\b₹[0-9,]+\s*crore\b/i.test(blob)) {
      financialMateriality = 15;
    } else if (/\$[0-9.]+\s*million|\$[0-9]+M\b|\bbasis points\b|\bcapital requirements\b|\bliquidity\b|\bfundraising\b/i.test(blob)) {
      financialMateriality = 13;
    } else if (
      /\b(capital|credit|debt|equity|valuation|fund|portfolio|tariff|trade|market|treasury|clearing|custody|tax)\b/i.test(
        blob
      )
    ) {
      financialMateriality = 11;
    }
  } else {
    financialMateriality = 3;
  }
  financialMateriality = Math.min(15, financialMateriality);

  // Criterion 4: Relevance to the assigned category (0–15 pts)
  let categoryMatches = 0;
  for (const kw of categoryObj.keywords) {
    if (blob.toLowerCase().includes(kw.toLowerCase())) {
      categoryMatches += title.toLowerCase().includes(kw.toLowerCase()) ? 2 : 1;
    }
  }
  let categoryRelevance = Math.min(15, 9 + Math.min(6, categoryMatches * 2));
  if (categoryMatches === 0) {
    categoryRelevance = 7;
  }

  // Criterion 5: Novelty and substantive new developments (0–10 pts)
  let novelty = 7;
  if (
    /\b(new|proposes|adopts|announces|completes|agrees|files|rules|issues|launches|introduces|terminates|approves|charges)\b/i.test(
      title
    )
  ) {
    novelty += 2;
  }
  if (summary.length >= 140 || contentRaw.length >= 400) {
    novelty += 1;
  }
  novelty = Math.min(10, novelty);

  // Criterion 6: Source credibility and factual evidence (0–10 pts)
  const repScore = scoreSourceReputation(item.url || '', item.sourceName || '');
  let sourceCredibilityPts = Math.round((repScore / 100) * 10);
  if (item.sourceType === 'primary_regulatory') {
    sourceCredibilityPts = 10;
  } else if (repScore >= 88) {
    sourceCredibilityPts = Math.max(9, sourceCredibilityPts);
  }
  sourceCredibilityPts = Math.max(4, Math.min(10, sourceCredibilityPts));

  // Criterion 7: Long-term significance (0–5 pts)
  let longTermSignificance = 3;
  if (
    /\b(precedent|framework|structural|amendment|statute|constitutional|doctrine|rulemaking|reform|cross-border|billion|overhaul)\b/i.test(
      blob
    )
  ) {
    longTermSignificance = 5;
  } else if (matchedFirmIds.length > 0 || item.sourceType === 'primary_regulatory') {
    longTermSignificance = 4;
  }

  const rawTotal =
    realWorldImpact +
    legalRegulatory +
    financialMateriality +
    categoryRelevance +
    novelty +
    sourceCredibilityPts +
    longTermSignificance;

  const finalScore = Math.max(10, Math.min(99, Math.round(rawTotal)));
  const breakdown = {
    realWorldImpact,
    legalRegulatory,
    financialMateriality,
    categoryRelevance,
    novelty,
    sourceCredibility: sourceCredibilityPts,
    longTermSignificance,
  };

  return {
    score: finalScore,
    eligible: finalScore >= 70,
    breakdown,
    rejectionReason: finalScore < 70 ? `Below 70 quality threshold (scored ${finalScore}/100)` : null,
  };
}

/**
 * Generates an immediate, factual "Why This Matters" summary before or without AI enrichment.
 */
export function generateBaselineWhyThisMatters(item, categoryId, matchedFirmIds, allFirms, authorshipInfo) {
  const category = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  const firmNames = allFirms
    .filter((f) => matchedFirmIds.includes(f.id))
    .map((f) => f.short_name || f.shortName);

  const parts = [];
  if (authorshipInfo.isFacultyAuthored && authorshipInfo.verifiedProfessor) {
    parts.push(`Verified Harvard Law School faculty publication by Prof. ${authorshipInfo.verifiedProfessor.name} examining core ${category.shortName} doctrine.`);
  } else if (authorshipInfo.contributorType === 'law_firm_guest') {
    parts.push(`Practitioner governance memorandum published via the HLS Forum on Corporate Governance${firmNames.length ? ` involving ${firmNames.join(', ')}` : ''}.`);
  } else if (firmNames.length > 0) {
    parts.push(`Tracks ${firmNames.join(', ')} counsel activity and deal execution in ${category.shortName}.`);
  }

  const blob = `${item.title || ''} ${item.summary || ''}`;
  if (/\$[0-9.]+\s*billion|\$[0-9]+B\b/i.test(blob)) {
    parts.push('Involves billion-dollar transaction scale with material market-moving and deal-structuring implications.');
  } else if (item.sourceType === 'primary_regulatory') {
    parts.push(`Primary regulatory action from ${item.sourceName} directly shaping compliance, enforcement, and commercial advisory practice.`);
  } else if (parts.length === 0) {
    parts.push(`Significant development in ${category.shortName} selected for commercial awareness and legal policy impact.`);
  }

  return parts.join(' ');
}

/**
 * Deduplicates incoming article against existing database articles and assigns a `story_cluster_id`
 * when an article tracks a developing transaction, litigation, or regulatory initiative.
 */
export function deduplicateAndAssignCluster(item, existingArticles = []) {
  const normUrl = normalizeUrl(item.url);
  const itemTokens = extractTokens(`${item.title || ''} ${(item.summary || '').slice(0, 160)}`);
  const titleTokens = extractTokens(item.title || '');

  let bestClusterMatch = null;
  let bestClusterSim = 0;

  for (const existing of existingArticles) {
    if (normalizeUrl(existing.url) === normUrl && !existing.is_sample) {
      return { isDuplicate: true, duplicateOf: existing.id, storyClusterId: existing.story_cluster_id };
    }

    const existingTitleTokens = extractTokens(existing.title || '');
    const titleSim = jaccardSimilarity(titleTokens, existingTitleTokens);

    // High title similarity = duplicate report of exact same event
    if (titleSim >= 0.72) {
      return { isDuplicate: true, duplicateOf: existing.id, storyClusterId: existing.story_cluster_id };
    }

    const existingBlobTokens = extractTokens(`${existing.title || ''} ${(existing.summary || '').slice(0, 160)}`);
    const combinedSim = Math.max(titleSim, jaccardSimilarity(itemTokens, existingBlobTokens));

    if (combinedSim >= 0.28 && combinedSim > bestClusterSim) {
      bestClusterSim = combinedSim;
      bestClusterMatch = existing;
    }
  }

  if (bestClusterMatch) {
    const clusterId = bestClusterMatch.story_cluster_id || `cluster-${bestClusterMatch.id.slice(0, 18)}`;
    return {
      isDuplicate: false,
      storyClusterId: clusterId,
      linkedToArticleId: bestClusterMatch.id,
    };
  }

  return {
    isDuplicate: false,
    storyClusterId: null,
    linkedToArticleId: null,
  };
}
