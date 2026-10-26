/* OpenDSL presentation enhancement for the native documents.
   It never requests data, never submits a form, never stores anything and
   never rewrites a native field. It only moves static presentation nodes into
   the approved page layout and adds accessible labels. */
(function () {
  'use strict';

  /* OpenDSL build identity, shown beside the native vendor version on the
     manual firmware page. The generator substitutes the placeholder from the
     Makefile's CURRENT_VERSION/OPENDSL_RELEASE so the page can never claim a
     version other than the image it was built into. */
  var OPENDSL_RELEASE = '@@OPENDSL_RELEASE@@';

  /* Embedded wizard/status documents let their host paint the canvas; a
     standalone qis/* document keeps the native page gradient. review Q01 */
  if (window.self !== window.top && document.body) {
    document.body.classList.add('od-embedded');
  }

  var main = document.getElementById('mainMenu');
  var host = main ? main.parentNode : null;
  var row = main ? main.closest('tr') : null;
  var labelSeq = 0;

  function contentCell() {
    var tc = document.getElementById('tabMenu');
    if (tc) {
      var owner = tc.closest ? tc.closest('td') : null;
      if (owner) return owner;
    }
    if (row) {
      var fallback = null;
      for (var i = 0; i < row.children.length; i++) {
        var cell = row.children[i];
        if (cell.contains(main)) continue;
        if (cell.querySelector('#FormTitle, #tabMenu, #NM_table')) return cell;
        if (fallback) continue;
        var width = parseFloat(cell.getAttribute('width'));
        if ((isFinite(width) && width > 40) || text(cell) || cell.children.length) fallback = cell;
      }
      if (fallback) return fallback;
    }
    var ft = document.getElementById('FormTitle');
    if (ft) {
      var c = ft.closest('td');
      if (c) return c;
    }
    return null;
  }

  /* Undo state.js banner compensation without cloning nodes or losing handlers. */
  function normalizeContentWrapper() {
    var tc = document.getElementById('tabMenu');
    if (!tc) return;
    var parent = tc.parentNode;
    if (!parent || parent.tagName !== 'DIV') return;
    var cell = parent.parentNode;
    if (!cell || cell.tagName !== 'TD') return;
    var inline = String(parent.getAttribute('style') || '');
    var computed = window.getComputedStyle ? parseFloat(window.getComputedStyle(parent).marginTop) : NaN;
    if (!(computed < 0) && !/margin-top\s*:\s*-/i.test(inline)) return;
    while (parent.firstChild) cell.insertBefore(parent.firstChild, parent);
    if (parent.parentNode) parent.parentNode.removeChild(parent);
  }

  /* Phone navigation: one toggle in the compact header, one close control in
     the open drawer. The native menu keeps its own links and handlers. */
  if (main && host) {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'od-menu-toggle';
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'mainMenu subMenu');
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('od-nav-open', open);
      if (open && main) {
        var first = main.querySelector('div[onclick]') || main.querySelector('a');
        if (first) first.focus();
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('od-nav-open')) {
        document.body.classList.remove('od-nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
    document.body.appendChild(toggle);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'od-nav-close';
    close.setAttribute('aria-label', 'Close navigation');
    close.addEventListener('click', function () {
      document.body.classList.remove('od-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });
    /* The close control must follow the drawer transform. */
    host.appendChild(close);
    document.body.classList.add('od-enhanced');
  }

  /* Native document.write leaves script source beside the data it rendered. */
  var NON_TEXT_TAGS = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1 };
  function visibleText(node) {
    if (!node) return '';
    var parts = [];
    var walk = function (parent) {
      for (var child = parent.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) parts.push(child.nodeValue || '');
        else if (child.nodeType === 1 && !NON_TEXT_TAGS[String(child.tagName || '').toUpperCase()]) walk(child);
      }
    };
    walk(node);
    return parts.join('').replace(/\s+/g, ' ').trim();
  }
  function text(node) { return visibleText(node); }

  /* Reject mixed or ambiguous source values instead of choosing an address. */
  function macAddress(value) {
    var address = String(value || '').trim().replace(/-/g, ':').toUpperCase();
    return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(address) ? address : 'Unavailable';
  }

  function modelName() {
    var label = document.querySelector('.modelName_top');
    return label ? text(label).replace(/_/g, ' ') : '';
  }

  function bandName() {
    /* The native banner exposes the 2.4 GHz SSID element; the 5 GHz element
       stays hidden for this model. No band is invented when neither exists. */
    if (document.getElementById('elliptic_ssid_2g')) return '2.4 GHz';
    return '';
  }

  var TITLES = {
    '/Advanced_ACL_Content.asp': 'Wireless MAC filter',
    '/Advanced_ADSL_Content.asp': 'DSL settings',
    '/Advanced_ASUSDDNS_Content.asp': 'Dynamic DNS',
    '/Advanced_BasicFirewall_Content.asp': 'Firewall',
    '/Advanced_DHCP_Content.asp': 'DHCP server',
    '/Advanced_DSL_Content.asp': 'Internet connection',
    '/Advanced_Exposed_Content.asp': 'Exposed station (DMZ)',
    '/Advanced_Feedback.asp': 'Send feedback',
    '/Advanced_Firewall_Content.asp': 'Network services filter',
    '/Advanced_FirmwareUpgrade_Content.asp': 'Firmware upgrade',
    '/Advanced_GWStaticRoute_Content.asp': 'Static routes',
    '/Advanced_IPTV_Content.asp': 'IPTV',
    '/Advanced_IPv6_Content.asp': 'IPv6',
    '/Advanced_KeywordFilter_Content.asp': 'Keyword filter',
    '/Advanced_LAN_Content.asp': 'LAN address',
    '/Advanced_MACFilter_Content.asp': 'MAC filter',
    '/Advanced_NATPassThrough_Content.asp': 'NAT passthrough',
    '/Advanced_PortTrigger_Content.asp': 'Port triggering',
    '/Advanced_Privacy.asp': 'Privacy notice',
    '/Advanced_QOSUserPrio_Content.asp': 'QoS priorities',
    '/Advanced_QOSUserRules_Content.asp': 'QoS rules',
    '/Advanced_SettingBackup_Content.asp': 'Backup & restore',
    '/Advanced_SwitchCtrl_Content.asp': 'Switch control',
    '/Advanced_System_Content.asp': 'System settings',
    '/Advanced_URLFilter_Content.asp': 'URL filter',
    '/Advanced_VirtualServer_Content.asp': 'Port forwarding',
    '/Advanced_WANPort_Content.asp': 'WAN port',
    '/Advanced_WAdvanced_Content.asp': 'Wireless professional',
    '/Advanced_WMode_Content.asp': 'Wireless bridge',
    '/Advanced_WSecurity_Content.asp': 'RADIUS settings',
    '/Advanced_WWPS_Content.asp': 'WPS',
    '/Advanced_Wireless_Content.asp': 'Wireless',
    '/Bandwidth_Limiter.asp': 'Bandwidth limiter',
    '/Feedback_Info.asp': 'Feedback information',
    '/Guest_network.asp': 'Guest network',
    '/Logout.asp': 'Signed out',
    '/Main_AccessLog_Content.asp': 'Access log',
    '/Main_AdslStatus_Content.asp': 'DSL status',
    '/Main_Analysis_Content.asp': 'Network diagnostics',
    '/Main_ConnStatus_Content.asp': 'Connections',
    '/Main_DHCPStatus_Content.asp': 'DHCP leases',
    '/Main_IPTStatus_Content.asp': 'Port forwarding status',
    '/Main_LogStatus_Content.asp': 'System log',
    '/Main_Netstat_Content.asp': 'Network connections',
    '/Main_RouteStatus_Content.asp': 'Routing table',
    '/Main_Spectrum_Content.asp': 'Spectrum',
    '/Main_TrafficMonitor_realtime.asp': 'Live traffic',
    '/Main_WOL_Content.asp': 'Wake on LAN',
    '/Main_WStatus_Content.asp': 'Wireless clients',
    '/Main_WebHistory_Content.asp': 'Web history',
    '/ParentalControl.asp': 'Parental controls',
    '/QoS_EZQoS.asp': 'Quality of service',
    '/Wireless_Content_redirect.asp': 'Opening wireless settings',
    '/blocking.asp': 'Access restricted',
    '/error_page.asp': 'Page unavailable',
    '/get_release_note0.asp': 'Release notes',
    '/get_release_note1.asp': 'Release notes',
    '/index2.asp': 'Network Map',
    '/language_change.asp': 'Applying language',
    '/live_update.asp': 'Manual firmware update',
    '/mod_login.asp': 'Sign in required',
    '/start_apply.asp': 'Applying settings'
  };

  var QIS_TITLES = {
    '/qis/QIS_admin_pass.asp': 'Secure your modem',
    '/qis/QIS_PTM_manual_setting.asp': 'Your ISP settings',
    '/qis/QIS_annex_setting.asp': 'DSL line type',
    '/qis/QIS_bridge_cfg_tmp.asp': 'Bridge connection',
    '/qis/QIS_detect.asp': 'Detecting your connection',
    '/qis/QIS_finish.asp': 'You\u2019re connected',
    '/qis/QIS_ipoa_cfg_tmp.asp': 'Static IP connection',
    '/qis/QIS_manual_setting.asp': 'Your ISP settings',
    '/qis/QIS_mer_cfg.asp': 'Automatic IP connection',
    '/qis/QIS_mer_cfg_tmp.asp': 'IP address settings',
    '/qis/QIS_ppp_cfg.asp': 'Internet account',
    '/qis/QIS_ppp_cfg_tmp.asp': 'Internet account',
    '/qis/QIS_process.asp': 'Applying your settings',
    '/qis/QIS_verify_detect.asp': 'Checking your connection',
    '/qis/QIS_wireless.asp': 'Name your Wi-Fi'
  };

  function nativeTitle() {
    var title = document.querySelector('.formfonttitle');
    if (title) return title;
    var map = document.getElementById('NM_table');
    if (map) {
      var parts = String(document.title || '').split(' - ');
      var last = parts[parts.length - 1].trim();
      if (last) {
        var heading = document.createElement('div');
        heading.className = 'formfonttitle';
        heading.textContent = last;
        return heading;
      }
    }
    return null;
  }

  /* Page header: native title, page group and device context. Native reboot,
     log out and metadata move into the shared topbar/drawer without cloning or
     replacing their nodes, handlers or destinations. */
  var headGroup = null;
  var headMeta = null;
  var pageTitleSuffix = '';

  function routePath() {
    var path = String(location.pathname || '');
    path = path.replace(/^\/cgi-bin(?=\/)/, '');
    return path || '/';
  }

  function routeGroup() {
    var p = routePath();
    if (/^\/(index2\.asp|OpenDSL\.asp|blocking\.asp|error_page\.asp)$/.test(p)) return 'Workspace';
    if (/^\/qis\//.test(p) || /QIS_wizard/.test(p)) return 'Setup';
    if (/^\/(Main_Login|Main_Password|mod_login)\.asp$/.test(p)) return 'System';
    if (/^\/(Guest_network\.asp|Advanced_(Wireless|WAdvanced|WMode|WSecurity|WWPS|ACL)_Content)/.test(p)) return 'Wireless';
    if (/^\/Advanced_(LAN|DHCP|GWStaticRoute|IPTV|SwitchCtrl)_Content/.test(p)) return 'Local network';
    if (/^\/Advanced_(ADSL|DSL|WANPort|PortTrigger|VirtualServer|Exposed|ASUSDDNS|NATPassThrough|IPv6)_Content/.test(p)) return 'Internet & DSL';
    if (/^\/Advanced_(BasicFirewall|Firewall|URLFilter|MACFilter|KeywordFilter)_Content/.test(p)) return 'Firewall';
    if (/^\/(QoS_EZQoS|Bandwidth_Limiter)\.asp$/.test(p) || /^\/Advanced_QOSUser/.test(p) || /^\/Main_(TrafficMonitor|WebHistory|Spectrum)_/.test(p)) return 'Traffic manager';
    if (/^\/Main_/.test(p) || /^\/(Main_LogStatus_Content|Feedback_Info)\.asp$/.test(p)) return 'Diagnostics';
    if (/^\/Advanced_(System|FirmwareUpgrade|SettingBackup|Privacy|Feedback)/.test(p)) return 'Administration';
    if (/^\/(ParentalControl\.asp|Wireless_Content_redirect\.asp|language_change\.asp|live_update\.asp|start_apply\.asp|Logout\.asp|get_release_note)/.test(p)) return 'System';
    if (/^\/device-map\//.test(p)) return 'Network';
    return '';
  }

  function nativeLinkHref(node) {
    var onclick = String(node.getAttribute('onclick') || '');
    var match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
    match = onclick.match(/go_setting\(['"]([^'"]+)['"]\)/);
    if (match) return match[1];
    return node.getAttribute('href') || '';
  }

  /* Local route lookup only: the option list comes from the generated native
     menu and the route title maps. It never searches the device. */
  function buildSettingsSearch() {
    var wrap = element('div', 'od-topbar-search');
    var input = document.createElement('input');
    input.type = 'search';
    input.id = 'od-settings-search';
    input.setAttribute('aria-label', 'Search settings');
    input.setAttribute('placeholder', 'Search settings\u2026');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('list', 'od-settings-routes');
    wrap.appendChild(input);
    var list = document.createElement('datalist');
    list.id = 'od-settings-routes';
    var seen = {};
    var add = function (label, href) {
      label = String(label || '').replace(/\s+/g, ' ').trim();
      if (!label || !href || /^(#|javascript:)/i.test(href)) return;
      var key = label + '|' + href;
      if (seen[key]) return;
      seen[key] = 1;
      var option = document.createElement('option');
      option.value = label;
      option.setAttribute('data-href', href);
      list.appendChild(option);
    };
    var items = document.querySelectorAll('#mainMenu .menu, #subMenu .menu');
    for (var i = 0; i < items.length; i++) add(text(items[i]), nativeLinkHref(items[i]));
    for (var path in TITLES) {
      if (Object.prototype.hasOwnProperty.call(TITLES, path)) add(TITLES[path], path);
    }
    for (var qpath in QIS_TITLES) {
      if (Object.prototype.hasOwnProperty.call(QIS_TITLES, qpath)) add(QIS_TITLES[qpath], qpath);
    }
    var go = function (name) {
      var wanted = String(name || '').trim().toLowerCase();
      if (!wanted) return false;
      var exact = null, partial = null;
      for (var o = 0; o < list.options.length; o++) {
        var value = String(list.options[o].value || '').toLowerCase();
        if (value === wanted) { exact = list.options[o]; break; }
        if (!partial && value.indexOf(wanted) === 0) partial = list.options[o];
      }
      var target = exact || partial;
      if (!target) return false;
      window.location.assign(target.getAttribute('data-href'));
      return true;
    };
    input.addEventListener('change', function () { go(input.value); });
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      go(input.value);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildDeviceDrawer(infoButton) {
    var bar = document.querySelector('.statusBar');
    if (!bar || !bar.parentNode) return;
    var backdrop = element('div', 'od-drawer-backdrop');
    backdrop.hidden = true;
    var drawer = document.createElement('aside');
    drawer.className = 'od-device-drawer';
    drawer.id = 'od-device-drawer';
    drawer.hidden = true;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Device information');
    var head = element('div', 'od-drawer-head');
    var titles = element('div', 'od-drawer-titles');
    titles.appendChild(element('span', 'od-eyebrow', 'Your modem'));
    var heading = document.createElement('h2');
    heading.textContent = 'Device info';
    titles.appendChild(heading);
    head.appendChild(titles);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'od-drawer-close';
    close.setAttribute('aria-label', 'Close Device info');
    head.appendChild(close);
    drawer.appendChild(head);
    var body = element('div', 'od-drawer-body');
    bar.parentNode.removeChild(bar);
    body.appendChild(bar);
    drawer.appendChild(body);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    var refresh = decorateDeviceStatus(bar, body);

    var open = function () {
      drawer.hidden = false;
      backdrop.hidden = false;
      infoButton.setAttribute('aria-expanded', 'true');
      if (refresh) refresh();
      close.focus();
    };
    var hide = function () {
      drawer.hidden = true;
      backdrop.hidden = true;
      infoButton.setAttribute('aria-expanded', 'false');
      infoButton.focus();
    };
    infoButton.setAttribute('aria-controls', 'od-device-drawer');
    infoButton.setAttribute('aria-expanded', 'false');
    infoButton.addEventListener('click', function () {
      if (drawer.hidden) open();
      else hide();
    });
    close.addEventListener('click', hide);
    backdrop.addEventListener('click', hide);
    document.addEventListener('keydown', function (event) {
      if (drawer.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        hide();
        return;
      }
      if (event.key !== 'Tab') return;
      var nodes = drawer.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]');
      var focusable = [];
      for (var f = 0; f < nodes.length; f++) {
        if (nodes[f].getClientRects().length) focusable.push(nodes[f]);
      }
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    headMeta = drawer;
  }

  /* The native status bar carries the live firmware, SSID and indicator nodes.
     Give them labelled rows without inventing a reading: values the native
     scripts have not written render as "Unavailable", and every status class is
     mapped explicitly. The nodes keep their ids and native click handlers. */
  function decorateDeviceStatus(bar, body) {
    var titledown = bar.querySelector('.titledown');
    var firmware = document.getElementById('firmver');
    var firmwareLink = firmware ? firmware.closest('a') : null;
    var ssid = document.getElementById('elliptic_ssid_2g');
    var adsl = document.getElementById('adsl_line_status');
    var internet = document.getElementById('connect_status');
    var guest = document.getElementById('guestnetwork_status');
    var notifications = document.getElementById('notification_status1');
    var model = text(document.querySelector('.modelName_top')) || modelName();

    var list = element('dl', 'od-readouts od-device-readouts');
    var refresh = [];

    var addRow = function (label) {
      var line = element('div', 'od-readout');
      line.appendChild(element('dt', '', label));
      var value = document.createElement('dd');
      value.className = 'od-readout-value';
      line.appendChild(value);
      list.appendChild(line);
      return value;
    };
    var addText = function (label, value) {
      if (value) addRow(label).textContent = value;
    };
    addText('Model', model);
    if (firmwareLink) {
      var fwValue = addRow('Firmware');
      fwValue.appendChild(firmwareLink);
      var fwEmpty = element('span', 'od-readout-empty', 'Unavailable');
      fwValue.appendChild(fwEmpty);
      refresh.push(function () { fwEmpty.hidden = !!text(firmwareLink); });
    }
    if (ssid) {
      var ssidValue = addRow('SSID \u00b7 2.4 GHz');
      ssidValue.appendChild(ssid);
      var ssidEmpty = element('span', 'od-readout-empty', 'Unavailable');
      ssidValue.appendChild(ssidEmpty);
      refresh.push(function () { ssidEmpty.hidden = !!text(ssid); });
    }
    var addStatus = function (label, node, states) {
      if (!node) return;
      var value = addRow(label);
      var dot = element('span', 'od-native-state');
      dot.appendChild(node);
      value.appendChild(dot);
      var copy = element('span', 'od-readout-state');
      value.appendChild(copy);
      refresh.push(function () {
        var cls = String(node.className || '');
        var state = '';
        for (var key in states) {
          if (states.hasOwnProperty(key) && new RegExp('(^|\\s)' + key + '(\\s|$)').test(cls)) state = states[key];
        }
        copy.textContent = state || 'Unavailable';
        copy.classList.toggle('od-muted', !state);
        dot.classList.toggle('od-unknown', !state);
      });
    };
    addStatus('DSL line', adsl, {
      linestatusup: 'Connected', linestatusdown: 'Disconnected',
      linestatusdiag: 'Diagnosing', linestatuselse: 'Standby'
    });
    addStatus('Internet', internet, { connectstatuson: 'Connected', connectstatusoff: 'Disconnected' });
    addStatus('Guest network', guest, { guestnetworkstatuson: 'Enabled', guestnetworkstatusoff: 'Disabled' });
    if (list.children.length) body.insertBefore(list, bar);

    if (notifications) {
      var section = element('div', 'od-drawer-notifications');
      section.appendChild(element('h3', '', 'Notifications'));
      var line = element('div', 'od-notification-line');
      line.appendChild(notifications);
      var label = document.createElement('button');
      label.type = 'button';
      label.className = 'od-notification-label';
      label.textContent = 'View notifications';
      label.addEventListener('click', function () {
        if (typeof notifications.click === 'function') notifications.click();
      });
      line.appendChild(label);
      section.appendChild(line);
      var empty = element('p', 'od-notification-empty', 'No notifications available.');
      section.appendChild(empty);
      refresh.push(function () {
        var active = /notification_on1?/.test(String(notifications.className || ''));
        line.hidden = !active;
        empty.hidden = active;
        line.classList.toggle('od-has-notifications', active);
      });
      body.appendChild(section);
    }
    /* Keep the native table in the document so page scripts still resolve the
       ids they write to; only its empty chrome and copied labels are hidden. */
    if (titledown) titledown.hidden = true;
    var app = document.getElementById('app_icon');
    if (app && app.parentNode) app.parentNode.hidden = true;
    bar.hidden = true;

    var run = function () {
      for (var n = 0; n < refresh.length; n++) refresh[n]();
    };
    run();
    return run;
  }

  /* R6 navigation: the native menu supplies the live targets and handlers.
     Republish the same nodes under the three R6 groups and add the routes the
     stock menu omits on this page (all are real shipped pages). No link,
     handler or destination is invented or replaced. */
  var NAV_ITEMS = [
    { key: 'opendsl.asp', href: '/OpenDSL.asp', label: 'Overview', icon: 'activity', group: 'workspace' },
    { key: 'index2.asp', href: '/index2.asp', label: 'Network Map', icon: 'network', group: 'workspace' },
    { key: 'guest_network.asp', href: '/Guest_network.asp', label: 'Guest network', icon: 'guests', group: 'workspace' },
    { key: 'parentalcontrol.asp', href: '/ParentalControl.asp', label: 'Access controls', icon: 'lock', group: 'workspace' },
    { key: 'qos_ezqos.asp', href: '/QoS_EZQoS.asp', label: 'Traffic manager', icon: 'traffic', group: 'workspace' },
    { key: 'advanced_wireless_content.asp', href: '/Advanced_Wireless_Content.asp', label: 'Wireless', icon: 'wifi', group: 'network' },
    { key: 'advanced_lan_content.asp', href: '/Advanced_LAN_Content.asp', label: 'Local network', icon: 'lan', group: 'network' },
    { key: 'advanced_dsl_content.asp', href: '/Advanced_DSL_Content.asp', label: 'Internet & DSL', icon: 'internet', group: 'network' },
    { key: 'advanced_iptv_content.asp', href: '/Advanced_IPTV_Content.asp', label: 'IPTV', icon: 'devices', group: 'network' },
    { key: 'advanced_basicfirewall_content.asp', href: '/Advanced_BasicFirewall_Content.asp', label: 'Firewall', icon: 'firewall', group: 'network' },
    { key: 'advanced_system_content.asp', href: '/Advanced_System_Content.asp', label: 'Administration', icon: 'settings', group: 'system' },
    { key: 'main_logstatus_content.asp', href: '/Main_LogStatus_Content.asp', label: 'Logs & diagnostics', icon: 'logs', group: 'system' },
    { key: 'main_analysis_content.asp', href: '/Main_Analysis_Content.asp', label: 'Network tools', icon: 'tools', group: 'system' }
  ];
  var NAV_GROUPS = [['workspace', 'Workspace'], ['network', 'Network'], ['system', 'System']];

  function navKey(value) {
    var href = String(value || '').split('#')[0].split('?')[0];
    var match = href.match(/([^/]+\.asp)$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function activeNavKey() {
    var key = navKey(routePath());
    if (/^advanced_(wwps|wadvanced|wmode|wsecurity|acl)_content\.asp$/.test(key)) return 'advanced_wireless_content.asp';
    /* R6R-04: the approved R6 sidebar marks DSL settings (Advanced_ADSL) under
       Internet & DSL, alongside the Internet connection route. Only the active
       indicator moves; every native destination keeps its own handler. */
    if (/^advanced_(adsl|dsl|wanport|porttrigger|virtualserver|exposed|asusddns|natpassthrough|ipv6)_content\.asp$/.test(key)) return 'advanced_dsl_content.asp';
    if (/^advanced_(dhcp|gwstaticroute|switchctrl|lan)_content\.asp$/.test(key)) return 'advanced_lan_content.asp';
    if (/^advanced_(firewall|urlfilter|macfilter|keywordfilter)_content\.asp$/.test(key)) return 'advanced_basicfirewall_content.asp';
    if (/^advanced_(firmwareupgrade|settingbackup|system|privacy|feedback)/.test(key)) return 'advanced_system_content.asp';
    if (/^main_(trafficmonitor|webhistory|spectrum)_/.test(key)) return 'qos_ezqos.asp';
    if (key === 'main_analysis_content.asp') return key;
    if (/^main_/.test(key)) return 'main_logstatus_content.asp';
    return key;
  }

  function navPool() {
    var pool = [];
    var seen = {};
    var labelKeys = {
      'network map': 'index2.asp', 'guest network': 'guest_network.asp',
      'parental controls': 'parentalcontrol.asp', 'traffic manager': 'qos_ezqos.asp',
      'wireless': 'advanced_wireless_content.asp', 'lan': 'advanced_lan_content.asp',
      'wan': 'advanced_dsl_content.asp', 'firewall': 'advanced_basicfirewall_content.asp',
      'administration': 'advanced_system_content.asp', 'system log': 'main_logstatus_content.asp',
      'network tools': 'main_analysis_content.asp'
    };
    var containers = [document.getElementById('mainMenu'), document.getElementById('subMenu')];
    for (var c = 0; c < containers.length; c++) {
      if (!containers[c]) continue;
      var nodes = containers[c].querySelectorAll('.menu, [class*="_r"]');
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        var cls = String(node.className || '');
        if (/\bm0_r\b/.test(cls) || /\bm_qis_r\b/.test(cls)) continue;
        var key = navKey(nativeLinkHref(node));
        if (!key) key = labelKeys[text(node).toLowerCase()] || '';
        if (key && seen[key]) continue;
        if (key) seen[key] = 1;
        pool.push({ key: key, node: node });
      }
    }
    return pool;
  }

  function markNavCurrent(node) {
    var current = document.querySelectorAll('#mainMenu .od-current');
    for (var i = 0; i < current.length; i++) {
      current[i].classList.remove('od-current');
      current[i].setAttribute('aria-current', 'false');
    }
    if (!node) return;
    node.classList.add('od-current');
    node.setAttribute('aria-current', 'page');
  }

  /* Native links normally reload the document. Add a short, non-blocking
     cross-fade before leaving; the destination still loads through the same
     native URL. Modifier clicks, downloads, targets and logout/reboot keep
     their browser behavior. */
  var transition = { active: false, frame: 0 };
  function resetPageTransition() {
    transition.active = false;
    if (transition.frame) {
      window.cancelAnimationFrame(transition.frame);
      transition.frame = 0;
    }
    document.body.classList.remove('od-leaving');
  }
  /* Marking the destination before leaving survives a bfcache restore, so the
     restored document would show the next page's row selected. Recompute the
     selection from the route the document is actually showing. */
  function syncNavCurrent() {
    var key = activeNavKey();
    var items = document.querySelectorAll('#mainMenu .od-nav-item');
    for (var i = 0; i < items.length; i++) {
      var current = navKey(items[i].getAttribute('data-od-href')) === key;
      items[i].classList.toggle('od-current', current);
      items[i].setAttribute('aria-current', current ? 'page' : 'false');
    }
  }
  /* A page restored from the back/forward cache keeps the frozen fade state;
     clearing it on pageshow keeps the restored document visible and usable. */
  window.addEventListener('pageshow', function () {
    resetPageTransition();
    syncNavCurrent();
  });
  window.addEventListener('pagehide', function () {
    transition.active = false;
    if (transition.frame) {
      window.cancelAnimationFrame(transition.frame);
      transition.frame = 0;
    }
  });

  function beginPageTransition(href) {
    if (!href) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !window.requestAnimationFrame) { window.location.assign(href); return; }
    if (transition.active) return;
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

  function navNode(item, pool) {
    var native = null;
    for (var p = 0; p < pool.length; p++) {
      if (item.key && pool[p].key === item.key) {
        native = pool[p].node;
        pool.splice(p, 1);
        break;
      }
    }
    var node = native;
    if (node) {
      /* The native generator marks the selected category with m<N>_r. Once the
         node is republished under the R6 groups that marker can point at a
         different item than the route (ADSL settings is now Internet & DSL),
         and it is not the presentation's selection class. Strip it and use
         od-current, which navNode computes from the route. review R6R-04 */
      var classes = String(node.className || '').split(/\s+/);
      for (var c = 0; c < classes.length; c++) {
        if (/^m\d+_r$/.test(classes[c])) node.classList.remove(classes[c]);
      }
      node.classList.add('od-nav-item');
      var labels = node.querySelectorAll('[id^="menu_string"], [id^="option_str1"]');
      for (var l = 0; l < labels.length; l++) labels[l].textContent = item.label;
    } else {
      node = element('div', 'menu od-nav-item');
      node.setAttribute('role', 'link');
      node.setAttribute('tabindex', '0');
      var table = document.createElement('table');
      var tbody = document.createElement('tbody');
      var row = document.createElement('tr');
      var ico = document.createElement('td');
      var glyph = element('span', 'od-nav-glyph');
      glyph.setAttribute('data-icon', item.icon);
      ico.appendChild(glyph);
      var cell = document.createElement('td');
      cell.appendChild(element('div', 'od-nav-label', item.label));
      row.appendChild(ico);
      row.appendChild(cell);
      tbody.appendChild(row);
      table.appendChild(tbody);
      node.appendChild(table);
      (function (href) {
        var go = function () { beginPageTransition(href); };
        node.addEventListener('click', go);
        node.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          go();
        });
      }(item.href));
    }
    if (item.href) node.setAttribute('data-od-href', item.href);
    if (native) {
      node.setAttribute('role', 'link');
      node.setAttribute('tabindex', '0');
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        node.click();
      });
    }
    var active = activeNavKey() === item.key;
    node.classList.toggle('od-current', active);
    node.setAttribute('aria-current', active ? 'page' : 'false');
    return node;
  }

  function decorateNavigation() {
    if (!host) return;
    host.classList.add('od-nav-cell');
    var mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return;
    var quick = mainMenu.querySelector('.m_qis_r');
    if (quick) {
      var quickLabel = quick.querySelector('div:not([id])');
      if (quickLabel) quickLabel.textContent = /quick/i.test(text(quick)) ? 'Quick setup' : text(quickLabel);
    }
    if (!mainMenu.querySelector('.od-nav-group')) {
      var pool = navPool();
      var items = [];
      for (var i = 0; i < NAV_ITEMS.length; i++) {
        var node = navNode(NAV_ITEMS[i], pool);
        items.push({ group: NAV_ITEMS[i].group, node: node, key: NAV_ITEMS[i].key });
      }
      var oldCaptions = mainMenu.querySelectorAll('.od-nav-caption');
      for (var c = 0; c < oldCaptions.length; c++) oldCaptions[c].parentNode.removeChild(oldCaptions[c]);
      var headings = mainMenu.querySelectorAll('.m0_r');
      for (var h = 0; h < headings.length; h++) headings[h].parentNode.removeChild(headings[h]);
      while (mainMenu.firstChild) mainMenu.removeChild(mainMenu.firstChild);
      if (quick) mainMenu.appendChild(quick);
      for (var g = 0; g < NAV_GROUPS.length; g++) {
        var groupItems = [];
        for (var n = 0; n < items.length; n++) if (items[n].group === NAV_GROUPS[g][0]) groupItems.push(items[n].node);
        if (!groupItems.length) continue;
        mainMenu.appendChild(element('span', 'od-nav-caption', NAV_GROUPS[g][1]));
        for (var m = 0; m < groupItems.length; m++) mainMenu.appendChild(groupItems[m]);
      }
    }
    if (!host.querySelector('.od-sidebar-model')) {
      var model = modelName();
      var band = bandName();
      if (model || band) {
        var footer = element('div', 'od-sidebar-model');
        var status = element('span', 'od-sidebar-band');
        status.appendChild(element('i', ''));
        status.appendChild(document.createTextNode((band || '2.4 GHz') + ' \u00b7 ADSL gateway'));
        footer.appendChild(status);
        host.appendChild(footer);
      }
    }
  }

  /* Keep the native brand with the fixed drawer, outside its scrolling menu. */
  function mountNavBrand() {
    var banner = document.querySelector('.banner1');
    if (!banner || !host) return;
    banner.classList.add('od-nav-brand');
    if (host.contains(banner)) return;
    host.insertBefore(banner, host.firstChild);
  }

  function buildShell(cell, head) {
    if (!cell || !main) return;
    if (document.body.classList.contains('LevelQIS')) return;
    if (document.querySelector('.QISmain')) return;
    if (document.querySelector('.od-topbar')) return;
    cell.classList.add('od-content-cell');
    var topbar = element('div', 'od-topbar');
    topbar.appendChild(buildSettingsSearch());
    var compactBrand = element('span', 'od-mobile-brand', 'OpenDSL');
    compactBrand.setAttribute('aria-hidden', 'true');
    topbar.appendChild(compactBrand);
    var actions = element('div', 'od-topbar-actions');
    var info = document.createElement('button');
    info.type = 'button';
    info.className = 'od-info-button';
    info.textContent = 'Device info';
    actions.appendChild(info);
    var banner = document.querySelector('.banner1');
    if (banner) {
      var links = banner.querySelectorAll('a[href*="logout"], a[href*="reboot"]');
      var rebootLink = null, logoutLink = null;
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        link.parentNode.removeChild(link);
        var href = link.getAttribute('href') || '';
        link.classList.add('od-icon-action');
        link.setAttribute('aria-label', /reboot/.test(href) ? 'Reboot' : 'Log out');
        link.setAttribute('title', /reboot/.test(href) ? 'Reboot' : 'Log out');
        if (/reboot/.test(href)) rebootLink = link;
        else logoutLink = link;
      }
      if (rebootLink) actions.appendChild(rebootLink);
      if (logoutLink) actions.appendChild(logoutLink);
    }
    topbar.appendChild(actions);
    cell.insertBefore(topbar, head || cell.firstChild);
    headGroup = actions;
    buildDeviceDrawer(info);
    decorateNavigation();
    mountNavBrand();
  }

  /* Phone screens scroll the native sub-tab strip. Bring the active tab into
     view at load the way the drawn header does; order and handlers stay. */
  function revealActiveTab() {
    var strip = document.getElementById('tabMenu');
    var active = strip && strip.querySelector('.tabclick, .tabclick_NW');
    if (!active || strip.scrollWidth <= strip.clientWidth + 1) return;
    var box = active.getBoundingClientRect();
    var edge = strip.getBoundingClientRect();
    if (box.left >= edge.left && box.right <= edge.right) return;
    strip.scrollLeft += (box.left - edge.left) - (edge.width - box.width) / 2;
  }

  function buildHeader() {
    normalizeContentWrapper();
    var cell = contentCell();
    if (!cell) return;
    if (document.body.classList.contains('LevelQIS')) return;
    if (document.querySelector('.QISmain')) return;
    var title = nativeTitle();
    if (!title) return;
    cell.classList.add('od-content-cell');
    var original = text(title);
    if (original.indexOf(' - ') >= 0) {
      var suffix = original.split(' - ').pop().trim();
      if (suffix && suffix.length <= 28) pageTitleSuffix = suffix;
    }
    var mapped = TITLES[routePath()];
    if (mapped) title.textContent = mapped;
    var head = element('div', 'od-page-head');
    var group = routeGroup();
    if (group) head.appendChild(element('span', 'od-eyebrow', group));
    head.appendChild(title);
    if (routePath() === '/index2.asp') {
      head.appendChild(element('p', 'od-page-sub', 'View your network status, connected devices and essential information at a glance.'));
      head.appendChild(element('span', 'od-band-chip', bandName() || '2.4 GHz'));
    }
    cell.insertBefore(head, cell.firstChild);
    /* Native pages pull the content up under their own banner (an inline
       negative top margin). The themed header replaces that banner, so the
       compensation would overlap the two blocks. */
    for (var sib = head.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (parseFloat(window.getComputedStyle(sib).marginTop) < 0) {
        sib.style.setProperty('margin-top', '0px', 'important');
      }
    }
    buildShell(cell, head);
  }

  /* Section headings: a native single-cell table head becomes the card's own
     header above its group. Multi-column heads stay inside the group. */
  var sectionTitleSeq = 0;
  function bindSectionTitle(heading, table) {
    if (!table.id) table.id = 'od-title-target-' + (++sectionTitleSeq);
    heading.setAttribute('data-od-title-for', table.id);
    heading.hidden = table.getClientRects().length === 0;
    return heading;
  }
  function syncSectionTitles() {
    var headings = document.querySelectorAll('[data-od-title-for]');
    for (var i = 0; i < headings.length; i++) {
      var table = document.getElementById(headings[i].getAttribute('data-od-title-for'));
      headings[i].hidden = !table || table.getClientRects().length === 0;
    }
  }
  function observeSectionTitles() {
    syncSectionTitles();
    if (window.requestAnimationFrame) window.requestAnimationFrame(syncSectionTitles);
    else syncSectionTitles();
    var scope = document.getElementById('FormTitle') || document.body;
    if (!window.MutationObserver || !scope) return;
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        syncSectionTitles();
      });
    }).observe(scope, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
  }
  /* Native matrix tables (PVC summary, routing rules, log tables) use many
     columns. The two-column label/value width rule must not apply to them. */
  function markMatrixTables() {
    var tables = document.querySelectorAll('table.FormTable, table.FormTable_table');
    for (var i = 0; i < tables.length; i++) {
      var cols = 0;
      for (var r = 0; r < tables[i].rows.length; r++) {
        var span = 0;
        for (var c = 0; c < tables[i].rows[r].cells.length; c++) span += tables[i].rows[r].cells[c].colSpan;
        if (span > cols) cols = span;
      }
      if (cols > 2) tables[i].classList.add('od-matrix');
    }
  }

  function buildSectionTitles() {
    var tables = document.querySelectorAll('table.FormTable, table.FormTable_table');
    for (var i = 0; i < tables.length; i++) {
      var head = tables[i].tHead;
      if (!head || !head.rows.length) continue;
      var line = head.rows[0];
      if (line.cells.length !== 1) continue;
      var cell = line.cells[0];
      if (cell.querySelector('input, select, textarea, iframe')) continue;
      if (!text(cell)) continue;
      var heading = bindSectionTitle(element('div', 'od-section-title od-card-title', text(cell)), tables[i]);
      tables[i].parentNode.insertBefore(heading, tables[i]);
      tables[i].setAttribute('data-od-titled', '1');
      line.className = 'od-moved';
    }
    /* A single settings table without a native section row still names its
       card from the native page title ("Wireless - General"). */
    if (!pageTitleSuffix || pageTitleSuffix.length > 20) return;
    if (!/^\/Advanced_.*_Content\.asp$/.test(routePath())) return;
    var top = [];
    var scope = document.querySelector('td.od-content-cell') || document.getElementById('FormTitle');
    if (!scope) return;
    var all = scope.querySelectorAll('table.FormTable');
    for (var t = 0; t < all.length; t++) {
      var table = all[t];
      if (table.closest('table.FormTable') !== table) continue;
      if (table.hasAttribute('data-od-titled')) continue;
      top.push(table);
    }
    if (top.length !== 1) return;
    var prev = top[0].previousElementSibling;
    if (prev && prev.classList && prev.classList.contains('od-card-title')) return;
    var title = bindSectionTitle(element('div', 'od-section-title od-card-title', pageTitleSuffix), top[0]);
    top[0].parentNode.insertBefore(title, top[0]);
    top[0].setAttribute('data-od-titled', '1');
  }

  /* Privacy notice has no settings table: its single FormTitle block is the
     card, and the drawn composition names that card. */
  function buildPrivacyTitle() {
    if (routePath() !== '/Advanced_Privacy.asp') return;
    var desc = document.getElementById('privacy_desc');
    if (!desc || !desc.parentNode) return;
    if (desc.parentNode.querySelector('.od-card-title')) return;
    desc.parentNode.insertBefore(element('div', 'od-section-title od-card-title', TITLES[routePath()]), desc);
  }

  /* R6 administration composition. System, backup/restore and feedback are one
     native table each. The rows, controls, hidden fields, forms and handlers
     stay the same nodes; only their presentation is regrouped into the panels
     the approved composition shows. */
  function adminRowIndex(scope) {
    var index = {};
    var rows = scope.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.closest('table.FormTable, table.FormTable_table')) continue;
      var fields = row.querySelectorAll('input[name], select[name], textarea[name]');
      for (var f = 0; f < fields.length; f++) {
        var name = fields[f].getAttribute('name');
        if (name && !index[name]) index[name] = row;
      }
      if (row.id && !index['#' + row.id]) index['#' + row.id] = row;
    }
    return index;
  }

  function adminTake(index, keys) {
    var taken = [], seen = [];
    for (var i = 0; i < keys.length; i++) {
      var row = index[keys[i]];
      if (!row || seen.indexOf(row) >= 0) continue;
      seen.push(row);
      taken.push(row);
    }
    return taken;
  }

  function adminMoveRows(tbody, rows) {
    for (var i = 0; i < rows.length; i++) tbody.appendChild(rows[i]);
  }

  function adminPanel(container, key, title, subtitle, options) {
    var section = element('section', 'od-admin-panel');
    section.setAttribute('data-od-admin', key);
    if (options && options.danger) section.classList.add('od-admin-danger');
    var head = element('div', 'od-admin-panel-head');
    var heading = document.createElement('h2');
    heading.className = 'od-admin-panel-title';
    heading.textContent = title;
    head.appendChild(heading);
    if (subtitle) head.appendChild(element('p', 'od-admin-panel-sub', subtitle));
    section.appendChild(head);
    var body = element('div', 'od-admin-panel-body');
    var table = element('table', 'FormTable od-admin-table');
    table.appendChild(document.createElement('tbody'));
    body.appendChild(table);
    section.appendChild(body);
    container.appendChild(section);
    return { section: section, body: body, tbody: table.tBodies[0] };
  }

  function adminActionBar(parent, className) {
    var bar = element('div', 'od-admin-actions' + (className ? ' ' + className : ''));
    parent.appendChild(bar);
    return bar;
  }

  function adminDropTitles(node) {
    var prev = node ? node.previousElementSibling : null;
    while (prev && prev.classList && prev.classList.contains('od-card-title')) {
      var before = prev.previousElementSibling;
      prev.parentNode.removeChild(prev);
      prev = before;
    }
  }

  function adminDropTable(table) {
    if (!table) return;
    table.classList.add('od-admin-source');
    adminDropTitles(table);
  }

  /* Native conditional functions hide these source tables after this script
     runs. Keep the composed panel in step with the table the page controls. */
  function adminFollowPanel(section, node) {
    if (!section || !node) return;
    var sync = function () {
      section.hidden = getComputedStyle(node).display === 'none' || node.hidden;
    };
    sync();
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    }
  }

  function adminHideEmptyTables(scope) {
    var tables = scope.querySelectorAll('table.FormTable, table.FormTable_table');
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.classList.contains('od-admin-table')) continue;
      var rows = 0;
      for (var b = 0; b < table.tBodies.length; b++) rows += table.tBodies[b].rows.length;
      if (!rows) adminDropTable(table);
    }
  }

  function composeSystemAdmin() {
    var scope = document.getElementById('FormTitle');
    if (!scope || scope.querySelector('.od-admin-panels')) return;
    var anchor = scope.querySelector('table.FormTable');
    if (!anchor || !anchor.parentNode) return;
    var index = adminRowIndex(scope);
    var container = element('div', 'od-admin-panels');
    adminDropTitles(anchor);
    anchor.parentNode.insertBefore(container, anchor);

    var account = adminPanel(container, 'system-account', 'Administrator account',
      'Manage the account used to sign in to your modem.');
    adminMoveRows(account.tbody, adminTake(index, [
      'uiViewTools_username', 'uiViewTools_Password', 'uiViewTools_PasswordConfirm'
    ]));

    var behavior = adminPanel(container, 'system-behavior', 'Buttons & system behavior');
    adminMoveRows(behavior.tbody, adminTake(index, [
      'btn_ez_radiotoggle', 'http_autologout', 'nat_redirect_enable', 'swap_enable'
    ]));

    var schedule = adminPanel(container, 'system-schedule', 'Scheduled maintenance',
      'Set independent restart and WAN reconnect schedules.');
    adminMoveRows(schedule.tbody, adminTake(index, [
      '#reboot_schedule_enable_tr', '#reboot_schedule_date_tr', '#reboot_schedule_time_tr',
      '#rewan_schedule_enable_tr', '#rewan_schedule_date_tr', '#rewan_schedule_time_tr'
    ]));

    var time = adminPanel(container, 'system-time', 'Time & logging');
    adminMoveRows(time.tbody, adminTake(index, [
      'syslogServerAddr', 'uiViewdateToolsTZ', 'uiViewdateDS', 'uiViewSNTPServer'
    ]));

    var services = adminPanel(container, 'system-services', 'Management services',
      'Configure command-line access to your modem.');
    adminMoveRows(services.tbody, adminTake(index, [
      '#telnet_tr', '#sshd_enable_tr', '#sshd_port_tr', '#sshd_password_tr',
      '#auth_keys_tr', 'shell_timeout_x'
    ]));

    var local = adminPanel(container, 'system-local', 'Local management');
    adminMoveRows(local.tbody, adminTake(index, ['http_enable', 'https_lanport']));

    var remote = adminPanel(container, 'system-remote', 'Remote management',
      'Choose whether management is reachable from the WAN.');
    adminMoveRows(remote.tbody, adminTake(index, [
      'misc_http_x', '#accessfromwan_port', 'http_client'
    ]));

    var allowed = adminPanel(container, 'system-allowed', 'Allowed management clients',
      'Up to four source-native access rules.');
    var rules = document.getElementById('http_client_table');
    if (rules) {
      if (rules.tHead && rules.tHead.rows.length) rules.tHead.rows[0].classList.add('od-moved');
      var inset = element('div', 'od-admin-inset');
      adminDropTitles(rules);
      inset.appendChild(rules);
      var ruleList = document.getElementById('http_clientlist_Block');
      if (ruleList) inset.appendChild(ruleList);
      allowed.body.appendChild(inset);
      adminFollowPanel(allowed.section, rules);
    }

    var apply = scope.querySelector('input.button_gen[name="button"]');
    if (apply) adminActionBar(container).appendChild(apply);

    adminHideEmptyTables(scope);
  }

  function composeBackupAdmin() {
    var scope = document.getElementById('FormTitle');
    if (!scope || scope.querySelector('.od-admin-panels')) return;
    var table = scope.querySelector('table.FormTable');
    if (!table || !table.parentNode) return;
    var uploadForm = document.forms.uiPostUpdateForm;
    if (uploadForm && !uploadForm.id) uploadForm.id = 'od-upload-form';
    var save = table.querySelector('input[name="action2"]');
    var file = document.getElementById('tools_FW_UploadFile');
    var fileRow = file ? file.closest('tr') : null;
    var upload = fileRow ? fileRow.querySelector('input[type="button"].button_gen') : null;
    var restoreForm = document.forms.tools_System_Restore;
    if (!save || !upload || !file || !restoreForm) return;

    /* The native upload form is parsed inside the table and its rows are
       associated through the parser's form pointer. Moving a control resets
       that owner, so bind the moved controls to the same native form first. */
    if (uploadForm) {
      var controls = table.querySelectorAll('input, select, textarea, button');
      for (var i = 0; i < controls.length; i++) {
        if (controls[i].form === uploadForm) controls[i].setAttribute('form', uploadForm.id);
      }
    }

    var container = element('div', 'od-admin-panels');
    adminDropTitles(table);
    table.parentNode.insertBefore(container, table);

    var backup = adminPanel(container, 'backup-save', 'Back up settings',
      'Save your current configuration to a local file.');
    adminActionBar(backup.section).appendChild(save);

    var restore = adminPanel(container, 'backup-restore', 'Restore saved settings',
      'Choose a settings file saved for this modem.');
    var picker = element('div', 'od-admin-file');
    picker.appendChild(file);
    /* The native file control truncates its own status on a narrow phone.
       Keep the control and report the complete selected/empty name on its own
       line; the value shown is the browser's File name, never a native write. */
    var fileName = element('span', 'od-admin-filename', 'No file selected');
    picker.appendChild(fileName);
    picker.classList.add('od-file-named');
    file.addEventListener('change', function () {
      var selected = file.files && file.files.length ? file.files[0].name : '';
      fileName.textContent = selected || 'No file selected';
      fileName.classList.toggle('has-file', !!selected);
    });
    restore.body.appendChild(picker);
    adminActionBar(restore.section).appendChild(upload);

    var factory = adminPanel(container, 'backup-factory', 'Factory defaults',
      'Restore the modem to its factory settings. Your configured network and administrator settings will be reset.',
      { danger: true });
    var factoryActions = adminActionBar(factory.section, 'od-admin-danger-actions');
    factoryActions.appendChild(restoreForm);

    adminDropTable(table);
  }

  function composeFirmwareAdmin() {
    var scope = document.getElementById('FormTitle');
    var form = document.forms.uiPostUpdateForm;
    if (!scope || !form || scope.querySelector('.od-admin-panels')) return;
    var table = scope.querySelector('table.FormTable');
    var file = scope.querySelector('input[name="tools_FW_UploadFile"]');
    var upload = scope.querySelector('input[name="FW_apply"]');
    if (!table || !file || !upload) return;
    var fileRow = file.closest('tr');
    var rows = table.tBodies.length ? Array.prototype.slice.call(table.tBodies[0].rows) : [];
    var container = element('div', 'od-admin-panels');
    adminDropTitles(table);
    table.parentNode.insertBefore(container, table);
    var installed = adminPanel(container, 'firmware-installed', 'Installed firmware');
    var releaseRow = element('tr', 'od-admin-release');
    releaseRow.appendChild(element('th', null, 'OpenDSL release'));
    releaseRow.appendChild(element('td', null, OPENDSL_RELEASE));
    installed.tbody.appendChild(releaseRow);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] !== fileRow && rows[i].id !== 'sig_ver_field') installed.tbody.appendChild(rows[i]);
    }
    var local = adminPanel(container, 'firmware-local', 'Upload firmware',
      'Choose a reviewed local firmware image for this modem.');
    var picker = element('div', 'od-admin-file');
    picker.appendChild(file);
    var fileName = element('span', 'od-admin-filename', 'No file selected');
    picker.appendChild(fileName);
    picker.classList.add('od-file-named');
    file.addEventListener('change', function () {
      var selected = file.files && file.files.length ? file.files[0].name : '';
      fileName.textContent = selected || 'No file selected';
      fileName.classList.toggle('has-file', !!selected);
    });
    local.body.appendChild(picker);
    adminActionBar(local.section).appendChild(upload);
    adminDropTable(table);
  }

  function composeFeedbackAdmin() {
    var scope = document.getElementById('FormTitle');
    if (!scope || scope.querySelector('.od-admin-panels')) return;
    var table = scope.querySelector('table.FormTable');
    if (!table || !table.parentNode || !document.forms.adv_adsl) return;
    var index = adminRowIndex(scope);
    var container = element('div', 'od-admin-panels');
    adminDropTitles(table);
    table.parentNode.insertBefore(container, table);

    var service = adminPanel(container, 'feedback-service', 'Your service');
    adminMoveRows(service.tbody, adminTake(index, [
      'fb_country', 'fb_ISP', 'fb_Subscribed_Info', 'fb_email', 'fb_serviceno'
    ]));

    var report = adminPanel(container, 'feedback-report', 'Report details');
    adminMoveRows(report.tbody, adminTake(index, ['fb_availability', 'fb_comment']));

    var attachments = adminPanel(container, 'feedback-attachments', 'Attachments');
    adminMoveRows(attachments.tbody, adminTake(index, [
      'attach_syslog', '#dslx_diag_enable_tr', '#dslx_diag_duration_tr'
    ]));

    var consent = adminPanel(container, 'feedback-consent', 'Consent');
    var consentRows = adminTake(index, ['eula_checkbox']);
    if (consentRows.length) {
      consentRows[0].classList.add('od-admin-consent-row');
      adminMoveRows(consent.tbody, consentRows);
      var consentInput = consentRows[0].querySelector('input[name="eula_checkbox"]');
      if (consentInput) {
        if (!consentInput.id) consentInput.id = 'eula_checkbox';
        var consentLabel = document.createElement('label');
        consentLabel.className = 'od-admin-consent-label';
        consentLabel.setAttribute('for', consentInput.id);
        consentLabel.textContent = 'I have read and agree to the feedback consent notice.';
        consentInput.parentNode.appendChild(consentLabel);
      }
    }
    var send = scope.querySelector('input[name="btn_send"]');
    if (send) adminActionBar(container).appendChild(send);

    var support = adminPanel(container, 'feedback-support', 'Technical support');
    var supportLink = scope.querySelector('a[href*="CallUs"]');
    var supportRow = supportLink ? supportLink.closest('tr') : null;
    if (supportRow) {
      supportRow.classList.add('od-admin-support-row');
      support.tbody.appendChild(supportRow);
    }

    adminHideEmptyTables(scope);
  }

  function composeNativeAdmin() {
    var path = routePath();
    if (path === '/Advanced_System_Content.asp') {
      document.body.classList.add('od-admin-system');
      composeSystemAdmin();
    } else if (path === '/Advanced_SettingBackup_Content.asp') {
      document.body.classList.add('od-admin-backup');
      composeBackupAdmin();
    } else if (path === '/Advanced_FirmwareUpgrade_Content.asp') {
      document.body.classList.add('od-admin-firmware');
      composeFirmwareAdmin();
    } else if (path === '/Advanced_Feedback.asp') {
      document.body.classList.add('od-admin-feedback');
      composeFeedbackAdmin();
    }
  }

  /* Long prose help pushed the first settings card far below the approved
     composition. Conditional messages, validation copy and live warnings stay
     where the native scripts can show them; only static prose and its FAQ link
     move into a native disclosure. Nodes, text and handlers are preserved. */
  function isConditionalMessage(node) {
    if (node.getAttribute('role') === 'alert') return true;
    if (node.style && node.style.display === 'none') return true;
    if (/(^|\s)(error|warning|alert|invalid|success|nologin)(\s|$)/i.test(' ' + String(node.className || '') + ' ')) return true;
    if (/(error|warn|alert|conflict|pool|lock)/i.test(node.id || '')) return true;
    return /(^|;)\s*color\s*:/i.test(node.getAttribute('style') || '');
  }

  function isFaqOnly(node) {
    var links = node.querySelectorAll('a');
    if (links.length !== 1 || node.querySelector('ol, ul, li')) return false;
    var copy = text(node).toLowerCase();
    return copy.indexOf('faq') >= 0 && copy.length <= 90;
  }

  function isLongHelp(node) {
    if (node.hasAttribute('data-od-help')) return false;
    if (node.closest('table.FormTable, table.FormTable_table, table.TMTable, table.DescTable, .od-page-head, .od-meta, .od-inspector, .od-help')) return false;
    if (node.querySelector('input, select, textarea, button, iframe')) return false;
    if (isConditionalMessage(node)) return false;
    var copy = text(node);
    if (!copy) return false;
    return node.querySelectorAll('li').length >= 2 || node.querySelectorAll('br').length >= 3 || copy.length >= 160;
  }

  /* R6 settings composition: page help is a disclosure even when the native
     copy is short, and the section index mirrors the card titles on pages
     whose approved layout includes the rail. */
  function settingsShell() {
    var p = routePath().toLowerCase();
    if (/^\/(qis|main_login|main_password|mod_login|logout|error_page|blocking|language_change|live_update|start_apply|get_release_note)/.test(p)) return false;
    return /^\/(advanced_.*_content|guest_network|parentalcontrol|qos_ezqos|bandwidth_limiter|main_.*)\.asp$/.test(p);
  }

  function settingsRail() {
    if (!settingsShell()) return false;
    var p = routePath().toLowerCase();
    return !/^\/advanced_(system|firmwareupgrade|settingbackup|adsl|privacy|feedback|iptv|qosuserprio)/.test(p);
  }

  function isSettingsIntro(node) {
    if (!settingsShell()) return false;
    if (node.closest('table.FormTable, table.FormTable_table, table.TMTable, table.DescTable, .od-page-head, .od-meta, .od-inspector, .od-help')) return false;
    if (node.querySelector('input, select, textarea, button, iframe, table')) return false;
    if (isConditionalMessage(node)) return false;
    return !!text(node);
  }

  function decorateHelp() {
    var spacers = document.querySelectorAll('#FormTitle > tbody > tr > td > div');
    for (var s = 0; s < spacers.length; s++) {
      var spacer = spacers[s];
      if (spacer.id || spacer.className) continue;
      if (spacer.querySelector('input, select, textarea, button, iframe, a, table')) continue;
      if (spacer.querySelector('img:not([src*="line_export"])')) continue;
      spacer.classList.add('od-native-spacer');
    }
    var settingsPage = settingsShell();
    var nodes = document.querySelectorAll('.formfontdesc');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!isLongHelp(node) && !isSettingsIntro(node)) continue;
      var details = element('details', 'od-help');
      var summary = document.createElement('summary');
      summary.textContent = /^notes?\b/i.test(text(node)) ? 'Notes'
        : settingsPage ? 'Help with these settings' : 'Help';
      details.appendChild(summary);
      node.parentNode.insertBefore(details, node);
      details.appendChild(node);
      node.setAttribute('data-od-help', '1');
      var scan = details.nextSibling;
      while (scan) {
        if (scan.nodeType === 3 && !scan.textContent.trim()) { scan = scan.nextSibling; continue; }
        if (scan.nodeType === 1 && scan.tagName === 'BR') { scan = scan.nextSibling; continue; }
        if (scan.nodeType === 1 && scan.classList && scan.classList.contains('formfontdesc') &&
            scan.style.display === 'none' && isConditionalMessage(scan)) {
          scan = scan.nextSibling;
          continue;
        }
        if (scan.nodeType === 1 && scan.classList && scan.classList.contains('formfontdesc') && isFaqOnly(scan)) {
          var faq = scan;
          scan = scan.nextSibling;
          details.appendChild(faq);
          continue;
        }
        break;
      }
      /* Adjacent native help paragraphs share one disclosure instead of
         producing two identical "Help with these settings" rows. Keep the
         first summary and move the later prose into it. review KF-01 */
      var prior = details.previousElementSibling;
      while (prior && prior.nodeType !== 1) prior = prior.previousElementSibling;
      if (prior && prior.classList && prior.classList.contains('od-help') &&
          text(prior.querySelector('summary')) === text(summary)) {
        var children = [].slice.call(details.childNodes);
        for (var k = 0; k < children.length; k++) {
          if (children[k] === summary) continue;
          prior.appendChild(children[k]);
        }
        details.parentNode.removeChild(details);
      }
    }
  }

  /* Section rail: links target the same card headings that were lifted from
     the native section rows. Cards keep their own tables and handlers. */
  function buildSettingsIndex() {
    if (!settingsRail()) return;
    var cell = contentCell();
    if (!cell) return;
    var allHeadings = cell.querySelectorAll('.od-card-title');
    var headings = [];
    for (var hh = 0; hh < allHeadings.length; hh++) if (!allHeadings[hh].hidden) headings.push(allHeadings[hh]);
    if (!headings.length) return;
    var tables = [];
    for (var c = 0; c < cell.children.length; c++) {
      if (cell.children[c].tagName === 'TABLE') tables.push(cell.children[c]);
    }
    if (!tables.length) return;
    var first = tables[0];
    var helps = cell.querySelectorAll('.od-help');
    for (var h = 0; h < helps.length; h++) {
      if (helps[h].closest('table.FormTable, table.FormTable_table')) continue;
      if (helps[h].parentNode !== cell) cell.insertBefore(helps[h], first);
    }
    var nav = element('nav', 'od-section-index');
    nav.setAttribute('aria-label', 'Settings sections');
    for (var i = 0; i < headings.length; i++) {
      if (!headings[i].id) headings[i].id = 'od-setting-' + (i + 1);
      var link = element('a', '', text(headings[i]));
      link.href = '#' + headings[i].id;
      nav.appendChild(link);
    }
    cell.insertBefore(nav, first);
    cell.classList.add('od-settings-page');
  }

  function actionLabel(control) {
    var raw = control.tagName === 'INPUT' ? control.value : control.textContent;
    return String(raw || '').replace(/\s+/g, ' ').trim();
  }

  var ROUTE_PRIMARY = {
    /* The approved firmware-upgrade drawing keeps Upload neutral: the file
       input already carries the secondary control and Upload only submits the
       selected reviewed image. Backup's Upload stays the page action. */
    '/Advanced_SettingBackup_Content.asp': ['save', 'upload'],
    '/Main_Analysis_Content.asp': ['diagnose'],
    '/Main_Netstat_Content.asp': ['netstat'],
    '/Feedback_Info.asp': ['complete']
  };

  function markPrimaryActions() {
    var roles = ROUTE_PRIMARY[location.pathname] || null;
    var selectors = ['input[type="button"]', 'input[type="submit"]', 'button', 'div.titlebtn'];
    for (var s = 0; s < selectors.length; s++) {
      var nodes = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var label = actionLabel(node).toLowerCase().replace(/[!.\s]+$/g, '');
        var oc = String(node.getAttribute('onclick') || '');
        /* A route that names its action keeps only that action primary, so a
           native "Save" next to it stays a secondary control. */
        var primary = roles ? false : (/^(apply|save|ok|submit|next|start|finish|continue|done)\b/i.test(label) ||
            /submitQoS|applyRule|save_table|initChange/.test(oc));
        if (roles) {
          for (var r = 0; r < roles.length; r++) {
            if (label.indexOf(roles[r]) >= 0) { primary = true; break; }
          }
        }
        if (/^(reboot|logout|reset|delete|cancel|close)$/.test(label) ||
            /reboot|logout|reset/.test(label)) primary = false;
        if (primary) node.classList.add('od-primary');
      }
    }
  }

  function element(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  /* Native Network Map: the stock table carries one live node per row
     (Internet, gateway, clients) and the native inspector frame. Rearrange the
     same nodes into the approved horizontal topology and give the inspector a
     contextual panel. IDs, links, generated values and native click handlers
     stay in place. */
  function decorateNetworkMap() {
    var map = document.getElementById('NM_table');
    if (!map || map.querySelector('.od-map-layout')) return;
    var table = map.querySelector('table');
    var internetAnchor = map.querySelector('#single_wan_icon a');
    var routerAnchor = map.querySelector('#iconRouter') ? map.querySelector('#iconRouter').closest('a') : null;
    var clientAnchor = document.getElementById('clientStatusLink');
    if (!internetAnchor && !routerAnchor && !clientAnchor) return;
    map.classList.add('od-network-map');

    var connectStatus = document.getElementById('NM_connect_status');
    var security = document.getElementById('wl_securitylevel_span');
    var clientCount = document.getElementById('clientNumber');
    var wanDiv = document.getElementById('wanIP_div');
    var ddnsDiv = document.getElementById('ddnsHostName_div');
    var statusTitle = map.querySelector('.statusTitle');
    var frame = document.getElementById('statusframe');
    var helpname = document.getElementById('helpname');
    var routerCell = map.querySelector('tr:has(#iconRouter) > td:nth-child(2)');
    var model = modelName();

    var brand = 'OpenDSL', subtitle = model;
    if (routerCell) {
      var prose = '';
      for (var node = routerCell.firstChild; node && node !== security; node = node.nextSibling) {
        if (node.nodeType === 3) prose += ' ' + node.textContent;
        else if (node.nodeType === 1 && node.tagName === 'BR') prose += ' ';
      }
      prose = prose.replace(/\s+/g, ' ').trim();
      var securityLabel = prose.match(/security(?:\s+level)?\s*:?/i);
      var identity = (securityLabel ? prose.slice(0, securityLabel.index).trim() : prose).replace(/_/g, ' ');
      if (identity) {
        if (model && identity.indexOf(model) !== -1) {
          brand = identity.slice(0, identity.indexOf(model)).trim() || 'OpenDSL';
          subtitle = model;
        } else {
          var pieces = identity.split(' ');
          brand = pieces.shift() || 'OpenDSL';
          subtitle = pieces.join(' ') || model;
        }
      }
    }

    var layout = element('div', 'od-map-layout');
    var primary = element('div', 'od-map-primary');
    var panel = element('section', 'od-map-panel');
    var head = element('div', 'od-map-head');
    var headCopy = element('div', 'od-panel-copy');
    headCopy.appendChild(element('h2', 'od-map-heading', 'Network connection'));
    var headSub = element('p', 'od-map-sub');
    headCopy.appendChild(headSub);
    head.appendChild(headCopy);
    /* The drawn badge is a sibling of the title so a wrapped badge takes its
       own line instead of overlapping the heading. */
    var stateBadge = connectStatus ? element('span', 'od-map-state') : null;
    if (stateBadge) {
      stateBadge.setAttribute('aria-hidden', 'true');
      head.appendChild(stateBadge);
    }
    panel.appendChild(head);

    var topology = element('div', 'od-topology');
    var line = element('span', 'od-topo-line');
    line.setAttribute('aria-hidden', 'true');
    topology.appendChild(line);
    topology.appendChild(element('span', 'od-topo-dot od-topo-dot-a'));
    topology.appendChild(element('span', 'od-topo-dot od-topo-dot-b'));

    var nodes = [];
    var titles = { internet: 'Internet details', gateway: 'Gateway details', clients: 'Devices' };
    function addNode(type, page, anchor, name, sub) {
      var wrapper = element('div', 'od-topo-node');
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('aria-pressed', 'false');
      wrapper.setAttribute('aria-label', name);
      wrapper.setAttribute('data-od-node', type);
      var icon = element('span', 'od-topo-icon');
      if (anchor) {
        anchor.classList.add('od-topo-anchor');
        anchor.setAttribute('tabindex', '-1');
        icon.appendChild(anchor);
      }
      wrapper.appendChild(icon);
      wrapper.appendChild(element('span', 'od-topo-name', name));
      if (sub) wrapper.appendChild(sub);
      var select = function () { choose(type); };
      wrapper.addEventListener('click', function (event) {
        event.preventDefault();
        select();
      });
      wrapper.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select();
      });
      nodes.push({ type: type, page: page, anchor: anchor, node: wrapper });
      return wrapper;
    }

    var internetSub = element('span', 'od-topo-sub od-topo-status');
    if (connectStatus) {
      internetSub.appendChild(connectStatus);
      connectStatus.classList.add('od-topo-live');
    } else {
      internetSub.textContent = 'Internet';
    }
    topology.appendChild(addNode('internet', 'Internet', internetAnchor, 'Internet', internetSub));

    var gatewaySub = element('span', 'od-topo-sub');
    if (subtitle) gatewaySub.appendChild(document.createTextNode(subtitle));
    topology.appendChild(addNode('gateway', 'Router', routerAnchor, brand, gatewaySub));

    var clientsSub = element('span', 'od-topo-sub od-topo-count');
    if (clientCount) {
      clientCount.classList.add('od-visually-hidden');
      clientCount.setAttribute('aria-live', 'polite');
      clientsSub.setAttribute('aria-hidden', 'true');
    }
    topology.appendChild(addNode('clients', 'Client', clientAnchor, 'Devices', clientsSub));
    panel.appendChild(topology);

    function sourceText(id) {
      return text(document.getElementById(id));
    }
    function rateMbps(raw) {
      var value = String(raw || '').trim();
      if (!value) return '';
      var mbps = value.match(/([0-9.]+)\s*Mbps/i);
      if (mbps) return parseFloat(mbps[1]).toFixed(1);
      var kbps = value.match(/([0-9.]+)/);
      if (!kbps) return '';
      var number = parseFloat(kbps[1]);
      if (!isFinite(number) || number <= 0) return '';
      return (number / 1000).toFixed(1);
    }
    function nativeClients() {
      var list = window.clientList;
      if ((!list || !list.length) && typeof window.genClientList === 'function') {
        try { window.genClientList(); list = window.clientList; } catch (error) { list = null; }
      }
      var clients = [];
      if (!list || !list.length) return clients;
      for (var i = 0; i < list.length; i++) {
        var client = list[list[i]];
        if (!client || client.isOnline === false || client.isOnline === 0) continue;
        clients.push(client);
      }
      return clients;
    }
    function clientCountValue() {
      var node = document.getElementById('_clientNumber');
      var match = node ? text(node).match(/\d+/) : null;
      if (!match) match = text(clientCount).match(/\d+/);
      if (!match && window.originData && typeof window.originData.size === 'number') {
        return window.originData.size;
      }
      return match ? parseInt(match[0], 10) : null;
    }

    /* Connection strip: the drawn two-up card with the live native DSL rates
       and the native security label. A missing reading stays "Unavailable". */
    var strip = element('div', 'od-map-strip');
    var dslButton = element('button', 'od-strip-item od-strip-dsl');
    dslButton.type = 'button';
    dslButton.setAttribute('aria-label', 'DSL line details');
    var dslGlyph = element('span', 'od-strip-glyph');
    dslGlyph.setAttribute('aria-hidden', 'true');
    dslButton.appendChild(dslGlyph);
    var dslCopy = element('span', 'od-strip-copy');
    dslCopy.appendChild(element('span', 'od-strip-label', 'DSL line'));
    var dslValue = element('strong', 'od-strip-value', 'Unavailable');
    dslCopy.appendChild(dslValue);
    dslButton.appendChild(dslCopy);
    var dslChevron = element('span', 'od-strip-chevron');
    dslChevron.setAttribute('aria-hidden', 'true');
    dslButton.appendChild(dslChevron);
    strip.appendChild(dslButton);

    var wirelessItem = element('div', 'od-strip-item');
    var wifiGlyph = element('span', 'od-strip-glyph od-strip-glyph-wifi');
    wifiGlyph.setAttribute('aria-hidden', 'true');
    wirelessItem.appendChild(wifiGlyph);
    var wifiCopy = element('span', 'od-strip-copy');
    wifiCopy.appendChild(element('span', 'od-strip-label', 'Wireless'));
    var wirelessValue = element('strong', 'od-strip-value', bandName() || 'Unavailable');
    wifiCopy.appendChild(wirelessValue);
    wirelessItem.appendChild(wifiCopy);
    strip.appendChild(wirelessItem);
    panel.appendChild(strip);

    /* Connected devices preview. Rows come only from the native clientList
       that client_function.js builds from originData; a page without that data
       shows no invented devices. The native count node stays the live source. */
    var devicePanel = element('section', 'od-map-panel od-devices-panel');
    var deviceHead = element('div', 'od-map-head od-devices-head');
    var deviceCopy = element('div', 'od-panel-copy');
    deviceCopy.appendChild(element('h2', 'od-map-heading', 'Connected devices'));
    var deviceSub = element('p', 'od-map-sub');
    deviceCopy.appendChild(deviceSub);
    deviceHead.appendChild(deviceCopy);
    var viewAll = element('button', 'od-view-all');
    viewAll.type = 'button';
    viewAll.appendChild(document.createTextNode('View all'));
    var viewAllChevron = element('span', 'od-strip-chevron');
    viewAllChevron.setAttribute('aria-hidden', 'true');
    viewAll.appendChild(viewAllChevron);
    deviceHead.appendChild(viewAll);
    devicePanel.appendChild(deviceHead);
    var deviceList = element('div', 'od-device-list');
    devicePanel.appendChild(deviceList);

    var renderedDevices = null;
    function drawDevices() {
      var clients = nativeClients();
      var signature = clients.length + '|';
      for (var c = 0; c < clients.length; c++) {
        var client = clients[c];
        signature += [client.MacAddr || '', client.Name || '', client.IP || '', client.isWL ? 1 : 0].join('~') + ',';
      }
      if (signature === renderedDevices) return;
      renderedDevices = signature;
      while (deviceList.firstChild) deviceList.removeChild(deviceList.firstChild);
      var shown = clients.slice(0, 4);
      for (var i = 0; i < shown.length; i++) {
        var record = shown[i];
        var card = element('button', 'od-device-card');
        card.type = 'button';
        card.setAttribute('aria-label', (record.Name || record.MacAddr || 'Device') + ' details');
        var glyph = element('span', 'od-device-glyph ' + (record.isWL ? 'od-device-glyph-wifi' : 'od-device-glyph-wired'));
        glyph.setAttribute('aria-hidden', 'true');
        card.appendChild(glyph);
        var body = element('span', 'od-device-copy');
        body.appendChild(element('span', 'od-device-name', record.Name || record.MacAddr || 'Unnamed device'));
        var connection = record.isWL === 1 ? '2.4 GHz' : (record.isWL ? 'Wireless' : 'Wired');
        body.appendChild(element('span', 'od-device-kind ' + (record.isWL ? 'od-kind-wifi' : 'od-kind-wired'), connection));
        body.appendChild(element('span', 'od-device-ip', record.IP || 'Unavailable'));
        card.appendChild(body);
        var chevron = element('span', 'od-strip-chevron');
        chevron.setAttribute('aria-hidden', 'true');
        card.appendChild(chevron);
        card.addEventListener('click', function () { choose('clients', true); });
        deviceList.appendChild(card);
      }
      if (!shown.length && clientCountValue() > 0) {
        deviceList.appendChild(element('p', 'od-device-empty', 'Device details are unavailable.'));
      }
    }

    var aside = element('aside', 'od-map-inspector');
    aside.setAttribute('aria-label', 'Selected network item');
    var inspectorTop = element('div', 'od-inspector-top');
    var inspectorGlyph = element('span', 'od-inspector-glyph');
    inspectorGlyph.setAttribute('aria-hidden', 'true');
    inspectorTop.appendChild(inspectorGlyph);
    var inspectorLabel = element('h2', 'od-inspector-label', 'Gateway details');
    inspectorTop.appendChild(inspectorLabel);
    aside.appendChild(inspectorTop);

    var gwValues = {};
    function addReadout(list, label, key) {
      var row = element('div', 'od-readout-line');
      row.appendChild(element('dt', null, label));
      var value = element('dd');
      if (key) {
        value.setAttribute('data-od-gw', key);
        gwValues[key] = value;
      }
      row.appendChild(value);
      list.appendChild(row);
      return value;
    }

    var gatewayView = element('div', 'od-inspector-view');
    gatewayView.setAttribute('data-od-view', 'gateway');
    var gatewayTitle = element('div', 'od-inspector-title');
    gatewayTitle.appendChild(element('span', 'od-eyebrow', 'Gateway'));
    gatewayTitle.appendChild(element('h3', null, brand));
    var gatewaySubtitle = element('p', 'od-inspector-sub');
    gatewayTitle.appendChild(gatewaySubtitle);
    gatewayView.appendChild(gatewayTitle);
    var gatewayReadouts = element('dl', 'od-inspector-readouts');
    addReadout(gatewayReadouts, 'Wi-Fi network', 'ssid');
    addReadout(gatewayReadouts, 'Security', 'security');
    addReadout(gatewayReadouts, 'LAN address', 'lanip');
    addReadout(gatewayReadouts, 'WPS PIN', 'wps');
    addReadout(gatewayReadouts, 'LAN MAC', 'mac');
    addReadout(gatewayReadouts, 'Wireless MAC', 'bandmac');
    gatewayView.appendChild(gatewayReadouts);
    var gatewayActions = element('div', 'od-inspector-actions');
    var editWifi = element('button', 'od-action od-primary');
    editWifi.type = 'button';
    editWifi.appendChild(document.createTextNode('Edit Wi-Fi settings'));
    var editChevron = element('span', 'od-strip-chevron');
    editChevron.setAttribute('aria-hidden', 'true');
    editWifi.appendChild(editChevron);
    editWifi.addEventListener('click', function () { choose('wireless', true); });
    gatewayActions.appendChild(editWifi);
    var systemButton = element('button', 'od-action', 'System status');
    systemButton.type = 'button';
    systemButton.addEventListener('click', function () { choose('system', true); });
    gatewayActions.appendChild(systemButton);
    gatewayView.appendChild(gatewayActions);
    aside.appendChild(gatewayView);

    var internetView = element('div', 'od-inspector-view');
    internetView.setAttribute('data-od-view', 'internet');
    internetView.hidden = true;
    var internetTitle = element('div', 'od-inspector-title');
    internetTitle.appendChild(element('span', 'od-eyebrow', 'Internet'));
    internetTitle.appendChild(element('h3', null, 'Connection details'));
    internetTitle.appendChild(element('p', 'od-inspector-sub', 'Live values reported by the native WAN status.'));
    internetView.appendChild(internetTitle);
    var internetReadouts = element('dl', 'od-inspector-readouts');
    var wanRow = element('div', 'od-readout-line');
    wanRow.appendChild(element('dt', null, 'WAN address'));
    var wanCell = element('dd', 'od-readout-native');
    if (wanDiv) wanCell.appendChild(wanDiv);
    var wanEmpty = element('span', 'od-readout-empty', 'Unavailable');
    wanCell.appendChild(wanEmpty);
    wanRow.appendChild(wanCell);
    internetReadouts.appendChild(wanRow);
    var ddnsRow = element('div', 'od-readout-line');
    ddnsRow.appendChild(element('dt', null, 'DDNS'));
    var ddnsCell = element('dd', 'od-readout-native');
    if (ddnsDiv) ddnsCell.appendChild(ddnsDiv);
    ddnsRow.appendChild(ddnsCell);
    internetReadouts.appendChild(ddnsRow);
    internetView.appendChild(internetReadouts);
    var internetActions = element('div', 'od-inspector-actions');
    var moreInternet = element('button', 'od-action', 'More connection details');
    moreInternet.type = 'button';
    moreInternet.addEventListener('click', function () { choose('internet-native', true); });
    internetActions.appendChild(moreInternet);
    var wanSettings = element('a', 'od-text-action', 'WAN settings');
    wanSettings.setAttribute('href', '/Advanced_DSL_Content.asp');
    internetActions.appendChild(wanSettings);
    internetView.appendChild(internetActions);
    aside.appendChild(internetView);

    var dslView = element('div', 'od-inspector-view');
    dslView.setAttribute('data-od-view', 'dsl');
    dslView.hidden = true;
    var dslTitle = element('div', 'od-inspector-title');
    dslTitle.appendChild(element('span', 'od-eyebrow', 'DSL line'));
    dslTitle.appendChild(element('h3', null, 'Line details'));
    dslView.appendChild(dslTitle);
    var dslReadouts = element('dl', 'od-inspector-readouts');
    var dslStateValue = addReadout(dslReadouts, 'Line state');
    var dslDownValue = addReadout(dslReadouts, 'Downstream');
    var dslUpValue = addReadout(dslReadouts, 'Upstream');
    var dslTypeValue = addReadout(dslReadouts, 'Modulation');
    dslView.appendChild(dslReadouts);
    var dslActions = element('div', 'od-inspector-actions');
    var allLine = element('button', 'od-action', 'All line statistics');
    allLine.type = 'button';
    allLine.addEventListener('click', function () { choose('dsl-native', true); });
    dslActions.appendChild(allLine);
    dslView.appendChild(dslActions);
    aside.appendChild(dslView);

    /* The single native frame is retained for the router form, the client
       list, the WAN details, system status and the DSL dashboard. Native
       showstausframe still owns the Internet/Router/Client destinations. */
    var nativeView = element('div', 'od-inspector-native');
    nativeView.hidden = true;
    if (statusTitle) nativeView.appendChild(statusTitle);
    if (frame && frame.parentNode) nativeView.appendChild(frame.parentNode);
    aside.appendChild(nativeView);
    if (helpname) helpname.setAttribute('tabindex', '-1');

    primary.appendChild(panel);
    primary.appendChild(devicePanel);
    layout.appendChild(primary);
    layout.appendChild(aside);
    map.insertBefore(layout, map.firstChild);

    var VIEW_LABELS = {
      gateway: 'Gateway details',
      internet: 'Internet details',
      'internet-native': 'Connection details',
      dsl: 'DSL line',
      'dsl-native': 'DSL line',
      clients: 'Client list',
      wireless: 'Wireless settings',
      /* The native router-status document carries its own "System status"
         heading. The outer label says what the panel is without repeating it. */
      system: 'Router status'
    };
    var currentView = 'gateway';

    function syncStatus() {
      var value = connectStatus ? text(connectStatus).replace(/\.\.\.$/, '').trim() : '';
      if (connectStatus) {
        connectStatus.classList.toggle('od-status-ok', /^(connected|online|up)$/i.test(value));
        connectStatus.classList.toggle('od-status-bad', /(fail|disconnect|offline|down|error)/i.test(value));
      }
      head.setAttribute('data-state', value);
      head.classList.toggle('od-state-ok', /^(connected|online|up)$/i.test(value));
      head.classList.toggle('od-state-bad', /(fail|disconnect|offline|down|error)/i.test(value));
      if (stateBadge) stateBadge.textContent = value;
      if (/^(connected|online|up)$/i.test(value)) headSub.textContent = 'Your network is online and working properly.';
      else if (/(fail|disconnect|offline|down|error)/i.test(value)) headSub.textContent = 'Your network is not connected.';
      else headSub.textContent = 'Checking your network status.';
      internetTitle.querySelector('.od-inspector-sub').textContent = value ?
        'Reported by the native WAN status: ' + value + '.' :
        'Live values reported by the native WAN status.';
    }
    function syncGateway() {
      var values = {
        ssid: sourceText('od_gw_ssid'),
        lanip: sourceText('od_gw_lanip'),
        wps: sourceText('od_gw_wps'),
        mac: macAddress(sourceText('od_gw_mac')),
        bandmac: macAddress(sourceText('od_gw_bandmac')),
        security: text(security)
      };
      var path = framePath();
      if (frame && path && /\/device-map\/router\.asp$/i.test(path)) {
        try {
          var doc = frame.contentDocument;
          if (doc) {
            var ssid = doc.getElementById('wl_ssid');
            if (ssid && ssid.value) values.ssid = ssid.value;
            var auth = doc.querySelector('[name="wl_auth_mode_x"]');
            if (auth && auth.options && auth.selectedIndex >= 0) {
              values.security = text(auth.options[auth.selectedIndex]);
            }
            var fields = { LANIP: 'lanip', PINCode: 'wps', MAC: 'mac', BandMAC: 'bandmac' };
            for (var id in fields) {
              var field = doc.getElementById(id);
              var fieldValue = field ? text(field) : '';
              if (!fieldValue) continue;
              if (id === 'MAC' || id === 'BandMAC') fieldValue = macAddress(fieldValue);
              values[fields[id]] = fieldValue;
            }
          }
        } catch (error) { /* the frame is same-origin; retain page values */ }
      }
      var fallback = { ssid: 'Unavailable', security: 'Unavailable', lanip: 'Unavailable', wps: 'Unavailable', mac: 'Unavailable', bandmac: 'Unavailable' };
      for (var key in gwValues) {
        var output = values[key] || fallback[key];
        gwValues[key].textContent = output;
        if (key === 'mac' || key === 'bandmac') gwValues[key].classList.add('od-mono');
      }
      var band = bandName();
      wirelessValue.textContent = [band || '2.4 GHz', values.security].filter(Boolean).join(' · ');
      gatewaySubtitle.textContent = [model || subtitle, band].filter(Boolean).join(' · ');
      var down = rateMbps(sourceText('od_dsl_down'));
      var up = rateMbps(sourceText('od_dsl_up'));
      var readings = [];
      if (down) readings.push(down + ' ↓');
      if (up) readings.push(up + ' ↑');
      dslValue.textContent = readings.length ? readings.join(' / ') + ' Mbps' : 'Unavailable';
      var state = sourceText('od_dsl_state');
      dslStateValue.textContent = state || 'Unavailable';
      dslDownValue.textContent = down ? down + ' Mbps' : 'Unavailable';
      dslUpValue.textContent = up ? up + ' Mbps' : 'Unavailable';
      dslTypeValue.textContent = sourceText('od_dsl_type').replace(/_/g, ' ') || 'Unavailable';
      wanEmpty.hidden = !!(text(wanDiv) && (!wanDiv.style || wanDiv.style.display !== 'none'));
    }
    function syncCount() {
      var count = clientCountValue();
      clientsSub.textContent = count === null ? '' : count + ' online';
      if (count === null) deviceSub.textContent = 'Device information is unavailable.';
      else if (count === 0) deviceSub.textContent = 'No devices are connected to your network.';
      else deviceSub.textContent = count + (count === 1 ? ' device is connected to your network.' : ' devices are connected to your network.');
      drawDevices();
    }
    function framePath() {
      try { return frame && frame.contentWindow ? frame.contentWindow.location.pathname || '' : ''; } catch (error) { return ''; }
    }
    function ensureNative(nativePage, path, title) {
      var current = framePath();
      if (current === path) {
        if (helpname && !text(helpname)) helpname.textContent = title;
        return;
      }
      if (nativePage && typeof window.showstausframe === 'function') {
        try { window.showstausframe(nativePage); return; } catch (error) { /* direct source below */ }
      }
      if (frame) frame.src = path;
      if (helpname) helpname.textContent = title;
    }
    function choose(view, focus) {
      currentView = view;
      var type = view === 'internet' || view === 'internet-native' ? 'internet' : (view === 'clients' ? 'clients' : 'gateway');
      for (var n = 0; n < nodes.length; n++) {
        var active = nodes[n].type === type;
        nodes[n].node.classList.toggle('is-selected', active);
        nodes[n].node.setAttribute('aria-pressed', String(active));
      }
      gatewayView.hidden = view !== 'gateway';
      internetView.hidden = view !== 'internet';
      dslView.hidden = view !== 'dsl';
      nativeView.hidden = view !== 'wireless' && view !== 'system' && view !== 'clients' && view !== 'internet-native' && view !== 'dsl-native';
      inspectorLabel.textContent = VIEW_LABELS[view] || 'Network details';
      inspectorGlyph.setAttribute('data-view', view === 'clients' ? 'devices' : (view === 'wireless' ? 'wifi' : (view === 'dsl' || view === 'dsl-native' ? 'dsl' : (view === 'internet' || view === 'internet-native' ? 'internet' : 'gateway'))));
      if (view === 'wireless') ensureNative('Router', '/cgi-bin/device-map/router.asp', 'Wireless settings');
      else if (view === 'system') ensureNative('', '/cgi-bin/device-map/router_status.asp', 'System status');
      else if (view === 'clients') ensureNative('Client', '/cgi-bin/device-map/clients.asp', 'Client list');
      else if (view === 'internet-native') ensureNative('Internet', '/cgi-bin/device-map/internet.asp', 'Connection details');
      else if (view === 'dsl-native') ensureNative('', '/cgi-bin/device-map/DSL_dashboard.asp', 'DSL line');
      if (focus) {
        var heading = inspectorLabel;
        if (window.matchMedia && window.matchMedia('(max-width:850px)').matches) {
          try { heading.focus(); } catch (error) { /* heading focus is best effort */ }
        }
      }
    }

    viewAll.addEventListener('click', function () { choose('clients', true); });
    dslButton.addEventListener('click', function () { choose('dsl', true); });
    if (frame) frame.addEventListener('load', syncGateway);

    /* Initial selection is the gateway summary; the editable router form stays
       loaded in the retained native view behind the explicit Edit action. */
    choose('gateway', false);
    syncStatus();
    syncGateway();
    syncCount();
    if (window.MutationObserver) {
      if (connectStatus) new MutationObserver(syncStatus).observe(connectStatus, { childList: true, subtree: true, characterData: true });
      if (clientCount) new MutationObserver(syncCount).observe(clientCount, { childList: true, subtree: true, characterData: true });
      if (security) new MutationObserver(syncGateway).observe(security, { childList: true, subtree: true, characterData: true });
      var liveCount = document.getElementById('_clientNumber');
      if (liveCount) new MutationObserver(syncCount).observe(liveCount, { childList: true, subtree: true, characterData: true });
    }
    if (currentView === 'gateway') inspectorLabel.setAttribute('tabindex', '-1');
  }

  /* The embedded inspector labels its fields by mechanism. Present the same
     controls under the approved wording; values and validation stay native. */
  function decoratePasswordFields() {
    var psk = document.getElementById('wl_wpa_psk') || document.querySelector('input[name="wl_wpa_psk"]');
    if (!psk || (psk.parentNode && psk.parentNode.querySelector('.od-password-toggle'))) return;
    if (!psk.id) psk.id = 'wl_wpa_psk';
    var revealed = false;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'od-password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');

    function syncType() {
      psk.type = revealed ? 'text' : 'password';
      toggle.setAttribute('aria-label', revealed ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(revealed));
      toggle.classList.toggle('od-show', revealed);
    }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      revealed = !revealed;
      syncType();
    });

    psk.addEventListener('blur', function () {
      if (revealed) psk.type = 'text';
    });

    psk.addEventListener('focus', function () {
      if (!revealed) psk.type = 'password';
    });

    var wrap = document.createElement('div');
    wrap.className = 'od-password-wrap';
    psk.parentNode.insertBefore(wrap, psk);
    wrap.appendChild(psk);
    wrap.appendChild(toggle);
  }

  function labelInspector() {
    if (!document.body.classList.contains('statusbody')) return;
    var fields = [
      ['wl_ssid', 'Network name (SSID)'],
      ['wl_auth_mode_x', 'Authentication'],
      ['wl_crypto', 'Encryption'],
      ['wl_wpa_psk', 'Wi-Fi password']
    ];
    var i, control, cell, label;
    for (i = 0; i < fields.length; i++) {
      control = document.querySelector('[name="' + fields[i][0] + '"]');
      cell = control && control.closest('td');
      label = cell && cell.querySelector('.formfonttitle_nwm');
      if (label) label.textContent = fields[i][1];
    }
    var info = [
      ['LANIP', 'LAN address'], ['PINCode', 'WPS PIN'],
      ['MAC', 'LAN MAC'], ['BandMAC', 'Wireless MAC']
    ];
    for (i = 0; i < info.length; i++) {
      control = document.getElementById(info[i][0]);
      cell = control && control.closest('td');
      label = cell && cell.querySelector('.formfonttitle_nwm');
      if (label) label.textContent = info[i][1];
    }
  }

  /* The embedded router form ships one table per setting. Present those tables
     as rows of one card and put the unchanged native Apply below the card;
     branch wrappers, table cells and their display toggles stay in place. */
  function groupInspectorFields() {
    if (!document.body.classList.contains('statusbody')) return;
    if (document.body.classList.contains('od-inspector-form')) return;
    var ssid = document.querySelector('[name="wl_ssid"]');
    var first = ssid && ssid.closest('table.table1px');
    var applyRow = document.getElementById('apply_tr');
    var applyTable = applyRow && applyRow.closest('table');
    if (!first || !applyTable) return;
    var cell = first.parentNode;
    var card = document.createElement('div');
    card.className = 'od-inspector-card';
    var fields = [], node;
    for (node = cell.firstElementChild; node; node = node.nextElementSibling) fields.push(node);
    cell.insertBefore(card, cell.firstElementChild);
    var tables = [];
    for (var f = 0; f < fields.length; f++) {
      node = fields[f];
      card.appendChild(node);
      if (node.tagName === 'TABLE') tables.push(node);
      else {
        var inner = node.querySelectorAll('table.table1px');
        for (var t = 0; t < inner.length; t++) tables.push(inner[t]);
      }
    }
    for (var i = 0; i < tables.length; i++) {
      tables[i].classList.add('od-inspector-field');
      var rows = tables[i].rows;
      var multi = false;
      for (var r = 0; r < rows.length; r++) {
        var td = rows[r].cells[0];
        if (!td) continue;
        var oneLabel = td.querySelectorAll('.formfonttitle_nwm').length === 1;
        var count = td.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
        if (oneLabel && count === 1) rows[r].classList.add('od-inspector-row');
        else if (oneLabel && count > 1) multi = true;
      }
      if (multi) tables[i].classList.add('od-inspector-multi');
    }
    var button = applyRow.querySelector('input[type="submit"]');
    if (button) {
      var actions = document.createElement('div');
      actions.className = 'od-inspector-actions';
      var hidden = applyRow.querySelectorAll('input[type="hidden"]');
      for (var h = 0; h < hidden.length; h++) actions.appendChild(hidden[h]);
      actions.appendChild(button);
      cell.appendChild(actions);
    }
    applyRow.parentNode.removeChild(applyRow);
    document.body.classList.add('od-inspector-form');
  }

  /* Guest access-time controls belong to one group: day, hour and minute
     fields each keep their unit beside them, and the limitless option stays
     its own choice. Moving original nodes keeps names, radios, handlers,
     state and form membership; the function is idempotent. The known native
     controls are located explicitly instead of relying on sibling order. */
  function groupTimeFields() {
    var day = document.querySelector('select[name="wl_expire_day"]');
    if (!day || day.closest('.od-time-fields')) return;
    var cell = day.closest('td');
    var timed = document.querySelector('input[name="wl_expire_radio"][value="1"]');
    var unlimited = document.querySelector('input[name="wl_expire_radio"][value="0"]');
    var hr = document.querySelector('input[name="wl_expire_hr"]');
    var min = document.querySelector('input[name="wl_expire_min"]');
    if (!cell || !timed || !unlimited || !hr || !min) return;
    if (timed.closest('td') !== cell || hr.closest('td') !== cell || min.closest('td') !== cell) return;
    var group = element('div', 'od-time-fields');
    cell.insertBefore(group, timed);
    var pairFor = function (control) {
      var pair = element('span', 'od-time-pair');
      var units = [];
      var unit = control.nextSibling;
      while (unit && (unit.nodeType === 3 || unit.nodeName === 'BR')) {
        var after = unit.nextSibling;
        if (unit.nodeType === 3 && unit.textContent.replace(/\s+/g, ' ')) units.push(unit);
        unit = after;
      }
      pair.appendChild(control);
      for (var u = 0; u < units.length; u++) pair.appendChild(units[u]);
      return pair;
    };
    group.appendChild(timed);
    group.appendChild(pairFor(day));
    group.appendChild(pairFor(hr));
    group.appendChild(pairFor(min));
    var alternative = element('div', 'od-time-unlimited');
    cell.insertBefore(alternative, unlimited);
    while (unlimited) {
      var after = unlimited.nextSibling;
      alternative.appendChild(unlimited);
      unlimited = after;
    }
  }

  /* The setup assistant's native title names the page mechanism rather than
     the task. Use the approved task title and its lock mark. */
  function decorateSetupForm() {
    var main = document.querySelector('.QISmain');
    if (!main) return;
    var mapped = QIS_TITLES[location.pathname];
    var title = main.querySelector('.description_down') || main.querySelector('.formfonttitle');
    if (!title) return;
    var nativeTitle = title;
    if (main.querySelector('.description_down') && main.querySelector('.formfonttitle') &&
        nativeTitle !== main.querySelector('.description_down')) {
      main.querySelector('.formfonttitle').style.display = 'none';
      nativeTitle = main.querySelector('.description_down');
    }
    var desc = main.querySelector('.description_down');
    var target = desc || nativeTitle;
    if (mapped && text(target) !== mapped) target.textContent = mapped;
    if (document.getElementById('adminPassDesc')) {
      var t = main.querySelector('.description_down');
      if (t) {
        if (!t.previousElementSibling || !t.previousElementSibling.classList.contains('od-setup-mark')) {
          var mark = element('span', 'od-setup-mark');
          t.parentNode.insertBefore(mark, t);
        }
        if (!mapped) t.textContent = 'Secure your modem';
      }
    }
  }

  /* The map keeps its native actions; a phone shortcut opens the native
     wireless form instead of duplicating it on the overview. */
  function addWifiShortcut() {
    var map = document.getElementById('NM_table');
    if (!map) return;
    var router = map.querySelector('tr:has(#iconRouter) > td:nth-child(2)');
    if (router && !router.querySelector('.od-wifi-link')) {
      var link = document.createElement('a');
      link.className = 'od-wifi-link';
      link.href = '/Advanced_Wireless_Content.asp';
      link.textContent = 'Edit Wi-Fi';
      router.appendChild(link);
    }
    var body = map.querySelector('tbody');
    if (body && !body.querySelector('.od-map-caption')) {
      var caption = document.createElement('p');
      caption.className = 'od-map-caption';
      caption.textContent = 'Internet \u2192 OpenDSL \u2192 Your devices';
      body.appendChild(caption);
    }
  }

  function stackFieldTables() {
    var tables = document.querySelectorAll('table.FormTable');
    for (var n = 0; n < tables.length; n++) {
      var rows = tables[n].rows, fields = false, wide = false;
      for (var r = 0; r < rows.length; r++) {
        if (rows[r].cells.length > 2) wide = true;
        if (rows[r].cells.length === 2 && rows[r].cells[0].tagName === 'TH') fields = true;
      }
      if (fields && !wide) tables[n].classList.add('od-fields');
    }
  }

  /* Router-specific presentation hooks. Native nodes keep identity, names,
     handlers and visibility callbacks; only presentation wrappers/classes
     are added. The QoS switch state is mirrored to the theme via classes so
     the knob colour/direction follows the native hidden field, not the
     container filename (the QoS page deliberately uses the off sprite for
     both states). */
  function qosPhoneLayout() {
    var path = location.pathname || '';
    if (path.indexOf('QoS_EZQoS.asp') >= 0) {
      document.body.classList.add('od-qos-ez');
      var field = document.querySelector('input[name="qos_enable"]');
      if (field) {
        var sync = function () {
          var sw = document.querySelector('.iphone_switch_container');
          if (!sw) return;
          var on = field.value === '1';
          sw.classList.toggle('od-on', on);
          sw.classList.toggle('od-off', !on);
          sw.setAttribute('aria-checked', on ? 'true' : 'false');
        };
        sync();
        document.addEventListener('click', function (event) {
          if (event.target && event.target.closest && event.target.closest('.iphone_switch_container')) {
            if (window.requestAnimationFrame) window.requestAnimationFrame(sync); else sync();
          }
        });
        if (window.MutationObserver) {
          new MutationObserver(sync).observe(field, { attributes: true, attributeFilter: ['value'] });
        }
        var save = document.querySelector('div.titlebtn[onclick*="submitQoS"]');
        if (save && !save.hasAttribute('tabindex')) {
          save.setAttribute('tabindex', '0');
          save.setAttribute('role', 'button');
          save.addEventListener('keydown', function (event) {
            if (event.target === this && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              this.click();
            }
          });
        }
      }
    } else if (path.indexOf('Advanced_QOSUserPrio_Content.asp') >= 0) {
      document.body.classList.add('od-qos-prio');
      decorateQosPriorities();
    } else if (path.indexOf('Advanced_QOSUserRules_Content.asp') >= 0) {
      document.body.classList.add('od-qos-rules');
      var block = document.getElementById('qos_rulelist_Block');
      if (block) block.classList.add('od-scroll', 'od-rules-scroll');
      if (window.matchMedia && window.matchMedia('(max-width:850px)').matches &&
          typeof addRow_Group === 'function' && !window.__odQosGuard) {
        window.__odQosGuard = 1;
        var nativeAdd = window.addRow_Group;
        window.addRow_Group = function () {
          try {
            var t = document.getElementById('qos_rulelist_table');
            if (t && t.rows.length && typeof qos_rulelist_array !== 'undefined' && qos_rulelist_array === '') {
              var parts = [];
              for (var row = 0; row < t.rows.length; row++) {
                var field = t.rows[row].cells;
                var clean = function (cell) {
                  var clone = cell.cloneNode(true);
                  var labels = clone.querySelectorAll('.od-cell-label');
                  for (var k = 0; k < labels.length; k++) labels[k].parentNode.removeChild(labels[k]);
                  var control = clone.querySelector('input:not([type="hidden"]):not([type="button"]):not([type="submit"]), select, textarea');
                  if (control) return String(control.value || '');
                  return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
                };
                var prio = '1';
                var sel = field[5] ? field[5].querySelector('select') : null;
                if (sel) {
                  for (var o = 0; o < sel.options.length; o++) if (sel.options[o].selected) { prio = String(o); break; }
                }
                parts.push('<' + clean(field[0]) + '>' + clean(field[1]) + '>' + clean(field[2]) + '>' +
                  clean(field[3]) + '>' + clean(field[4]) + '>' + prio);
              }
              qos_rulelist_array = parts.join('');
            }
          } catch (error) { /* Keep native flow. */ }
          return nativeAdd.apply(this, arguments);
        };
      }
    }
  }

  /* QoS priority fields: the native markup nests two balance tables inside a
     FormTable. Each balance table has a group-title row followed by a real
     multi-column header row and body rows whose first cell names the
     priority. On phones the header strip is visually removed, so every value
     cell gets its own caption built from the native column-header text and
     the priority name is joined into the accessible name. The algorithm
     processes only the tagged balance tables and uses each row's direct
     cells, so captions map to the correct fields. Captions are built at all
     viewports; CSS shows them only on phones, preserving desktop headers. */
  function decorateQosPriorities() {
    var up = document.querySelector('select[name="upload_bw_min_0"]');
    var upTable = up && up.closest('table');
    if (upTable && !upTable.classList.contains('od-qos-upload')) upTable.classList.add('od-qos-upload');
    var dn = document.querySelector('select[name="download_bw_max_0"]');
    var dnTable = dn && dn.closest('table');
    if (dnTable && !dnTable.classList.contains('od-qos-download')) dnTable.classList.add('od-qos-download');
    var tables = document.querySelectorAll('table.od-qos-upload, table.od-qos-download');
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t];
      var head = table.tHead;
      if (!head) continue;
      var headingRow = null;
      for (var h = head.rows.length - 1; h >= 0; h--) {
        if (head.rows[h].cells.length > 1) { headingRow = head.rows[h]; break; }
      }
      if (!headingRow) continue;
      var headers = [];
      for (var ci = 0; ci < headingRow.cells.length; ci++) {
        headers.push(text(headingRow.cells[ci]).replace(/\s+/g, ' ').trim());
      }
      if (headers.length < 2) continue;
      var titleRow = table.tHead.rows[0];
      if (titleRow && titleRow.cells.length === 1 && !table.closest('.od-qos-group')) {
        titleRow.classList.add('od-qos-title-row');
        var nativeTitle = text(titleRow).replace(/\s+/g, ' ').trim();
        var groupTitle = nativeTitle ||
          (table.classList.contains('od-qos-upload') ? 'Upload bandwidth' : 'Download bandwidth');
        if (/upload/i.test(groupTitle)) groupTitle = 'Upload bandwidth';
        else if (/download/i.test(groupTitle)) groupTitle = 'Download bandwidth';
        var slot = table.parentNode;
        var group = element('div', 'od-qos-group');
        if (slot) {
          slot.classList.add('od-qos-slot');
          /* The approved hierarchy places the section heading above its one
             card, not inside the card's surface. */
          slot.insertBefore(element('div', 'od-qos-group-title', groupTitle), table);
          slot.insertBefore(group, table);
          group.appendChild(table);
        }
      }
      var old = table.querySelectorAll('.od-qos-field-label');
      for (var x = 0; x < old.length; x++) old[x].parentNode.removeChild(old[x]);
      for (var b = 0; b < table.tBodies.length; b++) {
        var rows = table.tBodies[b].rows;
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          if (row.cells.length !== headers.length) continue;
          var priorityCell = row.cells[0];
          if (!priorityCell.id) priorityCell.id = 'od-qos-priority-' + t + '-' + r;
          var priorityName = text(priorityCell).replace(/\s+/g, ' ').trim();
          for (var c = 1; c < row.cells.length; c++) {
            var purpose = headers[c];
            if (!purpose) continue;
            var cell = row.cells[c];
            cell.classList.add('od-qos-field');
            /* Cells that own a live value div are the native "current
               settings" column; the phone drawing has no such column, so CSS
               hides them behind this class (the divs stay as update targets). */
            if (cell.querySelector(':scope > [id$="_desc"]')) cell.classList.add('od-qos-current');
            var label = element('span', 'od-qos-field-label', '');
            label.id = 'od-qos-purpose-' + (++labelSeq);
            /* The caption keeps the native column-purpose text for the
               accessible name; phones additionally print the priority name,
               which is what the approved phone drawing shows over each
               control (see the U23-10 phone block in legacy.css). */
            label.appendChild(element('span', 'od-qos-label-purpose', purpose));
            var drawn = element('span', 'od-qos-label-name', priorityName || purpose);
            drawn.setAttribute('aria-hidden', 'true');
            label.appendChild(drawn);
            cell.insertBefore(label, cell.firstChild);
            var control = cell.querySelector('select, input[type="text"]');
            if (control && !control.hasAttribute('aria-labelledby') && !control.hasAttribute('aria-label')) {
              control.setAttribute('aria-labelledby', priorityCell.id + ' ' + label.id);
            }
          }
        }
      }
    }
    /* The separate "Enable QoS..." notice is static guidance on this route,
       not a validation/live warning: keep its text in the same closed Help
       disclosure instead of leaving a bullet under the summary. */
    var help = document.querySelector('.od-help');
    var extra = document.getElementById('is_qos_enable_desc');
    if (extra && !extra.hasAttribute('data-od-help')) {
      if (help) {
        help.appendChild(extra);
        extra.setAttribute('data-od-help', '1');
      }
    }
    /* The native FormTitle wrapper table carries no cellspacing attribute, so
       the UA's default 2px border-spacing plus the 1px default cell padding
       inset the whole route by 3px. Tag the frame (and its two native lead
       rows) so the theme can zero that inset and drop the rows the approved
       drawing does not have; the drawn geometry starts at the content column
       edge with the tools row on top. */
    var frame = document.querySelector('#FormTitle > tbody > tr > td > table');
    if (frame && !frame.classList.contains('od-qos-frame')) {
      frame.classList.add('od-qos-frame');
      var frameRows = frame.rows ? frame.rows : [];
      for (var fr = 0; fr < frameRows.length; fr++) {
        var frameRow = frameRows[fr];
        if (frameRow.querySelector && frameRow.querySelector('img[src*="line_export"]')) {
          frameRow.classList.add('od-qos-native-line');
        }
      }
    }
    /* The approved tools row pairs the compact help summary with the native
       page switcher at the drawn width. The select keeps its options and
       handler and stays inside the native form. The emptied native title row
       is not in the drawing; hiding it also drops the 11px lead-in above the
       tools row so it starts at the drawn y. */
    if (help && !document.querySelector('.od-qos-tools')) {
      var switcher = document.querySelector('#FormTitle > tbody > tr:first-child select');
      if (switcher && switcher.closest('form') === help.closest('form')) {
        var titleTable = switcher.closest('table');
        var toolsRow = element('div', 'od-qos-tools');
        help.parentNode.insertBefore(toolsRow, help);
        toolsRow.appendChild(help);
        var actionSlot = element('div', 'od-qos-tools-action');
        actionSlot.appendChild(switcher);
        toolsRow.appendChild(actionSlot);
        var titleRow = titleTable && titleTable.closest('tr');
        if (titleRow) titleRow.classList.add('od-qos-native-title');
      }
    }
    /* The Highest Priority packet group: hide the native h_help note row from
       the card (its copy joins the Help disclosure) and give empty Current
       settings cells the drawn em dash. The native divs stay update targets
       for gen_options(). */
    var packet = document.getElementById('packet_table');
    if (packet) {
      var packetCard = packet.closest('table.FormTable');
      if (packetCard) packetCard.classList.add('od-qos-packet-card');
      var packetList = packet.querySelector('table');
      if (packetList) packetList.classList.add('od-qos-packet-list');
      var note = document.getElementById('prio_packet_note');
      var noteRow = note && note.closest('tr');
      if (noteRow) noteRow.classList.add('od-qos-note-row');
      if (note && help && !note.hasAttribute('data-od-help')) {
        var noteBlock = element('div', 'formfontdesc');
        noteBlock.appendChild(note);
        help.appendChild(noteBlock);
        note.setAttribute('data-od-help', '1');
      }
    }
    var descs = document.querySelectorAll('.od-qos-group [id$="_desc"]');
    for (var d = 0; d < descs.length; d++) {
      if (!text(descs[d]) && !descs[d].hasAttribute('data-od-placeholder')) {
        descs[d].setAttribute('data-od-placeholder', '1');
        descs[d].textContent = '\u2014';
      }
    }
  }

  function scrollWideTables() {
    var limit = document.documentElement.clientWidth - 2;
    var tables = document.querySelectorAll('body table');
    for (var n = 0; n < tables.length; n++) {
      var table = tables[n];
      if (table.closest('.od-scroll') || table.closest('#NM_table')) continue;
      if (table.closest('#tabMenu')) continue;
      if (table.parentElement === document.body) continue;
      if (table.classList.contains('content') || table.querySelector('#mainMenu, #TopBanner, #footer')) continue;
      if (document.body.classList.contains('LevelQIS') || table.closest('.QISmain')) continue;
      var rect = table.getBoundingClientRect();
      if (rect.width <= limit && rect.right <= limit + 2) continue;
      var wrapper = document.createElement('div');
      wrapper.className = 'od-scroll';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }

  /* A unit immediately after a control is presentation copy ("seconds", "%").
     Keep it beside the control but visually inside the full-width field. */
  function followingUnit(control) {
    var node = control.nextSibling;
    while (node && node.nodeType === 3 && !node.textContent.replace(/\u00a0/g, ' ').trim()) node = node.nextSibling;
    if (!node) return null;
    if (node.nodeType === 3) {
      var value = node.textContent.replace(/\u00a0/g, ' ').trim();
      if (!value || value.length > 24 || !/^[%\w][%\w .\/()+-]*$/.test(value)) return null;
      return node;
    }
    if (node.nodeType !== 1 || !/^(SPAN|B|FONT|EM|SMALL|I)$/.test(node.tagName)) return null;
    /* Interactive helpers are actions, never a field's decorative unit. */
    if (node.matches('[onclick], [onkeydown], [tabindex], [role="button"], [role="link"]')) return null;
    if (node.querySelector('a, input, select, textarea, button')) return null;
    var label = text(node);
    if (!label || label.length > 24 || !/^[%\w][%\w .\/()+-]*$/.test(label)) return null;
    return node;
  }

  function sizeFields() {
    var cells = document.querySelectorAll('table.FormTable td');
    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      if (cell.querySelector('.od-unit-field')) continue;
      var controls = cell.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]),select,textarea');
      if (controls.length !== 1) continue;
      var control = controls[0];
      control.classList.add('od-full');
      if (control.type === 'file' || control.closest('.od-control-with-helper, .od-qos-group, .od-picker-row')) continue;
      var unit = followingUnit(control);
      if (!unit) continue;
      var wrap = element('div', 'od-unit-field');
      control.parentNode.insertBefore(wrap, control);
      wrap.appendChild(control);
      var suffix = element('span', 'od-unit-text');
      suffix.appendChild(unit);
      wrap.appendChild(suffix);
      if (suffix.getBoundingClientRect) {
        wrap.style.setProperty('--od-unit-pad', Math.ceil(suffix.getBoundingClientRect().width) + 32 + 'px');
      }
    }
  }

  /* Native radio pairs sit flush against the previous label (◯ Yes◯ No).
     Space the whole option token, not just the control, and leave a control
     that starts a line or a block alone. */
  function decorateIptvPanel() {
    var action = document.getElementById('igmpproxy_param_text');
    var panel = document.getElementById('igmp_panel');
    if (!action || !panel) return;
    if (action.tagName !== 'BUTTON') {
      var button = document.createElement('button');
      button.type = 'button';
      button.id = action.id;
      button.className = 'button_gen od-igmp-config';
      button.textContent = text(action);
      button.onclick = action.onclick;
      button.style.display = action.style.display;
      button.setAttribute('aria-controls', 'igmp_panel');
      action.parentNode.replaceChild(button, action);
      action = button;
    }
    var group = action.closest('table.FormTable');
    if (group && !panel.classList.contains('od-igmp-inline')) {
      panel.classList.add('od-igmp-inline');
      group.parentNode.insertBefore(panel, group.nextSibling);
    }
    var sync = function () {
      action.setAttribute('aria-expanded', String(window.getComputedStyle(panel).display !== 'none'));
    };
    sync();
    if (window.MutationObserver) new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['style'] });
  }

  function decorateChoiceGroups() {
    var inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var token = input.closest('label');
      if (!token) {
        var parent = input.parentElement;
        if (parent && /^(SPAN|B|I|EM|SMALL)$/.test(parent.tagName) && parent.querySelectorAll('input').length === 1) token = parent;
      }
      if (!token) token = input;
      if (token.classList.contains('od-choice-gap')) continue;
      var prev = token.previousSibling;
      while (prev && ((prev.nodeType === 3 && !prev.textContent.trim()) || prev.nodeType === 8)) prev = prev.previousSibling;
      if (!prev) continue;
      if (prev.nodeType === 3) { token.classList.add('od-choice-gap'); continue; }
      if (prev.nodeType !== 1 || prev.tagName === 'BR') continue;
      var display = window.getComputedStyle(prev).display;
      if (display === 'block' || display === 'table' || display === 'list-item') continue;
      token.classList.add('od-choice-gap');
    }
  }

  /* The DDNS Server value cell keeps real table-cell semantics; the select
     and its helper links share an inner flex wrapper so the row divider and
     column edges stay aligned while the helper can wrap on narrow screens. */
  function decorateDdnsServerRow() {
    var cells = document.querySelectorAll('td:has(> select[name="ddns_server_x"])');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.querySelector('.od-control-with-helper')) continue;
      var wrap = element('div', 'od-control-with-helper');
      var select = cell.querySelector('select[name="ddns_server_x"]');
      if (!select) continue;
      while (cell.firstChild) wrap.appendChild(cell.firstChild);
      cell.appendChild(wrap);
    }
  }

  function labelFields() {
    var fields = document.querySelectorAll('input:not([type="hidden"]),select,textarea');
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f], line = field.closest('tr');
      if (field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby') ||
          (field.id && document.querySelector('label[for="' + field.id + '"]'))) continue;
      var label = line ? line.querySelector('th,.formfonttitle_nwm') : null;
      if (label && text(label)) {
        if (!label.id) label.id = 'od-label-' + f;
        field.setAttribute('aria-labelledby', label.id);
      }
    }
  }

  function keyboardLinks() {
    var items = host ? host.querySelectorAll('div[onclick]') : [];
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute('role', 'link');
      items[i].setAttribute('tabindex', '0');
      items[i].addEventListener('keydown', function (event) {
        if (event.target === this && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          this.click();
        }
      });
    }
  }

  function fitFrames() {
    var fits = [];
    ['statusframe', 'contentM'].forEach(function (id) {
      var frame = document.getElementById(id);
      if (!frame) return;
      var observer;
      var fit = function () {
        if (observer) observer.disconnect();
        try {
          var body = frame.contentDocument.body;
          if (!body) return;
          var measure = function () {
            var height = Math.max(160, Math.min(12000, Math.ceil(body.getBoundingClientRect().height)));
            if (Math.abs(frame.getBoundingClientRect().height - height) > 1) frame.style.height = height + 'px';
          };
          measure();
          fits.push(measure);
          if (window.ResizeObserver) {
            observer = new ResizeObserver(measure);
            observer.observe(body);
          }
        } catch (error) { /* Native iframe scrolling remains the fallback. */ }
      };
      frame.addEventListener('load', fit);
      fit();
    });
    if (fits.length) {
      var pending = false;
      window.addEventListener('resize', function () {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () {
          pending = false;
          for (var f = 0; f < fits.length; f++) fits[f]();
        });
      });
    }
  }

  /* The diagnostic CGI documents are separate same-origin HTML responses
     with only a fixed textarea. Inject the shared dark presentation into each
     frame after load; no CGI bytes, commands or response format change. */
  var DIAGNOSTIC_FRAME_CSS = [
    'html,body{margin:0!important;padding:0!important;background:#0f141b!important;color:#edf2f8!important;height:100%!important;overflow:hidden!important}',
    'body{font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace!important}',
    'textarea#textarea{display:block!important;width:100%!important;height:100%!important;min-height:0!important;max-width:100%!important;box-sizing:border-box!important;margin:0!important;padding:16px 18px!important;border:1px solid #2c3c50!important;border-radius:12px!important;background:#121820!important;color:#edf2f8!important;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace!important;resize:none!important;white-space:pre!important;overflow:auto!important;scrollbar-width:thin}',
    'textarea#textarea:focus{outline:2px solid #62bbff!important;outline-offset:2px}'
  ].join('');
  function themeDiagnosticFrames() {
    var frames = document.querySelectorAll('iframe#status_iframe, iframe[src*="status_log2.cgi"], iframe[src*="status_wifi.cgi"], iframe[src*="status_route.cgi"], iframe[src*="status_conn.cgi"]');
    for (var f = 0; f < frames.length; f++) {
      (function (frame) {
        var apply = function () {
          try {
            var doc = frame.contentDocument;
            if (!doc || !doc.head || doc.getElementById('od-diagnostic-frame-style')) return;
            var style = doc.createElement('style');
            style.id = 'od-diagnostic-frame-style';
            style.textContent = DIAGNOSTIC_FRAME_CSS;
            doc.head.appendChild(style);
            if (doc.documentElement) doc.documentElement.classList.add('od-diagnostic-frame');
            var area = doc.getElementById('textarea');
            var src = frame.getAttribute('src') || '';
            if (area && src.indexOf('status_log2.cgi') < 0) {
              var lines = area.value ? area.value.split('\n').length : 0;
              var height = Math.max(160, Math.min(460, lines * 20 + 44));
              area.style.height = height + 'px';
              frame.style.height = (height + 2) + 'px';
            }
          } catch (error) { /* Same-origin only; native scrolling remains. */ }
        };
        frame.addEventListener('load', apply);
        apply();
      })(frames[f]);
    }
  }

  function mapDisclosure() {
    var status = document.getElementById('statusframe');
    if (status) {
      var panel = status.closest('td');
      if (panel) panel.classList.add('od-inspector');
    }
    var nodes = document.querySelectorAll('#NM_table td[onclick]');
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].setAttribute('tabindex', '0');
      nodes[k].setAttribute('role', 'button');
      nodes[k].addEventListener('keydown', function (event) {
        if (event.target === this && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          this.click();
        }
      });
    }
  }

  /* Native footer: keep the generated links, FAQ input, native search action
     and capability gating, but present them as one compact row with support
     and FAQ panels that expand above it. The 2018 vendor notice is omitted at
     the user's explicit request. */
  function decorateFooter() {
    var footer = document.getElementById('footer');
    if (!footer || footer.querySelector('.od-footer-bar')) return;
    var linkCell = footer.querySelector('#bottom_help_link');
    var faqInput = footer.querySelector('#FAQ_input');
    if (!linkCell && !faqInput) return;
    var panels = element('div', 'od-footer-panels');
    var bar = element('div', 'od-footer-bar');
    var supportPanel = null;
    var faqPanel = null;
    var anchors = linkCell ? linkCell.querySelectorAll('a') : [];
    if (anchors.length) {
      supportPanel = element('nav', 'od-footer-panel od-footer-links');
      supportPanel.setAttribute('aria-label', 'Support links');
      supportPanel.hidden = true;
      for (var a = 0; a < anchors.length; a++) supportPanel.appendChild(anchors[a]);
      panels.appendChild(supportPanel);
    }
    if (faqInput) {
      faqPanel = element('div', 'od-footer-panel od-footer-faq');
      faqPanel.hidden = true;
      var row = element('div', 'od-faq-row');
      faqInput.setAttribute('aria-label', 'Search FAQ');
      row.appendChild(faqInput);
      var icon = footer.querySelector('#bottom_help_FAQ_icon');
      if (icon) row.appendChild(icon);
      faqPanel.appendChild(row);
      panels.appendChild(faqPanel);
    }
    var supportToggle = null;
    if (supportPanel) {
      supportToggle = document.createElement('button');
      supportToggle.type = 'button';
      supportToggle.className = 'od-footer-toggle od-support-toggle';
      var titleNode = footer.querySelector('#bottom_help_title');
      var label = titleNode ? text(titleNode) : 'Help & Support';
      supportToggle.appendChild(document.createTextNode(label || 'Help & Support'));
      supportToggle.appendChild(element('span', 'od-footer-chevron'));
      supportToggle.setAttribute('aria-expanded', 'false');
      supportToggle.setAttribute('aria-controls', 'od-footer-support');
      supportPanel.id = 'od-footer-support';
      supportToggle.addEventListener('click', function () {
        var open = supportPanel.hidden;
        supportPanel.hidden = !open;
        supportToggle.setAttribute('aria-expanded', String(open));
      });
      bar.appendChild(supportToggle);
    }
    var faqToggle = null;
    if (faqPanel) {
      faqToggle = document.createElement('button');
      faqToggle.type = 'button';
      faqToggle.className = 'od-footer-toggle od-faq-toggle';
      faqToggle.appendChild(document.createTextNode('Search FAQ'));
      faqToggle.appendChild(element('span', 'od-footer-chevron'));
      faqToggle.setAttribute('aria-expanded', 'false');
      faqToggle.setAttribute('aria-controls', 'od-footer-faq');
      faqPanel.id = 'od-footer-faq';
      faqToggle.addEventListener('click', function () {
        var open = faqPanel.hidden;
        faqPanel.hidden = !open;
        faqToggle.setAttribute('aria-expanded', String(open));
        if (open) faqInput.focus();
      });
      bar.appendChild(faqToggle);
      faqInput.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (typeof window.search_supportsite === 'function') window.search_supportsite();
      });
    }
    footer.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (faqPanel && !faqPanel.hidden) {
        faqPanel.hidden = true;
        faqToggle.setAttribute('aria-expanded', 'false');
        faqToggle.focus();
      } else if (supportPanel && !supportPanel.hidden) {
        supportPanel.hidden = true;
        supportToggle.setAttribute('aria-expanded', 'false');
        supportToggle.focus();
      }
    });
    footer.appendChild(panels);
    footer.appendChild(bar);
    var children = [].slice.call(footer.children);
    for (var c = 0; c < children.length; c++) {
      var child = children[c];
      if (child === panels || child === bar) continue;
      child.parentNode.removeChild(child);
    }
  }

  function routeClasses() {
    var p = location.pathname || '';
    if (p.indexOf('Main_TrafficMonitor_realtime.asp') >= 0) {
      document.body.classList.add('od-traffic-main');
    }
    if (p.indexOf('device-map/') >= 0) {
      document.body.classList.add('od-device-panel');
    }
    if (document.querySelector('.QISmain')) {
      document.body.classList.add('od-qis-child');
    }
    if (p.indexOf('Advanced_IPTV_Content.asp') >= 0) {
      document.body.classList.add('od-iptv');
    }
    if (p.indexOf('Advanced_Feedback.asp') >= 0) {
      document.body.classList.add('od-feedback');
    }
    if (p.indexOf('Advanced_ACL_Content.asp') >= 0) {
      document.body.classList.add('od-acl');
    }
    if (p.indexOf('Advanced_Privacy.asp') >= 0) {
      document.body.classList.add('od-privacy');
    }
  }

  /* The host wizard carries the stock "Setting" exit inside the stage strip.
     The approved composition places "Skip setup" at the top-right of the
     standalone shell. The native node and gotoIndex handler stay in place. */
  function decorateWizardHost() {
    if (!document.body.classList.contains('LevelQIS')) return;
    var skip = document.getElementById('btn_gotoindex');
    if (skip && text(skip) !== 'Skip setup') {
      skip.textContent = 'Skip setup';
      skip.setAttribute('role', 'link');
      skip.setAttribute('tabindex', '0');
      if (!skip.hasAttribute('data-od-skip-key')) {
        skip.setAttribute('data-od-skip-key', '1');
        skip.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            skip.click();
          }
        });
      }
    }
    var label = document.querySelector('.banner1 .modelName_top');
    var name = modelName();
    if (label && name && text(label) !== name) label.textContent = name;
    if (skip && skip.parentNode !== document.body) document.body.appendChild(skip);
    var stage = document.querySelector('._contentM_qis');
    var cell = stage ? stage.parentNode : null;
    if (cell && !cell.querySelector('.od-setup-caption')) {
      var caption = element('div', 'od-setup-caption');
      caption.appendChild(element('span', 'od-setup-caption-icon'));
      caption.appendChild(document.createTextNode('Quick setup'));
      cell.insertBefore(caption, stage);
    }
  }

  /* The live Traffic Monitor ships its title as a table cell inside a fixed
     width shell. After the header adapter moves that title, the leftover
     shell keeps constraining the page. This route adapter opens every nested
     table to the full content width and lets the graph scale with it. */
  /* U23-09: the live traffic monitor keeps its native graph, update loops,
     selectors and actions, but the body is presented with the theme's cards.
     The native "Display Options" group follows the status card rhythm, the
     mode selector sits in a toolbar card, the reception/transmission matrix
     becomes a legend with a readable empty state, and the counter table
     becomes a readings card. Nothing that the native hides is revealed. */
  function decorateTrafficMonitor() {
    if (location.pathname.indexOf('Main_TrafficMonitor') < 0) return;
    document.body.classList.add('od-traffic');
    var head = document.querySelector('.od-page-head');
    if (head) {
      head.style.width = '100%';
      head.style.maxWidth = '100%';
      head.style.boxSizing = 'border-box';
    }
    var ft = document.getElementById('FormTitle');
    if (ft) {
      var tables = ft.querySelectorAll('table');
      for (var i = 0; i < tables.length; i++) {
        tables[i].style.width = '100%';
        tables[i].maxWidth = '100%';
      }
    }
    var graph = document.querySelector('object#graph');
    if (graph) {
      graph.style.width = '100%';
      graph.style.height = 'auto';
      graph.style.minHeight = '240px';
    }
    var titleCells = document.querySelectorAll('td.formfonttitle');
    for (var c = 0; c < titleCells.length; c++) {
      if (!text(titleCells[c])) titleCells[c].style.display = 'none';
    }

    /* The native options group shares the status card rhythm. */
    var trigger = document.getElementById('TriggerList');
    if (trigger) {
      var options = trigger.closest('table');
      if (options) {
        options.classList.add('od-tm-options');
        var optionTitle = options.parentNode.querySelector('.od-section-title');
        if (optionTitle) optionTitle.classList.add('od-tm-heading');
        var optionRows = options.querySelectorAll('tbody > tr');
        for (var o = 0; o < optionRows.length; o++) {
          optionRows[o].classList.add('od-tm-row');
          if (o > 0) optionRows[o].classList.add('od-tm-sep');
        }
      }
    }

    /* The reception/transmission matrix becomes a legend: the direction
       labels stay, the counters keep their native cells. */
    var legend = document.querySelector('table.DescTable');
    var readings = document.querySelector('table.FormTable_NWM');
    if (legend) {
      legend.classList.add('od-tm-legend');
      var legendRows = legend.querySelectorAll('tr');
      for (var r = 0; r < legendRows.length; r++) {
        var cells = legendRows[r].cells;
        for (var l = 0; l < cells.length; l++) {
          if (cells[l].tagName === 'TH') {
            if (l === 0) {
              /* The header's first cell is an empty corner, not a direction;
                 only the data rows below it carry Reception/Transmission. */
              if (cells[l].textContent.replace(/\s+/g, ' ').trim()) {
                cells[l].classList.add('od-tm-legend-label');
                if (r === 1) cells[l].classList.add('od-tm-legend-label-a');
              }
            }
            else cells[l].classList.add('od-tm-legend-head');
          } else {
            cells[l].classList.add('od-tm-legend-value');
          }
        }
        if (r === 0) legendRows[r].classList.add('od-tm-legend-headrow');
      }
    }

    /* The counter table gains the drawing's direction column and an empty
       state that appears while the native counters are still blank. The
       native header shares the implicit tbody with the two data rows, so the
       header must be identified before data-row labels are attached. */
    var emptyRow = null;
    if (readings) {
      readings.classList.add('od-tm-readings');
      var nativeRows = readings.querySelectorAll('tbody > tr');
      var headRow = null, dataRows = [], columnLabels = [];
      for (var b = 0; b < nativeRows.length; b++) {
        if (!headRow && nativeRows[b].querySelector('th')) {
          headRow = nativeRows[b];
          headRow.classList.add('od-tm-readings-head');
          var headerCells = headRow.querySelectorAll('th');
          for (var hc = 0; hc < headerCells.length; hc++) {
            headerCells[hc].setAttribute('scope', 'col');
            columnLabels.push(headerCells[hc].textContent.replace(/\s+/g, ' ').trim());
          }
          var first = document.createElement('th');
          first.className = 'od-tm-readings-direction';
          first.setAttribute('scope', 'col');
          first.textContent = 'Traffic';
          headRow.insertBefore(first, headRow.firstChild);
        } else if (nativeRows[b].querySelector('td[id]')) {
          dataRows.push(nativeRows[b]);
        }
      }
      var legendRows = legend ? legend.querySelectorAll('tr') : [];
      for (var d = 0; d < dataRows.length; d++) {
        dataRows[d].classList.add('od-tm-readings-row');
        var label = document.createElement('th');
        label.className = 'od-tm-readings-direction';
        label.setAttribute('scope', 'row');
        var legendLabel = legendRows[d + 1] && legendRows[d + 1].cells[0];
        label.textContent = legendLabel ? legendLabel.textContent.replace(/\s+/g, ' ').trim()
          : (d === 0 ? 'Reception' : 'Transmission');
        dataRows[d].insertBefore(label, dataRows[d].firstChild);
        var valueCells = dataRows[d].querySelectorAll('td');
        for (var vc = 0; vc < valueCells.length; vc++) {
          valueCells[vc].setAttribute('data-od-label', columnLabels[vc] || '');
        }
      }
      if (readings.tBodies[0]) {
        emptyRow = document.createElement('tr');
        emptyRow.className = 'od-tm-empty-row';
        var cell = document.createElement('td');
        cell.className = 'od-tm-empty';
        cell.colSpan = 5;
        cell.textContent = 'No entries';
        emptyRow.appendChild(cell);
        readings.tBodies[0].appendChild(emptyRow);
      }
    }

    /* The graph card carries the native prose and the chart; the empty state
       names the missing readings. */
    var graphCell = graph ? graph.closest('td') : null;
    var emptyNote = null;
    if (graphCell) {
      graphCell.classList.add('od-tm-graph');
      emptyNote = document.createElement('div');
      emptyNote.className = 'od-tm-empty od-tm-empty-graph';
      emptyNote.textContent = 'No readings available';
      graphCell.insertBefore(emptyNote, graphCell.firstChild);
      /* The legend and the native prose join the chart in one card. */
      var host = graphCell;
      if (legend && legend.parentNode !== host) host.insertBefore(legend, host.firstChild);
      var prose = document.querySelectorAll('#FormTitle div.formfontcontent');
      var help = null;
      for (var p = 0; p < prose.length; p++) {
        var faq = prose[p].querySelector('a#faq0');
        if (!help) {
          help = element('details', 'od-help');
          var summary = document.createElement('summary');
          summary.textContent = 'Help';
          help.appendChild(summary);
          host.insertBefore(help, graph);
        }
        help.appendChild(prose[p]);
        if (faq) faq.setAttribute('data-od-help', '1');
      }
      var empties = document.querySelectorAll('#FormTitle td');
      for (var e2 = 0; e2 < empties.length; e2++) {
        var cell3 = empties[e2];
        if (cell3 === host) continue;
        if (cell3.querySelector('table.DescTable, table.FormTable_NWM, select')) continue;
        /* Native traffic counters start blank and are filled by polling; an
           initially empty cell must never be treated as a permanent spacer. */
        if (cell3.closest('.od-tm-readings') || cell3.id || cell3.querySelector('[id]')) continue;
        if (!cell3.textContent.replace(/\s+/g, '').length) cell3.style.display = 'none';
      }
      /* The empty chart keeps the drawn separator and its own band. */
      var space = document.createElement('div');
      space.className = 'od-tm-graphspace';
      host.insertBefore(space, graph);
    }
    /* The mode selector sits in its own toolbar card above the graph card. */
    var tmTable = document.querySelector('table.TMTable');
    if (tmTable) {
      for (var t2 = 0; t2 < tmTable.rows.length; t2++) {
        var cell2 = tmTable.rows[t2].cells[0];
        if (!cell2) continue;
        if (tmTable.rows[t2].querySelector('select')) cell2.classList.add('od-tm-toolbar');
      }
    }

    var counters = readings ? [...readings.querySelectorAll('tbody > tr.od-tm-readings-row td:not(.od-tm-readings-direction)')] : [];
    var hide = function (node, hidden) {
      if (!node) return;
      node.style.setProperty('display', hidden ? 'none' : '', 'important');
    };
    var space = document.querySelector('.od-tm-graphspace');
    var sync = function () {
      var filled = counters.some(function (cell) { return text(cell).length > 0; });
      if (readings && emptyRow) {
        hide(emptyRow, filled);
        var rows = readings.querySelectorAll('tbody > tr.od-tm-readings-row');
        for (var s = 0; s < rows.length; s++) hide(rows[s], !filled);
      }
      if (emptyNote) hide(emptyNote, filled);
      if (graph) hide(graph, !filled);
      if (space) hide(space, filled);
      if (legend) {
        legend.classList.toggle('od-tm-legend-empty', !filled);
        /* The direction labels alone read as a broken sentence while the
           native counters are blank; the empty note owns that state. */
        hide(legend, !filled);
        var values = legend.querySelectorAll('.od-tm-legend-value');
        for (var v = 0; v < values.length; v++) hide(values[v], !filled);
        var heads = legend.querySelectorAll('.od-tm-legend-head');
        for (var h = 0; h < heads.length; h++) hide(heads[h], !filled);
      }
    };
    sync();
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () { sync(); });
      for (var t = 0; t < counters.length; t++) observer.observe(counters[t], { childList: true, characterData: true, subtree: true });
    }
  }

  /* Entry lists (MAC lists, static routes, port forwarding/triggering, QoS
     rules, limiter and parental editors) become labelled stacked forms on
     phones. Original controls, names, handlers and form membership stay; the
     header row is mirrored as a visible label above each control. Data-only
     tables without entry controls keep their scroller instead. */
  /* A native action row without colspan receives one column of a multi-column
     table, so its 100%-wide button stays one third of the phone card. Span the
     single action cell on phones and restore the native colspan on resize. */
  function spanActionCells() {
    var phone = window.matchMedia && window.matchMedia('(max-width:850px)').matches;
    var rows = document.querySelectorAll('tr.apply_gen');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.cells.length !== 1) continue;
      var cell = row.cells[0];
      var table = row.closest('table');
      var columns = 0;
      if (table) {
        for (var r = 0; r < table.rows.length; r++) {
          var count = 0;
          for (var c = 0; c < table.rows[r].cells.length; c++) {
            count += Math.max(1, table.rows[r].cells[c].colSpan || 1);
          }
          if (count > columns) columns = count;
        }
      }
      if (phone && columns > 1) {
        cell.colSpan = columns;
        cell.setAttribute('data-od-action-span', String(columns));
      } else if (cell.hasAttribute('data-od-action-span')) {
        cell.colSpan = 1;
        cell.removeAttribute('data-od-action-span');
      }
    }
  }

  /* Native client pickers put the field, an absolute 14px trigger and the
     menu div as siblings in one cell. Wrap all three so the menu can anchor to
     the field row and stay inside the card; keep the native handlers, ids and
     focus calls untouched. */
  function decoratePicker(row, arrow, list) {
    if (!list || list.hasAttribute('data-od-picker-bound')) return;
    list.setAttribute('data-od-picker-bound', '1');
    list.setAttribute('role', 'listbox');
    var sync = function () {
      var open = list.style.display === 'block';
      arrow.setAttribute('aria-expanded', open ? 'true' : 'false');
      row.classList.toggle('od-picker-open', open);
      var items = list.querySelectorAll('a > div');
      for (var n = 0; n < items.length; n++) {
        items[n].setAttribute('role', 'option');
        items[n].setAttribute('tabindex', '0');
      }
    };
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(list, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
    }
    list.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (list.style.display !== 'none') arrow.click();
        var field = row.querySelector('input[type="text"]');
        if (field) field.focus();
        return;
      }
      var item = event.target && event.target.closest ? event.target.closest('a > div') : null;
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        item.click();
      }
    });
    sync();
  }

  function decoratePickers() {
    var arrows = document.querySelectorAll('#pull_arrow');
    for (var i = 0; i < arrows.length; i++) {
      var arrow = arrows[i];
      if (arrow.closest('#NM_table, .QISmain')) continue;
      var input = arrow.previousElementSibling;
      if (!input || input.tagName !== 'INPUT' || input.type === 'hidden') continue;
      var host = arrow.parentElement;
      if (!host) continue;
      var list = host.querySelector(':scope > #ClientList_Block_PC, :scope > #WL_MAC_List_Block, :scope > .WL_MAC_Block');
      var row = arrow.closest('.od-picker-row');
      if (!row) {
        row = element('div', 'od-picker-row');
        host.insertBefore(row, input);
        row.appendChild(input);
        row.appendChild(arrow);
        if (list) row.appendChild(list);
      } else if (list && list.parentElement !== row) {
        row.appendChild(list);
      }
      if (!arrow.hasAttribute('tabindex')) arrow.setAttribute('tabindex', '0');
      arrow.setAttribute('role', 'button');
      arrow.setAttribute('aria-controls', list ? list.id : 'ClientList_Block_PC');
      decoratePicker(row, arrow, list);
    }
  }

  /* The native CPE history SVGs are 270x100 with percentage grid lines and
     fixed point coordinates. A viewBox keeps both in one coordinate system;
     compensate the label and stroke scale so the 10px R6 design token stays
     10px and lines stay hairline at every panel width. */
  function fitDeviceCharts() {
    var charts = document.querySelectorAll('div[style*="background-color:black"] svg');
    var bind = function (svg) {
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 270 100');
      var fit = function () {
        var width = svg.getBoundingClientRect().width;
        if (!width) return;
        svg.style.setProperty('--od-chart-label-size', (10 * 270 / width).toFixed(3) + 'px');
      };
      fit();
      if (window.ResizeObserver && !svg.hasAttribute('data-od-chart-fit')) {
        svg.setAttribute('data-od-chart-fit', '1');
        new ResizeObserver(fit).observe(svg);
      }
    };
    for (var i = 0; i < charts.length; i++) bind(charts[i]);
  }

  /* One native entry cell can pack a range into two text inputs (QoS
     transferred min/max). The handoff renders those as two labelled rows;
     split them so neither control is squeezed next to a wrapping unit. */
  function splitRangeField(row, cell, label) {
    if (cell.hasAttribute('data-od-range-split')) return;
    var field = cell.querySelector(':scope > .od-field');
    if (!field) return;
    var inputs = [].slice.call(field.querySelectorAll('input[type="text"], input[type="number"]'));
    if (inputs.length !== 2 || field.querySelector('select, textarea')) return;
    cell.setAttribute('data-od-range-split', '1');
    var secondCell = cell.cloneNode(false);
    secondCell.removeAttribute('data-od-range-split');
    var secondLabel = label.cloneNode(true);
    secondLabel.id = 'od-cell-label-' + (++labelSeq);
    var secondField = element('div', 'od-field');
    secondField.appendChild(inputs[1]);
    if (!inputs[1].hasAttribute('aria-label') && !inputs[1].hasAttribute('title') &&
        !(inputs[1].labels && inputs[1].labels.length)) inputs[1].setAttribute('aria-labelledby', secondLabel.id);
    secondCell.appendChild(secondLabel);
    secondCell.appendChild(secondField);
    row.insertBefore(secondCell, cell.nextSibling);
    var nodes = [].slice.call(field.childNodes);
    for (var n = 0; n < nodes.length; n++) if (nodes[n].nodeType === 3) field.removeChild(nodes[n]);
  }

  function decorateEditors() {
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.closest('#NM_table') || table.closest('.QISmain')) continue;
      if (table.classList.contains('FormTable') || table.classList.contains('od-editor')) continue;
      if (table.classList.contains('od-qos-upload') || table.classList.contains('od-qos-download')) continue;
      var inputs = table.querySelectorAll('tbody input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), tbody select, tbody textarea');
      if (!inputs.length) continue;
      var rows = table.tBodies.length ? table.tBodies[0].rows : [];
      var headRow = null;
      var headIndex = -1;
      var candidates = table.tHead ? [].slice.call(table.tHead.rows) : [];
      candidates = candidates.concat([].slice.call(rows));
      for (var hi = 0; hi < candidates.length; hi++) {
        var cand = candidates[hi];
        if (cand.cells.length >= 2 && !cand.querySelector('input, select, textarea')) {
          headRow = cand;
          if (cand.parentNode && cand.parentNode.tagName === 'TBODY') headIndex = [].indexOf.call(rows, cand);
          break;
        }
      }
      if (!headRow) continue;
      /* Two-cell title/logo rows are page furniture, not entry columns. */
      if (headRow.cells.length < 3 && !headRow.querySelector('th')) continue;
      var headers = [];
      var anyHeader = false;
      for (var h = 0; h < headRow.cells.length; h++) {
        headers.push(text(headRow.cells[h]));
        if (headers[h]) anyHeader = true;
      }
      if (!anyHeader) continue;
      table.classList.add('od-editor');
      headRow.classList.add('od-editor-head');
      var dataRows = [];
      for (var dr = 0; dr < rows.length; dr++) {
        if (dr !== headIndex) dataRows.push(rows[dr]);
      }
      var add = table.querySelector('input.add_btn, input.service_btn, input.url_btn');
      /* A single entry row plus an Add button is the common native list form.
         Those pages put their saved entries in a separate table, so the row is
         a form, not a matrix: render it as a field card with a left caption
         (above the control on phones) and a compact labelled Add action. */
      var formMode = !!(add && dataRows.length === 1);
      var actionCell = add ? (add.closest('td') || add.closest('th')) : null;
      if (formMode) table.classList.add('od-editor-form');
      for (var r = 0; r < rows.length; r++) {
        if (r === headIndex) continue;
        var row = rows[r];
        var rowCells = [].slice.call(row.cells);
        for (var c = 0; c < rowCells.length && c < headers.length; c++) {
          var cell = rowCells[c];
          var isAction = formMode && cell === actionCell;
          if (!headers[c] && !isAction) continue;
          var hasField = cell.querySelector('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea');
          if (!hasField && !isAction) continue;
          var label = cell.querySelector('.od-cell-label');
          if (!label) {
            label = element('span', 'od-cell-label', headers[c] || 'Add / Delete');
            label.id = 'od-cell-label-' + (++labelSeq);
            cell.insertBefore(label, cell.firstChild);
          }
          if (hasField) {
            /* A visible caption is not an accessible name by itself. Link every
               unnamed entry control in this column to the caption; explicit
               native labels, ARIA names and titles keep precedence. */
            var fields = cell.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea');
            for (var cf = 0; cf < fields.length; cf++) {
              var field = fields[cf];
              if (field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby') ||
                  field.hasAttribute('title') || (field.labels && field.labels.length)) continue;
              field.setAttribute('aria-labelledby', label.id);
            }
          }
          if (formMode && !cell.querySelector(':scope > .od-field')) {
            var wrapper = element('div', 'od-field');
            var nodes = [].slice.call(cell.childNodes);
            for (var cn = 0; cn < nodes.length; cn++) {
              if (nodes[cn] !== label) wrapper.appendChild(nodes[cn]);
            }
            cell.appendChild(wrapper);
            if (hasField) splitRangeField(row, cell, label);
          }
        }
      }
      if (add && !add.hasAttribute('data-od-label-set')) {
        add.setAttribute('data-od-label-set', '1');
        if (!add.value) add.value = 'Add';
      }
    }
    spanActionCells();
  }

  /* DSL log tables carry page-local 12px Arial styles and blue-grey cells.
     U23-13: lift each native title row into a heading above its card, publish
     the native column labels onto the body cells (phones render one card per
     row), and tag visible rows so the drawn inset separators can be painted.
     Wide matrices get a bounded scroller; ordinary label/value rows stack on
     phones. Native values, units, timers and the Refresh action are untouched. */
  function decorateStatusLog() {
    var logs = document.querySelectorAll('table.FormTable_log');
    if (!logs.length) return;
    document.body.classList.add('od-status-log');
    for (var i = 0; i < logs.length; i++) {
      var table = logs[i];
      if (table.getAttribute('data-od-status') === 'ready') continue;
      table.setAttribute('data-od-status', 'ready');
      var rows = table.rows, r, c, maxCells = 0;
      for (r = 0; r < rows.length; r++) maxCells = Math.max(maxCells, rows[r].cells.length);
      if (maxCells >= 3) {
        table.classList.add('od-status-matrix');
        if (maxCells > 5) table.classList.add('od-status-matrix-wide');
      } else {
        table.classList.add('od-status-info');
      }
      var prevBefore = table.previousElementSibling;

      // The native title cell becomes the card heading.
      var title = '', titleRow = null;
      for (r = 0; r < Math.min(rows.length, 2); r++) {
        var row = rows[r];
        if (row.cells.length !== 1) continue;
        var cell = row.cells[0];
        var text = String(cell.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && (cell.colSpan || 1) >= 2) { title = text; titleRow = row; break; }
      }
      if (titleRow) titleRow.classList.add('od-status-title-row');

      // Matrix column labels, copied onto every body cell for phone cards.
      var headRow = null;
      if (maxCells >= 3) {
        for (r = 0; r < rows.length; r++) {
          var candidate = rows[r];
          if (candidate === titleRow || candidate.cells.length < 2) continue;
          if (candidate.cells[0].tagName === 'TD') { headRow = candidate; break; }
        }
        if (headRow) {
          headRow.classList.add('od-status-head');
          var labels = [];
          for (c = 0; c < headRow.cells.length; c++) labels.push(String(headRow.cells[c].textContent || '').replace(/\s+/g, ' ').trim());
          for (r = 0; r < rows.length; r++) {
            var bodyRow = rows[r];
            if (bodyRow === titleRow || bodyRow === headRow) continue;
            for (c = 1; c < bodyRow.cells.length; c++) {
              if (labels[c]) bodyRow.cells[c].setAttribute('data-od-label', labels[c]);
            }
            if (bodyRow.cells[0]) bodyRow.cells[0].classList.add('od-metric');
          }
        }
      }

      // Visible rows: first/last/separator bookkeeping for the drawn rules.
      var visible = [];
      for (r = 0; r < rows.length; r++) if (getComputedStyle(rows[r]).display !== 'none') visible.push(rows[r]);
      for (r = 0; r < visible.length; r++) {
        visible[r].classList.add('od-status-row');
        if (r > 0) visible[r].classList.add('od-status-sep');
        if (r === visible.length - 1) visible[r].classList.add('od-status-last');
      }

      if (maxCells >= 3 && !table.closest('.od-scroll')) {
        var wrapper = document.createElement('div');
        wrapper.className = 'od-scroll';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
      if (title) {
        var heading = document.createElement('div');
        heading.className = 'od-status-heading';
        if (maxCells >= 3) heading.classList.add('od-status-heading-matrix');
        heading.setAttribute('role', 'heading');
        heading.setAttribute('aria-level', '2');
        heading.textContent = title;
        var anchor = table.closest('.od-scroll') || table;
        anchor.parentNode.insertBefore(heading, anchor);
      }
      if (i === 0 && prevBefore && /(^|\s)formfontdesc(\s|$)/.test(String(prevBefore.className || ''))) {
        prevBefore.classList.add('od-status-desc');
      }
    }
  }

  /* The native System Log action row is pulled 10px up into the iframe. Give
     the buttons their own row with a positive gap; handlers and form
     ownership stay untouched. */
  function separateLogActions() {
    var frame = document.querySelector('iframe[src*="status_log2.cgi"]');
    if (!frame || !frame.parentNode) return;
    var frameBox = frame.parentNode;
    frameBox.classList.add('od-log-frame');
    var actions = frameBox.nextElementSibling;
    if (actions && actions.querySelector('table.apply_gen')) actions.classList.add('od-log-actions');
  }

  /* DSL status keeps two native FormTable_log tables: line/identity rows and
     the downstream/upstream statistics matrix. The approved composition puts
     a "Line connection" summary beside "DSL information", with the matrix as
     a full-width card below. Native value nodes and table rows are moved, not
     copied, so the page's ajax poller keeps writing to the same ids. */
  function decorateAdslStatus() {
    if (location.pathname.indexOf('/Main_AdslStatus_Content.asp') < 0) return;
    var refreshList = [];
    var statsRow = document.getElementById('line_stats');
    var statsTable = statsRow ? statsRow.querySelector('table.FormTable_log') : null;
    var infoTable = document.querySelector('table.FormTable_log.od-status-info');
    if (!statsTable || !infoTable || infoTable.getAttribute('data-od-adsl') === 'ready') return;
    infoTable.setAttribute('data-od-adsl', 'ready');
    document.body.classList.add('od-adsl-status');

    var scroll = statsTable.closest('.od-scroll');
    var infoHeading = infoTable.previousElementSibling;
    if (infoHeading && infoHeading.className.indexOf('od-status-heading') < 0) infoHeading = null;
    var statsHeading = scroll && scroll.previousElementSibling;
    if (statsHeading && statsHeading.className.indexOf('od-status-heading') < 0) statsHeading = null;
    var infoHost = infoTable.parentNode;
    var statsHost = (scroll || statsTable).parentNode;

    var raw = function (node) {
      return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
    };
    var pair = function (down, up) {
      var a = raw(down), b = raw(up);
      if (!a || !b) return a || b || 'Unavailable';
      var ma = a.match(/^(-?[\d.]+)\s*([A-Za-z%]+)$/);
      var mb = b.match(/^(-?[\d.]+)\s*([A-Za-z%]+)$/);
      if (ma && mb && ma[2].toLowerCase() === mb[2].toLowerCase()) return ma[1] + ' / ' + mb[1] + ' ' + mb[2];
      return a + ' / ' + b;
    };
    var mbps = function (node) {
      var value = raw(node);
      var match = value.match(/^([\d.]+)\s*kbps$/i);
      return match ? (parseFloat(match[1]) / 1000).toFixed(1) + ' Mbps' : (value || 'Unavailable');
    };

    var layout = element('div', 'od-adsl-layout');
    var summary = element('section', 'od-adsl-panel od-adsl-connection');
    summary.appendChild(element('h2', 'od-adsl-panel-title', 'Line connection'));
    var list = element('dl', 'od-adsl-readouts');
    summary.appendChild(list);

    var row = function (label, nodes, render) {
      var line = element('div', 'od-adsl-readout');
      line.appendChild(element('dt', '', label));
      var value = document.createElement('dd');
      var empty = element('span', 'od-adsl-empty', 'Unavailable');
      for (var n = 0; n < nodes.length; n++) {
        if (!nodes[n]) continue;
        value.appendChild(nodes[n]);
      }
      value.appendChild(empty);
      line.appendChild(value);
      list.appendChild(line);
      return function () {
        var out = render ? render() : raw(nodes[0]);
        var mirror = value.querySelector('.od-adsl-mirror');
        if (render) {
          if (!mirror) {
            mirror = element('span', 'od-adsl-mirror', '');
            value.insertBefore(mirror, empty);
          }
          /* The observer watches this list; rewriting the same text would
             retrigger refresh forever. */
          if (mirror.textContent !== out) mirror.textContent = out;
        }
        empty.hidden = !!out && out !== 'Unavailable';
        return out;
      };
    };

    /* The summary values are the native nodes themselves, so the rows they
       came from must be remembered before the nodes move out of the table. */
    var nativeRows = [];
    var keepRow = function (node) {
      var tr = node ? node.closest('tr') : null;
      if (tr && nativeRows.indexOf(tr) < 0) nativeRows.push(tr);
    };
    var lineState = document.getElementById('div_lineState');
    var opmode = document.getElementById('div_Opmode');
    var adslType = document.getElementById('div_AdslType');
    keepRow(lineState);
    keepRow(opmode);
    keepRow(adslType);

    var stateBadge = element('span', 'od-adsl-state');
    if (lineState) {
      lineState.hidden = true;
      stateBadge.appendChild(lineState);
      var stateEmpty = element('span', 'od-adsl-empty', 'Unavailable');
      stateBadge.appendChild(stateEmpty);
      var stateSync = function () {
        var value = raw(lineState);
        var state = /^(up|connected|online)$/i.test(value) ? 'Connected'
          : /^(down|disconnected|offline)$/i.test(value) ? 'Disconnected'
          : /^idle$/i.test(value) ? 'Standby' : value;
        var label = state || 'Unavailable';
        if (stateEmpty.textContent !== label) stateEmpty.textContent = label;
        stateBadge.classList.toggle('is-ok', state === 'Connected');
        stateBadge.classList.toggle('is-bad', state === 'Disconnected');
      };
      var stateRow = element('div', 'od-adsl-readout');
      stateRow.appendChild(element('dt', '', 'Line state'));
      var stateValue = document.createElement('dd');
      stateValue.appendChild(stateBadge);
      stateRow.appendChild(stateValue);
      list.appendChild(stateRow);
      refreshList.push(stateSync);
    }

    refreshList.push(row('Modulation', [opmode]));
    refreshList.push(row('Annex', [adslType]));
    refreshList.push(row('Downstream', [], function () {
      return mbps(document.getElementById('div_DataRateDown'));
    }));
    refreshList.push(row('Upstream', [], function () {
      return mbps(document.getElementById('div_DataRateUp'));
    }));
    refreshList.push(row('SNR \u00b7 down / up', [], function () {
      return pair(document.getElementById('div_SNRMarginDown'), document.getElementById('div_SNRMarginUp'));
    }));
    refreshList.push(row('Attenuation \u00b7 down / up', [], function () {
      return pair(document.getElementById('div_AttenDown'), document.getElementById('div_AttenUp'));
    }));
    refreshList.push(row('CRC \u00b7 down / up', [], function () {
      return pair(document.getElementById('div_CRCDown'), document.getElementById('div_CRCUp'));
    }));

    /* The three values now live in the summary. Their native rows are hidden
       rather than removed: the poller still looks up th_AdslType by id. */
    for (var m = 0; m < nativeRows.length; m++) {
      nativeRows[m].hidden = true;
    }

    var info = element('section', 'od-adsl-panel od-adsl-info');
    var infoTitle = document.createElement('h2');
    infoTitle.className = 'od-adsl-panel-title';
    infoTitle.textContent = infoHeading ? raw(infoHeading) : 'DSL information';
    if (!infoTitle.textContent) infoTitle.textContent = 'DSL information';
    info.appendChild(infoTitle);

    layout.appendChild(summary);
    layout.appendChild(info);
    infoHost.insertBefore(layout, infoHeading || infoTable);
    if (infoHeading && infoHeading.parentNode) infoHeading.parentNode.removeChild(infoHeading);
    info.appendChild(infoTable);

    var stats = element('section', 'od-adsl-panel od-adsl-stats');
    var statsTitle = document.createElement('h2');
    statsTitle.className = 'od-adsl-panel-title';
    statsTitle.textContent = 'Line statistics';
    stats.appendChild(statsTitle);
    var headCell = statsTable.querySelector('thead tr td:first-child');
    if (headCell && !raw(headCell)) headCell.textContent = 'Reading';
    statsHost.insertBefore(stats, scroll || statsTable);
    if (statsHeading && statsHeading.parentNode) statsHeading.parentNode.removeChild(statsHeading);
    stats.appendChild(scroll || statsTable);

    var refresh = function () {
      for (var r = 0; r < refreshList.length; r++) refreshList[r]();
    };
    refresh();
    if (window.MutationObserver) {
      var watch = function (node) {
        if (node) new MutationObserver(refresh).observe(node, { childList: true, subtree: true, characterData: true });
      };
      watch(list);
      watch(infoTable);
      watch(statsTable);
    }
  }

  /* R6 device panels: the six embedded routes share one content column, a
     "Network details" page head and card readouts. Native nodes are moved or
     mirrored, never re-created, so ASP targets, handlers and pollers keep
     ownership of every value. */
  var DEVICE_TITLES = {
    '/device-map/clients.asp': 'Connected devices',
    '/device-map/internet.asp': 'Internet status',
    '/device-map/DSL_dashboard.asp': 'DSL line',
    '/device-map/router.asp': 'Wireless settings',
    '/device-map/router_status.asp': 'System status',
    '/device-map/remote.asp': 'Remote access point'
  };

  function deviceSvg(shapes, className) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', className || 'icon');
    for (var i = 0; i < shapes.length; i++) {
      var node = document.createElementNS(ns, shapes[i][0]);
      var attrs = shapes[i][1];
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
      }
      svg.appendChild(node);
    }
    return svg;
  }

  function devicePanelHead(title) {
    var head = document.querySelector('.od-device-head');
    if (head || !title) return head;
    head = element('header', 'od-device-head');
    head.appendChild(element('span', 'od-eyebrow', 'Network details'));
    var heading = document.createElement('h1');
    heading.className = 'od-device-title';
    heading.textContent = title;
    head.appendChild(heading);
    document.body.insertBefore(head, document.body.firstChild);
    return head;
  }

  /* One-card readouts for the embedded tables: the native label and value
     nodes stay where the pollers can find them; only their container and
     alignment change. Rows that own a control are left to the route adapter. */
  function readoutProbe(host, fallback) {
    var out = '';
    for (var i = 0; i < host.childNodes.length; i++) {
      var node = host.childNodes[i];
      if (node === fallback) continue;
      if (node.nodeType === 3) { out += node.textContent; continue; }
      if (node.nodeType !== 1) continue;
      if (/^(IMG|BR|SCRIPT|STYLE)$/.test(node.tagName)) continue;
      if (getComputedStyle(node).display === 'none') continue;
      out += node.textContent;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  function watchReadout(host, fallback) {
    var sync = function () { fallback.hidden = !!readoutProbe(host, fallback); };
    sync();
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(host, {
        childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style']
      });
    }
  }

  function decorateReadoutTable(table, title) {
    if (!table || table.getAttribute('data-od-readout') === 'ready') return;
    table.setAttribute('data-od-readout', 'ready');
    table.classList.add('od-readout-card');
    var body = table.tBodies[0] || table;
    var rows = [];
    for (var r = 0; r < body.rows.length; r++) rows.push(body.rows[r]);
    var headRow = document.createElement('tr');
    headRow.className = 'od-card-head';
    var headCell = document.createElement('th');
    headCell.colSpan = 2;
    headCell.textContent = title;
    headRow.appendChild(headCell);
    body.insertBefore(headRow, body.firstChild);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.cells || !row.cells.length) continue;
      var label = row.querySelector('.formfonttitle_nwm');
      if (!label && row.cells.length === 2 && row.cells[0].tagName === 'TH') label = row.cells[0];
      if (!label) continue;
      if (row.querySelector('input:not([type="hidden"]), select, textarea, button, [id^="radio_"], .iphone_switch')) continue;
      row.classList.add('od-readout-row');
      var host;
      if (row.cells.length === 2 && row.cells[0].tagName === 'TH') {
        row.cells[0].classList.add('od-readout-label');
        row.cells[1].classList.add('od-readout-value');
        row.cells[0].style.removeProperty('width');
        host = row.cells[1];
      } else {
        var cell = row.cells[0];
        cell.classList.add('od-readout-cell');
        label.classList.add('od-readout-label');
        host = element('span', 'od-readout-value');
        var node = label.nextSibling;
        while (node) {
          var next = node.nextSibling;
          if (node.nodeType === 3 && node.textContent.replace(/\s+/g, '')) host.appendChild(node);
          else if (node.nodeType === 1 && !/^(IMG|BR|SCRIPT)$/.test(node.tagName)) host.appendChild(node);
          else if (node.nodeType === 1) node.parentNode.removeChild(node);
          node = next;
        }
        cell.appendChild(host);
      }
      var empty = element('span', 'od-panel-empty', 'Unavailable');
      host.appendChild(empty);
      watchReadout(host, empty);
    }
  }

  /* Native actions that live in their own table row move below the card.
     Their row keeps the native display toggles, so an action the firmware
     hides is removed from the bar as well. */
  function placeDeviceAction(action, row, label) {
    var slot = element('span', 'od-device-action-slot');
    if (label) action.setAttribute('aria-label', label);
    slot.appendChild(action);
    if (row) {
      row.classList.add('od-action-source');
      var sync = function () { slot.hidden = row.style.display === 'none'; };
      sync();
      if (window.MutationObserver) {
        new MutationObserver(sync).observe(row, { attributes: true, attributeFilter: ['style'] });
      }
    }
    return slot;
  }

  function deviceActionBar(anchor) {
    var bar = document.querySelector('.od-device-actions');
    if (bar) return bar;
    bar = element('div', 'od-device-actions');
    bar.hidden = true;
    anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    return bar;
  }

  function decorateInternetPanel() {
    var rt = document.getElementById('rt_table');
    var ap = document.getElementById('ap_table');
    if (!rt) return;
    decorateReadoutTable(rt, 'Internet connection');
    if (ap) decorateReadoutTable(ap, 'Access point');
    var anchor = ap && ap.parentNode ? ap : rt;
    var bar = deviceActionBar(anchor);
    var ids = ['goDualWANSetting', 'goSetting'];
    for (var i = 0; i < ids.length; i++) {
      var row = document.getElementById(ids[i]);
      if (!row || getComputedStyle(row).display === 'none') continue;
      var button = row.querySelector('input[type="button"]');
      if (!button) continue;
      var label = row.querySelector('.formfonttitle_nwm');
      button.classList.add('od-device-action');
      bar.appendChild(placeDeviceAction(button, row, text(label)));
    }
    bar.hidden = !bar.children.length;
  }

  function decorateRemotePanel() {
    var table = document.querySelector('table.table1px');
    if (!table) return;
    decorateReadoutTable(table, 'Remote access point');
    var go = table.querySelector('input.sbtn');
    if (!go) return;
    var row = go.closest('tr');
    var label = row ? row.querySelector('th') : null;
    go.classList.add('od-device-action');
    var bar = deviceActionBar(table);
    bar.appendChild(placeDeviceAction(go, row, text(label)));
    bar.hidden = false;
  }

  function decorateRouterPanel() {
    var card = document.querySelector('.od-inspector-card');
    if (!card || card.querySelector('.od-inspector-card-head')) return;
    var label = function (selector, caption) {
      var node = document.querySelector(selector);
      var cell = node && node.closest('td');
      var captionNode = cell && cell.querySelector('.formfonttitle_nwm');
      if (captionNode) captionNode.textContent = caption;
    };
    label('[name="wl_auth_mode_x"]', 'Security');
    label('[name="wl_wpa_gtk_rekey"]', 'Key rotation interval');
    label('p#LANIP', 'LAN IP');
    label('p#PINCode', 'PIN code');
    label('p#MAC', 'LAN MAC address');
    label('p#BandMAC', 'Wireless MAC address');
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'od-inspector-card-head';
    head.setAttribute('aria-expanded', 'true');
    head.setAttribute('aria-controls', 'od-router-general');
    var title = document.createElement('h2');
    title.className = 'od-inspector-card-title';
    title.textContent = 'General';
    head.appendChild(title);
    head.appendChild(deviceSvg([['path', { d: 'm9 5 7 7-7 7' }]], 'icon od-inspector-card-chevron'));
    card.id = 'od-router-general';
    card.insertBefore(head, card.firstChild);
    head.addEventListener('click', function () {
      var open = head.getAttribute('aria-expanded') !== 'false';
      head.setAttribute('aria-expanded', String(!open));
      card.classList.toggle('is-collapsed', open);
    });
    var info = document.getElementById('LANIP');
    var infoTable = info ? info.closest('table.table1px') : null;
    if (infoTable) decorateReadoutTable(infoTable, 'Information');
  }

  function decorateDslDashboard() {
    var source = document.getElementById('DSL_dashboard');
    if (!source || document.querySelector('.od-dsl-card')) return;
    var card = element('section', 'od-dsl-card');
    card.appendChild(element('h2', 'od-dsl-card-title', 'DSL connection'));
    var list = element('dl', 'od-dsl-readouts');
    card.appendChild(list);
    var syncs = [];
    var addRow = function (label, read) {
      var row = element('div', 'od-dsl-readout');
      row.appendChild(element('dt', '', label));
      var value = document.createElement('dd');
      value.appendChild(element('span', 'od-dsl-value', ''));
      var empty = element('span', 'od-panel-empty', 'Unavailable');
      value.appendChild(empty);
      row.appendChild(value);
      list.appendChild(row);
      var mirror = value.querySelector('.od-dsl-value');
      syncs.push(function () {
        var out = read() || '';
        if (mirror.textContent !== out) mirror.textContent = out;
        empty.hidden = !!out;
      });
    };
    var raw = function (id) {
      var node = document.getElementById(id);
      return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
    };
    var rate = function (id) {
      var value = raw(id);
      var match = value.match(/^([\d.]+)\s*kbps$/i);
      return match ? (parseFloat(match[1]) / 1000).toFixed(1) + ' Mbps' : value;
    };
    var icon = document.getElementById('connection_icon');
    var state = document.getElementById('div_AdslState');
    var badge = element('span', 'od-dsl-state');
    var badgeText = element('span', '', 'Unavailable');
    badge.appendChild(badgeText);
    var stateRow = element('div', 'od-dsl-readout');
    stateRow.appendChild(element('dt', '', 'Line state'));
    var stateValue = document.createElement('dd');
    stateValue.appendChild(badge);
    stateRow.appendChild(stateValue);
    list.appendChild(stateRow);
    syncs.push(function () {
      var cls = icon ? String(icon.className) : '';
      var label = /connected_logo/.test(cls) ? 'Connected'
        : /disconnect_logo/.test(cls) ? 'Disconnected'
        : /connecting_logo/.test(cls) ? 'Connecting' : '';
      if (!label) label = raw('div_AdslState') || 'Unavailable';
      if (badgeText.textContent !== label) badgeText.textContent = label;
      badge.classList.toggle('is-ok', label === 'Connected');
      badge.classList.toggle('is-bad', label === 'Disconnected');
    });
    addRow('Modulation', function () { return raw('div_Opmode'); });
    addRow('Annex', function () { return raw('div_AdslType'); });
    addRow('Downstream', function () { return rate('div_DataRateDown'); });
    addRow('Upstream', function () { return rate('div_DataRateUp'); });
    addRow('DSL uptime', function () { return raw('div_Uptime'); });
    addRow('Exchange', function () { return raw('vendor_id'); });
    addRow('DSL firmware', function () { return raw('dsl_ver_info'); });

    source.classList.add('od-dsl-source');
    var head = devicePanelHead(DEVICE_TITLES['/device-map/DSL_dashboard.asp']);
    var mount = head ? head.nextSibling : document.body.firstChild;
    document.body.insertBefore(card, mount);

    var sync = function () { for (var i = 0; i < syncs.length; i++) syncs[i](); };
    sync();
    if (window.MutationObserver) {
      var watch = function (id) {
        var node = document.getElementById(id);
        if (node) new MutationObserver(sync).observe(node, { childList: true, subtree: true, characterData: true });
      };
      watch('div_Opmode');
      watch('div_AdslType');
      watch('div_DataRateDown');
      watch('div_DataRateUp');
      watch('div_Uptime');
      watch('vendor_id');
      watch('dsl_ver_info');
      watch('div_AdslState');
      if (icon) new MutationObserver(sync).observe(icon, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* Connected devices: drawClientList() rebuilds #client_list_Block on every
     scan, so this adapter runs again whenever a new native table appears.
     Generated nodes with handlers (IP link and method, MAC lookup, signal
     icon) are moved into the entry, never copied as text; the native table
     itself stays in the document, hidden, for the native finders. */
  function decorateDeviceClients() {
    var block = document.getElementById('client_list_Block');
    var search = document.getElementById('searchingBar');
    var refresh = document.getElementById('refresh_list');
    var online = document.getElementById('tabOnline');
    if (!block || !search || !refresh || !online) return;
    if (document.querySelector('.od-clients-panel')) return;

    var panel = element('section', 'od-clients-panel');
    var left = document.getElementById('leftBtn');
    var right = document.getElementById('rightBtn');
    var loading = document.getElementById('loadingIcon');

    var toolbar = element('div', 'od-clients-toolbar');
    var searchBox = element('label', 'od-clients-search');
    searchBox.appendChild(deviceSvg([
      ['circle', { cx: '10', cy: '10', r: '7' }],
      ['path', { d: 'm15 15 6 6' }]
    ], 'icon od-clients-search-icon'));
    searchBox.appendChild(element('span', 'od-clients-hidden-label', 'Search devices by name'));
    search.setAttribute('aria-label', 'Search devices by name');
    search.setAttribute('autocomplete', 'off');
    search.setAttribute('autocapitalize', 'off');
    search.parentNode.removeChild(search);
    searchBox.appendChild(search);
    toolbar.appendChild(searchBox);

    var refreshBox = element('label', 'od-clients-refresh');
    refreshBox.appendChild(deviceSvg([['path', { d: 'M20 10a8 8 0 1 0-1 8M20 3v7h-7' }]], 'icon'));
    refresh.classList.add('od-clients-refresh-input');
    refresh.parentNode.removeChild(refresh);
    refreshBox.appendChild(refresh);
    toolbar.appendChild(refreshBox);
    if (loading) {
      loading.classList.add('od-clients-loading');
      loading.setAttribute('alt', 'Scanning for devices');
      loading.parentNode.removeChild(loading);
      toolbar.appendChild(loading);
    }
    panel.appendChild(toolbar);

    var tabs = element('div', 'od-clients-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Device filter');
    var tabIds = ['tabOnline', 'tabWired', 'tabWireless', 'tabCustom'];
    var tabList = [];
    for (var t = 0; t < tabIds.length; t++) {
      var tab = document.getElementById(tabIds[t]);
      if (!tab) continue;
      tab.parentNode.removeChild(tab);
      tab.classList.add('od-clients-tab');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', tab.classList.contains('tabclick_NW') ? 'true' : 'false');
      var count = tab.querySelector('b');
      var holder = element('span', 'od-clients-count');
      if (count) {
        /* The native caption is "Wired (<b>3</b>)"; keep the count node but
           turn it into the drawn pill instead of the parenthesis text. */
        if (count.previousSibling && count.previousSibling.nodeType === 3) {
          count.previousSibling.textContent = count.previousSibling.textContent.replace(/\(\s*$/, '');
        }
        if (count.nextSibling && count.nextSibling.nodeType === 3) {
          count.nextSibling.textContent = count.nextSibling.textContent.replace(/^\s*\)/, '');
        }
        count.style.removeProperty('font-size');
        count.classList.add('od-clients-count-value');
        count.parentNode.removeChild(count);
        holder.appendChild(count);
      } else {
        holder.setAttribute('data-od-count', 'online');
        holder.appendChild(element('span', 'od-clients-count-value', '0'));
      }
      tab.appendChild(holder);
      tabs.appendChild(tab);
      tabList.push(tab);
    }
    panel.appendChild(tabs);

    var status = element('p', 'od-clients-status', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.appendChild(status);

    var source = block;
    while (source && source.parentNode !== document.body) source = source.parentNode;
    block.classList.add('od-clients-list');
    panel.appendChild(block);
    if (source && source !== panel) source.classList.add('od-clients-source');
    var strayBreak = document.querySelector('body > br');
    if (strayBreak) strayBreak.style.display = 'none';

    var pager = element('div', 'od-clients-pagination');
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'od-page-button';
    prev.textContent = 'Previous';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'od-page-button';
    next.textContent = 'Next';
    var range = element('span', 'od-clients-range', '');
    pager.appendChild(prev);
    pager.appendChild(range);
    pager.appendChild(next);
    if (left) {
      left.classList.add('od-page-native');
      pager.appendChild(left);
    }
    if (right) {
      right.classList.add('od-page-native');
      pager.appendChild(right);
    }
    panel.appendChild(pager);

    var head = devicePanelHead(DEVICE_TITLES['/device-map/clients.asp']);
    var mount = head ? head.nextSibling : document.body.firstChild;
    document.body.insertBefore(panel, mount);

    var openMap = {};
    var clientData = function (mac) {
      var list = window.clientList;
      if (!list || !mac) return null;
      var key = String(mac).toUpperCase();
      if (list[key] && typeof list[key] === 'object') return list[key];
      for (var k in list) {
        if (!Object.prototype.hasOwnProperty.call(list, k)) continue;
        var item = list[k];
        if (item && typeof item === 'object' && String(item.MacAddr || '').toUpperCase() === key) return item;
      }
      return null;
    };
    var currentTab = function () {
      var pv = window.pagesVar;
      if (pv && pv.curTab) return String(pv.curTab);
      for (var i = 0; i < tabList.length; i++) {
        if (tabList[i].classList.contains('tabclick_NW')) return tabIds[i].replace('tab', '').toLowerCase();
      }
      return 'online';
    };
    /* Mirrors the visibility test in drawClientList so the count and range
       labels describe the same rows the native renderer selected. */
    var belongs = function (client, tab, query) {
      var name = String(client.Name === undefined || client.Name === null ? '' : client.Name).toLowerCase();
      if (name.indexOf(query) < 0) return false;
      var live = !!client.isOnline;
      if (tab === 'online' && !live) return false;
      if (tab === 'wired' && (client.isWL != 0 || !live)) return false;
      if (tab === 'wireless' && (client.isWL == 0 || !live)) return false;
      if (tab === 'wireless0' && (client.isWL == 0 || client.isWL == 2 || client.isWL == 3 || !live)) return false;
      if (tab === 'wireless1' && (client.isWL == 0 || client.isWL == 1 || client.isWL == 3 || !live)) return false;
      if (tab === 'wireless2' && (client.isWL == 0 || client.isWL == 1 || client.isWL == 2 || !live)) return false;
      if (tab === 'custom' && client.from !== 'customList') return false;
      return true;
    };
    var matchCount = function (tab, query) {
      var list = window.clientList;
      if (!list) return null;
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        var client = list[list[i]];
        if (client && typeof client === 'object' && belongs(client, tab, query)) n++;
      }
      return n;
    };
    var syncTabs = function () {
      var active = null;
      for (var i = 0; i < tabList.length; i++) {
        /* drawClientList() assigns className directly, which drops the class
           added here; restore it so styling and focus order stay intact.
           Guard the write: the class observer would otherwise re-enter. */
        if (!tabList[i].classList.contains('od-clients-tab')) {
          tabList[i].classList.add('od-clients-tab');
        }
        var on = tabList[i].classList.contains('tabclick_NW');
        tabList[i].setAttribute('aria-selected', on ? 'true' : 'false');
        tabList[i].setAttribute('tabindex', on ? '0' : '-1');
        if (on) active = tabList[i];
      }
      if (!active) {
        for (var v = 0; v < tabList.length; v++) {
          if (getComputedStyle(tabList[v]).display !== 'none') {
            tabList[v].setAttribute('tabindex', '0');
            break;
          }
        }
      }
    };
    var updateMeta = function () {
      /* The native renderer rewrites the placeholder caption on every draw;
         keep the drawn wording without touching its search handler. */
      search.placeholder = 'Search devices by name\u2026';
      var query = String(search.value || '').toLowerCase();
      var tab = currentTab();
      var total = matchCount(tab, query);
      var shown = block.querySelectorAll('.od-client-entry').length;
      var onlineCount = tabs.querySelector('[data-od-count="online"] .od-clients-count-value');
      if (onlineCount) {
        var onlineTotal = window.totalClientNum ? window.totalClientNum.online : null;
        var usable = onlineTotal !== null && onlineTotal !== undefined && isFinite(onlineTotal);
        onlineCount.textContent = usable ? String(onlineTotal) : '';
        onlineCount.parentNode.hidden = !usable;
      }
      if (total !== null) {
        var noun = total === 1 ? ' device' : ' devices';
        status.textContent = total + noun + (query ? ' matching your search' : '');
        var pv = window.pagesVar;
        var page = pv && pv.startArray && pv.startArray.length ? pv.startArray.length : 1;
        var pages = Math.max(1, Math.ceil(total / 7));
        if (page > pages) page = pages;
        var start = total ? (page - 1) * 7 + 1 : 0;
        var end = Math.min(page * 7, total);
        range.textContent = total ? start + '\u2013' + end + ' of ' + total : '0 devices';
        range.hidden = false;
      } else {
        status.textContent = shown ? shown + (shown === 1 ? ' device' : ' devices') : 'No device data available';
        range.textContent = shown ? '1\u2013' + shown : '';
        range.hidden = !shown;
      }
    };
    var buildEntry = function (bg) {
      /* A web-server client wraps its IP in `a.link`; the MAC row is the
         `div.link`, so resolve the MAC by node type rather than order. */
      var macNode = bg.querySelector('div.link');
      var mac = text(macNode);
      var data = clientData(mac);
      var entry = document.createElement('details');
      entry.className = 'od-client-entry';
      if (openMap[mac]) entry.open = true;
      entry.addEventListener('toggle', function () { openMap[mac] = entry.open; });
      var summary = document.createElement('summary');
      summary.className = 'od-client-summary';

      var icon = element('span', 'od-client-cell od-client-icon');
      icon.appendChild(deviceSvg(data && data.isWL ? [
        ['path', { d: 'M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0' }],
        ['circle', { cx: '12', cy: '20', r: '.7', fill: 'currentColor', stroke: 'none' }]
      ] : [
        ['rect', { x: '3', y: '4', width: '18', height: '12', rx: '2' }],
        ['path', { d: 'M8 20h8M12 16v4' }]
      ], 'icon'));
      summary.appendChild(icon);

      var name = element('span', 'od-client-cell od-client-name');
      name.appendChild(element('small', 'od-client-label', 'Device'));
      name.appendChild(element('span', 'od-client-name-value', data && data.Name ? String(data.Name) : mac));
      var circle = bg.nextElementSibling;
      if (circle && String(circle.className || '').split(/\s+/).indexOf('circle') >= 0) {
        circle.parentNode.removeChild(circle);
        circle.classList.add('od-client-repeat');
        name.appendChild(circle);
      }
      summary.appendChild(name);

      var ipCell = element('span', 'od-client-cell');
      ipCell.appendChild(element('small', 'od-client-label', 'IP address'));
      var ipValue = element('span', 'od-client-value');
      var ipTd = bg.querySelector('tr:nth-child(2) td:first-child');
      if (ipTd) {
        while (ipTd.firstChild) ipValue.appendChild(ipTd.firstChild);
      } else {
        ipValue.textContent = data && data.IP ? String(data.IP) : 'Unavailable';
      }
      ipCell.appendChild(ipValue);
      summary.appendChild(ipCell);

      var macCell = element('span', 'od-client-cell');
      macCell.appendChild(element('small', 'od-client-label', 'MAC address'));
      var macValue = element('span', 'od-client-value');
      if (macNode) {
        macNode.parentNode.removeChild(macNode);
        macValue.appendChild(macNode);
      } else {
        macValue.textContent = mac || 'Unavailable';
      }
      macCell.appendChild(macValue);
      summary.appendChild(macCell);

      var connection = element('span', 'od-client-cell od-client-connection');
      connection.appendChild(element('small', 'od-client-label', 'Connection'));
      var connectionValue = element('span', 'od-client-value od-client-connection-value');
      var radio = bg.querySelector('.radioIcon');
      if (radio) {
        radio.parentNode.removeChild(radio);
        connectionValue.appendChild(radio);
      }
      var bandText;
      if (data && data.isWL) {
        bandText = window.wl_nband_title && window.wl_nband_title[data.isWL - 1]
          ? window.wl_nband_title[data.isWL - 1] : text(bg.querySelector('.band_chrome'));
        if (!bandText) bandText = 'Wireless';
      } else {
        bandText = 'Wired';
      }
      connectionValue.appendChild(element('span', 'od-client-band', bandText));
      connection.appendChild(connectionValue);
      summary.appendChild(connection);

      var chevron = element('span', 'od-client-chevron');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.appendChild(deviceSvg([['path', { d: 'm9 5 7 7-7 7' }]], 'icon'));
      summary.appendChild(chevron);
      entry.appendChild(summary);

      var detail = element('div', 'od-client-detail');
      detail.appendChild(element('h3', 'od-client-detail-title', 'Device details'));
      var list = document.createElement('dl');
      list.className = 'od-client-readouts';
      var signalRow = null;
      var add = function (label, value) {
        var row = document.createElement('div');
        row.className = 'od-client-readout';
        row.appendChild(element('dt', '', label));
        row.appendChild(element('dd', '', value));
        list.appendChild(row);
        if (label === 'Signal') signalRow = row;
      };
      add('Online', data ? (data.isOnline ? 'Yes' : 'No') : 'Unavailable');
      add('IP assignment', data && data.ipMethod ? String(data.ipMethod) : 'Unavailable');
      add('Device type', data && data.dpiType ? String(data.dpiType) : 'Unavailable');
      add('Signal', data && data.isWL ? (data.rssi ? String(data.rssi) + ' dBm' : 'Unavailable') : 'Not applicable');
      /* The native signal sprite stays a live indicator; the drawn summary
         shows the band as text, so the sprite moves beside the measured dBm. */
      if (signalRow && radio) signalRow.querySelector('dd').appendChild(radio);
      add('SSID', data && data.ssid ? String(data.ssid) : (data && data.isWL ? 'Unavailable' : 'Not applicable'));
      add('This device', data ? (data.isLogin ? 'Yes' : 'No') : 'Unavailable');
      detail.appendChild(list);
      entry.appendChild(detail);
      return entry;
    };
    var build = function () {
      var nativeTable = null;
      for (var i = 0; i < block.children.length; i++) {
        if (block.children[i].tagName === 'TABLE') { nativeTable = block.children[i]; break; }
      }
      if (!nativeTable || nativeTable.getAttribute('data-od-clients') === 'ready') {
        updateMeta();
        syncPages();
        syncTabs();
        return;
      }
      nativeTable.setAttribute('data-od-clients', 'ready');
      nativeTable.classList.add('od-clients-native');
      var rows = element('div', 'od-clients-rows');
      var entries = nativeTable.querySelectorAll('.clientBg');
      for (var e = 0; e < entries.length; e++) rows.appendChild(buildEntry(entries[e]));
      if (!entries.length) {
        var message = nativeTable.querySelector('td > div');
        var empty = element('div', 'od-clients-empty');
        if (message) {
          message.parentNode.removeChild(message);
          message.classList.add('od-clients-empty-native');
          empty.appendChild(message);
        } else {
          empty.appendChild(element('h3', '', 'No devices in this view'));
          empty.appendChild(element('p', '', 'Choose another filter or refresh the device list.'));
        }
        rows.appendChild(empty);
      }
      var old = block.querySelector('.od-clients-rows');
      if (old) old.parentNode.removeChild(old);
      block.appendChild(rows);
      updateMeta();
      syncPages();
      syncTabs();
    };
    var syncPages = function () {
      prev.disabled = !left || String(left.style.visibility) === 'hidden';
      next.disabled = !right || String(right.style.visibility) === 'hidden';
    };

    var pressPage = function (control) {
      if (!control) return;
      control.click();
      syncPages();
    };
    prev.addEventListener('click', function () { pressPage(left); });
    next.addEventListener('click', function () { pressPage(right); });

    tabs.addEventListener('keydown', function (event) {
      var target = event.target;
      var tab = target && target.closest ? target.closest('[role="tab"]') : null;
      if (!tab) return;
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        tab.click();
        return;
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
      var visible = [];
      for (var i = 0; i < tabList.length; i++) {
        if (getComputedStyle(tabList[i]).display !== 'none') visible.push(tabList[i]);
      }
      if (!visible.length) return;
      var at = visible.indexOf(tab);
      var to = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1
        : (at + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
      event.preventDefault();
      visible[to].focus();
      visible[to].click();
    });
    /* The wireless tab has no div handler of its own; its label span owns the
       native switch. Keep the extra padding clickable without double-firing. */
    var wireless = document.getElementById('tabWireless');
    if (wireless) {
      wireless.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest('#tabWirelessSpan') || target.closest('#select_wlclient_band')) return;
        var label = document.getElementById('tabWirelessSpan');
        if (label) label.click();
      });
    }
    search.addEventListener('input', updateMeta);

    if (window.MutationObserver) {
      var scheduled = false;
      new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () { scheduled = false; build(); });
      }).observe(block, { childList: true });
      var tabObserver = new MutationObserver(syncTabs);
      for (var o = 0; o < tabList.length; o++) {
        tabObserver.observe(tabList[o], { attributes: true, attributeFilter: ['class'] });
      }
      var pageObserver = new MutationObserver(syncPages);
      if (left) pageObserver.observe(left, { attributes: true, attributeFilter: ['style'] });
      if (right) pageObserver.observe(right, { attributes: true, attributeFilter: ['style'] });
      if (loading) {
        new MutationObserver(function () {
          panel.setAttribute('aria-busy', loading.style.visibility === 'visible' ? 'true' : 'false');
        }).observe(loading, { attributes: true, attributeFilter: ['style'] });
      }
    }
    panel.setAttribute('aria-busy', loading && loading.style.visibility === 'visible' ? 'true' : 'false');
    build();
  }

  /* Theme only native positive markers, including rows rebuilt after load. */
  function decorateStateChecks() {
    var selector = 'img[src*="/images/checked.gif"]';
    var upgrade = function () {
      var images = document.querySelectorAll(selector);
      for (var i = 0; i < images.length; i++) {
        var image = images[i];
        if (image.getAttribute('data-od-checked') === 'ready') continue;
        image.setAttribute('data-od-checked', 'ready');
        image.classList.add('od-check-source');
        image.setAttribute('aria-hidden', 'true');
        image.setAttribute('alt', '');
        var marker = element('span', 'od-check');
        marker.setAttribute('role', 'img');
        marker.setAttribute('aria-label', 'Selected');
        marker.setAttribute('title', 'Selected');
        image.parentNode.insertBefore(marker, image);
      }
    };
    upgrade();
    if (!window.MutationObserver) return;
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      var run = function () { pending = false; upgrade(); };
      if (window.requestAnimationFrame) window.requestAnimationFrame(run);
      else run();
    });
    var tables = ['ATMPVCTable', 'MultiServiceTable'];
    for (var t = 0; t < tables.length; t++) {
      var table = document.getElementById(tables[t]);
      if (table) observer.observe(table, { childList: true, subtree: true });
    }
  }

  function decorateDevicePanel() {
    var path = location.pathname || '';
    if (path.indexOf('/device-map/') < 0) return;
    var title = null;
    for (var key in DEVICE_TITLES) {
      if (Object.prototype.hasOwnProperty.call(DEVICE_TITLES, key) && path.indexOf(key) >= 0) {
        title = DEVICE_TITLES[key];
        break;
      }
    }
    if (title) devicePanelHead(title);
    if (path.indexOf('/device-map/clients.asp') >= 0) decorateDeviceClients();
    else if (path.indexOf('/device-map/internet.asp') >= 0) decorateInternetPanel();
    else if (path.indexOf('/device-map/DSL_dashboard.asp') >= 0) decorateDslDashboard();
    else if (path.indexOf('/device-map/router.asp') >= 0) decorateRouterPanel();
    else if (path.indexOf('/device-map/remote.asp') >= 0) decorateRemotePanel();
  }

  /* System status ships CPU, RAM and swap as three native tables whose live
     cells are rewritten by ajax. The drawn page turns them into two measured
     cards; the native charts are moved (not cloned) so their canvas paint
     keeps working, and every reading is mirrored from the native cell. */
  function decorateStatusReadings() {
    if (!document.body.classList.contains('statusbody')) return;
    if (location.pathname.indexOf('router_status.asp') >= 0) {
      document.body.classList.add('od-router-status');
      var tm = document.getElementById('tabMenu');
      if (tm) tm.style.setProperty('display', 'none', 'important');
      var tabs = document.querySelectorAll('.tab_NW, .tabclick_NW');
      for (var tb = 0; tb < tabs.length; tb++) tabs[tb].style.setProperty('display', 'none', 'important');
    }
    var cpu = document.getElementById('cpu');
    var ram = document.getElementById('ram_quantification');
    if (!cpu || !ram || document.querySelector('.od-status-grid')) return;

    var text = function (id) {
      var node = document.getElementById(id);
      var out = node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return out || 'Unavailable';
    };
    var percent = function (id) {
      var node = document.getElementById(id);
      var out = node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return out.replace(/%/g, '').trim() || '0';
    };
    var axis = function () {
      var line = element('div', 'od-status-axis');
      line.appendChild(element('span', '', 'Earlier'));
      line.appendChild(element('span', '', 'Now'));
      return line;
    };
    var readout = function (list, label, key) {
      var row = element('div', 'od-status-readout');
      row.appendChild(element('dt', '', label));
      var value = document.createElement('dd');
      value.setAttribute('data-od-reading', key);
      value.textContent = 'Unavailable';
      row.appendChild(value);
      list.appendChild(row);
      return { row: row, value: value };
    };
    var legendItem = function (label, key) {
      return element('span', 'od-status-legend-item od-status-legend-' + key, label);
    };

    var grid = element('div', 'od-status-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'System status');

    var cpuCard = document.createElement('section');
    cpuCard.className = 'od-status-card';
    cpuCard.appendChild(element('h2', 'od-status-card-title', 'CPU'));
    var cpuMetric = element('div', 'od-status-metric');
    var cpuValue = element('span', 'od-status-number', '0');
    cpuValue.setAttribute('data-od-reading', 'cpu1');
    cpuMetric.appendChild(cpuValue);
    cpuMetric.appendChild(element('span', 'od-status-unit', '%'));
    cpuCard.appendChild(cpuMetric);
    var cpuLegend = element('div', 'od-status-legend');
    cpuLegend.appendChild(legendItem('Core 1', 'cpu1'));
    cpuLegend.appendChild(legendItem('Core 2', 'cpu2'));
    cpuLegend.style.display = 'none';
    cpuCard.appendChild(cpuLegend);
    var cpuChart = element('div', 'od-status-chart');
    cpuCard.appendChild(cpuChart);
    cpuCard.appendChild(axis());
    var cpuReadouts = document.createElement('dl');
    cpuReadouts.className = 'od-status-readouts od-status-core-readouts';
    cpuReadouts.style.display = 'none';
    var core1 = readout(cpuReadouts, 'Core 1', 'cpuCore1');
    var core2 = readout(cpuReadouts, 'Core 2', 'cpuCore2');
    cpuCard.appendChild(cpuReadouts);
    grid.appendChild(cpuCard);

    var memCard = document.createElement('section');
    memCard.className = 'od-status-card';
    memCard.appendChild(element('h2', 'od-status-card-title', 'Memory'));
    var memMetric = element('div', 'od-status-metric');
    var memValue = element('span', 'od-status-number', '0');
    memValue.setAttribute('data-od-reading', 'ram');
    memMetric.appendChild(memValue);
    memMetric.appendChild(element('span', 'od-status-unit', '% used'));
    memCard.appendChild(memMetric);
    var memLegend = element('div', 'od-status-legend');
    memLegend.appendChild(legendItem('RAM', 'ram'));
    memLegend.appendChild(legendItem('Virtual RAM', 'swap'));
    memLegend.style.display = 'none';
    memCard.appendChild(memLegend);
    var memChart = element('div', 'od-status-chart');
    memCard.appendChild(memChart);
    memCard.appendChild(axis());
    var memReadouts = document.createElement('dl');
    memReadouts.className = 'od-status-readouts';
    var ramUsed = readout(memReadouts, 'Used', 'ramUsed');
    var ramFree = readout(memReadouts, 'Free', 'ramFree');
    var ramTotal = readout(memReadouts, 'Total', 'ramTotal');
    var swapUsed = readout(memReadouts, 'Virtual RAM used', 'swapUsed');
    var swapFree = readout(memReadouts, 'Virtual RAM free', 'swapFree');
    var swapTotal = readout(memReadouts, 'Virtual RAM total', 'swapTotal');
    var swapRows = [swapUsed.row, swapFree.row, swapTotal.row];
    for (var s = 0; s < swapRows.length; s++) swapRows[s].style.display = 'none';
    memCard.appendChild(memReadouts);
    grid.appendChild(memCard);

    var cpuMount = cpu.querySelector('div[style*="background-color:black"]');
    var chartBoxes = document.querySelectorAll('div[style*="background-color:black"]');
    var memMount = null;
    for (var c = 0; c < chartBoxes.length; c++) {
      if (!cpu.contains(chartBoxes[c])) { memMount = chartBoxes[c]; break; }
    }
    if (cpuMount) {
      cpuMount.classList.add('od-status-chart-mount');
      cpuChart.appendChild(cpuMount);
    }
    if (memMount) {
      memMount.classList.add('od-status-chart-mount');
      memChart.appendChild(memMount);
    }

    var tables = document.querySelectorAll('.table1px');
    for (var t = 0; t < tables.length; t++) tables[t].classList.add('od-readings-source');

    var anchor = document.querySelector('form[name="form"]');
    if (anchor && anchor.parentNode === document.body) document.body.insertBefore(grid, anchor);
    else document.body.appendChild(grid);

    var sync = function () {
      var core2Row = document.getElementById('cpu2_tr');
      var two = !!(core2Row && getComputedStyle(core2Row).display !== 'none');
      cpuValue.textContent = percent('cpu1_quantification');
      cpuLegend.style.display = two ? '' : 'none';
      cpuReadouts.style.display = two ? '' : 'none';
      core1.value.textContent = text('cpu1_quantification');
      core2.value.textContent = text('cpu2_quantification');
      memValue.textContent = percent('ram_quantification');
      ramUsed.value.textContent = text('ram_used_info');
      ramFree.value.textContent = text('ram_free_info');
      ramTotal.value.textContent = text('ram_total_info');
      var swapTable = document.getElementById('SwapRAM_graph_table');
      var swapReady = !!(swapTable && swapTable.style.display !== 'none' &&
        text('swapram_used_info') !== 'Unavailable' && text('swapram_free_info') !== 'Unavailable' &&
        text('swapram_total_info') !== 'Unavailable');
      memLegend.style.display = swapReady ? '' : 'none';
      swapUsed.row.style.display = swapReady ? '' : 'none';
      swapFree.row.style.display = swapReady ? '' : 'none';
      swapTotal.row.style.display = swapReady ? '' : 'none';
      swapUsed.value.textContent = text('swapram_used_info');
      swapFree.value.textContent = text('swapram_free_info');
      swapTotal.value.textContent = text('swapram_total_info');
    };
    sync();
    if (window.MutationObserver) {
      var pending = false;
      var observer = new MutationObserver(function () {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () { pending = false; sync(); });
      });
      var monitors = document.querySelectorAll('.od-readings-source');
      for (var m = 0; m < monitors.length; m++) {
        observer.observe(monitors[m], { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
      }
    }
  }

  /* Some native pages carry the action row as a table row inside the form
     grid, where the row owns a single narrow column. The approved layout
     places the action on the content column's right edge, so the lone cell
     spans the grid. Only the presentation span changes; the form, its
     fields and the action itself are untouched. */
  function spanActionRows() {
    var rows = document.querySelectorAll('tr.apply_gen');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.cells.length !== 1) continue;
      var table = row.closest('table');
      if (!table) continue;
      var columns = 0;
      for (var r = 0; r < table.rows.length; r++) {
        var span = 0;
        for (var c = 0; c < table.rows[r].cells.length; c++) span += table.rows[r].cells[c].colSpan;
        if (span > columns) columns = span;
      }
      var cell = row.cells[0];
      if (columns > 1 && cell.colSpan < columns) cell.colSpan = columns;
    }
    var centers = document.querySelectorAll('td > center > input.button_gen');
    for (var k = 0; k < centers.length; k++) {
      centers[k].parentElement.classList.add('apply_gen');
    }
  }

  window.addEventListener('load', function () {
    document.body.classList.add('od-ready');
    routeClasses();
    decorateWizardHost();
    buildHeader();
    revealActiveTab();
    markMatrixTables();
    buildSectionTitles();
    observeSectionTitles();
    buildPrivacyTitle();
    decorateHelp();
    buildSettingsIndex();
    markPrimaryActions();
    composeNativeAdmin();
    decorateNetworkMap();
    labelInspector();
    decoratePasswordFields();
    groupInspectorFields();
    addWifiShortcut();
    stackFieldTables();
    qosPhoneLayout();
    scrollWideTables();
    decoratePickers();
    decorateIptvPanel();
    sizeFields();
    decorateChoiceGroups();
    decorateDdnsServerRow();
    labelFields();
    groupTimeFields();
    decorateSetupForm();
    keyboardLinks();
    fitFrames();
    themeDiagnosticFrames();
    mapDisclosure();
    decorateTrafficMonitor();
    decorateEditors();
    decorateStatusLog();
    separateLogActions();
    decorateAdslStatus();
    decorateStateChecks();
    decorateStatusReadings();
    decorateDevicePanel();
    spanActionRows();
    fitDeviceCharts();
    decorateFooter();
    var errors = document.querySelectorAll('[id^="alert_msg"]');
    for (var e = 0; e < errors.length; e++) errors[e].setAttribute('aria-live', 'polite');
  });

  /* Clicking a republished navigation row should look selected immediately,
     not only after the destination finishes loading. The same capture handles
     ordinary internal links for the short page fade. */
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target;
    if (!target || !target.closest) return;
    var item = target.closest('.od-nav-item[data-od-href]');
    if (item) {
      var href = item.getAttribute('data-od-href');
      if (!href || /^javascript:/i.test(href)) return;
      markNavCurrent(item);
      event.preventDefault();
      event.stopPropagation();
      beginPageTransition(href);
      return;
    }
    var link = target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || link.hasAttribute('onclick') || link.hasAttribute('data-od-no-transition')) return;
    var raw = link.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || /^javascript:/i.test(raw) || /^(mailto|tel):/i.test(raw)) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (error) { return; }
    if (url.origin !== location.origin || /logout|reboot/i.test(url.pathname)) return;
    event.preventDefault();
    event.stopPropagation();
    beginPageTransition(url.href);
  }, true);

  /* The schedule button sits in the rightmost column of a wide client table;
     opening the generated week grid should start at its first day column.
     The native inline handler has already rebuilt the table when this
     bubbling listener runs, so the reset applies to the new grid. */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest || !target.closest('input.service_btn')) return;
    var main = document.getElementById('mainTable');
    if (main) main.scrollLeft = 0;
  });
}());
