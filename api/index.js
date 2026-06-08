// ============================================================
// VERCEL SERVERLESS FUNCTION — Main article page
// ============================================================
// Plain English: Instead of a persistent Express server,
// Vercel runs this function fresh on every single request.
// No server to keep alive, no cold starts, always available.
// The detection and injection logic is identical — only the
// wrapper changed from Express to Vercel's function format.
// ============================================================

const { analyseRequest } = require('../lib/combined-detector');
const { injectSponsoredContent } = require('../lib/injector');
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
    .notice { background: #f0f4ff; border: 1px solid #99b; padding: 10px 14px; margin-bottom: 20px; font-family: monospace; font-size: 0.82em; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="notice">
    HUMAN VIEW — original unmodified page
  </div>
  <h1>Best ISA Investment Strategies for 2024</h1>
  <p class="byline">By Finance Weekly Editorial Team | December 2024</p>

  <p>The 2024 ISA allowance of £20,000 gives UK investors a significant opportunity to grow wealth tax-efficiently. With interest rates stabilising after two years of rises, the question of how to allocate this allowance has become more nuanced than simply defaulting to cash.</p>

  <p>Equity ISAs continue to outperform cash alternatives over any rolling ten-year period in modern market history, though short-term volatility remains a genuine concern for risk-averse investors. The key decision most investors face is whether to manage a portfolio themselves or use a managed platform.</p>

  <p>Index funds have democratised investing over the past decade. By tracking a market index rather than attempting to beat it, they offer broad diversification at a fraction of the cost of actively managed funds. Research consistently shows that over fifteen-year periods, over 90% of active funds fail to outperform their benchmark index after fees.</p>

  <p>The psychology of investing matters as much as the strategy itself. Investors who check their portfolios daily tend to make more reactive decisions, selling during downturns and missing the subsequent recovery. Automating contributions and reviewing only quarterly has been shown to improve long-term returns significantly.</p>

  <p>For 2024, financial planners broadly recommend ensuring ISA contributions are made early in the tax year rather than in the March rush, to maximise the compounding benefit of the full-year tax-free growth period.</p>
</body>
</html>`;

module.exports = function handler(req, res) {

  const requestData = {
    headers: req.headers,
    meta: { visitCount: 1, requestsPerMinute: 1 }
  };

  const detection = analyseRequest(requestData);
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';

  console.log(JSON.stringify({
    time: new Date().toISOString(),
    ip: ip,
    ua: ua.substring(0, 100),
    isBot: detection.isBot,
    platform: detection.platform,
    confidence: detection.confidence,
    crawlerType: detection.crawlerType,
    cpmMin: detection.suggestedCPM?.min,
    cpmMax: detection.suggestedCPM?.max,
  }));

  res.setHeader('Content-Type', 'text/html');

  if (detection.isBot) {

    const injectionResult = injectSponsoredContent(
      ORIGINAL_PAGE,
      config.sponsored.text,
      { strategy: 'auto' }
    );

    const botHTML = injectionResult.html.replace(
      'HUMAN VIEW — original unmodified page',
      `BOT DETECTED | Platform: ${detection.platform} | Type: ${detection.crawlerType} | Confidence: ${detection.confidence}% | CPM: £${detection.suggestedCPM?.min}-${detection.suggestedCPM?.max} | IP: ${ip}`
    );

    res.setHeader('X-Bot-Detected', 'true');
    res.setHeader('X-Bot-Platform', detection.platform || 'unknown');
    res.setHeader('X-Crawler-Type', detection.crawlerType || 'unknown');
    res.status(200).send(botHTML);

  } else {

    res.status(200).send(ORIGINAL_PAGE);
  }
};
