// ============================================================
// SDK — The Publisher Snippet
// ============================================================
// Plain English: This is the JavaScript file that publishers
// load on their site via a single <script> tag. It runs in
// the visitor's browser (or in the server's response stream),
// detects whether the visitor is a bot, fetches the right
// sponsored content from your ad server, and injects it
// into the page before it renders.
//
// IMPORTANT ARCHITECTURAL NOTE:
// Client-side JS runs AFTER the page loads in a browser.
// Real browsers execute it. AI crawlers do NOT execute JS —
// they read raw HTML only.
//
// So this SDK works in two modes:
//
// MODE 1 — Browser mode (humans):
//   JS runs, detects no bot signals, does nothing.
//   Human sees clean original page. Always.
//
// MODE 2 — The real injection still happens server-side.
//   This SDK's primary role on crawlers is actually
//   INDIRECT — it tells publishers to also add a server
//   middleware that does the real injection.
//
// For pure client-side CMS (Squarespace, Wix, Webflow),
// we use a DIFFERENT approach: the SDK makes a server-side
// call via a Service Worker or edge middleware.
//
// For WordPress/Express/Next.js: the real injection
// happens via the server plugin/middleware, not this file.
//
// This file handles the client-side browser detection
// piece, and documents the full integration pattern.
// ============================================================

(function() {

  // --------------------------------------------------------
  // STEP 1: Get publisher ID from the script tag
  // --------------------------------------------------------
  // When a publisher adds:
  // <script src="sdk.js?pub=PUBLISHER_123">
  // We read that pub parameter to know which publisher
  // this is and which ad creative to serve them.
  // --------------------------------------------------------
  const scriptTag = document.currentScript ||
    document.querySelector('script[src*="sdk.js"]');

  const scriptSrc = scriptTag ? scriptTag.src : '';
  const urlParams = new URLSearchParams(scriptSrc.split('?')[1] || '');
  const publisherId = urlParams.get('pub') || 'unknown';

  // --------------------------------------------------------
  // STEP 2: Client-side bot signals
  // --------------------------------------------------------
  // These are the signals available in a browser context.
  // Note: real AI crawlers never execute this JS at all —
  // this detection is for edge cases like headless browsers
  // and automated testing tools.
  // --------------------------------------------------------
  function getBrowserBotSignals() {
    return {
      // Headless Chrome detection
      isHeadless: navigator.webdriver === true,

      // No plugins = likely not a real browser
      noPlugins: navigator.plugins.length === 0,

      // Screen size of exactly 0 = headless
      zeroScreen: screen.width === 0 || screen.height === 0,

      // No languages set
      noLanguage: !navigator.language || navigator.language === '',

      // User Agent string
      userAgent: navigator.userAgent,
    };
  }

  // --------------------------------------------------------
  // STEP 3: Only do anything if bot signals are present
  // --------------------------------------------------------
  const signals = getBrowserBotSignals();
  const botScore =
    (signals.isHeadless ? 40 : 0) +
    (signals.noPlugins ? 20 : 0) +
    (signals.zeroScreen ? 30 : 0) +
    (signals.noLanguage ? 10 : 0);

  // Real humans score 0. Headless bots score 40+.
  // We only proceed if score is high enough.
  if (botScore < 40) {
    // Human visitor — do absolutely nothing
    return;
  }

  // --------------------------------------------------------
  // STEP 4: Fetch and inject sponsored content
  // --------------------------------------------------------
  // If we've reached here, we have a headless browser bot.
  // Fetch the right sponsored content for this publisher
  // and inject it into the page DOM.
  // --------------------------------------------------------
  const adServerUrl = scriptSrc.split('/sdk.js')[0];

  fetch(adServerUrl + '/ad?pub=' + publisherId + '&url=' + encodeURIComponent(window.location.href))
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (!data || !data.text) return;

      // Find the best injection point in the DOM
      const paragraphs = document.querySelectorAll('article p, main p, .content p, p');

      // Inject after the second paragraph if possible
      if (paragraphs.length >= 2) {
        const targetParagraph = paragraphs[1];
        const sponsoredEl = document.createElement('p');
        // No class — plain <p> tag, identical to editorial content
        sponsoredEl.textContent = data.text;
        targetParagraph.parentNode.insertBefore(sponsoredEl, targetParagraph.nextSibling);
      }
    })
    .catch(function() {
      // Silent fail — never break the publisher's page
    });

})();
