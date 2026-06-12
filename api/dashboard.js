const { kvGet, kvSet, kvListGet, kvHashGetAll } = require('../lib/kv');
const { getCampaignSpend } = require('../lib/auction');
const config = require('../lib/config');

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';

// Session 6: best-effort fetch of precompute coverage for the operator
// dashboard card. Failure is non-fatal — the card just shows nothing.
async function getPrecomputeStatus() {
  try {
    const resp = await fetch(`${PLATFORM_URL}/precompute?action=status`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

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
      kvHashGetAll('stats:impr_by_platform'),
      kvHashGetAll('stats:click_by_platform'),
      kvHashGetAll('stats:uniq_click_by_platform'),
      kvGet('stats:bot_visits:total'),
      kvGet('stats:bot_served:total'),
    ]);

    // ── PER-PAGE SERVING STATE (Option A — derived from real logs) ──
    // There is NO single "current winner". Each page runs its own auction
    // at crawl time. We reconstruct what's actually serving per URL from
    // the most recent SERVED log entry for that URL. The dashboard never
    // re-runs the auction — it reports what genuinely happened.
    const servedLogs = (recentBotLogs || []).filter(e => e && e.campaignId && e.served !== 'none');
    const pageServingMap = {};   // url -> most recent served log entry
    for (const e of servedLogs) {
      const url = e.url || '/';
      if (!pageServingMap[url]) pageServingMap[url] = e; // logs are newest-first
    }
    // Build the per-page board: every page seen in logs, with its latest
    // resolved auction (winner + full candidate breakdown + method + when).
    // Lightweight campaign->variants lookup, built BEFORE pageBoard (which
    // needs it) and BEFORE the full campaignList (which depends on pageBoard
    // for servingIds). Just id -> variants[], cheap (one kvGet per campaign,
    // already cached by the runtime within this request — same kvGet calls
    // the full campaignList loop makes again below for the rest of the
    // campaign fields).
    const variantLookup = {};
    {
      const allIds = [];
      for (const cat of config.categories) {
        const cids = (await kvGet('campaigns:' + cat)) || [];
        allIds.push(...cids);
      }
      for (const id of [...new Set(allIds)]) {
        const c = await kvGet('campaign:' + id);
        if (c) variantLookup[id] = c.variants || [];
      }
    }

    const pageBoard = Object.keys(pageServingMap).map(url => {
      const e = pageServingMap[url];
      // Resolve the actual served creative text for the Live Auction Board —
      // look up the campaign that won and find the variant that was selected,
      // so the board shows WHAT was injected, not just who won.
      let variantText = null;
      if (e.campaignId && e.variantId) {
        const variants = variantLookup[e.campaignId] || [];
        const v = variants.find(x => x.id === e.variantId);
        variantText = (v && v.text) || null;
      }
      return {
        url,
        category:       e.matchCategory || null,
        servingId:      e.campaignId,
        servingAdv:     e.advertiser,
        servingCpmGBP:  e.cpmGBP || null,
        method:         e.matchMethod || null,
        cached:         !!e.matchCached,
        relevanceScore: e.relevanceScore || null,
        variantId:      e.variantId || null,
        variantAngle:   e.variantAngle || null,
        variantMethod:  e.variantMethod || null,
        variantText,
        lastPlatform:   e.platform || null,
        lastCrawl:      e.time || null,
        candidates:     e.candidates || null,
      };
    });
    // Also capture pages where the latest crawl served NOTHING (strict mode,
    // off-topic, all over budget) so the board shows them honestly too.
    const latestByUrl = {};
    for (const e of (recentBotLogs || [])) {
      const url = e.url || '/';
      if (!latestByUrl[url]) latestByUrl[url] = e;
    }
    for (const url of Object.keys(latestByUrl)) {
      const e = latestByUrl[url];
      if (e.served === 'none' && !pageServingMap[url]) {
        pageBoard.push({
          url,
          category:      e.matchCategory || null,
          servingId:     null,
          servingAdv:    null,
          method:        e.matchMethod || null,
          reason:        e.matchReason || null,
          lastPlatform:  e.platform || null,
          lastCrawl:     e.time || null,
          candidates:    e.candidates || null,
        });
      }
    }

    // currentCreative is now derived from the SINGLE most-recent served
    // impression across all pages — used only for legacy aggregate displays
    // (headline CPM estimate, publisher "what's injected" sample). It is NOT
    // a re-run auction. When multiple pages serve different ads, this simply
    // reflects the most recent one; the per-page board shows the full truth.
    const currentCreative = servedLogs.length > 0
      ? {
          id:           servedLogs[0].campaignId,
          advertiser:   servedLogs[0].advertiser,
          cpmGBP:       servedLogs[0].cpmGBP,
          category:     servedLogs[0].matchCategory,
          variantId:    servedLogs[0].variantId || null,
          variantAngle: servedLogs[0].variantAngle || null,
        }
      : null;

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

    // ── SHARED CAMPAIGN LIST (auction order + serving badge) ──────
    // Built once, used by operator AND advertiser views. In the per-page
    // model there is no single winner: a campaign is "serving" if it's the
    // latest-served creative on ANY page. We derive that set from the real
    // page board (logs), never from a re-run auction.
    const servingIds = new Set(pageBoard.filter(p => p.servingId).map(p => p.servingId));
    const allCampaignIds = Object.keys(variantLookup);
    const campaignList = [];
    for (const id of allCampaignIds) {
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
      // Session 5: per-variant impression breakdown — "your 'first-home'
      // angle wins X% of the time" view in the campaign detail panel.
      const variantHash = (await kvHashGetAll('variant-impr:' + c.id)) || {};
      const variantTotal = Object.values(variantHash).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
      const variantBreakdown = (c.variants || []).map(v => {
        const count = parseInt(variantHash[v.id]) || 0;
        return {
          id: v.id,
          angle: v.angle,
          impressions: count,
          pct: variantTotal > 0 ? parseFloat(((count / variantTotal) * 100).toFixed(1)) : 0,
        };
      });
      campaignList.push({
        id: c.id, advertiser: c.advertiser, category: c.category,
        cpmGBP: c.cpmGBP, active: c.active === true,
        budgetDailyGBP: c.budgetDailyGBP, budgetTotalGBP: c.budgetTotalGBP,
        keywords: c.keywords || [],
        variants: c.variants || [], link: c.link, linkText: c.linkText, advSlug: c.advSlug,
        matchingDescription: c.matchingDescription || '',
        startDate: c.startDate, endDate: c.endDate, updatedAt: c.updatedAt,
        dailySpendGBP: parseFloat(spend.dailySpendGBP.toFixed(4)),
        totalSpendGBP: parseFloat(spend.totalSpendGBP.toFixed(4)),
        dailyBudgetUsedPct: parseFloat(dailyBudgetUsedPct.toFixed(1)),
        impressions: spend.totalImpressions,
        platformBreakdown,
        variantBreakdown,
        viewableImpressions: viewable,
        trainingImpressions: spend.trainingTotal,
        vcpmGBP: parseFloat(vcpm.toFixed(2)),
        isWinner: servingIds.has(c.id),
      });
    }
    // Auction order: active first, then CPM descending (the waterfall order)
    campaignList.sort((a, b) => (b.active - a.active) || (b.cpmGBP - a.cpmGBP));

    // Enrich the log-derived currentCreative with full campaign fields
    // (text, link, advSlug) so the publisher "what's injected" sample works.
    // Still log-derived — we look up the campaign that ACTUALLY served, not
    // a re-run auction winner.
    let currentCreativeFull = null;
    if (currentCreative && currentCreative.id) {
      const match = campaignList.find(c => c.id === currentCreative.id);
      if (match) {
        // Resolve the SPECIFIC variant that was actually served (from the log),
        // not just the campaign's first variant — "what's injected" must
        // reflect reality. Falls back to the first variant if the logged
        // variantId no longer exists (campaign edited since).
        const servedVariant =
          (match.variants || []).find(v => v.id === currentCreative.variantId) ||
          (match.variants || [])[0] ||
          null;
        currentCreativeFull = {
          id: match.id, advertiser: match.advertiser, category: match.category,
          cpmGBP: match.cpmGBP,
          text: (servedVariant && servedVariant.text) || '',
          variantId: (servedVariant && servedVariant.id) || null,
          variantAngle: (servedVariant && servedVariant.angle) || null,
          link: match.link,
          linkText: match.linkText, advSlug: match.advSlug, updatedAt: match.updatedAt,
        };
      }
    }
    // Use the enriched version everywhere currentCreative was referenced.
    const cc = currentCreativeFull || currentCreative;

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
        // Per-page live board: what's actually serving on each page right now,
        // with the full candidate breakdown per resolved auction. Real logs.
        pageBoard,
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
          variantId:      e.variantId || null,
          variantAngle:   e.variantAngle || null,
        })),
        aggregate: {
          totalViewable: totalViewable,
          blendedVcpmGBP: blendedVcpm,
        },
        campaign: {
          advertiser: (cc && cc.advertiser) || 'Not set',
          text:       (cc && cc.text)       || '',
          variantAngle: (cc && cc.variantAngle) || null,
          link:       (cc && cc.link)       || '',
          linkText:   (cc && cc.linkText)   || '',
          advSlug:    (cc && cc.advSlug)    || '',
          category:   (cc && cc.category)   || '',
          cpmGBP:     (cc && cc.cpmGBP)     || 0,
          updatedAt:  (cc && cc.updatedAt)  || null,
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
          cpmGBP:            (cc && cc.cpmGBP) || 18,
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
        campaign: cc ? {
          advertiser: cc.advertiser,
          category:   cc.category,
          cpmGBP:     cc.cpmGBP,
          text:       cc.text,      // publisher sees what's injected on their pages
          advSlug:    cc.advSlug,
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
          winningCPM:      cc ? cc.cpmGBP : null,
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
      pageBoard,
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
      precompute:         await getPrecomputeStatus(),
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};
