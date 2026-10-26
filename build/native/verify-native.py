#!/usr/bin/env python3
"""Static ELF/source manifest only. Never loads target code for execution."""
import hashlib
import io
import json
import pathlib

from elftools.elf.elffile import ELFFile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / 'artifacts/source/extracted/dsl-n12e-c1_gpl'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inspect(path):
    data = path.read_bytes()
    elf = ELFFile(io.BytesIO(data))
    dynamic = elf.get_section_by_name('.dynamic')
    symbols = elf.get_section_by_name('.dynsym')
    return {
        'path': str(path.relative_to(ROOT)),
        'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'elf_class': elf.elfclass, 'little_endian': elf.little_endian,
        'machine': elf.header['e_machine'], 'flags': hex(elf.header['e_flags']),
        'interpreter': [s.get_interp_name() for s in elf.iter_segments() if s['p_type'] == 'PT_INTERP'],
        'needed': [t.needed for t in dynamic.iter_tags() if t.entry.d_tag == 'DT_NEEDED'],
        'undefined_symbols': sorted(s.name for s in symbols.iter_symbols() if s.name and s['st_shndx'] == 'SHN_UNDEF'),
        'symtab_present': elf.get_section_by_name('.symtab') is not None,
        'text_size': elf.get_section_by_name('.text')['sh_size'],
        'bss_size': elf.get_section_by_name('.bss')['sh_size'],
    }

results = {}
for program, original in [('rc', 'sbin/rc'), ('boa', 'userfs/bin/boa')]:
    entries = {'stock': inspect(ROOT / 'analysis/verified/rootfs' / original)}
    for phase in ['baseline', 'candidate']:
        entries[phase] = inspect(HERE / 'out' / phase / program)
    for phase in ['baseline', 'candidate']:
        for key in ['elf_class', 'little_endian', 'machine', 'flags', 'interpreter', 'needed']:
            assert entries[phase][key] == entries['stock'][key], (program, phase, key)
        entries[phase]['added_undefined_symbols_vs_stock'] = sorted(set(entries[phase]['undefined_symbols']) - set(entries['stock']['undefined_symbols']))
        assert not entries[phase]['added_undefined_symbols_vs_stock'], (program, phase, 'new ABI requirements')
    entries['baseline_byte_identical_to_stock'] = entries['stock']['sha256'] == entries['baseline']['sha256']
    results[program] = entries
assert results['rc']['baseline_byte_identical_to_stock']

inputs = []
for relative in ['apps/public/rc', 'apps/public/boa-asp/src', 'Project']:
    for original in sorted((SOURCE / relative).rglob('*')):
        if not original.is_file() or original.is_symlink():
            continue
        # All original files in these narrow source/recipe trees, including configs.
        rel = original.relative_to(SOURCE)
        local = HERE / 'sdk' / rel
        inputs.append({'path': str(rel), 'official_sha256': sha(original),
                       'build_sha256': sha(local) if local.is_file() else None,
                       'changed': sha(original) != sha(local) if local.is_file() else True})
results['source_inputs'] = inputs
results['changed_official_source_inputs'] = [x for x in inputs if x['changed']]
results['host_inputs'] = [
    {'path': str(p.relative_to(ROOT)), 'sha256': sha(p), 'size': p.stat().st_size}
    for p in [HERE/'host-libs/libz.so.1', HERE/'host-tools/bison-2.5-install/bin/bison', HERE/'host-tools/install/bin/flex']
]
for name in ['run-container.py', 'build-native.py', 'capture-strip.py', 'rebuild-native.py', 'BUILD.md', 'tool-versions.txt', 'rc-no-monitor-start.patch', 'boa-english-only-dictionary.patch', 'boa-retire-online-update-controller.patch', 'vendor-env.nul', 'dependency-inputs.json', 'host-tools/bison-2.5-glibc-compat.patch']:
    p=HERE/name
    results.setdefault('build_recipe_inputs', []).append({'path': str(p.relative_to(ROOT)), 'sha256': sha(p)})
request_patch = ROOT / 'patches/0005-boa-protect-config-restore-and-static-symbols.patch'
results['build_recipe_inputs'].append({'path': str(request_patch.relative_to(ROOT)), 'sha256': sha(request_patch)})
results['generated_parser_inputs'] = [
    {'path': str(p.relative_to(HERE)), 'sha256': sha(p)}
    for p in [HERE/'sdk/apps/public/boa-asp/src/asp/grammar.c', HERE/'sdk/apps/public/boa-asp/src/asp/grammar.h', HERE/'sdk/apps/public/boa-asp/src/y.tab.c', HERE/'sdk/apps/public/boa-asp/src/y.tab.h', HERE/'sdk/apps/public/boa-asp/src/lex.yy.c']
]
results['rc_disabled_start_functions'] = {}
for phase in ['baseline', 'candidate']:
    obj=ELFFile(io.BytesIO((HERE/'out'/phase/'rc-services.o').read_bytes()))
    for name in ['start_rstats', 'start_spectrum', 'start_sysstate', 'start_infosvr', 'start_ptcsrv']:
        symbol=obj.get_section_by_name('.symtab').get_symbol_by_name(name)[0]
        section=obj.get_section(symbol['st_shndx'])
        code=section.data()[symbol['st_value']:symbol['st_value']+symbol['st_size']]
        results['rc_disabled_start_functions'].setdefault(name, {})[phase]={'size':len(code),'hex':code.hex()}
        if phase=='candidate' and name in ['start_rstats', 'start_spectrum', 'start_sysstate']:
            assert code.hex()=='03e0000800000000', name  # jr $ra; nop, no calls
assert {x['path'] for x in results['changed_official_source_inputs']} == {
    'apps/public/rc/services.c', 'apps/public/boa-asp/src/asp/asp_handler.c', 'apps/public/boa-asp/src/asp/parsers.c', 'apps/public/boa-asp/src/request.c'
}
(HERE / 'native-manifest.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps({p: {k: v for k,v in results[p].items() if k == 'baseline_byte_identical_to_stock'} for p in ['rc','boa']}))
print('Changed official inputs:', [x['path'] for x in results['changed_official_source_inputs']])
