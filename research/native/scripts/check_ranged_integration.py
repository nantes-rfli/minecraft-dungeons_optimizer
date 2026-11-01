#!/usr/bin/env python3
"""Public provenance checks; optional hash-bound replay in supervised worker.

Never executes the loader, game, CRT, or original native_probe. Private inputs
stay outside Git. Historical Astra files are immutable inputs, not regenerated.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import types

ROOT = Path(__file__).resolve().parents[3]
STUDY = 'research/native/ranged-20261031'
CAPTURE = 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin'
IMAGE_HASH = '04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
def digest(b): return hashlib.sha256(b).hexdigest()
def require(ok, message):
    if not ok: raise ValueError(message)
def load(path): return json.loads(path.read_text())
def walk(props):
    for p in props:
        yield p
        d=p.get('decoding',{})
        yield from walk(d.get('properties',[]))
        for e in d.get('elements',[]): yield from walk(e.get('properties',[]))
def validate_public(root=ROOT):
    study=root/STUDY
    manifest=load(study/'source-manifest.json')
    for name, sha in manifest['files'].items():
        require('/' not in name and digest((study/name).read_bytes())==sha, 'Astra source drift: '+name)
    raw=load(study/'raw-evidence.json')
    require(len(raw)==23 and sum(len(p['sources']) for p in raw)==46, 'Raw census drift')
    raw_manifest=load(root/'research/raw/game-data-raw-structural-inventory/manifest.json')
    cache={}
    for record in raw:
        path=record['shard']
        if path not in cache:
            packed=(root/path).read_bytes(); unpacked=gzip.decompress(packed)
            m=next(s for s in raw_manifest['shards'] if path.endswith('/'+s['path']))
            require(digest(packed)==m['compressedSha256'] and digest(unpacked)==m['uncompressedSha256'], 'Raw shard hash drift')
            cache[path]=json.loads(unpacked)
        pkg=cache[path]['packages'][record['index']]
        require(pkg['path']==record['path'] and pkg['sourceFiles']==record['sources'] and pkg['inheritanceChains']==record['inheritance'], 'Raw provenance/inheritance drift')
        leaves=[]
        for cdo in pkg['cdoPropertyInventory']:
            for p in walk(cdo['properties']):
                d=p.get('decoding',{})
                if 'value' in d:
                    leaves.append((cdo['objectName'],p['path'],p['type']['value'],d['value'],p['valueRange']))
        require(leaves==[(p['cdo'],p['path'],p['type'],p['value'],p['range']) for p in record['leaves']], 'Raw leaf drift')
        for p in record['leaves']:
            b=bytes.fromhex(p['hex'])
            require(len(b)==p['range']['end']-p['range']['start'], 'Raw byte range drift')
            if p['type'] in ('FloatProperty','IntProperty'):
                require(struct.unpack('<f' if p['type']=='FloatProperty' else '<i',b)[0]==p['value'], 'Raw numeric byte drift')
    proof=load(study/'verification.json')
    require(proof['mapped_image_sha256']==IMAGE_HASH and proof['total_replays']==4158 and proof['limits']['runtime_promotion'] is False, 'Replay claim drift')
    require(proof['limits']=={'live_state':'unknown','exact_CRT_output':'unverified','same_build_raw_exe':'unverified','real_shot_interval':'requires input/tick/state parameters; no fixed FPS assumed','runtime_promotion':False}, 'Unknown preservation drift')
    from build_ranged_domain import validate_model
    validate_model(root, load(root/'research/domain/ranged-native-model.json'))
    require(load(study/'integration-replay.json') == proof, 'Saved independent replay drift')
    watchdog=load(study/'integration-replay.watchdog.json')
    require(watchdog['status']=='exited' and watchdog['returncode']==0 and watchdog['cleanupComplete'] and not watchdog['forcedKill'], 'Saved watchdog failure')
    from check_ranged_blueprints import validate_saved
    validate_saved(root)
    return raw

def worker(local, output):
    study=ROOT/STUDY
    image=(local/CAPTURE).read_bytes()
    require(digest(image)==IMAGE_HASH, 'Private image hash mismatch')
    from check_ranged_blueprints import generate, validate_saved
    require(generate(ROOT,local)==validate_saved(ROOT), 'Private Blueprint review drift')
    # Optional dependencies are local-only. No dependency install or execution
    # takes place during public CI, and no original absolute path is imported.
    sys.path.insert(0,str(local/'phase6.8/native-stage2/tools'))
    import capstone
    module=types.ModuleType('native_probe')
    module.im=image; module.BASE=0x140000000
    module.cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64)
    sys.modules['native_probe']=module
    proof=load(study/'verification.json')
    for span in [*proof['spans'].values(), *load(study/'static-spans.json').values()]:
        a,b=int(span['start'],16),int(span['end_exclusive'],16)
        require(digest(image[a:b])==span['sha256'], 'Private replay span hash mismatch')
    # Recheck ALL source bytes and leaves independently before replay. The
    # original checker checks file hashes, but not every leaf valueRange.
    for record in validate_public():
        for src in record['sources']:
            b=(local/'QuickBMS 1.17.0.0'/src['path']).read_bytes()
            require(len(b)==src['size'] and digest(b)==src['sha256'], 'Private Raw source mismatch')
        for leaf in record['leaves']:
            r=leaf['range']; b=(local/'QuickBMS 1.17.0.0'/r['file']).read_bytes()[r['start']:r['end']]
            require(b.hex()==leaf['hex'], 'Private Raw valueRange mismatch')
    spec=importlib.util.spec_from_file_location('astra_ranged',study/'check_ranged.py')
    checker=importlib.util.module_from_spec(spec); spec.loader.exec_module(checker)
    for address, expected in {0xb19404: ('mov', 'dword ptr [rdi + 0x54c], 0x3f800000'), 0x823589: ('mov', 'dword ptr [rdi + 0xc28], 0x3f800000')}.items():
        ins=next(module.cs.disasm(image[address:address+16],address))
        require((ins.mnemonic,ins.op_str)==expected, 'Supplemental Native default drift')
    with tempfile.TemporaryDirectory(prefix='mcd-ranged-') as directory:
        tmp=Path(directory); (tmp/'out').mkdir()
        (tmp/'QuickBMS 1.17.0.0').symlink_to(local/'QuickBMS 1.17.0.0',target_is_directory=True)
        shutil.copyfile(study/'raw-evidence.json',tmp/'out/raw-evidence.json')
        checker.OUT=tmp/'out'; checker.main()
        result=load(tmp/'out/verification.json')
        require(result==proof, 'Independent replay differs from Astra proof')
    output.write_text(json.dumps(result,indent=2)+'\n')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--local-root',type=Path)
    parser.add_argument('--replay',action='store_true')
    parser.add_argument('--output',type=Path)
    parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
    args=parser.parse_args(); validate_public()
    if args.worker:
        worker(args.local_root,args.output); return
    if args.replay:
        require(args.local_root is not None and args.output is not None, 'Replay requires local root and new output')
        require(not args.output.exists(), 'Refusing to overwrite evidence')
        from native_watchdog import supervise
        result=supervise([sys.executable,'-B',__file__,'--worker','--local-root',str(args.local_root),'--output',str(args.output)],60)
        require(result['status']=='exited' and result['returncode']==0 and result['cleanupComplete'], 'Replay/watchdog failure: '+str(result))
        args.output.with_suffix('.watchdog.json').write_text(json.dumps(result,indent=2)+'\n')
        print('Watchdog:',json.dumps(result))
    print('Ranged Native public provenance PASS: 23 packages / 46 files / 255 leaves; no runtime promotion')
if __name__=='__main__': main()
