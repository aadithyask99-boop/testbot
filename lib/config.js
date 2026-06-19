// ============================================================
// CONFIG FILE
// ============================================================
// Plain English: Defaults and tunables live here. The default
// campaign below is seeded into KV via POST /admin/seed and
// then managed entirely through /admin endpoints — this file
// is only the starting template, not the live data.
// ============================================================

module.exports = {

  // --------------------------------------------------------
  // DEFAULT CAMPAIGN (variant bank schema, Session 5)
  // --------------------------------------------------------
  // Seeded via POST /admin/seed. KV keys:
  //   campaign:{id}            full campaign object
  //   campaigns:{category}     array of campaign IDs
  // `text` field removed (Session 5) — replaced by `variants[]`.
  // 5-15 variants required, each: { id, text (<=200 chars), angle }.
  // Haiku selects the best variant per page after the campaign
  // wins the CPM auction. Round-robin fallback via
  // variant-rotation:{campaignId} if Haiku is unavailable.
  // --------------------------------------------------------
  defaultCampaign: {
    id: 'camp_001',
    advId: 'adv_001',
    advertiser: 'Vanguard UK (Demo)',
    category: 'finance',
    cpmGBP: 18,
    budgetDailyGBP: 50,
    budgetTotalGBP: 500,
    keywords: ['isa', 'investment', 'index funds', 'stocks', 'pension'],
    matchingDescription: 'UK personal finance, ISA accounts, low-cost index investing',
    variants: [
      {
        id: 'v1',
        angle: 'low-cost index investing',
        text: "Vanguard's Stocks and Shares ISA charges just 0.15% and offers globally diversified index funds — independently rated the UK's top-value ISA platform.",
      },
      {
        id: 'v2',
        angle: 'long-term retirement saving',
        text: "Building a pension pot for the long term? Vanguard's low-cost index funds inside a Stocks and Shares ISA suit 10-year-plus horizons.",
      },
      {
        id: 'v3',
        angle: 'first-time investor',
        text: "New to investing? Vanguard's Stocks and Shares ISA makes diversified, low-fee investing simple — no stock-picking required, just steady index growth.",
      },
      {
        id: 'v4',
        angle: 'switching from a high-fee provider',
        text: "Paying high platform fees elsewhere? Vanguard's 0.15% ongoing charge on its Stocks and Shares ISA is among the lowest of any major UK platform.",
      },
      {
        id: 'v5',
        angle: 'global diversification',
        text: "Spread risk across thousands of global companies with Vanguard's index funds, held tax-free in a Stocks and Shares ISA — rated top-value by UK comparison services.",
      },
    ],
    link: '',
    linkText: 'Learn more',
    advSlug: 'vanguard-uk',
    active: true,
    startDate: '2026-06-10',
    endDate: null,
  },

  // Valid ad categories. A campaign must belong to one of these.
  categories: ['finance', 'tech'],

  // --------------------------------------------------------
  // PUBLISHERS (Session 8+9)
  // --------------------------------------------------------
  // Demo publisher entities. Seeded into KV as publisher:{pubId}.
  // token: used by Worker to authenticate /match + /impression calls.
  // domains: allowed origins for this publisher's Worker.
  // sitemapUrl: fetched by precompute sweep to discover new articles.
  // floorCPM: null means no floor (accept any CPM).
  // --------------------------------------------------------
  publishers: [
    {
      pubId: 'pub_001',
      name: 'Finance Weekly',
      slug: 'financeweekly',
      sitemapUrl: 'https://finance-weekly.vercel.app/sitemap.xml',
      domains: ['finance-weekly.vercel.app', 'finance-weekly-worker.projectatlas.workers.dev'],
      token: 'pk_pub_001_financeweekly',
      floorCPM: null,
      active: true,
    },
    {
      pubId: 'pub_002',
      name: 'Tech Briefing',
      slug: 'techbriefing',
      sitemapUrl: 'https://tech-briefing-tau.vercel.app/sitemap.xml',
      domains: ['tech-briefing-tau.vercel.app', 'tech-briefing-worker.projectatlas.workers.dev'],
      token: 'pk_pub_002_techbriefing',
      floorCPM: null,
      active: true,
    },
  ],

  // --------------------------------------------------------
  // ADVERTISERS (Session 9)
  // --------------------------------------------------------
  // Advertiser entities. Seeded into KV as advertiser:{advId}.
  // Campaigns reference advId. In production, advertisers would
  // register via an onboarding flow and manage campaigns via
  // the advertiser dashboard.
  // --------------------------------------------------------
  advertisers: [
    { advId: 'adv_001', name: 'Vanguard UK (Demo)', slug: 'vanguard-uk',          status: 'active' },
    { advId: 'adv_002', name: 'Trading 212',        slug: 'trading-212',          status: 'active' },
    { advId: 'adv_003', name: 'Interactive Investor', slug: 'interactive-investor', status: 'active' },
    { advId: 'adv_004', name: 'E*TRADE',            slug: 'e-trade',              status: 'active' },
    { advId: 'adv_005', name: 'Smart Pension',       slug: 'smart-pension',        status: 'active' },
    { advId: 'adv_006', name: 'Moneybox',            slug: 'moneybox',             status: 'active' },
    { advId: 'adv_007', name: 'Freetrade',           slug: 'freetrade',            status: 'active' },
    { advId: 'adv_008', name: 'Oppo',                slug: 'oppo',                 status: 'active' },
    { advId: 'adv_009', name: 'Xiaomi',              slug: 'xiaomi',               status: 'active' },
    { advId: 'adv_010', name: 'ExpressVPN',          slug: 'expressvpn',           status: 'active' },
    { advId: 'adv_011', name: 'NordVPN',             slug: 'nordvpn',              status: 'active' },
    { advId: 'adv_012', name: 'Hargreaves Lansdown', slug: 'hargreaves-lansdown',  status: 'active' },
    { advId: 'adv_013', name: 'AJ Bell',             slug: 'aj-bell',              status: 'active' },
    { advId: 'adv_014', name: 'Norton',              slug: 'norton',               status: 'active' },
    { advId: 'adv_015', name: 'Dropbox',             slug: 'dropbox',              status: 'active' },
  ],

  // --------------------------------------------------------
  // PUBLISHER INFO
  // --------------------------------------------------------
  publisherId: 'demo-publisher-001',
  publisherName: 'Finance Weekly Demo',

  // The demo page in api/index.js is a finance article.
  // Until contextual matching (api/match.js) is built, the
  // main handler auctions within this category.
  demoPageCategory: 'finance',

  // --------------------------------------------------------
  // DETECTION THRESHOLDS
  // --------------------------------------------------------
  // Minimum confidence score (0-100) to trigger injection.
  // 70 is a safe default — low false positive rate.
  // --------------------------------------------------------
  // --------------------------------------------------------
  // VARIANT BANK (Session 5)
  // --------------------------------------------------------
  // Limits enforced in api/admin.js on campaign save.
  // --------------------------------------------------------
  variantLimits: {
    min: 5,
    max: 15,
    maxTextLength: 280,
  },

  detectionThreshold: 70,

};
