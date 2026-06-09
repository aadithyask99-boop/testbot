module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(getHTML());
};

function getHTML() {
return '<!DOCTYPE html>\
<html lang="en">\
<head>\
<meta charset="UTF-8">\
<meta name="viewport" content="width=device-width,initial-scale=1">\
<title>AI Ad Platform</title>\
<style>\
*{box-sizing:border-box;margin:0;padding:0}\
body{font-family:system-ui,-apple-system,sans-serif;background:#f9f9f9;color:#111;font-size:14px}\
header{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}\
header h1{font-size:14px;font-weight:600}\
#ts{font-size:11px;color:#aaa}\
nav{background:#fff;border-bottom:1px solid #e5e5e5;padding:0 24px;display:flex}\
nav button{background:none;border:none;border-bottom:2px solid transparent;padding:11px 14px;font-size:13px;color:#777;cursor:pointer;font-family:inherit}\
nav button.active{border-bottom-color:#111;color:#111;font-weight:500}\
main{padding:20px 24px;max-width:1000px}\
.tab{display:none}.tab.active{display:block}\
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px}\
.card{background:#fff;border:1px solid #e5e5e5;border-radius:5px;padding:14px}\
.lbl{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}\
.val{font-size:24px;font-weight:600;letter-spacing:-.02em}\
.sub{font-size:11px;color:#aaa;margin-top:3px}\
.blue{color:#2563eb}.green{color:#16a34a}.purple{color:#7c3aed}\
section{background:#fff;border:1px solid #e5e5e5;border-radius:5px;margin-bottom:14px}\
section h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#999;padding:12px 16px;border-bottom:1px solid #f0f0f0}\
table{width:100%;border-collapse:collapse}\
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#aaa;text-align:left;padding:9px 16px;border-bottom:1px solid #f5f5f5}\
td{padding:9px 16px;border-bottom:1px solid #fafafa;font-size:13px}\
tr:last-child td{border-bottom:none}\
tr:hover td{background:#fafafa}\
.tag{display:inline-block;font-size:11px;padding:2px 6px;border-radius:3px;background:#f0f0f0;color:#666}\
.tag.retrieval{background:#eff6ff;color:#2563eb}\
.tag.training{background:#f0fdf4;color:#16a34a}\
.tag.impression{background:#f0f0f0;color:#555}\
.tag.pubclick{background:#fdf4ff;color:#9333ea}\
.tag.advclick{background:#fff7ed;color:#c2410c}\
.cbox{padding:14px}\
.cname{font-size:14px;font-weight:600;margin-bottom:3px}\
.cmeta{font-size:11px;color:#999;margin-bottom:8px}\
.ccopy{font-size:12px;color:#555;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px;margin-bottom:8px}\
.empty{color:#ccc;font-size:12px;padding:14px;text-align:center}\
.fbody{padding:16px;display:grid;gap:12px}\
.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}\
.field label{display:block;font-size:11px;color:#777;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}\
.field input,.field textarea{width:100%;border:1px solid #e5e5e5;border-radius:4px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff}\
.field input:focus,.field textarea:focus{outline:none;border-color:#2563eb}\
.field textarea{min-height:80px;resize:vertical;line-height:1.5}\
.btn{background:#111;color:#fff;border:none;border-radius:4px;padding:9px 18px;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500}\
.btn:hover{background:#333}\
.btnsec{background:#fff;color:#111;border:1px solid #e5e5e5}\
.btnsec:hover{background:#f5f5f5}\
.msg{font-size:12px;padding:8px 10px;border-radius:4px;margin-top:8px}\
.msg.ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}\
.msg.err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}\
.mono{font-family:monospace;font-size:12px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:4px;padding:10px;word-break:break-all;color:#333}\
</style>\
</head>\
<body>\
<header><h1>AI Ad Platform</h1><span id="ts">Loading...</span></header>\
<nav>\
<button class="active" onclick="switchTab(\'overview\',this)">Overview</button>\
<button onclick="switchTab(\'advertiser\',this)">Advertiser</button>\
<button onclick="switchTab(\'publisher\',this)">Publisher</button>\
</nav>\
<main>\
<div id="tab-overview" class="tab active">\
  <div class="grid" id="ov-cards"></div>\
  <section><h2>Recent Activity</h2>\
  <table><thead><tr><th>When</th><th>Event</th><th>Platform</th><th>Detail</th></tr></thead>\
  <tbody id="ov-activity"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>\
  <section><h2>Impressions by AI Platform</h2>\
  <table><thead><tr><th>Platform</th><th>Impressions</th><th>Visits</th><th>Unique Visits</th><th>CTR</th></tr></thead>\
  <tbody id="ov-platforms"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>\
</div>\
<div id="tab-advertiser" class="tab">\
  <section><h2>Active Campaign</h2><div class="cbox" id="adv-campaign"><div class="empty">Loading...</div></div></section>\
  <div class="grid" id="adv-cards"></div>\
  <section><h2>Performance by AI Platform</h2>\
  <table><thead><tr><th>Platform</th><th>Impressions</th><th>AI Visits</th><th>Unique Visits</th><th>Visit Rate</th></tr></thead>\
  <tbody id="adv-platforms"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>\
  <section><h2>Search Queries Driving Visits</h2>\
  <table><thead><tr><th>Query</th><th>Platform</th><th>When</th></tr></thead>\
  <tbody id="adv-queries"><tr><td colspan="3" class="empty">Queries from Perplexity and Google will appear here</td></tr></tbody></table></section>\
  <section><h2>Verification</h2>\
  <div style="padding:14px;display:grid;gap:12px">\
    <div><div class="lbl" style="margin-bottom:6px">Self-Test Command</div>\
    <div class="mono" id="adv-selftest">Loading...</div>\
    <div style="font-size:11px;color:#aaa;margin-top:4px">Run this in your terminal. Your ad copy should appear as a paragraph in the HTML response.</div></div>\
    <div><div class="lbl" style="margin-bottom:6px">Recent Verified Impressions</div>\
    <table><thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>IP Prefix</th></tr></thead>\
    <tbody id="adv-verify"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></div>\
    <div style="font-size:12px;color:#888;line-height:1.6;border-left:2px solid #e5e5e5;padding-left:10px">\
    <b style="color:#555">Independent verification:</b> Each impression is logged with timestamp, platform, User-Agent, and detection confidence. Raw data is stored in Upstash Redis and available on request. You can also verify by asking Perplexity or ChatGPT about ISA platforms and checking for your brand in the response.</div>\
  </div></section>\
  <section><h2>Update Creative</h2>\
  <div class="fbody">\
    <div class="frow"><div class="field"><label>Advertiser</label><input type="text" id="f-adv" placeholder="e.g. Hargreaves Lansdown"></div>\
    <div class="field"><label>Category</label><input type="text" id="f-cat" value="finance_investing"></div></div>\
    <div class="field"><label>Ad Copy</label><textarea id="f-text" placeholder="Your sponsored text (40-80 words)..."></textarea></div>\
    <div class="frow"><div class="field"><label>Destination Link (optional)</label><input type="url" id="f-link" placeholder="https://advertiser.com"></div>\
    <div class="field"><label>Link Label</label><input type="text" id="f-lt" value="Learn more"></div></div>\
    <div class="frow"><div class="field"><label>Advertiser Slug</label><input type="text" id="f-slug" placeholder="e.g. hargreaves-lansdown"></div>\
    <div class="field"><label>CPM (GBP)</label><input type="number" id="f-cpm" value="18" min="1" max="100"></div></div>\
    <div style="display:flex;gap:8px;align-items:center">\
    <button class="btn" onclick="saveCreative()">Save Creative</button>\
    <button class="btn btnsec" onclick="resetForm()">Reset to Current</button>\
    <span id="fmsg"></span></div>\
  </div></section>\
</div>\
<div id="tab-publisher" class="tab">\
  <section><h2>Campaign Running on Your Page</h2><div class="cbox" id="pub-campaign"><div class="empty">Loading...</div></div></section>\
  <div class="grid" id="pub-cards"></div>\
  <section><h2>Crawler Traffic by Platform</h2>\
  <table><thead><tr><th>Platform</th><th>Impressions</th><th>Type</th><th>Visit Rate</th></tr></thead>\
  <tbody id="pub-crawlers"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>\
  <section><h2>Recent Bot Visits</h2>\
  <table><thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>CPM</th></tr></thead>\
  <tbody id="pub-visits"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>\
</div>\
</main>\
<script>\
var opData=null,advData=null,pubData=null,formLoaded=false;\
function switchTab(id,btn){document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});document.querySelectorAll("nav button").forEach(function(b){b.classList.remove("active")});document.getElementById("tab-"+id).classList.add("active");btn.classList.add("active");}\
function ago(iso){var s=Math.floor((Date.now()-new Date(iso))/1000);if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";return new Date(iso).toLocaleDateString();}\
function fmt(n){return (n||0).toLocaleString();}\
function tag(txt,cls){return "<span class=\\"tag "+cls+"\\">"+txt+"</span>";}\
function card(lbl,val,sub,cls){return "<div class=\\"card\\"><div class=\\"lbl\\">"+lbl+"</div><div class=\\"val "+(cls||")\\"">"+val+"</div><div class=\\"sub\\">"+sub+"</div></div>";}\
function renderOverview(){\
  if(!opData)return;\
  var s=opData.summary||{},r=opData.revenue||{};\
  document.getElementById("ov-cards").innerHTML=\
    card("Total Impressions",fmt(s.totalImpressions),fmt(s.todayImpressions)+" today","")+\
    card("Total AI Visits",fmt(s.pubClicks),fmt(s.todayPubClicks)+" today","blue")+\
    card("Unique Visits",fmt(s.uniqClicks),fmt(s.todayUniqClicks)+" today","green")+\
    card("Visit CTR",s.pubCTR||"0.0%","unique: "+(s.uniqCTR||"0.0%"),"green")+\
    card("Retrieval Crawlers",fmt(s.retrieval),"15-25 CPM","")+\
    card("Gross Revenue","£"+r.grossGBP,"Publisher: £"+r.publisherShare60,"");\
  var bots=(opData.recentImpressions||[]).map(function(e){return Object.assign({},e,{_t:"impression"});});\
  var pclk=(opData.recentPubClicks||[]).map(function(e){return Object.assign({},e,{_t:"pubclick"});});\
  var all=[].concat(bots,pclk).sort(function(a,b){return new Date(b.time)-new Date(a.time);}).slice(0,15);\
  document.getElementById("ov-activity").innerHTML=all.length?all.map(function(e){\
    return "<tr><td>"+ago(e.time)+"</td><td>"+tag(e._t==="impression"?"impression":"visit",e._t)+"</td><td>"+(e.platform||"—")+"</td><td style=\\"color:#999;font-size:12px\\">"+(e._t==="impression"?(e.crawlerType||"—"):(e.query||"—"))+"</td></tr>";\
  }).join(""):"<tr><td colspan=\\"4\\" class=\\"empty\\">No activity yet</td></tr>";\
  var pt=opData.platformBreakdown||[];\
  document.getElementById("ov-platforms").innerHTML=pt.filter(function(p){return p.impressions>0;}).map(function(p){\
    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+fmt(p.clicks)+"</td><td>"+fmt(p.uniqueClicks)+"</td><td>"+p.ctr+"</td></tr>";\
  }).join("")||"<tr><td colspan=\\"5\\" class=\\"empty\\">No data yet</td></tr>";\
}\
function renderAdvertiser(){\
  if(!advData)return;\
  var c=advData.campaign||{},imp=advData.impressions||{},vis=advData.visits||{},sp=advData.spend||{},ver=advData.verification||{};\
  document.getElementById("adv-campaign").innerHTML="<div class=\\"cname\\">"+(c.advertiser||"No campaign set")+"</div><div class=\\"cmeta\\">Category: "+(c.category||"—")+" &nbsp;·&nbsp; CPM: £"+(c.cpmGBP||0)+" &nbsp;·&nbsp; Updated: "+(c.updatedAt?ago(c.updatedAt):"—")+"</div>"+(c.text?"<div class=\\"ccopy\\">"+c.text+"</div>":"")+(c.link?"<div style=\\"font-size:11px;color:#2563eb\\">Link: "+c.link+"</div>":"<div style=\\"font-size:11px;color:#ccc\\">No link set</div>");\
  document.getElementById("adv-cards").innerHTML=\
    card("Impressions",fmt(imp.total),fmt(imp.today)+" today","")+\
    card("Total AI Visits",fmt(vis.total),vis.overallCTR+" CTR","blue")+\
    card("Unique Visits",fmt(vis.unique||0),vis.uniqueCTR+" CTR","green")+\
    card("Est. Spend","£"+(sp.estimatedTotalGBP||0),"£"+sp.cpmGBP+" CPM","");\
  var pt=imp.byPlatform||[];\
  document.getElementById("adv-platforms").innerHTML=pt.filter(function(p){return p.impressions>0;}).map(function(p){\
    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+fmt(p.clicks||0)+"</td><td>"+fmt(p.uniqueClicks||0)+"</td><td>"+p.ctr+"</td></tr>";\
  }).join("")||"<tr><td colspan=\\"5\\" class=\\"empty\\">No impressions yet</td></tr>";\
  var q=vis.queries||[];\
  document.getElementById("adv-queries").innerHTML=q.length?q.map(function(q){\
    return "<tr><td>"+q.query+"</td><td>"+q.platform+"</td><td>"+ago(q.time)+"</td></tr>";\
  }).join(""):"<tr><td colspan=\\"3\\" class=\\"empty\\">Queries from Perplexity and Google will appear here</td></tr>";\
  if(ver.selfTest){document.getElementById("adv-selftest").textContent=ver.selfTest.command;}\
  var vl=ver.recentImpressions||[];\
  document.getElementById("adv-verify").innerHTML=vl.length?vl.map(function(e){\
    var conf=parseInt(e.confidence||0);var col=conf>=85?"#16a34a":"#f59e0b";\
    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td style=\\"color:"+col+"\\">"+e.confidence+"</td><td style=\\"font-family:monospace;font-size:11px;color:#aaa\\">"+(e.ipPrefix||"—")+"</td></tr>";\
  }).join(""):"<tr><td colspan=\\"5\\" class=\\"empty\\">No impressions yet</td></tr>";\
  if(!formLoaded){resetForm();formLoaded=true;}\
}\
function renderPublisher(){\
  if(!pubData)return;\
  var c=pubData.campaign||{},e=pubData.earnings||{},t=pubData.traffic||{},cl=pubData.clicks||{};\
  document.getElementById("pub-campaign").innerHTML="<div class=\\"cname\\">"+(c.advertiser||"No campaign")+"</div><div class=\\"cmeta\\">Category: "+(c.category||"—")+" &nbsp;·&nbsp; CPM: £"+(c.cpmGBP||0)+"</div>";\
  document.getElementById("pub-cards").innerHTML=\
    card("Impressions",fmt(t.totalImpressions),fmt(t.today)+" today","")+\
    card("Your Earnings","£"+(e.estimatedGBP||0),"60% share","green")+\
    card("Total AI Visits",fmt(cl.total||0),cl.overallCTR+" CTR","blue")+\
    card("Unique Visits",fmt(cl.unique||0),cl.uniqueCTR+" CTR","green");\
  var pt=t.byPlatform||[];\
  document.getElementById("pub-crawlers").innerHTML=pt.filter(function(p){return p.impressions>0;}).map(function(p){\
    var isTraining=p.platform.indexOf("training")>-1||p.platform.indexOf("Bot")>-1;\
    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+tag(isTraining?"training":"retrieval",isTraining?"training":"retrieval")+"</td><td>"+p.ctr+"</td></tr>";\
  }).join("")||"<tr><td colspan=\\"4\\" class=\\"empty\\">No visits yet</td></tr>";\
  var v=pubData.recentVisits||[];\
  document.getElementById("pub-visits").innerHTML=v.length?v.map(function(e){\
    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td>"+(e.confidence||0)+"%</td><td>£"+(e.cpmMin||0)+"–"+(e.cpmMax||0)+"</td></tr>";\
  }).join(""):"<tr><td colspan=\\"5\\" class=\\"empty\\">No visits yet</td></tr>";\
}\
function resetForm(){\
  if(!advData||!advData.campaign)return;\
  var c=advData.campaign;\
  document.getElementById("f-adv").value=c.advertiser||"";\
  document.getElementById("f-cat").value=c.category||"finance_investing";\
  document.getElementById("f-text").value=c.text||"";\
  document.getElementById("f-link").value=c.link||"";\
  document.getElementById("f-lt").value=c.linkText||"Learn more";\
  document.getElementById("f-slug").value=c.advSlug||"";\
  document.getElementById("f-cpm").value=c.cpmGBP||18;\
}\
function saveCreative(){\
  var body={advertiser:document.getElementById("f-adv").value,category:document.getElementById("f-cat").value,text:document.getElementById("f-text").value,link:document.getElementById("f-link").value,linkText:document.getElementById("f-lt").value,advSlug:document.getElementById("f-slug").value,cpmGBP:parseFloat(document.getElementById("f-cpm").value)};\
  var msg=document.getElementById("fmsg");\
  fetch("/admin/creative",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){\
    if(d.creative){msg.className="msg ok";msg.textContent="Creative updated — live immediately";setTimeout(load,1000);}\
    else{msg.className="msg err";msg.textContent=d.error||"Failed";}\
  }).catch(function(){msg.className="msg err";msg.textContent="Network error";});\
}\
function load(){\
  Promise.all([fetch("/dashboard"),fetch("/dashboard?view=advertiser"),fetch("/dashboard?view=publisher")]).then(function(rs){return Promise.all(rs.map(function(r){return r.json();}));}).then(function(data){\
    opData=data[0];advData=data[1];pubData=data[2];\
    renderOverview();renderAdvertiser();renderPublisher();\
    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");\
  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});\
}\
load();\
setInterval(load,5000);\
</script>\
</body></html>';
}
