const { kvGet, kvListGet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      // Impressions
      totalImpressions,
      perplexityImpressions,
      chatgptImpressions,
      claudeImpressions,
      googleAgentImpressions,
      unknownImpressions,
      retrievalCount,
      trainingCount,
      todayImpressions,
      recentBotLogs,
      // Clicks
      totalClicks,
      perplexityClicks,
      chatgptClicks,
      googleClicks,
      bingClicks,
      todayClicks,
      recentClickLogs,
    ] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:platform:Perplexity'),
      kvGet('stats:impressions:platform:ChatGPT Browse'),
      kvGet('stats:impressions:platform:Claude (Anthropic retrieval)'),
      kvGet('stats:impressions:platform:Google Agent (Gemini retrieval)'),
      kvGet('stats:impressions:platform:unknown'),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvGet(`stats:impressions:date:${today}`),
      kvListGet('log:recent', 20),
      kvGet('stats:clicks:total'),
      kvGet('stats:clicks:platform:Perplexity'),
      kvGet('stats:clicks:platform:ChatGPT'),
      kvGet('stats:clicks:platform:Google'),
      kvGet('stats:clicks:platform:Bing'),
      kvGet(`stats:clicks:date:${today}`),
      kvListGet('log:clicks', 20),
    ]);

    const impressions = parseInt(totalImpressions) || 0;
    const clicks = parseInt(totalClicks) || 0;
    const retrieval = parseInt(retrievalCount) || 0;
    const training = parseInt(trainingCount) || 0;

    // Revenue estimate: retrieval at £18 CPM, training at £5 CPM
    const estimatedRevenueGBP = ((retrieval * 18) + (training * 5)) / 1000;

    // CTR per platform — safe divide
    function ctr(c, i) {
      if (!i || i === 0) return '0.0%';
      return ((parseInt(c) || 0) / i * 100).toFixed(1) + '%';
    }

    const pImpressions = parseInt(perplexityImpressions) || 0;
    const cImpressions = parseInt(chatgptImpressions) || 0;
    const pClicks = parseInt(perplexityClicks) || 0;
    const cClicks = parseInt(chatgptClicks) || 0;

    res.status(200).json({
      publisher: 'Finance Weekly Demo',
      date: today,

      impressions: {
        total: impressions,
        today: parseInt(todayImpressions) || 0,
        retrieval,
        training,
        byPlatform: {
          Perplexity: pImpressions,
          ChatGPT: cImpressions,
          Claude: parseInt(claudeImpressions) || 0,
          GoogleAgent: parseInt(googleAgentImpressions) || 0,
          unknown: parseInt(unknownImpressions) || 0,
        },
      },

      clicks: {
        total: clicks,
        today: parseInt(todayClicks) || 0,
        byPlatform: {
          Perplexity: pClicks,
          ChatGPT: cClicks,
          Google: parseInt(googleClicks) || 0,
          Bing: parseInt(bingClicks) || 0,
        },
      },

      ctr: {
        overall: ctr(clicks, impressions),
        byPlatform: {
          Perplexity: ctr(pClicks, pImpressions),
          ChatGPT: ctr(cClicks, cImpressions),
        },
        note: 'CTR = clicks from AI platform referrer ÷ bot impressions. Perplexity and ChatGPT only where both signals are tracked.',
      },

      revenue: {
        estimatedGBP: parseFloat(estimatedRevenueGBP.toFixed(4)),
        publisherShare60pct: parseFloat((estimatedRevenueGBP * 0.6).toFixed(4)),
        platformShare40pct: parseFloat((estimatedRevenueGBP * 0.4).toFixed(4)),
      },

      recentImpressions: recentBotLogs,
      recentClicks: recentClickLogs,
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};
