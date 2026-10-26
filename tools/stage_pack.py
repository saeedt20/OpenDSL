#!/usr/bin/env python3
"""Build one release staging tree and its SquashFS image, or re-verify a packed one.

Runs INSIDE ONE fakeroot session inside the pinned build container, mounting:

  /analysis     analysis/verified       (ro) stock evidence: rootfs.squashfs
  /verify       stock-check2.json       (ro) frozen metadata of all 1093 entries
  /overlays     overlays/               (ro) four packable overlays
  /native       build/native/           (ro) frozen rc/boa candidates + manifests
  /vendor-tools build/vendor-tools/     (ro) vendor squashfs host tools
  /work         writable work directory for this single run
  /release      (release-verify mode)   (ro) the release directory

Host tooling only: unsquashfs/mksquashfs are reviewed host binaries from the
vendor tree and pyelftools reads staged ELF headers; no MIPS target code is
executed. All inputs are hash-checked before copying; the staged tree is
compared entry-by-entry against the frozen stock metadata plus the explicit
modification table; the packed SquashFS is re-extracted and re-compared.

Modes:
  staging         build one release staging tree and pack it (the default).
  release-verify  review A03 fix: rebuild the expected tree purely from the
                  frozen inputs and compare a packed release rootfs against it.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).parent))
from rootfs_metadata import collect  # noqa: E402

RELEASE_EPOCH = 1561756316  # stock rootfs mkfs_time (2019-06-28T21:11:56Z)
INFOLINES = 40

# overlay name -> subtree directories packed (must equal each integration.json)
OVERLAYS = {
    'security': ['boaroot', 'usr'],
    'lean-ipv4': ['rootfs'],
    'native-english': ['boaroot', 'userfs'],
    'opendsl-ui': ['boaroot'],
}
DEFAULTS_FILE_MODE = 0o644
DEFAULT_DIR_MODE = 0o755
CANDIDATES = [('userfs/bin/boa', 'out/candidate/boa'), ('sbin/rc', 'out/candidate/rc')]
DICT_KEEP = 'userfs/EN.dict'
DICT_RE = re.compile(r'^userfs/[A-Z]{2}\.dict$')
UPLOAD_CONTRACT = ('multipart/form-data', 'tools_FW_UploadFile',
                   'request_Form("postflag")', 'form.postflag.value = "1"',
                   'HTML_HEADER_TYPE', 'value_NONE')


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def run_tool(argv, log_path, env=None):
    with open(log_path, 'w') as log:
        status = subprocess.run([str(item) for item in argv], stdout=log,
                                stderr=subprocess.STDOUT, env=env)
    if status.returncode != 0:
        tail = Path(log_path).read_text().splitlines()[-INFOLINES:]
        raise RuntimeError(f"{argv[0]} failed ({status.returncode}):\n" + '\n'.join(tail))


def perms_from_string(mode_string):
    """drwxr-xr-x style -> permission bits; setuid/setgid/sticky are included."""
    extra = {'s': 0o6000, 'S': 0o4000, 't': 0o1000}
    special = 0
    permissions = 0
    for group in range(3):
        value = 0
        for char in mode_string[1 + group * 3:4 + group * 3]:
            value += {'r': 4, 'w': 2, 'x': 1, '-': 0}.get(char, 0)
            special += extra.get(char, 0)
        permissions = (permissions << 3) | value
    return permissions | special


def merge_expected(stock, replacements, additions, removals):
    """stock metadata list + explicit changes, sorted like collect() output."""
    by_path = {item['path']: dict(item) for item in stock}
    for path in removals:
        by_path.pop(path, None)
    for path, info in list(replacements.items()) + list(additions.items()):
        if path in removals:
            raise RuntimeError(f'changed entry also pruned: {path}')
        by_path[path] = info
    return sorted(by_path.values(), key=lambda item: item['path'])


def compare_full(expected, actual, label):
    exp_map = {item['path']: item for item in expected}
    act_map = {item['path']: item for item in actual}
    problems = []
    for path in sorted(set(exp_map) | set(act_map)):
        expected_item, actual_item = exp_map.get(path), act_map.get(path)
        if expected_item is None:
            problems.append(f'+ unexpected {path}')
        elif actual_item is None:
            problems.append(f'- missing {path}')
        else:
            for key in set(expected_item) | set(actual_item):
                if expected_item.get(key) != actual_item.get(key):
                    problems.append(f'~ {path}: {key} expected '
                                    f'{expected_item.get(key)!r} got {actual_item.get(key)!r}')
    if problems:
        raise RuntimeError(f'{label} differences:\n' + '\n'.join(problems))


def rebuild_expected_tables():
    """Data-driven expected tree: stock metadata minus pruned dicts plus the
    explicit overlay/candidate changes. Independent of any staging work dir.
    Returns (frozen, replaced, additions, removals, expected_sorted)."""
    frozen = json.loads(Path('/verify/stock-check2.json').read_text())
    assert len(frozen) == 1093, len(frozen)
    stock_by_path = {item['path']: item for item in frozen}

    replaced, additions, removals = {}, {}, []
    for name, expected_subtrees in OVERLAYS.items():
        overlay = Path('/overlays') / name
        integration = json.loads((overlay / 'integration.json').read_text())
        subtrees = ([integration['pack_subtree'], integration['extra_pack_subtree']]
                    if integration.get('extra_pack_subtree')
                    else [integration['pack_subtree']])
        if sorted(subtrees) != sorted(expected_subtrees):
            raise RuntimeError(f'{name}: subtree mismatch {subtrees}')
        for entry in sorted(integration['files'], key=lambda item: item['path']):
            path = entry['path']
            first, _, rest = path.partition('/')
            if first not in subtrees:
                raise RuntimeError(f'{name}: {path} outside subtree')
            rest_target = rest if first == 'rootfs' else path
            source = overlay / path
            if sha256_file(source) != entry['sha256'] or source.stat().st_size != entry['size']:
                raise RuntimeError(f'{name}: overlay source mismatch {path}')
            if rest_target in stock_by_path:
                stock = stock_by_path[rest_target]
                if not stock['mode'].startswith('-'):
                    raise RuntimeError((name, path, 'replaced target is not a regular file'))
                if rest_target in additions:
                    raise RuntimeError(f'{name}: replaced/additions clash {rest_target}')
                replaced[rest_target] = dict(path=rest_target, mode=stock['mode'],
                                             uid=0, gid=0, mtime=RELEASE_EPOCH,
                                             size=entry['size'], sha256=entry['sha256'])
            else:
                if rest_target in replaced:
                    raise RuntimeError(f'{name}: added/replacements clash {rest_target}')
                additions[rest_target] = dict(
                    path=rest_target, mode=stat.filemode(stat.S_IFREG | DEFAULTS_FILE_MODE),
                    uid=0, gid=0, mtime=RELEASE_EPOCH,
                    size=entry['size'], sha256=entry['sha256'])
                # any intermediate ancestor directories created for this file
                parts = rest_target.split('/')[:-1]
                for depth in range(1, len(parts) + 1):
                    directory = '/'.join(parts[:depth])
                    if directory in stock_by_path or directory in additions:
                        continue
                    additions[directory] = dict(
                        path=directory, mode=stat.filemode(stat.S_IFDIR | DEFAULT_DIR_MODE),
                        uid=0, gid=0, mtime=RELEASE_EPOCH)

    freeze = json.loads(Path('/native/FREEZE.json').read_text())
    frozen_hashes = {item['path']: item['sha256'] for item in freeze['files']
                     if item['path'].startswith('build/native/out/candidate')}
    frozen_sizes = {item['path']: item['size'] for item in freeze['files']
                    if item['path'].startswith('build/native/out/candidate')}
    for destination, candidate in CANDIDATES:
        source = Path('/native') / candidate
        full_key = f'build/native/{candidate}'
        if sha256_file(source) != frozen_hashes.get(full_key) \
                or source.stat().st_size != frozen_sizes.get(full_key):
            raise RuntimeError(f'candidate freeze mismatch: {candidate}')
        if destination not in stock_by_path:
            raise RuntimeError(f'candidate destination not in stock: {destination}')
        stock = stock_by_path[destination]
        if not stock['mode'].startswith('-'):
            raise RuntimeError(destination)
        # candidate content is frozen; the staged tree places it at RELEASE_EPOCH
        replaced[destination] = dict(path=destination, mode=stock['mode'], uid=0, gid=0,
                                     mtime=RELEASE_EPOCH,
                                     size=frozen_sizes[full_key], sha256=frozen_hashes[full_key])

    dicts = sorted(item['path'] for item in frozen if DICT_RE.match(item['path']))
    if len(dicts) != 19 or DICT_KEEP not in dicts:
        raise RuntimeError(dicts)
    removals = [path for path in dicts if path != DICT_KEEP]
    if any(path in replaced or path in additions for path in removals):
        raise RuntimeError('pruned dictionary is also replaced/added')
    return frozen, replaced, additions, removals, \
        merge_expected(frozen, replaced, additions, removals)


def verify_release_mode(args, tools):
    """Review A03 fix: re-verify a packed release filesystem from frozen inputs
    alone. Bounded superblock gate, then a fresh extraction compared metadata-
    and content-wise against the data-driven tables plus the upload contract.
    No dependency on old staging work dirs."""
    work = Path('/work')
    logs = work / 'release-verify-logs'
    tree = work / 'release-verify-tree'
    for path in (logs, tree):
        if path.exists():
            raise RuntimeError(f'path already exists, refusing to reuse: {path}')
    logs.mkdir(parents=True)
    rootfs = Path(args.release_rootfs)
    if not rootfs.is_file():
        raise RuntimeError(f'release rootfs not found: {args.release_rootfs}')

    data = rootfs.read_bytes()
    if data[:4] != b'sqsh':
        raise RuntimeError(f'not a big-endian SquashFS image: magic {data[:4]!r}')
    if data[28:30] != b'\x00\x03':
        raise RuntimeError(f'unsupported SquashFS major version '
                           f'{int.from_bytes(data[28:30], "big")} (rootfs bytes 28-29); '
                           'not the supported big-endian 3.x layout')
    mkfs_time = int.from_bytes(data[8:12], 'big')
    if mkfs_time != 0:
        raise RuntimeError(f'rootfs superblock mkfs_time {mkfs_time} != stock (0); '
                           'the packed filesystem header does not match the pinned stock layout')

    _, _, _, _, expected = rebuild_expected_tables()
    run_tool([tools / 'unsquashfs-lzma', '-dest', tree, str(rootfs)],
             logs / 'reunpack.log')
    extracted = collect(tree)
    compare_full(expected, extracted, 'release filesystem vs expected changed tree')

    page = tree / 'boaroot/cgi-bin/Advanced_FirmwareUpgrade_Content.asp'
    tokens = {token: (token in page.read_text(errors='replace')) for token in UPLOAD_CONTRACT}
    missing = sorted(t for t, present in tokens.items() if not present)
    if missing:
        raise RuntimeError(f'manual upload contract tokens missing: {missing}')

    report = {
        'mode': 'release-verify',
        'release_rootfs': str(args.release_rootfs),
        'entries': len(extracted),
        'expected_entries': len(expected),
        'result': 'metadata and content identical; upload contract intact',
        'upload_contract': tokens,
        'rootfs': {'sha256': sha256_file(rootfs), 'bytes': rootfs.stat().st_size},
    }
    Path(args.report).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'ok': True, 'mode': 'release-verify',
                      'entries': report['entries'], 'expected': report['expected_entries'],
                      'rootfs_sha256': report['rootfs']['sha256']}))


def main():
    # review C02: refuse optimized execution outright, for the same reason as
    # tools/build_image.py: asserts here gate staging/verify decisions that
    # must never be silently removable from the command line.
    if sys.flags.optimize:
        raise RuntimeError('refusing optimized execution (python -O / '
                           'PYTHONOPTIMIZE): release-critical checks must not '
                           'be skippable by interpreter settings')

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--mode', choices=('staging', 'release-verify'), default='staging')
    parser.add_argument('--release-rootfs', default=None)
    args = parser.parse_args()

    tools = Path('/vendor-tools/squashfs-tools')
    if args.mode == 'release-verify':
        verify_release_mode(args, tools)
        return

    _staging_mode(args, tools)


def _staging_mode(args, tools):
    work = Path('/work')
    stage = work / f'{args.run_id}-stage'
    verify_dir = work / f'{args.run_id}-verify'
    logs = work / f'{args.run_id}-logs'
    squash_out = work / f'{args.run_id}-rootfs.squashfs'
    report = {}
    for path in (stage, verify_dir, logs, squash_out,
                 work / f'{args.run_id}-stage-metadata.json'):
        assert not path.exists(), f'path already exists, refusing to reuse: {path}'
    logs.mkdir(parents=True)
    epoch = str(RELEASE_EPOCH)

    def apply_attrs(path, mode, owner=(0, 0), mtime=RELEASE_EPOCH):
        os.chmod(path, mode)
        os.chown(path, *owner)
        os.utime(path, (mtime, mtime))

    ensure_dirs_state = {'created': set()}

    def ensure_dirs(target):
        for parent in target.parents:
            if not parent.is_relative_to(stage) or parent == stage:
                break
            if not parent.exists():
                parent.mkdir()
                apply_attrs(parent, DEFAULT_DIR_MODE)
                ensure_dirs_state['created'].add(parent.relative_to(stage).as_posix())

    def ancestor_paths(relative_path):
        """Shallowest-to-deepest stage-relative ancestor dirs ('.' included)."""
        current = stage if relative_path == '.' else stage / relative_path
        ancestors = []
        for parent in current.parents:
            if parent == stage:
                ancestors.append('.')
                break
            if parent.is_relative_to(stage):
                ancestors.append(parent.relative_to(stage).as_posix())
        return ancestors

    # --- 1. unpack the verified stock SquashFS -------------------------------
    tools = Path('/vendor-tools/squashfs-tools')
    vendor_manifest = json.loads(Path('/vendor-tools/build-manifest.json').read_text())
    for item in vendor_manifest['tools']:
        got = sha256_file(Path('/vendor-tools') / item['path'])
        assert got == item['sha256'], (item['path'], got)
    run_tool([tools / 'unsquashfs-lzma', '-dest', stage, '/analysis/rootfs.squashfs'],
             logs / 'unpack.log')

    frozen = json.loads(Path('/verify/stock-check2.json').read_text())
    assert len(frozen) == 1093, len(frozen)
    stock_by_path = {item['path']: item for item in frozen}
    root_record = stock_by_path['.']
    apply_attrs(stage, perms_from_string(root_record['mode']),
                mtime=root_record['mtime'])
    extracted = collect(stage)
    compare_full(frozen, extracted, 'stock extraction vs frozen stock metadata')
    stage_paths = {item['path'] for item in extracted}

    replaced, additions, removals = {}, {}, []
    affected_dirs = set()

    def mark_affected(destination_path):
        affected_dirs.update(ancestor_paths(destination_path))

    # --- 2. overlays ----------------------------------------------------------
    for name, expected_subtrees in OVERLAYS.items():
        overlay = Path('/overlays') / name
        integration = json.loads((overlay / 'integration.json').read_text())
        subtrees = ([integration['pack_subtree'], integration['extra_pack_subtree']]
                    if integration.get('extra_pack_subtree')
                    else [integration['pack_subtree']])
        assert sorted(subtrees) == sorted(expected_subtrees), (name, subtrees)
        for entry in sorted(integration['files'], key=lambda item: item['path']):
            path = entry['path']
            first, _, rest = path.partition('/')
            assert first in subtrees, (name, path)
            rest_target = rest if first == 'rootfs' else path
            source = overlay / path
            assert sha256_file(source) == entry['sha256'], (name, path)
            assert source.stat().st_size == entry['size'], (name, path)
            target = stage / rest_target
            ensure_dirs(target)
            is_replacement = rest_target in stage_paths
            if is_replacement:
                assert stat.S_ISREG(target.lstat().st_mode), \
                    (name, path, 'replaced target is not a regular file')
                apply_modes = stat.S_IMODE(target.lstat().st_mode)
                target.unlink()
            else:
                apply_modes = DEFAULTS_FILE_MODE
            target.write_bytes(source.read_bytes())
            file_mode = stat.S_IFREG | apply_modes
            os.chmod(target, apply_modes)
            os.chown(target, 0, 0)
            os.utime(target, (RELEASE_EPOCH, RELEASE_EPOCH))
            installed = dict(path=rest_target,
                             mode=stat.filemode(os.stat(target).st_mode).replace('?', 'r'),
                             uid=0, gid=0, mtime=RELEASE_EPOCH,
                             size=target.stat().st_size, sha256=sha256_file(target))
            assert installed['sha256'] == entry['sha256']
            if is_replacement:
                assert rest_target not in additions
                replaced[rest_target] = installed
            else:
                assert rest_target not in replaced
                additions[rest_target] = installed
            mark_affected(rest_target)

    # --- 3. frozen native candidates -------------------------------------------
    native_manifest = json.loads(Path('/native/native-manifest.json').read_text())
    freeze = json.loads(Path('/native/FREEZE.json').read_text())
    frozen_hashes = {item['path']: item['sha256'] for item in freeze['files']
                     if item['path'].startswith('build/native/out/candidate')}
    frozen_sizes = {item['path']: item['size'] for item in freeze['files']
                    if item['path'].startswith('build/native/out/candidate')}
    from elftools.elf.elffile import ELFFile
    for destination, candidate in CANDIDATES:
        source = Path('/native') / candidate
        full_key = f'build/native/{candidate}'
        assert sha256_file(source) == frozen_hashes[full_key], candidate
        assert source.stat().st_size == frozen_sizes[full_key], candidate
        target = stage / destination
        assert target.exists() and stat.S_ISREG(target.lstat().st_mode), destination
        vary = stat.S_IMODE(target.lstat().st_mode)
        target.unlink()
        target.write_bytes(source.read_bytes())
        os.chmod(target, vary)
        os.chown(target, 0, 0)
        os.utime(target, (RELEASE_EPOCH, RELEASE_EPOCH))
        replaced[destination] = dict(path=destination,
                                     mode=stat.filemode(stat.S_IFREG | vary),
                                     uid=0, gid=0, mtime=RELEASE_EPOCH,
                                     size=target.stat().st_size, sha256=sha256_file(target))
        # the frozen per-ELF ABI record (interpreter/DT_NEEDED/machine/flags)
        elf = ELFFile(io.BytesIO(target.read_bytes()))
        dynamic = elf.get_section_by_name('.dynamic')
        installed_abi = {
            'elf_class': elf.elfclass, 'little_endian': elf.little_endian,
            'machine': elf.header['e_machine'], 'flags': hex(elf.header['e_flags']),
            'interpreter': [s.get_interp_name() for s in elf.iter_segments()
                            if s['p_type'] == 'PT_INTERP'],
            'needed': [t.needed for t in dynamic.iter_tags() if t.entry.d_tag == 'DT_NEEDED'],
        }
        frozen_record = native_manifest[candidate.split('/')[-1]]['candidate']
        for key, value in installed_abi.items():
            assert value == frozen_record[key], (destination, key, value, frozen_record[key])
        mark_affected(destination)

    # --- 4. dictionary pruning ---------------------------------------------------
    dicts = sorted('userfs/' + item.name for item in (stage / 'userfs').iterdir()
                   if item.name.endswith('.dict'))
    assert all(DICT_RE.match(item) for item in dicts), dicts
    assert len(dicts) == 19 and DICT_KEEP in dicts, dicts
    for path in dicts:
        if path != DICT_KEEP:
            (stage / path).unlink()
            mark_affected(path)
    removals = [path for path in dicts if path != DICT_KEEP]
    assert (stage / DICT_KEEP).exists()

    for item in collect(stage):
        if item['mode'].startswith('l'):
            assert not re.search(r'[A-Z]{2}\.dict', item.get('target', '')), item

    # --- 5. restore directory metadata, snapshot, compare -------------------------
    for relative_dir in sorted(affected_dirs | {'.'}):
        directory = stage if relative_dir == '.' else stage / relative_dir
        if relative_dir in ensure_dirs_state['created']:
            apply_attrs(directory, DEFAULT_DIR_MODE)
            additions[relative_dir] = dict(path=relative_dir,
                                           mode=stat.filemode(stat.S_IFDIR | DEFAULT_DIR_MODE),
                                           uid=0, gid=0, mtime=RELEASE_EPOCH)
        else:
            record = stock_by_path[relative_dir]
            assert not record['mode'].startswith('l'), relative_dir
            apply_attrs(directory, perms_from_string(record['mode']),
                        mtime=record['mtime'])

    stage_metadata = collect(stage)
    expected_stage = merge_expected(frozen, replaced, additions, removals)
    # belt-and-braces: the data-driven expected tables must equal the staged
    # deltas exactly, so that the release-verify mode checks the same target tree
    static_replaced, static_additions, static_removals, static_expected = \
        rebuild_expected_tables()[1:]
    if (replaced != static_replaced or additions != static_additions
            or removals != static_removals or expected_stage != static_expected):
        raise RuntimeError(
            'staged delta tables diverged from the data-driven expected tables:\n'
            f'staged: replaced={sorted(replaced)} added={sorted(additions)} '
            f'removed={sorted(removals)}\n'
            f'static: replaced={sorted(static_replaced)} added={sorted(static_additions)} '
            f'removed={sorted(static_removals)}')
    (work / f'{args.run_id}-stage-metadata.json').write_text(json.dumps(stage_metadata, indent=2))
    report['stage'] = {
        'entries': len(stage_metadata), 'replaced': sorted(replaced),
        'added': sorted(additions), 'removed': removals,
        'raw_bytes': sum(item.get('size', 0) for item in stage_metadata),
    }

    # --- 6. pack SquashFS ---------------------------------------------------------
    run_tool([tools / 'mksquashfs-lzma', stage, squash_out, '-be', '-noappend'],
             logs / 'mksquashfs.log', env=dict(os.environ, SOURCE_DATE_EPOCH=epoch))
    report['squashfs'] = {'sha256': sha256_file(squash_out), 'bytes': squash_out.stat().st_size}

    # --- 7. independent re-extraction comparison ----------------------------------
    run_tool([tools / 'unsquashfs-lzma', '-dest', verify_dir, squash_out],
             logs / 'reunpack.log')
    verify_metadata = collect(verify_dir)
    compare_full(stage_metadata, verify_metadata, 're-extracted image vs staged tree')
    report['verify'] = {'entries': len(verify_metadata),
                        'result': 'metadata and content identical'}

    work.joinpath(f'{args.run_id}-report.json').write_text(json.dumps(report, indent=2))
    Path(args.report).write_text(json.dumps(report, indent=2))
    print(json.dumps({'ok': True, 'run_id': args.run_id,
                      'squashfs_sha256': report['squashfs']['sha256'],
                      'squashfs_bytes': report['squashfs']['bytes']}))


if __name__ == '__main__':
    main()
