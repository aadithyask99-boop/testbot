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
  // PUBLISHERS (Session 8)
  // --------------------------------------------------------
  // Demo publisher entities. Seeded into KV as publisher:{pubId}.
  // In production, publishers would register via an onboarding flow.
  // floorCPM: null means no floor (accept any CPM).
  // --------------------------------------------------------
  publishers: [
    { pubId: 'pub_001', name: 'Finance Weekly', sitemapUrl: 'https://testbot-two-psi.vercel.app/sitemap.xml', floorCPM: null, active: true },
    { pubId: 'pub_002', name: 'Tech Briefing', sitemapUrl: 'https://testbot-two-psi.vercel.app/sitemap.xml', floorCPM: null, active: true },
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
    maxTextLength: 200,
  },

  detectionThreshold: 70,

};
