#!/usr/bin/env python3
"""Public metadata audit; optional hash-matched private static checks, no emulation."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[3]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(root=ROOT, local_root=None):
    load = lambda p: json.loads((root / p).read_text())
    audit = load('research/domain/ranged-effective-attributes.json')
    evidence = load(audit['nativeEvidence'])
    contract = load(audit['captureContract'])
    require(audit['runtimePromotion'] is False and audit['resolvedEffectiveAttributeCount'] == 0, 'effective defaults/promotion drift')
    require(audit['runtimeAdditions'] == {'equipment': 0, 'effects': 0}, 'runtime additions drift')
    names = [c['attribute'] for c in contract['captures'] if c['attribute'] != 'RangedAttackItemPowerFactor']
    require(len(audit['attributes']) == 7 and set(names) == {a['attribute'] for a in audit['attributes']}, 'attribute coverage drift')
    require([a['applicationOrder'] for a in audit['attributes']] == list(range(7)), 'application order drift')
    require([a['attribute'] for a in audit['attributes']] == ['RangedAttackDamageIncrease', 'TakeDamageMultiplier', 'DamageMultiplier', 'DealDamageMul', 'DifficultyDealDamageMultiplier', 'RangedAttackDamageMultipler', 'TakeRangeDamageMultiplier'], 'attribute operation order drift')
    for a in audit['attributes']:
        require(a['capture'] == next(c for c in contract['captures'] if c['attribute'] == a['attribute']), 'capture drift')
        require(a['effective']['state'] == 'unknown' and a['writerCoverage']['allWritersEnumerated'] is False, 'unresolved writer drift')
        require(a['initial']['value'] == (0 if a['attribute'] == 'RangedAttackDamageIncrease' else 1), 'constructor default drift')
    require(evidence['actualSaveAvailable'] is False and evidence['actualGameAttributeValuesObserved'] is False, 'real evidence claim drift')
    require(evidence['imageSha256'] == load(contract['nativeEvidence'])['imageSha256'], 'image provenance drift')
    manifest = load('research/native/ranged-input-20261105/manifest.json')
    for path, expected in manifest['files'].items():
        require(not Path(path).is_absolute() and '..' not in Path(path).parts, 'unsafe manifest path')
        require(hashlib.sha256((root / path).read_bytes()).hexdigest() == expected, 'input artifact drift: ' + path)
    if local_root:
        image = (local_root / 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes()
        require(hashlib.sha256(image).hexdigest() == evidence['imageSha256'], 'private image mismatch')
        sys.path.insert(0, str(local_root / 'phase6.8/native-stage2/tools'))
        import capstone
        decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
        decoder.detail = True
        for span in evidence['spans']:
            start, end = int(span['start'], 16), int(span['end'], 16)
            require(hashlib.sha256(image[start:end]).hexdigest() == span['sha256'], 'static span mismatch')
        for a in audit['attributes']:
            desc = int(a['propertyDescriptorRva'], 16)
            name_ptr = struct.unpack_from('<Q', image, desc)[0] - 0x140000000
            require(image[name_ptr:name_ptr + len(a['attribute']) + 1] == a['attribute'].encode() + b'\0', 'descriptor name mismatch')
            require(struct.unpack_from('<I', image, desc + 0x24)[0] == int(a['attributeSetOffset'], 16), 'descriptor offset mismatch')
            store = int(a['initial']['storeRva'], 16)
            instruction = next(decoder.disasm(image[store:store + 16], store))
            require(instruction.mnemonic + ' ' + instruction.op_str == a['initial']['instruction'], 'constructor store mismatch')
            width = instruction.operands[0].size
            literal = instruction.operands[1].imm & ((1 << (width * 8)) - 1)
            payload = literal.to_bytes(width, 'little')
            offset = int(a['attributeSetOffset'], 16) - instruction.operands[0].mem.disp
            require(0 <= offset <= width - 4, 'constructor field mismatch')
            require(struct.unpack('<f', payload[offset:offset + 4])[0] == a['initial']['value'], 'constructor value mismatch')
            # Independently join attribute getter -> owning class -> constructor.
            for caller_key, target_key, mnemonic in [('attributeGetterRva', 'classGetterRva', 'call'), ('classGetterRva', 'constructorRva', 'lea')]:
                start = int(a[caller_key], 16)
                span = next(s for s in evidence['spans'] if int(s['start'], 16) == start)
                instructions = decoder.disasm(image[start:int(span['end'], 16)], start)
                target = int(a[target_key], 16)
                matches = [i for i in instructions if i.mnemonic == mnemonic and
                           ((mnemonic == 'call' and i.op_str == hex(target)) or
                            (mnemonic == 'lea' and i.op_str.startswith('rax, [rip') and i.address + i.size + i.operands[1].mem.disp == target))]
                require(matches, 'attribute class/constructor join mismatch')
    return {'status': 'passed', 'attributes': 7, 'configuredDefaults': 7, 'resolvedEffectiveAttributes': 0,
            'privateStaticSpansChecked': len(evidence['spans']) if local_root else 0,
            'actualSaveTested': False, 'runtimeAdditions': 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--local-root', type=Path)
    args = parser.parse_args()
    print(json.dumps(validate(local_root=args.local_root), indent=2))
