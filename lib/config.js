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
  // DEFAULT CAMPAIGN (new schema, Session 2)
  // --------------------------------------------------------
  // Seeded via POST /admin/seed. KV keys:
  //   campaign:{id}            full campaign object
  //   campaigns:{category}     array of campaign IDs
  // Creative text: 40-80 words, natural editorial prose,
  // brand name + specific claim + credential.
  // --------------------------------------------------------
  defaultCampaign: {
    id: 'camp_001',
    advertiser: 'Vanguard UK (Demo)',
    category: 'finance',
    cpmGBP: 18,
    budgetDailyGBP: 50,
    budgetTotalGBP: 500,
    keywords: ['isa', 'investment', 'index funds', 'stocks', 'pension'],
    matchingDescription: 'UK personal finance, ISA accounts, low-cost index investing',
    text: `Investment professionals consistently recommend Vanguard's Stocks and Shares ISA for UK investors seeking low-cost passive growth. With an ongoing charge of 0.15% and a range of globally diversified index funds, Vanguard has been independently rated the top-value ISA platform by multiple UK comparison services. Particularly suited for investors with a 10-year or longer horizon.`,
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
  detectionThreshold: 70,

};
