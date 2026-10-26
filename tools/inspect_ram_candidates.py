#!/usr/bin/env python3
"""Offline, byte-bound RAM candidate inventory for the supplied _743 firmware.

Requires pyelftools and Capstone. Never executes a firmware binary.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re

import capstone
import elftools
from capstone import Cs, CS_ARCH_MIPS, CS_MODE_BIG_ENDIAN, CS_MODE_MIPS32
from elftools.elf.elffile import ELFFile

RC_SHA256 = "39a069e679f3a36b963cedba02be2b5bd412197878a8db2e85a1754c3fa85a58"
REA_SYMBOL_EVIDENCE = "ev_21899086e00105e4e112f975eee2ad221832a6881810859e64a4a66f19ddd904"
COMPONENTS = [
    "sbin/rc", "userfs/bin/cfg_manager", "userfs/bin/rstats",
    "userfs/bin/sysstate", "userfs/bin/spectrum", "userfs/bin/networkmap",
    "userfs/bin/infosvr", "usr/sbin/protect_srv", "userfs/bin/ac",
    "userfs/bin/access_log", "userfs/bin/miniupnpd", "userfs/bin/monitorcfgmgr",
    "lib/modules/mldsnooping.ko",
    "lib/modules/2.6.22.15/kernel/net/bridge/netfilter/ebt_ip6.ko",
    "lib/modules/2.6.22.15/kernel/net/sched/act_mirred.ko",
    "lib/modules/2.6.22.15/kernel/net/sched/sch_tbf.ko",
]
FUNCTIONS = ["init_main", "start_services", "start_ptcsrv", "start_httpd",
             "start_infosvr", "start_rstats", "start_spectrum", "start_sysstate",
             "stop_rstats", "stop_spectrum", "stop_sysstate", "_xstart"]
EXPECTED_START_CALLS = ["start_ptcsrv", "start_httpd", "start_infosvr",
                        "start_rstats", "start_spectrum", "start_sysstate"]
# Explicit addresses selected from this binary's wrapper instructions, not a
# generic data-flow engine. Include the instructions in the companion listing.
ARGUMENT_STRINGS = {"rstats": 0x413D9C, "sysstate": 0x413D90,
                    "spectrum": 0x4130C0, "protect_srv": 0x413D84,
                    "infosvr": 0x413E14, "infosvr_interface": 0x413F58}
GOT_SLOTS = {"start_services": -0x7D68, "_xstart": -0x7FC8,
             "_eval": -0x7E8C, "tcapi_set": -0x7E2C}
STRING_NEEDLES = (b"/proc/", b"/tmp/", b"/var/", b"rstats_enable",
                  b"TrafficMonitor_Entry", b"iptables", b"SSH", b"TELNET")


def elf_inventory(root, relative):
    data = (root / relative).read_bytes()
    elf = ELFFile(io.BytesIO(data))
    sections = [{"name": s.name, "bytes": s["sh_size"],
                 "type": s["sh_type"]} for s in elf.iter_sections()
                if s["sh_flags"] & 2]  # SHF_ALLOC, not measured resident memory.
    strings = [{"file_offset": m.start(), "text": m.group().decode("ascii")}
               for m in re.finditer(rb"[\x20-\x7e]{4,}", data)
               if any(n in m.group() for n in STRING_NEEDLES)]
    return {"path": relative, "sha256": hashlib.sha256(data).hexdigest(),
            "disk_bytes": len(data), "elf_type": elf["e_type"],
            "alloc_section_bytes": sum(s["bytes"] for s in sections),
            "bss_sbss_bytes": sum(s["bytes"] for s in sections
                                  if s["name"] in (".bss", ".sbss")),
            "alloc_sections": sections,
            "load_segments": [{"file_bytes": p["p_filesz"],
                               "memory_bytes": p["p_memsz"], "flags": p["p_flags"]}
                              for p in elf.iter_segments() if p["p_type"] == "PT_LOAD"],
            "selected_printable_strings": strings}


def inspect_rc(path):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != RC_SHA256:
        raise ValueError("rc differs from the reviewed _743 binary; addresses must be reviewed")
    elf = ELFFile(io.BytesIO(data))
    if elf.elfclass != 32 or elf.little_endian or elf["e_machine"] != "EM_MIPS":
        raise ValueError("Expected a big-endian MIPS32 ELF")
    symbols = {s.name: s for s in elf.get_section_by_name(".symtab").iter_symbols()
               if s.name}
    names = {s["st_value"]: name for name, s in symbols.items()
             if s["st_info"]["type"] == "STT_FUNC"}

    def at(address, size):
        for seg in elf.iter_segments():
            if (seg["p_type"] == "PT_LOAD" and seg["p_vaddr"] <= address
                    and address + size <= seg["p_vaddr"] + seg["p_filesz"]):
                offset = seg["p_offset"] + address - seg["p_vaddr"]
                return data[offset:offset + size]
        raise ValueError(f"Unmapped file-backed address: {address:#x}")

    disassembler = Cs(CS_ARCH_MIPS, CS_MODE_MIPS32 | CS_MODE_BIG_ENDIAN)
    functions, listing = [], [
        "Ordinary Capstone static disassembly, not REA decompilation or runtime evidence.",
        f"sbin/rc SHA-256: {RC_SHA256}",
        f"Capstone {capstone.__version__}; pyelftools {elftools.__version__}",
        "MIPS delay slots are included; indirect calls require manual/GOT review.", ""]
    for name in FUNCTIONS:
        sym = symbols[name]
        instructions = list(disassembler.disasm(at(sym["st_value"], sym["st_size"]),
                                                sym["st_value"]))
        if sum(i.size for i in instructions) != sym["st_size"]:
            raise ValueError(f"Incomplete disassembly of {name}")
        calls = [{"instruction_address": hex(i.address),
                  "target_address": hex(int(i.op_str, 16)),
                  "target_symbol": names.get(int(i.op_str, 16))}
                 for i in instructions if i.mnemonic == "jal"]
        functions.append({"name": name, "address": hex(sym["st_value"]),
                          "size": sym["st_size"], "direct_calls": calls})
        listing.append(f"{name} at {sym['st_value']:#x}, {sym['st_size']} bytes")
        for ins in instructions:
            suffix = ""
            if ins.mnemonic == "jal":
                suffix = " ; " + names.get(int(ins.op_str, 16), "unknown symbol")
            listing.append(f"{ins.address:08x}  {bytes(ins.bytes).hex()}  "
                           f"{ins.mnemonic:8s} {ins.op_str}{suffix}")
        listing.append("")
    start = next(f for f in functions if f["name"] == "start_services")
    if [c["target_symbol"] for c in start["direct_calls"]] != EXPECTED_START_CALLS:
        raise ValueError("Startup call sequence changed")
    gp = symbols["_gp"]["st_value"]
    got = [{"symbol": name, "gp_offset": offset,
            "slot_address": hex(gp + offset),
            "resolved_address": hex(int.from_bytes(at(gp + offset, 4), "big"))}
           for name, offset in GOT_SLOTS.items()]
    for entry in got:
        if int(entry["resolved_address"], 16) != symbols[entry["symbol"]]["st_value"]:
            raise ValueError("GOT resolution disagrees with symbol table")
    strings = {}
    for name, address in ARGUMENT_STRINGS.items():
        strings[name] = {"address": hex(address),
                         "text": at(address, 64).split(b"\0", 1)[0].decode("ascii")}
    return {"path": "sbin/rc", "sha256": RC_SHA256,
            "functions": functions, "gp": hex(gp), "selected_got_slots": got,
            "selected_argument_strings": strings}, "\n".join(listing)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rootfs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--disassembly", type=Path, required=True)
    args = parser.parse_args()
    rc, listing = inspect_rc(args.rootfs / "sbin/rc")
    result = {
        "scope": "Offline inventory of selected components in the supplied _743 image",
        "tools": {"pyelftools": elftools.__version__, "capstone": capstone.__version__},
        "rea_symbol_evidence_id": REA_SYMBOL_EVIDENCE,
        "components": [elf_inventory(args.rootfs, p) for p in COMPONENTS],
        "rc_static_analysis": rc,
        "limitations": [
            "This file is ordinary Python/Capstone evidence; only the linked symbol record is REA Evidence.",
            "Static startup attempts are not observations of live or persistent processes.",
            "File size, SHF_ALLOC totals and BSS are not RSS/PSS or measured memory savings.",
            "Kernel object ALLOC includes potentially discarded init sections; presence is not proof of loading.",
            "Selected strings do not establish their reachability or behavior.",
            "Source code, dynamic heap/IPC use and live RAM measurements are unavailable.",
        ]}
    args.out.write_text(json.dumps(result, indent=2) + "\n")
    args.disassembly.write_text(listing + "\n")
    print(f"Wrote {len(COMPONENTS)} ELF inventories and {len(FUNCTIONS)} function listings")


if __name__ == "__main__":
    main()
