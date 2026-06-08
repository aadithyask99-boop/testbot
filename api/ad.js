// ============================================================
// AD ENDPOINT — /ad?pub=PUBLISHER_ID
// ============================================================
// Plain English: The SDK calls this endpoint to fetch the
// right sponsored text for a given publisher. In production
// this would query a database of advertisers, match by
// publisher category, and return the winning creative.
// For the demo it returns the hardcoded Vanguard creative.
// ============================================================

const config = require('../lib/config');

module.exports = function handler(req, res) {

  // Allow cross-origin requests — the SDK runs on the
  // publisher's domain and calls back to your server.
  // Without CORS headers the browser blocks the request.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const publisherId = req.query.pub || 'unknown';
  const pageUrl = req.query.url || '';

  console.log(JSON.stringify({
    event: 'ad_request',
    publisherId,
    pageUrl,
    time: new Date().toISOString(),
  }));

  // In production: look up publisher in database,
  // match to advertiser by category, return winning creative.
  // For demo: return hardcoded creative.
  res.status(200).json({
    publisherId,
    advertiser: config.sponsored.advertiser,
    text: config.sponsored.text,
    category: config.sponsored.category,
    cpmGBP: config.sponsored.cpmGBP,
  });
};
