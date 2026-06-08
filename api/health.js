// Health check — Vercel pings this to confirm function is alive
module.exports = function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'vercel',
    version: '1.0.0',
    region: process.env.VERCEL_REGION || 'unknown',
  });
};
