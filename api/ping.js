// ============================================================
// INDEXNOW PING — /ping
// ============================================================
// Plain English: IndexNow is a protocol supported by Bing,
// Yandex, and others. Hitting this endpoint sends a signal
// to those search engines saying "please crawl this URL now."
// Bing typically crawls within 24 hours of receiving a ping.
// Perplexity uses Bing's index as a source — so getting into
// Bing gets you into Perplexity's retrieval pool.
// ============================================================

module.exports = async function handler(req, res) {

  const siteUrl = 'https://testbot-two-psi.vercel.app/';
  const key = 'testbot-indexnow-key-001';

  // Ping Bing via IndexNow
  const payload = {
    host: 'testbot-two-psi.vercel.app',
    key: key,
    keyLocation: siteUrl + 'indexnow-key.txt',
    urlList: [siteUrl]
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

  res.status(200).json({
    message: 'IndexNow ping sent',
    url: siteUrl,
    bingResult: bingResult,
    note: 'Bing typically crawls within 24-48 hours. Perplexity uses Bing index as a source.',
    nextStep: 'Wait 24 hours, then ask Perplexity: "best ISA investment platform UK 2024 index funds"'
  });
};
