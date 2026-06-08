const express = require('express');
const { analyseRequest } = require('./combined-detector');
const { injectSponsoredContent } = require('./injector');
const config = require('./config');

const app = express();

// --------------------------------------------------------
// PORT — configurable via environment variable
// --------------------------------------------------------
// Plain English: Render (and most hosting platforms) assign
// their own port via the PORT environment variable. If that
// isn't set (e.g. running locally) we fall back to 3000.
// This is required for deployment — without it Render can't
// find your server and the deploy fails.
// --------------------------------------------------------
const PORT = process.env.PORT || 3000;

// --------------------------------------------------------
// THE ARTICLE PAGE
// --------------------------------------------------------
// Realistic finance article. Proper meta tags added so
// search engines and AI crawlers can understand what the
// page is about — which makes it more likely to be crawled
// when relevant queries are made.
// --------------------------------------------------------
const ORIGINAL_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="A guide to the best ISA investment strategies for UK investors in 2024, covering stocks and shares ISAs, index funds, and platform selection.">
  <meta name="keywords" content="ISA investment, stocks and shares ISA, index funds UK, best ISA platform 2024">
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

// --------------------------------------------------------
// REQUEST LOG
// --------------------------------------------------------
const requestLog = [];

// --------------------------------------------------------
// HEALTH CHECK ENDPOINT
// --------------------------------------------------------
// Plain English: Render pings this route every 30 seconds
// to confirm your server is alive. If it doesn't get a 200
// response, Render marks the deployment as failed and
// restarts it. Without this, deployments can fail silently.
// --------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    publisher: config.publisherName,
    version: '1.0.0',
  });
});

// --------------------------------------------------------
// MAIN ROUTE — the article page
// --------------------------------------------------------
app.get('/', (req, res) => {

  const requestData = {
    headers: req.headers,
    meta: {
      visitCount: 1,
      requestsPerMinute: 1,
    }
  };

  const detection = analyseRequest(requestData);

  // Log every request
  requestLog.push({
    time: new Date().toISOString(),
    ip: req.ip,
    ua: req.headers['user-agent']?.substring(0, 80),
    isBot: detection.isBot,
    platform: detection.platform,
    confidence: detection.confidence,
    crawlerType: detection.crawlerType,
    commercialValue: detection.commercialValue,
    cpmMin: detection.suggestedCPM?.min,
    cpmMax: detection.suggestedCPM?.max,
  });

  if (detection.isBot) {

    // BOT PATH — inject sponsored content
    const injectionResult = injectSponsoredContent(
      ORIGINAL_PAGE,
      config.sponsored.text,
      { strategy: 'auto' }
    );

    // Replace the human notice with a bot-visible debug notice
    // This lets us verify injection happened when testing
    const botHTML = injectionResult.html.replace(
      'HUMAN VIEW — original unmodified page',
      `BOT DETECTED | Platform: ${detection.platform} | Type: ${detection.crawlerType} | Confidence: ${detection.confidence}% | CPM: £${detection.suggestedCPM?.min}-${detection.suggestedCPM?.max} | Injection: ${injectionResult.strategy}`
    );

    console.log(`[${new Date().toISOString()}] BOT | ${detection.platform} | ${detection.confidence}% | ${detection.crawlerType} | CPM £${detection.suggestedCPM?.min}-${detection.suggestedCPM?.max} | IP: ${req.ip}`);

    res.setHeader('X-Bot-Detected', 'true');
    res.setHeader('X-Bot-Platform', detection.platform);
    res.setHeader('X-Crawler-Type', detection.crawlerType || 'unknown');
    res.send(botHTML);

  } else {

    // HUMAN PATH — serve clean original page
    console.log(`[${new Date().toISOString()}] HUMAN | ${req.headers['user-agent']?.substring(0, 60)} | IP: ${req.ip}`);
    res.send(ORIGINAL_PAGE);
  }
});

// --------------------------------------------------------
// DASHBOARD ROUTE
// --------------------------------------------------------
app.get('/dashboard', (req, res) => {
  const bots = requestLog.filter(r => r.isBot);
  const humans = requestLog.filter(r => !r.isBot);
  const retrieval = bots.filter(r => r.crawlerType === 'retrieval');
  const training = bots.filter(r => r.crawlerType === 'training');
  const estimatedRevenue = bots.reduce((sum, r) => sum + (r.cpmMin || 0) / 1000, 0);

  res.json({
    publisher: config.publisherName,
    summary: {
      totalRequests: requestLog.length,
      humanVisits: humans.length,
      botVisits: bots.length,
      retrievalCrawlers: retrieval.length,
      trainingCrawlers: training.length,
      estimatedRevenueGBP: parseFloat(estimatedRevenue.toFixed(4)),
    },
    botBreakdown: bots.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {}),
    recentRequests: requestLog.slice(-20).reverse(),
  });
});

// --------------------------------------------------------
// START SERVER
// --------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`\n📋 Routes:`);
  console.log(`   Article page:  http://localhost:${PORT}/`);
  console.log(`   Health check:  http://localhost:${PORT}/health`);
  console.log(`   Dashboard:     http://localhost:${PORT}/dashboard`);
  console.log(`\n🤖 Simulate a Perplexity bot:`);
  console.log(`   curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" http://localhost:${PORT}`);
  console.log(`\n🤖 Simulate GPTBot:`);
  console.log(`   curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" http://localhost:${PORT}`);
  console.log(`\n👤 Simulate a human:`);
  console.log(`   curl -H "User-Agent: Mozilla/5.0 Chrome/120.0.0.0" -H "Accept-Language: en-GB" -H "sec-ch-ua: Chrome" http://localhost:${PORT}\n`);
});
