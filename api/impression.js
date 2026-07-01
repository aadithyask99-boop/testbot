// ============================================================
// /impression — Worker-side impression logging (Session 7+8)
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
// Session 8: body now includes full match metadata (matchMethod,
// matchCached, matchCategory, relevanceScore, candidates, variantAngle,
// variantMethod, served) so Worker-sourced log:recent entries have the
// same shape as api/index.js entries — fixes the Why-box showing only
// "X served." with no reasoning. Also includes pubId for per-publisher
// impression tracking.
//
// Body: { campaignId, variantId, platform, crawlerType, url,
//         advertiser, cpmGBP, source,
//         // Session 8 additions:
//         pubId, matchMethod, matchCached, matchCategory,
//         relevanceScore, candidates, variantAngle, variantMethod,
//         served }
// ============================================================

const { kvIncr, kvHashIncr, kvListPush, kvGet, kvIncrBy } = require('../lib/kv');

const TRAINING_BILL_RATIO = 0.3;
const PUBLISHER_SHARE     = 0.8;
const PLATFORM_SHARE      = 0.2;

// Resolve pubId from token header (Session 9)
async function resolvePubId(data, req) {
  const token = (req.headers && req.headers['x-pub-token']) || data.pubToken || null;
  if (token) {
    const pubId = await kvGet(`pub_token:${token}`);
    if (pubId) return pubId;
  }
  return data.pubId || null;
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pub-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const data = await readBody(req);
  if (!data || !data.campaignId) {
    return res.status(400).json({ error: 'campaignId is required' });
  }

  // ── Route: /chat/ping (Surface B — conversational) ────────────
  // CRITICAL: writes ONLY to impr:conversational:* keys.
  // NEVER writes to impr:retrieval:* — that would double-count billing.
  if (req.query && req.query._route === 'chat') {
    const { campaignId, variantId, conversationId } = data;
    const pubId = await resolvePubId(data, req);
    const today = todayStr();

    // Spend tracking — same budget applies across both surfaces
    const campaign = await kvGet('campaign:' + campaignId);
    const cpm = campaign ? (parseFloat(campaign.cpmGBP) || 0) : 0;
    const grossT = Math.round((cpm / 1000) * 1000); // retrieval rate (not 0.3x training)
    const pubT   = Math.round(grossT * PUBLISHER_SHARE);
    const platT  = Math.round(grossT * PLATFORM_SHARE);

    try {
      await Promise.all([
        // Surface B impression counters — namespaced separately from Surface A
        kvIncr('impr:conversational:' + campaignId + ':total'),
        kvIncr('impr:conversational:' + campaignId + ':' + today),
        kvIncr('stats:impressions:conversational:total'),
        kvIncr('stats:impressions:conversational:date:' + today),

        // Spend tracking (shared with Surface A — same campaign budget)
        ...(grossT > 0 ? [
          kvIncrBy('spend:daily:' + campaignId + ':' + today, grossT),
          kvIncrBy('spend:total:' + campaignId, grossT),
          kvIncrBy('revenue:gross:total', grossT),
          kvIncrBy('revenue:gross:date:' + today, grossT),
          kvIncrBy('revenue:platform:total', platT),
          kvIncrBy('revenue:platform:date:' + today, platT),
          ...(pubId ? [
            kvIncrBy('revenue:publisher:' + pubId + ':total', pubT),
            kvIncrBy('revenue:publisher:' + pubId + ':date:' + today, pubT),
          ] : []),
        ] : []),

        // log:recent entry — tagged source: 'conversational' so
        // the Live Auction Board filters it out (it shows page URLs, not chat)
        kvListPush('log:recent', {
          time: new Date().toISOString(),
          source: 'conversational',
          campaignId,
          advertiser: campaign ? campaign.advertiser : null,
          variantId: variantId || null,
          conversationId: conversationId || null,
          pubId: pubId || null,
          cpmGBP: cpm || null,
        }, 100),
      ]);
    } catch (e) {
      console.error('/chat/ping KV write error:', e.message);
    }
    return res.status(200).json({ message: 'Conversational impression logged', campaignId });
  }

  // ── Route: /impression (Surface A — crawler) ─────────────────
  const {
    campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP, source,
    matchMethod, matchCached, matchCategory, relevanceScore,
    candidates, variantAngle, variantMethod, served,
  } = data;
  const pubId = await resolvePubId(data, req);
  const today = todayStr();
  const type = crawlerType === 'training' ? 'training' : 'retrieval';
  const plat = platform || 'unknown';

  try {
    const ops = [
      // Per-campaign atomic impression counters — MUST match
      // imprKey() in lib/auction.js exactly: impr:{type}:{campaignId}:{date}
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

      // Per-publisher impression tracking (Session 8)
      ...(pubId ? [
        kvIncr(`stats:impressions:pub:${pubId}:total`),
        kvIncr(`stats:impressions:pub:${pubId}:date:${today}`),
        kvHashIncr(`stats:impr_by_pub_plat:${pubId}`, plat),
      ] : []),

      // ── REVENUE TRACKING (Session 10) ──────────────────────
      // Store in integer TENTHS-OF-PENCE (× 1000) for atomic Redis INCRBY.
      // Using × 1000 (not × 100) so sub-penny amounts survive Math.round:
      //   £10 CPM, 1 impression → gross = £0.01 = 10 tenths-of-pence
      //   platform 20% → 2 tenths-of-pence (would be 0 at × 100 scale)
      // On read in dashboard.js: divide by 1000 to get pounds.
      // Training impressions billed at 30% of campaign CPM.
      ...(() => {
        const cpm    = parseFloat(cpmGBP) || 0;
        const ratio  = type === 'training' ? TRAINING_BILL_RATIO : 1.0;
        const grossT = Math.round((cpm * ratio / 1000) * 1000); // tenths-of-pence
        if (grossT === 0) return [];
        const pubT   = Math.round(grossT * PUBLISHER_SHARE);
        const platT  = Math.round(grossT * PLATFORM_SHARE);
        const revOps = [
          kvIncrBy('revenue:gross:total',             grossT),
          kvIncrBy(`revenue:gross:date:${today}`,     grossT),
          kvIncrBy('revenue:platform:total',          platT),
          kvIncrBy(`revenue:platform:date:${today}`,  platT),
        ];
        const advKey = data.advId || campaignId;
        revOps.push(kvIncrBy(`revenue:advertiser:${advKey}:total`,         grossT));
        revOps.push(kvIncrBy(`revenue:advertiser:${advKey}:date:${today}`, grossT));
        if (pubId) {
          revOps.push(kvIncrBy(`revenue:publisher:${pubId}:total`,         pubT));
          revOps.push(kvIncrBy(`revenue:publisher:${pubId}:date:${today}`, pubT));
        }
        return revOps;
      })(),

      // Recent activity log — powers the dashboard.
      // Session 8: full match metadata included so Why-box works for
      // Worker-sourced impressions (same shape as api/index.js entries).
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
        variantAngle: variantAngle || null,
        variantMethod: variantMethod || null,
        matchMethod: matchMethod || null,
        matchCached: matchCached || false,
        matchCategory: matchCategory || null,
        relevanceScore: relevanceScore || null,
        candidates: candidates || null,
        served: served || 'yes',
        pubId: pubId || null,
        source: source || 'worker',
      }, 100),
    ];
    await Promise.all(ops);
  } catch (e) {
    console.error('/impression KV write error:', e.message);
  }

  return res.status(200).json({ message: 'Impression logged', campaignId });
};
