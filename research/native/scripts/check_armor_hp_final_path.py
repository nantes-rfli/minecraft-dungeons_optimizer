#!/usr/bin/env python3
"""Build-pinned Armor HP static checks and bounded, isolated aggregation replay.

No game startup, CRT, engine objects, promotion, or exact final-HP prediction.
Replay's synthetic modifier records explicitly supply already-qualified flags.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import random
import struct
import sys
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[3]
REPORT = ROOT / 'research/native/armor-hp-final-path.json'
CAPTURE = 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a'
BASE = 0x140000000
SPANS = {
    'owner-interface-lookup': (0x3b2450, 0x6f),
    'base-character-constructor-head': (0x794ad0, 0x44),
    'base-character-ability-creation': (0x794f25, 0x53),
    'player-class-registration': (0xf5de30, 0xa2),
    'player-constructor-thunk': (0xf5fa50, 0x14),
    'player-constructor-head': (0x7e1110, 0x73),
    'ability-class-registration': (0xed3670, 0xa2),
    'dungeons-ability-constructor': (0xed4870, 0x5e),
    'ability-interface-return': (0x7b9f50, 8),
    'apply-spec-to-self': (0x362ce0, 0x912),
    'active-effect-apply': (0x3a8180, 0x10cc),
    'calculate-modifier-magnitudes': (0x3abce0, 0xad),
    'active-effect-added': (0x3b9740, 0x2e7),
    'inhibition-transition': (0x3aca10, 0x113),
    'add-active-modifiers-prefix': (0x3a6950, 0x207),
    'stack-magnitude': (0x3d2510, 0x33),
    'find-or-create-attribute-aggregator': (0x3b1250, 0x35f),
    'add-aggregator-modifier': (0x3d1130, 0xa2),
    'aggregator-dirty': (0x3d1c00, 0x1cf),
    'dirty-delegate': (0x382e20, 0x7c),
    'dirty-evaluate-and-write': (0x3bdb40, 0x197),
    'aggregator-evaluate': (0x3d2c60, 0x7e),
    'qualify-channel-records': (0x3d2d80, 0x23d),
    'evaluate-channels': (0x3d31e0, 0x223),
    'evaluate-single-channel': (0x3d30e0, 0xf6),
    'write-current-and-notify': (0x3ba190, 0x1c2),
    'component-current-setter': (0x38f150, 0x4a),
    'attribute-numeric-setter': (0x3c9bd0, 0x101),
    'health-reflection-construct': (0xf05200, 0x2f),
    'class-property-construction-loop': (0x1237e97, 0x32),
    'property-kind-switch': (0x1238747, 0x3f),
    'float-property-construction-case': (0x1238e64, 0xab),
    'property-offset-constructor': (0x1202c50, 0x60),
    'float-property-registration': (0x1228750, 0xa2),
    'float-property-constructor': (0x121c9a0, 0x30),
    'float-property-writer': (0x1230d60, 0xc),
    'health-component-registration': (0xf0a980, 0xa2),
    'health-component-constructor-thunk': (0xf0c120, 0xd),
    'health-component-constructor': (0x97cd40, 0x261),
    'health-component-initialization': (0x98ee00, 0xf0),
    'component-base-setter': (0x38f0f0, 0x5f),
    'container-base-setter': (0x3c9560, 0x143),
    'aggregator-base-setter': (0x3d92d0, 0xf),
    'health-pre-base-change': (0x7cea90, 0x54),
    'health-pre-current-change': (0x7cebc0, 0x228),
    'custom-calculation-dispatch': (0x4083f0, 0xb2),
    'calculation-fname-init': (0xffb20, 0x19),
    'calculation-native-registration': (0x40a030, 0x22),
    'native-name-exec-registration': (0x11338a0, 0x1d2),
    'process-event': (0x12443e0, 0x39c),
    'ufunction-native-invoke': (0x1130c30, 0x9b),
    'calculate-base-magnitude-exec': (0x40acc0, 0xcf),
    'health-effect-duration-prefix': (0x7a1430, 0x5f),
}
CALLS = {
    0xaea616: 0x3b2450, 0x794f42: 0xed3670,
    0x794f62: 0x1207580, 0xed4884: 0x356cd0,
    0x7e1150: 0x794ad0, 0x3630b5: 0x3a8180,
    0x3a8b05: 0x3ac060, 0x3a8b0f: 0x3abce0,
    0x3abd54: 0x3a9c70, 0x3a9f6d: 0x4083f0,
    0x3a9208: 0x3b9740, 0x3b99de: 0x3aca10,
    0x3aca79: 0x3a6950, 0x3a6a6c: 0x3d2510,
    0x3a6aa8: 0x3b1250, 0x3a6b20: 0x3d1130,
    0x3d11cd: 0x3d1c00, 0x382e74: 0x3bdb40,
    0x3bdc27: 0x3d2c60, 0x3d2cd9: 0x3d31e0,
    0x3d33bf: 0x3d30e0, 0x3bdc5d: 0x3ba190,
    0x3ba1da: 0x38f150, 0x38f17e: 0x3c9bd0,
    0x98eea1: 0x7c45b0, 0x98eeb4: 0x38f0f0,
    0x38f133: 0x3c9560, 0x3c9645: 0x3d92d0,
    0x3c9684: 0x3ba190, 0x40844d: 0x123c6e0,
    0x12446c0: 0x1130c30, 0x40a04d: 0x11338a0,
    0xf0521e: 0x1237d80, 0x1237ebd: 0x12386f0,
    0x1238e91: 0x1228750, 0x1238ef0: 0x1202c50,
}
INS = {
    0x363aff: ('call', 'qword ptr [r10 + 0x590]'),
    0x794f67: ('mov', 'qword ptr [rsi + 0x8b0], rax'),
    0x7b9f50: ('mov', 'rax, qword ptr [rcx + 0x168]'),
    0x3abd5d: ('mov', 'dword ptr [r14], ebp'),
    0x3a6a60: ('movzx', 'r8d, byte ptr [rdx + rdi + 0x20]'),
    0x3a6af3: ('movzx', 'r8d, byte ptr [rsi + 0x20]'),
    0x3d115b: ('shl', 'rdi, 4'),
    0x3d11a8: ('movss', 'dword ptr [rcx + rdx*8 + 0x10], xmm6'),
    0x3b130c: ('movss', 'dword ptr [rax + 0x4c], xmm6'),
    0x3d252a: ('subss', 'xmm1, xmm2'),
    0x3d253a: ('mulss', 'xmm0, xmm1'),
    0x3d253e: ('addss', 'xmm0, xmm2'),
    0x3d3100: ('cmp', 'byte ptr [r8 + 0x21], 0'),
    0x3d3136: ('addss', 'xmm0, dword ptr [rdx + 0x10]'),
    0x3d316a: ('addss', 'xmm3, dword ptr [rdx + 0x10]'),
    0x3d316f: ('subss', 'xmm3, xmm4'),
    0x3d319a: ('addss', 'xmm2, dword ptr [rdx + 0x10]'),
    0x3d319f: ('subss', 'xmm2, xmm4'),
    0x3d31c2: ('addss', 'xmm0, xmm5'),
    0x3d31c6: ('mulss', 'xmm0, xmm3'),
    0x3d31ca: ('divss', 'xmm0, xmm2'),
    0x3d31cf: ('movss', 'xmm0, dword ptr [r8 + 0x10]'),
    0x97cd8d: ('mov', 'qword ptr [rbx + 0x100], 0x43fa0000'),
    0x98eea9: ('movss', 'xmm2, dword ptr [rdi + 0x100]'),
    0x3c95a9: ('call', 'qword ptr [rax + 0x258]'),
    0x3c9c32: ('call', 'qword ptr [rax + 0x250]'),
    0x3c9c49: ('call', 'qword ptr [rax + 0x350]'),
    0x3c9c46: ('cvtps2pd', 'xmm2, xmm2'),
    0x1230d63: ('cvtsd2ss', 'xmm0, xmm2'),
    0x1230d67: ('movss', 'dword ptr [rdx], xmm0'),
    0x1238763: ('mov', 'eax, dword ptr [r13 + 0x18]'),
    0x1238767: ('and', 'eax, 0x1f'),
    0x123877a: ('mov', 'ecx, dword ptr [rdx + rax*4 + 0x123a0f4]'),
    0x1238ec9: ('mov', 'edi, dword ptr [r13 + 0x24]'),
    0x1202c81: ('mov', 'dword ptr [rdi + 0x44], ebx'),
    0x40845d: ('call', 'qword ptr [rbx + 0x200]'),
    0x1130ca3: ('call', 'qword ptr [rbp + 0xc0]'),
    0x40ad57: ('call', 'qword ptr [rax + 0x240]'),
    0x7a148b: ('mov', 'byte ptr [rsi + 0x30], 1'),
}
POINTERS = {
    0x33f5530 + 0x590: 0x362ce0,
    0x31b6378 + 0x10: 0x7b9f50,
    0x31d32f0 + 0x10: 0x7b9f50,
    0x3443720 + 0x200: 0x12443e0,
    0x3443720 + 0x240: 0x7b0300,
    0x342f8c0 + 0x250: 0x7cebc0,
    0x342f8c0 + 0x258: 0x7cea90,
    0x322dd30 + 0x2f8: 0x98ee00,
    0x30f9760: 0x30f7bd0, 0x30f9768: 0x40acc0,
    0x351fa80 + 0x350: 0x1230d60,
    0x342c8a8: 0x342c7d0, 0x342c858: 0x42234c8,
    0x42234c8: 0x30e5f98,
}
LEAS = {0xed4889: 0x33f5530, 0x3b13a7: 0x382e20,
        0xffb26: 0x30f7ba0, 0xffb2d: 0x44758e8,
        0x40a03f: 0x30f9760, 0x97cd67: 0x322dd30,
        0xf5de64: 0xea7df0, 0x7e1175: 0x31d32f0,
        0xf05210: 0x342c880, 0x1238773: 0,
        0x1238ef5: 0x351fa80, 0x121c9b9: 0x351fa80,
        0x122878f: 0x351ddc2, 0x12287b3: 0x121c9a0}
LIMITS = {
    'liveEquippedObjectState': 'not-observed',
    'effectiveBaseInArbitrarySession': 'unknown',
    'windowsCrtOutputBits': 'unverified',
    'liveMxcsr': 'unknown',
    'rawNativeSameBuild': 'unverified',
    'officialBuildProvenance': 'unverified',
    'exactItemPowerFromDisplayInteger': 'not-unique',
    'adoptionDecision': 'not-submitted',
}

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(b):
    return hashlib.sha256(b).hexdigest()

def public_check(report):
    require(report['baselineCommit'] == 'e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a', 'baseline drift')
    require(report['status'] == 'held-research-only', 'research status drift')
    require(report['runtimePromotion'] is False and report['newCalculableEquipment'] == [], 'no support/promotion permitted')
    require(report['applicationImpact'] is False and report['limits'] == LIMITS, 'scope/limits drift')
    old = json.loads((ROOT/'research/native/armor-hp-connection.json').read_text())
    for k in ['binarySha256', 'recoveredImageSha256']:
        require(report[k] == old[k], 'input identity drift')
    require([(s['label'], int(s['rva'],16), s['size']) for s in report['nativeSpans']] ==
            [(label,a,n) for label,(a,n) in SPANS.items()], 'span coverage drift')
    raw = ROOT/'research/raw/game-data-raw-structural-inventory'
    meta = report['playerRaw']
    compressed = (raw/meta['shard']).read_bytes()
    require(sha(compressed) == meta['compressedSha256'], 'player Raw shard drift')
    require(meta['packageIndex'] == 63 and meta['abilityExportIndex'] == 214 and
            meta['healthTemplateExportIndex'] == 270, 'player export selection drift')
    package = json.loads(gzip.decompress(compressed))['packages'][meta['packageIndex']]
    require(package['path'] == meta['packagePath'], 'player package drift')
    require(package['sourceFiles'] == meta['sourceFiles'], 'player source identity drift')
    require(package['inheritanceChains'][0]['hops'][0]['targetObject'] == '/Script/Dungeons.PlayerCharacter', 'player superclass drift')
    cdo = package['cdoPropertyInventory'][0]
    prop = next(p for p in cdo['properties'] if p['path']=='AbilitySystem')
    require(prop['decoding']['value']['index'] == 214, 'player ability link drift')
    for index,name,cls in [(214,'AbilitySystemComponent','DungeonsAbilitySystemComponent'),(270,'HealthComponent_GEN_VARIABLE','HealthComponent')]:
        e=package['exports'][index]
        require(e['objectName']['value']==name and e['references']['class']['objectName']==cls, 'component class drift')
        require(e['serialized']['serialSize']==12, 'component payload changed')
    return package

def private_check(local, report, package):
    sys.path.insert(0,str(local/'phase6.8/native-stage2/tools'))
    import capstone
    require(capstone.__version__ == '5.0.6', 'require Capstone 5.0.6')
    im=(local/CAPTURE/'mapped-image.bin').read_bytes()
    require(sha(im)==report['recoveredImageSha256'], 'image hash mismatch')
    exe=local/'archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe'
    require(sha(exe.read_bytes())==report['binarySha256'], 'exe hash mismatch')
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64);md.detail=True
    for s in report['nativeSpans']:
        a=int(s['rva'],16)
        require(sha(im[a:a+s['size']])==s['sha256'], 'span mismatch '+s['label'])
    for a,(mn,op) in INS.items():
        i=next(md.disasm(im[a:a+15],a))
        require((i.mnemonic,i.op_str)==(mn,op), 'instruction mismatch '+hex(a))
    for a,target in CALLS.items():
        i=next(md.disasm(im[a:a+15],a))
        require(i.mnemonic in ('call','jmp') and i.operands[0].type==capstone.CS_OP_IMM and i.operands[0].imm==target,'call mismatch '+hex(a))
    for a,target in POINTERS.items():
        require(struct.unpack_from('<Q',im,a)[0]==BASE+target,'pointer mismatch '+hex(a))
    for a,target in LEAS.items():
        i=next(md.disasm(im[a:a+15],a))
        require(i.mnemonic=='lea' and i.operands[1].mem.base==capstone.x86.X86_REG_RIP and a+i.size+i.disp==target,'lea mismatch '+hex(a))
    for a,word in [(0x30f7ba0,'CalculateBaseMagnitude'),(0x3432d02,'HealthComponent'),(0x347f56a,'PlayerCharacter'),(0x351ddc2,'FloatProperty')]:
        data=(word+'\0').encode('utf-16le');require(im[a:a+len(data)]==data,'name mismatch')
    require(im[0x30f7bd0:0x30f7bd0+23]==b'CalculateBaseMagnitude\0', 'exec name mismatch')
    require(struct.unpack_from('<4f',im,0x30de8c8)==(0.,1.,1.,0.), 'operation bias drift')
    require(struct.unpack_from('<I',im,0x30d9390)[0]==0x322bcc77,'division tolerance drift')
    require(im[0x30e5f98:0x30e5fa2]==b'MaxHealth\0', 'MaxHealth name drift')
    require(struct.unpack_from('<I',im,0x42234c8+0x18)[0]&0x1f==10, 'MaxHealth property kind drift')
    require(struct.unpack_from('<I',im,0x42234c8+0x24)[0]==0x38, 'MaxHealth property offset drift')
    require(struct.unpack_from('<I',im,0x123a0f4+10*4)[0]==0x1238e64, 'FloatProperty switch target drift')
    for table,names in [(0x30f8580,['Additive','Multiplicitive','Division','Override']), (0x30f50f8,['Instant','Infinite','HasDuration'])]:
        for v,name in enumerate(names):
            ptr,value=struct.unpack_from('<Qq',im,table+16*v);a=ptr-BASE
            got=im[a:im.index(0,a)].decode('ascii')
            require(value==v and got.endswith('::'+name), 'enum table mismatch')
    source=local/'QuickBMS 1.17.0.0'
    for f in package['sourceFiles']:
        require(sha((source/f['path']).read_bytes())==f['sha256'],'Raw source hash mismatch')
    asset=(source/(package['path']+'.uasset')).read_bytes()
    # Port of the repository reader for this pinned Name Map only.
    require(struct.unpack_from('<Ii',asset)==(0x9e2a83c1,-7), 'unsupported package header')
    c=24+20*struct.unpack_from('<i',asset,20)[0]+4
    n=struct.unpack_from('<i',asset,c)[0];c+=4+(n if n>=0 else -2*n)+4
    count,off=struct.unpack_from('<ii',asset,c);names=[];q=off
    require(count==1380 and off==193,'Name Map layout drift')
    for _ in range(count):
        n=struct.unpack_from('<i',asset,q)[0];q+=4;size=n if n>=0 else -2*n
        names.append(asset[q:q+size].decode('utf-8' if n>=0 else 'utf-16le').rstrip('\0'));q+=size+4
    require(names[1015]=='None','terminator FName drift')
    for index in (214,270):
        s=package['exports'][index]['serialized']['sourceRange']
        b=(source/s['file']).read_bytes()[s['start']:s['end']]
        require(struct.unpack('<III',b)==(1015,0,0),'component serialized override observed')
    return im

# Exact-rational binary32 model for finite checks, round-to-nearest/ties-even.
def rational(bits):
    x=struct.unpack('<f',struct.pack('<I',bits))[0]
    return Fraction(x)

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
    require(e<=127,'test oracle overflow')
    return sign|((e+127)<<23)|(q-(1<<23))

def op(a,b,kind):
    a,b=rational(a),rational(b)
    return rounded({'add':lambda:a+b,'sub':lambda:a-b,'mul':lambda:a*b,'div':lambda:a/b}[kind]())

def channel_model(base,groups):
    for bits,qualified in groups[3]:
        if qualified:return bits
    a=0;m=d=0x3f800000
    for bits,q in groups[0]:
        if q:a=op(a,bits,'add')
    for j in (1,2):
        total=0x3f800000
        for bits,q in groups[j]:
            if q:total=op(op(total,bits,'add'),0x3f800000,'sub')
        if j==1:m=total
        else:d=total
    if abs(rational(d))<=rational(0x322bcc77):d=0x3f800000
    return op(op(op(a,base,'add'),m,'mul'),d,'div')

def replay(im):
    import unicorn
    from unicorn import x86_const as r
    require(unicorn.__version__=='2.1.4','require Unicorn 2.1.4')
    u=unicorn.Uc(unicorn.UC_ARCH_X86,unicorn.UC_MODE_64)
    for page in (0x3d2000,0x3d3000,0x30de000,0x3cc0000,0x30c7000,0x30d9000):
        u.mem_map(BASE+page,0x1000);u.mem_write(BASE+page,im[page:page+0x1000])
    data=0x60000000;stack=0x70000000;stop=0x71000000
    u.mem_map(data,0x10000);u.mem_map(stack,0x10000);u.mem_map(stop,0x1000)
    def run(start):
        u.reg_write(r.UC_X86_REG_RSP,stack+0x8008);u.mem_write(stack+0x8008,struct.pack('<Q',stop))
        u.reg_write(r.UC_X86_REG_MXCSR,0x1f80)
        u.emu_start(BASE+start,stop,count=10000) # one synchronous call, never timeout/resume
        require(u.reg_read(r.UC_X86_REG_RIP)==stop,'instruction budget / unexpected return')
        return u.reg_read(r.UC_X86_REG_XMM0)&0xffffffff
    rng=random.Random(218);rows=[]
    def bits(f):return struct.unpack('<I',struct.pack('<f',f))[0]
    magnitudes=[0x3f800000,0x3f800001,0x3f800003,0x3fffffff,0x40000001,0x4b000001]
    magnitudes += [bits(rng.uniform(.1,100000)) for _ in range(200)]
    for m in magnitudes:
        for count in (-1,0,1,2,7):
            for kind,bias in [(0,0),(1,0x3f800000),(2,0x3f800000),(3,0)]:
                u.reg_write(r.UC_X86_REG_XMM0,m);u.reg_write(r.UC_X86_REG_EDX,count&0xffffffff);u.reg_write(r.UC_X86_REG_R8D,kind)
                got=run(0x3d2510)
                want=m if kind==3 else op(op(bits(max(count,0)),op(m,bias,'sub'),'mul'),bias,'add')
                require(got==want,'stack mismatch')
                rows.append(['stack',m,count,kind,got])
    cases=[]
    for m in magnitudes:cases.append((bits(500),[[],[(m,True)],[],[]]))
    cases.extend([
        (bits(500),[[],[],[],[]]),
        (bits(500),[[],[(bits(2),True),(bits(3),True)],[],[]]),
        (bits(500),[[(bits(100),True)],[(bits(3),False)],[],[]]),
        (bits(500),[[],[],[(bits(0),True)],[]]),
        (bits(500),[[],[(bits(7),True)],[],[(bits(41),False),(bits(42),True),(bits(43),True)]]),
    ])
    for _ in range(250):
        groups=[[(bits(rng.uniform(.1,4) if j in [1,2] else rng.uniform(1,100)),rng.choice([True,False])) for k in range(rng.randrange(4))] for j in range(4)]
        cases.append((bits(rng.uniform(100,2000)),groups))
    differences=[]
    for b,groups in cases:
        u.mem_write(data,bytes(0x4000))
        for j,group in enumerate(groups):
            ptr=data+0x1000+j*0x400
            u.mem_write(data+j*16,struct.pack('<Qii',ptr,len(group),len(group)))
            for k,(m,q) in enumerate(group):
                u.mem_write(ptr+k*0x28+0x10,struct.pack('<I',m));u.mem_write(ptr+k*0x28+0x21,bytes([q]))
        u.reg_write(r.UC_X86_REG_RCX,data);u.reg_write(r.UC_X86_REG_XMM1,b)
        got=run(0x3d30e0);want=channel_model(b,groups)
        require(got==want,'channel mismatch')
        rows.append(['channel',b,groups,got])
        if not groups[0] and len(groups[1])==1 and groups[1][0][1] and not groups[2] and not groups[3]:
            simple=op(b,groups[1][0][0],'mul')
            if got!=simple:differences.append({'baseBits':hex(b),'magnitudeBits':hex(groups[1][0][0]),'nativeBits':hex(got),'simplifiedMultiplyBits':hex(simple)})
    return {'scope':'isolated leaf functions; synthetic prequalified modifier records; no CRT or game objects',
            'mxcsr':'0x1f80','stackCases':len(magnitudes)*20,'channelCases':len(cases),'mismatches':0,
            'caseDigestSha256':sha(json.dumps(rows,separators=(',',':')).encode()),
            'roundingCounterexamples':differences[:8]}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--local-root',type=Path)
    p.add_argument('--replay',action='store_true');p.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
    p.add_argument('--output',type=Path);args=p.parse_args()
    report=json.loads(REPORT.read_text());package=public_check(report)
    result={'publicChecks':'passed','privateChecks':'not-run','nativeReplay':'not-run',
            'recoveredImageSha256':report['recoveredImageSha256'],
            'checkerSha256':sha(Path(__file__).read_bytes())}
    if args.replay:
        require(args.local_root is not None and args.output is not None,'replay requires --local-root and --output')
        from native_watchdog import supervise
        cmd=[sys.executable,'-B',str(Path(__file__).resolve()),'--worker','--local-root',str(args.local_root),'--output',str(args.output)]
        record=supervise(cmd,45)
        args.output.with_suffix('.watchdog.json').write_text(json.dumps(record,indent=2)+'\n')
        require(record['status']=='exited' and record['cleanupComplete'],'watchdog failed; no resume')
        print(json.dumps(record));return
    if args.local_root:
        im=private_check(args.local_root,report,package);result['privateChecks']='passed'
    if args.worker:
        require(args.local_root is not None, 'worker requires --local-root')
        result['nativeReplay']=replay(im)
    if args.output:args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__':main()
