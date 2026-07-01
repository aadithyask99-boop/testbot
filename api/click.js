// ============================================================
// CLICK REDIRECT
// Two paths:
//   /t/{token}          — trackable link redirect (Batch A)
//   /click?dest=&adv=   — legacy advertiser click (unchanged)
// ============================================================

const crypto = require('crypto');
const { kvGet, kvIncr, kvHashIncr, kvListPush } = require('../lib/kv');
const { detectAIReferrer } = require('../lib/referrer');

module.exports = async function handler(req, res) {

  // ── PATH A: Trackable link /t/{token} ──────────────────────
  if (req.query && req.query.token) {
    const token = req.query.token;
    let link;
    try { link = await kvGet('track:' + token); } catch (e) { link = null; }

    if (!link || !link.active) {
      return res.status(410).send('This link is no longer active.');
    }

    const referrer = req.headers['referer'] || '';
    const aiRef    = detectAIReferrer(referrer);
    const platform = aiRef ? aiRef.platform : 'direct';
    const aiReferral = aiRef !== null;
    const variantId  = (req.query && req.query.vid) || null;
    const today      = new Date().toISOString().slice(0, 10);
    const ipHash     = crypto
      .createHash('sha256')
      .update(req.headers['x-forwarded-for'] || '')
      .digest('hex')
      .slice(0, 16);

    // Fire-and-forget — never block the redirect
    Promise.all([
      kvIncr('stats:track:' + token + ':total'),
      kvIncr('stats:track:' + token + ':date:' + today),
      kvHashIncr('stats:track:' + token + ':platform', platform),
      kvListPush('log:track:' + token, {
        time: new Date().toISOString(),
        platform,
        aiReferral,
        referrer: referrer.slice(0, 200),
        ipHash,
        variantId,
      }, 100),
    ]).catch(() => {});

    res.writeHead(302, { Location: link.dest });
    return res.end();
  }

  // ── PATH B: Legacy /click?dest=&adv= ───────────────────────
  const dest    = req.query && req.query.dest;
  const advSlug = req.query && req.query.adv;

  if (!dest) {
    return res.status(400).send('Missing destination URL');
  }

  const today = new Date().toISOString().split('T')[0];
  const ip    = req.headers['x-forwarded-for'] || 'unknown';
  const ref   = req.headers['referer'] || '';

  // Log advertiser click — fire and forget
  try {
    await Promise.all([
      kvIncr('stats:adclicks:total'),
      kvIncr(`stats:adclicks:advertiser:${advSlug || 'unknown'}`),
      kvIncr(`stats:adclicks:date:${today}`),
      kvListPush('log:adclicks', {
        time: new Date().toISOString(),
        ip,
        advertiser: advSlug,
        dest,
        referrer: ref.substring(0, 200),
      }, 100),
    ]);
  } catch (e) {
    // Never block the redirect on a logging error
  }

  // Redirect to advertiser destination
  res.writeHead(302, { Location: dest });
  res.end();
};
