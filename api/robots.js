// Serves robots.txt — tells crawlers they are welcome
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(`User-agent: *
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

Sitemap: https://testbot-two-psi.vercel.app/sitemap.xml`);
};
