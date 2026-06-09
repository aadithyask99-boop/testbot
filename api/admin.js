// ============================================================
// ADMIN ENDPOINT
// GET  /admin                — view current creatives
// POST /admin/creative       — update a creative
// POST /admin/seed           — seed default from config
// ============================================================

const config  = require('../lib/config');
const { kvGet, kvSet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---- SEED ----
  if (req.method === 'POST' && req.url.includes('/admin/seed')) {
    const def = {
      advertiser: config.sponsored.advertiser,
      text:       config.sponsored.text,
      link:       config.sponsored.link || '',
      linkText:   config.sponsored.linkText || 'Learn more',
      advSlug:    config.sponsored.advSlug || 'default',
      cpmGBP:     config.sponsored.cpmGBP,
      category:   config.sponsored.category,
      updatedAt:  new Date().toISOString(),
    };
    await kvSet(`creative:${config.sponsored.category}`, def);
    return res.status(200).json({ message: 'Seeded', creative: def });
  }

  // ---- UPDATE CREATIVE ----
  if (req.method === 'POST' && req.url.includes('/admin/creative')) {
    let body = '';
    await new Promise(resolve => { req.on('data', c => body += c); req.on('end', resolve); });

    let data;
    try { data = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid JSON' }); }

    const { category, text, advertiser, link, linkText, advSlug, cpmGBP } = data;
    if (!category || !text) return res.status(400).json({ error: 'category and text required' });

    const creative = {
      advertiser: advertiser || 'Unknown',
      text,
      link:      link || '',
      linkText:  linkText || 'Learn more',
      advSlug:   advSlug || (advertiser || 'unknown').toLowerCase().replace(/\s+/g, '-'),
      cpmGBP:    cpmGBP || 10,
      category,
      updatedAt: new Date().toISOString(),
    };

    await kvSet(`creative:${category}`, creative);
    return res.status(200).json({ message: `Creative updated: ${category}`, creative });
  }

  // ---- VIEW ----
  if (req.method === 'GET') {
    const current = await kvGet('creative:finance_investing');
    return res.status(200).json({
      message: 'Current creative',
      current: current || 'not set — using config fallback',
      updateEndpoint: {
        method: 'POST',
        url:    '/admin/creative',
        body: {
          category:   'finance_investing',
          advertiser: 'Brand Name',
          text:       'Your ad copy here (40-80 words)',
          link:       'https://yoursite.com (optional)',
          linkText:   'Visit us',
          advSlug:    'brand-slug',
          cpmGBP:     18,
        },
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
