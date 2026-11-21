#!/usr/bin/env python3
"""Hash-pinned static Chains evidence. No engine calls, game execution or promotion."""
import argparse,gzip,hashlib,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DEFAULT_LOCAL=Path('/Users/nanto/Development/minecraft-dungeons_optimizer/local-game-data')
IMAGE='04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
BASE=0x140000000
# Whole function hashes, but only compact decisive instruction snippets are published.
SPANS=[('class-registration',0x1be300,0x1be33a),('class-getter',0xebec50,0xebec7f),('class-builder',0xebbe80,0xebbf22),('constructor-thunk',0xebd300,0xebd30d),('constructor',0xa484f0,0xa4864f),('target-selection',0xa66ad0,0xa66ceb),('neighbor-query',0x820ef0,0x8212c5),('eligibility',0xa5c270,0xa5c3a2),('neighbor-filter',0xa42470,0xa4252d),('prefix-slice',0xa44530,0xa4462f),('arm-rng',0xa6ba90,0xa6bafd),('tier-magnitude',0xa7aa70,0xa7aa84),('apply-chain',0xa74f00,0xa756b0),('flail-catalog',0x165c10,0x165e63),('jailor-catalog',0x173b40,0x173d9d),('enchantment-record',0xad9f70,0xad9f8d),('record-wrapper',0xad9fb0,0xad9fbe),('catalog-record-array-copy',0xb67390,0xb67424)]
SNIPPETS=[('native-constructor-fields',0xa4851f,0xa4859f),('primary-excluded',0x821000,0x82100a),('distance-gate',0x821026,0x821036),('select-and-test-count',0xa66bcd,0xa66c08),('append-primary',0xa66c18,0xa66c29),('call-application',0xa66c82,0xa66ca5),('tier-magnitude',0xa7aa70,0xa7aa84),('flail-fixed-id-tier',0x165c64,0x165c81),('jailor-fixed-id-tier',0x173b94,0x173bb1),('enchantment-record',0xad9f70,0xad9f8d),('flail-name-id-pair',0x165d68,0x165d87),('jailor-name-id-pair',0x173c98,0x173cb7)]
ITEMS=[('flail','Mace_Unique2','part-018',33,0x165c10,0x32cdd48,0x32cde10),('jailors-scythe','SoulScythe_Unique1','part-020',13,0x173b40,0x32d1340,0x32d1368)]
def sha(b):return hashlib.sha256(b).hexdigest()
def leaves(props):
 for p in props:
  d=p['decoding']
  if 'value' in d:yield p
  yield from leaves(d.get('properties',[]))
  for e in d.get('elements',[]):yield from leaves(e.get('properties',[]))
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--local-root',type=Path,default=DEFAULT_LOCAL);ap.add_argument('--output',type=Path,default=Path(__file__).with_name('chains-evidence.json'));ap.add_argument('--check',action='store_true');args=ap.parse_args()
 sys.path.insert(0,str(args.local_root/'phase6.8/native-stage2/tools'));import capstone
 im=(args.local_root/'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes();assert sha(im)==IMAGE
 cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64)
 def u64(a):return struct.unpack_from('<Q',im,a)[0]
 def string(a,enc):
  if enc=='ascii':return im[a:im.index(b'\0',a)].decode('ascii')
  end=next(i for i in range(a,len(im)-1,2) if im[i:i+2]==b'\0\0');return im[a:end].decode('utf-16le')
 assert u64(0x327c038+0x3d8)-BASE==0xa66ad0
 assert u64(0x327c038+0x3e0)-BASE==0xa6ba90
 assert u64(0x3291470+0x10)-BASE==0xa7aa70
 assert u64(0x3414a60)-BASE==0x3415658 and u64(0x3414a68)==24
 assert string(0x3415658,'ascii')=='EEnchantmentTypeID::Chains'
 assert string(0x33da240,'utf16')=='UChains'
 assert string(0x32648b8,'utf16')=='ItemType'
 rows=[];inputs={}
 for eid,raw,shard,ix,fn,idstr,namestr in ITEMS:
  p=f'research/raw/game-data-raw-structural-inventory/shards/{shard}.json.gz';b=(ROOT/p).read_bytes();inputs[p]=sha(b);x=json.loads(gzip.decompress(b))['packages'][ix]
  assert x['path'].endswith('/BP_'+raw+'Instance')
  props=[z for c in x['cdoPropertyInventory'] for z in leaves(c['properties'])]
  ident={z['path']:z['decoding']['value'] for z in props if z['path'] in ['ItemIdName','ItemId.SerializedId']};assert ident=={'ItemIdName':raw,'ItemId.SerializedId':raw}
  wanted=[z for z in props if z['path'] in ident or z['path']=='GearActor' or z['path'].startswith('ConfiguredAttackVariants[') and z['path'].split('.')[-1] in ['Name','Damage','AttackAnimationTimeDurationSeconds','CooldownSeconds','VariantLoopAmount','VariantActiveEffect','VariantChangeEffect','ContinuousDamageInterval','bTriggerEnchantmentsAfterDamage']]
  assert string(idstr,'utf16')==raw
  rows.append(dict(id=eid,rawIdentity=raw,nativeCatalogFunction=hex(fn),nativeStringBinding=dict(namespaceRva='0x32648b8',namespace='ItemType',keyRva=hex(idstr),key=raw,displayRva=hex(namestr),display=string(namestr,'utf16')),rawLocator=p+'#/packages/'+str(ix),packagePath=x['path'],packageHash=x['packageHash'],sourceFiles=x['sourceFiles'],inheritanceChains=x['inheritanceChains'],ownFields=[dict(path=z['path'],value=z['decoding']['value'],valueRange=z['valueRange']) for z in wanted],fixedRecord=dict(enumId=24,enumName='EEnchantmentTypeID::Chains',tier=1,wrapperByte=2,recordConstructor='0xad9f70',copyIntoCatalogArray='0xb67390',catalogArrayOffset='0x70',recordStrideBytes=20),formalIdentityPromotion=False))
 for p in ['research/domain/formal/identity-evidence-v1.json','research/melee-attack-profile-audit.json']:
  inputs[p]=sha((ROOT/p).read_bytes())
 assertions=json.loads((ROOT/'research/domain/formal/identity-evidence-v1.json').read_bytes())['identityAssertions']
 assert not [z for z in assertions if z['domainId'] in ['flail','jailors-scythe']]
 d=dict(schemaVersion=1,artifactKind='chains-native-static-evidence',baselineCommit='6bf212dc5ea8f686f981c9882657874264e41791',runtimePromotion=False,image=dict(sha256=IMAGE,base=hex(BASE)),status=dict(conditionalNativeFoundation='READY-for-independent-review',itemNativeIdentityAndFixedRecord='STATIC-BOUND',formalItemAdoption='PARTIAL-not-promoted',fullQueryExecution='not-executed',gameplay='not-observed'),classBinding=dict(nameRva='0x33da240',registration='0x1be300',getter='0xebec50',builder='0xebbe80',constructionCallback='0xebd300',constructor='0xa484f0',vtable='0x327c038',selectionSlot='0x3d8',selectionFunction='0xa66ad0',armSlot='0x3e0',armFunction='0xa6ba90',typeIdField='0x1dc',typeId=24),enumBinding=dict(recordRva='0x3414a60',stringRva='0x3415658',name='EEnchantmentTypeID::Chains',value=24),spans=[dict(role=n,startRva=hex(a),endRvaExclusive=hex(b),sha256=sha(im[a:b])) for n,a,b in SPANS],decisiveInstructions=[dict(role=n,startRva=hex(a),endRvaExclusive=hex(b),sha256=sha(im[a:b]),instructions=[dict(rva=hex(q.address),mnemonic=q.mnemonic,operands=q.op_str) for q in cs.disasm(im[a:b],a)]) for n,a,b in SNIPPETS],items=rows,conditions=['This specific recovered-image UChains path.','No other eligible Chain candidate returned by completed world/class/predicate/radius/eligibility query around the primary.','Melee averageTargetsInReach=1 is not sufficient for that condition.','Effect count, RNG and eligibility engine behavior are not replaced with zero or successful stubs.'],staticConclusion='Primary actor is excluded from the neighbor query. Selected neighbor count zero skips primary append and application call; nonempty neighbors allow primary append.',query=dict(radiusArgumentField='0x20c',constructorDefault=1200.0,unit='native spatial units; no metre/block conversion claimed',radiusSquaredAt='0x820f55',selfExclusionAt='0x821000',candidateDistanceCall='0xc26c40',distanceCompareAt='0x821031',predicateVtable='0x32910d0',predicateFunction='0x344720',eligibilityFunction='0xa5c270',eligibilityGates=['candidate classification/lookup at 0xf4fa20 -> 0xe479a0','owner actor virtual slot +0x900 must return false','0xe4ade0 -> 0x7c30f0 must return true','0xc1eb20 -> 0x7c2560 must return true','StatusEffect.Chains tag must be absent','target +0x84 mask 0x04 must be clear'],maxNeighborCountExpression='object[+0x1f8] + object[+0x1d8] - 1',constructorBaseNeighborCount=2),duration=dict(callback='0xa7aa70',expression='binary32(binary32(signed tier int32) * object[+0x200])',defaultFactor=1.0,unit='set-by-caller gameplay duration candidate; complete final duration not asserted',mobAlternativeField='0x204',mobAlternativeDefault=4.0,applicationSetByCallerCall='0x3ca070',remaining='Set-by-caller name and effect evaluation/refresh not fully bound; irrelevant to zero-neighbor no-call proof.'),boundaries=['Raw/exe exact build equivalence and official authenticity remain unverified.','No Windows/gameplay runtime was executed.','No whole-world query, timer, multiplayer or immunity proof.','Own native catalog identities correct old ambiguous icon seeds; no Formal status changed.','Whole function bytes/private payload/full decompilation are not emitted.'],inputSha256=inputs)
 text=json.dumps(d,ensure_ascii=False,indent=2)+'\n'
 if args.check:assert args.output.read_text()==text;print('Chains static evidence matches pinned image and source inputs')
 else:args.output.write_text(text);print('Saved',args.output)
if __name__=='__main__':main()
