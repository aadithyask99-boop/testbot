// ============================================================
// DASHBOARD — Vercel version
// ============================================================
// Plain English: Vercel functions have no persistent memory.
// Each function invocation is completely fresh — the request
// log array from the Express version doesn't survive between
// requests. So this dashboard shows a different kind of data:
// a live snapshot of what THIS request looks like, plus
// instructions for reading logs in the Vercel dashboard.
//
// For real persistent logging you'd connect a database
// (Vercel KV, PlanetScale, Supabase). That's Phase 2.
// For now the Vercel dashboard's built-in log viewer shows
// every request in real time — that's your dashboard for now.
// ============================================================

const { analyseRequest } = require('../lib/combined-detector');

module.exports = function handler(req, res) {

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || '';

  const detection = analyseRequest({
    headers: req.headers,
    meta: { visitCount: 1, requestsPerMinute: 1 }
  });

  res.status(200).json({
    message: 'Vercel functions are stateless — no persistent request log. Use Vercel dashboard logs to see all requests.',
    vercelLogsUrl: 'https://vercel.com/dashboard → your project → Logs tab',
    thisRequest: {
      time: new Date().toISOString(),
      ip: ip,
      ua: ua.substring(0, 100),
      isBot: detection.isBot,
      platform: detection.platform,
      confidence: detection.confidence,
      crawlerType: detection.crawlerType,
      suggestedCPM: detection.suggestedCPM,
    },
    howToReadLogs: [
      '1. Go to vercel.com and open your project',
      '2. Click the Logs tab',
      '3. Every request appears here in real time',
      '4. Filter by "BOT DETECTED" to see only bot visits',
      '5. Each log line is JSON — platform, confidence, CPM all included',
    ]
  });
};
