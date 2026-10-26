"""Shared built-release selection for packed-tree QA gates (recheck D05).

Every gate that inspects a built release must select the release the same
way, and overrides must be honoured explicitly:

  precedence:  argument / OPENDSL_RELEASE env ( wired from the Makefile's
               CURRENT_VERSION, so `make check` and `make release` always
               agree)  >  numeric-newest stable/experimental under build/release/

Selection is numeric-aware: 0.1.10 > 0.1.9 > 0.1.3, which naive path-string
sorting gets wrong (the D05 finding). A missing explicitly-selected release
is a hard error (the build/verify contract is broken); only the case "no
release built at all and nothing requested" is left to the caller to turn
into the established SKIPPED-INCOMPLETE status.

No release directory is modified by this module.
"""
import os
import re
import sys
from pathlib import Path

RELEASE_ROOT = Path(__file__).resolve().parents[2] / 'build' / 'release'


def parse_version_tuple(name):
    """'0.1.10-experimental' -> (0, 1, 10); None when the name has no
    leading numeric version."""
    match = re.match(r'^(\d+(?:\.\d+)*)(.*)$', name)
    if not match:
        return None
    return tuple(int(part) for part in match.group(1).split('.'))


def parse_requested(release_root, requested):
    """Resolve an explicitly requested release directory."""
    directory = Path(release_root) / requested
    if not directory.is_dir() or not (directory / 'release-manifest.json').exists():
        raise RuntimeError(
            f'selected release "{requested}" (explicit/current version) is not a '
            f'built release under {release_root}: missing '
            f'{directory}/release-manifest.json; refusing to silently fall back')
    return directory


def newer(a_name, b_name):
    """True when version name a sorts numerically newer than b."""
    a, b = parse_version_tuple(a_name), parse_version_tuple(b_name)
    if a is None or b is None:
        raise RuntimeError(f'unparsable release names: {a_name!r} / {b_name!r}')
    return (a, not a_name.endswith('-experimental')) > (b, not b_name.endswith('-experimental'))


def find_release(release_root=RELEASE_ROOT, requested=None,
                 need_rootfs=False):
    """Select one built release directory.

    requested precedence: argument, then OPENDSL_RELEASE env, then the
    numeric-newest stable/experimental directory. Stable wins a numeric tie.
    Raises RuntimeError for an
    explicit selection that is not a built release; raises LookupError when
    nothing was requested and no parsable built release exists (callers map
    that to their SKIPPED-INCOMPLETE status).
    """
    if requested is None:
        requested = os.environ.get('OPENDSL_RELEASE') or None
    if requested:
        return parse_requested(release_root, requested)
    parsable = []
    for candidate in Path(release_root).glob('*'):
        if re.fullmatch(r'\d+\.\d+\.\d+(?:-experimental)?', candidate.name) \
                and candidate.is_dir() and (candidate / 'release-manifest.json').exists() \
                and parse_version_tuple(candidate.name) is not None:
            if need_rootfs and not (candidate / 'rootfs.squashfs').exists():
                continue
            parsable.append(candidate)
    if not parsable:
        raise LookupError(
            f'no numerically-parsable built release ({"" if need_rootfs else "manifest-only"})'
            f' under {release_root}')
    newest = parsable[0]
    for candidate in parsable[1:]:
        if newer(candidate.name, newest.name):
            newest = candidate
    return newest


def skipped_or_select(doorway, result, need_rootfs=False):
    """Convenience for gates: select, or print the SKIPPED-INCOMPLETE JSON and
    exit 2 (established optional-browser-coverage convention) when nothing is
    built yet. Returns the release directory or None after printing."""
    try:
        return find_release(requested=None, need_rootfs=need_rootfs)
    except LookupError as gap:
        print({**result, 'result': 'SKIPPED-INCOMPLETE',
               'detail': f'{gap}; run after make release to enable this part'},
              file=doorway)
        return None


if __name__ == '__main__':
    # no-argument listing of the current selection (no output side effects)
    try:
        print(find_release(requested=sys.argv[1]
                           if len(sys.argv) > 1 else None))
    except LookupError as error:
        print(f'no release selected: {error}', file=sys.stderr)
        raise SystemExit(2)
