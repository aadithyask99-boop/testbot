const { kvGet, kvSet, kvListGet, kvHashGetAll } = require('../lib/kv');
const { runAuction, getCampaignSpend } = require('../lib/auction');
const config = require('../lib/config');

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
      botVisitsTotal,
      botServedTotal,
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
      runAuction(config.demoPageCategory), // current auction winner (was creative:finance_investing)
      kvHashGetAll('stats:impr_by_platform'),
      kvHashGetAll('stats:click_by_platform'),
      kvHashGetAll('stats:uniq_click_by_platform'),
      kvGet('stats:bot_visits:total'),
      kvGet('stats:bot_served:total'),
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

    // ── SHARED CAMPAIGN LIST (auction order + winner badge) ──────
    // Built once, used by operator AND advertiser views. isWinner is
    // tied to the SINGLE runAuction() result above (currentCreative)
    // so equal-CPM ties never badge two rows or flicker.
    const winnerId = (currentCreative && currentCreative.id) || null;
    const allCampaignIds = [];
    for (const cat of config.categories) {
      const cids = (await kvGet('campaigns:' + cat)) || [];
      allCampaignIds.push(...cids);
    }
    const campaignList = [];
    for (const id of [...new Set(allCampaignIds)]) {
      const c = await kvGet('campaign:' + id);
      if (!c) continue;
      const spend = await getCampaignSpend(c);
      const dailyBudgetUsedPct = c.budgetDailyGBP ? Math.min(100, (spend.dailySpendGBP / c.budgetDailyGBP) * 100) : 0;
      // Viewable = retrieval impressions (reached a live retrieval crawler).
      // vCPM = spend per 1000 viewable impressions. Runs slightly above CPM
      // when training traffic exists (training billed but not viewable).
      const viewable = spend.retrievalTotal;
      const vcpm = viewable > 0 ? (spend.totalSpendGBP / viewable) * 1000 : 0;
      // Per-campaign platform breakdown (which AI crawlers saw THIS specific ad)
      const platHash = (await kvHashGetAll('stats:impr_by_camp_plat:' + c.id)) || {};
      const platformBreakdown = Object.keys(platHash)
        .map(k => ({ platform: k, impressions: parseInt(platHash[k]) || 0 }))
        .filter(x => x.impressions > 0)
        .sort((a, b) => b.impressions - a.impressions);
      campaignList.push({
        id: c.id, advertiser: c.advertiser, category: c.category,
        cpmGBP: c.cpmGBP, active: c.active === true,
        budgetDailyGBP: c.budgetDailyGBP, budgetTotalGBP: c.budgetTotalGBP,
        keywords: c.keywords || [],
        text: c.text, link: c.link, linkText: c.linkText, advSlug: c.advSlug,
        matchingDescription: c.matchingDescription || '',
        startDate: c.startDate, endDate: c.endDate, updatedAt: c.updatedAt,
        dailySpendGBP: parseFloat(spend.dailySpendGBP.toFixed(4)),
        totalSpendGBP: parseFloat(spend.totalSpendGBP.toFixed(4)),
        dailyBudgetUsedPct: parseFloat(dailyBudgetUsedPct.toFixed(1)),
        impressions: spend.totalImpressions,
        platformBreakdown,
        viewableImpressions: viewable,
        trainingImpressions: spend.trainingTotal,
        vcpmGBP: parseFloat(vcpm.toFixed(2)),
        isWinner: winnerId === c.id,
      });
    }
    // Auction order: active first, then CPM descending (the waterfall order)
    campaignList.sort((a, b) => (b.active - a.active) || (b.cpmGBP - a.cpmGBP));

    // Fill rate = bot visits that were served a creative / all bot visits.
    // Tells a publisher how well-monetised their AI traffic is.
    const botVisits = n(botVisitsTotal);
    const botServed = n(botServedTotal);
    const fillRatePct = botVisits > 0 ? parseFloat(((botServed / botVisits) * 100).toFixed(1)) : null;

    // Eligible competitors = campaigns that COULD serve on the demo category
    // right now (active, in-date). Mirrors the auction eligibility filter.
    // Note: does not re-check budget here (cheap approximation for display).
    const todayStr = today;
    const eligibleCount = campaignList.filter(c =>
      c.active && c.category === config.demoPageCategory &&
      (!c.startDate || c.startDate <= todayStr) &&
      (!c.endDate || c.endDate >= todayStr)
    ).length;

    // Aggregate viewable impressions across all campaigns (for KPI strips)
    const totalViewable = campaignList.reduce((s, c) => s + (c.viewableImpressions || 0), 0);
    const blendedVcpm = totalViewable > 0
      ? parseFloat(((revenueGBP / totalViewable) * 1000).toFixed(2)) : 0;

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
        campaigns: campaignList,
        // Session 3 diagnostic: surface match decisions at top level so the
        // dashboard's "Recent Match Decisions" table can read them directly.
        // Includes served AND unserved entries — the diagnostic value is
        // seeing WHY matching rejects things, not just successes.
        recentMatches: (recentBotLogs || []).slice(0, 15).map(e => ({
          time:           e.time,
          url:            e.url || null,
          platform:       e.platform,
          crawlerType:    e.crawlerType,
          campaignId:     e.campaignId || null,
          advertiser:     e.advertiser || null,
          served:         e.served === 'none' ? null : (e.advertiser || null),
          matchMethod:    e.matchMethod || null,
          matchCached:    !!e.matchCached,
          matchReason:    e.matchReason || null,
          matchCategory:  e.matchCategory || null,
          relevanceScore: e.relevanceScore || null,
        })),
        aggregate: {
          totalViewable: totalViewable,
          blendedVcpmGBP: blendedVcpm,
        },
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
        // NOTE: publisher "visits" intentionally removed from advertiser view.
        // Humans landing on the PUBLISHER page is a publisher/operator metric.
        // Advertisers care about impressions of THEIR creative + spend.
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
        campaign: currentCreative ? {
          advertiser: currentCreative.advertiser,
          category:   currentCreative.category,
          cpmGBP:     currentCreative.cpmGBP,
          text:       currentCreative.text,      // publisher sees what's injected on their pages
          advSlug:    currentCreative.advSlug,
        } : {
          advertiser: 'No active campaign',
          category:   '',
          cpmGBP:     null,
          text:       '',
          note:       'No campaign is currently winning the auction (none active, in-budget, and in-date).',
        },
        // Publisher sees the WINNING CPM and how many advertisers are competing —
        // not the itemised bid list (competitors' pricing stays private).
        auction: {
          competitorCount: eligibleCount,
          winningCPM:      currentCreative ? currentCreative.cpmGBP : null,
        },
        earnings: {
          estimatedGBP:    parseFloat((revenueGBP * 0.8).toFixed(4)),
          revenueSharePct: 80,
          grossGBP:        parseFloat(revenueGBP.toFixed(4)),
          vcpmGBP:         blendedVcpm,
        },
        traffic: {
          totalImpressions: impressions,
          viewableImpressions: totalViewable,
          today:            n(todayImpressions),
          fillRatePct:      fillRatePct,
          byPlatform:       platformTable,
        },
        clicks: {
          total:      pubClicks,
          unique:     uniqClicks,
          today:      n(todayPubClicks),
          // CTR only meaningful once real referrer clicks exist. Showing a
          // CTR computed from zero (or stale) clicks produced a misleading
          // 100% figure — suppress until there is genuine click data.
          overallCTR: pubClicks > 0 ? pct(pubClicks, impressions) : null,
          uniqueCTR:  uniqClicks > 0 ? pct(uniqClicks, impressions) : null,
        },
        recentVisits: (recentBotLogs || []).slice(0, 10),
      });
    }

    // ── OPERATOR VIEW (default) ─────────────────────────────────
    return res.status(200).json({
      _view: 'operator',
      campaigns: campaignList,
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
