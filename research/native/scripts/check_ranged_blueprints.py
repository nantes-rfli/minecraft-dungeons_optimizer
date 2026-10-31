#!/usr/bin/env python3
"""Read-only, fail-closed review of four small, hash-bound Ranged Blueprints.

No game execution and no bytecode/native payload emission. This is a deliberately
narrow serialized-expression reader, not a general UE VM implementation. Token
names are corroborated by Epic's EExprToken API; version-specific bytes remain
bound to the recorded 1.17.0.0 source hashes, not certified by that newer API.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import struct

TOKEN_SOURCE = 'https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/CoreUObject/EExprToken'
TARGETS = {
    'shortbow': 'Shortbow/BP_ShortBow_Arrow',
    'longbow': 'LongBow/BP_LongBowArrow',
    'power-bow': 'PowerBow/BP_PlayerPowerBowArrow',
    'heavy-crossbow': 'HeavyCrossbow/BP_HeavyCrossbow_Arrow',
}
EXPECTED_SCRIPT_HASHES = {
    'shortbow': ['4eb1ad84cd9ce670f927e69012de7cdae55ffe616002dc815410572f675647fe', '5c4feb776c1fdce071c6ad66d9e5a42ca8936355d723499ee686ba06db73ddf3', 'eed9fcdceea18e54abe6a7aac0109dd960fb8b409731076e2c4f5431c9496fb3', '2fdf88aec3165407bbb3b0ecde4fe2a0fa030521fa5907c317f283be80050918'],
    'longbow': ['4eb1ad84cd9ce670f927e69012de7cdae55ffe616002dc815410572f675647fe', '5c4feb776c1fdce071c6ad66d9e5a42ca8936355d723499ee686ba06db73ddf3', 'eed9fcdceea18e54abe6a7aac0109dd960fb8b409731076e2c4f5431c9496fb3', '2fdf88aec3165407bbb3b0ecde4fe2a0fa030521fa5907c317f283be80050918'],
    'power-bow': ['d703f5a6a3521be17ebac494d6851375f5707dac3542c919702f2cd9c06a705d', '294875fef2f7eb59082460e7e50c594f517d3ddf42671024809e197753693647'],
    'heavy-crossbow': ['29269d5bb3cc97e0edcc4a13436bb6c41a77cd852b3697167d1aa8475511baad', '79a3cfc7f13e3aaa7aa365a7eec010a030c801c6223f3ad8a13e2b3ce4cb9820', '103c7a63d552374ed67eeebcabe5a46e7f5acf70a33b17498b9ba65a2deffa42'],
}
def sha(data): return hashlib.sha256(data).hexdigest()
def require(ok, message):
    if not ok: raise ValueError(message)

class Reader:
    def __init__(self, data): self.data=data; self.at=0
    def take(self, size):
        require(0 <= size <= len(self.data)-self.at, 'truncated serialized expression')
        b=self.data[self.at:self.at+size]; self.at+=size; return b
    def u8(self): return self.take(1)[0]
    def i32(self): return struct.unpack('<i', self.take(4))[0]
    def u32(self): return struct.unpack('<I', self.take(4))[0]

def names_from_source(data, summary):
    r=Reader(data); r.at=summary['nameOffset']; names=[]
    for _ in range(summary['nameCount']):
        n=r.i32(); require(n != 0 and abs(n)<10000, 'invalid FName string')
        b=r.take(abs(n)*(2 if n<0 else 1))
        name=b.decode('utf-16le' if n<0 else 'utf8')
        require(name.endswith('\0'), 'unterminated FName')
        names.append(name[:-1]); r.take(4)
    return names

class Expressions(Reader):
    def __init__(self, data, package, names):
        super().__init__(data); self.package=package; self.names=names; self.pointers=0; self.fnames=0
    def ref(self):
        index=self.i32(); self.pointers+=1
        if index == 0: return {'index':0,'name':None,'class':None,'outer':None}
        if index < 0:
            v=self.package['imports'][-index-1]
            return {'index':index,'name':v['objectName']['value'],'class':v['className']['value'],'outer':v['outerIndex']}
        v=self.package['exports'][index-1]
        return {'index':index,'name':v['objectName']['value'],'class':v['references']['class'].get('objectName'),'outer':v['references']['outer']['rawPackageIndex']}
    def fname(self):
        index=self.u32(); number=self.u32(); self.fnames+=1
        require(index < len(self.names) and number == 0, 'unsupported FName occurrence')
        return {'index':index,'name':self.names[index]}
    def params(self):
        out=[]
        while True:
            require(self.at < len(self.data), 'unterminated parameters')
            if self.data[self.at] == 0x16: self.at+=1; return out
            out.append(self.expr())
    def expr(self):
        token=self.u8()
        if token in (0x00,0x01):
            return {'op':'local' if token==0 else 'instance','property':self.ref()}
        if token == 0x04: return {'op':'return','value':self.expr()}
        if token == 0x06: return {'op':'jump','expandedOffset':self.u32()}
        if token == 0x0b: return {'op':'nothing'}
        if token == 0x19:
            obj=self.expr(); skip=self.u32(); rv=self.ref(); call=self.expr()
            return {'op':'context','object':obj,'expandedSkip':skip,'rvalueProperty':rv,'call':call}
        if token == 0x1b: return {'op':'virtual-call','name':self.fname(),'args':self.params()}
        if token == 0x1d: return {'op':'int','value':self.i32()}
        if token in (0x27,0x28): return {'op':'bool','value':token==0x27}
        if token == 0x46: return {'op':'local-final-call','function':self.ref(),'args':self.params()}
        if token == 0x4e: return {'op':'computed-jump','value':self.expr()}
        if token == 0x53: return {'op':'end-script'}
        if token == 0x64: return {'op':'persistent-frame-copy','target':self.ref(),'value':self.expr()}
        raise ValueError('unsupported expression token '+hex(token))

def audit_expression(expr, package, ubergraph, context=None):
    op=expr['op']
    if op in ('local','instance'):
        require(expr['property']['index']>0, 'unexpected external property')
    elif op in ('return','computed-jump'):
        audit_expression(expr['value'],package,ubergraph)
    elif op == 'persistent-frame-copy':
        require(expr['target']['outer']==ubergraph['rawPackageIndex'], 'copy outside local Ubergraph frame')
        require(expr['value']['op']=='local', 'nonlocal frame input')
    elif op == 'local-final-call':
        f=expr['function']
        require(f['class']=='Function', 'non-Function call target')
        if f['index']<0:
            require(f['name'] in ('OnProjectileLaunch','OnProjectileReset','ToggleCharged'), 'additional parent function')
            require(f['outer'] == package['exports'][1]['references']['super']['rawPackageIndex'], 'call outside immediate parent')
        else:
            require(f['index']==ubergraph['rawPackageIndex'], 'additional local function')
        for arg in expr['args']: audit_expression(arg,package,ubergraph)
    elif op == 'context':
        require(expr['object']['op']=='instance', 'unsupported context object')
        prop=expr['object']['property']
        require(prop['name'] in ('sfx_item_crossbowHeavyArrows','ParticleSystem_0') and prop['class']=='ObjectProperty', 'noncosmetic context')
        component=next((e for e in package['exports'] if e['objectName']['value']==prop['name']+'_GEN_VARIABLE'),None)
        require(component is not None and component['references']['class'].get('objectName') in ('AudioComponent','ParticleSystemComponent'), 'context is not cosmetic component')
        require(expr['rvalueProperty']['index']==0 and expr['call']['op']=='virtual-call', 'unsupported context result/call')
        audit_expression(expr['call'],package,ubergraph,context=prop['name'])
    elif op == 'virtual-call':
        require(context is not None and expr['name']['name'] in ('Activate','Deactivate'), 'noncosmetic virtual call')
        require(all(a['op']=='bool' for a in expr['args']), 'nonbool cosmetic call arguments')
    else:
        require(op in ('jump','nothing','int','bool','end-script'), 'unsupported expression semantics')

def generate(repo, local):
    study=repo/'research/native/ranged-20261031'
    rows=json.loads((study/'raw-evidence.json').read_text())
    results=[]
    for target,suffix in TARGETS.items():
        source=next(x for x in rows if x['path'].endswith('/'+suffix))
        packed=(repo/source['shard']).read_bytes()
        p=json.loads(gzip.decompress(packed))['packages'][source['index']]
        require(p['path']==source['path'] and p['sourceFiles']==source['sources'], 'source provenance mismatch')
        source_data={}
        for f in source['sources']:
            b=(local/'QuickBMS 1.17.0.0'/f['path']).read_bytes()
            require(len(b)==f['size'] and sha(b)==f['sha256'], 'private source hash mismatch')
            source_data[f['path']]=b
        names=names_from_source(source_data[p['path']+'.uasset'],p['parse']['summary'])
        funcs=[e for e in p['exports'] if e['references']['class'].get('objectName')=='Function']
        ubergraph=next(e for e in funcs if e['objectName']['value'].startswith('ExecuteUbergraph_'))
        found=[]
        for e in funcs:
            rg=e['serialized']['sourceRange']; b=source_data[rg['file']][rg['start']:rg['end']]; header=Reader(b)
            require(names[header.u32()]=='None' and header.u32()==0, 'unsupported Function property tags')
            require(header.i32()==0, 'unexpected next field')
            require(header.i32()==e['references']['super']['rawPackageIndex'], 'Function super mismatch')
            children=header.i32(); require(0<=children<=3, 'unsupported Function child count')
            for _ in range(children):
                child=header.i32();require(child>0 and p['exports'][child-1]['references']['outer']['rawPackageIndex']==e['rawPackageIndex'], 'invalid Function local property')
            expanded=header.u32();size=header.u32();start=header.at
            script=header.take(size);reader=Expressions(script,p,names);exprs=[]
            while reader.at < len(script): exprs.append(reader.expr())
            require(exprs and exprs[-1]['op']=='end-script', 'missing exact script end')
            require(expanded==len(script)+(reader.pointers+reader.fnames)*4, 'expanded pointer-size mismatch '+target+'/'+e['objectName']['value']+' '+str((expanded,len(script),reader.pointers)))
            for expr in exprs: audit_expression(expr,p,ubergraph)
            found.append({'name':e['objectName']['value'],'exportIndex':e['exportIndex'],'sourceRange':rg,'payloadSha256':sha(b),'scriptRange':{'file':rg['file'],'start':rg['start']+start,'end':rg['start']+start+size},'scriptSha256':sha(script),'expandedSize':expanded,'serializedSize':size,'expressions':exprs})
        require([f['scriptSha256'] for f in found]==EXPECTED_SCRIPT_HASHES[target], 'reviewed script drift')
        results.append({'domainId':target,'package':p['path'],'shard':source['shard'],'packageIndex':source['index'],'sources':source['sources'],'functions':found,'conclusion':'source-derived bounded observation reuse: parent event forwarding; Heavy Crossbow additionally activates/deactivates audio/particle components; no additional combat expression in these serialized scripts'})
    return {'schemaVersion':1,'gameVersion':'1.17.0.0 local-input claim','scope':'four derived-class serialized Function bodies only; no game execution, full VM proof, or independent gameplay evidence','tokenReference':{'url':TOKEN_SOURCE,'version':'UE 5.8 API corroboration only; not proof of this game VM version'},'runtimePromotion':False,'results':results,'limits':['Inherited parent behavior retains the existing observed single-projectile runtime boundary.','Observation damage/cycle remain mandatory; these scripts do not establish final damage or effective cadence.','No unverified proc, target/channel, Soul, armor, speed composition, or unique variant is authorized.']}

def validate_saved(repo):
    study=repo/'research/native/ranged-20261031'
    saved=json.loads((study/'blueprint-review.json').read_text())
    raw=json.loads((study/'raw-evidence.json').read_text())
    require(saved['runtimePromotion'] is False, 'Blueprint review is not a runtime promotion')
    require([r['domainId'] for r in saved['results']]==list(TARGETS), 'Blueprint target drift')
    for result in saved['results']:
        row=next(r for r in raw if r['path']==result['package'])
        require(result['sources']==row['sources'] and result['shard']==row['shard'] and result['packageIndex']==row['index'], 'Blueprint provenance drift')
        p=json.loads(gzip.decompress((repo/row['shard']).read_bytes()))['packages'][row['index']]
        funcs=[e for e in p['exports'] if e['references']['class'].get('objectName')=='Function']
        ubergraph=next(e for e in funcs if e['objectName']['value'].startswith('ExecuteUbergraph_'))
        require(len(funcs)==len(result['functions']), 'Blueprint Function census drift')
        for e,f in zip(funcs,result['functions']):
            require(e['objectName']['value']==f['name'] and e['serialized']['sourceRange']==f['sourceRange'] and e['exportIndex']==f['exportIndex'], 'Blueprint export drift')
            require(f['sourceRange']['start']<=f['scriptRange']['start']<f['scriptRange']['end']<=f['sourceRange']['end'], 'Blueprint script range drift')
            require(f['scriptRange']['end']-f['scriptRange']['start']==f['serializedSize'], 'Blueprint script size drift')
            for expr in f['expressions']: audit_expression(expr,p,ubergraph)
        require([f['scriptSha256'] for f in result['functions']]==EXPECTED_SCRIPT_HASHES[result['domainId']], 'Blueprint script hash drift')
    return saved

def main():
    a=argparse.ArgumentParser();a.add_argument('--repo-root',type=Path,default=Path(__file__).resolve().parents[3]);a.add_argument('--local-root',type=Path);a.add_argument('--output',type=Path);a.add_argument('--compare',type=Path);args=a.parse_args()
    saved=validate_saved(args.repo_root)
    data=generate(args.repo_root,args.local_root) if args.local_root else saved
    if args.local_root: require(data==saved, 'private Blueprint proof drift')
    if args.compare: require(data==json.loads(args.compare.read_text()), 'review metadata drift')
    if args.output:
        require(not args.output.exists(), 'refusing output overwrite')
        args.output.write_text(json.dumps(data,indent=2)+'\n')
    print('Ranged Blueprint review PASS: four classes, thirteen Function bodies; parent forwarding and cosmetic context calls only')
if __name__=='__main__':main()
