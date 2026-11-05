#!/usr/bin/env python3
"""Conditional research calculator and bounded Native checks; never runtime support.

Uses the genuine pinned CRT instructions, not host pow. The CRT is an explicit
reference environment, NOT a demonstrated provider from the inspected game.
Game objects, tags, Blueprint dispatch and target events are NOT emulated.
"""
import argparse
import ctypes
import hashlib
import json
import mmap
import platform
import random
import struct
import sys
from fractions import Fraction
from pathlib import Path

from pe_math import PE, import_checksum

HERE = Path(__file__).resolve().parent
BASE = 0x140000000
IMAGE_HASH = '04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
EXE_HASH = 'eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8'
CRT_HASH = 'fbed69a52fdcf571dd37fe4cc63cb86ed3732b5b998807f14968788027c00754'
FWD_HASH = '6ea15153e8948e7fc9e0aee7cfc5cb7b9b8f872f94e6714bc510b9bc7291ad9b'
ONE = 0x3f800000


def bits(x):
    return struct.unpack('<I', struct.pack('<f', x))[0]


def value(x):
    return struct.unpack('<f', struct.pack('<I', x))[0]


def rounded(x):
    """Exact rational -> binary32 RN-even, finite normal/subnormal test domain."""
    if not x:
        return 0
    sign = 0x80000000 if x < 0 else 0
    x = abs(x)
    e = x.numerator.bit_length()-x.denominator.bit_length()
    if x < Fraction(2)**e:
        e -= 1
    unit = Fraction(2)**max(e-23, -149)
    scaled = x/unit
    q, r = divmod(scaled.numerator, scaled.denominator)
    if 2*r > scaled.denominator or (2*r == scaled.denominator and q & 1):
        q += 1
    if e < -126:
        return sign | q
    if q == 1 << 24:
        q >>= 1
        e += 1
    assert e <= 127
    return sign | ((e+127) << 23) | (q-(1 << 23))


def op(a, b, kind):
    a, b = Fraction(value(a)), Fraction(value(b))
    return rounded({'add': lambda: a+b, 'sub': lambda: a-b,
                    'mul': lambda: a*b, 'div': lambda: a/b}[kind]())


def exponent(x):
    q = op(op(x, ONE, 'sub'), 0x4127b7b8, 'div')
    q = bits(min(3, max(0, value(q))))
    return op(q, bits(19), 'mul')


def scalar_suffix(y):
    t = op(op(y, bits(.75), 'mul'), bits(.75), 'sub')
    t = bits(max(0, value(t)))
    return op(op(t, t, 'add'), ONE, 'add')


def effective_q(m):
    # Explicit one-stack/one-channel/base=1, custom defaults, one qualified mod.
    m = op(0, op(ONE, op(0, m, 'add'), 'mul'), 'add')
    stacked = op(op(ONE, op(m, ONE, 'sub'), 'mul'), ONE, 'add')
    channel = op(op(ONE, stacked, 'add'), ONE, 'sub')
    return op(op(op(0, ONE, 'add'), channel, 'mul'), ONE, 'div')


def signed_damage(h, inc, take, damage, deal, difficulty, q, ranged, take_range):
    v = op(op(inc ^ 0x80000000, h ^ 0x80000000, 'add'), take, 'mul')
    v = op(op(v, damage, 'mul'), deal, 'mul')
    v = op(v, difficulty, 'mul')
    return op(op(op(q, v, 'mul'), ranged, 'mul'), take_range, 'mul')


def threshold_model(current, maximum, threshold, proposed):
    t = value(threshold)
    eps = value(0x3c23d70a)
    if abs(value(op(threshold, ONE, 'sub'))) <= eps or abs(t) <= eps:
        return proposed
    inv = op(ONE, maximum, 'div')
    new_ratio = op(inv, proposed, 'mul')
    old_ratio = op(inv, current, 'mul')
    if value(new_ratio) >= t or value(old_ratio) <= t:
        return proposed
    if abs(value(op(old_ratio, threshold, 'sub'))) <= eps:
        return proposed
    return op(maximum, threshold, 'mul')


def read_inputs(args):
    local = Path(args.local_root)
    sys.path.insert(0, str(local/'phase6.8/native-stage2/tools'))
    im = (local/'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes()
    assert hashlib.sha256(im).hexdigest() == IMAGE_HASH
    exe = local/'archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe'
    assert hashlib.sha256(exe.read_bytes()).hexdigest() == EXE_HASH
    crt = PE(Path(args.crt_root)/'ucrtbase.dll')
    fwd = PE(Path(args.crt_root)/'api-ms-win-crt-math-l1-1-0.dll')
    assert crt.sha256 == CRT_HASH and fwd.sha256 == FWD_HASH
    assert crt.exports['powf'] == 0x34630 and fwd.exports['powf'] == 'ucrtbase.powf'
    for p in (crt, fwd):
        assert [n for n in p.exports if import_checksum(n) == 0xc6b8f5fd] == ['powf']
    evidence = json.loads((HERE/'evidence.json').read_text())
    for rec in evidence['nativeSpans']:
        a, b = int(rec['start'], 16), int(rec['end'], 16)
        assert hashlib.sha256(im[a:b]).hexdigest() == rec['sha256'], rec['role']
    for rec in evidence['pointers']:
        assert struct.unpack_from('<Q', im, int(rec['rva'], 16))[0] == BASE+int(rec['target'], 16)
    return im, crt, fwd


def worker(args):
    im, crt, fwd = read_inputs(args)
    import unicorn as uc
    from unicorn import x86_const as r
    assert uc.__version__ == '2.1.4'
    u = uc.Uc(uc.UC_ARCH_X86, uc.UC_MODE_64)
    for base, data in ((BASE, im), (crt.base, bytes(crt.im))):
        u.mem_map(base, (len(data)+4095) & ~4095)
        u.mem_write(base, data)
    data, stack, stop = 0x60000000, 0x70000000, 0x71000000
    u.mem_map(data, 0x10000)
    u.mem_map(stack, 0x10000)
    u.mem_map(stop, 0x1000)
    # Only environment binding: resolve the demonstrated import to this explicit
    # provider. No native arithmetic, success/failure result or game call stubbed.
    u.mem_write(BASE+0x3095e38, struct.pack('<Q', crt.base+crt.exports['powf']))
    u.mem_write(crt.base+0x1007d4, struct.pack('<I', 0))
    counts = {}
    def xf(n, b):
        u.reg_write(getattr(r, 'UC_X86_REG_XMM'+str(n)), b)
    def xg(n=0):
        return u.reg_read(getattr(r, 'UC_X86_REG_XMM'+str(n))) & 0xffffffff
    def wf(a, b):
        u.mem_write(a, struct.pack('<I', b))
    def rf(a):
        return struct.unpack('<I', u.mem_read(a, 4))[0]
    def reg(name, val):
        u.reg_write(getattr(r, 'UC_X86_REG_'+name), val)
    def run(name, start, end=None):
        reg('RSP', stack+0x8008)
        u.mem_write(stack+0x8008, struct.pack('<Q', stop))
        reg('MXCSR', 0x1f80)
        target = BASE+end if end is not None else stop
        u.emu_start(BASE+start, target, count=10000, timeout=100000)
        assert u.reg_read(r.UC_X86_REG_RIP) == target, name
        counts[name] = counts.get(name, 0)+1
        return xg()
    trace = set()
    call_values = {}
    def observe(vm, address, size, unused):
        if BASE <= address < BASE+len(im):
            trace.add(('game', address-BASE, size))
        elif crt.base <= address < crt.base+len(crt.im):
            trace.add(('crt', address-crt.base, size))
        else:
            raise AssertionError('external execution')
        if address == BASE+0xb88f66:
            call_values['exponent'] = xg(1)
            assert xg(0) == bits(1.25)
        if address == BASE+0xb88f6b:
            call_values['powf'] = xg(0)
    hook = u.hook_add(uc.UC_HOOK_CODE, observe)
    rng = random.Random(117220)
    xs = [bits(v) for v in (0, 1, 2, 5, 10.9, 11, 20, 26.2, 32.44706, 40)]
    xs += [0x412e6666, 0x412e6667, 0x3f800001]
    xs += [bits(rng.uniform(1, 40)) for _ in range(256)]
    rows = []
    for x in xs:
        xf(0, x)
        m = run('complete_power_with_crt', 0xb88f20)
        assert call_values['exponent'] == exponent(x)
        assert m == scalar_suffix(call_values['powf'])
        # Existing native stack helper followed by actual channel evaluation.
        xf(0, m); reg('EDX', 1); reg('R8D', 1)
        ms = run('stack', 0x3d2510)
        u.mem_write(data, bytes(0x2000))
        u.mem_write(data+16, struct.pack('<Qii', data+0x1000, 1, 1))
        wf(data+0x1010, ms); u.mem_write(data+0x1021, b'\1')
        reg('RCX', data); xf(1, ONE)
        q = run('channel', 0x3d30e0)
        assert q == effective_q(m)
        rows.append({'itemPowerBits': f'{x:08x}', 'exponentBits': f'{exponent(x):08x}',
                     'powfBits': f'{call_values["powf"]:08x}', 'scalarBits': f'{m:08x}',
                     'effectiveQBits': f'{q:08x}'})
    u.hook_del(hook)
    # Save numeric variant -> float, record +0x14 -> item +0x480. Numerical
    # variants are fixtures; this does not decrypt or parse an actual save file.
    transport = []
    for d in [10.9, 10.90000057220459, 1., 26.2]+[rng.uniform(1, 40) for _ in range(100)]:
        u.mem_write(data, struct.pack('<dB', d, 3))
        reg('RCX', data)
        got = run('json_numeric_to_float', 0x3164c0)
        assert got == rounded(Fraction(d))
        reg('RCX', data+0x100); xf(2, got)
        run('record_power_store', 0xb1ac14, 0xb1ac19)
        reg('RDX', data+0x100); reg('RCX', data+0x200)
        run('record_power_copy', 0x7e2e5a, 0x7e2e60)
        assert rf(data+0x214) == got
        reg('RDI', data+0x200)
        run('save_power_to_double', 0xdf01c0, 0xdf01c8)
        double_bits = u.reg_read(r.UC_X86_REG_XMM1) & ((1 << 64)-1)
        assert struct.unpack('<d', struct.pack('<Q', double_bits))[0] == value(got)
        reg('RSI', data+0x200)
        run('record_to_spawn_input', 0xb5997e, 0xb59983)
        assert xg(1) == got
        reg('RCX', data+0x300)
        run('item_power_store', 0xb02900, 0xb02908)
        assert rf(data+0x780) == got
        transport.append([d, f'{got:08x}'])
    # New target leaf: HealthThreshold. Exercise crossing and non-crossing paths.
    threshold_rows = []
    threshold_inputs = [tuple(bits(v) for v in row) for row in (
        (1000, 1000, .9, 850), (1000, 1000, 0, 850),
        (1000, 1000, 1, 850), (900, 1000, .9, 850),
        (1000, 1000, .9, 900), (1000, 1000, .9, 950),
        (1000, 1000, .01, -10), (1000, 1000, .99, 850),
        (1000, 1000, .5, -10), (500, 1000, .5, -10),
        (509, 1000, .5, 400), (511, 1000, .5, 400))]
    for _ in range(256):
        maximum = bits(rng.uniform(10, 100000))
        current = bits(value(maximum)*rng.uniform(.05, 1))
        proposed = bits(value(current)-rng.uniform(0, value(maximum)))
        t = bits(rng.choice([0, 1, .5, .9, rng.uniform(.02, .98)]))
        threshold_inputs.append((current, maximum, t, proposed))
    for current, maximum, t, proposed in threshold_inputs:
        wf(data+0x34, current); wf(data+0x38, maximum); wf(data+0x6c, t)
        wf(data+0x100, proposed); reg('RCX', data); reg('RDX', data+0x100)
        run('health_threshold', 0x7ac8b0)
        expected = threshold_model(current, maximum, t, proposed)
        assert rf(data+0x100) == expected
        threshold_rows.append([f'{b:08x}' for b in (current, maximum, t, proposed, expected)])
    assert threshold_rows[0][-1] == f'{bits(900):08x}'
    assert threshold_rows[1][-1] == f'{bits(850):08x}'
    # Two custom-magnitude spans and the Health Additive operator.
    # Existing native operation order is tested, no fake capture/engine returns.
    product_rows = []
    for _ in range(256):
        h = bits(rng.uniform(1, 300)); inc = bits(rng.uniform(0, 50))
        take, dmg, deal, diff, q, ranged, tr = [bits(rng.uniform(.1, 5)) for _ in range(7)]
        reg('RBP', data+0x1000); wf(data+0x1067, take)
        xf(0, inc ^ 0x80000000); xf(6, h ^ 0x80000000)
        run('add_then_take', 0x7af568, 0x7af574)
        v0 = xg(7)
        # General/difficulty/ranged multiplications use the exact-rational model;
        # ranged tail is additionally replayed from the original Native span.
        v2 = op(op(op(v0, dmg, 'mul'), deal, 'mul'), diff, 'mul')
        wf(data+0x1067, q); wf(data+0x1077, ranged); wf(data+0x107f, tr); xf(6, v2)
        run('ranged_tail', 0x7b0446, 0x7b0459)
        expected = signed_damage(h, inc, take, dmg, deal, diff, q, ranged, tr)
        assert xg(7) == expected
        reg('EDX', 0); xf(0, bits(1000)); xf(2, expected)
        final = run('health_add', 0x3d9300)
        assert final == op(bits(1000), expected, 'add')
        product_rows.append(f'{expected:08x}')
    examples = []
    # H0 from #220's committed/replayed Raw+Native product, already binary32.
    modes = [('Bow', 'uncharged', bits(50)), ('Bow', 'charged', bits(125)),
             ('Shortbow', 'uncharged', bits(37.5)), ('Shortbow', 'charged', 0x42777fff),
             ('Longbow', 'uncharged', 0x42700001), ('Longbow', 'charged', bits(180)),
             ('Power Bow', 'uncharged', bits(100)), ('Power Bow', 'charged', bits(300)),
             ('Heavy Crossbow', 'single', bits(135))]
    for row in rows[:13]:
        q = int(row['effectiveQBits'], 16)
        for weapon, mode, h in modes:
            damage = signed_damage(h, 0, ONE, ONE, ONE, ONE, q, ONE, ONE) ^ 0x80000000
            examples.append({'weapon': weapon, 'mode': mode, 'itemPowerBits': row['itemPowerBits'],
                             'positiveCustomMagnitudeBits': f'{damage:08x}',
                             'positiveCustomMagnitude': value(damage),
                             'actualGameFinalDamage': None})
    cpu = cpu_check(im, crt, rows) if args.cpu else {'status': 'not-requested'}
    keyed = {r['itemPowerBits']: r for r in rows}
    assert keyed['40a00000']['scalarBits'] == '40e20739'
    assert keyed['40a00000']['effectiveQBits'] == '40e20738'
    assert keyed['412e6666']['scalarBits'] != keyed['412e6667']['scalarBits']
    executed = []
    for source, a, n in sorted(trace):
        blob = im if source == 'game' else crt.im
        executed.append({'image': source, 'rva': hex(a), 'size': n,
                         'sha256': hashlib.sha256(blob[a:a+n]).hexdigest()})
    result = {'baseline': 'bd9249efcebc78934e69fd1ebfe43e5adc7390c3',
              'scope': 'conditional reference CRT + explicit effective attributes; research only',
              'actualGameProviderConfirmed': False, 'actualSaveTested': False,
              'liveGameMxcsrObserved': False, 'wholeGameExecution': False,
              'actualGameFinalDamageComputed': False,
              'rawExeSameBuildAuthenticated': False, 'runtimePromotion': False,
              'mxcsr': '0x1f80', 'imageSha256': IMAGE_HASH, 'crtSha256': CRT_HASH,
              'providerBinding': {
                  'importIatRva': '0x3095e38', 'nameChecksum': '0xc6b8f5fd',
                  'forwarder': fwd.exports['powf'], 'providerPowfRva': hex(crt.exports['powf']),
                  'forwarderNamedExports': len(fwd.exports),
                  'providerNamedExports': len(crt.exports),
                  'matchingNamesInEachExportTable': ['powf'],
                  'providerDispatchFlagRva': '0x1007d4'},
              'checks': counts, 'mismatches': 0, 'completePowerCases': rows,
              'inputTransport': transport, 'thresholdCases': threshold_rows,
              'signedProductDigest': hashlib.sha256(json.dumps(product_rows).encode()).hexdigest(),
              'conditionalExamples': examples, 'cpuCrosscheck': cpu,
              'executedPowerAndAggregationInstructions': executed,
              'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    Path(args.output).write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'checks': counts, 'mismatches': 0, 'cpu': cpu}, ensure_ascii=False))


def cpu_check(im, crt, rows):
    """Independent execution backend: original DLL/game code on x86-64 CPU.

    No math substitution. Hot paths use RIP-relative code/data; import pointer
    alone is fixed up. Only the demonstrated positive-base bounded pow domain.
    """
    assert platform.machine() == 'x86_64', '--cpu requires x86-64/FMA host'
    def mapped(blob):
        mem = mmap.mmap(-1, len(blob), prot=mmap.PROT_READ|mmap.PROT_WRITE|mmap.PROT_EXEC)
        mem.write(blob)
        return mem, ctypes.addressof(ctypes.c_char.from_buffer(mem))
    cm, cb = mapped(crt.im)
    gm, gb = mapped(im)
    gm.seek(0x3095e38); gm.write(struct.pack('<Q', cb+crt.exports['powf']))
    f = ctypes.CFUNCTYPE(ctypes.c_float, ctypes.c_float)(gb+0xb88f20)
    ctl, ctrl = mapped(bytes.fromhex('0fae17c30fae1fc3')+bytes(4088))
    ld = ctypes.CFUNCTYPE(None, ctypes.c_void_p)(ctrl)
    st = ctypes.CFUNCTYPE(None, ctypes.c_void_p)(ctrl+4)
    old = ctypes.c_uint32(); st(ctypes.byref(old))
    env = ctypes.c_uint32(0x1f80)
    differences = []
    try:
        for flag in (0, 1):
            cm.seek(0x1007d4); cm.write(struct.pack('<I', flag))
            for row in rows:
                x = int(row['itemPowerBits'], 16)
                assert 0 <= value(x) <= 40
                ld(ctypes.byref(env))
                got = bits(f(value(x)))
                if got != int(row['scalarBits'], 16):
                    differences.append({'flag': flag, 'itemPowerBits': row['itemPowerBits'],
                                        'cpuBits': f'{got:08x}', 'unicornSseBits': row['scalarBits']})
    finally:
        ld(ctypes.byref(old))
    assert not differences, differences
    return {'status': 'passed', 'backend': 'original x86-64 instructions on CPU',
            'cases': 2*len(rows), 'dispatchFlags': [0, 1], 'mismatches': 0,
            'allPossibleInputsProvenEqual': False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--local-root', required=True)
    p.add_argument('--crt-root', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--cpu', action='store_true')
    p.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = p.parse_args()
    if args.worker:
        worker(args)
        return
    sys.path.insert(0, str(HERE.parent/'scripts'))
    from native_watchdog import supervise
    result = supervise([sys.executable, '-B', str(Path(__file__).resolve()),
                        *sys.argv[1:], '--worker'], 45)
    Path(args.output+'.watchdog.json').write_text(json.dumps(result, indent=2)+'\n')
    assert result['status'] == 'exited' and result['returncode'] == 0
    assert not result['forcedKill'] and result['cleanupComplete']


if __name__ == '__main__':
    main()
