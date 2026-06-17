// ============================================================
// DEMO PAGES — retired in Session 9
// ============================================================
// The testbot demo pages (Finance Weekly ISA article etc.) have
// been replaced by real publisher sites:
//   - finance-weekly.vercel.app (pub_001) — Finance Weekly
//   - tech-briefing-tau.vercel.app (pub_002) — Tech Briefing
//
// Both publishers use Cloudflare Workers to inject ads, with
// impressions logged to the platform via /impression.
//
// This file is kept for backward compatibility — other modules
// import getPage(), getPubId(), listPaths(), listPages() from here.
// All return empty/null so the demo paths return 404 cleanly.
// ============================================================

const PAGES = {};

function makePage() { return ''; }

function getPage() { return null; }
function getPubId() { return null; }
function listPaths() { return []; }
function listPages() { return []; }

module.exports = { getPage, getPubId, listPaths, listPages, PAGES };
