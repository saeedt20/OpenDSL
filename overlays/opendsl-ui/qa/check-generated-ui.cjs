// Host execution of the shipped page scripts for the interfaces that native
// JavaScript generates (guest summary, parental client/time grid, bandwidth
// limiter). ASP expressions are replaced with dictionary text or neutral
// values; the modem backend is never contacted and no request is written.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const {chromium}=require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/legacy-contracts.json')));
const out=path.join(ROOT,'analysis/ui-system-settings/browser-generated');fs.mkdirSync(out,{recursive:true});
const dict=Object.fromEntries(fs.readFileSync(path.join(ROOT,'overlays/native-english/userfs/EN.dict'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const pages=new Map(contract.pages.map(e=>['/'+e.path.replace('boaroot/cgi-bin/',''),e]));

function dictValue(tag){const m=tag.match(/String_Entry"\s*,\s*"([^"]+)"/i);return m?(dict[m[1]]||m[1]):null;}
const QOS_TYPE_FIXTURE='0';
function isValueExpression(tag){return /^\s*<%\s*(tcWebApi_(get|Get|staticGet|char_to_ascii)|TCWebApi_get)\s*\(/i.test(tag);}
function synthetic(tag){
  if(!isValueExpression(tag))return null;
  if(/Parental_Entry"\s*,\s*"MULTIFILTER_ALL"/i.test(tag))return '1';
  if(/QoS_Entry0"\s*,\s*"qos_enable"/i.test(tag))return '1';
  if(/QoS_Entry0"\s*,\s*"qos_type"/i.test(tag))return QOS_TYPE_FIXTURE;
  if(/QoS_Entry0"\s*,\s*"qos_orates"/i.test(tag))return '0-80,0-80,0-80,0-80,0-80';
  if(/QoS_Entry0"\s*,\s*"qos_irates"/i.test(tag))return '100,100,100,100,100';
  if(/QoS_Entry0"\s*,\s*"qos_obw"/i.test(tag))return '1024';
  if(/QoS_Entry0"\s*,\s*"qos_ibw"/i.test(tag))return '8192';
  if(/QoS_Entry0"\s*,\s*"qos_rulelist"/i.test(tag))return '<QA TCP>0.0.0.0>80>tcp>0~100>1';
  return null;
}
/* Native ASP branches of the form
   <%If tcWebApi_get("QoS_Entry0","qos_enable","h") = "1" then asp_write("1") else asp_write("0") end if%>
   are substituted from the synthetic QoS profile so the fixture represents a
   genuine enabled/type-0 state without editing production ASP. */
function aspConditional(tag){
  const m=tag.match(/QoS_Entry0"\s*,\s*"(qos_enable|qos_type)"\s*,\s*"h"\s*\)\s*=\s*"([0-9])"[^]*?asp_?[Ww]rite\("([^"]*)"\)[^]*?end\s+if/i);
  if(!m)return null;
  const fixture=m[1]==='qos_enable'?'1':QOS_TYPE_FIXTURE;
  return fixture===m[2]?m[3]:'';
}
function escapeFor(source,quote){
  return source.replace(/\\/g,'\\\\').replace(/[\r\n]/g,' ').replace(quote==="'" ? /'/g : /"/g,'\\'+quote);
}
/* Script blocks: ASP expansions are valid JavaScript tokens. Inside a string
   literal they become text (or nothing); outside they become 0. Server-side
   control blocks are removed entirely rather than replaced with a value. */
function expandScripts(s){
  return s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,(all,open,body,close)=>
    open+body.replace(/<%[\s\S]*?%>/g,(tag,offset,whole)=>{
      const lineStart=whole.lastIndexOf('\n',offset)+1;
      const before=whole.slice(lineStart,offset);
      const inDouble=(before.match(/"/g)||[]).length%2===1;
      const inSingle=(before.match(/'/g)||[]).length%2===1;
      const cw=aspConditional(tag);
      if(cw!==null)return (inDouble||inSingle)?escapeFor(cw,inDouble?'"':"'"):cw;
      const wan=tag.match(/^\s*<%\s*(first|secondary)_wanlink\(\s*\)\s*;\s*%>\s*$/);
      if(wan)return wan[1]==='first'?'function first_wanlink_status(){return 1}':'function secondary_wanlink_status(){return 1}';
      if(!isValueExpression(tag))return (inDouble||inSingle)?'':'0';
      const syn=synthetic(tag);
      const value=syn!==null?syn:dictValue(tag);
      if(inDouble)return escapeFor(value===null?'':value,'"');
      if(inSingle)return escapeFor(value===null?'':value,"'");
      return '0';
    })+close);
}
function expandHtml(s){
  return s.replace(/<%[\s\S]*?%>/g,tag=>{
    const cw=aspConditional(tag);
    if(cw!==null)return cw;
    if(!isValueExpression(tag))return '';
    const syn=synthetic(tag);
    if(syn!==null)return syn;
    const v=dictValue(tag);
    return v===null?'':v;
  });
}
/* The shipped state.js renders the banner/menu from server values. The same
   explicit synthetic profile as the static fixture keeps the menu truthful. */
function expandMenuScript(js){
  return js.replace(/<%[\s\S]*?%>/g,(tag,offset,whole)=>{
    const lineStart=whole.lastIndexOf('\n',offset)+1;
    const before=whole.slice(lineStart,offset);
    const inDouble=(before.match(/"/g)||[]).length%2===1;
    const inSingle=(before.match(/'/g)||[]).length%2===1;
    const quote=inDouble?'"':inSingle?"'":null;
    const value=dictValue(tag);
    let v;
    if(value!==null)v=value;
    else if(/wl_get_[25]G_guestnetwork/.test(tag))v='[["0","QA Guest","WPA2PSK","AES","qa-guest-pass","0","0","","","","","0","on","0","disabled","","","qa-guest-pass","0","0","0","","",""]]';
    else if(/available_disk|disk_pool/.test(tag))v='';
    else if(/wl_nband_info/.test(tag))v='[2]';
    else if(/rc_support/.test(tag))v='2.4G dsl mssid PARENTAL PARENTAL2 iptv wds';
    else if(/ProductName|ej_get_productid/.test(tag))v='DSL-N12E C1';
    else if(/hideQIS/.test(tag))v='NO';
    else if(/wans_dualwan/.test(tag))v='adsl none';
    else if(/get_wan_unit/.test(tag))v='0';
    else if(/wl0_auth_mode/.test(tag))v='WPA2PSK';
    else if(/\buptime\s*\(\s*\)/.test(tag))v='Fri, 20 Oct 2026 12:00:00 +0000';
    else v=quote?'':'0';
    return quote?escapeFor(v,quote):v;
  });
}
function expandGenericScript(js,bare){
  return js.replace(/<%[\s\S]*?%>/g,(tag,offset,whole)=>{
    const lineStart=whole.lastIndexOf('\n',offset)+1;
    const before=whole.slice(lineStart,offset);
    const inDouble=(before.match(/"/g)||[]).length%2===1;
    const inSingle=(before.match(/'/g)||[]).length%2===1;
    const quote=inDouble?'"':inSingle?"'":null;
    const value=dictValue(tag);
    if(value!==null)return quote?escapeFor(value,quote):'0';
    if(quote)return '';
    return bare?'':'0';
  });
}
const STUB=`<script>
window.__qa={alerts:[],errors:[],submits:0};
window.alert=function(m){window.__qa.alerts.push(String(m));};
window.confirm=function(){return false;};
window.prompt=function(){return null;};
window.open=function(){return null;};
window.print=function(){};
window.fetch=function(){return Promise.resolve({ok:true,status:200,text:function(){return Promise.resolve('')},json:function(){return Promise.resolve({})}});};
window.XMLHttpRequest=function(){this.open=function(){};this.send=function(){};this.setRequestHeader=function(){};this.abort=function(){};this.readyState=4;this.status=200;this.responseText='';};
HTMLFormElement.prototype.submit=function(){window.__qa.submits++;};
window.addEventListener('error',function(e){window.__qa.errors.push(String(e.message));});
</script>`;
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent(req.url.split('?')[0]);const entry=pages.get(url.replace('/cgi-bin/','/'));
 if(entry){
  let raw=fs.readFileSync(path.join(ROOT,'overlays',entry.owner,entry.path),'utf8');
  raw=raw.replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi,'');
   let s=expandHtml(expandScripts(raw));
  s=s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,m=>m.replace(/\s+src=["'][^"']*["']/gi,''));
  s=s.replace(/<head([^>]*)>/i,'<head$1>'+STUB);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);return;
 }
 let file;
 for(const base of ['overlays/opendsl-ui','overlays/native-english','overlays/security','analysis/recheck-015-image/candidate-tree']){const p=path.join(ROOT,base,'boaroot/html',url);if(fs.existsSync(p)&&fs.statSync(p).isFile()){file=p;break;}}
 if(!file){res.writeHead(404);res.end();return;}
 let body=fs.readFileSync(file);
 if(url.endsWith('.js')){
  const js=body.toString('utf8');
  const expanded=url==='/state.js'?expandMenuScript(js):expandGenericScript(js,url.endsWith('/general.js'));
  body=Buffer.from(expanded);
 }
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'application/octet-stream'});res.end(body);
});
const CASES=[
 {url:'/Bandwidth_Limiter.asp',containers:['#mainTable table'],expect:'generated bandwidth client table'},
 {url:'/ParentalControl.asp',containers:['#mainTable table'],expect:'generated parental client table',schedule:true},
 {url:'/Guest_network.asp',containers:['#guest_table2','#guest_table5'],expect:'generated guest network summary',guestForm:true},
 {url:'/QoS_EZQoS.asp',containers:['#qos_table'],expect:'generated QoS editor',qosEZ:true},
 {url:'/Advanced_QOSUserPrio_Content.asp',containers:['.FormTable'],expect:'generated QoS priority rows',qosPrio:true},
 {url:'/Advanced_QOSUserRules_Content.asp',containers:['#qos_rulelist_table'],expect:'generated QoS rule list',qosRules:true}
];
async function fillQosRule(p,label){
 const nm=p.locator('input[name="qos_service_name_x_0"]');
 assert.equal(await nm.count(),1,label+' add-row name field missing');
 await p.fill('input[name="qos_service_name_x_0"]','QA UDP');
 await p.fill('input[name="qos_ip_x_0"]','192.168.1.50');
 await p.fill('input[name="qos_port_x_0"]','53');
 await p.evaluate(()=>{const s=document.querySelector('select[name="qos_proto_x_0"]');if(s)s.value='udp';});
 await p.fill('input[name="qos_min_transferred_x_0"]','0');
 await p.fill('input[name="qos_max_transferred_x_0"]','100');
 await p.evaluate(()=>{document.querySelector('select[name="qos_prio_x_0"]').value='1';});
}
async function activateQos(control,label,name,mode,minWidth=36){
 assert.equal(await control.count(),1,label+' '+name+' control missing');
 await control.scrollIntoViewIfNeeded();
 const before=await control.boundingBox();
 assert(before,label+' '+name+' control not laid out');
 assert(before.width>=minWidth&&before.height>=36,label+' '+name+' control not a usable target: '+JSON.stringify(before));
 const atCenter=async()=>control.evaluate(el=>{
  const b=el.getBoundingClientRect();
  const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
  return {isSelf:hit===el,hitTag:hit&&hit.tagName,hitClass:hit&&String(hit.className)};
 });
 const initialHit=await atCenter();
 assert(initialHit.isSelf,label+' '+name+' is not the pointer hit target: '+JSON.stringify(initialHit));
 if(mode==='tap'){
  await control.tap();
 }else{
  await control.hover();
  const hovered=await control.boundingBox();
  assert(hovered&&Math.abs(hovered.width-before.width)<=1&&Math.abs(hovered.height-before.height)<=1,
   label+' '+name+' changed geometry under the pointer: '+JSON.stringify({before,hovered}));
  const hoverHit=await atCenter();
  assert(hoverHit.isSelf,label+' '+name+' lost the pointer hit target on hover: '+JSON.stringify(hoverHit));
  await control.click();
 }
 await control.page().waitForTimeout(350);
 return {before,mode};
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.OPENDSL_CHROMIUM});const results=[];
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  for(const c of CASES){
   const errors=[];page.removeAllListeners('pageerror');page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+c.url,{waitUntil:'load'});
   await page.waitForTimeout(800);
   await page.evaluate(()=>{window.scrollTo(0,0);});
   const data=await page.evaluate(containers=>({
    found:containers.map(sel=>{const n=document.querySelector(sel);return {sel,nodes:n?n.querySelectorAll('tr').length:0,text:n?n.innerText.trim().slice(0,80):null};}),
    theme:!!document.querySelector('[data-opendsl-theme="legacy"]'),
    width:document.documentElement.scrollWidth,viewport:innerWidth,
    shadows:[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).boxShadow!=='none'||getComputedStyle(e).textShadow!=='none').length,
    qa:{alerts:window.__qa.alerts.slice(),errors:window.__qa.errors.slice(),submits:window.__qa.submits},
    wide:[...document.querySelectorAll('body *')].filter(e=>{
      const r=e.getBoundingClientRect();
      return r.right>innerWidth+2 && !e.closest('.od-scroll') && getComputedStyle(e).position!=='fixed';
    }).slice(0,6).map(e=>{
      const r=e.getBoundingClientRect();
      return {tag:e.tagName,id:e.id,cls:String(e.className).slice(0,30),w:Math.round(r.width),right:Math.round(r.right),parent:e.parentElement?e.parentElement.tagName+'#'+e.parentElement.id:null};
    })
   }),c.containers);
   assert.equal(errors.length,0,c.url+' page errors: '+errors.join(' | '));
   assert.equal(data.theme,true,c.url+' theme missing');
   for(const f of data.found)assert(f.nodes>0,c.url+' container empty: '+f.sel);
   assert(data.width<=data.viewport+2,c.url+' overflows: '+data.width+'/'+data.viewport+' '+JSON.stringify(data.wide));
   assert.equal(data.shadows,0,c.url+' shadows present');
   assert.equal(data.qa.submits,0,c.url+' form submitted');
   const row={url:c.url,width,expect:c.expect,containers:data.found,overflow:Math.max(0,data.width-data.viewport)};
   const foot=await page.evaluate(()=>{
    const icon=document.getElementById('bottom_help_FAQ_icon');
    if(!icon)return {present:false};
    const s=getComputedStyle(icon),before=getComputedStyle(icon,'::before');
    return {present:true,bg:s.backgroundImage,mask:before.maskImage||before.webkitMaskImage,bmp:!!Array.from(document.querySelectorAll('img')).find(i=>(i.src||'').includes('bottom_search'))};
   });
   row.footer=foot;
   if(foot.present){
    assert.equal(foot.bg,'none',c.url+' footer bitmap background');
    assert(foot.mask&&foot.mask!=='none',c.url+' footer mask missing');
    assert(!foot.bmp,c.url+' footer bitmap img present');
   }
   await page.screenshot({path:path.join(out,c.url.slice(1).replace('.asp','')+'-'+width+'.png'),fullPage:true});
   if(c.schedule){
    assert.equal(await page.locator('#mainTable input[name="PC_devicename"]').count(),1,c.url+' add-row name field missing');
    assert.equal(await page.locator('#mainTable input[name="PC_mac"]').count(),1,c.url+' add-row MAC field missing');
    await page.evaluate(()=>{window.__qa.errors=[];});
    await page.fill('#mainTable input[name="PC_devicename"]','QA Client');
    await page.fill('#mainTable input[name="PC_mac"]','00:11:22:33:44:55');
    await page.click('#mainTable input.url_btn');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#mainTable input.service_btn').count(),1,c.url+' schedule trigger missing');
    await page.click('#mainTable input.service_btn');
    await page.waitForTimeout(400);
    await page.evaluate(()=>{window.scrollTo(0,0);});
    errors.length=0;
    const grid=await page.evaluate(()=>{
     const t=document.querySelector('#selectable');
     if(!t)return null;
     const main=document.querySelector('#mainTable');
     return {
      rows:t.rows.length,cells:t.querySelectorAll('td').length,
      checked:t.querySelectorAll('td.checked').length,
      legend:!!document.querySelector('#hintBlock table'),
      legendVisible:!!document.querySelector('#hintBlock table')&&getComputedStyle(document.getElementById('hintBlock')).display!=='none',
      width:document.documentElement.scrollWidth,viewport:innerWidth,
      scrollable:main?main.scrollWidth>main.clientWidth:false,
      errors:window.__qa.errors.slice()
     };
    });
    assert(grid,c.url+' schedule grid not rendered');
    assert.equal(errors.length,0,c.url+' schedule page errors: '+errors.join(' | '));
    assert.equal(grid.errors.length,0,c.url+' schedule runtime errors: '+grid.errors.join(' | '));
    assert.equal(grid.rows,25,c.url+' schedule grid rows: '+grid.rows);
    assert.equal(grid.cells,168,c.url+' schedule day cells: '+grid.cells);
    assert(grid.legendVisible,c.url+' schedule legend missing');
    assert(grid.width<=grid.viewport+2,c.url+' schedule overflows: '+grid.width+'/'+grid.viewport);
    assert.equal(await page.evaluate(()=>window.__qa.submits),0,c.url+' schedule submitted a form');
    await page.screenshot({path:path.join(out,'ParentalControl-schedule-'+width+'.png'),fullPage:true});
    row.schedule={rows:grid.rows,cells:grid.cells,checked:grid.checked,legend:grid.legendVisible,scrollable:grid.scrollable,overflow:Math.max(0,grid.width-grid.viewport),syntheticClient:'QA Client / 00:11:22:33:44:55'};
    row.drawingEvidence={summary:true,schedule:true};
   }
   if(c.guestForm){
    const enable=page.locator('#guest_table2 input.button_gen');
    assert.equal(await enable.count(),1,c.url+' guest enable control missing');
    await enable.click();
    await page.waitForTimeout(300);
    const form=await page.evaluate(()=>({
     visible:getComputedStyle(document.getElementById('gnset_table')).display!=='none',
     width:document.documentElement.scrollWidth,viewport:innerWidth,
     submits:window.__qa.submits,errors:window.__qa.errors.slice(),
     wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2&&!e.closest('.od-scroll')&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,cls:String(e.className).slice(0,30),w:Math.round(r.width),x:Math.round(r.x),right:Math.round(r.right),parent:e.parentElement?e.parentElement.tagName+'#'+e.parentElement.id:null};})
    }));
    assert(form.visible,c.url+' guest settings form did not open');
    assert.equal(form.errors.length,0,c.url+' guest form runtime errors: '+form.errors.join(' | '));
    assert.equal(form.submits,0,c.url+' guest form submitted');
    assert(form.width<=form.viewport+2,c.url+' guest form overflows: '+form.width+'/'+form.viewport+' '+JSON.stringify(form.wide));
    const grp=await page.evaluate(()=>{
     const group=document.querySelector('.od-time-fields');
     const day=document.querySelector('select[name="wl_expire_day"]');
     const hr=document.querySelector('input[name="wl_expire_hr"]');
     const min=document.querySelector('input[name="wl_expire_min"]');
     const unlimited=document.querySelector('input[name="wl_expire_radio"][value="0"]');
     const timed=document.querySelector('input[name="wl_expire_radio"][value="1"]');
     const pairs=[...document.querySelectorAll('.od-time-pair')].map(p=>{
      const control=p.querySelector('select,input');
      if(!control)return null;
      const cr=control.getBoundingClientRect();
      const textNodes=[...p.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
      const units=textNodes.map(n=>{const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return {left:+b.left.toFixed(1),right:+b.right.toFixed(1),top:+b.top.toFixed(1),bottom:+b.bottom.toFixed(1),text:n.textContent.trim()};});
      return {name:control.name,control:{left:+cr.left.toFixed(1),right:+cr.right.toFixed(1),top:+cr.top.toFixed(1),bottom:+cr.bottom.toFixed(1)},units};
     }).filter(Boolean);
     return {
      hasGroup:!!group,pairs,day:!!day,hr:!!hr,min:!!min,
      inGroup:day&&hr&&min&&group?group.contains(day)&&group.contains(hr)&&group.contains(min):false,
      unlimitedOutside:unlimited&&group?!group.contains(unlimited):null,
      timedInGroup:timed&&group?group.contains(timed):null,
      hrInForm:hr?!!hr.form:null,
      minInForm:min?!!min.form:null,
      hrHandler:hr?hr.getAttribute('onblur')||hr.getAttribute('onkeypress'):null,
      minHandler:min?min.getAttribute('onblur')||min.getAttribute('onkeypress'):null,
      style:[...document.querySelectorAll('.od-time-pair')].map(p=>{
       const s=getComputedStyle(p);
       const ref=getComputedStyle(document.querySelector('.od-time-unlimited'));
       const matched=[...document.styleSheets].flatMap(sh=>{try{return [...sh.cssRules].filter(r=>r.selectorText&&r.selectorText.includes('od-time-pair')).map(r=>r.cssText.replace(/\s+/g,' '));}catch(e){return[];}});
       return {bg:s.backgroundColor,color:s.color,ref:ref.color,font:s.fontFamily,border:s.borderTopWidth,display:s.display,matched:matched.slice(0,8)};
      })
     };
    });
    assert(grp.day&&grp.hr&&grp.min,'guest time controls missing: '+JSON.stringify(grp));
    assert(grp.hasGroup&&grp.inGroup,'guest time fields not grouped: '+JSON.stringify(grp));
    assert.equal(grp.unlimitedOutside,true,'guest unlimited radio inside timed group');
    assert.equal(grp.timedInGroup,true,'guest timed radio not in group');
    assert.equal(grp.hrInForm&&grp.minInForm,true,'guest time inputs lost form membership');
    assert(grp.hrHandler&&grp.minHandler,'guest time inputs lost native handlers');
    assert.equal(grp.pairs.length,3,'expected three time pairs: '+JSON.stringify(grp.pairs));
    assert.equal(grp.style.length,3,'time pair style probe missing');
    for(const st of grp.style){
     assert(['inline-flex','flex'].includes(st.display),'time pair lost flex container role: '+JSON.stringify(st));
     assert.equal(st.bg,'rgba(0, 0, 0, 0)','time pair inherited legacy teal background: '+JSON.stringify(st));
     assert.equal(st.color,st.ref,'time pair text not ordinary muted colour: '+JSON.stringify(st));
     assert.equal(st.border,'0px','time pair border not cleared: '+JSON.stringify(st));
    }
    for(const pair of grp.pairs){
     assert(pair.units.length>=1,'pair has no unit text: '+JSON.stringify(pair));
     for(const u of pair.units){
      // 16px, not 14: a centered unit inside the 44px control tops out at
      // (44-15)/2 = 14.5px under headless fallback font metrics. That is the
      // intended on-line alignment, not a wrap; a real wrap lands >=44px off
      // and the pair is nowrap + flex:none, so units cannot drop alone.
      assert.equal(Math.abs(u.top-pair.control.top)<=16,true,'unit wraps off the control line: '+JSON.stringify(pair)+' / '+JSON.stringify(u));
      assert(u.left>=pair.control.right-1,'unit is not beside its control: '+JSON.stringify(pair)+' / '+JSON.stringify(u));
      assert(pair.control.left>0&&u.right>u.left,'pair not rendered: '+JSON.stringify(pair));
     }
    }
    await page.screenshot({path:path.join(out,'Guest_network-form-'+width+'.png'),fullPage:true});
    row.form={visible:form.visible,overflow:Math.max(0,form.width-form.viewport)};
    row.drawingEvidence={summary:true,editor:true,wep:false};
   }
   if(c.qosEZ){
    const q=await page.evaluate(()=>{
     const vis=id=>getComputedStyle(document.getElementById(id)).display!=='none';
     const sel=document.getElementById('settingSelection');
     return {
      obw:document.getElementById('obw').value,
      ibw:document.getElementById('ibw').value,
      uploadVis:vis('upload_tr'),downloadVis:vis('download_tr'),typeRowVis:vis('qos_type_tr'),
      tradChecked:document.getElementById('trad_type').checked,
      bwChecked:document.getElementById('bw_limit_type').checked,
      settings:sel?sel.options.length:0,
      settingsText:sel?Array.from(sel.options).map(o=>o.text.trim()):[]
     };
    });
    assert(q.obw==='1'&&q.ibw==='8',c.url+' bandwidth scale fixture: '+JSON.stringify(q));
    assert(q.uploadVis&&q.downloadVis&&q.typeRowVis,c.url+' enable/type rows hidden: '+JSON.stringify(q));
    assert(q.tradChecked&&!q.bwChecked,c.url+' type radios wrong: '+JSON.stringify(q));
    assert(q.settingsText.length>=3,c.url+' settingSelection not filled: '+JSON.stringify(q));
    await page.evaluate(()=>document.getElementById('bw_limit_type').click());
    await page.waitForTimeout(80);
    const q2=await page.evaluate(()=>{
     const vis=id=>getComputedStyle(document.getElementById(id)).display!=='none';
     return {uploadVis:vis('upload_tr'),downloadVis:vis('download_tr'),bwChecked:document.getElementById('bw_limit_type').checked,tradChecked:document.getElementById('trad_type').checked};
    });
    assert(!q2.uploadVis&&!q2.downloadVis,c.url+' bandwidth-limiter branch kept rows: '+JSON.stringify(q2));
    assert(q2.bwChecked&&!q2.tradChecked,c.url+' radio switch failed: '+JSON.stringify(q2));
    await page.evaluate(()=>document.getElementById('trad_type').click());
    await page.waitForTimeout(80);
    const q3=await page.evaluate(()=>{
     const vis=id=>getComputedStyle(document.getElementById(id)).display!=='none';
     return {uploadVis:vis('upload_tr'),downloadVis:vis('download_tr'),tradChecked:document.getElementById('trad_type').checked};
    });
    assert(q3.uploadVis&&q3.downloadVis&&q3.tradChecked,c.url+' traditional branch did not restore rows: '+JSON.stringify(q3));
    const switchProbe=async()=>page.evaluate(()=>{
     const sw=document.querySelector('.iphone_switch_container');
     const img=sw?sw.querySelector('img.iphone_switch'):null;
     const field=document.querySelector('input[name="qos_enable"]');
     const style=img?getComputedStyle(img):null;
     const vis=id=>getComputedStyle(document.getElementById(id)).display!=='none';
     return sw&&img&&field?{
      value:field.value,
      onClass:sw.classList.contains('od-on'),offClass:sw.classList.contains('od-off'),
      bg:style.backgroundColor,knob:style.backgroundImage,
      bpos:style.backgroundPosition,brep:style.backgroundRepeat,
      uploadVis:vis('upload_tr'),downloadVis:vis('download_tr'),typeRowVis:vis('qos_type_tr')
     }:null;
    });
    const on0=await switchProbe();
    assert(on0&&on0.value==='1'&&on0.onClass&&!on0.offClass,c.url+' initial switch state: '+JSON.stringify(on0));
    assert(on0&&on0.knob.includes('88%'),c.url+' enabled knob not right: '+JSON.stringify(on0));
    assert(on0&&on0.uploadVis&&on0.downloadVis,c.url+' enabled rows hidden at start: '+JSON.stringify(on0));
    await page.click('.iphone_switch_container');
    await page.waitForTimeout(700);
     const off=await switchProbe();
     assert(off&&off.value==='0'&&off.offClass&&!off.onClass,c.url+' switch did not turn off: '+JSON.stringify(off));
     assert(off&&off.knob.includes('12%'),c.url+' disabled knob not left: '+JSON.stringify(off));
     assert(off&&off.bpos==='0px 0px',c.url+' disabled switch background-position not pinned: '+JSON.stringify(off));
     assert(off&&off.brep==='no-repeat',c.url+' disabled switch background-repeat not pinned: '+JSON.stringify(off));
     assert(off&&!off.uploadVis&&!off.downloadVis&&!off.typeRowVis,c.url+' disabled rows still visible: '+JSON.stringify(off));
    await page.click('.iphone_switch_container');
    await page.waitForTimeout(700);
    const on1=await switchProbe();
    assert(on1&&on1.value==='1'&&on1.onClass&&!on1.offClass,c.url+' switch did not turn back on: '+JSON.stringify(on1));
    assert(on1&&on1.knob.includes('88%'),c.url+' re-enabled knob wrong: '+JSON.stringify(on1));
    assert(on1&&on1.uploadVis&&on1.downloadVis&&on1.typeRowVis,c.url+' re-enabled rows missing: '+JSON.stringify(on1));
    const saveCheck=await page.evaluate(()=>{
     const save=document.querySelector('div.titlebtn[onclick*="submitQoS"]');
     if(!save)return null;
     const s=getComputedStyle(save);
     return {cls:save.classList.contains('od-primary'),bg:s.backgroundColor,onclick:save.getAttribute('onclick'),tabindex:save.getAttribute('tabindex')};
    });
    assert(saveCheck&&saveCheck.cls,c.url+' QoS Save missing od-primary: '+JSON.stringify(saveCheck));
    assert(saveCheck&&saveCheck.bg==='rgb(35, 128, 251)',c.url+' QoS Save not blue: '+JSON.stringify(saveCheck));
    assert(saveCheck&&/submitQoS/.test(saveCheck.onclick||''),c.url+' QoS Save handler lost: '+JSON.stringify(saveCheck));
    assert.equal(saveCheck&&saveCheck.tabindex,'0',c.url+' QoS Save keyboard access missing');
    if(width<850){
     const layout=await page.evaluate(()=>{
      const obw=document.getElementById('obw');
      const note=document.querySelector('td[rowspan]');
      const save=document.querySelector('div.titlebtn[onclick*="submitQoS"]');
      const r=e=>{const b=e.getBoundingClientRect();return {w:+b.width.toFixed(1),x:+b.left.toFixed(1)};};
      return {obw:obw?r(obw):null,note:note?r(note):null,save:save?r(save):null,viewport:innerWidth};
     });
     assert(layout.obw&&layout.obw.w>=120,c.url+' QoS bandwidth input unusably narrow at '+width+'px: '+JSON.stringify(layout));
     assert(layout.note&&layout.note.w>=layout.viewport*0.7,c.url+' QoS helper cell not full-width at '+width+'px: '+JSON.stringify(layout));
     assert(layout.save&&layout.save.w>=100,c.url+' QoS Save button narrow at '+width+'px: '+JSON.stringify(layout));
    }
    row.qosEZ={obw:q.obw,ibw:q.ibw,settings:q.settingsText,branch:'type0<->type2 native radios',switch:'1->0->1 native iphoneSwitch',saveBlue:true,layout:width>=850?'desktop':'phone'};
    row.drawingEvidence={summary:true,type0:true,type2:true};
   }
    if(c.qosPrio){
     const p=await page.evaluate(()=>{
      const mins=[...document.querySelectorAll('select[name^="upload_bw_min_"]')];
      const maxs=[...document.querySelectorAll('select[name^="upload_bw_max_"]')];
      const downs=[...document.querySelectorAll('select[name^="download_bw_max_"]')];
      const labels=[...document.querySelectorAll('.od-qos-field-label')].map(l=>({
       text:l.textContent.trim(), id:l.id,
       bg:getComputedStyle(l).backgroundColor,
       w:Math.round(l.getBoundingClientRect().width),
       display:getComputedStyle(l).display
      }));
      const named=[...document.querySelectorAll('select[name^="upload_bw_min_"],select[name^="upload_bw_max_"],select[name^="download_bw_max_"]')].map(s=>{
       const refs=(s.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
       const texts=refs.map(id=>{const el=document.getElementById(id);return el?el.textContent.trim():'';}).filter(Boolean);
       return {name:s.name,labelledby:s.getAttribute('aria-labelledby')||'',access:texts.join(' ')};
      });
      const expected={
       upload_bw_min_0:'Minimum Reserved Bandwidth',upload_bw_max_0:'Maximum Bandwidth Limit',
       upload_bw_min_1:'Minimum Reserved Bandwidth',upload_bw_max_1:'Maximum Bandwidth Limit',
       upload_bw_min_2:'Minimum Reserved Bandwidth',upload_bw_max_2:'Maximum Bandwidth Limit',
       upload_bw_min_3:'Minimum Reserved Bandwidth',upload_bw_max_3:'Maximum Bandwidth Limit',
       upload_bw_min_4:'Minimum Reserved Bandwidth',upload_bw_max_4:'Maximum Bandwidth Limit',
       download_bw_max_0:'Maximum Bandwidth Limit',download_bw_max_1:'Maximum Bandwidth Limit',
       download_bw_max_2:'Maximum Bandwidth Limit',download_bw_max_3:'Maximum Bandwidth Limit',
       download_bw_max_4:'Maximum Bandwidth Limit'
      };
      const per = Object.fromEntries(named.map(n=>[n.name,{access:n.access,labelledby:n.labelledby,purpose:expected[n.name]}]));
      const dup = labels.length !== new Set(labels.map(l=>l.id)).size;
      return {
       rows:[mins.length,maxs.length,downs.length],
       opts:mins.map(s=>s.options.length),
       widths:mins.map(s=>Math.round(s.getBoundingClientRect().width)),
       checks:document.querySelectorAll('input[name="qos_ack_checkbox"],input[name="qos_syn_checkbox"],input[name="qos_fin_checkbox"],input[name="qos_rst_checkbox"],input[name="qos_icmp_checkbox"]').length,
       labels,per,dup,
       firstMin:mins[0]?mins[0].selectedIndex:null,
       firstMax:maxs[0]?maxs[0].selectedIndex:null
      };
     });
     assert.equal(JSON.stringify(p.rows),JSON.stringify([5,5,5]),c.url+' priority rows: '+JSON.stringify(p));
     assert(p.opts.every(n=>n>=101),c.url+' option ranges not generated: '+JSON.stringify(p.opts));
     assert.equal(p.checks,5,c.url+' packet checkbox set missing: '+JSON.stringify(p));
     assert.equal(p.dup,false,c.url+' duplicate caption nodes: '+JSON.stringify(p.labels));
     assert.equal(p.labels.length,25,c.url+' expected 25 purpose captions (15 selects + 10 current-setting values): '+p.labels.length);
     assert(p.labels.every(l=>l.text),c.url+' blank caption present: '+JSON.stringify(p.labels));
     assert(p.labels.every(l=>l.bg==='rgba(0, 0, 0, 0)'),c.url+' caption not transparent: '+JSON.stringify(p.labels.map(l=>l.bg)));
     for(const n of Object.values(p.per)){
      assert(n.labelledby,c.url+' '+n.name+' lacks aria-labelledby: '+JSON.stringify(n));
      assert(n.access.includes(n.purpose),c.url+' '+n.name+' wrong purpose: '+JSON.stringify(n));
      assert(/\b(Highest|High|Medium|Low|Lowest)\b/.test(n.access),c.url+' '+n.name+' accessible name lacks priority: '+JSON.stringify(n));
     }
     if(width<850){
      assert(p.widths.every(w=>w>=120),c.url+' priority selects too narrow at '+width+'px: '+JSON.stringify(p.widths));
      const activeLabels=p.labels.filter(l=>l.w>0); assert.equal(activeLabels.length,15); assert(activeLabels.every(l=>l.display==='block'),c.url+' phone caption not rendered: '+JSON.stringify(p.labels.map(l=>l.display)));
     } else {
      assert(p.labels.every(l=>l.display==='none'),c.url+' caption visible on desktop: '+JSON.stringify(p.labels.map(l=>l.display)));
      /* Desktop -> phone resize: captions are built at every viewport and
         the CSS reveals them, so no reload is needed. */
      await page.setViewportSize({width:390,height:1000});
      await page.waitForTimeout(250);
      const rp=await page.evaluate(()=>{
       const ls=[...document.querySelectorAll('.od-qos-field-label')];
       return {n:ls.length,vis:ls.filter(l=>getComputedStyle(l).display==='block').length,w:ls[0]?Math.round(ls[0].getBoundingClientRect().width):0};
      });
      assert.equal(rp.n,25,c.url+' captions missing after desktop->phone resize: '+JSON.stringify(rp));
      assert.equal(rp.vis,25,c.url+' captions hidden after desktop->phone resize: '+JSON.stringify(rp));
      assert(rp.w>0,c.url+' caption unreadable after resize: '+JSON.stringify(rp));
      await page.setViewportSize({width:1440,height:1000});
      await page.waitForTimeout(200);
     }
     row.qosPrio={rows:p.rows,options:p.opts[0],checks:p.checks,minWidth:Math.min(...p.widths),labels:p.labels.length,purposes:Object.keys(p.per).length};
     row.drawingEvidence={summary:true};
    }
    if(c.qosRules){
     /* Persistent container scroller: the native renderer replaces the
        block's children (innerHTML) after add/delete, so the scroller must
        live on #qos_rulelist_Block itself. Exercise the real native
        add/delete handlers through initial -> add -> delete -> empty -> add. */
     const scrollerState=async()=>page.evaluate(()=>{
      const block=document.getElementById('qos_rulelist_Block');
      const t=block?block.querySelector('#qos_rulelist_table'):null;
      const sc=block;
      const desc=document.getElementById('is_qos_enable_desc');
      return {
       blockScrolled:!!block&&block.classList.contains('od-rules-scroll')&&block.classList.contains('od-scroll'),
       rows:t?t.rows.length:0,
       cells:t&&t.rows[0]?t.rows[0].cells.length:0,
       text:t?t.innerText.trim().slice(0,160):null,
       scrollWidth:sc?sc.scrollWidth:0,clientWidth:sc?sc.clientWidth:0,
       cellWidths:t&&t.rows[0]?[...t.rows[0].cells].map(c=>Math.round(c.getBoundingClientRect().width)):[],
       descHidden:desc?getComputedStyle(desc).display==='none':null
      };
     });
     const r0=await scrollerState();
     assert.equal(r0.rows,1,c.url+' rule rows: '+JSON.stringify(r0));
     assert.equal(r0.cells,7,c.url+' rule columns (name/ip/port/proto/transferred/prio-input/action): '+JSON.stringify(r0));
     assert.equal(r0.descHidden,true,c.url+' enable desc not hidden: '+JSON.stringify(r0));
     assert(r0.blockScrolled,c.url+' rule block not the persistent scroller: '+JSON.stringify(r0));
     if(width<850){
      assert(r0.scrollWidth>r0.clientWidth,c.url+' rule list not in real scroller at '+width+'px: '+JSON.stringify(r0));
      assert(r0.cellWidths.every(w=>w>=80),c.url+' rule cells crushed at '+width+'px: '+JSON.stringify(r0.cellWidths));
      assert(/0\.0\.0\.0/.test(r0.text),c.url+' rule IP broken: '+JSON.stringify(r0.text));
     }
     /* Add/delete through real pointer activation. A hover rule used to shrink
        Add to 40x40 so the click landed on the containing cell; geometry and
        hit-testing are asserted here instead of bypassing the pointer. */
     await fillQosRule(page,c.url);
     /* The QoS rule form is a handoff form card: its Add stays a compact
        96px action at phone widths (the native generated tables keep the
        full-width primary). Never demand two contradictory geometries. */
     await activateQos(page.locator('input.add_btn').first(),c.url,'Add rule','click',width<850?96:36);
     const r1=await scrollerState();
     assert.equal(r1.rows,2,c.url+' rule add did not append: '+JSON.stringify(r1));
     assert(r1.blockScrolled,c.url+' scroller lost after add: '+JSON.stringify(r1));
     if(width<850){
      assert(r1.scrollWidth>r1.clientWidth,c.url+' scroller invalid after add: '+JSON.stringify(r1));
      assert(r1.cellWidths.every(w=>w>=80),c.url+' rule cells crushed after add: '+JSON.stringify(r1.cellWidths));
      assert(/192\.168\.1\.50/.test(r1.text)&&/0\.0\.0\.0/.test(r1.text),c.url+' added rule text broken: '+JSON.stringify(r1.text));
     }
     /* Delete the second row with a real pointer. */
     await activateQos(page.locator('#qos_rulelist_table tr').nth(1).locator('input.remove_btn'),c.url,'remove second rule','click');
     const r2=await scrollerState();
     assert.equal(r2.rows,1,c.url+' rule delete did not remove: '+JSON.stringify(r2));
     assert(/QA TCP/.test(r2.text),c.url+' remaining rule lost: '+JSON.stringify(r2.text));
     /* Delete the last rule -> empty message */
     await activateQos(page.locator('#qos_rulelist_table tr').nth(0).locator('input.remove_btn'),c.url,'remove last rule','click');
     const r3=await scrollerState();
     assert(r3.blockScrolled,c.url+' scroller lost on empty state: '+JSON.stringify(r3));
     /* Add again */
     await fillQosRule(page,c.url);
     await activateQos(page.locator('input.add_btn').first(),c.url,'Add rule after empty','click',width<850?96:36);
     const r4=await scrollerState();
     assert.equal(r4.rows,1,c.url+' rule add after empty failed: '+JSON.stringify(r4));
     assert(r4.blockScrolled,c.url+' scroller lost after re-add: '+JSON.stringify(r4));
     assert.equal(await page.evaluate(()=>window.__qa.submits),0,c.url+' rules submitted a form');
     row.qosRules={initial:{rows:r0.rows,scroll:r0.scrollWidth+'>'+r0.clientWidth,cellMin:r0.cellWidths.length?Math.min(...r0.cellWidths):0},afterAdd:{rows:r1.rows,scroll:r1.scrollWidth+'>'+r1.clientWidth,cellMin:r1.cellWidths.length?Math.min(...r1.cellWidths):0},afterDelete:r2.rows,empty:r3.rows>0,reactivated:r4.rows,fixture:'<QA TCP>0.0.0.0>80>tcp>0~100>1 | <QA UDP>192.168.1.50>53>udp>0~100>1'};
     row.drawingEvidence={summary:true,list:true};
    }
   results.push(row);
  }
  await page.close();
 }
 /* R21-01: the native host picker must be measured while it is open. The
    shipped showLANIPList/pullLANIPList/setClientIP handlers drive a synthetic
    client list; the themed menu stays inside the card, below its field and
    clear of the column caption, and keeps pointer and keyboard selection. */
 const pickerOpen=[];
 const pickerControls=[];
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:1100}});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base+'/Advanced_GWStaticRoute_Content.asp',{waitUntil:'load'});
  await page.waitForTimeout(800);
  await page.evaluate(()=>{
   window.clientList=['qa1','qa2'];
   window.clientList.qa1={IP:'192.168.1.50',Name:'QA synthetic client one',ip:'192.168.1.50'};
   window.clientList.qa2={IP:'192.168.1.51',Name:'QA synthetic client two',ip:'192.168.1.51'};
   showLANIPList();
   document.getElementById('pull_arrow').scrollIntoView({block:'center'});
  });
  await page.locator('#pull_arrow').click();
  await page.waitForTimeout(100);
  const opened=await page.evaluate(()=>{
   const list=document.getElementById('ClientList_Block_PC');
   const arrow=document.getElementById('pull_arrow');
   const row=list.closest('.od-picker-row');
   const input=row&&row.querySelector('input[type="text"]');
   const cell=input&&input.closest('td');
   const headerRow=cell&&cell.parentElement.previousElementSibling;
   const phoneCaption=[...document.querySelectorAll('table.od-editor .od-cell-label')].find(l=>getComputedStyle(l).display!=='none'&&l.getBoundingClientRect().height>0);
   const desktopCaption=headerRow&&headerRow.cells?headerRow.cells[cell.cellIndex]:null;
   const caption=phoneCaption||(desktopCaption&&getComputedStyle(desktopCaption).display!=='none'?desktopCaption:null);
   const card=document.querySelector('table.od-editor');
   const rb=e=>{const b=e.getBoundingClientRect();return{x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),r:+b.right.toFixed(1),b:+b.bottom.toFixed(1)};};
   const clips=[];
   for(let a=list.parentElement;a&&a!==document.body;a=a.parentElement){
    const cs=getComputedStyle(a);
    if(cs.overflowX==='visible'&&cs.overflowY==='visible')continue;
    const ar=a.getBoundingClientRect(),lr=list.getBoundingClientRect();
    if(lr.left<ar.left-0.5||lr.right>ar.right+0.5||lr.top<ar.top-0.5||lr.bottom>ar.bottom+0.5)
     clips.push({tag:a.tagName,cls:String(a.className),list:rb(list),ancestor:rb(a)});
   }
   const lr=list.getBoundingClientRect();
   const hit=(x,y)=>{const e=document.elementFromPoint(x,y);return !!(e&&list.contains(e));};
   return {
    list:rb(list),row:row?rb(row):null,arrow:rb(arrow),card:rb(card),
    caption:caption?{text:caption.textContent.trim(),rect:rb(caption)}:null,
    parentClass:list.parentElement.className,display:getComputedStyle(list).display,
    expanded:arrow.getAttribute('aria-expanded'),role:list.getAttribute('role'),
    options:[...list.querySelectorAll('a > div')].map(d=>({role:d.getAttribute('role'),tabindex:d.getAttribute('tabindex')})),
    hits:[hit(lr.left+4,Math.max(lr.top+4,0)),hit(lr.right-4,Math.min(lr.bottom-4,innerHeight-1))],
    clips
   };
  });
  assert.equal(opened.display,'block','static-route picker did not open at '+width+': '+JSON.stringify(opened));
  assert.equal(opened.expanded,'true','static-route picker aria-expanded not synced at '+width+': '+JSON.stringify(opened));
  assert.equal(opened.role,'listbox','static-route picker listbox role missing at '+width+': '+JSON.stringify(opened));
  assert(opened.row&&opened.list.y>=opened.row.b-0.5,'opened picker does not sit below its field row at '+width+': '+JSON.stringify(opened));
  assert(opened.list.x>=opened.card.x-0.5&&opened.list.r<=opened.card.r+0.5,'opened picker escapes the card at '+width+': '+JSON.stringify(opened));
  assert(opened.list.w<=opened.row.w+1,'opened picker wider than its field row at '+width+': '+JSON.stringify(opened));
  assert(opened.caption&&!(opened.list.x<opened.caption.rect.r&&opened.list.r>opened.caption.rect.x&&opened.list.y<opened.caption.rect.b&&opened.list.b>opened.caption.rect.y),'opened picker covers its caption at '+width+': '+JSON.stringify(opened));
  assert.deepEqual(opened.clips,[],'opened picker is clipped at '+width+': '+JSON.stringify(opened.clips));
  assert(opened.hits.every(Boolean),'opened picker is not hit-testable at '+width+': '+JSON.stringify(opened.hits));
  assert(opened.options.length===2&&opened.options.every(o=>o.role==='option'&&o.tabindex==='0'),'picker options are not keyboard options at '+width+': '+JSON.stringify(opened.options));
  await page.screenshot({path:path.join(out,'static-route-picker-open-'+width+'.png'),fullPage:true});
  await page.locator('#ClientList_Block_PC a > div').nth(1).click();
  await page.waitForTimeout(50);
  const selected=await page.evaluate(()=>({value:document.querySelector('.od-picker-row input[type="text"]').value,display:getComputedStyle(document.getElementById('ClientList_Block_PC')).display,expanded:document.getElementById('pull_arrow').getAttribute('aria-expanded')}));
  assert.equal(selected.value,'192.168.1.51','picker selection did not fill the field at '+width+': '+JSON.stringify(selected));
  assert.equal(selected.display,'none','picker did not close after selection at '+width+': '+JSON.stringify(selected));
  assert.equal(selected.expanded,'false','picker aria-expanded not cleared at '+width+': '+JSON.stringify(selected));
  await page.locator('#pull_arrow').click();
  await page.waitForTimeout(50);
  await page.locator('#ClientList_Block_PC a > div').nth(0).focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  const escaped=await page.evaluate(()=>({display:getComputedStyle(document.getElementById('ClientList_Block_PC')).display,expanded:document.getElementById('pull_arrow').getAttribute('aria-expanded'),focus:document.activeElement&&document.activeElement.type==='text',value:document.querySelector('.od-picker-row input[type="text"]').value}));
  assert.equal(escaped.display,'none','Escape did not close the picker at '+width+': '+JSON.stringify(escaped));
  assert.equal(escaped.expanded,'false','Escape did not clear aria-expanded at '+width+': '+JSON.stringify(escaped));
  assert(escaped.focus,'Escape did not return focus to the field at '+width+': '+JSON.stringify(escaped));
  assert.equal(escaped.value,'192.168.1.51','Escape changed the field value at '+width+': '+JSON.stringify(escaped));
  pickerOpen.push({width,opened,selected,escaped});
  /* Negative control: re-create the R21-01 defect shape (menu over the
     caption, wider than the card). The same geometry predicates must reject
     it, and removing the injection must restore the clean state. */
  if(width===390){
   await page.locator('#pull_arrow').click();
   await page.waitForTimeout(50);
   const control=await page.evaluate(()=>{
    const list=document.getElementById('ClientList_Block_PC');
    const card=document.querySelector('table.od-editor');
    const caption=[...document.querySelectorAll('table.od-editor .od-cell-label')].find(l=>getComputedStyle(l).display!=='none'&&l.getBoundingClientRect().height>0);
    const read=()=>{
     const lr=list.getBoundingClientRect(),cr=card.getBoundingClientRect(),cap=caption?caption.getBoundingClientRect():null;
     return {insideCard:lr.left>=cr.left-0.5&&lr.right<=cr.right+0.5,
      coversCaption:!!cap&&lr.left<cap.right&&lr.right>cap.left&&lr.top<cap.bottom&&lr.bottom>cap.top};
    };
    const before=read();
    list.style.setProperty('transform','translateY(-80px)','important');
    list.style.setProperty('width','380px','important');
    list.style.setProperty('max-width','380px','important');
    const injected=read();
    list.style.removeProperty('transform');
    list.style.removeProperty('width');
    list.style.removeProperty('max-width');
    const restored=read();
    return {before,injected,restored};
   });
   assert.deepEqual(control.before,{insideCard:true,coversCaption:false},'picker control baseline not clean: '+JSON.stringify(control));
   assert(control.injected.coversCaption&&!control.injected.insideCard,'picker control: injected caption/width defect was not detected: '+JSON.stringify(control));
   assert.deepEqual(control.restored,control.before,'picker control did not restore clean geometry: '+JSON.stringify(control));
   pickerControls.push({width,result:'defect-shape rejected and restored',...control});
   await page.locator('#pull_arrow').click();
  }
  await page.close();
 }
 /* R21-02: the shipped CPU/RAM renderers must place known 0/50/100% histories
    on the matching grid line and span the plot, including after a live resize.
    Percentages of height are compared, so one assertion covers all widths. */
 const chartSource=fs.readFileSync(path.join(ROOT,'overlays/opendsl-ui/boaroot/cgi-bin/device-map/router_status.asp'),'utf8');
 const chartRenderers=chartSource.slice(chartSource.indexOf('function render_SwapRAM('),chartSource.indexOf('var SwapTotal'));
 const chartCases=[];
 const chartControls=[];
 const chartOffsets=charts=>charts.map(c=>+(((c.trace.y-c.svg.y)/c.plotH)*100).toFixed(2));
 async function measureCharts(page,usage){
  await page.evaluate(u=>{
   const det=document.querySelector('.od-charts-details');if(det)det.open=true;
   window.core_num=1;
   window.cpu1_usage_array=new Array(46).fill(100-u);window.cpu2_usage_array=new Array(46).fill(100-u);
   window.ram_usage_array=new Array(31).fill(100-u);window.swap_ram_usage_array=new Array(31).fill(100-u);
  },usage);
  await page.addScriptTag({content:'var $=function(id){return document.getElementById(id)};var core_num=1;'+chartRenderers+';render_CPU(['+usage+']);render_RAM(100*1024,'+(100-usage)+'*1024,'+usage+'*1024);render_SwapRAM(100*1024,'+(100-usage)+'*1024,'+usage+'*1024);'});
  await page.waitForTimeout(120);
  return page.evaluate(()=>[...document.querySelectorAll('div[style*="background-color:black"] svg')].map(svg=>{
   const rb=e=>{const b=e.getBoundingClientRect();return{x:+b.x.toFixed(2),y:+b.y.toFixed(2),w:+b.width.toFixed(2),h:+b.height.toFixed(2)};};
   const trace=svg.querySelector('polyline');const mid=[...svg.querySelectorAll('line')].find(e=>e.getAttribute('y1')==='50%');
   const text=svg.querySelector('text');const ctm=svg.getScreenCTM();
   const style=getComputedStyle(svg);
   // The theme gives the svg padding-bottom so the bottom stroke half stays
   // inside the padding-edge clip; the viewBox maps into the content box, so
   // plot-height percentages use that box, not the padded border box.
   const plotH=rb(svg).h-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0);
   return {id:trace.id,viewBox:svg.getAttribute('viewBox'),svg:rb(svg),plotH:+plotH.toFixed(2),trace:rb(trace),mid:mid?rb(mid):null,
    vectorEffect:getComputedStyle(trace).vectorEffect,
    label:+(parseFloat(getComputedStyle(text).fontSize)*ctm.a).toFixed(2)};
  }));
 }
 function assertCharts(charts,width,usage){
  assert.equal(charts.length,2,'router-status chart surfaces missing at '+width+': '+JSON.stringify(charts));
  for(const c of charts){
   assert.equal(c.viewBox,'0 0 270 100','chart viewBox missing at '+width+': '+JSON.stringify(c));
   const offset=(c.trace.y-c.svg.y)/c.plotH*100;
   assert(Math.abs(offset-(100-usage))<=1.2,'chart '+usage+'% trace at '+offset.toFixed(2)+'% at '+width+': '+JSON.stringify(c));
   assert(Math.abs(c.trace.w-c.svg.w)<=1.5,'chart trace does not span the plot at '+width+': '+JSON.stringify(c));
   if(c.mid)assert(Math.abs((c.mid.y-c.svg.y)/c.plotH*100-50)<=1.2,'chart midline moved at '+width+': '+JSON.stringify(c));
   assert.equal(c.vectorEffect,'non-scaling-stroke','chart stroke scales at '+width+': '+JSON.stringify(c));
   // The R6 design token sets chart labels to 10px (previews/app.css
   // .chart-labels); fitDeviceCharts compensates the viewBox scale so the
   // rendered label stays 10px at every panel width.
   assert(Math.abs(c.label-10)<=0.35,'chart label is '+c.label+'px at '+width+': '+JSON.stringify(c));
  }
 }
 for(const width of [600,390,320]){
  const page=await browser.newPage({viewport:{width,height:1100}});
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base+'/device-map/router_status.asp',{waitUntil:'load'});
  await page.waitForTimeout(300);
  for(const usage of [0,50,100]){
   const charts=await measureCharts(page,usage);
   assertCharts(charts,width,usage);
   chartCases.push({phase:'fresh',width,usage,charts});
  }
  await page.screenshot({path:path.join(out,'router-status-chart-50pct-'+width+'.png'),fullPage:true});
  await page.close();
 }
 const resizePage=await browser.newPage({viewport:{width:600,height:1100}});
 await resizePage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await resizePage.goto(base+'/device-map/router_status.asp',{waitUntil:'load'});
 await resizePage.waitForTimeout(300);
 for(const width of [600,390,320,600]){
  await resizePage.setViewportSize({width,height:1100});
  await resizePage.waitForTimeout(250);
  const charts=await measureCharts(resizePage,50);
  assertCharts(charts,width,50);
  chartCases.push({phase:'resize',width,usage:50,charts});
 }
 await resizePage.close();
 /* Negative control: dropping the runtime viewBox must reproduce the R21-02
    coordinate drift at 600px and be rejected by the same assertions; putting
    it back must restore the 50% position. */
 const chartControlPage=await browser.newPage({viewport:{width:600,height:1100}});
 await chartControlPage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await chartControlPage.goto(base+'/device-map/router_status.asp',{waitUntil:'load'});
 await chartControlPage.waitForTimeout(300);
 const chartBaseline=await measureCharts(chartControlPage,50);
 assertCharts(chartBaseline,600,50);
 await chartControlPage.evaluate(()=>{[...document.querySelectorAll('div[style*="background-color:black"] svg')].forEach(s=>s.removeAttribute('viewBox'));});
 const chartBroken=await measureCharts(chartControlPage,50);
 let chartRejected=false;
 try{assertCharts(chartBroken,600,50);}catch(e){chartRejected=true;}
 assert(chartRejected,'chart control: removing viewBox was not detected at 600: '+JSON.stringify(chartBroken));
 await chartControlPage.evaluate(()=>{[...document.querySelectorAll('div[style*="background-color:black"] svg')].forEach(s=>s.setAttribute('viewBox','0 0 270 100'));});
 const chartRestored=await measureCharts(chartControlPage,50);
 assertCharts(chartRestored,600,50);
 chartControls.push({width:600,result:'viewBox-removal rejected and restored',baselinePct:chartOffsets(chartBaseline),brokenPct:chartOffsets(chartBroken),restoredPct:chartOffsets(chartRestored)});
 await chartControlPage.close();
 /* Emulated-touch lifecycle at phone widths. Chromium emits compatibility
    mouse events before the final click, which is the path that triggered the
    hover-shrink defect; locator.tap() exercises it without synthetic click(). */
 const touchResults=[];
 for(const width of [390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:true,isMobile:true});
  const tpage=await context.newPage();
  const errors=[];tpage.on('pageerror',e=>errors.push(e.message));
  await tpage.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await tpage.goto(base+'/Advanced_QOSUserRules_Content.asp',{waitUntil:'load'});
  await tpage.waitForTimeout(800);
  const label='QoS emulated touch @'+width;
  assert.equal(await tpage.locator('#qos_rulelist_table tr').count(),1,label+' initial rule count');
  await fillQosRule(tpage,label);
  const added=await activateQos(tpage.locator('input.add_btn').first(),label,'Add rule','tap',96);
  assert.equal(await tpage.locator('#qos_rulelist_table tr').count(),2,label+' tap add did not append');
  await tpage.screenshot({path:path.join(out,'qos-touch-'+width+'-after-add.png'),fullPage:true});
  await activateQos(tpage.locator('#qos_rulelist_table tr').nth(1).locator('input.remove_btn'),label,'remove second rule','tap');
  assert.equal(await tpage.locator('#qos_rulelist_table tr').count(),1,label+' tap remove did not remove');
  await tpage.screenshot({path:path.join(out,'qos-touch-'+width+'-after-remove.png'),fullPage:true});
  assert.equal(await tpage.evaluate(()=>window.__qa.submits),0,label+' submitted a form');
  assert.equal(errors.length,0,label+' page errors: '+errors.join(' | '));
  touchResults.push({width,addTarget:added.before,afterTapAdd:2,afterTapRemove:1});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({
  scope:'Chromium execution of the shipped page scripts with synthetic native values; ASP replaced by dictionary text/neutral tokens; no Boa, modem, network or write path',
  fixture:{viewports:[1440,390,320],touchViewports:[390,320],rcSupport:'2.4G dsl mssid PARENTAL PARENTAL2 iptv wds (synthetic capability profile for the shipped v2 scheduler)',client:'QA Client / 00:11:22:33:44:55 (synthetic, schedule grid only)',guest:'QA Guest / qa-guest-pass (synthetic guest entry, disabled)',systemTime:'Fri, 20 Oct 2026 12:00:00 +0000 (synthetic banner/clock input)'},
  touchLifecycle:touchResults,
  pickerOpen,
  pickerControls,
  charts:chartCases,
  chartControls,
  results
 },null,2));
 console.log(JSON.stringify({result:'PASS',renders:results.length,touchLifecycles:touchResults.length,pickerOpen:pickerOpen.length,pickerControls:pickerControls.length,chartCases:chartCases.length,chartControls:chartControls.length,generated:results.map(r=>r.url.replace('/',''))}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
