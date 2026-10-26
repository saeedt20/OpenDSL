// Native Traffic Monitor lifecycle fixture.
//
// Serves the shipped Main_TrafficMonitor_realtime.asp together with the real
// state.js/general.js/popup.js menu and page scripts. ASP tags are translated
// from the shipped dictionary and an explicit capability profile; no modem,
// network or backend is contacted. This reproduces the body-onload
// show_menu() -> browser_compatibility() wrapper that the older fixtures
// stubbed out, so the final DOM ancestry and geometry are the real ones.
//
// Run: node overlays/opendsl-ui/qa/check-native-traffic.cjs [label]
// Writes evidence/<label>-traffic.json and captures/<label>-traffic-*.png.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../../..');
const HERE = path.join(ROOT, 'analysis/ui-request-regressions');
const { chromium } = require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const label = process.argv[2] || 'after';
const assetDir = label === 'before' ? path.join(ROOT, 'analysis/postflash-fixes-0.1.27-2026-10-26/before-assets') :
  path.join(ROOT, 'overlays/opendsl-ui/boaroot/html/opendsl');
const route = '/Main_TrafficMonitor_realtime.asp';
const caps = {
  rc_support: '2.4G dsl mssid PARENTAL iptv wds feedback ipt_webmon spectrum',
  ProductName: 'DSL-N12E-C1',
  ProductTitle: 'DSL-N12E-C1',
  Web_Title2: 'DSL-N12E C1',
  hideQIS: 'NO',
  wans_dualwan: 'adsl none',
  get_wan_unit: '0',
  wl0_auth_mode: 'WPA2PSK',
  wl_unit: '0',
  havePtm: 'No',
  TransMode: 'ATM',
  wl0_ssid: 'OpenDSL Home'
};

const dict = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'overlays/native-english/userfs/EN.dict'), 'utf8')
  .split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));

function resolveHtml(requestPath) {
  for (const base of ['overlays/native-english', 'analysis/recheck-015-image/candidate-tree', 'analysis/rootfs', 'overlays/opendsl-ui']) {
    const file = path.join(ROOT, base, 'boaroot/html', requestPath);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function translate(source) {
  return source.replace(/<%[\s\S]*?%>/g, (tag) => {
    const entry = tag.match(/String_Entry"\s*,\s*"([^"]+)"/i);
    if (entry) {
      const value = dict[entry[1]] || entry[1];
      return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
    }
    for (const [key, value] of Object.entries(caps)) {
      if (new RegExp(key, 'i').test(tag)) return value;
    }
    if (/wl_get_[25]G_guestnetwork/.test(tag)) return '[]';
    if (/get_wl_channel_skiplist|get_wl_channel_list/.test(tag)) return '';
    if (/available_disk|disk_pool/.test(tag)) return '';
    if (/wl_nband_info/.test(tag)) return '[2]';
    if (/char_to_ascii/.test(tag)) return 'OpenDSL Home';
    return '0';
  });
}

const fixtureGlobals = `
window.require = function () {};
window.supportsite_model = function () { return 'DSL-N12E-C1'; };
window.get_supportsite_lang = function () { return 'en-us'; };`;

const assetHashes = {
  css: crypto.createHash('sha256').update(fs.readFileSync(path.join(assetDir, 'legacy.css'))).digest('hex'),
  js: crypto.createHash('sha256').update(fs.readFileSync(path.join(assetDir, 'legacy.js'))).digest('hex')
};

function startServer(jquery) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.invalid');
    const requestPath = url.pathname;
    const send = (body, type = 'text/html; charset=utf-8') => {
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-OpenDSL-Fixture': 'native-traffic'
      });
      res.end(body);
    };
    if (requestPath === '/blank.html') return send('<!doctype html><title>blank</title><p>blank</p>');
    if (requestPath === route) {
      let source = translate(fs.readFileSync(path.join(ROOT, 'overlays/native-english/boaroot/cgi-bin/Main_TrafficMonitor_realtime.asp'), 'utf8'));
      source = source.replace('<head>', '<head>' + (jquery ? '<script src="/jquery.js"></script>' : '') + '<script>' + fixtureGlobals + (jquery ? 'window.$j=jQuery.noConflict();' : '') +
        '\nwindow.__odErrors=[];window.addEventListener("error",function(e){window.__odErrors.push(String(e.message));});</script>');
      return send(source);
    }
    if (requestPath === '/state.js') {
      let source = translate(fs.readFileSync(path.join(ROOT, 'overlays/native-english/boaroot/html/state.js'), 'utf8'));
      source = source.replace(/document\.write\('<script[^']*require\.min\.js[^']*><\/script>'\);/g, '');
      source = source.replace(/document\.write\('<script[^']*support_site\.js[^']*><\/script>'\);/g, '');
      return send(source, 'text/javascript');
    }
    if (requestPath === '/help.js') {
      let source = translate(fs.readFileSync(path.join(ROOT, 'analysis/recheck-015-image/candidate-tree/boaroot/html/help.js'), 'utf8'));
      const cut = source.indexOf('// init Helper');
      if (cut > 0) source = source.slice(0, cut);
      return send(source, 'text/javascript');
    }
    if (requestPath === '/opendsl/legacy.css') {
      return send(fs.readFileSync(path.join(assetDir, 'legacy.css')), 'text/css');
    }
    if (requestPath === '/opendsl/legacy.js') {
      return send(fs.readFileSync(path.join(assetDir, 'legacy.js')), 'text/javascript');
    }
    if (requestPath === '/update.asp') return send('netdev={};', 'text/plain');
    if (requestPath === '/require/require.min.js') return send('window.require=function(){};', 'text/javascript');
    if (requestPath === '/js/support_site.js') return send('window.supportsite_model=function(){return "DSL-N12E-C1"};', 'text/javascript');
    const file = resolveHtml(requestPath);
    if (!file) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(file).toLowerCase();
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }[ext] || 'application/octet-stream';
    let body = fs.readFileSync(file);
    if (ext === '.js') body = Buffer.from(translate(body.toString('utf8')));
    send(body, type);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    server,
    base: 'http://127.0.0.1:' + server.address().port
  })));
}

function measure() {
  const rect = (node) => {
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return {
      top: +box.top.toFixed(2), bottom: +box.bottom.toFixed(2),
      left: +box.left.toFixed(2), right: +box.right.toFixed(2),
      width: +box.width.toFixed(2), height: +box.height.toFixed(2)
    };
  };
  const tabMenu = document.getElementById('tabMenu');
  const cell = document.querySelector('.od-content-cell');
  const head = document.querySelector('.od-page-head');
  const title = document.querySelector('.od-page-head .formfonttitle');
  const group = document.querySelector('.od-page-head .od-eyebrow');
  const nav = document.querySelector('.od-nav-cell');
  const brand = document.querySelector('.banner1 > span:first-child');
  const wrap = tabMenu && tabMenu.parentNode;
  const styles = (node) => {
    if (!node) return null;
    const css = getComputedStyle(node);
    return { display: css.display, position: css.position, width: css.width, marginTop: css.marginTop, overflowX: css.overflowX };
  };
  return {
    bodyClass: document.body.className,
    ready: document.body.classList.contains('od-ready'),
    pageErrors: window.__odErrors ? window.__odErrors.slice() : [],
    tabs: tabMenu ? Array.from(tabMenu.querySelectorAll('.tab, .tabclick')).map((node) => ({
      label: (node.textContent || '').trim(),
      href: node.closest('a') ? node.closest('a').getAttribute('href') : null,
      active: node.classList.contains('tabclick')
    })) : [],
    tabParent: wrap ? { tag: wrap.tagName, style: wrap.getAttribute('style'), cls: wrap.className } : null,
    tabAncestors: tabMenu ? (() => {
      const list = [];
      for (let node = tabMenu; node && node !== document.body; node = node.parentNode) {
        if (node.nodeType === 1) list.push(node.tagName + (node.id ? '#' + node.id : '') + (node.className ? '.' + String(node.className).trim().replace(/\s+/g, '.') : ''));
      }
      return list;
    })() : [],
    contentCell: cell ? { tag: cell.tagName, cls: cell.className, children: Array.from(cell.children).map((node) => node.tagName + (node.id ? '#' + node.id : '') + (node.className ? '.' + String(node.className).trim().replace(/\s+/g, '.') : '')) } : null,
    contentCellIsTabCell: !!(cell && tabMenu && cell.contains(tabMenu)),
    head: rect(head),
    title: rect(title),
    group: rect(group),
    tabsBox: rect(tabMenu),
    nav: rect(nav),
    brand: rect(brand),
    brandInNav: !!(nav && brand && nav.contains(brand)),
    navPosition: nav ? getComputedStyle(nav).position : null,
    brandPosition: brand ? getComputedStyle(brand).position : null,
    headStyle: styles(head),
    headMargins: head ? { bottom: getComputedStyle(head).marginBottom, top: getComputedStyle(head).marginTop } : null,
    tabMargins: tabMenu ? { top: getComputedStyle(tabMenu).marginTop, bottom: getComputedStyle(tabMenu).marginBottom } : null,
    tabStyle: styles(tabMenu),
    cellBox: rect(cell),
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  };
}

function intersect(a, b) {
  if (!a || !b) return false;
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function check(name, info, width) {
  if (process.env.OPENDSL_FIXTURE_ASSERT === '0') return;
  assert.equal(info.ready, true, name + ': legacy enhancement did not reach od-ready');
  assert.deepEqual(info.pageErrors, [], name + ': page errors at ' + width + 'px: ' + JSON.stringify(info.pageErrors));
  assert.equal(info.tabs.length, 4, name + ': expected the native four-tab profile at ' + width + 'px, got ' + JSON.stringify(info.tabs));
  const labels = info.tabs.map((tab) => tab.label);
  assert.deepEqual(labels, ['QoS', 'Traffic Monitor', 'Web History', 'Spectrum'], name + ': tab labels changed at ' + width + 'px: ' + JSON.stringify(labels));
  assert.deepEqual(info.tabs.map((tab) => tab.href), ['QoS_EZQoS.asp', null, 'Main_WebHistory_Content.asp', 'Main_Spectrum_Content.asp'], name + ': tab destinations changed at ' + width + 'px');
  assert.equal(info.contentCellIsTabCell, true, name + ': content cell is not the tab-owned cell at ' + width + 'px: ' + JSON.stringify(info.tabAncestors));
  assert(!(info.tabParent && info.tabParent.tag === 'DIV' && /-140/.test(info.tabParent.style || '')), name + ': native negative-margin wrapper survived at ' + width + 'px: ' + JSON.stringify(info.tabParent));
  assert(info.head && info.head.width > 0, name + ': themed header has no width at ' + width + 'px: ' + JSON.stringify(info.head));
  assert(info.title && info.title.width > 0, name + ': title has no width at ' + width + 'px: ' + JSON.stringify(info.title));
  assert(info.tabsBox && info.tabsBox.width > 0, name + ': tabs have no width at ' + width + 'px: ' + JSON.stringify(info.tabsBox));
  assert(info.head.left >= info.nav.right - 0.5, name + ': header starts under the navigation at ' + width + 'px: ' + JSON.stringify({ head: info.head, nav: info.nav }));
  assert(!intersect(info.title, info.tabsBox), name + ': title intersects the tab strip at ' + width + 'px: ' + JSON.stringify({ title: info.title, tabs: info.tabsBox }));
  assert(!intersect(info.group, info.tabsBox), name + ': group intersects the tab strip at ' + width + 'px: ' + JSON.stringify({ group: info.group, tabs: info.tabsBox }));
  assert(info.tabsBox.top >= info.head.bottom + 4, name + ': tab strip touches the header at ' + width + 'px: ' + JSON.stringify({ head: info.head, tabs: info.tabsBox }));
  assert(info.title.right <= info.head.right + 0.5 && info.title.left >= info.head.left - 0.5, name + ': title leaves the header at ' + width + 'px');
  assert(info.tabsBox.width >= Math.min(info.cellBox.width - 1, info.head.width - 1), name + ': tab strip is narrower than its cell at ' + width + 'px: ' + JSON.stringify({ tabs: info.tabsBox, cell: info.cellBox }));
  assert.equal(info.brandInNav, true, name + ': brand is not owned by the navigation at ' + width + 'px');
  assert.equal(info.navPosition, 'fixed', name + ': navigation is not fixed at ' + width + 'px');
}

async function load(page, base) {
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('od-ready') && document.getElementById('tabMenu') &&
    document.getElementById('tabMenu').querySelectorAll('.tab, .tabclick').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(250);
}

(async () => {
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(HERE, 'captures'), { recursive: true });
  const result = {
    scope: 'Native Main_TrafficMonitor_realtime.asp lifecycle; real state.js menu generation and browser_compatibility wrapper; no modem contact',
    label,
    assets: assetHashes,
    capabilityProfile: caps.rc_support,
    modes: {},
    widths: [1440, 1024, 390, 320],
    resizeRoundTrip: [],
    navigation: []
  };
  for (const mode of ['jquery', 'fallback']) {
    const modeResult = { widthChecks: [], errors: [] };
    const { server, base } = await startServer(mode === 'jquery');
    let browser;
    try {
      browser = await chromium.launch({ headless: true, executablePath: process.env.OPENDSL_CHROMIUM });
      for (const width of result.widths) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await load(page, base);
        const info = await page.evaluate(measure);
        info.clientErrors = errors;
        check(mode, info, width);
        modeResult.widthChecks.push({ width, ...info });
        await page.screenshot({ path: path.join(HERE, 'captures', label + '-traffic-' + mode + '-' + width + '.png'), fullPage: false });
        await page.close();
      }

      // Same page, repeated viewport changes: the fixed shell must survive
      // desktop -> tablet -> phone -> desktop without stale widths.
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await load(page, base);
      for (const width of [1024, 390, 320, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(250);
        const info = await page.evaluate(measure);
        info.clientErrors = errors;
        check(mode + ' resize', info, width);
        result.resizeRoundTrip.push({ mode, width, ...info });
      }
      await page.screenshot({ path: path.join(HERE, 'captures', label + '-traffic-' + mode + '-resize-1440.png'), fullPage: false });
      await page.close();

      // Normal reload and same-origin history return.
      const navPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const navErrors = [];
      navPage.on('pageerror', (error) => navErrors.push(error.message));
      await load(navPage, base);
      let info = await navPage.evaluate(measure);
      check(mode + ' first load', info, 1440);
      result.navigation.push({ mode, step: 'first load', ...info });
      await navPage.reload({ waitUntil: 'load' });
      await navPage.waitForFunction(() => document.body.classList.contains('od-ready') && document.getElementById('tabMenu') && document.getElementById('tabMenu').querySelectorAll('.tab, .tabclick').length > 0);
      await navPage.waitForTimeout(250);
      info = await navPage.evaluate(measure);
      check(mode + ' reload', info, 1440);
      result.navigation.push({ mode, step: 'reload', ...info });
      await navPage.goto(base + '/blank.html', { waitUntil: 'load' });
      await navPage.goBack({ waitUntil: 'load' });
      await navPage.waitForFunction(() => document.body.classList.contains('od-ready') && document.getElementById('tabMenu') && document.getElementById('tabMenu').querySelectorAll('.tab, .tabclick').length > 0);
      await navPage.waitForTimeout(250);
      info = await navPage.evaluate(measure);
      info.clientErrors = navErrors;
      check(mode + ' history return', info, 1440);
      result.navigation.push({ mode, step: 'history return', ...info });
      await navPage.close();
    } catch (error) {
      modeResult.errors.push(String(error && error.stack || error));
      result.modes[mode] = modeResult;
      fs.writeFileSync(path.join(HERE, 'evidence', label + '-traffic.json'), JSON.stringify(result, null, 2));
      throw error;
    } finally {
      if (browser) await browser.close();
      server.close();
    }
    result.modes[mode] = modeResult;
  }
  fs.writeFileSync(path.join(HERE, 'evidence', label + '-traffic.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    label,
    assets: result.assets,
    modes: Object.fromEntries(Object.entries(result.modes).map(([mode, data]) => [mode, data.widthChecks.map((check) => ({
      width: check.width,
      head: check.head,
      title: check.title,
      tabs: check.tabsBox,
      tabParent: check.tabParent,
      contentCell: check.contentCell && check.contentCell.cls,
      brandInNav: check.brandInNav
    }))])),
    resize: result.resizeRoundTrip.map((step) => ({ mode: step.mode, width: step.width, title: step.title.width, tabs: step.tabsBox.width, gap: +(step.tabsBox.top - step.head.bottom).toFixed(1) })),
    navigation: result.navigation.map((step) => ({ mode: step.mode, step: step.step, title: step.title.width, tabs: step.tabsBox.width, gap: +(step.tabsBox.top - step.head.bottom).toFixed(1) }))
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
