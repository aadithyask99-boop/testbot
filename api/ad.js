// ============================================================
// AD ENDPOINT — /ad?pub=PUBLISHER_ID&cat=CATEGORY
// ============================================================
// Returns the current live creative for a given category.
// Checks the database first. Falls back to config.js if
// the database has no creative set yet.
// ============================================================

const config = require('../lib/config');
const { kvGet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const publisherId = req.query.pub || 'unknown';
  const category = req.query.cat || config.sponsored.category;

  // Try database first
  let creative = null;
  try {
    const stored = await kvGet(`creative:${category}`);
    if (stored) creative = stored;
  } catch (e) {
    console.error('Ad fetch error:', e.message);
  }

  // Fall back to config.js if nothing in database yet
  if (!creative) {
    creative = {
      advertiser: config.sponsored.advertiser,
      text: config.sponsored.text,
      cpmGBP: config.sponsored.cpmGBP,
      category: config.sponsored.category,
      source: 'config_fallback',
    };
  }

  res.status(200).json({ publisherId, ...creative });
};
