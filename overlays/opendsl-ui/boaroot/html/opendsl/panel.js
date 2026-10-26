/* Production status view: same-origin reads only; native forms own all writes. */
(function () {
  'use strict';
  var data = window.DeviceData;
  var busy = false;
  var active = [];
  var byId = function (id) { return document.getElementById(id); };
  var set = function (id, value) { var node = byId(id); if (node) node.textContent = value; };
  var pad = function (value) { return value < 10 ? '0' + value : String(value); };
  function uptimeLabel(seconds) {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor(seconds % 86400 / 3600);
    var minutes = Math.floor(seconds % 3600 / 60);
    if (days) return days + 'd ' + pad(hours) + 'h';
    if (hours) return hours + 'h ' + pad(minutes) + 'm';
    return minutes + 'm';
  }
  function annexLabel(value) {
    var text = String(value || '').replace(/_/g, ' ').replace(/^annex\s*/i, '').trim();
    return text ? 'Annex ' + text : 'Annex not read';
  }
  function dot(id, value) {
    var node = byId(id);
    if (!node) return;
    node.classList.toggle('unknown', value === null);
    node.classList.toggle('offline', value === false);
    var badge = node.closest ? node.closest('.badge') : null;
    if (badge) { badge.classList.toggle('neutral', value === null); badge.classList.toggle('bad', value === false); }
  }
  function dslPlain(on) {
    var badge = byId('dsl-badge');
    if (badge) badge.classList.toggle('plain', on);
  }
  function dslNote(text) {
    var node = byId('dsl-note');
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
  }
  function renderStatus(status) {
    var connected = status ? status.connected : null;
    var wireless = status ? status.wireless : null;
    var line = status ? status.lineState === 'up' : null;
    var connection = connected === null ? 'Not read' : connected ? 'Connected' : 'Disconnected';
    set('internet-status', connection);
    set('wireless-summary', wireless === null ? 'Not read' : wireless ? 'Enabled · 2.4 GHz' : 'Radio off');
    dot('internet-dot', connected); dot('wireless-dot', wireless); dot('dsl-dot', line);
    dslPlain(!status);
    var path = document.querySelector('.network-path');
    if (path) path.classList.toggle('unknown', !connected);
    set('system-uptime', uptimeLabel(status ? status.uptime : null));
    set('connection-detail', !status ? 'Unavailable' : line ? 'Synchronized' : 'Not synchronized');
  }
  function renderDSL(dsl) {
    if (!dsl) { renderDSLUnavailable(); return; }
    var synchronized = dsl.log_lineState.toLowerCase() === 'up';
    var raw = false;
    ['down', 'up'].forEach(function (direction) {
      var suffix = direction === 'down' ? 'Down' : 'Up';
      var rate = data.formatRate(synchronized ? dsl['log_DataRate' + suffix] : '');
      if (rate.unit === 'raw') raw = true;
      var caption = rate.unit === 'Mbps' ? 'Mbps sync rate' : rate.unit === 'raw' ? 'Raw device value' : 'Sync rate';
      set('rate-' + direction, rate.value); set('rate-' + direction + '-caption', caption);
      set('rate-' + direction + '-detail', rate.value); set('rate-' + direction + '-detail-unit', rate.unit === 'raw' ? '' : rate.unit);
      set('snr-' + direction, data.formatReading(synchronized ? dsl['log_SNRMargin' + suffix] : ''));
      set('atten-' + direction, data.formatReading(synchronized ? dsl['log_Atten' + suffix] : ''));
      set('crc-' + direction, data.formatReading(synchronized ? dsl['log_CRC' + suffix] : ''));
    });
    ['snr', 'atten', 'crc'].forEach(function (key) {
      var up = byId(key + '-up'), sep = byId(key + '-sep');
      if (up) up.hidden = false;
      if (sep) sep.hidden = false;
    });
    var opmode = dsl.log_Opmode ? dsl.log_Opmode : '';
    var annex = dsl.log_AdslType ? annexLabel(dsl.log_AdslType) : 'Annex not read';
    /* The producer reports strings such as "ITU G.992.5(ADSL2PLUS)". The
       summary tile shows the established mode; the raw string stays in the
       details row for diagnosis. */
    var mode = data.lineModeLabel(opmode);
    set('dsl-mode', mode || '—');
    set('dsl-mode-annex', annex);
    set('dsl-mode-detail', opmode || 'Unavailable');
    set('dsl-annex', annex);
    var tile = byId('dsl-mode');
    if (tile) {
      if (opmode) tile.setAttribute('title', opmode);
      else tile.removeAttribute('title');
    }
    dslNote(raw ? 'Modem-reported readings. “raw” means the device supplied no unit.' : '');
  }
  function renderDSLUnavailable() {
    ['down', 'up'].forEach(function (direction) {
      set('rate-' + direction, '—'); set('rate-' + direction + '-caption', 'Sync rate');
      set('rate-' + direction + '-detail', 'Unavailable'); set('rate-' + direction + '-detail-unit', '');
    });
    ['snr', 'atten', 'crc'].forEach(function (key) {
      set(key + '-down', 'Unavailable');
      var up = byId(key + '-up'), sep = byId(key + '-sep');
      if (up) up.hidden = true;
      if (sep) sep.hidden = true;
    });
    set('dsl-mode', '—'); set('dsl-mode-annex', 'Annex unavailable');
    set('dsl-mode-detail', 'Unavailable'); set('dsl-annex', 'Unavailable');
    dslNote('');
  }
  async function readText(path) {
    var controller = new AbortController(); active.push(controller);
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var response = await fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', mode: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var declared = response.headers.get('Content-Length');
      if (declared && Number(declared) > data.MAX_RESPONSE) throw new Error('Response exceeded the size limit');
      if (!response.body || !response.body.getReader) throw new Error('This browser cannot limit device responses safely');
      var reader = response.body.getReader(), chunks = [], bytes = 0;
      while (true) {
        var chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > data.MAX_RESPONSE) { await reader.cancel(); throw new Error('Response exceeded the size limit'); }
        chunks.push(chunk.value);
      }
      var joined = new Uint8Array(bytes), offset = 0;
      chunks.forEach(function (chunk) { joined.set(chunk, offset); offset += chunk.byteLength; });
      return new TextDecoder('utf-8', { fatal: true }).decode(joined);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Device request timed out or was cancelled');
      throw error;
    } finally {
      clearTimeout(timer); active = active.filter(function (item) { return item !== controller; });
    }
  }
  async function refresh() {
    if (busy) return;
    busy = true; byId('refresh-button').disabled = true; byId('refresh-button').setAttribute('aria-busy', 'true');
    renderStatus(null); renderDSL(null); set('notice-text', 'Reading connection status…'); byId('notice').hidden = false;
    var results = await Promise.allSettled([
      readText('/cgi-bin/ajax_status.xml').then(function (text) { return data.parseStatusXML(text); }),
      readText('/cgi-bin/ajax_AdslStatus.asp').then(function (text) { return data.parseDSLText(text); })
    ]);
    var errors = [];
    if (results[0].status === 'fulfilled') renderStatus(results[0].value);
    else {
      errors.push('Status: ' + results[0].reason.message);
      set('system-uptime', '—'); set('connection-detail', 'Unavailable'); dslPlain(true);
    }
    if (results[1].status === 'fulfilled') {
      renderDSL(results[1].value);
    } else {
      errors.push('DSL: ' + results[1].reason.message);
      renderDSLUnavailable();
    }
    set('footer-state', 'Connection status · ' + (errors.length ? 'Read incomplete' : 'Last read ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })));
    byId('notice').title = errors.join('. ');
    set('notice-text', errors.length ? (errors.length > 1 ? 'Connection status could not be read. Try Refresh again.' : 'Some connection readings could not be read. Try Refresh again.') : 'Status loaded. Refresh manually when needed.');
    byId('notice').classList.toggle('error', !!errors.length);
    byId('notice').hidden = !errors.length;
    busy = false; byId('refresh-button').disabled = false; byId('refresh-button').setAttribute('aria-busy', 'false');
  }
  byId('refresh-button').addEventListener('click', refresh);
  var mobile = window.matchMedia('(max-width:850px)');
  var scrim = byId('nav-scrim');
  function menu(expanded) {
    byId('sidebar').classList.toggle('open', expanded);
    byId('sidebar').inert = mobile.matches && !expanded;
    byId('menu-toggle').setAttribute('aria-expanded', String(expanded));
    if (scrim) scrim.hidden = !expanded || !mobile.matches;
    document.body.classList.toggle('nav-open', mobile.matches && expanded);
  }
  byId('menu-toggle').addEventListener('click', function () { menu(this.getAttribute('aria-expanded') !== 'true'); });
  var closeButton = byId('menu-close');
  if (closeButton) closeButton.addEventListener('click', function () { menu(false); byId('menu-toggle').focus(); });
  if (scrim) scrim.addEventListener('click', function () { menu(false); byId('menu-toggle').focus(); });
  mobile.addEventListener('change', function () { menu(false); });
  window.addEventListener('resize', function () { if (!mobile.matches) menu(false); });
  menu(false);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { menu(false); if (mobile.matches) byId('menu-toggle').focus(); }
  });
  var search = byId('od-settings-search');
  if (search) {
    var routes = {};
    Array.prototype.forEach.call(document.querySelectorAll('#settings-routes option'), function (option) {
      if (option.value && option.getAttribute('data-href')) routes[option.value] = option.getAttribute('data-href');
    });
    var openRoute = function () {
      var href = routes[search.value];
      if (href) fadeTo(href);
    };
    search.addEventListener('change', openRoute);
    search.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); openRoute(); }
      else if (event.key === 'Escape') { search.value = ''; search.blur(); }
    });
  }
  /* Sidebar links are real anchors. Move the active marker on press and use
     the same short cross-page fade as the native pages; reduced-motion users
     navigate immediately. */
  function setActive(item) {
    var current = document.querySelectorAll('.sidebar .nav-item.active');
    for (var i = 0; i < current.length; i++) {
      current[i].classList.remove('active');
      current[i].removeAttribute('aria-current');
    }
    if (item) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    }
  }
  var transition = {active: false, frame: 0};
  function resetPageTransition() {
    transition.active = false;
    if (transition.frame) {
      window.cancelAnimationFrame(transition.frame);
      transition.frame = 0;
    }
    document.body.classList.remove('od-leaving');
  }
  /* The click handler moves the selection before leaving, and a bfcache
     restore keeps that destination marker on the previous document. Reset the
     selection from the URL this document actually shows. */
  function restoreNavSelection() {
    var items = document.querySelectorAll('.sidebar a.nav-item[href]');
    for (var i = 0; i < items.length; i++) {
      var url;
      try { url = new URL(items[i].getAttribute('href'), location.href); } catch (error) { continue; }
      if (url.pathname === location.pathname) { setActive(items[i]); return; }
    }
  }
  /* A document restored from the back/forward cache keeps the frozen fade
     state; clear it so the restored page stays visible and clickable. */
  window.addEventListener('pageshow', function () {
    resetPageTransition();
    restoreNavSelection();
  });
  window.addEventListener('pagehide', function () {
    transition.active = false;
    if (transition.frame) {
      window.cancelAnimationFrame(transition.frame);
      transition.frame = 0;
    }
  });
  function fadeTo(href) {
    if (!href) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.location.assign(href); return;
    }
    if (transition.active || !window.requestAnimationFrame) {
      window.location.assign(href); return;
    }
    transition.active = true;
    document.body.classList.add('od-leaving');
    var started = 0;
    var step = function (now) {
      if (!transition.active) return;
      if (!started) started = now;
      if (now - started < 150) transition.frame = window.requestAnimationFrame(step);
      else window.location.assign(href);
    };
    transition.frame = window.requestAnimationFrame(step);
  }
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target;
    if (!target || !target.closest) return;
    var nav = target.closest('a.nav-item[href]');
    if (nav) {
      setActive(nav);
      event.preventDefault();
      event.stopPropagation();
      fadeTo(nav.href);
      return;
    }
    var link = target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || link.hasAttribute('onclick')) return;
    var raw = link.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || /^javascript:/i.test(raw) || /^(mailto|tel):/i.test(raw)) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (error) { return; }
    if (url.origin !== location.origin || /logout|reboot/i.test(url.pathname)) return;
    event.preventDefault();
    event.stopPropagation();
    fadeTo(url.href);
  }, true);
  var firmware = byId('firmware-version');
  if (firmware && firmware.textContent.trim()) byId('firmware-line').hidden = false;
  window.addEventListener('pagehide', function () { active.forEach(function (controller) { controller.abort(); }); });
  renderStatus(null); renderDSL(null);
  refresh();
})();
