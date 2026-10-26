// Host rendering of actual documents. ASP/page scripts are not executed.
// The shipped state.js menu generator runs with an explicit synthetic profile.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ROOT=path.resolve(__dirname,'../../..');
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/legacy-contracts.json')));

const dict=Object.fromEntries(fs.readFileSync(path.join(ROOT,'overlays/native-english/userfs/EN.dict'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const pages=new Map(contract.pages.map(e=>['/'+e.path.replace('boaroot/cgi-bin/',''),e]));
function expand(s){return s.replace(/<%[\s\S]*?%>/g,t=>{const m=t.match(/String_Entry"\s*,\s*"([^"]+)"/i);return m?(dict[m[1]]||m[1]):'';});}
const nativeFooter=require('./native-footer-fixture.cjs');
function footerMarkup(feedback){return nativeFooter(ROOT,dict,{feedback}).html;}
const nativeMenu=require('./native-menu-fixture.cjs');
// Source-matched product capabilities; `feedback` is the native Feedback tab.
const menuCapabilities={rc_support:'2.4G dsl mssid PARENTAL iptv wds feedback',product:'DSL-N12E C1'};
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent(req.url.split('?')[0]);const entry=pages.get(url.replace('/cgi-bin/','/'));
 if(/^\/cgi-bin\/status_(?:log2|wifi|route|conn)\.cgi$/.test(url)){
  const lines=url.includes('route')?'Kernel IP routing table\nDestination Gateway Genmask Flags Metric Ref Use Iface\n0.0.0.0 192.168.1.1 0.0.0.0 UG 0 0 0 br0\n192.168.1.0 0.0.0.0 255.255.255.0 U 0 0 0 br0':
   url.includes('wifi')?'Station MAC RSSI SSID\n02:00:00:00:00:02 -55 OpenDSL Home\n02:00:00:00:00:03 -71 OpenDSL Home':
   url.includes('conn')?'tcp 0 0 192.168.1.1:80 192.168.1.20:51234 ESTABLISHED\ntcp 0 0 192.168.1.1:443 192.168.1.20:51235 ESTABLISHED':
   [
    'Jan 1 00:00:01 syslogd started: BusyBox v1.17.4',
    'Jan 1 00:00:01 kernel: brcmboard registered',
    'Jan 1 00:00:01 kernel: Broadcom BCM963xx core',
    'Jan 1 00:00:01 kernel: flash size 16MB',
    'Jan 1 00:00:02 kernel: ADSL line up',
    'Jan 1 00:00:02 kernel: ATM init complete',
    'Jan 1 00:00:03 nat: started',
    'Jan 1 00:00:03 dhcpd: DHCP server started on br0',
    'Jan 1 00:00:04 httpd: listening on 192.168.1.1:80',
    'Jan 1 00:00:05 wl: wl0: Broadcom BCM43217 802.11 2.4 GHz',
    'Jan 1 00:00:05 wl: wl0: SSID OpenDSL Home channel 6',
    'Jan 1 00:00:06 dnsmasq[123]: started, version 2.78',
    'Jan 1 00:00:08 pppd: PPPoE session established',
    'Jan 1 00:00:08 pppd: local IP 100.64.0.2 remote IP 100.64.0.1',
    'Jan 1 00:00:09 kernel: IPv4 forwarding enabled',
    'Jan 1 00:00:10 crond[456]: started',
    'Jan 1 00:00:12 wl: wl0: STA 02:00:00:00:00:02 associated',
    'Jan 1 00:00:14 wl: wl0: STA 02:00:00:00:00:03 associated',
    'Jan 1 00:00:16 dhcpd: DHCPACK on 192.168.1.20 to 02:00:00:00:00:01',
    'Jan 1 00:00:19 dhcpd: DHCPACK on 192.168.1.31 to 02:00:00:00:00:02',
    'Jan 1 00:00:23 ntp: time synchronised to pool.ntp.org',
    'Jan 1 00:00:25 wl: wl0: STA 02:00:00:00:00:03 RSSI -71'
   ].join('\n');
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
  // Never perform backend writes in fixtures. The four read-only diagnostic
  // CGI frames are served locally so their real response shape can be themed;
  // every other iframe keeps no src.
  s=s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,m=>/status_(?:log2|wifi|route|conn)\.cgi/.test(m)?m:m.replace(/\s+src=["'][^"']*["']/gi,''));
  // show_footer() writes the help links and FAQ field before load; the fixture
  // supplies the same native nodes. ?footer=no-feedback models feedback_support -1.
  if(s.includes('<div id="footer"></div>')){
   s=s.replace('<div id="footer"></div>','<div id="footer">'+footerMarkup(!/[?&]footer=no-feedback\b/.test(req.url))+'</div>');
  }
  // showclock() and showbootTime() populate these on the device; scripts are
  // not executed here, so supply the same visible values the scripts would.
  if(entry.path.endsWith('/Main_LogStatus_Content.asp')){
   s=s.replace(/(<input\b[^>]*id="system_time"[^>]*\bvalue=")[^"]*/, '$12026-10-26 09:14:07');
   s=s.replace(/(<textarea id="time1">)[\s\S]*?(<\/textarea>)/, '$12026-10-26 09:14:07$2');
   for(const [id,value] of Object.entries({boot_days:'3',boot_hours:'7',boot_minutes:'42',boot_seconds:'18'})){
    s=s.replace(new RegExp('(<span id="'+id+'">)[\\s\\S]*?(</span>)'), '$1'+value+'$2');
   }
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
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);return;
 }
 let file;
 for(const base of ['overlays/opendsl-ui','overlays/native-english','overlays/security','analysis/recheck-015-image/candidate-tree']){const p=path.join(ROOT,base,'boaroot/html',url);if(fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
 if(!file){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'application/octet-stream'});res.end(fs.readFileSync(file));
});

module.exports={start:async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,base:'http://127.0.0.1:'+server.address().port}}};
