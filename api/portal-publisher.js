// ============================================================
// PUBLISHER PORTAL — /portal/publisher?id=pub_fw
// ============================================================

const { kvGet, kvListGet, kvHashGetAll } = require('../lib/kv');

const PUBLISHERS = {
  pub_fw:  { name:'Finance Weekly Demo',  domain:'testbot-two-psi.vercel.app',   category:'finance_investing', color:'#059669' },
  pub_tm:  { name:'TechMonthly',           domain:'techmonthly.example.com',      category:'tech',              color:'#0ea5e9' },
  pub_fi:  { name:'Fintech Insider',       domain:'fintechinsider.example.com',   category:'finance_investing', color:'#8b5cf6' },
};

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  const id  = (req.query && req.query.id) || 'pub_fw';
  const pub = PUBLISHERS[id] || PUBLISHERS.pub_fw;

  const today = new Date().toISOString().split('T')[0];
  const n = v => parseInt(v) || 0;
  const pct = (c, i) => !i ? '0.0%' : (n(c)/i*100).toFixed(1)+'%';

  let totalImp=0, todayImp=0, totalClicks=0, uniqClicks=0, todayClicks=0,
      retrieval=0, training=0, revenueGBP=0,
      platformTotals={}, recentLogs=[], recentClicks=[], currentCreative=null;

  try {
    const [ti, td, tc, tu, tcd, rt, tr, pt, rl, rc, cc] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:date:'+today),
      kvGet('stats:clicks:total'),
      kvGet('stats:unique_clicks:total'),
      kvGet('stats:clicks:date:'+today),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvHashGetAll('stats:impr_by_platform'),
      kvListGet('log:recent', 20),
      kvListGet('log:clicks', 20),
      kvGet('creative:'+pub.category),
    ]);
    totalImp=n(ti); todayImp=n(td); totalClicks=n(tc); uniqClicks=n(tu);
    todayClicks=n(tcd); retrieval=n(rt); training=n(tr);
    platformTotals=pt||{}; recentLogs=rl||[]; recentClicks=rc||[];
    currentCreative=cc||null;
    const cpm = (currentCreative&&currentCreative.cpmGBP)||18;
    revenueGBP = ((retrieval*cpm)+(training*cpm*0.3))/1000;
  } catch(e) {}

  const pubEarnings   = parseFloat((revenueGBP * 0.8).toFixed(4));
  const overallCTR    = pct(totalClicks, totalImp);

  // Platform table
  const allPlatforms = Object.keys(platformTotals).filter(p=>platformTotals[p]>0).sort((a,b)=>platformTotals[b]-platformTotals[a]);
  const platformRows = allPlatforms.map(p => {
    const imp = platformTotals[p]||0;
    const isRetrieval = ['Perplexity','ChatGPT Browse','Claude (Anthropic retrieval)','SearchGPT','Bing Copilot','Meta AI (retrieval)','Google Agent (Gemini retrieval)','Gemini Deep Research','Grok'].includes(p);
    return `<tr>
      <td>${p}</td>
      <td>${imp.toLocaleString()}</td>
      <td><span class="tag ${isRetrieval?'retrieval':'training'}">${isRetrieval?'retrieval':'training'}</span></td>
      <td style="color:#34d399">£${(imp*(isRetrieval?((currentCreative&&currentCreative.cpmGBP)||18):(((currentCreative&&currentCreative.cpmGBP)||18)*0.3))*0.8/1000).toFixed(4)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:#555;text-align:center;padding:16px">No traffic recorded yet</td></tr>';

  // Recent bot visits
  const visitRows = recentLogs.slice(0,10).map(e=>`
    <tr>
      <td style="color:#666;font-size:11px">${ago(e.time)}</td>
      <td>${e.platform||'—'}</td>
      <td><span class="tag ${e.crawlerType||'unknown'}">${e.crawlerType||'—'}</span></td>
      <td style="color:${parseInt(e.confidence)>=85?'#34d399':'#f59e0b'}">${e.confidence||0}%</td>
      <td style="color:#34d399;font-size:12px">£${e.cpmMin||0}–${e.cpmMax||0}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="color:#555;text-align:center;padding:16px">No visits yet</td></tr>';

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pub.name} — Publisher Portal</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;font-size:14px;min-height:100vh}
a{color:inherit;text-decoration:none}

header{background:#111;border-bottom:1px solid #1a1a1a;padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.header-left{display:flex;align-items:center;gap:12px}
.back{font-size:12px;color:#444;padding:6px 10px;border:1px solid #222;border-radius:5px;transition:all .15s}
.back:hover{border-color:#333;color:#888}
.header-brand{font-size:13px;font-weight:600}
.accent-dot{width:8px;height:8px;border-radius:50%;background:${pub.color};display:inline-block;margin-right:6px}
.header-right{font-size:11px;color:#444;display:flex;align-items:center;gap:16px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

main{max-width:960px;margin:0 auto;padding:28px 24px}
.page-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}
.page-sub{font-size:13px;color:#555;margin-bottom:28px}

.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.card{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px}
.card-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:8px}
.card-val{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1}
.card-sub{font-size:11px;color:#444;margin-top:4px}
.card-green .card-val{color:#34d399}
.card-blue .card-val{color:#818cf8}

section{background:#111;border:1px solid #1a1a1a;border-radius:8px;margin-bottom:14px;overflow:hidden}
.sec-head{padding:14px 18px;border-bottom:1px solid #161616;display:flex;align-items:center;justify-content:space-between}
.sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#555}

table{width:100%;border-collapse:collapse}
th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#444;text-align:left;padding:10px 18px;border-bottom:1px solid #161616}
td{padding:10px 18px;border-bottom:1px solid #0f0f0f;font-size:13px}
tr:last-child td{border-bottom:none}
tr:hover td{background:#0d0d0d}

.tag{display:inline-block;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:500}
.tag.retrieval{background:#1e1b4b;color:#818cf8}
.tag.training{background:#052e16;color:#34d399}
.tag.unknown{background:#1c1917;color:#78716c}

/* CAMPAIGN BANNER */
.campaign-banner{padding:18px;display:flex;align-items:flex-start;gap:16px}
.cb-icon{width:36px;height:36px;border-radius:6px;background:#052e16;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px}
.cb-name{font-size:14px;font-weight:600;margin-bottom:2px}
.cb-meta{font-size:11px;color:#555}
.cb-copy{font-size:12px;color:#666;line-height:1.6;margin-top:8px;border-left:2px solid #1a1a1a;padding-left:10px}

/* SNIPPET */
.snippet-box{padding:16px 18px}
.mono{font-family:'Courier New',monospace;font-size:11px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:5px;padding:12px 14px;color:#555;word-break:break-all;line-height:1.6}
</style>
</head>
<body>

<header>
  <div class="header-left">
    <a href="/portal" class="back">← Accounts</a>
    <span class="header-brand"><span class="accent-dot"></span>${pub.name}</span>
  </div>
  <div class="header-right">
    <span><span class="live-dot"></span> Live</span>
    <span>Publisher Portal</span>
  </div>
</header>

<main>
  <div class="page-title">${pub.name}</div>
  <div class="page-sub">${pub.domain} · ${pub.category.replace('_',' ')} · Auto-refreshes every 10s</div>

  <div class="cards">
    <div class="card card-green">
      <div class="card-lbl">Your Earnings</div>
      <div class="card-val">£${pubEarnings}</div>
      <div class="card-sub">80% revenue share</div>
    </div>
    <div class="card">
      <div class="card-lbl">Total Impressions</div>
      <div class="card-val">${totalImp.toLocaleString()}</div>
      <div class="card-sub">${todayImp.toLocaleString()} today</div>
    </div>
    <div class="card card-blue">
      <div class="card-lbl">AI Visits Driven</div>
      <div class="card-val">${totalClicks.toLocaleString()}</div>
      <div class="card-sub">${overallCTR} visit rate</div>
    </div>
    <div class="card">
      <div class="card-lbl">Unique Visits</div>
      <div class="card-val">${uniqClicks.toLocaleString()}</div>
      <div class="card-sub">${pct(uniqClicks,totalImp)} unique rate</div>
    </div>
  </div>

  <!-- ACTIVE CAMPAIGN -->
  <section>
    <div class="sec-head"><span class="sec-title">Active Campaign on Your Pages</span></div>
    <div class="campaign-banner">
      <div class="cb-icon">📢</div>
      <div>
        <div class="cb-name">${currentCreative ? currentCreative.advertiser : 'No campaign set'}</div>
        <div class="cb-meta">${currentCreative ? 'Category: '+currentCreative.category.replace('_',' ')+' · CPM: £'+(currentCreative.cpmGBP||18) : 'Contact your account manager to activate a campaign'}</div>
        ${currentCreative && currentCreative.text ? '<div class="cb-copy">'+currentCreative.text.substring(0,180)+'…</div>' : ''}
      </div>
    </div>
  </section>

  <!-- TRAFFIC BY PLATFORM -->
  <section>
    <div class="sec-head"><span class="sec-title">AI Traffic by Platform</span></div>
    <table>
      <thead><tr><th>Platform</th><th>Impressions</th><th>Type</th><th>Your Earnings</th></tr></thead>
      <tbody>${platformRows}</tbody>
    </table>
  </section>

  <!-- RECENT BOT VISITS -->
  <section>
    <div class="sec-head"><span class="sec-title">Recent AI Crawler Visits</span></div>
    <table>
      <thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>CPM Range</th></tr></thead>
      <tbody>${visitRows}</tbody>
    </table>
  </section>

  <!-- SDK SNIPPET -->
  <section>
    <div class="sec-head"><span class="sec-title">Your Integration Snippet</span></div>
    <div class="snippet-box">
      <div style="font-size:11px;color:#555;margin-bottom:8px">Add this once to your site's &lt;head&gt; tag to enable injection on all pages:</div>
      <div class="mono">&lt;script src="https://testbot-two-psi.vercel.app/sdk.js?pub=${id}" async&gt;&lt;/script&gt;</div>
      <div style="font-size:11px;color:#444;margin-top:8px">Works on WordPress, Next.js, Webflow, and any HTML site. One line, no configuration required.</div>
    </div>
  </section>
</main>

<script>
setInterval(function() {
  location.reload();
}, 10000);
</script>
</body>
</html>`);
};

function ago(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return new Date(iso).toLocaleDateString();
}
