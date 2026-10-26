#!/usr/bin/env python3
"""Validate and split this model's 2RDH image without executing firmware code."""

import argparse
import hashlib
import json
import lzma
from pathlib import Path, PurePosixPath
import struct
import subprocess
import zipfile
import zlib

STOCK_ZIP_SHA256 = "2c257096c26297c151ef28cad4d080ea22756a14b93024e1a00fd917c66d365d"
STOCK_TRX_SHA256 = "927d93267ef1b33a5383e9b7b046287be20922586fb489f50352e83056603f4c"
STOCK_MD5 = "62fb2fb1b01d3f6e9ef4a14d10c9ee69"
MAX_IMAGE = 16 * 1024 * 1024


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def inspect_image(data):
    if len(data) < 256 or len(data) > MAX_IMAGE or data[:4] != b"2RDH":
        raise ValueError("Expected a bounded DSL-N12E-C1 2RDH image")
    header_size, total_size, checksum = struct.unpack_from(">III", data, 4)
    kernel_size, rootfs_size, third_size = struct.unpack_from(">III", data, 0x50)
    if header_size != 256 or total_size != len(data) or third_size != 0:
        raise ValueError("Unsupported header/lengths/third region")
    if header_size + kernel_size + rootfs_size != total_size:
        raise ValueError("Region lengths do not cover image exactly")
    calculated = zlib.crc32(data[header_size:]) ^ 0xFFFFFFFF
    if calculated != checksum:
        raise ValueError("Payload checksum mismatch")
    model = data[0x7C:0x9C].split(b"\0", 1)[0].decode("ascii")
    if model != "DSL-N12E-C1":
        raise ValueError(f"Unexpected model {model!r}")
    root_offset = header_size + kernel_size
    if data[root_offset:root_offset + 4] != b"sqsh":
        raise ValueError("Expected big endian SquashFS root filesystem")
    decoder = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE, memlimit=32 << 20)
    kernel = decoder.decompress(data[header_size:root_offset], max_length=32 << 20)
    if not decoder.eof or decoder.unused_data:
        raise ValueError("Kernel is oversized, incomplete, or has trailing data")
    return {
        "model": model,
        "sha256": sha256(data),
        "md5": hashlib.md5(data).hexdigest(),
        "size": total_size,
        "header": {"offset": 0, "size": header_size, "magic": "2RDH"},
        "checksum": {"offset": 12, "stored": f"0x{checksum:08x}",
                     "algorithm": "zlib.crc32(payload) XOR 0xffffffff", "valid": True},
        "kernel": {"offset": header_size, "size": kernel_size, "compression": "LZMA alone",
                   "sha256": sha256(data[header_size:root_offset]),
                   "decompressed_size": len(kernel), "decompressed_sha256": sha256(kernel)},
        "rootfs": {"offset": root_offset, "size": rootfs_size,
                   "sha256": sha256(data[root_offset:]), "format": "SquashFS 3.0 BE, LZMA (7-Zip observation)"},
        "limitations": ["Checksum rule is measured on this supplied image; CRC is not authentication.",
                        "Header bytes outside parsed fields remain opaque.",
                        "No image construction, firmware execution, hardware identity verification or flash writes."],
    }, kernel


def extract_for_analysis(image, out):
    """Materialize regular files only; record symlink data instead of creating links."""
    listing = subprocess.run(["7z", "l", "-slt", str(image)], check=True,
                             capture_output=True, text=True).stdout
    (out / "squashfs-listing.txt").write_text(listing)
    entries = []
    for block in listing.split("----------\n", 1)[1].strip().split("\n\n"):
        fields = dict(line.split(" = ", 1) for line in block.splitlines() if " = " in line)
        name = fields["Path"]
        path = PurePosixPath(name)
        if (not name or path.is_absolute() or ".." in path.parts or
                any(c in name for c in "\n\r\0*?\\") or name.startswith("-")):
            raise ValueError(f"Unsafe archive name {name!r}")
        entries.append(fields)
    if len(entries) > 4096 or sum(int(e.get("Size") or 0) for e in entries) > 64 << 20:
        raise ValueError("Extraction budget exceeded")
    files = [e for e in entries if e["Mode"].startswith("-")]
    links = [e for e in entries if e["Mode"].startswith("l")]
    special = [e for e in entries if e["Mode"][0] not in "-ld"]
    root = out / "rootfs"
    root.mkdir()
    selected = out / "regular-files.txt"
    selected.write_text("\n".join(e["Path"] for e in files) + "\n")
    with (out / "extraction.log").open("w") as log:
        subprocess.run(["7z", "x", "-y", "-spd", f"-o{root}", f"-i@{selected}", str(image)],
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    manifest = []
    for e in entries:
        record = {"path": e["Path"], "mode": e["Mode"], "uid": int(e["User ID"]),
                  "gid": int(e["Group ID"]), "modified": e.get("Modified")}
        if e in files:
            path = root / e["Path"]
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"Expected regular file {path}")
            content = path.read_bytes()
            if len(content) != int(e["Size"]):
                raise ValueError(f"Length mismatch {path}")
            record.update(size=len(content), sha256=sha256(content), materialized=True)
            path.chmod(0o644)  # analysis copy must not be confused with a bootable tree
        elif e in links:
            result = subprocess.run(["7z", "x", "-so", "-spd", str(image), e["Path"]],
                                    capture_output=True, check=True)
            if len(result.stdout) != int(e["Size"]):
                raise ValueError(f"Link size mismatch {e['Path']}")
            record.update(target=result.stdout.decode("utf-8", "surrogateescape"), materialized=False)
        else:
            record.update(materialized=False)
        manifest.append(record)
    (out / "rootfs-manifest.json").write_text(json.dumps({
        "source_sha256": sha256(image.read_bytes()), "entries": manifest,
        "counts": {"regular": len(files), "symlinks_recorded": len(links), "special_omitted": len(special)},
        "limitations": ["Analysis tree omits symlinks/special files and normalizes executable modes.",
                        "Original ownership, modes and link targets are recorded; this is not a repack tree."]
    }, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="new output directory")
    parser.add_argument("--extract", action="store_true", help="extract regular rootfs files with installed 7z")
    args = parser.parse_args()
    if args.out.exists():
        parser.error("output directory must be new; existing evidence is never overwritten")
    if args.input.stat().st_size > MAX_IMAGE:
        parser.error("input too large")
    source = args.input.read_bytes()
    if args.input.suffix.lower() == ".zip":
        if sha256(source) != STOCK_ZIP_SHA256:
            parser.error("ZIP differs from supplied stock firmware")
        with zipfile.ZipFile(args.input) as archive:
            members = archive.infolist()
            if len(members) != 1 or members[0].file_size > MAX_IMAGE:
                parser.error("expected one bounded firmware image")
            data = archive.read(members[0])
    else:
        data = source
    result, kernel = inspect_image(data)
    if sha256(data) != STOCK_TRX_SHA256 or result["md5"] != STOCK_MD5:
        parser.error("image differs from the reviewed stock baseline")
    args.out.mkdir(parents=True)
    (args.out / "firmware.trx").write_bytes(data)
    (args.out / "header.bin").write_bytes(data[:256])
    (args.out / "kernel.lzma").write_bytes(data[256:result["rootfs"]["offset"]])
    (args.out / "kernel.bin").write_bytes(kernel)
    (args.out / "rootfs.squashfs").write_bytes(data[result["rootfs"]["offset"]:])
    result["input"] = {"name": args.input.name, "sha256": sha256(source)}
    (args.out / "firmware-map.json").write_text(json.dumps(result, indent=2) + "\n")
    if args.extract:
        extract_for_analysis(args.out / "rootfs.squashfs", args.out)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
