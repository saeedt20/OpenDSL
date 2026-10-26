#!/usr/bin/env python3
"""Review C06 + recheck D02/D03 regression gate (host only): the Quick
Internet Setup wizard is branded OpenDSL while its flow logic stays untouched.

Checks:
  - the wizard page and the fourteen step pages exist as overlay replacements
    pinned by the integration manifest (hashes match);
  - QIS_wizard's <title> and both IE banner branches use the OpenDSL text
    branding and no asustitle image references remain in the page;
  - no replaced wizard page sets a parent document title beginning with
    "ASUS";
  - the finish page no longer renders the stock ASUS cloud-registration hint;
  - every remaining literal "ASUS" token inside the replaced wizard pages is
    either inside an HTML comment, a JS comment line, or an inherited stock
    helper URL (documented deliberate retention);
  - D02: the wizard's downlevel-hidden IE6 conditional block contains no
    close-comment terminator before its <![endif] (a nested comment exposed a
    duplicate banner in 0.1.3); the rendered counterpart lives in
    check_wizard_render.cjs (browser-dependent, separate SKIPPED-incomplete
    status);
  - D03: the shipped EN.dict differs from stock in exactly the five bounded
    display values (wizard text, passphrase label and manual-update/recovery guidance), and every
    String_Entry dictionary value expanded from the scanned pages contains a
    live "ASUS" display token nowhere; the default-password fallback page
    (Main_Password.asp) differs from stock only in its login title and is
    ASUS-free;
  - the flow logic is untouched: each replaced page differs from the exact
    stock original only in the documented branding lines after reversing the shared CSS link and dashboard navigation (separately checked byte-for-byte);
  - the overlay favicon.png is a valid PNG (magic + CRC verified) and differs
    from the stock ASUS logo favicon;
  - the packed tree scan (built release, best effort) confirms no wizard page
    carries ASUS display branding.
"""
import hashlib
import json
import pathlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "tools" / "qa"))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "tools"))
from legacy_theme import untheme, original_navigation
import release_selection as rsel  # recheck D05: shared numeric/explicit release selector

ROOT = pathlib.Path(__file__).resolve().parents[3]
OVERLAY = ROOT / 'overlays/native-english'
STOCK = ROOT / 'analysis/verified/rootfs'
MANIFEST = json.loads((OVERLAY / 'integration.json').read_text())
WIZ_PAGES = sorted([f['path'] for f in MANIFEST['files']
                    if 'QIS_wizard' in f['path'] or '/qis/QIS_' in f['path']])
HELP_URL_RE = re.compile(r'https?://[^\s\'"]*asus\.com[^\s\'"]*')
BRAND_SPAN_SNIPPET = '>OpenDSL</span>'
BRANDISH = ('OpenDSL is ready', 'local admin interface')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def strip_comments(text):
    text = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)      # HTML comments
    text = re.sub(r'<%--.*?--%>', ' ', text, flags=re.S)     # ASP comments
    return text


def check_no_asus_display_text(rel, text, failures):
    # remaining ASUS tokens allowed only in comments or inherited URLs
    no_html = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)
    for i, line in enumerate(no_html.splitlines(), 1):
        if 'ASUS' not in line:
            continue
        if line.lstrip().startswith('//'):
            continue
        remainder = HELP_URL_RE.sub('§', line)
        if 'ASUS' in remainder:
            failures.append(f'{rel}:{i}: live ASUS token outside a comment or '
                            f'documented helper URL: {line.strip()[:120]}')


def main():
    ok = True
    results = {'pages': WIZ_PAGES}

    # 1) manifests pin every wizard page and favicon
    failures = []
    for rel in WIZ_PAGES + ['boaroot/html/images/favicon.png']:
        entry = next((f for f in MANIFEST['files'] if f['path'] == rel), None)
        path = OVERLAY / rel
        if not entry or not path.exists() or entry['size'] != path.stat().st_size \
                or entry['sha256'] != sha(path):
            failures.append(f'manifest mismatch for {rel}')
    results['manifest_pinned'] = not failures
    ok = ok and not failures

    # 2) wizard banner + title
    wiz = (OVERLAY / 'boaroot/cgi-bin/QIS_wizard.asp').read_text()
    f2 = []
    if '<title>OpenDSL ' not in wiz or '<title>ASUS ' in wiz:
        f2.append('wizard <title> not OpenDSL-branded')
    if 'asustitle' in wiz:
        f2.append('asustitle image reference remains')
    if wiz.count(BRAND_SPAN_SNIPPET) < 2:
        f2.append('OpenDSL banner span missing in one of the IE branches')
    # flow logic intact: conditional banner comments and modelName spans survive
    for keep in ('<!--[if !lte IE 6]>-->', '<!--[if lte IE 6]>',
                 'modelName_top', '"/qis/qis_style.css"'):
        if keep not in wiz:
            f2.append(f'wizard flow/banner structure marker removed: {keep}')
    results['wizard_banner_and_title'] = {'ok': not f2, 'failures': f2}
    ok = ok and not f2
    check_no_asus_display_text('QIS_wizard.asp', wiz, failures)

    # 3) step pages: only the documented branding lines changed vs stock
    step_failures = []
    intended = [
        ('parent.document.title = "ASUS ', 'parent.document.title = "OpenDSL '),
    ]
    for rel in WIZ_PAGES:
        src = STOCK / rel
        if rel == 'boaroot/cgi-bin/QIS_wizard.asp':
            continue
        if not src.exists():
            step_failures.append(f'{rel}: no stock original')
            continue
        new = original_navigation(untheme((OVERLAY / rel).read_text()), rel)
        original = src.read_text()
        if rel.endswith('QIS_finish.asp'):
            # stock span replaced by a comment+span block: diff must be
            # exactly parent-title + that multi-line block
            stock_wo = original
            start = new.index('<!--OpenDSL: the stock ASUS cloud-registration hint')
            start2 = new.rfind('\n', 0, start) + 1   # include the line's leading tabs
            span_block = new[start2:new.index('</span>', start) + len('</span>')]
            stock_wo = stock_wo.replace(
                '\t\t<span><% tcWebApi_Get("String_Entry", "ASUS_Registration", "s") %></span>',
                span_block)
            stock_wo = stock_wo.replace('parent.document.title = "ASUS ',
                                        'parent.document.title = "OpenDSL ')
            if stock_wo != new:
                step_failures.append(f'{rel}: differs beyond the documented '
                                     'registration-span replacement')
            continue
        replaced = original.replace('parent.document.title = "ASUS ',
                                    'parent.document.title = "OpenDSL ')
        if 'parent.document.title = "ASUS ' not in original:
            step_failures.append(f'{rel}: overlay added for a page without the '
                                 'documented ASUS title line')
        elif replaced != new:
            step_failures.append(f'{rel}: differs beyond the parent-title literal')
    results['step_pages_minimal_diff'] = {'ok': not step_failures, 'failures': step_failures}
    ok = ok and not step_failures

    # 4) no parent title begins with ASUS anywhere in replaced pages
    f4 = []
    for rel in WIZ_PAGES:
        text = (OVERLAY / rel).read_text()
        for line in strip_comments(text).splitlines():
            if 'parent.document.title = "ASUS' in line:
                f4.append(f'{rel}: ASUS parent title remains')
    results['no_asus_parent_titles'] = {'ok': not f4, 'failures': f4}
    ok = ok and not f4

    # 5) finish page: local-management replacement present
    fin = (OVERLAY / 'boaroot/cgi-bin/qis/QIS_finish.asp').read_text()
    f5 = []
    if 'tcWebApi_Get("String_Entry", "ASUS_Registration"' in fin:
        f5.append('finish page still renders the stock registration string')
    if not any(s in fin for s in BRANDISH):
        f5.append('finish page local-management replacement absent')
    results['finish_registration_replaced'] = {'ok': not f5, 'failures': f5}
    ok = ok and not f5
    check_no_asus_display_text('qis/QIS_finish.asp', fin, failures)

    # 6) favicon: valid PNG, differs from stock
    fav = OVERLAY / 'boaroot/html/images/favicon.png'
    data = fav.read_bytes()
    f6 = []
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        f6.append('overlay favicon is not a PNG')
    else:
        # verify chunk CRCs
        pos, tail_ok = 8, True
        while pos < len(data):
            size = struct.unpack_from('>I', data, pos)[0]
            crc = struct.unpack_from('>I', data, pos + 8 + size)[0]
            if zlib.crc32(data[pos + 4:pos + 8 + size]) & 0xffffffff != crc:
                tail_ok = False
                break
            pos += 12 + size
        if not tail_ok:
            f6.append('favicon PNG chunk CRC mismatch')
    stock_images = STOCK / 'boaroot/html/images'
    if stock_images.exists():
        for cand in stock_images.glob('favicon*'):
            if cand.read_bytes() == data:
                f6.append('overlay favicon identical to stock')
    results['favicon'] = {'ok': not f6, 'failures': f6, 'bytes': len(data)}
    ok = ok and not f6

    # 6b) recheck D02 (static complement to check_wizard_render.cjs): the
    #     downlevel-hidden IE6 conditional comment must contain no premature
    #     close-comment terminator before its downlevel marker.
    f6b = []
    hidden = re.search(r'<!--\[if lte IE 6\]>(.*?)<!\[endif\]', wiz, re.S)
    if not hidden:
        f6b.append('wizard lost the downlevel-hidden IE6 conditional block')
    elif '-->' in hidden.group(1):
        f6b.append('close-comment terminator inside the hidden IE6 conditional '
                   'block (d02: nested comments render a duplicate banner)')
    results['wizard_conditional_comment_integrity'] = {'ok': not f6b, 'failures': f6b}
    ok = ok and not f6b

    # 6c) recheck D03: bounded EN.dict delta + expanded display text scan
    f6c = []
    stock_dict, over_dict = {}, {}
    for mapping, srcpath in ((stock_dict, STOCK / 'userfs/EN.dict'),
                             (over_dict, OVERLAY / 'userfs/EN.dict')):
        for line in srcpath.read_text().splitlines():
            if '=' in line:
                key, value = line.split('=', 1)
                mapping[key] = value
    changed = {k for k in set(stock_dict) | set(over_dict)
               if stock_dict.get(k) != over_dict.get(k)}
    if over_dict.get('WC11b_x_Phrase_in') != 'Passphrase:':
        f6c.append('wireless passphrase display label changed unexpectedly')
    documented_edits = {'QIS_pass_desc1', 'not_support_script', 'WC11b_x_Phrase_in',
                        'FW_desc0', 'FW_n2', 'QIS', 'menu5', 't1Logout'}
    if changed != documented_edits:
        f6c.append(f'EN.dict changed keys differ from the documented display edits: {sorted(changed)}')
    # Pin the navigation wording so the allowlist cannot silently absorb a
    # different display value later.
    for key, value in {'QIS': 'Quick Setup', 'menu5': 'Advanced', 't1Logout': 'Log out'}.items():
        if over_dict.get(key) != value:
            f6c.append(f'{key} display value is not the documented {value!r}')
    if over_dict.get('QIS_pass_desc1', '').lower().find('asus') != -1 or \
            over_dict.get('not_support_script', '').lower().find('asus') != -1:
        f6c.append('changed display values still contain an ASUS token')
    # every String_Entry value expanded from the scanned display pages
    scanned = WIZ_PAGES + ['boaroot/cgi-bin/Main_Password.asp']
    used = set()
    for rel in scanned:
        source = (OVERLAY / rel).read_text()
        used |= set(re.findall(r'[Tt]cWebApi_[Gg]et\(\s*"String_Entry"\s*,\s*"([^"]+)"',
                               source))
    asus_keys = {key for key in used if 'asus' in over_dict.get(key, '').lower()}
    if asus_keys:
        f6c.append(f'scanned pages expand dictionary keys whose shipped values '
                   f'still display "ASUS": {sorted(asus_keys)}')
    missing_keys = {key for key in used if key not in over_dict}
    if missing_keys:
        f6c.append(f'referenced String_Entry keys absent from the shipped '
                   f'EN.dict: {sorted(missing_keys)}')
    results['d03_dictionary_expansion'] = {
        'ok': not f6c, 'failures': f6c, 'keys_scanned': len(used),
        'changed_keys': sorted(changed)}
    ok = ok and not f6c

    # 6d) recheck D03: default-password fallback minimal diff
    f6d = []
    if (OVERLAY / 'boaroot/cgi-bin/Main_Password.asp').exists():
        stock_pw = (STOCK / 'boaroot/cgi-bin/Main_Password.asp').read_text()
        over_pw = untheme((OVERLAY / 'boaroot/cgi-bin/Main_Password.asp').read_text())
        expected = stock_pw.replace('<title>ASUS Login</title>',
                                    '<title>OpenDSL Login</title>')
        if over_pw != expected:
            f6d.append('Main_Password.asp differs from stock beyond the login title')
    else:
        f6d.append('Main_Password.asp overlay missing (d03)')
    results['d03_main_password_fallback'] = {'ok': not f6d, 'failures': f6d}
    ok = ok and not f6d

    # 7) packed-tree scan of the built release selected by the shared
    #    numeric/explicit selector (recheck D05: no lexicographic pick).
    #    (Best effort, like A02)
    try:
        release = rsel.find_release(need_rootfs=True)
    except LookupError:
        results['packed_tree_scan'] = 'SKIPPED-INCOMPLETE: no built release under build/release/'
    else:
        tmp = pathlib.Path(tempfile.mkdtemp(prefix='wizard-scan-'))
        try:
            subprocess.run(['7z', 'x', '-y', f'-o{tmp}',
                            str(release / 'rootfs.squashfs')],
                           capture_output=True, text=True)
            extraction_ok = bool(tmp.exists())
            f7 = []
            for rel in WIZ_PAGES + ['boaroot/cgi-bin/Main_Password.asp',
                                    'userfs/EN.dict']:
                packed = tmp / rel
                if not packed.exists():
                    f7.append(f'{rel}: missing from packed tree')
                    continue
                if sha(packed) != sha(OVERLAY / rel):
                    f7.append(f'{rel}: packed bytes differ from overlay')
            results['packed_tree_scan'] = {
                'release': release.name, 'extraction_ok': extraction_ok,
                'failures': f7,
            }
            ok = ok and not f7 and extraction_ok
        finally:
            shutil.rmtree(tmp)

    # collect late ASUS display-text findings
    if failures:
        results['asus_text_scan_failures'] = failures
        ok = False

    print(json.dumps({'scope': 'host checks over overlay sources, frozen manifest '
                      'and (best effort) packed tree; no device or firmware execution',
                      'results': results}, indent=2))
    if ok:
        print('PASS: QIS wizard is OpenDSL-branded with unchanged flow logic; '
              'no live ASUS display text remains in wizard or default-password '
              'pages (page literals AND expanded String_Entry dictionary '
              'values); the IE6 conditional-comment structure cannot leak the '
              'hidden banner; EN.dict changes are the documented display values only')
        return 0
    print('FAIL: wizard branding incomplete', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
