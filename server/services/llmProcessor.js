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
  buildArticleConceptPrompt,
  buildConceptChatPrompt,
} from './prompts.js';
import {
  enrichArticleContentIfNeeded,
  buildBoundedArticleSummary,
  buildCompactPracticeNote,
  extractPublisherFromHeadline,
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

function cleanJsonResponseText(rawText = '') {
  return rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
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

  const isVertexKey = apiKey.startsWith('AQ.');
  const endpointsForModel = (candidateModel) => {
    const genLangUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      candidateModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const vertexUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(
      candidateModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    return isVertexKey ? [vertexUrl, genLangUrl] : [genLangUrl, vertexUrl];
  };

  let lastError = null;
  for (const candidateModel of modelCascade) {
    for (const endpoint of endpointsForModel(candidateModel)) {
      const payload = {
        systemInstruction: {
          role: 'system',
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
          parsed: JSON.parse(cleanJsonResponseText(rawText)),
          modelUsed: `Google Gemini (${candidateModel})`,
        };
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError;
}

/**
 * Dynamically extracts a personalized, article-specific legal/financial concept from the article's actual text
 * so each article has a distinct, tailored concept rather than a static category placeholder.
 */
export function buildDynamicArticleConcept(article) {
  const { cleanHeadline } = extractPublisherFromHeadline(article.title || '');
  const blob = `${cleanHeadline} ${article.summary || ''} ${article.content_raw || ''}`;

  const SPECIFIC_CONCEPT_MATCHERS = [
    {
      rx: /\b(repo|treasury clearing|central clearing|inter-affiliate)\b/i,
      term: 'U.S. Treasury Repo Central Clearing & Inter-Affiliate Exemptions',
      shortDef:
        'The SEC regulatory mandate requiring central clearing of U.S. Treasury repurchase (repo) and cash transactions through a covered clearing agency, subject to conditional inter-affiliate exemptions.',
      beginner:
        'In the U.S. Treasury market, trillions of dollars in short-term loans ("repos") backed by government bonds occur daily. Central clearing interposes a clearinghouse between buyer and seller to prevent a default by one firm from freezing the financial system, while inter-affiliate exemptions allow related corporate subsidiaries to manage internal liquidity without double-clearing.',
      intermediate:
        'Under the SEC’s Treasury Clearing rules (Exchange Act Rule 17ad-22), covered clearing agencies (such as FICC) must require direct participants to submit all eligible secondary market Treasury cash and repo transactions for clearing, unless the transaction qualifies for a conditional inter-affiliate or foreign-sovereign exemption.',
      advanced:
        'Practitioners structure liquidity and collateral documentation around the internal credit-risk conditions of the inter-affiliate exemption and cross-border jurisdictional nexus rules for non-U.S. affiliates.',
      example:
        'A global broker-dealer routing internal liquidity transfers across its U.S. and European affiliates relies on SEC exemptive relief to avoid posting duplicate clearinghouse margin on internal repo legs.',
      risks:
        'Loss of exemptive eligibility if affiliate risk-management or external clearing conditions are breached, triggering mandatory margin and clearing onboarding costs.',
    },
    {
      rx: /\b(small entity|regulatory flexibility act|investment company|business development company)\b/i,
      term: 'Regulatory Flexibility Act (RFA) "Small Entity" Thresholds under the Investment Company & Advisers Acts',
      shortDef:
        'The statutory and SEC rule thresholds determining which investment funds and registered investment advisers qualify for tailored regulatory relief and economic-impact review as "small entities."',
      beginner:
        'Federal agencies are required by the Regulatory Flexibility Act to analyze how new rules burden smaller businesses and consider less costly compliance alternatives. The SEC sets asset-size thresholds to define which investment advisers and funds count as "small entities."',
      intermediate:
        'Under Rules 0-10 of the Investment Company Act of 1940 and rule 0-7 of the Investment Advisers Act of 1940, the SEC periodically updates net-asset and regulatory-assets-under-management (RAUM) thresholds to reflect market inflation and industry growth when conducting mandatory rulemaking cost-benefit analyses.',
      advanced:
        'Updating small-entity asset thresholds directly alters the scope of APA economic-impact challenges and tailored compliance phase-ins for emerging fund managers and lower-middle-market BDCs.',
      example:
        'When the SEC proposes new reporting or custody mandates, advisers below the updated small-entity asset threshold may receive extended transition periods or simplified compliance requirements.',
      risks:
        'Outdated asset thresholds can undercount affected smaller managers during SEC rulemaking, while threshold adjustments redefine which managers qualify for tiered regulatory relief.',
    },
    {
      rx: /\b(MOU|memorandum of understanding|AMF|cross-border supervision|supervisory cooperation)\b/i,
      term: 'Cross-Border Regulatory Memoranda of Understanding (MOUs) & Substituted Compliance',
      shortDef:
        'Bilateral arrangements between national securities regulators (such as the U.S. SEC and European/Asian authorities) enabling supervisory information sharing, joint inspections, and cross-border oversight.',
      beginner:
        'Because investment managers and financial firms operate across borders, national regulators sign formal cooperation agreements ("MOUs") so they can share inspection findings, coordinate enforcement, and supervise global firms without conflicting rules.',
      intermediate:
        'Supervisory MOUs establish protocols for confidential non-public information sharing, on-site examination of cross-border registered investment advisers, and early warning of systemic or compliance risks across jurisdictions.',
      advanced:
        'Global asset managers must harmonize GDPR/foreign data-privacy restrictions with SEC examination document-production requests executed under bilateral supervisory MOUs.',
      example:
        'A dual-registered U.S.–French asset manager undergoes coordinated supervisory review by the SEC and the French AMF under their bilateral MOU framework.',
      risks:
        'Cross-border regulatory arbitrage is curtailed, and compliance deficiencies identified by one domestic regulator can rapidly trigger parallel inquiries in partner jurisdictions.',
    },
    {
      rx: /\b(cherry[\s-]picking|allocation|disproportionately allocated|co-cio|western asset)\b/i,
      term: 'Trade Allocation Fiduciary Duty & "Cherry-Picking" Enforcement under Advisers Act § 206',
      shortDef:
        'The fiduciary prohibition against investment advisers opportunistically allocating profitable trades to favored or personal accounts while assigning losing trades to other client portfolios.',
      beginner:
        'Investment advisers manage money for many different clients at once and owe every client a duty of loyalty. "Cherry-picking" happens when a portfolio manager waits to see if a trade makes money before deciding which client account gets it—giving winners to favored funds and losers to others.',
      intermediate:
        'Under Section 206 of the Investment Advisers Act of 1940 and Rule 206(4)-7, advisers must maintain pre-trade or prompt systematic trade-allocation policies ensuring fair and equitable treatment across all client accounts, enforced via SEC statistical dispersion and latency surveillance.',
      advanced:
        'Enforcement actions frequently pair SEC civil fraud charges (Scienter under § 206(1) and negligence under § 206(2)) with parallel DOJ criminal wire/securities fraud indictments and derivative investor restitution claims.',
      example:
        'A portfolio manager executes block trades in derivatives in a suspense account and delays allocation until end-of-day mark-to-market gains are known.',
      risks:
        'Severe institutional reputational damage, massive client redemptions, disgorgement, industry bars, and supervisory liability for the advisory firm.',
    },
    {
      rx: /\b(cross trading|rule 17a-7|affiliated transactions)\b/i,
      term: 'Affiliated Cross-Trading & Valuation Safeguards under Investment Company Act Rule 17a-7',
      shortDef:
        'The SEC regulatory exemption permitting registered investment companies and affiliated accounts to buy and sell securities directly between one another without a broker, subject to strict market-price and board-oversight conditions.',
      beginner:
        'Normally, federal law bans an investment manager from selling a bond or stock from one of its funds directly to another of its funds—to prevent the manager from dumping bad assets into a favored client’s account. Rule 17a-7 allows these "cross trades" when they happen at a transparent market price and save brokerage fees for both funds.',
      intermediate:
        'Under Section 17(a) of the Investment Company Act of 1940 and Rule 17a-7, affiliated funds may engage in direct cross-trades of securities having readily available market quotations at the independent current market price, without paying brokerage commissions.',
      advanced:
        'Expanding fixed-income cross-trading eligibility requires calibrating independent pricing-service verification, Chief Compliance Officer (CCO) review protocols, and tension with Rule 2a-5 fair-valuation requirements.',
      example:
        'An asset manager executes an internal cross-trade of investment-grade corporate bonds between an index fund experiencing redemptions and an affiliated fund with new inflows, saving bid-ask spread costs.',
      risks:
        'Fiduciary conflicts if illiquid securities are cross-traded at stale prices to mask fund losses or favor higher-fee accounts.',
    },
    {
      rx: /\b(fraud\w*|defraud\w*|false sec filings|whatsapp|veterans|offering fraud|ponzi|misappropriat\w*)\b/i,
      term: 'Securities Offering Fraud & Anti-Fraud Enforcement (Section 17(a) & Rule 10b-5)',
      shortDef:
        'Federal anti-fraud provisions prohibiting material misrepresentations, fabricated regulatory filings, and deceptive schemes in connection with the offer or sale of securities.',
      beginner:
        'Federal securities laws make it illegal to lie to investors, fake SEC filings, or promise guaranteed returns to raise money. The SEC brings civil enforcement actions to freeze assets, halt ongoing scams, and recover funds for defrauded investors.',
      intermediate:
        'The SEC prosecutes offering frauds under Securities Act Section 17(a) and Exchange Act Section 10(b) and Rule 10b-5, frequently coupling antifraud counts with unregistered offering violations under Sections 5(a) and 5(c).',
      advanced:
        'Cross-border digital solicitation schemes implicate extraterritorial jurisdiction under the Dodd-Frank Act’s conduct-and-effects test (Morrison § 929P(b)), emergency asset freezes, and gatekeeper/platform scrutiny.',
      example:
        'Promoters fabricate EDGAR filings or performance records to create a veneer of legitimacy while soliciting retail investors.',
      risks:
        'Emergency temporary restraining orders (TROs), asset freezes, receiverships, civil monetary penalties, and officer-and-director bars.',
    },
    {
      rx: /\b(examination priorities|division of examinations|2027 priorities|exams)\b/i,
      term: 'SEC Division of Examinations (EXAMS) Risk-Based Supervisory Priorities',
      shortDef:
        'The SEC’s annual regulatory roadmap identifying the key compliance, conflict-of-interest, valuation, and technology practices subject to targeted inspections across registered advisers, funds, and broker-dealers.',
      beginner:
        'Every year, the SEC publishes a list of "Examination Priorities" telling investment firms, funds, and brokers exactly what SEC inspectors will look for during audits—such as hidden fees, complex financial products, cybersecurity, and AI claims.',
      intermediate:
        'Published by the SEC Division of Examinations under Exchange Act § 17 and Advisers Act § 204, the annual priorities guide risk-based sweep exams and deficiency letters across fiduciary duty compliance, private fund fee/expense allocations, and operational resiliency.',
      advanced:
        'Chief Compliance Officers (CCOs) use the annual EXAMS release to recalibrate Rule 206(4)-7 annual compliance reviews, pre-empting referral to the Division of Enforcement.',
      example:
        'Following the EXAMS release highlighting complex products and AI washing, a registered adviser audits its marketing disclosures and private credit valuation models.',
      risks:
        'Unaddressed deficiency findings during a routine examination frequently escalate into formal Division of Enforcement investigations.',
    },
    {
      rx: /\b(termination of enforcement action|enforcement action with|enforcement action against|consent order|cease and desist)\b/i,
      term: 'Federal Reserve Prudential Enforcement Orders & Supervisory Remediation (12 U.S.C. § 1818)',
      shortDef:
        'The statutory banking supervision process governing formal Federal Reserve enforcement orders against bank holding companies and their termination upon verified remediation of capital, governance, or AML deficiencies.',
      beginner:
        'When a bank or its parent company has weaknesses in risk management, capital reserves, or anti-money-laundering controls, the Federal Reserve issues a formal enforcement order requiring fixes. Once the bank proves it has fixed every issue, the Fed formally terminates the order.',
      intermediate:
        'Under Section 8 of the Federal Deposit Insurance Act (12 U.S.C. § 1818), the Federal Reserve Board imposes written agreements or cease-and-desist orders restricting dividends, expansion, or golden-parachute payments until supervisory examiners verify sustainable remediation.',
      advanced:
        'Termination of a formal § 1818 enforcement order restores a banking organization’s "well-managed" status under the Bank Holding Company Act, unlocking M&A eligibility and capital distribution flexibility.',
      example:
        'After overhauling board risk oversight and internal audit controls, a regional bank holding company secures Federal Reserve termination of its prior consent order.',
      risks:
        'While an enforcement order remains active, the institution faces growth caps, heightened supervisory assessments, and bars on strategic acquisitions.',
    },
    {
      rx: /\b(approval of application|bank holding company act|bank of nova scotia|change in bank control)\b/i,
      term: 'Bank Holding Company Act (BHCA) Regulatory Approval & Statutory Merger Factors',
      shortDef:
        'The Federal Reserve’s statutory review process evaluating banking acquisitions and investments for financial stability, managerial resources, competition, and community convenience.',
      beginner:
        'Before a bank can buy another financial institution or take a significant stake in a U.S. banking entity, it must apply for formal approval from the Federal Reserve, which checks that the deal is financially sound and won’t hurt competition.',
      intermediate:
        'Under Section 3 and Section 4 of the Bank Holding Company Act (12 U.S.C. §§ 1842, 1843), the Federal Reserve Board evaluates capital adequacy, anti-money-laundering compliance, Herfindahl-Hirschman Index (HHI) market concentration, and Community Reinvestment Act (CRA) records.',
      advanced:
        'Cross-border banking applications additionally require a determination that the foreign acquirer is subject to Comprehensive Consolidated Supervision (CCS) by its home-country regulator.',
      example:
        'An international banking group obtains Federal Reserve Board approval after demonstrating robust consolidated capital ratios and U.S. supervisory compliance.',
      risks:
        'Protracted regulatory review timelines, conditional divestiture commitments, or supervisory objections that delay or block closing.',
    },
    {
      rx: /\b(FOMC|federal open market committee|monetary policy|federal funds rate)\b/i,
      term: 'FOMC Monetary Policy Transmission, Policy Rate Calibration & Balance Sheet Normalization',
      shortDef:
        'The Federal Reserve’s statutory framework for setting the target federal funds rate and managing system liquidity to achieve maximum employment and stable prices.',
      beginner:
        'The Federal Open Market Committee (FOMC) meets regularly to set the benchmark U.S. interest rate. Its decisions directly determine borrowing costs for corporations, buyout funds, mortgages, and government debt worldwide.',
      intermediate:
        'Operating under the Federal Reserve Act’s dual mandate, the FOMC calibrates the target federal funds range, interest on reserve balances (IORB), and quantitative tightening (QT) securities runoff, reshaping corporate debt refinancing and M&A valuation multiples.',
      advanced:
        'Fixed-income and leveraged-finance markets parse FOMC policy statements for shifts in the neutral rate (r-star), term premium dynamics, and SOFR base-rate trajectories.',
      example:
        'An FOMC rate decision immediately reprices floating-rate SOFR syndicated term loans and alters interest-coverage ratios for leveraged buyout issuers.',
      risks:
        'Divergence between market rate-cut expectations and FOMC inflation vigilance can trigger credit-spread widening and refinancing stress.',
    },
    {
      rx: /\b(REIT|real estate investment trust|logistics assets|brookfield)\b/i,
      term: 'Public-to-Private REIT Leveraged Buyouts (LBOs) & Asset Portfolio Take-Privates',
      shortDef:
        'The acquisition of a publicly traded Real Estate Investment Trust (REIT) by private equity or institutional sponsors to capture net-asset-value (NAV) discounts and scale cash-flowing property portfolios.',
      beginner:
        'When a public real estate company (a "REIT") trades on the stock market for less than the true value of its warehouses or buildings, private equity firms and pension funds can team up to buy the entire company, take it private, and manage the properties directly.',
      intermediate:
        'REIT take-private transactions combine sponsor equity commitments with commercial mortgage-backed securities (CMBS) or institutional property-level debt, structured through forward or reverse triangular mergers while preserving tax-efficient REIT qualification under IRC §§ 856–860.',
      advanced:
        'Counsel navigate Maryland REIT corporate governance statutes (where most public REITs are chartered), operating partnership (UPREIT) unit rollovers, and debt-assumption change-of-control covenants.',
      example:
        'Institutional sponsors complete a multi-billion-dollar buyout of an industrial REIT to consolidate high-demand U.S. logistics and distribution warehouses.',
      risks:
        'Interest-rate sensitivity on property-level refinancing, cap-rate expansion, and tax disqualification traps if REIT asset/income tests are breached post-closing.',
    },
    {
      rx: /\b(takes\s+\d+-lawyer|lateral|team to|debt finance team)\b/i,
      term: 'Institutional Law Firm Group Lateral Acquisitions & Sponsor Client Portability',
      shortDef:
        'The strategic recruitment of multi-partner transactional and debt-finance practice groups by elite law firms to capture private equity sponsor relationships and deal market share.',
      beginner:
        'Top corporate law firms compete fiercely to advise private equity giants on billion-dollar buyouts. Instead of growing slowly, a firm may hire an entire 30-to-40-lawyer private equity and debt finance team at once to immediately bring over major sponsor clients and deal expertise.',
      intermediate:
        'Group lateral moves require navigating partnership agreement notice and non-solicitation covenants, state bar Rule 5.6 restrictions on restrictive covenants, and complex conflict-of-interest waivers under Model Rules 1.7, 1.9, and 1.10 across hundreds of active sponsor matters.',
      advanced:
        'Consolidating top-tier sponsor buyout and leveraged finance counsel under one roof enables seamless execution across syndicated bank debt, private credit unitranche facilities, and mega-fund buyouts.',
      example:
        'A leading private equity practice recruits a 40-lawyer buyout and acquisition-finance team from a peer firm to expand its New York and global sponsor bench.',
      risks:
        'Positional client conflicts blocking matter transfers, partnership compensation guarantee dilution, and cultural integration friction.',
    },
    {
      rx: /\b(cash crunch|continuation fund|GP-led|NAV loan|dividend recap|liquidity)\b/i,
      term: 'Private Equity Liquidity Engineering: Continuation Vehicles, NAV Facilities & Structured Exits',
      shortDef:
        'Financial and contractual mechanisms used by private equity sponsors to generate cash distributions for Limited Partners (LPs) when traditional IPO and M&A exit markets are constrained.',
      beginner:
        'When high interest rates or slow stock markets make it hard for private equity firms to sell the companies they own, they use alternative tools—like transferring prize companies into a new "continuation fund" or borrowing against the fund’s portfolio—to return cash to their investors.',
      intermediate:
        'GP-led secondary continuation funds and Net Asset Value (NAV) credit facilities allow sponsors to extend hold periods on trophy assets while offering existing LPs a cash-out election, subject to Limited Partner Advisory Committee (LPAC) conflict-of-interest waivers and fairness opinions.',
      advanced:
        'Structuring GP-led secondaries requires balancing pricing tension between rolling and selling LPs, LPA borrowing limitations, and ILPA transparency guidelines.',
      example:
        'Facing a muted IPO window, a buyout sponsor utilizes a structured liquidity facility and partial minority stake sale to return capital to LPs ahead of its next fundraising cycle.',
      risks:
        'Fiduciary valuation conflicts when the same sponsor sits on both sides of a continuation vehicle, alongside compounded fund-level leverage from NAV loans.',
    },
    {
      rx: /\b(tariff|trade|canada|import|customs|section 232|ieepa|wto)\b/i,
      term: 'Executive Tariff Authority (Section 232 / Section 301 / IEEPA) & Cross-Border Supply-Chain Allocation',
      shortDef:
        'The statutory trade authorities enabling executive imposition of import tariffs and the commercial contract mechanisms used to allocate tariff cost shocks across cross-border supply chains.',
      beginner:
        'Tariffs are taxes placed on goods imported from other countries. While Congress holds constitutional authority over trade, several federal statutes delegate broad power to the President to impose tariffs for national security or unfair trade practices—immediately raising costs for cross-border manufacturers and consumers.',
      intermediate:
        'Executive tariff actions rely on Section 232 of the Trade Expansion Act of 1962 (national security), Section 301 of the Trade Act of 1974, or IEEPA, prompting commercial counterparties to invoke price-escalation clauses, Incoterms importer-of-record allocations, and force majeure or hardship defenses.',
      advanced:
        'In cross-border M&A and supply contracting, counsel draft bespoke tariff-sharing matrices, country-of-origin substantial transformation covenants, and valuation earnout adjustments tied to bilateral trade policy.',
      example:
        'Cross-border automotive and industrial manufacturers face billions in added input costs from bilateral tariffs, prompting legislative pushback and supply-chain restructuring.',
      risks:
        'Retaliatory counter-tariffs, margin compression under fixed-price supply contracts, and judicial challenges to the statutory scope of executive tariff delegations.',
    },
    {
      rx: /\b(reverse cfius|outbound investment|cfius|foreign direct investment|fdi|industrial accelerator)\b/i,
      term: 'Inbound FDI Screening (CFIUS) & Outbound National Security Investment Controls ("Reverse CFIUS")',
      shortDef:
        'The regulatory regimes governing national-security review of foreign investments into domestic critical sectors and restrictions on outbound capital flows into sensitive foreign technologies.',
      beginner:
        'Governments increasingly screen cross-border investments to protect national security and strategic industries. "CFIUS" reviews foreign buyers investing in U.S. companies, while new "Reverse CFIUS" rules and EU industrial acts restrict domestic capital and technology from flowing into sensitive sectors abroad.',
      intermediate:
        'Under the Defense Production Act (FIRRMA) and Treasury’s Outbound Investment Security Program (31 C.F.R. Part 850), U.S. persons face mandatory notifications or outright prohibitions on equity, debt, and joint-venture investments involving covered foreign semiconductors, quantum computing, and frontier AI.',
      advanced:
        'In parallel, the European Commission’s FDI screening and industrial policy frameworks impose domestic value-add ("Made in EU") and strategic-sector reciprocity conditions on foreign acquirers and state-backed bidders.',
      example:
        'Multinational sponsors and corporate acquirers must screen both inbound and outbound cross-border transactions against Treasury’s codified Reverse CFIUS regulations and EU industrial rules.',
      risks:
        'Mandatory divestment orders, blocked closings, civil penalties up to twice the transaction value, and strict LP knowledge-standard compliance obligations.',
    },
    {
      rx: /\b(NRSC v\. FEC|coordinated spending|campaign finance|first amendment|political part)/i,
      term: 'First Amendment Scrutiny of Campaign Finance & Political Party Coordinated Expenditure Limits',
      shortDef:
        'The constitutional doctrine governing whether statutory caps on coordinated spending between political parties and candidates violate the First Amendment’s protection of political speech.',
      beginner:
        'Federal campaign finance laws distinguish between money spent independently and money spent in direct coordination with a candidate. In challenges to party spending limits, the Supreme Court weighs whether restricting coordinated party expenditures is justified to prevent quid-pro-quo corruption or unconstitutionally restricts core political speech.',
      intermediate:
        'Under Buckley v. Valeo and subsequent Supreme Court precedent (McCutcheon, Cruz), restrictions on campaign expenditures face rigorous First Amendment scrutiny and must be narrowly tailored to preventing actual or apparent quid-pro-quo corruption rather than merely leveling electoral influence.',
      advanced:
        'Invalidating statutory limits on party-coordinated expenditures under 52 U.S.C. § 30116(d) reshapes the institutional balance between formal political party committees and independent Super PACs.',
      example:
        'The Supreme Court evaluates whether FECA’s limits on coordinated party expenditures remain constitutional under modern First Amendment campaign-finance jurisprudence.',
      risks:
        'Major structural shifts in federal compliance rules for political committees, corporate PACs, and regulated lobbying/campaign disclosures.',
    },
    {
      rx: /\b(FS Credit|closed-end fund|investment company act|section 18|control share)\b/i,
      term: 'Investment Company Act Governance, Closed-End Fund Protections & Implied Private Rights of Action',
      shortDef:
        'The federal statutory framework under the Investment Company Act of 1940 governing registered closed-end funds, shareholder voting protections, and the availability of private litigation remedies.',
      beginner:
        'Closed-end investment funds trade on stock exchanges and often trade below the value of their underlying investments, attracting activist hedge funds. Litigation under the Investment Company Act tests whether activist investors have an implied right to sue in federal court to overturn fund defensive measures.',
      intermediate:
        'Disputes involving registered closed-end funds center on Section 18(i) (equal voting rights) and Section 47(b) (rescission of unlawful contracts) of the Investment Company Act of 1940, alongside state statutory control-share acquisition defenses.',
      advanced:
        'Appellate and Supreme Court rulings restricting implied private rights of action under Alexander v. Sandoval principles significantly strengthen closed-end fund boards against activist takeover arbitrage.',
      example:
        'A closed-end credit fund defends its governance structure before the U.S. Supreme Court against activist challenges under the Investment Company Act.',
      risks:
        'Shifts in the availability of private federal causes of action alter the leverage between closed-end fund managers and activist arbitrage funds.',
    },
    {
      rx: /\b(form pf|private fund reporting|cftc|advisers act)\b/i,
      term: 'SEC & CFTC Form PF Systemic Risk Reporting for Private Fund Advisers',
      shortDef:
        'The joint SEC and CFTC regulatory reporting regime requiring private equity, hedge fund, and liquidity fund advisers to disclose granular portfolio leverage, counterparty exposure, and stress events.',
      beginner:
        'Although private funds (like hedge funds and private equity funds) don’t sell shares to the general public, regulators require large fund managers to file confidential "Form PF" reports so the government can monitor whether hidden leverage or fund stress could threaten the broader financial system.',
      intermediate:
        'Enacted under Dodd-Frank Act Section 404 (Advisers Act § 204(b)), joint SEC/CFTC Form PF amendments expand reporting on master-feeder structures, trading vehicles, borrowing/counterparty concentration, and trigger-based current reporting of material fund stress events.',
      advanced:
        'Dual-registered Commodity Pool Operators (CPOs) and investment advisers must harmonize data aggregation architectures across SEC and CFTC reporting schedules while protecting proprietary portfolio strategies.',
      example:
        'Private fund sponsors overhaul internal fund-accounting pipelines to comply with amended SEC and CFTC Form PF systemic-risk reporting templates.',
      risks:
        'Heightened regulatory examination visibility into fund-level leverage, valuation marks, and redemption gates.',
    },
  ];

  for (const matcher of SPECIFIC_CONCEPT_MATCHERS) {
    if (matcher.rx.test(blob)) {
      return {
        conceptTerm: matcher.term,
        categoryId: article.category_id,
        shortDefinition: matcher.shortDef,
        beginner: matcher.beginner,
        intermediate: matcher.intermediate,
        advanced: matcher.advanced,
        practicalExample: matcher.example,
        articleApplication: `In "${cleanHeadline}", this mechanism directly governs the legal, regulatory, or transactional actions reported and explains the strategic posture of the involved parties.`,
        keyRisks: matcher.risks,
        suggestedQuestions: [
          `How does ${matcher.term.split('&')[0].trim()} specifically apply to the facts in "${cleanHeadline}"?`,
          `What are the main legal or financial risks that counsel and decision-makers face here?`,
          `Can you walk me through a step-by-step real-world example of how this works in practice?`,
        ],
      };
    }
  }

  // Dynamic fallback tailored directly to the article's own headline and subject matter
  const dealMatch = cleanHeadline.match(/(?:US)?\$[0-9.]+\s*(?:billion|million|B|M)\b/i);
  if (/Acquisition|Merger|Advises|Buyout/i.test(cleanHeadline)) {
    const term = `Strategic M&A Structuring, Valuation & Closing Conditionality (${cleanHeadline.slice(0, 52)}${cleanHeadline.length > 52 ? '...' : ''})`;
    return {
      conceptTerm: term,
      categoryId: article.category_id,
      shortDefinition: `The contractual, regulatory, and corporate-governance architecture governing ${cleanHeadline}.`,
      beginner: `When executing a major corporate acquisition${dealMatch ? ` valued at ${dealMatch[0]}` : ''}, the buyer and seller negotiate a definitive merger agreement that locks in the purchase price, allocates regulatory approval risks, and governs how the target business operates until closing.`,
      intermediate: `Transaction counsel structure representations and warranties, Material Adverse Effect (MAE) definitions, antitrust/regulatory clearance covenants, and termination remedies tailored to the industry and counterparty profile in ${cleanHeadline}.`,
      advanced: `At an advanced level, dealmakers calibrate financing commitment certainty, interim operating covenants, and post-closing integration or indemnification mechanics to protect shareholder value.`,
      practicalExample: `In "${cleanHeadline}", transaction counsel coordinate due diligence, board fiduciary approvals, and regulatory filings to bring the transaction from signing to closing.`,
      articleApplication: `Directly explains the deal structuring, valuation, and legal advisory work reported in "${cleanHeadline}".`,
      keyRisks: `Regulatory antitrust delays, valuation shifts between signing and closing, and financing or integration execution risks.`,
      suggestedQuestions: [
        `What are the key deal-protection and closing conditions in a transaction like "${cleanHeadline}"?`,
        `How do law firms allocate antitrust and regulatory risk between the buyer and seller here?`,
        `What financial and strategic factors drive this acquisition?`,
      ],
    };
  }

  const dynamicTerm = `Legal, Regulatory & Commercial Framework: ${cleanHeadline.slice(0, 68)}`;
  return {
    conceptTerm: dynamicTerm,
    categoryId: article.category_id,
    shortDefinition: `The core legal, regulatory, and market mechanism underlying "${cleanHeadline}".`,
    beginner: `This article centers on the legal and commercial rules governing ${cleanHeadline}. Understanding the underlying regulatory framework and market incentives helps explain why the parties and authorities acted as they did and what it means for the sector.`,
    intermediate: `At a doctrinal and practice level, this development implicates statutory authority, regulatory compliance standards, and institutional risk allocation across the affected market participants.`,
    advanced: `Practitioners analyze how the precedent or market shift in "${cleanHeadline}" alters future transaction structuring, compliance programs, and litigation or regulatory strategy.`,
    practicalExample: `Market participants directly affected by "${cleanHeadline}" must adjust their operational, financial, or legal compliance strategies in response.`,
    articleApplication: `Directly governs the core event, parties, and legal/commercial implications reported in "${cleanHeadline}".`,
    keyRisks: `Regulatory enforcement exposure, compliance transition costs, and strategic misalignment if market participants fail to adapt.`,
    suggestedQuestions: [
      `What is the core legal or financial mechanism driving "${cleanHeadline}"?`,
      `Why does this development matter for companies, investors, and law firms?`,
      `What are the main counterarguments or risks surrounding this development?`,
    ],
  };
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
  const dynamicConcept = buildDynamicArticleConcept(article);
  const { cleanHeadline } = extractPublisherFromHeadline(article.title || '');

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
      summaryHeadline: cleanHeadline,
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
    conceptExplainer: dynamicConcept,
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
          title: 'Harvard Law School Forum on Corporate Governance (Tertiary Repository)',
          type: 'Tertiary Academic Reference',
          url: 'https://corpgov.law.harvard.edu/',
        },
      ],
    },
  };
}

const LEGACY_STATIC_CONCEPT_TERMS = new Set([
  'Fiduciary Standard of Review, Deal Protection Devices & Regulatory Risk Allocation',
  'Syndicated Credit Architecture, Liability Management & Prudential Capital Regulation',
  'Mandatory Securities Disclosure, Gatekeeper Due Diligence & Offering Exemptions',
  'Limited Partnership Governance (LPAs), Fiduciary Conflicts & Continuation Vehicles',
  'Algorithmic & Foundation Model Governance, Digital Antitrust & IP Provenance',
  'Leveraged Buyout (LBO) Risk Allocation, Take-Private Contracting & Sponsor Financing',
  'Post-Loper Bright Administrative Review, Cross-Border Regulatory Clearance & Sovereign Risk',
]);

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
      const hasLegacyStaticConcept = LEGACY_STATIC_CONCEPT_TERMS.has(parsed?.conceptExplainer?.conceptTerm || '');

      if (
        !hasLegacyBoilerplate &&
        !hasLegacyStaticConcept &&
        narrativeWords >= 145 &&
        narrativeWords <= 315 &&
        parsed?.detailedOverview?.practiceNote
      ) {
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
      const { cleanHeadline } = extractPublisherFromHeadline(article.title || '');
      const fallbackDynamicConcept = buildDynamicArticleConcept(article);
      const rawConcept = rawParsed?.conceptExplainer || {};
      const finalConcept =
        rawConcept.conceptTerm && !LEGACY_STATIC_CONCEPT_TERMS.has(rawConcept.conceptTerm)
          ? {
              ...fallbackDynamicConcept,
              ...rawConcept,
              suggestedQuestions:
                Array.isArray(rawConcept.suggestedQuestions) && rawConcept.suggestedQuestions.length
                  ? rawConcept.suggestedQuestions
                  : fallbackDynamicConcept.suggestedQuestions,
            }
          : fallbackDynamicConcept;

      analysisObj = {
        ...rawParsed,
        detailedOverview: {
          ...(rawParsed.detailedOverview || {}),
          summaryHeadline: rawParsed?.detailedOverview?.summaryHeadline || cleanHeadline,
          narrative: finalNarrative,
          practiceNote: finalPracticeNote,
        },
        conceptExplainer: finalConcept,
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

/**
 * On-demand Concept Identifier & Explorer for a specific article.
 * Uses the article's summary and text to identify its core legal/financial/economic concept
 * and caches it back into the article's analysis object.
 */
export async function identifyOrExploreArticleConcept(articleId, { forceRefresh = false } = {}) {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  const analysisBundle = await getOrGenerateArticleAnalysis(articleId);
  const analysisObj = analysisBundle.analysis || {};
  const existingConcept = analysisObj.conceptExplainer || buildDynamicArticleConcept(article);
  const { hasApiKey } = getGeminiConfig();

  // If Gemini is available and either forceRefresh was requested or the concept is missing rich fields, ask Gemini
  if (hasApiKey && (forceRefresh || !existingConcept.articleApplication || !existingConcept.keyRisks)) {
    try {
      const summaryText =
        analysisObj?.detailedOverview?.narrative ||
        article.why_this_matters ||
        article.summary_snippet ||
        '';
      const prompt = buildArticleConceptPrompt(article, summaryText);
      const res = await callGeminiJson(prompt);
      if (res.parsed?.term && res.parsed?.beginner) {
        const enrichedConcept = {
          ...existingConcept,
          ...res.parsed,
          suggestedQuestions: Array.isArray(res.parsed.suggestedQuestions) && res.parsed.suggestedQuestions.length > 0
            ? res.parsed.suggestedQuestions
            : existingConcept.suggestedQuestions,
        };
        analysisObj.conceptExplainer = enrichedConcept;
        db.prepare(`
          UPDATE article_analyses
          SET analysis_json = ?, model_used = ?, generated_at = ?
          WHERE article_id = ?
        `).run(
          JSON.stringify(analysisObj),
          res.modelUsed,
          new Date().toISOString(),
          articleId
        );
        return {
          articleId,
          modelUsed: res.modelUsed,
          concept: enrichedConcept,
        };
      }
    } catch (err) {
      console.warn(`Concept exploration Gemini call fallback for ${articleId}:`, err.message);
    }
  }

  return {
    articleId,
    modelUsed: analysisBundle.modelUsed,
    concept: existingConcept,
  };
}

/**
 * Interactive Concept Chatbox handler.
 * Lets the user ask follow-up questions about the article's core concept.
 */
export async function chatAboutArticleConcept(articleId, { question = '', history = [] } = {}) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) {
    throw new Error('Question is required');
  }

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  const analysisBundle = await getOrGenerateArticleAnalysis(articleId);
  const concept = analysisBundle?.analysis?.conceptExplainer || buildDynamicArticleConcept(article);
  const { hasApiKey } = getGeminiConfig();

  if (hasApiKey) {
    try {
      const prompt = buildConceptChatPrompt(article, concept, history, cleanQuestion);
      const res = await callGeminiJson(prompt);
      if (res.parsed?.reply) {
        return {
          articleId,
          modelUsed: res.modelUsed,
          reply: res.parsed.reply,
          followUpSuggestions: Array.isArray(res.parsed.followUpSuggestions)
            ? res.parsed.followUpSuggestions.slice(0, 3)
            : [],
        };
      }
    } catch (err) {
      console.warn(`Concept chat Gemini call fallback for ${articleId}:`, err.message);
    }
  }

  // Deterministic, concept-and-article-grounded conversational fallback
  const qLower = cleanQuestion.toLowerCase();
  const cleanHeadline = extractPublisherFromHeadline(article.title || '').cleanTitle || article.title;
  let reply = '';

  if (qLower.includes('advance') || qLower.includes('technical') || qLower.includes('doctrin') || qLower.includes('deep')) {
    reply = `${concept.advanced || concept.intermediate}\n\nIn the specific context of "${cleanHeadline}", ${concept.articleApplication || concept.practicalExample}`;
  } else if (qLower.includes('risk') || qLower.includes('counsel') || qLower.includes('structur') || qLower.includes('draft')) {
    reply = `${concept.keyRisks || concept.intermediate}\n\nPractice Application: ${concept.practicalExample}`;
  } else if (qLower.includes('example') || qLower.includes('apply') || qLower.includes('article') || qLower.includes('here')) {
    reply = `${concept.articleApplication || concept.practicalExample}\n\nFrom a legal and financial standpoint, ${concept.intermediate}`;
  } else if (qLower.includes('simple') || qLower.includes('beginner') || qLower.includes('what is') || qLower.includes('explain')) {
    reply = `${concept.shortDefinition}\n\n${concept.beginner}\n\nHow it connects to this article: ${concept.articleApplication || concept.practicalExample}`;
  } else {
    reply = `Regarding "${concept.term}" in "${cleanHeadline}":\n\n${concept.intermediate}\n\nSpecifically for this development, ${concept.articleApplication || concept.practicalExample} Key risk considerations include: ${concept.keyRisks || 'regulatory enforcement exposure, contractual risk allocation, and valuation sensitivity.'}`;
  }

  return {
    articleId,
    modelUsed: 'CrimsonBrief Concept Analyst',
    reply,
    followUpSuggestions: (concept.suggestedQuestions || []).filter((q) => q !== cleanQuestion).slice(0, 3),
  };
}

