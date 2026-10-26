#!/usr/bin/python3
"""Keep the linker's unstripped ELF, then invoke the exact vendor strip tool."""
import os
import pathlib
import shutil
import subprocess
import sys

target = pathlib.Path(sys.argv[-1])
out = pathlib.Path('/work/out') / os.environ['NATIVE_PHASE']
out.mkdir(parents=True, exist_ok=True)
shutil.copy2(target, out / (target.name + '.unstripped'))
raise SystemExit(subprocess.call(['/opt/trendchip/mips-linux-uclibc/usr/bin/mips-linux-uclibc-strip', *sys.argv[1:]]))
