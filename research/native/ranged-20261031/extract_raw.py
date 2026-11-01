"""Read-only Raw evidence extraction; never supplies missing defaults."""
import gzip, hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'local-game-data/QuickBMS 1.17.0.0'

def walk(props):
    for p in props:
        yield p
        d = p.get('decoding', {})
        yield from walk(d.get('properties', []))
        for e in d.get('elements', []):
            yield from walk(e.get('properties', []))

def main():
    records = []
    for shard in sorted((ROOT/'research/raw/game-data-raw-structural-inventory/shards').glob('*.gz')):
        content = json.loads(gzip.decompress(shard.read_bytes()))
        packages = content['packages']
        for index, pkg in enumerate(packages):
            path = pkg['path']
            wanted = ('/rangedweapons/' in path.lower() and
                      any('/'+n+'/' in path.lower() for n in ['bow','shortbow','longbow','powerbow','heavycrossbow']))
            wanted |= path.endswith(('/BP_ArrowBaseRangedWeapon','/BP_Arrow','/BP_Projectile'))
            if not wanted or not pkg.get('cdoPropertyInventory'): continue
            hashes=[]
            for f in pkg['sourceFiles']:
                b=(SOURCE/f['path']).read_bytes()
                actual=hashlib.sha256(b).hexdigest()
                assert actual==f['sha256'] and len(b)==f['size'],f['path']
                hashes.append(f)
            leaves=[]
            for cdo in pkg['cdoPropertyInventory']:
                for p in walk(cdo['properties']):
                    d=p.get('decoding',{})
                    if 'value' not in d: continue
                    r=p['valueRange']; b=(SOURCE/r['file']).read_bytes()[r['start']:r['end']]
                    typ=p['type']['value']; v=d['value']
                    if typ=='FloatProperty': assert len(b)==4 and struct.unpack('<f',b)[0]==v
                    if typ=='IntProperty': assert len(b)==4 and struct.unpack('<i',b)[0]==v
                    leaves.append({'cdo':cdo['objectName'],'path':p['path'],'type':typ,'value':v,'range':r,'hex':b.hex()})
            records.append({'path':path,'shard':str(shard.relative_to(ROOT)),'index':index,
                            'sources':hashes,'inheritance':pkg.get('inheritanceChains'), 'leaves':leaves})
    (OUT/'raw-evidence.json').write_text(json.dumps(records,indent=2)+'\n')
    for r in records:
        if not r['path'].endswith(('Instance','Arrow','Projectile','BP_ArrowBaseRangedWeapon')): continue
        print(r['path'])
        for p in r['leaves']:
            if p['path'].startswith('AttackDefintion') or p['path'] in ['damage','PowerEffects','ItemIdName','SerializedId']:
                print(' ',p['path'],p['value'],p['hex'])
    print('verified packages',len(records),'files',sum(len(r['sources']) for r in records))

if __name__=='__main__':main()
