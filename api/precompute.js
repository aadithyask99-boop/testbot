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
const { kvGet, kvSet, kvSetWithTTL, kvDel } = require('../lib/kv');
const { classifyOnly, CACHE_TTL_SECONDS } = require('../lib/relevance');
const { listPaths, getPage } = require('../lib/demo-pages');
const config = require('../lib/config');

const SITE_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';
const STALE_MS = CACHE_TTL_SECONDS * 1000;

// --------------------------------------------------------
// Sitemap-driven URL discovery (Session 9)
// --------------------------------------------------------
// Fetches and parses a sitemap.xml, extracting all <loc> URLs.
// Returns array of { url, path, pubId } objects.
// Falls back to [] on any fetch/parse error (non-fatal).
async function fetchSitemapUrls(sitemapUrl, pubId) {
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'boop-precompute/1.0' },
      // 5 second timeout via AbortController
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    // Extract all <loc>...</loc> entries
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1].trim());
    return locs.map(url => {
      try {
        const parsed = new URL(url);
        return { url, path: parsed.pathname || '/', pubId };
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    console.error('fetchSitemapUrls failed for', sitemapUrl, e.message);
    return [];
  }
}

// Aggregate URLs from all registered publisher sitemaps.
// Deduplicates by URL. Returns [{ url, path, pubId }].
async function fetchAllPublisherUrls() {
  const publishers = config.publishers || [];
  if (!publishers.length) {
    // Fallback: use hardcoded demo-pages list
    return listPaths().map(path => ({ url: SITE_URL + path, path, pubId: null }));
  }

  const seen = new Set();
  const results = [];
  for (const pub of publishers) {
    if (!pub.active || !pub.sitemapUrl) continue;
    const urls = await fetchSitemapUrls(pub.sitemapUrl, pub.pubId);
    for (const entry of urls) {
      if (!seen.has(entry.url)) {
        seen.add(entry.url);
        results.push(entry);
      }
    }
  }

  // If sitemap fetch returned nothing, fall back to hardcoded list
  if (!results.length) {
    return listPaths().map(path => ({ url: SITE_URL + path, path, pubId: null }));
  }
  return results;
}

// Build pageSignals for a URL.
// For known demo pages: uses local page object (fast, no network).
// For remote publisher pages: fetches the URL and extracts signals.
async function buildPageSignals(urlOrPath, pubId) {
  // Try local demo page first (path lookup)
  const pathOnly = urlOrPath.startsWith('http')
    ? (() => { try { return new URL(urlOrPath).pathname; } catch { return urlOrPath; } })()
    : urlOrPath;
  const page = getPage(pathOnly);

  if (page) {
    // Local demo page — fast path, no network
    const allParas = [...((page.body || '').matchAll(/<p>([\s\S]*?)<\/p>/g))]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const firstParagraph = (allParas[0] || '').slice(0, 500);
    const bodySample = allParas.join(' ').slice(0, 1500);
    return {
      url: SITE_URL + (page.path || pathOnly),
      title: page.title,
      metaDescription: page.metaDescription,
      firstParagraph,
      bodySample,
      publisherCategory: null,
      precomputeSource: 'cron',
      pubId: page.pubId || pubId || null,
    };
  }

  // Remote publisher page — fetch and extract signals
  const fullUrl = urlOrPath.startsWith('http') ? urlOrPath : SITE_URL + urlOrPath;
  try {
    const resp = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'boop-precompute/1.0',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDescription = metaMatch ? metaMatch[1].trim() : '';

    // Extract paragraph text (strip tags)
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 30); // skip short/empty paragraphs
    const firstParagraph = (paras[0] || '').slice(0, 500);
    const bodySample = paras.join(' ').slice(0, 1500);

    return {
      url: fullUrl,
      title,
      metaDescription,
      firstParagraph,
      bodySample,
      publisherCategory: null,
      precomputeSource: 'sitemap',
      pubId: pubId || null,
    };
  } catch (e) {
    console.error('buildPageSignals fetch failed for', fullUrl, e.message);
    return null;
  }
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
    // Session 9: fetch URLs from publisher sitemaps.
    // NOTE: Vercel Hobby plan restricts outbound HTTP to unlisted domains,
    // so we cannot fetch remote publisher page HTML from within the sweep.
    // Instead: check if each URL has already been classified by a live
    // Worker hit (cached in precompute:{hash} by /match). Mark uncached
    // pages as pending — they will be classified on first real bot crawl.
    const urlEntries = await fetchAllPublisherUrls();
    let classified = 0, skipped = 0;
    const errors = [];
    const results = [];

    for (const entry of urlEntries) {
      const { url, path } = entry;
      try {
        const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(url).digest('hex');
        const existing = await kvGet(precomputeKey);
        const isFresh = existing && existing.classifiedAt && (Date.now() - existing.classifiedAt) < STALE_MS;

        if (isFresh) {
          skipped++;
          results.push({ path: path || url, status: 'skipped', category: existing.category, age_h: ((Date.now() - existing.classifiedAt) / 3600000).toFixed(1) });
        } else if (existing && existing.classifiedAt) {
          skipped++;
          results.push({ path: path || url, status: 'stale', category: existing.category });
        } else {
          // Not yet classified — will be classified on first bot crawl
          results.push({ path: path || url, status: 'pending', category: null });
          classified++;
        }
      } catch (e) {
        errors.push({ path: path || url, error: e.message });
      }
    }

    try {
      await kvSetWithTTL('precompute:meta:last-sweep', {
        time: Date.now(),
        classified, skipped, errors: errors.length,
        pagesTotal: urlEntries.length,
        results,
      }, CACHE_TTL_SECONDS * 7);
    } catch (e) { /* non-fatal */ }

    return res.status(200).json({
      message: 'Sweep complete',
      pagesTotal: urlEntries.length,
      classified, skipped,
      errors,
      results,
    });
  }

  // --------------------------------------------------------
  // STATUS — coverage report for the dashboard.
  // --------------------------------------------------------
  if (req.method === 'GET' && action === 'status') {
    // For real publisher pages, classification happens live at crawl time
    // (Worker calls /match which caches in precompute:{hash}).
    // Status reads the URLs from log:recent and checks their cache entries.
    const { kvListGet } = require('../lib/kv');
    const recentLogs = await kvListGet('log:recent', 100);
    const seenUrls = new Set();
    const pages = [];
    let covered = 0;

    for (const entry of (recentLogs || [])) {
      const url = entry.url;
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const fullUrl = url.startsWith('http') ? url : SITE_URL + url;
      const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(fullUrl).digest('hex');
      const cached = await kvGet(precomputeKey);
      const isFresh = cached && cached.classifiedAt && (Date.now() - cached.classifiedAt) < STALE_MS;
      if (isFresh) covered++;
      pages.push({
        path: url,
        category: (cached && cached.category) || entry.matchCategory || null,
        method: (cached && cached.method) || entry.matchMethod || null,
        source: (cached && cached.source) || 'live',
        classifiedAt: (cached && cached.classifiedAt) || null,
        fresh: isFresh || !!entry.matchCategory, // live hit counts as covered
      });
      if (entry.matchCategory) covered = pages.filter(p => p.fresh).length;
    }

    const lastSweep = await kvGet('precompute:meta:last-sweep');
    const pagesTotal = pages.length;
    const actualCovered = pages.filter(p => p.fresh).length;

    return res.status(200).json({
      pagesTotal,
      covered: actualCovered,
      coveragePct: pagesTotal ? parseFloat(((actualCovered / pagesTotal) * 100).toFixed(1)) : 0,
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

    // Get all known URLs — from publisher sitemaps (real pages) + any
    // demo pages still in listPaths() (now empty after Session 9)
    const urlEntries = await fetchAllPublisherUrls();
    const deleted = [];

    for (const entry of urlEntries) {
      const fullUrl = entry.url;
      const pathOnly = entry.path || '/';

      // Clear variant selection cache for this campaign on this page
      const variantKey = 'variant:' + crypto.createHash('sha256').update(fullUrl + '|' + campaignId).digest('hex');
      try { await kvDel(variantKey); deleted.push(variantKey); } catch (e) { /* non-fatal */ }

      // Clear relevance cache
      const pageCat = null; // unknown for remote pages — clear regardless
      if (!category || true) {
        try {
          const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(fullUrl).digest('hex');
          const cached = await kvGet(precomputeKey);
          const pageCategoryActual = cached && cached.category;
          if (!category || category === pageCategoryActual) {
            const ids = (await kvGet('campaigns:' + (pageCategoryActual || category))) || [];
            const allCampaigns = (await Promise.all(ids.map(id => kvGet('campaign:' + id))))
              .filter(c => c && c.active);
            const { scoreCampaignRelevance, RELEVANCE_THRESHOLD } = require('../lib/relevance');
            const pageSignals = { url: fullUrl, title: '', metaDescription: '', firstParagraph: '', bodySample: '' };
            const survivors = allCampaigns
              .filter(c => scoreCampaignRelevance(c, pageSignals) >= RELEVANCE_THRESHOLD)
              .map(c => c.id).sort().join(',');
            const relKey = 'match-rel:' + crypto.createHash('sha256').update(fullUrl + '|' + survivors).digest('hex');
            await kvDel(relKey);
            deleted.push(relKey);
          }
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
