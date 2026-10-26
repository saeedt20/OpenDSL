#!/usr/bin/env python3
"""Host-only regression probe of the exact recovered Boa header function.

Hardware/config/network calls are stubbed. No MIPS firmware binary is executed.
Requires host cc supporting ASan/UBSan and -ftrivial-auto-var-init=pattern.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO / 'artifacts/source/extracted/dsl-n12e-c1_gpl/apps/public/boa-asp/src/asp/asp_handler.c'
PREAMBLE = r'''
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
typedef struct request { int unused; } request;
typedef enum { CLI_TYPE_BROWSER=0, CLI_TYPE_APP, CLI_TYPE_ATE, CLI_TYPE_ASSIA, CLI_TYPE_IFTTT } CLIENT_TYPE;
#define EXTEND_AIHOME_API_LEVEL 8
#define EXTEND_HTTPD_AIHOME_VER 0
#define EXTEND_ASSIA_API_LEVEL 1
#define _dprintf(...) ((void)0)
static char *charset;
static char captured[4096];
static int fail_write;
static const char *get_productid(void) { return "DSL-N12E_C1"; }
static void rfc822_time_buf(char *target, time_t ignored) {
    (void)ignored; memcpy(target, "Sun, 18 Oct 2026 12:00:00 GMT", 29);
}
static int req_write(request *req, const char *text) {
    (void)req; snprintf(captured, sizeof(captured), "%s", text); return fail_write;
}
static int asp_send_response(void *ignored, const char *text, size_t size) {
    (void)ignored; assert(size < sizeof(captured)); memcpy(captured, text, size);
    captured[size] = 0; return fail_write;
}
'''
MAIN = r'''
int main(int argc, char **argv) {
    request req;
    if (argc > 1 && !strcmp(argv[1], "baseline")) {
        charset = "utf-8";
        /* Original function reads an uninitialized set_cookie on this path. */
        return http_login_header(NULL, &req, CLI_TYPE_BROWSER);
    }
    const char *token = "0123456789abcdef0123456789abcdef";
    int cases = 0;
    for (int encoding=0; encoding<2; ++encoding)
    for (int channel=0; channel<2; ++channel)
    for (int client=CLI_TYPE_BROWSER; client<=CLI_TYPE_IFTTT; ++client)
    for (int success=0; success<2; ++success) {
        charset = encoding ? "utf-8" : NULL;
        captured[0] = 0;
        fail_write = 0;
        assert(http_login_header(success ? token : NULL, channel ? &req : NULL, client) == 0);
        assert(!strncmp(captured, "HTTP/1.0 200 OK\r\n", 17));
        assert(strstr(captured, "Connection: close\r\n\r\n"));
        assert(strstr(captured, encoding ? "charset=utf-8\r\n" : "charset=ISO-8859-1\r\n"));
        if (success) assert(strstr(captured, "Set-Cookie: asus_token=0123456789abcdef0123456789abcdef; HttpOnly;\r\n"));
        else assert(!strstr(captured, "Set-Cookie:"));
        if (client == CLI_TYPE_APP) assert(strstr(captured, "Model_Name: DSL-N12E_C1\r\n"));
        if (client == CLI_TYPE_ASSIA) assert(strstr(captured, "ASSIA_API_Level: 1\r\n"));
        ++cases;
    }
    fail_write = 1;
    assert(http_login_header(NULL, &req, CLI_TYPE_BROWSER) == -1); ++cases;
    assert(http_login_header(NULL, NULL, CLI_TYPE_BROWSER) == -1); ++cases;
    printf("%d host-only header cases passed\n", cases);
    return 0;
}
'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--cc', default=os.environ.get('CC', 'cc'))
    args = parser.parse_args()
    source = args.source.read_text()
    start = source.index('int http_login_header(')
    end = source.index('\n/*******************************************************************', start)
    function = source[start:end]
    old = '\tchar set_cookie[256];'
    assert function.count(old) == 1, 'Expected one original uninitialized cookie array'
    patched = function.replace(old, '\tchar set_cookie[256] = {0};')
    flags = ['-std=gnu99', '-O0', '-g', '-fsanitize=address,undefined', '-fno-omit-frame-pointer', '-ftrivial-auto-var-init=pattern']
    env = dict(os.environ, ASAN_OPTIONS='detect_leaks=0:abort_on_error=0', UBSAN_OPTIONS='halt_on_error=1')
    with tempfile.TemporaryDirectory(prefix='opendsl-boa-cookie-') as task_tmp:
        task_tmp = Path(task_tmp)
        results = {}
        for label, body in [('original', function), ('patched', patched)]:
            cfile = task_tmp / f'{label}.c'
            binary = task_tmp / label
            cfile.write_text(PREAMBLE + body + MAIN)
            subprocess.run([args.cc, *flags, str(cfile), '-o', str(binary)], check=True, capture_output=True, text=True)
            run = subprocess.run([str(binary), *(['baseline'] if label == 'original' else [])], env=env, capture_output=True, text=True)
            if label == 'original':
                assert run.returncode != 0, 'Original null-token path unexpectedly passed sanitizer probe'
                assert 'stack-buffer-overflow' in run.stderr, run.stderr[:2000]
                results[label] = 'ASan reproduces stack-buffer-overflow when token is NULL (forced initialization pattern makes the uninitialized read deterministic)'
            else:
                assert run.returncode == 0, run.stderr[:2000]
                assert '42 host-only header cases passed' in run.stdout, run.stdout
                results[label] = run.stdout.strip()
        print(json.dumps({'scope': 'Isolated exact-source host function with stubbed I/O; not device execution', 'source': str(args.source), 'source_function_sha256': hashlib.sha256(function.encode()).hexdigest(), 'results': results}, indent=2))

if __name__ == '__main__':
    main()
