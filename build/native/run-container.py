#!/usr/bin/env python3
"""Run a recorded, isolated host cross-compilation command; never MIPS output."""
import datetime, json, os, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[2]
native=root/'build/native'
command=sys.argv[1:]
assert command
args=['docker','run','--rm','--user','1000:1000','--network','none','--cap-drop','ALL',
      '--security-opt','no-new-privileges','--read-only',
      '--mount',f'type=bind,src={root}/artifacts/source/extracted/dsl-n12e-c1_gpl,dst=/source,readonly',
      '--mount',f'type=bind,src={native},dst=/work',
      '--mount',f'type=bind,src={native}/toolchain/mips-linux-uclibc,dst=/opt/trendchip/mips-linux-uclibc,readonly',
      '--mount',f'type=bind,src={root}/patches,dst=/patches,readonly',
      '--mount',f'type=bind,src={native}/host-libs,dst=/host-libs,readonly',
      '--tmpfs','/tmp:rw,nosuid,nodev,mode=1777','--workdir','/work/sdk',
      'sha256:726a561f12fa35cf2b5a7b639927d64558e1599f92be28845de3312c546b2df1',*command]
with (native/'commands.jsonl').open('a') as output:
 output.write(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args})+'\n')
raise SystemExit(subprocess.call(args))
