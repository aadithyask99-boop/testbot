// ============================================================
// ADMIN ENDPOINT — Campaign management (Session 2)
// GET  /admin                  — list all campaigns + spend status
// POST /admin/campaign         — create or update a campaign
// POST /admin/campaign/pause   — pause/unpause: { id, active }
// POST /admin/seed             — seed default campaign from config
// GET  /ad?cat=CATEGORY        — auction winner for a category (SDK)
//
// NOTE: campaigns:{category} index lists use read-modify-write.
// Admin operations are low-concurrency (a human clicking a form)
// so this is safe. NEVER use this pattern for counters.
// ============================================================

const config = require('../lib/config');
const { kvGet, kvSet } = require('../lib/kv');
const { runAuction, getCampaignSpend } = require('../lib/auction');

async function readBody(req) {
  let body = '';
  await new Promise(resolve => { req.on('data', c => body += c); req.on('end', resolve); });
  try { return JSON.parse(body); } catch { return null; }
}

// Add a campaign ID to its category index list (idempotent)
async function addToCategoryIndex(category, id) {
  const ids = (await kvGet(`campaigns:${category}`)) || [];
  if (!ids.includes(id)) {
    ids.push(id);
    await kvSet(`campaigns:${category}`, ids);
  }
}

async function saveCampaign(data) {
  const campaign = {
    id: data.id,
    advertiser: data.advertiser || 'Unknown',
    category: data.category,
    cpmGBP: parseFloat(data.cpmGBP) || 10,
    budgetDailyGBP: parseFloat(data.budgetDailyGBP) || 0,
    budgetTotalGBP: parseFloat(data.budgetTotalGBP) || 0,
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    matchingDescription: data.matchingDescription || '',
    text: data.text,
    link: data.link || '',
    linkText: data.linkText || 'Learn more',
    advSlug: data.advSlug || (data.advertiser || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    active: data.active !== false,
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    endDate: data.endDate || null,
    updatedAt: new Date().toISOString(),
  };
  await kvSet(`campaign:${campaign.id}`, campaign);
  await addToCategoryIndex(campaign.category, campaign.id);
  return campaign;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';

  // ---- SEED default campaign ----
  if (req.method === 'POST' && url.includes('/admin/seed')) {
    const campaign = await saveCampaign(config.defaultCampaign);
    return res.status(200).json({ message: 'Seeded default campaign', campaign });
  }

  // ---- PAUSE / UNPAUSE ----
  if (req.method === 'POST' && url.includes('/admin/campaign/pause')) {
    const data = await readBody(req);
    if (!data || !data.id) return res.status(400).json({ error: 'id required' });
    const campaign = await kvGet(`campaign:${data.id}`);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    campaign.active = data.active === true; // explicit: pause sets false unless active:true sent
    campaign.updatedAt = new Date().toISOString();
    await kvSet(`campaign:${campaign.id}`, campaign);
    return res.status(200).json({ message: campaign.active ? 'Campaign activated' : 'Campaign paused', campaign });
  }

  // ---- CREATE / UPDATE campaign ----
  if (req.method === 'POST' && url.includes('/admin/campaign')) {
    const data = await readBody(req);
    if (!data) return res.status(400).json({ error: 'Invalid JSON' });
    const { id, category, text } = data;
    if (!id || !category || !text) {
      return res.status(400).json({ error: 'id, category and text are required' });
    }
    if (!config.categories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${config.categories.join(', ')}` });
    }
    const campaign = await saveCampaign(data);
    return res.status(200).json({ message: `Campaign saved: ${campaign.id}`, campaign });
  }

  // ---- GET /ad — auction winner for a category (used by SDK) ----
  if (req.method === 'GET' && url.startsWith('/ad')) {
    const category = (req.query && req.query.cat) || config.demoPageCategory;
    const winner = await runAuction(category);
    if (!winner) return res.status(200).json({ category, campaign: null, message: 'No eligible campaign' });
    return res.status(200).json({ category, campaign: winner });
  }

  // ---- GET /admin — list all campaigns with spend ----
  if (req.method === 'GET') {
    const allIds = [];
    for (const cat of config.categories) {
      const ids = (await kvGet(`campaigns:${cat}`)) || [];
      allIds.push(...ids);
    }
    const campaigns = [];
    for (const id of [...new Set(allIds)]) {
      const c = await kvGet(`campaign:${id}`);
      if (!c) continue;
      const spend = await getCampaignSpend(c);
      campaigns.push({ ...c, spend });
    }
    // Sort: active first, then CPM descending (auction order)
    campaigns.sort((a, b) => (b.active - a.active) || (b.cpmGBP - a.cpmGBP));
    return res.status(200).json({
      message: 'All campaigns',
      count: campaigns.length,
      campaigns,
      endpoints: {
        create: { method: 'POST', url: '/admin/campaign', body: { id: 'camp_002', advertiser: 'Brand', category: 'finance|tech', cpmGBP: 20, budgetDailyGBP: 50, budgetTotalGBP: 500, keywords: ['isa'], matchingDescription: '...', text: 'Ad copy 40-80 words', link: '', linkText: '', advSlug: '', active: true, startDate: 'YYYY-MM-DD', endDate: null } },
        pause: { method: 'POST', url: '/admin/campaign/pause', body: { id: 'camp_002', active: false } },
        seed: { method: 'POST', url: '/admin/seed' },
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
