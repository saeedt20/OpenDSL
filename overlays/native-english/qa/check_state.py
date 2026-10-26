#!/usr/bin/env python3
"""Host checks for the native-english state.js overlay.

Compares the replacement against the stock file, syntax-checks both after
stripping server template tags, and asserts which behaviour changed and which
contracts are preserved. Never contacts a device.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
STOCK = ROOT / 'analysis/verified/rootfs/boaroot/html/state.js'
OUT = ROOT / 'overlays/native-english/boaroot/html/state.js'
PATCH = ROOT / 'overlays/native-english/statejs-english-opendsl.patch'
MANIFEST = ROOT / 'overlays/native-english/integration.json'

TEMPLATE = re.compile(r'<%.*?%>', re.S)


def strip_templates(text):
    return TEMPLATE.sub('0', text)


def node_check(path):
    text = strip_templates(path.read_bytes().decode('utf-8'))
    with tempfile.NamedTemporaryFile('w+', suffix='.js', delete=False) as handle:
        handle.write(text)
        name = handle.name
    result = subprocess.run(['node', '--check', name], capture_output=True, text=True)
    assert result.returncode == 0, f'node --check failed for {path}:\n{result.stderr}'
    pathlib.Path(name).unlink()


def count(text, needle):
    return text.count(needle)


def main():
    stock = STOCK.read_bytes().decode('utf-8')
    new = OUT.read_bytes().decode('utf-8')
    js_stock = strip_templates(stock)
    js_new = strip_templates(new)
    node_check(STOCK)
    node_check(OUT)

    expected = json.loads(MANIFEST.read_text())['files']
    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
    assert digest == expected[0]['sha256'], (digest, expected)

    # Removed behaviour: no foreign-language offer remains.
    for call in ['submit_language(1)', 'submit_language(2)', 'submit_language(3)',
                 'submit_language(18)', 'submit_language(19)', 'submit_language(12)']:
        assert count(js_new, call) == 0, call
    for entry_id in ['id="EN"', 'id="CN"', 'id="TW"', 'id="BR"', 'id="UK"']:
        assert count(js_new, entry_id) == 0, entry_id
    assert count(js_new, 'asustitle.png') == 0, 'ASUS title image must be removed'
    assert count(js_new, 'OpenDSL') >= 1, 'OpenDSL branding must be present'
    assert 'function get_selected_language(){\n/*OpenDSL' in js_new, 'return route'
    assert 'the saved language choice is not applied.*/' in js_new, 'display policy'

    # Preserved native contracts: identical occurrence counts in both files.
    for needle in [
        'name="next_page"', 'name="current_page"', 'name="action_mode"',
        'name="action_script"', 'name="action_wait"', 'name="preferred_lang"',
        'name="wl_unit"', 'name="wl_subunit"', 'name="rebootFlag"',
        'name="restoreFlag"', 'action = "language_change.asp"', 'action = "reboot.asp"',
        'action = "start_apply.asp"', 'location = "Logout.asp"',
        'var productid =', 'var odm_productid =', 'function submit_language',
        'function change_language()', 'function logout()', 'function reboot(){',
        'isNewFW = function(FWVer', 'SysInfo_Entry', 'FirmwareUpgrade',
    ]:
        assert count(js_new, needle) == count(js_stock, needle), needle
    assert count(js_stock, 'asustitle.png') == 1

    # The patch records the exact bounded difference.
    patch = PATCH.read_text()
    assert patch.startswith('--- '), 'patch file must be a unified diff'
    changed_lines = [line for line in patch.splitlines() if line.startswith(('+', '-'))]
    assert 20 <= len(changed_lines) <= 60, len(changed_lines)

    print(json.dumps({
        'stock_bytes': len(stock.encode('utf-8')), 'overlay_bytes': len(new.encode('utf-8')),
        'overlay_sha256': digest,
        'syntax_stock_after_template_strip': 'passed', 'syntax_overlay_after_template_strip': 'passed',
        'foreign_language_entries_removed': True, 'asus_title_image_removed': True,
        'native_form_and_id_contracts_preserved': True,
    }, indent=2))


if __name__ == '__main__':
    sys.exit(main())
