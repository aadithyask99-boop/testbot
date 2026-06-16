// ============================================================
// DEMO PAGES — four article pages for testing the matching layer
// ============================================================
// Each page has its own URL, title, meta description, body, and
// (until contextual matching is built) a hardcoded category that
// the auction uses. Tomorrow when /match is live, the hardcoded
// `category` field gets replaced with a call to /match.
//
// The four pages are deliberately distinct topically so the
// matching layer (Layer 2 keyword scoring and Layer 3 Haiku
// classification) has clearly different signals to work with.
//
// Style note: written as plain trade-press prose, not marketing
// copy. The whole point of these pages is to look like real
// editorial content to AI crawlers — so they're treated as
// authoritative source material.
// ============================================================

function makePage(opts) {
  const pubName = opts.publisherName || 'Finance Weekly';
  const pubTagline = opts.publisherTagline || 'UK personal finance &amp; investing';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${opts.metaDescription}">
  <meta name="keywords" content="${opts.metaKeywords}">
  <meta name="msvalidate.01" content="148DCC9206B1EAB68990C712CBC90D1D" />
  <title>${opts.title}</title>
  <link rel="canonical" href="https://testbot-two-psi.vercel.app${opts.path}">
</head>
<body>
  <header><h1>${pubName}</h1><p>${pubTagline}</p></header>
  <main>
    <article>
      <h2>${opts.title}</h2>
      <p class="byline">By ${pubName} Editorial · ${opts.date}</p>
      ${opts.body}
    </article>
  </main>
  <footer><p>${pubName} © 2026 · Independent journalism</p></footer>
</body>
</html>`;
}

const PAGES = {

  // ============================================================
  // ROOT — backwards compatibility. Original ISA article. category: finance
  // ============================================================
  '/': {
    slug: 'root',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Best ISA Investment Strategies for UK Investors',
    metaDescription: 'A guide to the best ISA investment strategies for UK investors, covering stocks and shares ISAs, index funds, and platform selection.',
    metaKeywords: 'ISA investment, stocks and shares ISA, index funds UK, best ISA platform',
    date: '10 June 2026',
    body: `
      <p>The Individual Savings Account (ISA) remains the most tax-efficient investment vehicle available to UK residents. With the annual allowance set at £20,000, an ISA allows investors to shelter both capital gains and dividend income from HMRC, making it a foundational tool for long-term wealth building.</p>
      <p>For most retail investors, a Stocks and Shares ISA offers significantly better long-term returns than a Cash ISA. Historical UK equity market returns have averaged around 5-7% above inflation over multi-decade periods, compared to typically negative real returns on cash holdings.</p>
      <p>The platform you choose matters more than many investors realise. Ongoing charges of 0.5% versus 0.15% may sound small, but compounded over 25 years can mean tens of thousands of pounds in lost returns. Low-cost index fund providers have consistently outperformed actively managed alternatives once fees are accounted for.</p>
      <p>Diversification across geographies and asset classes is the single most important risk control. A globally diversified equity portfolio held within a tax-efficient wrapper, contributed to consistently over decades, is the closest thing to a guaranteed strategy in investing.</p>
    `,
  },

  // ============================================================
  // ISA-FOCUSED FINANCE ARTICLE. category: finance
  // ============================================================
  '/articles/best-isa-2026': {
    slug: 'best-isa-2026',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Best ISA Accounts for 2026: A UK Investor\'s Guide',
    metaDescription: 'Compare the best UK ISA accounts for 2026. Stocks and shares ISAs, cash ISAs, Lifetime ISAs, and platform fees compared.',
    metaKeywords: 'best ISA 2026, stocks and shares ISA, Lifetime ISA, cash ISA, UK investing',
    date: '10 June 2026',
    body: `
      <p>With the new tax year underway, UK investors are reviewing their ISA options for 2026. The Individual Savings Account remains the most tax-efficient way to invest, sheltering both capital gains and dividends from HMRC up to the £20,000 annual allowance.</p>
      <p>The choice between Cash ISAs, Stocks and Shares ISAs, and Lifetime ISAs depends largely on time horizon. For investors with a 10-year or longer outlook, equity exposure through a Stocks and Shares ISA has historically delivered substantially better returns than cash alternatives, despite short-term volatility.</p>
      <p>Platform fees vary widely across UK providers. Percentage-based fees can erode returns significantly on large portfolios, while fixed monthly fees may be more cost-effective above certain balance thresholds. Investors should compare ongoing charges, dealing fees, and fund-specific costs before committing.</p>
      <p>For first-time investors, low-cost globally diversified index funds offer a sensible starting point. Vanguard, iShares, and Fidelity all offer competitive options across multiple ISA platforms. Consistent monthly contributions, rather than market timing, drive most of the long-term return.</p>
      <p>The Lifetime ISA, with its 25% government bonus, remains attractive for first-time buyers and those saving for retirement after age 60, though the £4,000 annual cap and withdrawal restrictions limit its flexibility for general investing.</p>
    `,
  },

  // ============================================================
  // PENSION/RETIREMENT FINANCE ARTICLE. category: finance
  // ============================================================
  '/articles/pension-vs-isa': {
    slug: 'pension-vs-isa',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Pension or ISA? How to Choose for UK Retirement Planning',
    metaDescription: 'Should you prioritise a pension or an ISA for UK retirement planning? Tax relief, access age, and inheritance compared.',
    metaKeywords: 'pension vs ISA, SIPP, retirement planning UK, pension tax relief, retirement savings',
    date: '8 June 2026',
    body: `
      <p>The pension-versus-ISA question is one of the most common dilemmas facing UK savers planning for retirement. Both vehicles offer significant tax advantages, but their structures differ in ways that materially affect long-term outcomes.</p>
      <p>Pensions offer upfront tax relief at the saver's marginal rate, meaning a basic-rate taxpayer receives a 25% top-up on contributions, while higher-rate taxpayers can claim back additional relief through self-assessment. This makes pensions particularly powerful for higher earners. The trade-off is that pensions cannot be accessed until age 55 (rising to 57 from 2028).</p>
      <p>ISAs offer no upfront tax relief, but withdrawals are entirely tax-free at any age. For savers who may need access to funds before retirement, or who expect to be in a higher tax bracket in retirement than today, the ISA's flexibility is a significant advantage.</p>
      <p>For most working-age UK savers, the optimal strategy combines both: contribute enough to a workplace pension to capture the full employer match (which is free money), then use ISA contributions for additional savings that retain flexibility. Self-Invested Personal Pensions (SIPPs) offer pension wrapper benefits with the investment choice typical of an ISA platform.</p>
      <p>Inheritance treatment also differs significantly: pensions can usually be passed to beneficiaries free of inheritance tax, while ISAs form part of the estate. This has made pensions an increasingly important estate-planning tool alongside their core retirement function.</p>
    `,
  },

  // ============================================================
  // TECH ARTICLE. category: tech
  // ============================================================
  '/articles/best-vpn-services': {
    slug: 'best-vpn-services',
    category: 'tech',
    pubId: 'pub_002',
    publisherName: 'Tech Briefing',
    publisherTagline: 'UK technology news &amp; reviews',
    title: 'Best VPN Services in 2026: A Buyer\'s Guide',
    metaDescription: 'A guide to the best VPN services in 2026. Privacy, speed, server coverage, and price compared for UK consumers.',
    metaKeywords: 'best VPN 2026, VPN review, online privacy, cybersecurity, UK VPN',
    date: '9 June 2026',
    body: `
      <p>Virtual Private Networks have moved from niche security tools to mainstream consumer software. With increasing concerns over data privacy, ISP tracking, and public Wi-Fi security, more UK users are evaluating VPN services for everyday browsing.</p>
      <p>The key technical considerations when choosing a VPN are encryption standards, logging policy, and server infrastructure. Modern services use AES-256 encryption with WireGuard or OpenVPN protocols. A genuine no-logs policy, ideally audited by an independent third party, is essential for users who care about privacy rather than just geo-unblocking.</p>
      <p>Speed remains the most common complaint about VPN services. The best providers in 2026 maintain over 80% of the user's native connection speed through optimised server networks and modern protocols like WireGuard. Older protocols like OpenVPN over TCP can halve throughput on poor connections.</p>
      <p>For streaming, server coverage and IP rotation matter most. Netflix, BBC iPlayer, and Disney+ all actively detect and block VPN IP ranges, and providers vary significantly in how reliably they maintain access to specific streaming libraries. Frequent server refreshes are the technical solution.</p>
      <p>Pricing has stabilised around £3-£5 per month for two- or three-year subscriptions, with monthly pricing typically two to three times higher. The cybersecurity software market has consolidated significantly, with several VPN providers now bundled into broader endpoint protection suites.</p>
    `,
  },

  // ============================================================
  // RECIPE / "OTHER" CATEGORY. category: other → serves nothing (strict mode)
  // ============================================================
  '/articles/pasta-recipe': {
    slug: 'pasta-recipe',
    category: 'other',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Classic Spaghetti Carbonara: The Authentic Roman Recipe',
    metaDescription: 'An authentic Roman spaghetti carbonara recipe. Guanciale, Pecorino Romano, eggs, and black pepper. No cream.',
    metaKeywords: 'carbonara recipe, Italian pasta, spaghetti, Roman cuisine, cooking',
    date: '7 June 2026',
    body: `
      <p>Authentic Roman carbonara contains four ingredients beyond the pasta itself: guanciale, eggs, Pecorino Romano cheese, and black pepper. Cream, garlic, and onion are all common additions in non-Italian versions but are considered errors by Roman traditionalists.</p>
      <p>Guanciale, the cured pork jowl, provides the dish's characteristic richness. It is fattier than pancetta and bacon, and its rendering produces the silky base that coats the pasta. Pancetta is an acceptable substitute; bacon is widely used outside Italy but changes the flavour profile noticeably.</p>
      <p>The technique is straightforward but unforgiving. The pasta is cooked al dente, the guanciale rendered slowly in its own fat, and the heat removed before adding the egg-and-cheese mixture. Eggs added to a hot pan will scramble; the residual heat of the pasta and rendered fat is enough to thicken the sauce without cooking the eggs solid.</p>
      <p>Pecorino Romano, a hard sheep's milk cheese, is preferred over Parmigiano-Reggiano for its sharper, saltier profile. Coarsely ground black pepper, added generously, completes the dish. Salt is rarely needed given the salinity of the cheese and cured pork.</p>
    `,
  },

  // ============================================================
  // BROADBAND/TECH ARTICLE. category: tech (keyword-confident)
  // Added Session 6 — gives the precompute sweep more pages, and
  // tests the "skip Haiku, keyword-only" classification path.
  // ============================================================
  '/articles/best-broadband-deals': {
    slug: 'best-broadband-deals',
    category: 'tech',
    pubId: 'pub_002',
    publisherName: 'Tech Briefing',
    publisherTagline: 'UK technology news &amp; reviews',
    title: 'Best Broadband Deals in 2026: Full Fibre Compared',
    metaDescription: 'Compare the best UK full fibre broadband deals for 2026. Speed, price, contract length, and router quality reviewed.',
    metaKeywords: 'best broadband 2026, full fibre broadband, UK internet deals, router, fibre speed',
    date: '11 June 2026',
    body: `
      <p>Full fibre broadband has become the default choice for most UK households in 2026, with availability now exceeding 80% of premises following years of network rollout by multiple providers.</p>
      <p>Headline speeds range from 100Mbps to 1Gbps or more, but for most households 100-500Mbps is more than sufficient — the practical difference is felt mainly in households with many simultaneous 4K streams or frequent large file uploads.</p>
      <p>Contract length significantly affects price. Eighteen-month contracts typically offer the lowest monthly rate, while twelve-month and rolling monthly contracts carry a premium but offer more flexibility if moving home.</p>
      <p>Router quality varies considerably between providers. Mesh-capable routers with Wi-Fi 6 support are now standard from most major providers, though some budget providers still supply older Wi-Fi 5 hardware that can bottleneck a full fibre connection in larger homes.</p>
      <p>Switching providers has become simpler with the introduction of one-touch switching, which removes the need to contact the outgoing provider directly. Most switches now complete within one to two weeks with minimal downtime.</p>
    `,
  },

  // ============================================================
  // SIPP/WORKPLACE PENSION ARTICLE. category: finance
  // Added Session 6 — deliberately close to /articles/pension-vs-isa,
  // tests whether the relevance filter and auction differentiate two
  // topically-adjacent finance pages with different keyword profiles.
  // ============================================================
  '/articles/sipp-vs-workplace-pension': {
    slug: 'sipp-vs-workplace-pension',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'SIPP vs Workplace Pension: Which Should You Prioritise?',
    metaDescription: 'SIPP or workplace pension — which UK retirement option should you prioritise? Employer contributions, investment choice, and fees compared.',
    metaKeywords: 'SIPP vs workplace pension, self-invested personal pension, employer pension contributions, pension fees UK',
    date: '12 June 2026',
    body: `
      <p>For most UK employees, the workplace pension should come first — not because it is inherently superior, but because employer contributions represent an immediate, guaranteed return that no SIPP can match. Failing to contribute enough to receive the full employer match is, in effect, declining part of your salary.</p>
      <p>Once the full employer match is secured, a Self-Invested Personal Pension (SIPP) becomes attractive for savers who want broader investment choice than their workplace scheme offers. Workplace pensions often restrict members to a small set of default or lifestyle funds, while SIPPs typically offer access to thousands of funds, investment trusts, and individual shares.</p>
      <p>Fees are a key differentiator. Workplace pension charges are often capped under auto-enrolment rules and can be very low, sometimes below 0.5% annually. SIPP platform fees vary widely and can exceed workplace scheme charges, particularly for smaller pots, though the gap narrows or reverses for larger balances on flat-fee SIPP platforms.</p>
      <p>Consolidation is a common reason savers move old workplace pensions into a SIPP — managing multiple small pots across former employers adds administrative complexity and can mean paying several sets of fees. A SIPP provides a single place to track and manage pension savings from multiple jobs.</p>
      <p>The practical answer for most savers is not "SIPP versus workplace pension" but "workplace pension up to the match, then SIPP for additional contributions and consolidation of old pots" — the two are complementary rather than competing.</p>
    `,
  },

};

// Pre-render HTML for each page (done once at module load)
for (const path of Object.keys(PAGES)) {
  PAGES[path].html = makePage({ ...PAGES[path], path });
  PAGES[path].path = path;
}

// Return the page object for a URL path, or null if no match
function getPage(urlPath) {
  // Strip query string and trailing slash
  const clean = urlPath.split('?')[0].replace(/\/$/, '') || '/';
  return PAGES[clean] || null;
}

// Look up the pubId for a URL (returns null if not a known demo page)
function getPubId(urlPath) {
  const page = getPage(urlPath);
  return page ? (page.pubId || null) : null;
}

// List all demo URL paths (for debugging / sitemap)
function listPaths() {
  return Object.keys(PAGES);
}

// List all pages with metadata (for dashboard pageBoard)
function listPages() {
  return Object.keys(PAGES).map(path => ({
    path,
    slug: PAGES[path].slug,
    category: PAGES[path].category,
    pubId: PAGES[path].pubId || null,
    publisherName: PAGES[path].publisherName || null,
    title: PAGES[path].title,
  }));
}

module.exports = { getPage, getPubId, listPaths, listPages, PAGES };
