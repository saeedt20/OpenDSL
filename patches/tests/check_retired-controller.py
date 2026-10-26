#!/usr/bin/env python3
"""Review A01/C04 regression gate (host only): the native controller must
return before service-stop/signal/upgrade-commit actions when a retired helper
fails, AND a retired-only request must reach the caller as a no-change result
(no config save). 

Extracts the exact `start_webs_update` / `start_webs_upgrade` branches from the
current candidate source (build/native/sdk/apps/public/boa-asp/src/asp/
asp_handler.c, i.e. the source that the frozen out/candidate/boa binary was
built from), compiles them for the host with every process/config/file action
stubbed, and asserts, for a nonzero helper exit status:

  - the controller returns 0 (the caller do_apply_cgi loop treats it as "not a
    modified/running service": no MODIFIED/RUN SERVICE line, no tcapi_save()),
  - NO tcapi_set, pid-file signal, mock script open, chmod or system() action
    of the upgrade machinery occurs.

Caller-level cases (recheck C04), with the real controller wired into a copy of
its do_apply_cgi service loop and response/save block:
  - retired-only lists ("start_webs_update", "start_webs_upgrade") produce
    "NOT MODIFIED" and no tcapi_save call;
  - a mixed list ("start_webs_update;restart_wireless") still saves, because
    the unrelated real service returns its own hit value;
  - an unrelated attribute-only change still saves (appSet_attribute path).

For contrast, a hypothetical zero helper status still reaches the original
machinery (branch preserved, not hijacked). No firmware binary or device is
touched; output artifacts stay under analysis/audit-root/.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'analysis/audit-root'
SOURCE = ROOT / 'build/native/sdk/apps/public/boa-asp/src/asp/asp_handler.c'
OUT.mkdir(exist_ok=True)

HARNESS = r'''
#define STUB_EVAL_TO __STUB_EVAL_TO__
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
static int audit_eval(const char *path) { printf("eval_returns_%d:%s\n", STUB_EVAL_TO, path); return STUB_EVAL_TO; }
static int audit_sleep(int n) { (void)n; return 0; }
static int audit_signal(const char *p, int sig) { printf("MACHINERY signal: %s %d\n",p,sig); return 0; }
static void audit_killall_tk(const char *name) { printf("MACHINERY killall: %s\n", name); }
static int audit_set(const char *node, const char *key, const char *value) {
  printf("MACHINERY tcapi_set: %s %s %s\n",node,key,value); return 0;
}
static int audit_save(void) { printf("MACHINERY tcapi_save\n"); return 0; }
static FILE *audit_open(const char *path, const char *mode) {
  (void)mode; printf("MACHINERY open: %s\n",path); return tmpfile();
}
static void audit_write(const char *text) { printf("RESPONSE %s", text); }
static int audit_chmod(const char *path,int mode) { (void)path;(void)mode;printf("MACHINERY chmod: %s\n",path);return 0; }
static int audit_system(const char *cmd) { printf("MACHINERY system: %s\n",cmd);return 0; }
static void audit_debug(const char *fmt,...) { (void)fmt; printf("dbg\n"); }

#define eval audit_eval
#define sleep audit_sleep
#define killall_tk audit_killall_tk
#define kill_pidfile_s audit_signal
#define tcapi_set audit_set
#define tcapi_save audit_save
#define fopen audit_open
#define chmod audit_chmod
#define system audit_system
#define _dprintf audit_debug
static int audit_eval_argv(char *const argv[], const char *stdoutf, unsigned long timeout, int *ppid) { printf("MACHINERY _eval: %s\n", argv[0] ? argv[0] : "(null)"); return 0; }
#define _eval audit_eval_argv
#define SIGUSR2 10
typedef int pid_t;

static int controller(const char *rc_service) {
 int app_method_hit=0;
'''

TAIL = r'''
 return app_method_hit;
}

static void websWrite_stub(const char *text) { audit_write(text); }

int main(void) { printf("result:%d\n", controller(SVC)); return 0; }
'''

CALLER_TAIL = r'''
 return app_method_hit;
}

static void websWrite_stub(const char *text) { audit_write(text); }

/* A faithful copy of the do_apply_cgi rc-service loop and its response/save
   block (asp_handler.c ~:8003-8020): strtok_r on ';', nonzero hit -> 2,
   then MODIFIED/RUN SERVICE + tcapi_save() or NOT MODIFIED. */
static int caller_loop(const char *rc_service, int attribute_hit) {
 int app_method_hit = attribute_hit;
 char list[128]; snprintf(list, sizeof(list), "%s", rc_service);
 char *saveptr = NULL;
 char *rc_service_t = strtok_r(list, ";", &saveptr);
 while (rc_service_t != NULL) {
   if (controller(rc_service_t))
     app_method_hit = 2;
   rc_service_t = strtok_r(NULL, ";", &saveptr);
 }
 if (app_method_hit == 2) {
   websWrite_stub("MODIFIED\n");
   websWrite_stub("RUN SERVICE\n");
   tcapi_save();
 }
 else if (app_method_hit == 1) {
   websWrite_stub("MODIFIED\n");
   tcapi_save();
 }
 else {
   websWrite_stub("NOT MODIFIED\n");
 }
 return app_method_hit;
}

int main(void) { printf("result:%d\n", caller_loop(ATTR_HIT ? "start_webs_update" : SVC, ATTR_HIT)); return 0; }
'''


def extract_branch(service):
    source = SOURCE.read_text()
    start = source.index(f'else if(!strcmp(rc_service, "{service}")) {{')
    next_marker = source.index('else if(!strcmp(rc_service, "reboot")', start)
    block = source[start:next_marker].strip()
    assert block.count(f'eval("/usr/script/{service[len("start_"):]}.sh")') == 1
    return block.removeprefix('else ')


def compile_and_run(name, body, eval_to, svc, attr_hit=0):
    harness = (HARNESS.replace('__STUB_EVAL_TO__', str(eval_to))
               + '\n' + body
               + (CALLER_TAIL if 'caller' in name else TAIL))
    code = OUT / f'{name}.c'
    binary = OUT / name
    code.write_text(harness.replace('SVC', json.dumps(svc)).replace('ATTR_HIT', str(attr_hit)))
    subprocess.run(['gcc', '-std=gnu99', '-O0', '-w', str(code), '-o', str(binary)], check=True)
    result = subprocess.run([str(binary)], capture_output=True, text=True, check=True)
    hit = int(re.search(r'result:(\d+)', result.stdout).group(1))
    machinery = [line for line in result.stdout.splitlines() if line.startswith('MACHINERY ')]
    responses = [line[len('RESPONSE '):] for line in result.stdout.splitlines()
                 if line.startswith('RESPONSE ')]
    code.unlink(missing_ok=True)
    return {'stdout': result.stdout.splitlines(), 'result': hit,
            'machinery_actions': machinery, 'responses': responses,
            'saved': 'MACHINERY tcapi_save' in result.stdout,
            'source_sha256': hashlib.sha256(body.encode()).hexdigest()}


def main():
    ok = True
    report = {'scope': 'exact candidate source branches compiled for the host; all process/config/file actions stubbed; no firmware or device execution',
              'source': str(SOURCE.relative_to(ROOT))}
    for service in ('start_webs_update', 'start_webs_upgrade'):
        retired = compile_and_run(f'retire-boundary-{service}',
                                  extract_branch(service), 1, service)
        legacy = compile_and_run(f'retire-boundary-{service}-legacy',
                                 extract_branch(service), 0, service)
        entry = {
            'retired_helper_nonzero': {k: v for k, v in retired.items() if k != 'stdout'},
            'retired_stdout': retired['stdout'],
            'hypothetical_zero_status_reaches_original_machinery':
                len(legacy['machinery_actions']) > 0,
        }
        failures = []
        # review C04 contract: retired-only requests return the caller's
        # no-change result (0), not the save-triggering value 2
        if retired['result'] != 0:
            failures.append('retired action must return the caller no-change result (0), '
                            f'got {retired["result"]}')
        if retired['machinery_actions']:
            failures.append(f'upgrade machinery ran despite nonzero helper: {retired["machinery_actions"]}')
        if 'eval_returns_1:' not in ' '.join(retired['stdout']):
            failures.append('helper eval was not exercised')
        if legacy['machinery_actions'] and \
                'tcapi_set: System_Entry upgrade_fw 1' not in ' '.join(legacy['machinery_actions']) \
                and service == 'start_webs_upgrade':
            failures.append('contrast case lost its original machinery (patch overreached)')
        entry['failures'] = failures
        report[service] = entry
        if failures:
            ok = False

    # caller-level cases (recheck C04): retired-only vs mixed vs attribute-only
    mixed = compile_and_run('retire-caller-mixed', extract_branch('start_webs_update'),
                            1, 'start_webs_update;restart_wireless')
    entry = {'retired_only_saves': mixed['saved'],
             'responses': mixed['responses'], 'result': mixed['result']}
    failures = []
    if not mixed['saved']:
        failures.append('mixed list lost the real service save (overreach)')
    if 'MODIFIED' not in ' '.join(mixed['responses']):
        failures.append('mixed list did not answer MODIFIED for the real service')
    entry['failures'] = failures
    report['caller_mixed'] = entry
    if failures:
        ok = False

    for service in ('start_webs_update', 'start_webs_upgrade'):
        retired_only = compile_and_run(f'retire-caller-only-{service}',
                                       extract_branch(service), 1, service)
        attrs = compile_and_run(f'retire-caller-attrs-{service}',
                                extract_branch(service), 1, service, attr_hit=1)
        entry = {'service': service,
                 'retired_only': {'result': retired_only['result'], 'saves': retired_only['saved'],
                                  'responses': retired_only['responses'],
                                  'machinery': retired_only['machinery_actions']},
                 'with_real_attributes': {'result': attrs['result'], 'saves': attrs['saved'],
                                          'responses': attrs['responses']}}
        failures = []
        if retired_only['saved'] or retired_only['result'] != 0 \
                or 'NOT MODIFIED' not in ' '.join(retired_only['responses']):
            failures.append('retired-only request triggered a save or modified response')
        if retired_only['machinery_actions']:
            failures.append('retired-only request ran upgrade machinery')
        if not attrs['saved']:
            failures.append('attribute-only change lost its save (overreach)')
        entry['failures'] = failures
        report[f'caller_retired_only_{service}'] = entry
        if failures:
            ok = False

    (OUT / 'retire-controller-boundary-result.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if ok:
        print('PASS: retired native actions return no-change before '
              'service-stop/signal/commit on nonzero helper status; caller does '
              'not save for retired-only requests and still saves mixed/real ones.')
        return 0
    print('FAIL: retired boundary incomplete', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
