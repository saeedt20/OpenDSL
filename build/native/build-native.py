#!/usr/bin/env python3
"""Run only vendor cross-compiler/host make; never execute generated MIPS code."""
import json, os, pathlib, shutil, subprocess, sys
work=pathlib.Path('/work')
env=dict(x.decode().split('=',1) for x in (work/'vendor-env.nul').read_bytes().split(b'\0') if b'=' in x)
env['PATH']='/work/host-tools/bison-2.5-install/bin:/work/host-tools/install/bin:/opt/trendchip/mips-linux-uclibc/usr/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
env['MAKEFLAGS']=''
env['LD_LIBRARY_PATH']='/host-libs'
phase,program=sys.argv[1:]
env['NATIVE_PHASE']=phase
env['STRIP']='python3 /work/capture-strip.py'
if program=='rc':
 directory=work/'sdk/apps/public/rc'
 subprocess.run(['make','-C',str(directory),'-j2','rc'],env=env,check=True)
else:
 directory=work/'sdk/apps/public/boa-asp/src'
 subprocess.run(['make','-C',str(directory/'asp')],env=env,check=True)
 subprocess.run(['make','-C',str(directory),'boa'],env=env,check=True)
target=work/'out'/phase
target.mkdir(parents=True,exist_ok=True)
shutil.copy2(directory/program,target/program)
if program=='rc':
 shutil.copy2(directory/'services.o',target/'rc-services.o')
(work/'out'/phase/f'{program}-environment.json').write_text(json.dumps(env,indent=2)+'\n')
