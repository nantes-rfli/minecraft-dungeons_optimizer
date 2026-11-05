#!/usr/bin/env python3
"""Explicit conditional calculator using hash-pinned original CRT/game code.

No host pow, display-Power inference, save decryption, live game or DPS adoption.
The worker is bounded by native_watchdog; no loader or Windows APIs are run.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
STUDY = ROOT / 'research/native/ranged-final-20261101'
sys.path.insert(0, str(STUDY))
import verify as oracle


def require(condition, message):
    if not condition:
        raise ValueError(message)


def worker(args):
    from check_ranged_final import validate
    validate()
    request_bytes = args.input.read_bytes()
    request = json.loads(request_bytes)
    model = json.loads((ROOT/'research/domain/ranged-final-native-model.json').read_text())
    profiles = json.loads((ROOT/model['baselineModel']).read_text())['profiles']
    require(request['provider'] == model['provider']['id'], 'unverified provider/FP state')
    for field, expected in model['conditions'].items():
        require(request[field] == expected, 'unsupported condition: '+field)
    profile = profiles[request['weaponId']]
    mode = request['mode']
    require(mode in (['single'] if request['weaponId']=='heavy-crossbow' else ['uncharged', 'charged']), 'unsupported mode')
    h = profile['derivedCdoBaseline']['charged' if mode=='charged' else 'uncharged']
    power = request['power']
    require(isinstance(power['sourceNote'], str) and power['sourceNote'].strip(), 'missing item power provenance')
    if power['kind'] == 'internal-f32-bits':
        require(isinstance(power['bits'], str) and len(power['bits']) == 8 and all(c in '0123456789abcdefABCDEF' for c in power['bits']), 'invalid float32 bits')
        x = int(power['bits'], 16)
    else:
        require(power['kind']=='parsed-save-double' and type(power['value']) in (int, float) and math.isfinite(power['value']), 'parsed numeric double required')
        x = oracle.bits(float(power['value']))
    def normal(v):
        return math.isfinite(v) and (v == 0 or abs(v) >= 2**-126)
    require(normal(oracle.value(x)) and 0 <= oracle.value(x) <= 40, 'Power outside reviewed domain')
    attributes = request['attributes']
    names = [c['attribute'] for c in model['captures'] if c['attribute']!='RangedAttackItemPowerFactor']
    for key in names:
        v = attributes[key]
        require(type(v) in (int, float) and normal(v) and v >= 0 and oracle.value(oracle.bits(v)) == v, 'explicit nonnegative normal binary32 attribute required: '+key)
    im, crt, _ = oracle.read_inputs(SimpleNamespace(local_root=args.local_root, crt_root=args.crt_root))
    import unicorn as uc
    from unicorn import x86_const as r
    require(uc.__version__ == '2.1.4', 'Unicorn version mismatch')
    u = uc.Uc(uc.UC_ARCH_X86, uc.UC_MODE_64)
    for base, blob in ((oracle.BASE, im), (crt.base, bytes(crt.im))):
        u.mem_map(base, (len(blob)+4095) & ~4095)
        u.mem_write(base, blob)
    data, stack, stop = 0x60000000, 0x70000000, 0x71000000
    for base, size in ((data, 0x10000), (stack, 0x10000), (stop, 0x1000)):
        u.mem_map(base, size)
    u.mem_write(oracle.BASE+0x3095e38, struct.pack('<Q', crt.base+crt.exports['powf']))
    u.mem_write(crt.base+0x1007d4, struct.pack('<I', 0))
    def run(start):
        u.reg_write(r.UC_X86_REG_RSP, stack+0x8008)
        u.mem_write(stack+0x8008, struct.pack('<Q', stop))
        u.reg_write(r.UC_X86_REG_MXCSR, 0x1f80)
        u.emu_start(oracle.BASE+start, stop, count=10000, timeout=100000)
        require(u.reg_read(r.UC_X86_REG_RIP) == stop, 'bounded Native execution did not return')
        return u.reg_read(r.UC_X86_REG_XMM0) & 0xffffffff
    u.reg_write(r.UC_X86_REG_XMM0, x)
    m = run(0xb88f20)
    u.reg_write(r.UC_X86_REG_XMM0, m)
    u.reg_write(r.UC_X86_REG_EDX, 1)
    u.reg_write(r.UC_X86_REG_R8D, 1)
    ms = run(0x3d2510)
    u.mem_write(data+16, struct.pack('<Qii', data+0x1000, 1, 1))
    u.mem_write(data+0x1010, struct.pack('<I', ms))
    u.mem_write(data+0x1021, bytes([1]))
    u.reg_write(r.UC_X86_REG_RCX, data)
    u.reg_write(r.UC_X86_REG_XMM1, oracle.ONE)
    q = run(0x3d30e0)
    require(q == oracle.effective_q(m), 'Native aggregation disagrees with rational oracle')
    a = {key: oracle.bits(attributes[key]) for key in names}
    def op(left, right, kind):
        result = oracle.op(left, right, kind)
        # The original rational oracle erases signed zero; preserve IEEE signs
        # here as the public JS binary32 path does, including an explicit zero.
        if result & 0x7fffffff == 0:
            l, r = oracle.value(left), oracle.value(right)
            result = oracle.bits(l+r if kind == 'add' else l*r)
        require(normal(oracle.value(result)), 'intermediate outside normal domain')
        return result
    v = op(a['RangedAttackDamageIncrease'] ^ 0x80000000, oracle.bits(h) ^ 0x80000000, 'add')
    for factor in [a['TakeDamageMultiplier'], a['DamageMultiplier'], a['DealDamageMul'], a['DifficultyDealDamageMultiplier'], q, a['RangedAttackDamageMultipler'], a['TakeRangeDamageMultiplier']]:
        v = op(v, factor, 'mul')
    require(normal(oracle.value(v)), 'custom magnitude outside normal domain')
    output = {'state':'known', 'evidenceStatus':'derived', 'runtimePromotion':False,
        'gameVersion':model['gameVersion'], 'identityAssertionId':profile['identityAssertionId'],
        'itemPowerBits':f'{x:08x}', 'powerScalarBits':f'{m:08x}', 'effectivePowerFactorBits':f'{q:08x}',
        'baselineBeforePower':h, 'signedCustomMagnitude':oracle.value(v), 'signedCustomMagnitudeBits':f'{v:08x}',
        'positiveCustomMagnitude':-oracle.value(v),
        'hpLoss':{'state':'unknown', 'reason':'target state and events not supplied'},
        'combatDps':{'state':'unknown', 'reason':'unpromoted damage and effective cadence'},
        'provenance':{'requestSha256':hashlib.sha256(request_bytes).hexdigest(),
            'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'imageSha256':oracle.IMAGE_HASH, 'crtSha256':crt.sha256, 'mxcsr':'0x1f80', 'dispatch':0,
            'powerAndAggregation':'original Native instructions', 'customMagnitude':'exact-rational binary32 model; not full capture/engine execution',
            'actualGameProviderConfirmed':False, 'actualSaveTested':False, 'wholeGameExecution':False}}
    args.output.write_text(json.dumps(output,indent=2)+'\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--local-root', required=True)
    parser.add_argument('--crt-root', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        worker(args)
        return
    require(not args.output.exists() and not Path(str(args.output)+'.watchdog.json').exists(), 'refusing to overwrite an existing result')
    from native_watchdog import supervise
    result = supervise([sys.executable, '-B', __file__, *sys.argv[1:], '--worker'], 10)
    Path(str(args.output)+'.watchdog.json').write_text(json.dumps(result,indent=2)+'\n')
    require(result['status']=='exited' and result['returncode']==0 and not result['forcedKill'] and result['cleanupComplete'], 'calculation failed: '+str(result))
    print(args.output.read_text())


if __name__ == '__main__':
    main()
