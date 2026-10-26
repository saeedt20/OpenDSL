// Source-shaped DSL summary marker fixture (F26-03).
//
// Extracts the real showDSLWANList() function and the real ATM/multi-service
// summary tables from Advanced_DSL_Content.asp, evaluates only its ASP
// compile-time branches (ATM vs PTM, multi-service yes), and runs the native
// row generator with populated and unselected PVC/service sets. The shipped
// legacy enhancement is then loaded normally. No PVC, DSL or IPTV setting is
// changed and no modem is contacted.
//
// Run: node overlays/opendsl-ui/qa/check-dsl-checks.cjs [before|current]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
const HERE = path.join(ROOT, 'analysis/ui-request-regressions');
const { chromium } = require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const variant = process.argv[2] || 'current';
const beforeDir = path.join(ROOT, 'analysis/postflash-fixes-0.1.27-2026-10-26/before-assets');

const dict = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'overlays/native-english/userfs/EN.dict'), 'utf8')
  .split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const source = fs.readFileSync(path.join(ROOT, 'overlays/opendsl-ui/boaroot/cgi-bin/Advanced_DSL_Content.asp'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(){');
  const end = source.indexOf('\nfunction ', start + 10);
  if (start < 0 || end < 0) throw new Error('native function not found: ' + name);
  return source.slice(start, end);
}

function extractTable(id) {
  const start = source.indexOf('<table id="' + id + '"');
  const end = source.indexOf('</table>', start);
  if (start < 0 || end < 0) throw new Error('native table not found: ' + id);
  return source.slice(start, end + '</table>'.length);
}

function conditionValue(tag, flags) {
  if (/Wan_Common"\s*,\s*"TransMode"\s*,\s*"h"\s*\)\s*=\s*"ATM"/i.test(tag)) return flags.transMode === 'ATM';
  if (/Wan_Common"\s*,\s*"TransMode"\s*,\s*"h"\s*\)\s*<>\s*"LAN"/i.test(tag)) return flags.transMode !== 'LAN';
  if (/WebCustom_Entry"\s*,\s*"isMultiSerSupported"\s*,\s*"h"\s*\)\s*=\s*"Yes"/i.test(tag)) return true;
  if (/Wan_Common"\s*,\s*"sharepvc"\s*,\s*"h"\s*\)\s*<>\s*"1"/i.test(tag)) return flags.sharepvc !== '1';
  throw new Error('unhandled ASP condition: ' + tag);
}

// Compile-time ASP conditionals + String_Entry output only. The extracted
// branch contains no runtime ASP writes beyond translated labels.
function translateAsp(text, flags) {
  const stack = [];
  let active = true;
  let out = '';
  let index = 0;
  const pattern = /<%([\s\S]*?)%>/g;
  let match;
  const emit = (chunk) => { if (active) out += chunk; };
  while ((match = pattern.exec(text))) {
    emit(text.slice(index, match.index));
    index = pattern.lastIndex;
    const tag = match[1].trim();
    const ifMatch = tag.match(/^if\s+([\s\S]+?)\s+then$/i);
    if (ifMatch) {
      const value = conditionValue(tag, flags);
      stack.push({ parent: active, taken: value });
      active = active && value;
      continue;
    }
    if (/^else$/i.test(tag)) {
      const top = stack[stack.length - 1];
      if (!top) throw new Error('ASP else without if');
      active = top.parent && !top.taken;
      top.taken = true;
      continue;
    }
    if (/^end\s+if$/i.test(tag)) {
      const top = stack.pop();
      if (!top) throw new Error('ASP end if without if');
      active = top.parent;
      continue;
    }
    if (!active) continue;
    const entry = tag.match(/String_Entry"\s*,\s*"([^"]+)"/i);
    if (entry) emit(dict[entry[1]] || entry[1]);
    else if (/asp_write\s*\(\s*"([^"]+)"\s*\)/i.test(tag)) emit(tag.match(/asp_write\s*\(\s*"([^"]+)"\s*\)/i)[1]);
    else emit('');
  }
  emit(text.slice(index));
  return out;
}

const nativeFunction = extractFunction('showDSLWANList');
const atmTable = translateAsp(extractTable('ATMPVCTable'), { transMode: 'ATM', sharepvc: '0' });
const ptmTable = translateAsp(extractTable('MultiServiceTable'), { transMode: 'PTM', sharepvc: '0' });

function pageMarkup(mode) {
  const atm = mode === 'ATM';
  const table = atm ? atmTable : ptmTable;
  const functionSource = translateAsp(nativeFunction, { transMode: mode, sharepvc: '0' });
  const data = atm
    ? '[["Yes","0","8","35","0","P1","P2"],["Yes","1","0","36","1","P1","P2"],["Yes","2","1","37","3","P1","P2"],["No","3","2","38","2","P1","P2"],["Yes","4","3","39","2","P1","P2"]]'
    : '[["Yes","0","1","10","0","P1","P2"],["Yes","1","2","20","1","P1","P2"],["Yes","2","3","30","3","P1","P2"],["No","3","4","40","2","P1","P2"]]';
  const unselected = atm
    ? '[["No","0","8","35","0","P1","P2"],["Yes","1","0","36","0","P1","P2"]]'
    : '[["No","0","1","10","0","P1","P2"],["Yes","1","2","20","0","P1","P2"]]';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/index_style.css">
<link rel="stylesheet" href="/form_style.css">
<link rel="stylesheet" href="/opendsl/legacy.css">
<script>
var DSLWANList = ${data};
var ad_mr_enable = "0", ad_wan_port = "1";
var vd_mr_enable = "1", vd_wan_port = "2";
var eth_mr_enable = "0", eth_wan_port = "0";
var wan_TransMode_orig = "${mode}";
${functionSource}
window.__atmData = ${data};
window.__unselectedData = ${unselected};
window.__mode = "${mode}";
</script>
</head><body class="statusbody">
${table}
<script>showDSLWANList();</script>
<script defer src="/opendsl/legacy.js"></script>
</body></html>`;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.invalid');
    const requestPath = url.pathname;
    const send = (body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    if (requestPath === '/atm' || requestPath === '/ptm') return send(pageMarkup(requestPath === '/atm' ? 'ATM' : 'PTM'), 'text/html; charset=utf-8');
    if (requestPath === '/opendsl/legacy.css') return send(fs.readFileSync(path.join(ROOT, 'overlays/opendsl-ui/boaroot/html/opendsl/legacy.css')), 'text/css');
    if (requestPath === '/opendsl/legacy.js') return send(fs.readFileSync(path.join(ROOT, 'overlays/opendsl-ui/boaroot/html/opendsl/legacy.js')), 'text/javascript');
    for (const base of ['overlays/native-english', 'analysis/recheck-015-image/candidate-tree', 'analysis/rootfs']) {
      const file = path.join(ROOT, base, 'boaroot/html', requestPath);
      if (fs.existsSync(file)) {
        const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
        return send(fs.readFileSync(file), type);
      }
    }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port })));
}

function inspect() {
  const markers = Array.from(document.querySelectorAll('.od-check'));
  const sources = Array.from(document.querySelectorAll('img[src*="/images/checked.gif"]'));
  const table = document.getElementById(window.__mode === 'ATM' ? 'ATMPVCTable' : 'MultiServiceTable');
  const cells = markers.map((marker) => marker.closest('td'));
  return {
    mode: window.__mode,
    rows: table ? table.rows.length - 2 : 0,
    markers: markers.length,
    sources: sources.length,
    visibleSources: sources.filter((image) => getComputedStyle(image).display !== 'none').length,
    markersWithRole: markers.filter((marker) => marker.getAttribute('role') === 'img' && marker.getAttribute('aria-label') === 'Selected').length,
    markerSizes: markers.map((marker) => {
      const box = marker.getBoundingClientRect();
      return { width: +box.width.toFixed(1), height: +box.height.toFixed(1) };
    }),
    onePerCell: cells.every((cell) => cell && cell.querySelectorAll('.od-check').length === 1),
    sourceMarked: sources.every((image) => image.getAttribute('data-od-checked') === 'ready' && image.getAttribute('aria-hidden') === 'true')
  };
}

function assertDecorated(info, step) {
  const expected = info.sources;
  assert.equal(info.markers, expected, step + ': marker count does not match native condition: ' + JSON.stringify(info));
  assert.equal(info.visibleSources, 0, step + ': legacy bitmap remains visible: ' + JSON.stringify(info));
  assert.equal(info.markersWithRole, expected, step + ': marker is not exposed as an accessible Selected image: ' + JSON.stringify(info));
  assert.equal(info.onePerCell, true, step + ': marker is not one per native cell: ' + JSON.stringify(info));
  assert.equal(info.sourceMarked, true, step + ': hidden source image was not marked for assistive technology: ' + JSON.stringify(info));
  for (const size of info.markerSizes) assert(size.width >= 18 && size.height >= 18, step + ': marker has no usable hit/visibility box: ' + JSON.stringify(size));
}

async function runCase(page, base, mode, step) {
  await page.goto(base + '/' + mode.toLowerCase(), { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('od-ready'));
  await page.waitForTimeout(80);
  const info = await page.evaluate(inspect);
  const expected = mode === 'ATM' ? 2 : 2;
  assert.equal(info.sources, expected, step + ': native ' + mode + ' condition produced ' + info.sources + ' bitmaps, expected ' + expected);
  if (variant === 'before') {
    assert.equal(info.markers, 0, step + ': before assets already contain markers');
    assert.equal(info.visibleSources, info.sources, step + ': before assets hid the legacy bitmap');
  } else {
    assertDecorated(info, step);
  }
  return info;
}

(async () => {
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(HERE, 'captures'), { recursive: true });
  const { server, base } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.OPENDSL_CHROMIUM });
  const out = { scope: 'Extracted native showDSLWANList()/ATM/PTM tables; dynamic rows; no modem contact', variant, checks: [] };
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (variant === 'before') {
    await page.route('**/opendsl/legacy.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(beforeDir, 'legacy.js')) }));
    await page.route('**/opendsl/legacy.css', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(beforeDir, 'legacy.css')) }));
  }
  try {
    for (const mode of ['ATM', 'PTM']) {
      const info = await runCase(page, base, mode, variant + ' initial ' + mode);
      out.checks.push({ step: 'initial ' + mode, ...info });
      await page.screenshot({ path: path.join(HERE, 'captures', variant + '-dsl-check-' + mode.toLowerCase() + '.png'), fullPage: false });

      // Repopulate the same table through the native generator: rows are
      // deleted and recreated exactly as a dynamic refresh would.
      await page.evaluate(() => {
        const table = document.getElementById(window.__mode === 'ATM' ? 'ATMPVCTable' : 'MultiServiceTable');
        while (table.rows.length > 2) table.deleteRow(2);
        DSLWANList = window.__unselectedData.slice();
        showDSLWANList();
      });
      await page.waitForTimeout(120);
      const unselected = await page.evaluate(inspect);
      if (variant === 'current') {
        assert.equal(unselected.sources, 0, 'unselected dynamic rows produced a native bitmap: ' + JSON.stringify(unselected));
        assert.equal(unselected.markers, 0, 'unselected dynamic rows produced a marker: ' + JSON.stringify(unselected));
      }
      out.checks.push({ step: 'dynamic unselected ' + mode, ...unselected });

      // Regenerate a selected set again; the observer must convert the new
      // bitmaps without touching the old/hidden nodes or inventing markers.
      await page.evaluate(() => {
        const table = document.getElementById(window.__mode === 'ATM' ? 'ATMPVCTable' : 'MultiServiceTable');
        while (table.rows.length > 2) table.deleteRow(2);
        DSLWANList = window.__atmData.slice();
        if (window.__mode === 'PTM') DSLWANList = [['Yes','0','1','10','0','P1','P2'],['Yes','1','2','20','1','P1','P2'],['Yes','2','3','30','3','P1','P2']];
        showDSLWANList();
      });
      await page.waitForTimeout(150);
      const dynamic = await page.evaluate(inspect);
      if (variant === 'current') {
        assert.equal(dynamic.sources, 2, 'dynamic selected rows do not match native condition: ' + JSON.stringify(dynamic));
        assertDecorated(dynamic, 'dynamic selected ' + mode);
      }
      out.checks.push({ step: 'dynamic selected ' + mode, ...dynamic });
    }
    out.pageErrors = errors;
    if (variant === 'current') assert.deepEqual(errors, [], 'page errors: ' + JSON.stringify(errors));
    fs.writeFileSync(path.join(HERE, 'evidence', variant + '-dsl-checks.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
