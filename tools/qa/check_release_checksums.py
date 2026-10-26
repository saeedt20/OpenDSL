#!/usr/bin/env python3
"""Gate for the release checksum list.

The list must exclude itself, cover every other release document and reject
tampering. Regression for the 0.1.20 self-entry that made `sha256sum -c` fail.
"""
import tempfile
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import build_image


def listed(release):
    entries = {}
    for line in (release / 'checksums.txt').read_text().splitlines():
        digest, name = line.split('  ')
        entries[name] = digest
    return entries


with tempfile.TemporaryDirectory() as tmp:
    release = Path(tmp)
    (release / 'OpenDSL_fixture.trx').write_bytes(b'firmware-bytes')
    (release / 'rootfs.squashfs').write_bytes(b'rootfs-bytes')
    (release / 'release-manifest.json').write_text('{"fixture":true}\n')
    (release / 'RELEASE.md').write_text('# fixture\n')
    build_image.write_release_checksums(release)
    entries = listed(release)
    assert 'checksums.txt' not in entries, 'checksum list includes itself'
    expected = {'OpenDSL_fixture.trx', 'rootfs.squashfs', 'release-manifest.json', 'RELEASE.md'}
    assert set(entries) == expected, f'checksum coverage mismatch: {sorted(entries)}'
    build_image.verify_release_checksums(release)

    # Negative control: a modified payload must not verify.
    (release / 'OpenDSL_fixture.trx').write_bytes(b'tampered')
    try:
        build_image.verify_release_checksums(release)
    except RuntimeError:
        pass
    else:
        raise SystemExit('tampered release passed checksum verification')

print('release checksum list: PASS (self excluded, coverage complete, tamper rejected)')
