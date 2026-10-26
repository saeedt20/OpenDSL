#!/usr/bin/env python3
"""Assemble, pack, validate and release an OpenDSL firmware image.

Host orchestrator. Staging runs inside the pinned build container
(opendsl-build:bookworm-20261018) in ONE fakeroot session per run
(tools/stage_pack.py). The release directory written by this script:

  build/release/<version>/OpenDSL_DSL-N12E-C1_<version>.trx
  build/release/<version>/rootfs.squashfs
  build/release/<version>/release-manifest.json
  build/release/<version>/checksums.txt
  build/release/<version>/RELEASE.md

Packing uses the reviewed vendor trx tool. First a NO-CHANGE roundtrip packs
the stock kernel + stock rootfs and must reproduce the verified stock image
exactly, headers included; otherwise the script aborts instead of trusting
the freshly compiled tool. The release image keeps the stock compressed
kernel byte-for-byte and only replaces the rootfs region.

Nothing here touches a device.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STAGE_SCRIPT_DIR = ROOT / 'tools'
STACK_IMAGE = ROOT / 'analysis/verified'
STOCK_META = ROOT / 'build/stock-check2.json'
VENDOR_TRX_BIN = ROOT / 'build/vendor-tools/trx/trx'
VENDOR_TRX_CONFIG = ROOT / 'build/vendor-tools/trx/trx_config'
CONTAINER_IMAGE = 'opendsl-build:bookworm-20261018'
CONTAINER_ID = 'sha256:726a561f12fa35cf2b5a7b639927d64558e1599f92be28845de3312c546b2df1'
HEADER_SIZE = 256
DEFAULT_VERSION = '0.1.9-experimental'
OVERLAY_NAMES = ('security', 'lean-ipv4', 'native-english', 'opendsl-ui')
UPLOAD_CONTRACT = ('multipart/form-data', 'tools_FW_UploadFile', 'request_Form("postflag")',
                   'form.postflag.value = "1"', 'HTML_HEADER_TYPE', 'value_NONE')
KERNEL_COPY = 'image_kernel.bin'   # must not contain linux.7z/rootfs/tclinux
ROOTFS_COPY = 'tclinux_root.img'   # contains tclinux, not rootfs -> stock "2RDH" magic


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def load_inspect_firmware():
    spec = importlib.util.spec_from_file_location(
        'inspect_firmware', ROOT / 'tools/inspect_firmware.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(argv, quiet=False):
    status = subprocess.run([str(a) for a in argv], capture_output=True, text=True)
    if status.returncode != 0 and not quiet:
        raise RuntimeError(f"{status.args} failed ({status.returncode}):\n"
                           + status.stdout[-4000:] + status.stderr[-4000:])
    return status


def log_command(argv):
    path = ROOT / 'build/release/commands.jsonl'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        handle.write(json.dumps({'argv': [str(a) for a in argv]}) + '\n')


def record(argv):
    log_command(argv)
    status = run(argv, quiet=True)
    if status.returncode != 0:
        raise RuntimeError('command failed:\n' + status.stdout[-4000:] + status.stderr[-4000:])
    return status


# --------------------------------------------------------------------------
# frozen-input verification
# --------------------------------------------------------------------------

def verify_inputs(report, version):
    policy = json.loads((ROOT / 'firmware-policy.json').read_text())
    report['policy'] = policy
    checks = []

    def check(name, got, want):
        checks.append({'check': name, 'pass': got == want, 'expected': want, 'got': got})
        if got != want:
            # review C02: release-critical identity check; must reject even
            # under python -O (assert statements are stripped there)
            raise RuntimeError(f'frozen-input mismatch: {name}: {got!r} != {want!r}')

    check('stock trx sha256', sha256_file(STACK_IMAGE / 'firmware.trx'),
          policy['baseline_image_sha256'])
    stock_map = json.loads((STACK_IMAGE / 'firmware-map.json').read_text())
    check('stock kernel digest (analysis manifest)',
          sha256_file(STACK_IMAGE / 'kernel.lzma'), stock_map['kernel']['sha256'])
    check('stock rootfs digest (analysis manifest)',
          sha256_file(STACK_IMAGE / 'rootfs.squashfs'), stock_map['rootfs']['sha256'])
    report['stock'] = {
        'image_sha256': policy['baseline_image_sha256'],
        'kernel_sha256': stock_map['kernel']['sha256'],
        'rootfs_sha256': stock_map['rootfs']['sha256'],
        'kernel_bytes': (STACK_IMAGE / 'kernel.lzma').stat().st_size,
        'rootfs_bytes': (STACK_IMAGE / 'rootfs.squashfs').stat().st_size,
    }

    freeze = json.loads((ROOT / 'build/native/FREEZE.json').read_text())
    for item in freeze['files']:
        check(f'frozen {item["path"]}', sha256_file(ROOT / item['path']), item['sha256'])
    report['candidates'] = [
        {'candidate': item['path'], 'sha256': item['sha256'], 'size': item['size']}
        for item in freeze['files'] if item['path'].startswith('build/native/out/candidate/')]

    vendor_manifest = json.loads((ROOT / 'build/vendor-tools/build-manifest.json').read_text())
    for item in vendor_manifest['tools']:
        check(f'vendor tool {item["path"]}',
              sha256_file(ROOT / 'build/vendor-tools' / item['path']), item['sha256'])
    check('vendor trx_config matches GPL copy', sha256_file(VENDOR_TRX_CONFIG),
          sha256_file(ROOT / 'artifacts/source/extracted/dsl-n12e-c1_gpl/tools/trx/trx_config'))

    stock_meta = json.loads(STOCK_META.read_text())
    assert len(stock_meta) == 1093, len(stock_meta)
    report['stock_rootfs_entries'] = len(stock_meta)

    overlays = {}
    for name in OVERLAY_NAMES:
        integration = json.loads((ROOT / 'overlays' / name / 'integration.json').read_text())
        for item in integration['files']:
            check(f'overlay {name} {item["path"]}',
                  sha256_file(ROOT / 'overlays' / name / item['path']), item['sha256'])
        overlays[name] = integration
    # The firmware page displays the build identity from the generated theme,
    # so a stale or guessed version must stop the build rather than ship.
    theme_js = (ROOT / 'overlays/opendsl-ui/boaroot/html/opendsl/legacy.js').read_text()
    check('theme release placeholder', '@@OPENDSL_RELEASE@@' in theme_js, False)
    check('theme release identity',
          sorted(set(re.findall(r'\d+\.\d+\.\d+(?:-[a-z]+)?', theme_js))), [version])
    report['overlays'] = {name: overlay['status'] for name, overlay in overlays.items()}
    report['input_checks'] = checks


# --------------------------------------------------------------------------
# staging inside the build container (one fakeroot session per run)
# --------------------------------------------------------------------------

def stage_in_container(run_id, work_root):
    workdir = work_root / f'run-{run_id}'
    assert not workdir.exists(), f'existing workdir must not be reused: {workdir}'
    workdir.mkdir(parents=True)
    argv = ['docker', 'run', '--rm', '--user', '1000:1000', '--network', 'none',
            '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
            '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777', '--workdir', '/work',
            '--mount', f'type=bind,src={STAGE_SCRIPT_DIR},dst=/stage,readonly',
            '--mount', f'type=bind,src={STACK_IMAGE},dst=/analysis,readonly',
            '--mount', f'type=bind,src={STOCK_META},dst=/verify/stock-check2.json,readonly',
            '--mount', f'type=bind,src={ROOT / "overlays"},dst=/overlays,readonly',
            '--mount', f'type=bind,src={ROOT / "build/native"},dst=/native,readonly',
            '--mount', f'type=bind,src={ROOT / "build/vendor-tools"},dst=/vendor-tools,readonly',
            '--mount', f'type=bind,src={workdir},dst=/work',
            '-e', 'SOURCE_DATE_EPOCH=1561756316',
            CONTAINER_ID, 'fakeroot', 'python3', '/stage/stage_pack.py',
            '--run-id', 'staging', '--report', '/work/staging-report.json']
    status = record(argv)
    report = json.loads((workdir / 'staging-report.json').read_text())
    assert report['verify']['result'] == 'metadata and content identical', report['verify']
    return workdir, report


# --------------------------------------------------------------------------
# trx packing with the reviewed vendor tool
# --------------------------------------------------------------------------

def pack_stage(workdir, final_path, kernel_path, rootfs_path, rootfs_len,
               copies_dir=None):
    """Invoke the vendor trx packer; the -f input copies go to copies_dir
    (defaulting beside the output) so releases stay clean of pack inputs."""
    packdir = copies_dir if copies_dir is not None else final_path.parent
    if str(packdir) == str(final_path.parent):
        packdir = packdir / 'pack'
    packdir.mkdir(exist_ok=True)
    kernel_copy = packdir / KERNEL_COPY
    rootfs_copy = packdir / ROOTFS_COPY
    shutil.copyfile(kernel_path, kernel_copy)
    shutil.copyfile(rootfs_path, rootfs_copy)
    argv = [VENDOR_TRX_BIN,
            '-k', str(kernel_size(kernel_path)),
            '-r', str(rootfs_len),
            '-c', VENDOR_TRX_CONFIG,
            '-f', kernel_copy, '-f', rootfs_copy,
            '-o', final_path]
    record(argv)
    assert final_path.exists(), 'trx tool produced no output'
    return final_path


def kernel_size(kernel_path):
    return kernel_path.stat().st_size


# --------------------------------------------------------------------------
# release validation gates
# --------------------------------------------------------------------------

def check_add(report, name, detail=None, pass_=True):
    report['checks'].append({'check': name, 'pass': pass_, 'detail': detail})


def validate_header(report, final_path, kernel_len, stock_rootfs_len):
    stock_header = (STACK_IMAGE / 'header.bin').read_bytes()
    final_header = final_path.read_bytes()[:HEADER_SIZE]
    differences = [i for i in range(HEADER_SIZE) if stock_header[i] != final_header[i]]
    allowed = set(range(0x08, 0x10)) | set(range(0x54, 0x58))
    assert set(differences) <= allowed, \
        f'header differs outside len/crc/rootfs_len regions at {[hex(i) for i in set(differences) - allowed]}'
    assert differences, 'image identical to stock was not expected for a new rootfs'
    rootfs_len = struct.unpack_from('>I', final_header, 0x54)[0]
    assert rootfs_len == final_path.stat().st_size - HEADER_SIZE - kernel_len
    assert struct.unpack_from('>I', final_header, 0x08)[0] == final_path.stat().st_size
    assert final_header[0x58:0x5c] == b'\x00\x00\x00\x00', 'romfile_len must stay zero'
    assert final_header[0x94:HEADER_SIZE] == b'\x00' * (HEADER_SIZE - 0x94), \
        'uninitialised header tail (nand_version/reserved) must be zero like stock'
    assert struct.unpack_from('>I', final_header, 0x50)[0] == kernel_len
    check_add(report, 'release header identical to stock except total len (0x08-0x0f) and rootfs len (0x54-0x57); kernel len (0x50), model tuple, model name, version fields and zeroed opaque bytes preserved',
              {'changed_offsets': sorted(hex(i) for i in differences),
               'total_bytes': final_path.stat().st_size, 'rootfs_len': rootfs_len})


def validate_image(report, final_path, kernel_path, rootfs_path):
    inspect = load_inspect_firmware()
    info, kernel = inspect.inspect_image(final_path.read_bytes())
    # review C02: these host identity checks are release-critical and must
    # survive `python3 -O`, where assert statements would be stripped, so they
    # raise explicit errors instead of using asserts
    if info['model'] != 'DSL-N12E-C1':
        raise RuntimeError(f"parsed model {info['model']!r} is not DSL-N12E-C1")
    final_bytes = final_path.read_bytes()
    kernel_bytes = final_bytes[HEADER_SIZE:HEADER_SIZE + kernel_path.stat().st_size]
    if kernel_bytes != kernel_path.read_bytes():
        raise RuntimeError('kernel region not byte-identical to stock kernel '
                           '(compressed-kernel identity is a release promise)')
    rootfs_slice = final_bytes[HEADER_SIZE + kernel_path.stat().st_size:]
    if rootfs_slice != rootfs_path.read_bytes():
        raise RuntimeError('rootfs region not identical to packed staging image')
    check_add(report, 'bounded 2RDH parse of the release image (magic/lengths/payload CRC/model tuple/LZMA kernel/big-endian SquashFS magic)',
              {'stored_crc': info['checksum']['stored'],
               'kernel_decompressed_bytes': info['kernel']['decompressed_size']})
    report['image'] = {'size': info['size'], 'sha256': info['sha256'], 'md5': info['md5'],
                       'checksum': info['checksum'], 'raw_kernel_decompressed_bytes': info['kernel']['decompressed_size']}


def validate_independently(report, release_dir, workdir):
    rootfs_path = release_dir / 'rootfs.squashfs'
    stage_meta = json.loads((workdir / 'staging-stage-metadata.json').read_text())
    meta_files = [i for i in stage_meta if i['mode'].startswith('-')]
    links_meta = [i for i in stage_meta if i['mode'].startswith('l')]
    dirs_meta = [i for i in stage_meta if i['mode'].startswith('d')]
    special_meta = [i for i in stage_meta if i['mode'][0] not in '-ld']

    listing = run(['7z', 'l', '-slt', rootfs_path]).stdout
    # 7-Zip never lists the archive root itself; the staged metadata contains it
    # (collected from the extraction tree), so exclude it from the comparison.
    dirs_meta = [i for i in dirs_meta if i['path'] != '.']
    blocks, current = [], None
    for line in listing.split('----------\n')[1].splitlines():
        if ' = ' in line:
            key, _, value = line.partition(' = ')
            if current is None:
                current = {}
            current[key] = value
        elif line.strip() == '' and current:
            blocks.append(current)
            current = {}
    if current:
        blocks.append(current)
    counts_7z = {'files': 0, 'links': 0, 'dirs': 0, 'special': 0}
    for block in blocks:
        mode = block.get('Mode', '')[:1]
        bucket = {'-': 'files', 'l': 'links', 'd': 'dirs'}.get(mode, 'special')
        if bucket:
            counts_7z[bucket] += 1
    counts_meta = {'files': len(meta_files), 'links': len(links_meta),
                   'dirs': len(dirs_meta), 'special': len(special_meta)}
    assert counts_7z == counts_meta, (counts_7z, counts_meta)
    check_add(report, 'independent 7-Zip listing entity classes match staged metadata', counts_7z)

    extract_root = release_dir.parent / f'{version_tmpdir(release_dir)}-7zcheck'
    assert not extract_root.exists()
    extract_root.mkdir()
    files_list = release_dir.parent / f'{version_tmpdir(release_dir)}-7zcheck.files'
    files_list.write_text('\n'.join(i['path'] for i in meta_files) + '\n')
    run(['7z', 'x', '-y', '-spd', f'-o{extract_root}', f'-i@{files_list}', rootfs_path])
    for meta in meta_files:
        extracted = extract_root / meta['path']
        assert extracted.is_file(), meta['path']
        assert extracted.stat().st_size == meta['size'], meta['path']
        got = hashlib.sha256(extracted.read_bytes()).hexdigest()
        assert got == meta['sha256'], meta['path']
    shutil.rmtree(extract_root)
    files_list.unlink()
    extracted_dicts = [i['path'] for i in meta_files if i['path'].endswith('.dict')]
    assert extracted_dicts == ['userfs/EN.dict'], extracted_dicts
    check_add(report, 'independent 7-Zip regular-file extraction: sizes and hashes match staged metadata',
              {'files': len(meta_files), 'dictionaries': extracted_dicts})

    page = (workdir / 'staging-stage' / 'boaroot/cgi-bin/Advanced_FirmwareUpgrade_Content.asp').read_bytes().decode('utf-8')
    tokens = {token: (token in page) for token in UPLOAD_CONTRACT}
    assert all(tokens.values()), tokens
    check_add(report, 'staged manual firmware-upload page keeps the multipart POST form contract', tokens)

    contents_report = json.loads((workdir / 'staging-report.json').read_text())
    assert contents_report['verify']['result'] == 'metadata and content identical'


def validate_size(report, final_path):
    status = run(['python3', ROOT / 'tools/check_image_size.py', final_path])
    assertion = 'Size gate passed' in status.stdout
    assert assertion, status.stdout + status.stderr
    lines = status.stdout.splitlines()
    first = lines.index('{')
    last = len(lines) - lines[::-1].index('}')
    detail = json.loads('\n'.join(lines[first:last]))
    check_add(report, 'tools/check_image_size.py size/magic gate', detail)


def validate_size_report(report, release_dir, version):
    size = report['image']['size']
    policy_limit = report['policy']['max_raw_image_bytes']
    assert size <= policy_limit, size
    report['size_budget'] = {'bytes': size, 'limit': policy_limit, 'headroom': policy_limit - size}


# --------------------------------------------------------------------------
# release documents
# --------------------------------------------------------------------------

def write_release_documents(report, release_dir, version, workdir):
    trx_path = release_dir / f'OpenDSL_DSL-N12E-C1_{version}.trx'
    rootfs_path = release_dir / 'rootfs.squashfs'
    stage_report = json.loads((workdir / 'staging-report.json').read_text())
    policy = report['policy']

    def sha(path):
        return sha256_file(path)

    manifest = {
        'kind': 'OpenDSL release manifest (hardware-unverified candidate)',
        'version': version,
        'image': {'file': trx_path.name, 'sha256': sha(trx_path), 'bytes': trx_path.stat().st_size,
                  'md5': hashlib.md5(trx_path.read_bytes()).hexdigest(),
                  'limit_bytes': policy['max_raw_image_bytes']},
        'stock': {'baseline_image_sha256': report['stock']['image_sha256'],
                  'kernel_sha256': report['stock']['kernel_sha256'],
                  'rootfs_sha256': report['stock']['rootfs_sha256']},
        'kernel_bytes': report['stock']['kernel_bytes'],
        'rootfs': {'file': rootfs_path.name, 'sha256': sha(rootfs_path),
                   'bytes': rootfs_path.stat().st_size, 'stock_bytes': report['stock']['rootfs_bytes'],
                   'entries': stage_report['stage']['entries'],
                   'replaced': stage_report['stage']['replaced'],
                   'added': stage_report['stage']['added'],
                   'removed': stage_report['stage']['removed'],
                   'metadata_verification': stage_report['verify']},
        'native_candidates': report['candidates'],
        'staging_runs': {key: value for key, value in report.items() if key.startswith('staging')},
        'overlay_status': report['overlays'],
        'determinism': report['determinism'],
        'roundtrip': report['roundtrip'],
        'checks': report['checks'],
        'security_notes': [
            'The payload CRC is not authentication.',
            'The image installs through the existing local firmware upload page; '
            'no new unattended or cloud-update service is implemented.',
            'A broader 2019-2026 vulnerability audit remains unfinished; no all-fixed claim is warranted.',
            'Flash map, configuration/calibration backup and recovery work remain unperformed; '
            'this is not a bootloader, all-in-one or configuration image.',
        ],
    }
    (release_dir / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


def write_release_checksums(release_dir):
    """Emit checksums for every release document except the list itself.

    The list must be written after all other documents (including RELEASE.md)
    exist; hashing a still-empty checksums.txt produced a self-entry for the
    empty-file digest and made `sha256sum -c` fail.
    """
    with (release_dir / 'checksums.txt').open('w') as checksums:
        for path in sorted(release_dir.iterdir()):
            if path.is_file() and path.name != 'checksums.txt':
                checksums.write(f'{sha256_file(path)}  {path.name}\n')


def verify_release_checksums(release_dir):
    """Verify the published list covers exactly the release files and matches."""
    path = release_dir / 'checksums.txt'
    if not path.is_file():
        raise RuntimeError('checksum verification failed: checksums.txt missing')
    listed = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        digest, separator, name = line.partition('  ')
        if not separator or len(digest) != 64 or not name:
            raise RuntimeError(f'checksum verification failed: malformed line {line!r}')
        listed[name] = digest
    expected = {item.name for item in release_dir.iterdir()
                if item.is_file() and item.name != 'checksums.txt'}
    if set(listed) != expected:
        raise RuntimeError('checksum verification failed: file set mismatch '
                           f'(missing={sorted(expected - set(listed))}, '
                           f'extra={sorted(set(listed) - expected)})')
    for name, digest in listed.items():
        if sha256_file(release_dir / name) != digest:
            raise RuntimeError(f'checksum verification failed: {name} differs from list')


def write_release_notes(report, release_dir, version, workdir):
    trx_path = release_dir / f'OpenDSL_DSL-N12E-C1_{version}.trx'
    rootfs_path = release_dir / 'rootfs.squashfs'
    stage_report = json.loads((workdir / 'staging-report.json').read_text())
    policy = report['policy']
    lines = [
        f'# OpenDSL {version} — hardware-unverified candidate',
        '',
        '**This image has never run on hardware. Boot, DSL/PPP, IPTV, Wi-Fi, IPv4 NAT/DHCP,',
        'native settings pages and a later manual upgrade all remain unverified until',
        'the user installs and tests the candidate on the modem.**',
        '',
        '## Result',
        '',
        f'- File: `build/release/{version}/{trx_path.name}` — `{trx_path.stat().st_size:,}` bytes',
        f'  (limit `{policy["max_raw_image_bytes"]:,}`, sha256 `{sha256_file(trx_path)}`).',
        f'- Stock compressed kernel kept byte-for-byte (`{report["stock"]["kernel_sha256"]}`).',
        f'- Stock rootfs: `{report["stock"]["rootfs_bytes"]:,}` bytes extracted into a NEW staging',
        '  directory inside one fakeroot session in the pinned build container.',
        '- Overlays applied, frozen native candidates installed, 18 foreign dictionaries removed.',
        f'- Rebuilt rootfs: `{rootfs_path.stat().st_size:,}` bytes (sha256 `{sha256_file(rootfs_path)}`),',
        '  packed with `mksquashfs-lzma -be -noappend` at SOURCE_DATE_EPOCH=1561756316.',
        '',
        '## Passed checks',
        '',
    ]
    for check in report['checks']:
        lines.append(f'- {check["check"]}')
    lines += [
        '',
        '## Tree changes applied',
        '',
        f'- Replaced: {", ".join(stage_report["stage"]["replaced"])}',
        f'- Added: {", ".join(stage_report["stage"]["added"])}',
        f'- Removed: {", ".join(stage_report["stage"]["removed"])}',
        '',
        '## Still open (hardware testing and post-release work)',
        '',
        '- Device boot, DSL/PPP, IPTV, Wi-Fi/IGMP, IPv4 NAT/firewall, DHCP/DNS and native pages.',
        '- Second manual upgrade (this candidate receives the next OpenDSL image).',
        '- Flash map, configuration/calibration backup and recovery work remain unperformed; '
        'this is not a bootloader, all-in-one or configuration image.',
        '- Monitor retirement: rstats/spectrum/sysstate binaries are retained as on-demand tools;',
        '  they no longer start at boot and the spectrum web page can still launch `spectrum` on',
        '  demand. Removing the binaries plus hooks/pages was not performed because size headroom',
        '  made it unnecessary and the removal would need its own caller audit.',
        '',
    ]
    (release_dir / 'RELEASE.md').write_text('\n'.join(lines) + '\n')


def version_tmpdir(release_dir):
    return release_dir.name


# --------------------------------------------------------------------------
# main flow
# --------------------------------------------------------------------------

def build(version):
    report = {'input_checks': []}
    verify_inputs(report, version)
    inspect_image_status = run(['docker', 'image', 'inspect', CONTAINER_IMAGE])
    actual_id = json.loads(inspect_image_status.stdout)[0]['Id']
    assert actual_id == CONTAINER_ID, (actual_id, CONTAINER_ID)
    report['container'] = {'image': CONTAINER_IMAGE, 'id': actual_id}
    report['checks'] = []

    work_root = ROOT / 'build/release/work'
    # a fresh build never resumes; drop leftovers from any failed earlier run
    # (stage_pack itself still refuses to reuse a populated per-run directory)
    for stale in sorted(work_root.glob('run-*')) + sorted(work_root.glob('*-pack')):
        if stale.is_dir() and not stale.is_symlink():
            shutil.rmtree(stale)
    work_root.mkdir(parents=True, exist_ok=True)
    report['roundtrip'] = []
    runs = {}
    rootfs_len = None
    for run_id in ('runA', 'runB'):
        workdir, stage_report = stage_in_container(run_id, work_root)
        squash = workdir / 'staging-rootfs.squashfs'
        rootfs_len = squash.stat().st_size
        report[f'staging_{run_id}'] = {'sha256': sha256_file(squash), 'bytes': rootfs_len,
                                       'stage_entries': stage_report['stage']['entries']}
        runs[run_id] = workdir
    sha_a = sha256_file(runs['runA'] / 'staging-rootfs.squashfs')
    sha_b = sha256_file(runs['runB'] / 'staging-rootfs.squashfs')
    assert sha_a == sha_b, f'SquashFS differs between staging runs: {sha_a} vs {sha_b}'
    report['determinism'] = {'squashfs_sha256': sha_a, 'reproduced_across_runs': True}

    kernel_path = STACK_IMAGE / 'kernel.lzma'
    kernel_len = kernel_path.stat().st_size
    stock_rootfs_len = (STACK_IMAGE / 'rootfs.squashfs').stat().st_size
    work_root.mkdir(parents=True, exist_ok=True)
    # --- NO-CHANGE packer roundtrip, twice (fresh malloc per process) ---------
    roundtrip_dir = work_root / 'roundtrip'
    roundtrip_dir.mkdir(exist_ok=True)
    for index in (0, 1):
        target = roundtrip_dir / f'roundtrip-{index}.trx'
        pack_stage(roundtrip_dir, target, kernel_path, STACK_IMAGE / 'rootfs.squashfs', stock_rootfs_len)
        got = target.read_bytes()
        want = (STACK_IMAGE / 'firmware.trx').read_bytes()
        if got != want:
            difference = min((i for i in range(min(len(got), len(want)))
                              if got[i] != want[i]), default=None)
            raise RuntimeError(f'vendor trx no-change roundtrip #{index} differs from stock '
                               f'({len(got)} vs {len(want)} bytes), first diff at {difference}')
        report['roundtrip'].append({'roundtrip': index, 'sha256': sha256_file(target), 'identical': True})
        target.unlink()

    # --- release directory --------------------------------------------------
    release_dir = ROOT / 'build/release' / version
    assert not release_dir.exists(), f'release dir already exists: {release_dir}'
    release_dir.mkdir(parents=True)
    final_path = release_dir / f'OpenDSL_DSL-N12E-C1_{version}.trx'
    release_pack_dir = work_root / 'release-pack'
    release_pack_dir.mkdir(exist_ok=True)
    pack_stage(release_pack_dir, final_path, kernel_path,
               runs['runA'] / 'staging-rootfs.squashfs', rootfs_len,
               copies_dir=release_pack_dir)
    validate_header(report, final_path, kernel_len, stock_rootfs_len)
    validate_image(report, final_path, kernel_path, runs['runA'] / 'staging-rootfs.squashfs')
    shutil.copyfile(runs['runA'] / 'staging-rootfs.squashfs', release_dir / 'rootfs.squashfs')
    assert sha256_file(release_dir / 'rootfs.squashfs') == sha_a

    # the release trx from run B must be identical -> whole artifact reproducible
    compare_dir = work_root / 'run-B-pack'
    compare_dir.mkdir(exist_ok=True)
    compare_trx = compare_dir / f'OpenDSL_DSL-N12E-C1_{version}.trx'
    pack_stage(compare_dir, compare_trx, kernel_path,
               runs['runB'] / 'staging-rootfs.squashfs', rootfs_len)
    assert sha256_file(compare_trx) == sha256_file(final_path), 'release trx not reproducible'
    report['determinism']['release_trx_reproduced'] = True

    validate_size(report, final_path)
    validate_independently(report, release_dir, runs['runA'])
    validate_size_report(report, release_dir, version)
    write_release_documents(report, release_dir, version, runs['runA'])
    write_release_notes(report, release_dir, version, runs['runA'])
    write_release_checksums(release_dir)
    verify_release_checksums(release_dir)
    print(json.dumps({'release': str(final_path), 'bytes': final_path.stat().st_size,
                      'limit': report['policy']['max_raw_image_bytes'],
                      'sha256': sha256_file(final_path)}, indent=2))


# --------------------------------------------------------------------------
# re-validation of an existing release directory
# --------------------------------------------------------------------------

def validate_release_artifacts(release_dir):
    """Check published bytes and image boundaries without workspace comparison."""
    def fail(message):
        raise RuntimeError(f'release verification failed: {message}')

    release_dir = Path(release_dir).resolve()
    manifest_path = release_dir / 'release-manifest.json'
    if not manifest_path.is_file():
        fail('not a release directory (missing release-manifest.json)')
    manifest = json.loads(manifest_path.read_text())
    trx_path = release_dir / manifest['image']['file']
    rootfs_path = release_dir / manifest['rootfs']['file']
    if sha256_file(trx_path) != manifest['image']['sha256']:
        fail('trx differs from manifest')
    if sha256_file(rootfs_path) != manifest['rootfs']['sha256']:
        fail('rootfs differs from manifest')
    try:
        verify_release_checksums(release_dir)
    except RuntimeError as error:
        fail(str(error))
    for check in manifest['checks']:
        if not check.get('pass'):
            fail(f"stored check failure: {check}")

    report = {'input_checks': [], 'checks': []}
    kernel_path = STACK_IMAGE / 'kernel.lzma'

    # bounded superblock gate on the packed filesystem (plainly unsupported
    # images are rejected before any extraction)
    data = rootfs_path.read_bytes()
    if data[:4] != b'sqsh':
        fail(f'rootfs.magic {data[:4]!r}')
    if data[28:30] != b'\x00\x03':
        fail('rootfs SquashFS major != 3')
    if int.from_bytes(data[8:12], 'big') != 0:
        fail('rootfs superblock mkfs_time is not the stock value 0')

    stock_header = (STACK_IMAGE / 'header.bin').read_bytes()
    final_header = trx_path.read_bytes()[:HEADER_SIZE]
    differences = [i for i in range(HEADER_SIZE) if stock_header[i] != final_header[i]]
    allowed = set(range(0x08, 0x10)) | set(range(0x54, 0x58))
    if not set(differences) <= allowed:
        fail('header differs outside allowed regions at '
             + repr([hex(i) for i in sorted(set(differences) - allowed)]))
    if final_header[0x94:HEADER_SIZE] != b'\x00' * (HEADER_SIZE - 0x94):
        fail('reserved header tail not zero')
    if final_header[0x58:0x5c] != b'\x00\x00\x00\x00':
        fail('romfile_len not zero')
    check_add(report, 'release header holds the stock layout except total len / payload crc / rootfs len',
              {'changed_offsets': [hex(i) for i in differences]})
    validate_image(report, trx_path, kernel_path, rootfs_path)
    validate_size(report, trx_path)
    return manifest, report


def validate_release(release_dir):
    """Verify artifacts, current inputs and the complete decoded filesystem."""
    release_dir = Path(release_dir).resolve()
    manifest, report = validate_release_artifacts(release_dir)
    verify_inputs(report, manifest['version'])
    trx_path = release_dir / manifest['image']['file']

    # full structural re-verification inside the pinned container: fresh
    # extraction + metadata/content compare against the data-driven expected
    # tree, upload contract on extracted bytes
    work_root = ROOT / 'build/release/work'
    workdir = work_root / f'release-verify-{release_dir.name}'
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)
    argv = ['docker', 'run', '--rm', '--user', '1000:1000', '--network', 'none',
            '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
            '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777', '--workdir', '/work',
            '--mount', f'type=bind,src={STAGE_SCRIPT_DIR},dst=/stage,readonly',
            '--mount', f'type=bind,src={STOCK_META},dst=/verify/stock-check2.json,readonly',
            '--mount', f'type=bind,src={ROOT / "overlays"},dst=/overlays,readonly',
            '--mount', f'type=bind,src={ROOT / "build/native"},dst=/native,readonly',
            '--mount', f'type=bind,src={ROOT / "build/vendor-tools"},dst=/vendor-tools,readonly',
            '--mount', f'type=bind,src={release_dir},dst=/release,readonly',
            '--mount', f'type=bind,src={workdir},dst=/work',
            '-e', 'SOURCE_DATE_EPOCH=1561756316',
            CONTAINER_ID, 'fakeroot', 'python3', '/stage/stage_pack.py',
            '--mode', 'release-verify', '--run-id', 'release-verify',
            '--release-rootfs', '/release/rootfs.squashfs',
            '--report', '/work/release-verify-report.json']
    record(argv)
    structural = json.loads((workdir / 'release-verify-report.json').read_text())
    if structural['entries'] != structural['expected_entries'] \
            or 'identical' not in structural['result']:
        raise RuntimeError(f'release verification failed: manifest structural re-verification mismatch: {structural["result"]}')
    report['structural'] = structural
    print(json.dumps({'release': str(trx_path), 'status': 'all static gates passed',
                      'size': report['image']['size'], 'sha256': sha256_file(trx_path),
                      'filesystem': structural['result']}, indent=2))


def main():
    # review C02: refuse optimized execution outright. `-O`/PYTHONOPTIMIZE
    # would strip assert statements from release-critical checks; the
    # environment must not be able to weaken the verifier.
    if sys.flags.optimize:
        raise RuntimeError('refusing optimized execution (python -O / '
                           'PYTHONOPTIMIZE): release-critical checks must not '
                           'be skippable by interpreter settings')

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default=DEFAULT_VERSION)
    parser.add_argument('--validate-only', type=Path, const=None, nargs='?',
                        metavar='RELEASE_DIR',
                        help='re-run static gates over an existing release '
                             'directory (default: the current --version)')
    args = parser.parse_args()
    if args.validate_only is not None or '--validate-only' in sys.argv:
        validate_release(args.validate_only or ROOT / 'build/release' / args.version)
    else:
        build(args.version)


if __name__ == '__main__':
    main()
