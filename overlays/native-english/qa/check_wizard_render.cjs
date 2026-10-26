#!/usr/bin/env node
// Recheck-D02 rendered regression gate (host only): the wizard banner markup
// must produce exactly ONE visible OpenDSL banner/model label in a modern
// browser, exactly like stock's single native label.
//
// 0.1.3 nested an HTML comment inside the stock `<!--[if lte IE 6]>` hidden
// conditional block. HTML comments cannot nest, so the inner close-comment
// sequence terminated the hidden block early and rendered a second OpenDSL
// banner (see analysis/recheck-013-runtime/banner-parse-result.json). Source
// span counting cannot catch that class of defect, so this gate parses and
// renders the real HTML with Chromium, and proves it can detect the
// regression by re-injecting the nested comment as a negative control.
//
// Convention: missing optional browser prerequisites -> SKIPPED-INCOMPLETE,
// exit 2 (same as tools/run_production_ui_check.py). Renders the overlay
// source with ASP expressions replaced by fixture text and scripts,
// onload/resource tags stripped so HTML parsing is exercised, not JS.
// Screenshots (desktop + mobile) are written under build/release/work/.

'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const WIZARD = path.join(ROOT, 'overlays/native-english/boaroot/cgi-bin/QIS_wizard.asp');
const STOCK_WIZARD = path.join(ROOT, 'analysis/verified/rootfs/boaroot/cgi-bin/QIS_wizard.asp');
const WORK = path.join(ROOT, 'build/release/work/wizard-render');
const NESTED_COMMENT = '<!--OpenDSL: see replacement above; IE6 banner branch banded the same way.-->';

function discover() {
  const candidates = [];
  if (process.env.OPENDSL_PLAYWRIGHT_MODULE) {
    candidates.push(process.env.OPENDSL_PLAYWRIGHT_MODULE);
  }
  const npxRoot = path.join(process.env.HOME || '', '.npm/_npx');
  if (fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot)) {
      candidates.push(path.join(npxRoot, entry, 'node_modules', 'playwright-core'));
    }
  }
  for (const candidate of candidates) {
    try {
      const resolved = require.resolve(candidate);
      return { module: path.dirname(resolved) };
    } catch {
      // try next candidate
    }
  }
  // playwright module exists (with bundled browsers) is enough
  return null;
}

function discoverChrome() {
  if (process.env.OPENDSL_CHROMIUM) return process.env.OPENDSL_CHROMIUM;
  const cache = path.join(process.env.HOME || '', '.cache/ms-playwright');
  const found = [];
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'chrome-linux64/chrome');
      if (fs.existsSync(candidate)) found.push(candidate);
      const candidate2 = path.join(cache, entry, 'chrome-linux/chrome');
      if (fs.existsSync(candidate2)) found.push(candidate2);
    }
  }
  found.sort();
  return found[found.length - 1] || null;
}

let headless = null;
try {
  const moduleDir = discover();
  if (!moduleDir) throw new Error('no playwright module');
  const browserPath = discoverChrome();
  if (!browserPath) throw new Error('no chromium executable');
  headless = require(moduleDir.module).chromium; // playwright-core chromium engine
  headless.browserPath = browserPath;
} catch (error) {
  console.log(JSON.stringify({
    gate: 'wizard-render',
    result: 'SKIPPED-INCOMPLETE',
    detail: `optional browser prerequisites missing (${error.message}); set OPENDSL_PLAYWRIGHT_MODULE and OPENDSL_CHROMIUM`,
  }, null, 2));
  process.exit(2);
}


function sanitized(text) {
  return text
    .replace(/<%[\s\S]*?%>/g, 'fixture-model')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\bonload\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/<(?:link|img|iframe|input)\b[^>]*>/gi, '');
}

(async () => {
  const overlay = fs.readFileSync(WIZARD, 'utf8');
  const stock = fs.readFileSync(STOCK_WIZARD, 'utf8');
  const injected = overlay.replace(
    '<!--[if lte IE 6]>\n<div class="banner1" align="center">\n',
    '<!--[if lte IE 6]>\n<div class="banner1" align="center">\n\t'
      + NESTED_COMMENT + '\n');
  if (!injected.includes(NESTED_COMMENT)) {
    throw new Error('negative-control injection did not take effect');
  }

  const browser = await headless.launch({
    executablePath: headless.browserPath,
    headless: true,
  });
  const report = [];
  try {
    const variants = [
      ['stock', stock, { bannerDivs: 1, modelSpans: 1, opendslSpans: 0 }],
      ['overlay-current', overlay, { bannerDivs: 1, modelSpans: 1, opendslSpans: 1 }],
      ['negative-control-nested-comment-reinjected', injected,
        // the truthful 0.1.3 signature (per
        // analysis/recheck-013-runtime/banner-parse-result.json): the
        // ancestor div opens before the premature comment termination, so
        // its count stays 1, while BOTH duplicated text spans render
        { bannerDivs: 1, modelSpans: 2, opendslSpans: 2 }],
    ];
    for (const [name, html, want] of variants) {
      const page = await browser.newPage();
      await page.setContent(sanitized(html));
      const bannerDivs = await page.locator('.banner1').count();
      const modelSpans = await page.locator('.modelName_top').count();
      const opendslSpans = await page
        .locator('span', { hasText: 'OpenDSL' }).count();
      const failures = [];
      if (bannerDivs !== want.bannerDivs) {
        failures.push(`banner divs ${bannerDivs} != ${want.bannerDivs}`);
      }
      if (modelSpans !== want.modelSpans) {
        failures.push(`model spans ${modelSpans} != ${want.modelSpans}`);
      }
      if (opendslSpans !== want.opendslSpans) {
        failures.push(`OpenDSL spans ${opendslSpans} != ${want.opendslSpans}`);
      }
      report.push({ variant: name, bannerDivs, modelSpans, opendslSpans,
        ok: failures.length === 0, failures });

      if (name === 'overlay-current') {
        fs.mkdirSync(WORK, { recursive: true });
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.screenshot({ path: path.join(WORK, 'wizard-desktop.png'), fullPage: false });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(WORK, 'wizard-mobile.png'), fullPage: false });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const ok = report.every((entry) => entry.ok);
  console.log(JSON.stringify({
    gate: 'wizard-render',
    scope: 'Chromium DOM render of the actual wizard markup; ASP expressions '
      + 'replaced with fixture values; scripts/onload/resource tags stripped '
      + 'so HTML parsing is checked. No firmware/device/native execution.',
    report,
    pass: ok,
  }, null, 2));
  if (!ok) {
    console.error('FAIL: wizard banner render regression');
    process.exit(1);
  }
  console.log('PASS: rendered wizard has exactly one visible banner/model '
    + 'label like stock (1 banner div, 1 model label, 1 OpenDSL watermark); '
    + 'the re-injected nested-comment negative control is detected with the '
    + '0.1.3 defect signature (2 model labels, 2 OpenDSL watermarks).');
})().catch((error) => {
  console.error(`FAIL wizard-render: ${error.message}`);
  process.exit(1);
});
