#!/usr/bin/env python3
"""Apply the shared theme to reviewed native documents, with no overlay clashes.

Supply a fresh extraction of the immutable 0.1.5 image as --baseline-tree.
Every original document must match the recorded reviewed-image hash first.
Existing overlay owners retain their files; previously stock pages go into
opendsl-ui. Re-running is deterministic and never edits the baseline tree.
"""
import argparse
import gzip
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from legacy_theme import theme, navigation, untheme, original_navigation
from ui_symbols import symbol_css, symbol_file_css, symbol_files, MODERN_SYMBOLS

ROOT = Path(__file__).resolve().parents[1]
RELEASE_TOKEN = '@@OPENDSL_RELEASE@@'


def release_version(explicit=None):
    """The version this source tree builds: explicit flag, the Makefile's
    exported OPENDSL_RELEASE, then CURRENT_VERSION itself. A future or guessed
    version is never used for the displayed release identity."""
    release = explicit or os.environ.get('OPENDSL_RELEASE')
    if not release:
        match = re.search(r'^CURRENT_VERSION\s*\?=\s*(\S+)',
                          (ROOT / 'Makefile').read_text(), re.M)
        if not match:
            raise SystemExit('cannot determine CURRENT_VERSION for the release identity')
        release = match.group(1)
    return release


def compact_css(text):
    """Whitespace-only compaction for this local stylesheet (no CSS imports)."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'\s+', ' ', text)
    # Collapse around punctuation only outside quoted strings. Attribute
    # selectors such as [style*="display: none"] must keep their space, or they
    # silently stop matching Chromium's serialized inline styles.
    parts = re.split(r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')', text)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r'\s*([{}:;,])\s*', r'\1', parts[i])
    return ''.join(parts).replace(';}', '}').strip() + '\n'


def build_css():
    root = ROOT / 'overlays/opendsl-ui'
    (root / 'boaroot/html/opendsl/legacy.css').write_text(
        compact_css(symbol_css() + (root / 'src/legacy.css').read_text()))
    # The modern pages ship a strict Content Security Policy (img-src 'self'),
    # so their masks reference shipped symbol files instead of data URIs.
    symbols = root / 'boaroot/html/opendsl/symbols'
    symbols.mkdir(parents=True, exist_ok=True)
    for name, svg in symbol_files(MODERN_SYMBOLS).items():
        (symbols / name).write_text(svg)
    (root / 'boaroot/html/opendsl/styles.css').write_text(
        compact_css(symbol_file_css(MODERN_SYMBOLS) + (root / 'src/styles.css').read_text()))
def compiled_js(release):
    root = ROOT / 'overlays/opendsl-ui'
    source = (root / 'src/legacy.js').read_text()
    if RELEASE_TOKEN not in source:
        raise SystemExit('legacy.js must carry the ' + RELEASE_TOKEN + ' placeholder')
    source = source.replace(RELEASE_TOKEN, release)
    result = subprocess.run(['terser', '--compress', '--mangle', '--ecma', '5'],
                            input=source, check=True, capture_output=True, text=True)
    return result.stdout


def build_js(release):
    root = ROOT / 'overlays/opendsl-ui'
    (root / 'boaroot/html/opendsl/legacy.js').write_text(compiled_js(release))


def refresh_manifests():
    for name in ('security', 'native-english', 'opendsl-ui'):
        root = ROOT / 'overlays' / name
        path = root / 'integration.json'
        data = json.loads(path.read_text())
        # Keep order: native-english QA intentionally identifies state.js first.
        paths = [entry['path'] for entry in data['files']]
        if name == 'opendsl-ui':
            contract = json.loads((root / 'legacy-contracts.json').read_text())
            new_paths = [e['path'] for e in contract['pages'] if e['owner'] == name]
            new_paths += ['boaroot/html/opendsl/legacy.css', 'boaroot/html/opendsl/legacy.js']
            symbols = root / 'boaroot/html/opendsl/symbols'
            if symbols.is_dir():
                new_paths += ['boaroot/html/opendsl/symbols/' + p.name for p in sorted(symbols.iterdir())]
            paths += sorted(p for p in new_paths if p not in paths)
        data['files'] = [dict(path=p, size=(root / p).stat().st_size,
                             sha256=hashlib.sha256((root / p).read_bytes()).hexdigest())
                         for p in paths]
        if name == 'opendsl-ui':
            data['uncompressed_bytes'] = sum(e['size'] for e in data['files'])
            data['individual_gzip_bytes'] = sum(len(gzip.compress((root / p).read_bytes(), mtime=0)) for p in paths)
            data['legacy_theme'] = '87 reviewed native HTML documents; shared CSS and event-driven presentation enhancement; no network I/O; see legacy-contracts.json'
        path.write_text(json.dumps(data, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-tree', type=Path, required=True)
    parser.add_argument('--release', help='release identity (default: CURRENT_VERSION)')
    args = parser.parse_args()
    release = release_version(args.release)
    build_css()
    build_js(release)
    contract = json.loads((ROOT / 'overlays/opendsl-ui/legacy-contracts.json').read_text())
    for entry in contract['pages']:
        source = (args.baseline_tree / entry['path']).read_bytes()
        if hashlib.sha256(source).hexdigest() != entry['sha256']:
            raise SystemExit('reviewed baseline mismatch: ' + entry['path'])
        dest = ROOT / 'overlays' / entry['owner'] / entry['path']
        if dest.exists():
            previous = original_navigation(untheme(dest.read_bytes().decode('utf-8')), entry['path'])
            if hashlib.sha256(previous.encode('utf-8')).hexdigest() != entry['sha256']:
                raise SystemExit('refusing to overwrite a native behavior change: ' + str(dest))
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(theme(navigation(source.decode('utf-8'), entry['path'])).encode('utf-8'))
    refresh_manifests()
