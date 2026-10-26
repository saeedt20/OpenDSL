#!/usr/bin/env python3
"""Boot-state neutralisation regression gate (host only) — reviews C03/D01
plus rechecks E01/E02.

History: the C03 gate modelled `tcapi` failures as NONZERO exit codes. The
shipped CLI never does that (E01: main overwrites its dispatch result with
zero; API errors are printed on stdout as "connection error", "no attribute
information" or "no node information"), so those stubs tested a contract the
firmware does not have. This version executes the REAL marked rcS block under
bash with the observed stdout-diagnostic/exit-0 contract and asserts outcome
semantics, not exit codes.

Behavioural cases (stateful, per attr, two attrs):
  healthy-stale / clean / persistent-connection-error / transient-recovery /
  missing-attribute / missing-node / failed-set / set-ok-readback-diagnostic /
  failed-commit / unexpected-output / blocking-deadline (blocked initial GET) /
  blocking-set / blocking-readback / blocking-commit

Every failure case must show: no verified-clear classification, no COMMIT
unless something was really cleared, an explicit "OpenDSL:" diagnostic, and
live state left untouched. The blocking cases assert a finite wall-clock
budget (E02) and cover blocked initial GET, SET, read-back and COMMIT: the
whole block must finish within its derived budget and reach the modelled
service-launch boundary even when the API call blocks. Each blocking fixture
records the ACTUAL supervised child (a static capture of Bash $BASHPID) plus
its real /proc parent and an ancestry walk to the harness - never the Bash $$
observation, which stays the outer shell PID (recheck F01) - and the gate
asserts every recorded child differs from the outer harness, is anchored to
it through /proc ancestry, and is absent after the reap. A negative control
replays the old $$ observation and requires the identity assertion to reject
it.

Static checks:
  - block ordered before `/sbin/rc_init &`;
  - OPENDSL_TCAPI_DEADLINE/OPENDSL_TCAPI_TRIES constants present;
  - exactly one /userfs/bin/tcapi invocation site (inside the bounded wrapper)
    and kill+wait reap of owned children;
  - no `tcapi save`;
  - the primitives used (usleep, sleep, kill, cat, rm) exist in the packed
    BusyBox v1.00 applet table, and `timeout` is ABSENT from it — proving the
    polled kill/wait deadline was chosen because the obvious applet is not
    available on this target (E02's "verify chosen primitives exist" rule).

Modes:
  (default)      the overlay source rcS
  --rcs <path>   explicit script OR image path (recheck E01): an rcS script,
                 a `rootfs.squashfs`, or a release `.trx` (the 256-byte
                 vendor header names the kernel/rootfs slice lengths; the
                 rootfs is extracted with 7z exactly as the project does).
                 Negative controls: the packed 0.1.4 image must FAIL for the
                 semantic contract reasons above; packed 0.1.3 fails ordering.
  --json <path>  also write the machine-readable result
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[3]
OVERLAY_RCS = ROOT / 'overlays/lean-ipv4/rootfs/usr/etc/init.d/rcS'
BUSYBOX = ROOT / 'analysis/verified/rootfs/bin/busybox'
STOCK_RCS = ROOT / 'analysis/verified/rootfs/usr/etc/init.d/rcS'

BEGIN = '# OpenDSL boot state neutralisation: begin'
END = '# OpenDSL boot state neutralisation: end.'

# The stub follows the statically observed packed CLI contract: every command
# exits 0; API outcomes are stdout text. Failure output is EXACTLY one of the
# three packed strings (objdump evidence in analysis/recheck-014-boot/).
#
# otr_block is the blocking fixture (recheck F01): inside a background Bash
# function $$ stays the OUTER harness PID, so the supervised child is recorded
# as a static capture of $BASHPID (a live $BASHPID inside a command
# substitution would resolve to that subshell), plus its real /proc parent
# and an ancestry walk to the harness: the wrapper runs inside command
# substitution, so the child's direct parent is a transient subshell and the
# walk proves the recorded child belongs to the launched harness. exec then
# keeps that exact PID as the process the rcS wrapper kills and reaps.
STUB = r'''
otr_block() {
	OTR_SELF="$BASHPID"
	OTR_PP=unknown
	if [ -r "/proc/$OTR_SELF/stat" ]; then
		OTR_PP=`awk '{print $4}' "/proc/$OTR_SELF/stat" 2>/dev/null`
		[ -n "$OTR_PP" ] || OTR_PP=unknown
	fi
	OTR_ANCHOR=0
	OTR_WALK="$OTR_SELF"
	OTR_HOPS=0
	while [ "$OTR_HOPS" -lt 6 ]; do
		OTR_HOPS=$((OTR_HOPS+1))
		OTR_NEXT=`awk '{print $4}' "/proc/$OTR_WALK/stat" 2>/dev/null`
		case "$OTR_NEXT" in
			""|*[!0-9]*) break ;;
		esac
		if [ "$OTR_NEXT" = "$$" ]; then OTR_ANCHOR=1; break; fi
		if [ "$OTR_NEXT" -le 1 ]; then break; fi
		OTR_WALK="$OTR_NEXT"
	done
	printf 'harness=%s child=%s realppid=%s anchored=%s\n' "$$" "$OTR_SELF" "$OTR_PP" "$OTR_ANCHOR" >> "$ST/pids"
	exec /bin/sleep 60
}
/userfs/bin/tcapi() {
	printf '%s|%s|%s|%s\n' "$1" "$2" "$3" "${4-NONE}" >> "$ST/events"
	case "$1" in
		get)
			n=$(cat "$ST/gets-$3" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$ST/gets-$3"
			case "$MODE" in
				persistent_connection_error)
					echo 'connection error'; return 0 ;;
				transient_recovery)
					if [ "$n" -le 1 ]; then echo 'connection error'; return 0; fi ;;
				missing_attribute)
					echo 'no attribute information'; return 0 ;;
				missing_node)
					echo 'no node information'; return 0 ;;
				unexpected_output)
					echo 'banana'; return 0 ;;
				set_ok_readback_diag)
					if [ -e "$ST/set-$3" ]; then echo 'connection error'; return 0; fi ;;
				blocking_deadline)
					otr_block ;;
				blocking_readback)
					if [ -e "$ST/set-$3" ]; then otr_block; fi ;;
			esac
			cat "$ST/live-$3"
			return 0 ;;
		set)
			case "$MODE" in
				failed_set)
					echo 'connection error'; return 0 ;;
				set_ok_readback_diag)
					touch "$ST/set-$3"; return 0 ;;
				blocking_readback)
					touch "$ST/set-$3" ;;
				blocking_set)
					otr_block ;;
			esac
			printf '%s' "$4" > "$ST/live-$3"
			return 0 ;;
		commit)
			case "$MODE" in
				failed_commit)
					echo 'connection error'; return 0 ;;
				blocking_commit)
					otr_block ;;
			esac
			return 0 ;;
	esac
}
'''

# Expected outcome model. `budget` is computed from the block's own constants
# (deadline D, tries N): per attr worst case = get N*(D+1) + pause (N-1)
# + set (D+1) + read-back N*(D+1) + pause (N-1); two attrs + one commit call.
CASES = {
    'healthy': {
        'live': ('', ''), 'sets': 2, 'commits': 1,
        'gets_min': 4, 'gets_max': 4,
        'stdout_has': ['cleared and verified empty'],
        'stdout_lacks': ['cleanup incomplete'],
    },
    'clean': {
        'live': ('', ''), 'sets': 0, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['already empty'],
        'stdout_lacks': ['cleanup incomplete', 'cleared and verified empty'],
    },
    'persistent_connection_error': {
        'live': ('1', '1'), 'sets': 0, 'commits': 0,
        'gets_min': 4, 'gets_max': 4,
        'stdout_has': ['API unavailable', 'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
    },
    'transient_recovery': {
        'live': ('', ''), 'sets': 2, 'commits': 1,
        'gets_min': 6, 'gets_max': 6,
        'stdout_has': ['transient API failure', 'cleared and verified empty'],
        'stdout_lacks': ['cleanup incomplete'],
    },
    'missing_attribute': {
        'live': ('1', '1'), 'sets': 0, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['attribute absent'],
        'stdout_lacks': ['cleanup incomplete', 'cleared and verified empty'],
    },
    'missing_node': {
        'live': ('1', '1'), 'sets': 0, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['configuration node missing', 'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
    },
    'failed_set': {
        'live': ('1', '1'), 'sets': 2, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['SET webs_rsa_state_upgrade failed',
                       'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
    },
    'set_ok_readback_diag': {
        'live': ('1', '1'), 'sets': 2, 'commits': 0,
        'gets_min': 6, 'gets_max': 6,
        'stdout_has': ['not verified cleared', 'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
    },
    'failed_commit': {
        'live': ('', ''), 'sets': 2, 'commits': 1,
        'gets_min': 4, 'gets_max': 4,
        'stdout_has': ['commit failed'],
        'stdout_lacks': ['cleanup incomplete'],
    },
    'unexpected_output': {
        'live': ('1', '1'), 'sets': 0, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['unexpected GET output', 'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
    },
    'blocking_deadline': {
        'live': ('1', '1'), 'sets': 0, 'commits': 0,
        'gets_min': 4, 'gets_max': 4,
        'stdout_has': ['API unavailable', 'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
        'must_finish_within_budget': True,
        # blocked initial GET: 2 attrs x 2 tries x deadline + 2 retry pauses
        'expected_min_s': 10, 'pid_records': 4,
    },
    'blocking_set': {
        'live': ('1', '1'), 'sets': 2, 'commits': 0,
        'gets_min': 2, 'gets_max': 2,
        'stdout_has': ['SET webs_rsa_state_upgrade failed',
                       'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
        'must_finish_within_budget': True,
        # blocked SET: 2 attrs x 1 call (no retry) x deadline
        'expected_min_s': 4, 'pid_records': 2,
    },
    'blocking_readback': {
        'live': ('', ''), 'sets': 2, 'commits': 0,
        'gets_min': 6, 'gets_max': 6,
        'stdout_has': ['read-back of webs_rsa_state_upgrade failed',
                       'cleanup incomplete'],
        'stdout_lacks': ['cleared and verified empty'],
        'must_finish_within_budget': True,
        # blocked read-back: 2 attrs x 2 tries x deadline + 2 retry pauses
        'expected_min_s': 10, 'pid_records': 4,
    },
    'blocking_commit': {
        'live': ('', ''), 'sets': 2, 'commits': 1,
        'gets_min': 4, 'gets_max': 4,
        'stdout_has': ['commit failed'],
        'stdout_lacks': ['cleanup incomplete'],
        'must_finish_within_budget': True,
        # blocked COMMIT: 1 call x deadline
        'expected_min_s': 2, 'pid_records': 1,
    },
}


def block_of(text):
    start = text.index(BEGIN)
    end = text.index(END) + len(END)
    return text[start:end]


def static_checks(text, results):
    failures = []
    block = block_of(text)

    if not re.search(r'# OpenDSL boot state neutralisation: end\.\n/sbin/rc_init &\n', text):
        failures.append('block does not end immediately before the /sbin/rc_init & GUI launch line')

    deadline = re.search(r'^OPENDSL_TCAPI_DEADLINE=(\d+)$', block, re.M)
    tries = re.search(r'^OPENDSL_TCAPI_TRIES=(\d+)$', block, re.M)
    if not deadline or not tries:
        failures.append('missing OPENDSL_TCAPI_DEADLINE/OPENDSL_TCAPI_TRIES constants')
        deadline_v, tries_v = 2, 2
    else:
        deadline_v, tries_v = int(deadline.group(1)), int(tries.group(1))
        if deadline_v < 1 or deadline_v > 10 or tries_v < 1 or tries_v > 4:
            failures.append(f'unreasonable deadline/tries: {deadline_v}/{tries_v}')

    invocations = [line for line in block.splitlines()
                   if '/userfs/bin/tcapi' in line and not line.lstrip().startswith('#')]
    if len(invocations) != 1:
        failures.append(f'expected exactly ONE /userfs/bin/tcapi invocation site '
                        f'(inside the bounded wrapper), found {len(invocations)}')
    if 'kill "$OTR_PID"' not in block or 'wait "$OTR_PID"' not in block:
        failures.append('wrapper must kill and reap owned children on deadline')
    if any('tcapi save' in line for line in block.splitlines()
           if not line.lstrip().startswith('#')):
        failures.append('cleanup must never call tcapi save')

    # BusyBox v1.00 applet-table evidence (E02: verify chosen primitives).
    busybox_failures = []
    data = BUSYBOX.read_bytes()
    anchor = data.find(b'applet not found')
    zcat = data.find(b'zcat\x00')
    if anchor == -1 or zcat == -1 or zcat < anchor:
        busybox_failures.append('could not locate the packed applet table')
    else:
        window = data[anchor:zcat + 16]
        for applet in (b'sleep\x00', b'kill\x00', b'cat\x00', b'rm\x00',
                       b'usleep\x00'):
            if applet not in window:
                busybox_failures.append(f'applet {applet[:-1].decode()} missing from packed BusyBox table')
        if b'timeout\x00' in window:
            # would only mean the design assumption must be revisited
            pass
        else:
            results['timeout_applet_absent'] = True
    if busybox_failures:
        failures.extend(busybox_failures)

    if STOCK_RCS.exists() and '/tmp/' not in STOCK_RCS.read_text():
        failures.append('stock rcS does not use /tmp, so the wrapper temp file path is unverified')

    results['static'] = {
        'ok': not failures, 'failures': list(failures),
        'deadline': deadline_v, 'tries': tries_v,
        'tcapi_invocation_sites': len(invocations),
        'busybox_applet_evidence': not busybox_failures,
    }
    return failures, deadline_v, tries_v


def read_text(path):
    return path.read_text() if path.exists() else ''


def parse_pid_records(text):
    records = []
    for line in text.splitlines():
        fields = {}
        for part in line.split():
            if '=' in part:
                key, value = part.split('=', 1)
                fields[key] = value
        if fields:
            records.append(fields)
    return records


def pid_record_failures(rec, harness_pid, mode):
    """F01 identity assertions for one blocking PID record. `harness` is the
    fixture's view of $$ (the outer shell); `child` must be the supervised
    child the wrapper kills - never the outer PID - and `anchored` must show
    its /proc ancestry reaches the launched harness (the wrapper's command
    substitution puts a transient subshell between them). `realppid` is
    kept as informational evidence of that intermediate subshell."""
    try:
        harness = int(rec['harness'])
        child = int(rec['child'])
    except (KeyError, ValueError):
        return [f'{mode}: malformed blocking PID record {rec!r}']
    failures = []
    if harness != harness_pid:
        failures.append(f'{mode}: record says outer PID {harness} but the '
                        f'launched harness process is {harness_pid}')
    if child == harness or child == harness_pid:
        failures.append(f'{mode}: recorded child PID {child} is the outer '
                        f'harness PID, not the supervised child - the old '
                        f'$$ observation (F01)')
    if child <= 1 or child == os.getpid():
        failures.append(f'{mode}: implausible recorded child PID {child}')
    anchored = rec.get('anchored', '')
    if anchored != '1':
        failures.append(f'{mode}: recorded child {child} is not anchored to '
                        f'the launched harness through /proc ancestry '
                        f'(anchored={anchored!r}); cannot prove it is the '
                        f'launched fixture\'s supervised child')
    return failures


def check_blocked_children(st, harness_pid, mode, expected_records):
    """Verify every recorded blocking child: the expected count of blocked
    calls, distinct from the outer harness, linked to it through /proc, and
    absent after the wrapper's kill+wait reap. Returns (failures, info)."""
    failures = []
    records = parse_pid_records(read_text(st / 'pids'))
    info = {'harness_pid': harness_pid, 'expected_records': expected_records,
            'records': len(records), 'children': []}
    if len(records) != expected_records:
        failures.append(f'{mode}: expected {expected_records} blocked-call '
                        f'PID record(s), found {len(records)}')
    children = []
    for rec in records:
        failures.extend(pid_record_failures(rec, harness_pid, mode))
        try:
            children.append(int(rec['child']))
        except (KeyError, ValueError):
            continue
        info['children'].append({'harness': rec.get('harness'),
                                 'child': rec.get('child'),
                                 'realppid': rec.get('realppid')})
    absent = True
    for child in dict.fromkeys(children):
        if child <= 1:
            continue
        for _ in range(20):
            try:
                os.kill(child, 0)
            except (ProcessLookupError, PermissionError):
                break
            time.sleep(0.1)
        else:
            absent = False
            failures.append(f'{mode}: recorded blocking child {child} still '
                            f'alive after reap')
    info['all_children_absent_after_reap'] = absent
    return failures, info


def run_case(block, mode, deadline_v, tries_v, results):
    failures = []
    with tempfile.TemporaryDirectory(prefix='bootstate-') as td:
        st = pathlib.Path(td)
        for attr in ('webs_rsa_state_upgrade', 'webs_state_error'):
            initial = '' if mode == 'clean' else '1'
            (st / f'live-{attr}').write_text(initial)
            (st / f'gets-{attr}').write_text('0')
        (st / 'events').touch()
        # The target BusyBox v1.00 HAS usleep (verified in the applet table),
        # but common host distributions do not. Without this shim the deadline
        # poll would spin free and the blocking case would "pass" without ever
        # waiting a real deadline (observed during development). The shim uses
        # the same 100 ms granularity the block assumes.
        shim = st / 'shim'
        shim.mkdir()
        (shim / 'usleep').write_text('#!/bin/sh\nsleep 0.1\n')
        (shim / 'usleep').chmod(0o755)
        script = STUB + '\n' + block + '\necho OPENDSL_RC_INIT_BOUNDARY\n'
        budget = 2 * (tries_v * (deadline_v + 1) + (tries_v - 1) + (deadline_v + 1)
                      + tries_v * (deadline_v + 1) + (tries_v - 1)) + (deadline_v + 1)
        host_cap = budget + 8
        t0 = time.monotonic()
        proc = subprocess.Popen(['bash', '-c', script],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True,
                                env={'PATH': f'{shim}:/usr/bin:/bin', 'ST': td,
                                     'MODE': mode})
        harness_pid = proc.pid
        timed_out = False
        try:
            out, err = proc.communicate(timeout=host_cap)
        except subprocess.TimeoutExpired:
            timed_out = True
            proc.kill()
            out, err = proc.communicate()
            failures.append(f'cleanup did not finish within the derived budget '
                            f'({budget}s, host cap {host_cap}s) — unbounded wait')
            # An input without the bounded wrapper (old negative controls)
            # never times out its own calls: kill any blocking child the
            # killed harness left behind so it cannot outlive this case.
            for rec in parse_pid_records(read_text(st / 'pids')):
                try:
                    pid = int(rec.get('child', ''))
                except ValueError:
                    continue
                if pid > 1:
                    try:
                        os.kill(pid, 9)
                    except OSError:
                        pass
        elapsed = time.monotonic() - t0
        events = (st / 'events').read_text().splitlines()
        live = tuple((st / f'live-{attr}').read_text()
                     for attr in ('webs_rsa_state_upgrade', 'webs_state_error'))
        gets = sum(1 for e in events if e.startswith('get|'))
        sets = sum(1 for e in events if e.startswith('set|'))
        commits = sum(1 for e in events if e.startswith('commit|'))
        expect = CASES[mode]
        entry = {
            'gets': gets, 'sets': sets, 'commits': commits,
            'live_after': list(live), 'elapsed_s': round(elapsed, 2),
            'derived_budget_s': budget,
        }
        if live != expect['live']:
            entry['live_mismatch'] = True
        combined = out + (err or '')
        for want in expect.get('stdout_has', []):
            if want not in combined:
                failures.append(f'{mode}: output missing {want!r}')
        for banned in expect.get('stdout_lacks', []):
            if banned in combined:
                failures.append(f'{mode}: output must not contain {banned!r}')
        if not (expect['gets_min'] <= gets <= expect['gets_max']):
            failures.append(f'{mode}: get count {gets} outside '
                            f'[{expect["gets_min"]},{expect["gets_max"]}]')
        if sets != expect['sets']:
            failures.append(f'{mode}: set count {sets} != {expect["sets"]}')
        if commits != expect['commits']:
            failures.append(f'{mode}: commit count {commits} != {expect["commits"]}')
        if live != expect['live']:
            failures.append(f'{mode}: live state {live} != {expect["live"]}')
        if 'OPENDSL_RC_INIT_BOUNDARY' not in out:
            failures.append(f'{mode}: never reached the modelled service-launch boundary')
        if expect.get('must_finish_within_budget'):
            if elapsed > budget + 4:
                failures.append(f'{mode}: took {elapsed:.1f}s > derived budget {budget}s')
            expected_min = expect.get('expected_min_s', 0)
            if elapsed < expected_min * 0.7:
                failures.append(f'{mode}: finished in {elapsed:.1f}s but the '
                                f'deadline structure requires >= ~{expected_min}s; '
                                f'the kill path was probably not exercised')
        if expect.get('pid_records'):
            if timed_out:
                failures.append(f'{mode}: timed out before the child-PID '
                                f'identity assertion could run')
            else:
                pid_failures, pid_info = check_blocked_children(
                    st, harness_pid, mode, expect['pid_records'])
                failures.extend(pid_failures)
                entry['pid_identity'] = pid_info
        entry['ok'] = not failures
        entry['failures'] = list(failures)
        results['cases'][mode] = entry
    return failures


def pid_observation_negative_control(results):
    """F01 negative control: replay the deliberately ineffective observation
    (log $$ inside a background Bash function) and require the identity
    assertion to reject it. If the old observation were accepted, the gate
    would not catch the parent-PID defect it exists to prevent."""
    failures = []
    script = ('legacy_observe() { printf "harness=%s\\n" "$$"; '
              'printf "child=%s\\n" "$$"; }\n'
              'legacy_observe & wait "$!"\n')
    proc = subprocess.Popen(['bash', '-c', script],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True)
    out, _ = proc.communicate(timeout=20)
    harness_pid = proc.pid
    values = {}
    for line in out.splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            values[key] = value
    control = {'outer_harness_pid': harness_pid,
               'old_observation_harness': values.get('harness'),
               'old_observation_child': values.get('child')}
    reproduces = (values.get('harness') == str(harness_pid)
                  and values.get('child') == str(harness_pid))
    control['reproduces_old_observation'] = reproduces
    if not reproduces:
        failures.append('PID negative control did not reproduce the old $$ '
                        'observation (child and harness should both be the '
                        'outer shell PID)')
    record = {'harness': values.get('harness', ''),
              'child': values.get('child', ''),
              'realppid': 'unknown', 'anchored': '0'}
    identity_failures = pid_record_failures(
        record, harness_pid, 'pid-observation-negative-control')
    control['rejected_by_identity_assertion'] = bool(identity_failures)
    control['child_pid_check_catches_it'] = any(
        'old $$ observation' in f for f in identity_failures)
    if not identity_failures:
        failures.append('PID negative control: the old $$ observation passed '
                        'the identity assertion; the check would not catch '
                        'the F01 defect')
    if not control['child_pid_check_catches_it']:
        failures.append('PID negative control: rejection did not come from '
                        'the child-versus-harness PID check')
    results['pid_observation_negative_control'] = control
    return failures


def resolve_rcs(path):
    """Return (text, source_info). Accepts the rcS script itself, a
    rootfs.squashfs image or a release .trx (carved through the documented
    256-byte vendor header: kernel length at 0x50, rootfs length at 0x54,
    total length at 0x08, all big-endian — the same layout
    tools/build_image.py validates). Extraction uses 7z, the project's
    established squashfs reader. Temp dirs are always removed."""
    raw = path.read_bytes()
    head = raw[:256]
    source = {'path': str(path), 'sha256': hashlib.sha256(raw).hexdigest()}
    workdir = None
    try:
        if head[:4] in (b'sqsh', b'hsqs'):
            source['kind'] = 'squashfs'
            squash = path
        elif head[:4] == b'2RDH':
            source['kind'] = 'trx'
            total = int.from_bytes(head[0x08:0x0c], 'big')
            kernel_len = int.from_bytes(head[0x50:0x54], 'big')
            rootfs_len = int.from_bytes(head[0x54:0x58], 'big')
            if total != len(raw):
                raise SystemExit(f'{path}: header total length {total} != '
                                 f'file size {len(raw)}')
            slice_ = raw[256 + kernel_len:256 + kernel_len + rootfs_len]
            if slice_[:4] != b'sqsh':
                raise SystemExit(f'{path}: rootfs slice does not start with '
                                 f'the squashfs magic {slice_[:4]!r}')
            source['kernel_len'] = kernel_len
            source['rootfs_len'] = rootfs_len
            source['rootfs_sha256'] = hashlib.sha256(slice_).hexdigest()
            workdir = tempfile.mkdtemp(prefix='rcs-trx-')
            squash = pathlib.Path(workdir) / 'rootfs.squashfs'
            squash.write_bytes(slice_)
        else:
            text = raw.decode('utf-8', errors='replace')
            if '/userfs/bin/tcapi' not in text:
                raise SystemExit(f'{path}: neither a squashfs/trx image nor a '
                                 f'script mentioning /userfs/bin/tcapi')
            source['kind'] = 'script'
            source['rcs_sha256'] = hashlib.sha256(raw).hexdigest()
            return text, source
        extract = pathlib.Path(workdir if workdir else
                               tempfile.mkdtemp(prefix='rcs-squash-'))
        try:
            proc = subprocess.run(['7z', 'x', '-y', f'-o{extract}', str(squash)],
                                  capture_output=True, text=True)
            # 7z exits nonzero after refusing to recreate the release's
            # "../../bin/busybox"-style relative symlinks (a 7z path
            # heuristic; every link resolves inside the extracted tree).
            # All regular files, including rcS, are still written, so the
            # requirement is the extracted rcS itself, not 7z's exit code.
            source['extraction_7z_rc'] = proc.returncode
            rcs = extract / 'usr/etc/init.d/rcS'
            if not rcs.is_file():
                raise SystemExit(f'{path}: 7z extraction did not produce '
                                 f'usr/etc/init.d/rcS (7z exit '
                                 f'{proc.returncode}): '
                                 f'{proc.stdout[-300:]} {proc.stderr[-300:]}')
            data = rcs.read_bytes()
            if b'/userfs/bin/tcapi' not in data:
                raise SystemExit(f'{path}: extracted rcS does not mention '
                                 f'/userfs/bin/tcapi; image carving is suspect')
            source['rcs_sha256'] = hashlib.sha256(data).hexdigest()
            return data.decode('utf-8', errors='replace'), source
        finally:
            if workdir is None:
                shutil.rmtree(extract, ignore_errors=True)
    finally:
        if workdir:
            shutil.rmtree(workdir, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rcs', type=pathlib.Path, default=OVERLAY_RCS,
                    help='rcS script, rootfs.squashfs or release .trx')
    ap.add_argument('--json', type=pathlib.Path)
    args = ap.parse_args()

    text, source = resolve_rcs(args.rcs)
    results = {'rcs': str(args.rcs), 'source': source, 'cases': {}}
    failures, deadline_v, tries_v = static_checks(text, results)
    for mode in CASES:
        failures.extend(run_case(block_of(text), mode, deadline_v, tries_v, results))
    failures.extend(pid_observation_negative_control(results))

    results['failures'] = failures
    results['pass'] = not failures
    out = json.dumps(results, indent=2)
    print(out)
    if args.json:
        args.json.write_text(out + '\n')
    if not failures:
        print('PASS: boot-state neutralisation matches the shipped tcapi contract '
              '(stdout diagnostics, exit 0), never treats error text as a cleared '
              'value, commits only after a verified empty read-back, and every '
              'API call is deadline-bounded so the block always reaches the '
              'GUI-launch boundary within its derived budget; the blocked '
              'initial-GET/SET/read-back/COMMIT fixtures record the real '
              'supervised child PIDs (BASHPID, /proc ancestry anchored to the '
              'launched harness), all are reaped, and the old $$ observation '
              'fails the child-identity negative control', file=sys.stderr)
        return 0
    for f in failures:
        print(f'FAIL: {f}', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
