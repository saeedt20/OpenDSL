// Host rendering of actual documents. ASP/page scripts are not executed.
// The shipped state.js menu generator runs with an explicit synthetic profile.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const {chromium}=require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/legacy-contracts.json')));
const out=path.join(ROOT,'analysis/ui-system-settings/browser');fs.mkdirSync(out,{recursive:true});
const dict=Object.fromEntries(fs.readFileSync(path.join(ROOT,'overlays/native-english/userfs/EN.dict'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const pages=new Map(contract.pages.map(e=>['/'+e.path.replace('boaroot/cgi-bin/',''),e]));
function expand(s){return s.replace(/<%[\s\S]*?%>/g,t=>{const m=t.match(/String_Entry"\s*,\s*"([^"]+)"/i);return m?(dict[m[1]]||m[1]):'';});}
// state.js show_footer() builds this markup at runtime; the fixture supplies
// the same nodes so the drawn footer can be exercised with page scripts off.
function footerMarkup(feedback){
 const site='https://www.asus.com/Networking/DSL-N12E_C1';
 const manual=site+'/HelpDesk_Manual/?utm_source=asus-product&utm_medium=referral&utm_campaign=router';
 const utility=site+'/HelpDesk_Download/?utm_source=asus-product&utm_medium=referral&utm_campaign=router';
 return '<div align="center" class="bottom-image"></div>'
  +'<div align="center" class="copyright">Copyright \u00a9 2018 ASUSTeK Computer Inc. All Rights Reserved.</div><br>'
  +'<div style="margin-top:-75px;margin-left:205px;"><table width="765px" border="0" align="center" cellpadding="0" cellspacing="0"><tr>'
  +'<td width="20" align="right"><div id="bottom_help_icon" style="margin-right:3px;"></div></td>'
  +'<td width="110" id="bottom_help_title" align="left">Help &amp; Support</td>'
  +'<td width="335" id="bottom_help_link" align="left">&nbsp;&nbsp;<a href="'+manual+'" target="_blank">Manual</a>&nbsp;|&nbsp;<a href="'+utility+'" target="_blank">Utility</a>'
  +(feedback?'&nbsp;|&nbsp;<a href="/Advanced_Feedback.asp" target="_self">Send Feedback</a>':'')
  +'&nbsp;|&nbsp;<a id="registration_link" target="_blank" href="https://account.asus.com/" target="_self">Product Registration</a></td>'
  +'<td width="270" id="bottom_help_FAQ" align="right">FAQ&nbsp;&nbsp;<input type="text" id="FAQ_input" name="FAQ_input" class="input_FAQ_table" maxlength="40"></td>'
  +'<td width="30" align="left"><div id="bottom_help_FAQ_icon" class="bottom_help_FAQ_icon" style="cursor:pointer;margin-left:3px;" target="_blank"></div></td>'
  +'</tr></table></div>';
}
const nativeMenu=require('./native-menu-fixture.cjs');
// Source-matched capabilities for this product: the shipped state.js menu
// generator reads rc_support, and `feedback` is the native Feedback tab on the
// administration pages. Without it the fixture omits a real native tab.
const menuCapabilities={rc_support:'2.4G dsl mssid PARENTAL iptv wds feedback',product:'DSL-N12E C1'};
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent(req.url.split('?')[0]);const entry=pages.get(url.replace('/cgi-bin/','/'));
 if(/^\/cgi-bin\/status_(?:log2|wifi|route|conn)\.cgi$/.test(url)){
  const lines=url.includes('route')?'Kernel IP routing table\nDestination Gateway Genmask Flags Metric Ref Use Iface\n0.0.0.0 192.168.1.1 0.0.0.0 UG 0 0 0 br0\n192.168.1.0 0.0.0.0 255.255.255.0 U 0 0 0 br0':
   url.includes('wifi')?'Station MAC RSSI SSID\n02:00:00:00:00:02 -55 OpenDSL Home\n02:00:00:00:00:03 -71 OpenDSL Home':
   url.includes('conn')?'tcp 0 0 192.168.1.1:80 192.168.1.20:51234 ESTABLISHED\ntcp 0 0 192.168.1.1:443 192.168.1.20:51235 ESTABLISHED':
   'Jan 1 00:00:01 syslogd started: BusyBox v1.17.4\nJan 1 00:00:02 kernel: ADSL line up\nJan 1 00:00:03 nat: started';
  const resize=url.includes('log2')?'':'<script>function reSize(){var f=parent.document.getElementById("status_iframe");if(f)f.height=document.body.scrollHeight;}</script>';
  const body='<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><style>body{margin-right:0}</style>'+resize+'</head><body '+(url.includes('log2')?'':'onload="reSize();"')+' BGCOLOR="#4D595D"><textarea cols="63" rows="27" wrap="off" readonly="readonly" id="textarea" style="width:98%; font-family:\'Courier New\', Courier, mono; font-size:13px;background:#475A5F;color:#FFFFFF;">'+lines+'</textarea></body></html>';
  res.writeHead(200,{'Content-Type':'text/html; charset=iso-8859-1'});res.end(body);return;
 }
 if(entry){let s=expand(fs.readFileSync(path.join(ROOT,'overlays',entry.owner,entry.path),'utf8'));
  s=s.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<script\b[^>]*>[\s\S]*?^\s*<\/script\s*>/gmi,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi,'');
  const shell=nativeMenu(ROOT,dict,url,menuCapabilities);
  s=s.replace('<div id="TopBanner"></div>','<div id="TopBanner">'+shell.banner+'</div>')
   .replace('<div id="mainMenu"></div>','<div id="mainMenu">'+shell.main+'</div>')
   .replace('<div id="subMenu"></div>','<div id="subMenu">'+shell.sub+'</div>')
   .replace('<div id="tabMenu" class="submenuBlock"></div>','<div id="tabMenu" class="submenuBlock">'+shell.tabs+'</div>')
   .replace('<div id="tabMenu"></div>','<div id="tabMenu">'+shell.tabs+'</div>');
  // Never perform backend writes in fixtures. The read-only diagnostic CGI
  // frames are served locally so their real response shape can be themed;
  // every other iframe keeps no src.
  s=s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,m=>/status_(?:log2|wifi|route|conn)\.cgi/.test(m)?m:m.replace(/\s+src=["'][^"']*["']/gi,''));
  // show_footer() writes the help links and FAQ field before load; the fixture
  // supplies the same native nodes. ?footer=no-feedback models feedback_support -1.
  if(s.includes('<div id="footer"></div>')){
   s=s.replace('<div id="footer"></div>','<div id="footer">'+footerMarkup(!/[?&]footer=no-feedback\b/.test(req.url))+'</div>');
  }
  // Fixture for the state that native initial() reveals after checking defaults.
  if(entry.path.endsWith('/device-map/router.asp')){
   // Native WPA2-Personal branch; keep the hidden WEP controls in the DOM.
   s=s.replace('<option value="psk2"','<option selected value="psk2"');
   s=s.replace('id="t0" class="tabclick_NW"','id="t0" class="tabclick_NW" data-fixture="2.4GHz"').replace('display:none; margin-right:2px; width:90px;','margin-right:2px; width:90px;');
   s=s.replace(/(id="wl_ssid"[^>]*value=")[^"]*/, '$1OpenDSL Home');
   for(const [id,value] of Object.entries({LANIP:'192.168.1.1',PINCode:'12345678',MAC:'02:00:00:00:00:01',BandMAC:'02:00:00:00:00:02'}))s=s.replace(new RegExp('(<p[^>]*id="'+id+'"[^>]*>)[\\s\\S]*?</p>'), '$1'+value+'</p>');
   for(const id of ['div_wepencrypt','div_wlkey','div_passphrase'])s=s.replace('id="'+id+'"','id="'+id+'" style="display:none"');
  }
  if(entry.path.endsWith('/device-map/clients.asp')){
   // drawClientList() builds these rows from clientList on the device; the host
   // fixture supplies the same native markup and data objects the adapter reads,
   // without the page's scripts, 3s polling or generated user icons.
   const client=(mac,extra)=>Object.assign({Name:'',IP:'',MacAddr:mac,type:'0',dpiType:'',rssi:'',ssid:'',isWL:0,isOnline:1,ipMethod:'Static',isLogin:0,from:'networkmapd',macRepeat:1,isPrinter:0,isITunes:0,isWebServer:0,isGateway:0},extra);
   const all=[
    client('AA:BB:CC:00:00:01',{Name:'Office PC',IP:'192.168.1.20',ipMethod:'DHCP',dpiType:'Laptop'}),
    client('AA:BB:CC:00:00:02',{Name:'Living Room TV',IP:'192.168.1.31',isWL:1,rssi:'-55',ssid:'OpenDSL Home',dpiType:'Smart TV'}),
    client('AA:BB:CC:00:00:03',{Name:'Pixel 9',IP:'192.168.1.32',isWL:1,rssi:'-71',ssid:'OpenDSL Home',ipMethod:'Manual',isLogin:1,macRepeat:2,dpiType:'Phone'}),
    client('AA:BB:CC:00:00:04',{Name:'Home NAS',IP:'192.168.1.40',isWebServer:1,dpiType:'NAS'}),
    client('AA:BB:CC:00:00:05',{Name:'Old Tablet',IP:'192.168.1.55',isWL:1,rssi:'-88',isOnline:0,ssid:'OpenDSL Home'})
   ];
   const online=all.filter(c=>c.isOnline);
   const row=c=>{
    const ip=c.isWebServer?'<a class="link" href="http://'+c.IP+'" target="_blank">'+c.IP+'</a>':c.IP;
    const level=c.isWL?(+c.rssi>=-50?'4':+c.rssi>=-80?'3':'2'):'wired';
    return '<div class="clientBg"><table width="100%" height="85px" border="0"><tbody>'
     +'<tr><td rowspan="3" width="80px"><div class="clientIcon type'+c.type+'" title="'+c.dpiType+'"></div></td><td style="height:20px;">'+c.Name+'</td></tr>'
     +'<tr><td style="height:20px;">'+ip+(c.ipMethod==='DHCP'||c.ipMethod==='Manual'?' <span class="ipMethod" title="'+c.ipMethod+'">'+c.ipMethod+'</span>':'')+'</td>'
     +'<td><div style="height:30px;margin-left:0px;" title="'+c.Name+'" class="radioIcon radio_'+level+'"></div>'+(c.isWL?'<div class="band_chrome">2.4 G</div>':'')+'</td></tr>'
     +'<tr><td colspan="2" style="height:20px;"><div style="margin-top:-15px;" class="link">'+c.MacAddr+'</div></td></tr>'
     +'</tbody></table></div>'+(c.macRepeat>1?'<div class="circle"><div>'+c.macRepeat+'</div></div>':'');
   };
   s=s.replace('<div id="client_list_Block"></div>','<div id="client_list_Block"><table width="100%" cellspacing="0" align="center"><tbody><tr><td>'+online.map(row).join('')+'</td></tr></tbody></table></div>');
   s=s.replace('id="tabWired" class="tab_NW" align="center" style="display:none"','id="tabWired" class="tab_NW" align="center"')
    .replace('id="tabWireless" class="tab_NW" align="center" style="display:none"','id="tabWireless" class="tab_NW" align="center"')
    .replace('id="tabWiredNum">0<','id="tabWiredNum">2<')
    .replace('id="tabWirelessNum">0<','id="tabWirelessNum">2<');
   // drawClientList() hides a pager arrow at either end of the list.
   s=s.replace(/(id="leftBtn"[^>]*?)style="[^"]*"/,'$1style="visibility:hidden"')
    .replace(/(id="rightBtn"[^>]*?)style="[^"]*"/,'$1style="visibility:hidden"');
   s=s.replace('</head>','<script>window.__row=function(){return '+JSON.stringify('<table width="100%" cellspacing="0" align="center"><tbody><tr><td>'+online.map(row).join('')+'</td></tr></tbody></table>')+'};'
    +'window.clientList=(function(){var l=[];'+JSON.stringify(online)+'.forEach(function(c){l.push(c.MacAddr);l[c.MacAddr]=c});return l})();'
    +'window.totalClientNum={online:4,wired:2,wireless:2,wireless_0:2,wireless_1:0,wireless_2:0};'
    +'window.wl_nband_title=["2.4 GHz"];'
    +'window.pagesVar={curTab:"online",CLIENTSPERPAGE:7,startIndex:0,endIndex:7,startArray:[0],resetVar:function(){}};'
    +'</script></head>');
  }
  if(entry.path.endsWith('/Advanced_Feedback.asp')){
   // The shipping profile has no USB, so native initial() takes the
   // unsupported-diagnostic branch: both xDSL/Wi-Fi diagnostic rows and the
   // 3G/4G attachment are hidden. The other attachment flags stay native.
   s=s.replace('id="dslx_diag_enable_tr"','id="dslx_diag_enable_tr" style="display:none"')
    .replace('id="dslx_diag_duration_tr"','id="dslx_diag_duration_tr" style="display:none"')
    .replace('id="attach_modem_span" style="color:#FFFFFF;"','id="attach_modem_span" style="display:none"');
  }
  if(entry.path.endsWith('/Advanced_Privacy.asp')){
   // Native initial() reveals the description when neither EULA is accepted,
   // which is the fixture's default nvram state; keep both withdrawal panels
   // hidden exactly as the page's own initial() does.
   s=s.replace('id="privacy_desc" style="font-size:14px; margin: 20px 10px auto 10px; display:none;"','id="privacy_desc" style="font-size:14px; margin: 20px 10px auto 10px; display:block;"');
  }
  if(entry.path.endsWith('/index2.asp')){
   // The shipped initial() explicitly hides USB when usb_support == -1.
   s=s.replace('id="usb1_tr"','id="usb1_tr" style="display:none"').replace('id="usb2_tr"','id="usb2_tr" style="display:none"');
   // ?map=empty keeps the native count but supplies no client records, so the
   // regression proves the preview never invents device rows.
   const emptyMap=/[?&]map=empty\b/.test(req.url);
   s=s.replace(/(<strong id="NM_connect_status"[^>]*>)[\s\S]*?<\/strong>/,'$1Connected</strong>')
    .replace(/(<strong id="ddnsHostName"[^>]*>)[\s\S]*?<\/strong>/,'$1Disabled</strong>')
    .replace('id="wanIP_status" class="index_status" style="font-size:14px;"></strong>','id="wanIP_status" class="index_status" style="font-size:14px;">192.0.2.25</strong>')
    .replace('id="wl_securitylevel_span" class="index_status"></strong>','id="wl_securitylevel_span" class="index_status">WPA2-Personal</strong>')
    .replace('id="clientNumber" style="cursor:pointer;"></div>','id="clientNumber" style="cursor:pointer;">Connected devices: <strong id="_clientNumber">4</strong></div>')
    .replace('id="helpname" style="padding-top:10px;font-size:16px;"></div>','id="helpname" style="padding-top:10px;font-size:16px;">Wireless settings</div>')
    .replace('id="statusframe"','src="/device-map/router.asp" id="statusframe"');
   for(const [id,value] of Object.entries({od_gw_ssid:'OpenDSL Home',od_gw_lanip:'192.168.1.1',od_gw_wps:'',od_gw_mac:'02:00:00:00:00:01',od_gw_bandmac:'02:00:00:00:00:02',od_dsl_down:'8397 kbps',od_dsl_up:'1024 kbps',od_dsl_state:'up',od_dsl_type:'ADSL2+'}))s=s.replace('id="'+id+'">','id="'+id+'">'+value);
   // Native clientList shape from client_function.js: online records drive the
   // preview; an offline cached record must stay out of it.
   const nativeClients=[
    {Name:'Office PC',IP:'192.168.1.20',MacAddr:'AA:BB:CC:00:00:01',isWL:0,isOnline:1,type:'0'},
    {Name:'Living Room TV',IP:'192.168.1.31',MacAddr:'AA:BB:CC:00:00:02',isWL:1,isOnline:1,type:'0'},
    {Name:'Pixel 9',IP:'192.168.1.32',MacAddr:'AA:BB:CC:00:00:03',isWL:1,isOnline:1,type:'0'},
    {Name:'Home NAS',IP:'192.168.1.40',MacAddr:'AA:BB:CC:00:00:04',isWL:0,isOnline:1,type:'0'},
    {Name:'Old Tablet',IP:'192.168.1.55',MacAddr:'AA:BB:CC:00:00:05',isWL:1,isOnline:0,type:'0'}
   ];
   const clientFixture='<script>window.originData={size:4};window.totalClientNum={online:4,wired:2,wireless:2};'
    +(emptyMap?'window.clientList=[];':'window.clientList=(function(){var l=[];'+JSON.stringify(nativeClients)+'.forEach(function(c){l.push(c.MacAddr);l[c.MacAddr]=c});return l})();')+'</script>';
   s=s.replace('</head>',clientFixture+'</head>');
  }
  s=s.replace('</head>','<script>window.search_supportsite=function(){window.__faqSearches=(window.__faqSearches||0)+1;};</script><script defer src="/opendsl/legacy.js"></script></head>');
  // The shipped iPhone switch plugin renders its own markup; the fixture has
  // no page scripts, so the off-state control is injected to show the real
  // control shape without inventing behaviour.
  s=s.replace(/<div class="iphone_switch_container"([^>]*)>([\s\S]*?)<\/div>/gi,
   '<div class="iphone_switch_container"$1><img id="iphone_switch" class="iphone_switch" src="/switcherplugin/iphone_switch_container_off.png" style="height:32px; width:74px"/></div>');
  if(entry.path.endsWith('/Main_Password.asp'))s=s.replace('id="loginTable" align="center" cellpadding="0" cellspacing="0" style="display:none"','id="loginTable" align="center" cellpadding="0" cellspacing="0" style="display:table"');
  if(entry.path.endsWith('/QIS_wizard.asp'))s=s.replace('name="contentM" id="contentM"','src="/qis/QIS_admin_pass.asp" name="contentM" id="contentM"');
  if(entry.path.endsWith('/Advanced_ASUSDDNS_Content.asp')){
   // Native initial state over a public WAN address (valid_wan_ip):
   // both conditional messages start hidden and the page script owns toggling.
   s=s.replace('id="wan_ip_hide2"','id="wan_ip_hide2" style="display:none"').replace('id="wan_ip_hide3"','id="wan_ip_hide3" style="display:none"');
  }
  if(entry.path.endsWith('/Main_TrafficMonitor_realtime.asp')&&/[?&]wrapper=1\b/.test(req.url)){
   // Reproduce state.js browser_compatibility(): every child of #tabMenu's
   // cell is wrapped in an inline -140px div before the enhancement loads.
   // The inline fixture script runs while parsing; deferred legacy.js runs
   // after it, exactly like the device lifecycle.
   s=s.replace('</body>','<script>(function(){var t=document.getElementById("tabMenu");if(!t)return;var c=t.parentNode;var d=document.createElement("div");d.style.marginTop="-140px";while(c.firstChild)d.appendChild(c.firstChild);c.appendChild(d);})();</script></body>');
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);return;
 }
 let file;
 for(const base of ['overlays/opendsl-ui','overlays/native-english','overlays/security','analysis/recheck-015-image/candidate-tree']){const p=path.join(ROOT,base,'boaroot/html',url);if(fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
 if(!file){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'application/octet-stream'});res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 /* Playwright disables bfcache by default; the SFR-01 regression below needs
    a real restored document, not a synthetic pageshow event. */
 const browser=await chromium.launch({headless:true,executablePath:process.env.OPENDSL_CHROMIUM,ignoreDefaultArgs:['--disable-back-forward-cache']});const results=[],failures=[],accessibleControls=[],geometryEvidence={picker:[],refresh:[],qis:[],ssid:[],r6r01:[]},sharedEvidence=[];
 const widths=[1440,1024,390,320];
 /* R6A regressions: the native inspector MACs stay on one readable line at
    every viewport, the map badge never intersects the map title, and the
    Feedback performance caption sizes its block before its select. */
 async function inspectorMacProbe(page){
  const frame=page.frames().find(f=>f.url().includes('/device-map/router.asp'));
  if(!frame)return null;
  await frame.waitForSelector('#MAC',{timeout:5000}).catch(()=>{});
  return frame.evaluate(()=>['MAC','BandMAC'].map(id=>{
   const e=document.getElementById(id);
   if(!e)return {id,missing:true};
   const cs=getComputedStyle(e),cell=e.parentElement.getBoundingClientRect(),ccs=getComputedStyle(e.parentElement);
   const range=document.createRange();range.selectNodeContents(e);
   const rects=[...range.getClientRects()].map(r=>({left:+r.left.toFixed(2),right:+r.right.toFixed(2),top:+r.top.toFixed(2),bottom:+r.bottom.toFixed(2)}));
   return {id,text:e.textContent.trim(),fragments:rects.length,rects,fontSize:parseFloat(cs.fontSize),
    right:rects.length?Math.max(...rects.map(r=>r.right)):null,
    availableRight:cell.right-parseFloat(ccs.paddingRight)-parseFloat(ccs.borderRightWidth),
    lineHeight:parseFloat(cs.lineHeight)};
  }));
 }
 async function waitRouterFrame(page){
  await page.waitForFunction(()=>{
   const f=document.getElementById('statusframe');
   return !!(f&&f.contentDocument&&f.contentDocument.getElementById('MAC'));
  },{timeout:5000});
 }
 async function openEditWifi(page){
  const edit=page.locator('.od-inspector-view[data-od-view="gateway"] .od-action.od-primary');
  await edit.click();
  await page.waitForFunction(()=>{
   const native=document.querySelector('.od-inspector-native');
   const frame=document.getElementById('statusframe');
   return !!(native&&!native.hidden&&frame);
  },{timeout:5000});
  await waitRouterFrame(page);
 }
 function assertInspectorMacs(values,width){
  assert(values&&values.length===2,'inspector MAC values missing at '+width+': '+JSON.stringify(values));
  for(const v of values){
   assert(!v.missing&&/^[0-9A-F:]{17}$/i.test(v.text),'inspector MAC text at '+width+': '+JSON.stringify(v));
   assert.equal(v.fragments,1,'inspector MAC wrapped onto '+v.fragments+' lines at '+width+': '+JSON.stringify(v));
   assert(v.fontSize>=14,'inspector MAC text below 14px at '+width+': '+JSON.stringify(v));
   assert(v.right<=v.availableRight+1,'inspector MAC overflows its cell at '+width+': '+JSON.stringify(v));
  }
 }
 async function mapHeadingProbe(page){
  return page.evaluate(()=>{
   const title=document.querySelector('.od-map-heading'),head=document.querySelector('.od-map-head'),badge=head&&head.querySelector('.od-map-state');
   if(!title||!badge)return {title:!!title,badge:!!badge};
   const tr=title.getBoundingClientRect(),br=badge.getBoundingClientRect(),hr=head.getBoundingClientRect();
   return {title:{left:+tr.left.toFixed(2),right:+tr.right.toFixed(2),top:+tr.top.toFixed(2),bottom:+tr.bottom.toFixed(2)},
    badge:{left:+br.left.toFixed(2),right:+br.right.toFixed(2),top:+br.top.toFixed(2),bottom:+br.bottom.toFixed(2)},
    head:{left:+hr.left.toFixed(2),right:+hr.right.toFixed(2)},text:badge.textContent.trim(),
    state:head.getAttribute('data-state'),
    intersection:{width:+Math.max(0,Math.min(tr.right,br.right)-Math.max(tr.left,br.left)).toFixed(2),
     height:+Math.max(0,Math.min(tr.bottom,br.bottom)-Math.max(tr.top,br.top)).toFixed(2)}};
  });
 }
 function assertMapHeading(h,width){
  assert(h&&h.title&&h.badge,'map heading/status badge missing at '+width+': '+JSON.stringify(h));
  assert(h.intersection.width===0||h.intersection.height===0,'map badge intersects the heading at '+width+': '+JSON.stringify(h));
  assert(h.badge.left>=h.title.right||h.badge.top>=h.title.bottom,'map badge overlaps the heading at '+width+': '+JSON.stringify(h));
  assert(h.badge.left>=h.head.left&&h.badge.right<=h.head.right+0.5,'map badge outside its panel at '+width+': '+JSON.stringify(h));
  assert(h.text===h.state,'map badge text does not match the native status at '+width+': '+JSON.stringify(h));
 }
 async function feedbackCaptionProbe(page){
  return page.evaluate(()=>{
   const label=[...document.querySelectorAll('th')].find(th=>/best describes the performance/i.test(th.textContent));
   const control=label&&label.parentElement.querySelector('select[name="fb_availability"]');
   if(!label||!control)return {missing:true};
   const lr=label.getBoundingClientRect(),cr=control.getBoundingClientRect(),cs=getComputedStyle(label);
   const range=document.createRange();range.selectNodeContents(label);
   const rects=[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
   const lines=new Set(rects.map(r=>r.top)).size;
   return {label:{top:+lr.top.toFixed(2),bottom:+lr.bottom.toFixed(2),height:+lr.height.toFixed(2)},
    control:{top:+cr.top.toFixed(2),left:+cr.left.toFixed(2),right:+cr.right.toFixed(2)},
    display:cs.display,lineHeight:parseFloat(cs.lineHeight),lines,
    overlap:rects.some(r=>r.bottom>cr.top&&r.top<cr.bottom&&r.right>cr.left&&r.left<cr.right),
    textOutside:rects.some(r=>r.bottom>lr.bottom+0.5)};
  });
 }
 function assertFeedbackCaption(c,width){
  assert(c&&!c.missing,'Feedback performance caption missing at '+width+': '+JSON.stringify(c));
  assert.equal(c.overlap,false,'Feedback caption overlaps its select at '+width+': '+JSON.stringify(c));
  assert.equal(c.textOutside,false,'Feedback caption text leaves its own box at '+width+': '+JSON.stringify(c));
  if(c.display==='block')assert(c.label.bottom<=c.control.top+0.5,'Feedback caption does not size before its control at '+width+': '+JSON.stringify(c));
  assert(c.label.height>=c.lines*c.lineHeight,'Feedback caption box shorter than its lines at '+width+': '+JSON.stringify(c));
 }
 /* R6R-04: the four native client filters must size to their own labels and
    counts. Measuring the text ink (not just the box) catches a count pill
    that sits on top of the next label even when the page has no overflow. */
 async function clientTabProbe(page){
  return page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),r:+r.right.toFixed(2),y:+r.top.toFixed(2),b:+r.bottom.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};};
   const ink=e=>{
    const count=e.querySelector('.od-clients-count');const out=[];
    const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
    while((n=walk.nextNode())){
     if(count&&count.contains(n))continue;
     if(!n.textContent.trim())continue;
     const range=document.createRange();range.selectNodeContents(n);
     for(const r of range.getClientRects())out.push({x:r.x,r:r.right,y:r.top,b:r.bottom});
    }
    return out.length?{x:Math.min(...out.map(r=>r.x)),r:Math.max(...out.map(r=>r.r)),y:Math.min(...out.map(r=>r.y)),b:Math.max(...out.map(r=>r.b))}:null;
   };
   return [...document.querySelectorAll('.od-clients-tab')].map(e=>{
    const box=rect(e),label=ink(e),count=e.querySelector('.od-clients-count');
    return {text:e.textContent.replace(/\s+/g,' ').trim(),box,label,count:count?rect(count):null,
     gap:label&&count?+(count.getBoundingClientRect().x-label.r).toFixed(2):null};
   });
  });
 }
 function assertClientTabs(tabs,width){
  assert.equal(tabs.length,4,'client filter count changed at '+width+': '+JSON.stringify(tabs));
  for(const t of tabs){
   assert(t.label&&t.count,'client filter label or count missing at '+width+': '+JSON.stringify(t));
   assert(t.gap>=3,'client filter label/count collision at '+width+': '+JSON.stringify(t));
   assert(t.label.x>=t.box.x-0.5&&t.count.r<=t.box.r+0.5,'client filter content leaves its tab at '+width+': '+JSON.stringify(t));
   assert(t.label.b<=t.count.b+0.5&&t.label.y>=t.count.y-0.5,'client filter label/count not on one line at '+width+': '+JSON.stringify(t));
  }
  for(let i=1;i<tabs.length;i++){
   const a=tabs[i-1],b=tabs[i];
   assert(b.box.x>=a.box.r+3||b.box.y>=a.box.b-0.5,'client filter tabs overlap at '+width+': '+JSON.stringify({a:a.box,b:b.box}));
   // The audited defect was a count pill extending over the next tab's label
   // while each tab box still started at its own grid column.
   if(b.box.y<a.box.b-0.5)assert(b.label.x>=a.count.r+3,'client filter count overlaps the next label at '+width+': '+JSON.stringify({prev:a,next:b}));
  }
 }

 try{for(const width of widths){const page=await browser.newPage({viewport:{width,height:1000}});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  for(const [url,e] of pages){if(process.env.OPENDSL_QA_FILTER&&!url.includes(process.env.OPENDSL_QA_FILTER))continue;await page.goto(base+url,{waitUntil:'load'});
   if(url==='/Advanced_Wireless_Content.asp')await page.evaluate(()=>{
    document.querySelector('[name="wl_auth_mode_x"]').value='psk2';
    for(const name of ['wl_wep_x','wl_key','wl_key1','wl_key2','wl_key3','wl_key4','wl_phrase_x'])document.querySelector('[name="'+name+'"]').closest('tr').style.display='none';
   });
   // The device emits reservation rows only for stored entries; the host fixture
   // has no ASP state, so drop the empty conditional rows to show the real state.
   await page.evaluate(()=>{
    const list=document.getElementById('static_list');
    if(list)for(const row of [...list.rows])if(!row.textContent.trim())row.remove();
   });
   const data=await page.evaluate(()=>{
    const tab=document.querySelector('#tabMenu .tabclick');
    const tabSpan=tab?tab.querySelector('span'):null;
    const side=document.querySelector('#mainMenu')?document.querySelector('#mainMenu').closest('td'):null;
    const field=[...document.querySelectorAll('.FormTable input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.FormTable select,.FormTable textarea')].find(e=>e.getBoundingClientRect().height>0);
    return {embedded:document.body.classList.contains("statusbody"),theme:!!document.querySelector('[data-opendsl-theme="legacy"]'),bg:getComputedStyle(document.body).backgroundColor,bgImage:getComputedStyle(document.body).backgroundImage,fg:getComputedStyle(document.body).color,width:document.documentElement.scrollWidth,viewport:innerWidth,forms:document.forms.length,shadows:[...document.querySelectorAll("body *")].filter(e=>getComputedStyle(e).boxShadow!=="none"||getComputedStyle(e).textShadow!=="none").length,wizardNav:document.getElementById("btn_gotoindex")?{display:getComputedStyle(document.getElementById("btn_gotoindex")).display,top:document.getElementById("btn_gotoindex").getBoundingClientRect().top,width:document.getElementById("btn_gotoindex").getBoundingClientRect().width}:null,bodyWidth:document.body.getBoundingClientRect().width,bodyMin:getComputedStyle(document.body).minWidth,overflowElements:[...document.querySelectorAll("body *")].filter(e=>{if(e.getBoundingClientRect().right<=innerWidth+2)return false;for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const ox=getComputedStyle(p).overflowX;if(ox==='auto'||ox==='scroll')return false;}return true;}).slice(0,60).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,min:getComputedStyle(e).minWidth,csswidth:getComputedStyle(e).width})),
     sidebar:side?Math.round(side.getBoundingClientRect().width):null,
     tabUnderline:tab?getComputedStyle(tab).borderBottomWidth:null,
     tabColor:tab?getComputedStyle(tab).color:null,
     tabBackground:tab?getComputedStyle(tab).backgroundImage:null,
     tabSpanBackground:tabSpan?getComputedStyle(tabSpan).backgroundImage:null,
     tabSpanBackgroundColor:tabSpan?getComputedStyle(tabSpan).backgroundColor:null,
     sectionTitles:document.querySelectorAll('.od-section-title').length,
     pageTitle:document.querySelector('.od-page-head .formfonttitle')?document.querySelector('.od-page-head .formfonttitle').textContent.trim():null,
     fieldHeight:field?Math.round(field.getBoundingClientRect().height):null,
     fieldRadius:field?getComputedStyle(field).borderTopLeftRadius:null,
     primaryButtons:document.querySelectorAll('.od-primary').length,
     editors:[...document.querySelectorAll('table.od-editor')].map((t,i)=>({
      i,id:t.id,cls:String(t.className),rows:t.rows.length,
      heads:[...t.querySelectorAll('.od-editor-head th,.od-editor-head td')].map(e=>e.textContent.trim()).filter(Boolean),
      controls:[...t.querySelectorAll('tbody input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), tbody select, tbody textarea')].filter(e=>e.getBoundingClientRect().height>0).length,
      buttons:[...t.querySelectorAll('input[type="button"],input[type="submit"],button')].map(e=>String(e.className)+':'+(e.value||e.textContent||'').trim()).slice(0,8),
      labels:[...t.querySelectorAll('.od-cell-label')].map(e=>e.textContent.trim())
     })),
     formTables:[...document.querySelectorAll('table.FormTable')].filter(t=>!t.querySelector('table')).map((t,i)=>{
      const rb=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
      const vis=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
      const rows=[];
      for(const row of t.rows){
       if(!vis(row))continue;
       const ths=[...row.cells].filter(c=>c.tagName==='TH'&&vis(c));
       const tds=[...row.cells].filter(c=>c.tagName==='TD'&&vis(c));
       if(ths.length!==1||!tds.length)continue;
       const ctrl=[...row.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')].find(vis);
       if(!ctrl)continue;
       rows.push({label:ths[0].textContent.replace(/\s+/g,' ').trim().slice(0,48),th:rb(ths[0]),td:rb(tds[0]),ctrl:rb(ctrl),type:ctrl.type||ctrl.tagName,cellCount:row.cells.length});
      }
      return {i,id:t.id,cls:String(t.className),fields:t.classList.contains('od-fields'),rect:rb(t),rows};
     }).filter(t=>t.rows.length>0),
     menuIcons:[...document.querySelectorAll('#mainMenu [id^=index_img],#mainMenu [id^=menu_img],#subMenu [id^=menu_img]')].filter(e=>getComputedStyle(e).maskImage!=='none').length};
   });
   /* R6R-04: approved R6 sidebar grouping and active route. Only the active
      indicator moves; each native destination keeps its own handler. */
   const NAV_ACTIVE={
    '/Advanced_ADSL_Content.asp':'Internet & DSL','/Advanced_DSL_Content.asp':'Internet & DSL',
    '/Advanced_WANPort_Content.asp':'Internet & DSL','/Advanced_IPTV_Content.asp':'IPTV',
    '/Advanced_DHCP_Content.asp':'Local network','/Advanced_BasicFirewall_Content.asp':'Firewall',
    '/Advanced_System_Content.asp':'Administration','/Advanced_SettingBackup_Content.asp':'Administration',
    '/Advanced_Feedback.asp':'Administration','/Advanced_Wireless_Content.asp':'Wireless',
    '/Main_LogStatus_Content.asp':'Logs & diagnostics'
   };
   if(NAV_ACTIVE[url]){
    const current=await page.evaluate(()=>{const e=document.querySelector('#mainMenu .od-current');return e?e.textContent.replace(/\s+/g,' ').trim():null;});
    assert.equal(current,NAV_ACTIVE[url],'R6 sidebar active route at '+width+': '+JSON.stringify({url,current}));
   }
   /* R6 page-group eyebrow. It is the page's section, not necessarily the
      active sidebar item: IPTV is drawn under LOCAL NETWORK and the system log
      under DIAGNOSTICS, exactly as the approved previews do. */
   const EYEBROW={
    '/Advanced_ADSL_Content.asp':'Internet & DSL','/Advanced_DSL_Content.asp':'Internet & DSL',
    '/Advanced_WANPort_Content.asp':'Internet & DSL','/Advanced_IPTV_Content.asp':'Local network',
    '/Advanced_DHCP_Content.asp':'Local network','/Advanced_BasicFirewall_Content.asp':'Firewall',
    '/Advanced_System_Content.asp':'Administration','/Advanced_SettingBackup_Content.asp':'Administration',
    '/Advanced_Feedback.asp':'Administration','/Advanced_Wireless_Content.asp':'Wireless',
    '/Main_LogStatus_Content.asp':'Diagnostics'
   };
   if(EYEBROW[url]&&width>850){
    const eyebrow=await page.evaluate(()=>{const e=document.querySelector('.od-page-head .od-eyebrow');return e?e.textContent.replace(/\s+/g,' ').trim():null;});
    assert.equal(eyebrow,EYEBROW[url],'R6 page group at '+width+': '+JSON.stringify({url,eyebrow}));
   }
   if(url==='/Advanced_Feedback.asp'){
    const tabs=await page.evaluate(()=>[...document.querySelectorAll('#tabMenu .tabclick, #tabMenu .tab')].map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
    assert(tabs.length>=6&&tabs.includes('Feedback'),'native administration tabs missing on Feedback at '+width+': '+JSON.stringify(tabs));
    geometryEvidence.feedbackTabs=geometryEvidence.feedbackTabs||[];geometryEvidence.feedbackTabs.push({width,tabs});
   }
   if(url==='/device-map/clients.asp'&&width<=600){
    const tabs=await clientTabProbe(page);
    assertClientTabs(tabs,width);
    geometryEvidence.clientTabs=geometryEvidence.clientTabs||[];geometryEvidence.clientTabs.push({width,tabs});
   }
   if(url==='/Advanced_SettingBackup_Content.asp'){
    const readName=()=>page.evaluate(()=>{const l=document.querySelector('.od-admin-filename'),f=document.getElementById('tools_FW_UploadFile');const r=l?l.getBoundingClientRect():null;return {line:l?l.textContent.trim():null,file:[f&&f.id,f&&f.name,f&&f.type],width:r?+r.width.toFixed(2):null,
     scroll:l?l.scrollWidth:null,client:l?l.clientWidth:null,overflow:l?+(l.scrollWidth-l.clientWidth).toFixed(2):null};});
    const empty=await readName();
    assert.equal(empty.line,'No file selected','Backup empty filename line at '+width+': '+JSON.stringify(empty));
    assert(empty.width>=150,'Backup empty filename line too narrow at '+width+': '+JSON.stringify(empty));
    const longName='OpenDSL_DSL-N12E-C1_settings_2026-10-25.cfg';
    await page.setInputFiles('#tools_FW_UploadFile',{name:longName,mimeType:'application/octet-stream',buffer:Buffer.from('host-fixture')});
    await page.waitForTimeout(80);
    const picked=await readName();
    assert.equal(picked.line,longName,'Backup picker does not report the full selected name at '+width+': '+JSON.stringify(picked));
    assert(picked.overflow<=1,'Backup filename line truncates at '+width+': '+JSON.stringify(picked));
    assert.deepEqual(picked.file,['tools_FW_UploadFile','tools_FW_UploadFile','file'],'Backup picker control changed at '+width+': '+JSON.stringify(picked.file));
    geometryEvidence.backupName=geometryEvidence.backupName||[];geometryEvidence.backupName.push({width,empty,picked});
   }
   /* Shared 0.1.23 batch (U23-01..U23-06). These host-only measurements keep
      the native nodes and handlers in place while checking the approved
      composition: collapsed help, one inset row separator, spaced radios,
      full-width unit fields, a themed file picker and the phone head. */
   if(url==='/Advanced_DHCP_Content.asp'){
    const dhcp=await page.evaluate(()=>{
     const vis=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
     const rb=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1)};};
     const tables=[...document.querySelectorAll('table.FormTable')].filter(t=>!t.querySelector('table'));
     const rows=tables.flatMap(t=>[...t.tBodies].flatMap(b=>[...b.rows]).filter(vis));
     const lastRows=tables.map(t=>[...t.tBodies].flatMap(x=>[...x.rows]).filter(vis).pop()).filter(Boolean);
     const cells=[...document.querySelectorAll('table.FormTable th, table.FormTable td')].filter(vis);
     const radios=[...document.querySelectorAll('.FormTable input[type=radio]')].filter(vis);
     let radioGap=null;
     if(radios.length>1){
      let start=radios[0].getBoundingClientRect().right;
      const range=document.createRange();
      for(let n=radios[0].nextSibling;n&&n!==radios[1];n=n.nextSibling){
       if(n.nodeType===3&&n.textContent.trim()){range.selectNodeContents(n);const rs=[...range.getClientRects()];if(rs.length)start=Math.max(start,rs[rs.length-1].right);}
      }
      radioGap=+(radios[1].getBoundingClientRect().left-start).toFixed(1);
     }
     const unit=document.querySelector('.od-unit-field');
     const input=unit&&unit.querySelector('input,select');
     const suffix=unit&&unit.querySelector('.od-unit-text');
     const cell=input&&input.closest('td');
     const help=document.querySelector('.od-help');
     const head=document.querySelector('.od-page-head');
     const context=document.querySelector('.od-context');
     const banner=document.querySelector('.banner1 > span:first-child');
     const infoButton=document.querySelector('.od-topbar-actions .od-info-button');
     const drawer=document.getElementById('od-device-drawer');
     const section=document.querySelector('.od-section-title');
     const tabs=document.getElementById('tabMenu');
     return {view:innerWidth,scrollW:document.documentElement.scrollWidth,
      contentStart:{section:section?+section.getBoundingClientRect().top.toFixed(1):null,table:tables[0]?+tables[0].getBoundingClientRect().top.toFixed(1):null,tabsBottom:tabs?+tabs.getBoundingClientRect().bottom.toFixed(1):null},
      help:help?{open:help.open,summary:help.querySelector('summary').textContent.trim()}:null,
      rows:rows.length,lastRows:lastRows.length,
      gradients:rows.map(r=>getComputedStyle(r).backgroundImage),
      sizes:rows.map(r=>getComputedStyle(r).backgroundSize),
      borders:cells.filter(c=>getComputedStyle(c).borderBottomWidth!=='0px').length,
      pseudos:cells.filter(c=>getComputedStyle(c,'::after').content!=='none').length,
      radioGap,
      unit:unit?{input:rb(input),suffix:suffix?rb(suffix):null,cell:cell?rb(cell):null}:null,
      context:context?getComputedStyle(context).display:null,
      headBorder:head?getComputedStyle(head).borderBottomWidth:null,
      bannerBorder:banner?getComputedStyle(banner).borderBottomWidth:null,
      metaInDrawer:!!(infoButton&&drawer&&drawer.querySelector('.statusBar')),
      metaParent:drawer?String(drawer.className):null,
      info:{button:!!infoButton&&infoButton.getBoundingClientRect().width>0,hidden:drawer?drawer.hidden:null,bar:!!(drawer&&drawer.querySelector('.statusBar'))}};
    });
    assert(dhcp.scrollW<=width,'DHCP overflow at '+width);
    assert(dhcp.help&&dhcp.help.open===false&&dhcp.help.summary==='Help with these settings','DHCP help not collapsed at '+width+': '+JSON.stringify(dhcp.help));
    assert(dhcp.rows>=6&&dhcp.lastRows>=2,'DHCP settings rows missing at '+width+': '+JSON.stringify(dhcp));
    const inset=width<850?'calc(100% - 32px) 1px':'calc(100% - 44px) 1px';
    const ordinary=dhcp.gradients.filter(g=>g!=='none');
    assert.equal(dhcp.gradients.filter(g=>g==='none').length,dhcp.lastRows,'DHCP separator count at '+width+': '+JSON.stringify(dhcp.gradients));
    assert(ordinary.length>0&&ordinary.every(g=>g==='linear-gradient(rgb(44, 60, 80), rgb(44, 60, 80))'),'DHCP separator paint at '+width+': '+JSON.stringify(dhcp.gradients));
    assert(dhcp.sizes.every(s=>s==='auto'||s===inset),'DHCP separator inset at '+width+': '+JSON.stringify(dhcp.sizes));
    assert.equal(dhcp.borders,0,'DHCP cell borders remain at '+width+': '+dhcp.borders);
    assert.equal(dhcp.pseudos,0,'DHCP cell pseudo separators remain at '+width+': '+dhcp.pseudos);
    assert(dhcp.radioGap!==null&&dhcp.radioGap>=10,'DHCP radio gap at '+width+': '+dhcp.radioGap);
    assert(dhcp.unit&&dhcp.unit.cell&&(dhcp.unit.input.x-dhcp.unit.cell.x)<=23&&(dhcp.unit.cell.r-dhcp.unit.input.r)<=23,'DHCP unit field not full width at '+width+': '+JSON.stringify(dhcp.unit));
    assert(dhcp.unit.suffix&&dhcp.unit.suffix.r<=dhcp.unit.input.r-8,'DHCP unit suffix outside field at '+width+': '+JSON.stringify(dhcp.unit));
    assert(dhcp.contentStart.table<dhcp.contentStart.tabsBottom+(width<850?240:200),'DHCP content start still below the drawing at '+width+': '+JSON.stringify(dhcp.contentStart));
    await page.locator('.od-help > summary').click();
    assert(await page.locator('.od-help').evaluate(e=>e.open),'DHCP help pointer open failed at '+width);
    assert((await page.locator('.od-help').boundingBox()).height>40,'DHCP help expanded without content at '+width);
    await page.screenshot({path:path.join(out,'shared-dhcp-help-open-'+width+'.png')});
    await page.locator('.od-help > summary').click();
    assert(!await page.locator('.od-help').evaluate(e=>e.open),'DHCP help pointer close failed at '+width);
    await page.locator('.od-help > summary').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('.od-help').evaluate(e=>e.open),'DHCP help keyboard open failed at '+width);
    await page.keyboard.press('Enter');
    assert(!await page.locator('.od-help').evaluate(e=>e.open),'DHCP help keyboard close failed at '+width);
    assert.equal(dhcp.metaInDrawer,true,'DHCP device info not in drawer at '+width+': '+dhcp.metaParent);
    assert(dhcp.info&&dhcp.info.button,'DHCP Device info control missing at '+width+': '+JSON.stringify(dhcp.info));
    assert.equal(dhcp.info.hidden,true,'DHCP Device info drawer open by default at '+width);
    assert.equal(dhcp.info.bar,true,'DHCP Device info drawer missing native status bar at '+width);
    if(width<850){
     assert(dhcp.context===null||dhcp.context==='none','DHCP phone context remains at '+width);
     assert.equal(dhcp.headBorder,'0px','DHCP phone head divider remains at '+width);
     assert.equal(dhcp.bannerBorder,'1px','DHCP phone top-bar divider missing at '+width);
     await page.locator('.od-menu-toggle').click();
     await page.waitForTimeout(350);
     assert(await page.locator('#mainMenu').isVisible(),'DHCP phone drawer did not open at '+width);
     await page.screenshot({path:path.join(out,'shared-dhcp-drawer-'+width+'.png')});
     await page.locator('.od-nav-close').click();
     await page.waitForTimeout(300);
    }
    await page.locator('.od-topbar-actions .od-info-button').click();
    assert(await page.locator('#od-device-drawer').isVisible(),'Device info drawer did not open at '+width);
    assert(await page.locator('#od-device-drawer .od-device-readouts').isVisible(),'Device info drawer contents hidden at '+width);
    await page.screenshot({path:path.join(out,'shared-device-info-drawer-'+width+'.png')});
    await page.locator('#od-device-drawer .od-drawer-close').click();
    assert(!await page.locator('#od-device-drawer').isVisible(),'Device info drawer did not close at '+width);
    sharedEvidence.push({page:'dhcp',width,help:dhcp.help,contentStart:dhcp.contentStart,rows:dhcp.rows,radioGap:dhcp.radioGap,unit:dhcp.unit,metaInDrawer:dhcp.metaInDrawer});
   }
   if(url==='/Advanced_FirmwareUpgrade_Content.asp'){
    const fw=await page.evaluate(()=>{
     const help=document.querySelector('.od-help');
     const file=document.querySelector('input[type=file]');
     const cell=file&&file.closest('.od-admin-file');
     const section=document.querySelector('[data-od-admin="firmware-installed"] .od-admin-panel-head');
     const tabs=document.getElementById('tabMenu');
     const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1),y:+r.y.toFixed(1),b:+r.bottom.toFixed(1)};};
     const btn=file?getComputedStyle(file,'::file-selector-button'):null;
     const named=cell&&cell.querySelector('.od-admin-filename');
     const vis=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
     const tables=[...document.querySelectorAll('table.FormTable')].filter(t=>!t.querySelector('table'));
     const rows=tables.flatMap(t=>[...t.tBodies].flatMap(x=>[...x.rows]).filter(vis));
     const lastRows=tables.map(t=>[...t.tBodies].flatMap(x=>[...x.rows]).filter(vis).pop()).filter(Boolean);
     const cells=[...document.querySelectorAll('table.FormTable th, table.FormTable td')].filter(vis);
     return {enhanced:document.body.classList.contains('od-ready'),
      panels:[...document.querySelectorAll('.od-admin-panels > [data-od-admin]')].map(e=>e.getAttribute('data-od-admin')),
      shell:!!document.querySelector('.od-topbar')&&!!document.querySelector('.od-footer-bar'),
      nativeForm:!!file&&file.form===document.forms.uiPostUpdateForm&&document.querySelector('[name="FW_apply"]').form===file.form,
      retiredHidden:['update_div','linkpage_div','sig_ver_field'].every(id=>{const e=document.getElementById(id);return !e||!vis(e)}),
      help:help?{open:help.open,summary:help.querySelector('summary').textContent.trim()}:null,
      rows:rows.length,lastRows:lastRows.length,gradients:rows.map(r=>getComputedStyle(r).backgroundImage),sizes:rows.map(r=>getComputedStyle(r).backgroundSize),
      release:[...document.querySelectorAll('.od-admin-release')].map(r=>r.textContent.replace(/\s+/g,' ').trim()),
      borders:cells.filter(c=>getComputedStyle(c).borderBottomWidth!=='0px').length,
      file:file?{box:b(file),cell:cell?b(cell):null,status:named?b(named):null,statusText:named?named.textContent.replace(/\s+/g,' ').trim():null,button:btn?{bg:btn.backgroundImage,color:btn.backgroundColor,border:btn.borderTopWidth,radius:btn.borderTopLeftRadius,height:btn.height}:null}:null,
      section:section?b(section):null,tabs:tabs?b(tabs):null,scrollW:document.documentElement.scrollWidth};
    });
    assert(fw.help&&fw.help.open===false,'Firmware help not collapsed at '+width+': '+JSON.stringify(fw.help));
    assert(fw.enhanced&&fw.shell&&fw.nativeForm&&fw.retiredHidden,'Firmware shell/form/retirement regression at '+width+': '+JSON.stringify(fw));
    assert.deepEqual(fw.panels,['firmware-installed','firmware-local'],'Firmware panel composition at '+width);
    assert.equal(fw.rows,4,'Firmware must retain OpenDSL release, product, DSL version and firmware version rows at '+width+': '+JSON.stringify(fw));
    assert.equal(fw.release.length,1,'Firmware OpenDSL release row missing at '+width+': '+JSON.stringify(fw.release));
    const expectedRelease=process.env.OPENDSL_RELEASE||/^CURRENT_VERSION\s*\?=\s*(\S+)/m.exec(fs.readFileSync(path.join(ROOT,'Makefile'),'utf8'))[1];
    assert.equal(fw.release[0].replace(/^OpenDSL release\s*/,''),expectedRelease,'Firmware OpenDSL release identity changed at '+width+': '+JSON.stringify(fw.release));
    assert.equal(fw.gradients.filter(g=>g==='none').length,fw.lastRows,'Firmware separator count at '+width+': '+JSON.stringify(fw.gradients));
    assert(fw.gradients.filter(g=>g!=='none').every(g=>g==='linear-gradient(rgb(44, 60, 80), rgb(44, 60, 80))'),'Firmware separator paint at '+width+': '+JSON.stringify(fw.gradients));
    assert(fw.sizes.every(s=>s==='auto'||s===(width<850?'calc(100% - 32px) 1px':'calc(100% - 44px) 1px')),'Firmware separator inset at '+width+': '+JSON.stringify(fw.sizes));
    assert.equal(fw.borders,0,'Firmware cell borders remain at '+width+': '+fw.borders);
    assert(fw.section&&fw.tabs&&fw.section.y-fw.tabs.b<300,'Firmware content start still below the drawing at '+width+': '+JSON.stringify(fw));
    /* The picker rule paints its button with the card-top control fill
       (rgb(28, 40, 55)) so it separates from the dark input behind it; this
       assertion previously captured the generic --od-control fill. The exact
       fill, border, radius and absent gradient still reject a native button. */
    assert(fw.file&&fw.file.button&&fw.file.button.radius==='8px'&&fw.file.button.border==='1px'&&fw.file.button.bg==='none'&&fw.file.button.color==='rgb(28, 40, 55)','Firmware file button not themed at '+width+': '+JSON.stringify(fw.file));
    /* The single-status picker intentionally sizes the native input to its
       button and gives the remaining row to .od-admin-filename; the previous
       assertion demanded a full-width native input, i.e. the duplicate-copy
       layout this fix removed. Require the status to fill and stay inside the
       cell, beside the picker on desktop and below it on phones. */
    assert(fw.file.status&&fw.file.statusText&&fw.file.status.x>=fw.file.cell.x&&fw.file.status.r<=fw.file.cell.r&&fw.file.status.r>=fw.file.cell.r-24,'Firmware filename status does not fill the upload row at '+width+': '+JSON.stringify(fw.file));
    if(width>=851)assert(fw.file.status.x>fw.file.box.r,'Firmware filename status is not beside the picker at '+width+': '+JSON.stringify(fw.file));
    else assert(fw.file.status.y>=fw.file.box.b-0.5&&Math.abs(fw.file.status.x-fw.file.box.x)<=1,'Firmware filename status is not on its own aligned line at '+width+': '+JSON.stringify(fw.file));
    await page.locator('input[type=file]').focus();
    const focused=await page.locator('input[type=file]').evaluate(f=>getComputedStyle(f,'::file-selector-button').borderTopColor);
    assert.equal(focused,'rgb(98, 187, 255)','Firmware file focus colour at '+width+': '+focused);
    await page.locator('input[type=file]').blur();
    assert(fw.scrollW<=width,'Firmware overflow at '+width);
    sharedEvidence.push({page:'firmware',width,...fw});
   }
   if(url==='/QoS_EZQoS.asp'){
    const qos=await page.evaluate(()=>{
     const help=document.querySelector('.od-help');
     const table=document.querySelector('table.FormTable');
     const tabs=document.getElementById('tabMenu');
     const b=e=>{const r=e.getBoundingClientRect();return {y:+r.y.toFixed(1),b:+r.bottom.toFixed(1),h:+r.height.toFixed(1)};};
     return {help:help?{open:help.open,box:b(help),summary:help.querySelector('summary').textContent.trim()}:null,table:table?b(table):null,tabs:tabs?b(tabs):null,scrollW:document.documentElement.scrollWidth};
    });
    assert(qos.help&&qos.help.open===false,'QoS help not collapsed at '+width+': '+JSON.stringify(qos.help));
    assert(qos.help.box.h<=48,'QoS help still expanded at '+width+': '+JSON.stringify(qos.help));
    assert(qos.table&&qos.tabs&&qos.table.y-qos.tabs.b<260,'QoS content start still below the drawing at '+width+': '+JSON.stringify(qos));
    assert(qos.scrollW<=width,'QoS overflow at '+width);
    sharedEvidence.push({page:'qos',width,...qos});
   }
   if(url==='/Advanced_DSL_Content.asp'){
    const dsl=await page.evaluate(()=>{
     const vis=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
     const tables=[...document.querySelectorAll('table.FormTable')].filter(t=>!t.querySelector('table'));
     const rows=tables.flatMap(t=>[...t.tBodies].flatMap(x=>[...x.rows]).filter(vis));
     const lastRows=tables.map(t=>[...t.tBodies].flatMap(x=>[...x.rows]).filter(vis).pop()).filter(Boolean);
     const cells=[...document.querySelectorAll('table.FormTable th, table.FormTable td')].filter(vis);
     return {rows:rows.length,lastRows:lastRows.length,gradients:rows.map(r=>getComputedStyle(r).backgroundImage),sizes:rows.map(r=>getComputedStyle(r).backgroundSize),
      borders:cells.filter(c=>getComputedStyle(c).borderBottomWidth!=='0px').length,
      pseudos:cells.filter(c=>getComputedStyle(c,'::after').content!=='none').length,scrollW:document.documentElement.scrollWidth};
    });
    assert(dsl.rows>=8&&dsl.lastRows>=3,'DSL separator rows missing at '+width+': '+JSON.stringify(dsl));
    assert.equal(dsl.gradients.filter(g=>g==='none').length,dsl.lastRows,'DSL separator count at '+width+': '+JSON.stringify(dsl.gradients));
    assert(dsl.gradients.filter(g=>g!=='none').every(g=>g==='linear-gradient(rgb(44, 60, 80), rgb(44, 60, 80))'),'DSL separator paint at '+width+': '+JSON.stringify(dsl.gradients));
    assert(dsl.sizes.every(s=>s==='auto'||s===(width<850?'calc(100% - 32px) 1px':'calc(100% - 44px) 1px')),'DSL separator inset at '+width+': '+JSON.stringify(dsl.sizes));
    assert.equal(dsl.borders,0,'DSL cell borders remain at '+width+': '+dsl.borders);
    assert.equal(dsl.pseudos,0,'DSL cell pseudo separators remain at '+width+': '+dsl.pseudos);
    assert(dsl.scrollW<=width,'DSL overflow at '+width);
    sharedEvidence.push({page:'dsl',width,...dsl});
   }
       if(url==='/Main_TrafficMonitor_realtime.asp'){
     /* U23-09: the live traffic monitor keeps its native graph, counters and
        actions, but the body is presented with the theme's cards: a toolbar
        card for the mode selector, a legend card for reception/transmission
        with a readable empty state, and a readings card. */
     const tm=await page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};};
      const visible=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
      const toolbar=document.querySelector('.od-tm-toolbar');
      const graphCard=document.querySelector('.od-tm-graph');
      const readings=document.querySelector('.od-tm-readings');
      const legend=document.querySelector('.od-tm-legend');
      const note=document.querySelector('.od-tm-empty-graph');
      const empty=document.querySelector('.od-tm-empty-row');
      const graph=document.getElementById('graph');
      const select=document.querySelector('.od-tm-toolbar select');
      const values=[...document.querySelectorAll('.od-tm-legend-value')].filter(visible);
      const legacy=[...document.querySelectorAll('.od-tm-legend td, .od-tm-legend th')].filter(visible)
        .map(e=>getComputedStyle(e).color).filter(c=>c!=='rgb(237, 242, 248)'&&c!=='rgb(165, 184, 209)'&&c!=='rgb(98, 187, 255)'&&c!=='rgb(120, 185, 255)');
      const card=e=>e?{box:box(e),radius:getComputedStyle(e).borderRadius,shadow:getComputedStyle(e).boxShadow}:null;
      return {
       bodyClass:document.body.className,toolbar:card(toolbar),graphCard:card(graphCard),readings:card(readings),
       legendLabels:[...document.querySelectorAll('.od-tm-legend-label')].filter(visible).map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),x:+e.getBoundingClientRect().x.toFixed(1),colour:getComputedStyle(e).color})),
       note:note?{text:note.textContent.trim(),visible:visible(note)}:null,
       empty:empty?{text:empty.textContent.trim(),visible:visible(empty)}:null,
       graph:graph?{present:true,visible:visible(graph),id:graph.id,src:graph.getAttribute('data')||graph.getAttribute('src')}:null,
       select:select?{present:true,value:select.value,options:select.options.length,onchange:!!select.getAttribute('onchange')}:null,
       values:values.length,legacyColours:legacy,
       overflow:document.documentElement.scrollWidth-innerWidth
      };
     });
     if(process.env.OPENDSL_QA_DEBUG)console.log('TRAFFIC',width,JSON.stringify(tm));
     assert(/od-traffic/.test(tm.bodyClass),'traffic monitor not themed: '+JSON.stringify(tm.bodyClass));
     assert(tm.toolbar&&tm.graphCard&&tm.readings,'traffic monitor cards missing: '+JSON.stringify(tm));
     assert.equal(tm.toolbar.radius,'15px','traffic toolbar radius: '+JSON.stringify(tm.toolbar));
     assert.equal(tm.graphCard.radius,'15px','traffic graph card radius: '+JSON.stringify(tm.graphCard));
     assert.equal(tm.readings.radius,'15px','traffic readings radius: '+JSON.stringify(tm.readings));
     assert.equal(tm.legacyColours.length,0,'traffic monitor legacy colours: '+JSON.stringify(tm.legacyColours));
     assert(tm.note&&tm.note.visible&&tm.note.text==='No readings available','traffic empty state missing: '+JSON.stringify(tm.note));
     assert(tm.empty&&tm.empty.visible&&tm.empty.text==='No entries','traffic readings empty state missing: '+JSON.stringify(tm.empty));
     assert(tm.graph&&tm.graph.present&&!tm.graph.visible,'traffic graph hidden state: '+JSON.stringify(tm.graph));
     assert(tm.select&&tm.select.present&&tm.select.options>=1,'traffic mode selector missing: '+JSON.stringify(tm.select));
     assert(tm.overflow<=0,'traffic monitor overflow: '+JSON.stringify(tm.overflow));
     if(width<850)assert(tm.toolbar.box.w>=width-56,'traffic toolbar not full width: '+JSON.stringify(tm.toolbar));
    }
if(url==='/Advanced_QOSUserPrio_Content.asp'){
    const prio=await page.evaluate(()=>{
     const groups=[...document.querySelectorAll('.od-qos-group')];
     const rows=groups.map(g=>g.closest('tr')).filter(Boolean);
     const cells=[...document.querySelectorAll('table.FormTable th, table.FormTable td')].filter(c=>c.closest('tr')&&rows.includes(c.closest('tr')));
     return {groups:groups.length,rows:rows.length,gradients:rows.map(r=>getComputedStyle(r).backgroundImage),
      borders:cells.filter(c=>getComputedStyle(c).borderBottomWidth!=='0px').length,optOut:document.body.classList.contains('od-qos-prio')};
    });
    assert(prio.groups>=2&&prio.optOut,'QoS priority groups missing at '+width+': '+JSON.stringify(prio));
    assert(prio.gradients.every(g=>g==='none'),'QoS priority matrix opt-out missing at '+width+': '+JSON.stringify(prio));
    assert.equal(prio.borders,0,'QoS priority cell borders remain at '+width+': '+prio.borders);
    sharedEvidence.push({page:'qos-prio',width,...prio});
   }
   if(url==='/Advanced_Feedback.asp'){
    const fb=await page.evaluate(()=>{
     const shown=id=>{const e=document.getElementById(id);return e?getComputedStyle(e).display:null;};
     const ta=document.querySelector('textarea[name="fb_comment"]');
     const counter=document.getElementById('msglength');
     const send=document.querySelector('input[name="btn_send"]');
     const t=ta.getBoundingClientRect(),c=counter.getBoundingClientRect(),s=send.getBoundingClientRect();
     const counterBox=counter.parentElement.getBoundingClientRect();
     const bar=send.closest('.od-admin-actions');
     const b=bar?bar.getBoundingClientRect():null;
     const consentPanel=send.closest('.od-admin-panels').querySelector('[data-od-admin="feedback-consent"]');
     return {diag:shown('dslx_diag_enable_tr'),duration:shown('dslx_diag_duration_tr'),modem:shown('attach_modem_span'),
      value:counter.value,readOnly:counter.readOnly,counterW:+c.width.toFixed(1),counterR:+c.right.toFixed(1),
      counterL:+counterBox.left.toFixed(1),taL:+t.left.toFixed(1),
      sendType:send.type,sendW:+s.width.toFixed(1),sendR:+s.right.toFixed(1),taR:+t.right.toFixed(1),taW:+t.width.toFixed(1),
      sendInBar:!!bar,sendBarR:b?+b.right.toFixed(1):null,
      barPadR:bar?parseFloat(getComputedStyle(bar).paddingRight):0,
      barAfterConsent:!!(bar&&consentPanel&&consentPanel.nextElementSibling===bar),
      barBeforeSupport:!!(bar&&bar.nextElementSibling&&bar.nextElementSibling.getAttribute('data-od-admin')==='feedback-support'),
      panels:[...document.querySelectorAll('.od-admin-panels > .od-admin-panel')].map(e=>e.getAttribute('data-od-admin')),
      consent:!!document.querySelector('input[name="eula_checkbox"]'),
      consentLabel:(()=>{const l=document.querySelector('.od-admin-consent-label'),c=document.querySelector('input[name="eula_checkbox"]');
       return l?{text:l.textContent.trim(),for:l.htmlFor,owns:!!(c&&l.control===c)}:null;})(),
      cards:document.querySelectorAll('#FormTitle .od-card-title').length,
      attach:[...document.querySelectorAll('input[name^="attach_"]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.name),
      help:!!document.querySelector('.od-help')};
    });
    assert.equal(fb.diag,'none','unsupported diagnostic row visible: '+JSON.stringify(fb));
    assert.equal(fb.duration,'none','unsupported diagnostic duration visible: '+JSON.stringify(fb));
    assert.equal(fb.modem,'none','3G/4G attachment visible without a modem: '+JSON.stringify(fb));
    assert.equal(fb.value,'2000','native feedback counter value changed: '+JSON.stringify(fb));
    assert(fb.readOnly&&fb.counterW>60,'native counter control changed: '+JSON.stringify(fb));
    assert.equal(fb.sendType,'button','native Send type changed: '+JSON.stringify(fb));
    assert(fb.consent,'native feedback consent lost');
    assert(fb.consentLabel&&fb.consentLabel.owns&&/I have read and agree/.test(fb.consentLabel.text),
     'feedback consent caption missing or detached: '+JSON.stringify(fb.consentLabel));
    assert.equal(fb.cards,0,'generated feedback card titles survived composition: '+JSON.stringify(fb.cards));
    assert.deepEqual(fb.attach,['attach_syslog','attach_cfgfile','attach_iptables'],'native attachment flags changed: '+JSON.stringify(fb.attach));
    assert(fb.sendInBar&&Math.abs(fb.sendR-(fb.sendBarR-fb.barPadR))<=2,'feedback Send not aligned in its action bar: '+JSON.stringify(fb));
    assert(fb.barAfterConsent&&fb.barBeforeSupport,'feedback Send bar not between consent and support: '+JSON.stringify(fb));
    assert.deepEqual(fb.panels,['feedback-service','feedback-report','feedback-attachments','feedback-consent','feedback-support'],'feedback panel composition changed: '+JSON.stringify(fb.panels));
    assert(Math.abs(fb.counterL-fb.taL)<=2,'feedback counter not aligned to the textarea edge: '+JSON.stringify(fb));
    assertFeedbackCaption(await feedbackCaptionProbe(page),width);
    geometryEvidence.feedback=fb;
   }
   if(url==='/Advanced_System_Content.asp'){
    const sys=await page.evaluate(()=>{
     const panels=[...document.querySelectorAll('.od-admin-panels > .od-admin-panel')].map(p=>({
      key:p.getAttribute('data-od-admin'),
      title:(p.querySelector('.od-admin-panel-title')||{}).textContent||'',
      rows:p.querySelectorAll('.od-admin-table > tbody > tr').length}));
     const apply=document.querySelector('input[name="button"].button_gen');
     const rules=document.getElementById('http_client_table');
     const list=document.getElementById('http_clientlist_Block');
     const thead=rules&&rules.tHead?rules.tHead.rows[0]:null;
     const form=document.forms.form;
     const stray=[...document.querySelectorAll('#FormTitle *')].filter(e=>e.children.length===0&&/Specified IP address/.test(e.textContent)).map(e=>{
      const r=e.getBoundingClientRect();
      return {tag:e.tagName,cls:String(e.className),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),
       table:e.closest('table')?String(e.closest('table').className):null,panel:e.closest('.od-admin-panel')?e.closest('.od-admin-panel').getAttribute('data-od-admin'):null};});
     return {panels,
      applyInBar:!!(apply&&apply.parentElement&&apply.parentElement.classList.contains('od-admin-actions')),
      applyForm:apply&&apply.form?apply.form.getAttribute('name'):null,
      hiddenFields:form?form.querySelectorAll('input[type="hidden"]').length:0,
      rulesInInset:!!(rules&&rules.closest('.od-admin-inset')),
      listInInset:!!(list&&list.closest('.od-admin-inset')),
      theadMoved:!!(thead&&thead.classList.contains('od-moved')),
      sourceHidden:!!document.querySelector('.od-admin-source'),
      sources:[...document.querySelectorAll('#FormTitle table.FormTable, #FormTitle table.FormTable_table')].filter(t=>!t.closest('.od-admin-panel')).map(t=>({cls:String(t.className),id:t.id,rows:t.tBodies.length?[...t.tBodies].reduce((n,b)=>n+b.rows.length,0):0,hidden:getComputedStyle(t).display==='none',text:(t.textContent||'').replace(/\s+/g,' ').trim().slice(0,60)})),
      titles:[...document.querySelectorAll('#FormTitle .od-card-title')].map(t=>({text:(t.textContent||'').trim().slice(0,40),hidden:getComputedStyle(t).display==='none'||!t.getClientRects().length})),
      stray};
    });
    assert.deepEqual(sys.panels.map(p=>p.key),
     ['system-account','system-behavior','system-schedule','system-time','system-services','system-local','system-remote','system-allowed'],
     'system panel composition changed: '+JSON.stringify(sys.panels));
    assert.deepEqual(sys.panels.map(p=>p.title),
     ['Administrator account','Buttons & system behavior','Scheduled maintenance','Time & logging','Management services','Local management','Remote management','Allowed management clients'],
     'system panel titles changed: '+JSON.stringify(sys.panels));
    assert(sys.panels.filter(p=>p.key!=='system-allowed').every(p=>p.rows>0),'empty system panel rendered: '+JSON.stringify(sys.panels));
    assert(sys.applyInBar&&sys.applyForm==='form','native System apply moved or detached: '+JSON.stringify(sys));
    assert(sys.hiddenFields>=20,'native System hidden request state lost: '+JSON.stringify(sys));
    assert(sys.rulesInInset&&sys.listInInset&&sys.theadMoved,'native management rules not composed: '+JSON.stringify(sys));
    assert(sys.sourceHidden,'native System source rows still visible: '+JSON.stringify(sys));
    assert.deepEqual(sys.titles,[],'generated System card titles survived composition: '+JSON.stringify(sys.titles));
    const sysFollow=await page.evaluate(async()=>{
     const rules=document.getElementById('http_client_table');
     const panel=document.querySelector('[data-od-admin="system-allowed"]');
     const before=panel.hidden;
     rules.style.display='none';
     await new Promise(r=>setTimeout(r,0));
     const hidden=panel.hidden;
     rules.style.display='';
     await new Promise(r=>setTimeout(r,0));
     return {before,hidden,restored:!panel.hidden};
    });
    assert(!sysFollow.before&&sysFollow.hidden&&sysFollow.restored,
     'Allowed management clients panel does not follow native visibility: '+JSON.stringify(sysFollow));
    sharedEvidence.push({page:'admin-system',width,...sys});
   }
   if(url==='/Advanced_SettingBackup_Content.asp'){
    const bak=await page.evaluate(()=>{
     const panels=[...document.querySelectorAll('.od-admin-panels > .od-admin-panel')].map(p=>({
      key:p.getAttribute('data-od-admin'),
      title:(p.querySelector('.od-admin-panel-title')||{}).textContent||'',
      danger:p.classList.contains('od-admin-danger')}));
     const uploadForm=document.forms.uiPostUpdateForm;
     const restoreForm=document.forms.tools_System_Restore;
     const save=document.querySelector('input[name="action2"]');
     const file=document.getElementById('tools_FW_UploadFile');
     const upload=document.querySelector('[data-od-admin="backup-restore"] .od-admin-actions input[type="button"]');
     const restore=restoreForm?restoreForm.querySelector('input[name="RestartBtn"]'):null;
     const fr=file?file.getBoundingClientRect():null,ur=upload?upload.getBoundingClientRect():null;
     return {panels,
      saveOwned:!!(save&&uploadForm&&save.form===uploadForm),
      fileOwned:!!(file&&uploadForm&&file.form===uploadForm),
      uploadOwned:!!(upload&&uploadForm&&upload.form===uploadForm),
      uploadHidden:uploadForm?[...uploadForm.elements].filter(e=>e.type==='hidden').map(e=>e.name):[],
      restoreHidden:restoreForm?[...restoreForm.elements].filter(e=>e.type==='hidden').map(e=>e.name):[],
      restoreOwned:!!(restore&&restoreForm&&restore.form===restoreForm),
      pickerFirst:!!(fr&&ur&&fr.top<ur.top),
      fileInPanel:!!(file&&file.closest('[data-od-admin="backup-restore"]')),
      saveInPanel:!!(save&&save.closest('[data-od-admin="backup-save"]')),
      uploadInPanel:!!(upload&&upload.closest('[data-od-admin="backup-restore"]')),
      restoreInPanel:!!(restore&&restore.closest('[data-od-admin="backup-factory"]')),
      cards:document.querySelectorAll('#FormTitle .od-card-title').length,
      sourceHidden:!!document.querySelector('.od-admin-source')};
    });
    assert.deepEqual(bak.panels.map(p=>p.key),['backup-save','backup-restore','backup-factory'],
     'backup panel composition changed: '+JSON.stringify(bak.panels));
    assert.deepEqual(bak.panels.map(p=>p.title),['Back up settings','Restore saved settings','Factory defaults'],
     'backup panel titles changed: '+JSON.stringify(bak.panels));
    assert(bak.panels[2].danger,'factory defaults not marked destructive: '+JSON.stringify(bak.panels));
    assert(bak.saveOwned&&bak.fileOwned&&bak.uploadOwned,'native upload form association lost: '+JSON.stringify(bak));
    assert(bak.uploadHidden.includes('current_page')&&bak.uploadHidden.includes('postflag')&&bak.uploadHidden.includes('value_NONE'),
     'native upload hidden state lost: '+JSON.stringify(bak.uploadHidden));
    assert(['testFlag','restoreFlag','rebootFlag'].every(n=>bak.restoreHidden.includes(n)),'native factory state lost: '+JSON.stringify(bak.restoreHidden));
    assert(bak.restoreOwned,'native factory form association lost: '+JSON.stringify(bak));
    assert(bak.pickerFirst&&bak.fileInPanel,'settings picker not before Upload: '+JSON.stringify(bak));
    assert(bak.saveInPanel&&bak.uploadInPanel&&bak.restoreInPanel,'backup actions not in their panels: '+JSON.stringify(bak));
    assert.equal(bak.cards,0,'generated backup card titles survived composition: '+JSON.stringify(bak));
    assert(bak.sourceHidden,'backup source table still visible: '+JSON.stringify(bak));
    sharedEvidence.push({page:'admin-backup',width,...bak});
   }
   if(url==='/Advanced_ASUSDDNS_Content.asp'){
    const message=await page.evaluate(()=>{
     const e=document.getElementById('wan_ip_hide2');
     if(!e)return null;
     const was=e.style.display;
     e.style.display='block';
     const result={shown:getComputedStyle(e).display!=='none',inside:!!e.closest('.od-help'),text:e.textContent.replace(/\s+/g,' ').trim().slice(0,80)};
     e.style.display=was;
     return result;
    });
    assert(message&&message.shown&&!message.inside,'DDNS conditional message moved into help at '+width+': '+JSON.stringify(message));
    sharedEvidence.push({page:'ddns-warning',width,...message});
   }
   if(data.width>data.viewport+2){
    const wide=await page.evaluate(()=>{const list=[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect();return {t:e.tagName,id:e.id,c:String(e.className).slice(0,24),x:Math.round(r.x),w:Math.round(r.width),right:Math.round(r.right),ov:getComputedStyle(e).overflowX,css:getComputedStyle(e).width,disp:getComputedStyle(e).display,parent:e.parentElement?e.parentElement.tagName+'#'+e.parentElement.id+'.'+String(e.parentElement.className).slice(0,16):null,html:e.outerHTML.slice(0,120)};}).filter(e=>e.right>innerWidth+2);
     const max=Math.max(...list.map(e=>e.right));
     const small=list.filter(e=>e.right<520).sort((a,b)=>b.right-a.right).slice(0,8);
     return {max,small};});
    console.log('OVERFLOW',url,width,data.width+'/'+data.viewport,JSON.stringify(wide));
   }
   if(process.env.OPENDSL_QA_DEBUG){
    const dbg=await page.evaluate(url=>{
     const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
     const priv=url==='/Advanced_Privacy.asp'?[...document.querySelectorAll('#FormTitle *')].filter(e=>e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {t:e.tagName,id:e.id,c:String(e.className).slice(0,30),y:Math.round(r.y),h:Math.round(r.height),x:Math.round(r.x),w:Math.round(r.width),b:s.borderTopWidth+' '+s.borderTopColor,r2:s.borderRadius,bg:s.backgroundColor};}):null;
     return {head:box('.od-page-head'),title:box('.od-page-head .formfonttitle'),status:box('.od-page-head .statusBar'),
      sidebar:box('#mainMenu'),toggle:box('.od-menu-toggle'),inspector:box('.od-inspector'),priv,
      cards:['#single_wan_icon','#single_wan_status','#clients_tr'].map(box)};
    },url);
    console.log('DEBUG',url,width,JSON.stringify(dbg));
   }
   if(url==='/Advanced_Wireless_Content.asp'&&width<850){
    assert(await page.locator('#WLgeneral').evaluate(e=>e.classList.contains('od-fields')));
    for(const name of ['wl_ssid','wl_wpa_psk']){const b=await page.locator('[name="'+name+'"]').boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width+1,'wireless field clipped: '+name);}
   }
    if(url==='/index2.asp'){
     await waitRouterFrame(page);
     const mapState=await page.evaluate(()=>({
      layout:!!document.querySelector('.od-map-layout'),
      nodes:[...document.querySelectorAll('.od-topo-node')].length,
      inspector:!!document.querySelector('.od-map-inspector'),
      native:['single_wan_icon','single_wan_status','iconRouter','clients_tr'].every(id=>!!document.getElementById(id)),
      router:(()=>{const e=document.getElementById('iconRouter');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,r:r.right,y:r.y,w:r.width,h:r.height};})(),
      fit:[...document.querySelectorAll('.od-map-layout *')].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1;}),
      overflow:document.documentElement.scrollWidth-innerWidth,
      frameCount:document.querySelectorAll('#statusframe').length,
      gatewayVisible:(()=>{const v=document.querySelector('.od-inspector-view[data-od-view="gateway"]');return !!(v&&!v.hidden);})(),
      nativeHidden:(()=>{const n=document.querySelector('.od-inspector-native');return !!(n&&n.hidden);})()
     }));
     assert(mapState.layout&&mapState.nodes===3&&mapState.inspector,'map composition missing: '+JSON.stringify(mapState));
     assert(mapState.native,'map native anchors lost: '+JSON.stringify(mapState));
     assert(mapState.router&&mapState.router.x>=0&&mapState.router.r<=width+1&&mapState.router.y>=0,'map router icon clipped: '+JSON.stringify(mapState.router));
     assert(mapState.fit&&mapState.overflow<=0,'map content clipped: '+JSON.stringify(mapState));
     assert.equal(mapState.frameCount,1,'network map must keep exactly one native frame: '+JSON.stringify(mapState));
     assert(mapState.gatewayVisible&&mapState.nativeHidden,'default inspector is not the gateway summary: '+JSON.stringify(mapState));
     assertMapHeading(await mapHeadingProbe(page),width);
     // R6A-03: the summary is built from the native hidden values, the native
     // clientList and the live status nodes, not from drawn sample records.
     const composition=await page.evaluate(()=>{
      const t=e=>e?e.textContent.replace(/\s+/g,' ').trim():null;
      const val=k=>{const e=document.querySelector('[data-od-gw="'+k+'"]');return t(e);};
      const rows=[...document.querySelectorAll('.od-device-card')].map(e=>({
       name:t(e.querySelector('.od-device-name')),kind:t(e.querySelector('.od-device-kind')),
       ip:t(e.querySelector('.od-device-ip')),label:e.getAttribute('aria-label')}));
      return {readouts:{ssid:val('ssid'),security:val('security'),lanip:val('lanip'),wps:val('wps'),mac:val('mac'),bandmac:val('bandmac')},
       strip:[...document.querySelectorAll('.od-map-strip .od-strip-item')].map(t),
       stripLabels:[...document.querySelectorAll('.od-strip-label')].map(t),
       headSub:t(document.querySelector('.od-map-panel > .od-map-head .od-map-sub')),
       deviceHeading:t(document.querySelector('.od-devices-panel .od-map-heading')),
       deviceSub:t(document.querySelector('.od-devices-head .od-map-sub')),
       rows,empty:!!document.querySelector('.od-device-empty'),viewAll:t(document.querySelector('.od-view-all')),
       actions:[...document.querySelectorAll('.od-inspector-view[data-od-view="gateway"] .od-action')].map(t)};
     });
     assert.equal(composition.readouts.ssid,'OpenDSL Home','gateway SSID does not match the native source: '+JSON.stringify(composition.readouts));
     assert.equal(composition.readouts.security,'WPA2-Personal','gateway security does not match the native source: '+JSON.stringify(composition.readouts));
     assert.equal(composition.readouts.lanip,'192.168.1.1','gateway LAN address does not match the native source: '+JSON.stringify(composition.readouts));
     assert.equal(composition.readouts.wps,'12345678','gateway WPS PIN does not match the native source: '+JSON.stringify(composition.readouts));
     assert.equal(composition.readouts.mac,'02:00:00:00:00:01','gateway LAN MAC does not match the native source: '+JSON.stringify(composition.readouts));
     assert.equal(composition.readouts.bandmac,'02:00:00:00:00:02','gateway wireless MAC does not match the native source: '+JSON.stringify(composition.readouts));
     assert(composition.headSub==='Your network is online and working properly.','map subtitle does not follow the native status: '+JSON.stringify(composition.headSub));
     assert.deepEqual(composition.stripLabels,['DSL line','Wireless'],'connection strip labels: '+JSON.stringify(composition.strip));
     assert(/^DSL line\s*8\.4 ↓ \/ 1\.0 ↑ Mbps$/.test(composition.strip[0]),'DSL strip does not render the native rates: '+JSON.stringify(composition.strip));
     assert(/^Wireless\s*2\.4 GHz · WPA2-Personal$/.test(composition.strip[1]),'wireless strip does not render the native band/security: '+JSON.stringify(composition.strip));
     assert.equal(composition.deviceHeading,'Connected devices','devices panel heading missing: '+JSON.stringify(composition));
     assert.equal(composition.deviceSub,'4 devices are connected to your network.','devices subtitle does not follow the native count: '+JSON.stringify(composition.deviceSub));
     assert.deepEqual(composition.rows.map(r=>r.name),['Office PC','Living Room TV','Pixel 9','Home NAS'],'device preview rows do not match the native online clients: '+JSON.stringify(composition.rows));
     assert.deepEqual(composition.rows.map(r=>r.kind),['Wired','2.4 GHz','2.4 GHz','Wired'],'device preview connection labels: '+JSON.stringify(composition.rows));
     assert.deepEqual(composition.rows.map(r=>r.ip),['192.168.1.20','192.168.1.31','192.168.1.32','192.168.1.40'],'device preview addresses: '+JSON.stringify(composition.rows));
     assert(composition.rows.every(r=>r.label===r.name+' details'),'device preview row labels: '+JSON.stringify(composition.rows));
     assert(!composition.rows.some(r=>/Old Tablet/.test(r.name)),'offline native client leaked into the preview: '+JSON.stringify(composition.rows));
     assert.equal(composition.empty,false,'device preview shows an empty state despite native clients');
     assert.equal(composition.viewAll,'View all','devices View all action missing: '+JSON.stringify(composition));
     assert.deepEqual(composition.actions,['Edit Wi-Fi settings','System status'],'gateway inspector actions: '+JSON.stringify(composition.actions));
     // R6R-01: every rendered client value is part of the redraw key. A native
     // record change alone must not redraw (the theme adds no polling); the
     // page's own count mutation is the refresh signal the theme already used.
     {
      const refresh=await page.evaluate(async()=>{
       const list=window.clientList, mac=list&&list.length?list[0]:null, record=mac?list[mac]:null;
       if(!record)return {missing:true};
       const card=()=>document.querySelector('.od-device-card');
       const snap=()=>{const c=card();return c?c.innerText.replace(/\s+/g,' ').trim():null;};
       const count=document.getElementById('_clientNumber');
       const bump=()=>{if(count)count.textContent=count.textContent;};
       const wait=ms=>new Promise(r=>setTimeout(r,ms));
       const original={Name:record.Name,IP:record.IP,isWL:record.isWL};
       const originalText=snap();
       record.Name='Audit renamed device';record.IP='192.168.1.222';record.isWL=1;
       await wait(250);
       const withoutSignal=snap();
       bump();await wait(200);
       const afterSignal=snap();
       record.Name=original.Name;record.IP=original.IP;record.isWL=original.isWL;bump();await wait(200);
       return {original,originalText,withoutSignal,afterSignal,restored:snap()};
      });
      assert(!refresh.missing,'R6R-01 refresh probe found no native client record: '+JSON.stringify(refresh));
      assert.equal(refresh.originalText,'Office PC Wired 192.168.1.20','R6R-01 starting row is not the native record: '+JSON.stringify(refresh));
      assert.equal(refresh.withoutSignal,refresh.originalText,'R6R-01 row changed without the native refresh signal (duplicate polling): '+JSON.stringify(refresh));
      assert.equal(refresh.afterSignal,'Audit renamed device 2.4 GHz 192.168.1.222','R6R-01 row kept stale native values: '+JSON.stringify(refresh));
      assert.equal(refresh.restored,refresh.originalText,'R6R-01 row did not return to the native values: '+JSON.stringify(refresh));
      geometryEvidence.r6r01.push(Object.assign({width},refresh));
     }
     // Mask icons paint a frame after layout; settle like the route renders so
     // the captured shell shows the same actions the DOM already carries.
     await page.evaluate(()=>window.scrollTo(0,0));
     await page.waitForTimeout(250);
     await page.screenshot({path:path.join(out,'index2-summary-'+width+'.png'),fullPage:true});
     // The retained native form opens only behind the explicit action and keeps
     // ownership of the Wi-Fi controls, validation and submit target.
     const beforeEdit=await page.evaluate(()=>({native:document.querySelector('.od-inspector-native').hidden,
      gateway:!document.querySelector('.od-inspector-view[data-od-view="gateway"]').hidden}));
     assert(beforeEdit.native&&beforeEdit.gateway,'editable router form is not held behind Edit Wi-Fi: '+JSON.stringify(beforeEdit));
     await openEditWifi(page);
     const nativeForm=await page.locator('#statusframe').evaluate(f=>{
      const d=f.contentDocument;if(!d)return null;
      return {path:d.location.pathname,ssid:!!d.getElementById('wl_ssid'),psk:!!d.querySelector('[name="wl_wpa_psk"]'),
       apply:!!d.querySelector('input[value="Apply"]'),form:!!d.querySelector('form'),
       target:d.querySelector('form')?d.querySelector('form').getAttribute('action'):null};
     });
     assert(nativeForm&&/\/device-map\/router\.asp$/.test(nativeForm.path)&&nativeForm.ssid&&nativeForm.psk&&nativeForm.apply&&nativeForm.form,
      'Edit Wi-Fi did not open the retained native router form: '+JSON.stringify(nativeForm));
     assertInspectorMacs(await inspectorMacProbe(page),width);
     assert(!await page.locator('#usb1_tr').isVisible());assert(!await page.locator('#usb2_tr').isVisible());
     if(width>=850){
      assert(!await page.locator('.od-menu-toggle').isVisible(),'desktop hamburger visible');
      assert(await page.locator('#mainMenu').isVisible(),'desktop sidebar hidden');
      await page.waitForTimeout(350);
      const fit=await page.locator('#statusframe').evaluate(f=>{
       const d=f.contentDocument; if(!d||!d.body) return null;
       const vh=f.clientHeight;
       const pick=s=>{const e=d.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1)};};
       return {vh,fpassword:pick('[name="wl_wpa_psk"]'),fapply:pick('input[value="Apply"]'),scroll:d.body.scrollHeight};
      });
      assert(fit&&fit.fpassword&&fit.fapply,'inspector frame missing fields: '+JSON.stringify(fit));
      assert(fit.fpassword.top>=0&&fit.fpassword.bottom<=fit.vh+1,'inspector password clipped: '+JSON.stringify(fit));
      assert(fit.fapply.top>=0&&fit.fapply.bottom<=fit.vh+1,'inspector apply clipped: '+JSON.stringify(fit));
      assert(fit.scroll<=fit.vh+1,'inspector inner scrolling remains: '+JSON.stringify(fit));
     }
     if(width<850){
     assert(!await page.locator('#mainMenu').isVisible());
     await page.locator('.od-menu-toggle').click();assert(await page.locator('#mainMenu').isVisible());
     await page.locator('.od-nav-close').click();assert(!await page.locator('#mainMenu').isVisible());
     await page.locator('.od-menu-toggle').click();assert(await page.locator('#mainMenu').isVisible());
     await page.keyboard.press('Escape');assert(!await page.locator('#mainMenu').isVisible());
     // Drawer keyboard order and scrolling: the native menu items stay focusable
     // role=link nodes and the drawer itself is the scroll container.
     await page.locator('.od-menu-toggle').click();
     await page.waitForTimeout(250);
     const menuState=await page.evaluate(()=>{
      const cell=document.querySelector('.content > tbody > tr > td:has(> #mainMenu)');
      const items=[...document.querySelectorAll('#mainMenu div[onclick],#subMenu div[onclick]')];
      const cs=getComputedStyle(cell);
      return {overflow:cs.overflowY,clientH:cell.clientHeight,scrollH:cell.scrollHeight,items:items.length,
       native:items.filter(e=>/location\.href|go_setting/.test(e.getAttribute('onclick')||'')).length,
       role:items.every(e=>e.getAttribute('role')==='link'&&e.getAttribute('tabindex')==='0'),
       focused:document.activeElement===items[0],focusTag:document.activeElement?document.activeElement.tagName:null};
     });
     assert.equal(menuState.overflow,'auto','drawer is not its own scroller: '+JSON.stringify(menuState));
     assert(menuState.items>=9&&menuState.native===menuState.items&&menuState.role,'native drawer links changed: '+JSON.stringify(menuState));
     assert(menuState.focused,'drawer did not focus the first native link: '+JSON.stringify(menuState));
     await page.keyboard.press('Tab');
     const menuTab=await page.evaluate(()=>{
      const inMenu=!!(document.activeElement&&document.activeElement.closest('#mainMenu,#subMenu'));
      return {inMenu,role:document.activeElement?document.activeElement.getAttribute('role'):null};
     });
     assert(menuTab.inMenu&&menuTab.role==='link','Tab left the drawer menu: '+JSON.stringify(menuTab));
     if(menuState.scrollH>menuState.clientH+1){
      await page.evaluate(()=>{const c=document.querySelector('.content > tbody > tr > td:has(> #mainMenu)');c.scrollTop=c.scrollHeight;});
      const menuScroll=await page.evaluate(()=>document.querySelector('.content > tbody > tr > td:has(> #mainMenu)').scrollTop);
      assert(menuScroll>0,'drawer did not scroll: '+menuScroll);
     }
     await page.keyboard.press('Escape');
     assert(!await page.evaluate(()=>document.body.classList.contains('od-nav-open')),'Escape left the drawer open');
     assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.className),'od-menu-toggle','drawer close did not restore toggle focus');
     geometryEvidence.nav={width,...menuState};
     const phoneHead=await page.evaluate(()=>{
      const head=document.querySelector('.od-page-head'),context=document.querySelector('.od-context'),banner=document.querySelector('.banner1 > span:first-child');
      const infoButton=document.querySelector('.od-topbar-actions .od-info-button'),drawer=document.getElementById('od-device-drawer');
      return {context:context?getComputedStyle(context).display:null,headBorder:head?getComputedStyle(head).borderBottomWidth:null,bannerBorder:banner?getComputedStyle(banner).borderBottomWidth:null,label:infoButton?infoButton.textContent.trim():null,inDrawer:!!(infoButton&&drawer&&drawer.querySelector('.statusBar'))};
     });
     assert(phoneHead.context===null||phoneHead.context==='none','Index2 phone context remains at '+width);
     assert.equal(phoneHead.headBorder,'0px','Index2 phone head divider remains at '+width);
     assert.equal(phoneHead.bannerBorder,'1px','Index2 phone top-bar divider missing at '+width);
     assert.equal(phoneHead.label,'Device info','Index2 phone Device info control missing at '+width+': '+JSON.stringify(phoneHead));
     assert.equal(phoneHead.inDrawer,true,'Index2 phone Device info not in drawer at '+width);
     await page.locator('.od-menu-toggle').click();
     await page.waitForTimeout(350);
     await page.screenshot({path:path.join(out,'shared-index2-drawer-'+width+'.png')});
     await page.locator('.od-nav-close').click();
     await page.waitForTimeout(300);
     await page.locator('.od-topbar-actions .od-info-button').click();
     assert(await page.locator('#od-device-drawer .od-device-readouts').isVisible(),'Index2 phone Device info drawer hidden at '+width);
     await page.locator('#od-device-drawer .od-drawer-close').click();
     assert(!await page.locator('#od-device-drawer').isVisible(),'Index2 phone Device info drawer did not close at '+width);
    }
   }
   if(url==='/index2.asp'&&width<850){
     // R6 responsive map: one topology card, the two-up connection strip, the
     // connected-device preview and the inline summary inspector.
     await page.evaluate(()=>{const n=document.querySelector('.od-topo-node[data-od-node="gateway"]');if(n)n.click();});
     await page.waitForTimeout(150);
     const map=await page.evaluate(()=>{
      const b=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
      const nodes=[...document.querySelectorAll('.od-topo-node')];
      return {
       panel:b(document.querySelector('.od-map-panel')),
       inspector:b(document.querySelector('.od-map-inspector')),
       nodes:nodes.map(n=>({box:b(n),role:n.getAttribute('role'),tab:n.getAttribute('tabindex'),label:n.getAttribute('aria-label'),node:n.getAttribute('data-od-node')})),
       names:[...document.querySelectorAll('.od-topo-name')].map(e=>e.textContent.trim()),
       strip:[...document.querySelectorAll('.od-strip-item')].map(e=>({box:b(e),text:e.textContent.replace(/\s+/g,' ').trim()})),
       devices:[...document.querySelectorAll('.od-device-card')].map(e=>b(e)),
       gatewayVisible:(()=>{const v=document.querySelector('.od-inspector-view[data-od-view="gateway"]');return !!(v&&!v.hidden);})(),
       overflow:document.documentElement.scrollWidth-innerWidth,
       native:['single_wan_icon','single_wan_status','iconRouter','clients_tr'].every(id=>!!document.getElementById(id)),
       frame:!!document.getElementById('statusframe')
      };
     });
     assert(map.overflow<=0,'phone map overflow: '+JSON.stringify(map.overflow));
     assert(map.native,'phone map native anchors lost: '+JSON.stringify(map));
     assert.equal(map.nodes.length,3,'phone map topology nodes: '+JSON.stringify(map.nodes));
     assert(map.nodes.every(n=>n.role==='button'&&n.tab==='0'&&n.label),'phone map node affordance: '+JSON.stringify(map.nodes));
     assert(map.nodes.every(n=>n.box.w>=44&&n.box.h>=44&&n.box.x>=0&&n.box.r<=width+1),'phone map node geometry: '+JSON.stringify(map.nodes));
     assert.deepEqual(map.names,['Internet','OpenDSL','Devices'],'phone map node labels: '+JSON.stringify(map.names));
     assert.equal(map.strip.length,2,'phone map connection strip entries: '+JSON.stringify(map.strip));
     assert(map.strip.every(s=>s.box&&s.box.x>=map.panel.x-1&&s.box.r<=map.panel.r+1&&s.box.h>=44),'phone map strip geometry: '+JSON.stringify({panel:map.panel,strip:map.strip}));
     assert(/^DSL line\s*8\.4 ↓ \/ 1\.0 ↑ Mbps$/.test(map.strip[0].text)&&/^Wireless\s*2\.4 GHz · WPA2-Personal$/.test(map.strip[1].text),'phone map strip values: '+JSON.stringify(map.strip));
     assert.equal(map.devices.length,4,'phone device preview rows: '+JSON.stringify(map.devices));
     assert(map.devices.every(d=>d&&d.x>=map.panel.x-1&&d.r<=map.panel.r+1),'phone device preview geometry: '+JSON.stringify(map.devices));
     assert.equal(map.gatewayVisible,true,'phone map does not start on the gateway summary');
     assert(map.panel&&map.panel.x>=15&&map.panel.r<=width-15,'phone map panel gutter: '+JSON.stringify(map.panel));
     assert(map.inspector&&map.inspector.x>=15&&map.inspector.r<=width-15,'phone map inspector gutter: '+JSON.stringify(map.inspector));
     assert(map.frame,'phone map inspector frame missing');
     const acts=await page.evaluate(()=>[...document.querySelectorAll('.od-topbar-actions a[href*="logout"], .od-topbar-actions a[href*="reboot"]')].map(a=>({label:a.getAttribute('aria-label')||a.textContent.trim(),box:a.getBoundingClientRect().toJSON()})));
     assert(acts.some(a=>/Log out/i.test(a.label))&&acts.some(a=>/Reboot/i.test(a.label)),'phone header actions missing: '+JSON.stringify(acts));
     assert(acts.every(a=>a.box.width>=44&&a.box.height>=44&&a.box.left>=0&&a.box.right<=width+1),'phone header actions off the bar: '+JSON.stringify(acts));
     // Selecting a topology node switches the drawn summary; the retained frame
     // follows the native device-map targets only behind explicit actions.
     const clickNode=async t=>{
      const clicked=await page.evaluate(t=>{const n=document.querySelector('.od-topo-node[data-od-node="'+t+'"]');if(!n)return false;n.click();return true;},t);
      assert(clicked,'network-map node missing for '+t);
      await page.waitForTimeout(150);
     };
     const frameAt=async f=>page.evaluate(f=>{const x=document.getElementById('statusframe');if(!x)return false;try{return (x.contentWindow.location.pathname||'').includes('/device-map/'+f+'.asp');}catch(e){return false;}},f);
     const viewState=async v=>page.evaluate(v=>{
      const node=document.querySelector('.od-inspector-view[data-od-view="'+v+'"]');
      return {visible:!!(node&&!node.hidden),text:node?node.textContent.replace(/\s+/g,' ').trim():null};
     },v);
     await clickNode('internet');
     const internet=await viewState('internet');
     assert(internet.visible&&/192\.0\.2\.25/.test(internet.text)&&/Disabled/.test(internet.text),'phone internet view lost the native WAN/DDNS values: '+JSON.stringify(internet));
     await page.evaluate(()=>document.querySelector('.od-inspector-view[data-od-view="internet"] .od-action').click());
     await page.waitForTimeout(300);
     assert(await frameAt('internet'),'More connection details did not load internet.asp');
     await clickNode('clients');
     await page.waitForTimeout(300);
     assert(await frameAt('clients'),'Devices node did not load clients.asp');
     await clickNode('gateway');
     const gateway=await page.evaluate(()=>{
      const node=document.querySelector('.od-inspector-view[data-od-view="gateway"]');
      const label=document.querySelector('.od-inspector-label');
      return {visible:!!(node&&!node.hidden),label:label?label.textContent.trim():null};
     });
     assert(gateway.visible&&gateway.label==='Gateway details','gateway node did not restore the summary: '+JSON.stringify(gateway));
     await page.evaluate(()=>document.querySelector('.od-strip-dsl').click());
     await page.waitForTimeout(150);
     const dsl=await viewState('dsl');
     assert(dsl.visible&&/Line state\s*up/.test(dsl.text)&&/8\.4 Mbps/.test(dsl.text)&&/ADSL2\+/.test(dsl.text),'phone DSL view values: '+JSON.stringify(dsl));
     await page.evaluate(()=>document.querySelector('.od-inspector-view[data-od-view="dsl"] .od-action').click());
     await page.waitForTimeout(300);
     assert(await frameAt('DSL_dashboard'),'All line statistics did not load DSL_dashboard.asp');
     await page.evaluate(()=>document.querySelector('.od-view-all').click());
     await page.waitForTimeout(300);
     assert(await frameAt('clients'),'View all did not load clients.asp');
     await clickNode('gateway');
     await page.evaluate(()=>document.querySelector('.od-inspector-view[data-od-view="gateway"] .od-action.od-primary').click());
     await page.waitForTimeout(300);
     assert(await frameAt('router'),'Edit Wi-Fi settings did not return to the native router form');
     await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:path.join(out,'index2-phone-map-'+width+'.png'),fullPage:true});
   }
   if(url==='/index2.asp'&&width>=851){
     const desk=await page.evaluate(()=>({
      nodes:[...document.querySelectorAll('.od-topo-node')].length,
      layout:!!document.querySelector('.od-map-layout'),
      inspector:!!document.querySelector('.od-map-inspector'),
      overflow:document.documentElement.scrollWidth-innerWidth
     }));
     assert.equal(desk.nodes,3,'desktop topology nodes: '+JSON.stringify(desk));
     assert(desk.layout&&desk.inspector,'desktop map composition missing: '+JSON.stringify(desk));
     assert(desk.overflow<=0,'desktop map overflow: '+JSON.stringify(desk));
     if(width>=1201){
      await page.waitForTimeout(400);
      const frame=await page.locator('#statusframe').evaluate(f=>{
       const d=f.contentDocument; if(!d||!d.body)return null;
       const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),r:+r.right.toFixed(1)};};
       const v=d.getElementById('LANIP'), a=d.querySelector('.od-inspector-actions input[type="submit"]');
       if(!v)return {cw:f.clientWidth,missing:true};
       return {cw:f.clientWidth,value:b(v),apply:a?b(a):null};
      });
      // Embedded status card must keep its right-aligned values inside the
      // iframe instead of clipping them at the parent card edge.
      assert(frame&&!frame.missing&&frame.value.r<=frame.cw-8,'embedded status values clipped at '+width+': '+JSON.stringify(frame));
      assert(frame&&(!frame.apply||frame.apply.r<=frame.cw-8),'embedded status Apply clipped at '+width+': '+JSON.stringify(frame));
     }
   }
   if(data.editors.length){
     const editors=await page.evaluate(()=>[...document.querySelectorAll('table.od-editor')].map(t=>{
      const rb=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
      const vis=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
      const head=t.querySelector('.od-editor-head');
      const form=t.classList.contains('od-editor-form');
      const controls=[...t.querySelectorAll('tbody input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), tbody select, tbody textarea')].filter(vis);
      const caps=[...t.querySelectorAll('.od-cell-label')].filter(vis);
      const per=controls.map(c=>{const cell=c.closest('td,th');return cell?[...cell.querySelectorAll('.od-cell-label')].filter(vis).length:-1;});
      const rows=[...t.querySelectorAll(':scope > tbody > tr')].filter(tr=>!tr.classList.contains('od-editor-head')&&vis(tr));
      const cells=rows.flatMap(tr=>[...tr.cells].filter(vis));
      const labels=cells.map(c=>c.querySelector(':scope > .od-cell-label')).filter(Boolean);
      const fields=cells.map(c=>c.querySelector(':scope > .od-field')).filter(Boolean);
      const entries=fields.map(f=>{
       const all=[...f.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')].filter(vis);
       if(!all.length)return null;
       const c=all[0];
       const rs=all.map(rb);
       const picker=c.closest('.od-picker-row');
       const arrow=picker?picker.querySelector('#pull_arrow'):null;
       return {rect:rb(c),span:{x:Math.min(...rs.map(r=>r.x)),r:Math.max(...rs.map(r=>r.r))},count:all.length,
        field:rb(f),picker:picker?rb(picker):null,arrow:arrow&&vis(arrow)?rb(arrow):null};
      }).filter(Boolean);
      const add=t.querySelector('input.add_btn, input.service_btn, input.url_btn');
      const action=add?add.closest('td'):null;
      const al=action?action.querySelector(':scope > .od-cell-label'):null;
      const acs=add?getComputedStyle(add):null;
      return {headVisible:!!(head&&vis(head)),form,controls:controls.length,captions:caps.length,per,
       captionColor:caps.length?getComputedStyle(caps[0]).color:null,captionFont:caps.length?getComputedStyle(caps[0]).fontSize:null,
       rect:rb(t),cells:cells.length,labels:labels.filter(vis).map(rb),labelTexts:labels.filter(vis).map(l=>l.textContent.trim()),fields:fields.map(rb),entries,
       addLabel:al&&vis(al)?al.textContent.trim():null,
       add:add?{rect:rb(add),text:(add.value||'').trim(),border:acs.borderTopWidth,bg:acs.backgroundColor,fullRow:action?rb(add).w>=rb(action).w-8:null}:null};
     }));
     const check=(ok,msg)=>{if(!ok)failures.push(msg);};
     check(editors.length>=1,url+' has no decorated editor');
     for(const e of editors){
      check(e.form,url+'@'+width+' single-entry editor not presented as a form card');
      check(!e.headVisible,url+'@'+width+' mirrored header still visible');
      check(e.controls>0&&e.captions>=e.controls,url+'@'+width+' captions missing: '+JSON.stringify(e));
      check(e.per.every(n=>n===1),url+'@'+width+' caption not one-per-control: '+JSON.stringify(e));
      check(e.captionColor==='rgb(165, 184, 209)',url+'@'+width+' caption colour: '+e.captionColor);
      check(e.labels.length===e.cells,url+'@'+width+' not every form cell has a caption: '+JSON.stringify(e));
      check(e.add&&e.addLabel,url+'@'+width+' Add action caption missing: '+JSON.stringify(e.addLabel));
      if(!e.add){failures.push(url+'@'+width+' editor has no Add action');continue;}
      check(e.add.text==='Add',url+'@'+width+' Add action not labelled: '+JSON.stringify(e.add));
      check(e.add.rect.w>=80&&e.add.rect.w<=180,url+'@'+width+' Add is not compact: '+JSON.stringify(e.add.rect));
      check(!e.add.fullRow,url+'@'+width+' Add spans the form row: '+JSON.stringify(e.add.rect));
      check(e.add.border==='1px',url+'@'+width+' Add outline missing');
      if(width<850){
       check(e.captionFont==='16px',url+'@'+width+' caption size: '+e.captionFont);
       for(let i=0;i<e.entries.length;i++){
        const en=e.entries[i],lab=e.labels[i];
        if(!lab)continue;
        check(lab.b<=en.field.y+1,url+'@'+width+' caption not above its control: '+JSON.stringify({lab,field:en.field}));
        check(Math.abs(lab.x-en.field.x)<=1.1,url+'@'+width+' caption and control left edges differ: '+JSON.stringify({lab,field:en.field}));
        if(en.picker){
         check(en.picker.w>=en.field.w-2,url+'@'+width+' picker row does not fill its field: '+JSON.stringify(en));
         check(en.rect.w>=en.picker.w-24,url+'@'+width+' picker control does not fill its row: '+JSON.stringify(en));
         if(en.arrow)check(en.arrow.r<=en.picker.r+0.6,url+'@'+width+' picker trigger escapes its row: '+JSON.stringify(en));
        }else{
         check(en.span.r-en.span.x>=en.field.w-2,url+'@'+width+' controls do not fill their field: '+JSON.stringify(en));
         check(en.count===1||en.span.r<=en.field.r+0.6,url+'@'+width+' multi-control field escapes: '+JSON.stringify(en));
        }
        check(en.rect.r<=e.rect.r+0.6,url+'@'+width+' control escapes the card');
       }
       check(e.add.rect.x>=e.rect.x-0.6&&e.add.rect.r<=e.rect.r+0.6,url+'@'+width+' Add escapes the card');
      }else{
       check(e.captionFont==='16px',url+'@'+width+' caption size: '+e.captionFont);
       const xs=e.entries.map(en=>en.rect.x);
       if(xs.length>1)check(Math.max(...xs)-Math.min(...xs)<=1.1,url+'@'+width+' value controls do not share a left edge: '+JSON.stringify(xs));
       for(let i=0;i<e.entries.length;i++){
        const en=e.entries[i],lab=e.labels[i];
        if(!lab)continue;
        check(Math.abs((lab.y+lab.h/2)-(en.rect.y+en.rect.h/2))<=2.5,url+'@'+width+' caption/control not on one baseline: '+JSON.stringify({lab,entry:en}));
        check(en.rect.x>lab.x+10,url+'@'+width+' control overlaps its caption');
        check(en.rect.r<=e.rect.r+0.6,url+'@'+width+' control escapes the card');
       }
      }
     }
     if(url==='/Advanced_QOSUserRules_Content.asp'){
      const q=editors.find(e=>e.form);
      check(q&&q.labelTexts.filter(t=>t==='Transferred').length===2,url+'@'+width+' transferred range not split into two fields: '+JSON.stringify(q&&q.labelTexts));
      check(q&&q.entries.length===q.labels.length-1,url+'@'+width+' range split lost a field: '+JSON.stringify(q&&{labels:q.labelTexts,entries:q.entries.length}));
      check(q&&q.entries.every(en=>en.count===1),url+'@'+width+' range field still holds two controls: '+JSON.stringify(q&&q.entries));
     }
   }
   /* A visible caption is not an accessible name. Read the browser's computed
      accessibility tree for every entry control on the editor pages. */
   if(['/Advanced_GWStaticRoute_Content.asp','/Advanced_PortTrigger_Content.asp','/Main_WOL_Content.asp','/Advanced_VirtualServer_Content.asp'].includes(url)){
     const snapshot=await page.locator('table.od-editor').first().ariaSnapshot();
     const fields=snapshot.split('\n').map(l=>l.trim()).filter(l=>/^- (textbox|combobox|spinbutton|searchbox)(\s|$)/.test(l));
     const unnamed=fields.filter(l=>!/^- (textbox|combobox|spinbutton|searchbox) "[^"]+"/.test(l));
     assert(fields.length>=1,url+'@'+width+' no accessible entry controls: '+snapshot.slice(0,400));
     assert.equal(unnamed.length,0,url+'@'+width+' unnamed entry controls: '+unnamed.join(' | ')+' in '+snapshot.slice(0,500));
     accessibleControls.push({url,width,fields:fields.length});
   }
   /* The static-route host picker must sit inside the card, below its caption,
      with the dropdown trigger after the field rather than over the text. */
   if(url==='/Advanced_GWStaticRoute_Content.asp'&&width<850){
     const picker=await page.evaluate(()=>{
      const table=document.querySelector('table.od-editor');
      const row=table&&table.querySelector('.od-picker-row');
      const input=row&&row.querySelector('input[type="text"]');
      const arrow=row&&row.querySelector('#pull_arrow');
      const labels=[...document.querySelectorAll('table.od-editor .od-cell-label')].filter(l=>getComputedStyle(l).display!=='none'&&l.getBoundingClientRect().height>0);
      const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
      const ab=arrow?b(arrow):null;
      return {table:table?b(table):null,row:row?b(row):null,input:input?b(input):null,arrow:ab,
       inputMargin:input?getComputedStyle(input).marginLeft:null,arrowPosition:arrow?getComputedStyle(arrow).position:null,
       overlaps:labels.filter(l=>{const lb=b(l);return ab&&lb.x<ab.r&&lb.r>ab.x&&lb.y<ab.b&&lb.b>ab.y;}).map(l=>l.textContent.trim())};
     });
     assert(picker.table&&picker.row&&picker.input&&picker.arrow,'static-route picker row missing: '+JSON.stringify(picker));
     assert(picker.input.x>=picker.table.x-1&&picker.input.r<=picker.table.r+1,'static-route field escapes the card: '+JSON.stringify(picker));
     assert(picker.row.x>=picker.table.x-1&&picker.row.r<=picker.table.r+1,'static-route picker row escapes the card: '+JSON.stringify(picker));
     assert(picker.arrow.x>=picker.input.r,'static-route dropdown trigger overlaps the field: '+JSON.stringify(picker));
     assert.equal(picker.overlaps.length,0,'static-route dropdown trigger covers its caption: '+JSON.stringify(picker));
     assert.equal(picker.inputMargin,'0px','static-route obsolete negative field margin: '+JSON.stringify(picker));
     assert.equal(picker.arrowPosition,'static','static-route trigger still absolute: '+JSON.stringify(picker));
     geometryEvidence.picker.push({width,...picker});
   }
   /* R6 keeps the diagnostics actions neutral; only these two pages draw a
      blue commit action. */
   if(['/Advanced_ASUSDDNS_Content.asp','/Advanced_GWStaticRoute_Content.asp'].includes(url)){
     const prim=await page.evaluate(()=>{
      const e=[...document.querySelectorAll('.apply_gen input.od-primary, .apply_gen button.od-primary, .apply_gen .od-primary')].find(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().height>0);
      if(!e)return null;
      const r=e.getBoundingClientRect();
      return {x:r.x,w:r.width,r:r.right,vw:innerWidth,label:(e.value||e.textContent||'').trim()};
     });
     assert(prim,url+'@'+width+' primary action missing');
     if(width<850)assert(prim.w>=width-42&&prim.x>=0&&prim.r<=width+1,url+'@'+width+' primary not full width: '+JSON.stringify(prim));
     else assert(prim.w<Math.min(420,width*.45),url+'@'+width+' desktop primary too wide: '+JSON.stringify(prim));
   }
           if(url==='/Main_AdslStatus_Content.asp'){
     /* R6: "Line connection" and "DSL information" share a row above a
        full-width "Line statistics" card. Native ids are moved, not cloned;
        the summary mirrors the polled cells. */
     const adsl=await page.evaluate(async()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2),r:+r.right.toFixed(2),b:+r.bottom.toFixed(2)};};
      const cs=e=>getComputedStyle(e);
      const summary=document.querySelector('.od-adsl-connection');
      const info=document.querySelector('.od-adsl-info');
      const stats=document.querySelector('.od-adsl-stats');
      const layout=document.querySelector('.od-adsl-layout');
      const titles=[...document.querySelectorAll('.od-adsl-panel-title')].map(h=>({text:h.textContent.replace(/\s+/g,' ').trim(),font:cs(h).fontSize,weight:cs(h).fontWeight}));
      const rows=summary?[...summary.querySelectorAll('.od-adsl-readout')]:[];
      const rowBoxes=rows.map(box);
      const labels=rows.map(r=>r.querySelector('dt')?r.querySelector('dt').textContent.trim():'');
      const badge=summary?summary.querySelector('.od-adsl-state'):null;
      const badgeBox=badge?box(badge):null;
      const infoTable=info?info.querySelector('table.FormTable_log'):null;
      const infoRows=infoTable?[...infoTable.querySelectorAll('tbody > tr')].filter(r=>cs(r).display!=='none'):[];
      const infoLabels=infoRows.map(r=>r.cells[0].textContent.replace(/\s+/g,' ').trim());
      const infoValue=infoRows.length&&infoRows[0].cells[1]?{align:cs(infoRows[0].cells[1]).textAlign,font:cs(infoRows[0].cells[1]).fontSize,colour:cs(infoRows[0].cells[1]).color}:null;
      const infoChrome=infoTable?{bg:cs(infoTable).backgroundColor,outline:cs(infoTable).outlineStyle,margin:cs(infoTable).margin,font:infoRows.length?cs(infoRows[0].cells[0]).fontSize:null}:null;
      const statsTable=stats?stats.querySelector('table.FormTable_log'):null;
      const scroll=stats?stats.querySelector('.od-scroll'):null;
      const head=statsTable?statsTable.querySelector('thead > tr.od-status-head'):null;
      const headCells=head?[...head.cells].map(c=>({text:c.textContent.replace(/\s+/g,' ').trim(),box:box(c),font:cs(c).fontSize,colour:cs(c).color,display:cs(c).display})):null;
      const bodyRows=statsTable?[...statsTable.querySelectorAll('tbody > tr')].filter(r=>cs(r).display!=='none'):[];
      const bodyBoxes=bodyRows.map(box);
      const cell=bodyRows.length?bodyRows[0].cells[0]:null;
      const statsChrome=statsTable?{border:cs(statsTable).borderTopWidth,radius:cs(statsTable).borderTopLeftRadius,bg:cs(statsTable).backgroundColor}:null;
      const scrollChrome=scroll?{padding:cs(scroll).padding,margin:cs(scroll).margin,bg:cs(scroll).backgroundColor,pad:box(scroll)}:null;
      document.getElementById('div_lineState').textContent='Up';
      document.getElementById('div_Opmode').textContent='ADSL2+';
      document.getElementById('div_AdslType').textContent='Annex A';
      document.getElementById('div_DataRateDown').textContent='8192 kbps';
      document.getElementById('div_DataRateUp').textContent='1024 kbps';
      document.getElementById('div_SNRMarginDown').textContent='8.2 dB';
      document.getElementById('div_SNRMarginUp').textContent='10.4 dB';
      document.getElementById('div_AttenDown').textContent='32.0 dB';
      document.getElementById('div_AttenUp').textContent='18.5 dB';
      document.getElementById('div_CRCDown').textContent='14';
      document.getElementById('div_CRCUp').textContent='3';
      await new Promise(r=>setTimeout(r,80));
      const values=rows.map(r=>r.querySelector('dd')?r.querySelector('dd').innerText.replace(/\s+/g,' ').trim():'');
      return {
       panels:document.querySelectorAll('.od-adsl-panel').length,
       titles,
       layout:box(layout),summary:box(summary),info:box(info),stats:box(stats),
       layoutDisplay:layout?cs(layout).display:null,
       rows:rows.length,labels,rowPitch:rowBoxes.length>1?+(rowBoxes[1].y-rowBoxes[0].y).toFixed(2):null,
       rowLastBottom:rowBoxes.length?rowBoxes[rowBoxes.length-1].b:null,
       summaryBottom:box(summary).b,
       badgeText:badge?badge.innerText.replace(/\s+/g,' ').trim():null,
       badgeOk:badge?badge.classList.contains('is-ok'):null,
       badgeBox,
       badgeColour:badge?cs(badge).color:null,
       values,
       infoRows:infoRows.length,infoLabels,infoValue,infoChrome,
       infoHeading:!!info.querySelector('.od-status-heading'),
       statsHeading:!!stats.querySelector('.od-status-heading'),
       headCells,headDisplay:head?cs(head).display:null,
       matrixFont:cell?{font:cs(cell).fontSize,colour:cs(cell).color,display:cs(cell).display}:null,
       matrixPitch:bodyBoxes.length>1?+(bodyBoxes[1].y-bodyBoxes[0].y).toFixed(2):null,
       matrixCols:bodyRows.length?bodyRows[0].cells.length:0,
       statsChrome,scrollChrome,
       nativeRows:document.querySelectorAll('table.FormTable_log').length,
       micro:cell?getComputedStyle(cell,'::before').content:null,
       desc:document.querySelector('.od-status-desc')?cs(document.querySelector('.od-status-desc')).display:null,
       titleRows:[...document.querySelectorAll('.od-status-title-row')].map(r=>cs(r).display)
      };
     });
     if(process.env.OPENDSL_QA_DEBUG)console.log('ADSL-STATUS',width,JSON.stringify(adsl));
     assert.equal(adsl.panels,3,'ADSL R6 panels: '+JSON.stringify(adsl.panels));
     assert.deepEqual(adsl.titles.map(t=>t.text.toLowerCase()),['line connection','dsl information','line statistics'],'ADSL panel titles: '+JSON.stringify(adsl.titles));
     assert(adsl.titles.every(t=>t.font==='16px'&&t.weight==='600'),'ADSL panel title type: '+JSON.stringify(adsl.titles));
     assert(adsl.desc===null||adsl.desc==='none','ADSL page description still shown: '+JSON.stringify(adsl.desc));
     assert(adsl.titleRows.every(d=>d==='none'),'ADSL native title row still shown: '+JSON.stringify(adsl.titleRows));
     assert(!adsl.infoHeading&&!adsl.statsHeading,'ADSL lifted heading left inside a panel: '+JSON.stringify(adsl));
     assert.equal(adsl.rows,8,'ADSL summary rows: '+JSON.stringify(adsl.labels));
     assert.deepEqual(adsl.labels,['Line state','Modulation','Annex','Downstream','Upstream','SNR \u00b7 down / up','Attenuation \u00b7 down / up','CRC \u00b7 down / up'],'ADSL summary labels: '+JSON.stringify(adsl.labels));
     assert(adsl.badgeText==='Connected'&&adsl.badgeOk,'ADSL live line state badge: '+JSON.stringify({text:adsl.badgeText,ok:adsl.badgeOk}));
     assert.deepEqual(adsl.values,['Connected','ADSL2+','Annex A','8.2 Mbps','1.0 Mbps','8.2 / 10.4 dB','32.0 / 18.5 dB','14 / 3'],'ADSL summary mirrors native values: '+JSON.stringify(adsl.values));
     /* Native label casing is preserved; only the row set is asserted. */
     assert(adsl.infoRows>=4&&adsl.infoLabels.some(l=>l.toLowerCase()==='dsl driver version'),'ADSL info rows: '+JSON.stringify(adsl.infoLabels));
     assert(adsl.infoValue&&adsl.infoValue.align==='right','ADSL info values not right aligned: '+JSON.stringify(adsl.infoValue));
     assert(adsl.infoChrome&&adsl.infoChrome.bg==='rgba(0, 0, 0, 0)'&&adsl.infoChrome.outline==='none'&&adsl.infoChrome.margin==='0px','ADSL info table still carded: '+JSON.stringify(adsl.infoChrome));
     assert.deepEqual(adsl.headCells.slice(0,3).map(c=>c.text),['Reading','Downstream','Upstream'],'ADSL matrix header: '+JSON.stringify(adsl.headCells));
     assert(adsl.matrixCols===3,'ADSL matrix columns: '+JSON.stringify(adsl.matrixCols));
     assert(adsl.nativeRows>=2,'ADSL native tables missing: '+JSON.stringify(adsl.nativeRows));
     if(width<850){
      assert.equal(adsl.layoutDisplay,'block','ADSL phone layout display: '+adsl.layoutDisplay);
      assert(Math.abs(adsl.summary.x-adsl.info.x)<=1&&adsl.info.y>adsl.summary.b,'ADSL phone panels not stacked: '+JSON.stringify({s:adsl.summary,i:adsl.info}));
      assert(adsl.stats.y>adsl.info.b,'ADSL phone stats not below panels: '+JSON.stringify({i:adsl.info,s:adsl.stats}));
      assert(adsl.summary.w>width-60&&adsl.stats.w>width-60,'ADSL phone panel width: '+JSON.stringify({s:adsl.summary,st:adsl.stats}));
      assert.equal(adsl.headDisplay,'table-row','ADSL phone matrix header hidden: '+adsl.headDisplay);
      assert(adsl.headCells.every(c=>c.display==='table-cell'&&c.box.w>0),'ADSL phone matrix header cells: '+JSON.stringify(adsl.headCells));
      assert(adsl.matrixFont&&adsl.matrixFont.display==='table-cell'&&adsl.matrixFont.font==='11px','ADSL phone matrix cells: '+JSON.stringify(adsl.matrixFont));
      assert(adsl.micro==='none','ADSL phone matrix label badge: '+JSON.stringify(adsl.micro));
      assert(adsl.rowPitch>=47&&adsl.rowPitch<=49,'ADSL phone summary pitch: '+JSON.stringify(adsl.rowPitch));
     }else{
      assert.equal(adsl.layoutDisplay,'grid','ADSL desktop layout display: '+adsl.layoutDisplay);
      assert(Math.abs(adsl.summary.y-adsl.info.y)<=1,'ADSL desktop panels not in one row: '+JSON.stringify({s:adsl.summary,i:adsl.info}));
      assert(Math.abs(adsl.summary.w-adsl.info.w)<=1.5,'ADSL desktop panels unequal: '+JSON.stringify({s:adsl.summary.w,i:adsl.info.w}));
      assert(Math.abs((adsl.info.x-(adsl.summary.x+adsl.summary.w))-22)<=1,'ADSL desktop panel gap: '+JSON.stringify({gap:adsl.info.x-(adsl.summary.x+adsl.summary.w)}));
      assert(adsl.stats.y>=Math.max(adsl.summary.b,adsl.info.b)&&Math.abs(adsl.stats.w-adsl.layout.w)<=1,'ADSL desktop stats card: '+JSON.stringify({st:adsl.stats,l:adsl.layout}));
      assert(adsl.rowPitch>=46&&adsl.rowPitch<=50,'ADSL desktop summary pitch: '+JSON.stringify(adsl.rowPitch));
      assert(adsl.badgeBox&&Math.abs((adsl.summary.x+adsl.summary.w-20)-adsl.badgeBox.r)<=2,'ADSL desktop badge not on the value edge: '+JSON.stringify({badge:adsl.badgeBox,s:adsl.summary}));
      assert(adsl.matrixFont&&adsl.matrixFont.font==='13px','ADSL desktop matrix font: '+JSON.stringify(adsl.matrixFont));
      assert(adsl.matrixPitch>=44&&adsl.matrixPitch<=50,'ADSL desktop matrix pitch: '+JSON.stringify(adsl.matrixPitch));
      assert(adsl.headCells.every(c=>c.font==='11px'&&c.colour==='rgb(165, 184, 209)'),'ADSL header type: '+JSON.stringify(adsl.headCells));
      assert(adsl.statsChrome&&parseFloat(adsl.statsChrome.border)>=1&&parseFloat(adsl.statsChrome.radius)>=10,'ADSL stats table chrome: '+JSON.stringify(adsl.statsChrome));
      assert(adsl.scrollChrome&&adsl.scrollChrome.padding==='0px'&&adsl.scrollChrome.margin==='0px'&&adsl.scrollChrome.bg==='rgba(0, 0, 0, 0)','ADSL scroll wrapper chrome: '+JSON.stringify(adsl.scrollChrome));
      assert(adsl.headCells[1].box.x>adsl.stats.x+adsl.stats.w*.35&&adsl.headCells[2].box.x>adsl.stats.x+adsl.stats.w*.6,'ADSL matrix column positions: '+JSON.stringify(adsl.headCells.map(c=>c.box)));
     }
     const refresh=await page.evaluate(()=>{
      const btn=[...document.querySelectorAll('tr.apply_gen input[type="button"], tr.apply_gen input[type="submit"], tr.apply_gen button')].find(b=>getComputedStyle(b).display!=='none');
      if(!btn)return null;
      const r=btn.getBoundingClientRect(),cell=btn.closest('td'),form=btn.closest('form');
      const rb=e=>{const x=e.getBoundingClientRect();return {x:+x.x.toFixed(1),w:+x.width.toFixed(1),r:+x.right.toFixed(1)};};
      const chain=[];for(let e=cell;e&&chain.length<7;e=e.parentElement){const b=e.getBoundingClientRect();chain.push({tag:e.tagName,cls:String(e.className).slice(0,24),disp:getComputedStyle(e).display,w:+b.width.toFixed(1),x:+b.x.toFixed(1),cols:e.cells?e.cells.length:null});}
      return {btn:rb(btn),cell:cell?rb(cell):null,form:form?rb(form):null,colspan:cell?cell.colSpan:null,chain,vw:innerWidth,label:(btn.value||btn.textContent||'').trim()};
     });
     if(process.env.OPENDSL_QA_DEBUG)console.log('ADSL-REFRESH',width,JSON.stringify(refresh));
     assert(refresh,'ADSL refresh control missing');
     if(width<850)assert(refresh.btn.w>=width-44&&refresh.btn.x>=15&&refresh.btn.r<=width-15,'ADSL refresh not full width at '+width+': '+JSON.stringify(refresh));
     else{
      assert(refresh.btn.w<Math.min(420,width*.45),'ADSL refresh too wide on desktop: '+JSON.stringify(refresh));
      assert(Math.abs(refresh.btn.r-refresh.form.r)<2,'ADSL refresh not on the content right edge: '+JSON.stringify(refresh));
     }
     geometryEvidence.refresh.push({width,...refresh});
    }
if(url==='/Advanced_QOSUserPrio_Content.asp'){
     const qos=await page.evaluate(()=>{
      const groups=[...document.querySelectorAll('.od-qos-group')];
      const boxes=groups.map(g=>{const r=g.getBoundingClientRect(),cs=getComputedStyle(g);return {x:r.x,y:r.y,w:r.width,h:r.height,radius:cs.borderRadius,thead:g.querySelector('thead')?getComputedStyle(g.querySelector('thead')).display:null};});
      const labels=[...document.querySelectorAll('.od-qos-field-label')];
      const vis=labels.filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0);
      const sels=[...document.querySelectorAll('.od-qos-upload select, .od-qos-download select')];
      const current=[...document.querySelectorAll('.od-qos-current')].map(c=>getComputedStyle(c).display);
      return {boxes,labels:labels.length,visible:vis.length,selects:sels.length,current,names:{upload:sels.filter(s=>/^upload/.test(s.name)).map(s=>s.name),download:sels.filter(s=>/^download/.test(s.name)).map(s=>s.name)},aria:sels.map(s=>({name:s.name,ids:(s.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).length}))};
     });
     assert.equal(qos.boxes.length,2,'QoS bandwidth groups missing: '+JSON.stringify(qos));
     assert.equal(qos.labels,25,'QoS captions total: '+qos.labels);
     assert.equal(qos.selects,15,'QoS selects total: '+qos.selects);
     assert.equal(qos.names.upload.length,10,'QoS upload select names: '+JSON.stringify(qos.names));
     assert.equal(qos.names.download.length,5,'QoS download select names: '+JSON.stringify(qos.names));
     assert(qos.aria.every(a=>a.ids>=2),'QoS control accessible names: '+JSON.stringify(qos.aria));
     if(width<850){
      /* The approved phone drawing has no Current-settings column: 10 upload
         captions (min+max) plus 5 download captions stay visible. */
      assert.equal(qos.visible,15,'QoS phone captions: '+JSON.stringify(qos));
      assert(qos.current.length===10&&qos.current.every(d=>d==='none'),'QoS phone current-settings column visible: '+JSON.stringify(qos.current));
      assert(qos.boxes.every(b=>b.w>=width-56&&b.x<=40&&b.thead==='none'),'QoS phone groups not full width / header: '+JSON.stringify(qos.boxes));
      assert(Math.abs(qos.boxes[0].y-qos.boxes[1].y)>60,'QoS phone groups not stacked: '+JSON.stringify(qos.boxes));
     }else{
      assert.equal(qos.visible,0,'QoS desktop captions duplicate headers: '+JSON.stringify(qos));
      assert(qos.current.length===10&&qos.current.every(d=>d!=='none'),'QoS desktop current-settings column hidden: '+JSON.stringify(qos.current));
      assert(qos.boxes.every(b=>b.w>width*.55&&b.thead!=='none'),'QoS desktop groups not full width / header hidden: '+JSON.stringify(qos.boxes));
      assert(Math.abs(qos.boxes[0].y-qos.boxes[1].y)>60,'QoS desktop groups not stacked: '+JSON.stringify(qos.boxes));
     }
   }
   if(url==='/QIS_wizard.asp'&&width<850){
     const host=await page.evaluate(()=>{
      const b=getComputedStyle(document.body);
      const table=[...document.querySelectorAll('body.LevelQIS > table')].find(t=>t.getBoundingClientRect().width>0);
      const t1=document.getElementById('t1');
      const frame=document.getElementById('contentM');
      const skip=document.getElementById('btn_gotoindex');
      const head=document.querySelector('.od-page-head');
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom};};
      return {padL:parseFloat(b.paddingLeft),padR:parseFloat(b.paddingRight),table:table?box(table):null,tab:t1?box(t1):null,frame:frame?box(frame):null,
       skip:skip?{...box(skip),border:getComputedStyle(skip).borderBottomWidth}:null,head:head?box(head):null};
     });
     assert.equal(host.padL,20,'wizard phone left gutter: '+JSON.stringify(host));
     assert.equal(host.padR,20,'wizard phone right gutter: '+JSON.stringify(host));
     assert(host.table&&Math.abs(host.table.x-20)<=1&&Math.abs(host.table.w-(width-40))<=2,'wizard table does not span the gutter column: '+JSON.stringify(host));
     assert(host.tab&&Math.abs(host.tab.x-20)<=1,'wizard stage tab misaligned: '+JSON.stringify(host));
     assert(host.frame&&host.frame.x>host.table.x&&host.frame.r<host.table.r&&host.frame.w>host.table.w-80,'wizard frame misaligned: '+JSON.stringify(host));
     assert(Math.abs((host.frame.x+host.frame.r)/2-(host.table.x+host.table.r)/2)<=2,'wizard frame off centre: '+JSON.stringify(host));
     // Native .m_qis_r is 53px tall; at phone it is a fixed header link, so its
     // spare height plus separator border read as an empty rounded field.
     assert(host.skip&&host.skip.border==='0px','wizard phone skip control has stray frame: '+JSON.stringify(host));
     assert(host.skip&&host.table&&host.skip.b<host.table.y,'wizard phone skip control spills into the page content: '+JSON.stringify(host));
   }
   if(url==='/QIS_wizard.asp'&&width>=851){
     const host=await page.evaluate(()=>{const table=[...document.querySelectorAll('body.LevelQIS > table')].find(t=>t.getBoundingClientRect().width>0);const frame=document.getElementById('contentM');const skip=document.getElementById('btn_gotoindex');const b=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,right:r.right,top:r.top};};const sb=skip?b(skip):null;return {table:b(table),frame:b(frame),vw:innerWidth,skipBorder:skip?getComputedStyle(skip).borderBottomWidth:null,skipPos:skip?getComputedStyle(skip).position:null,skipH:skip?skip.getBoundingClientRect().height:null,skipRight:sb?innerWidth-sb.right:null,skipTop:sb?sb.top:null,skipColor:skip?getComputedStyle(skip).color:null};});
     assert(host.table.w>0,'wizard desktop grid missing: '+JSON.stringify(host));
     assert(Math.abs(host.table.w-650)<=2,'wizard desktop card width: '+JSON.stringify(host));
     assert(Math.abs(host.table.x-(host.vw-host.table.w)/2)<=2,'wizard desktop card not centred: '+JSON.stringify(host));
     assert(host.frame.w<host.table.w&&host.frame.x>host.table.x&&host.frame.right<host.table.right,'wizard desktop frame outside card: '+JSON.stringify(host));
     assert(Math.abs((host.frame.x+host.frame.right)/2-(host.table.x+host.table.right)/2)<=2,'wizard desktop frame off centre: '+JSON.stringify(host));
     /* The approved desktop drawing (QIS_wizard.svg) puts a plain muted
        "Skip setup" link at x1400 baseline 50 — no separator row. */
     assert.equal(host.skipBorder,'0px','wizard desktop skip keeps the legacy separator: '+JSON.stringify(host));
     assert.equal(host.skipPos,'fixed','wizard desktop skip not pinned top-right: '+JSON.stringify(host));
     assert(host.skipRight>=16&&host.skipRight<=48&&host.skipTop<=44,'wizard desktop skip off the drawn corner: '+JSON.stringify(host));
     assert(host.skipH<=34,'wizard desktop skip row retains native 53px height: '+JSON.stringify(host));
   }
   if(['/qis/QIS_ipoa_cfg_tmp.asp','/qis/QIS_mer_cfg_tmp.asp'].includes(url)){
     const child=await page.evaluate(()=>{
      const b=getComputedStyle(document.body);
      const title=document.querySelector('.description_down');
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right};};
      const inp=document.querySelector('.input_15_table input[type="text"]');
      const fs=document.querySelector('fieldset');
      const addr=document.querySelector('.IPaddr');
      const octets=addr?[...addr.querySelectorAll('input')].map(box):null;
      const dhcp=document.getElementById('dhcp_opt_table');
      return {padL:parseFloat(b.paddingLeft),padR:parseFloat(b.paddingRight),padT:parseFloat(b.paddingTop),title:title?box(title):null,titleAlign:title?getComputedStyle(title).textAlign:null,input:inp?box(inp):null,addr:addr?box(addr):null,octets,dhcp:dhcp?box(dhcp):null,fieldset:fs?{border:getComputedStyle(fs).borderTopWidth,legend:fs.querySelector('legend')?getComputedStyle(fs.querySelector('legend')).fontSize:null}:null,vw:innerWidth};
     });
     assert(['left','start','-webkit-left'].includes(child.titleAlign),'QIS child title inherited the template right-align: '+JSON.stringify(child));
     if(width<850){
      assert.equal(child.padL,20,'QIS child phone left gutter: '+JSON.stringify(child));
      assert.equal(child.padR,20,'QIS child phone right gutter: '+JSON.stringify(child));
      assert(child.padT>=8,'QIS child phone top padding missing: '+JSON.stringify(child));
      assert(child.title&&child.title.x>=19&&child.title.y>=0&&child.title.r<=width-19,'QIS child title clipped: '+JSON.stringify(child));
      if(child.input)assert(child.input.x>=19&&child.input.r<=width-19,'QIS child field clipped: '+JSON.stringify(child));
     }
     if(child.octets){
      assert.equal(child.octets.length,4,'QIS split field octet count: '+JSON.stringify(child));
      assert(child.octets.every(o=>o.w>=40&&o.h>=40&&o.x>=19&&o.r<=width-19),'QIS split field octet clipped: '+JSON.stringify(child));
      assert.equal(new Set(child.octets.map(o=>Math.round(o.y))).size,1,'QIS split octets wrap instead of staying on one line: '+JSON.stringify(child));
      assert(child.addr&&child.addr.r<=width-19,'QIS split field frame clipped: '+JSON.stringify(child));
     }
     if(child.dhcp)assert(child.dhcp.x>=19&&child.dhcp.r<=width-19,'QIS option table outside gutters: '+JSON.stringify(child));
     if(child.fieldset){
      assert.equal(parseFloat(child.fieldset.border),0,'QIS child fieldset frame remains: '+JSON.stringify(child.fieldset));
      if(child.fieldset.legend)assert.equal(child.fieldset.legend,'16px','QIS child legend size: '+JSON.stringify(child.fieldset));
     }
   }
   if(url==='/Main_Password.asp'){
    for(const name of ['http_username_x','http_passwd_x','http_passwd_2_x','btn_modify'])assert(await page.locator('[name="'+name+'"]').isVisible(),'password control hidden: '+name);
    const title=await page.locator('.title_name').boundingBox(),copy=await page.locator('.p1').boundingBox();assert(copy.y>=title.y+title.height,'password title overlaps copy');
   }
    if(url==='/QIS_wizard.asp'){
     assert(await page.locator('#btn_gotoindex').isVisible());
     const nav=await page.locator('#btn_gotoindex').boundingBox(),frame=await page.locator('#contentM').boundingBox();
     if(width<850)assert(frame.y>=nav.y+nav.height,'setup frame overlaps wizard navigation');
     assert(frame.width>Math.min(499,width*.7),'setup frame too narrow');
     const qis=await page.locator('#contentM').evaluate(f=>{
      const d=f.contentDocument; if(!d||!d.body) return null;
      const btns=[...d.querySelectorAll('input[type="button"],input[type="submit"],button')];
      const next=btns.find(b=>/^(next|continue|start|finish|done)$/i.test((b.value||b.textContent||'').trim()));
      if(!next)return {ok:false,reason:'no-next'};
      const r=next.getBoundingClientRect();
      return {ok:true,fh:f.clientHeight,top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),bodyH:d.body.scrollHeight,primary:next.classList.contains('od-primary')};
     });
     assert(qis&&qis.ok,'QIS Next absent inside frame');
     assert(qis.top>=0&&qis.bottom<=qis.fh+1,'QIS Next hidden inside frame: '+JSON.stringify(qis));
     assert(qis.primary,'QIS Next not primary: '+JSON.stringify(qis));
    }
   /* Host-plus-child alignment: load every QIS child inside the production
      wizard host and compare its heading to the first field/action. */
   if(url==='/QIS_wizard.asp'){
     await page.evaluate(()=>{document.getElementById('contentM').src='about:blank';});
     await page.waitForTimeout(150);
     for(const child of ['/qis/QIS_admin_pass.asp','/qis/QIS_ipoa_cfg_tmp.asp','/qis/QIS_mer_cfg_tmp.asp']){
      await page.evaluate(src=>{document.getElementById('contentM').src=src;},child);
      await page.waitForFunction(src=>{const f=document.getElementById('contentM');try{return f.contentWindow.location.pathname===src;}catch(e){return false;}},child,{timeout:5000});
      await page.waitForTimeout(350);
      const align=await page.locator('#contentM').evaluate(f=>{
       const d=f.contentDocument,main=d&&d.querySelector('.QISmain');
       if(!main)return {missing:true};
       const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1)};};
       const title=main.querySelector('.description_down');
       const field=main.querySelector('input[type="text"]:not([type="hidden"]),input[type="password"],select,textarea');
       const action=[...main.querySelectorAll('input[type="button"],input[type="submit"],button')].find(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0);
       const textX=title?(()=>{const range=d.createRange();range.selectNodeContents(title);const r=range.getBoundingClientRect();return +r.x.toFixed(1);})():null;
       return {title:title?b(title):null,textX,margin:title?getComputedStyle(title).marginLeft:null,pad:title?getComputedStyle(title).paddingLeft:null,main:b(main),parent:title&&title.parentElement?b(title.parentElement):null,field:field?b(field):null,action:action?b(action):null};
      });
      if(process.env.OPENDSL_QA_DEBUG)console.log('QIS-ALIGN',width,child,JSON.stringify(align));
      assert(!align.missing&&align.title,'QIS host heading missing for '+child+' @'+width+': '+JSON.stringify(align));
      assert.equal(align.margin,'0px','QIS heading left margin remains for '+child+' @'+width+': '+JSON.stringify(align));
      assert.equal(align.pad,'0px','QIS heading left padding remains for '+child+' @'+width+': '+JSON.stringify(align));
      assert(align.parent,'QIS host child has no form grid for '+child+' @'+width);
      assert(Math.abs(align.textX-align.parent.x)<=2,'QIS heading off the form grid for '+child+' @'+width+': '+JSON.stringify(align));
      if(align.field&&align.field.x<=align.parent.x+4)assert(Math.abs(align.textX-align.field.x)<=2,'QIS heading off the field edge for '+child+' @'+width+': '+JSON.stringify(align));
      geometryEvidence.qis.push({width,child,...align});
      if(width===390)await page.screenshot({path:path.join(out,'qis-'+child.split('/').pop().replace('.asp','')+'-390.png'),fullPage:true});
     }
    }
    if(url==='/Advanced_ASUSDDNS_Content.asp'){
     assert.equal(data.pageTitle,'Dynamic DNS','DDNS title mismatch');
     assert(data.primaryButtons>=1,'DDNS has no primary action');
     await page.waitForTimeout(400);
     const bg=await page.evaluate(()=>{const e=document.querySelector('.od-primary');return e?getComputedStyle(e).backgroundColor:null;});
     assert.equal(bg,'rgb(35, 128, 251)','DDNS primary not blue: '+bg);
     assert(!await page.locator('#wan_ip_hide2').isVisible(),'fixture default must hide DDNS warning2');
     assert(!await page.locator('#wan_ip_hide3').isVisible(),'fixture default must hide DDNS guidance');
     if(width>=1201){
      // Server row keeps table-cell semantics: its right edge and divider
      // align with the table's inner right edge, and the select shares the
      // control column's left edge with adjacent fields.
      const row=await page.evaluate(()=>{
       const cell=document.querySelector('td:has(> .od-control-with-helper)');
       const table=cell.closest('.FormTable');
       const tr=cell.closest('tr');
       const wrapper=cell.querySelector('.od-control-with-helper');
       const sel=wrapper.querySelector('select');
       const other=document.querySelector('.FormTable td .od-full, .FormTable td select.od-full, .FormTable td input[type="text"].od-full');
       const r=e=>{const b=e.getBoundingClientRect();return {left:+b.left.toFixed(1),right:+b.right.toFixed(1),top:+b.top.toFixed(1)};};
       return {cell:r(cell),table:r(table),tr:r(tr),sel:r(sel),other:other?r(other):null,wrapper:r(wrapper)};
      });
      assert.equal(Math.abs(row.cell.right-row.table.right)<=2,true,'DDNS server value cell right edge must align with table inner right: '+JSON.stringify(row));
      assert.equal(Math.abs(row.sel.left-row.other.left)<=2,true,'DDNS server select left edge must align with the control column: '+JSON.stringify(row));
      assert.equal(Math.abs(row.wrapper.left-row.other.left)<=2,true,'DDNS server wrapper left edge must align with the control column: '+JSON.stringify(row));
      assert.equal(Math.abs(row.sel.right-row.wrapper.right)<=2||row.sel.right<=row.wrapper.right+2,true,'DDNS select must fit the wrapper: '+JSON.stringify(row));
     }
    }
   results.push({url,width,...data});
   // Let embedded frames settle before the capture so screenshots are stable.
   // Return to the top so sticky bars are not painted at the focus-scroll offset.
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.waitForTimeout(250);
   if(/^\/Main_(?:LogStatus|WStatus|RouteStatus|ConnStatus)_Content\.asp$/.test(url)){
    const frame=page.frames().find(f=>/\/cgi-bin\/status_(?:log2|wifi|route|conn)\.cgi/.test(f.url()));
    assert(frame,'diagnostic frame missing for '+url+'@'+width);
    const diag=await frame.evaluate(()=>{
     const t=document.getElementById('textarea'),cs=t&&getComputedStyle(t),bs=getComputedStyle(document.body);
     return {styled:!!document.getElementById('od-diagnostic-frame-style'),textarea:!!t,
      fontSize:cs&&parseFloat(cs.fontSize),bg:cs&&cs.backgroundColor,radius:cs&&cs.borderTopLeftRadius,
      bodyBg:bs.backgroundColor,height:t?t.getBoundingClientRect().height:0,
      width:t?t.getBoundingClientRect().width:0,scrollWidth:t?t.scrollWidth:0};
    });
    assert(diag.styled&&diag.textarea,'diagnostic frame not themed for '+url+'@'+width+': '+JSON.stringify(diag));
    assert(diag.fontSize<=13&&diag.bg==='rgb(18, 24, 32)'&&diag.bodyBg==='rgb(15, 20, 27)','diagnostic frame retains legacy presentation for '+url+'@'+width+': '+JSON.stringify(diag));
    assert(diag.height<=470&&diag.width>0,'diagnostic frame has invalid geometry for '+url+'@'+width+': '+JSON.stringify(diag));
   }
   await page.screenshot({path:path.join(out,url.slice(1).replaceAll('/','-')+'-'+width+'.png'),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/Advanced_Wireless_Content.asp');
   assert.equal(await page.locator('input[type="text"]').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   await page.close();
  }
  {
   // Privacy notice: the page has no settings table, so the native FormTitle
   // block is drawn as the single R6 card. The withdrawal panels are native
   // conditional states; reveal both the way initial() does when both EULAs
   // are accepted and verify they keep their native buttons and copy.
   const privacySource=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/Advanced_Privacy.asp'),'utf8');
   assert(/withdraw_eula\('asus'\)/.test(privacySource)&&/withdraw_eula\('tm'\)/.test(privacySource),'native privacy withdrawal handlers changed in source');
   const privacyPage=await browser.newPage({viewport:{width:1440,height:1000}});
   await privacyPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await privacyPage.goto(base+'/Advanced_Privacy.asp',{waitUntil:'load'});await privacyPage.waitForTimeout(250);
   const privacy=await privacyPage.evaluate(()=>{
    const f=document.getElementById('FormTitle');
    const desc=document.getElementById('privacy_desc');
    const title=f.querySelector('.od-card-title');
    const box=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),w:+r.width.toFixed(1),y:+r.y.toFixed(1)};};
    const nested=[...f.querySelectorAll('*')].filter(e=>parseFloat(getComputedStyle(e).borderTopWidth)>0&&e.getBoundingClientRect().height>0).map(e=>e.id||String(e.className)||e.tagName);
    return {card:box(f),titled:!!title,title:title?title.textContent.trim():null,desc:getComputedStyle(desc).display,
     nested,radius:getComputedStyle(f).borderTopLeftRadius};
   });
   assert(privacy.titled&&privacy.title==='Privacy notice'&&privacy.desc!=='none','privacy card or description lost: '+JSON.stringify(privacy));
   assert.equal(privacy.nested.length,0,'privacy card nests another bordered box: '+JSON.stringify(privacy.nested));
   geometryEvidence.privacy={default:privacy};
   await privacyPage.evaluate(()=>{
    document.getElementById('privacy_desc').style.display='none';
    document.getElementById('asus_eula').style.display='';
    document.getElementById('tm_eula').style.display='';
   });
   await privacyPage.waitForTimeout(120);
   const withdraw=await privacyPage.evaluate(()=>({
    asus:document.getElementById('asus_eula').getBoundingClientRect().height>0,
    tm:document.getElementById('tm_eula').getBoundingClientRect().height>0,
    buttons:[...document.querySelectorAll('#FormTitle input[name="asus_withdraw_btn"]')].map(b=>({type:b.type,value:b.value,visible:b.getBoundingClientRect().height>0})),
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   assert(withdraw.asus&&withdraw.tm,'privacy withdrawal panels hidden after reveal: '+JSON.stringify(withdraw));
   assert.equal(withdraw.buttons.length,2,'privacy withdrawal buttons lost: '+JSON.stringify(withdraw.buttons));
   assert(withdraw.buttons.every(b=>b.type==='button'&&b.visible),'privacy withdrawal button changed: '+JSON.stringify(withdraw.buttons));
   assert(withdraw.overflow<=0,'privacy withdrawal state overflows: '+JSON.stringify(withdraw));
   await privacyPage.screenshot({path:path.join(out,'privacy-eula-1440.png'),fullPage:true});
   geometryEvidence.privacy.eula=withdraw;
   await privacyPage.close();
  }
  if(!process.env.OPENDSL_QA_FILTER){
   // 2026-10-25 screenshot-correction regressions. These target the actual
   // runtime geometry and native DOM shape; they do not accept screenshots
   // alone as evidence.
   const checkPage=await browser.newPage({viewport:{width:1440,height:1000}});
   await checkPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   const open=async(url,width=1440)=>{await checkPage.setViewportSize({width,height:1000});await checkPage.goto(base+url,{waitUntil:'load'});await checkPage.waitForTimeout(450);};
   /* SFR-02..04: traffic counters are native empty cells that polling fills.
      Update the native leaf nodes (not the cells) so their ids and update
      path stay intact, exactly as ref.refresh() would. */
   const trafficIds=['rx-current','rx-avg','rx-max','rx-total','tx-current','tx-avg','tx-max','tx-total'];
   const setTraffic=async values=>{
    await checkPage.evaluate(({ids,values})=>{ids.forEach((id,i)=>{const node=document.getElementById(id);if(node)node.textContent=values[i]||'';});},{ids:trafficIds,values});
    await checkPage.waitForTimeout(120);
   };
   const trafficState=()=>checkPage.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return{x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2),right:+r.right.toFixed(2)};};
    const shown=e=>!!(e&&getComputedStyle(e).display!=='none'&&e.getClientRects().length);
    const readings=document.querySelector('table.FormTable_NWM');
    if(!readings)return{missing:true};
    const head=readings.querySelector('tr.od-tm-readings-head');
    const legend=document.querySelector('table.DescTable');
    return {
     headerRows:[...readings.querySelectorAll('tbody > tr')].filter(tr=>tr.querySelector('th[scope="col"]')).length,
     header:head?[...head.querySelectorAll('th')].map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),scope:e.getAttribute('scope'),box:box(e)})):null,
     rows:[...readings.querySelectorAll('tr.od-tm-readings-row')].map(row=>{
      const dir=row.querySelector('th.od-tm-readings-direction');
      return {direction:dir&&dir.textContent.replace(/\s+/g,' ').trim(),scope:dir&&dir.getAttribute('scope'),shown:shown(row),
       cells:[...row.querySelectorAll('td')].map(cell=>({id:cell.id||(cell.querySelector('[id]')||{}).id||null,label:cell.getAttribute('data-od-label'),before:getComputedStyle(cell,'::before').content,text:cell.textContent.replace(/\s+/g,' ').trim(),shown:shown(cell),box:box(cell)}))};
     }),
     emptyShown:shown(readings.querySelector('.od-tm-empty-row')),
     emptyNote:shown(document.querySelector('.od-tm-empty-graph')),
     legendDisplay:legend?getComputedStyle(legend).display:null,
     legendGrid:legend?[...legend.querySelectorAll('tbody > tr')].map(r=>getComputedStyle(r).gridTemplateColumns):[],
     legendHeads:legend?[...legend.querySelectorAll('.od-tm-legend-head')].map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),shown:shown(e),box:box(e)})):[],
     legendValues:legend?[...legend.querySelectorAll('.od-tm-legend-value')].map(e=>{
      const words=[],walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
      while((n=walk.nextNode()))for(const match of n.textContent.matchAll(/\S+/g)){
       const range=document.createRange();range.setStart(n,match.index);range.setEnd(n,match.index+match[0].length);
       words.push({text:match[0],w:+range.getBoundingClientRect().width.toFixed(2)});
      }
      return {text:e.textContent.replace(/\s+/g,' ').trim(),shown:shown(e),box:box(e),scroll:e.scrollWidth,client:e.clientWidth,wrap:getComputedStyle(e).overflowWrap,wordBreak:getComputedStyle(e).wordBreak,words};
     }):[],
     directionLabels:legend?[...legend.querySelectorAll('.od-tm-legend-label')].map(e=>e.textContent.replace(/\s+/g,' ').trim()):[],
     ids:['rx-current','rx-avg','rx-max','rx-total','tx-current','tx-avg','tx-max','tx-total'].map(id=>!!document.getElementById(id)),
     overflow:document.documentElement.scrollWidth-innerWidth
    };
   });
   const assertTrafficHeader=(state,where)=>{
    assert(state.header&&state.headerRows===1,'traffic header is not exactly one row at '+where+': '+JSON.stringify({header:state.header,headerRows:state.headerRows}));
    assert.deepEqual(state.header.map(c=>c.text),['Traffic','Current','Average','Maximum','Total'],'traffic header labels changed at '+where+': '+JSON.stringify(state.header));
    assert(state.header.every(c=>c.scope==='col'),'traffic header lost scope=col at '+where+': '+JSON.stringify(state.header));
   };
   const assertTrafficEmpty=(state,where)=>{
    assertTrafficHeader(state,where);
    assert(state.rows.length===2&&state.rows.every(r=>!r.shown),'empty traffic rows still paint at '+where+': '+JSON.stringify(state.rows));
    assert.equal(state.emptyShown,true,'empty traffic state row missing at '+where+': '+JSON.stringify(state));
    assert.equal(state.emptyNote,true,'empty traffic chart note missing at '+where+': '+JSON.stringify(state));
    assert.equal(state.legendDisplay,'none','empty traffic legend still paints at '+where+': '+JSON.stringify(state.legendDisplay));
    assert(state.ids.every(Boolean),'traffic counter ids were removed at '+where+': '+JSON.stringify(state.ids));
    assert.equal(state.overflow,0,'empty traffic page overflows at '+where);
   };
   const assertTrafficFilled=(state,values,where,phone)=>{
    assertTrafficHeader(state,where);
    assert.equal(state.rows.length,2,'traffic direction rows changed at '+where+': '+JSON.stringify(state.rows));
    assert.deepEqual(state.rows.map(r=>r.direction),['Reception','Transmission'],'traffic direction labels changed at '+where+': '+JSON.stringify(state.rows.map(r=>r.direction)));
    assert(state.rows.every(r=>r.scope==='row'&&r.shown),'traffic direction row is hidden or not a row header at '+where+': '+JSON.stringify(state.rows));
    state.rows.forEach((row,ri)=>{
     assert.equal(row.cells.length,4,'traffic value count changed at '+where+': '+JSON.stringify(row));
     assert(row.cells.every(c=>c.shown&&c.id),'traffic counter missing or hidden at '+where+': '+JSON.stringify(row.cells));
     row.cells.forEach((cell,ci)=>{
      assert.equal(cell.text,values[ri*4+ci],'traffic counter value/association wrong at '+where+': '+JSON.stringify(cell));
      assert.equal(cell.label,state.header[ci+1].text,'traffic counter is not labelled with its column at '+where+': '+JSON.stringify({cell,header:state.header[ci+1]}));
      if(phone)assert((cell.before||'').replace(/^["']|["']$/g,'')===cell.label,'traffic phone counter does not show its column label at '+where+': '+JSON.stringify(cell));
      else assert(Math.abs(cell.box.x-state.header[ci+1].box.x)<=1.5&&Math.abs(cell.box.w-state.header[ci+1].box.w)<=1.5,'traffic counter is misaligned with its header at '+where+': '+JSON.stringify({cell,header:state.header[ci+1]}));
     });
    });
    assert.equal(state.emptyShown,false,'empty traffic row still paints when counters are filled at '+where);
    assert.equal(state.emptyNote,false,'empty traffic chart note still paints when counters are filled at '+where);
    assert.notEqual(state.legendDisplay,'none','traffic legend hidden with populated counters at '+where);
    assert.equal(state.legendHeads.filter(h=>h.shown).length,3,'traffic legend headings missing at '+where+': '+JSON.stringify(state.legendHeads));
    assert.equal(state.legendValues.filter(v=>v.shown).length,6,'traffic legend values missing at '+where+': '+JSON.stringify(state.legendValues));
    assert.equal(state.overflow,0,'populated traffic page overflows at '+where);
   };
   const trafficValues=['1.5 Mbps','1.2 Mbps','3.4 Mbps','5.6 Mbps','0.8 Mbps','0.6 Mbps','1.1 Mbps','2.2 Mbps'];
   const trafficValuesUpdated=['9.9 Mbps','1.2 Mbps','3.4 Mbps','5.6 Mbps','0.8 Mbps','0.6 Mbps','1.1 Mbps','4.4 Mbps'];
   // The native handlers are inline and stripped from the host fixture; attach
   // their exact source text for the reveal/hide regression.
   const extractFunction=(source,signature)=>{
    const start=source.indexOf(signature);
    if(start<0)throw new Error('cannot find '+signature);
    const open=source.indexOf('{',start);let depth=0;
    for(let i=open;i<source.length;i++){
     if(source[i]==='{')depth++;
     else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
    }
    throw new Error('unterminated '+signature);
   };
   const switchTypeSource=extractFunction(fs.readFileSync(path.join(ROOT,'overlays/native-english/boaroot/html/state.js'),'utf8'),'function switchType');
   const passCheckedSource=extractFunction(fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/Advanced_System_Content.asp'),'utf8'),'function pass_checked');
   const makeVersion=/^CURRENT_VERSION\s*\?=\s*(\S+)/m.exec(fs.readFileSync(path.join(ROOT,'Makefile'),'utf8'))[1];
   await open('/Advanced_KeywordFilter_Content.asp');
   const keyword=await checkPage.evaluate(()=>({helps:[...document.querySelectorAll('.od-help summary')].map(e=>e.textContent.trim()),
    visible:[...document.querySelectorAll('.od-card-title')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.textContent.trim()),
    hidden:[...document.querySelectorAll('.od-card-title[hidden]')].map(e=>e.textContent.trim())}));
   assert.equal(keyword.helps.length,1,'Keyword filter duplicate help disclosures remain: '+JSON.stringify(keyword));
   assert(!keyword.visible.includes('Keyword Filter'),'Keyword filter orphan heading remains visible: '+JSON.stringify(keyword));
   assert(keyword.hidden.includes('Keyword Filter'),'Keyword filter hidden branch heading lost its state: '+JSON.stringify(keyword));
   await open('/Advanced_IPv6_Content.asp');
   const ipv6=await checkPage.evaluate(()=>({visible:[...document.querySelectorAll('.od-card-title')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.textContent.trim()),
    hidden:[...document.querySelectorAll('.od-card-title[hidden]')].map(e=>e.textContent.trim())}));
   assert.deepEqual(ipv6.visible,['Basic Config'],'IPv6 hidden sections still paint heading bands: '+JSON.stringify(ipv6));
   assert(ipv6.hidden.includes('6rd Config')&&ipv6.hidden.includes('IPv6 LAN Setting')&&ipv6.hidden.includes('IPv6 DNS Setting'),'IPv6 hidden titles not bound: '+JSON.stringify(ipv6));
   await open('/Advanced_DSL_Content.asp');
   const pvc=await checkPage.evaluate(()=>{const t=document.getElementById('ATMPVCTable');const heads=t?[...t.querySelectorAll('tr:nth-child(2) th')]:[];const p=heads.find(e=>/Protocol/i.test(e.textContent));return{t:!!t,matrix:t?t.className:'',protocol:p?p.getBoundingClientRect().width:0,pvc:p?p.getBoundingClientRect().height:0};});
   assert(pvc.t&&/od-matrix/.test(pvc.matrix),'PVC summary table not marked as a matrix: '+JSON.stringify(pvc));
   assert(pvc.protocol>=100,'PVC Protocol column still compressed at desktop: '+JSON.stringify(pvc));
   const mac=await checkPage.evaluate(()=>{const i=document.querySelector('input[name="wan_hwaddr_x"]'),b=i&&i.nextElementSibling;const r=e=>{const x=e.getBoundingClientRect();return{t:x.top,b:x.bottom,l:x.left,w:x.width}};return{i:i?r(i):null,b:b&&b.tagName==='INPUT'?r(b):null};});
   assert(mac.i&&mac.b&&mac.b.t>=mac.i.b+6,'MAC Clone still touches the address field: '+JSON.stringify(mac));
   await open('/Main_TrafficMonitor_realtime.asp');
   const traffic=await checkPage.evaluate(()=>{const h=document.querySelector('.od-page-head'),t=document.querySelector('.formfonttitle'),m=document.getElementById('tabMenu');const r=e=>{const x=e.getBoundingClientRect();return{t:x.top,b:x.bottom,w:x.width,l:x.left}};return{head:h?r(h):null,title:t?r(t):null,tabs:m?r(m):null,cls:document.body.className,area:!!document.getElementById('tab-area')};});
   assert(traffic.head&&traffic.tabs&&traffic.head.b<=traffic.tabs.t+1,'Traffic header collides with its tab strip: '+JSON.stringify(traffic));
   assert(/od-traffic/.test(traffic.cls)&&traffic.area,'Traffic composition class or generated tab host missing: '+JSON.stringify(traffic));
   const trafficTabs=await checkPage.evaluate(()=>{const a=document.getElementById('tab-area');a.innerHTML='<ul id="tabs" class="tabs"><li><a href="javascript:void(0)" id="speed-tab-ATM" style="margin-right: 3px;">ADSL WAN(ATM)</a></li><li><a href="javascript:void(0)" id="speed-tab-WIRED" style="margin-right: 3px;">Wired</a></li><li><a href="javascript:void(0)" id="speed-tab-WIRELESS0" style="margin-right: 3px;">Wireless</a></li></ul><div id="tabs-bottom"></div>';const links=[...a.querySelectorAll('#tabs a')];const cs=links.map(e=>getComputedStyle(e));const ul=getComputedStyle(a.querySelector('#tabs'));return{count:links.length,display:ul.display,wrap:ul.flexWrap,bg:cs.map(c=>c.backgroundImage),radius:cs.map(c=>c.borderRadius),overflow:document.documentElement.scrollWidth-innerWidth};});
   assert.equal(trafficTabs.count,3,'Traffic generated tab links missing: '+JSON.stringify(trafficTabs));
   assert(trafficTabs.display==='flex'&&trafficTabs.wrap==='wrap','Traffic generated tabs are not a wrapping flex row: '+JSON.stringify(trafficTabs));
   assert(trafficTabs.bg.every(v=>v==='none')&&trafficTabs.radius.every(v=>v==='0px'),'Traffic generated tabs retain the legacy gradient/radius: '+JSON.stringify(trafficTabs));
   assert(trafficTabs.overflow<=0,'Traffic generated tabs cause horizontal overflow: '+JSON.stringify(trafficTabs));
   /* SFR-02/03: empty native counters stay in the DOM, then become visible
      with correct headers and directions once polling fills them. */
   const trafficEmpty=await trafficState();
   assertTrafficEmpty(trafficEmpty,'1440 initial');
   await setTraffic(trafficValues);
   const trafficFilled=await trafficState();
   assertTrafficFilled(trafficFilled,trafficValues,'1440 populated');
   assert.deepEqual(trafficFilled.directionLabels,['Reception','Transmission'],'traffic legend direction labels changed: '+JSON.stringify(trafficFilled.directionLabels));
   assert.deepEqual(trafficFilled.legendHeads.filter(h=>h.shown).map(h=>h.text),['Internet','Wired','Wireless'],'traffic legend headings changed: '+JSON.stringify(trafficFilled.legendHeads));
   await setTraffic(trafficValuesUpdated);
   const trafficUpdated=await trafficState();
   assertTrafficFilled(trafficUpdated,trafficValuesUpdated,'1440 updated');
   await setTraffic(['','','','','','','','']);
   const trafficCleared=await trafficState();
   assertTrafficEmpty(trafficCleared,'1440 cleared');
   geometryEvidence.sfrTraffic={empty:trafficEmpty,filled:trafficFilled,updated:trafficUpdated,cleared:trafficCleared};
   /* The tablet width shares the desktop composition but its content column
      is narrower than the table's former intrinsic width. */
   await open('/Main_TrafficMonitor_realtime.asp',1024);
   const tabletEmpty=await trafficState();
   assertTrafficEmpty(tabletEmpty,'1024 initial');
   await setTraffic(trafficValues);
   const tabletFilled=await trafficState();
   assertTrafficFilled(tabletFilled,trafficValues,'1024 populated');
   geometryEvidence.sfrTraffic.tablet={empty:tabletEmpty,filled:tabletFilled};
   /* SFR-04: at phone widths every legend word must fit its own column; a
      zero document overflow alone would still accept mid-word fragments. */
   for(const width of [390,320]){
    await open('/Main_TrafficMonitor_realtime.asp',width);
    const trafficPhone=await checkPage.evaluate(()=>{const h=document.querySelector('.od-page-head'),m=document.getElementById('tabMenu');const r=e=>{const x=e.getBoundingClientRect();return{t:x.top,b:x.bottom,w:x.width}};return{head:h?r(h):null,tabs:m?r(m):null,overflow:document.documentElement.scrollWidth-innerWidth};});
    assert(trafficPhone.head&&trafficPhone.tabs&&trafficPhone.head.b<=trafficPhone.tabs.t+1,'Phone Traffic header collides with its tab strip at '+width+': '+JSON.stringify(trafficPhone));
    assert(trafficPhone.overflow<=0,'Phone Traffic page overflows at '+width+': '+JSON.stringify(trafficPhone));
    const phoneEmpty=await trafficState();
    assertTrafficEmpty(phoneEmpty,width+' initial');
    await setTraffic(trafficValues);
    const phoneFilled=await trafficState();
    assertTrafficFilled(phoneFilled,trafficValues,width+' populated',true);
    const legendValues=phoneFilled.legendValues.filter(v=>v.shown);
    for(const value of legendValues){
     assert(value.box.w>=60,'traffic legend column narrower than a readable word at '+width+': '+JSON.stringify(value));
     assert(value.scroll<=value.client+1,'traffic legend value overflows its column at '+width+': '+JSON.stringify(value));
     assert.equal(value.wrap,'normal','traffic legend still wraps inside words at '+width+': '+JSON.stringify(value));
     assert.equal(value.wordBreak,'normal','traffic legend still breaks words at '+width+': '+JSON.stringify(value));
     for(const word of value.words)assert(word.w<=value.client+0.5,'traffic legend word "'+word.text+'" is wider than its column at '+width+': '+JSON.stringify({value,word}));
    }
    for(const grid of phoneFilled.legendGrid){
     const columns=grid.split(/\s+/).map(v=>parseFloat(v)).filter(Number.isFinite);
     assert.equal(columns.length,3,'traffic legend is not three columns at '+width+': '+grid);
     assert(Math.min(...columns)>=60,'traffic legend column is too narrow at '+width+': '+grid);
    }
    geometryEvidence['sfrTraffic'+width]={empty:phoneEmpty,filled:phoneFilled};
   }
   await open('/Advanced_System_Content.asp');
   const passwordGeometry=()=>checkPage.evaluate(()=>{
    const confirm=document.querySelector('input[name="uiViewTools_PasswordConfirm"]'),first=document.querySelector('input[name="uiViewTools_Password"]'),wrapper=document.querySelector('div:has(> input[name="show_pass_1"])'),checkbox=document.querySelector('input[name="show_pass_1"]');
    const r=e=>{const x=e.getBoundingClientRect();return{l:+x.left.toFixed(1),r:+x.right.toFixed(1),t:+x.top.toFixed(1),b:+x.bottom.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)};};
    return {confirm:r(confirm),first:r(first),wrapper:r(wrapper),display:getComputedStyle(wrapper).display,gap:+(wrapper.getBoundingClientRect().top-confirm.getBoundingClientRect().bottom).toFixed(1),leftDelta:+(wrapper.getBoundingClientRect().left-confirm.getBoundingClientRect().left).toFixed(1),rightDelta:+(wrapper.getBoundingClientRect().right-confirm.getBoundingClientRect().right).toFixed(1),checkbox:r(checkbox),checkboxInForm:!!checkbox.form,formName:checkbox.form&&checkbox.form.name,text:wrapper.textContent.replace(/\s+/g,' ').trim(),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   const assertPasswordGeometry=(p,width)=>{
    assert(p.display==='flex','Show password is not on its own flex line at '+width+': '+JSON.stringify(p));
    assert(p.gap>=6,'Show password overlaps the confirmation field at '+width+': '+JSON.stringify(p));
    assert(Math.abs(p.leftDelta)<=1&&Math.abs(p.rightDelta)<=1,'Show password is not aligned with the confirmation field at '+width+': '+JSON.stringify(p));
    assert(p.checkbox.t>=p.wrapper.t-0.5&&p.checkbox.b<=p.wrapper.b+0.5&&p.checkbox.l>=p.wrapper.l-0.5&&p.checkbox.r<=p.wrapper.r+0.5,'Show password checkbox leaves its line at '+width+': '+JSON.stringify(p));
    assert(p.checkboxInForm&&p.formName==='form','Show password checkbox left the native form at '+width+': '+JSON.stringify(p));
    assert(/show.*password/i.test(p.text),'Show password label missing at '+width+': '+JSON.stringify(p.text));
    assert(p.overflow<=0,'Advanced System page overflows at '+width+': '+JSON.stringify(p.overflow));
   };
   const pw=await passwordGeometry();
   assertPasswordGeometry(pw,1440);
   const pwBehavior=await checkPage.evaluate(({switchType,passChecked})=>{
    var isNotIE=navigator.userAgent.search('MSIE')==-1;
    eval(switchType);eval(passChecked);
    const checkbox=document.querySelector('input[name="show_pass_1"]'),first=document.querySelector('input[name="uiViewTools_Password"]'),confirm=document.querySelector('input[name="uiViewTools_PasswordConfirm"]');
    /* The host fixture strips the native inline onclick; attach its exact
       calls so the shipped reveal/hide functions are what is exercised. */
    checkbox.onclick=function(){pass_checked(first);pass_checked(confirm);};
    first.value='fixture-secret';confirm.value='fixture-secret';
    checkbox.click();
    const shown={first:first.type,confirm:confirm.type,firstValue:first.value,confirmValue:confirm.value,checked:checkbox.checked};
    checkbox.click();
    const hidden={first:first.type,confirm:confirm.type,firstValue:first.value,confirmValue:confirm.value,checked:checkbox.checked};
    return {shown,hidden,firstInForm:first.form===checkbox.form,confirmInForm:confirm.form===checkbox.form,names:[first.name,confirm.name]};
   },{switchType:switchTypeSource,passChecked:passCheckedSource});
   assert.deepEqual(pwBehavior.shown,{first:'text',confirm:'text',firstValue:'fixture-secret',confirmValue:'fixture-secret',checked:true},'Show password does not reveal both fields: '+JSON.stringify(pwBehavior));
   assert.deepEqual(pwBehavior.hidden,{first:'password',confirm:'password',firstValue:'fixture-secret',confirmValue:'fixture-secret',checked:false},'Show password does not hide both fields again: '+JSON.stringify(pwBehavior));
   assert(pwBehavior.firstInForm&&pwBehavior.confirmInForm,'Password fields left the native form: '+JSON.stringify(pwBehavior));
   assert.deepEqual(pwBehavior.names,['uiViewTools_Password','uiViewTools_PasswordConfirm'],'Password field names changed: '+JSON.stringify(pwBehavior.names));
   geometryEvidence.sfrPassword={1440:pw,behavior:pwBehavior};
   // Reproduce popup.js showLoading(): it writes inline 30% offsets on the
   // block, sizes #Loading to the document and hides html overflow. The theme
   // must defeat that geometry rather than only styling a pristine div.
   const loading=await checkPage.evaluate(()=>{const o=document.getElementById('Loading');o.innerHTML='<table cellpadding="5" cellspacing="0" id="loadingBlock" class="loadingBlock" align="center"><tr><td width="20%" height="80" align="center"><img src="/images/loading.gif"></td><td><span id="proceeding_main_txt">Please wait, 60% Applying Settings</span><span id="proceeding_txt" style="color:#FFFFCC;"></span></td></tr></table>';const block=document.getElementById('loadingBlock');const nativeLeft=innerWidth>1050?(1105*0.3)+(innerWidth-1050)/2:innerWidth*0.3;block.style.marginTop=(Math.min(innerHeight,660)*0.3)+'px';block.style.marginLeft=nativeLeft+'px';o.style.width=document.documentElement.scrollWidth+'px';o.style.height=document.documentElement.scrollHeight+'px';document.documentElement.style.overflow='hidden';o.style.visibility='visible';const b=block.getBoundingClientRect();const cs=getComputedStyle(block),os=getComputedStyle(o);return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:b.width,h:b.height,iw:innerWidth,ih:innerHeight,position:cs.position,img:getComputedStyle(document.querySelector('#loadingBlock img')).display,ml:cs.marginLeft,mt:cs.marginTop,width:os.width,height:os.height,nativeLeft};});
   assert(loading.position!=='absolute'&&loading.img==='none','Applying dialog still uses the legacy absolute block/spinner: '+JSON.stringify(loading));
   assert(loading.ml==='0px'&&loading.mt==='0px','Native showLoading inline margins are not overridden: '+JSON.stringify(loading));
   assert(Math.abs((loading.left+loading.right)/2-loading.iw/2)<3&&Math.abs((loading.top+loading.bottom)/2-loading.ih/2)<3,'Applying dialog is not centered: '+JSON.stringify(loading));
   assert(loading.w<=loading.iw-32,'Applying dialog is wider than the viewport: '+JSON.stringify(loading));
   await checkPage.setViewportSize({width:320,height:800});
   await checkPage.waitForTimeout(120);
   const loadingPhone=await checkPage.evaluate(()=>{const b=document.getElementById('loadingBlock').getBoundingClientRect();const cs=getComputedStyle(document.getElementById('loadingBlock'));return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:b.width,iw:innerWidth,ih:innerHeight,ml:cs.marginLeft,mt:cs.marginTop,overflow:document.documentElement.scrollWidth-innerWidth};});
   assert(loadingPhone.ml==='0px'&&loadingPhone.mt==='0px','Phone applying dialog keeps native inline margins: '+JSON.stringify(loadingPhone));
   assert(Math.abs((loadingPhone.left+loadingPhone.right)/2-loadingPhone.iw/2)<3&&Math.abs((loadingPhone.top+loadingPhone.bottom)/2-loadingPhone.ih/2)<3,'Phone applying dialog is not centered: '+JSON.stringify(loadingPhone));
   assert(loadingPhone.w<=loadingPhone.iw-32&&loadingPhone.overflow<=0,'Phone applying dialog exceeds the viewport: '+JSON.stringify(loadingPhone));
   /* SFR follow-up: the reveal row clears the confirmation border at every
      layout, not only at the desktop width. */
   for(const width of [1024,390,320]){
    await open('/Advanced_System_Content.asp',width);
    const placement=await passwordGeometry();
    assertPasswordGeometry(placement,width);
    geometryEvidence.sfrPassword[width]=placement;
   }
   await open('/Advanced_FirmwareUpgrade_Content.asp');
   const pickerState=()=>checkPage.evaluate(()=>{
    const wrap=document.querySelector('.od-admin-file'),input=wrap&&wrap.querySelector('input[type="file"]'),status=wrap&&wrap.querySelector('.od-admin-filename');
    if(!wrap||!input||!status)return{missing:true};
    const r=e=>{const x=e.getBoundingClientRect();return{l:+x.left.toFixed(1),r:+x.right.toFixed(1),t:+x.top.toFixed(1),b:+x.bottom.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)};};
    const cs=getComputedStyle(input),ss=getComputedStyle(status);
    const upload=[...document.querySelectorAll('.od-admin-panels input[type="button"]')].find(b=>/upload/i.test(b.value));
    return {classes:wrap.className,wrapper:r(wrap),statusCount:wrap.querySelectorAll('.od-admin-filename').length,text:status.textContent.trim(),status:r(status),input:r(input),inputValue:input.value,name:input.name,type:input.type,form:input.form&&{name:input.form.name,id:input.form.id},color:cs.color,fill:cs.webkitTextFillColor,fontSize:cs.fontSize,lineHeight:parseFloat(ss.lineHeight),overflowWrap:ss.overflowWrap,scroll:status.scrollWidth,client:status.clientWidth,upload:upload&&{value:upload.value,name:upload.name,type:upload.type,form:upload.form===input.form},overflow:document.documentElement.scrollWidth-innerWidth};
   });
   const assertPicker=(state,{expected,width,pageLabel,empty,wrapExpected})=>{
    assert(!state.missing,'file picker composition missing on '+pageLabel+' at '+width+': '+JSON.stringify(state));
    assert.equal(state.statusCount,1,'duplicate filename status on '+pageLabel+' at '+width+': '+JSON.stringify({statusCount:state.statusCount,text:state.text}));
    assert(/od-admin-file/.test(state.classes)&&/od-file-named/.test(state.classes),'file picker wrapper classes changed on '+pageLabel+' at '+width+': '+JSON.stringify(state.classes));
    assert.equal(state.name,'tools_FW_UploadFile','file input name changed on '+pageLabel+' at '+width+': '+JSON.stringify(state.name));
    assert.equal(state.type,'file','file input type changed on '+pageLabel+' at '+width);
    assert(state.form&&state.form.name==='uiPostUpdateForm','file input left the native upload form on '+pageLabel+' at '+width+': '+JSON.stringify(state.form));
    assert.equal(state.text,expected,'custom filename status wrong on '+pageLabel+' at '+width+': '+JSON.stringify({text:state.text,expected}));
    assert(/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(state.color)&&state.fontSize==='0px','native file text is not suppressed on '+pageLabel+' at '+width+': '+JSON.stringify({color:state.color,fontSize:state.fontSize}));
    assert(state.input.h>=44,'file picker is shorter than its control on '+pageLabel+' at '+width+': '+JSON.stringify(state.input));
    if(width<851){
     assert(state.status.t>=state.input.b-0.5,'custom filename is not on its own line on '+pageLabel+' at '+width+': '+JSON.stringify(state));
     assert(Math.abs(state.status.l-state.input.l)<=1,'custom filename is not aligned with the picker on '+pageLabel+' at '+width+': '+JSON.stringify(state));
     if(wrapExpected)assert(state.status.h>=state.lineHeight*1.5,'long filename did not wrap on '+pageLabel+' at '+width+': '+JSON.stringify(state));
    }else{
     assert(state.status.l>=state.input.r+4,'custom filename touches the browser button on '+pageLabel+' at '+width+': '+JSON.stringify(state));
     assert(state.status.t<state.input.b&&state.status.b>state.input.t,'custom filename is not vertically centred with the picker on '+pageLabel+' at '+width+': '+JSON.stringify(state));
    }
    assert(state.status.l>=state.wrapper.l-0.5&&state.status.r<=state.wrapper.r+0.5,'filename status leaves its picker on '+pageLabel+' at '+width+': '+JSON.stringify(state));
    assert(state.scroll<=state.client+1,'filename status overflows its line on '+pageLabel+' at '+width+': '+JSON.stringify(state));
    assert(state.upload&&state.upload.value&&state.upload.form,'upload action left the native form on '+pageLabel+' at '+width+': '+JSON.stringify(state.upload));
    assert.equal(state.upload.type,'button','upload action type changed on '+pageLabel+' at '+width+': '+JSON.stringify(state.upload));
    assert(state.overflow<=0,'file picker page overflows on '+pageLabel+' at '+width+': '+JSON.stringify(state.overflow));
    if(empty)assert.equal(state.inputValue,'','empty picker retained a filename on '+pageLabel+' at '+width+': '+JSON.stringify(state.inputValue));
    else assert(state.inputValue.includes(expected),'native file selection was not preserved on '+pageLabel+' at '+width+': '+JSON.stringify(state.inputValue));
   };
   const pickerSelectedName='OpenDSL_DSL-N12E-C1_'+makeVersion+'.trx';
   const pickerLongName='OpenDSL_DSL-N12E-C1_'+makeVersion+'-with-an-extremely-long-descriptive-build-filename-that-should-wrap.trx';
   const shippedLegacyJs=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/html/opendsl/legacy.js'),'utf8');
   assert(shippedLegacyJs.includes(makeVersion),'shipped legacy.js does not carry the Makefile release identity '+makeVersion);
   assert(!shippedLegacyJs.includes('@@OPENDSL_RELEASE@@'),'shipped legacy.js still contains the release placeholder');
   for(const [url,pageLabel] of [['/Advanced_FirmwareUpgrade_Content.asp','firmware'],['/Advanced_SettingBackup_Content.asp','backup']]){
    for(const width of [1440,1024,390,320]){
     await open(url,width);
     if(pageLabel==='firmware'&&width===1440){
      const release=await checkPage.evaluate(()=>{const row=document.querySelector('.od-admin-release'),cells=row?[...row.children].map(e=>e.textContent.replace(/\s+/g,' ').trim()):[];return{row:!!row,cells,text:row?row.textContent.replace(/\s+/g,' ').trim():null};});
      assert.deepEqual(release.cells,['OpenDSL release',makeVersion],'firmware release identity is not the build version: '+JSON.stringify(release));
      geometryEvidence.sfrRelease={expected:makeVersion,...release};
     }
     const empty=await pickerState();
     assertPicker(empty,{expected:'No file selected',width,pageLabel,empty:true});
     await checkPage.setInputFiles('input[name="tools_FW_UploadFile"]',{name:pickerSelectedName,mimeType:'application/octet-stream',buffer:Buffer.from('fixture')});
     await checkPage.waitForTimeout(100);
     const selected=await pickerState();
     assertPicker(selected,{expected:pickerSelectedName,width,pageLabel});
     await checkPage.setInputFiles('input[name="tools_FW_UploadFile"]',{name:pickerLongName,mimeType:'application/octet-stream',buffer:Buffer.from('fixture')});
     await checkPage.waitForTimeout(100);
     const long=await pickerState();
     assertPicker(long,{expected:pickerLongName,width,pageLabel,wrapExpected:true});
     geometryEvidence.picker.push({url,width,empty,selected,long});
    }
   }
   // Sidebar scroll containment: the menu is the scroll container, so its
   // top stays below the fixed brand instead of painting Quick setup over it.
   const side=await browser.newPage({viewport:{width:1024,height:844}});
   await side.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   const sideNav=()=>side.evaluate(()=>{
    const menu=document.getElementById('mainMenu'),cell=menu&&menu.closest('td.od-nav-cell'),quick=menu&&menu.querySelector('.m_qis_r'),brand=document.querySelector('.banner1 > span:first-child');
    const box=e=>{const x=e.getBoundingClientRect();return{l:+x.left.toFixed(1),r:+x.right.toFixed(1),t:+x.top.toFixed(1),b:+x.bottom.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)};};
    const items=menu?[...menu.querySelectorAll('.od-nav-item')]:[],active=menu&&menu.querySelector('.od-nav-item.od-current');
    const labelOf=e=>{const l=e.querySelector('[id^="menu_string"],[id^="option_str1"],.od-nav-label');return l?{text:l.textContent.replace(/\s+/g,' ').trim(),font:getComputedStyle(l).fontSize+' '+getComputedStyle(l).fontWeight}:null;};
    return {menu:box(menu),cell:cell?box(cell):null,menuScroll:{scroll:menu.scrollWidth,client:menu.clientWidth},quick:quick?box(quick):null,quickScroll:quick?{scroll:quick.scrollWidth,client:quick.clientWidth}:null,quickStyle:quick?{border:getComputedStyle(quick).borderTopWidth+'/'+getComputedStyle(quick).borderLeftWidth,radius:getComputedStyle(quick).borderTopLeftRadius}:null,
     count:items.length,hrefs:items.map(e=>e.getAttribute('data-od-href')),labels:items.map(e=>labelOf(e)&&labelOf(e).text),fonts:[...new Set(items.map(e=>labelOf(e)&&labelOf(e).font).filter(Boolean))],icons:items.map(e=>{/* Repurposed native rows carry the icon on the div#index_imgN/menu_imgN host itself, not in a descendant; generated rows use a glyph span. */const i=e.querySelector('td:first-child img,td:first-child [data-icon],td:first-child svg,td:first-child span,td:first-child [id^="index_img"],td:first-child [id^="menu_img"]');return i?{w:+box(i).w.toFixed(1),h:+box(i).h.toFixed(1)}:null;}),
     heights:[...new Set(items.map(e=>Math.round(box(e).h)))],widths:[...new Set(items.map(e=>Math.round(box(e).w)))],radii:[...new Set(items.map(e=>{const cs=getComputedStyle(e);return [cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' ');}))],borderWidths:[...new Set(items.map(e=>getComputedStyle(e).borderLeftWidth))],
     active:active?{label:labelOf(active)&&labelOf(active).text,height:box(active).h,border:getComputedStyle(active).borderLeftWidth+' '+getComputedStyle(active).borderLeftColor,radius:[getComputedStyle(active).borderTopLeftRadius,getComputedStyle(active).borderTopRightRadius,getComputedStyle(active).borderBottomRightRadius,getComputedStyle(active).borderBottomLeftRadius].join(' '),paddingLeft:getComputedStyle(active).paddingLeft}:null,
     brandBottom:brand?box(brand).b:null,menuTop:box(menu).t,menuOverflow:getComputedStyle(menu).overflowY,scroll:menu.scrollTop};
   });
   const assertSideNav=(s,width)=>{
    assert.equal(s.count,13,'navigation item count changed at '+width+': '+JSON.stringify(s.labels));
    assert.equal(new Set(s.hrefs).size,13,'navigation destinations are not unique at '+width+': '+JSON.stringify(s.hrefs));
    assert(s.hrefs.includes('/Main_Analysis_Content.asp')&&s.labels.includes('Network tools'),'navigation lost Network tools at '+width+': '+JSON.stringify(s.hrefs));
    assert.deepEqual(s.heights,[48],'navigation rows are not all 48px at '+width+': '+JSON.stringify(s.heights));
    assert.equal(s.widths.length,1,'navigation rows have different widths at '+width+': '+JSON.stringify(s.widths));
    assert(s.radii.every(r=>r==='0px 9px 9px 0px'),'navigation row radius changed at '+width+': '+JSON.stringify(s.radii));
    assert(s.borderWidths.every(w=>w==='4px'),'navigation row edge width changed at '+width+': '+JSON.stringify(s.borderWidths));
    assert.deepEqual(s.fonts,['14px 500'],'navigation typography changed at '+width+': '+JSON.stringify(s.fonts));
    assert(s.icons.every(i=>i&&Math.abs(i.w-21)<=0.5&&Math.abs(i.h-21)<=0.5),'navigation icon size changed at '+width+': '+JSON.stringify(s.icons));
    assert(s.active&&s.active.height===48&&s.active.border==='4px rgb(57, 167, 255)'&&s.active.radius==='0px 9px 9px 0px'&&s.active.paddingLeft==='8px','active navigation row appearance changed at '+width+': '+JSON.stringify(s.active));
    assert(s.quick&&Math.abs(s.quick.h-48)<=0.5&&Math.abs(s.quick.w-s.menu.w)<=0.5,'Quick setup is not a full-width 48px row at '+width+': '+JSON.stringify(s.quick));
    assert(s.quick.l>=s.menu.l-0.5&&s.quick.r<=s.menu.r+0.5,'Quick setup leaves the sidebar horizontally at '+width+': '+JSON.stringify({quick:s.quick,menu:s.menu}));
    assert(s.quickScroll.scroll<=s.quickScroll.client+1,'Quick setup clips its own content at '+width+': '+JSON.stringify(s.quickScroll));
    assert(s.quickStyle.border==='1px/1px'&&s.quickStyle.radius==='9px','Quick setup border/indicator is clipped at '+width+': '+JSON.stringify(s.quickStyle));
    assert(s.menuScroll.scroll<=s.menuScroll.client+1,'sidebar clips horizontally at '+width+': '+JSON.stringify(s.menuScroll));
   };
   await side.goto(base+'/Advanced_System_Content.asp',{waitUntil:'load'});await side.waitForTimeout(350);
   const sideNavData=await sideNav();
   assertSideNav(sideNavData,1024);
   const sideData=await side.evaluate(()=>{const m=document.getElementById('mainMenu'),b=document.querySelector('.banner1 > span:first-child');m.scrollTop=80;const r=e=>e.getBoundingClientRect();return{brandBottom:r(b).bottom,menuTop:r(m).top,overflow:getComputedStyle(m).overflowY,scroll:m.scrollTop};});
   assert(sideData.menuTop>=sideData.brandBottom-1&&sideData.overflow==='auto'&&sideData.scroll>0,'Desktop sidebar scrolls under the brand: '+JSON.stringify(sideData));
   geometryEvidence.sfrNav={1024:sideNavData};
   for(const width of [390,320]){
    await side.setViewportSize({width,height:844});await side.goto(base+'/Advanced_System_Content.asp',{waitUntil:'load'});await side.waitForTimeout(300);await side.locator('.od-menu-toggle').click();await side.waitForTimeout(250);
    const drawerNav=await sideNav();
    assertSideNav(drawerNav,width);
    assert(Math.abs(drawerNav.cell.w-Math.min(320,width*0.86))<=1,'phone drawer width changed at '+width+': '+JSON.stringify(drawerNav.cell));
    const drawer=await side.evaluate(()=>{const m=document.getElementById('mainMenu'),b=document.querySelector('.banner1 > span:first-child');m.scrollTop=80;const r=e=>e.getBoundingClientRect();return{brandBottom:r(b).bottom,menuTop:r(m).top,overflow:getComputedStyle(m).overflowY,scroll:m.scrollTop};});
    assert(drawer.menuTop>=drawer.brandBottom-1&&drawer.overflow==='auto'&&drawer.scroll>0,'Phone sidebar drawer scrolls under the brand at '+width+': '+JSON.stringify(drawer));
    geometryEvidence.sfrNav[width]=drawerNav;
   }
   await side.close();
   /* SFR-07: the legacy shell must keep the same selection before, during and
      after its destination loads. Measure the selected row itself rather than
      the click target, so a collapsed native row cannot pass. */
   const legacyNavSelection=()=>checkPage.evaluate(()=>{
    const menu=document.getElementById('mainMenu');
    const active=menu&&menu.querySelector('.od-nav-item.od-current');
    const label=active&&active.querySelector('.od-nav-label,[id^="menu_string"],[id^="option_str1"]');
    const cs=active&&getComputedStyle(active),b=active&&active.getBoundingClientRect();
    return {active:label?label.textContent.replace(/\s+/g,' ').trim():null,currentCount:menu?menu.querySelectorAll('.od-nav-item.od-current').length:0,
     aria:active&&active.getAttribute('aria-current'),height:b?+b.height.toFixed(1):null,borderWidth:cs?cs.borderLeftWidth:null,borderColor:cs?cs.borderLeftColor:null,
     radius:cs?[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '):null,paddingLeft:cs?cs.paddingLeft:null,
     leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,pointerEvents:getComputedStyle(document.body).pointerEvents,
     reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
   });
   const assertLegacySelection=(state,label,width)=>{
    assert.equal(state.currentCount,1,'legacy navigation has '+state.currentCount+' selected rows at '+width+': '+JSON.stringify(state));
    assert.equal(state.active,label,'legacy selected row is not '+label+' at '+width+': '+JSON.stringify(state));
    assert.equal(state.aria,'page','legacy selected row lost aria-current=page at '+width+': '+JSON.stringify(state));
    assert.equal(state.height,48,'legacy selected row is not 48px at '+width+': '+JSON.stringify(state));
    assert.equal(state.borderWidth,'4px','legacy selected row lost its 4px edge at '+width+': '+JSON.stringify(state));
    assert.equal(state.borderColor,'rgb(57, 167, 255)','legacy selected row edge colour changed at '+width+': '+JSON.stringify(state));
    assert.equal(state.radius,'0px 9px 9px 0px','legacy selected row shape changed at '+width+': '+JSON.stringify(state));
    assert.equal(state.paddingLeft,'8px','legacy selected row inset changed at '+width+': '+JSON.stringify(state));
   };
   await open('/Advanced_System_Content.asp');
   const navBefore=await legacyNavSelection();
   assert.equal(navBefore.reduced,false,'legacy normal-motion page reported reduce: '+JSON.stringify(navBefore));
   assertLegacySelection(navBefore,'Administration','before load');
   const navClick=await checkPage.evaluate(()=>{
    const item=[...document.querySelectorAll('#mainMenu .od-nav-item')].find(n=>n.getAttribute('data-od-href')==='/Advanced_Wireless_Content.asp');
    item.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
    const active=document.querySelector('#mainMenu .od-nav-item.od-current');
    const label=active&&active.querySelector('.od-nav-label,[id^="menu_string"],[id^="option_str1"]');
    const cs=active&&getComputedStyle(active),b=active&&active.getBoundingClientRect();
    return {active:label?label.textContent.replace(/\s+/g,' ').trim():null,currentCount:document.querySelectorAll('#mainMenu .od-nav-item.od-current').length,
     aria:active&&active.getAttribute('aria-current'),height:b?+b.height.toFixed(1):null,borderWidth:cs?cs.borderLeftWidth:null,borderColor:cs?cs.borderLeftColor:null,
     radius:cs?[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '):null,paddingLeft:cs?cs.paddingLeft:null,
     leaving:document.body.classList.contains('od-leaving'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
   });
   assert.equal(navClick.reduced,false,'legacy normal-motion click reported reduce: '+JSON.stringify(navClick));
   assertLegacySelection(navClick,'Wireless','immediate click');
   assert.equal(navClick.leaving,true,'legacy normal-motion click did not start the fade: '+JSON.stringify(navClick));
   await checkPage.waitForURL('**/Advanced_Wireless_Content.asp',{timeout:5000});
   await checkPage.waitForLoadState('load');await checkPage.waitForTimeout(450);
   const navArrival=await legacyNavSelection();
   assertLegacySelection(navArrival,'Wireless','after load');
   assert.equal(navArrival.leaving,false,'legacy destination kept the leaving class: '+JSON.stringify(navArrival));
   assert.equal(navArrival.opacity,'1','legacy destination is still faded: '+JSON.stringify(navArrival));
   assert.equal(navArrival.pointerEvents,'auto','legacy destination blocks pointer input: '+JSON.stringify(navArrival));
   geometryEvidence.sfrNav.afterLoad=navArrival;
   await checkPage.emulateMedia({reducedMotion:'reduce'});
   const reducedClick=await checkPage.evaluate(()=>{
    const item=[...document.querySelectorAll('#mainMenu .od-nav-item')].find(n=>n.getAttribute('data-od-href')==='/QoS_EZQoS.asp');
    item.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
    const active=document.querySelector('#mainMenu .od-nav-item.od-current');
    const label=active&&active.querySelector('.od-nav-label,[id^="menu_string"],[id^="option_str1"]');
    return {active:label?label.textContent.replace(/\s+/g,' ').trim():null,leaving:document.body.classList.contains('od-leaving'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
   });
   assert.equal(reducedClick.reduced,true,'legacy reduced-motion page reported no-preference: '+JSON.stringify(reducedClick));
   assert.equal(reducedClick.active,'Traffic manager','legacy reduced-motion click did not select its destination: '+JSON.stringify(reducedClick));
   assert.equal(reducedClick.leaving,false,'legacy reduced motion still starts the fade: '+JSON.stringify(reducedClick));
   await checkPage.waitForURL('**/QoS_EZQoS.asp',{timeout:5000});
   await checkPage.waitForLoadState('load');await checkPage.waitForTimeout(450);
   const reducedArrival=await legacyNavSelection();
   assertLegacySelection(reducedArrival,'Traffic manager','reduced-motion destination');
   assert.equal(reducedArrival.leaving,false,'legacy reduced-motion destination kept the fade: '+JSON.stringify(reducedArrival));
   geometryEvidence.sfrNav.reduced=reducedClick;
   await checkPage.emulateMedia({reducedMotion:'no-preference'});
   /* SFR-01: actual Back/Forward through Chromium's bfcache with motion on.
      A real click starts the fade, so the restored document is the state that
      previously stayed transparent and unclickable. */
   const legacyHistoryContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',locale:'en-US'});
   const legacyHistory=await legacyHistoryContext.newPage();
   await legacyHistory.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await legacyHistory.addInitScript(()=>{window.addEventListener('pageshow',e=>{window.__odPageshow={persisted:e.persisted,at:Date.now()};});});
   const readLegacyHistory=()=>legacyHistory.evaluate(()=>{
    const menu=document.getElementById('mainMenu');
    const active=menu&&menu.querySelector('.od-nav-item.od-current');
    const label=active&&active.querySelector('.od-nav-label,[id^="menu_string"],[id^="option_str1"]');
    const b=active&&active.getBoundingClientRect();
    const hit=b?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
    return {url:location.pathname,pageshow:window.__odPageshow||null,leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,
     pointerEvents:getComputedStyle(document.body).pointerEvents,visibility:getComputedStyle(document.body).visibility,
     active:label?label.textContent.replace(/\s+/g,' ').trim():null,aria:active&&active.getAttribute('aria-current'),
     height:b?+b.height.toFixed(1):null,hit:hit&&{tag:hit.tagName,menu:!!hit.closest('#mainMenu')}};
   });
   await legacyHistory.goto(base+'/Advanced_System_Content.asp',{waitUntil:'load'});
   await legacyHistory.waitForTimeout(450);
   assert.equal(await legacyHistory.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false,'legacy history page unexpectedly has reduced motion');
   await legacyHistory.locator('#mainMenu .od-nav-item[data-od-href="/Guest_network.asp"]').click();
   await legacyHistory.waitForURL('**/Guest_network.asp',{timeout:5000});
   await legacyHistory.waitForLoadState('load');await legacyHistory.waitForTimeout(300);
   const historyArrival=await readLegacyHistory();
   assert.equal(historyArrival.url,'/Guest_network.asp','real legacy nav click did not reach its destination: '+JSON.stringify(historyArrival));
   assert.equal(historyArrival.active,'Guest network','real legacy nav click did not select its destination: '+JSON.stringify(historyArrival));
   assert.equal(historyArrival.leaving,false,'legacy destination kept the fade after a real click: '+JSON.stringify(historyArrival));
   assert.equal(historyArrival.height,48,'legacy destination row collapsed after a real click: '+JSON.stringify(historyArrival));
   let backError=null;await legacyHistory.goBack({waitUntil:'load',timeout:5000}).catch(error=>{backError=String(error).split('\n')[0];});
   await legacyHistory.waitForTimeout(500);
   const backRestore=await readLegacyHistory();
   assert.equal(backRestore.url,'/Advanced_System_Content.asp','legacy Back did not restore the previous page: '+JSON.stringify({backError,backRestore}));
   assert(backRestore.pageshow&&backRestore.pageshow.persisted===true,'legacy Back did not restore from bfcache: '+JSON.stringify({backError,backRestore}));
   assert.equal(backRestore.leaving,false,'restored legacy page kept the frozen fade: '+JSON.stringify(backRestore));
   assert.equal(backRestore.opacity,'1','restored legacy page is transparent: '+JSON.stringify(backRestore));
   assert.equal(backRestore.pointerEvents,'auto','restored legacy page blocks pointer input: '+JSON.stringify(backRestore));
   assert.equal(backRestore.active,'Administration','restored legacy page lost its selected row: '+JSON.stringify(backRestore));
   assert.equal(backRestore.height,48,'restored legacy selected row collapsed: '+JSON.stringify(backRestore));
   assert(backRestore.hit&&backRestore.hit.menu,'restored legacy page has no clickable navigation row: '+JSON.stringify(backRestore));
   let forwardError=null;await legacyHistory.goForward({waitUntil:'load',timeout:5000}).catch(error=>{forwardError=String(error).split('\n')[0];});
   await legacyHistory.waitForTimeout(500);
   const forwardRestore=await readLegacyHistory();
   assert.equal(forwardRestore.url,'/Guest_network.asp','legacy Forward did not restore the destination: '+JSON.stringify({forwardError,forwardRestore}));
   assert(forwardRestore.pageshow&&forwardRestore.pageshow.persisted===true,'legacy Forward did not restore from bfcache: '+JSON.stringify({forwardError,forwardRestore}));
   assert.equal(forwardRestore.leaving,false,'forward-restored legacy page kept the frozen fade: '+JSON.stringify(forwardRestore));
   assert.equal(forwardRestore.opacity,'1','forward-restored legacy page is transparent: '+JSON.stringify(forwardRestore));
   assert.equal(forwardRestore.pointerEvents,'auto','forward-restored legacy page blocks pointer input: '+JSON.stringify(forwardRestore));
   assert.equal(forwardRestore.active,'Guest network','forward-restored legacy page lost its selected row: '+JSON.stringify(forwardRestore));
   assert(forwardRestore.hit&&forwardRestore.hit.menu,'forward-restored legacy page has no clickable navigation row: '+JSON.stringify(forwardRestore));
   geometryEvidence.sfrHistory={arrival:historyArrival,back:backRestore,forward:forwardRestore,backError,forwardError};
   await legacyHistoryContext.close();
   /* SFR-05: System Log actions sit below the log viewport with a positive
      gap, and the native Clear/Save/Refresh controls stay in the native form.
      Their inline handlers are stripped from the host fixture, so the shipped
      source is checked and Clear is executed against a stubbed submit. */
   const logSource=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/Main_LogStatus_Content.asp'),'utf8');
   assert(/onClick="clearLog\(\);"/i.test(logSource)&&/onClick="back_syslog\(\);"/i.test(logSource),'System Log lost its Clear or Save native handler');
   assert(/onClick="location\.href=location\.href"/i.test(logSource),'System Log lost its Refresh native handler');
   assert(/document\.clearform\.clearLog_Flag\.value\s*=\s*"1"[\s\S]*document\.clearform\.submit\(\)/.test(logSource),'System Log Clear no longer submits the native clear form');
   assert(/name="clearLog_Flag"/.test(logSource),'System Log native clear flag field removed');
   /* The native Save builds its target through cfg + eval, so matching a
      literal location.assign() string would reject shipped code. Execute the
      native handler with a stubbed location instead: that checks the URL it
      actually requests, not just that some navigation text is present. */
   const backSyslogSource=extractFunction(logSource,'function back_syslog');
   const clearLogSource=extractFunction(logSource,'function clearLog');
   await open('/Main_LogStatus_Content.asp');
   const logClear=await checkPage.evaluate(({source,backSource})=>{
    eval(source);
    const form=document.forms.clearform||document.querySelector('form[name="clearform"]');
    if(!form)return {missing:true};
    let submitted=0;form.submit=function(){submitted++;};
    clearLog();
    const assigned=[];
    (function(location){eval(backSource);back_syslog();})({assign:url=>assigned.push(url)});
    const flag=form.querySelector('input[name="clearLog_Flag"]');
    return {flag:flag&&flag.value,submitted,assigned};
   },{source:clearLogSource,backSource:backSyslogSource});
   assert.equal(logClear.flag,'1','System Log Clear did not set the native flag: '+JSON.stringify(logClear));
   assert.equal(logClear.submitted,1,'System Log Clear did not submit the native form once: '+JSON.stringify(logClear));
   assert.deepEqual(logClear.assigned,['/syslog.xlog'],'System Log Save does not request the native log file: '+JSON.stringify(logClear));
   geometryEvidence.sfrLog={clear:logClear};
   for(const width of [1440,1024,390,320]){
    await open('/Main_LogStatus_Content.asp',width);
    const logLayout=await checkPage.evaluate(()=>{
     const frame=document.querySelector('iframe[src*="status_log2.cgi"]'),box=frame&&frame.closest('.od-log-frame'),actions=box&&box.nextElementSibling;
     const r=e=>{const x=e.getBoundingClientRect();return{l:+x.left.toFixed(1),r:+x.right.toFixed(1),t:+x.top.toFixed(1),b:+x.bottom.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)};};
     return {frame:frame?r(frame):null,frameClass:box?box.className:null,actions:actions?r(actions):null,actionsClass:actions?actions.className:null,
      gap:frame&&actions?+(actions.getBoundingClientRect().top-frame.getBoundingClientRect().bottom).toFixed(1):null,
      buttons:actions?[...actions.querySelectorAll('input[type="button"]')].map(b=>({value:b.value,type:b.type,form:b.form&&b.form.name,nativeTable:!!b.closest('table.apply_gen'),shown:b.getClientRects().length>0,rect:r(b)})):[],
      overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert(logLayout.frame&&/od-log-frame/.test(logLayout.frameClass),'System Log viewport is not marked as its frame at '+width+': '+JSON.stringify(logLayout));
    assert(logLayout.actions&&/od-log-actions/.test(logLayout.actionsClass),'System Log actions are not separated at '+width+': '+JSON.stringify(logLayout));
    assert(logLayout.gap>=12,'System Log actions touch its viewport at '+width+': '+JSON.stringify(logLayout));
    assert.deepEqual(logLayout.buttons.map(b=>b.value),['Clear','Save','Refresh'],'System Log actions changed at '+width+': '+JSON.stringify(logLayout.buttons));
    for(const button of logLayout.buttons){
     /* These native buttons are not inside a form: the page's outer form
        closes above the log table and Clear reaches the separate clearform
        programmatically. Assert the native action table instead of inventing
        form ownership the device markup does not have. */
     assert(button.type==='button'&&button.shown&&button.nativeTable,'System Log action '+button.value+' left its native action table or type at '+width+': '+JSON.stringify(button));
     assert(button.rect.w>0&&button.rect.h>=24,'System Log action '+button.value+' is not visible at '+width+': '+JSON.stringify(button));
    }
    assert(logLayout.overflow<=0,'System Log page overflows at '+width+': '+JSON.stringify(logLayout.overflow));
    geometryEvidence.sfrLog[width]=logLayout;
   }
   await checkPage.close();
  }
  const named1440=accessibleControls.filter(c=>c.width===1440);
  // The aggregate counts every editor page; a filtered run cannot satisfy it.
  if(!process.env.OPENDSL_QA_FILTER)assert.equal(named1440.reduce((n,c)=>n+c.fields,0),18,'accessible-name coverage across editor pages: '+JSON.stringify(named1440));
  // Boundary header-overlap pass: at 849/850/851/900/1024/1200/1201/1440/
  // 1536 px, title text fragments (DOM Range rects) must not intersect the
  // header actions, and same-row neighbours keep at least 8px separation.
  // Gaps are measured as distances on the overlapping axis; diagonal
  // fragments demand no clearance. The same classifier runs the negative
  // control suite below (review §3).
  const { classifyGap, runNegativeControls } = require(path.join(__dirname, 'header-gap-classifier.js'));
  const controls = runNegativeControls();
  if (!controls.pass) throw new Error('header-gap classifier negative controls failed: ' + JSON.stringify(controls.probes.filter(p => !p.pass)));
  const ref=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/deepseek-ui/reference-index.json'),'utf8'));
  const longs=ref.pages.filter(p=>p.title&&p.role==='page'&&!/redirect/.test((p.route)||'')&&!/^qis\//.test((p.route)||'')).sort((a,b)=>(b.title||'').length-(a.title||'').length).slice(0,8).map(p=>'/'+p.route);
  const boundaryUrls=['/Advanced_ASUSDDNS_Content.asp','/index2.asp',...longs];
  const boundaryWidths=[849,850,851,900,1024,1200,1201,1440,1536];
  const hpage=await browser.newPage({viewport:{width:1440,height:1000}});
  await hpage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   const grabRects=()=>hpage.evaluate(()=>{
    const titleGroup=document.querySelector('.od-page-head');
    const actions=[...document.querySelectorAll('.od-topbar-actions a[href*="reboot"], .od-topbar-actions a[href*="logout"]')].filter(a=>getComputedStyle(a).display!=='none'&&a.getBoundingClientRect().width>0);
   if(!titleGroup||!actions.length)return {skip:true};
   const frags=[];
   const walker=document.createTreeWalker(titleGroup,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
    if(!node.textContent.trim())continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const rc of range.getClientRects()){if(rc.width>0&&rc.height>0)frags.push({l:rc.left,r:rc.right,t:rc.top,b:rc.bottom});}
   }
   const boxes=actions.map(a=>{const r=a.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};});
   return {skip:false,frags,boxes,fragCount:frags.length,actionCount:boxes.length,title:titleGroup.textContent.trim().slice(0,40)};
  });
  const classifyAll=data=>{
   const bad=[];
   for(const f of data.frags){
    for(const ab of data.boxes){
     const c=classifyGap(f,ab);
     if(c)bad.push(c);
    }
   }
   return {bad,comparisons:data.frags.length*data.boxes.length};
  };
  for(const url of boundaryUrls){
   for(const width of boundaryWidths){
    await hpage.setViewportSize({width,height:1000});
    await hpage.goto(base+url,{waitUntil:'load'});
    await hpage.waitForTimeout(200);
    const data=await grabRects();
    const required = (url==='/Advanced_ASUSDDNS_Content.asp' || url==='/index2.asp') && width >= 851;
    if(data.skip){ if(required) assert.equal(data.skip,false,url+'@'+width+' required header group/actions missing'); continue; }
    assert.equal(data.actionCount,2,url+'@'+width+' expected two visible header actions: '+JSON.stringify(data));
    assert(data.fragCount>=1,url+'@'+width+' no title text fragments measured');
    const clash=classifyAll(data);
    assert(clash.comparisons>0,url+'@'+width+' classifier made no comparisons');
    assert.deepEqual(clash.bad,[],url+'@'+width+' header collision: '+JSON.stringify(clash));
    if(url==='/index2.asp'&&(width===850||width===851))await hpage.screenshot({path:path.join(out,'index2.asp-'+width+'.png'),fullPage:true});
    if(url==='/Advanced_ASUSDDNS_Content.asp'&&width===1440){
     // End-to-end negative control: force an overlap through the same path
     // and verify the classifier rejects it, then restore and reload.
      await hpage.evaluate((t)=>{
       const s=document.createElement('style');
       s.id='od-gap-neg';
       s.textContent='.od-topbar-actions{position:fixed!important;left:'+t.l+'px!important;top:'+t.t+'px!important}';
       document.head.appendChild(s);
      }, data.frags[0]);
     const neg=classifyAll(await grabRects());
     assert.equal(neg.comparisons>0,true,'negative control made no comparisons');
     assert(neg.bad.length>0,'negative control missed a forced overlap: '+JSON.stringify(neg));
     await hpage.evaluate(()=>{const s=document.getElementById('od-gap-neg');if(s)s.remove();});
     await hpage.goto(base+url,{waitUntil:'load'});
     await hpage.waitForTimeout(200);
    }
    // Header action glyph probes: each moved native link keeps a loaded mask
    // glyph (19x19) with its correct action variable, on desktop and phone.
     const iconProbe=await hpage.evaluate(()=>{
      const links=[...document.querySelectorAll('.od-topbar-actions a[href*="logout"], .od-topbar-actions a[href*="reboot"]')].filter(a=>getComputedStyle(a).display!=='none'&&a.getBoundingClientRect().width>0);
     if(!links.length)return {skip:true};
     return {skip:false,actions:links.map(a=>{
      const s=getComputedStyle(a,'::before');
      return {
       href:a.getAttribute('href'),
       var:getComputedStyle(a).getPropertyValue('--od-action').trim(),
       glyph:{content:s.content,width:s.width,height:s.height,mask:s.maskImage||s.webkitMaskImage},
       dup:document.querySelectorAll('a[href="'+CSS.escape(a.getAttribute('href'))+'"]').length
      };
     })};
    });
    if(!iconProbe.skip){
     assert.equal(iconProbe.actions.length,2,url+'@'+width+' expected reboot+logout actions: '+JSON.stringify(iconProbe));
     for(const act of iconProbe.actions){
      const isReboot=act.href.includes('reboot');
      const wantGlyph=isReboot?'M20%2010a8':'M10%204H4';
      assert(act.var.includes(wantGlyph),url+'@'+width+' '+act.href+' wrong action glyph: '+act.var.slice(0,120));
      assert(act.glyph&&act.glyph.content==='""',url+'@'+width+' '+act.href+' glyph missing: '+JSON.stringify(act)+' DBG '+JSON.stringify(iconProbe));
      assert(act.glyph&&parseFloat(act.glyph.width)===19&&parseFloat(act.glyph.height)===19,url+'@'+width+' '+act.href+' glyph box: '+JSON.stringify(act.glyph));
      assert(act.glyph&&act.glyph.mask&&act.glyph.mask!=='none'&&act.glyph.mask.includes('data:'),url+'@'+width+' '+act.href+' mask not loaded: '+JSON.stringify(act.glyph));
      assert.equal(act.dup,1,url+'@'+width+' '+act.href+' duplicate glyph node: '+act.dup);
     }
    }
   }
  }
  // V19-01/V19-06 resize round trips: phone header actions return to the
  // desktop title row, and QoS groups reflow without a navigation.
  await hpage.setViewportSize({width:1440,height:1000});
  await hpage.goto(base+'/index2.asp',{waitUntil:'load'});
  await hpage.waitForTimeout(250);
  const headParent=()=>hpage.evaluate(()=>{const g=document.querySelector('.od-topbar-actions');return g&&g.parentNode?g.parentNode.className:null;});
  assert.equal(await headParent(),'od-topbar','desktop actions not in the top bar');
  await hpage.setViewportSize({width:390,height:900});await hpage.waitForTimeout(450);
  const phoneActions=await hpage.evaluate(()=>[...document.querySelectorAll('.od-topbar-actions a[href*="logout"], .od-topbar-actions a[href*="reboot"]')].map(a=>{const r=a.getBoundingClientRect();return {label:a.getAttribute('aria-label'),vis:getComputedStyle(a).display!=='none'&&r.width>0,x:r.x,r:r.right,w:r.width};}));
  assert.equal(phoneActions.filter(a=>a.vis).length,2,'phone header action count after resize: '+JSON.stringify(phoneActions));
  assert(phoneActions.every(a=>a.x>=0&&a.r<=391&&a.w>=44),'phone header actions off the bar after resize: '+JSON.stringify(phoneActions));
  await hpage.screenshot({path:path.join(out,'index2-resize-phone.png'),fullPage:true});
  await hpage.setViewportSize({width:1440,height:1000});await hpage.waitForTimeout(450);
  assert.equal(await headParent(),'od-topbar','actions failed to return to the top bar');
  assert(await hpage.locator('.od-topbar-actions a[href*="reboot"]').first().isVisible(),'desktop actions hidden after round trip');
  await hpage.screenshot({path:path.join(out,'index2-resize-desktop.png'),fullPage:true});
  await hpage.setViewportSize({width:390,height:900});
  await hpage.goto(base+'/Advanced_QOSUserPrio_Content.asp',{waitUntil:'load'});
  await hpage.waitForTimeout(250);
  const qosLayout=()=>hpage.evaluate(()=>[...document.querySelectorAll('.od-qos-group')].map(g=>{const r=g.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1)};}));
  const phoneQos=await qosLayout();
  assert(phoneQos.length===2&&Math.abs(phoneQos[0].y-phoneQos[1].y)>60,'QoS phone layout before resize: '+JSON.stringify(phoneQos));
  await hpage.screenshot({path:path.join(out,'qos-resize-phone.png'),fullPage:true});
  await hpage.setViewportSize({width:1440,height:1000});await hpage.waitForTimeout(350);
  const deskQos=await qosLayout();
  assert(deskQos.length===2&&deskQos[0].w>phoneQos[0].w+100,'QoS did not widen on resize: '+JSON.stringify({phoneQos,deskQos}));
  assert.equal(await hpage.evaluate(()=>document.querySelectorAll('.od-qos-field-label').length),25,'QoS captions lost on resize');
  assert.equal(await hpage.evaluate(()=>[...document.querySelectorAll('.od-qos-field-label')].filter(e=>getComputedStyle(e).display!=='none').length),0,'QoS desktop captions visible after resize');
  await hpage.screenshot({path:path.join(out,'qos-resize-desktop.png'),fullPage:true});
  geometryEvidence.resize={headAtPhone:'od-topbar',headAtDesktop:'od-topbar',phoneActions,phoneQos,deskQos};
  await hpage.close();

  // V19-08: panel evidence at the embedded 600px width plus the map parent.
  // Host fixtures strip inline handlers; verify the untouched native source.
  const routerSource=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/device-map/router.asp'),'utf8');
  assert(/<INPUT TYPE="SUBMIT"[^\n]*onClick="return doSave\(\);"/i.test(routerSource),'native router Apply handler changed in source');
  const panelPage=await browser.newPage({viewport:{width:600,height:1000}});
  await panelPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await panelPage.goto(base+'/index2.asp',{waitUntil:'load'});await panelPage.waitForTimeout(450);
  await panelPage.screenshot({path:path.join(out,'index2.asp-600-inside-parent.png'),fullPage:true});
  for(const url of ['/device-map/DSL_dashboard.asp','/device-map/internet.asp','/device-map/clients.asp','/device-map/router.asp','/device-map/router_status.asp','/device-map/remote.asp'].filter(u=>!process.env.OPENDSL_QA_PANEL_FILTER||u.includes(process.env.OPENDSL_QA_PANEL_FILTER))){
   await panelPage.goto(base+url,{waitUntil:'load'});await panelPage.waitForTimeout(250);
   const panel=await panelPage.evaluate(()=>{
    const visible=[...document.querySelectorAll('.table1px')].find(t=>t.getBoundingClientRect().width>0);
    const el=document.querySelector('.od-status-card')||visible;
    return {scroll:document.documentElement.scrollWidth,vw:innerWidth,cls:document.body.className,card:el?(()=>{const r=el.getBoundingClientRect();return {x:+r.x.toFixed(1),w:+r.width.toFixed(1),r:+r.right.toFixed(1)};})():null};
   });
   assert(panel.scroll<=panel.vw+2,'device panel overflows at 600: '+url+' '+JSON.stringify(panel));
   assert(panel.cls.includes('od-device-panel'),'device panel body class missing: '+url+' '+panel.cls);
   if(panel.card)assert(panel.card.r<=panel.vw+1&&panel.card.w>0,'device panel card clipped at 600: '+url+' '+JSON.stringify(panel.card));
   if(url==='/device-map/clients.asp'){
    // The adapter mirrors the native clientList/totalClientNum/pagesVar contract
    // and must survive drawClientList() replacing the block every 3s. Every
    // interaction below runs against the fixture's native-shaped markup only.
    const clients=await panelPage.evaluate(async()=>{
     const rb=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
     const entries=()=>[...document.querySelectorAll('.od-client-entry')];
     const status=()=>document.querySelector('.od-clients-status').textContent;
     const range=()=>document.querySelector('.od-clients-range').textContent;
     const tabs=()=>[...document.querySelectorAll('.od-clients-tab')].map(t=>({id:t.id,selected:t.getAttribute('aria-selected'),tabindex:t.getAttribute('tabindex'),display:getComputedStyle(t).display,count:(t.querySelector('.od-clients-count-value')||{}).textContent}));
     const wait=ms=>new Promise(r=>setTimeout(r,ms));
     const data={
      panel:!!document.querySelector('.od-clients-panel'),
      rows:document.querySelectorAll('.od-clients-rows').length,
      native:document.querySelector('.od-clients-native')?getComputedStyle(document.querySelector('.od-clients-native')).display:null,
      entries:entries().length,
      status:status(),range:range(),
      names:entries().map(e=>e.querySelector('.od-client-name-value').textContent),
      conn:entries().map(e=>e.querySelector('.od-client-connection-value').textContent.trim()),
      macs:entries().map(e=>e.querySelector('.od-client-cell:nth-child(4) .od-client-value').textContent.trim()),
      nas:document.querySelector('.od-client-entry:nth-child(4) a.link')?document.querySelector('.od-client-entry:nth-child(4) a.link').getAttribute('href'):null,
      repeat:entries()[2].querySelector('.od-client-repeat')?entries()[2].querySelector('.od-client-repeat').textContent.trim():null,
      summaryRadio:document.querySelectorAll('.od-client-summary .radioIcon').length,
      tabs:tabs(),
      prev:document.querySelectorAll('.od-page-button')[0].disabled,
      next:document.querySelectorAll('.od-page-button')[1].disabled,
      first:rb(entries()[0]),panelBox:rb(document.querySelector('.od-clients-panel')),
      searchPlaceholder:document.getElementById('searchingBar').placeholder
     };
     const wiredTab=document.getElementById('tabWired');
     wiredTab.style.display='none';
     data.hiddenTab=getComputedStyle(wiredTab).display;
     data.hiddenDebug={style:wiredTab.getAttribute('style'),cls:wiredTab.className,parent:wiredTab.parentElement.className,body:document.body.className,inline:getComputedStyle(wiredTab).display};
     wiredTab.style.display='';
     const pixel=entries()[2];
     pixel.open=true;
     await wait(80);
     data.detail=[...pixel.querySelectorAll('.od-client-readout')].map(r=>({k:r.querySelector('dt').textContent,v:r.querySelector('dd').textContent.trim(),radio:!!r.querySelector('.radioIcon')}));
     document.getElementById('client_list_Block').innerHTML=window.__row();
     await wait(150);
     data.redraw={count:entries().length,rows:document.querySelectorAll('.od-clients-rows').length,native:document.querySelector('.od-clients-native')?getComputedStyle(document.querySelector('.od-clients-native')).display:null,open:entries().map(e=>e.open)};
     const search=document.getElementById('searchingBar');
     search.value='pixel';search.dispatchEvent(new Event('input',{bubbles:true}));
     await wait(40);
     data.search={status:status(),range:range()};
     search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
     await wait(40);
     data.cleared={status:status(),range:range()};
     let clicks=0;
     document.getElementById('rightBtn').addEventListener('click',()=>{clicks++;});
     const nextBtn=document.querySelectorAll('.od-page-button')[1];
     nextBtn.disabled=false;nextBtn.click();
     data.pagerClicks=clicks;
     let wiredClicks=0;
     document.getElementById('tabWired').addEventListener('click',()=>{wiredClicks++;});
     document.getElementById('tabOnline').focus();
     document.getElementById('tabOnline').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
     await wait(40);
     data.keyboard={focus:document.activeElement&&document.activeElement.id,clicks:wiredClicks};
     document.getElementById('tabOnline').className='tab_NW';
     document.getElementById('tabWired').className='tabclick_NW';
     await wait(60);
     data.tabsAfterNativeClass=tabs();
     window.clientList=[];window.totalClientNum={online:0,wired:0,wireless:0,wireless_0:0,wireless_1:0,wireless_2:0};
     document.getElementById('client_list_Block').innerHTML='<table width="100%" cellspacing="0" align="center"><tbody><tr><td><div style="color:#FC0;height:30px;text-align:center;margin-top:15px">No devices found</div></td></tr></tbody></table>';
     await wait(150);
     data.empty={empty:document.querySelectorAll('.od-clients-empty').length,entries:entries().length,status:status(),range:range()};
     return data;
    });
    assert(clients.panel&&clients.rows===1,'clients panel not built: '+JSON.stringify(clients));
    assert.equal(clients.native,'none','native client table still visible');
    assert.equal(clients.entries,4,'clients entries: '+clients.entries);
    assert.equal(clients.status,'4 devices','clients status: '+clients.status);
    assert.equal(clients.range,'1\u20134 of 4','clients range: '+clients.range);
    assert.deepEqual(clients.names,['Office PC','Living Room TV','Pixel 9','Home NAS'],'clients names: '+JSON.stringify(clients.names));
    assert.deepEqual(clients.conn,['Wired','2.4 GHz','2.4 GHz','Wired'],'clients connection: '+JSON.stringify(clients.conn));
    assert.deepEqual(clients.macs,['AA:BB:CC:00:00:01','AA:BB:CC:00:00:02','AA:BB:CC:00:00:03','AA:BB:CC:00:00:04'],'clients macs: '+JSON.stringify(clients.macs));
    assert.equal(clients.nas,'http://192.168.1.40','client web-server link lost: '+clients.nas);
    assert.equal(clients.repeat,'2','client repeat badge lost: '+clients.repeat);
    assert.equal(clients.summaryRadio,0,'signal sprite still in summary');
    assert.equal(clients.prev,true,'previous pager should be disabled');
    assert.equal(clients.next,true,'next pager should be disabled');
    assert.equal(clients.searchPlaceholder,'Search devices by name\u2026','search placeholder: '+clients.searchPlaceholder);
    assert.equal(clients.tabs.length,4,'client tab count: '+clients.tabs.length);
    const onlineTab=clients.tabs.find(t=>t.id==='tabOnline');
    assert(onlineTab&&onlineTab.selected==='true','online tab not selected: '+JSON.stringify(clients.tabs));
    assert.equal(clients.tabs.filter(t=>t.selected==='true').length,1,'multiple selected tabs: '+JSON.stringify(clients.tabs));
    assert.equal(onlineTab.count,'4','online count pill: '+onlineTab.count);
    assert.equal(clients.tabs.find(t=>t.id==='tabWired').count,'2','wired count pill');
    assert(clients.tabs.find(t=>t.id==='tabCustom').display!=='none','history tab is drawn in R6 but hidden: '+JSON.stringify(clients.tabs));
    assert.equal(clients.hiddenTab,'none','native hidden client category was forced visible: '+JSON.stringify(clients.hiddenDebug));
    const detail=Object.fromEntries(clients.detail.map(r=>[r.k,r]));
    assert.equal(detail.Signal.v,'-71 dBm','client signal: '+JSON.stringify(clients.detail));
    assert(detail.Signal.radio,'signal sprite missing from detail: '+JSON.stringify(clients.detail));
    assert.equal(detail['IP assignment'].v,'Manual','client ip method: '+JSON.stringify(clients.detail));
    assert.equal(detail['This device'].v,'Yes','client this-device: '+JSON.stringify(clients.detail));
    assert(clients.redraw.count===4&&clients.redraw.rows===1&&clients.redraw.native==='none','redraw lost the drawn list: '+JSON.stringify(clients.redraw));
    assert.equal(clients.redraw.open[2],true,'redraw collapsed the open row: '+JSON.stringify(clients.redraw));
    assert.equal(clients.search.status,'1 device matching your search','search status: '+clients.search.status);
    assert.equal(clients.search.range,'1\u20131 of 1','search range: '+clients.search.range);
    assert.equal(clients.cleared.status,'4 devices','cleared status: '+clients.cleared.status);
    assert.equal(clients.pagerClicks,1,'drawn pager did not forward to native: '+clients.pagerClicks);
    assert(clients.keyboard.focus==='tabWired'&&clients.keyboard.clicks===1,'tab keyboard: '+JSON.stringify(clients.keyboard));
    assert(clients.tabsAfterNativeClass.length===4&&clients.tabsAfterNativeClass.find(t=>t.id==='tabWired').selected==='true','native className dropped the drawn tab class: '+JSON.stringify(clients.tabsAfterNativeClass));
    assert.equal(clients.tabsAfterNativeClass.find(t=>t.id==='tabWired').tabindex,'0','roving tabindex lost: '+JSON.stringify(clients.tabsAfterNativeClass));
    assert.equal(clients.empty.empty,1,'native empty message not restyled: '+JSON.stringify(clients.empty));
    assert(clients.empty.entries===0&&clients.empty.status==='0 devices','empty client state: '+JSON.stringify(clients.empty));
    geometryEvidence.clients=clients;
   }
   if(url==='/device-map/router.asp'){
    const inspector=await panelPage.evaluate(()=>{
     const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
     const card=document.querySelector('.od-inspector-card');
     const fields=card?[...card.querySelectorAll('.od-inspector-field')]:[];
     const visible=fields.filter(t=>t.getBoundingClientRect().height>0);
     const gaps=visible.slice(1).map((t,i)=>+(visible[i].getBoundingClientRect().bottom-t.getBoundingClientRect().top).toFixed(1));
     const rows=[...card.querySelectorAll('.od-inspector-row')].filter(tr=>tr.getBoundingClientRect().height>0).map(tr=>{
      const td=tr.cells[0],label=td.querySelector('.formfonttitle_nwm'),ctl=td.querySelector('input:not([type="hidden"]),select,textarea');
      return {label:b(label),ctl:b(ctl),display:getComputedStyle(td).display,cols:getComputedStyle(td).gridTemplateColumns};
     });
     const apply=document.querySelector('.od-inspector-actions input[type="submit"]');
     const info=document.getElementById('LANIP').closest('.table1px');
     const infoRow=document.getElementById('LANIP').closest('td');
     const names=[...document.querySelectorAll('.od-inspector-card input:not([type="hidden"]), .od-inspector-card select')].map(e=>e.name||e.id);
     const cs=card?getComputedStyle(card):null;
     return {body:document.body.className,cards:document.querySelectorAll('.od-inspector-card').length,
      fields:fields.length,visible:visible.length,card:cs?{bi:cs.backgroundImage,bg:cs.backgroundColor,radius:cs.borderRadius}:null,
      fieldGaps:gaps,rows,
      apply:apply?{...b(apply),name:apply.name,type:apply.type,inForm:!!apply.form}:null,
      info:{card:b(info),label:b(infoRow.querySelector('.formfonttitle_nwm')),value:b(document.getElementById('LANIP'))},
      names,tabs:[...document.querySelectorAll('#t0,#t1,#t2')].map(e=>getComputedStyle(e).display)};
    });
    assert.equal(inspector.cards,1,'router inspector should be one card: '+JSON.stringify(inspector));
    assert(inspector.visible>=3,'router visible field tables missing: '+JSON.stringify({fields:inspector.fields,visible:inspector.visible}));
    assert(inspector.fieldGaps.every(g=>g<=1),'router field rows have card gaps: '+JSON.stringify(inspector.fieldGaps));
    assert(inspector.card&&inspector.card.bg!=='rgba(0, 0, 0, 0)'&&inspector.card.bi==='none'&&parseFloat(inspector.card.radius)>=12,'router inspector card surface missing: '+JSON.stringify(inspector.card));
    assert.equal(inspector.rows.length,4,'router two-column rows missing: '+inspector.rows.length);
    for(const row of inspector.rows){
     assert.equal(row.display,'grid','router row not two-column: '+JSON.stringify(row));
     assert(row.ctl.x>row.label.x+100,'router control not in second column: '+JSON.stringify(row));
     assert(row.ctl.r>=row.label.r+140,'router control too narrow: '+JSON.stringify(row));
    }
    assert(inspector.apply&&inspector.apply.w>=110&&inspector.apply.h>=43&&inspector.apply.h<=46,'router Apply geometry: '+JSON.stringify(inspector.apply));
    assert(inspector.apply.name==='BUTTON'&&inspector.apply.type==='submit'&&inspector.apply.inForm,'router Apply native submit lost: '+JSON.stringify(inspector.apply));
    assert(inspector.apply.r>=inspector.info.card.r-24&&inspector.apply.r<=inspector.info.card.r-4,'router Apply not right-aligned: '+JSON.stringify({apply:inspector.apply,info:inspector.info.card}));
    assert(inspector.info.label.x>=inspector.info.card.x+10&&inspector.info.value.r<=inspector.info.card.r-10,'router info row geometry: '+JSON.stringify(inspector.info));
    for(const name of ['wl_ssid','wl_auth_mode_x','wl_crypto','wl_wpa_psk'])assert(inspector.names.includes(name),'router native field lost: '+name+' '+JSON.stringify(inspector.names));
    assert(inspector.tabs[0]!=='none'&&inspector.tabs[1]==='none'&&inspector.tabs[2]!=='none','router 2.4G/Status visible and 5G hidden: '+JSON.stringify(inspector.tabs));
    geometryEvidence.inspector=inspector;
   }
   if(url==='/device-map/router_status.asp'){
    const readings=await panelPage.evaluate(()=>{
     const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1)};};
     const cards=[...document.querySelectorAll('.od-status-card')];
     const mem=cards[1];
     const rows=[...mem.querySelectorAll('.od-status-readout')].filter(r=>r.getBoundingClientRect().height>0).map(r=>({label:r.querySelector('dt').textContent.trim(),
      value:r.querySelector('dd').textContent.trim(),display:getComputedStyle(r).display,
      l:b(r.querySelector('dt')),v:b(r.querySelector('dd'))}));
     const sources=[...document.querySelectorAll('.od-readings-source')];
     return {vw:innerWidth,scroll:document.documentElement.scrollWidth,cards:cards.length,
      titles:cards.map(c=>c.querySelector('.od-status-card-title').textContent.trim()),card:mem?b(mem):null,rows,
      sources:sources.map(t=>getComputedStyle(t).display),
      ids:['cpu1_quantification','ram_used_info','ram_free_info','ram_total_info','cpu1_graph','ram_graph'].every(id=>!!document.getElementById(id)),
      charts:[...document.querySelectorAll('.od-status-card .od-status-chart svg')].length};
    });
    assert.equal(readings.cards,2,'system status should be two cards: '+JSON.stringify(readings));
    assert.deepEqual(readings.titles,['CPU','Memory'],'system status card order: '+JSON.stringify(readings.titles));
    assert.equal(readings.rows.length,3,'system status reading rows missing: '+JSON.stringify(readings));
    assert.deepEqual(readings.rows.map(r=>r.label),['Used','Free','Total'],'system status row labels: '+JSON.stringify(readings.rows));
    assert(readings.rows.every(r=>r.display==='flex'&&r.v.x>r.l.r&&r.v.r<=readings.card.r-10),'system status label/value columns: '+JSON.stringify(readings.rows));
    assert(readings.rows.every(r=>r.value),'system status reading empty: '+JSON.stringify(readings.rows));
    assert(readings.sources.length===4&&readings.sources.every(d=>d==='none'),'system status source tables still visible: '+JSON.stringify(readings.sources));
    assert(readings.ids,'system status native update targets lost: '+JSON.stringify(readings));
    assert.equal(readings.charts,2,'system status history charts missing: '+JSON.stringify(readings));
    geometryEvidence.statusReadings=readings;
   }
   await panelPage.screenshot({path:path.join(out,'device-panel-600-'+url.split('/').pop()+'.png'),fullPage:true});
  }
  await panelPage.close();

  // R20-07: the plotted CPU/RAM surfaces adopt the interface palette while the
  // native SVG ids, points and display updates stay untouched.
  const chartPage=await browser.newPage({viewport:{width:600,height:1000}});
  await chartPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const chartResults=[];
  for(const width of [600,390,320]){
   await chartPage.setViewportSize({width,height:1000});
   await chartPage.goto(base+'/device-map/router_status.asp',{waitUntil:'load'});
   await chartPage.waitForTimeout(300);
   const chart=await chartPage.evaluate(()=>{
    const boxes=[...document.querySelectorAll('div[style*="background-color:black"]')].filter(d=>d.querySelector('svg'));
    const text=boxes[0]&&boxes[0].querySelector('svg text');
    const grid=boxes[0]&&boxes[0].querySelector('svg line');
    const svg=boxes[0]&&boxes[0].querySelector('svg');
    const trace=svg&&svg.querySelector('polyline');
    const cs=text?getComputedStyle(text):null;
    const ctm=text?text.getScreenCTM():null;
    const stroke=id=>{const e=document.getElementById(id);return e?getComputedStyle(e).stroke:null;};
    return {count:boxes.length,bg:boxes[0]?getComputedStyle(boxes[0]).backgroundColor:null,
     text:text?{fill:cs.fill,size:cs.fontSize,scale:ctm.a,family:cs.fontFamily}:null,grid:grid?getComputedStyle(grid).stroke:null,
     viewBox:svg?svg.getAttribute('viewBox'):null,vectorEffect:trace?getComputedStyle(trace).vectorEffect:null,
     traces:{cpu1:stroke('cpu1_graph'),cpu2:stroke('cpu2_graph'),ram:stroke('ram_graph'),swap:stroke('swapram_graph')},
     width:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.equal(chart.count,2,'router-status chart surfaces missing at '+width+': '+JSON.stringify(chart));
   assert.equal(chart.bg,'rgba(0, 0, 0, 0)','chart mount still paints its own surface at '+width+': '+JSON.stringify(chart));
   assert.equal(chart.text.fill,'rgb(165, 184, 209)','chart labels not themed at '+width+': '+JSON.stringify(chart));
   assert(Math.abs(parseFloat(chart.text.size)*chart.text.scale-10)<=0.35,'chart label is not 10px at '+width+': '+JSON.stringify(chart));
   assert(!/Verdana/i.test(chart.text.family),'chart labels still Verdana at '+width+': '+JSON.stringify(chart));
   assert.equal(chart.grid,'rgb(44, 60, 80)','chart grid not themed at '+width+': '+JSON.stringify(chart));
   assert.equal(chart.viewBox,'0 0 270 100','chart viewBox missing at '+width+': '+JSON.stringify(chart));
   assert.equal(chart.vectorEffect,'non-scaling-stroke','chart stroke scales at '+width+': '+JSON.stringify(chart));
   assert.deepEqual(chart.traces,{cpu1:'rgb(98, 187, 255)',cpu2:'rgb(130, 205, 178)',ram:'rgb(98, 187, 255)',swap:'rgb(120, 185, 255)'},'chart traces not themed at '+width+': '+JSON.stringify(chart));
   assert(chart.width<=chart.viewport+2,'router-status chart overflow at '+width+': '+JSON.stringify(chart));
   const readings=await chartPage.evaluate(()=>{
    const b=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),r:+r.right.toFixed(1)};};
    return [...document.querySelectorAll('.od-status-readout')].filter(r=>r.getBoundingClientRect().height>0).map(r=>({display:getComputedStyle(r).display,
     label:r.querySelector('dt').textContent.trim(),value:r.querySelector('dd').textContent.trim(),
     l:b(r.querySelector('dt')),v:b(r.querySelector('dd'))}));
   });
   assert.equal(readings.length,3,'router-status reading rows at '+width+': '+JSON.stringify(readings));
   assert.deepEqual(readings.map(r=>r.label),['Used','Free','Total'],'router-status readout labels at '+width+': '+JSON.stringify(readings));
   for(const r of readings){
    assert.equal(r.display,'flex','router-status reading row not two-column at '+width+': '+JSON.stringify(r));
    assert(r.v.x>r.l.r&&Math.abs(r.v.y-r.l.y)<=2,'router-status reading value not right-aligned at '+width+': '+JSON.stringify(r));
   }
   chartResults.push({width,...chart});
   await chartPage.screenshot({path:path.join(out,'router-status-chart-'+width+'.png'),fullPage:true});
  }
  await chartPage.close();

  // R6 footer: the native generator's links and FAQ field become one compact
  // row, panels expand above it, and the vendor notice is gone. A short page
  // pins the row to the viewport bottom; a long page keeps it below content.
  const footerPage=await browser.newPage({viewport:{width:1440,height:1100}});
  await footerPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const footerProbe=async url=>{
   await footerPage.goto(base+url,{waitUntil:'load'});
   await footerPage.waitForTimeout(250);
   return footerPage.evaluate(async()=>{
    const rb=e=>{const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)};};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const footer=document.getElementById('footer');
    const bar=footer.querySelector('.od-footer-bar');
    const support=footer.querySelector('.od-support-toggle');
    const faq=footer.querySelector('.od-faq-toggle');
    const content=document.querySelector('td.od-content-cell');
    const data={
     text:footer.textContent,bar:!!bar,barBox:bar?rb(bar):null,footerBox:rb(footer),
     toggles:[...footer.querySelectorAll('.od-footer-toggle')].map(b=>b.textContent.trim()),
     links:[...footer.querySelectorAll('.od-footer-links a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href'),target:a.getAttribute('target')})),
     faqId:!!document.getElementById('FAQ_input'),
     faqClass:(document.getElementById('FAQ_input')||{}).className||null,
     faqLabel:document.getElementById('FAQ_input')?document.getElementById('FAQ_input').getAttribute('aria-label'):null,
     supportHidden:footer.querySelector('#od-footer-support')?footer.querySelector('#od-footer-support').hidden:null,
     faqHidden:footer.querySelector('#od-footer-faq')?footer.querySelector('#od-footer-faq').hidden:null,
     contentBottom:content?rb(content).b:null,docHeight:document.documentElement.scrollHeight,innerHeight,
     bodyStyle:{display:getComputedStyle(document.body).display,direction:getComputedStyle(document.body).flexDirection,minHeight:getComputedStyle(document.body).minHeight,height:getComputedStyle(document.body).height},
     bodyKids:[...document.body.children].map(e=>({tag:e.tagName,cls:String(e.className).slice(0,32),disp:getComputedStyle(e).display,pos:getComputedStyle(e).position,box:rb(e),flex:getComputedStyle(e).flexGrow}))
    };
    support.click();await wait(30);
    data.supportOpen={expanded:support.getAttribute('aria-expanded'),hidden:footer.querySelector('#od-footer-support').hidden,panelBox:rb(footer.querySelector('#od-footer-support')),barBox:rb(bar)};
    faq.click();await wait(30);
    const input=document.getElementById('FAQ_input');
    data.faqOpen={expanded:faq.getAttribute('aria-expanded'),hidden:footer.querySelector('#od-footer-faq').hidden,focused:document.activeElement===input,panelBox:rb(footer.querySelector('#od-footer-faq')),barBox:rb(bar)};
    input.value='wifi';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(20);
    data.faqCalls=window.__faqSearches||0;
    footer.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(20);
    data.escaped={faqHidden:footer.querySelector('#od-footer-faq').hidden,expanded:faq.getAttribute('aria-expanded'),focus:document.activeElement===faq};
    return data;
   });
  };
  const shortFooter=await footerProbe('/Advanced_FirmwareUpgrade_Content.asp');
  if(process.env.OPENDSL_QA_DEBUG)console.log('FOOTER-DEBUG',JSON.stringify({style:shortFooter.bodyStyle,kids:shortFooter.bodyKids}));
  assert(shortFooter.bar,'footer row missing on a short page: '+JSON.stringify(shortFooter));
  assert.deepEqual(shortFooter.toggles,['Help & Support','Search FAQ'],'footer toggles: '+JSON.stringify(shortFooter.toggles));
  assert(!/ASUSTeK|2018/i.test(shortFooter.text),'vendor notice still in the footer: '+shortFooter.text.slice(0,120));
  assert.deepEqual(shortFooter.links.map(l=>l.text),['Manual','Utility','Send Feedback','Product Registration'],'footer native links: '+JSON.stringify(shortFooter.links));
  assert(shortFooter.links[0].href.includes('asus.com')&&shortFooter.links[2].href==='/Advanced_Feedback.asp','footer link targets changed: '+JSON.stringify(shortFooter.links));
  assert(shortFooter.faqId&&/input_FAQ_table/.test(shortFooter.faqClass||'')&&shortFooter.faqLabel==='Search FAQ','native FAQ field lost: '+JSON.stringify(shortFooter));
  assert.equal(shortFooter.supportHidden,true,'support panel should start collapsed');
  assert.equal(shortFooter.faqHidden,true,'FAQ panel should start collapsed');
  assert.equal(shortFooter.supportOpen.expanded,'true','support toggle did not expand');
  assert.equal(shortFooter.supportOpen.hidden,false,'support panel still hidden');
  assert(shortFooter.supportOpen.panelBox.b<=shortFooter.supportOpen.barBox.y+1,'support panel does not expand above the bar: '+JSON.stringify(shortFooter.supportOpen));
  assert.equal(shortFooter.faqOpen.focused,true,'FAQ panel did not focus the native field');
  assert(shortFooter.faqOpen.panelBox.b<=shortFooter.faqOpen.barBox.y+1,'FAQ panel does not expand above the bar: '+JSON.stringify(shortFooter.faqOpen));
  assert.equal(shortFooter.faqCalls,1,'FAQ search did not forward to the native action');
  assert(shortFooter.escaped.faqHidden===true&&shortFooter.escaped.focus,'Escape did not restore the footer: '+JSON.stringify(shortFooter.escaped));
  assert(Math.abs(shortFooter.footerBox.b-1100)<=1,'short footer not at the viewport bottom: '+JSON.stringify(shortFooter.footerBox));
  assert(shortFooter.barBox.h<=46,'footer bar is not a single line: '+shortFooter.barBox.h);
  assert.equal(shortFooter.footerBox.x,252,'footer left edge should follow the sidebar: '+shortFooter.footerBox.x);
  await footerPage.evaluate(()=>document.querySelector('.od-support-toggle').click());
  await footerPage.waitForTimeout(80);
  await footerPage.screenshot({path:path.join(out,'footer-short-1440.png'),fullPage:true});
  await footerPage.evaluate(()=>document.querySelector('.od-faq-toggle').click());
  await footerPage.waitForTimeout(120);
  await footerPage.screenshot({path:path.join(out,'footer-faq-1440.png'),fullPage:true});
  const longFooter=await footerProbe('/Advanced_System_Content.asp');
  assert(longFooter.bar,'footer row missing on a long page');
  assert(longFooter.footerBox.y>=1000,'long-page footer should stay below the first viewport: '+JSON.stringify(longFooter.footerBox));
  assert(longFooter.footerBox.y>=longFooter.contentBottom-2,'long-page footer overlaps content: '+JSON.stringify({footer:longFooter.footerBox,contentBottom:longFooter.contentBottom}));
  const noFeedbackFooter=await footerProbe('/Advanced_FirmwareUpgrade_Content.asp?footer=no-feedback');
  assert.deepEqual(noFeedbackFooter.links.map(l=>l.text),['Manual','Utility','Product Registration'],'feedback link should follow the native capability: '+JSON.stringify(noFeedbackFooter.links));
  await footerPage.setViewportSize({width:390,height:900});
  const phoneFooter=await footerProbe('/Advanced_FirmwareUpgrade_Content.asp');
  assert.equal(phoneFooter.footerBox.x,0,'phone footer should span the viewport: '+phoneFooter.footerBox.x);
  assert(phoneFooter.barBox.h<=46&&phoneFooter.barBox.r<=390,'phone footer row overflow: '+JSON.stringify(phoneFooter.barBox));
  assert(phoneFooter.faqOpen.focused&&phoneFooter.faqCalls===1,'phone footer panels: '+JSON.stringify({open:phoneFooter.faqOpen,calls:phoneFooter.faqCalls}));
  geometryEvidence.footer={short:shortFooter,long:longFooter,noFeedback:noFeedbackFooter.links,phone:phoneFooter};
  await footerPage.close();
 /* R6A-03 empty-native-data regression: the count is present but the native
    clientList carries no records, so the preview must show no invented rows. */
 {
  const emptyPage=await browser.newPage({viewport:{width:320,height:1000}});
  await emptyPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await emptyPage.goto(base+'/index2.asp?map=empty',{waitUntil:'load'});
  await emptyPage.waitForTimeout(300);
  const empty=await emptyPage.evaluate(()=>({
   rows:document.querySelectorAll('.od-device-card').length,
   text:document.querySelector('.od-devices-panel')?document.querySelector('.od-devices-panel').textContent.replace(/\s+/g,' ').trim():'',
   fallback:!!document.querySelector('.od-device-empty')
  }));
  assert.equal(empty.rows,0,'empty native client data produced device rows: '+JSON.stringify(empty));
  assert(!/Office PC|Living Room TV|Pixel 9|Home NAS|Old Tablet/.test(empty.text),'fabricated device records in the empty state: '+JSON.stringify(empty));
  assert(empty.fallback&&/Device details are unavailable\./.test(empty.text),'empty native client data did not show the unavailable state: '+JSON.stringify(empty));
  await emptyPage.close();
  geometryEvidence.r6a03Empty=empty;
 }
 /* R6A negative controls: reintroduce the three audited defects through the
    rendered theme and require the same detectors to reject them. The gate
    exits nonzero if detection regresses. */
 if(!process.env.OPENDSL_QA_FILTER||process.env.OPENDSL_QA_NEGATIVE){
  const negPage=await browser.newPage({viewport:{width:320,height:1000}});
  await negPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await negPage.goto(base+'/index2.asp',{waitUntil:'load'});
  await waitRouterFrame(negPage);
  await openEditWifi(negPage);
  const negFrame=negPage.frames().find(f=>f.url().includes('/device-map/router.asp'));
  if(negFrame){
   await negFrame.addStyleTag({content:'body.od-device-panel table.od-readout-card #MAC,body.od-device-panel table.od-readout-card #BandMAC{font-size:17px !important;display:block !important;width:168px !important}'});
  }
  const negMac=await inspectorMacProbe(negPage);
  assert(negMac&&negMac.every(v=>v.fragments>1),'R6A-01 negative control missed a reintroduced MAC wrap: '+JSON.stringify(negMac));
  await negPage.addStyleTag({content:'body .od-map-head{display:block !important}body .od-map-head .od-map-state{position:absolute !important;top:22px !important;right:24px !important;margin-left:0 !important}'});
  const negHead=await mapHeadingProbe(negPage);
  assert(negHead&&negHead.intersection.width>0&&negHead.intersection.height>0,'R6A-06 negative control missed a reintroduced heading collision: '+JSON.stringify(negHead));
  await negPage.close();
  const negFeedback=await browser.newPage({viewport:{width:320,height:1000}});
  await negFeedback.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await negFeedback.goto(base+'/Advanced_Feedback.asp',{waitUntil:'load'});
  await negFeedback.addStyleTag({content:'body .FormTable.od-fields th{height:30px !important;min-height:0 !important;padding-bottom:0 !important}'});
  const negCaption=await feedbackCaptionProbe(negFeedback);
  assert(negCaption&&negCaption.overlap,'R6A-02 negative control missed a reintroduced caption overlap: '+JSON.stringify(negCaption));
  await negFeedback.close();
  // R6R-01 negative control: serve the shipped bundle with the redraw key
  // narrowed back to the first client field (the old MAC-only behaviour) and
  // require the same refresh probe to observe a stale row.
  {
   const defectAsset=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/html/opendsl/legacy.js'),'utf8');
   const patched=defectAsset.replace('].join("~")','].slice(0,1).join("~")');
   assert.notEqual(patched,defectAsset,'R6R-01 defect control could not patch the redraw key');
   const stalePage=await browser.newPage({viewport:{width:390,height:844}});
   await stalePage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await stalePage.route('**/opendsl/legacy.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:patched}));
   await stalePage.goto(base+'/index2.asp',{waitUntil:'load'});
   await stalePage.waitForTimeout(350);
   const stale=await stalePage.evaluate(async()=>{
    const list=window.clientList, record=list&&list.length?list[list[0]]:null;
    if(!record)return {missing:true};
    const snap=()=>{const c=document.querySelector('.od-device-card');return c?c.innerText.replace(/\s+/g,' ').trim():null;};
    const count=document.getElementById('_clientNumber'), wait=ms=>new Promise(r=>setTimeout(r,ms));
    const original={Name:record.Name,IP:record.IP,isWL:record.isWL};
    const before=snap();
    record.Name='Audit renamed device';record.IP='192.168.1.222';record.isWL=1;
    if(count)count.textContent=count.textContent;
    await wait(250);
    const after=snap();
    record.Name=original.Name;record.IP=original.IP;record.isWL=original.isWL;
    return {original,before,after};
   });
   assert(!stale.missing,'R6R-01 defect control found no native client record: '+JSON.stringify(stale));
   assert.equal(stale.after,stale.before,'R6R-01 negative control missed a reintroduced stale row: '+JSON.stringify(stale));
   await stalePage.close();
   geometryEvidence.r6r01Negative=stale;
  }
  // R6R-04 negative control: restore the old equal-width filter rule and
  // require the measured label/count collision detector to reject it.
  {
   const negTabsPage=await browser.newPage({viewport:{width:320,height:844}});
   await negTabsPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await negTabsPage.goto(base+'/device-map/clients.asp',{waitUntil:'load'});
   await negTabsPage.addStyleTag({content:'body.od-device-panel .od-clients-tabs .tab_NW,body.od-device-panel .od-clients-tabs .tabclick_NW{flex:1 1 0% !important;padding:7px 8px !important;font-size:14px !important;white-space:normal !important}body.od-device-panel .od-clients-tabs .od-clients-count{min-width:22px;height:20px;padding:0 6px}'});
   const negTabs=await clientTabProbe(negTabsPage);
   let detected=false;
   try{assertClientTabs(negTabs,320);}catch(error){detected=true;}
   assert(detected,'R6R-04 negative control missed a reintroduced client-filter collision: '+JSON.stringify(negTabs));
   geometryEvidence.r6r04Negative=negTabs;
   await negTabsPage.close();
  }
  geometryEvidence.r6aNegative={mac:negMac,badge:negHead,caption:negCaption};
 }
 // Theme-negative control: raw reviewed native page does not carry the theme.
 const old=fs.readFileSync(path.join(ROOT,'analysis/recheck-015-image/candidate-tree/boaroot/cgi-bin/Advanced_Wireless_Content.asp'),'utf8');assert(!old.includes('data-opendsl-theme="legacy"'));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Host rendering: actual state.js menu generator with synthetic DSL/2.4GHz/IPTV profile; native page scripts/ASP not executed; no modem access',viewports:widths,documents:results.length/widths.length,renders:results,failures,accessibleControls,charts:chartResults,geometryEvidence,sharedComponents:sharedEvidence,negativeControl:'0.1.5 native page rejected as unthemed'},null,2));
 assert.deepEqual(failures,[],'native layouts overflow the page');
 const overflowRenders=results.filter(r=>r.width!==undefined&&r.width>r.viewport+2).map(r=>r.url+'@'+r.width);
 assert.deepEqual(overflowRenders,[],'documents overflow the page width: '+overflowRenders.join(', '));
 console.log(JSON.stringify({result:'PASS',documents:results.length/widths.length,renders:results.length,overflow:0}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
