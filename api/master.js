// ============================================================
// MASTER DASHBOARD — /master
// PIN: 123456
// Full operator view: all advertisers, all publishers, revenue
// ============================================================

const { kvGet, kvListGet, kvHashGetAll } = require('../lib/kv');

const ADVERTISERS = [
  { id:'adv_hl', name:'Hargreaves Lansdown', category:'Finance',   status:'active',  cpmGBP:22 },
  { id:'adv_fi', name:'Fidelity UK',          category:'Finance',   status:'active',  cpmGBP:19 },
  { id:'adv_vg', name:'Vanguard UK',           category:'Finance',   status:'paused',  cpmGBP:15 },
  { id:'adv_aw', name:'AWS Startups',          category:'Technology',status:'active',  cpmGBP:21 },
  { id:'adv_gh', name:'GitHub Enterprise',     category:'Technology',status:'paused',  cpmGBP:18 },
];

const PUBLISHERS = [
  { id:'pub_fw', name:'Finance Weekly Demo',  domain:'testbot-two-psi.vercel.app',   category:'Finance' },
  { id:'pub_tm', name:'TechMonthly',           domain:'techmonthly.example.com',      category:'Technology' },
  { id:'pub_fi', name:'Fintech Insider',       domain:'fintechinsider.example.com',   category:'Finance' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  // PIN check via query param (simple, no cookie needed)
  const pin = req.query && req.query.pin;
  if (pin !== '123456') {
    res.status(200).send(PIN_PAGE);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const n = v => parseInt(v) || 0;
  const pct = (c, i) => !i ? '0.0%' : (n(c)/i*100).toFixed(1)+'%';

  let totalImp=0, todayImp=0, totalClicks=0, uniqClicks=0,
      advClicks=0, retrieval=0, training=0,
      platformTotals={}, clickTotals={}, recentLogs=[], recentClicks=[], recentAdvClicks=[],
      currentCreative=null;

  try {
    const [ti,td,tc,tu,tac,rt,tr,pt,ct,rl,rc,rac,cc] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:date:'+today),
      kvGet('stats:clicks:total'),
      kvGet('stats:unique_clicks:total'),
      kvGet('stats:adclicks:total'),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvHashGetAll('stats:impr_by_platform'),
      kvHashGetAll('stats:click_by_platform'),
      kvListGet('log:recent', 100),
      kvListGet('log:clicks', 20),
      kvListGet('log:adclicks', 20),
      kvGet('creative:finance_investing'),
    ]);
    totalImp=n(ti); todayImp=n(td); totalClicks=n(tc); uniqClicks=n(tu);
    advClicks=n(tac); retrieval=n(rt); training=n(tr);
    platformTotals=pt||{}; clickTotals=ct||{}; recentLogs=rl||[];
    recentClicks=rc||[]; recentAdvClicks=rac||[]; currentCreative=cc||null;
  } catch(e) {}

  const cpm = (currentCreative&&currentCreative.cpmGBP)||18;
  const grossRevGBP  = parseFloat(((retrieval*cpm + training*cpm*0.3)/1000).toFixed(4));
  const pubShare     = parseFloat((grossRevGBP * 0.8).toFixed(4));
  const platShare    = parseFloat((grossRevGBP * 0.2).toFixed(4));

  // Build platform rows
  const allPlatforms = Object.keys(platformTotals).filter(p=>platformTotals[p]>0).sort((a,b)=>platformTotals[b]-platformTotals[a]);
  const platformRows = allPlatforms.map(p => {
    const imp = platformTotals[p]||0;
    const clk = clickTotals[p]||0;
    return `<tr><td>${p}</td><td>${imp.toLocaleString()}</td><td>${clk.toLocaleString()}</td><td>${pct(clk,imp)}</td><td style="color:#34d399">£${((imp*cpm*0.8)/1000).toFixed(4)}</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="color:#555;text-align:center;padding:16px">No data yet</td></tr>';

  // Recent activity (merge impressions + clicks)
  const activity = [
    ...(recentLogs.slice(0,20).map(e=>({...e, _t:'impression'}))),
    ...(recentClicks.slice(0,10).map(e=>({...e, _t:'pubclick'}))),
  ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,25);

  const activityRows = activity.map(e => {
    const detail = e._t==='impression' ? (e.crawlerType||'')+'  '+Math.round(e.confidence||0)+'%' : 'from '+(e.platform||'—')+(e.query?' · "'+e.query+'"':'');
    return `<tr>
      <td style="font-size:11px;color:#555">${ago(e.time)}</td>
      <td><span class="tag ${e._t}">${e._t==='impression'?'impression':'visit'}</span></td>
      <td>${e.platform||'—'}</td>
      <td style="font-size:11px;color:#444">${detail}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:#555;text-align:center;padding:16px">No activity yet</td></tr>';

  // Advertiser rows
  const advRows = ADVERTISERS.map(a => {
    const badge = a.status==='active' ? '<span class="badge badge-active">ACTIVE</span>' : '<span class="badge badge-paused">PAUSED</span>';
    return `<tr>
      <td><a href="/portal/advertiser?id=${a.id}" style="color:#818cf8">${a.name}</a></td>
      <td>${a.category}</td>
      <td>${badge}</td>
      <td>£${a.cpmGBP}</td>
      <td>—</td>
    </tr>`;
  }).join('');

  // Publisher rows
  const pubRows = PUBLISHERS.map(p => `
    <tr>
      <td><a href="/portal/publisher?id=${p.id}" style="color:#34d399">${p.name}</a></td>
      <td style="font-size:11px;color:#555">${p.domain}</td>
      <td>${p.category}</td>
      <td style="color:#34d399">—</td>
      <td>—</td>
    </tr>`).join('');

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Master — AI Ad Platform</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;font-size:14px;min-height:100vh}
a{color:inherit;text-decoration:none}

header{background:#111;border-bottom:1px solid #1a1a1a;padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.header-logo{font-size:13px;font-weight:600;letter-spacing:.05em}
.master-badge{font-size:10px;background:#1a1a2e;color:#818cf8;padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:600;margin-left:10px}
.header-right{display:flex;gap:16px;align-items:center}
.header-link{font-size:12px;color:#444;padding:6px 12px;border:1px solid #222;border-radius:5px}
.header-link:hover{border-color:#333;color:#888}

main{max-width:1080px;margin:0 auto;padding:28px 24px}
.page-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}
.page-sub{font-size:13px;color:#555;margin-bottom:28px}

/* TOP STATS */
.top-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px}
.stat-card{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:14px}
.stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#555;margin-bottom:6px}
.stat-val{font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1}
.stat-sub{font-size:10px;color:#444;margin-top:3px}

/* REVENUE BOX */
.rev-box{background:#0d1a0d;border:1px solid #14532d;border-radius:8px;padding:18px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;align-items:center}
.rev-item{text-align:center}
.rev-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:6px}
.rev-val{font-size:28px;font-weight:700;letter-spacing:-.02em}
.rev-gross .rev-val{color:#e5e5e5}
.rev-pub   .rev-val{color:#34d399}
.rev-plat  .rev-val{color:#818cf8}
.rev-sub{font-size:11px;color:#444;margin-top:3px}
.rev-divider{width:1px;background:#1a3a1a;align-self:stretch}

/* SECTIONS */
section{background:#111;border:1px solid #1a1a1a;border-radius:8px;margin-bottom:14px;overflow:hidden}
.sec-head{padding:14px 18px;border-bottom:1px solid #161616;display:flex;align-items:center;justify-content:space-between}
.sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#555}

table{width:100%;border-collapse:collapse}
th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#444;text-align:left;padding:10px 18px;border-bottom:1px solid #161616}
td{padding:10px 18px;border-bottom:1px solid #0f0f0f;font-size:13px}
tr:last-child td{border-bottom:none}
tr:hover td{background:#0d0d0d}

.tag{display:inline-block;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:500}
.tag.impression{background:#1c1917;color:#78716c}
.tag.pubclick{background:#1e1b4b;color:#818cf8}
.badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:500;letter-spacing:.04em}
.badge-active{background:#052e16;color:#34d399}
.badge-paused{background:#1c1917;color:#78716c}

/* TABS */
.tabs{display:flex;gap:0;border-bottom:1px solid #161616}
.tab-btn{background:none;border:none;border-bottom:2px solid transparent;padding:12px 18px;font-size:12px;color:#555;cursor:pointer;font-family:inherit;font-weight:500;margin-bottom:-1px;transition:all .15s}
.tab-btn.active{border-bottom-color:#818cf8;color:#e5e5e5}
.tab-content{display:none}
.tab-content.active{display:block}
</style>
</head>
<body>

<header>
  <div style="display:flex;align-items:center">
    <span class="header-logo">AI Ad Platform</span>
    <span class="master-badge">MASTER</span>
  </div>
  <div class="header-right">
    <span id="ts" style="font-size:11px;color:#444"></span>
    <a href="/portal" class="header-link">Portal →</a>
    <a href="/ui" class="header-link">Legacy UI →</a>
  </div>
</header>

<main>
  <div class="page-title">Operator Overview</div>
  <div class="page-sub">All accounts · All revenue · Auto-refreshes every 10s</div>

  <!-- TOP STATS -->
  <div class="top-stats">
    <div class="stat-card"><div class="stat-lbl">Total Impressions</div><div class="stat-val">${totalImp.toLocaleString()}</div><div class="stat-sub">${todayImp.toLocaleString()} today</div></div>
    <div class="stat-card"><div class="stat-lbl">AI Visits</div><div class="stat-val">${totalClicks.toLocaleString()}</div><div class="stat-sub">${pct(totalClicks,totalImp)} visit rate</div></div>
    <div class="stat-card"><div class="stat-lbl">Unique Visits</div><div class="stat-val">${uniqClicks.toLocaleString()}</div><div class="stat-sub">${pct(uniqClicks,totalImp)} unique rate</div></div>
    <div class="stat-card"><div class="stat-lbl">Retrieval</div><div class="stat-val" style="color:#818cf8">${retrieval.toLocaleString()}</div><div class="stat-sub">£${cpm} CPM</div></div>
    <div class="stat-card"><div class="stat-lbl">Training</div><div class="stat-val" style="color:#34d399">${training.toLocaleString()}</div><div class="stat-sub">£${(cpm*0.3).toFixed(1)} CPM</div></div>
    <div class="stat-card"><div class="stat-lbl">Ad Clicks</div><div class="stat-val" style="color:#fbbf24">${advClicks.toLocaleString()}</div><div class="stat-sub">on creative links</div></div>
  </div>

  <!-- REVENUE SPLIT -->
  <div class="rev-box">
    <div class="rev-item rev-gross"><div class="rev-lbl">Gross Revenue</div><div class="rev-val">£${grossRevGBP}</div><div class="rev-sub">from ${totalImp.toLocaleString()} impressions</div></div>
    <div class="rev-divider"></div>
    <div class="rev-item rev-pub"><div class="rev-lbl">Publisher Payout (80%)</div><div class="rev-val">£${pubShare}</div><div class="rev-sub">to ${PUBLISHERS.length} publishers</div></div>
    <div class="rev-divider"></div>
    <div class="rev-item rev-plat"><div class="rev-lbl">Platform Revenue (20%)</div><div class="rev-val">£${platShare}</div><div class="rev-sub">net to platform</div></div>
  </div>

  <!-- TABBED SECTION -->
  <section>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('activity',this)">Activity</button>
      <button class="tab-btn" onclick="switchTab('platforms',this)">By Platform</button>
      <button class="tab-btn" onclick="switchTab('advertisers',this)">Advertisers</button>
      <button class="tab-btn" onclick="switchTab('publishers',this)">Publishers</button>
    </div>

    <div id="tab-activity" class="tab-content active">
      <table>
        <thead><tr><th>When</th><th>Event</th><th>Platform</th><th>Detail</th></tr></thead>
        <tbody>${activityRows}</tbody>
      </table>
    </div>

    <div id="tab-platforms" class="tab-content">
      <table>
        <thead><tr><th>Platform</th><th>Impressions</th><th>Visits</th><th>CTR</th><th>Publisher Earnings</th></tr></thead>
        <tbody>${platformRows}</tbody>
      </table>
    </div>

    <div id="tab-advertisers" class="tab-content">
      <table>
        <thead><tr><th>Advertiser</th><th>Category</th><th>Status</th><th>CPM</th><th>Spend</th></tr></thead>
        <tbody>${advRows}</tbody>
      </table>
    </div>

    <div id="tab-publishers" class="tab-content">
      <table>
        <thead><tr><th>Publisher</th><th>Domain</th><th>Category</th><th>Earnings</th><th>Impressions</th></tr></thead>
        <tbody>${pubRows}</tbody>
      </table>
    </div>
  </section>
</main>

<script>
function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}

document.getElementById('ts').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB');

setInterval(function() {
  location.reload();
}, 10000);
</script>
</body>
</html>`);
};

// ── PIN PAGE ─────────────────────────────────────────────────
const PIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Master — AI Ad Platform</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;height:100vh;display:flex;align-items:center;justify-content:center}
.box{background:#111;border:1px solid #1a1a1a;border-radius:10px;padding:40px;width:340px;text-align:center}
.title{font-size:16px;font-weight:600;margin-bottom:6px}
.sub{font-size:12px;color:#555;margin-bottom:28px}
.input{width:100%;background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:13px;font-size:20px;text-align:center;letter-spacing:.25em;color:#fff;font-family:monospace;outline:none;margin-bottom:12px}
.input:focus{border-color:#333}
.btn{width:100%;background:#1a1a1a;border:none;border-radius:6px;padding:12px;font-size:13px;color:#aaa;cursor:pointer;font-family:inherit;font-weight:500}
.btn:hover{background:#222}
.back{display:block;margin-top:16px;font-size:12px;color:#333;text-decoration:none}
.back:hover{color:#555}
</style>
</head>
<body>
<div class="box">
  <div class="title">Master dashboard</div>
  <div class="sub">Operator access only</div>
  <input class="input" type="password" id="pin" maxlength="6" placeholder="······" autofocus
         onkeydown="if(event.key==='Enter')go()">
  <button class="btn" onclick="go()">Enter</button>
  <a href="/portal" class="back">← Back to portal</a>
</div>
<script>
function go() {
  var pin = document.getElementById('pin').value;
  window.location.href = '/master?pin=' + pin;
}
</script>
</body>
</html>`;

function ago(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return new Date(iso).toLocaleDateString();
}
