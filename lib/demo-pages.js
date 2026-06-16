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

  // ============================================================
  // Finance Weekly — new articles (Session 8)
  // ============================================================

  '/articles/best-stocks-and-shares-isa': {
    slug: 'best-stocks-and-shares-isa',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Best Stocks and Shares ISA Platforms for 2026',
    metaDescription: 'Compare the best stocks and shares ISA platforms in 2026. Fees, fund range, tools, and performance compared for UK investors.',
    metaKeywords: 'stocks and shares ISA, best ISA platform 2026, investment ISA, ISA fees, UK investing platform',
    date: '11 June 2026',
    body: `
      <p>The stocks and shares ISA remains the most flexible long-term investment wrapper available to UK savers — sheltering capital gains, dividends, and income from tax indefinitely, with no annual limit on withdrawals. Choosing the right platform is a consequential decision, as fee differences compound significantly over a 20 or 30-year investment horizon.</p>
      <p>Platform charges typically follow one of two models: percentage-based fees (usually 0.15% to 0.45% of portfolio value annually) and flat monthly fees (typically £5 to £25 per month regardless of portfolio size). Percentage-based fees are cheaper for small portfolios; flat fees become more cost-effective as balances grow, often above £50,000 to £100,000 depending on the specific platform.</p>
      <p>Fund range is the second consideration. Most major UK platforms offer thousands of OEIC funds, investment trusts, ETFs, and individual shares. Index-tracking ETFs from providers such as Vanguard, iShares, and Invesco have become the default building block for passive investors, with ongoing charges below 0.25% even for globally diversified products.</p>
      <p>For hands-on investors, the quality of research tools, charting, and portfolio analytics varies considerably. Platforms targeting active traders tend to offer more detailed data; those aimed at passive or buy-and-hold investors emphasise simplicity and low minimum investments.</p>
      <p>The Financial Services Compensation Scheme (FSCS) protects ISA assets up to £85,000 per authorised firm in the event of platform insolvency, though the underlying investments held within the ISA are typically ring-fenced from the platform's own assets and not subject to this limit in practice.</p>
    `,
  },

  '/articles/first-time-buyer-guide': {
    slug: 'first-time-buyer-guide',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'First-Time Buyer Guide: Saving for a Deposit in 2026',
    metaDescription: 'How to save for your first home in 2026. Lifetime ISA, Help to Buy, mortgage deposits, and first-time buyer schemes compared.',
    metaKeywords: 'first time buyer, lifetime ISA, LISA, home deposit, first home savings, UK mortgage deposit 2026',
    date: '10 June 2026',
    body: `
      <p>Saving for a first home deposit remains one of the largest financial undertakings most UK adults will face. With average house prices in England above £300,000, a 10% deposit requires £30,000 or more — a sum that demands both a disciplined savings plan and the right savings vehicle to maximise returns and available government support.</p>
      <p>The Lifetime ISA (LISA) is the most powerful savings vehicle available to first-time buyers under 40. It adds a 25% government bonus on contributions up to £4,000 per year — equivalent to £1,000 of free money annually. The bonus is paid monthly and earns interest or investment returns alongside the original contribution. For a couple both using a LISA, this represents £2,000 per year in government bonuses combined.</p>
      <p>The LISA has important restrictions. It can only be used to buy a first property worth £450,000 or less, and withdrawing for any other purpose before age 60 incurs a 25% penalty on the full withdrawal — which effectively claws back the bonus and a small portion of your own contributions. Savers must open a LISA before age 40 and can contribute until age 50.</p>
      <p>Outside the LISA, a Stocks and Shares ISA can grow a deposit faster than cash if the savings horizon is five years or more, though short-term market volatility makes it unsuitable for deposits needed within two or three years. Cash ISAs and high-interest savings accounts remain appropriate for nearer-term purchase plans.</p>
      <p>Mortgage brokers consistently recommend saving at least 10% as a deposit — 5% mortgages are available but attract considerably higher interest rates, and a 15% or 20% deposit unlocks the most competitive mortgage deals and lower monthly repayments over the life of the loan.</p>
    `,
  },

  '/articles/dividend-investing-uk': {
    slug: 'dividend-investing-uk',
    category: 'finance',
    pubId: 'pub_001',
    publisherName: 'Finance Weekly',
    publisherTagline: 'UK personal finance &amp; investing',
    title: 'Dividend Investing in the UK: Building an Income Portfolio',
    metaDescription: 'A guide to dividend investing in the UK. How to build an income portfolio using dividend stocks, investment trusts, and ETFs inside an ISA.',
    metaKeywords: 'dividend investing UK, income portfolio, dividend stocks, high yield shares, investment trust dividends, dividend ETF',
    date: '9 June 2026',
    body: `
      <p>Dividend investing — building a portfolio that generates a regular income stream from company profit distributions — has long attracted UK investors seeking alternatives to cash savings. At its most straightforward, it involves buying shares in companies that pay reliable, growing dividends and holding them long enough for compounding to work.</p>
      <p>The FTSE 100 has historically offered a higher dividend yield than most major global indices, reflecting the UK market's concentration in mature, cash-generative sectors: financials, energy, utilities, and consumer staples. This yield advantage comes with a trade-off — the UK market has delivered lower total returns than the US market over the past 15 years, partly because slower-growing companies pay out more in dividends rather than reinvesting for growth.</p>
      <p>Investment trusts are a popular vehicle for income investors, offering the ability to smooth dividends across good and bad years by holding back a revenue reserve in profitable periods. Several UK investment trusts have grown their dividends consecutively for 50 or more years, a track record that individual equity selections cannot match for consistency.</p>
      <p>Dividend ETFs offer a more passive route. Funds tracking indices such as the FTSE UK Dividend+ or global equivalents provide diversified exposure to high-yielding stocks with low ongoing charges. Dividend reinvestment plans (DRIPs) allow income to be automatically reinvested, accelerating compounding without the need for manual intervention.</p>
      <p>Tax efficiency matters. Within an ISA, dividends are received free of tax regardless of amount. Outside an ISA, the dividend allowance is currently £500 per year; income above this is taxed at 8.75% for basic rate taxpayers and 33.75% for higher rate taxpayers — making the ISA wrapper particularly valuable for income investors.</p>
    `,
  },

  // ============================================================
  // Tech Briefing — new articles (Session 8)
  // ============================================================

  '/articles/best-antivirus-2026': {
    slug: 'best-antivirus-2026',
    category: 'tech',
    pubId: 'pub_002',
    publisherName: 'Tech Briefing',
    publisherTagline: 'UK technology news &amp; reviews',
    title: 'Best Antivirus Software for 2026: UK Buyer\'s Guide',
    metaDescription: 'The best antivirus and internet security software for UK users in 2026. Protection, performance, and price compared.',
    metaKeywords: 'best antivirus 2026, internet security software, malware protection, antivirus UK, cybersecurity software',
    date: '8 June 2026',
    body: `
      <p>The antivirus software market has consolidated significantly over the past decade, with a handful of vendors — Norton, Bitdefender, Kaspersky, ESET, and Malwarebytes among the most prominent — collectively accounting for the majority of consumer installations. The distinction between antivirus and broader internet security suites has blurred as vendors bundle VPNs, password managers, parental controls, and identity monitoring alongside core malware detection.</p>
      <p>Detection rates across leading products have converged. Independent testing organisations including AV-Test and AV-Comparatives consistently show that top-tier products detect 99.5% or more of known malware samples. The meaningful differences in 2026 are found in performance impact (how much the software slows the host system), false positive rates, and the quality of additional features rather than raw detection capability.</p>
      <p>Real-time protection, behavioural analysis, and cloud-based threat intelligence are now standard across all premium tiers. Ransomware protection — either through behavioural detection or protected folder features that prevent unauthorised file encryption — has become a key selling point, given the volume and sophistication of ransomware attacks targeting individuals and small businesses.</p>
      <p>For most home users, Windows Defender (now Microsoft Defender) provides adequate baseline protection at no additional cost. Paid products justify their pricing through reduced false positives, lighter system footprint, and supplementary tools such as secure browsers, password managers, and dark web monitoring — rather than meaningfully superior malware detection for everyday users.</p>
      <p>Subscription pricing typically ranges from £20 to £80 per year for single-device cover, with multi-device household licences offering better value for families. Annual renewals often carry steep price increases; shopping for a new subscription at renewal is frequently cheaper than accepting the auto-renewal rate.</p>
    `,
  },

  '/articles/cloud-storage-comparison': {
    slug: 'cloud-storage-comparison',
    category: 'tech',
    pubId: 'pub_002',
    publisherName: 'Tech Briefing',
    publisherTagline: 'UK technology news &amp; reviews',
    title: 'Cloud Storage Comparison 2026: Which Service Is Best?',
    metaDescription: 'Compare the best cloud storage services in 2026. Google Drive, Dropbox, OneDrive, iCloud, and more compared on price, storage, and features.',
    metaKeywords: 'cloud storage comparison, best cloud storage 2026, Google Drive, Dropbox, OneDrive, online storage UK',
    date: '7 June 2026',
    body: `
      <p>Cloud storage has become a utility for most people who use smartphones and computers — automatic photo backups, document syncing across devices, and file sharing have made it essential infrastructure. The market is dominated by four providers: Google Drive, Microsoft OneDrive, Apple iCloud, and Dropbox, each with distinct strengths depending on the user's existing ecosystem.</p>
      <p>Free tier allocations vary considerably. Google Drive offers 15GB shared across Gmail, Drive, and Photos — generous enough for light users but quickly consumed by photo-heavy users. Microsoft OneDrive gives 5GB free, with 100GB available for £1.99 per month. Apple iCloud provides 5GB free, with 50GB for 99p per month. Dropbox has reduced its free tier to 2GB, making it the least competitive at the entry level despite being one of the earliest cloud storage services.</p>
      <p>For users already in a particular ecosystem, the native service is usually the rational choice. Microsoft 365 Personal (£59.99 per year) includes 1TB of OneDrive storage alongside Office apps — making it extremely cost-competitive if Office is already needed. Google One at 2TB costs £99.99 per year and includes Google Workspace benefits. Apple's 2TB iCloud plan (£8.99 per month) is deeply integrated into iOS and macOS workflows.</p>
      <p>Dropbox differentiates on collaboration features, selective sync granularity, and third-party integrations. Its Paper collaboration tool and tight Slack, Zoom, and Adobe integrations make it popular in professional environments, though its pricing (£9.99 per month for 2TB on the Plus plan) is harder to justify for individual consumers compared to ecosystem-native alternatives.</p>
      <p>Security and privacy considerations are increasingly relevant. Most mainstream cloud storage services encrypt data in transit and at rest, but hold encryption keys themselves — meaning they can technically access files if compelled. End-to-end encrypted alternatives such as Proton Drive and Tresorit offer stronger privacy guarantees but with fewer collaboration features and higher prices.</p>
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
