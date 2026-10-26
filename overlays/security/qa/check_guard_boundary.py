#!/usr/bin/env python3
"""Review A01 regression gate (host only): retirement helpers must not poison
the manual firmware upload.

Runs the actual overlay guard scripts under bash with a function shim for
/userfs/bin/tcapi that records every call (same harness family as the A01
audit's reproduce_guard_state.py), then models cfg_manager's operation-2
manual-upload RSA gate (native VAs 0x457f90..0x458040, see
analysis/audit-image/cfg-upgrade-rsa-gate.objdump.txt): the gate is entered
when webs_rsa_state_upgrade is "1" or "0"; it first clears the rsa state and
then requires webs_state_error == "0", otherwise the upload is rejected before
any flash action.

Required invariant: the manual-upload gate outcome for a state must be
IDENTICAL before and after each guard invocation, for empty and pre-existing
transient states, i.e. retirement must write nothing and must exit nonzero.
Also asserts that the controller-side retire-on-failure patch exists and is
wired into the native rebuild recipe.

No device, no firmware binary and no MIPS code is executed here.
"""
import json
import os
import pathlib
import shlex
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = ROOT / 'overlays/security'
GUARDS = ['usr/script/webs_update.sh', 'usr/script/webs_upgrade.sh',
          'usr/script/webs_upgrade2.sh']
CONTROLLER_PATCH = ROOT / 'build/native/boa-retire-online-update-controller.patch'


def gate(state):
    """cfg_manager 0x457f90..0x458040 (A01 audit model)."""
    if state.get('webs_rsa_state_upgrade', '') in ('0', '1'):
        state['webs_rsa_state_upgrade'] = ''
        if state.get('webs_state_error', '') != '0':
            return 'reject before signature verification or flash'
        return 'require detached vendor signature'
    return 'continue past this RSA gate'


def main():
    results = {}
    ok = True
    for error in ('', '0', '1'):
        for rsa in ('', '0', '1'):
            for name in GUARDS:
                script = HERE / name
                case = f'error={error!r} rsa={rsa!r} guard={name}'
                # Fail rather than executing newly added commands outside this
                # check's scope (same static precheck as the audit probe).
                for line in script.read_text().splitlines():
                    if line and not line.startswith('#'):
                        assert shlex.split(line)[0] in {'set', 'exit', 'echo'}, case
                with open(os.devnull) as devnull:
                    # shim must stay empty of calls: the guards write nothing.
                    harness = ('/userfs/bin/tcapi() { printf "%s\\n" "$@" >> "$PROBE_LOG"; }; . "$1"')
                    log = pathlib.Path('/tmp/opencode/a01-guardprobe-log')
                    log.parent.mkdir(parents=True, exist_ok=True)
                    log.write_text('')
                    state = {'webs_state_error': error, 'webs_rsa_state_upgrade': rsa}
                    before = gate(dict(state))
                    proc = subprocess.run(
                        ['bash', '-c', harness, 'probe', str(script)],
                        env=dict(os.environ, PROBE_LOG=str(log)), check=False,
                        stdout=devnull, stderr=subprocess.DEVNULL)
                    written = log.read_text().splitlines()
                after_state = dict(state)
                for line in written:
                    verb, node, key, value = line.split(' ', 3)
                    assert verb == 'set' and node == 'WebCustom_Entry', case
                    after_state[key] = value
                after = gate(after_state)
                entry = {
                    'returncode': proc.returncode,
                    'tcapi_calls': written,
                    'gate_before': before,
                    'gate_after': after,
                }
                failures = []
                if proc.returncode == 0:
                    failures.append('guard must exit nonzero to signal retirement')
                if written:
                    failures.append(f'guard issued tcapi calls: {written}')
                if after != before:
                    failures.append('retirement changed the manual-upload gate outcome')
                entry['failures'] = failures
                results[case] = entry
                if failures:
                    ok = False
    recipe = (ROOT / 'build/native/rebuild-native.py').read_text()
    wired = CONTROLLER_PATCH.name in recipe
    results['controller_patch'] = {'exists': CONTROLLER_PATCH.exists(),
                                   'wired_into_native_rebuild': wired}
    ok = ok and results['controller_patch']['exists'] and wired
    print(json.dumps({'scope': 'actual overlay shells with a tcapi shim; native gate is a static model; no device or MIPS execution',
                      'results': results}, indent=2))
    if ok:
        print('PASS: 27 guard/state cases; retirement writes nothing and never '
              'changes the manual-upload gate outcome; controller boundary patch wired')
        return 0
    print('FAIL: see failures above', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
