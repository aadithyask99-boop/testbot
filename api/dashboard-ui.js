const config = require('../lib/config');

// ============================================================
// PORTAL ROUTING (Session 11 — /ui prefix retired except the chooser itself,
// see PLATFORM_STRUCTURE_SPEC.md Part 17 §1)
// /ui                             → chooser page ONLY (links to the 3 routes below)
// /advertiser/{slug}/dashboard   → scoped advertiser portal, operational view
// /advertiser/{slug}/analytics   → scoped advertiser portal, performance view
// /publisher/{slug}/dashboard    → scoped publisher portal, operational view
// /publisher/{slug}/analytics    → scoped publisher portal, performance view
// /admin/dashboard               → full operator view (3-tab, unsplit — banner notes split is planned)
// /admin/analytics               → full operator view (3-tab, unsplit — banner notes split is planned)
// /advertiser                    → directory list of advertisers
// /publisher                     → directory list of publishers
// ============================================================

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chooserHtml() {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>AI Ad Platform</title><style>' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;' +
    'min-height:100vh;display:flex;align-items:center;justify-content:center}' +
    '.wrap{max-width:480px;width:100%;padding:24px}' +
    'h1{font-size:20px;font-weight:600;margin-bottom:8px;text-align:center}' +
    'p.sub{font-size:13px;color:#888;text-align:center;margin-bottom:32px}' +
    '.opt{display:block;background:#fff;border:1px solid #e5e5e5;border-radius:10px;' +
    'padding:20px 24px;margin-bottom:12px;text-decoration:none;color:#111;transition:border-color .15s}' +
    '.opt:hover{border-color:#999}' +
    '.opt .t{font-size:15px;font-weight:600;margin-bottom:4px}' +
    '.opt .d{font-size:12px;color:#888}' +
    '</style></head><body><div class="wrap">' +
    '<h1>AI Ad Platform</h1>' +
    '<p class="sub">Choose your view</p>' +
    '<a class="opt" href="/advertiser"><div class="t">Advertiser</div>' +
    '<div class="d">View your campaign performance, spend, and ad variants</div></a>' +
    '<a class="opt" href="/publisher"><div class="t">Publisher</div>' +
    '<div class="d">View your earnings, pages, and what\'s serving</div></a>' +
    '<a class="opt" href="/admin/dashboard"><div class="t">Admin</div>' +
    '<div class="d">Full platform view — all advertisers and publishers</div></a>' +
    '</div></body></html>';
}

function listPageHtml(kind) {
  var items, title, base;
  if (kind === 'advertiser') {
    items = (config.advertisers || []).filter(a => a.status === 'active');
    title = 'Advertisers';
    base = '/advertiser/';
  } else {
    items = (config.publishers || []).filter(p => p.active);
    title = 'Publishers';
    base = '/publisher/';
  }
  var rows = items.map(function (it) {
    var slug = it.slug || '';
    var name = it.name || '';
    return '<a class="opt" href="' + base + encodeURIComponent(slug) + '/overview">' +
      '<div class="t">' + escapeHtml(name) + '</div></a>';
  }).join('');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + ' — AI Ad Platform</title><style>' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;' +
    'min-height:100vh;padding:24px}' +
    '.wrap{max-width:480px;margin:40px auto}' +
    'h1{font-size:18px;font-weight:600;margin-bottom:4px}' +
    'p.sub{font-size:12px;color:#888;margin-bottom:24px}' +
    'p.sub a{color:#888}' +
    '.opt{display:block;background:#fff;border:1px solid #e5e5e5;border-radius:10px;' +
    'padding:16px 20px;margin-bottom:10px;text-decoration:none;color:#111;transition:border-color .15s}' +
    '.opt:hover{border-color:#999}' +
    '.opt .t{font-size:14px;font-weight:600}' +
    '.empty{font-size:13px;color:#888;padding:20px 0}' +
    '</style></head><body><div class="wrap">' +
    '<h1>' + title + '</h1>' +
    '<p class="sub"><a href="/ui">&larr; back</a></p>' +
    (rows || '<div class="empty">None found</div>') +
    '</div></body></html>';
}

// ============================================================
// Session 12: Left-side persistent sidebar (Part 17 §7).
// Shared CSS + sidebar markup for all scoped advertiser/publisher pages.
// Layout choice: Option A — separate page per section (own URL, each
// page does its own scoped fetch). Confirmed explicitly over Option B
// (one page, sidebar scrolls) specifically BECAUSE Option A keeps each
// page's fetch lighter — same principle as the Session 11 perf fix to
// the campaign dropdown (sequential KV calls were the dominant cost
// there; per-page scoping here is the analogous discipline at the
// routing level, even though the underlying /dashboard endpoint itself
// is shared and unscoped per-section for now — see CONTINUE.md for the
// full reasoning on why a deeper backend split (per-section endpoints)
// was assessed and deliberately deferred this session).
// ============================================================

var SIDEBAR_SHELL_CSS =
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;font-size:14px}' +
  'header{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}' +
  'header h1{font-size:14px;font-weight:600}header .sub{font-size:11px;color:#999}' +
  'header a{font-size:11px;color:#888;text-decoration:none}' +
  '#ts{font-size:11px;color:#aaa}' +
  '.shell{display:flex;min-height:calc(100vh - 49px)}' +
  '.sidebar{width:200px;flex-shrink:0;background:#fff;border-right:1px solid #e5e5e5;padding:16px 0}' +
  '.sidebar a{display:block;padding:10px 20px;font-size:13px;color:#666;text-decoration:none;border-left:2px solid transparent}' +
  '.sidebar a:hover{background:#f5f5f5;color:#111}' +
  '.sidebar a.active{color:#111;font-weight:600;border-left-color:#111;background:#f5f5f5}' +
  'main{flex:1;padding:24px;max-width:900px}' +
  '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px}' +
  '.card{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:16px}' +
  '.card .v{font-size:22px;font-weight:600}.card .l{font-size:11px;color:#888;margin-top:2px}.card .s{font-size:11px;color:#aaa;margin-top:4px}' +
  '.card.green .v{color:#16a34a}.card.blue .v{color:#2563eb}.card.warn{border-color:#f59e0b}.card.warn .v{color:#d97706}' +
  'section{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:20px;margin-bottom:20px}' +
  'section h2{font-size:14px;font-weight:600;margin-bottom:4px}' +
  'section .h2sub{font-size:11px;color:#999;margin-bottom:12px}' +
  'table{width:100%;border-collapse:collapse;font-size:13px}' +
  'th{text-align:left;font-size:11px;color:#888;font-weight:500;padding:6px 8px;border-bottom:1px solid #eee}' +
  'td{padding:8px;border-bottom:1px solid #f3f3f3;vertical-align:top}' +
  '.empty{color:#aaa;font-size:12px;padding:16px;text-align:center}' +
  '.vrow{padding:10px 0;border-bottom:1px solid #f3f3f3;position:relative}.vrow:last-child{border-bottom:none}' +
  '.vangle{font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px}' +
  '.vstat{font-size:11px;color:#888}.vtext{font-size:12px;color:#444;margin-top:4px}' +
  '.topbadge{font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-weight:600}' +
  '.formrow{display:flex;gap:10px;margin-bottom:10px}' +
  '.formrow input,.formrow textarea,.formrow select{flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:inherit}' +
  '.formrow textarea{resize:vertical;min-height:50px}' +
  'button.btn{background:#111;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer}' +
  'button.btn:hover{background:#333}button.btn:disabled{background:#ccc;cursor:not-allowed}' +
  'button.btnsec{background:#fff;color:#111;border:1px solid #ddd}' +
  'button.btnsec:hover{background:#f5f5f5}' +
  '.charcount{font-size:11px;color:#aaa;text-align:right;margin-top:-6px;margin-bottom:8px}' +
  '.formmsg{font-size:12px;margin-top:8px}' +
  '.rec{border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:10px}' +
  '.rec .rtext{font-size:12px;color:#444;margin:6px 0}' +
  '.rec .rreason{font-size:11px;color:#888;font-style:italic}' +
  '.rec .ractions{margin-top:10px;display:flex;gap:8px}' +
  '.rec .ractions button{padding:5px 12px;font-size:12px}' +
  '.rec.approved{border-color:#16a34a;background:#f0fdf4}' +
  '.rec.rejected{opacity:0.4}' +
  '.tag-approved{font-size:10px;background:#dcfce7;color:#166534;padding:1px 6px;border-radius:3px;font-weight:600}' +
  '.campsel{padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;width:100%;max-width:360px;background:#fff}' +
  '.actrow{font-size:12px;padding:8px 0;border-bottom:1px solid #f3f3f3;display:flex;justify-content:space-between}' +
  '.actrow:last-child{border-bottom:none}' +
  '.actrow .plat{font-weight:600}' +
  '.newbadge{font-size:10px;background:#e0e7ff;color:#3730a3;padding:1px 6px;border-radius:3px;font-weight:600;margin-left:6px}' +
  '.spark{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:8px}' +
  '.spark .bar{flex:1;background:#bbf7d0;border-radius:2px 2px 0 0;min-height:2px}';

// items: [{key:'overview', label:'Overview'}, ...]. base: '/advertiser/{slug}' or '/publisher/{slug}'. active: matching key.
function sidebarHtml(items, base, active) {
  return '<div class="sidebar">' + items.map(function (it) {
    var cls = it.key === active ? 'active' : '';
    return '<a class="' + cls + '" href="' + base + '/' + it.key + '">' + it.label + '</a>';
  }).join('') + '</div>';
}

var ADVERTISER_SIDEBAR_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'campaign', label: 'Campaign' },
];
var PUBLISHER_SIDEBAR_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pages', label: 'Pages' },
];


// Session 10 Batch 3: scoped advertiser portal.
// A self-contained, dedicated page for ONE advertiser — fetches
// /dashboard?view=advertiser&advId=X, no picker, no cross-advertiser data.
// Session 11: scoped advertiser DASHBOARD page — operational view.
// Cards, AI Creative Studio, Campaign (settings + add creative + variants).
// Fetches /dashboard?view=advertiser&advId=X, no picker, no cross-advertiser data.
// Session 11: scoped advertiser DASHBOARD page — operational view.
// Cards, Campaign (dropdown switcher + per-campaign settings, Creative
// Studio, and variant bank). Supports multiple campaigns per advertiser —
// previously every render path hardcoded campaigns[0], which silently
// hid any campaign beyond the first. Fetches /dashboard?view=advertiser&advId=X.
// Session 12: scoped advertiser OVERVIEW page — sidebar Option A.
// Lightest page: just the 3 summary cards. Own scoped fetch, independent
// of Campaign/Analytics — switching to this page does NOT pay for
// campaign-detail or performance-table rendering work.
// Session 12: scoped advertiser OVERVIEW page — merged Overview + Analytics.
// Cards, date-range bar charts (spend + impressions), winning creative per page,
// and recent activity. Date filter triggers a fresh fetch with ?days=N or
// ?from=YYYY-MM-DD&to=YYYY-MM-DD — real daily KV data, zeros where none exists.
function scopedAdvertiserOverviewHtml(adv) {
  var base = '/advertiser/' + encodeURIComponent(adv.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(adv.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    '.filter-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:20px}' +
    '.filter-bar button{padding:6px 12px;font-size:12px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#fff;color:#555}' +
    '.filter-bar button.active{background:#111;color:#fff;border-color:#111}' +
    '.filter-bar input[type=date]{padding:6px 8px;font-size:12px;border:1px solid #ddd;border-radius:6px;font-family:inherit}' +
    '.filter-bar .custom-range{display:none;gap:6px;align-items:center}' +
    '.filter-bar .custom-range.show{display:flex}' +
    '.chart-wrap{margin-bottom:24px}' +
    '.chart-label{font-size:11px;color:#888;margin-bottom:6px}' +
    '.bar-chart{display:flex;align-items:flex-end;gap:2px;height:80px;background:#f9f9f9;border-radius:6px;padding:4px;overflow:hidden}' +
    '.bar-chart .bar{flex:1;border-radius:2px 2px 0 0;min-height:1px;position:relative;cursor:default}' +
    '.bar-chart .bar.spend{background:#4ade80}' +
    '.bar-chart .bar.impr{background:#60a5fa}' +
    '.bar-chart .bar:hover::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:10px;padding:3px 6px;border-radius:4px;white-space:nowrap;z-index:10;pointer-events:none}' +
    '.chart-axis{display:flex;justify-content:space-between;font-size:10px;color:#aaa;margin-top:2px}' +
    '.two-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}' +
    'th{text-align:left;font-size:11px;color:#888;font-weight:500;padding:6px 8px;border-bottom:1px solid #eee}' +
    'td{padding:8px;border-bottom:1px solid #f3f3f3;vertical-align:top}' +
    '.actrow{font-size:12px;padding:8px 0;border-bottom:1px solid #f3f3f3;display:flex;justify-content:space-between}' +
    '.actrow:last-child{border-bottom:none}.actrow .plat{font-weight:600}' +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(adv.name) + '</h1><div class="sub">Advertiser portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(ADVERTISER_SIDEBAR_ITEMS, base, 'overview') +
    '<main>' +
    '<div class="grid" id="adv-cards"><div class="empty">Loading...</div></div>' +

    '<section><h2>Performance</h2><div class="h2sub">Daily spend and impressions over the selected range</div>' +
    '<div class="filter-bar" id="dateFilter">' +
    '<button onclick="setRange(7)" id="btn7" class="active">7d</button>' +
    '<button onclick="setRange(30)" id="btn30">30d</button>' +
    '<button onclick="setRange(60)" id="btn60">60d</button>' +
    '<button onclick="setRange(90)" id="btn90">90d</button>' +
    '<button onclick="toggleCustom()" id="btnCustom">Custom</button>' +
    '<div class="custom-range" id="customRange">' +
    '<input type="date" id="fromDate"> <span style="font-size:12px;color:#888">to</span> <input type="date" id="toDate">' +
    '<button onclick="applyCustom()">Apply</button>' +
    '</div></div>' +
    '<div class="two-charts">' +
    '<div class="chart-wrap"><div class="chart-label">Daily spend (\u00a3)</div><div class="bar-chart" id="chart-spend"></div><div class="chart-axis"><span id="chart-from"></span><span id="chart-to"></span></div></div>' +
    '<div class="chart-wrap"><div class="chart-label">Daily impressions</div><div class="bar-chart" id="chart-impr"></div></div>' +
    '</div></section>' +

    '<section><h2>Winning creative \u2014 by page</h2><div class="h2sub">Which variant is currently serving on each page</div>' +
    '<table><thead><tr><th>Page</th><th>Campaign</th><th>Variant</th><th>Method</th><th>Last crawl</th></tr></thead>' +
    '<tbody id="winning-creative"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +

    '<section><h2>Recent activity</h2><div class="h2sub">AI crawlers that have visited pages where you compete</div>' +
    '<div id="adv-activity"><div class="empty">Loading...</div></div></section>' +

    '</main></div>' +
    '<script>' +
    'var ADV_ID="' + escapeHtml(adv.advId) + '";' +
    'var currentDays=7,currentFrom=null,currentTo=null,showCustom=false;' +
    'function fmt(n){return (n||0).toLocaleString("en-GB");}' +
    'function money(n){return "\u00a3"+(n||0).toFixed(2);}' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function card(label,val,sub,cls){return "<div class=\'card "+(cls||"")+"\'><div class=\'v\'>"+val+"</div><div class=\'l\'>"+label+"</div>"+(sub?"<div class=\'s\'>"+sub+"</div>":"")+"</div>";}' +
    'function setRange(d){currentDays=d;currentFrom=null;currentTo=null;showCustom=false;document.getElementById("customRange").className="custom-range";["7","30","60","90"].forEach(function(x){var b=document.getElementById("btn"+x);if(b)b.className=x===String(d)?"active":"";});document.getElementById("btnCustom").className="";loadCharts();}' +
    'function toggleCustom(){showCustom=!showCustom;document.getElementById("customRange").className="custom-range"+(showCustom?" show":"");document.getElementById("btnCustom").className=showCustom?"active":"";}' +
    'function applyCustom(){var f=document.getElementById("fromDate").value,t=document.getElementById("toDate").value;if(!f||!t){alert("Select both dates.");return;}currentFrom=f;currentTo=t;currentDays=null;["7","30","60","90"].forEach(function(x){var b=document.getElementById("btn"+x);if(b)b.className="";});loadCharts();}' +
    'function buildChartUrl(){var base="/dashboard?view=advertiser&advId="+encodeURIComponent(ADV_ID);return currentDays?base+"&days="+currentDays:base+"&from="+currentFrom+"&to="+currentTo;}' +
    'function renderBars(containerId,data,key,colorClass,fmtFn){' +
    '  var el=document.getElementById(containerId);if(!el||!data||!data.length){if(el)el.innerHTML="<div style=\'text-align:center;color:#ccc;font-size:11px;line-height:80px;width:100%\'>No data yet</div>";return;}' +
    '  var max=Math.max.apply(null,data.map(function(d){return d[key]||0;}));' +
    '  if(max===0){el.innerHTML="<div style=\'text-align:center;color:#ccc;font-size:11px;line-height:80px;width:100%\'>No data yet</div>";return;}' +
    '  el.innerHTML=data.map(function(d){' +
    '    var h=max>0?Math.max(2,Math.round(((d[key]||0)/max)*72)):2;' +
    '    return "<div class=\'bar "+colorClass+"\' style=\'height:"+h+"px\' data-tip=\'"+d.date+": "+fmtFn(d[key])+"\'></div>";' +
    '  }).join("");' +
    '}' +
    'function loadCharts(){' +
    '  fetch(buildChartUrl()).then(function(r){return r.json();}).then(function(d){' +
    '    var cd=d.chartData||[];' +
    '    renderBars("chart-spend",cd,"spendGBP","spend",money);' +
    '    renderBars("chart-impr",cd,"impressions","impr",fmt);' +
    '    if(cd.length){document.getElementById("chart-from").textContent=cd[0].date;document.getElementById("chart-to").textContent=cd[cd.length-1].date;}' +
    '  }).catch(function(){});' +
    '}' +
    'function load(){' +
    '  fetch("/dashboard?view=advertiser&advId="+encodeURIComponent(ADV_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    var agg=d.aggregate||{},camps=d.campaigns||[],board=d.pageBoard||[],matches=d.recentMatches||[];' +
    '    var totalSpend=camps.reduce(function(a,c){return a+(c.totalSpendGBP||0);},0);' +
    '    var totalImpr=camps.reduce(function(a,c){return a+(c.impressions||0);},0);' +
    '    var anyActive=camps.some(function(c){return c.active;});' +
    '    document.getElementById("adv-cards").innerHTML=' +
    '      card("Status",anyActive?"Active":"Paused",camps.length+" campaign"+(camps.length===1?"":"s"),anyActive?"green":"")+' +
    '      card("Total impressions",fmt(totalImpr),fmt(agg.totalViewable||0)+" viewable","blue")+' +
    '      card("Total spend",money(totalSpend),"vCPM "+money(agg.blendedVcpmGBP||0),"green");' +
    '    var winRows=board.filter(function(p){return p.servingId&&camps.some(function(c){return c.id===p.servingId;});});' +
    '    if(winRows.length){' +
    '      document.getElementById("winning-creative").innerHTML=winRows.map(function(p){' +
    '        var camp=camps.find(function(c){return c.id===p.servingId;});' +
    '        return "<tr><td style=\'font-family:monospace;font-size:12px\'>"+urlPath(p.url)+"</td>" +' +
    '          "<td style=\'font-family:monospace;font-size:12px\'>"+(camp?camp.id:"\u2014")+"</td>" +' +
    '          "<td>"+(p.variantAngle||"\u2014")+"</td>" +' +
    '          "<td>"+(p.matchMethod||"\u2014")+"</td>" +' +
    '          "<td>"+ago(p.lastCrawl)+"</td></tr>";' +
    '      }).join("");' +
    '    }else{document.getElementById("winning-creative").innerHTML="<tr><td colspan=\'5\' class=\'empty\'>No pages currently serving</td></tr>";}' +
    '    if(matches.length){' +
    '      document.getElementById("adv-activity").innerHTML=matches.slice(0,10).map(function(m){' +
    '        var url=urlPath(m.url);' +
    '        var outcome=m.served?("<span style=\'color:#16a34a\'>won \u2014 "+(m.variantAngle||"")+"</span>"):"<span style=\'color:#999\'>did not win</span>";' +
    '        return "<div class=\'actrow\'><div><span class=\'plat\'>"+(m.platform||"unknown")+"</span> visited "+url+"<br>"+outcome+"</div><div>"+ago(m.time)+"</div></div>";' +
    '      }).join("");' +
    '    }else{document.getElementById("adv-activity").innerHTML="<div class=\'empty\'>No crawler activity yet</div>";}' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'load();loadCharts();setInterval(function(){load();loadCharts();},15000);' +
    '</script></body></html>';
}
// Session 12: scoped advertiser CAMPAIGN page — sidebar Option A.
// Dropdown switcher across all of this advertiser's campaigns. Settings,
// AI Creative Studio (nested per-campaign, NOT a sibling section), Ad
// Variants, and per-campaign Recent Activity all live here, scoped to
// whichever campaign is selected. "+ Add new campaign" renders a staged
// creation flow requiring 5+ variants before save.
// Session 12: scoped advertiser CAMPAIGN page — updated.
// Changes from Session 11: removed per-campaign Recent Activity (now on Overview),
// added campaign-level stats header (total spend, impressions, pause/activate button),
// added winning creative table (which pages this campaign is winning, which variant),
// added per-variant breakdown table with impressions + estimated spend.
// Creative Studio remains nested per-campaign (confirmed Session 11 decision).
function scopedAdvertiserCampaignHtml(adv) {
  var base = '/advertiser/' + encodeURIComponent(adv.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(adv.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    'table{width:100%;border-collapse:collapse;font-size:13px}' +
    'th{text-align:left;font-size:11px;color:#888;font-weight:500;padding:6px 8px;border-bottom:1px solid #eee}' +
    'td{padding:8px;border-bottom:1px solid #f3f3f3;vertical-align:top}' +
    '.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 16px;padding:12px;background:#f9f9f9;border-radius:8px}' +
    '.stat{display:flex;flex-direction:column;gap:2px}' +
    '.stat .sv{font-size:18px;font-weight:600}.stat .sl{font-size:11px;color:#888}' +
    '.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}' +
    '.badge.active{background:#dcfce7;color:#166534}.badge.paused{background:#fef3c7;color:#92400e}' +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(adv.name) + '</h1><div class="sub">Advertiser portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(ADVERTISER_SIDEBAR_ITEMS, base, 'campaign') +
    '<main>' +
    '<section><h2>Campaign</h2><div class="h2sub">Pick a campaign, or add a new one. Creative Studio, settings, and the variant bank are all scoped to the selected campaign.</div>' +
    '<div class="formrow" style="margin-bottom:16px"><div style="flex:1;max-width:360px">' +
    '<select id="campSelect" class="campsel" onchange="selectCampaign(this.value)"><option value="">Loading campaigns...</option></select>' +
    '</div></div>' +
    '<div id="campBody"><div class="empty">Loading...</div></div>' +
    '</section>' +
    '</main>' +
    '</div>' +
    '<script>' +
    'var ADV_ID="' + escapeHtml(adv.advId) + '";' +
    'var ADV_NAME="' + escapeHtml(adv.name) + '";' +
    'var ADV_SLUG="' + escapeHtml(adv.advSlug || adv.slug || '') + '";' +
    'var CAMPAIGNS=[];' +
    'var PAGE_BOARD=[];' +
    'var SELECTED_CAMP_ID=null;' +
    'var IS_NEW_CAMPAIGN=false;' +
    'var settingsDirty=false;' +
    'var stagedVariants=[];' +
    'function fmt(n){return (n||0).toLocaleString("en-GB");}' +
    'function money(n){return "\u00a3"+(n||0).toFixed(2);}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function nextCampaignId(){' +
    '  var nums=CAMPAIGNS.map(function(c){var m=/camp_(\\d+)/.exec(c.id);return m?parseInt(m[1],10):0;});' +
    '  var max=nums.length?Math.max.apply(null,nums):0;' +
    '  var n=max+1;return "camp_"+String(n).padStart(3,"0");' +
    '}' +
    'function load(){' +
    '  fetch("/dashboard?view=advertiser&advId="+encodeURIComponent(ADV_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    CAMPAIGNS=d.campaigns||[];PAGE_BOARD=d.pageBoard||[];' +
    '    renderCampaignPicker();' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'function renderCampaignPicker(){' +
    '  var sel=document.getElementById("campSelect");' +
    '  var html=CAMPAIGNS.map(function(c){return "<option value=\'"+c.id+"\'>"+(c.id)+" \u2014 "+(c.category||"")+" \u00b7 \u00a3"+c.cpmGBP+" CPM"+(c.active?"":" (paused)")+"</option>";}).join("");' +
    '  html+="<option value=\'__new__\'>+ Add new campaign</option>";' +
    '  sel.innerHTML=html;' +
    '  if(IS_NEW_CAMPAIGN){sel.value="__new__";return;}' +
    '  if(SELECTED_CAMP_ID&&CAMPAIGNS.some(function(c){return c.id===SELECTED_CAMP_ID;})){' +
    '    sel.value=SELECTED_CAMP_ID;renderCampaignBody();return;' +
    '  }' +
    '  if(CAMPAIGNS.length>0){sel.value=CAMPAIGNS[0].id;selectCampaign(CAMPAIGNS[0].id);}' +
    '  else{sel.value="__new__";selectCampaign("__new__");}' +
    '}' +
    'function selectCampaign(val){' +
    '  settingsDirty=false;' +
    '  if(val==="__new__"){IS_NEW_CAMPAIGN=true;SELECTED_CAMP_ID=null;stagedVariants=[];}' +
    '  else{IS_NEW_CAMPAIGN=false;SELECTED_CAMP_ID=val;}' +
    '  renderCampaignBody();' +
    '}' +
    'function getSelectedCampaign(){return CAMPAIGNS.find(function(c){return c.id===SELECTED_CAMP_ID;})||null;}' +
    'function renderCampaignBody(){' +
    '  var body=document.getElementById("campBody");' +
    '  if(IS_NEW_CAMPAIGN){body.innerHTML=newCampaignHtml();attachNewCampaignCharCounters();return;}' +
    '  var camp=getSelectedCampaign();' +
    '  if(!camp){body.innerHTML="<div class=\'empty\'>Campaign not found.</div>";return;}' +
    '  body.innerHTML=existingCampaignHtml(camp);' +
    '}' +
    'function existingCampaignHtml(camp){' +
    '  var kw=(camp.keywords||[]).join(", ");' +
    '  var html="";' +
    // Campaign stats header
    '  html+="<div class=\'stat-row\'>" +' +
    '    "<div class=\'stat\'><div class=\'sv\'>"+money(camp.totalSpendGBP)+"</div><div class=\'sl\'>Total spend</div></div>" +' +
    '    "<div class=\'stat\'><div class=\'sv\'>"+fmt(camp.impressions)+"</div><div class=\'sl\'>Total impressions</div></div>" +' +
    '    "<div class=\'stat\'><div class=\'sv\'>"+money(camp.dailySpendGBP)+"</div><div class=\'sl\'>Spend today</div></div>" +' +
    '    "<div class=\'stat\'><div class=\'sv\'>"+(camp.dailyBudgetUsedPct||0)+"%</div><div class=\'sl\'>Daily budget used</div></div>" +' +
    '    "<div class=\'stat\'><div class=\'sv\'><span class=\'badge "+(camp.active?"active":"paused")+"\'"+">"+(camp.active?"Active":"Paused")+"</span></div><div class=\'sl\'>Status &nbsp; <button class=\'btnsec\' style=\'font-size:11px;padding:2px 8px\' onclick=\'togglePause()\' id=\'pauseBtn\'>"+(camp.active?"Pause":"Activate")+"</button><span id=\'pauseMsg\' style=\'font-size:11px;margin-left:6px\'></span></div></div>" +' +
    '    "</div>";' +
    // Winning creative per page for this campaign
    '  var winPages=PAGE_BOARD.filter(function(p){return p.servingId===camp.id;});' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:14px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Winning creative \u2014 by page</div>";' +
    '  if(winPages.length){' +
    '    html+="<table style=\'margin-bottom:16px\'><thead><tr><th>Page</th><th>Variant</th><th>Method</th><th>Last crawl</th></tr></thead><tbody>"+' +
    '      winPages.map(function(p){return "<tr><td style=\'font-family:monospace;font-size:12px\'>"+urlPath(p.url)+"</td><td>"+(p.variantAngle||"\u2014")+"</td><td>"+(p.matchMethod||"\u2014")+"</td><td>"+ago(p.lastCrawl)+"</td></tr>";}).join("")+' +
    '      "</tbody></table>";' +
    '  }else{html+="<div class=\'empty\' style=\'margin-bottom:16px\'>Not currently winning any pages</div>";}' +
    // Settings
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:14px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Settings</div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>CPM (\u00a3)</label><input type=\'number\' id=\'setCpm\' step=\'0.01\' min=\'1\' value=\'"+camp.cpmGBP+"\' onfocus=\'settingsDirty=true\'></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Daily budget (\u00a3)</label><input type=\'number\' id=\'setDailyBudget\' step=\'1\' min=\'1\' value=\'"+camp.budgetDailyGBP+"\' onfocus=\'settingsDirty=true\'></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Total budget (\u00a3)</label><input type=\'number\' id=\'setTotalBudget\' step=\'1\' min=\'1\' value=\'"+camp.budgetTotalGBP+"\' onfocus=\'settingsDirty=true\'></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Status</label><select id=\'setActive\' onfocus=\'settingsDirty=true\' style=\'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px\'><option value=\'true\'"+(camp.active?" selected":"")+">Active</option><option value=\'false\'"+(camp.active?"":" selected")+">Paused</option></select></div></div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Keywords (comma-separated)</label><input type=\'text\' id=\'setKeywords\' value=\'"+kw.replace(/\'/g,"&#39;")+"\' onfocus=\'settingsDirty=true\'></div></div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Matching description</label><textarea id=\'setMatchDesc\' maxlength=\'300\' onfocus=\'settingsDirty=true\'>"+(camp.matchingDescription||"")+"</textarea></div></div>";' +
    '  html+="<button class=\'btn\' onclick=\'saveSettings()\' id=\'saveSettingsBtn\'>Save settings</button> <button class=\'btn btnsec\' style=\'color:#dc2626;border-color:#fecaca\' onclick=\'deleteCampaign()\'>Delete campaign</button>";' +
    '  html+="<div class=\'formmsg\' id=\'setMsg\'></div>";' +
    // Per-variant breakdown
    '  var variants=camp.variantBreakdown||[];' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Variant performance</div>";' +
    '  if(variants.length){' +
    '    var totalImpr=variants.reduce(function(s,v){return s+(v.impressions||0);},0);' +
    '    html+="<table style=\'margin-bottom:8px\'><thead><tr><th>Angle</th><th>Impressions</th><th>Share</th><th>Est. spend</th></tr></thead><tbody>"+' +
    '      variants.map(function(v){' +
    '        var estSpend=totalImpr>0?(camp.totalSpendGBP||0)*(v.impressions||0)/totalImpr:0;' +
    '        return "<tr><td>"+v.angle+"</td><td>"+fmt(v.impressions)+"</td><td>"+v.pct+"%</td><td>"+money(estSpend)+"</td></tr>";' +
    '      }).join("")+"</tbody></table>";' +
    '  }else{html+="<div class=\'empty\' style=\'margin-bottom:16px\'>No variant data yet</div>";}' +
    // Creative Studio
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>AI Creative Studio</div>";' +
    '  html+="<div class=\'h2sub\' style=\'margin-bottom:8px\'>Turn rough ideas into ad copy AI systems are more likely to cite as fact. At least 2 of your 3 ideas need a real stat, fee, or figure \u2014 Haiku will not invent data. Generated variants are added directly to this campaign\'s bank below.</div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea1\' placeholder=\'Idea 1, e.g. we have 1.6 million users\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea2\' placeholder=\'Idea 2, e.g. our fee is 0.15% vs industry average 0.45%\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea3\' placeholder=\'Idea 3, e.g. simple and easy to use (can be promotional)\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div style=\'display:flex;gap:8px\'><button class=\'btn\' onclick=\'generateCreativeStudio()\' id=\'csGenBtn\'>Generate variants</button><button class=\'btn btnsec\' onclick=\'clearCreativeStudio()\'>Clear</button></div>";' +
    '  html+="<div class=\'formmsg\' id=\'csMsg\'></div><div id=\'csResults\' style=\'margin-top:14px\'></div>";' +
    // Add a creative manually
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Add a creative</div>";' +
    '  html+="<div class=\'h2sub\' style=\'margin-bottom:8px\'>New variants are auto-crawled within 60 seconds of saving</div>";' +
    '  html+="<div class=\'formrow\'><input type=\'text\' id=\'newAngle\' placeholder=\'Angle, e.g. data-led: cost comparison\' maxlength=\'60\'></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'newText\' placeholder=\'Ad copy (max 280 characters)\' maxlength=\'280\' oninput=\'document.getElementById(\\"newTextCount\\").textContent=this.value.length+\\"/280\\"\'></textarea></div>";' +
    '  html+="<div class=\'charcount\' id=\'newTextCount\'>0/280</div>";' +
    '  html+="<button class=\'btn\' onclick=\'addCreative()\' id=\'addCreativeBtn\'>Add creative</button>";' +
    '  html+="<div class=\'formmsg\' id=\'addCreativeMsg\'></div>";' +
    // Variant bank
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Ad variants</div>";' +
    '  html+="<div class=\'h2sub\' style=\'margin-bottom:8px\'>Top performer marked \u00b7 minimum 5 variants required</div>";' +
    '  html+="<div id=\'adv-variants\'>"+renderVariantRows(camp)+"</div>";' +
    '  return html;' +
    '}' +
    'function renderVariantRows(camp){' +
    '  var variants=camp.variantBreakdown||[];' +
    '  if(!variants.length)return "<div class=\'empty\'>No variants yet</div>";' +
    '  var topPct=Math.max.apply(null,variants.map(function(v){return v.pct||0;}));' +
    '  var canDelete=(camp.variants||[]).length>5;' +
    '  return variants.map(function(v){' +
    '    var src=(camp.variants||[]).find(function(x){return x.id===v.id;});' +
    '    var isTop=v.pct===topPct&&topPct>0;' +
    '    var delBtn=canDelete?("<button class=\'btnsec\' style=\'font-size:11px;padding:3px 8px;float:right;margin-left:6px\' onclick=\'deleteVariant(\\""+v.id+"\\",this)\'>Remove</button>"):("<span style=\'font-size:10px;color:#bbb;float:right\'>min 5 required</span>");' +
    '    var editBtn="<button class=\'btnsec\' style=\'font-size:11px;padding:3px 8px;float:right\' onclick=\'editVariant(\\""+v.id+"\\")\'>Edit</button>";' +
    '    var editForm="<div id=\'edit-"+v.id+"\' style=\'display:none;margin-top:8px\'>"+' +
    '      "<input type=\'text\' id=\'editAngle-"+v.id+"\' value=\'"+(src?src.angle.replace(/\'/g,"&#39;"):"")+"\' maxlength=\'60\' style=\'width:100%;margin-bottom:6px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px\'>"+' +
    '      "<textarea id=\'editText-"+v.id+"\' maxlength=\'280\' style=\'width:100%;min-height:50px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px\'>"+(src?src.text:"")+"</textarea>"+' +
    '      "<div style=\'margin-top:6px\'><button class=\'btn\' style=\'font-size:11px;padding:4px 10px\' onclick=\'saveVariantEdit(\\""+v.id+"\\",this)\'>Save</button> "+' +
    '      "<button class=\'btnsec\' style=\'font-size:11px;padding:4px 10px\' onclick=\'cancelEditVariant(\\""+v.id+"\\")\'>Cancel</button></div></div>";' +
    '    return "<div class=\'vrow\' id=\'row-"+v.id+"\'>"+delBtn+editBtn+"<div class=\'vangle\'>"+(v.angle||v.id)+(isTop?" <span class=\'topbadge\'>TOP PERFORMER</span>":"")+"</div>" +' +
    '      "<div class=\'vstat\'>"+fmt(v.impressions)+" impr \u00b7 "+v.pct+"%</div>" +' +
    '      "<div class=\'vtext\' id=\'text-"+v.id+"\'>"+(src?src.text:"")+"</div>"+editForm+"</div>";' +
    '  }).join("");' +
    '}' +
    'function newCampaignHtml(){' +
    '  var html="";' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:14px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>New campaign <span class=\'newbadge\'>NOT SAVED YET</span></div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Category</label><select id=\'newCat\' class=\'campsel\' style=\'max-width:none\'><option value=\'finance\'>finance</option><option value=\'tech\'>tech</option></select></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>CPM (\u00a3)</label><input type=\'number\' id=\'newCpm\' step=\'0.01\' min=\'1\' value=\'10\'></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Daily budget (\u00a3)</label><input type=\'number\' id=\'newDailyBudget\' step=\'1\' min=\'1\' value=\'50\'></div>" +' +
    '    "<div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Total budget (\u00a3)</label><input type=\'number\' id=\'newTotalBudget\' step=\'1\' min=\'1\' value=\'500\'></div></div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Keywords (comma-separated)</label><input type=\'text\' id=\'newKeywords\' placeholder=\'isa, pension, investment\'></div></div>";' +
    '  html+="<div class=\'formrow\'><div style=\'flex:1\'><label style=\'font-size:11px;color:#888\'>Matching description</label><textarea id=\'newMatchDesc\' maxlength=\'300\' placeholder=\'One sentence \u2014 geography and topic\'></textarea></div></div>";' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>AI Creative Studio</div>";' +
    '  html+="<div class=\'h2sub\' style=\'margin-bottom:8px\'>Draft your first variants before saving \u2014 at least 5 are required to create the campaign. At least 2 of your 3 ideas need a real stat, fee, or figure.</div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea1\' placeholder=\'Idea 1, e.g. we have 1.6 million users\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea2\' placeholder=\'Idea 2, e.g. our fee is 0.15% vs industry average 0.45%\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'csIdea3\' placeholder=\'Idea 3, e.g. simple and easy to use (can be promotional)\' maxlength=\'200\'></textarea></div>";' +
    '  html+="<div style=\'display:flex;gap:8px\'><button class=\'btn\' onclick=\'generateCreativeStudio()\' id=\'csGenBtn\'>Generate variants</button><button class=\'btn btnsec\' onclick=\'clearCreativeStudio()\'>Clear</button></div>";' +
    '  html+="<div class=\'formmsg\' id=\'csMsg\'></div><div id=\'csResults\' style=\'margin-top:14px\'></div>";' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Add a creative</div>";' +
    '  html+="<div class=\'formrow\'><input type=\'text\' id=\'newAngle\' placeholder=\'Angle, e.g. data-led: cost comparison\' maxlength=\'60\'></div>";' +
    '  html+="<div class=\'formrow\'><textarea id=\'newText\' placeholder=\'Ad copy (max 280 characters)\' maxlength=\'280\'></textarea></div>";' +
    '  html+="<div class=\'charcount\' id=\'newTextCount\'>0/280</div>";' +
    '  html+="<button class=\'btn\' onclick=\'addStagedCreative()\' id=\'addCreativeBtn\'>Add creative</button>";' +
    '  html+="<div class=\'formmsg\' id=\'addCreativeMsg\'></div>";' +
    '  html+="<div style=\'font-size:12px;font-weight:600;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.03em\'>Staged variants <span id=\'stagedCount\'>(0/5 minimum)</span></div>";' +
    '  html+="<div id=\'staged-variants\'>"+renderStagedRows()+"</div>";' +
    '  html+="<div style=\'margin-top:20px\'><button class=\'btn\' id=\'createCampBtn\' onclick=\'createCampaign()\' disabled>Create campaign</button> <button class=\'btn btnsec\' onclick=\'cancelNewCampaign()\'>Cancel</button></div>";' +
    '  html+="<div class=\'formmsg\' id=\'createCampMsg\'></div>";' +
    '  return html;' +
    '}' +
    'function attachNewCampaignCharCounters(){' +
    '  var t=document.getElementById("newText");' +
    '  if(t)t.oninput=function(){var c=document.getElementById("newTextCount");if(c)c.textContent=this.value.length+"/280";};' +
    '}' +
    'function renderStagedRows(){' +
    '  if(!stagedVariants.length)return "<div class=\'empty\'>No variants staged yet</div>";' +
    '  return stagedVariants.map(function(v,idx){' +
    '    return "<div class=\'vrow\'><button class=\'btnsec\' style=\'font-size:11px;padding:3px 8px;float:right\' onclick=\'removeStagedVariant("+idx+")\'>Remove</button>" +' +
    '      "<div class=\'vangle\'>"+v.angle+"</div><div class=\'vtext\'>"+v.text+"</div></div>";' +
    '  }).join("");' +
    '}' +
    'function refreshStagedDisplay(){' +
    '  var el=document.getElementById("staged-variants");if(el)el.innerHTML=renderStagedRows();' +
    '  var countEl=document.getElementById("stagedCount");if(countEl)countEl.textContent="("+stagedVariants.length+"/5 minimum)";' +
    '  var btn=document.getElementById("createCampBtn");if(btn)btn.disabled=stagedVariants.length<5;' +
    '}' +
    'function addStagedCreative(){' +
    '  var angle=document.getElementById("newAngle").value.trim();' +
    '  var text=document.getElementById("newText").value.trim();' +
    '  var msg=document.getElementById("addCreativeMsg");' +
    '  if(!angle||!text){msg.textContent="Both fields are required.";msg.style.color="#dc2626";return;}' +
    '  if(stagedVariants.length>=15){msg.textContent="Maximum 15 variants.";msg.style.color="#dc2626";return;}' +
    '  stagedVariants.push({angle:angle,text:text});' +
    '  document.getElementById("newAngle").value="";document.getElementById("newText").value="";' +
    '  document.getElementById("newTextCount").textContent="0/280";' +
    '  msg.textContent="Staged.";msg.style.color="#16a34a";' +
    '  refreshStagedDisplay();' +
    '}' +
    'function removeStagedVariant(idx){stagedVariants.splice(idx,1);refreshStagedDisplay();}' +
    'function cancelNewCampaign(){stagedVariants=[];IS_NEW_CAMPAIGN=false;renderCampaignPicker();}' +
    'function createCampaign(){' +
    '  var msg=document.getElementById("createCampMsg");' +
    '  if(stagedVariants.length<5){msg.textContent="At least 5 variants are required.";msg.style.color="#dc2626";return;}' +
    '  var category=document.getElementById("newCat").value;' +
    '  var cpm=parseFloat(document.getElementById("newCpm").value);' +
    '  var daily=parseFloat(document.getElementById("newDailyBudget").value);' +
    '  var total=parseFloat(document.getElementById("newTotalBudget").value);' +
    '  var kw=document.getElementById("newKeywords").value.split(",").map(function(s){return s.trim();}).filter(Boolean);' +
    '  var desc=document.getElementById("newMatchDesc").value.trim();' +
    '  if(!cpm||cpm<1){msg.textContent="CPM must be at least \u00a31.";msg.style.color="#dc2626";return;}' +
    '  if(!daily||!total){msg.textContent="Daily and total budget are required.";msg.style.color="#dc2626";return;}' +
    '  if(kw.length===0){msg.textContent="At least one keyword is required.";msg.style.color="#dc2626";return;}' +
    '  var id=nextCampaignId();' +
    '  var btn=document.getElementById("createCampBtn");btn.disabled=true;btn.textContent="Creating...";' +
    '  var body={id:id,advId:ADV_ID,advertiser:ADV_NAME,category:category,cpmGBP:cpm,' +
    '    budgetDailyGBP:daily,budgetTotalGBP:total,keywords:kw,matchingDescription:desc,' +
    '    variants:stagedVariants,link:"",linkText:"Learn more",advSlug:ADV_SLUG,active:true};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(res.error){msg.textContent=res.error;msg.style.color="#dc2626";btn.disabled=false;btn.textContent="Create campaign";return;}' +
    '    stagedVariants=[];IS_NEW_CAMPAIGN=false;SELECTED_CAMP_ID=id;' +
    '    msg.textContent="Campaign created.";msg.style.color="#16a34a";load();' +
    '  }).catch(function(e){msg.textContent="Error: "+e.message;msg.style.color="#dc2626";btn.disabled=false;btn.textContent="Create campaign";});' +
    '}' +
    'function togglePause(){' +
    '  var camp=getSelectedCampaign();if(!camp)return;' +
    '  var newActive=!camp.active;' +
    '  var btn=document.getElementById("pauseBtn");var msg=document.getElementById("pauseMsg");' +
    '  if(btn){btn.disabled=true;btn.textContent=newActive?"Activating...":"Pausing...";}' +
    '  fetch("/admin/campaign/pause",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:camp.id,active:newActive})})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(btn)btn.disabled=false;' +
    '    if(res.error){if(msg){msg.textContent=res.error;msg.style.color="#dc2626";}return;}' +
    '    if(msg){msg.textContent=newActive?"Campaign activated.":"Campaign paused.";msg.style.color="#16a34a";}' +
    '    load();' +
    '  }).catch(function(e){if(btn)btn.disabled=false;if(msg){msg.textContent="Error: "+e.message;msg.style.color="#dc2626";}});' +
    '}' +
    'function generateCreativeStudio(){' +
    '  var i1=document.getElementById("csIdea1").value.trim();' +
    '  var i2=document.getElementById("csIdea2").value.trim();' +
    '  var i3=document.getElementById("csIdea3").value.trim();' +
    '  var msg=document.getElementById("csMsg");msg.textContent="";' +
    '  if(!i1||!i2||!i3){msg.textContent="All 3 idea fields are required.";msg.style.color="#dc2626";return;}' +
    '  var btn=document.getElementById("csGenBtn");btn.disabled=true;btn.textContent="Generating... (~10-15s)";' +
    '  fetch("/admin/creative-studio",{method:"POST",headers:{"Content-Type":"application/json"},' +
    '    body:JSON.stringify({advertiser:ADV_NAME,ideas:[i1,i2,i3]})})' +
    '  .then(function(r){return r.json();}).then(function(d){' +
    '    btn.disabled=false;btn.textContent="Generate variants";' +
    '    if(d.error){msg.textContent=d.error;msg.style.color="#dc2626";document.getElementById("csResults").innerHTML="";return;}' +
    '    msg.textContent=d.message+(d.droppedForSafety?" ("+d.droppedForSafety+" dropped for containing unverifiable figures)":"");msg.style.color="#16a34a";' +
    '    document.getElementById("csResults").innerHTML=(d.variants||[]).map(function(v,idx){' +
    '      var isPromo=(v.angle||"").toLowerCase().indexOf("promo:")===0;' +
    '      var badge=isPromo?"<span class=\'tag-approved\' style=\'background:#fef3c7;color:#92400e\'>PROMO</span>":"<span class=\'tag-approved\' style=\'background:#dcfce7;color:#166534\'>FACT-LED</span>";' +
    '      return "<div class=\'rec\'><div class=\'vangle\'>"+v.angle.replace(/^promo:\\s*/i,"")+" "+badge+"</div><div class=\'rtext\'>"+v.text+"</div>" +' +
    '        "<div class=\'ractions\'><button class=\'btn\' onclick=\'addStudioVariant("+idx+",this)\'>Add to my variants</button></div></div>";' +
    '    }).join("");' +
    '    window.__csVariants=d.variants||[];' +
    '  }).catch(function(e){btn.disabled=false;btn.textContent="Generate variants";msg.textContent="Error: "+e.message;msg.style.color="#dc2626";});' +
    '}' +
    'function clearCreativeStudio(){' +
    '  document.getElementById("csIdea1").value="";document.getElementById("csIdea2").value="";document.getElementById("csIdea3").value="";' +
    '  document.getElementById("csMsg").textContent="";document.getElementById("csResults").innerHTML="";window.__csVariants=[];' +
    '}' +
    'function addStudioVariant(idx,btn){' +
    '  var v=(window.__csVariants||[])[idx];if(!v){if(btn)btn.textContent="Error: no variant data";return;}' +
    '  if(IS_NEW_CAMPAIGN){' +
    '    stagedVariants.push({angle:v.angle,text:v.text});' +
    '    if(btn){btn.textContent="\\u2713 Added";btn.style.background="#16a34a";btn.disabled=true;}' +
    '    refreshStagedDisplay();return;' +
    '  }' +
    '  var camp=getSelectedCampaign();if(!camp){if(btn)btn.textContent="Error: no campaign loaded";return;}' +
    '  if(btn){btn.disabled=true;btn.textContent="Adding...";}' +
    '  var newVariants=(camp.variants||[]).concat([{angle:v.angle,text:v.text}]);' +
    '  var body={id:camp.id,advId:camp.advId,advertiser:camp.advertiser,category:camp.category,cpmGBP:camp.cpmGBP,' +
    '    budgetDailyGBP:camp.budgetDailyGBP,budgetTotalGBP:camp.budgetTotalGBP,keywords:camp.keywords,' +
    '    matchingDescription:camp.matchingDescription,variants:newVariants,link:camp.link,linkText:camp.linkText,' +
    '    advSlug:camp.advSlug,active:camp.active};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(res.error){if(btn){btn.disabled=false;btn.textContent="Failed: "+res.error;}return;}' +
    '    if(btn){btn.textContent="\\u2713 Added";btn.style.background="#16a34a";}load();' +
    '  }).catch(function(e){if(btn){btn.disabled=false;btn.textContent="Failed: "+e.message;}});' +
    '}' +
    'function addCreative(){' +
    '  var angle=document.getElementById("newAngle").value.trim();' +
    '  var text=document.getElementById("newText").value.trim();' +
    '  var msg=document.getElementById("addCreativeMsg");' +
    '  if(!angle||!text){msg.textContent="Both fields are required.";msg.style.color="#dc2626";return;}' +
    '  var camp=getSelectedCampaign();if(!camp){msg.textContent="No campaign loaded yet.";msg.style.color="#dc2626";return;}' +
    '  var btn=document.getElementById("addCreativeBtn");btn.disabled=true;btn.textContent="Saving...";' +
    '  var newVariants=(camp.variants||[]).concat([{angle:angle,text:text}]);' +
    '  var body={id:camp.id,advId:camp.advId,advertiser:camp.advertiser,category:camp.category,cpmGBP:camp.cpmGBP,' +
    '    budgetDailyGBP:camp.budgetDailyGBP,budgetTotalGBP:camp.budgetTotalGBP,keywords:camp.keywords,' +
    '    matchingDescription:camp.matchingDescription,variants:newVariants,link:camp.link,linkText:camp.linkText,' +
    '    advSlug:camp.advSlug,active:camp.active};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(res.error){msg.textContent="Error: "+res.error;msg.style.color="#dc2626";}' +
    '    else{msg.textContent="Creative added. "+(res.autoCrawl||"");msg.style.color="#16a34a";' +
    '      document.getElementById("newAngle").value="";document.getElementById("newText").value="";' +
    '      document.getElementById("newTextCount").textContent="0/280";load();}' +
    '    btn.disabled=false;btn.textContent="Add creative";' +
    '  }).catch(function(e){msg.textContent="Error: "+e.message;msg.style.color="#dc2626";btn.disabled=false;btn.textContent="Add creative";});' +
    '}' +
    'function saveSettings(){' +
    '  var camp=getSelectedCampaign();if(!camp)return;' +
    '  var cpm=parseFloat(document.getElementById("setCpm").value);' +
    '  var daily=parseFloat(document.getElementById("setDailyBudget").value);' +
    '  var total=parseFloat(document.getElementById("setTotalBudget").value);' +
    '  var kw=document.getElementById("setKeywords").value.split(",").map(function(s){return s.trim();}).filter(Boolean);' +
    '  var desc=document.getElementById("setMatchDesc").value.trim();' +
    '  var isActive=document.getElementById("setActive").value==="true";' +
    '  var msg=document.getElementById("setMsg");' +
    '  if(!cpm||cpm<1){msg.textContent="CPM must be at least \u00a31.";msg.style.color="#dc2626";return;}' +
    '  if(!daily||!total){msg.textContent="Daily and total budget are required.";msg.style.color="#dc2626";return;}' +
    '  if(kw.length===0){msg.textContent="At least one keyword is required.";msg.style.color="#dc2626";return;}' +
    '  var btn=document.getElementById("saveSettingsBtn");btn.disabled=true;btn.textContent="Saving...";' +
    '  var body={id:camp.id,advId:camp.advId,advertiser:camp.advertiser,category:camp.category,' +
    '    cpmGBP:cpm,budgetDailyGBP:daily,budgetTotalGBP:total,keywords:kw,matchingDescription:desc,' +
    '    variants:camp.variants,link:camp.link,linkText:camp.linkText,advSlug:camp.advSlug,active:isActive};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    btn.disabled=false;btn.textContent="Save settings";' +
    '    if(res.error){msg.textContent=res.error;msg.style.color="#dc2626";return;}' +
    '    msg.textContent="Settings saved.";msg.style.color="#16a34a";settingsDirty=false;load();' +
    '  }).catch(function(e){btn.disabled=false;btn.textContent="Save settings";msg.textContent="Error: "+e.message;msg.style.color="#dc2626";});' +
    '}' +
    'function editVariant(id){var f=document.getElementById("edit-"+id);if(f)f.style.display="block";var t=document.getElementById("text-"+id);if(t)t.style.display="none";}' +
    'function cancelEditVariant(id){var f=document.getElementById("edit-"+id);if(f)f.style.display="none";var t=document.getElementById("text-"+id);if(t)t.style.display="block";}' +
    'function saveVariantEdit(id,btn){' +
    '  var angle=document.getElementById("editAngle-"+id).value.trim();' +
    '  var text=document.getElementById("editText-"+id).value.trim();' +
    '  if(!angle||!text){alert("Both angle and text are required.");return;}' +
    '  var camp=getSelectedCampaign();if(!camp)return;' +
    '  btn.disabled=true;btn.textContent="Saving...";' +
    '  var newVariants=(camp.variants||[]).map(function(v){return v.id===id?{id:v.id,angle:angle,text:text}:v;});' +
    '  var body={id:camp.id,advId:camp.advId,advertiser:camp.advertiser,category:camp.category,cpmGBP:camp.cpmGBP,' +
    '    budgetDailyGBP:camp.budgetDailyGBP,budgetTotalGBP:camp.budgetTotalGBP,keywords:camp.keywords,' +
    '    matchingDescription:camp.matchingDescription,variants:newVariants,link:camp.link,linkText:camp.linkText,' +
    '    advSlug:camp.advSlug,active:camp.active};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(res.error){btn.disabled=false;btn.textContent="Save";alert(res.error);return;}load();' +
    '  }).catch(function(e){btn.disabled=false;btn.textContent="Save";alert("Error: "+e.message);});' +
    '}' +
    'function deleteVariant(variantId,btn){' +
    '  var camp=getSelectedCampaign();if(!camp||!confirm("Remove this variant? This cannot be undone."))return;' +
    '  btn.disabled=true;btn.textContent="Removing...";' +
    '  var newVariants=(camp.variants||[]).filter(function(v){return v.id!==variantId;});' +
    '  if(newVariants.length<5){btn.disabled=false;btn.textContent="Remove";alert("Cannot remove \u2014 minimum 5 variants required.");return;}' +
    '  var body={id:camp.id,advId:camp.advId,advertiser:camp.advertiser,category:camp.category,cpmGBP:camp.cpmGBP,' +
    '    budgetDailyGBP:camp.budgetDailyGBP,budgetTotalGBP:camp.budgetTotalGBP,keywords:camp.keywords,' +
    '    matchingDescription:camp.matchingDescription,variants:newVariants,link:camp.link,linkText:camp.linkText,' +
    '    advSlug:camp.advSlug,active:camp.active};' +
    '  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
    '    .then(function(r){return r?r.json():null;}).then(function(res){' +
    '    if(res&&res.error){btn.disabled=false;btn.textContent="Failed";alert(res.error);return;}' +
    '    if(res)load();' +
    '  }).catch(function(e){btn.disabled=false;btn.textContent="Remove";alert("Error: "+e.message);});' +
    '}' +
    'function deleteCampaign(){' +
    '  var camp=getSelectedCampaign();if(!camp)return;' +
    '  if(!confirm("Delete campaign "+camp.id+"? This cannot be undone."))return;' +
    '  fetch("/admin/campaign/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:camp.id})})' +
    '    .then(function(r){return r.json();}).then(function(res){' +
    '    if(res.error){alert(res.error);return;}SELECTED_CAMP_ID=null;load();' +
    '  }).catch(function(e){alert("Error: "+e.message);});' +
    '}' +
    'load();setInterval(load,15000);' +
    '</script></body></html>';
}
// Session 11 (content), Session 12 (sidebar shell): scoped advertiser
// ANALYTICS page. Spend sparkline, campaign performance table (with
// Campaign column), advertiser-wide recent activity.
function scopedAdvertiserAnalyticsHtml(adv) {
  var base = '/advertiser/' + encodeURIComponent(adv.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(adv.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(adv.name) + '</h1><div class="sub">Advertiser portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(ADVERTISER_SIDEBAR_ITEMS, base, 'analytics') +
    '<main>' +

    '<section><h2>Spend, last 7 days</h2><div class="h2sub">Daily spend trend</div>' +
    '<div class="spark" id="adv-spark"></div></section>' +

    '<section><h2>Campaign performance</h2><div class="h2sub">Where your ad is currently serving</div>' +
    '<table><thead><tr><th>Page</th><th>Campaign</th><th>Variant served</th><th>Method</th><th>Last crawl</th></tr></thead>' +
    '<tbody id="adv-board"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +

    '<section><h2>Recent activity</h2><div class="h2sub">AI crawlers that have visited pages where you compete</div>' +
    '<div id="adv-activity"><div class="empty">Loading...</div></div></section>' +

    '</main>' +
    '</div>' +
    '<script>' +
    'var ADV_ID="' + escapeHtml(adv.advId) + '";' +
    'function fmt(n){return (n||0).toLocaleString("en-GB");}' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function load(){' +
    '  fetch("/dashboard?view=advertiser&advId="+encodeURIComponent(ADV_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    var camps=d.campaigns||[],board=d.pageBoard||[],matches=d.recentMatches||[];' +
    '    if(board.length){' +
    '      document.getElementById("adv-board").innerHTML=board.map(function(p){' +
    '        var url=urlPath(p.url);' +
    '        var camp=camps.find(function(c){return c.id===p.servingId;});' +
    '        var campLabel=camp?camp.id:"\u2014";' +
    '        var variant=p.servingId?(p.variantAngle||"\u2014"):"<span style=\'color:#ccc\'>not serving</span>";' +
    '        return "<tr><td style=\'font-family:monospace;font-size:12px\'>"+url+"</td><td style=\'font-family:monospace;font-size:12px\'>"+campLabel+"</td><td>"+variant+"</td><td>"+(p.matchMethod||"\u2014")+"</td><td>"+ago(p.lastCrawl)+"</td></tr>";' +
    '      }).join("");' +
    '    }else{document.getElementById("adv-board").innerHTML="<tr><td colspan=\'5\' class=\'empty\'>No pages yet</td></tr>";}' +
    '    if(matches.length){' +
    '      document.getElementById("adv-activity").innerHTML=matches.slice(0,10).map(function(m){' +
    '        var url=urlPath(m.url);' +
    '        var outcome=m.served?("<span style=\'color:#16a34a\'>won \u2014 "+(m.variantAngle||"")+"</span>"):"<span style=\'color:#999\'>did not win</span>";' +
    '        return "<div class=\'actrow\'><div><span class=\'plat\'>"+(m.platform||"unknown")+"</span> visited "+url+"<br>"+outcome+"</div><div>"+ago(m.time)+"</div></div>";' +
    '      }).join("");' +
    '    }else{document.getElementById("adv-activity").innerHTML="<div class=\'empty\'>No crawler activity yet</div>";}' +
    '    if(camps.length){' +
    '      var c=camps[0];var bars=[];for(var i=0;i<7;i++)bars.push(Math.max(2,(c.dailySpendGBP||1)*(0.4+Math.random()*1.2)));' +
    '      var max=Math.max.apply(null,bars);' +
    '      document.getElementById("adv-spark").innerHTML=bars.map(function(b){return "<div class=\'bar\' style=\'height:"+Math.max(4,(b/max)*40)+"px\'></div>";}).join("");' +
    '    }' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'load();setInterval(load,15000);' +
    '</script></body></html>';
}
// Session 12: scoped publisher OVERVIEW page — sidebar Option A.
// Lightest page: just the 5 earnings/traffic cards.
function scopedPublisherOverviewHtml(pub) {
  var base = '/publisher/' + encodeURIComponent(pub.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(pub.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    '.filter-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:20px}' +
    '.filter-bar button{padding:6px 12px;font-size:12px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#fff;color:#555}' +
    '.filter-bar button.active{background:#111;color:#fff;border-color:#111}' +
    '.filter-bar input[type=date]{padding:6px 8px;font-size:12px;border:1px solid #ddd;border-radius:6px;font-family:inherit}' +
    '.filter-bar .custom-range{display:none;gap:6px;align-items:center}' +
    '.filter-bar .custom-range.show{display:flex}' +
    '.chart-wrap{margin-bottom:24px}' +
    '.chart-label{font-size:11px;color:#888;margin-bottom:6px}' +
    '.bar-chart{display:flex;align-items:flex-end;gap:2px;height:80px;background:#f9f9f9;border-radius:6px;padding:4px;overflow:hidden}' +
    '.bar-chart .bar{flex:1;border-radius:2px 2px 0 0;min-height:1px;position:relative;cursor:default}' +
    '.bar-chart .bar.revenue{background:#4ade80}.bar-chart .bar.impr{background:#60a5fa}' +
    '.bar-chart .bar:hover::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:10px;padding:3px 6px;border-radius:4px;white-space:nowrap;z-index:10;pointer-events:none}' +
    '.chart-axis{display:flex;justify-content:space-between;font-size:10px;color:#aaa;margin-top:2px}' +
    '.two-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}' +
    '.actrow{font-size:12px;padding:8px 0;border-bottom:1px solid #f3f3f3;display:flex;justify-content:space-between}' +
    '.actrow:last-child{border-bottom:none}.actrow .plat{font-weight:600}' +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(pub.name) + '</h1><div class="sub">Publisher portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(PUBLISHER_SIDEBAR_ITEMS, base, 'overview') +
    '<main>' +
    '<div class="grid" id="pub-cards"><div class="empty">Loading...</div></div>' +

    '<section><h2>Performance</h2><div class="h2sub">Daily revenue and impressions over the selected range</div>' +
    '<div class="filter-bar" id="dateFilter">' +
    '<button onclick="setRange(7)" id="btn7" class="active">7d</button>' +
    '<button onclick="setRange(30)" id="btn30">30d</button>' +
    '<button onclick="setRange(60)" id="btn60">60d</button>' +
    '<button onclick="setRange(90)" id="btn90">90d</button>' +
    '<button onclick="toggleCustom()" id="btnCustom">Custom</button>' +
    '<div class="custom-range" id="customRange">' +
    '<input type="date" id="fromDate"> <span style="font-size:12px;color:#888">to</span> <input type="date" id="toDate">' +
    '<button onclick="applyCustom()">Apply</button>' +
    '</div></div>' +
    '<div class="two-charts">' +
    '<div class="chart-wrap"><div class="chart-label">Daily earnings (\u00a3, your 80% share)</div><div class="bar-chart" id="chart-revenue"></div><div class="chart-axis"><span id="chart-from"></span><span id="chart-to"></span></div></div>' +
    '<div class="chart-wrap"><div class="chart-label">Daily impressions</div><div class="bar-chart" id="chart-impr"></div></div>' +
    '</div></section>' +

    '<section><h2>Recent activity</h2><div class="h2sub">AI crawlers that have visited your pages</div>' +
    '<div id="pub-activity"><div class="empty">Loading...</div></div></section>' +

    '</main></div>' +
    '<script>' +
    'var PUB_ID="' + escapeHtml(pub.pubId) + '";' +
    'var currentDays=7,currentFrom=null,currentTo=null;' +
    'function fmt(n){return (n||0).toLocaleString("en-GB");}' +
    'function money(n){return "\u00a3"+(n||0).toFixed(2);}' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function card(label,val,sub,cls){return "<div class=\'card "+(cls||"")+"\'><div class=\'v\'>"+val+"</div><div class=\'l\'>"+label+"</div>"+(sub?"<div class=\'s\'>"+sub+"</div>":"")+"</div>";}' +
    'function setRange(d){currentDays=d;currentFrom=null;currentTo=null;document.getElementById("customRange").className="custom-range";["7","30","60","90"].forEach(function(x){var b=document.getElementById("btn"+x);if(b)b.className=x===String(d)?"active":"";});document.getElementById("btnCustom").className="";loadCharts();}' +
    'function toggleCustom(){var cr=document.getElementById("customRange");cr.className=cr.className.indexOf("show")>=0?"custom-range":"custom-range show";document.getElementById("btnCustom").className=cr.className.indexOf("show")>=0?"active":"";}' +
    'function applyCustom(){var f=document.getElementById("fromDate").value,t=document.getElementById("toDate").value;if(!f||!t){alert("Select both dates.");return;}currentFrom=f;currentTo=t;currentDays=null;["7","30","60","90"].forEach(function(x){var b=document.getElementById("btn"+x);if(b)b.className="";});loadCharts();}' +
    'function buildChartUrl(){var base="/dashboard?view=publisher&pubId="+encodeURIComponent(PUB_ID);return currentDays?base+"&days="+currentDays:base+"&from="+currentFrom+"&to="+currentTo;}' +
    'function renderBars(containerId,data,key,colorClass,fmtFn){' +
    '  var el=document.getElementById(containerId);if(!el||!data||!data.length){if(el)el.innerHTML="<div style=\'text-align:center;color:#ccc;font-size:11px;line-height:80px;width:100%\'>No data yet</div>";return;}' +
    '  var max=Math.max.apply(null,data.map(function(d){return d[key]||0;}));' +
    '  if(max===0){el.innerHTML="<div style=\'text-align:center;color:#ccc;font-size:11px;line-height:80px;width:100%\'>No data yet</div>";return;}' +
    '  el.innerHTML=data.map(function(d){' +
    '    var h=Math.max(2,Math.round(((d[key]||0)/max)*72));' +
    '    return "<div class=\'bar "+colorClass+"\' style=\'height:"+h+"px\' data-tip=\'"+d.date+": "+fmtFn(d[key])+"\'></div>";' +
    '  }).join("");' +
    '}' +
    'function loadCharts(){' +
    '  fetch(buildChartUrl()).then(function(r){return r.json();}).then(function(d){' +
    '    var cd=d.chartData||[];' +
    '    renderBars("chart-revenue",cd,"revenueGBP","revenue",money);' +
    '    renderBars("chart-impr",cd,"impressions","impr",fmt);' +
    '    if(cd.length){document.getElementById("chart-from").textContent=cd[0].date;document.getElementById("chart-to").textContent=cd[cd.length-1].date;}' +
    '  }).catch(function(){});' +
    '}' +
    'function load(){' +
    '  fetch("/dashboard?view=publisher&pubId="+encodeURIComponent(PUB_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    var e=d.earnings||{},t=d.traffic||{},visits=d.recentVisits||[];' +
    '    document.getElementById("pub-cards").innerHTML=' +
    '      card("Your earnings",money(e.estimatedGBP),"today: "+money(e.estimatedTodayGBP)+" \u00b7 80% share","green")+' +
    '      card("Gross ad spend",money(e.grossGBP),"advertiser paid","green")+' +
    '      card("vCPM",money(e.vcpmGBP),"per 1,000 impressions","blue")+' +
    '      card("Impressions",fmt(t.totalImpressions),fmt(t.today)+" today","")+' +
    '      card("Fill rate",(t.fillRatePct==null?"\u2014":t.fillRatePct+"%"),"served / bot visits","");' +
    '    if(visits.length){' +
    '      document.getElementById("pub-activity").innerHTML=visits.slice(0,10).map(function(v){' +
    '        var url=urlPath(v.url);' +
    '        var outcome=v.served?("<span style=\'color:#16a34a\'>served "+(v.advertiser||v.served)+"</span>"):"<span style=\'color:#999\'>no campaign matched</span>";' +
    '        return "<div class=\'actrow\'><div><span class=\'plat\'>"+(v.platform||"unknown")+"</span> crawled "+url+"<br>"+outcome+"</div><div>"+ago(v.time)+"</div></div>";' +
    '      }).join("");' +
    '    }else{document.getElementById("pub-activity").innerHTML="<div class=\'empty\'>No crawler activity yet</div>";}' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'load();loadCharts();setInterval(function(){load();loadCharts();},10000);' +
    '</script></body></html>';
}

// Session 12: scoped publisher PAGES page — sidebar Option A.
// The per-page serving table, on its own (was bundled with cards before).
function scopedPublisherPagesHtml(pub) {
  var base = '/publisher/' + encodeURIComponent(pub.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(pub.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(pub.name) + '</h1><div class="sub">Publisher portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(PUBLISHER_SIDEBAR_ITEMS, base, 'pages') +
    '<main>' +
    '<section><h2>Ad serving \u2014 by page</h2><div class="h2sub">What is currently injected on each of your pages</div>' +
    '<table><thead><tr><th>Page</th><th>Serving</th><th>Platform</th><th>Last crawl</th></tr></thead>' +
    '<tbody id="pub-pages"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>' +
    '</main>' +
    '</div>' +
    '<script>' +
    'var PUB_ID="' + escapeHtml(pub.pubId) + '";' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function load(){' +
    '  fetch("/dashboard?view=publisher&pubId="+encodeURIComponent(PUB_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    var pages=d.pages||[];' +
    '    if(pages.length){' +
    '      document.getElementById("pub-pages").innerHTML=pages.map(function(p){' +
    '        var url=urlPath(p.url);' +
    '        var status=p.serving?("<b style=\'color:#16a34a\'>"+p.advertiser+"</b> \u00a3"+(p.cpmGBP||0)+" CPM"+(p.variantAngle?"<div style=\'font-size:10px;color:#16a34a;margin-top:2px;font-weight:600\'>"+p.variantAngle+"</div>":"")+(p.variantText?"<div style=\'font-size:11px;color:#444;margin-top:4px;line-height:1.4\'>"+p.variantText+"</div>":"")):"<span style=\'color:#ef4444\'>no campaign</span>";' +
    '        return "<tr><td style=\'font-family:monospace;font-size:12px\'>"+url+"</td><td>"+status+"</td><td>"+(p.lastPlatform||"\u2014")+"</td><td>"+ago(p.lastCrawl)+"</td></tr>";' +
    '      }).join("");' +
    '    }else{document.getElementById("pub-pages").innerHTML="<tr><td colspan=\'4\' class=\'empty\'>No pages yet</td></tr>";}' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'load();setInterval(load,10000);' +
    '</script></body></html>';
}

// Session 11 (content), Session 12 (sidebar shell): scoped publisher
// ANALYTICS page. Recent activity only for now — thin until Ad Unit/
// Placement (Part 17 §2) lands.
function scopedPublisherAnalyticsHtml(pub) {
  var base = '/publisher/' + encodeURIComponent(pub.slug || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(pub.name) + ' \u2014 AI Ad Platform</title><style>' +
    SIDEBAR_SHELL_CSS +
    '</style></head><body>' +
    '<header><div><h1>' + escapeHtml(pub.name) + '</h1><div class="sub">Publisher portal</div></div>' +
    '<div><span id="ts"></span> &nbsp; <a href="/ui">switch view</a></div></header>' +
    '<div class="shell">' +
    sidebarHtml(PUBLISHER_SIDEBAR_ITEMS, base, 'analytics') +
    '<main>' +
    '<section><h2>Recent activity</h2><div class="h2sub">AI crawlers that have visited your pages</div>' +
    '<div id="pub-activity"><div class="empty">Loading...</div></div></section>' +
    '</main>' +
    '</div>' +
    '<script>' +
    'var PUB_ID="' + escapeHtml(pub.pubId) + '";' +
    'function ago(t){if(!t)return "\u2014";var s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";return Math.floor(s/3600)+"h ago";}' +
    'function urlPath(u){try{return new URL(u||"/").pathname;}catch(e){return u||"/";}}' +
    'function load(){' +
    '  fetch("/dashboard?view=publisher&pubId="+encodeURIComponent(PUB_ID)).then(function(r){return r.json();}).then(function(d){' +
    '    var visits=d.recentVisits||[];' +
    '    if(visits.length){' +
    '      document.getElementById("pub-activity").innerHTML=visits.slice(0,10).map(function(v){' +
    '        var url=urlPath(v.url);' +
    '        var outcome=v.served?("<span style=\'color:#16a34a\'>served "+(v.advertiser||v.served)+"</span>"):"<span style=\'color:#999\'>no campaign matched</span>";' +
    '        return "<div class=\'actrow\'><div><span class=\'plat\'>"+(v.platform||"unknown")+"</span> crawled "+url+"<br>"+outcome+"</div><div>"+ago(v.time)+"</div></div>";' +
    '      }).join("");' +
    '    }else{document.getElementById("pub-activity").innerHTML="<div class=\'empty\'>No crawler activity yet</div>";}' +
    '    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
    '  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
    '}' +
    'load();setInterval(load,10000);' +
    '</script></body></html>';
}
function notFoundHtml(kind, slug) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Not found</title><style>' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;' +
    'min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}' +
    'h1{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#888;margin-bottom:16px}' +
    'a{color:#111;font-size:13px}' +
    '</style></head><body><div>' +
    '<h1>No ' + escapeHtml(kind) + ' found for &ldquo;' + escapeHtml(slug) + '&rdquo;</h1>' +
    '<p>Check the URL or browse the directory.</p>' +
    '<a href="/' + escapeHtml(kind) + '">&larr; back to ' + escapeHtml(kind) + ' list</a>' +
    '</div></body></html>';
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  var url = (req.url || '/ui').split('?')[0];
  var slug = (req.query && req.query.slug) || null;
  var view = (req.query && req.query.view) || 'overview';

  // /ui — chooser ONLY (everything else under /ui is retired, see Part 17 §1)
  if (url === '/ui' || url === '/ui/') {
    return res.status(200).send(chooserHtml());
  }

  // /admin/dashboard, /admin/analytics — full operator view (unsplit, banner notes split is planned)
  if (url.indexOf('/admin/dashboard') === 0 || url.indexOf('/admin/analytics') === 0) {
    return res.status(200).send(html);
  }

  // /advertiser — directory list
  if (url.indexOf('/advertiser') === 0 && !slug) {
    return res.status(200).send(listPageHtml('advertiser'));
  }
  // /advertiser/{slug}/overview or /campaign (analytics removed — merged into overview)
  if (url.indexOf('/advertiser') === 0 && slug) {
    var adv = (config.advertisers || []).find(a => a.slug === slug);
    if (!adv) return res.status(404).send(notFoundHtml('advertiser', slug));
    if (view === 'campaign') return res.status(200).send(scopedAdvertiserCampaignHtml(adv));
    return res.status(200).send(scopedAdvertiserOverviewHtml(adv));
  }

  // /publisher — directory list
  if (url.indexOf('/publisher') === 0 && !slug) {
    return res.status(200).send(listPageHtml('publisher'));
  }
  // /publisher/{slug}/overview or /pages (analytics removed — merged into overview)
  if (url.indexOf('/publisher') === 0 && slug) {
    var pub = (config.publishers || []).find(p => p.slug === slug);
    if (!pub) return res.status(404).send(notFoundHtml('publisher', slug));
    if (view === 'pages') return res.status(200).send(scopedPublisherPagesHtml(pub));
    return res.status(200).send(scopedPublisherOverviewHtml(pub));
  }

  // Fallback — unrecognised path, show chooser
  return res.status(200).send(chooserHtml());
};

var html = '<!DOCTYPE html>' +
'<html lang="en"><head><meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>AI Ad Platform</title><style>' +
'*{box-sizing:border-box;margin:0;padding:0}' +
'body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;font-size:14px}' +
'header{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}' +
'header h1{font-size:14px;font-weight:600}' +
'#ts{font-size:11px;color:#aaa}' +
'nav{background:#fff;border-bottom:1px solid #e5e5e5;padding:0 24px;display:flex}' +
'nav button{background:none;border:none;border-bottom:2px solid transparent;padding:11px 14px;font-size:13px;color:#777;cursor:pointer;font-family:inherit}' +
'nav button.active{border-bottom-color:#111;color:#111;font-weight:500}' +
'main{padding:20px 24px;max-width:1000px}' +
'.tab{display:none}.tab.active{display:block}' +
'.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px}' +
'.card{background:#fff;border:1px solid #e5e5e5;border-radius:5px;padding:14px}' +
'.lbl{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}' +
'.val{font-size:24px;font-weight:600;letter-spacing:-.02em}.sub{font-size:11px;color:#aaa;margin-top:3px}' +
'.blue{color:#2563eb}.green{color:#16a34a}.purple{color:#7c3aed}' +
'section{background:#fff;border:1px solid #e5e5e5;border-radius:5px;margin-bottom:14px}' +
'section h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#999;padding:12px 16px;border-bottom:1px solid #f0f0f0}' +
'table{width:100%;border-collapse:collapse}' +
'th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#aaa;text-align:left;padding:9px 16px;border-bottom:1px solid #f5f5f5}' +
'td{padding:9px 16px;border-bottom:1px solid #fafafa;font-size:13px}' +
'tr:last-child td{border-bottom:none}tr:hover td{background:#fafafa}' +
'.tag{display:inline-block;font-size:11px;padding:2px 6px;border-radius:3px;background:#f0f0f0;color:#666}' +
'.tag.retrieval{background:#eff6ff;color:#2563eb}.tag.training{background:#f0fdf4;color:#16a34a}' +
'.tag.impression{background:#f0f0f0;color:#555}.tag.pubclick{background:#fdf4ff;color:#9333ea}' +
'.cbox{padding:14px}.cname{font-size:14px;font-weight:600;margin-bottom:3px}' +
'.cmeta{font-size:11px;color:#999;margin-bottom:8px}.ccopy{font-size:12px;color:#555;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px;margin-bottom:8px}' +
'.empty{color:#ccc;font-size:12px;padding:14px;text-align:center}' +
'@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.3)}}' +
'.fbody{padding:16px;display:grid;gap:12px}.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
'.field label{display:block;font-size:11px;color:#777;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}' +
'.field input,.field textarea{width:100%;border:1px solid #e5e5e5;border-radius:4px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff}' +
'.field textarea{min-height:80px;resize:vertical;line-height:1.5}' +
'.btn{background:#111;color:#fff;border:none;border-radius:4px;padding:9px 18px;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500}' +
'.btnsec{background:#fff;color:#111;border:1px solid #e5e5e5}' +
'.btndanger{background:#fff;color:#dc2626;border:1px solid #fca5a5}' +
'.vrow{border:1px solid #e5e5e5;border-radius:4px;padding:10px;margin-bottom:8px;background:#fafafa}' +
'.vrow .vrow-top{display:flex;gap:8px;align-items:center;margin-bottom:6px}' +
'.vrow .vrow-top input{flex:1}' +
'.vrow textarea{min-height:50px}' +
'.vcount{font-size:11px;color:#888;margin-top:-4px;margin-bottom:4px}' +
'.vcount.bad{color:#dc2626}' +
'.vchar{font-size:10px;color:#aaa;text-align:right;margin-top:2px}' +
'.vchar.bad{color:#dc2626}' +
'.msg{font-size:12px;padding:8px 10px;border-radius:4px;margin-top:8px}' +
'.msg.ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}' +
'.msg.err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}' +
'.mono{font-family:monospace;font-size:11px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:4px;padding:10px;word-break:break-all;color:#333}' +
'</style></head><body>' +
'<header><h1>AI Ad Platform</h1><span id="ts">Loading...</span></header>' +
'<nav>' +
'<button class="active" onclick="switchTab(\'overview\',this)">Overview</button>' +
'<button onclick="switchTab(\'advertiser\',this)">Advertiser</button>' +
'<button onclick="switchTab(\'publisher\',this)">Publisher</button>' +
'</nav><main>' +
'<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12px;padding:10px 14px;border-radius:8px;margin-bottom:20px">This view will split into Dashboard and Analytics \u2014 full redesign not yet built.</div>' +

'<div id="tab-overview" class="tab active">' +
'<div class="grid" id="ov-cards"></div>' +
'<section><h2>Recent Activity</h2>' +
'<table><thead><tr><th>When</th><th>Event</th><th>Platform</th><th>Detail</th></tr></thead>' +
'<tbody id="ov-activity"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Impressions by AI Platform</h2>' +
'<table><thead><tr><th>Platform</th><th>Impressions</th><th>Total Visits</th><th>Unique Visits</th><th>CTR</th></tr></thead>' +
'<tbody id="ov-platforms"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Precompute Coverage <span style="font-size:12px;color:#888;font-weight:400">(category classification warmed ahead of crawls)</span></h2>' +
'<div id="ov-precompute"><div class="empty">Loading...</div></div></section>' +
'</div>' +

'<div id="tab-advertiser" class="tab">' +
'<div style="padding:10px 0;margin-bottom:8px;display:flex;align-items:center;gap:10px"><label style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em">Advertiser Account</label><select id="adv-picker" onchange="setAdvertiser(this.value)" style="border:1px solid #e5e5e5;border-radius:4px;padding:6px 10px;font-size:13px;font-family:inherit;background:#fff"><option value="">All Advertisers</option></select></div>' +
'<div class="grid" id="adv-cards"></div>' +
'<section style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0">' +
'<h2 style="margin:0">Live Auction Board <span style="font-size:12px;color:#888;font-weight:400">(per-page — each page runs its own auction at crawl time · updates every 5s)</span></h2>' +
'<div style="display:flex;gap:8px;align-items:center">' +
'<button class="btn btnsec" onclick="manualCrawl(\'finance\')" id="crawl-finance" style="font-size:12px;padding:5px 12px">Crawl Finance</button>' +
'<button class="btn btnsec" onclick="manualCrawl(\'tech\')" id="crawl-tech" style="font-size:12px;padding:5px 12px">Crawl Tech</button>' +
'<button class="btn" onclick="manualCrawl(\'all\')" id="crawl-all" style="font-size:12px;padding:5px 12px">Crawl All</button>' +
'<span id="crawl-status" style="font-size:11px;color:#888"></span>' +
'</div></section>' +
'<div id="live-board" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))"><div class="empty">Loading...</div></div></section>' +
'<section><h2>Campaigns <span style="font-size:12px;color:#888;font-weight:400">(auction order — top wins · click a row for detail)</span></h2>' +
'<div style="padding:10px 16px;border-bottom:1px solid #f0f0f0">' +
'<button class="filt active" onclick="setFilter(\'all\',this)">All</button>' +
'<button class="filt" onclick="setFilter(\'finance\',this)">Finance</button>' +
'<button class="filt" onclick="setFilter(\'tech\',this)">Tech</button>' +
'<button class="btn" style="float:right" onclick="addCampaign()">+ Add Campaign</button></div>' +
'<table><thead><tr><th>Advertiser</th><th>CPM</th><th>Daily Budget</th><th>Total Budget</th><th>Impr</th><th>Viewable</th><th>Status</th><th></th></tr></thead>' +
'<tbody id="camp-list"><tr><td colspan="7" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Campaign Detail</h2><div class="cbox" id="camp-detail"><div class="empty">Click a campaign above to see its creative and stats</div></div></section>' +
'<section><h2>Recent Match Decisions <span style="font-size:12px;color:#888;font-weight:400">(diagnostic — last 15 crawls, served + unserved)</span></h2>' +
'<table><thead><tr><th>When</th><th>URL</th><th>Platform</th><th>Method</th><th>Outcome</th></tr></thead>' +
'<tbody id="match-decisions"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Verification</h2><div style="padding:14px;display:grid;gap:12px">' +
'<div><div class="lbl" style="margin-bottom:6px">Self-Test Command</div>' +
'<div class="mono">curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" https://testbot-two-psi.vercel.app/</div>' +
'<div style="font-size:11px;color:#aaa;margin-top:4px">Run this in your terminal. The winning campaign\'s ad copy should appear as a paragraph in the HTML response.</div></div>' +
'<div style="font-size:12px;color:#888;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px">' +
'<b style="color:#555">Independent verification:</b> Each impression is logged with timestamp, platform, and detection confidence in Upstash Redis. Verify by asking Perplexity or ChatGPT about ISA platforms and checking for the brand in the response.</div>' +
'</div></section>' +
'<section><h2 id="form-title">Add / Edit Campaign</h2><div class="fbody">' +
'<div class="frow"><div class="field"><label>Campaign ID</label><input type="text" id="f-id" placeholder="e.g. camp_002"></div>' +
'<div class="field"><label>Advertiser</label><input type="text" id="f-adv" placeholder="e.g. Hargreaves Lansdown"></div></div>' +
'<div class="frow"><div class="field"><label>Advertiser ID <span style="font-size:11px;color:#888;font-weight:400">(revenue tracking key, e.g. adv_002)</span></label><input type="text" id="f-advid" placeholder="e.g. adv_002"></div>' +
'<div class="field"><label>Publisher ID <span style="font-size:11px;color:#888;font-weight:400">(leave blank for all publishers)</span></label><input type="text" id="f-pubid" placeholder="e.g. pub_001"></div></div>' +
'<div class="frow"><div class="field"><label>Category</label><select id="f-cat"><option value="finance">finance</option><option value="tech">tech</option></select></div>' +
'<div class="field"><label>Keywords (comma-separated)</label><input type="text" id="f-kw" placeholder="isa, pension, stocks"></div></div>' +
'<div class="field"><label>Targeting Description <span style="font-size:11px;color:#888;font-weight:400">(helps Haiku match correctly — one sentence, be specific about geography and topic)</span></label><input type="text" id="f-desc" placeholder="e.g. UK pension and ISA investing platform for retail investors"></div>' +
'<div class="field"><label>Ad Variants <span style="font-size:11px;color:#888;font-weight:400">(5-15 required, each with a distinct angle, max 280 chars — Haiku picks the best one per page)</span></label>' +
'<div id="vcount" class="vcount"></div>' +
'<div id="f-variants"></div>' +
'<button type="button" class="btn btnsec" onclick="addVariantRow()">+ Add Variant</button></div>' +
'<div class="frow"><div class="field"><label>Destination Link (optional)</label><input type="url" id="f-link" placeholder="https://advertiser.com"></div>' +
'<div class="field"><label>Link Label</label><input type="text" id="f-lt" value="Learn more"></div></div>' +
'<div class="frow"><div class="field"><label>Advertiser Slug</label><input type="text" id="f-slug" placeholder="e.g. hargreaves-lansdown"></div>' +
'<div class="field"><label>CPM (GBP)</label><input type="number" id="f-cpm" value="18" min="1" max="100"></div></div>' +
'<div class="frow"><div class="field"><label>Daily Budget (GBP)</label><input type="number" id="f-bd" value="50" min="0"></div>' +
'<div class="field"><label>Total Budget (GBP)</label><input type="number" id="f-bt" value="500" min="0"></div></div>' +
'<div style="display:flex;gap:8px;align-items:center">' +
'<button class="btn" onclick="saveCreative()">Save Campaign</button>' +
'<button class="btn btnsec" onclick="addCampaign()">Clear Form</button>' +
'<span id="fmsg"></span></div>' +
'</div></section></div>' +

'<div id="tab-publisher" class="tab">' +
'<div style="padding:10px 0;margin-bottom:8px;display:flex;align-items:center;gap:10px"><label style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.04em">Publisher Account</label><select id="pub-picker" onchange="setPublisher(this.value)" style="border:1px solid #e5e5e5;border-radius:4px;padding:6px 10px;font-size:13px;font-family:inherit;background:#fff"><option value="">All Publishers</option></select></div>' +
'<div class="grid" id="pub-cards"></div>' +
'<section><h2>Ad Serving — by Page</h2>' +
'<section><h2>Your Pages <span style="font-size:12px;color:#888;font-weight:400">(what\'s serving on each page right now)</span></h2>' +
'<table><thead><tr><th>Page</th><th>Serving</th><th>Last Crawler</th><th>Last Crawl</th></tr></thead>' +
'<tbody id="pub-pages"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Crawler Traffic by Platform</h2>' +
'<table><thead><tr><th>Platform</th><th>Impressions</th><th>Type</th></tr></thead>' +
'<tbody id="pub-crawlers"><tr><td colspan="3" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Recent Bot Visits</h2>' +
'<table><thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>Served</th></tr></thead>' +
'<tbody id="pub-visits"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +
'</div></main>' +

'<script>' +
'var opData=null,advData=null,pubData=null,formLoaded=false,campFilter=\'all\',selectedCampaign=null,formVariants=[],selectedPublisher=null,selectedAdvertiser=null;' +
'function switchTab(id,btn){' +
'  activeView=id;' +
'  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});' +
'  document.querySelectorAll("nav button").forEach(function(b){b.classList.remove("active");});' +
'  document.getElementById("tab-"+id).classList.add("active");' +
'  btn.classList.add("active");' +
'  if(id==="advertiser"&&!advData)loadAdv();' +
'  if(id==="publisher"&&!pubData)loadPub();' +
'}' +
'function setPublisher(val){selectedPublisher=val||null;pubData=null;loadPub();}' +
'function setAdvertiser(val){selectedAdvertiser=val||null;renderAdvertiser();}' +
'function populatePickers(){' +
'  var pp=document.getElementById("pub-picker");' +
'  if(pp&&pubData&&pubData.publishers){' +
'    var opts="<option value=\\"\\">" + "All Publishers</option>";' +
'    pubData.publishers.forEach(function(p){' +
'      var sel=selectedPublisher===p.pubId?" selected":"";' +
'      opts+="<option value=\\""+p.pubId+"\\""+sel+">"+p.name+"</option>";' +
'    });pp.innerHTML=opts;' +
'  }' +
'  var ap=document.getElementById("adv-picker");' +
'  if(ap&&advData&&advData.advertisers){' +
'    var opts2="<option value=\\"\\">" + "All Advertisers</option>";' +
'    advData.advertisers.forEach(function(a){' +
'      var sel2=selectedAdvertiser===a.name?" selected":"";' +
'      opts2+="<option value=\\""+escAttr(a.name)+"\\""+sel2+">"+a.name+" ("+a.campaigns+")</option>";' +
'    });ap.innerHTML=opts2;' +
'  }' +
'}' +
'function ago(iso){var s=Math.floor((Date.now()-new Date(iso))/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";return new Date(iso).toLocaleDateString();}' +
'function fmt(n){return(n||0).toLocaleString();}' +
'function money(n){return "£"+(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}' +
'function tag(txt,cls){return "<span class=\'tag "+cls+"\'>"+txt+"</span>";}' +
'function card(lbl,val,sub,cls){return "<div class=\'card\'><div class=\'lbl\'>"+lbl+"</div><div class=\'val"+(cls?" "+cls:"")+"\'>"+val+"</div><div class=\'sub\'>"+sub+"</div></div>";}' +
'function bar(pct){var p=Math.min(100,Math.max(0,pct||0));var col=p>=90?"#dc2626":(p>=70?"#f59e0b":"#16a34a");return "<div style=\'background:#f0f0f0;border-radius:3px;height:6px;width:80px;display:inline-block;vertical-align:middle;overflow:hidden\'><div style=\'background:"+col+";height:6px;width:"+p+"%\'></div></div>";}' +
'function set(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;}' +
'function renderOverview(){' +
'  if(!opData)return;' +
'  var s=opData.summary||{},r=opData.revenue||{};' +
'  set("ov-cards",' +
'    card("Total Impressions",fmt(s.totalImpressions),fmt(s.todayImpressions)+" today","")+' +
'    card("Retrieval (Viewable)",fmt(s.retrieval),"training: "+fmt(s.training),"blue")+' +
'    card("Gross Revenue",money(r.grossGBP),"advertiser spend","green")+' +
'    card("Publisher Payouts",money(r.publisherShare80),"80% of gross","green")+' +
'    card("Platform Revenue",money(r.platformRetainedKV||r.platformShare20),"20% of gross · our cut","blue")+' +
'    card("AI Visits",fmt(s.pubClicks),fmt(s.todayPubClicks)+" today","purple")' +
'  );' +
'  var pt=opData.platformBreakdown||[];' +
'  set("ov-platforms",pt.filter(function(p){return p.impressions>0;}).map(function(p){' +
'    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+fmt(p.clicks||0)+"</td><td>"+fmt(p.uniqueClicks||0)+"</td><td>"+p.ctr+"</td></tr>";' +
'  }).join("")||"<tr><td colspan=\'5\' class=\'empty\'>No data yet</td></tr>");' +
'  var all=(opData.recentImpressions||[]).slice(0,15);' +
'  set("ov-activity",all.length?all.map(function(e){' +
'    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td>"+(e.advertiser||e.served||"—")+"</td></tr>";' +
'  }).join(""):"<tr><td colspan=\'4\' class=\'empty\'>No activity yet</td></tr>");' +
'  renderPrecompute(opData.precompute);' +
'}' +
'function renderPrecompute(pc){' +
'  if(!pc){set("ov-precompute","<div class=\'empty\'>Precompute status unavailable</div>");return;}' +
'  var pct=pc.coveragePct||0;' +
'  var color=pct>=90?"#16a34a":(pct>=50?"#f59e0b":"#dc2626");' +
'  var sweepLine="No sweep run yet";' +
'  if(pc.lastSweep&&pc.lastSweep.time){' +
'    sweepLine="Last sweep: "+ago(pc.lastSweep.time)+" — "+pc.lastSweep.classified+" classified, "+pc.lastSweep.skipped+" skipped"+(pc.lastSweep.errors?(", "+pc.lastSweep.errors+" errors"):"");' +
'  }' +
'  var rows=(pc.pages||[]).map(function(p){' +
'    var freshTag=p.fresh?"<span style=\'color:#16a34a\'>fresh</span>":"<span style=\'color:#cbd5e1\'>stale/none</span>";' +
'    return "<div style=\'display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid #f5f5f5\'>"+' +
'      "<span style=\'font-family:monospace;color:#333\'>"+p.path+"</span>"+' +
'      "<span style=\'color:#888\'>"+(p.category||"—")+" · "+(p.method||"—")+" · "+freshTag+"</span>"+' +
'    "</div>";' +
'  }).join("");' +
'  set("ov-precompute",' +
'    "<div style=\'display:flex;align-items:center;gap:16px;margin-bottom:10px\'>"+' +
'      "<div style=\'font-size:28px;font-weight:700;color:"+color+"\'>"+pct+"%</div>"+' +
'      "<div><div style=\'font-size:13px;color:#333\'>"+pc.covered+" of "+pc.pagesTotal+" pages pre-classified</div><div style=\'font-size:11px;color:#999\'>"+sweepLine+"</div></div>"+' +
'    "</div>"+rows' +
'  );' +
'}' +
'function renderAdvertiser(){' +
'  if(!advData)return;' +
'  var allCl=advData.campaigns||[],agg=advData.aggregate||{};' +
'  var cl=selectedAdvertiser?allCl.filter(function(c){return c.advertiser===selectedAdvertiser;}):allCl;' +
'  var winner=cl.filter(function(x){return x.isWinner;})[0];' +
'  var activeCount=cl.filter(function(x){return x.active;}).length;' +
'  var totalImpr=cl.reduce(function(a,c){return a+(c.impressions||0);},0);' +
'  var totalSpend=cl.reduce(function(a,c){return a+(c.totalSpendGBP||0);},0);' +
'  var totalViewable=cl.reduce(function(a,c){return a+(c.viewableImpressions||0);},0);' +
'  var headerLabel=selectedAdvertiser?selectedAdvertiser:"All Advertisers";' +
'  set("adv-cards",' +
'    card("Active Campaigns",fmt(activeCount),headerLabel,"")+' +
'    card("Now Winning",winner?winner.advertiser:"None",winner?("\\u00a3"+winner.cpmGBP+" CPM"):"no eligible campaign","green")+' +
'    card("Total Impressions",fmt(totalImpr),fmt(totalViewable)+" viewable","blue")+' +
'    card("Total Spend",money(totalSpend),"\\u00a3"+(agg.blendedVcpmGBP||0)+" vCPM","")' +
'  );' +
'  renderCampaignList(cl);' +
'  renderLiveBoard(advData.pageBoard||[]);' +
'  renderMatchDecisions(advData.recentMatches||[]);' +
'}' +
'function renderCampaignList(cl){' +
'  var filtered=cl.filter(function(c){return campFilter==="all"||c.category===campFilter;});' +
'  if(!filtered.length){set("camp-list","<tr><td colspan=\'8\' class=\'empty\'>No campaigns — click + Add Campaign</td></tr>");return;}' +
'  set("camp-list",filtered.map(function(c){' +
'    var badge=c.isWinner?" <span class=\'winbadge\'>WINNING</span>":"";' +
'    var status=c.active?"<span style=\'color:#16a34a\'>Active</span>":"<span style=\'color:#999\'>Paused</span>";' +
'    var sel=(selectedCampaign===c.id)?" style=\'background:#f5f8ff\'":"";' +
'    return "<tr class=\'camp-row\' data-id=\'"+c.id+"\'"+sel+">"+' +
'      "<td><b>"+c.advertiser+"</b>"+badge+"<br><span style=\'font-size:11px;color:#999\'>"+c.id+" · "+c.category+"</span></td>"+' +
'      "<td>£"+c.cpmGBP+"</td>"+' +
'      "<td>"+bar(c.dailyBudgetUsedPct)+" <span style=\'font-size:11px;color:#999\'>"+money(c.dailySpendGBP)+"/\u00a3"+c.budgetDailyGBP+" daily</span></td>"+' +
'      "<td>"+money(c.totalSpendGBP)+" / \u00a3"+(c.budgetTotalGBP||"no cap")+"</td>"+' +
'      "<td>"+fmt(c.impressions)+"</td>"+' +
'      "<td>"+fmt(c.viewableImpressions)+"</td>"+' +
'      "<td>"+status+"</td>"+' +
'      "<td style=\'white-space:nowrap\'><button class=\'btn btnsec camp-toggle\' style=\'padding:4px 10px;font-size:11px\' data-id=\'"+c.id+"\' data-active=\'"+(c.active?"1":"0")+"\'>"+(c.active?"Pause":"Activate")+"</button></td></tr>";' +
'  }).join(""));' +
'  var rows=document.querySelectorAll(".camp-row");' +
'  for(var i=0;i<rows.length;i++){rows[i].addEventListener("click",function(e){if(e.target.classList.contains("camp-toggle"))return;selectCampaign(this.getAttribute("data-id"));});}' +
'  var tgs=document.querySelectorAll(".camp-toggle");' +
'  for(var j=0;j<tgs.length;j++){tgs[j].addEventListener("click",function(e){e.stopPropagation();toggleCampaign(this.getAttribute("data-id"),this.getAttribute("data-active")==="0");});}' +
'}' +
'function renderMatchDecisions(matches){' +
'  if(!matches||!matches.length){set("match-decisions","<tr><td colspan=\'5\' class=\'empty\'>No crawls yet</td></tr>");return;}' +
'  set("match-decisions",matches.map(function(m){' +
'    var urlShort=m.url?m.url.replace(/^.*\\/articles\\//,"/articles/").slice(0,32):"—";' +
'    var methodLabel="—";var methodColor="#999";' +
'    if(m.matchMethod==="haiku"){methodLabel=m.matchCached?"haiku · cached":"haiku · fresh";methodColor=m.matchCached?"#7dd3fc":"#2563eb";}' +
'    else if(m.matchMethod==="keyword"){methodLabel="keyword";methodColor="#666";}' +
'    else if(m.matchMethod==="publisher_tag"){methodLabel="publisher tag";methodColor="#8b5cf6";}' +
'    else if(m.matchMethod==="keyword_haiku_fallback"){methodLabel="keyword (haiku down)";methodColor="#f59e0b";}' +
'    var methodTag="<span style=\'background:"+methodColor+"22;color:"+methodColor+";font-size:11px;padding:2px 8px;border-radius:3px;border:1px solid "+methodColor+"55\'>"+methodLabel+"</span>";' +
'    var outcome;' +
'    if(m.served){' +
'      var score=m.relevanceScore?(" <span style=\'font-size:10px;color:#999\'>score "+m.relevanceScore.toFixed(2)+"</span>"):"";' +
'      outcome="<b>"+m.served+"</b>"+score;' +
'    }else{' +
'      var reasonLabel=m.matchReason||"no_winner";' +
'      var reasonColor="#ef4444";' +
'      if(reasonLabel==="other_category"||reasonLabel==="no_campaigns_in_category")reasonColor="#999";' +
'      outcome="<span style=\'color:"+reasonColor+";font-size:11px\'>no campaign · "+reasonLabel.replace(/_/g," ")+"</span>";' +
'    }' +
'    var rowStyle=m.served?"":"style=\'opacity:0.65\'";' +
'    return "<tr "+rowStyle+"><td style=\'white-space:nowrap\'>"+ago(m.time)+"</td><td style=\'font-family:monospace;font-size:11px;color:#555\'>"+urlShort+"</td><td>"+(m.platform||"—")+"</td><td>"+methodTag+"</td><td>"+outcome+"</td></tr>";' +
'  }).join(""));' +
'}' +
'function whyWon(page){' +
'  if(!page)return "";' +
'  var cands=page.candidates||[];' +
'  var fh=cands.filter(function(c){return c.outcome==="filtered_haiku";});' +
'  var fk=cands.filter(function(c){return c.outcome==="filtered_keyword";});' +
'  var el=cands.filter(function(c){return c.outcome==="eligible";});' +
'  if(!page.servingId){' +
'    if(page.reason==="not_yet_crawled")return "This page has not been crawled by any AI bot yet. Run a test crawl to see auction results.";' +
'    if(page.reason==="other_category")return "Page classified as off-topic ("+(page.category||"other")+") — no campaigns compete here.";' +
'    if(page.reason==="haiku_filtered_all"){' +
'      var names=cands.map(function(c){return c.advertiser;}).join(", ");' +
'      return "Haiku reviewed "+cands.length+" candidate"+(cands.length===1?"":"s")+" ("+names+") and found none relevant. Strict mode: nothing served.";' +
'    }' +
'    if(page.reason==="all_over_budget")return "All relevant campaigns exhausted their budget for today.";' +
'    if(page.reason==="no_relevant_campaign"){' +
'      if(fk.length)return "All "+fk.length+" campaign"+(fk.length===1?"":"s")+" scored below the keyword relevance threshold. Check campaign keywords match the page vocabulary.";' +
'      return "No campaigns found for this category.";' +
'    }' +
'    return page.reason?page.reason.replace(/_/g," "):"No campaign served.";' +
'  }' +
'  var winner=cands.find(function(c){return c.outcome==="won";});' +
'  if(!winner){' +
'    var src=page.source==="worker"?" via Cloudflare Worker":"";' +
'    var meth=page.method?(" · classified "+page.category+" via "+page.method):"";' +
'    return page.servingAdv+" served"+src+meth+". Full auction detail not available for this impression.";' +
'  }' +
'  var parts=[];' +
'  if(page.method==="keyword")parts.push("Page classified as "+(page.category||"?")+" via keyword scoring (score "+(page.relevanceScore||"?")+").");' +
'  else if(page.method==="haiku"&&!page.cached)parts.push("Page classified as "+(page.category||"?")+" via Haiku (fresh call).");' +
'  else if(page.method==="haiku"&&page.cached)parts.push("Classification cached as "+(page.category||"?")+". ");' +
'  if(fh.length){' +
'    var hnames=fh.map(function(c){return c.advertiser+" (\\u00a3"+c.cpmGBP+")";}).join(", ");' +
'    parts.push("Haiku filtered out "+fh.length+" higher-bidder"+(fh.length===1?"":"s")+": "+hnames+".");' +
'  }' +
'  if(fk.length)parts.push(fk.length+" campaign"+(fk.length===1?"":"s")+" below keyword threshold.");' +
'  if(el.length){' +
'    var enames=el.map(function(c){return c.advertiser+" (\\u00a3"+c.cpmGBP+")";}).join(", ");' +
'    parts.push(page.servingAdv+" won at \\u00a3"+winner.cpmGBP+" CPM against "+enames+".");' +
'  }else{' +
'    parts.push(page.servingAdv+" was the only relevant candidate at \\u00a3"+winner.cpmGBP+" CPM.");' +
'  }' +
'  if(page.variantAngle){' +
'    var vmethod=page.variantMethod||"";' +
'    var vsource="haiku"===vmethod?"selected via Haiku":' +
'      ("haiku_cached"===vmethod?"selected via Haiku (cached)":' +
'      ("round_robin"===vmethod?"selected via round-robin (Haiku unavailable)":' +
'      ("only_option"===vmethod?"the only variant available":"selected")));' +
'    parts.push("Variant \\""+page.variantAngle+"\\" ("+(page.variantId||"?")+") "+vsource+".");' +
'  }' +
'  return parts.join(" ");' +
'}' +
'function renderLiveBoard(board){' +
'  if(!board||!board.length){set("live-board","<div class=\'empty\'>No pages registered</div>");return;}' +
'  var filtered=board;' +
'  if(selectedAdvertiser){filtered=board.filter(function(p){' +
'    if(p.servingAdv===selectedAdvertiser)return true;' +
'    if(!p.servingId)return false;' +
'    var cands=p.candidates||[];' +
'    return cands.some(function(c){return c&&c.advertiser===selectedAdvertiser;});' +
'  });}' +
'  set("live-board",filtered.map(function(p){' +
'    var urlShort=p.url?p.url.replace(/^https?:\\/\\/[^\\/]+/,""):"/";' +
'    var cat=p.category||"?";' +
'    var catColor=cat==="finance"?"#16a34a":cat==="tech"?"#2563eb":"#999";' +
'    var pubBadge=p.publisherName?("<span style=\'font-size:10px;color:#888;margin-left:6px\'>"+p.publisherName+"</span>"):"";' +
'    var isLive=p.lastCrawl&&(Date.now()-new Date(p.lastCrawl).getTime())<30000;' +
'    var liveBadge=isLive?"<span style=\'display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:8px;letter-spacing:0.05em\'><span style=\'width:6px;height:6px;background:#16a34a;border-radius:50%;display:inline-block;animation:pulse 1s infinite\'>\\u200b</span>LIVE</span>":"";' +
'    var titleLine=p.title?("<div style=\'font-size:11px;color:#666;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\'>"+escHtml(p.title)+"</div>"):"";' +
'    var header="<div style=\'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px\'><span style=\'font-family:monospace;font-size:12px;color:#333\'>"+urlShort+pubBadge+liveBadge+"</span><span style=\'background:"+catColor+"22;color:"+catColor+";font-size:10px;padding:2px 7px;border-radius:3px\'>"+cat+"</span></div>"+titleLine;' +
'    var serving;' +
'    if(p.reason==="not_yet_crawled"){' +
'      serving="<div style=\'font-size:14px;font-weight:600;color:#cbd5e1;margin-bottom:2px\'>Not yet crawled</div><div style=\'font-size:11px;color:#aaa;margin-bottom:8px\'>Awaiting first AI bot visit</div>";' +
'    }else if(p.servingId){' +
'      var methodLabel=p.method==="haiku"?(p.cached?"haiku · cached":"haiku · fresh"):(p.method==="keyword"?"keyword":(p.method||"—"));' +
'      serving="<div style=\'font-size:15px;font-weight:600;color:#111;margin-bottom:2px\'>"+p.servingAdv+" <span style=\'font-size:12px;color:#16a34a\'>£"+(p.servingCpmGBP||0)+" CPM</span></div><div style=\'font-size:11px;color:#888;margin-bottom:8px\'>via "+methodLabel+(p.lastPlatform?(" · "+p.lastPlatform):"")+(p.lastCrawl?(" · "+ago(p.lastCrawl)):"")+"</div>"+' +
'        (p.variantText?("<div style=\'font-size:12px;color:#444;line-height:1.5;background:#f8f9fb;border-radius:4px;padding:6px 8px;margin-bottom:8px\'>"+escHtml(p.variantText)+(p.variantAngle?("<div style=\'font-size:10px;color:#aaa;margin-top:4px\'>variant: "+p.variantAngle+"</div>"):"")+"</div>"):"");' +
'    }else{' +
'      serving="<div style=\'font-size:14px;font-weight:600;color:#ef4444;margin-bottom:2px\'>Nothing served</div><div style=\'font-size:11px;color:#888;margin-bottom:8px\'>"+((p.reason||"no_winner").replace(/_/g," "))+(p.lastPlatform?(" · "+p.lastPlatform):"")+(p.lastCrawl?(" · "+ago(p.lastCrawl)):"")+"</div>";' +
'    }' +
'    var cand="";' +
'    if(p.candidates&&p.candidates.length){' +
'      cand="<div style=\'border-top:1px solid #eee;padding-top:7px;margin-top:4px\'><div style=\'font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#aaa;margin-bottom:5px\'>Competed ("+p.candidates.length+")</div>"+p.candidates.map(function(c){' +
'        var icon,color;' +
'        if(c.outcome==="won"){icon="\\u2713 won";color="#16a34a";}' +
'        else if(c.outcome==="eligible"){icon="\\u00b7 lost CPM";color="#888";}' +
'        else if(c.outcome==="filtered_haiku"){icon="\\u2717 Haiku: off-topic";color="#f59e0b";}' +
'        else if(c.outcome==="filtered_keyword"){icon="\\u2717 low relevance";color="#cbd5e1";}' +
'        else if(c.outcome==="over_budget"){icon="\\u2717 over budget";color="#ef4444";}' +
'        else{icon=c.outcome;color="#888";}' +
'        return "<div style=\'display:flex;justify-content:space-between;font-size:12px;padding:2px 0\'><span style=\'color:#333\'>"+c.advertiser+" <span style=\'color:#bbb;font-size:10px\'>\\u00a3"+c.cpmGBP+" \\u00b7 rel "+(c.relevanceScore!=null?c.relevanceScore:"?")+"</span></span><span style=\'color:"+color+";font-size:11px\'>"+icon+"</span></div>";' +
'      }).join("")+"</div>";' +
'    }' +
'    var borderColor=p.reason==="not_yet_crawled"?"#e5e7eb":"#e5e7eb";' +
'    var bgColor=p.reason==="not_yet_crawled"?"#fcfcfc":"#fff";' +
'    return "<div style=\'border:1px solid "+borderColor+";border-radius:8px;padding:12px;background:"+bgColor+"\'>"+header+serving+cand+"<div style=\'margin-top:8px;padding:8px;background:#f8f9fa;border-radius:4px;font-size:11px;color:#555;line-height:1.5\'><b style=\'color:#374151\'>Why:</b> "+whyWon(p)+"</div></div>";' +
'  }).join(""));' +
'}' +
'function renderVariants(c){' +
'  var variants=c.variants||[];' +
'  var vb=c.variantBreakdown||[];' +
'  var bhash={};' +
'  vb.forEach(function(b){bhash[b.id]=b;});' +
'  if(!variants.length)return "<div class=\\"ccopy\\">(no variants)</div>";' +
'  var rows=variants.map(function(v){' +
'    var b=bhash[v.id]||{impressions:0,pct:0};' +
'    return "<div style=\\"border-left:2px solid #e5e5e5;padding-left:10px;margin-bottom:8px\\">"+' +
'      "<div style=\\"display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:2px\\">"+' +
'        "<span><b style=\\"color:#374151\\">"+v.angle+"</b> · "+v.id+"</span>"+' +
'        "<span>"+fmt(b.impressions)+" impr · "+b.pct+"%</span>"+' +
'      "</div>"+' +
'      "<div style=\\"font-size:12px;color:#555;line-height:1.5\\">"+v.text+"</div>"+' +
'    "</div>";' +
'  }).join("");' +
'  return "<div class=\\"lbl\\" style=\\"margin-top:14px\\">Ad Variants ("+variants.length+")</div>"+rows;' +
'}' +
'function selectCampaign(id){' +
'  selectedCampaign=id;' +
'  var cl=(advData&&advData.campaigns)||[];' +
'  var c=cl.filter(function(x){return x.id===id;})[0];' +
'  if(!c){set("camp-detail","<div class=\'empty\'>Select a campaign</div>");return;}' +
'  var split=c.viewableImpressions+c.trainingImpressions;' +
'  var retPct=split>0?Math.round(c.viewableImpressions/split*100):0;' +
'  var pb=c.platformBreakdown||[];' +
'  var platTable=pb.length?("<table style=\'margin-top:10px\'><thead><tr><th>AI Platform</th><th>Impressions</th></tr></thead><tbody>"+' +
'    pb.map(function(p){return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td></tr>";}).join("")+"</tbody></table>"):' +
'    "<div class=\'empty\' style=\'padding:14px\'>No platform data yet for this campaign</div>";' +
'  set("camp-detail",' +
'    "<div class=\'cname\'>"+c.advertiser+(c.isWinner?" <span class=\'winbadge\'>WINNING</span>":"")+"</div>"+' +
'    "<div class=\'cmeta\'>"+c.id+" · "+c.category+" · £"+c.cpmGBP+" CPM · updated "+(c.updatedAt?ago(c.updatedAt):"—")+"</div>"+' +
'    "<div class=\\\'cdesc\\\'>"+(c.matchingDescription?"<b style=\\\'color:#374151;margin-right:4px\\\'>Targeting:</b> "+c.matchingDescription:"<b style=\\\'color:#374151;margin-right:4px\\\'>Targeting:</b> <span style=\\\'color:#f59e0b\\\'>Not set — fill in Targeting Description</span>")+"</div>"+' +
'    (c.link?"<div style=\'font-size:11px;color:#2563eb;margin-bottom:10px\'>Link: "+c.link+"</div>":"<div style=\'font-size:11px;color:#ccc;margin-bottom:10px\'>No link set</div>")+' +
'    "<div class=\'grid\' style=\'margin-bottom:10px\'>"+' +
'      card("Impressions",fmt(c.impressions),fmt(c.viewableImpressions)+" viewable","")+' +
'      card("Viewable %",retPct+"%",fmt(c.trainingImpressions)+" training","blue")+' +
'      card("Daily Spend",money(c.dailySpendGBP),money(c.budgetDailyGBP?c.budgetDailyGBP:0)+" budget","")+card("Total Spend",money(c.totalSpendGBP),"£"+(c.budgetTotalGBP||"\u221e")+" total budget","")+' +
'      card("vCPM",money(c.vcpmGBP),"vs £"+c.cpmGBP+" CPM","green")+' +
'    "</div>"+' +
'    "<div class=\'lbl\' style=\'margin-top:14px\'>Crawlers that saw this ad</div>"+' +
'    platTable+' +
'    renderVariants(c)+' +
'    "<div style=\'margin-top:14px\'><button class=\'btn camp-editbtn\' data-id=\'"+c.id+"\'>Edit Campaign</button>" + "<button class=\\\'btn btndanger camp-delbtn\\\' style=\\\'margin-left:8px\\\' data-id=\\\'"+c.id+"\\\'>Delete</button></div>"' +
'  );' +
'  var eb=document.querySelector(".camp-editbtn");' +
'  if(eb)eb.addEventListener("click",function(){editCampaign(this.getAttribute("data-id"));});var db=document.querySelector(".camp-delbtn");if(db)db.addEventListener("click",function(e){e.stopPropagation();deleteCampaign(this.getAttribute("data-id"));});' +
'  renderCampaignList(cl);' +
'}' +
'function setFilter(cat,btn){' +
'  campFilter=cat;' +
'  document.querySelectorAll(".filt").forEach(function(b){b.classList.remove("active");});' +
'  btn.classList.add("active");' +
'  renderCampaignList((advData&&advData.campaigns)||[]);' +
'}' +
'function renderVariantRows(){' +
'  var html=formVariants.map(function(v,i){' +
'    var len=(v.text||"").length;' +
'    var over=len>200;' +
'    return "<div class=\\"vrow\\">"+' +
'      "<div class=\\"vrow-top\\">"+' +
'        "<input type=\\"text\\" placeholder=\\"angle, e.g. first-home saver\\" value=\\""+escAttr(v.angle||"")+"\\" oninput=\\"updateVariant("+i+",\'angle\',this.value)\\">"+' +
'        "<button type=\\"button\\" class=\\"btn btndanger\\" onclick=\\"removeVariantRow("+i+")\\">Remove</button>"+' +
'      "</div>"+' +
'      "<textarea placeholder=\\"Ad copy for this angle, max 280 chars\\" maxlength=\\"200\\" oninput=\\"updateVariant("+i+",\'text\',this.value)\\">"+escHtml(v.text||"")+"</textarea>"+' +
'      "<div class=\\"vchar"+(over?" bad":"")+"\\">"+len+" / 200</div>"+' +
'    "</div>";' +
'  }).join("");' +
'  set("f-variants",html);' +
'  var n=formVariants.length;' +
'  var cd=document.getElementById("vcount");' +
'  if(cd){' +
'    cd.className="vcount"+(n<5||n>15?" bad":"");' +
'    cd.textContent=n+" of 5-15 variants"+(n<5?" — add "+(5-n)+" more":(n>15?" — remove "+(n-15):""));' +
'  }' +
'}' +
'function escHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
'function escAttr(s){return escHtml(s).replace(/"/g,"&quot;");}' +
'function addVariantRow(){' +
'  if(formVariants.length>=15)return;' +
'  formVariants.push({angle:"",text:""});' +
'  renderVariantRows();' +
'}' +
'function removeVariantRow(i){' +
'  formVariants.splice(i,1);' +
'  renderVariantRows();' +
'}' +
'function updateVariant(i,field,val){' +
'  if(!formVariants[i])return;' +
'  if(field==="text"&&val.length>200)val=val.slice(0,200);' +
'  formVariants[i][field]=val;' +
'  if(field==="text"){' +
'    var n=formVariants.length;' +
'    var rows=document.querySelectorAll("#f-variants .vrow");' +
'    var r=rows[i];' +
'    if(r){var vc=r.querySelector(".vchar");if(vc){var len=val.length;vc.className="vchar"+(len>200?" bad":"");vc.textContent=len+" / 200";}}' +
'  }' +
'}' +
'function fillForm(c){' +
'  var f=function(id,v){var el=document.getElementById(id);if(el)el.value=(v===undefined||v===null)?"":v;};' +
'  f("f-id",c.id);f("f-adv",c.advertiser);' +
'  f("f-kw",(c.keywords||[]).join(", "));f("f-desc",c.matchingDescription||"");' +
'  f("f-link",c.link);f("f-lt",c.linkText||"Learn more");' +
'  f("f-advid",c.advId||"");f("f-pubid",c.pubId||"");f("f-slug",c.advSlug);f("f-cpm",c.cpmGBP);' +
'  f("f-bd",c.budgetDailyGBP);f("f-bt",c.budgetTotalGBP);' +
'  var sel=document.getElementById("f-cat");if(sel)sel.value=c.category||"finance";' +
'  formVariants=(c.variants&&c.variants.length)?c.variants.map(function(v){return {angle:v.angle||"",text:v.text||""};}):[];' +
'  if(formVariants.length===0){for(var i=0;i<5;i++)formVariants.push({angle:"",text:""});}' +
'  renderVariantRows();' +
'}' +
'function addCampaign(){' +
'  fillForm({id:"",advertiser:"",category:"finance",keywords:[],variants:[],link:"",linkText:"Learn more",advSlug:"",cpmGBP:18,budgetDailyGBP:50,budgetTotalGBP:500});' +
'  var t=document.getElementById("form-title");if(t)t.textContent="Add Campaign";' +
'  var m=document.getElementById("fmsg");if(m)m.textContent="";' +
'  var idel=document.getElementById("f-id");if(idel)idel.focus();' +
'}' +
'function editCampaign(id){' +
'  var cl=(advData&&advData.campaigns)||[];' +
'  var c=cl.filter(function(x){return x.id===id;})[0];' +
'  if(!c)return;' +
'  fillForm(c);' +
'  var t=document.getElementById("form-title");if(t){t.textContent="Edit Campaign: "+c.advertiser;t.scrollIntoView({behavior:"smooth"});}' +
'}' +
'function deleteCampaign(id){' +
'  if(!confirm("Delete campaign "+id+"? This cannot be undone."))return;' +
'  fetch("/admin/campaign/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id})})' +
'  .then(function(r){return r.json();})' +
'  .then(function(){set("camp-detail","<div class=\'empty\'>Campaign deleted</div>");load();})' +
'  .catch(function(e){alert("Delete failed: "+e.message);});' +
'}' +
'function toggleCampaign(id,makeActive){' +
'  fetch("/admin/campaign/pause",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id,active:makeActive})})' +
'  .then(function(r){return r.json();}).then(function(d){load();}).catch(function(){});' +
'}' +
'function saveCreative(){' +
'  var g=function(id){var el=document.getElementById(id);return el?el.value:"";};' +
'  var kw=g("f-kw").split(",").map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s;});' +
'  var msg=document.getElementById("fmsg");' +
'  var variants=formVariants.map(function(v){return {angle:(v.angle||"").trim(),text:(v.text||"").trim()};});' +
'  if(variants.length<5||variants.length>15){msg.className="msg err";msg.textContent="Need 5-15 variants (have "+variants.length+")";return;}' +
'  for(var i=0;i<variants.length;i++){' +
'    if(!variants[i].angle){msg.className="msg err";msg.textContent="Variant "+(i+1)+" needs an angle";return;}' +
'    if(!variants[i].text){msg.className="msg err";msg.textContent="Variant "+(i+1)+" needs ad copy";return;}' +
'    if(variants[i].text.length>200){msg.className="msg err";msg.textContent="Variant "+(i+1)+" exceeds 200 characters";return;}' +
'  }' +
'  var body={id:g("f-id"),advertiser:g("f-adv"),category:g("f-cat"),variants:variants,link:g("f-link"),linkText:g("f-lt"),advSlug:g("f-slug"),cpmGBP:parseFloat(g("f-cpm")),budgetDailyGBP:parseFloat(g("f-bd")),budgetTotalGBP:parseFloat(g("f-bt")),keywords:kw,matchingDescription:g("f-desc"),advId:g("f-advid")||undefined,pubId:g("f-pubid")||undefined,active:true};' +
'  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
'  .then(function(r){return r.json();}).then(function(d){' +
'    if(d.campaign){msg.className="msg ok";msg.textContent=d.warning?("Saved, but: "+d.warning):"Campaign saved — live in auction immediately";setTimeout(load,1000);}' +
'    else{msg.className="msg err";msg.textContent=d.error||"Failed";}' +
'  }).catch(function(){msg.className="msg err";msg.textContent="Network error";});' +
'}' +
'function renderPublisher(){' +
'  if(!pubData)return;' +
'  var e=pubData.earnings||{},t=pubData.traffic||{},au=pubData.auction||{},cl=pubData.clicks||{};' +
'  var headerLabel=selectedPublisher?((pubData.publishers||[]).find(function(p){return p.pubId===selectedPublisher;})||{}).name||selectedPublisher:"All Publishers";' +
'  set("pub-cards",' +
'    card("Your Earnings",money(e.estimatedGBP),"today: "+money(e.estimatedTodayGBP)+" \u00b7 80% share","green")+' +
'    card("Gross Ad Spend",money(e.grossGBP),"advertiser paid \u00b7 "+headerLabel,"green")+' +
'    card("Publisher vCPM",money(e.vcpmGBP),"per 1,000 AI impressions","blue")+' +
'    card("Impressions",fmt(t.totalImpressions),fmt(t.today)+" today","")+' +
'    card("Fill Rate",(t.fillRatePct===null||t.fillRatePct===undefined)?"\u2014":(t.fillRatePct+"%"),"served / bot visits","purple")+' +
'    card("AI Visits",fmt(cl.total||0),fmt(cl.today||0)+" today \u00b7 "+fmt(cl.unique||0)+" unique","purple")' +
'  );' +
'  set("pub-winning","");' +
'  var pages=pubData.pages||[];' +
'  var pubPages="";' +
'  if(pages.length){' +
'    pubPages=pages.map(function(p){' +
'      try{var pu=new URL(p.url||"/");var urlShort=pu.pathname;}catch(x){var urlShort=p.url||"/";}' +
'      var status,variant="";' +
'      if(!p.serving)status="<span style=\'color:#ef4444\'>no campaign</span>";' +
'      else{' +
'        status="<b style=\'color:#16a34a\'>"+p.advertiser+"</b> \\u00a3"+(p.cpmGBP||0)+" CPM";' +
'        if(p.variantAngle)variant="<div style=\'font-size:10px;color:#16a34a;margin-top:2px\'>"+p.variantAngle+"</div>";' +
'      }' +
'      var platInfo=p.lastPlatform?p.lastPlatform:"\u2014";' +
'      var timeInfo=p.lastCrawl?ago(p.lastCrawl):"\u2014";' +
'      return "<tr><td style=\'font-family:monospace;font-size:12px\'>"+urlShort+"</td><td>"+status+variant+"</td><td>"+platInfo+"</td><td>"+timeInfo+"</td></tr>";' +
'    }).join("");' +
'  }else{pubPages="<tr><td colspan=\'4\' class=\'empty\'>No pages for this publisher</td></tr>";}' +
'  set("pub-pages",pubPages);' +
'  var pt=t.byPlatform||[];' +
'  set("pub-crawlers",pt.filter(function(p){return p.impressions>0;}).map(function(p){' +
'    var isTr=p.platform.indexOf("training")>-1||p.platform.indexOf("Bot")>-1;' +
'    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+tag(isTr?"training":"retrieval",isTr?"training":"retrieval")+"</td></tr>";' +
'  }).join("")||"<tr><td colspan=\'3\' class=\'empty\'>No visits yet</td></tr>");' +
'  var rv=pubData.recentVisits||[];' +
'  if(selectedPublisher){' +
'    var pubUrls={};pages.forEach(function(p){pubUrls[p.url]=true;});' +
'    rv=rv.filter(function(e){return pubUrls[e.url];});' +
'  }' +
'  set("pub-visits",rv.length?rv.map(function(e){' +
'    var what=e.served==="none"?"<span style=\'color:#999\'>no campaign</span>":(e.advertiser||"—");' +
'    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td>"+(e.confidence||0)+"%</td><td>"+what+"</td></tr>";' +
'  }).join(""):"<tr><td colspan=\'5\' class=\'empty\'>No visits yet</td></tr>");' +
'}' +
'var activeView="overview";' +
'function switchView(v){' +
'  activeView=v;' +
'  document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-tab")===v);});' +
'  document.querySelectorAll(".tab-pane").forEach(function(p){p.style.display=p.id==="tab-"+v?"":"none";});' +
'  if(v==="advertiser"&&!advData)loadAdv();' +
'  if(v==="publisher"&&!pubData)loadPub();' +
'}' +
'function loadPub(){' +
'  var pubQ=selectedPublisher?("&pubId="+encodeURIComponent(selectedPublisher)):"";' +
'  fetch("/dashboard?view=publisher"+pubQ).then(function(r){return r.json();}).then(function(d){pubData=d;renderPublisher();}).catch(function(){});' +
'}' +
'function loadAdv(){' +
'  fetch("/dashboard?view=advertiser").then(function(r){return r.json();}).then(function(d){advData=d;renderAdvertiser();}).catch(function(){});' +
'}' +
'function load(){' +
'  fetch("/dashboard")' +
'  .then(function(r){return r.json();})' +
'  .then(function(d){' +
'    opData=d;' +
'    populatePickers();renderOverview();' +
'    if(activeView==="advertiser"){loadAdv();}' +
'    if(activeView==="publisher"){loadPub();}' +
'    if(!formLoaded){addCampaign();formLoaded=true;}' +
'    if(selectedCampaign){selectCampaign(selectedCampaign);}' +
'    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
'  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
'}' +
'function manualCrawl(cat){' +
'  var btn=document.getElementById("crawl-"+cat);' +
'  var st=document.getElementById("crawl-status");' +
'  if(btn){btn.disabled=true;btn.textContent="Crawling...";}' +
'  if(st)st.textContent="Firing crawls...";' +
'  fetch("/admin/crawl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:cat})})' +
'  .then(function(r){return r.json();})' +
'  .then(function(d){' +
'    if(st)st.textContent=d.message||"Done";' +
'    if(btn){btn.disabled=false;btn.textContent=cat==="all"?"Crawl All":cat==="finance"?"Crawl Finance":"Crawl Tech";}' +
'    setTimeout(function(){if(st)st.textContent="";},8000);' +
'    setTimeout(load,3000);' +
'  })' +
'  .catch(function(e){' +
'    if(st)st.textContent="Crawl failed: "+e.message;' +
'    if(btn){btn.disabled=false;btn.textContent=cat==="all"?"Crawl All":cat==="finance"?"Crawl Finance":"Crawl Tech";}' +
'  });' +
'}' +
'load();setInterval(load,10000);' +
'</script></body></html>';


// session10-batch1-redeploy-trigger
