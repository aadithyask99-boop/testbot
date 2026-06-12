// ============================================================
// /impression — Worker-side impression logging (Session 7)
// ============================================================
// The Cloudflare Worker (worker/index.js) can't write to Upstash
// directly (different security boundary), so it POSTs here,
// fire-and-forget (ctx.waitUntil), after serving an injected page.
//
// This replicates the SAME KV writes api/index.js performs inline for
// its own bot path — recordImpression (atomic per-campaign retrieval/
// training counters), the global stats:* counters, the per-platform
// hash, the per-variant hash, and the log:recent entry that powers the
// dashboard's Live Auction Board / Recent Activity / Why box.
//
// Body: { campaignId, variantId, platform, crawlerType, url,
//         advertiser, cpmGBP, source }
//   source: 'worker' | other — informational only, surfaces in
//   log:recent so the dashboard can distinguish Worker-sourced
//   impressions from the demo-page direct-serve path during the
//   proof-of-concept phase.
//
// NOTE: this endpoint does NOT call /match or know about variant
// angles/methods/relevance scores — the Worker already has all of that
// from its own /match call and could pass it through if richer
// log:recent entries are wanted later. v1 keeps the payload minimal.
// ============================================================

const { kvIncr, kvHashIncr, kvListPush } = require('../lib/kv');

async function readBody(req) {
  let body = '';
  await new Promise((resolve, reject) => {
    req.on('data', c => body += c);
    req.on('end', resolve);
    req.on('error', reject);
  });
  try { return JSON.parse(body); } catch { return null; }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const data = await readBody(req);
  if (!data || !data.campaignId) {
    return res.status(400).json({ error: 'campaignId is required' });
  }

  const { campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP, source } = data;
  const today = todayStr();
  const type = crawlerType === 'training' ? 'training' : 'retrieval';
  const plat = platform || 'unknown';

  try {
    await Promise.all([
      // Per-campaign atomic impression counters — MUST match
      // imprKey() in lib/auction.js exactly: impr:{type}:{campaignId}:{date}
      // (used by getCampaignSpend for revenue calc / dashboard spend display)
      kvIncr(`impr:${type}:${campaignId}:${today}`),
      kvIncr(`impr:${type}:${campaignId}:total`),

      // Global fill-rate / volume counters
      kvIncr('stats:bot_visits:total'),
      kvIncr('stats:bot_served:total'),
      kvIncr('stats:impressions:total'),
      kvIncr(`stats:impressions:platform:${plat}`),
      kvIncr(`stats:impressions:type:${crawlerType || 'unknown'}`),
      kvIncr(`stats:impressions:date:${today}`),

      // Per-platform and per-campaign-per-platform breakdowns
      kvHashIncr('stats:impr_by_platform', plat),
      kvHashIncr('stats:impr_by_camp_plat:' + campaignId, plat),

      // Per-variant breakdown (Session 5)
      ...(variantId ? [kvHashIncr('variant-impr:' + campaignId, variantId)] : []),

      // Recent activity log — powers the dashboard
      kvListPush('log:recent', {
        time: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
        url: url || null,
        platform: plat,
        crawlerType: crawlerType || null,
        campaignId,
        advertiser: advertiser || null,
        cpmGBP: cpmGBP || null,
        variantId: variantId || null,
        matchCached: false,
        source: source || 'worker',
      }, 100),
    ]);
  } catch (e) {
    console.error('/impression KV write error:', e.message);
    // Non-fatal — the Worker already served the page. Still return 200
    // so the Worker doesn't retry/log noise for a logging-only failure.
  }

  return res.status(200).json({ message: 'Impression logged', campaignId });
};
