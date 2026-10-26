#!/usr/bin/env python3
"""Generate overlays/native-english/boaroot/html/state.js from the original.

Bounded, single-match edits to the stock Boa client library only. Records a
reviewable patch and prints the result hash. Internal product IDs,
authentication fields and upgrade identifiers stay untouched.
"""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'analysis/verified/rootfs/boaroot/html/state.js'
OUT = ROOT / 'overlays/native-english/boaroot/html/state.js'
PATCH = ROOT / 'overlays/native-english/statejs-english-opendsl.patch'

NL = '\\n'

edits = [
    # B: always display English; the saved language choice is not applied.
    (
        "function show_selected_language(){\n"
        "var lang_flag = get_preferred_lang_type();\n",
        "function show_selected_language(){\n"
        "/*OpenDSL: English-only interface; the saved language choice is not applied.*/\n"
        "\t$('selected_lang').innerHTML = \"English\";\n"
        "\treturn;\n"
        "if(false){var lang_flag = get_preferred_lang_type();\n",
    ),
    # B tail: close the neutralized original switch, then stop using it.
    (
        "\t\tcase '19':{\n"
        "\t\t\t$('selected_lang').innerHTML = \"Український\";\n"
        "\t\t\t$('UK').parentNode.style.display = \"none\";\n"
        "\t\t\tbreak;\n"
        "\t\t}\n"
        "\t}\n"
        "}\n",
        "\t\tcase '19':{\n"
        "\t\t\t$('selected_lang').innerHTML = \"Український\";\n"
        "\t\t\t$('UK').parentNode.style.display = \"none\";\n"
        "\t\t\tbreak;\n"
        "\t\t}\n"
        "\t}\n"
        "}\n"
        "}\n",
    ),
    # C: English variant for support-site links only.
    (
        "function get_selected_language(){\n"
        "var lang_flag = get_preferred_lang_type();\n",
        "function get_selected_language(){\n"
        "/*OpenDSL: English-only interface; support-site links use the English variant.*/\n"
        "\treturn \"/\";\n"
        "var lang_flag = get_preferred_lang_type();\n",
    ),
    # D: replace the ASUS title image with OpenDSL text branding.
    (
        "banner_code +='<div class=\"banner1\" align=\"center\">"
        "<img src=\"/images/New_ui/asustitle.png\" width=\"218\" height=\"54\" align=\"left\">" + NL + "';\n",
        "banner_code +='<div class=\"banner1\" align=\"center\">"
        "<span style=\"float:left;width:218px;height:54px;line-height:54px;"
        "font-size:26px;font-weight:600;letter-spacing:1px;color:#8ec5ff;"
        "text-shadow:0 0 10px rgba(96,170,255,.30);text-align:left;\">OpenDSL</span>" + NL + "';\n",
    ),
]

# A: English-only language menu; the entire foreign dropdown block is deleted.
text = SRC.read_bytes().decode('utf-8')
drop_start = "banner_code +='<li><dl><dt id=\"selected_lang\"></dt>" + NL + "';\n"
drop_end = "banner_code +='</dl></li>" + NL + "';\n"
start = text.index(drop_start) + len(drop_start)
end = text.index(drop_end, start)
dropped = text[start:end]
text = text[:start] + (
    "/*\n"
    "OpenDSL: English-only interface. Foreign-language menu entries were removed;\n"
    "the Boa loader always opens EN.dict (0004-boa-english-only-dictionary.patch)\n"
    "and userfs/ carries only EN.dict.\n"
    "*/\n"
) + text[end:]
assert 'is_UK_sku' in dropped and 'id="UK"' in dropped and 'id="BR"' in dropped
assert text.count(drop_start) == 1 and text.count(drop_end) == 1

for old, new in edits:
    assert text.count(old) == 1, f"expected exactly one match: {old!r}"
    text = text.replace(old, new)
# User-facing dashboard navigation; native index2 page remains a device-map route.
# Keep the native index2.asp home destination; it now shares the theme.
# Preserve the reviewed traffic-history retirement on regeneration.
text = text.replace('"Main_Spectrum_Content.asp", "Main_TrafficMonitor_last24.asp", "Main_TrafficMonitor_daily.asp",',
                    '"Main_Spectrum_Content.asp",')
OUT.write_bytes(text.encode('utf-8'))

diff = subprocess.run(['diff', '-u', str(SRC), str(OUT)], capture_output=True, text=True).stdout
PATCH.write_text(diff)

data = OUT.read_bytes()
print(json.dumps({
    'source': str(SRC), 'output': str(OUT), 'patch': str(PATCH),
    'source_bytes': SRC.stat().st_size, 'output_bytes': len(data),
    'output_sha256': hashlib.sha256(data).hexdigest(),
    'diff_lines': len(diff.splitlines()),
}, indent=2))
