// ============================================================
// PRECOMPUTE — Session 6
// ============================================================
// Proactively warms the classification cache (Layers 0-3 of
// lib/relevance.js, via classifyOnly) for known pages, so the
// FIRST real bot crawl on any page is always a cache hit for
// category classification. Does NOT run the auction or select
// variants — those stay live (Layers 4-6), since campaigns and
// budgets change far more often than a page's topic does.
//
// See PRECOMPUTE_SPEC.md for the full design.
//
// Actions:
//   GET  /precompute?action=sweep      — classify any page whose
//                                          precompute: entry is
//                                          missing or >24h old.
//                                          Cron target (daily).
//   GET  /precompute?action=status     — coverage report for the
//                                          dashboard.
//   POST /precompute?action=invalidate — called by admin.js after
//                                          a campaign save/pause/
//                                          delete. Deletes the
//                                          relevance-filter and
//                                          variant caches for every
//                                          known page + the edited
//                                          campaign, so the next
//                                          crawl (or sweep) re-runs
//                                          Layers 4-6 with fresh
//                                          campaign data. Category
//                                          classification (match:/
//                                          precompute:) is NOT
//                                          touched — a page's TOPIC
//                                          doesn't change when a
//                                          campaign is edited.
// ============================================================

const crypto = require('crypto');
const { kvGet, kvSetWithTTL, kvDel } = require('../lib/kv');
const { classifyOnly, CACHE_TTL_SECONDS } = require('../lib/relevance');
const { listPaths, getPage } = require('../lib/demo-pages');
const config = require('../lib/config');

const SITE_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';
const STALE_MS = CACHE_TTL_SECONDS * 1000; // 24h — same lifetime as match:/precompute:

// Build the same pageSignals shape api/index.js builds for a live crawl.
function buildPageSignals(path) {
  const page = getPage(path);
  if (!page) return null;
  const allParas = [...((page.body || '').matchAll(/<p>([\s\S]*?)<\/p>/g))]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const firstParagraph = (allParas[0] || '').slice(0, 500);
  const bodySample = allParas.join(' ').slice(0, 1500);
  return {
    url: SITE_URL + (page.path || path),
    title: page.title,
    metaDescription: page.metaDescription,
    firstParagraph,
    bodySample,
    publisherCategory: null,
    precomputeSource: 'cron',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const action = (req.query && req.query.action) ||
    new URLSearchParams(url.split('?')[1] || '').get('action');

  // --------------------------------------------------------
  // SWEEP — classify any page that's missing or stale.
  // --------------------------------------------------------
  if (req.method === 'GET' && action === 'sweep') {
    const paths = listPaths();
    let classified = 0, skipped = 0;
    const errors = [];
    const results = [];

    for (const path of paths) {
      try {
        const signals = buildPageSignals(path);
        if (!signals) { errors.push({ path, error: 'no page data' }); continue; }

        const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(signals.url).digest('hex');
        const existing = await kvGet(precomputeKey);
        const isFresh = existing && existing.classifiedAt && (Date.now() - existing.classifiedAt) < STALE_MS;

        if (isFresh) {
          skipped++;
          results.push({ path, status: 'skipped', category: existing.category, age_h: ((Date.now() - existing.classifiedAt) / 3600000).toFixed(1) });
          continue;
        }

        const result = await classifyOnly(signals);
        classified++;
        results.push({ path, status: 'classified', category: result.category, method: result.method });
      } catch (e) {
        errors.push({ path, error: e.message });
      }
    }

    // Record sweep metadata for the status endpoint / dashboard card.
    try {
      await kvSetWithTTL('precompute:meta:last-sweep', {
        time: Date.now(),
        classified, skipped, errors: errors.length,
      }, CACHE_TTL_SECONDS * 7); // keep meta around longer than individual entries
    } catch (e) { /* non-fatal */ }

    return res.status(200).json({
      message: 'Sweep complete',
      pagesTotal: paths.length,
      classified, skipped,
      errors,
      results,
    });
  }

  // --------------------------------------------------------
  // STATUS — coverage report for the dashboard.
  // --------------------------------------------------------
  if (req.method === 'GET' && action === 'status') {
    const paths = listPaths();
    const pages = [];
    let covered = 0;

    for (const path of paths) {
      const page = getPage(path);
      const fullUrl = SITE_URL + (page.path || path);
      const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(fullUrl).digest('hex');
      const entry = await kvGet(precomputeKey);
      const isFresh = entry && entry.classifiedAt && (Date.now() - entry.classifiedAt) < STALE_MS;
      if (isFresh) covered++;
      pages.push({
        path,
        category: (entry && entry.category) || null,
        method: (entry && entry.method) || null,
        source: (entry && entry.source) || null,
        classifiedAt: (entry && entry.classifiedAt) || null,
        fresh: !!isFresh,
      });
    }

    const lastSweep = await kvGet('precompute:meta:last-sweep');

    return res.status(200).json({
      pagesTotal: paths.length,
      covered,
      coveragePct: paths.length ? parseFloat(((covered / paths.length) * 100).toFixed(1)) : 0,
      lastSweep: lastSweep || null,
      pages,
    });
  }

  // --------------------------------------------------------
  // INVALIDATE — called by admin.js after a campaign save/pause/
  // delete. Deletes match-rel: and variant: cache entries for the
  // edited campaign across every known page, so the next crawl
  // re-runs the relevance filter and variant selection with fresh
  // campaign data. Category classification (match:/precompute:) is
  // intentionally left alone.
  //
  // The match-rel: cache key is built from the page's URL plus the
  // SORTED, JOINED IDs of campaigns that survive the keyword
  // pre-filter for that page (lib/relevance.js, runAuctionForCategory,
  // "STAGE 1: keyword pre-filter") — NOT simply every campaign in the
  // category. To delete the right key we have to replicate that
  // pre-filter here using the SAME scoreCampaignRelevance +
  // RELEVANCE_THRESHOLD the live path uses.
  // --------------------------------------------------------
  if (req.method === 'POST' && action === 'invalidate') {
    let body = '';
    await new Promise(resolve => {
      req.on('data', chunk => body += chunk);
      req.on('end', resolve);
    });
    let data;
    try { data = JSON.parse(body || '{}'); } catch { data = {}; }

    const { campaignId, category } = data;
    if (!campaignId) {
      return res.status(400).json({ error: 'campaignId is required' });
    }

    const { scoreCampaignRelevance, RELEVANCE_THRESHOLD } = require('../lib/relevance');
    const paths = listPaths();
    const deleted = [];

    for (const path of paths) {
      const page = getPage(path);
      const fullUrl = SITE_URL + (page.path || path);
      const pageCat = page.category;

      // variant: cache is keyed on url|campaignId — always delete for
      // this specific campaign, regardless of category (cheap, and the
      // campaign's category may itself have just changed).
      const variantKey = 'variant:' + crypto.createHash('sha256').update(fullUrl + '|' + campaignId).digest('hex');
      try {
        await kvDel(variantKey);
        deleted.push(variantKey);
      } catch (e) { /* non-fatal */ }

      // match-rel: cache — only relevant if this page's category matches
      // the campaign's category (or no category filter given). Replicate
      // the keyword pre-filter to get the SAME candidate-set hash the
      // live path would compute, so we delete the actual cached entry.
      if (!category || category === pageCat) {
        try {
          const ids = (await kvGet('campaigns:' + pageCat)) || [];
          const allCampaigns = (await Promise.all(ids.map(id => kvGet('campaign:' + id))))
            .filter(c => c && c.active);
          const pageSignals = buildPageSignals(path) || { url: fullUrl };
          const survivors = allCampaigns
            .filter(c => scoreCampaignRelevance(c, pageSignals) >= RELEVANCE_THRESHOLD)
            .map(c => c.id).sort().join(',');
          const relKey = 'match-rel:' + crypto.createHash('sha256').update(fullUrl + '|' + survivors).digest('hex');
          await kvDel(relKey);
          deleted.push(relKey);
        } catch (e) { /* non-fatal */ }
      }
    }

    return res.status(200).json({ message: 'Invalidated', campaignId, category: category || null, keysDeleted: deleted.length });
  }

  return res.status(400).json({
    error: 'Unknown or missing action',
    validActions: ['sweep (GET)', 'status (GET)', 'invalidate (POST)'],
  });
};
