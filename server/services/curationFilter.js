import { CATEGORIES, VERIFIED_HLS_FACULTY } from '../data/verifiedRegistries.js';

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
 * Classifies an article into one of the 7 core categories based on weighted keyword matching.
 */
export function classifyCategory(item, defaultCategoryId = 'general-international') {
  const blob = `${item.title || ''} ${item.summary || ''} ${item.contentRaw || ''}`.toLowerCase();
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
 * Multi-factor curation scoring engine (0–100)
 */
export function computeSignificanceScore(item, matchedFirmIds = [], authorshipInfo = {}, sourceCredibility = 15) {
  const blob = `${item.title || ''} ${item.summary || ''} ${item.contentRaw || ''}`;

  // Reject routine firm announcements or promotional fluff
  if (ROUTINE_OR_PROMOTIONAL_PATTERNS.some((rx) => rx.test(blob))) {
    return { score: 15, eligible: false, rejectionReason: 'Routine announcement or promotional content' };
  }

  let score = 38 + Math.min(20, sourceCredibility);

  // 1. Transaction Size & Economic Impact
  if (/\$[0-9.]+\s*billion|\$[0-9]+B\b|\bbillion-dollar\b/i.test(blob)) {
    score += 20;
  } else if (/\$[0-9.]+\s*million|\$[0-9]+M\b/i.test(blob)) {
    score += 9;
  }

  // 2. Regulatory, Judicial, International Geopolitical & Indian Law Gravity
  if (/\b(Supreme Court|SCOTUS|Supreme Court of India|SEBI|Reserve Bank of India|RBI|Competition Commission of India|CCI|NCLT|IBC|Delaware Chancery|Delaware Supreme Court|SEC|FTC|DOJ|Federal Reserve|CFIUS|European Commission|Fifth Circuit|Second Circuit|Basel III|Loper Bright|Chapter 11|tariffs|sanctions|geopolitics|cross-border|sovereign)\b/i.test(blob)) {
    score += 16;
  }

  // 3. Leading US Law Firm Involvement
  if (matchedFirmIds.length > 0) {
    score += 16 + Math.min(8, (matchedFirmIds.length - 1) * 4);
  }

  // 4. Verified HLS Faculty Authorship or Academic Research Value
  if (authorshipInfo.isFacultyAuthored) {
    score += 22;
  } else if (authorshipInfo.verifiedProfessorId) {
    score += 12;
  } else if (authorshipInfo.contributorType === 'law_firm_guest') {
    score += 10;
  }

  // 5. Recency Bonus
  const pubDate = new Date(item.publishedAt || Date.now());
  const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
  if (ageHours >= 0 && ageHours <= 48) {
    score += 6;
  }

  const finalScore = Math.max(10, Math.min(99, Math.round(score)));
  return {
    score: finalScore,
    eligible: finalScore >= 48,
    rejectionReason: finalScore < 48 ? 'Insufficient commercial or legal significance' : null,
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
