// ============================================================
// PORTAL LANDING PAGE — /portal
// Split screen: Advertiser (left) | Publisher (right)
// ============================================================

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(HTML);
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Ad Platform</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column;background:#0a0a0a;color:#fff;overflow:hidden}

/* TOP BAR */
.topbar{height:48px;background:#111;border-bottom:1px solid #222;display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0}
.topbar-logo{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#fff;opacity:.9}
.topbar-link{font-size:12px;color:#555;text-decoration:none}
.topbar-link:hover{color:#888}

/* SPLIT */
.split{flex:1;display:flex;overflow:hidden}
.half{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:48px 40px;position:relative;cursor:pointer;transition:background .2s}
.half:first-child{border-right:1px solid #1a1a1a}
.half-adv:hover{background:#0d0d14}
.half-pub:hover{background:#0a140a}

/* ACCENT LINES */
.half-adv::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#4f46e5 0%,#7c3aed 100%)}
.half-pub::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#059669 0%,#10b981 100%)}

/* CONTENT */
.role-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px;opacity:.4;font-weight:500}
.half-adv .role-label{color:#818cf8}
.half-pub .role-label{color:#34d399}

.role-title{font-size:36px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;line-height:1.1}
.role-desc{font-size:14px;color:#666;line-height:1.6;max-width:300px;text-align:center;margin-bottom:32px}

.enter-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:6px;font-size:13px;font-weight:500;font-family:inherit;border:none;cursor:pointer;transition:all .15s;text-decoration:none}
.half-adv .enter-btn{background:#4f46e5;color:#fff}
.half-adv .enter-btn:hover{background:#4338ca}
.half-pub .enter-btn{background:#059669;color:#fff}
.half-pub .enter-btn:hover{background:#047857}

.stat-row{display:flex;gap:24px;margin-top:32px}
.stat{text-align:center}
.stat-val{font-size:20px;font-weight:700;letter-spacing:-.02em}
.stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#444;margin-top:2px}
.half-adv .stat-val{color:#818cf8}
.half-pub .stat-val{color:#34d399}

/* MASTER LINK */
.master-bar{height:36px;background:#0d0d0d;border-top:1px solid #161616;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.master-bar a{font-size:11px;color:#333;text-decoration:none;letter-spacing:.04em}
.master-bar a:hover{color:#555}

/* OVERLAY — entity list */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:100}
.overlay.open{display:flex}
.modal{background:#111;border:1px solid #222;border-radius:10px;width:480px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden}
.modal-head{padding:20px 24px 16px;border-bottom:1px solid #1a1a1a;display:flex;align-items:center;justify-content:space-between}
.modal-title{font-size:14px;font-weight:600}
.modal-close{background:none;border:none;color:#555;font-size:20px;cursor:pointer;line-height:1;padding:0}
.modal-close:hover{color:#999}
.modal-list{overflow-y:auto;padding:8px}
.entity-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:6px;cursor:pointer;transition:background .1s;border:1px solid transparent}
.entity-row:hover{background:#161616;border-color:#222}
.entity-name{font-size:14px;font-weight:500;margin-bottom:2px}
.entity-meta{font-size:11px;color:#555}
.entity-badge{font-size:10px;padding:3px 8px;border-radius:3px;font-weight:500;letter-spacing:.04em}
.badge-active{background:#052e16;color:#34d399}
.badge-paused{background:#1c1917;color:#78716c}
.entity-arrow{color:#333;font-size:16px;margin-left:12px}

/* PIN MODAL */
.pin-modal{background:#111;border:1px solid #222;border-radius:10px;width:340px;padding:32px;text-align:center}
.pin-title{font-size:15px;font-weight:600;margin-bottom:6px}
.pin-desc{font-size:12px;color:#555;margin-bottom:24px}
.pin-input{width:100%;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;padding:12px;font-size:18px;text-align:center;letter-spacing:.2em;color:#fff;font-family:monospace;outline:none}
.pin-input:focus{border-color:#444}
.pin-btn{width:100%;margin-top:12px;background:#222;border:none;border-radius:6px;padding:11px;font-size:13px;color:#ccc;cursor:pointer;font-family:inherit;font-weight:500;transition:background .15s}
.pin-btn:hover{background:#2a2a2a}
.pin-err{font-size:12px;color:#ef4444;margin-top:8px;display:none}
</style>
</head>
<body>

<div class="topbar">
  <span class="topbar-logo">AI Ad Platform</span>
  <a href="/ui" class="topbar-link">Operator View →</a>
</div>

<div class="split">
  <!-- ADVERTISER SIDE -->
  <div class="half half-adv" onclick="openModal('advertiser')">
    <div class="role-label">Advertiser</div>
    <div class="role-title">Place your brand<br>in AI responses</div>
    <p class="role-desc">Your message, injected into the pages AI crawlers read when answering user questions in real time.</p>
    <button class="enter-btn" onclick="openModal('advertiser');event.stopPropagation()">
      Enter portal <span>→</span>
    </button>
    <div class="stat-row">
      <div class="stat"><div class="stat-val" id="adv-stat-imp">—</div><div class="stat-lbl">Impressions today</div></div>
      <div class="stat"><div class="stat-val" id="adv-stat-ctr">—</div><div class="stat-lbl">Avg visit rate</div></div>
      <div class="stat"><div class="stat-val" id="adv-stat-plat">—</div><div class="stat-lbl">AI platforms</div></div>
    </div>
  </div>

  <!-- PUBLISHER SIDE -->
  <div class="half half-pub" onclick="openModal('publisher')">
    <div class="role-label">Publisher</div>
    <div class="role-title">Monetise your<br>AI crawler traffic</div>
    <p class="role-desc">AI bots are visiting your site thousands of times a week. Turn those invisible visits into a new revenue stream.</p>
    <button class="enter-btn" onclick="openModal('publisher');event.stopPropagation()">
      Enter portal <span>→</span>
    </button>
    <div class="stat-row">
      <div class="stat"><div class="stat-val" id="pub-stat-earn">—</div><div class="stat-lbl">Publisher earnings</div></div>
      <div class="stat"><div class="stat-val" id="pub-stat-imp">—</div><div class="stat-lbl">Total impressions</div></div>
      <div class="stat"><div class="stat-val" id="pub-stat-share">80%</div><div class="stat-lbl">Revenue share</div></div>
    </div>
  </div>
</div>

<div class="master-bar">
  <a href="#" onclick="openPin();return false;">Master dashboard →</a>
</div>

<!-- ADVERTISER ENTITY LIST -->
<div class="overlay" id="overlay-advertiser" onclick="closeOverlay(event,this)">
  <div class="modal">
    <div class="modal-head">
      <span class="modal-title">Select advertiser account</span>
      <button class="modal-close" onclick="closeModal('advertiser')">×</button>
    </div>
    <div class="modal-list" id="adv-list">
      ${buildAdvertiserList()}
    </div>
  </div>
</div>

<!-- PUBLISHER ENTITY LIST -->
<div class="overlay" id="overlay-publisher" onclick="closeOverlay(event,this)">
  <div class="modal">
    <div class="modal-head">
      <span class="modal-title">Select publisher account</span>
      <button class="modal-close" onclick="closeModal('publisher')">×</button>
    </div>
    <div class="modal-list" id="pub-list">
      ${buildPublisherList()}
    </div>
  </div>
</div>

<!-- PIN MODAL -->
<div class="overlay" id="overlay-pin" onclick="closeOverlay(event,this)">
  <div class="pin-modal" onclick="event.stopPropagation()">
    <div class="pin-title">Master dashboard</div>
    <div class="pin-desc">Enter the operator PIN to continue</div>
    <input class="pin-input" type="password" id="pin-input" maxlength="6" placeholder="······"
           onkeydown="if(event.key==='Enter')checkPin()">
    <button class="pin-btn" onclick="checkPin()">Enter</button>
    <div class="pin-err" id="pin-err">Incorrect PIN</div>
  </div>
</div>

<script>
// ── DUMMY DATA (replace with real KV reads later) ─────────────
const ADVERTISERS = [
  { id:'adv_hl',   name:'Hargreaves Lansdown', slug:'hargreaves-lansdown', category:'Finance',   status:'active',  impressions:1840, spend:'£40.48', ctr:'18.2%' },
  { id:'adv_fi',   name:'Fidelity UK',          slug:'fidelity-uk',         category:'Finance',   status:'active',  impressions: 920, spend:'£17.48', ctr:'14.6%' },
  { id:'adv_vg',   name:'Vanguard UK',           slug:'vanguard-uk',         category:'Finance',   status:'paused',  impressions: 560, spend:'£10.08', ctr:'11.3%' },
  { id:'adv_aw',   name:'AWS Startups',          slug:'aws-startups',        category:'Technology',status:'active',  impressions: 310, spend:'£ 6.51', ctr:'22.1%' },
  { id:'adv_gh',   name:'GitHub Enterprise',     slug:'github-enterprise',   category:'Technology',status:'paused',  impressions:   0, spend:'£ 0.00', ctr:' —'    },
];

const PUBLISHERS = [
  { id:'pub_fw',  name:'Finance Weekly Demo', domain:'testbot-two-psi.vercel.app', category:'Finance',    impressions:1840, earnings:'£33.12' },
  { id:'pub_tm',  name:'TechMonthly',          domain:'techmonthly.example.com',   category:'Technology', impressions: 310, earnings:'£ 5.58' },
  { id:'pub_fi',  name:'Fintech Insider',      domain:'fintechinsider.example.com',category:'Finance',    impressions: 620, earnings:'£11.16' },
];

function buildAdvertiserRow(a) {
  return '<div class="entity-row" onclick="goPortal(\'advertiser\',\'' + a.id + '\')">' +
    '<div>' +
      '<div class="entity-name">' + a.name + '</div>' +
      '<div class="entity-meta">' + a.category + ' · ' + a.impressions.toLocaleString() + ' impressions · ' + a.spend + ' spend · CTR ' + a.ctr + '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<span class="entity-badge ' + (a.status==='active'?'badge-active':'badge-paused') + '">' + a.status.toUpperCase() + '</span>' +
      '<span class="entity-arrow">›</span>' +
    '</div>' +
  '</div>';
}

function buildPublisherRow(p) {
  return '<div class="entity-row" onclick="goPortal(\'publisher\',\'' + p.id + '\')">' +
    '<div>' +
      '<div class="entity-name">' + p.name + '</div>' +
      '<div class="entity-meta">' + p.domain + ' · ' + p.impressions.toLocaleString() + ' impressions · ' + p.earnings + ' earned</div>' +
    '</div>' +
    '<span class="entity-arrow">›</span>' +
  '</div>';
}

// Inject lists on load
document.getElementById('adv-list').innerHTML = ADVERTISERS.map(buildAdvertiserRow).join('');
document.getElementById('pub-list').innerHTML  = PUBLISHERS.map(buildPublisherRow).join('');

// ── MODALS ─────────────────────────────────────────────────
function openModal(role) {
  document.getElementById('overlay-' + role).classList.add('open');
}
function closeModal(role) {
  document.getElementById('overlay-' + role).classList.remove('open');
}
function closeOverlay(e, el) {
  if (e.target === el) el.classList.remove('open');
}
function openPin() {
  document.getElementById('overlay-pin').classList.add('open');
  setTimeout(function(){ document.getElementById('pin-input').focus(); }, 100);
}

// ── NAVIGATION ──────────────────────────────────────────────
function goPortal(role, id) {
  if (role === 'advertiser') {
    window.location.href = '/portal/advertiser?id=' + id;
  } else {
    window.location.href = '/portal/publisher?id=' + id;
  }
}

// ── PIN CHECK ───────────────────────────────────────────────
function checkPin() {
  var pin = document.getElementById('pin-input').value;
  var err = document.getElementById('pin-err');
  if (pin === '123456') {
    window.location.href = '/master';
  } else {
    err.style.display = 'block';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}

// ── LOAD LIVE STATS ─────────────────────────────────────────
fetch('/dashboard')
  .then(function(r){ return r.json(); })
  .then(function(d) {
    var s = d.summary || {};
    var r = d.revenue || {};
    document.getElementById('adv-stat-imp').textContent  = (s.todayImpressions || 0).toLocaleString();
    document.getElementById('adv-stat-ctr').textContent  = s.pubCTR || '0.0%';
    document.getElementById('adv-stat-plat').textContent = Object.keys(d.platformBreakdown || {}).filter(function(p){ return (d.platformBreakdown[p]||0)>0; }).length || '—';
    document.getElementById('pub-stat-earn').textContent = '£' + (r.publisherShare80 || 0).toFixed(2);
    document.getElementById('pub-stat-imp').textContent  = (s.totalImpressions || 0).toLocaleString();
  })
  .catch(function(){});
</script>
</body>
</html>`;

// These functions run at module load to build the initial HTML
function buildAdvertiserList() { return ''; } // populated client-side via JS
function buildPublisherList()  { return ''; }
