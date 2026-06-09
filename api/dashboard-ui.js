module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Ad Platform</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;font-size:14px}
  header{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}
  header h1{font-size:14px;font-weight:600}
  #lastUpdated{font-size:11px;color:#aaa}
  nav{background:#fff;border-bottom:1px solid #e5e5e5;padding:0 24px;display:flex}
  nav button{background:none;border:none;border-bottom:2px solid transparent;padding:11px 14px;font-size:13px;color:#777;cursor:pointer;font-family:inherit;transition:color .15s}
  nav button.active{border-bottom-color:#111;color:#111;font-weight:500}
  main{padding:20px 24px;max-width:980px}
  .tab{display:none}.tab.active{display:block}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px}
  .card{background:#fff;border:1px solid #e5e5e5;border-radius:5px;padding:14px}
  .card .lbl{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
  .card .val{font-size:24px;font-weight:600;letter-spacing:-.02em}
  .card .sub{font-size:11px;color:#aaa;margin-top:3px}
  .val.blue{color:#2563eb}.val.green{color:#16a34a}.val.purple{color:#7c3aed}
  section{background:#fff;border:1px solid #e5e5e5;border-radius:5px;margin-bottom:14px}
  section h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#999;padding:12px 16px;border-bottom:1px solid #f0f0f0}
  table{width:100%;border-collapse:collapse}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#aaa;text-align:left;padding:9px 16px;border-bottom:1px solid #f5f5f5}
  td{padding:9px 16px;border-bottom:1px solid #fafafa;font-size:13px}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafafa}
  .tag{display:inline-block;font-size:11px;padding:2px 6px;border-radius:3px;background:#f0f0f0;color:#666}
  .tag.retrieval{background:#eff6ff;color:#2563eb}
  .tag.training{background:#f0fdf4;color:#16a34a}
  .tag.pubclick{background:#fdf4ff;color:#9333ea}
  .tag.advclick{background:#fff7ed;color:#c2410c}
  .cbox{padding:14px}
  .cbox .name{font-size:14px;font-weight:600;margin-bottom:3px}
  .cbox .meta{font-size:11px;color:#999;margin-bottom:10px}
  .cbox .copy{font-size:12px;color:#555;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px;margin-bottom:10px;white-space:pre-wrap}
  .cbox .link-preview{font-size:11px;color:#2563eb}
  .empty{color:#ccc;font-size:12px;padding:16px;text-align:center}
  /* Form styles */
  .form-section{background:#fff;border:1px solid #e5e5e5;border-radius:5px;margin-bottom:14px}
  .form-section h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#999;padding:12px 16px;border-bottom:1px solid #f0f0f0}
  .form-body{padding:16px;display:grid;gap:12px}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field label{display:block;font-size:11px;color:#777;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
  .field input,.field textarea,.field select{width:100%;border:1px solid #e5e5e5;border-radius:4px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:#111}
  .field input:focus,.field textarea:focus{outline:none;border-color:#2563eb}
  .field textarea{min-height:80px;resize:vertical;line-height:1.5}
  .btn{background:#111;color:#fff;border:none;border-radius:4px;padding:9px 18px;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500}
  .btn:hover{background:#333}
  .btn.secondary{background:#fff;color:#111;border:1px solid #e5e5e5}
  .btn.secondary:hover{background:#f5f5f5}
  .msg{font-size:12px;padding:8px 10px;border-radius:4px;margin-top:8px}
  .msg.ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
  .msg.err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
</style>
</head>
<body>

<header>
  <h1>AI Ad Platform</h1>
  <span id="lastUpdated">—</span>
</header>

<nav>
  <button class="active" onclick="switchTab('overview',this)">Overview</button>
  <button onclick="switchTab('advertiser',this)">Advertiser</button>
  <button onclick="switchTab('publisher',this)">Publisher</button>
</nav>

<main>

<!-- OVERVIEW TAB -->
<div id="tab-overview" class="tab active">
  <div class="grid" id="ov-cards"><div class="empty">Loading…</div></div>
  <section>
    <h2>Recent Activity</h2>
    <table><thead><tr><th>When</th><th>Event</th><th>Platform</th><th>Detail</th></tr></thead>
    <tbody id="ov-activity"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table>
  </section>
  <section>
    <h2>Impressions by AI Platform</h2>
    <table><thead><tr><th>Platform</th><th>Impressions</th><th>Publisher Clicks</th><th>Ad Clicks</th><th>CTR</th></tr></thead>
    <tbody id="ov-platforms"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table>
  </section>
</div>

<!-- ADVERTISER TAB -->
<div id="tab-advertiser" class="tab">
  <section>
    <h2>Active Campaign</h2>
    <div class="cbox" id="adv-campaign"><div class="empty">Loading…</div></div>
  </section>
  <div class="grid" id="adv-cards"><div class="empty">Loading…</div></div>
  <section>
    <h2>Performance by AI Platform</h2>
    <table><thead><tr><th>Platform</th><th>Impressions</th><th>Total Visits</th><th>Unique Visits</th><th>CTR</th></tr></thead>
    <tbody id="adv-platforms"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table>
  </section>
  <section>
    <h2>Search Queries That Drove AI-Driven Visits</h2>
    <table><thead><tr><th>Query</th><th>Platform</th><th>When</th></tr></thead>
    <tbody id="adv-queries"><tr><td colspan="3" class="empty">No query data yet</td></tr></tbody></table>
  </section>

  <!-- VERIFICATION PANEL -->
  <section>
    <h2>Verification</h2>
    <div style="padding:14px;display:grid;gap:12px">
      <div>
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Self-Test Command</div>
        <div style="font-family:monospace;font-size:12px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:4px;padding:10px;color:#333;word-break:break-all" id="adv-selftest">Loading…</div>
        <div style="font-size:11px;color:#aaa;margin-top:4px">Run this to verify your creative is live. Your ad copy should appear as a paragraph in the HTML output.</div>
      </div>
      <div>
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Recent Verified Impressions</div>
        <table>
          <thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>IP Prefix</th></tr></thead>
          <tbody id="adv-verify-log"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
        </table>
      </div>
      <div style="font-size:12px;color:#888;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px">
        <b style="color:#555">How to verify independently:</b> Each impression is logged with timestamp, IP, User-Agent, and detection confidence. Impression data is stored in Upstash Redis and available on request. You can also check your brand is appearing in AI responses by asking Perplexity or ChatGPT about ISA investment strategies and looking for your brand name in the response.
      </div>
    </div>
  </section>

  <!-- CREATIVE UPDATE FORM -->
  <div class="form-section">
    <h2>Update Creative</h2>
    <div class="form-body">
      <div class="form-row">
        <div class="field"><label>Advertiser Name</label><input type="text" id="f-advertiser" placeholder="e.g. Hargreaves Lansdown"></div>
        <div class="field"><label>Category</label><input type="text" id="f-category" value="finance_investing"></div>
      </div>
      <div class="field"><label>Ad Copy (40–80 words)</label><textarea id="f-text" placeholder="Your sponsored text here…"></textarea></div>
      <div class="form-row">
        <div class="field"><label>Destination Link (optional)</label><input type="url" id="f-link" placeholder="https://advertiser.com"></div>
        <div class="field"><label>Link Label</label><input type="text" id="f-linktext" placeholder="Learn more" value="Learn more"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Advertiser Slug</label><input type="text" id="f-slug" placeholder="e.g. hargreaves-lansdown"></div>
        <div class="field"><label>CPM (£)</label><input type="number" id="f-cpm" value="18" min="1" max="100"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" onclick="updateCreative()">Save Creative</button>
        <button class="btn secondary" onclick="loadCurrentCreative()">Reset to Current</button>
        <span id="form-msg"></span>
      </div>
    </div>
  </div>
</div>

<!-- PUBLISHER TAB -->
<div id="tab-publisher" class="tab">
  <section>
    <h2>Campaign Running on Your Page</h2>
    <div class="cbox" id="pub-campaign"><div class="empty">Loading…</div></div>
  </section>
  <div class="grid" id="pub-cards"><div class="empty">Loading…</div></div>
  <section>
    <h2>Crawler Traffic by Platform</h2>
    <table><thead><tr><th>Platform</th><th>Impressions</th><th>Type</th><th>CTR</th></tr></thead>
    <tbody id="pub-crawlers"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table>
  </section>
  <section>
    <h2>Recent Bot Visits</h2>
    <table><thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>CPM range</th></tr></thead>
    <tbody id="pub-visits"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table>
  </section>
</div>

</main>

<script>
let opData = null, advData = null, pubData = null, formLoaded = false;

function switchTab(id, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

const ago = iso => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return new Date(iso).toLocaleDateString();
};
const fmt = n => (n||0).toLocaleString();
const tag = (txt, cls) => \`<span class="tag \${cls}">\${txt}</span>\`;

function renderOverview() {
  if (!opData) return;
  const s = opData.summary || {};
  const r = opData.revenue || {};
  document.getElementById('ov-cards').innerHTML = [
    ['Total Impressions', fmt(s.totalImpressions), s.todayImpressions + ' today', ''],
    ['Total Visits (AI)', fmt(s.pubClicks), s.todayPubClicks + ' today', 'blue'],
    ['Unique Visits (AI)', fmt(s.uniqueClicks || 0), s.todayUniqueClicks + ' today', 'blue'],
    ['Ad Clicks', fmt(s.advClicks), s.todayAdvClicks + ' today', 'purple'],
    ['Pub CTR', s.pubCTR || '0%', 'pub clicks / impressions', 'green'],
    ['Ad CTR', s.advCTR || '0%', 'ad clicks / impressions', ''],
    ['Gross Revenue', '£' + r.grossGBP, 'Platform: £' + r.platformShare40, ''],
  ].map(([l,v,s,c]) => \`<div class="card"><div class="lbl">\${l}</div><div class="val \${c}">\${v}</div><div class="sub">\${s}</div></div>\`).join('');

  // Merge all recent activity
  const bots = (opData.recentImpressions||[]).map(e=>({...e,_t:'impression'}));
  const pc   = (opData.recentPubClicks||[]).map(e=>({...e,_t:'pubclick'}));
  const ac   = (opData.recentAdvClicks||[]).map(e=>({...e,_t:'advclick'}));
  const all  = [...bots,...pc,...ac].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,15);
  document.getElementById('ov-activity').innerHTML = all.length ? all.map(e => \`<tr>
    <td>\${ago(e.time)}</td>
    <td>\${tag(e._t === 'impression' ? 'impression' : e._t === 'pubclick' ? 'pub click' : 'ad click', e._t)}</td>
    <td>\${e.platform||'—'}</td>
    <td style="color:#999;font-size:12px">\${e._t==='impression' ? (e.crawlerType||'—') : (e.query||e.dest||'—')}</td>
  </tr>\`).join('') : '<tr><td colspan="4" class="empty">No activity yet</td></tr>';

  const pt = opData.platformBreakdown || [];
  document.getElementById('ov-platforms').innerHTML = pt.length ? pt.map(p => \`<tr>
    <td>\${p.platform}</td>
    <td>\${fmt(p.impressions)}</td>
    <td>\${fmt(p.pubClicks)}</td>
    <td>—</td>
    <td>\${p.ctr}</td>
  </tr>\`).join('') : '<tr><td colspan="5" class="empty">No data yet</td></tr>';
}

function renderAdvertiser() {
  if (!advData) return;
  const c = advData.campaign || {};
  const imp = advData.impressions || {};
  const pc  = advData.publisherClicks || {};
  const ac  = advData.advertiserClicks || {};
  const sp  = advData.spend || {};

  document.getElementById('adv-campaign').innerHTML = \`
    <div class="name">\${c.advertiser || 'No campaign set'}</div>
    <div class="meta">Category: \${c.category||'—'} &nbsp;·&nbsp; CPM: £\${c.cpmGBP||0} &nbsp;·&nbsp; Updated: \${c.updatedAt ? ago(c.updatedAt) : '—'}</div>
    \${c.text ? \`<div class="copy">\${c.text}</div>\` : ''}
    \${c.link ? \`<div class="link-preview">🔗 \${c.linkText||'Learn more'} → \${c.link}</div>\` : '<div style="font-size:11px;color:#ccc">No link set — add a destination URL to track ad clicks</div>'}
  \`;

  document.getElementById('adv-cards').innerHTML = [
    ['Impressions', fmt(imp.total), imp.today + ' today', ''],
    ['Total AI Visits', fmt(pc.total), pc.overallCTR + ' CTR', 'blue'],
    ['Unique AI Visits', fmt(pc.unique || 0), pc.uniqueCTR + ' unique CTR', 'green'],
    ['Est. Spend', '£' + sp.estimatedTotalGBP, '£' + sp.cpmGBP + ' CPM', ''],
  ].map(([l,v,s,c]) => \`<div class="card"><div class="lbl">\${l}</div><div class="val \${c}">\${v}</div><div class="sub">\${s}</div></div>\`).join('');

  const pt = imp.byPlatform || [];
  const advClickByPlatform = {};
  (ac.recentClicks||[]).forEach(e => {
    if (!e || !e.advertiser) return;
    advClickByPlatform[e.advertiser] = (advClickByPlatform[e.advertiser]||0)+1;
  });
  document.getElementById('adv-platforms').innerHTML = pt.length ? pt.filter(p=>p.impressions>0).map(p => {
    const adCl = (pc.byPlatform||{})[p.platform] || 0;
    const adCtr = p.impressions > 0 ? (adCl/p.impressions*100).toFixed(1)+'%' : '—';
    return \`<tr>
      <td>\${p.platform}</td>
      <td>\${fmt(p.impressions)}</td>
      <td>\${fmt(adCl)}</td>
      <td>\${adCtr}</td>
    </tr>\`;
  }).join('') : '<tr><td colspan="4" class="empty">No impressions yet</td></tr>';

  const q = (pc.queries || []);
  document.getElementById('adv-queries').innerHTML = q.length ? q.map(q => \`<tr>
    <td>\${q.query}</td><td>\${q.platform}</td><td>\${ago(q.time)}</td>
  </tr>\`).join('') : '<tr><td colspan="3" class="empty">Queries appear when Perplexity or Google clicks are tracked</td></tr>';

  // Render verification panel
  const v = advData.verification || {};
  if (v.selfTest) {
    document.getElementById('adv-selftest').textContent = v.selfTest.command;
  }
  const vlog = v.recentImpressions || [];
  document.getElementById('adv-verify-log').innerHTML = vlog.length ? vlog.map(e => `<tr>
    <td>${ago(e.time)}</td>
    <td>${e.platform || '—'}</td>
    <td>${tag(e.crawlerType || '—', e.crawlerType || '')}</td>
    <td style="color:${parseInt(e.confidence) >= 85 ? '#16a34a' : '#f59e0b'}">${e.confidence}</td>
    <td style="font-family:monospace;font-size:11px;color:#aaa">${e.ipPrefix}</td>
  </tr>`).join('') : '<tr><td colspan="5" class="empty">No impressions logged yet</td></tr>';

  if (!formLoaded) {
    loadCurrentCreative();
    formLoaded = true;
  }
}

function renderPublisher() {
  if (!pubData) return;
  const c = pubData.campaign || {};
  const e = pubData.earnings || {};
  const t = pubData.traffic || {};
  const cl = pubData.clicks || {};

  document.getElementById('pub-campaign').innerHTML = \`
    <div class="name">\${c.advertiser || 'No campaign active'}</div>
    <div class="meta">Category: \${c.category||'—'} &nbsp;·&nbsp; CPM: £\${c.cpmGBP||0}</div>
  \`;

  document.getElementById('pub-cards').innerHTML = [
    ['Impressions', fmt(t.totalImpressions), t.today + ' today', ''],
    ['Your Earnings', '£' + e.estimatedGBP, '60% share', 'green'],
    ['Total AI Visits', fmt(cl.total), cl.overallCTR + ' CTR', 'blue'],
    ['Unique AI Visits', fmt(cl.unique || 0), cl.uniqueCTR + ' unique CTR', 'green'],
    ['Gross Revenue', '£' + e.grossGBP, 'before split', ''],
  ].map(([l,v,s,c]) => \`<div class="card"><div class="lbl">\${l}</div><div class="val \${c}">\${v}</div><div class="sub">\${s}</div></div>\`).join('');

  const pt = t.byPlatform || [];
  document.getElementById('pub-crawlers').innerHTML = pt.length ? pt.filter(p=>p.impressions>0).map(p => \`<tr>
    <td>\${p.platform}</td>
    <td>\${fmt(p.impressions)}</td>
    <td>\${tag(p.platform.includes('training') || p.platform.includes('Bot') ? 'training' : 'retrieval', p.platform.includes('training') || p.platform.includes('Bot') ? 'training' : 'retrieval')}</td>
    <td>\${p.ctr}</td>
  </tr>\`).join('') : '<tr><td colspan="4" class="empty">No visits yet</td></tr>';

  const v = pubData.recentVisits || [];
  document.getElementById('pub-visits').innerHTML = v.length ? v.map(v => \`<tr>
    <td>\${ago(v.time)}</td>
    <td>\${v.platform||'—'}</td>
    <td>\${tag(v.crawlerType||'—', v.crawlerType||'')}</td>
    <td>\${v.confidence||0}%</td>
    <td>£\${v.cpmMin||0}–\${v.cpmMax||0}</td>
  </tr>\`).join('') : '<tr><td colspan="5" class="empty">No visits yet</td></tr>';
}

function loadCurrentCreative() {
  if (!advData || !advData.campaign) return;
  const c = advData.campaign;
  document.getElementById('f-advertiser').value = c.advertiser || '';
  document.getElementById('f-category').value   = c.category   || 'finance_investing';
  document.getElementById('f-text').value        = c.text       || '';
  document.getElementById('f-link').value        = c.link       || '';
  document.getElementById('f-linktext').value    = c.linkText   || 'Learn more';
  document.getElementById('f-slug').value        = c.advSlug    || '';
  document.getElementById('f-cpm').value         = c.cpmGBP     || 18;
}

async function updateCreative() {
  const body = {
    advertiser: document.getElementById('f-advertiser').value,
    category:   document.getElementById('f-category').value,
    text:       document.getElementById('f-text').value,
    link:       document.getElementById('f-link').value,
    linkText:   document.getElementById('f-linktext').value,
    advSlug:    document.getElementById('f-slug').value,
    cpmGBP:     parseFloat(document.getElementById('f-cpm').value),
  };
  const msg = document.getElementById('form-msg');
  try {
    const res = await fetch('/admin/creative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      msg.className = 'msg ok';
      msg.textContent = '✓ Creative updated — live immediately';
      setTimeout(() => loadData(), 1000);
    } else {
      msg.className = 'msg err';
      msg.textContent = data.error || 'Update failed';
    }
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = 'Network error';
  }
}

async function loadData() {
  try {
    const [opRes, advRes, pubRes] = await Promise.all([
      fetch('/dashboard'),
      fetch('/dashboard?view=advertiser'),
      fetch('/dashboard?view=publisher'),
    ]);
    opData  = await opRes.json();
    advData = await advRes.json();
    pubData = await pubRes.json();

    renderOverview();
    renderAdvertiser();
    renderPublisher();

    document.getElementById('lastUpdated').textContent =
      'Updated ' + new Date().toLocaleTimeString('en-GB');
  } catch (e) {
    document.getElementById('lastUpdated').textContent = 'Error loading';
  }
}

loadData();
setInterval(loadData, 5000);
</script>
</body>
</html>`);
};
