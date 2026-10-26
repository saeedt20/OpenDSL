/* Shipped endpoints are treated as untrusted data, never executable script. */
(function (root) {
  'use strict';
  var MAX_RESPONSE = 32768;
  var variables = new Set([
    'uptimeStr', 'sync_status_update', 'adsl_timestamp_update', 'status_isVDSLmode',
    'log_lineState', 'log_Opmode', 'log_AdslType', 'log_SNRMarginDown', 'log_SNRMarginUp',
    'log_AttenDown', 'log_AttenUp', 'log_TCM', 'log_PathModeDown', 'log_IntDepthDown',
    'log_PathModeUp', 'log_IntDepthUp', 'log_WanListMode', 'log_DataRateDown',
    'log_DataRateUp', 'log_AttainDown', 'log_AttainUp', 'log_PowerDown', 'log_PowerUp',
    'log_INPDown', 'log_INPUp', 'log_INPSHINEDown', 'log_INPSHINEUp', 'log_INPREINDown',
    'log_INPREINUp', 'log_CRCDown', 'log_CRCUp', 'log_VDSL_CurrentProfile',
    'log_FarEndVendorID', 'log_VDSLBAND_SNRMarginDown', 'log_VDSLBAND_SNRMarginUp',
    'log_VDSLBAND_LATNDown', 'log_VDSLBAND_LATNUp', 'log_VDSLBAND_SATNDown', 'log_VDSLBAND_SATNUp'
  ]);

  function checkText(text) {
    if (typeof text !== 'string' || !text.length || text.length > MAX_RESPONSE) {
      throw new Error('The device returned an empty or oversized response.');
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
      throw new Error('The device response contains invalid control characters.');
    }
  }

  function uptimeSeconds(text) {
    // The shipped producer emits rfctime() followed by "(<reltime> since
    // boot)"; reltime is either "N secs" or, with SHOWALL, "D days, H hours,
    // M minutes, S seconds". Keep the old fixed-offset read as a fallback for
    // a bare seconds suffix.
    var value = String(text || '');
    var boot = /\(([^)]*?)\s*since boot\)/i.exec(value);
    var body = boot ? boot[1].replace(/\s+/g, ' ').trim() : value.slice(32, 42).trim();
    if (/^\d{1,10}\s*(?:secs?|seconds?)?$/i.test(body)) {
      return Number(body.replace(/\D.*$/, ''));
    }
    var parts = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    var seen = false;
    ['days', 'hours', 'minutes', 'seconds'].forEach(function (unit) {
      var match = new RegExp('(\\d+)\\s*' + unit.replace(/s$/, '') + 's?', 'i').exec(body);
      if (match) { parts[unit] = Number(match[1]); seen = true; }
    });
    if (!seen) return null;
    return parts.days * 86400 + parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
  }

  function parseStatusXML(text, Parser) {
    checkText(text);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML declarations with entities are not accepted.');
    var XMLParser = Parser || root.DOMParser;
    if (!XMLParser) throw new Error('This browser does not provide an XML parser.');
    var doc = new XMLParser().parseFromString(text, 'application/xml');
    var map = doc.documentElement;
    if (doc.getElementsByTagName('parsererror').length || !map || map.tagName !== 'devicemap' || map.namespaceURI || map.attributes.length) {
      throw new Error('Status was not valid device XML. Your login session may have expired.');
    }
    var elements = Array.from(map.children);
    if (elements.length > 128 || elements.some(function (element) {
      return !/^(wan|sys|vpn|usb|secondary_wan)$/.test(element.tagName) || element.namespaceURI || element.attributes.length || element.children.length;
    })) throw new Error('The status XML structure was not recognized.');
    var wan = elements.filter(function (element) { return element.tagName === 'wan'; });
    if (wan.length < 3 || !wan.slice(0, 3).every(function (element) { return /^\d{1,3}$/.test(element.textContent.trim()); })) {
      throw new Error('WAN status fields are missing or malformed.');
    }
    var fields = Object.create(null);
    ['wan_line_state', 'wlan0_radio_flag', 'wifi_hw_switch'].forEach(function (key) {
      var matches = wan.filter(function (element) { return element.textContent.indexOf(key + '=') === 0; });
      if (matches.length > 1) throw new Error('The status XML repeats a device field.');
      fields[key] = matches.length ? matches[0].textContent.slice(key.length + 1).trim() : '';
    });
    if (!/^(up|down|initializing|wait for init)$/i.test(fields.wan_line_state)) {
      throw new Error('DSL line status is missing or not recognized.');
    }
    if (!/^[01]?$/.test(fields.wlan0_radio_flag) || !/^[01]?$/.test(fields.wifi_hw_switch)) {
      throw new Error('The wireless status was not recognized.');
    }
    var sys = elements.filter(function (element) { return element.tagName === 'sys' && element.textContent.indexOf('uptimeStr=') === 0; });
    if (sys.length > 1) throw new Error('The status XML repeats system uptime.');
    var link = wan[0].textContent.trim();
    var auxiliary = wan[2].textContent.trim();
    return {
      connected: link === '2' && (auxiliary === '0' || auxiliary === '2'),
      lineState: fields.wan_line_state.toLowerCase(),
      wireless: fields.wlan0_radio_flag === '' ? null : fields.wlan0_radio_flag === '1',
      uptime: sys.length ? uptimeSeconds(sys[0].textContent.slice(10)) : null
    };
  }

  function parseDSLText(text) {
    checkText(text);
    var result = Object.create(null);
    var lines = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (lines.length > 100) throw new Error('The DSL response contains too many fields.');
    lines.forEach(function (line) {
      var assignment = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*"([^"\\\r\n<>]{0,256})"\s*;$/.exec(line);
      if (assignment) {
        if (!variables.has(assignment[1]) || Object.hasOwn(result, assignment[1])) {
          throw new Error('The DSL response contains an unknown or repeated field.');
        }
        result[assignment[1]] = assignment[2];
        return;
      }
      // Only the exact computed forms in the supplied template are recognized.
      // Their source text is never evaluated. We need no per-band transformations.
      if (/^boottime\s*=\s*parseInt\(uptimeStr\.substring\(32,\s*42\)\);$/.test(line)) return;
      var timestamp = /^adsl_timestamp_update\s*=\s*parseInt\("(\d{0,12})"\);$/.exec(line);
      if (timestamp && !Object.hasOwn(result, 'adsl_timestamp_update')) {
        result.adsl_timestamp_update = timestamp[1];
        return;
      }
      if (/^log_AdslType\s*=\s*log_AdslType\.replace\("_",\s*" "\);$/.test(line) && Object.hasOwn(result, 'log_AdslType')) {
        result.log_AdslType = result.log_AdslType.replace('_', ' ');
        return;
      }
      var split = /^(log_VDSLBAND_(?:SNRMargin|LATN|SATN)(?:Down|Up))\s*=\s*\1\.split\(","\);$/.exec(line);
      if (split && Object.hasOwn(result, split[1])) return;
      throw new Error('The DSL response format was not recognized. No script was executed.');
    });
    if (!Object.hasOwn(result, 'log_lineState') || !Object.hasOwn(result, 'log_DataRateDown') || !Object.hasOwn(result, 'log_DataRateUp')) {
      throw new Error('Required DSL fields are missing. Your login session may have expired.');
    }
    return result;
  }

  function formatRate(raw) {
    var match = /^(\d+(?:\.\d+)?)\s*(kbps|kbit\/s|kb\/s|mbps|mbit\/s|mb\/s)?$/i.exec(String(raw || '').trim());
    if (!match || !Number.isFinite(Number(match[1]))) return { value: '—', unit: '' };
    // Bare device numbers have no established units in the template. Do not guess.
    if (!match[2]) return { value: match[1], unit: 'raw' };
    var number = Number(match[1]) / (/^k/i.test(match[2]) ? 1000 : 1);
    return { value: number.toFixed(1), unit: 'Mbps' };
  }

  function lineModeLabel(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    var upper = text.toUpperCase();
    if (/G\.992\.5|ADSL2PLUS|ADSL2\+/.test(upper)) return 'ADSL2+';
    if (/G\.992\.3|ADSL2(?!\+)/.test(upper)) return 'ADSL2';
    if (/G\.992\.1|G\.DMT/.test(upper)) return 'ADSL';
    if (/VDSL2/.test(upper)) return 'VDSL2';
    if (/VDSL/.test(upper)) return 'VDSL';
    if (/G\.993\.2|G\.993\.5|G\.fast/.test(upper)) return 'VDSL';
    return text.replace(/^ITU\s+/i, '');
  }

  function formatReading(raw) {
    var text = String(raw || '').trim();
    return /^(?:\d+(?:\.\d+)?\s*(?:dB|dbm|errors)?|N\/A|-)$/i.test(text) ? text : '—';
  }

  var api = Object.freeze({ MAX_RESPONSE: MAX_RESPONSE, parseStatusXML: parseStatusXML, parseDSLText: parseDSLText, formatRate: formatRate, formatReading: formatReading, uptimeSeconds: uptimeSeconds, lineModeLabel: lineModeLabel });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeviceData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
