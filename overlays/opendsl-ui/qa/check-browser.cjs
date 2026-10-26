const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const statusData = require(path.join(__dirname, '../boaroot/html/opendsl/status-data.js'));
const root = path.resolve(__dirname, '../boaroot');
const xml = '<?xml version="1.0"?><devicemap><wan>2</wan><wan>0</wan><wan>0</wan><wan>wan_line_state=up</wan><wan>wlan0_radio_flag=1</wan><wan>wifi_hw_switch=1</wan><sys>uptimeStr=Sat, 17 Oct 2026 10:20:30 +0000(286920 secs since boot)</sys></devicemap>';
const dsl = 'log_lineState="up";\nlog_Opmode="ITU G.992.5(ADSL2PLUS)";\nlog_AdslType="ANNEX_A";\nlog_DataRateDown="17432 kbps";\nlog_DataRateUp="1024 kbps";\nlog_SNRMarginDown="9.4 dB";\nlog_SNRMarginUp="11.8 dB";\nlog_AttenDown="23.5 dB";\nlog_AttenUp="14.1 dB";\nlog_CRCDown="0";\nlog_CRCUp="0";';
let failing = false;
let loginInfo = {error_status:0,lock_time:0,page:'index.asp'};
let loginIP = '192.168.1.5';
let postedBody = '';

let requests = [];
const server = http.createServer((req,res) => {
 requests.push([req.method,req.url]);
 if(req.url==='/cgi-bin/ajax_status.xml') {res.writeHead(failing?503:200,{'Content-Type':'application/xml'});res.end(failing?'unavailable':xml);return;}
 if(req.url==='/cgi-bin/ajax_AdslStatus.asp') {res.writeHead(200,{'Content-Type':'text/plain'});res.end(dsl+(failing?'\nwindow.injected=true;':''));return;}
 if(req.url==='/login.cgi' && req.method==='POST') {postedBody='';req.on('data',chunk=>postedBody+=chunk);req.on('end',()=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>Mock native login response</p>');});return;}
 const file=path.join(root,req.url.startsWith('/opendsl/')?'html':'cgi-bin',req.url);
 if(!file.startsWith(root)||!fs.existsSync(file)) {res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(file.endsWith('Main_Login.asp') ? fs.readFileSync(file,'utf8').replace('<% login_error_info(); %>',JSON.stringify(loginInfo)).replace('<% login_state_hook(); %>','function login_ip_str(){return '+JSON.stringify(loginIP)+';}') : fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 /* Playwright disables the back/forward cache by default; SFR-01 needs a real
    bfcache restore, so keep Chromium's default and exercise it below. */
 const browser=await chromium.launch({executablePath:process.env.OPENDSL_CHROMIUM,headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
 const results=[];
 assert.equal(statusData.uptimeSeconds('Sat, 17 Oct 2026 10:20:30 +0000(286920 secs since boot)'),286920);
 assert.equal(statusData.uptimeSeconds('Sat, 17 Oct 2026 10:20:30 +0000(0 days, 3 hours, 19 minutes, 52 seconds since boot)'),11992);
 assert.equal(statusData.lineModeLabel('ITU G.992.5(ADSL2PLUS)'),'ADSL2+');
 assert.equal(statusData.lineModeLabel('ITU G.992.3(ADSL2)'),'ADSL2');
 assert.deepEqual(statusData.formatRate('16384 kbps'),{value:'16.4',unit:'Mbps'});
 assert.deepEqual(statusData.formatRate('1024 kbps'),{value:'1.0',unit:'Mbps'});
 results.push('Uptime parser accepts bare seconds and SHOWALL day/hour text; line-mode mapping is concise');
 try {
 const context=await browser.newContext({viewport:{width:1586,height:992},reducedMotion:'reduce',locale:'en-US'});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/OpenDSL.asp');
 await page.waitForFunction(()=>document.getElementById('notice-text').textContent.startsWith('Status loaded'));
 assert.equal(await page.locator('#internet-status').innerText(),'Connected');
 assert.equal(await page.locator('#wireless-summary').innerText(),'Enabled · 2.4 GHz');
 await page.locator('#dsl-details').evaluate(node=>node.open=true);
 assert.equal(await page.locator('#rate-down').innerText(),'17.4');assert.equal(await page.locator('#system-uptime').innerText(),'3d 07h');assert.equal(await page.locator('#dsl-mode').innerText(),'ADSL2+');results.push('Two bounded same-origin GET endpoints render real-shaped status, uptime and a concise line mode');
 assert.equal(await page.locator('form').count(),0);
 const overviewText=await page.locator('body').innerText();
 assert(!/demo|sample|ASUS|IPv6/i.test(overviewText),'overview carries demo, legacy or IPv6 content');
 assert(!/\b(lorem|ipsum|placeholder|example\.com|TODO)\b/i.test(overviewText),'overview carries placeholder copy');
 for(const [href,label] of [['/Guest_network.asp','Guest network'],['/QoS_EZQoS.asp','Traffic manager'],['/ParentalControl.asp','Access controls']])
  assert.equal((await page.locator('.sidebar a[href="'+href+'"]').innerText()).trim(),label,'native route '+href);
 assert.equal(await page.locator('a[href="/Advanced_FirmwareUpgrade_Content.asp"]').count(),1);
 assert.equal(await page.locator('a[href="/Logout.asp"]').count(),1);results.push('No demo data or writes; native update, settings and logout routes remain');
 await page.waitForTimeout(1200);assert.equal(requests.filter(r=>r[0]!=='GET').length,0);assert.equal(requests.filter(r=>r[1].startsWith('/cgi-bin/ajax_')).length,2);results.push('No automatic polling or POST requests');
 await page.screenshot({path:'/tmp/opendsl-production-panel-desktop.png',fullPage:true});
 failing=true;await page.locator('#refresh-button').click();await page.waitForFunction(()=>document.getElementById('notice').classList.contains('error'));
 assert.equal(await page.locator('#internet-status').innerText(),'Not read');assert.equal(await page.locator('#rate-down').innerText(),'—');assert.equal(await page.evaluate(()=>window.injected),undefined);results.push('Failed status and injected executable text rejected without stale/sample fallback');
 /* The loopback fixture is shared by every context in this process; leaving
    the failure switch on makes the later history/navigation pages load an
    error instead of the real-shaped status they assert. */
 failing=false;
 for(const width of [320,390,768,1024,1586]) {await page.setViewportSize({width,height:992});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 results.push('No page horizontal overflow at 320,390,768,1024,1586 px');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('sidebar').inert===true);assert.equal(await page.locator('#sidebar').evaluate(node=>node.inert),true);await page.locator('#menu-toggle').click();assert.equal(await page.locator('#sidebar').evaluate(node=>node.inert),false);assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#sidebar').evaluate(node=>node.inert),true);results.push('Mobile menu opens and Escape closes; hidden links cannot take focus');
 await page.screenshot({path:'/tmp/opendsl-production-panel-mobile.png',fullPage:true});
 const navPage=await context.newPage();
 await navPage.goto(origin+'/OpenDSL.asp');
 const modernNav=await navPage.evaluate(()=>{const a=document.querySelector('.sidebar a[href="/Guest_network.asp"]');a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));return{active:[...document.querySelectorAll('.nav-item.active')].map(e=>e.textContent.trim()),leaving:document.body.classList.contains('od-leaving'),reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches};});
 assert(modernNav.active.length===1&&modernNav.active[0]==='Guest network','modern sidebar click does not select its destination before loading: '+JSON.stringify(modernNav));
 assert.equal(modernNav.reduced,true,'reduced-motion context did not report reduce: '+JSON.stringify(modernNav));
 assert.equal(modernNav.leaving,false,'reduced motion still applies the fade: '+JSON.stringify(modernNav));
 await navPage.waitForURL('**/Guest_network.asp');
 assert.equal((await navPage.locator('.od-page-head .formfonttitle').innerText()).trim(),'Guest network');
 await navPage.close();
 results.push('Modern sidebar click moves the active marker immediately; reduced motion skips the fade and the destination keeps the selection');
 /* SFR-01/SFR-07: normal motion, real cross-shell destination, and actual
    browser Back/Forward restoration. The source fix clears a frozen fade on
    pageshow; the assertions below fail on the former transparent page even
    when a synthetic click alone looks correct. */
 const motionContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',locale:'en-US'});
 const motionPage=await motionContext.newPage();
 await motionPage.goto(origin+'/OpenDSL.asp');
 await motionPage.waitForFunction(()=>document.getElementById('notice-text').textContent.startsWith('Status loaded'));
 const modernBase=await motionPage.evaluate(()=>{
  const geo=el=>{const cs=getComputedStyle(el),b=el.getBoundingClientRect();return{height:+b.height.toFixed(1),width:+b.width.toFixed(1),borderWidth:cs.borderLeftWidth,borderColor:cs.borderLeftColor,radius:[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '),paddingLeft:cs.paddingLeft};};
  const items=[...document.querySelectorAll('.sidebar a.nav-item')],active=document.querySelector('.sidebar a.nav-item.active');
  return {count:items.length,destinations:items.map(a=>[a.textContent.trim(),a.getAttribute('href')]),heights:[...new Set(items.map(a=>Math.round(a.getBoundingClientRect().height)))],widths:[...new Set(items.map(a=>Math.round(a.getBoundingClientRect().width)))],active:{label:active&&active.textContent.trim(),...geo(active)}};
 });
 assert.equal(modernBase.count,13,'modern navigation item count changed: '+JSON.stringify(modernBase));
 assert(modernBase.destinations.some(([label,href])=>label==='Network tools'&&href==='/Main_Analysis_Content.asp'),'modern navigation lost Network tools: '+JSON.stringify(modernBase.destinations));
 assert.deepEqual(modernBase.heights,[48],'modern navigation rows are not all 48px: '+JSON.stringify(modernBase.heights));
 assert.equal(modernBase.widths.length,1,'modern navigation rows have different widths: '+JSON.stringify(modernBase.widths));
 assert.equal(modernBase.active.label,'Overview','modern active row is not Overview: '+JSON.stringify(modernBase.active));
 assert.equal(modernBase.active.height,48,'active modern row is not 48px: '+JSON.stringify(modernBase.active));
 assert.equal(modernBase.active.borderWidth,'4px','active modern row lost its 4px edge: '+JSON.stringify(modernBase.active));
 assert.equal(modernBase.active.borderColor,'rgb(57, 167, 255)','active modern row edge colour changed: '+JSON.stringify(modernBase.active));
 assert.equal(modernBase.active.radius,'0px 9px 9px 0px','active modern row shape changed: '+JSON.stringify(modernBase.active));
 const motionClick=await motionPage.evaluate(()=>{
  const item=[...document.querySelectorAll('.sidebar a.nav-item')].find(a=>a.getAttribute('href')==='/ParentalControl.asp');
  item.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  const active=document.querySelector('.sidebar a.nav-item.active'),cs=getComputedStyle(active),b=active.getBoundingClientRect();
  return {active:active.textContent.trim(),leaving:document.body.classList.contains('od-leaving'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,height:+b.height.toFixed(1),borderWidth:cs.borderLeftWidth,borderColor:cs.borderLeftColor};
 });
 assert.equal(motionClick.reduced,false,'normal-motion context reported reduce: '+JSON.stringify(motionClick));
 assert.equal(motionClick.active,'Access controls','normal-motion click did not select its destination: '+JSON.stringify(motionClick));
 assert.equal(motionClick.leaving,true,'normal-motion click did not start the fade: '+JSON.stringify(motionClick));
 assert.equal(motionClick.height,48,'selected normal-motion row is not 48px: '+JSON.stringify(motionClick));
 await motionPage.waitForURL('**/ParentalControl.asp',{timeout:5000});
 await motionPage.waitForLoadState('load');await motionPage.waitForTimeout(250);
 const motionArrival=await motionPage.evaluate(()=>{
  const active=document.querySelector('#mainMenu .od-nav-item.od-current'),cs=active?getComputedStyle(active):null,b=active?active.getBoundingClientRect():null;
  return {leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,active:active&&active.textContent.trim(),height:b?+b.height.toFixed(1):null,borderWidth:cs?cs.borderLeftWidth:null,borderColor:cs?cs.borderLeftColor:null,radius:cs?[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '):null};
 });
 assert.equal(motionArrival.leaving,false,'arrival page kept the leaving class: '+JSON.stringify(motionArrival));
 assert.equal(motionArrival.opacity,'1','arrival page is still faded: '+JSON.stringify(motionArrival));
 assert.equal(motionArrival.active,'Access controls','destination navigation row is not selected: '+JSON.stringify(motionArrival));
 assert.equal(motionArrival.height,48,'destination selected row is not 48px: '+JSON.stringify(motionArrival));
 assert.equal(motionArrival.borderWidth,'4px','destination selected row lost its 4px edge: '+JSON.stringify(motionArrival));
 assert.equal(motionArrival.borderColor,'rgb(57, 167, 255)','destination selected row edge colour changed: '+JSON.stringify(motionArrival));
 await motionPage.emulateMedia({reducedMotion:'reduce'});
 const reducedClick=await motionPage.evaluate(()=>{
  const item=[...document.querySelectorAll('#mainMenu .od-nav-item')].find(n=>n.getAttribute('data-od-href')==='/QoS_EZQoS.asp');
  item.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  return {leaving:document.body.classList.contains('od-leaving'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
 });
 assert.equal(reducedClick.reduced,true,'legacy reduced-motion context reported no-preference: '+JSON.stringify(reducedClick));
 assert.equal(reducedClick.leaving,false,'reduced motion still starts the legacy fade: '+JSON.stringify(reducedClick));
 await motionPage.waitForURL('**/QoS_EZQoS.asp',{timeout:5000});
 await motionContext.close();
 results.push('Normal motion starts and clears the cross-shell fade; reduced motion navigates without one');
 /* Real clicks and real history, with bfcache enabled. page.goBack/goForward
    time out waiting for a load event after a bfcache restore even though the
    restore has completed; the failures are captured and the restored document
    is asserted directly. */
 const historyContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',locale:'en-US'});
 const historyPage=await historyContext.newPage();
 await historyPage.addInitScript(()=>{window.addEventListener('pageshow',e=>{window.__odPageshow={persisted:e.persisted,at:Date.now()};});});
 await historyPage.goto(origin+'/OpenDSL.asp');
 await historyPage.waitForFunction(()=>document.getElementById('notice-text').textContent.startsWith('Status loaded'));
 assert.equal(await historyPage.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false,'history page unexpectedly has reduced motion');
 await historyPage.locator('.sidebar a[href="/Guest_network.asp"]').click();
 await historyPage.waitForURL('**/Guest_network.asp',{timeout:5000});
 await historyPage.waitForLoadState('load');await historyPage.waitForTimeout(300);
 const historyArrival=await historyPage.evaluate(()=>{
  const active=document.querySelector('#mainMenu .od-nav-item.od-current'),cs=active?getComputedStyle(active):null,b=active?active.getBoundingClientRect():null;
  return {url:location.pathname,leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,active:active&&active.textContent.trim(),height:b?+b.height.toFixed(1):null,borderWidth:cs?cs.borderLeftWidth:null,borderColor:cs?cs.borderLeftColor:null};
 });
 assert.equal(historyArrival.url,'/Guest_network.asp','real sidebar click did not reach its destination: '+JSON.stringify(historyArrival));
 assert.equal(historyArrival.active,'Guest network','destination row is not selected after a real click: '+JSON.stringify(historyArrival));
 assert.equal(historyArrival.leaving,false,'destination page kept the fade after a real click: '+JSON.stringify(historyArrival));
 assert.equal(historyArrival.height,48,'destination row collapsed after a real click: '+JSON.stringify(historyArrival));
 assert.equal(historyArrival.borderWidth,'4px','destination row lost its edge after a real click: '+JSON.stringify(historyArrival));
 let backError=null;await historyPage.goBack({waitUntil:'load',timeout:5000}).catch(error=>{backError=String(error).split('\n')[0];});
 await historyPage.waitForTimeout(500);
 const backRestore=await historyPage.evaluate(()=>{
  const active=document.querySelector('.sidebar a.nav-item.active'),b=active&&active.getBoundingClientRect();
  const hit=b?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
  return {url:location.pathname,pageshow:window.__odPageshow||null,leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,pointerEvents:getComputedStyle(document.body).pointerEvents,visibility:getComputedStyle(document.body).visibility,active:active&&active.textContent.trim(),hit:hit&&{tag:hit.tagName,nav:!!hit.closest('.sidebar')}};
 });
 assert.equal(backRestore.url,'/OpenDSL.asp','Back did not restore the overview: '+JSON.stringify({backError,backRestore}));
 assert(backRestore.pageshow&&backRestore.pageshow.persisted===true,'Back did not restore from bfcache: '+JSON.stringify({backError,backRestore}));
 assert.equal(backRestore.leaving,false,'restored overview kept the frozen fade: '+JSON.stringify(backRestore));
 assert.equal(backRestore.opacity,'1','restored overview is transparent: '+JSON.stringify(backRestore));
 assert.equal(backRestore.pointerEvents,'auto','restored overview blocks pointer input: '+JSON.stringify(backRestore));
 assert.equal(backRestore.active,'Overview','restored overview lost its selected row: '+JSON.stringify(backRestore));
 assert(backRestore.hit&&backRestore.hit.tag==='A'&&backRestore.hit.nav,'restored overview has no clickable navigation row: '+JSON.stringify(backRestore));
 let forwardError=null;await historyPage.goForward({waitUntil:'load',timeout:5000}).catch(error=>{forwardError=String(error).split('\n')[0];});
 await historyPage.waitForTimeout(500);
 const forwardRestore=await historyPage.evaluate(()=>{
  const active=document.querySelector('#mainMenu .od-nav-item.od-current'),b=active&&active.getBoundingClientRect();
  const hit=b?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
  return {url:location.pathname,pageshow:window.__odPageshow||null,leaving:document.body.classList.contains('od-leaving'),opacity:getComputedStyle(document.body).opacity,pointerEvents:getComputedStyle(document.body).pointerEvents,active:active&&active.textContent.trim(),hit:hit&&{tag:hit.tagName,nav:!!hit.closest('#mainMenu')}};
 });
 assert.equal(forwardRestore.url,'/Guest_network.asp','Forward did not restore the destination: '+JSON.stringify({forwardError,forwardRestore}));
 assert(forwardRestore.pageshow&&forwardRestore.pageshow.persisted===true,'Forward did not restore from bfcache: '+JSON.stringify({forwardError,forwardRestore}));
 assert.equal(forwardRestore.leaving,false,'forward-restored destination kept the frozen fade: '+JSON.stringify(forwardRestore));
 assert.equal(forwardRestore.opacity,'1','forward-restored destination is transparent: '+JSON.stringify(forwardRestore));
 assert.equal(forwardRestore.pointerEvents,'auto','forward-restored destination blocks pointer input: '+JSON.stringify(forwardRestore));
 assert.equal(forwardRestore.active,'Guest network','forward-restored destination lost its selected row: '+JSON.stringify(forwardRestore));
 assert(forwardRestore.hit&&forwardRestore.hit.nav,'forward-restored destination has no clickable navigation row: '+JSON.stringify(forwardRestore));
 await historyContext.close();
 results.push('Motion-enabled real Back/Forward restore both shells visible, selected and clickable from bfcache');
 await page.goto(origin+'/Main_Login.asp');
 assert.equal(await page.title(),'OpenDSL · Sign in');
 assert.equal(await page.locator('#login-form').getAttribute('method'),'post');assert.equal(await page.locator('#login-form').getAttribute('action'),'/login.cgi');
 assert.equal(await page.locator('#username').getAttribute('maxlength'),'20');assert.equal(await page.locator('#password').getAttribute('maxlength'),'16');
 assert(!/demo|sample|ASUS/i.test(await page.locator('body').innerText()));
 await page.locator('#password').fill('test-pass+&');await page.locator('#password-toggle').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');await page.locator('#password-toggle').click();
 await page.locator('#username').fill('  admin  ');
 const post = page.waitForRequest(req=>req.method()==='POST'&&req.url()===origin+'/login.cgi');
 await page.locator('#signin-button').click();const req = await post;await page.waitForLoadState();
 const body = new URLSearchParams(req.postData());
 assert.equal(body.get('login_authorization'),Buffer.from('admin:test-pass+&').toString('base64'));
 assert.equal(body.get('current_page'),'Main_Login.asp');assert.equal(body.get('next_page'),'index.asp');assert.equal(body.get('action_wait'),'5');
 assert.equal(body.has('login_username'),false);assert.equal(body.has('login_passwd'),false);
 assert(req.headers().referer.startsWith(origin+'/Main_Login.asp'));
 assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
 assert(!page.url().includes('test-pass'));results.push('Login posts native Base64 field and stock hidden fields with same-origin Referer; no credential storage');
 loginInfo={error_status:3,lock_time:0,page:'//outside.invalid/evil.asp'};
 await page.goto(origin+'/Main_Login.asp');assert.match(await page.locator('#login-note').innerText(),/Invalid username/);assert.equal(await page.locator('#login-note').isVisible(),true);
 await page.locator('#username').fill('admin');await page.locator('#password').fill('test');
 const retry = page.waitForRequest(req=>req.method()==='POST'&&req.url()===origin+'/login.cgi');await page.locator('#signin-button').click();assert.equal(new URLSearchParams((await retry).postData()).get('next_page'),'index.asp');await page.waitForLoadState();
 results.push('Account error remains visible; redirect is fixed to local first-run landing page');
 for(const flag of [7,8,9]) {loginInfo={error_status:flag,lock_time:10,page:'index.asp'};await page.goto(origin+'/Main_Login.asp');assert.equal(await page.locator('#login-form').isVisible(),false);assert.equal(await page.locator('#login-state').isVisible(),true);}
 assert.match(await page.locator('#login-state').innerText(),/192.168.1.5/);
 results.push('Backend lockout, logout and concurrent-login states suppress credential form');
 loginInfo=null;await page.goto(origin+'/Main_Login.asp');assert.equal(await page.locator('#login-form').isVisible(),false);assert.match(await page.locator('#login-state').innerText(),/valid sign-in state/);results.push('Missing native login state fails closed');
 loginInfo={error_status:0,lock_time:0,page:'index.asp'};await page.goto(origin+'/Main_Login.asp');
 for(const width of [320,390,768,1024,1586]) {await page.setViewportSize({width,height:992});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'login overflow '+width);}
 await page.screenshot({path:'/tmp/opendsl-production-login-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/opendsl-production-login-mobile.png',fullPage:true});
 results.push('Login fits 320–1586px, has no demo paths and does not write storage');
 assert.deepEqual(errors,[]);results.push('No JavaScript page errors');
 console.log(JSON.stringify({scope:'Synthetic loopback browser integration, not modem/Boa execution',results},null,2));
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
