#!/usr/bin/env python3
"""Verifier negative controls on disposable copies only (review C02).

For a built release, creates disposable copies in a separate work directory,
refreshes their payload CRC and copied-manifest hashes (so structural
consistency is preserved and only the intended promise is violated), then runs
`tools/build_image.py --validate-only <copy>` in normal and optimized modes:

  control-unsupported-major   SquashFS major 65535      -> must reject, both modes
  control-kernel-dictionary   LZMA dict header changed  -> must reject (kernel
                              identity), normal mode; optimized mode must exit
                              nonzero with the explicit optimized-execution
                              refusal (never 'all static gates passed')
  control-rootfs-payload      TRX/rootfs bytes disagree -> must reject, both modes

The real release is only read, never modified; every copy is deleted after its
run and re-checked. If no release is built yet, the check reports an explicit
SKIPPED-INCOMPLETE status and exits 0 without any pass claim.
"""
import hashlib
import json
import lzma
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release_selection as rsel

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import build_image
from stage_pack import compare_full
OUT = ROOT / 'build/release/work/verifier-controls'

HEADER_SIZE = 256


def latest_release():
    """Numeric-newest built release, honouring an explicit
    make/OPENDSL_RELEASE override (recheck D05). Returns None only when
    nothing is selected and nothing is built."""
    try:
        return rsel.find_release(need_rootfs=False)
    except LookupError:
        return None


def run(name, argv, optimized=False):
    env = dict(os.environ)
    env.pop('PYTHONOPTIMIZE', None)
    if optimized:
        env['PYTHONOPTIMIZE'] = '1'
    proc = subprocess.run(argv, cwd=ROOT, env=env, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (OUT / f'{name}.log').write_text(proc.stdout)
    return {'optimized': optimized, 'returncode': proc.returncode,
            'output_tail': proc.stdout[-1200:]}


def make_copy(name, data, manifest, rootfs):
    directory = OUT / name
    directory.mkdir(exist_ok=False)
    manifest = json.loads(json.dumps(manifest))
    struct.pack_into('>I', data, 12, zlib.crc32(data[HEADER_SIZE:]) ^ 0xffffffff)
    image = bytes(data)
    (directory / manifest['image']['file']).write_bytes(image)
    (directory / manifest['rootfs']['file']).write_bytes(rootfs)
    manifest['image']['sha256'] = hashlib.sha256(image).hexdigest()
    manifest['image']['md5'] = hashlib.md5(image).hexdigest()
    manifest['rootfs']['sha256'] = hashlib.sha256(rootfs).hexdigest()
    (directory / 'release-manifest.json').write_text(json.dumps(manifest, indent=2))
    build_image.write_release_checksums(directory)
    build_image.verify_release_checksums(directory)
    return directory


def check_control(name, data, detail, manifest, rootfs, expected_error, failures, results):
    directory = make_copy(name, data, manifest, rootfs)
    try:
        argv = ['python3', 'tools/build_image.py', '--validate-only', str(directory)]
        normal = run(f'{name}-normal', argv)
        optimized = run(f'{name}-optimized', argv, optimized=True)
    finally:
        shutil.rmtree(directory)
    entry = {'control': name, 'detail': detail,
             'normal_rejected': normal['returncode'] != 0,
             'normal_expected_error': expected_error in normal['output_tail'],
             'normal': normal,
             'optimized': optimized,
             'optimized_rejected': optimized['returncode'] != 0,
             'optimized_expected_error': 'refusing optimized execution' in optimized['output_tail'],
             'optimized_never_passes': 'all static gates passed'
                                       not in optimized['output_tail'],
             'disposable_copy_removed': not directory.exists()}
    results.append(entry)
    if not (entry['normal_rejected'] and entry['normal_expected_error']
            and entry['optimized_rejected'] and entry['optimized_expected_error']
            and entry['optimized_never_passes'] and entry['disposable_copy_removed']):
        failures.append(f"verifier control failed invariant: {name}: {entry}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    release = latest_release()
    if release is None:
        print(json.dumps({'gate': 'verifier-negative-controls',
                          'result': 'SKIPPED-INCOMPLETE',
                          'detail': 'no built release found under build/release/; '
                                    'run after make release to enable this gate'}, indent=2))
        return 0
    manifest = json.loads((release / 'release-manifest.json').read_text())
    original = (release / manifest['image']['file']).read_bytes()
    original_hash = hashlib.sha256(original).hexdigest()
    if original_hash != manifest['image']['sha256']:
        raise RuntimeError('the release about to be controlled fails its own hash')
    root_offset = HEADER_SIZE + struct.unpack_from('>I', original, 0x50)[0]

    failures, results = [], []
    positive = make_copy('control-unchanged', bytearray(original), manifest, original[root_offset:])
    try:
        checked_manifest, _ = build_image.validate_release_artifacts(positive)
        if checked_manifest['image']['sha256'] != original_hash:
            raise RuntimeError('positive artifact control changed the release')
        results.append({'control': 'unchanged-artifact-boundaries', 'accepted': True,
                        'scope': 'checksums, header, kernel/rootfs region identity and size; no workspace/filesystem acceptance'})
    finally:
        shutil.rmtree(positive)

    expected = [{'path': 'file', 'sha256': 'unchanged'}]
    compare_full(expected, expected, 'positive metadata control')
    try:
        compare_full(expected, [{'path': 'file', 'sha256': 'changed'}], 'changed-content control')
    except RuntimeError as error:
        if 'file: sha256' not in str(error):
            raise
        results.append({'control': 'decoded-file-hash-comparison', 'changed_hash_rejected': True})
    else:
        raise RuntimeError('changed decoded file hash was accepted')
    # 1) unsupported SquashFS major version
    bad_major = bytearray(original)
    bad_major[root_offset + 28:root_offset + 30] = b'\xff\xff'
    check_control('control-unsupported-major', bad_major, {'major': 65535},
                  manifest, bytes(bad_major[root_offset:]), 'rootfs SquashFS major != 3', failures, results)

    # 2) kernel identity: change ONLY the LZMA dictionary header size; the
    #    control must decompress to the same kernel (no new code) while
    #    violating compressed-byte identity
    changed_kernel = bytearray(original)
    old_dict = int.from_bytes(changed_kernel[257:261], 'little')
    new_dict = 4 << 20 if old_dict != 4 << 20 else 8 << 20
    changed_kernel[257:261] = new_dict.to_bytes(4, 'little')
    if lzma.decompress(original[HEADER_SIZE:root_offset], format=lzma.FORMAT_ALONE) != \
            lzma.decompress(bytes(changed_kernel)[HEADER_SIZE:root_offset], format=lzma.FORMAT_ALONE):
        raise RuntimeError('kernel-dictionary control must stay payload-identical')
    check_control('control-kernel-dictionary', changed_kernel,
                  {'old_dictionary_bytes': old_dict, 'new_dictionary_bytes': new_dict,
                   'decompressed_kernel_still_identical': True},
                  manifest, bytes(changed_kernel[root_offset:]), 'kernel region not byte-identical to stock kernel', failures, results)

    # Keep the published rootfs intact so the TRX region identity gate is exercised.
    bad_content = bytearray(original)
    bad_content[root_offset + 8192] ^= 0x80
    check_control('control-rootfs-payload', bad_content, {'flipped_rootfs_offset': 8192},
                  manifest, original[root_offset:], 'rootfs region not identical to packed staging image', failures, results)

    if hashlib.sha256((release / manifest['image']['file']).read_bytes()).hexdigest() != original_hash:
        failures.append('real release changed unexpectedly during controls')

    report = {'gate': 'verifier-negative-controls', 'release': str(release),
              'controls': results}
    (OUT / 'verifier-controls.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if failures:
        print(json.dumps({'gate': 'verifier-negative-controls', 'result': 'FAIL',
                          'failures': failures}, indent=2), file=sys.stderr)
        return 1
    print('PASS: unchanged artifact boundaries accepted; each malformed copy reaches '
          'its intended rejection; decoded-file hash drift rejected; optimized execution refused')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
