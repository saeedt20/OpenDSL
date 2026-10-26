#!/usr/bin/env python3
"""Inside the isolated container, rebuild source baselines then patched candidates."""
import pathlib
import shutil
import subprocess

work = pathlib.Path('/work')
source = pathlib.Path('/source')
sdk = work/'sdk'

for relative in [
    'apps/public/rc/services.c',
    'apps/public/boa-asp/src/asp/asp_handler.c',
    'apps/public/boa-asp/src/asp/parsers.c',
    'apps/public/boa-asp/src/request.c',
]:
    shutil.copy2(source/relative, sdk/relative)

for relative in [
    'apps/public/rc/services.o', 'apps/public/rc/rc',
    'apps/public/boa-asp/src/asp/asp_handler.o',
    'apps/public/boa-asp/src/asp/parsers.o',
    'apps/public/boa-asp/src/request.o',
    'apps/public/boa-asp/src/asp/grammar.c',
    'apps/public/boa-asp/src/asp/grammar.h',
    'apps/public/boa-asp/src/asp/grammar.o',
    'apps/public/boa-asp/src/y.tab.c',
    'apps/public/boa-asp/src/y.tab.h',
    'apps/public/boa-asp/src/y.tab.o',
    'apps/public/boa-asp/src/lex.yy.c',
    'apps/public/boa-asp/src/lex.yy.o',
    'apps/public/boa-asp/src/timestamp.o',
    'apps/public/boa-asp/src/boa',
]:
    (sdk/relative).unlink(missing_ok=True)

for program in ['rc', 'boa']:
    subprocess.run(['python3', '/work/build-native.py', 'baseline', program], check=True)

for patch in [
    '/work/rc-no-monitor-start.patch',
    '/patches/0003-boa-initialize-login-cookie-header.patch',
    '/work/boa-english-only-dictionary.patch',
    '/work/boa-retire-online-update-controller.patch',
    '/patches/0005-boa-protect-config-restore-and-static-symbols.patch',
]:
    subprocess.run(['patch', '--batch', '--fuzz=0', '-p1', '-i', patch], cwd=sdk, check=True)

for program in ['rc', 'boa']:
    subprocess.run(['python3', '/work/build-native.py', 'candidate', program], check=True)
