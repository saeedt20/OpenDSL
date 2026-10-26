#!/usr/bin/env python3
"""Record full rootfs metadata under fakeroot, without opening device nodes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat


def collect(root):
    records = []
    paths = [root]
    for folder, dirs, files in os.walk(root, followlinks=False):
        paths.extend(Path(folder) / name for name in dirs + files)
    for path in sorted(paths):
        s = path.lstat()
        item = {"path": str(path.relative_to(root)), "mode": stat.filemode(s.st_mode),
                "uid": s.st_uid, "gid": s.st_gid, "mtime": int(s.st_mtime)}
        if stat.S_ISREG(s.st_mode):
            item.update(size=s.st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        elif stat.S_ISLNK(s.st_mode):
            item["target"] = os.readlink(path)
        elif stat.S_ISCHR(s.st_mode) or stat.S_ISBLK(s.st_mode):
            item.update(major=os.major(s.st_rdev), minor=os.minor(s.st_rdev))
        elif not (stat.S_ISDIR(s.st_mode) or stat.S_ISFIFO(s.st_mode)):
            raise ValueError(f"Unsupported filesystem entry: {item}")
        records.append(item)
    return records


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("rootfs", type=Path)
    p.add_argument("out", type=Path)
    a = p.parse_args()
    data = collect(a.rootfs)
    a.out.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Recorded {len(data)} entries including root, links and device numbers")


if __name__ == "__main__":
    main()
