/**
 * Verified Reference Registries for CrimsonBrief
 * - 7 Core Legal & Commercial Categories
 * - 15 Leading US Law Firms (Vault Prestige Rank, Am Law Revenue Rank, Deal/Case Volume Tier)
 * - Verified Harvard Law School Faculty, Courses, Research Centers & Peer Programs
 * - Verified Public RSS & Regulatory Feed Endpoints
 */

export const CATEGORIES = [
  {
    id: 'corporate-ma',
    name: 'Corporate and M&A',
    shortName: 'Corporate & M&A',
    subtitle: 'Public & private mergers, Delaware fiduciary litigation, shareholder activism, and board governance',
    icon: 'Building2',
    accentColor: '#A51C30',
    keywords: [
      'merger', 'acquisition', 'takeover', 'delaware chancery', 'fiduciary duty', 'board of directors',
      'shareholder activism', 'proxy fight', 'antitrust merger', 'spin-off', 'joint venture', 'poison pill',
      'revlon', 'mfow', 'entire fairness', 'breakup fee', 'tender offer', 'hostile bid', 'corpgov'
    ],
  },
  {
    id: 'banking-finance',
    name: 'Banking and Finance',
    shortName: 'Banking & Finance',
    subtitle: 'Syndicated lending, private credit, Basel III endgame, restructuring, and central bank monetary policy',
    icon: 'Landmark',
    accentColor: '#1E3A8A',
    keywords: [
      'syndicated loan', 'private credit', 'direct lending', 'basel iii', 'federal reserve', 'interest rate',
      'chapter 11', 'restructuring', 'liability management', 'uptier', 'drop-down', 'leveraged loan',
      'fdic', 'occ', 'bank capital', 'liquidity', 'sofr', 'credit facility', 'debtor-in-possession'
    ],
  },
  {
    id: 'capital-markets',
    name: 'Capital Markets',
    shortName: 'Capital Markets',
    subtitle: 'IPOs, follow-on offerings, investment-grade & high-yield debt, Rule 144A, derivatives, and SEC disclosure',
    icon: 'TrendingUp',
    accentColor: '#065F46',
    keywords: [
      'ipo', 'initial public offering', 'secondary offering', 'high-yield bond', 'investment grade',
      'convertible note', 'rule 144a', 'sec disclosure', 'securities fraud', '10b-5', 'underwriting',
      'equity capital markets', 'debt capital markets', 'bond issuance', 'treasury market', 'spac', 'shelf registration'
    ],
  },
  {
    id: 'investment-funds',
    name: 'Investment Funds',
    shortName: 'Investment Funds',
    subtitle: 'Hedge funds, private fund advisers rules, GP-led secondaries, LP governance, and asset management regulation',
    icon: 'Briefcase',
    accentColor: '#5B21B6',
    keywords: [
      'investment fund', 'hedge fund', 'asset management', 'limited partner', 'general partner',
      'continuation fund', 'gp-led secondary', 'investment advisers act', 'private fund', 'fund formation',
      'sovereign wealth', 'institutional investor', 'carried interest', 'side letter', 'nav facility', 'etf'
    ],
  },
  {
    id: 'technology-ai',
    name: 'Technology and AI',
    shortName: 'Technology & AI',
    subtitle: 'Foundation model governance, IP & copyright litigation, semiconductor export controls, antitrust, and cyber regulation',
    icon: 'Cpu',
    accentColor: '#0F766E',
    keywords: [
      'artificial intelligence', 'generative ai', 'foundation model', 'semiconductor', 'export control',
      'copyright infringement', 'fair use', 'data privacy', 'cybersecurity', 'platform antitrust',
      'cloud computing', 'openAI', 'anthropic', 'nvidia', 'eu ai act', 'algorithmic', 'digital markets'
    ],
  },
  {
    id: 'private-equity',
    name: 'Private Equity',
    shortName: 'Private Equity',
    subtitle: 'Leveraged buyouts, take-privates, sponsor-to-sponsor exits, infrastructure buyouts, and PE antitrust scrutiny',
    icon: 'Layers',
    accentColor: '#9A3412',
    keywords: [
      'private equity', 'leveraged buyout', 'lbo', 'take-private', 'financial sponsor', 'blackstone',
      'kkr', 'apollo', 'carlyle', 'tpg', 'bain capital', 'thoma bravo', 'brookfield', 'roll-up',
      'portfolio company', 'exit', 'buyout', 'co-investment', 'dividend recapitalization'
    ],
  },
  {
    id: 'general-international',
    name: 'General Legal and International',
    shortName: 'General & International',
    subtitle: 'International geopolitics & macroeconomics, Indian law & Supreme Court/SEBI/CCI policy, CFIUS, sanctions, and cross-border trade',
    icon: 'Globe',
    accentColor: '#374151',
    keywords: [
      'supreme court', 'scotus', 'loper bright', 'administrative law', 'cfius', 'sanctions', 'tariffs',
      'international arbitration', 'icsid', 'cross-border', 'european commission', 'wto', 'foreign direct investment',
      'sovereign', 'treaty', 'appellate', 'constitutional', 'doj', 'ftc', 'geopolitics', 'geopolitical',
      'india', 'indian', 'supreme court of india', 'sebi', 'rbi', 'reserve bank of india', 'cci', 'ibc', 'nclt', 'new delhi'
    ],
  },
];

/**
 * Editable Watchlist of 15 Leading US Law Firms
 * Explicitly separates:
 * - vaultRank: Vault Law 100 Prestige Ranking
 * - amLawRevenueRank: The American Lawyer Gross Revenue Ranking
 * - dealVolumeTier: Global M&A and Capital Markets League Table Volume Tier
 */
export const INITIAL_LAW_FIRMS = [
  {
    id: 'cravath',
    name: 'Cravath, Swaine & Moore LLP',
    shortName: 'Cravath',
    vaultRank: 1,
    amLawRevenueRank: 43,
    dealVolumeTier: 'Tier 1 — Public M&A & Investment Grade Capital Markets',
    headquarters: 'New York, NY',
    coreStrengths: ['Public M&A', 'Syndicated Banking', 'Securities Litigation', 'Antitrust'],
    aliases: ['cravath', 'cravath swaine'],
    isWatched: true,
  },
  {
    id: 'wachtell',
    name: 'Wachtell, Lipton, Rosen & Katz',
    shortName: 'Wachtell Lipton',
    vaultRank: 2,
    amLawRevenueRank: 39,
    dealVolumeTier: 'Tier 1 — High-Stakes Strategic M&A & Activism Defense',
    headquarters: 'New York, NY',
    coreStrengths: ['Strategic M&A', 'Hostile Takeover Defense', 'Corporate Governance', 'Restructuring'],
    aliases: ['wachtell', 'wachtell lipton'],
    isWatched: true,
  },
  {
    id: 'skadden',
    name: 'Skadden, Arps, Slate, Meagher & Flom LLP',
    shortName: 'Skadden',
    vaultRank: 3,
    amLawRevenueRank: 5,
    dealVolumeTier: 'Tier 1 — Global Mega-M&A, Cross-Border & Tax',
    headquarters: 'New York, NY',
    coreStrengths: ['Cross-Border M&A', 'Delaware Litigation', 'CFIUS & National Security', 'Capital Markets'],
    aliases: ['skadden', 'skadden arps'],
    isWatched: true,
  },
  {
    id: 'latham',
    name: 'Latham & Watkins LLP',
    shortName: 'Latham & Watkins',
    vaultRank: 4,
    amLawRevenueRank: 2,
    dealVolumeTier: 'Tier 1 (#1–2 Global Volume) — Private Equity, Capital Markets & Tech M&A',
    headquarters: 'Los Angeles / New York',
    coreStrengths: ['Private Equity Buyouts', 'High-Yield & Leveraged Finance', 'Tech & AI M&A', 'Capital Markets'],
    aliases: ['latham', 'latham & watkins', 'latham and watkins'],
    isWatched: true,
  },
  {
    id: 'kirkland',
    name: 'Kirkland & Ellis LLP',
    shortName: 'Kirkland & Ellis',
    vaultRank: 5,
    amLawRevenueRank: 1,
    dealVolumeTier: 'Tier 1 (#1 Global M&A by Deal Count & Volume) — Private Equity, Funds & Restructuring',
    headquarters: 'Chicago / New York',
    coreStrengths: ['Private Equity', 'Investment Funds Formation', 'Debtor Restructuring', 'Leveraged Finance'],
    aliases: ['kirkland', 'kirkland & ellis', 'kirkland and ellis'],
    isWatched: true,
  },
  {
    id: 'sullivan-cromwell',
    name: 'Sullivan & Cromwell LLP',
    shortName: 'Sullivan & Cromwell',
    vaultRank: 6,
    amLawRevenueRank: 18,
    dealVolumeTier: 'Tier 1 — Financial Institutions M&A, Banking Regulation & Sovereign/Cross-Border',
    headquarters: 'New York, NY',
    coreStrengths: ['Banking & Financial Institutions', 'Strategic M&A', 'Capital Markets', 'White Collar & Regulatory'],
    aliases: ['sullivan & cromwell', 'sullivan and cromwell', 's&c'],
    isWatched: true,
  },
  {
    id: 'davis-polk',
    name: 'Davis Polk & Wardwell LLP',
    shortName: 'Davis Polk',
    vaultRank: 7,
    amLawRevenueRank: 16,
    dealVolumeTier: 'Tier 1 — Equity/Debt Capital Markets, Bank Regulatory & Public M&A',
    headquarters: 'New York, NY',
    coreStrengths: ['Capital Markets', 'Financial Regulation', 'Liability Management & Restructuring', 'M&A'],
    aliases: ['davis polk', 'davis polk & wardwell'],
    isWatched: true,
  },
  {
    id: 'simpson-thacher',
    name: 'Simpson Thacher & Bartlett LLP',
    shortName: 'Simpson Thacher',
    vaultRank: 8,
    amLawRevenueRank: 11,
    dealVolumeTier: 'Tier 1 — Sponsor Buyouts, Mega-Fund Formation & Acquisition Finance',
    headquarters: 'New York, NY',
    coreStrengths: ['Private Equity', 'Investment Funds', 'Banking & Credit', 'Capital Markets'],
    aliases: ['simpson thacher', 'simpson thacher & bartlett', 'stb'],
    isWatched: true,
  },
  {
    id: 'paul-weiss',
    name: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
    shortName: 'Paul, Weiss',
    vaultRank: 9,
    amLawRevenueRank: 10,
    dealVolumeTier: 'Tier 1 — Private Equity M&A, Antitrust Litigation & Crisis Management',
    headquarters: 'New York, NY',
    coreStrengths: ['Private Equity M&A', 'High-Stakes Litigation', 'Antitrust & Regulatory', 'Restructuring'],
    aliases: ['paul, weiss', 'paul weiss'],
    isWatched: true,
  },
  {
    id: 'gibson-dunn',
    name: 'Gibson, Dunn & Crutcher LLP',
    shortName: 'Gibson Dunn',
    vaultRank: 10,
    amLawRevenueRank: 7,
    dealVolumeTier: 'Tier 1 — Appellate/Administrative Litigation, Energy/Infra M&A & Regulatory Defense',
    headquarters: 'Los Angeles / Washington, D.C.',
    coreStrengths: ['Supreme Court & Administrative Law', 'M&A', 'Antitrust & White Collar', 'Real Estate & Energy'],
    aliases: ['gibson dunn', 'gibson, dunn'],
    isWatched: true,
  },
  {
    id: 'cleary-gottlieb',
    name: 'Cleary Gottlieb Steen & Hamilton LLP',
    shortName: 'Cleary Gottlieb',
    vaultRank: 12,
    amLawRevenueRank: 24,
    dealVolumeTier: 'Tier 1 — Sovereign Debt, Cross-Border Antitrust & International Arbitration',
    headquarters: 'New York / Brussels / London',
    coreStrengths: ['Sovereign & International Finance', 'Global Antitrust', 'Cross-Border M&A', 'Arbitration'],
    aliases: ['cleary gottlieb', 'cleary'],
    isWatched: true,
  },
  {
    id: 'weil-gotshal',
    name: 'Weil, Gotshal & Manges LLP',
    shortName: 'Weil Gotshal',
    vaultRank: 13,
    amLawRevenueRank: 21,
    dealVolumeTier: 'Tier 1 — Chapter 11 Restructuring, Private Equity & Distressed M&A',
    headquarters: 'New York, NY',
    coreStrengths: ['Chapter 11 Restructuring', 'Private Equity', 'Public Company Advisory', 'Antitrust'],
    aliases: ['weil gotshal', 'weil, gotshal'],
    isWatched: true,
  },
  {
    id: 'ropes-gray',
    name: 'Ropes & Gray LLP',
    shortName: 'Ropes & Gray',
    vaultRank: 15,
    amLawRevenueRank: 6,
    dealVolumeTier: 'Tier 1 — Asset Management, Healthcare/Life Sciences PE & Private Credit',
    headquarters: 'Boston / New York',
    coreStrengths: ['Investment Management & Funds', 'Private Equity', 'Life Sciences & Healthcare', 'Private Credit'],
    aliases: ['ropes & gray', 'ropes and gray'],
    isWatched: true,
  },
  {
    id: 'sidley-austin',
    name: 'Sidley Austin LLP',
    shortName: 'Sidley Austin',
    vaultRank: 17,
    amLawRevenueRank: 6,
    dealVolumeTier: 'Tier 1 — Shareholder Activism, Financial Services Regulation & Structured Finance',
    headquarters: 'Chicago / New York / Washington, D.C.',
    coreStrengths: ['Shareholder Activism', 'Securitization & Funds', 'Regulatory & Trade', 'Life Sciences'],
    aliases: ['sidley austin', 'sidley'],
    isWatched: true,
  },
  {
    id: 'milbank',
    name: 'Milbank LLP',
    shortName: 'Milbank',
    vaultRank: 19,
    amLawRevenueRank: 25,
    dealVolumeTier: 'Tier 1 — Project/Infrastructure Finance, Creditor Restructuring & Aviation/Space',
    headquarters: 'New York, NY',
    coreStrengths: ['Creditor Committee Restructuring', 'Project & Infrastructure Finance', 'Leveraged Finance', 'Digital Infrastructure'],
    aliases: ['milbank', 'milbank llp'],
    isWatched: true,
  },
];

/**
 * Verified Harvard Law School Faculty, Courses & Research Centers Registry
 * Used both to verify authorship on the HLS Forum on Corporate Governance and
 * to ground Academic Synergies & Professor Connections in real HLS scholarship.
 */
export const VERIFIED_HLS_FACULTY = [
  {
    id: 'lucian-bebchuk',
    name: 'Lucian A. Bebchuk',
    title: 'James Barr Ames Professor of Law, Economics, and Finance; Director, Program on Corporate Governance',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'investment-funds', 'private-equity'],
    courses: [
      'Corporate Governance and Finance Seminar',
      'Corporations',
      'Law and Economics Seminar'
    ],
    centers: ['HLS Program on Corporate Governance'],
    researchInterests: [
      'Shareholder activism and institutional investor stewardship',
      'Executive compensation and managerial agency costs',
      'Controlled corporations, dual-class shares, and stakeholder capitalism critiques',
      'Private equity and index fund governance'
    ],
    keyWorks: [
      'The Illusory Promise of Stakeholder Governance (with Roberto Tallarita, Cornell Law Review)',
      'The Agency Problems of Institutional Investors (with Alma Cohen & Scott Hirst, Journal of Economic Perspectives)',
      'Pay Without Performance: The Unfulfilled Promise of Executive Compensation (with Jesse Fried)'
    ],
    aliases: ['lucian bebchuk', 'bebchuk', 'lucian a. bebchuk'],
  },
  {
    id: 'john-coates',
    name: 'John C. Coates IV',
    title: 'John F. Cogan, Jr. Professor of Law and Economics (Former SEC General Counsel)',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'capital-markets', 'investment-funds', 'private-equity'],
    courses: [
      'Mergers and Acquisitions',
      'Corporations',
      'Capital Markets Regulation',
      'Financial Institutions'
    ],
    centers: ['HLS Program on Corporate Governance', 'Center on the Legal Profession'],
    researchInterests: [
      'M&A contract architecture, earnouts, and Material Adverse Effect (MAE) clauses',
      'SEC disclosure design, climate/cyber reporting, and capital formation',
      'The future of index funds and concentration of corporate ownership ("The Problem of Twelve")',
      'Private equity buyouts and public-to-private capital shifts'
    ],
    keyWorks: [
      'The Problem of Twelve: When a Few Financial Institutions Control Everything (Columbia Global Reports, 2023)',
      'M&A Contracts: Purposes, Types, Regulation, and Patterns of Practice',
      'ESG Disclosure — Keeping Pace with Developments Affecting Investors, Public Companies and the Capital Markets'
    ],
    aliases: ['john coates', 'john c. coates', 'coates'],
  },
  {
    id: 'jesse-fried',
    name: 'Jesse M. Fried',
    title: 'Dane Professor of Law',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'capital-markets', 'private-equity'],
    courses: [
      'Corporations',
      'Comparative Corporate Governance',
      'Venture Capital and Private Equity'
    ],
    centers: ['HLS Program on Corporate Governance'],
    researchInterests: [
      'Share repurchases, insider trading disclosures, and capital distributions',
      'Venture capital preferred stock cash-flow rights and governance',
      'Executive compensation structure and board fiduciary duties'
    ],
    keyWorks: [
      'Opportunistic Share Repurchases',
      'Will Nasdaq’s Diversity Rules Harm Investors? (with Mark J. Roe)',
      'Startup Preferred Stock: Why Founder Control Hurts VCs'
    ],
    aliases: ['jesse fried', 'jesse m. fried'],
  },
  {
    id: 'mark-roe',
    name: 'Mark J. Roe',
    title: 'David Berg Professor of Law',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'banking-finance', 'general-international'],
    courses: [
      'Corporate Reorganization and Bankruptcy',
      'Corporations',
      'Political Economy of Corporate Governance'
    ],
    centers: ['HLS Program on Corporate Governance'],
    researchInterests: [
      'Chapter 11 bankruptcy restructuring, liability management transactions, and creditor priorities',
      'Short-termism debates and macroeconomic implications of corporate finance',
      'Comparative political economy of US, European, and Asian corporate ownership'
    ],
    keyWorks: [
      'Strong Managers, Weak Owners: The Political Roots of American Corporate Finance',
      'Missing the Target: Why Stock Market Short-Termism Is Not the Problem',
      'The Bankruptcy Code’s Safe Harbors for Derivatives and Repo Financing'
    ],
    aliases: ['mark roe', 'mark j. roe'],
  },
  {
    id: 'roberto-tallarita',
    name: 'Roberto Tallarita',
    title: 'Assistant Professor of Law',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'technology-ai', 'investment-funds'],
    courses: [
      'Corporations',
      'Corporate Governance and AI',
      'Mergers and Acquisitions'
    ],
    centers: ['HLS Program on Corporate Governance'],
    researchInterests: [
      'AI governance in the boardroom and algorithmic corporate decision-making',
      'Public benefit corporations (such as OpenAI and Anthropic structures) and fiduciary conflicts',
      'Empirical analysis of board committees and sustainability oversight'
    ],
    keyWorks: [
      'AI in the Boardroom: Corporate Law and Algorithmic Governance',
      'The Limits of Portfolio Primacy',
      'Stockholder Politics'
    ],
    aliases: ['roberto tallarita', 'tallarita'],
  },
  {
    id: 'hal-scott',
    name: 'Hal S. Scott',
    title: 'Emeritus Nomura Professor of International Financial Systems; Director, Program on International Financial Systems (PIFS)',
    affiliation: 'Harvard Law School',
    categories: ['banking-finance', 'capital-markets', 'general-international'],
    courses: [
      'International Finance',
      'Capital Markets Regulation'
    ],
    centers: ['Program on International Financial Systems (PIFS)'],
    researchInterests: [
      'Systemic risk, bank liquidity runs, and lender-of-last-resort mechanisms',
      'Basel III capital requirements and cross-border financial stability',
      'Central bank digital currencies (CBDCs), stablecoins, and US clearing infrastructure'
    ],
    keyWorks: [
      'Connectedness and Contagion: Preventing Another Financial Crisis (MIT Press)',
      'International Finance: Transactions, Policy, and Regulation'
    ],
    aliases: ['hal scott', 'hal s. scott'],
  },
  {
    id: 'howell-jackson',
    name: 'Howell E. Jackson',
    title: 'James S. Reid, Jr., Professor of Law',
    affiliation: 'Harvard Law School',
    categories: ['banking-finance', 'investment-funds', 'technology-ai'],
    courses: [
      'Financial Institutions',
      'Regulation of Financial Markets',
      'Analytical Methods for Lawyers',
      'FinTech and Financial Regulation'
    ],
    centers: ['Program on Corporate Governance'],
    researchInterests: [
      'Prudential bank supervision, stress testing, and deposit insurance architecture',
      'Fintech payment systems, digital assets, and consumer financial protection',
      'Fiduciary duties of retail and institutional investment advisers'
    ],
    keyWorks: [
      'Financial Regulation: Law and Policy (with Margaret Tahyar & Michael Barr)',
      'The Nature of Federal Preemption in Banking Regulation'
    ],
    aliases: ['howell jackson', 'howell e. jackson'],
  },
  {
    id: 'holger-spamann',
    name: 'Holger Spamann',
    title: 'Lawrence R. Grove Professor of Law',
    affiliation: 'Harvard Law School',
    categories: ['corporate-ma', 'capital-markets', 'private-equity'],
    courses: [
      'Corporations',
      'Corporate Finance',
      'Empirical Law and Finance'
    ],
    centers: ['HLS Program on Corporate Governance', 'Program on Law and Economics'],
    researchInterests: [
      'Corporate valuation, discounted cash flow litigation in Delaware appraisal actions',
      'Indirect investor protection and securities market efficiency',
      'Comparative judicial decision-making'
    ],
    keyWorks: [
      'Indirect Investor Protection: The Investment Ecosystem and Its Legal Underpinnings',
      'Corporations (Open-Source Casebook)'
    ],
    aliases: ['holger spamann', 'spamann'],
  },
  {
    id: 'guhan-subramanian',
    name: 'Guhan Subramanian',
    title: 'Joseph Flom Professor of Law and Business (HLS) & Douglas Weaver Professor of Business Law (HBS)',
    affiliation: 'Harvard Law School & Harvard Business School',
    categories: ['corporate-ma', 'private-equity'],
    courses: [
      'Dealmaking in Law and Business',
      'Negotiation Workshop',
      'Mergers and Acquisitions'
    ],
    centers: ['Program on Negotiation (PON)', 'HLS Program on Corporate Governance'],
    researchInterests: [
      'Deal process design, go-shop vs. no-shop provisions, and M&A auctions vs. negotiations ("Dealmaking")',
      'Management buyouts (MBOs) and special committee governance under Delaware law',
      'Dual-class sunset provisions and controlling shareholder freeze-outs'
    ],
    keyWorks: [
      'Dealmaking: The New Strategy of Negotiauctions (W.W. Norton)',
      'Fixing Freezeouts',
      'Go-Shops Revisited'
    ],
    aliases: ['guhan subramanian', 'subramanian'],
  },
  {
    id: 'jonathan-zittrain',
    name: 'Jonathan L. Zittrain',
    title: 'George Bemis Professor of International Law; Faculty Director, Berkman Klein Center for Internet & Society',
    affiliation: 'Harvard Law School & Harvard Kennedy School',
    categories: ['technology-ai', 'general-international'],
    courses: [
      'Artificial Intelligence, Law, and Policy',
      'Cyberlaw and Internet Governance',
      'Torts'
    ],
    centers: ['Berkman Klein Center for Internet & Society'],
    researchInterests: [
      'Agentic AI governance, information fiduciaries, and foundation model safety obligations',
      'Intellectual property, training data provenance, and generative AI liability',
      'Digital platform architecture and global internet regulation'
    ],
    keyWorks: [
      'We Need to Control AI Agents Now (The Atlantic)',
      'Information Fiduciaries and the First Amendment (with Jack Balkin)',
      'The Future of the Internet—And How to Stop It'
    ],
    aliases: ['jonathan zittrain', 'zittrain', 'jonathan l. zittrain'],
  },
  {
    id: 'cass-sunstein',
    name: 'Cass R. Sunstein',
    title: 'Robert Walmsley University Professor; Director, Program on Behavioral Economics and Public Policy',
    affiliation: 'Harvard Law School',
    categories: ['general-international', 'banking-finance', 'technology-ai'],
    courses: [
      'Administrative Law',
      'Cost-Benefit Analysis and Regulatory Policy',
      'Constitutional Law'
    ],
    centers: ['Program on Behavioral Economics and Public Policy'],
    researchInterests: [
      'Post-Loper Bright administrative law, judicial review of SEC/FTC/EPA rulemaking, and Major Questions Doctrine',
      'Cost-benefit analysis in financial and technological regulation',
      'Behavioral law and economics'
    ],
    keyWorks: [
      'The Consequences of Loper Bright',
      'Chevron Step Zero',
      'Nudge (with Richard Thaler)'
    ],
    aliases: ['cass sunstein', 'cass r. sunstein', 'sunstein'],
  },
];

export const VERIFIED_PEER_INSTITUTIONS = [
  {
    school: 'Columbia Law School',
    centers: ['Ira M. Millstein Center for Global Markets and Corporate Ownership', 'Richman Center for Business, Law, and Public Policy'],
    focus: 'Capital markets regulation, M&A deal studies, and financial restructuring'
  },
  {
    school: 'NYU School of Law',
    centers: ['Institute for Corporate Governance & Finance', 'Pollack Center for Law and Business'],
    focus: 'Securities enforcement, compliance architecture, and international tax/finance'
  },
  {
    school: 'Yale Law School',
    centers: ['Yale Law School Center for the Study of Corporate Law', 'Thurman Arnold Project'],
    focus: 'Antitrust enforcement, macro-financial policy, and administrative law'
  },
  {
    school: 'Stanford Law School',
    centers: ['Rock Center for Corporate Governance', 'Stanford Center for Legal Informatics (CodeX)'],
    focus: 'Venture capital, securities class action clearinghouse, and AI/technology regulation'
  },
  {
    school: 'University of Chicago Law School',
    centers: ['Coase-Sandor Institute for Law and Economics', 'Stigler Center (Booth/Law)'],
    focus: 'Law and economics of corporate finance, bankruptcy reorganization, and competition policy'
  }
];

/**
 * Verified Public RSS & Atom Feeds for Live Ingestion
 */
export const PUBLIC_RSS_SOURCES = [
  {
    id: 'hls-corpgov',
    name: 'Harvard Law School Forum on Corporate Governance',
    url: 'https://corpgov.law.harvard.edu/feed/',
    sourceType: 'academic',
    defaultCategory: 'corporate-ma',
    credibilityWeight: 18,
  },
  {
    id: 'sec-press',
    name: 'U.S. Securities and Exchange Commission (SEC)',
    url: 'https://www.sec.gov/news/pressreleases.rss',
    sourceType: 'primary_regulatory',
    defaultCategory: 'capital-markets',
    credibilityWeight: 20,
  },
  {
    id: 'fed-press',
    name: 'Federal Reserve Board — Monetary & Banking Releases',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    sourceType: 'primary_regulatory',
    defaultCategory: 'banking-finance',
    credibilityWeight: 20,
  },
  {
    id: 'nyt-dealbook',
    name: 'New York Times — Business & DealBook',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    sourceType: 'journalism',
    defaultCategory: 'corporate-ma',
    credibilityWeight: 15,
  },
  {
    id: 'cnbc-finance',
    name: 'CNBC — Markets, Finance & M&A',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    sourceType: 'journalism',
    defaultCategory: 'capital-markets',
    credibilityWeight: 13,
  },
  {
    id: 'scotusblog',
    name: 'SCOTUSblog — Supreme Court & Administrative Law',
    url: 'https://www.scotusblog.com/feed/',
    sourceType: 'academic',
    defaultCategory: 'general-international',
    credibilityWeight: 17,
  },
  {
    id: 'intl-admin-wire',
    name: 'Global Regulatory, CFIUS & Administrative Law Wire',
    url: 'https://news.google.com/rss/search?q=(%22CFIUS%22+OR+%22Supreme+Court%22+OR+%22European+Commission%22+OR+%22International+Arbitration%22)+AND+(%22Gibson+Dunn%22+OR+%22Cleary+Gottlieb%22+OR+%22Sullivan+%26+Cromwell%22+OR+%22Skadden%22+OR+%22Sidley%22)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'general-international',
    credibilityWeight: 16,
  },
  {
    id: 'gnews-vault-ma',
    name: 'Deal & Counsel Wire (Vault 10 / AmLaw 50 M&A & Corporate)',
    url: 'https://news.google.com/rss/search?q=(%22Wachtell%22+OR+%22Cravath%22+OR+%22Skadden%22+OR+%22Kirkland+%26+Ellis%22+OR+%22Latham+%26+Watkins%22+OR+%22Sullivan+%26+Cromwell%22+OR+%22Davis+Polk%22+OR+%22Simpson+Thacher%22+OR+%22Paul+Weiss%22)+AND+(acquisition+OR+merger+OR+board+OR+IPO)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'corporate-ma',
    credibilityWeight: 16,
  },
  {
    id: 'pe-buyout-wire',
    name: 'Private Equity & Sponsor Buyout Wire (LBOs & Take-Privates)',
    url: 'https://news.google.com/rss/search?q=(%22private+equity%22+OR+%22take-private%22+OR+%22buyout%22)+AND+(%22Blackstone%22+OR+%22KKR%22+OR+%22Apollo%22+OR+%22Brookfield%22+OR+%22Kirkland%22+OR+%22Simpson+Thacher%22+OR+%22Thoma+Bravo%22)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'private-equity',
    credibilityWeight: 16,
  },
  {
    id: 'inv-funds-wire',
    name: 'Investment Funds, Institutional LPs & Asset Management Wire',
    url: 'https://news.google.com/rss/search?q=(%22private+fund%22+OR+%22continuation+fund%22+OR+%22hedge+fund%22+OR+%22sovereign+wealth%22+OR+%22private+credit+fund%22)+AND+(%22SEC%22+OR+%22LP%22+OR+%22fundraising%22+OR+%22billion%22)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'investment-funds',
    credibilityWeight: 15,
  },
  {
    id: 'tech-ai-law-wire',
    name: 'Technology, Frontier AI Governance & Digital Antitrust Wire',
    url: 'https://news.google.com/rss/search?q=(%22artificial+intelligence%22+OR+%22OpenAI%22+OR+%22Anthropic%22+OR+%22semiconductor%22)+AND+(%22antitrust%22+OR+%22regulation%22+OR+%22copyright%22+OR+%22DOJ%22+OR+%22FTC%22+OR+%22governance%22)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'technology-ai',
    credibilityWeight: 16,
  },
  {
    id: 'india-law-policy-wire',
    name: 'Indian Law, Supreme Court of India, SEBI, RBI & Policy Wire',
    url: 'https://news.google.com/rss/search?q=(%22Supreme+Court+of+India%22+OR+%22SEBI%22+OR+%22Reserve+Bank+of+India%22+OR+%22Competition+Commission+of+India%22+OR+%22IBC%22+OR+%22NCLT%22)+AND+(law+OR+ruling+OR+regulation+OR+policy+OR+economy)&hl=en-IN&gl=IN&ceid=IN:en',
    sourceType: 'journalism',
    defaultCategory: 'general-international',
    credibilityWeight: 18,
  },
  {
    id: 'global-geopolitics-econ-wire',
    name: 'International Geopolitics, Cross-Border Trade & Sovereign Economy Wire',
    url: 'https://news.google.com/rss/search?q=(%22geopolitics%22+OR+%22tariffs%22+OR+%22CFIUS%22+OR+%22European+Commission%22+OR+%22sovereign+wealth%22+OR+%22cross-border%22+OR+%22India-US%22)+AND+(trade+OR+economy+OR+sanctions+OR+treaty+OR+billion+OR+regulation)&hl=en-US&gl=US&ceid=US:en',
    sourceType: 'journalism',
    defaultCategory: 'general-international',
    credibilityWeight: 18,
  },
];
