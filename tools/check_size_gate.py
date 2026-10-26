#!/usr/bin/env python3
"""Boundary tests for the release size gate; uses temporary synthetic files."""
import json
from pathlib import Path
import tempfile
import unittest
from check_image_size import ROOT, inspect_size


class SizeGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = json.loads((ROOT / 'firmware-policy.json').read_text())

    def image(self, folder, size, magic=b'2RDH'):
        image = Path(folder) / 'test.trx'
        with image.open('wb') as stream:
            stream.write(magic)
            stream.truncate(size)
        return image

    def test_exact_original_limit_passes(self):
        self.assertEqual(self.policy['max_raw_image_bytes'], 7957219)
        with tempfile.TemporaryDirectory() as folder:
            result = inspect_size(self.image(folder, 7957219), self.policy)
            self.assertEqual(result['remaining_bytes'], 0)

    def test_one_extra_byte_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'exceeds'):
                inspect_size(self.image(folder, 7957220), self.policy)

    def test_zip_is_not_a_smaller_firmware_image(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'raw 2RDH'):
                inspect_size(self.image(folder, 1024, b'PK\x03\x04'), self.policy)

    def test_truncated_header_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'shorter'):
                inspect_size(self.image(folder, 255), self.policy)


if __name__ == '__main__':
    unittest.main(verbosity=2)
