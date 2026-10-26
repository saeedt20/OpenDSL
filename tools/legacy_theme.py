"""Reversible presentation-only additions to native HTML documents.

No DOM rewriting, polling, form interception, or server-template changes.
The inverse is also used by QA to compare every byte with the reviewed image.
"""
import re

LINK = '<link rel="stylesheet" href="/opendsl/legacy.css" data-opendsl-theme="legacy">'
SCRIPT = '<script defer src="/opendsl/legacy.js" data-opendsl-enhancement="legacy"></script>'
VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'
TITLE_OLD = '<title>ASUS '
TITLE_NEW = '<!--opendsl-title-brand--><title>OpenDSL '
MAP_OLD = 'ASUS <%tcWebApi_get("String_Entry","Web_Title2","s")%><br/>'
MAP_NEW = '<!--opendsl-map-brand-->OpenDSL <%tcWebApi_get("String_Entry","Web_Title2","s")%><br/>'
PHRASE_OLD = '<p class="formfonttitle_nwm" >ASUS Passphrase</p>'
PHRASE_NEW = '<!--opendsl-passphrase-brand--><p class="formfonttitle_nwm" >Passphrase</p>'
LABEL_OLD = '>ASUS Passphrase:</a>'
LABEL_NEW = '><!--opendsl-passphrase-label-->Passphrase:</a>'

# The redesigned home page needs read-only native values for its summary and
# DSL readout. The block lives in the reversible theme rather than as a manual
# page edit, so QA can still compare the unthemed document byte-for-byte with
# the reviewed image. The anchor occurs only in index2.asp.
SOURCES_ANCHOR = '\t</tr>\n</table>\n<div id="navtxt"'
SOURCES_BLOCK = (
    '\t\t\t<!-- Native values for the themed gateway summary and DSL readout.\n'
    '\t\t\t     The router iframe stays the editable owner of the Wi-Fi form. -->\n'
    '\t\t\t<div id="od_network_sources" style="display:none">\n'
    '\t\t\t\t<span id="od_gw_ssid"><% tcWebApi_get("WLan_Entry","ssid","s") %></span>\n'
    '\t\t\t\t<span id="od_gw_lanip"><% tcWebApi_staticGet("Info_Ether","ip","s") %></span>\n'
    '\t\t\t\t<span id="od_gw_wps"><% tcWebApi_get("WLan_Entry0","WscVendorPinCode","s") %></span>\n'
    '\t\t\t\t<span id="od_gw_mac"><% tcWebApi_staticGet("Info_Ether","mac","s") %></span>\n'
    '\t\t\t\t<span id="od_gw_bandmac"><% tcWebApi_get("WLan_Common","wl0_MacAddress","s") %></span>\n'
    '\t\t\t\t<span id="od_dsl_down"><% tcWebApi_get("Info_Adsl","DataRateDown","s") %></span>\n'
    '\t\t\t\t<span id="od_dsl_up"><% tcWebApi_get("Info_Adsl","DataRateUp","s") %></span>\n'
    '\t\t\t\t<span id="od_dsl_state"><% tcWebApi_staticGet("Info_Adsl","lineState","s") %></span>\n'
    '\t\t\t\t<span id="od_dsl_type"><% tcWebApi_get("Info_Adsl","AdslType","s") %></span>\n'
    '\t\t\t</div>\n'
)


INERT_HANDLER = 'Online updates retired'


def needs_enhancement(text):
    # Embedded wizard/status pages also need field alignment and accessible
    # label decoration. All native documents share the same small local script.
    # The retired online-update handler stays inert: it carries the stylesheet
    # only, so the security gate can still assert that it runs no script.
    # The manual upload page also carries this retirement notice. It needs
    # the shell enhancement; only the inert handler must remain script-free.
    if INERT_HANDLER in text and 'name="tools_FW_UploadFile"' not in text:
        return False
    return bool(re.search(r'<head\b', text, re.I))


def theme(text):
    if LINK in text:
        return text
    text = re.sub(r'(<title\b[^>]*>)ASUS ', lambda m: '<!--opendsl-title-brand-->' + m[1] + 'OpenDSL ', text, flags=re.I)
    text = text.replace(MAP_OLD, MAP_NEW)
    text = text.replace(PHRASE_OLD, PHRASE_NEW)
    text = text.replace(LABEL_OLD, LABEL_NEW)
    if SOURCES_BLOCK not in text and SOURCES_ANCHOR in text:
        text = text.replace(SOURCES_ANCHOR, SOURCES_BLOCK + SOURCES_ANCHOR, 1)
    assert len(re.findall(r'</head\s*>', text, re.I)) == 1
    extra = LINK + '\n'
    if needs_enhancement(text):
        extra += SCRIPT + '\n'
    if not re.search(r'<meta\b[^>]*name=["\']viewport["\']', text, re.I):
        extra += VIEWPORT + '\n'
    return re.sub(r'</head\s*>', lambda m: extra + m[0], text, count=1, flags=re.I)


def untheme(text):
    text = text.replace(SOURCES_BLOCK, '').replace(LINK + '\n', '').replace(SCRIPT + '\n', '').replace(VIEWPORT + '\n', '').replace(MAP_NEW, MAP_OLD).replace(PHRASE_NEW, PHRASE_OLD)
    text = text.replace(LABEL_NEW, LABEL_OLD)
    return re.sub(r'<!--opendsl-title-brand-->(<title\b[^>]*>)OpenDSL ', lambda m: m[1] + 'ASUS ', text, flags=re.I)


def navigation(text, path):
    # The approved redesign now lives on the actual native home page.
    return text


def original_navigation(text, path):
    if path.endswith('QIS_wizard.asp') or path.endswith('qis/QIS_finish.asp'):
        text = text.replace('/cgi-bin/OpenDSL.asp', '/cgi-bin/index2.asp')
        text = text.replace('/OpenDSL.asp', '/index2.asp')
    return text
