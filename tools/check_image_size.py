#!/usr/bin/env python3
"""Enforce the original raw firmware size ceiling; never flashes or changes input."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def inspect_size(image, policy):
    size = image.stat().st_size
    limit = policy['max_raw_image_bytes']
    if size > limit:
        raise ValueError(f"Image is {size:,} bytes: exceeds the {limit:,}-byte limit by {size - limit:,} bytes")
    with image.open('rb') as stream:
        magic = stream.read(4)
    if magic != policy['image_magic_ascii'].encode('ascii'):
        raise ValueError('Expected a raw 2RDH firmware image, not a ZIP archive or another format')
    if size < 256:
        raise ValueError('Image is shorter than the baseline header')
    return {'image': str(image), 'bytes': size, 'limit_bytes': limit,
            'remaining_bytes': limit - size, 'scope': 'size-and-format-magic-only'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    args = parser.parse_args()
    policy = json.loads((ROOT / 'firmware-policy.json').read_text())
    try:
        result = inspect_size(args.image, policy)
    except (OSError, ValueError) as error:
        print(f'FAIL: {error}', file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    print('Size gate passed. Bootability, partition layout, integrity and authenticity remain separate checks.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
