#!/usr/bin/env python3
"""Public CI checks for immutable source evidence and conditional Native model."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
STUDY = ROOT/'research/native/ranged-final-20261101'
sys.path.insert(0, str(STUDY))
import verify as oracle


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(root=ROOT):
    study=root/'research/native/ranged-final-20261101'
    load=lambda path: json.loads(path.read_text())
    for item in load(study/'manifest.json')['files']:
        require(Path(item['path']).name == item['path'], 'unsafe source path')
        data=(study/item['path']).read_bytes()
        require(len(data)==item['size'] and hashlib.sha256(data).hexdigest()==item['sha256'], 'Astra source drift: '+item['path'])
    for path, expected in load(study/'integration-manifest.json')['files'].items():
        require(not Path(path).is_absolute() and '..' not in Path(path).parts, 'unsafe integration path')
        require(hashlib.sha256((root/path).read_bytes()).hexdigest()==expected, 'integration evidence drift: '+path)
    evidence=load(study/'evidence.json')
    proof=load(study/'verification.json')
    model=load(root/'research/domain/ranged-final-native-model.json')
    require(load(study/'integration-replay.json') == proof, 'independent replay drift')
    watchdog=load(study/'integration-replay.watchdog.json')
    require(watchdog['status']=='exited' and watchdog['returncode']==0 and not watchdog['forcedKill'] and watchdog['cleanupComplete'], 'replay watchdog failure')
    require(sum(proof['checks'].values())==2467 and proof['cpuCrosscheck']['cases']==538 and proof['mismatches']==proof['cpuCrosscheck']['mismatches']==0, 'case count drift')
    require(len(evidence['nativeSpans'])==43 and len(evidence['pointers'])==7 and len(proof['executedPowerAndAggregationInstructions'])==212, 'evidence census drift')
    for key in ['actualGameProviderConfirmed','actualSaveTested','liveGameMxcsrObserved','wholeGameExecution','actualGameFinalDamageComputed','rawExeSameBuildAuthenticated','runtimePromotion']:
        require(proof[key] is False, 'unverified boundary drift: '+key)
    require(model['captures']==evidence['captures'] and model['runtimePromotion'] is False, 'capture or promotion drift')
    require(model['provider']['crtSha256']==proof['crtSha256'] and model['provider']['mxcsr']==proof['mxcsr'] and model['provider']['dispatch']==0, 'provider drift')
    require(model['runtimeAdoption']['outcome']=='held' and model['runtimeAdoption']['newCalculableRuntimeEquipment']==model['runtimeAdoption']['newCalculableRuntimeEffects']==0, 'runtime adoption drift')
    for row in proof['completePowerCases']:
        require(oracle.exponent(int(row['itemPowerBits'],16))==int(row['exponentBits'],16), 'exponent drift')
        require(oracle.scalar_suffix(int(row['powfBits'],16))==int(row['scalarBits'],16), 'suffix drift')
        require(oracle.effective_q(int(row['scalarBits'],16))==int(row['effectiveQBits'],16), 'aggregation drift')
    for row in proof['thresholdCases']:
        require(oracle.threshold_model(*[int(x,16) for x in row[:4]])==int(row[4],16), 'threshold drift')
    from build_ranged_domain import validate_model
    base=load(root/model['baselineModel'])
    validate_model(root,base)
    ids={'Bow':'bow','Shortbow':'shortbow','Longbow':'longbow','Power Bow':'power-bow','Heavy Crossbow':'heavy-crossbow'}
    for row in proof['conditionalExamples']:
        profile=base['profiles'][ids[row['weapon']]]
        h=profile['derivedCdoBaseline']['charged' if row['mode']=='charged' else 'uncharged']
        power=next(r for r in proof['completePowerCases'] if r['itemPowerBits']==row['itemPowerBits'])
        v=oracle.signed_damage(oracle.bits(h),0,oracle.ONE,oracle.ONE,oracle.ONE,oracle.ONE,int(power['effectiveQBits'],16),oracle.ONE,oracle.ONE)
        require((v ^ 0x80000000)==int(row['positiveCustomMagnitudeBits'],16) and row['actualGameFinalDamage'] is None, 'conditional example drift')
    for row in load(study/'attribute-fixtures.json')['cases']:
        a=row['attributes']; power=next(r for r in proof['completePowerCases'] if r['itemPowerBits']==row['itemPowerBits'])
        v=oracle.signed_damage(oracle.bits(125),*[oracle.bits(a[k]) for k in ['RangedAttackDamageIncrease','TakeDamageMultiplier','DamageMultiplier','DealDamageMul','DifficultyDealDamageMultiplier']],int(power['effectiveQBits'],16),oracle.bits(a['RangedAttackDamageMultipler']),oracle.bits(a['TakeRangeDamageMultiplier']))
        require(v==int(row['signedCustomMagnitudeBits'],16), 'attribute fixture drift')
    return {'status':'passed','nativeCases':2467,'cpuCases':538,'conditionalExamples':117,'nonNeutralAttributeCases':128,'runtimeAdditions':0,'privateInputsRequired':False}


if __name__=='__main__':
    print(json.dumps(validate(),indent=2))
