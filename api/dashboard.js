// ============================================================
// DASHBOARD — /dashboard
// ============================================================
// Shows real persistent impression data from the database.
// Every bot visit is logged and counted here.
// ============================================================

const { kvGet, kvListGet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all stats in parallel
    const [
      totalImpressions,
      perplexityCount,
      gptbotCount,
      claudeCount,
      bingCount,
      unknownCount,
      retrievalCount,
      trainingCount,
      todayCount,
      recentLogs,
    ] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:platform:Perplexity'),
      kvGet('stats:impressions:platform:GPTBot (OpenAI training)'),
      kvGet('stats:impressions:platform:Claude (Anthropic retrieval)'),
      kvGet('stats:impressions:platform:Bing Copilot'),
      kvGet('stats:impressions:platform:unknown'),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvGet(`stats:impressions:date:${today}`),
      kvListGet('log:recent', 20),
    ]);

    const total = parseInt(totalImpressions) || 0;
    const retrieval = parseInt(retrievalCount) || 0;
    const training = parseInt(trainingCount) || 0;

    // Estimate revenue: retrieval at £18 CPM, training at £5 CPM
    const estimatedRevenueGBP = ((retrieval * 18) + (training * 5)) / 1000;

    res.status(200).json({
      publisher: 'Finance Weekly Demo',
      summary: {
        totalImpressions: total,
        todayImpressions: parseInt(todayCount) || 0,
        retrievalCrawlers: retrieval,
        trainingCrawlers: training,
        estimatedRevenueGBP: parseFloat(estimatedRevenueGBP.toFixed(4)),
        publisherShare60pct: parseFloat((estimatedRevenueGBP * 0.6).toFixed(4)),
        platformShare40pct: parseFloat((estimatedRevenueGBP * 0.4).toFixed(4)),
      },
      byPlatform: {
        Perplexity: parseInt(perplexityCount) || 0,
        GPTBot: parseInt(gptbotCount) || 0,
        Claude: parseInt(claudeCount) || 0,
        Bing: parseInt(bingCount) || 0,
        unknown: parseInt(unknownCount) || 0,
      },
      recentImpressions: recentLogs,
    });

  } catch (e) {
    res.status(500).json({
      error: 'Dashboard unavailable',
      message: e.message,
    });
  }
};
