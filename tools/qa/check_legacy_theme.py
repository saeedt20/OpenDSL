#!/usr/bin/env python3
"""All native documents: reversible theme, exact reviewed behavior, fail controls."""
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from legacy_theme import LINK, SCRIPT, untheme, original_navigation, needs_enhancement
from make_legacy_theme import compact_css, compiled_js, release_version
from ui_symbols import symbol_css, symbol_file_css, symbol_files, MODERN_SYMBOLS


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def valid(text, entry):
    return (text.count(LINK) == 1 and text.count(SCRIPT) == int(needs_enhancement(text)) and
            digest(original_navigation(untheme(text), entry['path'])) == entry['sha256'])


def main():
    ui = ROOT / 'overlays/opendsl-ui'
    assert (ui / 'boaroot/html/opendsl/legacy.css').read_text() == compact_css(symbol_css() + (ui / 'src/legacy.css').read_text())
    # The modern pages carry a strict CSP (img-src 'self'); their masks point
    # at shipped same-origin symbol files instead of data URIs.
    assert (ui / 'boaroot/html/opendsl/styles.css').read_text() == compact_css(
        symbol_file_css(MODERN_SYMBOLS) + (ui / 'src/styles.css').read_text())
    for name, svg in symbol_files(MODERN_SYMBOLS).items():
        shipped = ui / 'boaroot/html/opendsl/symbols' / name
        assert shipped.is_file() and shipped.read_text() == svg, 'symbol file drift: ' + name
    compiled = compiled_js(release_version())
    shipped_js = (ui / 'boaroot/html/opendsl/legacy.js').read_text()
    assert shipped_js == compiled
    release = release_version()
    assert 'OpenDSL release' in compiled
    versions = set(re.findall(r'\d+\.\d+\.\d+(?:-[a-z]+)?', compiled))
    assert versions == {release}, (versions, release)
    assert (ui / 'src/legacy.js').read_text().count('@@OPENDSL_RELEASE@@') == 1
    script = (ui / 'src/legacy.js').read_text()
    for forbidden in ('fetch(', 'XMLHttpRequest', 'WebSocket', 'setInterval', 'setTimeout', 'localStorage', 'sessionStorage', '.submit('):
        assert forbidden not in script, forbidden
    for name in ('legacy.css', 'styles.css'):
        css = (ui / 'boaroot/html/opendsl' / name).read_text()
        assert not re.search(r'(?:box|text)-shadow\s*:\s*(?!none\b)[^;}]+', css)
    contract = json.loads((ROOT / 'overlays/opendsl-ui/legacy-contracts.json').read_text())
    manual_upload = (ROOT / 'overlays/security/boaroot/cgi-bin/Advanced_FirmwareUpgrade_Content.asp').read_text()
    retired_handler = (ROOT / 'overlays/security/boaroot/cgi-bin/live_update.asp').read_text()
    assert needs_enhancement(manual_upload) and SCRIPT in manual_upload
    assert not needs_enhancement(retired_handler) and SCRIPT not in retired_handler
    assert len(contract['pages']) == 87
    manifests = {name: json.loads((ROOT / 'overlays' / name / 'integration.json').read_text())
                 for name in ('security', 'native-english', 'opendsl-ui')}
    paths = []
    for entry in contract['pages']:
        path = ROOT / 'overlays' / entry['owner'] / entry['path']
        text = path.read_bytes().decode('utf-8')
        assert valid(text, entry), entry['path'] + ': template behavior changed or theme missing'
        owners = [n for n, m in manifests.items() if entry['path'] in [f['path'] for f in m['files']]]
        assert owners == [entry['owner']], (entry['path'], owners)
        # Controls: neither an unthemed old page nor an altered native field /
        # script / ASP fragment may satisfy the same contract.
        assert not valid(untheme(text), entry)
        assert not valid(re.sub(r'</head>', '<script>changed()</script></head>', text, count=1, flags=re.I), entry)
        paths.append(entry['path'])
    # Coverage is based on actual rendered document heads, not page-name guesses.
    stock = ROOT / 'analysis/verified/rootfs/boaroot/cgi-bin'
    stock_docs = {str(p.relative_to(stock.parent.parent)) for p in stock.rglob('*.asp')
                  if re.search(r'<head\b', p.read_text(), re.I)}
    assert stock_docs - {'boaroot/cgi-bin/Main_Login.asp'} <= set(paths), stock_docs - set(paths)
    state = (ROOT / 'overlays/native-english/boaroot/html/state.js').read_text()
    baseline = ROOT / 'analysis/recheck-015-image/candidate-tree/boaroot/html/state.js'
    # Restore native menu selection and home routes for the actual index2 page.
    assert state.count('menuL1_link = new Array("", "index2.asp",') == 2
    if baseline.exists():
        assert state == baseline.read_text()
    print(json.dumps(dict(gate='legacy-theme', result='PASS', documents=len(paths),
                         exact_behavior_contracts=87, negative_controls=174,
                         scope='Host source comparison; not native or modem execution')))


if __name__ == '__main__':
    main()
