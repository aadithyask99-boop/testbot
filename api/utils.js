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
    res.setHeader('Content-Type', 'application/xml');
    return res.status(200).send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://testbot-two-psi.vercel.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
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
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'vercel',
    version: '1.0.0',
    region: process.env.VERCEL_REGION || 'unknown',
  });
};
