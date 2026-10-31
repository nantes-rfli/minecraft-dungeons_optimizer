from pathlib import Path
import json,struct

def build_model(w):
    study=w/'research/native/ranged-20261031'
    raw=json.loads((study/'raw-evidence.json').read_text()); by={x['path']:x for x in raw}; ids=json.loads((w/'research/domain/formal/identity-evidence-v1.json').read_text())['identityAssertions']; replay=json.loads((study/'verification.json').read_text())
    names={'bow':('Bow','Bow/BP_BowInstance','Bow/BP_BowArrow'),'shortbow':('Shortbow','Shortbow/BP_ShortbowInstance','Shortbow/BP_ShortBow_Arrow'),'longbow':('Longbow','LongBow/BP_LongbowInstance','LongBow/BP_LongBowArrow'),'power-bow':('Powerbow','PowerBow/BP_PowerBowInstance','PowerBow/BP_PlayerPowerBowArrow'),'heavy-crossbow':('HeavyCrossbow','HeavyCrossbow/BP_HeavyCrossbowInstance','HeavyCrossbow/BP_HeavyCrossbow_Arrow')}
    pre='Dungeons/Content/Actors/Equipment/RangedWeapons/'
    def bits(v):return f'{struct.unpack("<I",struct.pack("<f",v))[0]:08x}'
    def resolve(pkg,field,default=None):
     for p in [pkg]+[h['targetPackage'] for c in by[pkg]['inheritance'] for h in c['hops'] if h.get('targetPackage') in by]:
      leaves=[x for x in by[p]['leaves'] if x['path']==field]
      if leaves:
       x=leaves[0];return {'value':x['value'],'bits':bits(x['value']),'origin':'raw-cdo','packagePath':p,'shard':by[p]['shard'],'packageIndex':by[p]['index'],'rawPath':field,'valueRange':x['range'],'sourceSha256':next(s['sha256'] for s in by[p]['sources'] if s['path']==x['range']['file'])}
     if default is None:raise ValueError((pkg,field))
     return {'value':default[0],'bits':bits(default[0]),'origin':'native-constructor','rva':default[1],'absenceCheckedIn':[pkg]+[h['targetPackage'] for c in by[pkg]['inheritance'] for h in c['hops'] if h.get('targetPackage') in by]}
    bp=json.loads((study/'blueprint-review.json').read_text())
    relations=json.loads((w/'research/domain/formal/serialized-relation-v2.json').read_text())['semantic']['relations']
    values=json.loads((w/'research/domain/formal/value-availability-v2.json').read_text())['semantic']['ranged']
    profiles={}
    for id,(native,weapon,arrow) in names.items():
     p=pre+weapon;a=pre+arrow; identity=next(x for x in ids if x['domainId']==id)
     profiles[id]={'identityAssertionId':identity['id'],'rawIdentity':identity['rawIdentity'],'weaponPackage':p,'projectilePackage':a,'parameters':{
     'projectileBaseDamage':resolve(a,'damage'),'projectileDamageFactor':resolve(p,'AttackDefintion.ProjectileDamageFactor',(1,'0xb19418')),
     'chargeDamageMultiplier':resolve(p,'AttackDefintion.ChargeDamageMultiplier',(1,'0xb193fa')),
     'attackRateSeconds':resolve(p,'AttackDefintion.AttackRateSeconds',(1,'0xb193e5')),
     'chargeTimeSeconds':resolve(p,'AttackDefintion.ChargeTimeSecond',(0,'0xb193e5')),
     'activeCancelPointFactor':resolve(p,'AttackDefintion.ActiveCancelPorintFactor',(1,'0xb19404'))},
     'configuredProjectile':{key:next(x['value'] for x in by[p]['leaves'] if x['path']=='AttackDefintion.ProjectileDefinition[0].'+key) for key in ['Projectile','NumberOfProjectiles','DelaySeconds','DelaySecondsPerProjectile']},
     'chargeSwitch':'completion-callback-boolean' if id!='heavy-crossbow' else 'not-chargeable',
     'derivedCdoBaseline':{'uncharged':replay['examples'][native]['uncharged'],'charged':replay['examples'][native]['charged']},
     'finalProjectileDamage':{'state':'unknown','reason':'internal ItemPower, exact CRT, effective captured attributes, event and target handling not established'},
     'effectiveShotCycleSeconds':{'state':'unknown','reason':'input/tick order, clocks and effective speed/action state not supplied'}}
    for id,profile in profiles.items():
     identity=next(x for x in ids if x['domainId']==id)
     assert identity['reviewState']=='accepted' and identity['applicationScope']['packagePath']==profile['weaponPackage'], 'Formal identity drift'
     rels=[r for r in relations if r['sourceDomainId']==id and r['occurrence'].get('sourceIndex')==0]
     assert len(rels)==1, 'Formal projectile relation missing/ambiguous'
     rel=rels[0]; projectile=profile['configuredProjectile']
     assert rel['target']['objectName']==projectile['Projectile']['objectName']==profile['projectilePackage'].split('/')[-1]+'_C', 'Projectile target drift'
     assert rel['target']['gamePackagePath'].replace('/Game/','Dungeons/Content/')==profile['projectilePackage'], 'Projectile package drift'
     val=values[id]; assert val['configuredProjectileDefinitions']['value']==[0], 'Projectile collection drift'
     entry=val['projectileDefinitions'][0]; assert entry['sourceIndex']==0
     pairs={'configuredProjectileCount':'NumberOfProjectiles','configuredDelaySeconds':'DelaySeconds','configuredDelaySecondsPerProjectile':'DelaySecondsPerProjectile'}
     for field,raw in pairs.items(): assert entry[field]['value']==projectile[raw], 'Formal configured value drift'
     profile['formalConnection']={'relationProjectionRef':rel['projectionRef'],'relationEvidenceRefs':rel['evidenceRefs'],'configuredValues':{field:entry[field] for field in pairs}}
     if id!='bow':
      review=next(r for r in bp['results'] if r['domainId']==id)
      profile['blueprintReview']={'ref':'research/native/ranged-20261031/blueprint-review.json','status':'source-derived-limited-observed-only','scriptHashes':[f['scriptSha256'] for f in review['functions']]}
     def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
     params=profile['parameters']; b=params['projectileBaseDamage']['value']; factor=params['projectileDamageFactor']['value']; k=params['chargeDamageMultiplier']['value']
     expected={'uncharged':f32(f32(1 * f32(1 * factor)) * b), 'charged':f32(f32(1 * f32(k * factor)) * b) if params['chargeTimeSeconds']['value']>0 else None}
     assert profile['derivedCdoBaseline']==expected, 'Native replay/base formula drift: '+id
    artifact={'schemaVersion':1,'kind':'conditional-native-cdo-ranged-model','gameVersion':'1.17.0.0','evidenceStatus':'derived','runtimePromotion':False,
     'identitySource':'research/domain/formal/identity-evidence-v1.json','rawValueRelationBoundary':'Formal v2 remains serialized configured values; this derived Native model does not mint Formal Value or Relation assertions',
     'nativeEvidence':'research/native/ranged-20261031/verification.json','nativeImageSha256':replay['mapped_image_sha256'],
     'conditions':['local Raw/Native inputs, same build and distribution authenticity unverified','normal single arrow on land; G explicitly 1; no extra effects or event changes','constructor defaults only after checking listed Raw inheritance; not a live equipment capture','binary32 round-nearest/ties-even, FTZ/DAZ off; live FP state unknown'],
     'formula':{'baseline':'F(F(G * F((charged ? K : 1) * P)) * B)','cooldownDuration':'F(F(1 / S_fire) * R)','chargeDuration':'F(C / S_charge)','nextAllowed':'F(F(cooldownDuration + worldNow) + itemTypeDelay)','chargeTimeAPI':'F(F(C + R) / S)','timerCallback':'timerClock > expiry; not >=; no assumed FPS'},'profiles':profiles}
    return artifact

def validate_model(root, model):
    if model != build_model(root):
        raise ValueError('Native domain drift')

def main():
    import sys
    root=Path(__file__).resolve().parents[3]
    f=root/'research/domain/ranged-native-model.json'
    text=json.dumps(build_model(root),indent=2)+'\n'
    if '--write' in sys.argv: f.write_text(text)
    assert f.read_text()==text, 'Native domain drift; run build_ranged_domain.py --write'
    print('Ranged Native derived domain PASS: 5 identity-bound CDO models; effective values unknown')
if __name__=='__main__': main()
