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
- Raw Summary / Content: ${article.content_raw || article.summary}

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

RETURN STRICT JSON WITH THIS EXACT STRUCTURE:
{
  "whyThisMatters": "1-2 sentence incisive explanation of why this development is commercially and legally significant.",
  "detailedOverview": {
    "narrative": [
      "Paragraph 1: Substantive account of the development, key parties, transaction values or regulatory scope, and current procedural posture.",
      "Paragraph 2: Doctrinal, statutory, or market background required to understand why this development breaks new ground.",
      "Paragraph 3: Key legal friction points, counsel roles, and what happens next."
    ],
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
    "conceptTerm": "Name of the core legal, financial, or regulatory mechanism in this article",
    "categoryId": "${article.category_id}",
    "shortDefinition": "1-sentence precise definition of the mechanism",
    "beginner": "Clear, plain-language explanation for someone encountering the mechanism for the first time, using intuitive commercial logic without losing accuracy.",
    "intermediate": "Doctrinal and transactional mechanics at the level of an upper-level law school course or junior corporate/regulatory associate.",
    "advanced": "Sophisticated structuring nuances, statutory/contractual edge cases, circuit splits, or empirical law-and-economics debates.",
    "practicalExample": "Concrete real-world or hypothetical deal/litigation scenario illustrating how the mechanism operates in practice."
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
