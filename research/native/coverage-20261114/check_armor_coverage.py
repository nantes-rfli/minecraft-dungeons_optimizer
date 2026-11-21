"""Verify pinned, bounded Armor research. No effect/game call is stubbed successful.

python3 check_armor_coverage.py --local-root /path/to/local-game-data --replay
"""
import argparse, hashlib, json, math, pathlib, random, struct, sys
BASE=0x140000000
HERE=pathlib.Path(__file__).resolve().parent

def sha(b): return hashlib.sha256(b).hexdigest()
def f32(x): return struct.unpack('<f',struct.pack('<f',x))[0]
def model_miss(seed,chance):
    n=(seed*0x0bb38435+0x3619636b)&0xffffffff
    return n, (n&0x7fffff)/2**23 < chance

def validate(d,root):
    assert d['newRuntimeEligibleCount']==0 and d['status']=='research-only-partial'
    assert d['evidenceLevels']['gameObservation']=='none'
    im=(root/d['imageRelativePath']).read_bytes();assert sha(im)==d['imageSha256']
    for s in d['nativeSpans']: assert sha(im[int(s['startRva'],16):int(s['endRvaExclusive'],16)])==s['sha256'],s['role']
    for x in d['pointerAssertions']: assert struct.unpack_from('<Q',im,int(x['rva'],16))[0]==BASE+int(x['targetRva'],16)
    for x in d['callAssertions']:
        a=int(x['rva'],16);assert im[a]==0xe8 and a+5+struct.unpack_from('<i',im,a+1)[0]==int(x['targetRva'],16)
    for x in d['rawSources']:
        b=(root/x['path']).read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256']
        if 'valueRange' in x:
            q=x['valueRange'];assert b[q['start']:q['end']].hex()==q['hex']
    return im

def replay(im,root):
    sys.path.insert(0,str(root/'phase6.8/native-stage2/tools'))
    import unicorn
    from unicorn import x86_const as r
    u=unicorn.Uc(unicorn.UC_ARCH_X86,unicorn.UC_MODE_64)
    for page in [0x940000,0xb50000,0xaf1000,0x3113000,0x30c7000]:
        u.mem_map(BASE+page,0x1000);u.mem_write(BASE+page,im[page:page+0x1000])
    DATA=0x70000000;STACK=0x71000000
    u.mem_map(DATA,0x10000);u.mem_map(STACK,0x10000)
    counts={'missChanceCases':0,'ammoConversionCases':0,'recursionFlagCases':0};out=[]
    def run(start,stop,count=100):
        u.reg_write(r.UC_X86_REG_MXCSR,0x1f80)
        u.emu_start(BASE+start,BASE+stop,count=count)
        assert u.reg_read(r.UC_X86_REG_RIP)==BASE+stop
    rnd=random.Random(20261114)
    seeds=[0,1,0xffffffff,0x80000000]+[rnd.getrandbits(32) for _ in range(256)]
    # Derive seeds whose NEXT lower 23 bits sit at threshold edges.
    inv=pow(0x0bb38435,-1,2**32)
    seeds += [((n-0x3619636b)*inv)&0xffffffff for n in [0,1,2516581,2516582,2516583,8388606,8388607]]
    for chance in [0.0,f32(.2),f32(.3),1.0]:
        for seed in seeds:
            obj=DATA;state=DATA+0x1000;flag=DATA+0x2000;bp=STACK+0x8000
            u.mem_write(obj+0x128,struct.pack('<f',chance));u.mem_write(state+4,struct.pack('<I',seed));u.mem_write(flag,b'\0')
            u.mem_write(bp+0x77,struct.pack('<Q',state))
            for reg,val in [(r.UC_X86_REG_RBX,obj),(r.UC_X86_REG_RDI,flag),(r.UC_X86_REG_RBP,bp),(r.UC_X86_REG_RSP,STACK+0x7000)]:u.reg_write(reg,val)
            expect,hit=model_miss(seed,chance)
            # Branch destinations delimit the slice; stop before any external call.
            run(0x940895,0x9408dd if hit else 0x94099e)
            actual=struct.unpack('<I',u.mem_read(state+4,4))[0]
            assert actual==expect and u.mem_read(flag,1)==bytes([hit])
            counts['missChanceCases']+=1
            if seed in seeds[-7:] and chance==f32(.3):out.append({'seed':seed,'chanceBits':'3e99999a','nextState':actual,'cancel':hit})
    # Fourth argument true prevents delegate emission after the pre-existing refresh.
    for flag in [0,1,2,255]:
        u.reg_write(r.UC_X86_REG_R14,flag);u.reg_write(r.UC_X86_REG_RDI,DATA)
        run(0xb5099e,0xb509b1 if not flag else 0xb50b10)
        counts['recursionFlagCases']+=1
    # AF13E0's history conversion is a separate slice, not a whole ammo grant.
    for numerator in [1,10,20,40,53,100]:
      for denominator in [1,10,20,40,53,100]:
       for amount in [0,1,5,10,19,99]:
        obj=DATA;records=DATA+0x3000
        u.mem_write(obj+0x2a0,struct.pack('<i',1));u.mem_write(obj+0x298,struct.pack('<Q',records))
        u.mem_write(obj+0x27c,struct.pack('<i',numerator));u.mem_write(obj+0x280,struct.pack('<i',denominator));u.mem_write(records+0x2a0,struct.pack('<i',7))
        u.reg_write(r.UC_X86_REG_RBX,obj);u.reg_write(r.UC_X86_REG_RSI,amount)
        value=f32(f32(f32(f32(numerator)/f32(denominator))*f32(amount))*f32(2))
        expect=7+(round(f32(value-f32(.5)))>>1)
        run(0xaf142b,0xaf147f)
        assert struct.unpack('<i',u.mem_read(records+0x2a0,4))[0]==expect
        counts['ammoConversionCases']+=1
    return {'mode':'isolated native instruction slices; synthetic explicit state; no game observation','mxcsr':'0x1f80','unicornVersion':unicorn.__version__,'cases':counts,'mismatches':0,'thresholdControls':out,'limitations':['eligibility helper not executed','RNG origin unknown','no full component dispatch','no full ammo grant','no gameplay oracle']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--local-root',type=pathlib.Path,required=True);p.add_argument('--manifest',type=pathlib.Path,default=HERE/'armor-evidence.json');p.add_argument('--replay',action='store_true');p.add_argument('--output',type=pathlib.Path);a=p.parse_args()
    d=json.loads(a.manifest.read_text());im=validate(d,a.local_root)
    result={'status':'passed','manifestSha256':sha(a.manifest.read_bytes()),'checkerSha256':sha(pathlib.Path(__file__).read_bytes()),'nativeSpans':len(d['nativeSpans']),'rawFiles':len(d['rawSources'])}
    if a.replay:result['replay']=replay(im,a.local_root)
    if a.output:a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
