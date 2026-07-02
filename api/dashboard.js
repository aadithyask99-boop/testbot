const { kvGet, kvSet, kvListGet, kvHashGetAll, kvIncrBy } = require('../lib/kv');
const { getCampaignSpend, TRAINING_BILL_RATIO } = require('../lib/auction');
const config = require('../lib/config');
const { listPages } = require('../lib/demo-pages');

const PUBLISHER_SHARE = 0.8;
const PLATFORM_SHARE  = 0.2;

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';

// Session 6: best-effort fetch of precompute coverage for the operator
// dashboard card. Failure is non-fatal — the card just shows nothing.
async function getPrecomputeStatus() {
  try {
    // Cache for 60 seconds — avoids recomputing on every 5s dashboard poll
    const { kvGet, kvSetWithTTL } = require('../lib/kv');
    const cached = await kvGet('precompute:meta:status-cache');
    if (cached && cached.cachedAt && (Date.now() - cached.cachedAt) < 60000) {
      return cached;
    }
    const resp = await fetch(`${PLATFORM_URL}/precompute?action=status`);
    if (!resp.ok) return null;
    const data = await resp.json();
    await kvSetWithTTL('precompute:meta:status-cache', { ...data, cachedAt: Date.now() }, 120);
    return data;
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
    // for servingIds).
    // Session 11 perf fix: this was ALSO a sequential `for` loop (one
    // kvGet per campaign, one at a time) — same bottleneck class as the
    // campaignList loop fixed below, and it re-fetches the exact same
    // campaign objects that loop fetches again moments later. Parallelized
    // here; the campaignList loop still does its own fetch afterward
    // (kept simple/independent rather than threading a cache through —
    // the redundant fetch is now at least concurrent, not sequential,
    // so it's no longer the dominant cost; a future pass could thread
    // this lookup's results through to avoid the second fetch entirely).
    const variantLookup = {};
    {
      const allIds = [];
      for (const cat of config.categories) {
        const cids = (await kvGet('campaigns:' + cat)) || [];
        allIds.push(...cids);
      }
      const uniqueIds = [...new Set(allIds)];
      const fetched = await Promise.all(uniqueIds.map(id => kvGet('campaign:' + id)));
      uniqueIds.forEach((id, i) => {
        const c = fetched[i];
        if (c) variantLookup[id] = c.variants || [];
      });
    }

    // Build latest-entry-per-URL maps from logs. Needed for pageBoard merge.
    const latestByUrl = {};
    for (const e of (recentBotLogs || [])) {
      const url = e.url || '/';
      if (!latestByUrl[url]) latestByUrl[url] = e; // logs are newest-first
    }

    const pageBoard = [];
    // Session 8: build the board from ALL known demo pages (listPages()),
    // not just pages that appear in log:recent. Pages that haven't been
    // crawled yet show as "not yet crawled" instead of being absent.
    const knownPages = listPages(); // [{path, slug, category, pubId, publisherName, title}]
    const knownPaths = new Set(knownPages.map(p => p.path));

    for (const kp of knownPages) {
      const logEntry = pageServingMap[kp.path]; // most recent SERVED entry
      const latestEntry = latestByUrl[kp.path]; // most recent entry (any outcome)

      if (logEntry) {
        // Page was crawled and served — full data available
        let variantText = null;
        if (logEntry.campaignId && logEntry.variantId) {
          const variants = variantLookup[logEntry.campaignId] || [];
          const v = variants.find(x => x.id === logEntry.variantId);
          variantText = (v && v.text) || null;
        }
        pageBoard.push({
          url: kp.path,
          title: kp.title || null,
          pubId: kp.pubId || logEntry.pubId || null,
          publisherName: kp.publisherName || null,
          category: logEntry.matchCategory || kp.category || null,
          servingId: logEntry.campaignId,
          servingAdv: logEntry.advertiser,
          servingCpmGBP: logEntry.cpmGBP || null,
          method: logEntry.matchMethod || null,
          cached: !!logEntry.matchCached,
          relevanceScore: logEntry.relevanceScore || null,
          variantId: logEntry.variantId || null,
          variantAngle: logEntry.variantAngle || null,
          variantMethod: logEntry.variantMethod || null,
          variantText,
          lastPlatform: logEntry.platform || null,
          lastCrawl: logEntry.time || null,
          candidates: logEntry.candidates || null,
          source: logEntry.source || 'demo',
        });
      } else if (latestEntry && latestEntry.served === 'none') {
        // Page was crawled but nothing served (off-topic, no budget, etc.)
        pageBoard.push({
          url: kp.path,
          title: kp.title || null,
          pubId: kp.pubId || latestEntry.pubId || null,
          publisherName: kp.publisherName || null,
          category: latestEntry.matchCategory || kp.category || null,
          servingId: null,
          servingAdv: null,
          method: latestEntry.matchMethod || null,
          reason: latestEntry.matchReason || null,
          lastPlatform: latestEntry.platform || null,
          lastCrawl: latestEntry.time || null,
          candidates: latestEntry.candidates || null,
          source: latestEntry.source || 'demo',
        });
      } else {
        // Page has never been crawled — show as pending
        pageBoard.push({
          url: kp.path,
          title: kp.title || null,
          pubId: kp.pubId || null,
          publisherName: kp.publisherName || null,
          category: kp.category || null,
          servingId: null,
          servingAdv: null,
          method: null,
          reason: 'not_yet_crawled',
          lastPlatform: null,
          lastCrawl: null,
          candidates: null,
        });
      }
    }

    // Also include any URLs from logs that aren't in the known demo pages
    // (Worker-proxied real publisher pages). Match by domain to publisher.
    const pubDomainMap = {};
    for (const pub of (config.publishers || [])) {
      for (const domain of (pub.domains || [])) {
        pubDomainMap[domain] = pub;
      }
    }

    for (const url of Object.keys(latestByUrl)) {
      if (knownPaths.has(url)) continue; // already handled above
      const e = latestByUrl[url];

      // Resolve publisher from URL domain or pubId on log entry
      let pubName = null;
      let resolvedPubId = e.pubId || null;
      try {
        const domain = new URL(url).hostname;
        const pub = pubDomainMap[domain];
        if (pub) { pubName = pub.name; resolvedPubId = resolvedPubId || pub.pubId; }
      } catch {}
      // Also resolve by pubId from log entry
      if (!pubName && resolvedPubId) {
        const pub = (config.publishers || []).find(p => p.pubId === resolvedPubId);
        if (pub) pubName = pub.name;
      }

      if (pageServingMap[url]) {
        const logEntry = pageServingMap[url];
        let variantText = null;
        if (logEntry.campaignId && logEntry.variantId) {
          const variants = variantLookup[logEntry.campaignId] || [];
          const v = variants.find(x => x.id === logEntry.variantId);
          variantText = (v && v.text) || null;
        }
        pageBoard.push({
          url, title: null, pubId: resolvedPubId, publisherName: pubName,
          category: logEntry.matchCategory || null,
          servingId: logEntry.campaignId, servingAdv: logEntry.advertiser,
          servingCpmGBP: logEntry.cpmGBP || null,
          method: logEntry.matchMethod || null, cached: !!logEntry.matchCached,
          relevanceScore: logEntry.relevanceScore || null,
          variantId: logEntry.variantId || null, variantAngle: logEntry.variantAngle || null,
          variantMethod: logEntry.variantMethod || null, variantText,
          lastPlatform: logEntry.platform || null, lastCrawl: logEntry.time || null,
          candidates: logEntry.candidates || null, source: logEntry.source || 'worker',
        });
      } else if (e.served === 'none') {
        pageBoard.push({
          url, title: null, pubId: resolvedPubId, publisherName: pubName,
          category: e.matchCategory || null,
          servingId: null, servingAdv: null,
          method: e.matchMethod || null, reason: e.matchReason || null,
          lastPlatform: e.platform || null, lastCrawl: e.time || null,
          candidates: e.candidates || null, source: e.source || 'worker',
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
    // revenueGBP is computed AFTER campaignList is built (summed across all campaigns).
    // campaignCPM kept for legacy publisher view calculations that need a single number.
    const campaignCPM  = ((currentCreative && currentCreative.cpmGBP) || 10);

    // ── SHARED CAMPAIGN LIST (auction order + serving badge) ──────
    // Built once, used by operator AND advertiser views. In the per-page
    // model there is no single winner: a campaign is "serving" if it's the
    // latest-served creative on ANY page. We derive that set from the real
    // page board (logs), never from a re-run auction.
    const servingIds = new Set(pageBoard.filter(p => p.servingId).map(p => p.servingId));
    const allCampaignIds = Object.keys(variantLookup);
    // Session 11 perf fix: this used to be a sequential `for` loop doing
    // 4 awaited KV round-trips PER campaign (kvGet, getCampaignSpend,
    // 2x kvHashGetAll) — with ~15 campaigns that's 60+ sequential network
    // round-trips before the response could even start assembling, which
    // is almost certainly the dominant cost behind "dropdown switch is
    // insanely slow" once campaign count grew past a handful. Diagnosed
    // by reading the loop directly, not by guessing — getCampaignSpend
    // itself was already correctly parallel internally (Promise.all over
    // its own 4 calls), so only the OUTER per-campaign loop needed fixing.
    // Fetch every campaign's data concurrently instead of one at a time.
    const campaignResults = await Promise.all(allCampaignIds.map(async (id) => {
      const c = await kvGet('campaign:' + id);
      if (!c) return null;
      const [spend, platHash, variantHash, trackTokens] = await Promise.all([
        getCampaignSpend(c),
        kvHashGetAll('stats:impr_by_camp_plat:' + c.id),
        kvHashGetAll('variant-impr:' + c.id),
        kvGet('track:list:' + c.id),
      ]);
      const dailyBudgetUsedPct = c.budgetDailyGBP ? Math.min(100, (spend.dailySpendGBP / c.budgetDailyGBP) * 100) : 0;
      const viewable = spend.retrievalTotal;
      const vcpm = viewable > 0 ? (spend.totalSpendGBP / viewable) * 1000 : 0;
      const platformBreakdown = Object.keys(platHash || {})
        .map(k => ({ platform: k, impressions: parseInt(platHash[k]) || 0 }))
        .filter(x => x.impressions > 0)
        .sort((a, b) => b.impressions - a.impressions);
      const variantTotal = Object.values(variantHash || {}).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
      const variantBreakdown = (c.variants || []).map(v => {
        const count = parseInt((variantHash || {})[v.id]) || 0;
        return {
          id: v.id,
          angle: v.angle,
          impressions: count,
          pct: variantTotal > 0 ? parseFloat(((count / variantTotal) * 100).toFixed(1)) : 0,
        };
      });

      // Track 1: click stats across all trackable links for this campaign
      const tokens = Array.isArray(trackTokens) ? trackTokens : [];
      const AI_PLATFORMS = ['Perplexity', 'ChatGPT', 'Grok', 'Claude', 'Gemini', 'Meta AI', 'Copilot'];
      let totalClicks = 0, aiClicks = 0;
      const trackLinks = await Promise.all(tokens.map(async token => {
        const [link, tot, platH] = await Promise.all([
          kvGet('track:' + token),
          kvGet('stats:track:' + token + ':total'),
          kvHashGetAll('stats:track:' + token + ':platform'),
        ]);
        if (!link) return null;
        const tc = parseInt(tot) || 0;
        const ai = AI_PLATFORMS.reduce((s, p) => s + (parseInt((platH || {})[p]) || 0), 0);
        totalClicks += tc;
        aiClicks += ai;
        return { token, label: link.label, dest: link.dest, active: link.active, totalClicks: tc, aiClicks: ai };
      }));

      return {
        id: c.id, advId: c.advId || null, advertiser: c.advertiser, category: c.category,
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
        todayImpressions: spend.dailyImpressions,
        platformBreakdown,
        variantBreakdown,
        viewableImpressions: viewable,
        trainingImpressions: spend.trainingTotal,
        vcpmGBP: parseFloat(vcpm.toFixed(2)),
        isWinner: servingIds.has(c.id),
        totalClicks,
        aiClicks,
        estimatedCTR: spend.totalImpressions > 0 ? parseFloat(((totalClicks / spend.totalImpressions) * 100).toFixed(2)) : 0,
        trackLinks: trackLinks.filter(Boolean),
        queryInsights: await (async () => {
          // Read raw conv_queries for last 7 days — no aggregate step needed.
          // Falls back to pre-aggregated query_insights if raw data is empty.
          const days = [];
          for (let i = 0; i < 7; i++) {
            days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
          }
          const rawEntries = [];
          await Promise.all(days.map(async d => {
            const entries = await kvGet('conv_queries:' + c.id + ':' + d);
            if (Array.isArray(entries)) rawEntries.push(...entries);
          }));
          if (rawEntries.length === 0) return null;
          const freq = {};
          for (const e of rawEntries) {
            const q = (e.query || '').toLowerCase().trim();
            if (q) freq[q] = (freq[q] || 0) + 1;
          }
          const topQueries = Object.entries(freq)
            .sort((a, b) => b[1] - a[1]).slice(0, 20)
            .map(([query, count]) => ({ query, count }));
          return { totalQueries: rawEntries.length, topQueries };
        })(),
        // Surface breakdown — where this campaign's ads actually appeared
        surfaceBreakdown: {
          crawler: { impressions: spend.retrievalTotal + spend.trainingTotal },
          conversational: { impressions: spend.conversationalTotal || 0 },
        },
      };
    }));
    const campaignList = campaignResults.filter(Boolean);
    // Auction order: active first, then CPM descending (the waterfall order)
    campaignList.sort((a, b) => (b.active - a.active) || (b.cpmGBP - a.cpmGBP));

    // ── CORRECT REVENUE COMPUTATION ────────────────────────────
    // Sum spend across ALL campaigns (each uses its own CPM rate).
    // This replaces the old single-campaignCPM approximation which was
    // wrong in a multi-campaign world. Source of truth: impression
    // counters × CPM, same formula as getCampaignSpend().
    // Publisher/platform split is applied on top.
    const grossRevenueGBP    = campaignList.reduce((s, c) => s + (c.totalSpendGBP || 0), 0);
    const revenueGBP         = grossRevenueGBP; // alias for legacy references below
    const platformRevenueGBP = grossRevenueGBP * PLATFORM_SHARE;
    const publisherRevenueGBP= grossRevenueGBP * PUBLISHER_SHARE;

    // Per-publisher revenue from KV (tenths-of-pence stored by recordImpression)
    // Read revenue:publisher:{pubId}:total for each publisher in config
    // Session 11 perf fix: parallelized (was sequential, same bottleneck
    // class as the campaignList loop above — small here since only 2
    // publishers exist today, but fixed for consistency and to not
    // reintroduce the pattern as publisher count grows).
    const pubRevenueMap = {};
    {
      const pubs = config.publishers || [];
      const raws = await Promise.all(pubs.map(pub => kvGet(`revenue:publisher:${pub.pubId}:total`)));
      pubs.forEach((pub, i) => {
        pubRevenueMap[pub.pubId] = (parseInt(raws[i]) || 0) / 1000; // tenths-of-pence → pounds
      });
    }

    // Per-advertiser billing from KV
    // Session 11 perf fix: parallelized — was sequential, one kvGet per
    // unique advertiser (up to 15), same bottleneck class as above.
    const advRevenueMap = {};
    {
      const uniqueAdvKeys = [...new Set(campaignList.map(c => c.advId || c.id))];
      const raws = await Promise.all(uniqueAdvKeys.map(advKey => kvGet(`revenue:advertiser:${advKey}:total`)));
      uniqueAdvKeys.forEach((advKey, i) => {
        advRevenueMap[advKey] = (parseInt(raws[i]) || 0) / 1000;
      });
    }

    // Platform retained from KV
    const platformRetainedRaw = await kvGet('revenue:platform:total');
    const platformRetainedKV  = (parseInt(platformRetainedRaw) || 0) / 1000;

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
      // Session 8: publisher/advertiser lists for account pickers
      const publisherList = (config.publishers || []).map(p => ({
        pubId: p.pubId, name: p.name,
      }));
      const advertiserList = [...new Set(campaignList.map(c => c.advertiser))].sort()
        .map(name => ({ name, campaigns: campaignList.filter(c => c.advertiser === name).length }));

      // Session 10 Batch 2: scope to a single advertiser if advId param given.
      // Used by /ui/advertiser/{slug} — the dedicated advertiser portal.
      const advId = (req.query && req.query.advId) || null;
      const scopedCampaigns = advId
        ? campaignList.filter(c => c.advId === advId)
        : campaignList;
      const scopedPageBoard = advId
        ? pageBoard.filter(p => scopedCampaigns.some(c => c.id === p.servingId))
        : pageBoard;

      // Recompute aggregate spend/viewable for this advertiser only
      const scopedGrossGBP = scopedCampaigns.reduce((s, c) => s + (c.totalSpendGBP || 0), 0);
      const scopedViewable = advId
        ? (recentBotLogs || []).filter(e =>
            e && e.crawlerType === 'retrieval' && e.campaignId &&
            scopedCampaigns.some(c => c.id === e.campaignId)
          ).length
        : totalViewable;
      const scopedVcpm = scopedViewable > 0
        ? parseFloat(((scopedGrossGBP / scopedViewable) * 1000).toFixed(2)) : 0;

      // Recent matches scoped to this advertiser's campaigns only
      const scopedCampaignIds = new Set(scopedCampaigns.map(c => c.id));

      // Session 11: optional further scoping to a SINGLE campaign within
      // this advertiser, for the multi-campaign dropdown in the Campaign
      // section. advId scoping still applies first (security boundary —
      // a campaignId outside this advId's set is ignored, not trusted).
      const campaignIdParam = (req.query && req.query.campaignId) || null;
      const filterCampaignIds = (campaignIdParam && scopedCampaignIds.has(campaignIdParam))
        ? new Set([campaignIdParam])
        : scopedCampaignIds;

      // Session 12: date-range chart data for spend/impressions bar charts.
      // Query params: days=7|30|60|90 (rolling window ending today)
      //   OR from=YYYY-MM-DD&to=YYYY-MM-DD (custom range, inclusive).
      // Reads real daily KV keys in parallel. Returns zeros for days with
      // no recorded data — honest, not fake.
      const daysParam = (req.query && req.query.days) ? parseInt(req.query.days) : null;
      const fromParam = (req.query && req.query.from) || null;
      const toParam   = (req.query && req.query.to)   || null;
      let advChartData = null;
      if (daysParam || (fromParam && toParam)) {
        const dateList = [];
        if (daysParam) {
          for (let i = daysParam - 1; i >= 0; i--) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - i);
            dateList.push(d.toISOString().slice(0, 10));
          }
        } else {
          const cur = new Date(fromParam + 'T00:00:00Z');
          const end = new Date(toParam   + 'T00:00:00Z');
          while (cur <= end && dateList.length < 365) {
            dateList.push(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
        const scopedCampIds = scopedCampaigns.map(c => c.id);
        advChartData = await Promise.all(dateList.map(async (date) => {
          const spendKey  = advId
            ? `revenue:advertiser:${advId}:date:${date}`
            : `revenue:gross:date:${date}`;
          const imprKeys  = scopedCampIds.map(id => `impr:retrieval:${id}:${date}`);
          const [spendRaw, ...imprRaws] = await Promise.all([
            kvGet(spendKey),
            ...imprKeys.map(k => kvGet(k)),
          ]);
          const spendGBP   = parseFloat(((parseInt(spendRaw) || 0) / 1000).toFixed(4));
          const impressions = imprRaws.reduce((s, v) => s + (parseInt(v) || 0), 0);
          return { date, spendGBP, impressions };
        }));
      }

      return res.status(200).json({
        _view: 'advertiser',
        scopedAdvId: advId,
        scopedCampaignId: (campaignIdParam && filterCampaignIds.has(campaignIdParam)) ? campaignIdParam : null,
        publishers: publisherList,
        advertisers: advertiserList,
        chartData: advChartData,
        // Per-page live board: what's actually serving on each page right now,
        // with the full candidate breakdown per resolved auction. Real logs.
        pageBoard: scopedPageBoard,
        campaigns: scopedCampaigns,
        // Session 3 diagnostic: surface match decisions at top level so the
        // dashboard's "Recent Match Decisions" table can read them directly.
        // Includes served AND unserved entries — the diagnostic value is
        // seeing WHY matching rejects things, not just successes.
        // Session 11: when campaignId is given, narrows further to that
        // single campaign's activity (used by the per-campaign Recent
        // Activity feed in the Campaign section's dropdown view).
        recentMatches: (recentBotLogs || [])
          .filter(e => !advId || (e.campaignId && filterCampaignIds.has(e.campaignId)))
          .slice(0, 15).map(e => {
          // Normalise URL — strip Worker proxy domain so dashboard shows
          // just the path (e.g. /articles/best-isa-2026.html) regardless
          // of whether impression came from demo path or real Worker.
          let displayUrl = e.url || null;
          try {
            if (displayUrl && displayUrl.startsWith('http')) {
              const u = new URL(displayUrl);
              displayUrl = u.pathname + (u.search || '');
            }
          } catch {}
          return ({
          time:           e.time,
          url:            displayUrl,
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
          pubId:          e.pubId || null,
          source:         e.source || null,
        });
        }),
        aggregate: {
          totalViewable: scopedViewable,
          blendedVcpmGBP: scopedVcpm,
        },
        campaign: scopedCampaigns.length > 0 ? {
          advertiser: scopedCampaigns[0].advertiser || 'Not set',
          text:       scopedCampaigns[0].variants?.[0]?.text || '',
          variantAngle: scopedCampaigns[0].variants?.[0]?.angle || null,
          link:       scopedCampaigns[0].link       || '',
          linkText:   scopedCampaigns[0].linkText   || '',
          advSlug:    scopedCampaigns[0].advSlug    || '',
          category:   scopedCampaigns[0].category   || '',
          cpmGBP:     scopedCampaigns[0].cpmGBP     || 0,
          updatedAt:  scopedCampaigns[0].updatedAt  || null,
        } : {
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
          total:       scopedCampaigns.reduce((s, c) => s + (c.impressions || 0), 0) || (advId ? 0 : impressions),
          today:       advId
            ? scopedCampaigns.reduce((s, c) => s + (c.todayImpressions || 0), 0)
            : n(todayImpressions),
          description: 'Times your brand message was served to an AI crawler',
          byPlatform:  advId ? [] : platformTable,
        },
        // NOTE: publisher "visits" intentionally removed from advertiser view.
        // Humans landing on the PUBLISHER page is a publisher/operator metric.
        // Advertisers care about impressions of THEIR creative + spend.
        spend: {
          estimatedTotalGBP: parseFloat(scopedGrossGBP.toFixed(4)),
          cpmGBP:            scopedCampaigns[0]?.cpmGBP || (cc && cc.cpmGBP) || 18,
          model:             'CPM charged on retrieval crawler impressions only',
        },
        verification: {
          selfTest: {
            command: 'curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" https://testbot-two-psi.vercel.app/',
            note: 'Your ad copy should appear as a plain paragraph in the HTML response.',
          },
          recentImpressions: (recentBotLogs || [])
            .filter(e => !advId || (e.campaignId && scopedCampaignIds.has(e.campaignId)))
            .slice(0, 10).map(e => ({
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
      const publisherList = (config.publishers || []).map(p => ({
        pubId: p.pubId, name: p.name,
      }));

      const pubId = (req.query && req.query.pubId) || null;

      // Per-publisher impression counts
      let pubImpressions = impressions;
      let pubTodayImpressions = n(todayImpressions);
      let pubPageBoard = pageBoard;
      let pubFillRatePct = fillRatePct;

      if (pubId) {
        const [pubTotalRaw, pubTodayRaw] = await Promise.all([
          kvGet('stats:impressions:pub:' + pubId + ':total'),
          kvGet('stats:impressions:pub:' + pubId + ':date:' + today),
        ]);
        pubImpressions     = n(pubTotalRaw);
        pubTodayImpressions= n(pubTodayRaw);
        pubPageBoard       = pageBoard.filter(p => p.pubId === pubId);
        const pubServed    = pubPageBoard.filter(p => p.servingId).length;
        pubFillRatePct     = pubPageBoard.length > 0
          ? Math.round((pubServed / pubPageBoard.length) * 100) : null;
      }

      // Correct publisher earnings: from KV tenths-of-pence counters
      const kvEarnedGBP = pubId ? (pubRevenueMap[pubId] || 0) : publisherRevenueGBP;
      const kvEarnedTodayRaw = pubId
        ? await kvGet(`revenue:publisher:${pubId}:date:${today}`) : null;
      const kvEarnedTodayGBP = pubId ? (parseInt(kvEarnedTodayRaw) || 0) / 1000 : 0;

      // Publisher vCPM — use KV impression count scoped to this publisher
      // NOT the global log-derived viewable count (wrong denominator)
      const pubVcpmGBP = pubImpressions > 0
        ? parseFloat(((kvEarnedGBP / pubImpressions) * 1000).toFixed(2)) : 0;

      // Per-page breakdown: what's serving on each page, which advertiser, which variant
      const pubPagesTable = pubPageBoard.map(p => {
        const servingCampaign = p.servingId
          ? campaignList.find(c => c.id === p.servingId) : null;
        // Resolve the served variant text
        let servedVariantText  = null;
        let servedVariantAngle = null;
        if (servingCampaign && p.variantId) {
          const v = (servingCampaign.variants || []).find(vv => vv.id === p.variantId);
          servedVariantText  = v ? v.text  : null;
          servedVariantAngle = v ? v.angle : null;
        }
        return {
          url:              p.url,
          title:            p.title || null,
          advertiser:       p.servingId ? (servingCampaign && servingCampaign.advertiser) || 'Unknown' : null,
          campaignId:       p.servingId || null,
          cpmGBP:           p.servingCpmGBP || null,
          variantAngle:     servedVariantAngle,
          variantText:      servedVariantText,
          lastCrawl:        p.lastCrawl || null,
          lastPlatform:     p.lastPlatform || null,
          matchMethod:      p.matchMethod || null,
          serving:          !!p.servingId,
        };
      });

      const pubViewable = pubId
        ? (recentBotLogs || []).filter(e =>
            e && e.pubId === pubId &&
            e.crawlerType === 'retrieval' && e.campaignId
          ).length
        : totalViewable;

      const pubUrls = new Set(pubPageBoard.map(p => p.url));
      const pubRecentVisits = (recentBotLogs || [])
        .filter(e => !pubId || pubUrls.has(e.url || '/'))
        .slice(0, 10);

      // Gross revenue on this publisher's pages (back-calc from publisher share)
      const pubGrossGBP = pubId
        ? kvEarnedGBP / PUBLISHER_SHARE
        : grossRevenueGBP;

      // Session 12: date-range chart data for publisher revenue/impressions charts.
      // Same days/from/to query params as the advertiser view.
      let pubChartData = null;
      const pubDaysParam = (req.query && req.query.days) ? parseInt(req.query.days) : null;
      const pubFromParam = (req.query && req.query.from) || null;
      const pubToParam   = (req.query && req.query.to)   || null;
      if (pubDaysParam || (pubFromParam && pubToParam)) {
        const dateList = [];
        if (pubDaysParam) {
          for (let i = pubDaysParam - 1; i >= 0; i--) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - i);
            dateList.push(d.toISOString().slice(0, 10));
          }
        } else {
          const cur = new Date(pubFromParam + 'T00:00:00Z');
          const end = new Date(pubToParam   + 'T00:00:00Z');
          while (cur <= end && dateList.length < 365) {
            dateList.push(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
        pubChartData = await Promise.all(dateList.map(async (date) => {
          const [revenueRaw, imprRaw] = await Promise.all([
            pubId
              ? kvGet(`revenue:publisher:${pubId}:date:${date}`)
              : kvGet(`revenue:gross:date:${date}`),
            pubId
              ? kvGet(`stats:impressions:pub:${pubId}:date:${date}`)
              : kvGet(`stats:impressions:date:${date}`),
          ]);
          const revenueGBP  = parseFloat(((parseInt(revenueRaw) || 0) / 1000).toFixed(4));
          const impressions = parseInt(imprRaw) || 0;
          return { date, revenueGBP, impressions };
        }));
      }

      return res.status(200).json({
        _view: 'publisher',
        publishers: publisherList,
        pageBoard: pubPageBoard,
        chartData: pubChartData,
        // Per-page breakdown replaces single "winning creative" — each page
        // runs its own auction so there is no single winner for the site
        pages: pubPagesTable,
        earnings: {
          // What the publisher actually earns (80% of gross spend on their pages)
          estimatedGBP:     parseFloat(kvEarnedGBP.toFixed(4)),
          estimatedTodayGBP:parseFloat(kvEarnedTodayGBP.toFixed(4)),
          revenueSharePct:  80,
          // Gross for context (what advertisers paid before split)
          grossGBP:         parseFloat(pubGrossGBP.toFixed(4)),
          vcpmGBP:          pubVcpmGBP,
          note: 'Your 80% share of gross CPM spend on your pages. Payouts processed monthly.',
        },
        auction: {
          competitorCount: eligibleCount,
          activePages:     pubPagesTable.filter(p => p.serving).length,
          totalPages:      pubPagesTable.length,
          fillRatePct:     pubFillRatePct,
        },
        traffic: {
          totalImpressions:    pubImpressions,
          viewableImpressions: pubId ? pubViewable : totalViewable,
          today:               pubTodayImpressions,
          fillRatePct:         pubFillRatePct,
          byPlatform:          platformTable,
        },
        clicks: {
          total:      pubClicks,
          unique:     uniqClicks,
          today:      n(todayPubClicks),
          overallCTR: pubClicks > 0 ? pct(pubClicks, pubImpressions) : null,
          uniqueCTR:  uniqClicks > 0 ? pct(uniqClicks, pubImpressions) : null,
        },
        recentVisits: pubRecentVisits,
        chatInsights: await (async () => {
          // Track 3: Query Insights for this publisher
          // Aggregate matched queries across all campaigns for this pub
          const today = new Date().toISOString().slice(0, 10);
          let totalQueries = 0, matchedQueries = 0;
          const topQueriesMap = {};
          const unmatchedRaw = [];
          // Matched queries: from conv_queries:{campaignId}:{date} where pubId matches
          for (const camp of campaignList) {
            for (let i = 0; i < 7; i++) {
              const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
              const entries = (await kvGet('conv_queries:' + camp.id + ':' + d)) || [];
              if (!Array.isArray(entries)) continue;
              const pubEntries = entries.filter(e => !pubId || e.pubId === pubId);
              for (const e of pubEntries) {
                totalQueries++;
                matchedQueries++;
                const q = (e.query || '').toLowerCase().trim();
                if (q) topQueriesMap[q] = (topQueriesMap[q] || 0) + 1;
              }
            }
          }
          // Unmatched queries for this publisher
          for (let i = 0; i < 7; i++) {
            const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
            const entries = (await kvGet('conv_unmatched:' + pubId + ':' + d)) || [];
            if (Array.isArray(entries)) {
              unmatchedRaw.push(...entries);
              totalQueries += entries.length;
            }
          }
          const topQueries = Object.entries(topQueriesMap)
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([query, count]) => ({ query, count }));
          const unmatchedQueries = unmatchedRaw.slice(0, 10);
          // Conversational revenue for this publisher (last 7 days)
          let convRevenueGBP = 0;
          for (let i = 0; i < 7; i++) {
            const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
            const v = parseInt(await kvGet('revenue:publisher:' + pubId + ':date:' + d)) || 0;
            convRevenueGBP += v;
          }
          return { totalQueries, matchedQueries, topQueries, unmatchedQueries, revenueGBP: parseFloat((convRevenueGBP / 1000).toFixed(4)) };
        })(),
      });
    }

    // ── OPERATOR VIEW (default) ─────────────────────────────────
    // Session 8: include publisher/advertiser lists for account pickers
    const publisherList = (config.publishers || []).map(p => ({
      pubId: p.pubId, name: p.name, active: p.active !== false,
    }));
    const advertiserList = [...new Set(campaignList.map(c => c.advertiser))].sort()
      .map(name => ({ name, campaigns: campaignList.filter(c => c.advertiser === name).length }));

    return res.status(200).json({
      _view: 'operator',
      pageBoard,
      campaigns: campaignList,
      publishers: publisherList,
      advertisers: advertiserList,
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
        grossGBP:          parseFloat(grossRevenueGBP.toFixed(4)),
        publisherShare80:  parseFloat(publisherRevenueGBP.toFixed(4)),
        platformShare20:   parseFloat(platformRevenueGBP.toFixed(4)),
        // KV-tracked retained (from recordImpression pence counters — source of truth for real money)
        platformRetainedKV: parseFloat(platformRetainedKV.toFixed(4)),
        // Per-publisher breakdown
        byPublisher: (config.publishers || []).map(pub => ({
          pubId:    pub.pubId,
          name:     pub.name,
          earnedGBP: parseFloat((pubRevenueMap[pub.pubId] || 0).toFixed(4)),
        })),
        // Per-advertiser billing
        byAdvertiser: campaignList.map(c => ({
          campaignId:  c.id,
          advertiser:  c.advertiser,
          billedGBP:   parseFloat((c.totalSpendGBP || 0).toFixed(4)),
          billedKVGBP: parseFloat((advRevenueMap[c.advId || c.id] || 0).toFixed(4)),
        })).filter(x => x.billedGBP > 0 || x.billedKVGBP > 0),
      },
      platformBreakdown:  platformTable,
      recentImpressions:  (recentBotLogs || []).slice(0, 20),
      recentPubClicks:    (recentPubClicks || []).slice(0, 10),
      recentAdvClicks:    (recentAdvClicks || []).slice(0, 10),
      precompute:         (() => {
        // Inline from already-fetched recentBotLogs — no extra KV or HTTP call
        const seen = new Set();
        let covered = 0;
        const pages = [];
        for (const e of (recentBotLogs || [])) {
          if (!e.url || seen.has(e.url)) continue;
          seen.add(e.url);
          const fresh = !!(e.matchCategory);
          if (fresh) covered++;
          pages.push({ path: e.url, category: e.matchCategory || null, fresh });
        }
        const pagesTotal = pages.length;
        return {
          pagesTotal,
          covered,
          coveragePct: pagesTotal ? parseFloat(((covered / pagesTotal) * 100).toFixed(1)) : 0,
          pages,
        };
      })(),
    });

  } catch (e) {
    res.status(500).json({ error: 'Dashboard unavailable', message: e.message });
  }
};

// redeploy 22:27:44
