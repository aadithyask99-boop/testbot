const { kvGet, kvSet, kvListGet, kvHashGetAll } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const view = (req.query && req.query.view) || 'operator';

  try {
    const today = new Date().toISOString().split('T')[0];
    const n   = v => parseInt(v) || 0;
    const pct = (c, i) => !i ? '0.0%' : (n(c) / i * 100).toFixed(1) + '%';

    // Fetch everything in one round trip
    const [
      totalImpressions,
      todayImpressions,
      retrievalCount,
      trainingCount,
      totalPubClicks,
      todayPubClicks,
      totalAdvClicks,
      todayAdvClicks,
      totalUniqClicks,
      todayUniqClicks,
      recentBotLogs,
      recentPubClicks,
      recentAdvClicks,
      currentCreative,
      platformTotals,
      clickPlatformTotals,
      uniqClickPlatformTotals,
    ] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:date:' + today),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvGet('stats:clicks:total'),
      kvGet('stats:clicks:date:' + today),
      kvGet('stats:adclicks:total'),
      kvGet('stats:adclicks:date:' + today),
      kvGet('stats:unique_clicks:total'),
      kvGet('stats:unique_clicks:date:' + today),
      kvListGet('log:recent', 100),
      kvListGet('log:clicks', 20),
      kvListGet('log:adclicks', 20),
      kvGet('creative:finance_investing'),
      kvHashGetAll('stats:impr_by_platform'),
      kvHashGetAll('stats:click_by_platform'),
      kvHashGetAll('stats:uniq_click_by_platform'),
    ]);

    // Core counts
    const impressions  = n(totalImpressions);
    const pubClicks    = n(totalPubClicks);
    const uniqClicks   = n(totalUniqClicks);
    const advClicks    = n(totalAdvClicks);
    const retrieval    = n(retrievalCount);
    const training     = n(trainingCount);
    // Use actual campaign CPM. Retrieval impressions billed at campaign rate.
    // Training impressions billed at 30% of campaign rate (lower commercial value).
    const campaignCPM  = ((currentCreative && currentCreative.cpmGBP) || 18);
    const revenueGBP   = ((retrieval * campaignCPM) + (training * campaignCPM * 0.3)) / 1000;

    // Platform impression breakdown
    // Merge KV totals (accurate, post-deploy) with log (last 100, historical)
    const logImprByPlatform = {};
    (recentBotLogs || []).forEach(e => {
      if (!e || !e.platform) return;
      logImprByPlatform[e.platform] = (logImprByPlatform[e.platform] || 0) + 1;
    });

    const kvImprByPlatform = platformTotals || {};

    // Seed KV totals from log on first run
    if (!platformTotals || Object.keys(platformTotals).length === 0) {
      kvSet('stats:platform_totals', logImprByPlatform).catch(() => {});
    }

    // Use max of both sources per platform
    const allPlatformNames = new Set([
      ...Object.keys(kvImprByPlatform),
      ...Object.keys(logImprByPlatform),
    ]);
    const imprByPlatform = {};
    allPlatformNames.forEach(p => {
      imprByPlatform[p] = Math.max(
        kvImprByPlatform[p] || 0,
        logImprByPlatform[p] || 0
      );
    });

    // Platform click breakdown
    const clicksByPlatform = clickPlatformTotals || {};
    if (Object.keys(clicksByPlatform).length === 0) {
      (recentPubClicks || []).forEach(e => {
        if (!e || !e.platform) return;
        clicksByPlatform[e.platform] = (clicksByPlatform[e.platform] || 0) + 1;
      });
    }

    // Platform unique click breakdown
    const uniqClicksByPlatform = uniqClickPlatformTotals || {};

    // Build platform table
    const platformNames = [...allPlatformNames]
      .sort((a, b) => (imprByPlatform[b] || 0) - (imprByPlatform[a] || 0));

    const platformTable = platformNames.map(p => ({
      platform:    p,
      impressions: imprByPlatform[p] || 0,
      clicks:      clicksByPlatform[p] || 0,
      uniqueClicks: uniqClicksByPlatform[p] || 0,
      ctr:         pct(clicksByPlatform[p] || 0, imprByPlatform[p] || 0),
      uniqueCTR:   pct(uniqClicksByPlatform[p] || 0, imprByPlatform[p] || 0),
    }));

    // Queries from pub clicks
    const queries = (recentPubClicks || [])
      .filter(c => c && c.query)
      .map(c => ({ query: c.query, platform: c.platform, time: c.time }))
      .slice(0, 10);

    // ── ADVERTISER VIEW ────────────────────────────────────────
    if (view === 'advertiser') {
      return res.status(200).json({
        _view: 'advertiser',
        campaign: {
          advertiser: (currentCreative && currentCreative.advertiser) || 'Not set',
          text:       (currentCreative && currentCreative.text)       || '',
          link:       (currentCreative && currentCreative.link)       || '',
          linkText:   (currentCreative && currentCreative.linkText)   || '',
          advSlug:    (currentCreative && currentCreative.advSlug)    || '',
          category:   (currentCreative && currentCreative.category)   || '',
          cpmGBP:     (currentCreative && currentCreative.cpmGBP)     || 0,
          updatedAt:  (currentCreative && currentCreative.updatedAt)  || null,
        },
        impressions: {
          total:       impressions,
          today:       n(todayImpressions),
          description: 'Times your brand message was served to an AI crawler',
          byPlatform:  platformTable,
        },
        visits: {
          total:       pubClicks,
          today:       n(todayPubClicks),
          unique:      uniqClicks,
          todayUnique: n(todayUniqClicks),
          overallCTR:  pct(pubClicks, impressions),
          uniqueCTR:   pct(uniqClicks, impressions),
          description: 'Humans who visited the publisher page from an AI platform citation',
          byPlatform:  clicksByPlatform,
          queries,
        },
        spend: {
          estimatedTotalGBP: parseFloat(revenueGBP.toFixed(4)),
          cpmGBP:            (currentCreative && currentCreative.cpmGBP) || 18,
          model:             'CPM charged on retrieval crawler impressions only',
        },
        verification: {
          selfTest: {
            command: 'curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" https://testbot-two-psi.vercel.app/',
            note: 'Your ad copy should appear as a plain paragraph in the HTML response.',
          },
          recentImpressions: (recentBotLogs || []).slice(0, 10).map(e => ({
            time:        e.time,
            platform:    e.platform,
            crawlerType: e.crawlerType,
            confidence:  (e.confidence || 0) + '%',
            ipPrefix:    e.ip ? e.ip.split(',')[0].trim().split('.').slice(0, 2).join('.') + '.*.*' : 'unknown',
          })),
          note: 'Confidence score reflects detection certainty. Only visits above 70% confidence are counted as impressions.',
        },
      });
    }

    // ── PUBLISHER VIEW ─────────────────────────────────────────
    if (view === 'publisher') {
      return res.status(200).json({
        _view: 'publisher',
        campaign: {
          advertiser: (currentCreative && currentCreative.advertiser) || 'No campaign',
          category:   (currentCreative && currentCreative.category)   || '',
          cpmGBP:     (currentCreative && currentCreative.cpmGBP)     || 0,
        },
        earnings: {
          estimatedGBP:    parseFloat((revenueGBP * 0.8).toFixed(4)),
          revenueSharePct: 80,
          grossGBP:        parseFloat(revenueGBP.toFixed(4)),
        },
        traffic: {
          totalImpressions: impressions,
          today:            n(todayImpressions),
          byPlatform:       platformTable,
        },
        clicks: {
          total:      pubClicks,
          unique:     uniqClicks,
          today:      n(todayPubClicks),
          overallCTR: pct(pubClicks, impressions),
          uniqueCTR:  pct(uniqClicks, impressions),
        },
        recentVisits: (recentBotLogs || []).slice(0, 10),
      });
    }

    // ── OPERATOR VIEW (default) ─────────────────────────────────
    return res.status(200).json({
      _view: 'operator',
      summary: {
        totalImpressions:  impressions,
        todayImpressions:  n(todayImpressions),
        pubClicks,
        uniqClicks,
        advClicks,
        todayPubClicks:    n(todayPubClicks),
        todayUniqClicks:   n(todayUniqClicks),
        todayAdvClicks:    n(todayAdvClicks),
        pubCTR:            pct(pubClicks, impressions),
        uniqCTR:           pct(uniqClicks, impressions),
        advCTR:            pct(advClicks, impressions),
        retrieval,
        training,
      },
      revenue: {
        grossGBP:         parseFloat(revenueGBP.toFixed(4)),
        publisherShare80: parseFloat((revenueGBP * 0.8).toFixed(4)),
        platformShare20:  parseFloat((revenueGBP * 0.2).toFixed(4)),
      },
      platformBreakdown:  platformTable,
      recentImpressions:  (recentBotLogs || []).slice(0, 20),
      recentPubClicks:    (recentPubClicks || []).slice(0, 10),
      recentAdvClicks:    (recentAdvClicks || []).slice(0, 10),
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};
