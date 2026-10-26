// DDNS native show/hide transition gate (host only). It executes the actual
// shipped `showhide` and `valid_wan_ip` functions extracted from production
// sources, plus the exact ASUS-registration condition lines from
// `ddns_load_body()`, against the themed page at several widths. Backend
// reads are stubbed; no form submits, modem contact or writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const {chromium}=require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/legacy-contracts.json')));
const dict=Object.fromEntries(fs.readFileSync(path.join(ROOT,'overlays/native-english/userfs/EN.dict'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const pages=new Map(contract.pages.map(e=>['/'+e.path.replace('boaroot/cgi-bin/',''),e]));
const HELPER=path.join(ROOT,'analysis/recheck-015-image/candidate-tree/boaroot/html/general.js');
const DDNS_ASP=path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/Advanced_ASUSDDNS_Content.asp');

function extractFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  assert(start!==-1,'function '+name+' not found in helper source');
  const open=source.indexOf('{',start);
  let depth=0,i=open;
  for(;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)break;}
  }
  return source.slice(start,i+1);
}
const showhideSrc=extractFunction(fs.readFileSync(HELPER,'utf8'),'showhide');
const inetNetworkSrc=extractFunction(fs.readFileSync(HELPER,'utf8'),'inet_network');
const validWanIpSrc=extractFunction(fs.readFileSync(DDNS_ASP,'utf8'),'valid_wan_ip');

function expand(s){return s.replace(/<%[\s\S]*?%>/g,t=>{const m=t.match(/String_Entry"\s*,\s*"([^"]+)"/i);return m?(dict[m[1]]||m[1]):'';});}
const nativeMenu=require('./native-menu-fixture.cjs');
const server=http.createServer((req,res)=>{
  let url=decodeURIComponent(req.url.split('?')[0]);const entry=pages.get(url.replace('/cgi-bin/',''));
  if(entry){let s=expand(fs.readFileSync(path.join(ROOT,'overlays',entry.owner,entry.path),'utf8'));
    s=s.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<script\b[^>]*>[\s\S]*?^\s*<\/script\s*>/gmi,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi,'');
    const shell=nativeMenu(ROOT,dict,url);
    s=s.replace('<div id="TopBanner"></div>','<div id="TopBanner">'+shell.banner+'</div>')
     .replace('<div id="mainMenu"></div>','<div id="mainMenu">'+shell.main+'</div>')
     .replace('<div id="subMenu"></div>','<div id="subMenu">'+shell.sub+'</div>')
     .replace('<div id="tabMenu" class="submenuBlock"></div>','<div id="tabMenu" class="submenuBlock">'+shell.tabs+'</div>')
     .replace('<div id="tabMenu"></div>','<div id="tabMenu">'+shell.tabs+'</div>');
    s=s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,m=>m.replace(/\s+src=["'][^"']*["']/gi,''));
    s=s.replace('</head>','<script defer src="/opendsl/legacy.js"></script></head>');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);return;
  }
  let file;
  for(const base of ['overlays/opendsl-ui','overlays/native-english','overlays/security','analysis/recheck-015-image/candidate-tree']){const p=path.join(ROOT,base,'boaroot/html',url);if(fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
  if(!file){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});res.end(fs.readFileSync(file));
});

(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.OPENDSL_CHROMIUM});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await page.goto(base+'/Advanced_ASUSDDNS_Content.asp',{waitUntil:'load'});
   await page.waitForTimeout(300);
   await page.addScriptTag({content:
     'window.__qaWanIp="203.0.113.5";\n'+
     showhideSrc+'\n'+inetNetworkSrc+'\n'+validWanIpSrc+'\n'+
     'function wanlink_ipaddr(){return window.__qaWanIp;}\n'
   });
   const state=()=>page.evaluate(()=>{
    const d=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {display:getComputedStyle(e).display,visible:r.width>0&&r.height>0,h:+r.height.toFixed(1)};};
    return {hide2:d('wan_ip_hide2'),hide3:d('wan_ip_hide3')};
   });
   const run=wan=>page.evaluate(ip=>{window.__qaWanIp=ip;valid_wan_ip();},wan);

   await run('203.0.113.5');
   let s=await state();
   assert.equal(s.hide2.display,'none','public WAN should hide wan_ip_hide2 @'+width);
   assert.equal(s.hide3.display,'none','public WAN should hide wan_ip_hide3 @'+width);

   await run('192.168.1.2');
   s=await state();
   assert.equal(s.hide2.visible,true,'private WAN should show wan_ip_hide2 @'+width);
   assert.equal(s.hide3.display,'none','private WAN must not show wan_ip_hide3 @'+width);

   await run('10.0.0.7');
   s=await state();
   assert.equal(s.hide2.visible,true,'10.0.0.0/8 should show wan_ip_hide2 @'+width);
   assert.equal(s.hide3.display,'none','10.0.0.0/8 must not show wan_ip_hide3 @'+width);

   await run('172.16.0.5');
   s=await state();
   assert.equal(s.hide2.visible,true,'172.16.0.0/12 should show wan_ip_hide2 @'+width);

   await run('0.0.0.0');
   s=await state();
   assert.equal(s.hide2.visible,true,'0.0.0.0 should show wan_ip_hide2 @'+width);

   // ASUS successful registration branch: exact condition lines from
   // ddns_load_body() (Advanced_ASUSDDNS_Content.asp lines 133-138).
   const asusSuccess=await page.evaluate(()=>{
    const ddns_return_code='200';let ddns_server_x='WWW.ASUS.COM';
    if(ddns_return_code.indexOf('200')!=-1||ddns_return_code.indexOf('220')!=-1||ddns_return_code==='register,230'){
      showhide('wan_ip_hide2',0);
      if(ddns_server_x==='WWW.ASUS.COM'){showhide('wan_ip_hide3',1);}
    }
    const d=id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return {display:getComputedStyle(e).display,visible:r.width>0&&r.height>0};};
    return {hide2:d('wan_ip_hide2'),hide3:d('wan_ip_hide3')};
   });
   assert.equal(asusSuccess.hide2.display,'none','ASUS success hides warning2 @'+width);
   assert.equal(asusSuccess.hide3.visible,true,'ASUS success shows registration guidance @'+width);

   const otherSuccess=await page.evaluate(()=>{
    // Fresh state: public-WAN init hid both; then a non-ASUS provider
    // succeeds (return code 200) and must not show ASUS registration guidance.
    showhide('wan_ip_hide2',0);showhide('wan_ip_hide3',0);
    const ddns_return_code='200';let ddns_server_x='WWW.NO-IP.COM';
    if(ddns_return_code.indexOf('200')!=-1){showhide('wan_ip_hide2',0);if(ddns_server_x==='WWW.ASUS.COM'){showhide('wan_ip_hide3',1);}}
    const e=document.getElementById('wan_ip_hide3');const r=e.getBoundingClientRect();
    return {display:getComputedStyle(e).display,visible:r.width>0&&r.height>0};
   });
   assert.equal(otherSuccess.visible,false,'non-ASUS provider must not show registration guidance @'+width);

   // Both directions through the real helper on the themed nodes.
   const roundtrip=await page.evaluate(()=>{
    showhide('wan_ip_hide3',1);
    const shown=document.getElementById('wan_ip_hide3').getBoundingClientRect();
    showhide('wan_ip_hide3',0);
    const hidden=document.getElementById('wan_ip_hide3').getBoundingClientRect();
    return {shownW:shown.width,hiddenW:hidden.width,shownD:getComputedStyle(document.getElementById('wan_ip_hide3')).display};
   });
   assert(roundtrip.shownW>0,'showhide(1) must render the element @'+width);
   assert.equal(roundtrip.hiddenW,0,'showhide(0) must hide the element @'+width);

   console.log(JSON.stringify({suite:'ddns-native-showhide',width,result:'PASS'}));
   await page.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
