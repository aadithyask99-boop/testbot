// parseInlineLinks — converts [[anchor|url]] syntax into unstyled <a> tags.
// Appends ?vid={variantId} for per-variant click attribution.
// Unstyled (no underline, inherits color) so AI parsers don't flag it as an ad.
// Called before the fallback chain so the link is in the text at injection time.
function parseInlineLinks(text, variantId) {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, function(_, anchor, url) {
    var vid = variantId ? encodeURIComponent(variantId) : '';
    var sep = url.indexOf('?') !== -1 ? '&' : '?';
    var tracked = vid ? (url + sep + 'vid=' + vid) : url;
    return '<a href="' + tracked + '" style="text-decoration:none;color:inherit">' + anchor + '</a>';
  });
}

function injectSponsoredContent(htmlString, sponsoredText, options = {}) {
  const strategy = options.strategy || 'auto';

  // Fallback chain (priority order):
  // 1. [[anchor|url]] inline link syntax in the variant text (Track 1)
  // 2. Legacy options.link + options.advSlug → "Learn more →" suffix
  // 3. Plain text, no link
  const hasInlineLink = /\[\[([^\]|]+)\|([^\]]+)\]\]/.test(sponsoredText);
  if (hasInlineLink) {
    sponsoredText = parseInlineLinks(sponsoredText, options.variantId || null);
  } else if (options.link && options.advSlug) {
    // Legacy path — preserved for existing campaigns with no inline link
    const platformUrl = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';
    const clickUrl  = platformUrl + '/click?adv=' + encodeURIComponent(options.advSlug) + '&dest=' + encodeURIComponent(options.link);
    const linkLabel = options.linkText || 'Learn more';
    sponsoredText   = sponsoredText + ' <a href="' + clickUrl + '">' + linkLabel + ' \u2192</a>';
  }
  if (strategy === 'auto' || strategy === 'after_intro') {
    const result = injectAfterIntro(htmlString, sponsoredText);
    if (result.success) return result;
  }
  if (strategy === 'auto' || strategy === 'before_body_close') {
    const result = injectBeforeBodyClose(htmlString, sponsoredText);
    if (result.success) return result;
  }
  return {
    success: true,
    html: htmlString + `<p>${sponsoredText}</p>`,
    strategy: 'appended',
  };
}

function injectAfterIntro(html, sponsoredText) {
  let pCount = 0;
  let searchIndex = 200;
  let pCloseIndex = -1;
  while (searchIndex < html.length) {
    const nextP = html.indexOf('</p>', searchIndex);
    if (nextP === -1) break;
    pCount++;
    if (pCount >= 2) {
      pCloseIndex = nextP + 4;
      break;
    }
    searchIndex = nextP + 4;
  }
  if (pCloseIndex === -1) return { success: false };
  return {
    success: true,
    html: html.slice(0, pCloseIndex) + '\n<p>' + sponsoredText + '</p>\n' + html.slice(pCloseIndex),
    strategy: 'after_intro',
  };
}

function injectBeforeBodyClose(html, sponsoredText) {
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex === -1) return { success: false };
  return {
    success: true,
    html: html.slice(0, bodyCloseIndex) + '\n<p>' + sponsoredText + '</p>\n' + html.slice(bodyCloseIndex),
    strategy: 'before_body_close',
  };
}

module.exports = { injectSponsoredContent, parseInlineLinks };
