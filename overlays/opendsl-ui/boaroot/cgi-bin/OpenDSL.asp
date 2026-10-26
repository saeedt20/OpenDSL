<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="referrer" content="same-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'">
  <title>OpenDSL · Overview</title>
  <link rel="stylesheet" href="/opendsl/styles.css">
  <script src="/opendsl/status-data.js" defer></script>
  <script src="/opendsl/panel.js" defer></script>
</head>
<body class="panel-page">
  <svg class="icon-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
    <symbol id="i-activity" viewBox="0 0 24 24"><path d="M2 12h5l3-8 4 16 3-8h5"/></symbol>
    <symbol id="i-network" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/></symbol>
    <symbol id="i-guests" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/></symbol>
    <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 18h2"/></symbol>
    <symbol id="i-traffic" viewBox="0 0 24 24"><path d="M3 20h18M4 15l5-6 4 4 7-9M16 4h4v4"/></symbol>
    <symbol id="i-wifi" viewBox="0 0 24 24"><path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="20" r=".7" fill="currentColor" stroke="none"/></symbol>
    <symbol id="i-lan" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/></symbol>
    <symbol id="i-internet" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M4.5 7.5h15M4.5 16.5h15"/></symbol>
    <symbol id="i-iptv" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/></symbol>
    <symbol id="i-firewall" viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><path d="m10 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L3.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-2v-3L21 8.5l-2-3-2 .5-2-1-.5-2Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-logs" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></symbol>
    <symbol id="i-tools" viewBox="0 0 24 24"><path d="M14.5 3.7a5.3 5.3 0 0 0-6.4 6.6l-4.4 4.4a2.4 2.4 0 0 0 3.4 3.4l4.4-4.4a5.3 5.3 0 0 0 6.6-6.4l-3.3 3.3-3.2-3.2Z"/><circle cx="5.4" cy="16.4" r=".55" fill="currentColor" stroke="none"/></symbol>
    <symbol id="i-setup" viewBox="0 0 24 24"><path d="m4 18 10-10 3 3L7 21ZM12 10l3 3M5 3v5M2.5 5.5h5M19 2v4M17 4h4M20 15v4M18 17h4"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></symbol>
    <symbol id="i-reboot" viewBox="0 0 24 24"><path d="M20 10a8 8 0 1 0-1 8M20 3v7h-7"/></symbol>
    <symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></symbol>
    <symbol id="i-gateway" viewBox="0 0 24 24"><path d="M7 7a7 7 0 0 1 10 0M9.5 9.5a3.5 3.5 0 0 1 5 0"/><rect x="3" y="13" width="18" height="8" rx="2.5"/><path d="M7 17h.01M10 17h.01M16 17h2"/></symbol>
  </defs></svg>
  <a class="skip-link" href="#main">Skip to overview</a>
  <aside class="sidebar" id="sidebar" aria-label="Router navigation">
    <button type="button" class="sidebar-close" id="menu-close" aria-label="Close navigation"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
    <a class="brand-block" href="/OpenDSL.asp"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text"><span class="wordmark">OpenDSL</span><span class="brand-model">DSL-N12E C1</span></span></a>
    <a class="quick-setup" href="/QIS_wizard.asp"><svg class="icon" aria-hidden="true"><use href="#i-setup"/></svg><span>Quick setup</span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></a>
    <nav aria-label="Main navigation">
      <span class="nav-caption">Workspace</span>
      <a href="/OpenDSL.asp" class="nav-item active" aria-current="page"><svg class="icon" aria-hidden="true"><use href="#i-activity"/></svg>Overview</a>
      <a href="/index2.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-network"/></svg>Network Map</a>
      <a href="/Guest_network.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-guests"/></svg>Guest network</a>
      <a href="/ParentalControl.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg>Access controls</a>
      <a href="/QoS_EZQoS.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-traffic"/></svg>Traffic manager</a>
      <span class="nav-caption">Network</span>
      <a href="/Advanced_Wireless_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-wifi"/></svg>Wireless</a>
      <a href="/Advanced_LAN_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-lan"/></svg>Local network</a>
      <a href="/Advanced_DSL_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-internet"/></svg>Internet &amp; DSL</a>
      <a href="/Advanced_IPTV_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-iptv"/></svg>IPTV</a>
      <a href="/Advanced_BasicFirewall_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-firewall"/></svg>Firewall</a>
      <span class="nav-caption">System</span>
      <a href="/Advanced_System_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-settings"/></svg>Administration</a>
      <a href="/Main_LogStatus_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-logs"/></svg>Logs &amp; diagnostics</a>
      <a href="/Main_Analysis_Content.asp" class="nav-item"><svg class="icon" aria-hidden="true"><use href="#i-tools"/></svg>Network tools</a>
    </nav>
    <div class="sidebar-model">2.4 GHz · ADSL gateway</div>
  </aside>
  <div class="nav-scrim" id="nav-scrim" hidden></div>
  <main id="main" class="panel-main">
    <header class="topbar">
      <div class="topbar-location">
        <button type="button" class="menu-toggle" id="menu-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar"><svg class="icon" aria-hidden="true"><use href="#i-menu"/></svg></button>
        <span class="mobile-wordmark">OpenDSL</span>
        <div class="settings-search">
          <svg class="icon" aria-hidden="true"><use href="#i-search"/></svg>
          <input id="od-settings-search" aria-label="Search settings" placeholder="Search settings…" list="settings-routes" autocomplete="off">
          <datalist id="settings-routes">
            <option value="Overview" data-href="/OpenDSL.asp"></option>
            <option value="Network Map" data-href="/index2.asp"></option>
            <option value="Guest network" data-href="/Guest_network.asp"></option>
            <option value="Parental controls" data-href="/ParentalControl.asp"></option>
            <option value="Traffic manager" data-href="/QoS_EZQoS.asp"></option>
            <option value="Wireless" data-href="/Advanced_Wireless_Content.asp"></option>
            <option value="LAN address" data-href="/Advanced_LAN_Content.asp"></option>
            <option value="DHCP server" data-href="/Advanced_DHCP_Content.asp"></option>
            <option value="DSL settings" data-href="/Advanced_DSL_Content.asp"></option>
            <option value="WAN settings" data-href="/Advanced_WANPort_Content.asp"></option>
            <option value="IPTV" data-href="/Advanced_IPTV_Content.asp"></option>
            <option value="Firewall" data-href="/Advanced_BasicFirewall_Content.asp"></option>
            <option value="System settings" data-href="/Advanced_System_Content.asp"></option>
            <option value="Firmware update" data-href="/Advanced_FirmwareUpgrade_Content.asp"></option>
            <option value="Backup and restore" data-href="/Advanced_SettingBackup_Content.asp"></option>
            <option value="System log" data-href="/Main_LogStatus_Content.asp"></option>
            <option value="DSL status" data-href="/Main_AdslStatus_Content.asp"></option>
            <option value="Wireless clients" data-href="/Main_WStatus_Content.asp"></option>
            <option value="DHCP leases" data-href="/Main_DHCPStatus_Content.asp"></option>
            <option value="Routing table" data-href="/Main_RouteStatus_Content.asp"></option>
            <option value="Network tools" data-href="/Main_Analysis_Content.asp"></option>
            <option value="Live traffic" data-href="/Main_TrafficMonitor_realtime.asp"></option>
            <option value="Wake on LAN" data-href="/Main_WOL_Content.asp"></option>
          </datalist>
        </div>
      </div>
      <div class="header-actions">
        <button type="button" class="action-button" id="refresh-button" aria-busy="false"><svg class="icon" aria-hidden="true"><use href="#i-reboot"/></svg><span>Refresh</span></button>
        <a class="action-button logout-link" href="/Logout.asp" aria-label="Log out" title="Log out"><svg class="icon" aria-hidden="true"><use href="#i-logout"/></svg></a>
      </div>
    </header>
    <div class="page-content">
    <div class="page-heading">
      <div><span class="eyebrow">Workspace</span><h1>Overview</h1></div>
    </div>
    <div class="notice" id="notice" role="status"><span id="notice-text">Reading connection status.</span></div>
    <section class="overview-hero" aria-labelledby="hero-title">
      <div>
        <span class="eyebrow">Your connection</span>
        <h2 id="hero-title">A clear view of your DSL line.</h2>
        <p>Connection readings, line details and everyday settings.</p>
      </div>
      <div class="hero-status">
        <span class="badge neutral" id="internet-badge"><i class="status-dot unknown" id="internet-dot"></i><span id="internet-status">Not read</span></span>
      </div>
    </section>
    <div class="stat-grid" aria-label="Line readings">
      <article class="stat-card"><span>Downstream</span><strong><span id="rate-down">—</span></strong><small id="rate-down-caption">Sync rate</small></article>
      <article class="stat-card"><span>Upstream</span><strong><span id="rate-up">—</span></strong><small id="rate-up-caption">Sync rate</small></article>
      <article class="stat-card"><span>Line mode</span><strong class="text-value" id="dsl-mode">Not read</strong><small id="dsl-mode-annex">Annex not read</small></article>
      <article class="stat-card"><span>Uptime</span><strong class="text-value" id="system-uptime">Not read</strong><small>Since last restart</small></article>
    </div>
    <div class="two-panels">
      <section class="panel" id="dsl-details" aria-labelledby="dsl-title">
        <div class="panel-heading"><h2 id="dsl-title">DSL line details</h2><a class="panel-link" href="/Advanced_WANPort_Content.asp">WAN settings</a></div>
        <dl class="readouts">
          <div><dt>Line state</dt><dd><span class="badge neutral" id="dsl-badge"><i class="status-dot unknown" id="dsl-dot"></i><span id="connection-detail">Not read</span></span></dd></div>
          <div><dt>Modulation</dt><dd id="dsl-mode-detail">Not read</dd></div>
          <div><dt>Annex</dt><dd id="dsl-annex">Not read</dd></div>
          <div><dt>Downstream</dt><dd><span id="rate-down-detail">—</span> <span id="rate-down-detail-unit"></span></dd></div>
          <div><dt>Upstream</dt><dd><span id="rate-up-detail">—</span> <span id="rate-up-detail-unit"></span></dd></div>
          <div><dt>SNR · down / up</dt><dd><span id="snr-down">—</span><span class="pair-sep" id="snr-sep"> / </span><span id="snr-up">—</span></dd></div>
          <div><dt>Attenuation · down / up</dt><dd><span id="atten-down">—</span><span class="pair-sep" id="atten-sep"> / </span><span id="atten-up">—</span></dd></div>
          <div><dt>CRC · down / up</dt><dd><span id="crc-down">—</span><span class="pair-sep" id="crc-sep"> / </span><span id="crc-up">—</span></dd></div>
        </dl>
        <p class="field-note" id="dsl-note" hidden></p>
      </section>
      <section class="panel" aria-labelledby="settings-title">
        <div class="panel-heading"><h2 id="settings-title">Everyday settings</h2></div>
        <div class="quick-links">
          <a href="/index2.asp"><svg class="icon" aria-hidden="true"><use href="#i-network"/></svg><span>Network Map<small>Explore devices and connections</small></span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></a>
          <a href="/Advanced_Wireless_Content.asp"><svg class="icon" aria-hidden="true"><use href="#i-wifi"/></svg><span>Wireless<small><span id="wireless-summary">Not read</span> · Network name, security and Wi-Fi password</small></span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></a>
          <a href="/Advanced_IPTV_Content.asp"><svg class="icon" aria-hidden="true"><use href="#i-iptv"/></svg><span>IPTV &amp; multicast<small>IGMP, VLAN and WAN settings</small></span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></a>
          <a href="/Advanced_FirmwareUpgrade_Content.asp"><svg class="icon" aria-hidden="true"><use href="#i-upload"/></svg><span>Firmware update<small><span id="firmware-line" hidden>Installed <span class="mono" id="firmware-version"><% tcWebApi_staticGet("DeviceInfo","FwVer","s") %></span> · </span>Upload a compatible firmware file from your computer</small></span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></a>
        </div>
      </section>
    </div>
    <noscript><p class="noscript-note">JavaScript is required for live status readings. Settings links remain available.</p></noscript>
    <footer class="page-footer"><span>OpenDSL · DSL-N12E C1</span><span id="footer-state">Connection status</span></footer>
    </div>
  </main>
</body>
</html>
