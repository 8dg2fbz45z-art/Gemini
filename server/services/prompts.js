import {
  CATEGORIES,
  VERIFIED_HLS_FACULTY,
  VERIFIED_PEER_INSTITUTIONS,
} from '../data/verifiedRegistries.js';

export const SYSTEM_INSTRUCTION_LEGAL_ANALYST = `You are CrimsonBrief’s Senior Legal, Commercial, and Academic Intelligence Analyst.
Your reader is a sophisticated prospective Harvard Law School LL.M. candidate building commercial awareness across top US law firms (Vault 10 / Am Law 50), corporate finance, macroeconomic policy, and legal scholarship.

STRICT EPISTEMIC & VERIFICATION RULES:
1. Clearly distinguish verified facts, unverified allegations/pleadings, and legal/commercial analysis.
2. Never fabricate citations, court holdings, deal values, law firm representations, Harvard Law School course titles, or faculty affiliations.
3. Only reference Harvard Law School professors and courses that appear in the Verified HLS Registry provided in the prompt, or explicitly note when a scholar is affiliated with another institution.
4. Do NOT assume every contributor to the Harvard Law School Forum on Corporate Governance is Harvard faculty (many are law firm partners or visiting scholars).
5. Avoid generic admissions clichés ("In your personal statement, say..."). Instead, formulate rigorous academic discussion questions and substantive intellectual connections.
6. Return valid JSON matching the exact requested schema.`;

export function buildArticleAnalysisPrompt(article, matchedFirms = [], knownGlossaryTerms = []) {
  const category = CATEGORIES.find((c) => c.id === article.category_id) || CATEGORIES[0];
  const relevantFaculty = VERIFIED_HLS_FACULTY.filter(
    (p) => p.categories.includes(article.category_id) || p.id === article.verified_professor_id
  );

  const firmContext = matchedFirms.length
    ? matchedFirms
        .map(
          (f) =>
            `${f.name} (Vault #${f.vault_rank || 'N/A'}, AmLaw Revenue #${f.amlaw_revenue_rank || 'N/A'}, ${f.deal_volume_tier})`
        )
        .join('; ')
    : 'No specific watched firm named in headline; analyze typical Vault 10 / AmLaw 50 advisory role for this matter.';

  const progressiveContext = knownGlossaryTerms.length
    ? `The user has already studied these legal/financial concepts in their Personal Glossary: [${knownGlossaryTerms.join(', ')}]. If any of these appear, build upon them rather than repeating basic definitions from scratch.`
    : 'No prior glossary concepts recorded yet.';

  return `Analyze the following legal/business news development and produce a comprehensive 6-part JSON analysis.

ARTICLE METADATA:
- Title: ${article.title}
- Source: ${article.source_name} (Type: ${article.source_type})
- Author: ${article.author || 'Not specified'}
- Published Date: ${article.published_at}
- Original URL: ${article.url}
- Category: ${category.name} (${category.id})
- Authorship Verification Status: ${article.contributor_type}
- Matched Law Firms: ${firmContext}
- Raw Summary / Content: ${(article.content_raw || article.summary || '').slice(0, 7000)}

VERIFIED HARVARD LAW SCHOOL FACULTY & COURSES REGISTRY FOR THIS SECTOR:
${JSON.stringify(
  relevantFaculty.map((f) => ({
    name: f.name,
    title: f.title,
    courses: f.courses,
    centers: f.centers,
    researchInterests: f.researchInterests,
    keyWorks: f.keyWorks,
  })),
  null,
  2
)}

VERIFIED PEER US LAW SCHOOL CENTERS:
${JSON.stringify(VERIFIED_PEER_INSTITUTIONS, null, 2)}

PROGRESSIVE LEARNING CONTEXT:
${progressiveContext}

CRITICAL ARTICLE SUMMARY INSTRUCTIONS:
Summarise the article in **150–300 words**, aiming for approximately 200 words. Use clear, concise, professional language suitable for a law student interested in business, finance, economics, technology, and legal developments.
- **Key Development:** Explain what happened, who was involved, and the essential facts.
- **Important Details:** Include relevant figures, dates, companies, laws, regulations, and judicial decisions.
- **Context:** Briefly explain necessary background and unfamiliar legal or financial concepts.
- **Significance:** Explain why the development matters and its potential legal, commercial, economic, or geopolitical implications.
- **Accuracy:** Distinguish facts from speculation. Never invent information or draw unsupported conclusions.
- **Format:** An informative headline ("summaryHeadline") followed by 2–4 coherent paragraphs ("narrative"). Integrate the significance naturally into the summary.
Prioritise substance over unnecessary detail, ensuring the reader understands **what happened, the relevant context, and why it matters** without needing to read the original article.

Also identify the SPECIFIC legal, financial, economic, or regulatory concept at the core of THIS particular article in "conceptExplainer" (never use a generic category-wide placeholder).

RETURN STRICT JSON WITH THIS EXACT STRUCTURE:
{
  "whyThisMatters": "1-2 sentence incisive explanation of why this development is commercially and legally significant.",
  "detailedOverview": {
    "summaryHeadline": "An informative headline capturing the core development and its significance",
    "narrative": [
      "Paragraph 1: Key development and important details (what happened, who was involved, essential facts, figures, dates, laws/regulations).",
      "Paragraph 2: Context and background (explaining necessary background and any unfamiliar legal or financial mechanisms).",
      "Paragraph 3: Significance integrated naturally into the summary (why the development matters and its legal, commercial, economic, or geopolitical implications). Ensure the 2–4 coherent paragraphs in narrative total 150–300 words, aiming for ~200 words."
    ],
    "practiceNote": "Short 1-2 line note on the practice area and counsel relevance (excluded from the 150-300 word summary count).",
    "partiesAndCounsel": [
      "List verified parties, regulators, and law firms involved (or clearly label typical practice counsel roles if specific firms are not disclosed in the raw text)."
    ],
    "dealValueAndStatus": "Concise summary of transaction value/scale and current legal status",
    "epistemicBreakdown": {
      "verifiedFacts": ["Fact 1 grounded in the source", "Fact 2 grounded in the source"],
      "allegationsAndDisputes": ["Contested legal claims, regulatory allegations, or unresolved factual disputes"],
      "analyticalConsensus": ["Commercial and doctrinal implications agreed upon by practitioners"]
    }
  },
  "conceptExplainer": {
    "conceptTerm": "Specific legal, financial, economic, or regulatory concept in THIS particular article",
    "categoryId": "${article.category_id}",
    "shortDefinition": "1-sentence precise definition of this specific concept",
    "beginner": "Clear, plain-language brief of the concept and how it operates in this article.",
    "intermediate": "Doctrinal, regulatory, or transactional mechanics at the level of an upper-level law student or associate.",
    "advanced": "Sophisticated structuring nuances, statutory/contractual edge cases, or policy debates around this concept.",
    "practicalExample": "Concrete real-world illustration of how this concept operates in practice.",
    "articleApplication": "How this specific concept directly governs or explains what happened in this article.",
    "keyRisks": "Key legal, regulatory, or commercial risks practitioners watch for with this mechanism.",
    "suggestedQuestions": [
      "Follow-up question 1 a law student might ask about this concept",
      "Follow-up question 2 connecting this concept to the article",
      "Follow-up question 3 on commercial or regulatory nuances"
    ]
  },
  "commercialImplications": {
    "businessRationale": "Explain the underlying commercial incentives, capital allocation logic, and strategic objectives of the corporate or institutional actors.",
    "structureAndFinancing": "Examine transaction structures, financing instruments, risk-allocation covenants, or regulatory compliance architecture.",
    "lawFirmAdvisoryRole": "Explain concretely how leading US law firms (Vault 10 / AmLaw 50 transactional, regulatory, or litigation practices) advise clients on or structure such matters.",
    "stakeholderImpact": "Why this development matters to boards, institutional investors, regulators, and legal practitioners."
  },
  "academicSynergies": {
    "intellectualConnection": "Substantive explanation of the theoretical and doctrinal connection between this news development and legal/economic scholarship.",
    "hlsCourses": [
      {
        "title": "Exact course title from the Verified HLS Registry",
        "instructors": "Verified instructor name(s) from the Registry",
        "connection": "Specific explanation of how this article's core problem is analyzed in that course."
      }
    ],
    "centersAndPeerPrograms": [
      "Verified HLS research center or peer US law school institute and why its research agenda intersects this topic."
    ]
  },
  "professorConnections": {
    "verifiedProfessor": "Name(s) of verified HLS faculty from the registry whose scholarship genuinely intersects this development",
    "affiliationStatus": "Verified Harvard Law School Faculty (Reference from Registry)",
    "scholarshipContext": "Detailed explanation of how the professor's published works and research interests illuminate the legal or economic tension in this article.",
    "discussionQuestions": [
      "Rigorous academic research or seminar discussion question 1",
      "Rigorous academic research or seminar discussion question 2"
    ]
  },
  "furtherReading": {
    "primarySources": [
      {
        "title": "Original article or referenced regulatory/judicial primary document",
        "type": "Primary Source / Original Report",
        "url": "${article.url}"
      }
    ],
    "secondaryCommentary": [
      {
        "title": "Harvard Law School Forum on Corporate Governance or relevant academic literature",
        "type": "Academic & Practitioner Commentary",
        "url": "https://corpgov.law.harvard.edu/"
      }
    ]
  }
}`;
}

export function buildWeeklyDigestPrompt(topArticles, glossaryTerms) {
  return `Synthesize a concise, high-signal Weekly Intelligence Digest for a prospective Harvard Law School LL.M. candidate based ONLY on the following curated developments and studied concepts from the past week.

CURATED ARTICLES THIS WEEK:
${JSON.stringify(
  topArticles.map((a) => ({
    title: a.title,
    category: a.category_id,
    source: a.source_name,
    publishedAt: a.published_at,
    whyThisMatters: a.why_this_matters,
    isFacultyAuthored: Boolean(a.is_faculty_authored),
    summary: a.summary,
  })),
  null,
  2
)}

CONCEPTS IN PERSONAL GLOSSARY:
${JSON.stringify(
  glossaryTerms.map((g) => ({
    term: g.term,
    category: g.category_id,
    shortDefinition: g.short_definition,
    masteryLevel: g.mastery_level,
  })),
  null,
  2
)}

RETURN STRICT JSON WITH THIS STRUCTURE:
{
  "headlineSummary": "2-3 sentence executive synthesis of the week's overarching legal, transactional, and regulatory themes.",
  "keyDevelopmentsByTheme": [
    {
      "theme": "Theme Title (e.g., Delaware Controller Governance & M&A Contracting)",
      "synthesis": "Substantive synthesis connecting the week's developments and law firm practice implications.",
      "relatedArticleTitles": ["Article Title 1"]
    }
  ],
  "facultyAndAcademicHighlights": [
    "Highlight of verified faculty scholarship or academic themes encountered this week."
  ],
  "conceptMasteryReview": [
    {
      "term": "Concept Term",
      "synthesisQuestion": "A self-test synthesis question connecting this concept to the week's commercial developments."
    }
  ]
}`;
}

export function buildArticleConceptPrompt(article, summaryText = '') {
  return `Identify the single most important, specific legal, financial, regulatory, or economic concept at the core of THIS specific article based on its headline and summary, and explain it clearly for a law student.

ARTICLE TITLE: ${article.title}
CATEGORY: ${article.category_id}
ARTICLE SUMMARY / CONTENT:
${(summaryText || article.content_raw || article.summary || '').slice(0, 4500)}

RULES:
1. The concept MUST be tailored specifically to what happens in THIS article (e.g., if the article is about a Treasury repo clearing exemption, identify "Central Clearing of U.S. Treasury Repo & Inter-Affiliate Exemptions"; if it is about an LBO of a REIT, identify "REIT Take-Private Leveraged Buyout (LBO) Structuring"; if it is about tariffs, identify the specific tariff/trade mechanism).
2. Never use a generic category-wide placeholder.

RETURN STRICT JSON WITH THIS EXACT STRUCTURE:
{
  "conceptTerm": "Specific name of the core concept in this article",
  "categoryId": "${article.category_id}",
  "shortDefinition": "1-sentence clear, precise definition of the concept.",
  "beginner": "A clear, accessible 3-4 sentence brief of the concept explaining how it works and why it exists.",
  "intermediate": "Detailed legal, regulatory, or financial mechanics of the concept (statutory/regulatory basis, market structure, and doctrinal standards).",
  "advanced": "Advanced structuring nuances, edge cases, regulatory tensions, or strategic debates surrounding this concept.",
  "practicalExample": "Concrete real-world example illustrating how this concept works in practice.",
  "articleApplication": "How this concept directly applies to the parties, facts, and outcome in '${article.title}'.",
  "keyRisks": "The main legal, regulatory, or commercial risks that counsel and principals manage when dealing with this concept.",
  "suggestedQuestions": [
    "Specific follow-up question 1 about how this concept works in the article",
    "Specific follow-up question 2 about legal or regulatory thresholds",
    "Specific follow-up question 3 about commercial or transactional impact"
  ]
}`;
}

export function buildConceptChatPrompt(article, concept, chatHistory = [], userQuestion = '') {
  const historyText = chatHistory
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Analyst'}: ${m.text}`)
    .join('\n');

  return `You are tutoring a sharp law student on the core legal/financial concept from the article they are reading.
Answer their question clearly, concisely, and accurately (in 80–180 words), grounding your explanation in both the general doctrine/finance mechanics and the specific context of the article.

ARTICLE TITLE: ${article.title}
ARTICLE SUMMARY: ${(article.content_raw || article.summary || '').slice(0, 2500)}
CORE CONCEPT: ${concept?.conceptTerm || 'Core Article Mechanism'} — ${concept?.shortDefinition || ''}

CONVERSATION SO FAR:
${historyText || 'No prior messages.'}

STUDENT QUESTION: ${userQuestion}

RETURN STRICT JSON WITH THIS STRUCTURE:
{
  "reply": "Clear, substantive, well-structured answer (1-2 short paragraphs) directly addressing the student's question.",
  "followUpSuggestions": [
    "Next logical follow-up question 1",
    "Next logical follow-up question 2"
  ]
}`;
}
