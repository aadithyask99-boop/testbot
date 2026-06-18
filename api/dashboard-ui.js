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
'<section><h2>Live Auction Board <span style="font-size:12px;color:#888;font-weight:400">(per-page — each page runs its own auction at crawl time · updates every 5s)</span></h2>' +
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
'load();setInterval(load,10000);' +
'</script></body></html>';

