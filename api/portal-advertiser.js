// ============================================================
// ADVERTISER PORTAL — /portal/advertiser?id=adv_hl
// ============================================================

const { kvGet, kvListGet, kvHashGetAll } = require('../lib/kv');

const ADVERTISERS = {
  adv_hl:  { name:'Hargreaves Lansdown', category:'finance_investing', slug:'hargreaves-lansdown', color:'#4f46e5' },
  adv_fi:  { name:'Fidelity UK',          category:'finance_investing', slug:'fidelity-uk',         color:'#7c3aed' },
  adv_vg:  { name:'Vanguard UK',           category:'finance_investing', slug:'vanguard-uk',         color:'#2563eb' },
  adv_aw:  { name:'AWS Startups',          category:'tech',              slug:'aws-startups',         color:'#ea580c' },
  adv_gh:  { name:'GitHub Enterprise',     category:'tech',              slug:'github-enterprise',    color:'#16a34a' },
};

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  const id  = (req.query && req.query.id) || 'adv_hl';
  const adv = ADVERTISERS[id] || ADVERTISERS.adv_hl;

  // Fetch live data
  const today = new Date().toISOString().split('T')[0];
  const n = v => parseInt(v) || 0;
  const pct = (c, i) => !i ? '0.0%' : (n(c)/i*100).toFixed(1)+'%';

  let totalImp=0, todayImp=0, totalClicks=0, uniqClicks=0, todayClicks=0,
      revenueGBP=0, platformTotals={}, clickTotals={}, recentLogs=[], recentClicks=[],
      currentCreative=null, retrieval=0, training=0;

  try {
    const [ti, td, tc, tu, tcd, rt, tr, pt, ct, rl, rc, cc] = await Promise.all([
      kvGet('stats:impressions:total'),
      kvGet('stats:impressions:date:'+today),
      kvGet('stats:clicks:total'),
      kvGet('stats:unique_clicks:total'),
      kvGet('stats:clicks:date:'+today),
      kvGet('stats:impressions:type:retrieval'),
      kvGet('stats:impressions:type:training'),
      kvHashGetAll('stats:impr_by_platform'),
      kvHashGetAll('stats:click_by_platform'),
      kvListGet('log:recent', 20),
      kvListGet('log:clicks', 20),
      kvGet('creative:'+adv.category),
    ]);
    totalImp=n(ti); todayImp=n(td); totalClicks=n(tc); uniqClicks=n(tu);
    todayClicks=n(tcd); retrieval=n(rt); training=n(tr);
    platformTotals=pt||{}; clickTotals=ct||{}; recentLogs=rl||[]; recentClicks=rc||[];
    currentCreative=cc||null;
    const cpm = (currentCreative&&currentCreative.cpmGBP)||18;
    revenueGBP = ((retrieval*cpm)+(training*cpm*0.3))/1000;
  } catch(e) {}

  const overallCTR = pct(totalClicks, totalImp);

  // Platform table rows
  const allPlatforms = [...new Set([...Object.keys(platformTotals)])].filter(p=>platformTotals[p]>0).sort((a,b)=>(platformTotals[b]||0)-(platformTotals[a]||0));
  const platformRows = allPlatforms.map(p => {
    const imp = platformTotals[p]||0;
    const clk = clickTotals[p]||0;
    return `<tr><td>${p}</td><td>${imp.toLocaleString()}</td><td>${clk.toLocaleString()}</td><td>${pct(clk,imp)}</td></tr>`;
  }).join('') || '<tr><td colspan="4" style="color:#555;text-align:center;padding:16px">No impressions yet</td></tr>';

  // Recent impression rows
  const logRows = recentLogs.slice(0,8).map(e=>`
    <tr>
      <td style="color:#666;font-size:11px">${ago(e.time)}</td>
      <td>${e.platform||'—'}</td>
      <td><span class="tag ${e.crawlerType||''}">${e.crawlerType||'—'}</span></td>
      <td style="color:${parseInt(e.confidence)>=85?'#34d399':'#f59e0b'}">${e.confidence||0}%</td>
      <td style="font-family:monospace;font-size:11px;color:#444">${e.ip?e.ip.split(',')[0].trim().split('.').slice(0,2).join('.')+'.*.*':'—'}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="color:#555;text-align:center;padding:16px">No impressions yet</td></tr>';

  const advSpend = parseFloat(revenueGBP.toFixed(4));

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${adv.name} — Advertiser Portal</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;font-size:14px;min-height:100vh}
a{color:inherit;text-decoration:none}

header{background:#111;border-bottom:1px solid #1a1a1a;padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.header-left{display:flex;align-items:center;gap:12px}
.back{font-size:12px;color:#444;padding:6px 10px;border:1px solid #222;border-radius:5px;transition:all .15s}
.back:hover{border-color:#333;color:#888}
.header-brand{font-size:13px;font-weight:600}
.accent-dot{width:8px;height:8px;border-radius:50%;background:${adv.color};display:inline-block;margin-right:6px}
.header-right{font-size:11px;color:#444;display:flex;align-items:center;gap:16px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

main{max-width:960px;margin:0 auto;padding:28px 24px}

.page-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}
.page-sub{font-size:13px;color:#555;margin-bottom:28px}

/* CARDS */
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.card{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px}
.card-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:8px}
.card-val{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1}
.card-sub{font-size:11px;color:#444;margin-top:4px}
.card-blue .card-val{color:#818cf8}
.card-green .card-val{color:#34d399}
.card-amber .card-val{color:#fbbf24}

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
.tag.retrieval{background:#1e1b4b;color:#818cf8}
.tag.training{background:#052e16;color:#34d399}
.tag.unknown{background:#1c1917;color:#78716c}

/* CREATIVE FORM */
.form-body{padding:18px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#555;margin-bottom:5px}
.field input,.field textarea,.field select{width:100%;background:#0d0d0d;border:1px solid #222;border-radius:5px;padding:9px 11px;font-size:13px;color:#e5e5e5;font-family:inherit;outline:none;transition:border-color .15s}
.field input:focus,.field textarea:focus{border-color:#333}
.field textarea{min-height:90px;resize:vertical;line-height:1.5}
.form-actions{display:flex;align-items:center;gap:10px}
.btn{padding:9px 20px;border-radius:5px;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;border:none;transition:background .15s}
.btn-primary{background:#4f46e5;color:#fff}
.btn-primary:hover{background:#4338ca}
.btn-secondary{background:#1a1a1a;color:#999;border:1px solid #222}
.btn-secondary:hover{background:#222}
.msg{font-size:12px;padding:7px 11px;border-radius:4px}
.msg.ok{background:#052e16;color:#34d399;border:1px solid #14532d}
.msg.err{background:#450a0a;color:#f87171;border:1px solid #7f1d1d}

/* SELF TEST */
.mono{font-family:'Courier New',monospace;font-size:11px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:5px;padding:12px 14px;color:#555;word-break:break-all;line-height:1.6}

</style>
</head>
<body>

<header>
  <div class="header-left">
    <a href="/portal" class="back">← Accounts</a>
    <span class="header-brand"><span class="accent-dot"></span>${adv.name}</span>
  </div>
  <div class="header-right">
    <span><span class="live-dot"></span> Live</span>
    <span>Advertiser Portal</span>
  </div>
</header>

<main>
  <div class="page-title">${adv.name}</div>
  <div class="page-sub">Campaign performance · ${adv.category.replace('_',' ')} · Auto-refreshes every 10s</div>

  <div class="cards">
    <div class="card">
      <div class="card-lbl">Total Impressions</div>
      <div class="card-val">${totalImp.toLocaleString()}</div>
      <div class="card-sub">${todayImp.toLocaleString()} today</div>
    </div>
    <div class="card card-blue">
      <div class="card-lbl">AI Visits</div>
      <div class="card-val">${totalClicks.toLocaleString()}</div>
      <div class="card-sub">${overallCTR} visit rate</div>
    </div>
    <div class="card card-green">
      <div class="card-lbl">Unique Visits</div>
      <div class="card-val">${uniqClicks.toLocaleString()}</div>
      <div class="card-sub">${pct(uniqClicks,totalImp)} unique rate</div>
    </div>
    <div class="card card-amber">
      <div class="card-lbl">Est. Spend</div>
      <div class="card-val">£${advSpend}</div>
      <div class="card-sub">£${(currentCreative&&currentCreative.cpmGBP)||18} CPM</div>
    </div>
  </div>

  <!-- PLATFORM BREAKDOWN -->
  <section>
    <div class="sec-head"><span class="sec-title">Performance by AI Platform</span></div>
    <table>
      <thead><tr><th>Platform</th><th>Impressions</th><th>AI Visits</th><th>Visit Rate</th></tr></thead>
      <tbody>${platformRows}</tbody>
    </table>
  </section>

  <!-- RECENT IMPRESSIONS -->
  <section>
    <div class="sec-head">
      <span class="sec-title">Recent Verified Impressions</span>
      <span style="font-size:11px;color:#444">Confidence ≥ 85% = verified</span>
    </div>
    <table>
      <thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>IP Prefix</th></tr></thead>
      <tbody>${logRows}</tbody>
    </table>
  </section>

  <!-- SELF TEST -->
  <section>
    <div class="sec-head"><span class="sec-title">Independent Verification</span></div>
    <div style="padding:16px 18px;display:grid;gap:12px">
      <div>
        <div style="font-size:11px;color:#555;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Self-test command</div>
        <div class="mono">curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" https://testbot-two-psi.vercel.app/</div>
        <div style="font-size:11px;color:#444;margin-top:6px">Run in your terminal — your ad copy should appear as a paragraph in the HTML response.</div>
      </div>
      <div style="font-size:12px;color:#444;line-height:1.7;border-left:2px solid #1a1a1a;padding-left:12px">
        Every impression is logged with timestamp, platform, and detection confidence. Raw data stored in Upstash Redis. Verify independently by asking Perplexity or ChatGPT about your category and checking for your brand name in the response.
      </div>
    </div>
  </section>

  <!-- UPDATE CREATIVE -->
  <section>
    <div class="sec-head"><span class="sec-title">Update Creative</span></div>
    <div class="form-body">
      <div class="form-grid">
        <div class="field"><label>Advertiser name</label><input type="text" id="f-adv" value="${(currentCreative&&currentCreative.advertiser)||adv.name}"></div>
        <div class="field"><label>Category</label><input type="text" id="f-cat" value="${(currentCreative&&currentCreative.category)||adv.category}" readonly style="opacity:.5;cursor:not-allowed"></div>
      </div>
      <div class="field" style="margin-bottom:12px"><label>Ad copy (40–80 words recommended)</label><textarea id="f-text">${(currentCreative&&currentCreative.text)||''}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Destination link (optional)</label><input type="url" id="f-link" value="${(currentCreative&&currentCreative.link)||''}" placeholder="https://"></div>
        <div class="field"><label>Link label</label><input type="text" id="f-lt" value="${(currentCreative&&currentCreative.linkText)||'Learn more'}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Slug</label><input type="text" id="f-slug" value="${(currentCreative&&currentCreative.advSlug)||adv.slug}"></div>
        <div class="field"><label>CPM (GBP)</label><input type="number" id="f-cpm" value="${(currentCreative&&currentCreative.cpmGBP)||18}" min="1" max="200"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveCreative()">Save creative</button>
        <button class="btn btn-secondary" onclick="resetForm()">Reset</button>
        <span id="fmsg"></span>
      </div>
    </div>
  </section>
</main>

<script>
var formLoaded = false;
var advCategory = '${adv.category}';

function ago(iso) {
  if (!iso) return '—';
  var s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return new Date(iso).toLocaleDateString();
}

function saveCreative() {
  var body = {
    advertiser: document.getElementById('f-adv').value,
    category:   advCategory,
    text:       document.getElementById('f-text').value,
    link:       document.getElementById('f-link').value,
    linkText:   document.getElementById('f-lt').value,
    advSlug:    document.getElementById('f-slug').value,
    cpmGBP:     parseFloat(document.getElementById('f-cpm').value),
  };
  var msg = document.getElementById('fmsg');
  fetch('/admin/creative', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.creative) {
      msg.className = 'msg ok';
      msg.textContent = 'Creative updated — live immediately';
      setTimeout(function(){ msg.textContent=''; }, 4000);
    } else {
      msg.className = 'msg err';
      msg.textContent = d.error || 'Failed to save';
    }
  })
  .catch(function() {
    msg.className = 'msg err';
    msg.textContent = 'Network error';
  });
}

function resetForm() {
  fetch('/admin')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.current && d.current.text) {
        document.getElementById('f-adv').value  = d.current.advertiser || '';
        document.getElementById('f-text').value = d.current.text || '';
        document.getElementById('f-link').value = d.current.link || '';
        document.getElementById('f-lt').value   = d.current.linkText || 'Learn more';
        document.getElementById('f-slug').value = d.current.advSlug || '';
        document.getElementById('f-cpm').value  = d.current.cpmGBP || 18;
      }
    });
}

// Auto-refresh stats (not the form)
setInterval(function() {
  fetch('/dashboard?view=advertiser')
    .then(function(r){ return r.json(); })
    .catch(function(){});
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
