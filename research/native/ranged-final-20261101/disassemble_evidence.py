#!/usr/bin/env python3
"""Reproduce selected evidence spans from the private hash-pinned image."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--local-root', required=True)
p.add_argument('--role', required=True, help='Substring of evidence.json nativeSpans role')
args = p.parse_args()
root = Path(args.local_root)
sys.path.insert(0, str(root / 'phase6.8/native-stage2/tools'))
import capstone
assert capstone.__version__ == '5.0.6'
evidence = json.loads(Path(__file__).with_name('evidence.json').read_text())
im = (root / 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes()
assert hashlib.sha256(im).hexdigest() == evidence['imageSha256']
spans = [s for s in evidence['nativeSpans'] if args.role in s['role']]
assert spans, 'No matching role'
cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for s in spans:
    a, b = int(s['start'], 16), int(s['end'], 16)
    assert hashlib.sha256(im[a:b]).hexdigest() == s['sha256']
    print(s['role'], s['start'], s['end'], s['sha256'])
    for instruction in cs.disasm(im[a:b], a):
        print(f'{instruction.address:08x} {instruction.mnemonic:10} {instruction.op_str}')
