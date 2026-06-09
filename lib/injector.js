function injectSponsoredContent(htmlString, sponsoredText, options = {}) {
  const strategy   = options.strategy || 'auto';
  // If the creative has a link, append it to the text as an anchor tag
  // The link goes through /click for tracking before redirecting to advertiser
  if (options.link && options.advSlug) {
    const clickUrl  = `/click?adv=${encodeURIComponent(options.advSlug)}&dest=${encodeURIComponent(options.link)}`;
    const linkLabel = options.linkText || 'Learn more';
    sponsoredText   = sponsoredText + ` <a href="${clickUrl}">${linkLabel} →</a>`;
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

module.exports = { injectSponsoredContent };
