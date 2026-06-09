const { kvGet, kvListGet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const view  = req.query && req.query.view;

  try {
    const today = new Date().toISOString().split('T')[0];
    const n = v => parseInt(v) || 0;
    const pct = (c, i) => !i ? '0.0%' : (n(c) / i * 100).toFixed(1) + '%';

    const [
      totalImpressions,
      todayImpressions,
      retrievalCount,
      trainingCount,
      totalPubClicks,       // humans landing from AI citation
      todayPubClicks,
      totalAdvClicks,       // humans clicking advertiser link
      todayAdvClicks,
      recentBotLogs,
      recentPubClickLogs,
      recentAdvClickLogs,
      currentCreative,
      platformTotals,
    ] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet(`stats:impressions:date:${today}`),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvGet('stats:clicks:total'),
      kvGet(`stats:clicks:date:${today}`),
      kvGet('stats:adclicks:total'),
      kvGet(`stats:adclicks:date:${today}`),
      kvListGet('log:recent', 100),
      kvListGet('log:clicks', 20),
      kvListGet('log:adclicks', 20),
      kvGet('creative:finance_investing'),
      kvGet('stats:platform_totals'),
    ]);

    const impressions  = n(totalImpressions);
    const pubClicks    = n(totalPubClicks);
    const advClicks    = n(totalAdvClicks);
    const retrieval    = n(retrievalCount);
    const training     = n(trainingCount);
    const revenueGBP   = ((retrieval * 18) + (training * 5)) / 1000;

    // Platform breakdown — use accurate KV totals, fall back to log
    const platformCounts = platformTotals || {};
    // If no totals stored yet, compute from log as fallback
    if (Object.keys(platformCounts).length === 0) {
      (recentBotLogs || []).forEach(e => {
        if (!e || !e.platform) return;
        platformCounts[e.platform] = (platformCounts[e.platform] || 0) + 1;
      });
    }

    // Compute pub click platform breakdown from log
    const pubClickByPlatform = {};
    (recentPubClickLogs || []).forEach(e => {
      if (!e || !e.platform) return;
      pubClickByPlatform[e.platform] = (pubClickByPlatform[e.platform] || 0) + 1;
    });

    // Extract queries from pub clicks
    const queries = (recentPubClickLogs || [])
      .filter(c => c && c.query)
      .map(c => ({ query: c.query, platform: c.platform, time: c.time }))
      .slice(0, 10);

    // Build platform table with both impressions + pub clicks + CTR
    const allPlatforms = [...new Set([
      ...Object.keys(platformCounts),
      ...Object.keys(pubClickByPlatform),
    ])].sort((a, b) => (platformCounts[b] || 0) - (platformCounts[a] || 0));

    const platformTable = allPlatforms.map(p => ({
      platform:    p,
      impressions: platformCounts[p] || 0,
      pubClicks:   pubClickByPlatform[p] || 0,
      ctr:         pct(pubClickByPlatform[p] || 0, platformCounts[p] || 0),
    }));

    // --------------------------------------------------------
    // ADVERTISER VIEW — /dashboard?view=advertiser
    // --------------------------------------------------------
    if (view === 'advertiser') {
      return res.status(200).json({
        _view: 'advertiser',
        campaign: {
          advertiser: currentCreative ? currentCreative.advertiser : 'Not set',
          text:       currentCreative ? currentCreative.text       : '',
          link:       currentCreative ? currentCreative.link       : '',
          linkText:   currentCreative ? currentCreative.linkText   : '',
          advSlug:    currentCreative ? currentCreative.advSlug    : '',
          category:   currentCreative ? currentCreative.category   : '',
          cpmGBP:     currentCreative ? currentCreative.cpmGBP     : 0,
          updatedAt:  currentCreative ? currentCreative.updatedAt  : null,
        },
        impressions: {
          total:       impressions,
          today:       n(todayImpressions),
          description: 'Times your brand message was served to an AI crawler',
          byPlatform:  platformTable,
        },
        // Publisher clicks = humans landing on publisher page after AI cited it
        publisherClicks: {
          total:       pubClicks,
          today:       n(todayPubClicks),
          description: 'Humans who visited the publisher page from an AI platform citation',
          overallCTR:  pct(pubClicks, impressions),
          byPlatform:  pubClickByPlatform,
          queries,
        },
        // Advertiser clicks = humans who clicked your ad link in the content
        advertiserClicks: {
          total:       advClicks,
          today:       n(todayAdvClicks),
          description: 'Humans who clicked your link in the injected content',
          overallCTR:  pct(advClicks, impressions),
          recentClicks: recentAdvClickLogs.slice(0, 10),
        },
        spend: {
          estimatedTotalGBP: parseFloat(revenueGBP.toFixed(4)),
          cpmGBP:            currentCreative ? currentCreative.cpmGBP : 18,
          model:             'CPM charged on retrieval impressions only',
        },
      });
    }

    // --------------------------------------------------------
    // PUBLISHER VIEW — /dashboard?view=publisher
    // --------------------------------------------------------
    if (view === 'publisher') {
      return res.status(200).json({
        _view: 'publisher',
        campaign: {
          advertiser: currentCreative ? currentCreative.advertiser : 'No campaign',
          category:   currentCreative ? currentCreative.category   : '',
          cpmGBP:     currentCreative ? currentCreative.cpmGBP     : 0,
        },
        earnings: {
          estimatedGBP:     parseFloat((revenueGBP * 0.6).toFixed(4)),
          revenueSharePct:  60,
          grossGBP:         parseFloat(revenueGBP.toFixed(4)),
        },
        traffic: {
          totalImpressions: impressions,
          today:            n(todayImpressions),
          byPlatform:       platformTable,
        },
        clicks: {
          total:       pubClicks,
          today:       n(todayPubClicks),
          description: 'Humans landing on your page after an AI cited it',
          overallCTR:  pct(pubClicks, impressions),
        },
        recentVisits: (recentBotLogs || []).slice(0, 10),
      });
    }

    // --------------------------------------------------------
    // OPERATOR VIEW — /dashboard (default)
    // --------------------------------------------------------
    return res.status(200).json({
      _view: 'operator',
      summary: {
        totalImpressions:  impressions,
        todayImpressions:  n(todayImpressions),
        pubClicks,
        advClicks,
        todayPubClicks:    n(todayPubClicks),
        todayAdvClicks:    n(todayAdvClicks),
        pubCTR:            pct(pubClicks, impressions),
        advCTR:            pct(advClicks, impressions),
        retrieval,
        training,
      },
      revenue: {
        grossGBP:           parseFloat(revenueGBP.toFixed(4)),
        publisherShare60:   parseFloat((revenueGBP * 0.6).toFixed(4)),
        platformShare40:    parseFloat((revenueGBP * 0.4).toFixed(4)),
      },
      platformBreakdown:   platformTable,
      recentImpressions:   (recentBotLogs || []).slice(0, 20),
      recentPubClicks:     recentPubClickLogs.slice(0, 10),
      recentAdvClicks:     recentAdvClickLogs.slice(0, 10),
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};
