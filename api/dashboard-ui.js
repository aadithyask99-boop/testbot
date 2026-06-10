module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
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
'.fbody{padding:16px;display:grid;gap:12px}.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
'.field label{display:block;font-size:11px;color:#777;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}' +
'.field input,.field textarea{width:100%;border:1px solid #e5e5e5;border-radius:4px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff}' +
'.field textarea{min-height:80px;resize:vertical;line-height:1.5}' +
'.btn{background:#111;color:#fff;border:none;border-radius:4px;padding:9px 18px;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500}' +
'.btnsec{background:#fff;color:#111;border:1px solid #e5e5e5}' +
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

'<div id="tab-overview" class="tab active">' +
'<div class="grid" id="ov-cards"></div>' +
'<section><h2>Recent Activity</h2>' +
'<table><thead><tr><th>When</th><th>Event</th><th>Platform</th><th>Detail</th></tr></thead>' +
'<tbody id="ov-activity"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Impressions by AI Platform</h2>' +
'<table><thead><tr><th>Platform</th><th>Impressions</th><th>Total Visits</th><th>Unique Visits</th><th>CTR</th></tr></thead>' +
'<tbody id="ov-platforms"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +
'</div>' +

'<div id="tab-advertiser" class="tab">' +
'<div class="grid" id="adv-cards"></div>' +
'<section><h2>Campaigns <span style="font-size:12px;color:#888;font-weight:400">(auction order — top wins · click a row for detail)</span></h2>' +
'<div style="padding:10px 16px;border-bottom:1px solid #f0f0f0">' +
'<button class="filt active" onclick="setFilter(\'all\',this)">All</button>' +
'<button class="filt" onclick="setFilter(\'finance\',this)">Finance</button>' +
'<button class="filt" onclick="setFilter(\'tech\',this)">Tech</button>' +
'<button class="btn" style="float:right" onclick="addCampaign()">+ Add Campaign</button></div>' +
'<table><thead><tr><th>Advertiser</th><th>CPM</th><th>Daily Budget</th><th>Impr</th><th>Viewable</th><th>Status</th><th></th></tr></thead>' +
'<tbody id="camp-list"><tr><td colspan="7" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Campaign Detail</h2><div class="cbox" id="camp-detail"><div class="empty">Click a campaign above to see its creative and stats</div></div></section>' +
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
'<div class="frow"><div class="field"><label>Category</label><select id="f-cat"><option value="finance">finance</option><option value="tech">tech</option></select></div>' +
'<div class="field"><label>Keywords (comma-separated)</label><input type="text" id="f-kw" placeholder="isa, pension, stocks"></div></div>' +
'<div class="field"><label>Ad Copy</label><textarea id="f-text" placeholder="Your sponsored text (40-80 words)..."></textarea></div>' +
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
'<div class="grid" id="pub-cards"></div>' +
'<section><h2>Winning Creative on Your Pages</h2><div class="cbox" id="pub-winning"><div class="empty">Loading...</div></div></section>' +
'<section><h2>Crawler Traffic by Platform</h2>' +
'<table><thead><tr><th>Platform</th><th>Impressions</th><th>Type</th></tr></thead>' +
'<tbody id="pub-crawlers"><tr><td colspan="3" class="empty">Loading...</td></tr></tbody></table></section>' +
'<section><h2>Recent Bot Visits</h2>' +
'<table><thead><tr><th>When</th><th>Platform</th><th>Type</th><th>Confidence</th><th>Served</th></tr></thead>' +
'<tbody id="pub-visits"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table></section>' +
'</div></main>' +

'<script>' +
'var opData=null,advData=null,pubData=null,formLoaded=false,campFilter=\'all\',selectedCampaign=null;' +
'function switchTab(id,btn){' +
'  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});' +
'  document.querySelectorAll("nav button").forEach(function(b){b.classList.remove("active");});' +
'  document.getElementById("tab-"+id).classList.add("active");' +
'  btn.classList.add("active");' +
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
'    card("AI Visits",fmt(s.pubClicks),fmt(s.todayPubClicks)+" today","purple")+' +
'    card("Gross Revenue",money(r.grossGBP),"pub: "+money(r.publisherShare80),"green")' +
'  );' +
'  var pt=opData.platformBreakdown||[];' +
'  set("ov-platforms",pt.filter(function(p){return p.impressions>0;}).map(function(p){' +
'    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+fmt(p.clicks||0)+"</td><td>"+fmt(p.uniqueClicks||0)+"</td><td>"+p.ctr+"</td></tr>";' +
'  }).join("")||"<tr><td colspan=\'5\' class=\'empty\'>No data yet</td></tr>");' +
'  var all=(opData.recentImpressions||[]).slice(0,15);' +
'  set("ov-activity",all.length?all.map(function(e){' +
'    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td>"+(e.advertiser||e.served||"—")+"</td></tr>";' +
'  }).join(""):"<tr><td colspan=\'4\' class=\'empty\'>No activity yet</td></tr>");' +
'}' +
'function renderAdvertiser(){' +
'  if(!advData)return;' +
'  var cl=advData.campaigns||[],agg=advData.aggregate||{};' +
'  var winner=cl.filter(function(x){return x.isWinner;})[0];' +
'  var activeCount=cl.filter(function(x){return x.active;}).length;' +
'  var totalImpr=cl.reduce(function(a,c){return a+(c.impressions||0);},0);' +
'  var totalSpend=cl.reduce(function(a,c){return a+(c.totalSpendGBP||0);},0);' +
'  set("adv-cards",' +
'    card("Active Campaigns",fmt(activeCount),fmt(cl.length)+" total","")+' +
'    card("Now Winning",winner?winner.advertiser:"None",winner?("£"+winner.cpmGBP+" CPM"):"no eligible campaign","green")+' +
'    card("Total Impressions",fmt(totalImpr),fmt(agg.totalViewable||0)+" viewable","blue")+' +
'    card("Total Spend",money(totalSpend),"£"+(agg.blendedVcpmGBP||0)+" vCPM","")' +
'  );' +
'  renderCampaignList(cl);' +
'}' +
'function renderCampaignList(cl){' +
'  var filtered=cl.filter(function(c){return campFilter==="all"||c.category===campFilter;});' +
'  if(!filtered.length){set("camp-list","<tr><td colspan=\'7\' class=\'empty\'>No campaigns — click + Add Campaign</td></tr>");return;}' +
'  set("camp-list",filtered.map(function(c){' +
'    var badge=c.isWinner?" <span class=\'winbadge\'>WINNING</span>":"";' +
'    var status=c.active?"<span style=\'color:#16a34a\'>Active</span>":"<span style=\'color:#999\'>Paused</span>";' +
'    var sel=(selectedCampaign===c.id)?" style=\'background:#f5f8ff\'":"";' +
'    return "<tr class=\'camp-row\' data-id=\'"+c.id+"\'"+sel+">"+' +
'      "<td><b>"+c.advertiser+"</b>"+badge+"<br><span style=\'font-size:11px;color:#999\'>"+c.id+" · "+c.category+"</span></td>"+' +
'      "<td>£"+c.cpmGBP+"</td>"+' +
'      "<td>"+bar(c.dailyBudgetUsedPct)+" <span style=\'font-size:11px;color:#999\'>"+money(c.dailySpendGBP)+"/£"+c.budgetDailyGBP+"</span></td>"+' +
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
'    "<div class=\'ccopy\'>"+(c.text||"(no creative text)")+"</div>"+' +
'    (c.link?"<div style=\'font-size:11px;color:#2563eb;margin-bottom:10px\'>Link: "+c.link+"</div>":"<div style=\'font-size:11px;color:#ccc;margin-bottom:10px\'>No link set</div>")+' +
'    "<div class=\'grid\' style=\'margin-bottom:10px\'>"+' +
'      card("Impressions",fmt(c.impressions),fmt(c.viewableImpressions)+" viewable","")+' +
'      card("Viewable %",retPct+"%",fmt(c.trainingImpressions)+" training","blue")+' +
'      card("Spend",money(c.totalSpendGBP),money(c.dailySpendGBP)+" today","")+' +
'      card("vCPM",money(c.vcpmGBP),"vs £"+c.cpmGBP+" CPM","green")+' +
'    "</div>"+' +
'    "<div class=\'lbl\' style=\'margin-top:14px\'>Crawlers that saw this ad</div>"+' +
'    platTable+' +
'    "<div style=\'margin-top:14px\'><button class=\'btn camp-editbtn\' data-id=\'"+c.id+"\'>Edit Campaign</button></div>"' +
'  );' +
'  var eb=document.querySelector(".camp-editbtn");' +
'  if(eb)eb.addEventListener("click",function(){editCampaign(this.getAttribute("data-id"));});' +
'  renderCampaignList(cl);' +
'}' +
'function setFilter(cat,btn){' +
'  campFilter=cat;' +
'  document.querySelectorAll(".filt").forEach(function(b){b.classList.remove("active");});' +
'  btn.classList.add("active");' +
'  renderCampaignList((advData&&advData.campaigns)||[]);' +
'}' +
'function fillForm(c){' +
'  var f=function(id,v){var el=document.getElementById(id);if(el)el.value=(v===undefined||v===null)?"":v;};' +
'  f("f-id",c.id);f("f-adv",c.advertiser);' +
'  f("f-kw",(c.keywords||[]).join(", "));' +
'  f("f-text",c.text);f("f-link",c.link);f("f-lt",c.linkText||"Learn more");' +
'  f("f-slug",c.advSlug);f("f-cpm",c.cpmGBP);' +
'  f("f-bd",c.budgetDailyGBP);f("f-bt",c.budgetTotalGBP);' +
'  var sel=document.getElementById("f-cat");if(sel)sel.value=c.category||"finance";' +
'}' +
'function addCampaign(){' +
'  fillForm({id:"",advertiser:"",category:"finance",keywords:[],text:"",link:"",linkText:"Learn more",advSlug:"",cpmGBP:18,budgetDailyGBP:50,budgetTotalGBP:500});' +
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
'function toggleCampaign(id,makeActive){' +
'  fetch("/admin/campaign/pause",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id,active:makeActive})})' +
'  .then(function(r){return r.json();}).then(function(d){load();}).catch(function(){});' +
'}' +
'function saveCreative(){' +
'  var g=function(id){var el=document.getElementById(id);return el?el.value:"";};' +
'  var kw=g("f-kw").split(",").map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s;});' +
'  var body={id:g("f-id"),advertiser:g("f-adv"),category:g("f-cat"),text:g("f-text"),link:g("f-link"),linkText:g("f-lt"),advSlug:g("f-slug"),cpmGBP:parseFloat(g("f-cpm")),budgetDailyGBP:parseFloat(g("f-bd")),budgetTotalGBP:parseFloat(g("f-bt")),keywords:kw,active:true};' +
'  var msg=document.getElementById("fmsg");' +
'  fetch("/admin/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})' +
'  .then(function(r){return r.json();}).then(function(d){' +
'    if(d.campaign){msg.className="msg ok";msg.textContent="Campaign saved — live in auction immediately";setTimeout(load,1000);}' +
'    else{msg.className="msg err";msg.textContent=d.error||"Failed";}' +
'  }).catch(function(){msg.className="msg err";msg.textContent="Network error";});' +
'}' +
'function renderPublisher(){' +
'  if(!pubData)return;' +
'  var c=pubData.campaign||{},e=pubData.earnings||{},t=pubData.traffic||{},au=pubData.auction||{},cl=pubData.clicks||{};' +
'  set("pub-cards",' +
'    card("Your Earnings",money(e.estimatedGBP),"80% share · "+money(e.vcpmGBP)+" vCPM","green")+' +
'    card("Impressions",fmt(t.totalImpressions),fmt(t.today)+" today","")+' +
'    card("Viewable",fmt(t.viewableImpressions),"retrieval crawlers","blue")+' +
'    card("Fill Rate",(t.fillRatePct===null||t.fillRatePct===undefined)?"—":(t.fillRatePct+"%"),"served / bot visits","purple")+' +
'    card("AI Visits",fmt(cl.total||0),fmt(cl.today||0)+" today · "+fmt(cl.unique||0)+" unique","purple")' +
'  );' +
'  set("pub-winning",' +
'    "<div class=\'cname\'>"+(c.advertiser||"No active campaign")+"</div>"+' +
'    "<div class=\'cmeta\'>"+(c.cpmGBP!==null&&c.cpmGBP!==undefined?("£"+c.cpmGBP+" CPM winning · "):"")+(au.competitorCount||0)+" advertiser"+((au.competitorCount===1)?"":"s")+" competing</div>"+' +
'    (c.text?"<div class=\'ccopy\'>"+c.text+"</div>":"<div style=\'font-size:12px;color:#ccc\'>Nothing is being injected right now.</div>")+' +
'    "<div style=\'font-size:11px;color:#aaa;margin-top:8px\'>This is the creative currently served to AI crawlers on your pages.</div>"' +
'  );' +
'  var pt=t.byPlatform||[];' +
'  set("pub-crawlers",pt.filter(function(p){return p.impressions>0;}).map(function(p){' +
'    var isTr=p.platform.indexOf("training")>-1||p.platform.indexOf("Bot")>-1;' +
'    return "<tr><td>"+p.platform+"</td><td>"+fmt(p.impressions)+"</td><td>"+tag(isTr?"training":"retrieval",isTr?"training":"retrieval")+"</td></tr>";' +
'  }).join("")||"<tr><td colspan=\'3\' class=\'empty\'>No visits yet</td></tr>");' +
'  var rv=pubData.recentVisits||[];' +
'  set("pub-visits",rv.length?rv.map(function(e){' +
'    var what=e.served==="none"?"<span style=\'color:#999\'>no campaign</span>":(e.advertiser||"—");' +
'    return "<tr><td>"+ago(e.time)+"</td><td>"+(e.platform||"—")+"</td><td>"+tag(e.crawlerType||"—",e.crawlerType||"")+"</td><td>"+(e.confidence||0)+"%</td><td>"+what+"</td></tr>";' +
'  }).join(""):"<tr><td colspan=\'5\' class=\'empty\'>No visits yet</td></tr>");' +
'}' +
'function load(){' +
'  Promise.all([fetch("/dashboard"),fetch("/dashboard?view=advertiser"),fetch("/dashboard?view=publisher")])' +
'  .then(function(rs){return Promise.all(rs.map(function(r){return r.json();}));})' +
'  .then(function(data){' +
'    opData=data[0];advData=data[1];pubData=data[2];' +
'    renderOverview();renderAdvertiser();renderPublisher();' +
'    if(!formLoaded){addCampaign();formLoaded=true;}' +
'    if(selectedCampaign){selectCampaign(selectedCampaign);}' +
'    document.getElementById("ts").textContent="Updated "+new Date().toLocaleTimeString("en-GB");' +
'  }).catch(function(e){document.getElementById("ts").textContent="Error: "+e.message;});' +
'}' +
'load();setInterval(load,5000);' +
'</script></body></html>';
