// ============================================================
// CLICK REDIRECT — /click?dest=URL&adv=SLUG
// ============================================================
// When an advertiser's link is clicked in injected content,
// this endpoint logs the click then redirects to destination.
// This gives us accurate advertiser click tracking.
// ============================================================

const { kvIncr, kvListPush } = require('../lib/kv');

module.exports = async function handler(req, res) {
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
