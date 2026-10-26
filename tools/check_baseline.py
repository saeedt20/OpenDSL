#!/usr/bin/env python3
"""Regression checks for image rejection and the candidate updater guard."""
import json
import os
from pathlib import Path
import shlex
import struct
import subprocess
import tempfile
import unittest
import zlib

from inspect_firmware import inspect_image

ROOT = Path(__file__).resolve().parents[1]


class BaselineChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.image = (ROOT / "analysis/verified/firmware.trx").read_bytes()

    def test_baseline_and_roundtrip(self):
        info, kernel = inspect_image(self.image)
        self.assertEqual(info["size"], 7957219)
        self.assertEqual(len(kernel), 3464472)
        parts = ["header.bin", "kernel.lzma", "rootfs.squashfs"]
        restored = b"".join((ROOT / "analysis/verified" / p).read_bytes() for p in parts)
        self.assertEqual(restored, self.image)

    def test_corrupted_or_truncated_payload_rejected(self):
        modified = bytearray(self.image)
        modified[2048] ^= 1
        with self.assertRaisesRegex(ValueError, "checksum"):
            inspect_image(modified)
        with self.assertRaises(ValueError):
            inspect_image(self.image[:-1])

    def test_forged_lengths_and_other_model_rejected(self):
        modified = bytearray(self.image)
        struct.pack_into(">I", modified, 0x50, 0xFFFFFFFF)
        with self.assertRaisesRegex(ValueError, "lengths"):
            inspect_image(modified)
        modified = bytearray(self.image)
        modified[0x7C] = ord("X")
        with self.assertRaisesRegex(ValueError, "model"):
            inspect_image(modified)

    def test_header_checksum_is_not_authentication(self):
        modified = bytearray(self.image)
        modified[-1] ^= 1
        struct.pack_into(">I", modified, 12, zlib.crc32(modified[256:]) ^ 0xFFFFFFFF)
        info, _ = inspect_image(modified)
        self.assertNotEqual(info["sha256"], inspect_image(self.image)[0]["sha256"])
        with tempfile.TemporaryDirectory() as temp:
            candidate = Path(temp) / "modified.trx"
            candidate.write_bytes(modified)
            out = Path(temp) / "output"
            result = subprocess.run(["python3", str(ROOT / "tools/inspect_firmware.py"),
                                     str(candidate), "--out", str(out)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("differs from the reviewed stock baseline", result.stderr)
            self.assertFalse(out.exists())

    def test_regular_file_manifest(self):
        folder = ROOT / "analysis/verified"
        manifest = json.loads((folder / "rootfs-manifest.json").read_text())
        for item in manifest["entries"]:
            if item.get("materialized"):
                path = folder / "rootfs" / item["path"]
                self.assertTrue(path.is_file())
                self.assertFalse(path.is_symlink())
                self.assertEqual(path.stat().st_size, item["size"])
        self.assertEqual(manifest["counts"]["regular"], 781)

    def test_updater_guards_report_error_without_other_commands(self):
        """Review A01 final contract: guards write NO WebCustom_Entry state at
        all (a webs_state_error=1 write would poison the next manual upload and
        webs_rsa_state_upgrade=1 would fake a signed-upgrade state); retirement
        is signalled by exit status 1 only, and nothing else is executed."""
        for filename in ["webs_update.sh", "webs_upgrade.sh", "webs_upgrade2.sh"]:
            path = ROOT / "overlays/security/usr/script" / filename
            subprocess.run(["sh", "-n", str(path)], check=True)
            for line in path.read_text().splitlines():
                if line and not line.startswith("#"):
                    words = shlex.split(line)
                    self.assertIn(words[0], {"set", "echo", "exit"})
            with tempfile.TemporaryDirectory() as temp:
                log = Path(temp) / "calls"
                log.write_text("")  # created only if the guard calls tcapi
                # Bash function intercepts the exact absolute command in the guard.
                harness = '/userfs/bin/tcapi() { printf "%s\\n" "$*" >> "$TEST_LOG"; }; . "$1"'
                env = dict(os.environ, TEST_LOG=str(log))
                result = subprocess.run(["bash", "-c", harness, "guard-test", str(path)], env=env)
                self.assertEqual(result.returncode, 1)
                self.assertEqual(log.read_text(), "")  # zero tcapi writes
                fail = '/userfs/bin/tcapi() { return 23; }; . "$1"'
                result = subprocess.run(["bash", "-c", fail, "guard-test", str(path)])
                self.assertEqual(result.returncode, 1)  # retirement, never a fall-through

    def test_online_handler_is_inert_and_controls_are_retired(self):
        folder = ROOT / "overlays/security/boaroot/cgi-bin"
        handler = (folder / "live_update.asp").read_text()
        self.assertNotIn("<%", handler)
        self.assertNotIn("<script", handler.lower())
        self.assertNotIn("<form", handler.lower())
        page = (folder / "Advanced_FirmwareUpgrade_Content.asp").read_text()
        self.assertIn('id="update" disabled="disabled"', page)
        self.assertIn('id="beta_firmware_path" disabled="disabled"', page)
        self.assertIn('Online updates retired. Use a reviewed local firmware image.', page)
        self.assertIn('name="tools_FW_UploadFile"', page)
        self.assertIn('onclick="uiDoUpdate();"', page)


if __name__ == "__main__":
    unittest.main(verbosity=2)
