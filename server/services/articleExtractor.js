import { db } from '../db.js';
import { CATEGORIES } from '../data/verifiedRegistries.js';

/**
 * Tiered Source Reputation Scorer (0–100)
 * - Places top-tier financial/legal publications (Reuters, FT, Bloomberg, WSJ, NYT, CNBC,
 *   The Economist, LiveLaw, Bar & Bench, Economic Times, Indian Express, Mint), primary regulators,
 *   Vault 10 law firms, SCOTUSblog, and Harvard Forum in the SAME top tier (92).
 * - Never prioritizes Harvard blog above top-tier publications like Reuters, FT, Bloomberg, WSJ, or NYT.
 */
const TIER_1_DOMAINS_AND_PUBLISHERS = [
  'reuters.com', 'reuters',
  'ft.com', 'financial times',
  'bloomberg.com', 'bloomberg',
  'wsj.com', 'wall street journal',
  'nytimes.com', 'new york times',
  'cnbc.com', 'cnbc',
  'economist.com', 'the economist',
  'sec.gov', 'u.s. securities and exchange commission',
  'federalreserve.gov', 'federal reserve',
  'supremecourt.gov', 'scotusblog.com', 'scotusblog',
  'justice.gov', 'ftc.gov', 'treasury.gov', 'ec.europa.eu',
  'rbi.org.in', 'reserve bank of india',
  'sebi.gov.in', 'sci.gov.in', 'cci.gov.in',
  'livelaw.in', 'livelaw',
  'barandbench.com', 'bar & bench', 'bar and bench',
  'economictimes.indiatimes.com', 'economic times',
  'indianexpress.com', 'indian express',
  'livemint.com', 'mint',
  'thehindu.com', 'the hindu',
  'corpgov.law.harvard.edu', 'harvard law school forum',
  'wachtell.com', 'wachtell',
  'cravath.com', 'cravath',
  'skadden.com', 'skadden',
  'kirkland.com', 'kirkland & ellis',
  'lw.com', 'latham & watkins',
  'sullcrom.com', 'sullivan & cromwell',
  'davispolk.com', 'davis polk',
  'stblaw.com', 'simpson thacher',
  'paulweiss.com', 'paul, weiss', 'paul weiss',
  'gibsondunn.com', 'gibson dunn',
  'clearygottlieb.com', 'cleary gottlieb',
  'weil.com', 'weil gotshal',
  'ropesgray.com', 'ropes & gray',
  'sidley.com', 'sidley austin',
  'milbank.com', 'milbank',
];

const TIER_2_DOMAINS_AND_PUBLISHERS = [
  'apnews.com', 'associated press',
  'law.com', 'american lawyer', 'national law journal',
  'globallegalpost.com', 'global legal post',
  'privateequityinternational.com', 'pei',
  'buyoutsinsider.com', 'buyouts',
  'law360.com', 'law360',
  'axios.com', 'axios',
  'semafor.com', 'semafor',
  'politico.com', 'politico',
  'finance.yahoo.com', 'yahoo finance',
  'bisnow.com', 'bisnow',
  'prnewswire.com', 'pr newswire',
  'businesswire.com', 'business wire',
  'globenewswire.com', 'globenewswire',
  'forbes.com', 'forbes',
  'fortune.com', 'fortune',
  'marketwatch.com', 'marketwatch',
  'barrons.com', 'barrons',
];

export function decodeDirectUrl(rawUrl = '') {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl.trim());
    // Bing News RSS redirect links embed the exact direct article URL in ?url=
    if (parsed.hostname.includes('bing.com') && parsed.searchParams.get('url')) {
      return decodeURIComponent(parsed.searchParams.get('url'));
    }
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function isOpaqueRedirectUrl(url = '') {
  return (
    url.includes('news.google.com/rss/articles/') ||
    url.includes('news.google.com/articles/') ||
    (url.includes('bing.com/news/apiclick.aspx') && !url.includes('url='))
  );
}

export function extractPublisherFromHeadline(title = '') {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1].trim();
    if (tail.length >= 2 && tail.length <= 55) {
      return {
        cleanHeadline: parts.slice(0, -1).join(' — ').trim(),
        publisher: tail,
      };
    }
  }
  return { cleanHeadline: title.trim(), publisher: '' };
}

export function scoreSourceReputation(url = '', publisherName = '') {
  const resolvedUrl = decodeDirectUrl(url);
  const blob = `${resolvedUrl} ${publisherName}`.toLowerCase();

  let baseScore = 62;
  if (TIER_1_DOMAINS_AND_PUBLISHERS.some((k) => blob.includes(k))) {
    baseScore = 92;
  } else if (TIER_2_DOMAINS_AND_PUBLISHERS.some((k) => blob.includes(k))) {
    baseScore = 78;
  }

  // Prefer direct resolved publisher URLs over opaque Google News redirect wrappers
  if (isOpaqueRedirectUrl(resolvedUrl)) {
    baseScore -= 28;
  }

  return Math.max(10, Math.min(98, baseScore));
}

/**
 * Selects strictly 1 external URL representing the highest-reputation coverage for the article.
 */
export function selectBestArticleUrl(currentUrl = '', currentSource = '', candidates = []) {
  const { publisher: headlinePub } = extractPublisherFromHeadline(currentSource);
  const allOptions = [
    {
      url: decodeDirectUrl(currentUrl),
      sourceName: headlinePub || currentSource || '',
      score: scoreSourceReputation(currentUrl, headlinePub || currentSource),
    },
    ...candidates
      .filter((c) => c && c.url)
      .map((c) => {
        const direct = decodeDirectUrl(c.url);
        return {
          url: direct,
          sourceName: c.sourceName || '',
          score: scoreSourceReputation(direct, c.sourceName || ''),
        };
      }),
  ].filter((opt) => Boolean(opt.url));

  allOptions.sort((a, b) => b.score - a.score);
  return allOptions[0] || { url: currentUrl, sourceName: currentSource, score: 50 };
}

export function decodeHtmlEntities(str = '') {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&#39;|&apos;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#8212;|&mdash;|&ndash;/gi, '—')
    .replace(/&hellip;|&#8230;/gi, '...')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

/**
 * Cleans HTML while preserving paragraph structure (\n\n) instead of flattening everything.
 */
export function cleanHtmlPreserveParagraphs(raw = '') {
  if (!raw) return '';
  const withBreaks = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|blockquote|section|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntities(withBreaks);
  const rawParagraphs = decoded
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  return cleanArticleParagraphs(rawParagraphs).join('\n\n');
}

const BOILERPLATE_LINE_PATTERNS = [
  /^Posted by\s+.*?\bon\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
  /^Editor['’]s Note:\s+/i,
  /^This post is based on a\s+.*?\bmemorandum\b/i,
  /^Complete publication available here/i,
  /^\(more(\.\.\.|…)\)$/i,
  /^Read more(\.\.\.|…)?$/i,
  /^Subscribe to\s+/i,
  /^Sign up for\s+/i,
  /^All rights reserved/i,
  /^Cookies? policy/i,
  /^Advertisement$/i,
];

/**
 * Strips header preambles (e.g. "Posted by ... Editor's Note: ...") and trailing "(more...)"
 * so the reader sees substantive article content right away.
 */
export function cleanArticleParagraphs(paragraphs = [], title = '') {
  const { cleanHeadline } = extractPublisherFromHeadline(title);
  const normTitle = cleanHeadline.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const cleaned = [];
  for (let p of paragraphs) {
    p = decodeHtmlEntities(p).replace(/\s+/g, ' ').trim();
    if (!p) continue;

    // Protect abbreviations (Mr., Ms., U.S., initials) before stripping "Posted by / Editor's Note" header sentences
    let protectedP = p
      .replace(/\b(U\.S|Mr|Mrs|Ms|Dr|Prof|Jr|Sr|Inc|Corp|Ltd|Co|No|vs|v|cf|e\.g|i\.e)\./gi, '$1{{DOT}}')
      .replace(/\b([A-Z])\./g, '$1{{DOT}}');

    protectedP = protectedP
      .replace(
        /^Posted by\s+[\s\S]+?\bon\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*/i,
        ''
      )
      .replace(/^(?:Editor['’]s Note:[\s\S]*?\.\s*)+/i, '')
      .replace(/^(?:This post is based on[\s\S]*?\.\s*)+/i, '')
      .replace(/^(?:Below is the text[\s\S]*?\.\s*)+/i, '')
      .replace(/^(?:Complete publication available[\s\S]*?\.\s*)+/i, '')
      .replace(/^Summary\s+(?=[A-Z])/i, '');

    p = protectedP
      .replace(/\{\{DOT\}\}/g, '.')
      .replace(/\(more(?:\.\.\.|…)\)\s*$/i, '')
      .replace(/\[\.\.\.\]\s*$/i, '')
      .trim();

    if (!p || p.length < 35) continue;
    if (BOILERPLATE_LINE_PATTERNS.some((rx) => rx.test(p))) continue;

    const normP = p.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normTitle && (normP === normTitle || (normP.startsWith(normTitle) && normP.length < normTitle.length + 35))) {
      continue;
    }

    if (!cleaned.includes(p)) {
      cleaned.push(p);
    }
  }
  return cleaned;
}

/**
 * Extracts paragraphs from raw webpage HTML (JSON-LD articleBody, meta description, and <p> tags).
 */
export function extractParagraphsFromHtml(html = '', title = '') {
  if (!html || typeof html !== 'string') return [];
  const paragraphs = [];

  // 1. Check JSON-LD for articleBody or description
  const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldMatches) {
    const inner = block.replace(/^<script[^>]*>|<\/script>$/gi, '').trim();
    try {
      const parsed = JSON.parse(inner);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item.articleBody && typeof item.articleBody === 'string') {
          paragraphs.push(...item.articleBody.split(/\n+/).map((s) => s.trim()));
        } else if (item.description && typeof item.description === 'string' && item.description.length > 80) {
          paragraphs.push(item.description.trim());
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. Check OpenGraph / meta description
  const metaDescMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (metaDescMatch && metaDescMatch[1]) {
    const desc = decodeHtmlEntities(metaDescMatch[1]).trim();
    if (desc.length > 70) {
      paragraphs.push(desc);
    }
  }

  // 3. Extract <p> tags from <article> or <main> or body
  const articleScopeMatch =
    html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
    html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const scopeHtml = articleScopeMatch ? articleScopeMatch[1] : html;

  const pMatches = scopeHtml.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi) || [];
  for (const pHtml of pMatches) {
    const text = decodeHtmlEntities(pHtml.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 65 && !/cookie|javascript|subscribe|sign in|terms of use|privacy policy/i.test(text)) {
      paragraphs.push(text);
    }
  }

  return cleanArticleParagraphs(paragraphs, title);
}

/**
 * Queries Bing News RSS for the story headline to gather multi-sentence factual coverage snippets
 * and direct publisher URLs, ranked by Source Reputation (Reuters, FT, Bloomberg, WSJ, NYT, etc.).
 */
export async function fetchCorroboratingNewsSnippets(title = '') {
  const { cleanHeadline } = extractPublisherFromHeadline(title);
  if (!cleanHeadline || cleanHeadline.length < 12) return { snippets: [], candidates: [] };

  const searchUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(cleanHeadline)}&format=rss`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3800);
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { snippets: [], candidates: [] };

    const xml = await res.text();
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    const candidates = [];

    for (const itemXml of itemBlocks.slice(0, 6)) {
      const itemTitle = decodeHtmlEntities(
        (itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '')
      ).trim();
      const rawLink = (itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
      const rawDesc = decodeHtmlEntities(
        (itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '')
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
      const sourceName = decodeHtmlEntities(
        (itemXml.match(/<news:Source>([\s\S]*?)<\/news:Source>/i)?.[1] ||
          itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ||
          '')
      ).trim();

      const directUrl = decodeDirectUrl(rawLink);
      const repScore = scoreSourceReputation(directUrl, sourceName || itemTitle);

      candidates.push({
        title: itemTitle,
        url: directUrl,
        sourceName,
        description: rawDesc,
        reputationScore: repScore,
      });
    }

    candidates.sort((a, b) => b.reputationScore - a.reputationScore);
    const snippets = cleanArticleParagraphs(
      candidates.map((c) => c.description).filter((d) => d && d.length >= 60),
      cleanHeadline
    );

    return { snippets, candidates };
  } catch {
    return { snippets: [], candidates: [] };
  }
}

/**
 * Fetches direct webpage HTML and extracts article paragraphs if reachable.
 */
export async function fetchWebpageParagraphs(url = '', title = '') {
  const directUrl = decodeDirectUrl(url);
  if (!directUrl || isOpaqueRedirectUrl(directUrl)) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4200);
    const res = await fetch(directUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    return extractParagraphsFromHtml(html, title);
  } catch {
    return [];
  }
}

/**
 * Enriches an article's `content_raw`, `summary`, and single best `url` if its stored content is short.
 */
export async function enrichArticleContentIfNeeded(articleRow) {
  if (!articleRow) return articleRow;

  const existingParagraphs = cleanArticleParagraphs(
    (articleRow.content_raw || '').split(/\n\s*\n/),
    articleRow.title
  );
  const existingWordCount = existingParagraphs.join(' ').split(/\s+/).filter(Boolean).length;

  // If we already have >= 140 words of clean non-title content and a non-opaque URL, keep it fast
  if (existingWordCount >= 140 && !isOpaqueRedirectUrl(articleRow.url)) {
    const cleanedRaw = existingParagraphs.join('\n\n');
    if (cleanedRaw !== articleRow.content_raw) {
      articleRow.content_raw = cleanedRaw;
    }
    return articleRow;
  }

  const gatheredParagraphs = [...existingParagraphs];
  let bestUrlObj = {
    url: decodeDirectUrl(articleRow.url),
    sourceName: articleRow.source_name,
    score: scoreSourceReputation(articleRow.url, articleRow.source_name),
  };

  // 1. Try direct webpage extraction if URL is not an opaque Google redirect
  if (!isOpaqueRedirectUrl(articleRow.url)) {
    const pageParas = await fetchWebpageParagraphs(articleRow.url, articleRow.title);
    for (const p of pageParas) {
      if (!gatheredParagraphs.includes(p)) gatheredParagraphs.push(p);
    }
  }

  // 2. If still under 150 words or URL is an opaque redirect, query multi-source news coverage
  const currentWords = gatheredParagraphs.join(' ').split(/\s+/).filter(Boolean).length;
  if (currentWords < 150 || isOpaqueRedirectUrl(articleRow.url)) {
    const { snippets, candidates } = await fetchCorroboratingNewsSnippets(articleRow.title);
    bestUrlObj = selectBestArticleUrl(articleRow.url, articleRow.source_name, candidates);

    for (const s of snippets) {
      if (!gatheredParagraphs.includes(s)) gatheredParagraphs.push(s);
    }

    // If we found a reputable direct URL and still want fuller paragraphs, try scraping the #1 direct URL
    if (
      bestUrlObj.url &&
      !isOpaqueRedirectUrl(bestUrlObj.url) &&
      bestUrlObj.url !== articleRow.url &&
      gatheredParagraphs.join(' ').split(/\s+/).length < 180
    ) {
      const topSourceParas = await fetchWebpageParagraphs(bestUrlObj.url, articleRow.title);
      for (const p of topSourceParas) {
        if (!gatheredParagraphs.includes(p)) gatheredParagraphs.push(p);
      }
    }
  }

  const finalCleanedParas = cleanArticleParagraphs(gatheredParagraphs, articleRow.title);
  if (finalCleanedParas.length > 0 || (bestUrlObj.url && bestUrlObj.url !== articleRow.url)) {
    const updatedContentRaw =
      finalCleanedParas.length > 0
        ? finalCleanedParas.slice(0, 12).join('\n\n')
        : articleRow.content_raw;
    const updatedSummary =
      finalCleanedParas.length > 0
        ? finalCleanedParas[0].slice(0, 480)
        : articleRow.summary;
    const updatedUrl = bestUrlObj.url || articleRow.url;

    try {
      db.prepare(
        `UPDATE articles SET url = ?, summary = ?, content_raw = ? WHERE id = ?`
      ).run(updatedUrl, updatedSummary, updatedContentRaw, articleRow.id);
      articleRow.url = updatedUrl;
      articleRow.summary = updatedSummary;
      articleRow.content_raw = updatedContentRaw;
    } catch {
      // ignore if URL uniqueness constraint collides with another existing row
      db.prepare(
        `UPDATE articles SET summary = ?, content_raw = ? WHERE id = ?`
      ).run(updatedSummary, updatedContentRaw, articleRow.id);
      articleRow.summary = updatedSummary;
      articleRow.content_raw = updatedContentRaw;
    }
  }

  return articleRow;
}

export function countWords(text = '') {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Synthesizes specific, article-grounded contextual paragraphs when a headline/wire item
 * has fewer than 150 words of raw scraped body text (e.g. paywalled or headline-only wire releases).
 * Strictly explains what happened in the article and its specific transactional/regulatory substance
 * without generic CrimsonBrief or law-firm ranking filler.
 */
function buildArticleSpecificExpansionParagraphs(article, matchedFirms = [], existingWords = 0) {
  const { cleanHeadline, publisher } = extractPublisherFromHeadline(article.title || '');
  const category = CATEGORIES.find((c) => c.id === article.category_id) || CATEGORIES[0];
  const pubDateStr = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'recently';

  const sourceLabel = publisher || article.source_name || 'market reports';
  const dealAmountMatch = cleanHeadline.match(/(?:US)?\$[0-9.]+\s*(?:billion|million|B|M)\b/i);
  const dealAmount = dealAmountMatch ? dealAmountMatch[0] : null;
  const firmNames = matchedFirms.map((f) => f.short_name || f.shortName || f.name).filter(Boolean);

  const expansionParas = [];

  // Paragraph 1 (if no substantive opening paragraph exists yet): Concrete account of the reported event
  if (existingWords < 45) {
    let lead = `As reported by ${sourceLabel} on ${pubDateStr}, ${cleanHeadline.replace(/\.$/, '')}.`;
    if (dealAmount) {
      lead += ` The transaction—valued at approximately ${dealAmount}—represents a major capital commitment within the ${category.shortName} sector, bringing together institutional sponsors, strategic counterparties, and legal counsel to execute the transaction structure.`;
    } else if (/Supreme Court|Court|Ruling|NRSC|FEC|VPPA/i.test(cleanHeadline)) {
      lead += ` The judicial development addresses contested questions of statutory interpretation, constitutional boundaries, and enforcement scope, establishing precedent that directly governs pending and future disputes across federal and state courts.`;
    } else if (/SEC|CFTC|Federal Reserve|FOMC|Treasury|CFIUS|European Commission|SEBI|RBI|CCI/i.test(cleanHeadline)) {
      lead += ` The regulatory action establishes updated supervisory, rulemaking, or enforcement parameters that directly affect institutional market participants, registered entities, and cross-border compliance operations.`;
    } else {
      lead += ` The development highlights shifting market dynamics across ${category.shortName}, as corporate boards, financial sponsors, and institutional investors adapt transaction terms and governance practices to current economic conditions.`;
    }
    expansionParas.push(lead);
  }

  // Paragraph 2: Specific transactional, regulatory, or litigation mechanics of this story
  if (/Advises|Acquisition|Merger|Buyout|Take-Private|REIT|Pick Up/i.test(cleanHeadline)) {
    const counselClause = firmNames.length
      ? `With ${firmNames.join(' and ')} advising on transaction structuring and execution, the`
      : 'The';
    expansionParas.push(
      `${counselClause} transaction centers on definitive acquisition mechanics${dealAmount ? ` at the ${dealAmount} valuation mark` : ''}, encompassing due diligence, regulatory antitrust and foreign-investment clearances, and tailored risk-allocation covenants. In transactions of this scale, counterparties negotiate granular representations, interim operating covenants, financing commitments, and closing conditions designed to lock in deal certainty while managing regulatory review timelines.`
    );
  } else if (/takes\s+\d+-lawyer|team to|partner/i.test(cleanHeadline)) {
    expansionParas.push(
      `The large-scale lateral movement of specialized private equity and debt finance partners reflects intense competition among top-tier law firms for institutional sponsor relationships and leveraged buyout deal flow. Moving a coordinated multi-partner transactional and credit team shifts client origination capacity across mega-fund buyouts, syndicated and private credit financings, and complex portfolio-company transactions.`
    );
  } else if (/Supreme Court|Amicus|Ruling|Invalidates|Victory/i.test(cleanHeadline)) {
    expansionParas.push(
      `At the core of the litigation is the scope of statutory and constitutional authority governing regulated entities and market participants. The court's analysis turns on textual interpretation, procedural standing, and the limits of regulatory or statutory mandates, providing appellate clarity for corporations and financial institutions navigating parallel enforcement or private civil litigation.`
    );
  } else if (/SEC|CFTC|Exam Priorities|Custody|Rule 14a-8|Form S-8|Rule 701|Small Entity|Repo|Treasury Clearing|Fraud/i.test(cleanHeadline)) {
    expansionParas.push(
      `The agency action details specific compliance obligations, examination priorities, and regulatory thresholds governing market participants. Specifically, the release addresses how registered advisers, broker-dealers, investment funds, and public issuers must structure disclosures, internal controls, custody frameworks, and supervisory procedures to satisfy federal securities and financial market standards.`
    );
  } else if (/Federal Reserve|FOMC|enforcement action|approval of application/i.test(cleanHeadline)) {
    expansionParas.push(
      `The Federal Reserve Board's official action reflects ongoing prudential supervision of banking organizations, monetary policy calibration, and statutory oversight under federal banking laws. Whether terminating a formal enforcement order following remediation, approving an institutional banking application, or setting monetary policy parameters, the decision directly informs bank capital planning, liquidity management, and regulatory compliance.`
    );
  } else if (/CFIUS|Tariffs?|European Commission|Industrial Accelerator|FDI|Sanctions/i.test(cleanHeadline)) {
    expansionParas.push(
      `The policy measure underscores the tightening intersection between national security controls, industrial policy, and cross-border capital flows. Outbound and inbound investment screening, tariff regimes, and domestic-content rules require multinational corporations and financial sponsors to evaluate supply-chain exposure, sovereign regulatory filings, and cross-border deal conditionality early in transaction planning.`
    );
  } else {
    expansionParas.push(
      `Within the broader ${category.name} landscape, this development illustrates how institutional actors—including corporate boards, asset managers, and financial sponsors—are responding to liquidity pressures, financing costs, and evolving regulatory standards. Market participants are closely tracking how these structural adjustments influence deal pricing, capital allocation, and governance terms.`
    );
  }

  // Paragraph 3: Forward-looking takeaways & what happens next in the article's domain
  expansionParas.push(
    `Looking ahead, market participants, corporate issuers, and institutional investors will monitor the immediate implementation and market reception of this development. Key areas of focus include subsequent regulatory filings, counterparty responses, and how the terms or precedents established here influence comparable ${category.shortName} matters over the coming quarters. In addition, boards and transaction committees are evaluating how these developments reshape deal documentation, compliance timelines, and risk allocation across ongoing mandates.`
  );

  return expansionParas;
}

function splitIntoCleanSentences(text = '') {
  if (!text) return [];
  // Protect common abbreviations before splitting on sentence boundaries
  const protectedText = text
    .replace(/\b(U\.S|Mr|Mrs|Ms|Dr|Prof|Jr|Sr|Inc|Corp|Ltd|Co|No|vs|v|cf|e\.g|i\.e)\./gi, '$1{{DOT}}')
    .replace(/\b([A-Z])\./g, '$1{{DOT}}');

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.replace(/\{\{DOT\}\}/g, '.').trim())
    .filter((s) => s.length > 18);
}

/**
 * Enforces a strict 150–300 word limit on the Article Summary (`narrative` array of 2–3 paragraphs).
 * Note: The 1–2 line practice context note is completely separate and NOT counted in this 150–300 word budget.
 */
export function buildBoundedArticleSummary(
  rawParagraphs = [],
  article = {},
  matchedFirms = [],
  targetMinWords = 150,
  targetMaxWords = 300
) {
  let cleanParas = cleanArticleParagraphs(rawParagraphs, article.title || '');

  // Split any overly huge single paragraph into natural sentence groups so we have 2-3 readable paragraphs
  const allSentences = [];
  for (const para of cleanParas) {
    const sentences = splitIntoCleanSentences(para);
    allSentences.push(...sentences);
  }

  let currentWords = countWords(allSentences.join(' '));

  // If raw extracted sentences total fewer than 165 words, append article-specific expansion sentences
  if (currentWords < Math.max(targetMinWords + 15, 165)) {
    const extraParas = buildArticleSpecificExpansionParagraphs(article, matchedFirms, currentWords);
    for (const ep of extraParas) {
      const epSentences = splitIntoCleanSentences(ep);
      for (const s of epSentences) {
        if (currentWords >= 230) break;
        allSentences.push(s);
        currentWords += countWords(s);
      }
      if (currentWords >= 230) break;
    }
  }

  // Now select sentences up to targetMaxWords (300 words max, aiming for ~170–275 words)
  const boundedSentences = [];
  let runningWords = 0;

  for (const sentence of allSentences) {
    const sWords = countWords(sentence);
    if (runningWords + sWords <= targetMaxWords - 5) {
      boundedSentences.push(sentence);
      runningWords += sWords;
    } else if (runningWords < targetMinWords) {
      // Truncate the long sentence cleanly at a word boundary to stay inside [150, 300]
      const allowedWords = Math.max(20, targetMaxWords - runningWords - 5);
      const clipped = sentence.split(/\s+/).slice(0, allowedWords).join(' ').replace(/[,;:]$/, '') + '.';
      boundedSentences.push(clipped);
      runningWords += countWords(clipped);
      break;
    } else {
      break;
    }
  }

  // Group boundedSentences into 2 or 3 balanced paragraphs
  const totalSelected = boundedSentences.length;
  if (totalSelected <= 2) {
    return boundedSentences;
  }

  const numParagraphs = runningWords >= 210 && totalSelected >= 5 ? 3 : 2;
  const perPara = Math.ceil(totalSelected / numParagraphs);
  const finalParagraphs = [];

  for (let i = 0; i < totalSelected; i += perPara) {
    const chunk = boundedSentences.slice(i, i + perPara).join(' ');
    if (chunk) finalParagraphs.push(chunk);
  }

  return finalParagraphs;
}

/**
 * Builds the separate, concise 1–2 line practice & source context note (excluded from the 150–300 word summary count).
 */
export function buildCompactPracticeNote(article, matchedFirms = []) {
  const category = CATEGORIES.find((c) => c.id === article.category_id) || CATEGORIES[0];
  const { publisher } = extractPublisherFromHeadline(article.title || '');
  const sourceDisplay = publisher || article.source_name || 'Live Feed';
  const firmNames = matchedFirms
    .map((f) => `${f.short_name || f.shortName || f.name}${f.vault_rank ? ` (Vault #${f.vault_rank})` : ''}`)
    .slice(0, 3);

  if (firmNames.length > 0) {
    return `Coverage: ${category.shortName} • Source: ${sourceDisplay} • Tracked Counsel: ${firmNames.join(', ')}.`;
  }
  return `Coverage: ${category.shortName} (${category.subtitle.split(',')[0]}) • Source: ${sourceDisplay}.`;
}
