import assert from 'node:assert';
import { db, initializeDatabase } from './db.js';
import { CATEGORIES, INITIAL_LAW_FIRMS, VERIFIED_HLS_FACULTY } from './data/verifiedRegistries.js';
import {
  matchLawFirms,
  classifyAcademicAuthorship,
  computeSignificanceScore,
  deduplicateAndAssignCluster,
} from './services/curationFilter.js';
import {
  getOrGenerateArticleAnalysis,
  generateWeeklyDigest,
} from './services/llmProcessor.js';

async function runVerification() {
  console.log('=== CrimsonBrief Automated Verification Suite ===\n');

  // 1. Initialize SQLite Database
  initializeDatabase();
  const firmRows = db.prepare('SELECT * FROM law_firms').all();
  assert.strictEqual(CATEGORIES.length, 7, 'Must have exactly 7 topic categories');
  assert.ok(firmRows.length >= 15, 'Must seed at least 15 leading US law firms');
  console.log(`✓ [1/6] SQLite initialized: ${CATEGORIES.length} categories, ${firmRows.length} watched firms, ${VERIFIED_HLS_FACULTY.length} verified HLS professors.`);

  // 2. Verify Distinct Vault / AmLaw Revenue / Deal Volume Metrics
  const wachtell = INITIAL_LAW_FIRMS.find((f) => f.id === 'wachtell');
  const kirkland = INITIAL_LAW_FIRMS.find((f) => f.id === 'kirkland');
  assert.notStrictEqual(wachtell.vaultRank, wachtell.amLawRevenueRank, 'Vault prestige rank and AmLaw revenue rank must be tracked as distinct measures');
  assert.strictEqual(kirkland.amLawRevenueRank, 1, 'Kirkland & Ellis AmLaw revenue rank should be #1');
  console.log('✓ [2/6] Law firm watchlist separates Vault Prestige Rank, AmLaw Revenue Rank, and Deal Volume Tier.');

  // 3. Verify Strict HLS Faculty vs. Student vs. Law Firm Guest Classification
  const studentItem = {
    title: 'Note: Fiduciary Duties in Delaware Dual-Class Corporations',
    author: 'Jane Doe, J.D. Candidate, Class of 2026',
    sourceName: 'Harvard Law School Forum on Corporate Governance',
    summary: 'Student note analyzing corporate law.',
  };
  const studentAuth = classifyAcademicAuthorship(studentItem, []);
  assert.strictEqual(studentAuth.isFacultyAuthored, false, 'Student piece must NOT be marked as faculty-authored');
  assert.strictEqual(studentAuth.contributorType, 'student_author', 'Student piece must be classified as student_author');

  const guestFirmItem = {
    title: 'Takeover Defense Update',
    author: 'Wachtell, Lipton, Rosen & Katz',
    sourceName: 'Harvard Law School Forum on Corporate Governance',
    summary: 'Client memorandum on M&A.',
  };
  const guestAuth = classifyAcademicAuthorship(guestFirmItem, ['wachtell']);
  assert.strictEqual(guestAuth.isFacultyAuthored, false, 'Law firm guest post on HLS Forum must NOT be assumed to be HLS faculty');
  assert.strictEqual(guestAuth.contributorType, 'law_firm_guest');

  const facultyItem = {
    title: 'The Illusory Promise of Stakeholder Governance',
    author: 'Lucian A. Bebchuk and Roberto Tallarita',
    sourceName: 'Harvard Law School Forum on Corporate Governance',
    summary: 'Empirical analysis of stakeholder capitalism.',
  };
  const facultyAuth = classifyAcademicAuthorship(facultyItem, []);
  assert.strictEqual(facultyAuth.isFacultyAuthored, true, 'Verified HLS professor post must be marked isFacultyAuthored = true');
  assert.strictEqual(facultyAuth.verifiedProfessorId, 'lucian-bebchuk');
  console.log('✓ [3/6] Academic authorship verifier accurately distinguishes Verified HLS Faculty, Law Firm Guest Counsel, and Student Authors.');

  // 4. Verify Multi-Factor Curation Ranking & Promotional Filtering
  const promoItem = {
    title: 'Firm Announces New Partner Class and Opens New Office in Miami',
    summary: 'Register for our webinar on chambers rankings.',
  };
  const promoScore = computeSignificanceScore(promoItem, [], {});
  assert.strictEqual(promoScore.eligible, false, 'Routine firm announcements/promotional items must be filtered out');

  const megaDealItem = {
    title: 'Skadden and Wachtell Advise on $35 Billion Cross-Border Acquisition Amid DOJ Antitrust Review',
    summary: 'Blockbuster merger agreement involves significant regulatory breakup fees.',
    publishedAt: new Date().toISOString(),
  };
  const matchedFirms = matchLawFirms(megaDealItem, firmRows);
  assert.ok(matchedFirms.includes('skadden') && matchedFirms.includes('wachtell'));
  const megaScore = computeSignificanceScore(megaDealItem, matchedFirms, {}, 18);
  assert.strictEqual(megaScore.eligible, true);
  assert.ok(megaScore.score >= 85, `Expected high significance score >= 85, got ${megaScore.score}`);
  console.log(`✓ [4/6] Curation scorer rejected promotional fluff and scored $35B Vault 10 merger at ${megaScore.score}/100.`);

  // 5. Verify Deduplication & Story Clustering
  const existing = [
    {
      id: 'sample-corp-ma-1',
      title: 'Delaware Supreme Court Clarifies Controller Cleansing and MFW Safe Harbor in Match Group Freeze-Out Litigation',
      url: 'https://corpgov.law.harvard.edu/match-group',
      summary: 'Delaware Supreme Court rules on MFW controller transactions.',
      story_cluster_id: 'cluster-delaware-controller-governance',
      is_sample: 0,
    },
  ];
  const exactDup = deduplicateAndAssignCluster(
    {
      title: 'Delaware Supreme Court Clarifies Controller Cleansing and MFW Safe Harbor in Match Group Freeze-Out Litigation',
      url: 'https://corpgov.law.harvard.edu/match-group?utm_source=rss',
      summary: 'Duplicate link with UTM param.',
    },
    existing
  );
  assert.strictEqual(exactDup.isDuplicate, true, 'Normalized URL / identical title must be detected as duplicate');

  const relatedFollowUp = deduplicateAndAssignCluster(
    {
      title: 'After Match Group Freeze-Out Litigation: How Special Committees Apply Delaware Controller Cleansing and MFW Safe Harbor',
      url: 'https://corpgov.law.harvard.edu/match-group-followup',
      summary: 'Follow-up analysis on Delaware Supreme Court MFW controller transactions.',
    },
    existing
  );
  assert.strictEqual(relatedFollowUp.isDuplicate, false);
  assert.strictEqual(relatedFollowUp.storyClusterId, 'cluster-delaware-controller-governance', 'Related development must cluster into the same story timeline');
  console.log('✓ [5/6] Deduplication & Story Clustering verified.');

  // 6. Verify 6-Part Deep Analysis & Weekly Intelligence Digest
  const analysisRes = await getOrGenerateArticleAnalysis('sample-corp-ma-1');
  const a = analysisRes.analysis;
  assert.ok(a.detailedOverview?.narrative?.length > 0, 'Section A (Detailed Overview) present');
  assert.ok(a.conceptExplainer?.beginner && a.conceptExplainer?.intermediate && a.conceptExplainer?.advanced, 'Section B (3-Depth Concept Explainer) present');
  assert.ok(a.commercialImplications?.lawFirmAdvisoryRole, 'Section C (Commercial Implications) present');
  assert.ok(a.academicSynergies?.hlsCourses?.length > 0, 'Section D (Academic Synergies) present');
  assert.ok(a.professorConnections?.discussionQuestions?.length > 0, 'Section E (Professor Connections) present');
  assert.ok(a.furtherReading?.primarySources?.length > 0, 'Section F (Further Reading) present');

  const digestRes = await generateWeeklyDigest();
  assert.ok(digestRes.digest?.headlineSummary, 'Weekly Intelligence Digest generated');
  console.log('✓ [6/6] 6-Part Article Analysis (A–F) and Weekly Intelligence Digest verified.');

  const catCounts = db.prepare('SELECT category_id, COUNT(*) as total, SUM(CASE WHEN is_sample = 0 THEN 1 ELSE 0 END) as live_count FROM articles GROUP BY category_id').all();
  console.log('\nCurrent SQLite Category Distribution (crimsonbrief.sqlite):');
  for (const row of catCounts) {
    console.log(`  - ${row.category_id}: ${row.total} total (${row.live_count} live verified RSS)`);
  }
  console.log('\nALL VERIFICATION CHECKS PASSED!');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
