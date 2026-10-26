#!/usr/bin/env python3
"""Inspect actual build/verification argv with container execution stubbed."""
import json
import io
from contextlib import redirect_stdout
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_image

commands = []


def record(argv):
    commands.append(argv)
    mount = next(item for item in argv if ',dst=/work' in str(item))
    work = Path(mount.split('src=', 1)[1].split(',dst=', 1)[0])
    if '--mode' in argv:
        report = {'entries': 1, 'expected_entries': 1, 'result': 'metadata and content identical'}
        name = 'release-verify-report.json'
    else:
        report = {'verify': {'result': 'metadata and content identical'}}
        name = 'staging-report.json'
    (work / name).write_text(json.dumps(report))


with tempfile.TemporaryDirectory(prefix='opendsl-pin-') as tmp:
    root = Path(tmp)
    (root / 'release').mkdir()
    (root / 'release/fixture.trx').write_bytes(b'fixture')
    manifest = {'version': 'fixture', 'image': {'file': 'fixture.trx'}}
    report = {'image': {'size': 1, 'sha256': 'fixture'}}
    with patch.multiple(build_image, ROOT=root, record=record,
                        verify_inputs=lambda *args: None,
                        validate_release_artifacts=lambda *args: (manifest, report)):
        build_image.stage_in_container('fixture', root / 'work')
        with redirect_stdout(io.StringIO()):
            build_image.validate_release(root / 'release')
    assert len(commands) == 2
    for command in commands:
        assert build_image.CONTAINER_ID in command, 'container is not pinned by image ID'
        assert build_image.CONTAINER_IMAGE not in command, 'mutable image tag used for execution'
print('PASS: staging and release verification execute the pinned image ID')
