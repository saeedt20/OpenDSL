#!/usr/bin/env python3
"""Regression gate for recheck D05: built-release selection must be numeric
and must honour explicit overrides.

The previous inline `sorted(glob('*-experimental'))[-1]` picks used
lexicographic ordering and would select 0.1.3-experimental over
0.1.10-experimental, so future packed-tree checks
would silently inspect an older release, and Make overrides were not
followed. This gate proves the shared selector:

  private fixtures under /tmp/opencode (build/release itself is never
  created, written or modified here):

    ['0.1.3-experimental', '0.1.9-experimental', '0.1.10-experimental']
                  -> numeric newest is 0.1.10-experimental (a lexicographic
                     sort would pick 0.1.3 or 0.1.9)
    explicit '0.1.3-experimental' -> must select exactly that
    numeric compare 0.1.9 vs 0.1.10 both directions
    unparsable directory names are never selected
    explicit request for a missing release -> hard error, no silent fallback
    OPENDSL_RELEASE env override -> honoured

Historical evidence directories are documented/immutability-checked: the
fixture tree is freshly created per run and removed afterwards.
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
import release_selection as rs

PASS = True


def check(name, got, want):
    global PASS
    ok = got == want
    print({'check': name, 'got': got, 'want': want, 'ok': ok})
    if not ok:
        PASS = False


def main():
    # The exported OPENDSL_RELEASE (Makefile CURRENT_VERSION) is a legitimate
    # ambient override for PRODUCTION scans, but this self-test builds its own
    # private fixture root, so the ambient value must not leak into the
    # fixture scenarios — it is saved/restored, never consulted here.
    ambient = os.environ.pop('OPENDSL_RELEASE', None)
    try:
        _run_scenarios()
    finally:
        if ambient is not None:
            os.environ['OPENDSL_RELEASE'] = ambient
    print(json.dumps({'gate': 'release-selection', 'pass': PASS}))
    if PASS:
        print('PASS: built-release selection is numeric (0.1.10 > 0.1.9 > '
              '0.1.3), honours explicit Make/env overrides, ignores '
              'unparsable names, and fails hard on a missing explicit target')
        return 0
    print('FAIL: release selection contract violated', file=sys.stderr)
    return 1


def _run_scenarios():
    with tempfile.TemporaryDirectory(prefix='opendsl-release-') as td:
        root = __import__('pathlib').Path(td) / 'release'
        root.mkdir()
        for name in ('0.1.3-experimental', '0.1.9-experimental',
                     '0.1.10-experimental', '0.1.11-rc2-fixture'):
            directory = root / name
            directory.mkdir()
            (directory / 'release-manifest.json').write_text('{}')
            (directory / 'rootfs.squashfs').write_bytes(b'')

        # numeric newest beats lexicographic order
        chosen = rs.find_release(release_root=root)
        check('numeric-newest-0.1.10', chosen.name, '0.1.10-experimental')

        # explicit override wins even when newer releases exist
        chosen = rs.find_release(release_root=root, requested='0.1.3-experimental')
        check('explicit-override', chosen.name, '0.1.3-experimental')

        # lexicographic control: old behaviour would have selected 0.1.3 or 0.1.9
        lexicographic_last = sorted(root.glob('*-experimental'))[-1]
        check('lexicographic-control-would-differ',
              lexicographic_last.name != chosen.name, True)

        # the numeric comparator itself
        check('0.1.10-newer-than-0.1.9',
              rs.newer('0.1.10-experimental', '0.1.9-experimental'), True)
        check('0.1.9-not-newer-than-0.1.10',
              rs.newer('0.1.9-experimental', '0.1.10-experimental'), False)
        check('suffix-does-not-order',
              rs.newer('0.1.9-experimental', '0.1.9-fixture'), False)

        # unparsable names are ignored by the newest selection
        unparsable = root / 'zzz-broken-name'
        unparsable.mkdir()
        (unparsable / 'release-manifest.json').write_text('{}')
        (unparsable / 'rootfs.squashfs').write_bytes(b'x')
        chosen = rs.find_release(release_root=root)
        check('unparsable-ignored', chosen.name, '0.1.10-experimental')

        # env override is honoured
        os.environ['OPENDSL_RELEASE'] = '0.1.3-experimental'
        try:
            chosen = rs.find_release(release_root=root)
            check('env-override', chosen.name, '0.1.3-experimental')
        finally:
            del os.environ['OPENDSL_RELEASE']

        # explicit request for a missing release is a hard error
        try:
            rs.find_release(release_root=root, requested='9.9.9-ghost')
        except RuntimeError as error:
            check('missing-explicit-hard-error', 'RuntimeError' in type(error).__name__, True)
            check('missing-explicit-no-silent-fallback',
                  'refusing to silently fall back' in str(error), True)
        else:
            check('missing-explicit-hard-error', 'raised RuntimeError', True)

        for name in ('1.0.0-experimental', '1.0.0'):
            directory = root / name
            directory.mkdir()
            (directory / 'release-manifest.json').write_text('{}')
            (directory / 'rootfs.squashfs').write_bytes(b'')
        check('stable-newest-and-tie', rs.find_release(release_root=root).name, '1.0.0')
        check('explicit-experimental-still-honoured',
              rs.find_release(release_root=root, requested='1.0.0-experimental').name,
              '1.0.0-experimental')

        # nothing requested and nothing built -> LookupError for the caller
        empty = root / 'nothing-here'
        empty.mkdir()
        try:
            rs.find_release(release_root=empty)
        except LookupError:
            check('empty-root-skip-signal', 'LookupError', 'LookupError')
        else:
            check('empty-root-skip-signal', 'raised LookupError', 'LookupError')


if __name__ == '__main__':
    raise SystemExit(main())
