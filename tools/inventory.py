#!/usr/bin/env python3
"""Collect byte-bound ELF/component observations, without running target binaries."""
import argparse
import hashlib
import json
from pathlib import Path
import re

from elftools.elf.elffile import ELFFile

COMPONENTS = ["bin/busybox", "userfs/bin/boa", "userfs/bin/cfg_manager",
              "userfs/bin/dnsmasq", "userfs/bin/openssl", "userfs/bin/wpa_supplicant",
              "userfs/bin/miniupnpd", "lib/libc.so.0", "lib/libssl.so.1.0.0",
              "lib/libcrypto.so.1.0.0"]
LABELS = re.compile(rb"BusyBox v[^\x00\n]{1,110}|OpenSSL [0-9][^\x00\n]{1,70}|"
                    rb"wpa_supplicant v[0-9.]+|MiniUPnPd/1\.9|(?<![\x20-\x7e])2\.78(?=\x00)")


def inspect(path, relative):
    data = path.read_bytes()
    record = {"path": relative, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
    with path.open("rb") as stream:
        elf = ELFFile(stream)
        record["elf"] = {"class": elf.elfclass, "little_endian": elf.little_endian,
                         "machine": elf.header["e_machine"], "type": elf.header["e_type"],
                         "flags": hex(elf.header["e_flags"]), "entry": hex(elf.header["e_entry"])}
        record["program_headers"] = [{"type": p["p_type"], "flags": p["p_flags"],
                                      "offset": p["p_offset"], "file_size": p["p_filesz"]}
                                     for p in elf.iter_segments()]
        dynamic = elf.get_section_by_name(".dynamic")
        record["needed_libraries"] = [t.needed for t in dynamic.iter_tags()
                                      if t.entry.d_tag == "DT_NEEDED"] if dynamic else []
        symbols = elf.get_section_by_name(".dynsym")
        record["imported_symbols"] = sorted({s.name for s in symbols.iter_symbols()
                                              if s["st_shndx"] == "SHN_UNDEF" and s.name}) if symbols else []
    record["version_label_candidates"] = [{"file_offset": m.start(), "text": m.group().decode("ascii")}
                                          for m in LABELS.finditer(data)]
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rootfs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = {"components": [inspect(args.rootfs / p, p) for p in COMPONENTS],
              "limitations": ["Version strings are embedded labels, not proof of patch level or CVE applicability.",
                               "ELF flags describe file metadata, not effective hardware/runtime memory protections.",
                               "Imported unsafe C APIs alone do not establish a vulnerability.",
                               "Python pyelftools is the parser; this is shell-tool evidence, not REA Evidence."]}
    args.out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Wrote {len(result['components'])} components to {args.out}")


if __name__ == "__main__":
    main()
