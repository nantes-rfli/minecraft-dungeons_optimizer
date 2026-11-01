import sys,struct,re,hashlib,bisect,json
from pathlib import Path
ROOT=Path('/Users/nanto/Development/minecraft-dungeons_optimizer/local-game-data')
sys.path.insert(0,str(ROOT/'phase6.8/native-stage2/tools'))
import capstone
cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64);cs.detail=True
im=(ROOT/'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes()
assert hashlib.sha256(im).hexdigest()=='04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
BASE=0x140000000
pe=struct.unpack_from('<I',im,0x3c)[0]; opt=pe+24
pr,sz=struct.unpack_from('<II',im,opt+112+3*8)
funcs=[struct.unpack_from('<III',im,x) for x in range(pr,pr+sz,12)]
starts=[x[0] for x in funcs]
def fn(a):
 i=bisect.bisect_right(starts,a)-1
 return funcs[i] if i>=0 and a<funcs[i][1] else (a,a+96,0)
def dis(a,n=None):
 if n is None:a,end,_=fn(a);n=end-a
 print('FUNCTION',hex(a),hex(a+n), 'sha256',hashlib.sha256(im[a:a+n]).hexdigest())
 for x in cs.disasm(im[a:a+n],a):
  s=f'{x.address:08x} {x.mnemonic:9} {x.op_str}'
  for op in x.operands:
   if op.type==capstone.CS_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
    t=x.address+x.size+op.mem.disp;s+=f' ; RVA {t:x}'
    if 0<=t<len(im)-8:s+=f' f32={struct.unpack_from("<f",im,t)[0]} ptr={struct.unpack_from("<Q",im,t)[0]-BASE:x}'
  print(s)
def refs(target):
 # instruction-shaped RIP-relative xrefs, validate with disassembly, then show containing unwind span
 out=[]
 for m in re.finditer(rb'[\x40-\x4f]?[\x8d\x8b\x89]\x05|[\x40-\x4f]?[\x8d\x8b\x89]\x0d|[\x40-\x4f]?[\x8d\x8b\x89]\x15|[\x40-\x4f]?[\x8d\x8b\x89]\x1d|[\x40-\x4f]?[\x8d\x8b\x89]\x25|[\x40-\x4f]?[\x8d\x8b\x89]\x2d|[\x40-\x4f]?[\x8d\x8b\x89]\x35|[\x40-\x4f]?[\x8d\x8b\x89]\x3d',im[0x1000:0x3094000]):
  a=m.start()+0x1000;e=m.end()+0x1000
  if e+4+struct.unpack_from('<i',im,e)[0]==target:
   out.append((hex(a),tuple(hex(x) for x in fn(a)),next(cs.disasm(im[a:a+16],a)).op_str))
 return out
def ptrs(target):return [hex(m.start()) for m in re.finditer(re.escape(struct.pack('<Q',BASE+target)),im)]
def strings(pattern):
 for enc,regex in [('ascii',rb'[ -~]{5,}'),('utf16',rb'(?:[ -~]\x00){5,}')]:
  for m in re.finditer(regex,im[0x3094000:0x4189000]):
   s=m.group().decode('utf-16le' if enc=='utf16' else 'ascii')
   if re.search(pattern,s,re.I):print(hex(0x3094000+m.start()),enc,s[:220])
if __name__=='__main__':
 cmd=sys.argv[1]
 if cmd=='strings':strings(sys.argv[2])
 if cmd=='dis':dis(int(sys.argv[2],16),int(sys.argv[3],16) if len(sys.argv)>3 else None)
 if cmd=='refs':print(json.dumps(refs(int(sys.argv[2],16)),indent=2))
 if cmd=='ptrs':print(ptrs(int(sys.argv[2],16)))
