#!/usr/bin/env python3
"""Conditional Native replay of Artifact callback/arithmetic slices, not gameplay."""
import argparse, hashlib, json, random, struct, sys
from fractions import Fraction
from pathlib import Path
BASE=0x140000000
HASH='04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
def bits(x):return struct.unpack('<I',struct.pack('<f',x))[0]
def value(x):return struct.unpack('<f',struct.pack('<I',x))[0]
def rounded(x):
 if not x:return 0
 sign=0x80000000 if x<0 else 0;x=abs(x);e=x.numerator.bit_length()-x.denominator.bit_length()
 if x<Fraction(2)**e:e-=1
 unit=Fraction(2)**max(e-23,-149);s=x/unit;q,r=divmod(s.numerator,s.denominator)
 if 2*r>s.denominator or (2*r==s.denominator and q&1):q+=1
 if e<-126:return sign|q
 if q==1<<24:q>>=1;e+=1
 assert e<=127
 return sign|((e+127)<<23)|(q-(1<<23))
def op(a,b,k):
 a,b=Fraction(value(a)),Fraction(value(b));return rounded({'add':lambda:a+b,'sub':lambda:a-b,'mul':lambda:a*b,'div':lambda:a/b}[k]())
def duration_scalar(x):
 q=op(op(x,bits(1),'sub'),0x4127b7b8,'div');a=op(bits(18),0x3e1c9c9c,'mul');t=op(q,a,'mul');t=0 if value(t)<0 else t
 return op(op(t,bits(.25),'mul'),bits(1),'add')
def main():
 p=argparse.ArgumentParser();p.add_argument('--local-root',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.local_root)
 im=(root/'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes();assert hashlib.sha256(im).hexdigest()==HASH
 sys.path.insert(0,str(root/'phase6.8/native-stage2/tools'));import unicorn as uc;from unicorn import x86_const as r
 assert uc.__version__=='2.1.4';u=uc.Uc(uc.UC_ARCH_X86,uc.UC_MODE_64);u.mem_map(BASE,(len(im)+4095)&~4095);u.mem_write(BASE,im)
 DATA,STACK,STOP=0x60000000,0x70000000,0x71000000
 for x,n in ((DATA,0x10000),(STACK,0x10000),(STOP,0x1000)):u.mem_map(x,n)
 def w(a,x):u.mem_write(a,struct.pack('<I',x))
 def q(a,x):u.mem_write(a,struct.pack('<Q',x))
 def rr(n):return u.reg_read(getattr(r,'UC_X86_REG_'+n))
 def reg(n,x):u.reg_write(getattr(r,'UC_X86_REG_'+n),x)
 def xf(n,x):reg('XMM'+str(n),x)
 def xg(n=0):return rr('XMM'+str(n))&0xffffffff
 def run(start,end=STOP):
  reg('MXCSR',0x1f80);reg('RSP',STACK+0x8008);q(STACK+0x8008,STOP);u.emu_start(BASE+start,end if end==STOP else BASE+end,count=5000)
  assert rr('RIP')==(end if end==STOP else BASE+end),hex(rr('RIP'))
 # Synthetic object shape required by observed native constructor callback binding.
 # No engine calls, allocator return, Power arithmetic or math result is stubbed.
 q(DATA+0x68,DATA+0x200);q(DATA+0x200,BASE+0x3290fe0);q(DATA+0x208,BASE+0xb8a5f0)
 rng=random.Random(1171411);xs=[bits(x) for x in [-5,0,.5,1,1.000001,2,5,10.899999618530273,10.90000057220459,27.3,33,40,100]]
 xs += [bits(rng.uniform(-10,100)) for _ in range(300)]
 counts={'callbackScalar':0,'bootsDurationMultiplication':0,'statusDurationSuffix':0,'cooldownProductAndOverride':0,'typeBuilderDurationTransport':0}
 examples=[]
 for xb in xs:
  reg('RCX',DATA);xf(0,bits(-777));xf(1,xb);run(0xb903e0);scalar=xg();assert scalar==duration_scalar(xb),(hex(xb),hex(scalar),hex(duration_scalar(xb)));counts['callbackScalar']+=1
  # Exact native Boots suffix, with explicitly supplied itemtype duration field.
  q(BASE+0x44ae780,DATA+0x400);w(DATA+0x400+0x9c,bits(1.5));xf(0,scalar);run(0xae5ff1,0xae6007);d=xg(2);assert d==op(bits(1.5),scalar,'mul');counts['bootsDurationMultiplication']+=1
  for mul in (.5,1,1.25,2):
   reg('RBP',DATA+0x800);w(DATA+0x877,bits(mul));xf(7,d);run(0x7b0ca2,0x7b0cab);assert xg(6)==op(bits(mul),d,'mul');counts['statusDurationSuffix']+=1
  if xb in xs[:13]:examples.append(dict(internalPowerBits=f'{xb:08x}',internalPower=value(xb),durationScalarBits=f'{scalar:08x}',bootsBaseDurationSeconds=1.5,setByCallerDurationBits=f'{d:08x}',setByCallerDurationSeconds=value(d)))
 for base in (0,1,5,15,25,30,45):
  for mult in (0,.25,.5,1,1.2,2):
   for override in (-1,0,.5,1,3,5,15,60):
    xf(0,bits(base));xf(7,bits(mult));xf(6,bits(override));xf(8,bits(0));run(0xaecc56,0xaecc73)
    product=op(bits(base),bits(mult),'mul');expected=bits(override) if 0<override<value(product) else product
    assert xg()==expected,(base,mult,override,xg(),expected);counts['cooldownProductAndOverride']+=1
 # Builder .ac -> stack .78 -> callee frame .d8 -> ItemType .9c; .a8 similarly .98.
 # Only explicit dataflow slices execute, not object creation or registry insertion.
 for duration,cooldown in ((1.5,5),(8,25),(8,30),(3,15),(0,0)):
  reg('RBX',DATA+0x1000);w(DATA+0x10ac,bits(duration));w(DATA+0x10a8,bits(cooldown));run(0xb6500d,0xb65029)
  sp=rr('RSP');reg('RBP',sp-0x60);reg('RBX',DATA+0x2000)
  # run resets RSP only; RBP already models 8-byte return + 7 pushes + lea rbp,[rsp-0x20].
  run(0xb1b5ab,0xb1b5cb)
  assert struct.unpack('<I',u.mem_read(DATA+0x2098,4))[0]==bits(cooldown)
  assert struct.unpack('<I',u.mem_read(DATA+0x209c,4))[0]==bits(duration)
  counts['typeBuilderDurationTransport']+=1
 result=dict(schemaVersion=1,imageSha256=HASH,environment=dict(engine='Unicorn 2.1.4',mxcsr='0x1f80',instructionLimitPerSlice=5000),conditionalReplay=counts,totalComparisons=sum(counts.values()),mismatches=0,examples=examples,actualGameplay=None,independentValidation=None,limits=['Synthetic bound callback object and ItemType fields; no UE object initialization, Blueprint loading or actual game execution.','Function b903e0 executes complete native callback, normalization and DurationIncrease with no arithmetic stub.','Caller multiplication, status suffix, type-field transport and cooldown suffix are separate slices; not one continuous activation.','Status capture magnitudes and cooldown attributes explicitly supplied; unknown runtime state is not zero/defaulted.','Comparison oracle uses exact-rational binary32 RN-even; independent game oracle absent.'])
 Path(a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'comparisons':sum(counts.values()),'mismatches':0,'output':a.output}))
if __name__=='__main__':main()
