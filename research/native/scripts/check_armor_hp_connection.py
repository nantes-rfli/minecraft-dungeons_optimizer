#!/usr/bin/env python3
"""Check the bounded Armor HP connection study; never computes/promotes HP.

Default: public Raw/Identity/hash/claim checks. --local-root additionally checks
private recovered bytes and static instructions (Capstone, no Unicorn/game/CRT).
No historical proof is regenerated.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
import sys

ROOT = Path(__file__).resolve().parents[3]
ARTIFACT = 'research/native/armor-hp-connection.json'
RAW = 'research/raw/game-data-raw-structural-inventory'
CAPTURE = 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a'
BASE = 0x140000000
BASELINE = '0990f9731dba5ab668cbaf97a1b5da0fcb366bda'
PACKAGE = 'Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor/BP_MercenaryArmorInstance'

# Bounded spans, not whole-image search. Names describe inspected roles, not
# proof that these functions continuously execute for an equipped Blueprint.
SPANS = {
    'armor-class-registration': (0xEA3CD0, 0xA2),
    'armor-constructor-thunk': (0xEA3E50, 0xD),
    'armor-constructor': (0xAD8000, 0x9B),
    'armor-apply-override': (0xAEA3A0, 0x55),
    'item-power-effect-loop': (0xAEA5A0, 0x275),
    'max-health-increase-registration': (0xF1C730, 0xA2),
    'armor-damage-increase-registration': (0xF1C7E0, 0xA2),
    'health-effect-constructor': (0x7A1430, 0x275),
    'modifier-constructor': (0x400CD0, 0xCB),
    'magnitude-constructor': (0x400BF0, 0xD5),
    'custom-calculation-constructor': (0x39FA90, 0xAF),
    'modifier-copy': (0x796C70, 0x143),
    'custom-calculation-copy': (0x7968C0, 0x111),
    'health-attribute-registration': (0xF05130, 0xA2),
    'health-attribute-constructor': (0xF06A50, 0x93),
    'ability-constructor-prefix': (0x356CD0, 0x53),
    'apply-spec-prefix': (0x362CE0, 0xAC),
    'custom-magnitude-branch': (0x3A9F06, 0x15F),
    'scalable-float-evaluation': (0x3B55F0, 0x13A),
}

# Check semantic operands as well as whole-span identity. All targets are RVAs;
# RIP-relative LEAs below are checked by decoded target, not text displacement.
INSTRUCTIONS = {
    0xEA3E56: ('jne', '0xad8000'),
    0xAD801B: ('call', '0xad90a0'),
    0xAD8048: ('call', '0xf1c730'),
    0xAD804D: ('mov', 'qword ptr [rsp + 0x28], rax'),
    0xAD8052: ('call', '0xf1c7e0'),
    0xAD8057: ('mov', 'qword ptr [rsp + 0x30], rax'),
    0xAD805C: ('mov', 'dword ptr [rdi + 0x478], 2'),
    0xAD8079: ('call', '0x38cb80'),
    0xAD807E: ('mov', 'rax, qword ptr [rdi + 0x470]'),
    0xAD8085: ('movups', 'xmm0, xmmword ptr [rsp + 0x28]'),
    0xAD808A: ('movups', 'xmmword ptr [rax], xmm0'),
    0xAEA3AD: ('call', '0xaea5a0'),
    0xAEA5EE: ('cmp', 'byte ptr [rcx + 0x118], 3'),
    0xAEA627: ('mov', 'rsi, qword ptr [r15 + 0x470]'),
    0xAEA62E: ('movsxd', 'rcx, dword ptr [r15 + 0x478]'),
    0xAEA642: ('mov', 'rbx, qword ptr [rsi]'),
    0xAEA66E: ('cmp', 'qword ptr [rdi + 0x28], 0'),
    0xAEA743: ('mov', 'rbx, qword ptr [rdi + 0x28]'),
    0xAEA77F: ('movss', 'xmm3, dword ptr [r15 + 0x480]'),
    0xAEA790: ('call', '0x363a40'),
    0xAEA808: ('add', 'rsi, 8'),
    0x7A14E8: ('call', '0xf1bc90'),
    0x7A14ED: ('mov', 'qword ptr [rsp + 0x20], rax'),
    0x7A14FF: ('mov', 'byte ptr [rbp + 0x160], 1'),
    0x7A1506: ('mov', 'byte ptr [rbp - 0x58], 2'),
    0x7A1604: ('call', '0x7c45b0'),
    0x7A166C: ('call', '0x796c70'),
    0x400C2B: ('mov', 'dword ptr [rbx + 0x110], 0x3f800000'),
    0x400C54: ('mov', 'dword ptr [rbx + 0x130], edi'),
    0x400C79: ('mov', 'dword ptr [rbx + 0x150], edi'),
    0x400C9E: ('mov', 'qword ptr [rbx + 0x170], rdi'),
    0xF06A87: ('mov', 'qword ptr [rbx + 0x38], 0x43fa0000'),
    0x363AFF: ('call', 'qword ptr [r10 + 0x590]'),
    0x3A9F6D: ('call', '0x4083f0'),
    0x3A9FE3: ('addss', 'xmm6, xmm7'),
    0x3A9FFA: ('mulss', 'xmm7, xmm6'),
    0x3AA018: ('addss', 'xmm6, xmm7'),
    0x3AA04B: ('call', '0x1eed6a0'),
    0x3B56AA: ('movss', 'xmm0, dword ptr [rbx]'),
}
LEAS = {0xEA3D0F: 0x33C4E42, 0xEA3D33: 0xEA3E50,
        0xAD8030: 0x32C2A00, 0xF1C76F: 0x343F472,
        0xF1C81F: 0x343F512, 0xF0516F: 0x342CB12,
        0xF05193: 0xF06A50, 0x356CE4: 0x30CBBF8}
NAMES = {0x33C4E42: 'ArmorGearItemInstance', 0x343F472: 'MaxHealthIncrease',
         0x343F512: 'ArmorDamageIncrease', 0x342CB12: 'HealthAttributeSet'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(root, path):
    return json.loads((root / path).read_text())


def raw_snapshot(root):
    manifest = read_json(root, f'{RAW}/manifest.json')
    record = next(s for s in manifest['shards'] if s['path'] == 'shards/part-010.json.gz')
    compressed = (root / RAW / record['path']).read_bytes()
    require(digest(compressed) == record['compressedSha256'], 'Raw compressed hash drift')
    content = gzip.decompress(compressed)
    require(digest(content) == record['uncompressedSha256'], 'Raw uncompressed hash drift')
    shard = json.loads(content)
    matches = [(i, p) for i, p in enumerate(shard['packages']) if p['path'] == PACKAGE]
    require(len(matches) == 1, 'Raw package missing/ambiguous')
    index, package = matches[0]
    cdos = package['cdoPropertyInventory']
    require(len(cdos) == 1, 'Raw CDO missing/ambiguous')
    props = cdos[0]['properties']
    items = [p for p in props if p['path'] == 'ItemIdName']
    require(len(items) == 1 and items[0]['decoding'] == {'state': 'decoded', 'value': 'MercenaryArmor'}, 'Raw identity drift')
    ids = [p for p in props if p['path'] == 'ItemId']
    require(len(ids) == 1 and ids[0]['decoding']['state'] == 'decoded', 'Serialized identity missing/ambiguous')
    serialized = [p for p in ids[0]['decoding'].get('properties', []) if p['path'] == 'ItemId.SerializedId']
    require(len(serialized) == 1 and serialized[0]['decoding'] == {'state': 'decoded', 'value': 'MercenaryArmor'}, 'Serialized identity drift')
    chains = [c for c in package['inheritanceChains'] if c['sourceObject'] == 'BP_MercenaryArmorInstance_C']
    require(len(chains) == 1 and len(chains[0]['hops']) == 1, 'Native superclass missing/ambiguous')
    chain = chains[0]
    require(chain['stopReason'] == 'native-boundary' and chain['hops'][0]['targetObject'] == '/Script/Dungeons.ArmorGearItemInstance', 'Native superclass drift')
    require(not any(p['path'] in {'PowerEffects', 'ItemPower'} for p in props), 'Serialized override changed; reassess native defaults')
    identity = read_json(root, 'research/domain/formal/identity-evidence-v1.json')
    matches = [(i, x) for i, x in enumerate(identity['semantic']['identities']) if x['assertionId'] == 'identity:mercenary-armor@1']
    require(len(matches) == 1, 'Formal identity missing/ambiguous')
    ii, entry = matches[0]
    require(entry['resolution']['state'] == 'matched' and entry['resolution']['domainId'] == 'mercenary-armor', 'Formal identity unmatched')
    for key in ('itemIdName', 'serializedId'):
        require(entry['rawEvidence'][key]['state'] == 'known' and entry['rawEvidence'][key]['value'] == 'MercenaryArmor', 'Formal identity value drift')
    return {'artifactPath': f"{RAW}/{record['path']}",
            'compressedSha256': record['compressedSha256'],
            'uncompressedSha256': record['uncompressedSha256'],
            'datasetId': manifest['scope']['dataset']['id'],
            'packagePath': PACKAGE, 'packageHash': package['packageHash']['value'],
            'packagePointer': f'/packages/{index}',
            'cdoPointer': f'/packages/{index}/cdoPropertyInventory/0',
            'serializedPropertyNames': [p['path'] for p in props],
            'serializedPowerEffects': 'not-present-not-an-empty-array',
            'nativeSuperclass': chain['hops'][0]['targetObject'],
            'identityRef': f'research/domain/formal/identity-evidence-v1.json#/semantic/identities/{ii}',
            'sourceFiles': package['sourceFiles']}


LIMITS = {
    'continuousEquipmentDispatch': 'unknown',
    'effectivePlayerBaseMaxHealth': 'unknown',
    'finalAttributeAggregation': 'unknown',
    'windowsCrtOutputs': 'unverified',
    'liveGameMxcsr': 'unknown',
    'officialVersionAuthenticity': 'unverified',
    'rawNativeSameBuild': 'unverified',
    'displayPowerToExactInternalPower': 'not-unique',
    'independentLiveGameMeasurement': 'not-observed',
}
FACTS = {
    'nativeDefaultPowerEffects': ['MaxHealthIncrease', 'ArmorDamageIncrease'],
    'nativeArmorVtable': '0x32c2a00', 'applySlot': '0x678',
    'applyOverride': '0xaea3a0', 'sharedEffectLoop': '0xaea5a0',
    'healthEffectConstructor': '0x7a1430', 'magnitudeKindByte': 2,
    'modifierOperationByte': 1, 'modifierOperationGameplayMeaning': 'not-adopted',
    'commonCustomMagnitudeDefaults': {'coefficient': 1, 'preAdd': 0, 'postAdd': 0, 'finalCurvePointer': None},
    'healthAttributeConstructorMaxHealthBits': '0x43fa0000',
    'healthAttributeConstructorMaxHealthValue': 500,
    'constructorDefaultIsEffectivePlayerBase': False,
}


def validate_public(root, report):
    handoff = read_json(root, 'research/native/power-117-evidence-manifest.json')
    require(report['schemaVersion'] == 1 and report['artifactKind'] == 'native-raw-armor-hp-connection', 'Invalid artifact type')
    require(report['baselineCommit'] == BASELINE, 'Wrong baseline')
    require(report['status'] == 'held-research-only' and report['selectedTarget'] == 'armor-maximum-health', 'Invalid scope/status')
    require(report['runtimePromotion'] is False and report['applicationImpact'] is False and report['newCalculableEquipment'] == [], 'Research must not claim support')
    require(report['binarySha256'] == handoff['binary']['sha256'] and report['recoveredImageSha256'] == handoff['recoveredImageSha256'], 'Native identity drift')
    require(report['raw'] == raw_snapshot(root), 'Raw/Identity snapshot drift')
    require(report['facts'] == FACTS and report['limits'] == LIMITS, 'Claim/default/unknown boundary drift')
    require(report['adoption'] == {'route': 'new-mechanic-promotion', 'decision': 'not-submitted', 'eligibility': 'not-established', 'productRegression': 'not-run'}, 'Do not bypass promotion gates')
    require(len(report['nativeSpans']) == len(SPANS), 'Missing native spans')
    for span, (label, (rva, size)) in zip(report['nativeSpans'], SPANS.items()):
        require((span['label'], span['rva'], span['size']) == (label, hex(rva), size), 'Native span drift')
        require(re.fullmatch('[0-9a-f]{64}', span['sha256']) is not None, 'Invalid span hash')
    return report


def verify_private(root, local_root, report):
    capture = local_root / CAPTURE
    image = (capture / 'mapped-image.bin').read_bytes()
    require(digest(image) == report['recoveredImageSha256'], 'Recovered image hash mismatch')
    exe = local_root / 'archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe'
    require(digest(exe.read_bytes()) == report['binarySha256'], 'Executable hash mismatch')
    for name, start in [('copy-source-00-00.bin', 0x1000), ('copy-source-01-01.bin', 0x3094000)]:
        data = (capture / name).read_bytes()
        require(data == image[start:start + len(data)], 'Recovered/copy source mismatch')
    handoff = read_json(root, 'research/native/power-117-evidence-manifest.json')
    for group in ('bindings', 'inputAndDisplay'):
        for proof in handoff['proofFiles'][group]:
            require(digest((local_root / proof['path']).read_bytes()) == proof['sha256'], 'Referenced #217 proof hash mismatch')
    sys.path.insert(0, str(local_root / 'phase6.8/native-stage2/tools'))
    import capstone
    from capstone.x86_const import X86_REG_RIP
    require(capstone.__version__ == '5.0.6', 'Use pinned Capstone 5.0.6')
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    md.detail = True
    for span in report['nativeSpans']:
        start = int(span['rva'], 16)
        require(digest(image[start:start + span['size']]) == span['sha256'], f"Native span hash mismatch: {span['label']}")
    for rva, expected in INSTRUCTIONS.items():
        ins = next(md.disasm(image[rva:rva + 15], rva))
        require((ins.mnemonic, ins.op_str) == expected, f'Native instruction mismatch at {hex(rva)}')
    for rva, target in LEAS.items():
        ins = next(md.disasm(image[rva:rva + 15], rva))
        require(ins.mnemonic == 'lea' and ins.operands[1].mem.base == X86_REG_RIP and ins.address + ins.size + ins.disp == target, f'Native registration mismatch at {hex(rva)}')
    for rva, name in NAMES.items():
        encoded = (name + '\0').encode('utf-16le')
        require(image[rva:rva + len(encoded)] == encoded, 'Native class name mismatch')
    for rva, target in {0x32C2A00 + 0x678: 0xAEA3A0, 0x30CBBF8 + 0x590: 0x362CE0}.items():
        require(struct.unpack_from('<Q', image, rva)[0] == BASE + target, 'Native vtable mismatch')
    # Reflected custom-calculation fields independently name the storage used
    # by the constructor and generic evaluator. Do not infer names from offsets.
    for slot, record, name_rva, name, offset in (
        (0x30F26D0, 0x41A0B78, 0x30F26F8, 'FinalLookupCurve', 0x68),
        (0x30F26D8, 0x41A0BA8, 0x30F2710, 'PostMultiplyAdditiveValue', 0x48),
        (0x30F26E0, 0x41A0BD8, 0x30F2730, 'PreMultiplyAdditiveValue', 0x28),
        (0x30F26E8, 0x41A0C08, 0x30F2790, 'Coefficient', 8),
    ):
        encoded = (name + '\0').encode('ascii')
        require(struct.unpack_from('<Q', image, slot)[0] == BASE + record, 'Custom field array mismatch')
        require(struct.unpack_from('<Q', image, record)[0] == BASE + name_rva and image[name_rva:name_rva + len(encoded)] == encoded, 'Custom field name mismatch')
        require(struct.unpack_from('<I', image, record + 0x24)[0] == offset, 'Custom field offset mismatch')
    # HealthAttributeSet registration params -> property array -> MaxHealth record.
    require(struct.unpack_from('<Q', image, 0x342C880)[0] == BASE + 0xF05130, 'Health class getter mismatch')
    require(struct.unpack_from('<Q', image, 0x342C8A8)[0] == BASE + 0x342C7D0, 'Health property array binding mismatch')
    require(struct.unpack_from('<I', image, 0x342C8C0)[0] == 20 and 0x342C7D0 <= 0x342C858 < 0x342C7D0 + 20 * 8, 'Health property count mismatch')
    require(struct.unpack_from('<Q', image, 0x342C858)[0] == BASE + 0x42234C8, 'Health property array mismatch')
    require(struct.unpack_from('<Q', image, 0x42234C8)[0] == BASE + 0x30E5F98 and image[0x30E5F98:0x30E5FA2] == b'MaxHealth\0', 'MaxHealth metadata name mismatch')
    require(struct.unpack_from('<I', image, 0x42234C8 + 0x24)[0] == 0x38, 'MaxHealth metadata offset mismatch')
    # Current private Raw files must still equal the source identities pinned by
    # the existing extractor. Shared version labels do not prove same build.
    for source in report['raw']['sourceFiles']:
        data = (local_root / 'QuickBMS 1.17.0.0' / source['path']).read_bytes()
        require(len(data) == source['size'] and digest(data) == source['sha256'], 'Private Raw source mismatch')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-root', type=Path)
    args = parser.parse_args()
    report = read_json(ROOT, ARTIFACT)
    validate_public(ROOT, report)
    if args.local_root:
        verify_private(ROOT, args.local_root, report)
    print(json.dumps({'status': 'passed', 'publicRawIdentityChecks': 'passed',
                      'privateNativeAndRawChecks': 'passed' if args.local_root else 'not-run',
                      'nativeExecution': 'not-run-static-only', 'runtimePromotion': False}))


if __name__ == '__main__':
    main()
