#!/usr/bin/env python3
"""Production browser QA runner with explicit skip semantics (review A04).

Runs the production browser suites under overlays/opendsl-ui/qa/: the
modern integration suite, the static native-template sweep, and the
page-script execution suite for JavaScript-generated interfaces. Browser prerequisites are optional
on build hosts; a missing optional prerequisite must produce an explicit
SKIPPED-INCOMPLETE status and a distinct exit code — never a production-pass
claim.

Exit codes: 0 production browser suite passed;
            1 production browser suite FAILED;
            2 SKIPPED-INCOMPLETE (optional browser prerequisites missing).
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
QA = ROOT / 'overlays/opendsl-ui/qa/check-browser.cjs'

SKIP_NOTE = ('PRODUCTION-UI-BROWSER SKIPPED-INCOMPLETE: optional browser '
             'prerequisites missing ({detail}). This is NOT a production pass; '
             'run the suite on a host with the prerequisites installed.')


def main():
    if not QA.is_file():
        print(SKIP_NOTE.format(detail=f'{QA} not found'), file=sys.stderr)
        return 2
    module = os.environ.get('OPENDSL_PLAYWRIGHT_MODULE', 'playwright')
    probe = subprocess.run(
        [shutil.which('node'), '-e',
         f"require({json.dumps(module)}); console.log('ok')"],
        capture_output=True, text=True)
    if probe.returncode != 0 or probe.stdout.strip() != 'ok':
        detail = f'playwright module {module!r} not loadable'
        print(json.dumps({'gate': 'production-ui-browser', 'result': 'SKIPPED-INCOMPLETE',
                          'detail': detail}, indent=2))
        print(SKIP_NOTE.format(detail=detail), file=sys.stderr)
        return 2
    result = subprocess.run([shutil.which('node'), str(QA)])
    if result.returncode != 0:
        print('PRODUCTION-UI-BROWSER FAIL', file=sys.stderr)
        return 1
    result = subprocess.run([shutil.which('node'), str(QA.with_name('check-legacy-browser.cjs'))])
    if result.returncode != 0:
        print('NATIVE-UI-BROWSER FAIL', file=sys.stderr)
        return 1
    result = subprocess.run([shutil.which('node'), str(QA.with_name('check-generated-ui.cjs'))])
    if result.returncode != 0:
        print('GENERATED-UI-BROWSER FAIL', file=sys.stderr)
        return 1
    result = subprocess.run([shutil.which('node'), str(QA.with_name('check-ddns-showhide.cjs'))])
    if result.returncode != 0:
        print('DDNS-NATIVE-SHOWHIDE FAIL', file=sys.stderr)
        return 1
    for name in ('fixture-root', 'native-traffic', 'mac-summary', 'dsl-checks', 'brand-routes'):
        result = subprocess.run(
            [shutil.which('node'), str(QA.with_name('check-' + name + '.cjs')), 'current'],
            env={**os.environ, 'OPENDSL_FIXTURE_ASSERT': '1'})
        if result.returncode != 0:
            print(f'POSTFLASH-{name.upper()} FAIL', file=sys.stderr)
            return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
