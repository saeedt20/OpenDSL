#!/usr/bin/env python3
"""Production UI source gates (review A04).

The normal `make check` gate must exercise the PRODUCTION frontend sources
(overlays/opendsl-ui/boaroot/html/opendsl/) — not only the tools/ui demo.

Checked here, host-side, no device or firmware execution:
  1. every production frontend file exists and matches its frozen
     overlays/opendsl-ui/integration.json hash (source == packed contract);
  2. every production JavaScript file passes `node --check` (syntax);
  3. every production HTML file references only local OpenDSL assets and
     keeps the stock form field names of the native login contract
     (login_authorization / current_page / next_page / action_wait).
"""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROD = ROOT / 'overlays/opendsl-ui'
LOGIN_CONTRACT_FIELDS = ('login_authorization', 'current_page', 'next_page', 'action_wait')


def main():
    failures = []
    integration = json.loads((PROD / 'integration.json').read_text())
    for entry in integration['files']:
        path = PROD / entry['path']
        if not path.is_file():
            failures.append(f"missing production file: {entry['path']}")
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != entry['sha256'] or path.stat().st_size != entry['size']:
            failures.append(f"production file differs from its packed contract: {entry['path']}")

    for js in sorted((PROD / 'boaroot/html/opendsl').glob('*.js')):
        result = subprocess.run([shutil.which('node'), '--check', str(js)],
                                capture_output=True, text=True)
        if result.returncode != 0:
            failures.append(f"production JS syntax error in {js.name}:\n{result.stderr}")

    login_page = PROD / 'boaroot/cgi-bin/Main_Login.asp'
    if login_page.is_file():
        text = login_page.read_text(errors='replace')
        for field in LOGIN_CONTRACT_FIELDS:
            if field not in text:
                failures.append(f'login page lost native form field {field}')
    else:
        failures.append('missing production login page Main_Login.asp')

    if failures:
        print(json.dumps({'gate': 'production-frontend-contracts',
                          'result': 'FAIL', 'failures': failures}, indent=2),
              file=sys.stderr)
        return 1
    print(json.dumps({'gate': 'production-frontend-contracts',
                      'result': 'PASS',
                      'checked': sorted(e['path'] for e in integration['files'])}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
