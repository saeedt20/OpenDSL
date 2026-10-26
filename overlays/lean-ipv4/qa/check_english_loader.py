#!/usr/bin/env python3
"""Host-only exact-source dictionary parser test; no firmware executable runs."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO/'artifacts/source/extracted/dsl-n12e-c1_gpl/apps/public/boa-asp/src/asp/parsers.c'
HEADER = SOURCE.with_suffix('.h')
PATCH = Path(__file__).resolve().parents[1]/'source-patches/0004-boa-english-only-dictionary.patch'
STUB = r'''
extern int fake_type;
extern int reads;
static int tcapi_get(const char *node, const char *name, char *out) {
    (void)node; (void)name; ++reads; snprintf(out,4,"%d",fake_type); return 0;
}
#define tcdbg_printf(...) ((void)0)
'''
HARNESS = r'''
int fake_type = 14;
int reads = 0;
int main(void) {
    const int types[] = {0,1,2,3,14,19,99};
    char value[MAX_VALUE];
    initParseStruct();
    for(unsigned int i=0;i<sizeof(types)/sizeof(types[0]);++i) {
        fake_type=types[i];
        if(initandparserfile()!=SUCCESS) return 20;
        if(getString("hello",value)!=5 || strcmp(value,"Hello")) return 21;
        if(getString("brand",value)!=7 || strcmp(value,"OpenDSL")) return 22;
        if(islangChanged()!=0) return 23;
    }
    closefp(); ResetHashTable(&s_parse);
    if(reads!=0) return 24;
    puts("7 persisted-language cases passed with EN-only dictionary, no config reads/writes or reload requests");
    return 0;
}
'''

def main():
    with tempfile.TemporaryDirectory(prefix='odsl-en-') as task_tmp:
        task_tmp=Path(task_tmp)
        assert len(str(task_tmp/'EN.dict'))<32
        (task_tmp/'EN.dict').write_text('hello=Hello\nbrand=OpenDSL\n')
        rel=Path('apps/public/boa-asp/src/asp/parsers.c')
        target=task_tmp/rel;target.parent.mkdir(parents=True)
        target.write_bytes(SOURCE.read_bytes())
        subprocess.run(['patch','--batch','-p1','--directory',str(task_tmp),'--input',str(PATCH)],check=True,capture_output=True,text=True)
        patched=target.read_text()
        header=HEADER.read_text().replace('"/userfs/%s.dict"','"'+str(task_tmp/'%s.dict')+'"')
        (task_tmp/'parsers.h').write_text(header)
        (task_tmp/'tcapi-test.h').write_text(STUB)
        results={}
        for label,source in [('original',SOURCE.read_text()),('patched',patched)]:
            source=source.replace('#include "../../../lib/libtcapi.h"','#include "tcapi-test.h"')
            cfile=task_tmp/(label+'.c');binary=task_tmp/label
            cfile.write_text(source+'\n'+HARNESS)
            subprocess.run([os.environ.get('CC','cc'),'-std=gnu99','-O0','-g','-DTCSUPPORT_GENERAL_MULTILANGUAGE','-fsanitize=address,undefined','-fno-omit-frame-pointer',str(cfile),'-o',str(binary)],check=True,capture_output=True,text=True)
            run=subprocess.run([str(binary)],env=dict(os.environ,ASAN_OPTIONS='detect_leaks=0',UBSAN_OPTIONS='halt_on_error=1'),capture_output=True,text=True)
            if label=='original':
                assert run.returncode==20,(run.returncode,run.stderr)
                results[label]='Expected dictionary-open failure when only EN.dict exists but saved language is non-English'
            else:
                assert run.returncode==0,(run.returncode,run.stderr)
                results[label]=run.stdout.strip()
        print(json.dumps({'scope':'Host exact-parser logic with stubbed config API and relocated fixture dictionary path; not device testing','results':results},indent=2))

if __name__=='__main__':main()
