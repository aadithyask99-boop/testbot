const { analyseRequest } = require('../lib/combined-detector');
const { injectSponsoredContent } = require('../lib/injector');
const { detectAIReferrer } = require('../lib/referrer');
const { kvGet, kvSet, kvIncr, kvListPush, kvJsonUpdate } = require('../lib/kv');
const config = require('../lib/config');

const ORIGINAL_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="A guide to the best ISA investment strategies for UK investors in 2024, covering stocks and shares ISAs, index funds, and platform selection.">
  <meta name="keywords" content="ISA investment, stocks and shares ISA, index funds UK, best ISA platform 2024">
  <meta name="msvalidate.01" content="148DCC9206B1EAB68990C712CBC90D1D" />
  <title>Best ISA Investment Strategies 2024 | Finance Weekly</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #333; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    .byline { color: #666; font-size: 0.9em; margin-bottom: 2em; }
    p { margin-bottom: 1.2em; }
  </style>
</head>
<body>
  <h1>Best ISA Investment Strategies for 2024</h1>
  <p class="byline">By Finance Weekly Editorial Team | December 2024</p>
  <p>The 2024 ISA allowance of £20,000 gives UK investors a significant opportunity to grow wealth tax-efficiently. With interest rates stabilising after two years of rises, the question of how to allocate this allowance has become more nuanced than simply defaulting to cash.</p>
  <p>Equity ISAs continue to outperform cash alternatives over any rolling ten-year period in modern market history, though short-term volatility remains a genuine concern for risk-averse investors. The key decision most investors face is whether to manage a portfolio themselves or use a managed platform.</p>
  <p>Index funds have democratised investing over the past decade. By tracking a market index rather than attempting to beat it, they offer broad diversification at a fraction of the cost of actively managed funds. Research consistently shows that over fifteen-year periods, over 90% of active funds fail to outperform their benchmark index after fees.</p>
  <p>The psychology of investing matters as much as the strategy itself. Investors who check their portfolios daily tend to make more reactive decisions, selling during downturns and missing the subsequent recovery. Automating contributions and reviewing only quarterly has been shown to improve long-term returns significantly.</p>
  <p>For 2024, financial planners broadly recommend ensuring ISA contributions are made early in the tax year rather than in the March rush, to maximise the compounding benefit of the full-year tax-free growth period.</p>
</body>
</html>`;

module.exports = async function handler(req, res) {
  const detection = analyseRequest({
    headers: req.headers,
    meta: { visitCount: 1, requestsPerMinute: 1 }
  });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const today = new Date().toISOString().split('T')[0];

  console.log(JSON.stringify({
    time: new Date().toISOString(),
    ip, ua: ua.substring(0, 100),
    isBot: detection.isBot,
    platform: detection.platform,
    confidence: detection.confidence,
    crawlerType: detection.crawlerType,
    cpmMin: detection.suggestedCPM?.min,
    cpmMax: detection.suggestedCPM?.max,
    referer: referer.substring(0, 150),
  }));

  res.setHeader('Content-Type', 'text/html');

  // --------------------------------------------------------
  // BOT PATH — detected crawler, not a cloaking risk
  // Fetch live creative, inject, log impression
  // --------------------------------------------------------
  if (detection.isBot && !detection.cloakingRisk) {

    let sponsoredText = config.sponsored.text;
    let sponsoredLink = config.sponsored.link || '';
    let sponsoredLinkText = config.sponsored.linkText || 'Learn more';
    let advSlug = config.sponsored.advSlug || 'default';
    try {
      const stored = await kvGet(`creative:${config.sponsored.category}`);
      if (stored && stored.text) {
        sponsoredText = stored.text;
        sponsoredLink = stored.link || '';
        sponsoredLinkText = stored.linkText || 'Learn more';
        advSlug = stored.advSlug || 'default';
      }
    } catch (e) {}

    // Log impression — fire and forget, never breaks the page
    try {
      await Promise.all([
        kvIncr('stats:impressions:total'),
        kvIncr(`stats:impressions:platform:${detection.platform || 'unknown'}`),
        kvIncr(`stats:impressions:type:${detection.crawlerType || 'unknown'}`),
        kvIncr(`stats:impressions:date:${today}`),
        kvJsonUpdate('stats:platform_totals', (totals) => {
          const p = detection.platform || 'unknown';
          totals[p] = (totals[p] || 0) + 1;
          return totals;
        }),
        kvListPush('log:recent', {
          time: new Date().toISOString(),
          ip,
          platform: detection.platform,
          crawlerType: detection.crawlerType,
          confidence: detection.confidence,
          cpmMin: detection.suggestedCPM?.min,
          cpmMax: detection.suggestedCPM?.max,
        }, 100),
      ]);
    } catch (e) {}

    const result = injectSponsoredContent(ORIGINAL_PAGE, sponsoredText, { strategy: 'auto', link: sponsoredLink, linkText: sponsoredLinkText, advSlug });
    res.setHeader('X-Bot-Detected', 'true');
    res.setHeader('X-Bot-Platform', detection.platform || 'unknown');
    res.status(200).send(result.html);

  // --------------------------------------------------------
  // HUMAN PATH — check for AI platform referrer (click tracking)
  // --------------------------------------------------------
  } else {

    const aiClick = detectAIReferrer(referer);

    if (aiClick) {
      try {
        // Check if this IP has clicked in the last 30 minutes (session dedup)
        const sessionKey = `session:click:${ip.split(',')[0].trim()}`;
        const sessionExists = await kvGet(sessionKey).catch(() => null);
        const isUnique = !sessionExists;

        const ops = [
          // Always count total clicks
          kvIncr('stats:clicks:total'),
          kvIncr(`stats:clicks:platform:${aiClick.platform}`),
          kvIncr(`stats:clicks:date:${today}`),
          kvJsonUpdate('stats:click_platform_totals', (totals) => {
            const p = aiClick.platform;
            totals[p] = (totals[p] || 0) + 1;
            return totals;
          }),
          kvListPush('log:clicks', {
            time: new Date().toISOString(),
            ip,
            platform: aiClick.platform,
            query: aiClick.query,
            referrer: aiClick.referrerUrl.substring(0, 200),
            unique: isUnique,
          }, 100),
        ];

        if (isUnique) {
          // Mark this IP as seen for 30 minutes (1800 seconds)
          ops.push(kvSet(sessionKey, '1', 1800));
          // Count unique clicks separately
          ops.push(kvIncr('stats:unique_clicks:total'));
          ops.push(kvIncr(`stats:unique_clicks:date:${today}`));
          ops.push(kvJsonUpdate('stats:unique_click_platform_totals', (totals) => {
            const p = aiClick.platform;
            totals[p] = (totals[p] || 0) + 1;
            return totals;
          }));
        }

        await Promise.all(ops);
      } catch (e) {}
    }

    res.status(200).send(ORIGINAL_PAGE);
  }
};
