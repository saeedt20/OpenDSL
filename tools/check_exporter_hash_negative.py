#!/usr/bin/env python3
"""Permanent negative control: a mismatched packed-asset hash must make the
evidence exporter exit nonzero with a failed status. Runs the actual exporter
path with a temporarily corrupted gate record, then restores it."""
import json, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GATES = ROOT / "tools" / "gates-run-0.1.17.json"
BACKUP = ROOT / "tools" / ".gates-run-0.1.17.backup.json"
EXPORTER = ROOT / "tools" / "build_ui_evidence.py"

if not GATES.exists():
    print("missing gate record; run the real gate suite first")
    sys.exit(2)

shutil.copyfile(GATES, BACKUP)
try:
    d = json.load(open(GATES, encoding="utf-8"))
    d["input_identity"]["assets"]["legacy.js"] = "0" * 64
    json.dump(d, open(GATES, "w"), indent=2)
    r = subprocess.run([sys.executable, str(EXPORTER)], cwd=ROOT, capture_output=True, text=True)
    if r.returncode == 0:
        print("negative control FAILED: exporter exited 0 on mismatched hash")
        sys.exit(1)
    if '"status": "FAILED"' not in r.stdout:
        print("negative control FAILED: failed status not emitted")
        sys.exit(1)
    print("negative control PASS: exporter rejected mismatched hash (exit %d)" % r.returncode)
finally:
    shutil.move(BACKUP, GATES)
