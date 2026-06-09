module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Ad Platform — Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f9f9f9; color: #111; font-size: 14px; }
  header { background: #fff; border-bottom: 1px solid #e5e5e5; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  header span { font-size: 12px; color: #888; }
  nav { background: #fff; border-bottom: 1px solid #e5e5e5; padding: 0 24px; display: flex; gap: 0; }
  nav button { background: none; border: none; border-bottom: 2px solid transparent; padding: 12px 16px; font-size: 13px; color: #666; cursor: pointer; font-family: inherit; }
  nav button.active { border-bottom-color: #111; color: #111; font-weight: 500; }
  nav button:hover:not(.active) { color: #333; }
  main { padding: 24px; max-width: 1000px; }
  .tab { display: none; }
  .tab.active { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px; }
  .card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .card .value { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
  .card .sub { font-size: 11px; color: #888; margin-top: 4px; }
  .card .value.green { color: #16a34a; }
  .card .value.blue { color: #2563eb; }
  section { background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; margin-bottom: 16px; }
  section h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 14px 16px; border-bottom: 1px solid #e5e5e5; }
  table { width: 100%; border-collapse: collapse; }
  table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; text-align: left; padding: 10px 16px; border-bottom: 1px solid #f0f0f0; }
  table td { padding: 10px 16px; border-bottom: 1px solid #f9f9f9; font-size: 13px; }
  table tr:last-child td { border-bottom: none; }
  table tr:hover td { background: #fafafa; }
  .tag { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 3px; background: #f0f0f0; color: #555; }
  .tag.retrieval { background: #eff6ff; color: #2563eb; }
  .tag.training { background: #f0fdf4; color: #16a34a; }
  .tag.click { background: #fdf4ff; color: #9333ea; }
  .campaign-box { padding: 16px; }
  .campaign-box .headline { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .campaign-box .copy { font-size: 12px; color: #555; line-height: 1.5; margin-bottom: 10px; border-left: 2px solid #e5e5e5; padding-left: 10px; }
  .campaign-meta { display: flex; gap: 16px; font-size: 12px; color: #888; }
  .campaign-meta b { color: #111; }
  .loading { color: #aaa; font-size: 13px; padding: 20px; text-align: center; }
  .error { color: #dc2626; font-size: 13px; padding: 16px; }
  .refresh { font-size: 11px; color: #888; }
</style>
</head>
<body>

<header>
  <h1>AI Ad Platform</h1>
  <span class="refresh" id="lastUpdated">Loading...</span>
</header>

<nav>
  <button class="active" onclick="switchTab('overview')">Overview</button>
  <button onclick="switchTab('advertiser')">Advertiser</button>
  <button onclick="switchTab('publisher')">Publisher</button>
</nav>

<main>

<!-- OVERVIEW TAB -->
<div id="tab-overview" class="tab active">
  <div class="grid" id="overview-cards"><div class="loading">Loading...</div></div>
  <section>
    <h2>Recent Activity</h2>
    <table>
      <thead><tr>
        <th>Time</th><th>Event</th><th>Platform</th><th>Detail</th>
      </tr></thead>
      <tbody id="overview-activity"><tr><td colspan="4" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
  <section>
    <h2>Impressions by AI Model</h2>
    <table>
      <thead><tr><th>Platform</th><th>Impressions</th><th>Type</th></tr></thead>
      <tbody id="overview-platforms"><tr><td colspan="3" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
</div>

<!-- ADVERTISER TAB -->
<div id="tab-advertiser" class="tab">
  <section>
    <h2>Active Campaign</h2>
    <div class="campaign-box" id="adv-campaign"><div class="loading">Loading...</div></div>
  </section>
  <div class="grid" id="adv-cards"><div class="loading">Loading...</div></div>
  <section>
    <h2>Performance by AI Model</h2>
    <table>
      <thead><tr><th>Platform</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead>
      <tbody id="adv-platforms"><tr><td colspan="4" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
  <section>
    <h2>Search Queries Driving Clicks</h2>
    <table>
      <thead><tr><th>Query</th><th>Platform</th><th>Time</th></tr></thead>
      <tbody id="adv-queries"><tr><td colspan="3" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
</div>

<!-- PUBLISHER TAB -->
<div id="tab-publisher" class="tab">
  <section>
    <h2>Current Campaign Running on Your Page</h2>
    <div class="campaign-box" id="pub-campaign"><div class="loading">Loading...</div></div>
  </section>
  <div class="grid" id="pub-cards"><div class="loading">Loading...</div></div>
  <section>
    <h2>Bot Traffic by Crawler</h2>
    <table>
      <thead><tr><th>Platform</th><th>Impressions</th><th>Crawler Type</th></tr></thead>
      <tbody id="pub-crawlers"><tr><td colspan="3" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
  <section>
    <h2>Recent Bot Visits</h2>
    <table>
      <thead><tr><th>Time</th><th>Platform</th><th>Type</th><th>Confidence</th><th>CPM</th></tr></thead>
      <tbody id="pub-visits"><tr><td colspan="5" class="loading">Loading...</td></tr></tbody>
    </table>
  </section>
</div>

</main>

<script>
  let pubData = null;
  let advData = null;

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    event.target.classList.add('active');
  }

  function fmt(n) { return (n || 0).toLocaleString(); }
  function timeAgo(iso) {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return d.toLocaleDateString();
  }
  function shortTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function renderOverview() {
    if (!pubData || !advData) return;
    const p = pubData;
    const a = advData;

    // Cards
    document.getElementById('overview-cards').innerHTML = \`
      <div class="card"><div class="label">Total Impressions</div><div class="value">\${fmt(p.summary.totalImpressions)}</div><div class="sub">\${fmt(p.summary.todayImpressions)} today</div></div>
      <div class="card"><div class="label">Total Clicks</div><div class="value blue">\${fmt(p.summary.totalClicks)}</div><div class="sub">\${fmt(p.summary.todayClicks)} today</div></div>
      <div class="card"><div class="label">Overall CTR</div><div class="value green">\${p.summary.overallCTR}</div><div class="sub">clicks / impressions</div></div>
      <div class="card"><div class="label">Est. Revenue</div><div class="value">£\${p.revenue.estimatedGBP}</div><div class="sub">Publisher: £\${p.revenue.publisherShare60pct}</div></div>
      <div class="card"><div class="label">Retrieval Crawlers</div><div class="value">\${fmt(p.summary.retrievalCrawlers)}</div><div class="sub">£15-25 CPM</div></div>
      <div class="card"><div class="label">Training Crawlers</div><div class="value">\${fmt(p.summary.trainingCrawlers)}</div><div class="sub">£3-8 CPM</div></div>
    \`;

    // Activity (merge impressions + clicks, sort by time)
    const botEvents = (p.recentImpressions || []).map(e => ({ ...e, _type: 'impression' }));
    const clickEvents = (p.recentClicks || []).map(e => ({ ...e, _type: 'click' }));
    const all = [...botEvents, ...clickEvents].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 15);

    document.getElementById('overview-activity').innerHTML = all.length ? all.map(e => \`
      <tr>
        <td>\${timeAgo(e.time)}</td>
        <td><span class="tag \${e._type}">\${e._type}</span></td>
        <td>\${e.platform || '—'}</td>
        <td style="color:#888">\${e._type === 'click' ? (e.query || 'no query') : (e.crawlerType || '—')}</td>
      </tr>
    \`).join('') : '<tr><td colspan="4" style="color:#aaa;padding:16px">No activity yet</td></tr>';

    // Platforms table
    const platforms = Object.entries(p.impressionsByPlatform || {}).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
    document.getElementById('overview-platforms').innerHTML = platforms.length ? platforms.map(([name, count]) => \`
      <tr><td>\${name}</td><td>\${fmt(count)}</td><td><span class="tag \${name.toLowerCase().includes('training') || count < 3 ? 'training' : 'retrieval'}">\${name.includes('Bot') || name.includes('training') ? 'training' : 'retrieval'}</span></td></tr>
    \`).join('') : '<tr><td colspan="3" style="color:#aaa;padding:16px">No data yet</td></tr>';
  }

  function renderAdvertiser() {
    if (!advData) return;
    const a = advData;

    // Campaign box
    const c = a.campaign || {};
    document.getElementById('adv-campaign').innerHTML = \`
      <div class="headline">\${c.advertiser || 'No campaign set'}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px">Category: \${c.category || '—'} &nbsp;·&nbsp; CPM: £\${c.cpmGBP || 0} &nbsp;·&nbsp; Updated: \${c.updatedAt ? timeAgo(c.updatedAt) : '—'}</div>
    \`;

    // Cards
    const r = a.reach || {};
    const e = a.engagement || {};
    const s = a.spend || {};
    document.getElementById('adv-cards').innerHTML = \`
      <div class="card"><div class="label">Impressions</div><div class="value">\${fmt(r.totalImpressions)}</div><div class="sub">\${fmt(r.todayImpressions)} today</div></div>
      <div class="card"><div class="label">Clicks</div><div class="value blue">\${fmt(e.totalClicks)}</div><div class="sub">\${fmt(e.todayClicks)} today</div></div>
      <div class="card"><div class="label">CTR</div><div class="value green">\${e.overallCTR || '0.0%'}</div><div class="sub">overall</div></div>
      <div class="card"><div class="label">Est. Spend</div><div class="value">£\${s.estimatedTotalGBP || 0}</div><div class="sub">£\${s.cpmGBP} CPM</div></div>
    \`;

    // Platforms
    const platforms = r.byAIModel || [];
    const clickMap = {};
    (e.byAIModel || []).forEach(x => clickMap[x.platform] = x);

    document.getElementById('adv-platforms').innerHTML = platforms.length ? platforms.map(p => {
      const cl = clickMap[p.platform] || {};
      return \`<tr>
        <td>\${p.platform}</td>
        <td>\${fmt(p.impressions)}</td>
        <td>\${fmt(cl.clicks || 0)}</td>
        <td>\${cl.ctr || '—'}</td>
      </tr>\`;
    }).join('') : '<tr><td colspan="4" style="color:#aaa;padding:16px">No impressions yet</td></tr>';

    // Queries
    const queries = (a.searchQueries || {}).recentQueries || [];
    document.getElementById('adv-queries').innerHTML = queries.length ? queries.map(q => \`
      <tr>
        <td>\${q.query}</td>
        <td>\${q.platform}</td>
        <td>\${timeAgo(q.time)}</td>
      </tr>
    \`).join('') : '<tr><td colspan="3" style="color:#aaa;padding:16px">No click queries yet — clicks from Perplexity and Google will show query here</td></tr>';
  }

  function renderPublisher() {
    if (!advData || !pubData) return;
    const p = pubData;
    const c = advData.campaign || {};

    // Campaign box
    document.getElementById('pub-campaign').innerHTML = \`
      <div class="headline">\${c.advertiser || 'No campaign active'}</div>
      <div style="font-size:11px;color:#888;margin-bottom:6px">Category: \${c.category || '—'} &nbsp;·&nbsp; CPM: £\${c.cpmGBP || 0}</div>
    \`;

    // Cards
    const rev = p.revenue || {};
    document.getElementById('pub-cards').innerHTML = \`
      <div class="card"><div class="label">Your Impressions</div><div class="value">\${fmt(p.summary.totalImpressions)}</div><div class="sub">\${fmt(p.summary.todayImpressions)} today</div></div>
      <div class="card"><div class="label">Your Earnings</div><div class="value green">£\${rev.publisherShare60pct}</div><div class="sub">60% revenue share</div></div>
      <div class="card"><div class="label">Clicks</div><div class="value blue">\${fmt(p.summary.totalClicks)}</div><div class="sub">from AI citations</div></div>
      <div class="card"><div class="label">CTR</div><div class="value">\${p.summary.overallCTR}</div><div class="sub">clicks / impressions</div></div>
    \`;

    // Crawlers
    const platforms = Object.entries(p.impressionsByPlatform || {}).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
    document.getElementById('pub-crawlers').innerHTML = platforms.length ? platforms.map(([name, count]) => \`
      <tr>
        <td>\${name}</td>
        <td>\${fmt(count)}</td>
        <td><span class="tag \${name.includes('training') || name.includes('Bot') ? 'training' : 'retrieval'}">\${name.includes('training') || name.includes('Bot') ? 'training' : 'retrieval'}</span></td>
      </tr>
    \`).join('') : '<tr><td colspan="3" style="color:#aaa;padding:16px">No visits yet</td></tr>';

    // Recent visits
    const visits = p.recentImpressions || [];
    document.getElementById('pub-visits').innerHTML = visits.length ? visits.slice(0,10).map(v => \`
      <tr>
        <td>\${timeAgo(v.time)}</td>
        <td>\${v.platform || '—'}</td>
        <td><span class="tag \${v.crawlerType}">\${v.crawlerType || '—'}</span></td>
        <td>\${v.confidence || 0}%</td>
        <td>£\${v.cpmMin || 0}–\${v.cpmMax || 0}</td>
      </tr>
    \`).join('') : '<tr><td colspan="5" style="color:#aaa;padding:16px">No visits yet</td></tr>';
  }

  async function loadData() {
    try {
      const [pubRes, advRes] = await Promise.all([
        fetch('/dashboard'),
        fetch('/dashboard?view=advertiser')
      ]);
      pubData = await pubRes.json();
      advData = await advRes.json();

      renderOverview();
      renderAdvertiser();
      renderPublisher();

      document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB');
    } catch (e) {
      document.getElementById('lastUpdated').textContent = 'Error loading data';
    }
  }

  loadData();
  setInterval(loadData, 30000);
</script>
</body>
</html>`);
};
