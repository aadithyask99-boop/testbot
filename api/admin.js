// ============================================================
// ADMIN ENDPOINT — /admin
// ============================================================
// GET  /admin                  — view current creatives
// POST /admin/creative         — update a creative
// POST /admin/seed             — seed default creative
// ============================================================

const config = require('../lib/config');
const { kvGet, kvSet } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // ---- SEED default creative ----
  if (req.method === 'POST' && req.url.includes('/admin/seed')) {
    const defaultCreative = {
      advertiser: config.sponsored.advertiser,
      text: config.sponsored.text,
      cpmGBP: config.sponsored.cpmGBP,
      category: config.sponsored.category,
      updatedAt: new Date().toISOString(),
    };
    await kvSet(`creative:${config.sponsored.category}`, defaultCreative);
    return res.status(200).json({
      message: 'Default creative seeded',
      creative: defaultCreative,
    });
  }

  // ---- UPDATE creative ----
  if (req.method === 'POST' && req.url.includes('/admin/creative')) {
    let body = '';
    await new Promise(resolve => {
      req.on('data', chunk => body += chunk);
      req.on('end', resolve);
    });

    let data;
    try { data = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

    const { category, text, advertiser, cpmGBP } = data;
    if (!category || !text) {
      return res.status(400).json({ error: 'category and text are required' });
    }

    const creative = {
      advertiser: advertiser || 'Unknown',
      text,
      cpmGBP: cpmGBP || 10,
      category,
      updatedAt: new Date().toISOString(),
    };

    await kvSet(`creative:${category}`, creative);
    return res.status(200).json({
      message: `Creative updated for category: ${category}`,
      creative,
    });
  }

  // ---- VIEW current creatives ----
  if (req.method === 'GET') {
    const financeCreative = await kvGet('creative:finance_investing');
    const techCreative = await kvGet('creative:technology');
    return res.status(200).json({
      message: 'Current creatives in database',
      creatives: {
        finance_investing: financeCreative || 'not set — using config.js fallback',
        technology: techCreative || 'not set',
      },
      howToUpdate: {
        method: 'POST',
        url: '/admin/creative',
        body: {
          category: 'finance_investing',
          advertiser: 'Your Brand',
          text: 'Your sponsored text here (40-80 words)',
          cpmGBP: 18,
        },
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
