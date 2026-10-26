// Navigation brand ownership fixture (F26-04).
//
// Renders the shipped route documents (Overview, DSL, System, Traffic Monitor)
// from the real native markup plus the real state.js banner/menu generator
// through the existing host fixture. The shipped legacy enhancement then runs
// normally. This is a host rendering, not modem execution: page scripts are
// not executed, so the first-load state is the same post-render DOM the
// browser receives from the device.
//
// Checks:
// - the one native .banner1 element is owned by the fixed navigation cell,
//   outside #mainMenu's own scroll region, with the wordmark and model intact;
// - desktop scroll does not separate the brand from the fixed navigation;
// - the phone drawer carries the brand through closed -> open -> closed, while
//   the compact topbar wordmark takes over when the drawer is closed;
// - native logout/reboot actions stay in the topbar (not the drawer brand),
//   the device-info drawer still owns the native status bar, and the model
//   text remains present.
//
// Run: node overlays/opendsl-ui/qa/check-brand-routes.cjs [before|current]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
const HERE = path.join(ROOT, 'analysis/ui-request-regressions');
const { chromium } = require(process.env.OPENDSL_PLAYWRIGHT_MODULE || 'playwright');
const variant = process.argv[2] || 'current';
const beforeDir = path.join(ROOT, 'analysis/postflash-fixes-0.1.27-2026-10-26/before-assets');
const routes = [
  { path: '/index2.asp', name: 'overview' },
  { path: '/Advanced_DSL_Content.asp', name: 'dsl' },
  { path: '/Advanced_System_Content.asp', name: 'system' },
  { path: '/Main_TrafficMonitor_realtime.asp', name: 'traffic' }
];

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
  const css = (node, prop) => (node ? getComputedStyle(node)[prop] : null);
  const nav = document.querySelector('.od-nav-cell');
  const banner = document.querySelector('.banner1');
  const brand = document.querySelector('.banner1 > span:first-child');
  const modelNode = document.querySelector('.banner1 .modelName_top');
  const mainMenu = document.getElementById('mainMenu');
  const webHistory = document.querySelector('.od-mobile-brand');
  const toggle = document.querySelector('.od-menu-toggle');
  const info = document.querySelector('.od-info-button');
  const drawer = document.getElementById('od-device-drawer');
  const statusBar = document.querySelector('.statusBar');
  const close = document.querySelector('.od-nav-close');
  const topbarActions = document.querySelector('.od-topbar-actions');
  let brandTextRect = null;
  if (brand) {
    const range = document.createRange();
    range.selectNodeContents(brand);
    const box = range.getBoundingClientRect();
    brandTextRect = {
      top: +box.top.toFixed(2), bottom: +box.bottom.toFixed(2),
      left: +box.left.toFixed(2), right: +box.right.toFixed(2),
      width: +box.width.toFixed(2), height: +box.height.toFixed(2)
    };
  }
  return {
    ready: document.body.classList.contains('od-ready'),
    navOpen: document.body.classList.contains('od-nav-open'),
    bannerCount: document.querySelectorAll('.banner1').length,
    brandInNav: !!(nav && brand && nav.contains(brand)),
    brandOutsideMenu: !!(brand && mainMenu && !mainMenu.contains(brand)),
    brandInDrawerBrand: !!(banner && banner.classList.contains('od-nav-brand')),
    bannerParentClass: banner && banner.parentNode ? String(banner.parentNode.className || '') : null,
    brandText: brand ? String(brand.textContent || '').trim() : null,
    brandPosition: css(brand, 'position'),
    brandDisplay: css(brand, 'display'),
    brand: rect(brand),
    brandTextRect,
    nav: rect(nav),
    navPosition: css(nav, 'position'),
    navTransform: css(nav, 'transform'),
    mainMenu: rect(mainMenu),
    mainMenuTransform: css(mainMenu, 'transform'),
    modelText: modelNode ? String(modelNode.textContent || '').trim() : null,
    modelInNav: !!(nav && modelNode && nav.contains(modelNode)),
    modelDisplay: css(modelNode, 'display'),
    closeDisplay: css(close, 'display'),
    close: rect(close),
    topbarActionsDisplay: css(topbarActions, 'display'),
    mobileWordmarkText: webHistory ? String(webHistory.textContent || '').trim() : null,
    mobileWordmarkDisplay: css(webHistory, 'display'),
    mobileWordmark: rect(webHistory),
    toggleDisplay: css(toggle, 'display'),
    toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
    toggle: rect(toggle),
    infoPresent: !!info,
    drawerPresent: !!drawer,
    drawerHasStatusBar: !!(drawer && statusBar && drawer.contains(statusBar)),
    topbarLogout: document.querySelectorAll('.od-topbar-actions a[href*="logout"]').length,
    topbarReboot: document.querySelectorAll('.od-topbar-actions a[href*="reboot"]').length,
    bannerActionNodes: document.querySelectorAll('.od-nav-cell .titlebtn, .od-nav-cell a[href*="logout"], .od-nav-cell a[href*="reboot"]').length,
    topbarVisibleActions: Array.from(document.querySelectorAll('.od-topbar-actions .od-icon-action')).filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    }).length,
    scrollY: window.scrollY,
    docHeight: document.documentElement.scrollHeight,
    viewport: window.innerWidth,
    pageTitle: document.title
  };
}

function intersect(a, b) {
  if (!a || !b) return false;
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function assertDesktop(info, label) {
  assert.equal(info.ready, true, label + ': legacy enhancement did not reach od-ready');
  assert.equal(info.bannerCount, 1, label + ': expected one native banner element, got ' + info.bannerCount);
  assert.equal(info.brandInNav, true, label + ': brand is not a child of the navigation cell');
  assert.equal(info.brandOutsideMenu, true, label + ': brand sits inside #mainMenu scroll region');
  assert.equal(info.brandInDrawerBrand, true, label + ': the moved banner is not marked as the navigation brand');
  assert.equal(info.navPosition, 'fixed', label + ': navigation is not fixed: ' + info.navPosition);
  assert.equal(info.brandPosition, 'absolute', label + ': brand is not positioned within the navigation shell: ' + info.brandPosition);
  assert.equal(info.brandText, 'OpenDSL', label + ': wordmark changed: ' + info.brandText);
  const modelPresent = info.modelText || '';
  assert(/DSL-N12E/i.test(modelPresent), label + ': native model text missing: ' + JSON.stringify(info.modelText));
  assert.equal(info.modelInNav, true, label + ': model metadata did not move with the banner');
  assert(info.brand && info.brand.width >= 100 && info.brand.height >= 40, label + ': brand has no usable box: ' + JSON.stringify(info.brand));
  assert(info.brand.left >= info.nav.left - 0.5 && info.brand.right <= info.nav.right + 0.5, label + ': brand leaves the navigation column: ' + JSON.stringify({ brand: info.brand, nav: info.nav }));
  assert(info.brand.top >= info.nav.top - 0.5 && info.brand.top < info.nav.bottom, label + ': brand is not aligned to the top of the navigation: ' + JSON.stringify({ brand: info.brand, nav: info.nav }));
  assert.equal(info.infoPresent, true, label + ': Device info control missing');
  assert.equal(info.drawerPresent, true, label + ': Device info drawer missing');
  assert.equal(info.drawerHasStatusBar, true, label + ': native device-information status bar is not owned by the drawer');
  assert(info.topbarLogout === 1 && info.topbarReboot === 1, label + ': native logout/reboot actions are not preserved in the topbar: ' + JSON.stringify({ logout: info.topbarLogout, reboot: info.topbarReboot }));
  assert.equal(info.bannerActionNodes, 0, label + ': banner actions were moved into the navigation drawer');
  assert(info.topbarVisibleActions >= 2, label + ': topbar actions have no visible box');
}

function assertPhoneClosed(info, label) {
  assert.equal(info.ready, true, label + ': legacy enhancement did not reach od-ready');
  assert.equal(info.bannerCount, 1, label + ': expected one native banner element, got ' + info.bannerCount);
  assert.equal(info.brandInNav, true, label + ': brand is not owned by the navigation drawer');
  assert.equal(info.brandOutsideMenu, true, label + ': brand sits inside #mainMenu');
  assert.equal(info.navOpen, false, label + ': drawer unexpectedly open');
  assert.equal(info.toggleExpanded, 'false', label + ': menu toggle is not collapsed: ' + info.toggleExpanded);
  assert.notEqual(info.toggleDisplay, 'none', label + ': menu toggle hidden on phone');
  assert.equal(info.closeDisplay, 'none', label + ': drawer close control visible while the drawer is closed');
  assert.notEqual(info.topbarActionsDisplay, 'none', label + ': topbar actions hidden while the drawer is closed');
  assert(info.toggle && info.toggle.left >= -0.5 && info.toggle.right <= info.viewport + 0.5, label + ': menu toggle outside the viewport: ' + JSON.stringify(info.toggle));
  assert.equal(info.mobileWordmarkText, 'OpenDSL', label + ': compact wordmark missing: ' + info.mobileWordmarkText);
  assert.notEqual(info.mobileWordmarkDisplay, 'none', label + ': compact wordmark hidden while drawer is closed');
  assert(info.mobileWordmark && info.mobileWordmark.left >= info.toggle.right - 0.5 && info.mobileWordmark.right <= info.viewport + 0.5, label + ': compact wordmark overlaps the menu toggle or leaves the viewport: ' + JSON.stringify({ wordmark: info.mobileWordmark, toggle: info.toggle }));
  assert(!intersect(info.mobileWordmark, info.toggle), label + ': compact wordmark intersects the menu toggle');
  assert(info.nav && info.nav.left < -1, label + ': closed drawer is not translated off-canvas: ' + JSON.stringify(info.nav));
  assert(info.brand && info.brand.left < -1, label + ': brand did not follow the closed drawer: ' + JSON.stringify(info.brand));
}

function assertPhoneOpen(info, label) {
  assert.equal(info.navOpen, true, label + ': drawer did not open');
  assert.equal(info.toggleExpanded, 'true', label + ': menu toggle did not expand: ' + info.toggleExpanded);
  assert(info.nav && info.nav.left >= -1, label + ': open drawer is still off-canvas: ' + JSON.stringify(info.nav));
  assert(info.brand && info.brand.left >= info.nav.left - 0.5 && info.brand.right <= info.nav.right + 0.5, label + ': brand is not inside the open drawer: ' + JSON.stringify({ brand: info.brand, nav: info.nav }));
  assert(info.brand && info.brand.top >= info.nav.top - 0.5 && info.brand.top < info.nav.bottom, label + ': brand is not aligned to the open drawer top: ' + JSON.stringify({ brand: info.brand, nav: info.nav }));
  assert.equal(info.mobileWordmarkDisplay, 'none', label + ': compact wordmark still visible over the open drawer');
  assert.equal(info.brandOutsideMenu, true, label + ': brand moved inside #mainMenu');
  assert(info.brand && info.brand.width >= 100, label + ': open drawer brand has no usable box');
  assert.equal(info.toggleDisplay, 'none', label + ': fixed menu toggle still paints over the open drawer');
  assert.equal(info.topbarActionsDisplay, 'none', label + ': topbar actions still paint over the open drawer');
  assert.notEqual(info.closeDisplay, 'none', label + ': drawer close control missing');
  assert(info.close && info.close.left >= info.nav.left - 0.5 && info.close.right <= info.nav.right + 0.5 && info.close.top >= info.nav.top - 0.5 && info.close.bottom <= info.nav.bottom + 0.5, label + ': drawer close control is not inside the drawer: ' + JSON.stringify({ close: info.close, nav: info.nav }));
  assert(!intersect(info.brandTextRect, info.close), label + ': wordmark overlaps the drawer close control: ' + JSON.stringify({ text: info.brandTextRect, close: info.close }));
  assert.notEqual(info.modelDisplay, 'none', label + ': model is not shown in the open drawer header');
  assert(/DSL-N12E/i.test(info.modelText || ''), label + ': drawer model text missing: ' + JSON.stringify(info.modelText));
}

async function load(page, base, route) {
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('od-ready') && document.querySelector('.od-nav-cell') && document.querySelector('.banner1'));
  await page.waitForTimeout(250);
}

async function waitForDrawer(page) {
  await page.waitForFunction(() => {
    const box = document.querySelector('.od-nav-cell').getBoundingClientRect();
    const target = document.body.classList.contains('od-nav-open') ? 0 : -box.width;
    return Math.abs(box.left - target) < 0.01;
  });
}

(async () => {
  fs.mkdirSync(path.join(HERE, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(HERE, 'captures'), { recursive: true });
  const host = await require('./host-fixture.cjs').start();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.OPENDSL_CHROMIUM });
  const out = {
    scope: 'Host rendering of shipped route documents with the real state.js banner/menu generator; no modem contact',
    variant,
    routes: []
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    // The Traffic page embeds the real /tm.svg chart object, whose own script
    // calls back into the page. Host fixture pages intentionally run no page
    // scripts, so the chart is served inert here. This is the only asset
    // substitution; all route documents and the state.js menu generator are
    // the shipped sources.
    await page.route('**/tm.svg', (route) => route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="730" height="350"><rect width="730" height="350" fill="#101820"/></svg>'
    }));
    if (variant === 'before') {
      await page.route('**/opendsl/legacy.js', (route) => route.fulfill({
        status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(beforeDir, 'legacy.js'))
      }));
      await page.route('**/opendsl/legacy.css', (route) => route.fulfill({
        status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(beforeDir, 'legacy.css'))
      }));
    }
    for (const route of routes) {
      const record = { route: route.path, name: route.name, desktop: null, scroll: null, phone: [], errors: [] };

      // Desktop: ownership, actions, metadata and scroll stability.
      await page.setViewportSize({ width: 1440, height: 1000 });
      await load(page, host.base, route.path);
      const desktop = await page.evaluate(measure);
      record.desktop = desktop;
      await page.screenshot({ path: path.join(HERE, 'captures', variant + '-brand-' + route.name + '-desktop.png') });
      const before = desktop;
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(150);
      const scrolled = await page.evaluate(measure);
      record.scroll = {
        before: { brandTop: before.brand && before.brand.top, navTop: before.nav && before.nav.top, scrollY: before.scrollY },
        after: { brandTop: scrolled.brand && scrolled.brand.top, navTop: scrolled.nav && scrolled.nav.top, scrollY: scrolled.scrollY }
      };
      if (variant === 'current') {
        assertDesktop(desktop, route.name + ' desktop');
        assert.equal(scrolled.ready, true, route.name + ': shell lost after scroll');
        assert(Math.abs((scrolled.brand ? scrolled.brand.top : 0) - (desktop.brand ? desktop.brand.top : 0)) <= 1, route.name + ': brand separated from fixed navigation on scroll: ' + JSON.stringify(record.scroll));
        assert(Math.abs((scrolled.nav ? scrolled.nav.top : 0) - (desktop.nav ? desktop.nav.top : 0)) <= 1, route.name + ': fixed navigation moved on scroll: ' + JSON.stringify(record.scroll));
        assert(scrolled.brandInNav && scrolled.brandOutsideMenu, route.name + ': brand ownership lost after scroll');
      }
      await page.screenshot({ path: path.join(HERE, 'captures', variant + '-brand-' + route.name + '-desktop-scrolled.png') });
      await page.evaluate(() => window.scrollTo(0, 0));

      // Phone: closed drawer, open drawer, close again. The compact wordmark
      // takes the closed state; the native banner rides the drawer transform.
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await waitForDrawer(page);
        const closed = await page.evaluate(measure);
        record.phone.push({ width, step: 'closed', ...closed });
        await page.screenshot({ path: path.join(HERE, 'captures', variant + '-brand-' + route.name + '-phone-' + width + '-closed.png') });
        if (variant === 'current') assertPhoneClosed(closed, route.name + ' ' + width + ' closed');

        await page.locator('.od-menu-toggle').click();
        await waitForDrawer(page);
        const open = await page.evaluate(measure);
        record.phone.push({ width, step: 'open', ...open });
        await page.screenshot({ path: path.join(HERE, 'captures', variant + '-brand-' + route.name + '-phone-' + width + '-open.png') });
        if (variant === 'current') assertPhoneOpen(open, route.name + ' ' + width + ' open');

        await page.locator('.od-nav-close').click();
        await waitForDrawer(page);
        const reopenedClosed = await page.evaluate(measure);
        record.phone.push({ width, step: 'closed-again', ...reopenedClosed });
        if (variant === 'current') {
          assertPhoneClosed(reopenedClosed, route.name + ' ' + width + ' closed-again');
          assert.deepEqual(reopenedClosed.brand, closed.brand, route.name + ': brand box changed across the drawer round trip');
        }
      }
      record.errors = errors.slice();
      out.routes.push(record);
    }
    out.pageErrors = errors;
    fs.writeFileSync(path.join(HERE, 'evidence', variant + '-brand-routes.json'), JSON.stringify(out, null, 2));
    if (variant === 'current') {
      assert.deepEqual(errors, [], 'page errors: ' + JSON.stringify(errors));
      const scrollable = out.routes.filter((route) => route.scroll && route.scroll.after.scrollY > 0).length;
      assert(scrollable >= 1, 'no tested route produced a scrollable document, so the scroll assertion was not exercised');
    }
    console.log(JSON.stringify({
      variant,
      scope: out.scope,
      pageErrors: out.pageErrors,
      routes: out.routes.map((route) => ({
        route: route.route,
        name: route.name,
        bannerCount: route.desktop && route.desktop.bannerCount,
        brandInNav: route.desktop && route.desktop.brandInNav,
        brandOutsideMenu: route.desktop && route.desktop.brandOutsideMenu,
        brandPosition: route.desktop && route.desktop.brandPosition,
        navPosition: route.desktop && route.desktop.navPosition,
        brandBox: route.desktop && route.desktop.brand,
        navBox: route.desktop && route.desktop.nav,
        model: route.desktop && route.desktop.modelText,
        actions: route.desktop && { logout: route.desktop.topbarLogout, reboot: route.desktop.topbarReboot, inDrawer: route.desktop.bannerActionNodes },
        drawerHasStatusBar: route.desktop && route.desktop.drawerHasStatusBar,
        scroll: route.scroll,
        phone: route.phone.filter((step) => step.width === 390).map((step) => ({
          step: step.step,
          navOpen: step.navOpen,
          navLeft: step.nav && step.nav.left,
          brandLeft: step.brand && step.brand.left,
          brandRight: step.brand && step.brand.right,
          wordmark: step.mobileWordmarkDisplay,
          expanded: step.toggleExpanded
        }))
      }))
    }, null, 2));
  } finally {
    await page.close();
    await browser.close();
    host.server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
