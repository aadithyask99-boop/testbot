const { kvGet, kvListGet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const view = req.query && req.query.view;

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all stats in parallel
    const [
      totalImpressions,
      todayImpressions,
      retrievalCount,
      trainingCount,
      // Impressions by platform
      pImpr,   // Perplexity
      cgImpr,  // ChatGPT
      clImpr,  // Claude
      gaImpr,  // Google Agent
      grImpr,  // Grok
      ukImpr,  // unknown
      // Clicks
      totalClicks,
      todayClicks,
      pClicks,
      cgClicks,
      gClicks,
      bClicks,
      // Logs
      recentBotLogs,
      recentClickLogs,
      // Current creative
      currentCreative,
    ] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet(`stats:impressions:date:${today}`),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvGet('stats:impressions:platform:Perplexity'),
      kvGet('stats:impressions:platform:ChatGPT Browse'),
      kvGet('stats:impressions:platform:Claude (Anthropic retrieval)'),
      kvGet('stats:impressions:platform:Google Agent (Gemini retrieval)'),
      kvGet('stats:impressions:platform:xAI Grok'),
      kvGet('stats:impressions:platform:unknown'),
      kvGet('stats:clicks:total'),
      kvGet(`stats:clicks:date:${today}`),
      kvGet('stats:clicks:platform:Perplexity'),
      kvGet('stats:clicks:platform:ChatGPT'),
      kvGet('stats:clicks:platform:Google'),
      kvGet('stats:clicks:platform:Bing'),
      kvListGet('log:recent', 20),
      kvListGet('log:clicks', 20),
      kvGet('creative:finance_investing'),
    ]);

    // Helpers
    const n = v => parseInt(v) || 0;
    const pct = (c, i) => i === 0 ? '0.0%' : (n(c) / i * 100).toFixed(1) + '%';
    const cpm = v => v === 'high' ? 18 : v === 'medium' ? 10 : 5;

    const impressions    = n(totalImpressions);
    const clicks         = n(totalClicks);
    const retrieval      = n(retrievalCount);
    const training       = n(trainingCount);
    const revenueGBP     = ((retrieval * 18) + (training * 5)) / 1000;

    // Platform impressions
    const byPlatformImpressions = {
      'Perplexity':      n(pImpr),
      'ChatGPT':         n(cgImpr),
      'Claude':          n(clImpr),
      'Google Agent':    n(gaImpr),
      'Grok':            n(grImpr),
      'Unknown':         n(ukImpr),
    };

    // Platform clicks
    const byPlatformClicks = {
      'Perplexity':  n(pClicks),
      'ChatGPT':     n(cgClicks),
      'Google':      n(gClicks),
      'Bing':        n(bClicks),
    };

    // Per-platform CTR (only where we have both signals)
    const platformCTR = {
      'Perplexity': pct(pClicks, n(pImpr)),
      'ChatGPT':    pct(cgClicks, n(cgImpr)),
    };

    // Extract unique queries from click logs
    const queries = recentClickLogs
      .filter(c => c && c.query)
      .map(c => ({ query: c.query, platform: c.platform, time: c.time }))
      .slice(0, 10);

    // --------------------------------------------------------
    // ADVERTISER VIEW — /dashboard?view=advertiser
    // --------------------------------------------------------
    if (view === 'advertiser') {
      return res.status(200).json({
        _view: 'advertiser',
        _description: 'Campaign performance from advertiser perspective',

        campaign: {
          advertiser: currentCreative ? currentCreative.advertiser : 'Not set',
          category:   currentCreative ? currentCreative.category   : 'Not set',
          cpmGBP:     currentCreative ? currentCreative.cpmGBP     : 0,
          updatedAt:  currentCreative ? currentCreative.updatedAt  : null,
        },

        reach: {
          totalImpressions: impressions,
          todayImpressions: n(todayImpressions),
          description: 'Number of times your brand message was served to an AI crawler',
          byAIModel: Object.entries(byPlatformImpressions)
            .filter(([, v]) => v > 0)
            .map(([platform, count]) => ({ platform, impressions: count }))
            .sort((a, b) => b.impressions - a.impressions),
        },

        engagement: {
          totalClicks: clicks,
          todayClicks: n(todayClicks),
          description: 'Number of humans who clicked through to your page from an AI platform citation',
          overallCTR: pct(clicks, impressions),
          byAIModel: Object.entries(byPlatformClicks)
            .filter(([, v]) => v > 0)
            .map(([platform, count]) => ({
              platform,
              clicks: count,
              ctr: platformCTR[platform] || 'n/a',
            }))
            .sort((a, b) => b.clicks - a.clicks),
        },

        searchQueries: {
          description: 'Queries that brought users to your page from AI platforms',
          recentQueries: queries,
        },

        spend: {
          estimatedTotalGBP: parseFloat(revenueGBP.toFixed(4)),
          cpmGBP: currentCreative ? currentCreative.cpmGBP : 18,
          model: 'CPM charged on retrieval crawler impressions only',
        },

        recentActivity: recentClickLogs.slice(0, 5).map(c => ({
          time: c.time,
          event: 'click',
          platform: c.platform,
          query: c.query || null,
        })),
      });
    }

    // --------------------------------------------------------
    // PUBLISHER VIEW — /dashboard (default)
    // --------------------------------------------------------
    return res.status(200).json({
      _view: 'publisher',
      _description: 'Revenue and traffic data for publisher',
      _advertiserView: 'Add ?view=advertiser for advertiser report',

      summary: {
        totalImpressions: impressions,
        todayImpressions: n(todayImpressions),
        totalClicks: clicks,
        todayClicks: n(todayClicks),
        overallCTR: pct(clicks, impressions),
        retrievalCrawlers: retrieval,
        trainingCrawlers: training,
      },

      revenue: {
        estimatedGBP: parseFloat(revenueGBP.toFixed(4)),
        publisherShare60pct: parseFloat((revenueGBP * 0.6).toFixed(4)),
        platformShare40pct: parseFloat((revenueGBP * 0.4).toFixed(4)),
      },

      impressionsByPlatform: byPlatformImpressions,
      clicksByPlatform: byPlatformClicks,

      ctr: {
        overall: pct(clicks, impressions),
        byPlatform: platformCTR,
      },

      recentImpressions: recentBotLogs.slice(0, 10),
      recentClicks: recentClickLogs.slice(0, 10),
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};
