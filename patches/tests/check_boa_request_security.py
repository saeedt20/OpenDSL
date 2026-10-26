#!/usr/bin/env python3
"""Execute exact candidate request guards with all device actions stubbed."""
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SDK = ROOT / 'build/native/sdk/apps/public/boa-asp/src'
STOCK = ROOT / 'artifacts/source/extracted/dsl-n12e-c1_gpl/apps/public/boa-asp/src'


def function(source, signature):
    start = source.index(signature + '\n{')
    return source[start:source.index('\n}', start) + 2]


PREAMBLE = r'''
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#define ASUS_LOGIN_SESSION 1
#define M_POST 2
typedef struct { int method; char *content_type; } request;
typedef struct { request *server_env; } asp_reent;
typedef void asp_text;
static int authorized, writes, commits, external, fail_set;
static char *filename, *start, *end;
static void *g_var_post;
static int http_authorize(request *req) { (void)req; return authorized ? 0 : -1; }
static char *get_param(void *vars, const char *key) {
    (void)vars;
    return !strcmp(key,"bfilename") ? filename : !strcmp(key,"bdata_start") ? start : end;
}
static int tcapi_set(char *node, char *key, char *value) {
    assert(!strcmp(node,"System_Entry"));
    assert((!strcmp(key,"upgrade_fw_status") && !strcmp(value,"NONE")) ||
           (!strcmp(key,"upgrade_fw") && !strcmp(value,"2")));
    ++writes; return writes == fail_set ? -1 : 0;
}
static int tcapi_commit(char *node) { assert(!strcmp(node,"System_Entry")); ++commits; return 0; }
static int audit_external(const char *cmd) { (void)cmd; ++external; return 0; }
#define eval audit_external
#define system audit_external
'''

MAIN = r'''
int main(void) {
    assert(!AllPassUrl("/cgi-bin/upload.asp"));
    assert(!AllPassUrl("/cgi-bin/Advanced_System_Content.asp"));
    assert(AllPassUrl("/Main_Login.asp"));
    assert(AllPassUrl("/opendsl/login.js"));
    const char *bad[] = {"/opendsl/symbols/../private.svg", "/opendsl/symbols/private.asp",
        "/opendsl/symbols/x.svg/Private.asp", "/elsewhere/gateway.svg", "/opendsl/symbols/.svg"};
    for (unsigned i=0; i<sizeof(bad)/sizeof(*bad); ++i) {
        assert(!AllPassUrl((char*)bad[i])); assert(!_pass_login_check(bad[i]));
    }
    CHECK_SYMBOLS
    request req = {M_POST, "multipart/form-data; boundary=fixture"};
    asp_reent reent = {&req};
    for (int scenario=0; scenario<12; ++scenario) {
        writes=commits=external=fail_set=0; authorized=1;
        req.method=M_POST; req.content_type="multipart/form-data; boundary=fixture";
        filename="Settings_DSL-N12E-C1.cfg"; start="100"; end="200";
        if(scenario==0) authorized=0;
        if(scenario==1) req.method=1;
        if(scenario==2) req.content_type=NULL;
        if(scenario==3) req.content_type="application/x-www-form-urlencoded";
        if(scenario==4) filename="firmware.trx";
        if(scenario==5) filename="Settings_trx.cfg";
        if(scenario==6) filename="";
        if(scenario==7) start="";
        if(scenario==8) end=NULL;
        if(scenario==9) fail_set=1;
        if(scenario==10) fail_set=2;
        do_upload_cgi(&reent,NULL,NULL);
        assert(external==0);
        assert(commits==(scenario==11));
        assert(writes==(scenario==9 ? 1 : scenario>=10 ? 2 : 0));
    }
    writes=commits=external=0;
    do_upload_cgi(NULL,NULL,NULL);
    reent.server_env=NULL; do_upload_cgi(&reent,NULL,NULL);
    assert(!writes && !commits && !external);
    puts("PASS: request authorization, public symbols, restore guards and native commit ownership");
}
'''


def main():
    request_source = (SDK / 'request.c').read_text()
    asp_source = (SDK / 'asp/asp_handler.c').read_text()
    signatures = ('int AllPassUrl(char *url)', 'static int _pass_login_check(const char *url)')
    helper = function(request_source, 'static int is_public_symbol(const char *url)')
    guards = '\n'.join(function(request_source, s) for s in signatures)
    upload_sig = 'static void do_upload_cgi (asp_reent* reent, const asp_text* params, asp_text* ret)'
    upload = function(asp_source, upload_sig)
    symbols = '\n'.join(f'assert(AllPassUrl({json.dumps("/opendsl/symbols/" + p.name)})); '
                        f'assert(_pass_login_check({json.dumps("/opendsl/symbols/" + p.name)}));'
                        for p in sorted((ROOT / 'overlays/opendsl-ui/boaroot/html/opendsl/symbols').glob('*.svg')))
    assert symbols, 'no shipped symbols tested'
    main_c = MAIN.replace('CHECK_SYMBOLS', symbols)
    variants = {'candidate': (guards, upload),
                'old-auth': ('\n'.join(function((STOCK / 'request.c').read_text(), s) for s in signatures), upload),
                'old-restore': (guards, function((STOCK / 'asp/asp_handler.c').read_text(), upload_sig))}
    with tempfile.TemporaryDirectory(prefix='opendsl-request-qa-') as tmp:
        for label, (gates, handler) in variants.items():
            binary = Path(tmp) / label
            subprocess.run(['cc', '-std=gnu99', '-x', 'c', '-o', str(binary), '-'],
                           input=PREAMBLE + helper + gates + handler + main_c, text=True, check=True)
            result = subprocess.run([str(binary)], capture_output=True, text=True)
            assert (result.returncode == 0) == (label == 'candidate'), (label, result.stdout, result.stderr)
            print(result.stdout.strip() if label == 'candidate' else f'PASS: {label} defect control rejected')


if __name__ == '__main__':
    main()
