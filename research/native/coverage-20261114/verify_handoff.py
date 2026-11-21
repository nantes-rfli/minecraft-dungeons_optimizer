#!/usr/bin/env python3
"""Verify the research bundle, baseline preservation, and optional private inputs.

This is integrity/static verification, not Evidence Adoption or gameplay testing.
Run the separate replay scripts for conditional instruction-execution evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = 0x140000000


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(root, relative):
    path = (root / relative).resolve()
    assert path.is_relative_to(root.resolve()), relative
    return path


def verify(local):
    manifest = json.loads((HERE / 'manifest.json').read_text())
    for record in manifest['files']:
        path = inside(HERE, record['path'])
        assert path.stat().st_size == record['size'], record['path']
        assert digest(path) == record['sha256'], record['path']
    for record in manifest['baselineInputs']:
        path = inside(ROOT, record['path'])
        assert digest(path) == record['sha256'], record['path']
    subprocess.run(['git', 'diff', '--exit-code', manifest['baselineCommit'], '--',
                    'src', 'research/runtime', 'research/domain', 'research/raw',
                    'PROJECT_STATUS.md', 'ROADMAP.md'], cwd=ROOT, check=True,
                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    catalog_text = subprocess.check_output(['node', str(HERE / 'catalog_snapshot.mjs')], cwd=ROOT)
    catalog = json.loads(catalog_text)
    assert catalog == json.loads((HERE / 'baseline-catalog.json').read_text())
    assert sum(row['supported'] for row in catalog['counts'].values()) == 62
    promotion = json.loads((ROOT / 'research/runtime/runtime-promotion-manifest.json').read_text())
    assert promotion['summary'] == {'candidates': 1, 'eligible': 0, 'promoted': 0}
    result = {'publicFiles': len(manifest['files']), 'baselineInputs': len(manifest['baselineInputs']),
              'runtimeSupported': 62, 'catalogTotal': 271,
              'promotion': promotion['summary'], 'privateChecks': 'not-requested'}
    if local:
        for record in manifest['privateInputs']:
            path = inside(local, record['path'])
            assert path.stat().st_size == record['size'], record['path']
            assert digest(path) == record['sha256'], record['path']
        image = inside(local, manifest['imageRelativePath']).read_bytes()
        sys.path.insert(0, str(local / 'phase6.8/native-stage2/tools'))
        import capstone
        assert capstone.__version__ == '5.0.6'
        cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
        span_count = pointer_count = call_count = 0
        for filename in manifest['nativeEvidenceFiles']:
            evidence = json.loads(inside(HERE, filename).read_text())
            expected_image = evidence.get('imageSha256', evidence.get('image', {}).get('sha256'))
            assert hashlib.sha256(image).hexdigest() == expected_image
            for span in evidence.get('nativeSpans', evidence.get('spans', [])) + evidence.get('decisiveInstructions', []):
                start, end = int(span['startRva'], 16), int(span['endRvaExclusive'], 16)
                assert 0 <= start < end <= len(image)
                assert hashlib.sha256(image[start:end]).hexdigest() == span['sha256'], (filename, span['role'])
                span_count += 1
            for relative, expected in evidence.get('inputSha256', {}).items():
                assert digest(inside(ROOT, relative)) == expected, (filename, relative)
            for pointer in evidence.get('pointerAssertions', evidence.get('pointers', [])):
                rva, target = int(pointer['rva'], 16), int(pointer['targetRva'], 16)
                assert struct.unpack_from('<Q', image, rva)[0] == BASE + target, (filename, pointer)
                pointer_count += 1
            for call in evidence.get('callAssertions', evidence.get('directCalls', [])):
                rva, target = int(call['rva'], 16), int(call['targetRva'], 16)
                instruction = next(cs.disasm(image[rva:rva+15], rva))
                assert instruction.mnemonic == 'call' and instruction.op_str == hex(target), (filename, call)
                call_count += 1
        result['privateChecks'] = {'inputFiles': len(manifest['privateInputs']),
                                   'spanRecords': span_count, 'pointerAssertions': pointer_count,
                                   'directCallAssertions': call_count}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-root', type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.local_root), indent=2))
