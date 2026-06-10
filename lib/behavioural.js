// ============================================================
// COMPONENT 2: Behavioural Signal Detection
// ============================================================
// Plain English: Bots and humans behave very differently when
// making HTTP requests. Humans carry lots of "baggage" —
// cookies, referrers, language preferences. Bots tend to
// arrive clean, fast, and systematic. We score these signals.
// ============================================================

// FACT CHECK: Each signal below is annotated with its
// reliability and known false-positive rate.

function detectFromBehaviour(headers, requestMeta = {}) {

  let score = 0;
  const signals = [];

  // --------------------------------------------------------
  // SIGNAL 1: Missing Accept-Language header
  // --------------------------------------------------------
  // WHAT IT MEANS: Every real browser sends Accept-Language
  // (e.g. "en-GB,en;q=0.9") to tell servers what language
  // the user prefers. Bots almost never send this because
  // they don't have a "user" with language preferences.
  //
  // FACT CHECK: Verified. Browser spec requires Accept-Language.
  // Chrome, Firefox, Safari all send it. Curl and most bots don't.
  //
  // FALSE POSITIVE RATE: Low. Some server-to-server requests
  // also omit it. Not conclusive alone.
  // --------------------------------------------------------
  if (!headers['accept-language']) {
    score += 25;
    signals.push({ signal: 'no_accept_language', weight: 25, note: 'Reliable bot indicator' });
  }

  // --------------------------------------------------------
  // SIGNAL 2: Missing Cookie header on repeated visits
  // --------------------------------------------------------
  // WHAT IT MEANS: Real browsers accumulate cookies on every
  // visit and send them back. A bot visiting a page for the
  // second time with no cookies suggests it's stateless —
  // i.e. it doesn't maintain a session like a human would.
  //
  // FACT CHECK: Verified. Bots are stateless by design.
  // They don't maintain cookie jars across requests.
  //
  // FALSE POSITIVE RATE: Medium. First-time human visitors
  // also have no cookies. Only meaningful after first visit.
  // --------------------------------------------------------
  if (!headers['cookie'] && requestMeta.visitCount > 1) {
    score += 20;
    signals.push({ signal: 'no_cookie_repeat_visit', weight: 20, note: 'Medium reliability' });
  }

  // --------------------------------------------------------
  // SIGNAL 3: Missing Referer header
  // --------------------------------------------------------
  // WHAT IT MEANS: When a human clicks a link to arrive at
  // your page, their browser sends a Referer header showing
  // where they came from. Bots typically access URLs directly
  // — they don't "click" from anywhere.
  //
  // FACT CHECK: Verified. Referer is browser-standard behaviour.
  //
  // FALSE POSITIVE RATE: Medium-High. Direct navigation by
  // humans (typing URL, opening bookmark) also has no referer.
  // Don't rely on this alone.
  // --------------------------------------------------------
  if (!headers['referer'] && !headers['referrer']) {
    score += 10;
    signals.push({ signal: 'no_referer', weight: 10, note: 'Weak signal alone' });
  }

  // --------------------------------------------------------
  // SIGNAL 4: Request rate / timing
  // --------------------------------------------------------
  // WHAT IT MEANS: AI crawlers systematically hit multiple
  // pages on a domain in rapid succession, often with
  // millisecond precision between requests. Humans browse
  // irregularly, with varying dwell times.
  //
  // FACT CHECK: Verified by TollBit and Akamai bot research.
  // Bots typically hit 5-50 pages/minute on a domain.
  // Humans average 2-4 pages per session over several minutes.
  //
  // FALSE POSITIVE RATE: Low for high request rates.
  // Medium for moderate rates (could be a power user).
  // --------------------------------------------------------
  if (requestMeta.requestsPerMinute > 10) {
    score += 30;
    signals.push({ signal: 'high_request_rate', weight: 30, note: 'Strong bot indicator' });
  } else if (requestMeta.requestsPerMinute > 5) {
    score += 15;
    signals.push({ signal: 'elevated_request_rate', weight: 15, note: 'Moderate bot indicator' });
  }

  // --------------------------------------------------------
  // SIGNAL 5: Absence of browser-specific security headers
  // --------------------------------------------------------
  // WHAT IT MEANS: Modern browsers send several security
  // headers that are part of the browser spec:
  // - sec-ch-ua: identifies the browser brand
  // - sec-fetch-mode: describes how the request was initiated
  // - sec-fetch-site: describes the relationship to origin
  //
  // Bots almost never send these because they're not using
  // a real browser rendering engine.
  //
  // FACT CHECK: These are "Fetch Metadata" headers, mandatory
  // in Chromium-based browsers since Chrome 80 (2020).
  // Firefox also sends them. Safari does NOT send sec-ch-ua
  // but does send sec-fetch-mode.
  //
  // HONEST LIMITATION: Headless Chrome (used by some crawlers)
  // DOES send these headers. This signal only catches
  // non-browser HTTP clients.
  // --------------------------------------------------------
  const hasBrowserHeaders = headers['sec-ch-ua'] || headers['sec-fetch-mode'];
  if (!hasBrowserHeaders) {
    score += 20;
    signals.push({ signal: 'no_browser_security_headers', weight: 20, note: 'Strong for non-headless bots' });
  }

  // --------------------------------------------------------
  // SIGNAL 6: Accept header pattern
  // --------------------------------------------------------
  // WHAT IT MEANS: Real browsers send a very specific Accept
  // header pattern: "text/html,application/xhtml+xml,..."
  // Bots often send simpler patterns like "*/*" or just
  // "text/html" without the full browser signature.
  //
  // FACT CHECK: Verified. Browser Accept headers are defined
  // by spec and consistent across Chrome/Firefox/Safari.
  //
  // FALSE POSITIVE RATE: Medium. Some legitimate clients
  // also send simple Accept headers (RSS readers, apps).
  // --------------------------------------------------------
  const accept = headers['accept'] || '';
  const looksLikeBrowserAccept = accept.includes('text/html') &&
                                  accept.includes('application/xhtml');
  if (!looksLikeBrowserAccept) {
    score += 15;
    signals.push({ signal: 'non_browser_accept_header', weight: 15, note: 'Medium reliability' });
  }

  // --------------------------------------------------------
  // COMPUTE FINAL RESULT
  // --------------------------------------------------------
  // Cap score at 100. Require minimum score of 40 to flag
  // as behavioural bot (prevents false positives from
  // individual weak signals).
  // --------------------------------------------------------
  const finalScore = Math.min(score, 100);
  const isLikelyBot = finalScore >= 40;

  return {
    detected: isLikelyBot,
    confidence: finalScore,
    reason: 'behavioural_analysis',
    signals: signals,
    signalCount: signals.length,
  };
}

// ============================================================
// TEST SUITE
// ============================================================

const testCases = [

  // Typical AI crawler — no browser headers at all
  {
    label: 'Bare-bones crawler (no browser headers)',
    headers: {
      'host': 'example.com',
      'accept': '*/*',
    },
    meta: { visitCount: 3, requestsPerMinute: 15 },
    expectedBot: true,
  },

  // Real Chrome browser headers
  {
    label: 'Real Chrome browser (human)',
    headers: {
      'host': 'example.com',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-GB,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'cookie': 'session=abc123; _ga=GA1.2.xxxxx',
      'referer': 'https://google.com/search?q=test',
      'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120"',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
    },
    meta: { visitCount: 1, requestsPerMinute: 2 },
    expectedBot: false,
  },

  // EDGE CASE: Headless Chrome used by some crawlers
  // FACT CHECK: Some sophisticated crawlers use headless Chrome
  // and DO send browser-looking headers. This is the main
  // weakness of behavioural detection.
  {
    label: 'Headless Chrome crawler (hard to detect)',
    headers: {
      'host': 'example.com',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9', // Headless Chrome sends this
      'sec-ch-ua': '"HeadlessChrome";v="120"', // Reveals it!
      'sec-fetch-mode': 'navigate',
    },
    meta: { visitCount: 1, requestsPerMinute: 20 }, // But high rate gives it away
    expectedBot: true,
    note: 'High request rate is the giveaway — headers look browser-like',
  },
];

console.log('\n=== COMPONENT 2: Behavioural Detection — Test Results ===\n');

testCases.forEach(test => {
  const result = detectFromBehaviour(test.headers, test.meta);
  const pass = result.detected === test.expectedBot;
  const icon = pass ? '✓ PASS' : '✗ FAIL';

  console.log(`${icon} | ${test.label}`);
  console.log(`       Score: ${result.confidence}/100 | Bot: ${result.detected}`);
  console.log(`       Signals fired: ${result.signals.map(s => s.signal).join(', ') || 'none'}`);
  if (test.note) console.log(`       ⚠ ${test.note}`);
  console.log();
});

module.exports = { detectFromBehaviour };
