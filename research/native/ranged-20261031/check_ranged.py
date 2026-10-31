"""Bounded native instruction replay, synthetic operands, no game/CRT execution.

Oracle: exact rational arithmetic rounded to binary32 nearest/ties-even.
Unknown live values are parameters, never inferred from successful replay.
"""
import hashlib, json, random, struct
from fractions import Fraction
from pathlib import Path
from native_probe import im, BASE, cs
from unicorn import Uc, UC_ARCH_X86, UC_MODE_64
from unicorn.x86_const import *

OUT=Path(__file__).resolve().parent
ONE=0x3f800000
def bits(x): return struct.unpack('<I',struct.pack('<f',x))[0]
def value(x): return struct.unpack('<f',struct.pack('<I',x))[0]
def rational(x): return Fraction(value(x))
def rounded(x):
    if not x:return 0
    sign=0x80000000 if x<0 else 0;x=abs(x)
    e=x.numerator.bit_length()-x.denominator.bit_length()
    if x < Fraction(2)**e:e-=1
    unit=Fraction(2)**max(e-23,-149)
    q,r=divmod((x/unit).numerator,(x/unit).denominator)
    d=(x/unit).denominator
    if 2*r>d or (2*r==d and q&1):q+=1
    if e<-126:return sign|q
    if q==1<<24:q>>=1;e+=1
    assert e<=127
    return sign|((e+127)<<23)|(q-(1<<23))
def op(a,b,k):
    a,b=rational(a),rational(b)
    return rounded({'add':lambda:a+b,'sub':lambda:a-b,'mul':lambda:a*b,'div':lambda:a/b}[k]())

# Exact instruction-boundary ranges; no calls/imports in replay ranges.
SPANS={
 'weapon_damage_factor':(0xa19894,0xa198b8),
 'projectile_base_product':(0x83b7a8,0x83b7c0),
 'cooldown_duration':(0xa0fc6d,0xa0fc87),
 'charge_duration':(0xa1112e,0xa1113b),
 'charge_time_api':(0xa23387,0xa233a8),
 'next_fire_deadline':(0xa0fcc6,0xa0fcda),
 'action_durations':(0xa0fe78,0xa0fe96),
 'weapon_and_owner_gate':(0x991369,0x991388),
 'captured_ranged_product':(0x7b0446,0x7b0459),
 'timer_expiry_comparison':(0x2322a65,0x2322a79),
}

def main():
    raw=json.loads((OUT/'raw-evidence.json').read_text())
    for p in raw:
        for src in p['sources']:
            f=OUT.parent/'QuickBMS 1.17.0.0'/src['path']
            b=f.read_bytes();assert len(b)==src['size'] and hashlib.sha256(b).hexdigest()==src['sha256']
    pointers={0x3256140+0x3d0:0xa10480,0x3256140+0x3d8:0xa14c00,
              0x3256140+0x420:0xa0fa40,0x3256140+0x428:0xa32950,
              0x3256140+0x470:0xa2d5a0,0x31d27d0+0x970:0x7d2b90,
              0x34434d0+0x240:0x7b02e0,0x31b9648+0x240:0x7b0370,
              0x31b9648+0x250:0x7cf380}
    for a,target in pointers.items():assert struct.unpack_from('<Q',im,a)[0]==BASE+target
    descriptors={0x42660e0:('RangedAttackItemPowerFactor',0x30),
                 0x4266068:('RangedAttackSpeedMultiplier',0x3c),
                 0x41f0d20:('damage',0x3fc),
                 0x4264c20:('ProjectileDamageFactor',0x54),
                 0x4264c98:('ChargeDamageMultiplier',0x48),
                 0x4264ce8:('ChargeTimeSecond',0x40),
                 0x4264d10:('AttackRateSeconds',0x3c)}
    for a,(name,offset) in descriptors.items():
        p=struct.unpack_from('<Q',im,a)[0]-BASE
        assert im[p:p+len(name)]==name.encode() and struct.unpack_from('<I',im,a+0x24)[0]==offset
    instructions={
        0xb193e5:('mov','qword ptr [rdi + 0x53c], 0x3f800000'),
        0xb193fa:('mov','dword ptr [rdi + 0x548], 0x3f800000'),
        0xb19418:('mov','dword ptr [rdi + 0x554], 0x3f800000'),
        0xb1c1cf:('mov','qword ptr [rbx + 0xa8], rdi'),
        0x978ae1:('mov','dword ptr [rbx + 0x104], 0x3f19999a'),
        0x978aeb:('mov','qword ptr [rbx + 0x108], 0x3f4ccccd'),
        0xf72a20:('mov','dword ptr [rbx + 0x30], 0x3f800000'),
        0xf72a38:('mov','dword ptr [rbx + 0x3c], 0x3f800000'),
        0xa2ce6c:('lea','rdx, [rbx + 0x500]'),
        0xa2ce7a:('lea','rcx, [rbp + 0x3b0]'),
        0xa14e2c:('mov','byte ptr [rcx + 0x2d9], 1'),
        0xa2d6c2:('movzx','r8d, byte ptr [rbx + 0x2d9]'),
        0xf75181:('call','qword ptr [rax + 0x428]'),
    }
    for a,expected in instructions.items():
        ins=next(cs.disasm(im[a:a+16],a));assert (ins.mnemonic,ins.op_str)==expected,(hex(a),ins.op_str)
    uc=Uc(UC_ARCH_X86,UC_MODE_64)
    uc.mem_map(BASE,(len(im)+4095)&~4095);uc.mem_write(BASE,im)
    DATA=0x20000000;STACK=0x10000000
    uc.mem_map(DATA,0x10000);uc.mem_map(STACK,0x10000)
    DEF=DATA;PROJ=DATA+0x2000;OWNER=DATA+0x4000;RBPMEM=DATA+0x6000
    def setf(a,b):uc.mem_write(a,struct.pack('<I',b))
    def xmm(n,b):uc.reg_write(globals()['UC_X86_REG_XMM'+str(n)],b)
    def getx(n):return uc.reg_read(globals()['UC_X86_REG_XMM'+str(n)])&0xffffffff
    def getf(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
    counts={n:0 for n in SPANS}
    def run(n):
        start,end=SPANS[n]
        uc.reg_write(UC_X86_REG_RSP,STACK+0x8000)
        uc.reg_write(UC_X86_REG_MXCSR,0x1f80)
        uc.emu_start(BASE+start,BASE+end,timeout=100000,count=64)
        assert uc.reg_read(UC_X86_REG_RIP)==BASE+end,n
        counts[n]+=1
    def weapon(b,p,c,charged):
        uc.reg_write(UC_X86_REG_R14,DEF);uc.reg_write(UC_X86_REG_RSI,PROJ)
        uc.reg_write(UC_X86_REG_R13,int(charged));xmm(7,ONE)
        setf(DEF+0x3f8,c);setf(DEF+0x404,p)
        run('weapon_damage_factor');w=op(c if charged else ONE,p,'mul')
        assert getf(PROJ+0xc24)==w
        setf(PROJ+0xc28,ONE);setf(PROJ+0x3fc,b)
        run('projectile_base_product');d=op(op(ONE,w,'mul'),b,'mul')
        assert getx(4)==d
        return d
    def timing(r,c,s,now,w):
        uc.reg_write(UC_X86_REG_RSI,DEF);xmm(10,s);setf(DEF+0x3ec,r)
        run('cooldown_duration');cd=op(op(ONE,s,'div'),r,'mul');assert getx(6)==cd
        uc.reg_write(UC_X86_REG_R14,DEF);xmm(7,s);setf(DEF+0x3f0,c)
        run('charge_duration');ch=op(c,s,'div');assert getx(6)==ch
        uc.reg_write(UC_X86_REG_RSI,DEF);xmm(0,s)
        run('charge_time_api');api=op(op(c,r,'add'),s,'div');assert getx(0)==api
        uc.reg_write(UC_X86_REG_RSI,DEF);xmm(6,cd);xmm(7,now);xmm(8,w)
        run('next_fire_deadline');due=op(op(cd,now,'add'),w,'add');assert getf(DEF+0x10c)==due
        setf(DEF+0x104,bits(.6));setf(DEF+0x108,bits(.8));setf(DEF+0x3fc,ONE);xmm(6,cd)
        run('action_durations');assert getx(1)==op(cd,bits(.6),'mul') and getx(2)==op(cd,bits(.8),'mul')
        return {'cooldown':value(cd),'charge':value(ch),'api':value(api),'sum_of_durations':value(op(cd,ch,'add'))}
    names={'Bow':('Bow/BP_BowInstance','Bow/BP_BowArrow'),
           'Shortbow':('Shortbow/BP_ShortbowInstance','Shortbow/BP_ShortBow_Arrow'),
           'Longbow':('LongBow/BP_LongbowInstance','LongBow/BP_LongBowArrow'),
           'Powerbow':('PowerBow/BP_PowerBowInstance','Bow/BP_BowArrow'),
           'HeavyCrossbow':('HeavyCrossbow/BP_HeavyCrossbowInstance','HeavyCrossbow/BP_HeavyCrossbow_Arrow')}
    examples={}
    for name,(wp,ar) in names.items():
        p=next(x for x in raw if x['path'].endswith(wp));a=next(x for x in raw if x['path'].endswith(ar))
        leaves={x['path']:x['value'] for x in p['leaves']}
        # These defaults are proven in b19370, not generic absence->zero rules.
        r=bits(leaves.get('AttackDefintion.AttackRateSeconds',1))
        c=bits(leaves.get('AttackDefintion.ChargeTimeSecond',0))
        m=bits(leaves.get('AttackDefintion.ChargeDamageMultiplier',1))
        factor=bits(leaves.get('AttackDefintion.ProjectileDamageFactor',1))
        b=bits(next(x['value'] for x in a['leaves'] if x['path']=='damage'))
        d0=weapon(b,factor,m,False);d1=weapon(b,factor,m,True)
        examples[name]={'uncharged':value(d0),'uncharged_bits':hex(d0),
                        'charged':value(d1) if c else None,'charged_bits':hex(d1) if c else None,
                        'S1_w0_timing_fixture':timing(r,c,ONE,0,0)}
    rng=random.Random(217219)
    for i in range(512):
        b,p,c=[bits(rng.uniform(.125,200)) for _ in range(3)]
        weapon(b,p,c,i%2)
        r,c,s=map(bits,[rng.uniform(.01,2),rng.uniform(.01,2),rng.uniform(.1,8)])
        timing(r,c,s,bits(rng.uniform(0,100000)),bits(rng.uniform(0,.4)))
        # Explicit captured attributes; no simulated aggregation or tag resolution.
        args=[bits(rng.uniform(.1,10)) for _ in range(4)]
        uc.reg_write(UC_X86_REG_RBP,RBPMEM)
        setf(RBPMEM+0x67,args[0]);setf(RBPMEM+0x77,args[2]);setf(RBPMEM+0x7f,args[3]);xmm(6,args[1])
        run('captured_ranged_product')
        assert getx(7)==op(op(op(args[0],args[1],'mul'),args[2],'mul'),args[3],'mul')
    for now in [.4199999,.42,.4200001,.5]:
        for action in [.25,.42,.6]:
            uc.reg_write(UC_X86_REG_RBX,DEF);uc.mem_write(DEF+0x140,struct.pack('<Q',OWNER))
            setf(DEF+0x10c,bits(.42));setf(OWNER+0xa78,bits(action));xmm(6,bits(now))
            run('weapon_and_owner_gate')
            assert (uc.reg_read(UC_X86_REG_RAX)&255)==int(value(bits(now))>=value(bits(.42)) and value(bits(now))>=value(bits(action)))
    for now in [0,.34999999,.35,.35000001,1]:
        uc.reg_write(UC_X86_REG_RDI,PROJ);uc.reg_write(UC_X86_REG_R15,OWNER)
        uc.mem_write(PROJ+8,struct.pack('<d',.35));uc.mem_write(OWNER+0x140,struct.pack('<d',now))
        uc.emu_start(BASE+0x2322a65,BASE+0x2322a79,timeout=100000,count=3)
        assert uc.reg_read(UC_X86_REG_RIP)==BASE+(0x2322d76 if .35>=now else 0x2322a79)
        counts['timer_expiry_comparison']+=1
    result={'status':'passed','scope':'synthetic instruction fragments only; no game, Windows, CRT, loaded UFunction, or live state',
            'mapped_image_sha256':hashlib.sha256(im).hexdigest(),'mxcsr':'0x1f80',
            'raw_packages':len(raw),'raw_files':sum(len(x['sources']) for x in raw),
            'pointer_checks':len(pointers),'descriptor_checks':len(descriptors),'instruction_checks':len(instructions),
            'replay_counts':counts,'total_replays':sum(counts.values()),'examples':examples,
            'spans':{n:{'start':hex(a),'end_exclusive':hex(b),'sha256':hashlib.sha256(im[a:b]).hexdigest(),
                        'instructions':[f'{x.address:x} {x.mnemonic} {x.op_str}' for x in cs.disasm(im[a:b],a)]} for n,(a,b) in SPANS.items()},
            'limits':{'live_state':'unknown','exact_CRT_output':'unverified','same_build_raw_exe':'unverified',
                      'real_shot_interval':'requires input/tick/state parameters; no fixed FPS assumed',
                      'runtime_promotion':False}}
    (OUT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['spans','examples']},indent=2))
    print(json.dumps(examples,indent=2))

if __name__=='__main__':main()
