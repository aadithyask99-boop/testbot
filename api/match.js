// ============================================================
// /match — Contextual matching endpoint (Session 3)
// ============================================================
// Called by:
//   - api/index.js internally (for demo pages)
//   - External publisher intercepts (Cloudflare Worker, WordPress plugin,
//     Node middleware) — once Phase 4 ships
//
// POST /match with page signals → winning campaign or null.
// See MATCHING_SPEC.md for the full design rationale.
// ============================================================

const { runMatch } = require('../lib/relevance');

async function readBody(req) {
  let body = '';
  await new Promise((resolve, reject) => {
    req.on('data', c => body += c);
    req.on('end', resolve);
    req.on('error', reject);
  });
  try { return JSON.parse(body); } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = await readBody(req);
  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!body.url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const result = await runMatch({
      url: body.url,
      title: body.title || '',
      metaDescription: body.metaDescription || '',
      firstParagraph: body.firstParagraph || '',
      bodySample: body.bodySample || body.firstParagraph || '',
      publisherCategory: body.publisherCategory || null,
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error('/match error:', e.message);
    return res.status(200).json({
      winner: null,
      category: null,
      reason: 'match_error',
      error: e.message,
    });
  }
};
