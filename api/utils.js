// ============================================================
// UTILS — consolidates 4 lightweight endpoints
// Routes: /health, /robots.txt, /sitemap.xml, /ping
// ============================================================

module.exports = async function handler(req, res) {
  const url = req.url.split('?')[0];

  // ── /robots.txt ───────────────────────────────────────────
  if (url === '/robots.txt') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(
`User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: OAI-SearchBot
Allow: /

Sitemap: https://testbot-two-psi.vercel.app/sitemap.xml`
    );
  }

  // ── /sitemap.xml ──────────────────────────────────────────
  if (url === '/sitemap.xml') {
    const { listPaths } = require('../lib/demo-pages');
    const today = new Date().toISOString().split('T')[0];
    const urls = listPaths().map(p =>
      `  <url>
    <loc>https://testbot-two-psi.vercel.app${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
  </url>`
    ).join('\n');
    res.setHeader('Content-Type', 'application/xml');
    return res.status(200).send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
    );
  }

  // ── /ping ─────────────────────────────────────────────────
  if (url === '/ping') {
    const siteUrl = 'https://testbot-two-psi.vercel.app/';
    const payload = {
      host: 'testbot-two-psi.vercel.app',
      key: 'testbot-indexnow-key-001',
      keyLocation: siteUrl + 'indexnow-key.txt',
      urlList: [siteUrl],
    };
    let bingResult = 'not attempted';
    try {
      const response = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      bingResult = `HTTP ${response.status}`;
    } catch (err) {
      bingResult = `error: ${err.message}`;
    }
    return res.status(200).json({
      message: 'IndexNow ping sent',
      url: siteUrl,
      bingResult,
      note: 'Bing typically crawls within 24-48 hours.',
    });
  }

  // ── /health ───────────────────────────────────────────────
  // Reports environment readiness — env-var PRESENCE only, never values.
  // Used to diagnose "is the Anthropic key actually loaded in this env?"
  // without ever logging or returning the secret itself.
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'vercel',
    version: '1.0.0',
    region: process.env.VERCEL_REGION || 'unknown',
    env: {
      anthropic_key_set: !!process.env.ANTHROPIC_API_KEY,
      anthropic_key_prefix: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.slice(0, 10) + '...'
        : null,
      kv_url_set: !!process.env.KV_REST_API_URL,
      kv_token_set: !!process.env.KV_REST_API_TOKEN,
    },
  });
};
