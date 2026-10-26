#!/usr/bin/env python3
"""Build reviewed GPL filesystem/image tools in the isolated build container."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def run(*args, **kw):
    print("+", " ".join(str(x) for x in args), flush=True)
    subprocess.run([str(x) for x in args], check=True, **kw)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sdk", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--patches", type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir()
    for name in ("squashfs-tools", "trx"):
        shutil.copytree(args.sdk / "tools" / name, args.out / name, symlinks=True)
    run("patch", "--batch", "--fuzz=0", "-p1", "-d", args.out,
        "-i", args.patches / "0002-host-squashfs-metadata.patch")
    sq = args.out / "squashfs-tools"
    lzma = sq / "lzma/C/7zip/Compress/LZMA_Lib"
    # Do not reuse the SDK's old host object files or bundled executables.
    for folder in (sq, lzma, args.out / "trx"):
        for pattern in ("*.o", "*.a"):
            for file in folder.glob(pattern):
                file.unlink()
    run("make", "-C", lzma, "-j2", "CXX=g++ -O2 -std=gnu++98 -fpermissive")
    flags = "-I. -O2 -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE -fcommon -include sys/sysmacros.h"
    run("make", "-C", sq, "-j2", "mksquashfs-lzma", "unsquashfs.o", f"CFLAGS={flags}")
    # The supplied unsquashfs target links zlib; use the matching LZMA wrapper
    # for the actual firmware's compressed data and metadata.
    run("g++", sq / "unsquashfs.o", "-L" + str(lzma), "-llzma", "-o", sq / "unsquashfs-lzma")
    run("gcc", "-O2", "-DTRENDCHIP", '-DPRODUCTNAME="DSL-N12E-C1"',
        args.out / "trx/trx.c", "-o", args.out / "trx/trx")
    binaries = [sq / "mksquashfs-lzma", sq / "unsquashfs-lzma", args.out / "trx/trx"]
    manifest = {"tools": [{"path": str(f.relative_to(args.out)),
                           "sha256": hashlib.sha256(f.read_bytes()).hexdigest()}
                          for f in binaries],
                "host_compatibility_flags": flags,
                "lzma_cxx": "g++ -O2 -std=gnu++98 -fpermissive",
                "notes": ["Built from official _743 GPL source, never firmware executables.",
                          "The compiler environment is recorded separately by image digest and package versions."]}
    (args.out / "build-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
