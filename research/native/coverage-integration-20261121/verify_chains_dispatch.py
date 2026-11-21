#!/usr/bin/env python3
"""Pinned static Chains bridge. Emits metadata, never private bytes or disassembly.

This proves relations in the named files, not live world state or R3 adoption.
The original Astra replay remains a separate conditional instruction experiment.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys

HERE = Path(__file__).resolve().parent
IMAGE_PATH = 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin'
IMAGE_HASH = '04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
BASE = 0x140000000
# Function/slice digests are public; the private instructions are not emitted.
SPANS = [
 ('chains-metadata-record',0x139cce,0x139e31), ('metadata-name-builder',0xa7b300,0xa7b443),
 ('blueprint-name-prefix',0xe46e40,0xe46edc), ('metadata-getter',0xa7c640,0xa7c64f),
 ('finder-constructor',0x70a650,0x70a732), ('finder-registration',0x715b50,0x715c18),
 ('finder-map-init',0x713960,0x713d84), ('asset-match',0x714970,0x714efa),
 ('asset-lookup',0x711b60,0x711c20), ('enum-asset-lookup',0x710ef0,0x710f5a),
 ('class-from-enum',0xa63de0,0xa64034), ('module-factory',0x772fb0,0x772fdf),
 ('module-registration',0x11c5ef,0x11c620), ('module-enchantment-finder',0x745fb0,0x745fc2),
 ('master-finder-lazy',0x76d080,0x76d15e), ('master-finder-constructor',0x70a910,0x70aa55),
 ('master-class-constructor-thunk',0xf32c20,0xf32c2d),
 ('catalog-record-transport',0xb64df2,0xb64fa3), ('type-fixed-record-copy',0xb1b6a2,0xb1b6e8),
 ('fixed-record-to-equipped-record',0xb45dc0,0xb45f44), ('equipped-record-dispatch',0xb59a80,0xb59af0),
 ('active-enchantment-construction',0x9b4100,0x9b446a), ('tier-store',0xa74c20,0xa74c2d),
 ('active-receiver-array',0x9a0120,0x9a0300),
 ('melee-arm-entry',0x9d08f0,0x9d0b80), ('melee-selection-call',0x9ce440,0x9ce480),
 ('selection-dispatch',0x9a4920,0x9a4b00), ('arm-dispatch',0x9a6c70,0x9a6e00),
 ('chains-cue-hook',0xa6a690,0xa6a800),
]
CALLS = [
 (0x139dc4,0xa7b4e0),(0x139de4,0xa7b300),(0xa7b332,0xe46e40),
 (0x70a6d0,0x712ee0),(0x70a6d5,0xef2e70),(0x70a6e9,0x715b50),
 (0x710f17,0xa7c640),(0x710f2c,0x712ee0),(0x710f3d,0x711b60),
 (0xa63e6f,0x710ef0),(0xa63f1b,0x1247820),(0x76d0ac,0xf318a0),
 (0x745fb4,0x76d080),(0x70a998,0xef0d90),(0x70a9b8,0x1207580),
 (0x713b03,0x714970),(0x714dc3,0x711c20),(0x713ce9,0x704010),
 (0x9b431b,0xa63de0),(0x9b4385,0x1249050),(0x9b43e1,0xa74c20),
 (0xb59a85,0xb45dc0),(0xb59aeb,0x985630),(0x9d149f,0x9cd100),
 (0x9ce46f,0xc13be0),(0x9d0b72,0xc14a10),
]
POINTERS = [(0x319dec8+0x50,0x745fb0),(0x319a698+0x238,0x713960),
 (0x322ed78+0x3c8,0x9a0120),(0x322ed78+0x3d8,0x9b4100),
 (0x32448b8+0x3d0,0x9d0510),(0x327c038+0x3d8,0xa66ad0),
 (0x327c038+0x3e0,0xa6ba90),(0x327c038+0x3d0,0xa6a690)]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def registry_record(b):
    assert b[:16].hex() == 'e79e7f713a49b0e93291b3880781381b'
    assert struct.unpack_from('<I',b,16)[0] == 6
    name_start = struct.unpack_from('<Q',b,20)[0]
    assert 28 < name_start < len(b)
    off = name_start
    def int32():
        nonlocal off
        assert off+4 <= len(b)
        v = struct.unpack_from('<i',b,off)[0]; off += 4
        return v
    def string():
        nonlocal off
        n = int32(); size = abs(n)*(2 if n < 0 else 1)
        assert size <= 10_000_000 and off+size <= len(b)
        v = b[off:off+size].decode('utf-16le' if n < 0 else 'utf-8'); off += size
        assert n == 0 or v.endswith('\0')
        return v[:-1] if n else ''
    name_count = int32(); assert name_count == 146784
    names = []
    for _ in range(name_count):
        names.append(string()); off += 4  # serialized name hashes
        assert off <= len(b)
    assert off == len(b)
    def name():
        i,number = int32(),int32()
        assert 0 <= i < len(names) and number >= 0
        return names[i] + ('_'+str(number-1) if number else '')
    off = 28
    asset_count = int32(); assert asset_count == 49397
    matches = []
    for _ in range(asset_count):
        start = off
        d = {key:name() for key in ['objectPath','packagePath','assetClass','packageName','assetName']}
        count = int32(); assert 0 <= count < 10000
        tags = {}
        for _ in range(count):
            key,value = name(),string(); assert key not in tags; tags[key] = value
        d['tags'] = tags
        count = int32(); assert 0 <= count < 10000
        chunks = [int32() for _ in range(count)]
        flags = int32()
        assert off <= name_start
        if d['assetName'] == 'BP_Chains':
            d.update(recordRange=[start,off],chunks=chunks,packageFlags=flags); matches.append(d)
    asset_end = off
    # This pinned cooked registry has no dependency/package-data records.
    assert int32() == 0 and int32() == 0 and off == name_start
    assert len(matches) == 1
    record = matches[0]
    stem = '/Game/Components/Enchantments/Chains/BP_Chains'
    assert record['objectPath'] == stem+'.BP_Chains'
    assert record['packageName'] == stem and record['assetClass'] == 'Blueprint'
    assert record['tags']['GeneratedClass'] == "BlueprintGeneratedClass'"+stem+".BP_Chains_C'"
    for key in ['ParentClass','NativeParentClass']:
        assert record['tags'][key] == "Class'/Script/Dungeons.Chains'"
    # Emit only the one identity/binding record, not the registry or private payload.
    return dict(version=6,nameCount=name_count,assetCount=asset_count,assetDataEnd=asset_end,
                nameTableOffset=name_start,record=record)


def build(local):
    image = (local/IMAGE_PATH).read_bytes(); assert sha(image) == IMAGE_HASH
    sys.path.insert(0,str(local/'phase6.8/native-stage2/tools'))
    import capstone
    cs = capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64)
    for rva,target in CALLS:
        i = next(cs.disasm(image[rva:rva+15],rva))
        assert i.mnemonic == 'call' and i.op_str == hex(target),(hex(rva),i.mnemonic,i.op_str)
    for rva,target in POINTERS:
        assert struct.unpack_from('<Q',image,rva)[0] == BASE+target,hex(rva)
    assert image[0x3390518:0x339051c] == b'BP_\0'
    assert image[0x32659d4:0x32659db] == b'Chains\0'
    assert image[0x30fe910:0x30fe919] == b'Dungeons\0'
    game = local/'QuickBMS 1.17.0.0/Dungeons'
    config = (game/'Config/DefaultGame.ini').read_bytes()
    assert sha(config) == '8d121238c3be135c1f19fae3941262f2ec86aa660535800a659beb7482ab795d'
    text = config.decode('utf-8-sig')
    sections = dict((name,body) for name,body in re.findall(r'\[([^]]+)\]([^[]*)',text))
    assert '+EnchantmentAssetPaths="Components/Enchantments/"' in sections['/Script/Dungeons.EnchantmentAssetFinder']
    reg = (game/'AssetRegistry.bin').read_bytes()
    assert sha(reg) == 'ce74ac3a7c7b348fc1a3b1dc20626a2e9a68764edb4ed97e80607333a69c3a67'
    files = []
    for rel in ['AssetRegistry.bin','Config/DefaultGame.ini',
                'Content/Components/Enchantments/Chains/BP_Chains.uasset',
                'Content/Components/Enchantments/Chains/BP_Chains.uexp',
                'Content/Components/Enchantments/Chains/BP_ChainsGameplayEffect.uasset',
                'Content/Components/Enchantments/Chains/BP_ChainsGameplayEffect.uexp']:
        b = (game/rel).read_bytes(); files.append(dict(path='QuickBMS 1.17.0.0/Dungeons/'+rel,size=len(b),sha256=sha(b)))
    return dict(schemaVersion=1,scope='finite-static-no-application-bridge',gameVersion='1.17.0.0',
                versionBasis='Local archive label; official authenticity and Raw/exe exact build correspondence remain unverified.',
                imageSha256=IMAGE_HASH,privateFiles=files,registry=registry_record(reg),
                nativeSpans=[dict(role=role,startRva=hex(start),endRvaExclusive=hex(end),sha256=sha(image[start:end])) for role,start,end in SPANS],
                directCalls=[dict(rva=hex(a),targetRva=hex(t)) for a,t in CALLS],
                pointers=[dict(rva=hex(a),targetRva=hex(t)) for a,t in POINTERS],
                fixedRecords=[dict(id='flail',rawIdentity='Mace_Unique2',enum=24,tier=1),dict(id='jailors-scythe',rawIdentity='SoulScythe_Unique1',enum=24,tier=1)],
                requiredCondition='single target, initial Chains absent, and no other eligible query candidates for the entire evaluation interval',
                conclusion='Under the explicit condition, the owned Chains selection path skips primary append and application call. Visual gameplay cues are not asserted absent.',
                gameplayObserved=False,r3Accepted=False,newNumericMechanicAdopted=False)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--local-root',required=True,type=Path)
    p.add_argument('--write',action='store_true')
    a = p.parse_args()
    result = build(a.local_root)
    target = HERE/'chains-dispatch-proof.json'
    if a.write:
        target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    else:
        assert json.loads(target.read_text()) == result
    print(json.dumps(dict(status='passed',nativeSpans=len(SPANS),directCalls=len(CALLS),pointers=len(POINTERS),registryAssets=result['registry']['assetCount'],matches=1)))
