// Source-faithful wireless MAC summary fixture (F26-01).
//
// Loads the actual Overview document and its native router iframe through the
// existing host fixture, then restores the post-doLoad() shape of #BandMAC:
// the inline document.write script node plus the rendered MAC it wrote. The
// iframe load event drives the production syncGateway. No ASP is executed and
// no modem is contacted.
//
// Run: node overlays/opendsl-ui/qa/check-mac-summary.cjs [before|current]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
const HERE = path.join(ROOT, 'analysis/ui-request-regressions');
const { chromium } = require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const variant = process.argv[2] || 'current';
const beforeDir = path.join(ROOT, 'analysis/postflash-fixes-0.1.27-2026-10-26/before-assets');

function readout(page, key) {
  return page.evaluate((name) => {
    const value = document.querySelector('[data-od-gw="' + name + '"]');
    return value ? value.textContent : null;
  }, key);
}

(async () => {
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(HERE, 'captures'), { recursive: true });
  const host = await require('./host-fixture.cjs').start();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.OPENDSL_CHROMIUM });
  const out = {
    scope: 'Source-shaped native router iframe DOM; no ASP execution or modem contact',
    variant,
    checks: []
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (variant === 'before') {
    await page.route('**/opendsl/legacy.js', (route) => route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: fs.readFileSync(path.join(beforeDir, 'legacy.js'))
    }));
    await page.route('**/opendsl/legacy.css', (route) => route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: fs.readFileSync(path.join(beforeDir, 'legacy.css'))
    }));
  }
  try {
    await page.goto(host.base + '/index2.asp', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('statusframe') &&
      document.getElementById('statusframe').contentDocument &&
      document.getElementById('statusframe').contentDocument.getElementById('BandMAC'));
    const shape = await page.evaluate(() => {
      const frame = document.getElementById('statusframe');
      const doc = frame.contentDocument;
      const band = doc.getElementById('BandMAC');
      band.innerHTML = '<script>IF("0" == "1") DOCUMENT.WRITE(""); ELSE DOCUMENT.WRITE("02:00:00:00:00:02");</script>02:00:00:00:00:02';
      doc.getElementById('MAC').textContent = '02:00:00:00:00:01';
      frame.dispatchEvent(new Event('load'));
      return {
        bandScriptNodes: band.querySelectorAll('script').length,
        bandMarkup: band.innerHTML
      };
    });
    await page.waitForTimeout(150);
    const bandmac = await readout(page, 'bandmac');
    const mac = await readout(page, 'mac');
    out.checks.push({
      step: 'initial after script-bearing BandMAC sync',
      bandScriptNodes: shape.bandScriptNodes,
      bandMarkup: shape.bandMarkup,
      bandmac,
      mac
    });
    if (variant === 'current') {
      assert.equal(shape.bandScriptNodes, 1, 'native BandMAC script node was removed');
      assert.equal(bandmac, '02:00:00:00:00:02', 'band MAC summary is not exactly the one rendered MAC: ' + bandmac);
      assert(!/DOCUMENT\.WRITE|IF\s*\(/i.test(bandmac), 'summary contains script source: ' + bandmac);
      assert.equal(mac, '02:00:00:00:00:01', 'Ethernet MAC summary changed: ' + mac);
    } else {
      assert(/DOCUMENT\.WRITE/i.test(bandmac), 'before asset did not reproduce the script-source leak: ' + bandmac);
    }
    await page.screenshot({ path: path.join(HERE, 'captures', variant + '-mac-summary.png'), fullPage: false });

    // Leave the gateway summary for the native Wi-Fi inspector, then return.
    await page.getByRole('button', { name: 'Edit Wi-Fi settings' }).click();
    await page.waitForTimeout(120);
    await page.locator('[data-od-node="gateway"]').click();
    await page.waitForTimeout(120);
    const afterInspector = await page.evaluate(() => {
      const frame = document.getElementById('statusframe');
      const doc = frame.contentDocument;
      const band = doc.getElementById('BandMAC');
      band.innerHTML = '<script>IF("0" == "1") DOCUMENT.WRITE(""); ELSE DOCUMENT.WRITE("A0:B1:C2:D3:E4:F5");</script>A0:B1:C2:D3:E4:F5';
      frame.dispatchEvent(new Event('load'));
      return {
        bandScriptNodes: band.querySelectorAll('script').length,
        bandMarkup: band.innerHTML,
        inspectorLabel: document.querySelector('.od-inspector-label').textContent
      };
    });
    await page.waitForTimeout(150);
    const returnedBandmac = await readout(page, 'bandmac');
    out.checks.push({
      step: 'returned from native Wi-Fi inspector',
      bandScriptNodes: afterInspector.bandScriptNodes,
      bandMarkup: afterInspector.bandMarkup,
      bandmac: returnedBandmac,
      inspectorLabel: afterInspector.inspectorLabel
    });
    if (variant === 'current') {
      assert.equal(returnedBandmac, 'A0:B1:C2:D3:E4:F5', 'returned band MAC summary is not the one rendered MAC: ' + returnedBandmac);
      assert(!/DOCUMENT\.WRITE|IF\s*\(/i.test(returnedBandmac), 'returned summary contains script source: ' + returnedBandmac);
    }

    // Malformed and competing values must produce Unavailable, never source.
    await page.evaluate(() => {
      const frame = document.getElementById('statusframe');
      const doc = frame.contentDocument;
      doc.getElementById('BandMAC').innerHTML = '<script>DOCUMENT.WRITE("11:22:33:44:55:66");</script><b>11:22:33:44:55:66</b> AA:BB:CC:DD:EE:FF';
      frame.dispatchEvent(new Event('load'));
    });
    await page.waitForTimeout(150);
    const ambiguous = await readout(page, 'bandmac');
    const restored = await page.evaluate(() => {
      const frame = document.getElementById('statusframe');
      const doc = frame.contentDocument;
      doc.getElementById('BandMAC').innerHTML = '<script>DOCUMENT.WRITE("01:23:45:67:89:AB");</script><span>01:23:45:67:89:ab</span>';
      frame.dispatchEvent(new Event('load'));
      return document.querySelector('[data-od-gw="bandmac"]') ? document.querySelector('[data-od-gw="bandmac"]').textContent : null;
    });
    out.checks.push({ step: 'competing addresses', value: ambiguous });
    out.checks.push({ step: 'normalized single address', value: restored });
    if (variant === 'current') {
      assert.equal(ambiguous, 'Unavailable', 'competing MAC addresses were not rejected: ' + ambiguous);
      assert.equal(restored, '01:23:45:67:89:AB', 'single MAC was not normalized: ' + restored);
      for (const malformed of ['00:11:22:33:44:55:66', 'address: 00:11:22:33:44:55']) {
        const value = await page.evaluate(malformed => {
          const frame = document.getElementById('statusframe');
          frame.contentDocument.getElementById('BandMAC').textContent = malformed;
          frame.dispatchEvent(new Event('load'));
          return document.querySelector('[data-od-gw="bandmac"]').textContent;
        }, malformed);
        assert.equal(value, 'Unavailable', 'partial MAC was accepted: ' + malformed);
      }
    }

    // Other summary fields use the same text extractor.
    const scriptField = await page.evaluate(() => {
      const frame = document.getElementById('statusframe');
      frame.contentDocument.getElementById('wl_ssid').value = '';
      const ssid = document.getElementById('od_gw_ssid');
      ssid.innerHTML = '<script>window.__badSsid=1;</script>OpenDSL Home';
      frame.dispatchEvent(new Event('load'));
      return document.querySelector('[data-od-gw="ssid"]') ? document.querySelector('[data-od-gw="ssid"]').textContent : null;
    });
    out.checks.push({ step: 'script-bearing SSID summary', value: scriptField });
    if (variant === 'current') {
      assert.equal(scriptField, 'OpenDSL Home', 'SSID summary contains source: ' + scriptField);
      assert.equal(await page.evaluate(() => window.__badSsid), undefined, 'script content executed');
      for (const ssid of ['', 'ASUS']) {
        const value = await page.evaluate(ssid => {
          const frame = document.getElementById('statusframe');
          frame.contentDocument.getElementById('wl_ssid').value = '';
          document.getElementById('od_gw_ssid').textContent = ssid;
          frame.dispatchEvent(new Event('load'));
          return document.querySelector('[data-od-gw="ssid"]').textContent;
        }, ssid);
        assert.equal(value, ssid || 'Unavailable', 'SSID was invented or replaced');
        out.checks.push({ step: 'SSID source ' + JSON.stringify(ssid), value });
      }
    }

    out.pageErrors = errors;
    if (variant === 'current') assert.deepEqual(errors, [], 'page errors: ' + JSON.stringify(errors));
    fs.writeFileSync(path.join(HERE, 'evidence', variant + '-mac-summary.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await page.close();
    await browser.close();
    host.server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
