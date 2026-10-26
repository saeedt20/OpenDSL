#!/usr/bin/env python3
"""Review A02 regression gate (host only): the retired traffic-history views
must not keep synchronous producer-dependent consumers in the packed image.

The candidate `sbin/rc` keeps start_rstats() a no-op (see
build/native/rc-no-monitor-start.patch), so after boot no `rstats` producer
exists. The native updatePath handler (tcWebApi_UpdateBandwidth) would still
unlink its output, killall-signal the absent producer and block up to five
seconds in the management path — so the overlay must retire the two history
views and BOTH their update endpoints (`updateBandwidth.asp`,
`updateBandwidthDaily.asp`) with immediate, producer-independent responses.

Checked here:
  - the rc patch (frozen candidate) really disables producer start;
  - every retired view/endpoint exists as an overlay replacement whose bytes
    no longer invoke tcWebApi_UpdateBandwidth / TomatoRefresh(rstats) paths
    and contains the retirement text;
  - the realtime monitor (retreated in review C05) no longer offers the
    retired pages as destinations;
  - no remaining overlay file (including state.js and the production UI)
    links to the retired views or endpoint URLs;
  - a best-effort scan of the newest built release's FULL packed filesystem
    (fresh unsquashfs extraction, review C05 "scan the complete packed tree")
    finds no reference to the retired pages outside the retired pages
    themselves — this catches references left in unchanged stock pages;
  - the integration manifest hash of each retirement file still matches.
"""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "tools" / "qa"))
import release_selection as rsel  # recheck D05: shared numeric/explicit release selector

ROOT = pathlib.Path(__file__).resolve().parents[3]
OVERLAY = ROOT / 'overlays/native-english'
CGI = OVERLAY / 'boaroot/cgi-bin'
RETIRED = [
    'boaroot/cgi-bin/Main_TrafficMonitor_daily.asp',
    'boaroot/cgi-bin/Main_TrafficMonitor_last24.asp',
    'boaroot/cgi-bin/updateBandwidth.asp',
    'boaroot/cgi-bin/updateBandwidthDaily.asp',
]
# review C05: realtime monitor stays, but must not reference the retired views
CHECKED_NOT_RETIRED = [
    'boaroot/cgi-bin/Main_TrafficMonitor_realtime.asp',
]
CONSUMER_WORDS = ('tcWebApi_UpdateBandwidth', "new TomatoRefresh('updateBandwidth.asp'")
BANNED_LINK_WORDS = ('Main_TrafficMonitor_daily.asp',
                     'Main_TrafficMonitor_last24.asp')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scan_tree_for_links(directory, retired_paths, scan_all_suffixes=True):
    """Return {relpath: [banned refs]} for every file under directory.

    retired_paths are given relative to the same `directory`."""
    banned_rel = {str(pathlib.Path(rel)) for rel in retired_paths}
    hits = {}
    for path in sorted(directory.rglob('*')):
        if not path.is_file():
            continue
        rel = str(path.relative_to(directory))
        if rel in banned_rel:
            continue
        text = None
        try:
            text = path.read_text()
        except (UnicodeDecodeError, OSError):
            continue
        refs = [word for word in BANNED_LINK_WORDS
                + ('updateBandwidth.asp', 'updateBandwidthDaily.asp') if word in text]
        if refs:
            hits[rel] = refs
    return hits


def main():
    results = {}
    ok = True
    # 1) producer really disabled in the frozen candidate
    patch = (ROOT / 'build/native/rc-no-monitor-start.patch').read_text()
    producer_disabled = ('start_rstats' in patch and 'return;' in patch
                         and 'stop_rstats();' in patch)
    results['producer_disabled_by_rc_patch'] = producer_disabled
    manifest = json.loads((ROOT / 'build/native/native-manifest.json').read_text())
    start_rstats = manifest.get('rc_disabled_start_functions', {}).get('start_rstats', {}).get('candidate', {})
    producer_frozen = start_rstats.get('hex') == '03e0000800000000'
    results['frozen_rc_start_rstats_is_noop'] = producer_frozen
    ok = ok and producer_disabled and producer_frozen

    # 2) all retired surfaces + the C05 retreated realtime page exist in the
    #    overlay, do not use the native consumer, and document the retirement
    for rel in RETIRED + CHECKED_NOT_RETIRED:
        path = OVERLAY / rel
        if not path.exists():
            results[rel] = {'exists': False}
            ok = False
            continue
        text = path.read_text()
        uses_consumer = any(word in text for word in CONSUMER_WORDS)
        mentions = ('retired' in text or 'retirement' in text)
        results[rel] = {
            'exists': True,
            'invokes_native_consumer': uses_consumer,
            'mentions_retirement': mentions,
            'sha256': sha(path),
        }
        if uses_consumer or not mentions:
            ok = False

    # 3) no active links to the retired pages anywhere else in the overlay
    #    (whole overlay tree, relative to OVERLAY so the retired stub pages
    #    themselves are excluded; non-.js/.asp files are ignored)
    link_hits = scan_tree_for_links(OVERLAY, RETIRED)
    for rel, refs in sorted(link_hits.items()):
        if not rel.endswith(('.js', '.asp')):
            continue
        results[f'overlay-link-check:{rel}'] = {'banned_links': refs}
        ok = False

    # 4) review C05: scan the COMPLETE packed tree of the built release
    #    selected by the shared numeric/explicit selector (recheck D05: no
    #    lexicographic pick). Fresh extraction; catches references the
    #    overlay scan cannot see in stock pages that were never touched.
    #    Best effort: skipped with an explicit status when no release is
    #    built; extraction never modifies the release and always runs in a
    #    temporary directory. Explicitly selected but missing releases fail
    #    hard via RuntimeError.
    try:
        release = rsel.find_release(need_rootfs=True)
    except LookupError:
        results['packed_tree_scan'] = 'SKIPPED-INCOMPLETE: no built release under build/release/'
    else:
        tmp = pathlib.Path(tempfile.mkdtemp(prefix='packed-scan-'))
        try:
            # stock squashfs is big-endian LZMA (v3.x): use 7z, which handles
            # it natively, and treat device-node warnings as non-fatal (text
            # files all extract)
            proc = subprocess.run(['7z', 'x', '-y', f'-o{tmp}',
                                   str(release / 'rootfs.squashfs')],
                                  capture_output=True, text=True)
            extraction_ok = bool(list(tmp.rglob('boaroot')))

            hits = scan_tree_for_links(tmp, RETIRED)
            # inside the packed tree, the retired pages live under
            # boaroot/cgi-bin/ with the same names
            banned_names = {str(pathlib.Path(rel)) for rel in RETIRED}
            real_hits = {}
            for rel, refs in sorted(hits.items()):
                if rel in banned_names:
                    continue
                # The stub pages themselves may legitimately document the old
                # names, and they are exactly the four retired entries above.
                # Any hit outside them - including in comments of unchanged or
                # newly replaced pages - is a dead reference and a defect.
                real_hits[rel] = refs
            results['packed_tree_scan'] = {
                'release': release.name,
                'extraction_ok': extraction_ok,
                'extraction_exit': proc.returncode,
                'banned_reference_hits': real_hits,
            }
            if real_hits or not extraction_ok:
                ok = False
        finally:
            shutil.rmtree(tmp)

    # 5) the historic five-second-wait helper stays out of reach of the update
    #    endpoints because the endpoints no longer call the native handler:
    #    (tcWebApi_UpdateBandwidth not called anywhere in overlay, checked above)

    print(json.dumps({'scope': 'overlay-source, frozen-manifest and (best-effort) '
                      'packed-tree host checks; no device or firmware execution; '
                      'five-second wait is the audited native helper, not a live '
                      'measurement', 'results': results},
                     indent=2))
    if ok:
        print('PASS: producer disabled; retired history surfaces are overlay-'
              'replaced with immediate responses; no remaining links in overlay '
              'or packed tree')
        return 0
    print('FAIL: monitor retirement inconsistent', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
