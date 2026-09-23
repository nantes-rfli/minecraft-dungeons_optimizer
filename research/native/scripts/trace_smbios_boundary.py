#!/usr/bin/env python3
"""Run bounded SMBIOS counterfactuals; raw traces stay under ignored local-game-data."""
import pathlib,sys,struct,json,collections,time,hashlib,os
repoRoot=pathlib.Path(__file__).resolve().parents[3]
localData=pathlib.Path(os.environ.get('MCD_LOCAL_GAME_DATA_ROOT',repoRoot/'local-game-data')).resolve()
w=localData/'phase6.8'/'native-stage2';sys.path.insert(0,str(w/'tools'))
import unicorn as un
from unicorn.x86_const import *
from capstone import Cs,CS_ARCH_X86,CS_MODE_64
p=w.parents[1]/'archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe';data=p.read_bytes();pe=struct.unpack_from('<I',data,60)[0];opt=pe+24;base=struct.unpack_from('<Q',data,opt+24)[0];imageSize=struct.unpack_from('<I',data,opt+56)[0];sect=opt+struct.unpack_from('<H',data,pe+20)[0];stage=(w.parent/'mechanics/stage1.bin').read_bytes()
expectedExe='eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8'
expectedStage='d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b'
if hashlib.sha256(data).hexdigest()!=expectedExe: raise SystemExit('unexpected executable SHA-256')
if hashlib.sha256(stage).hexdigest()!=expectedStage: raise SystemExit('unexpected Stage 1 SHA-256')
u=un.Uc(un.UC_ARCH_X86,un.UC_MODE_64);u.mem_map(base,(imageSize+4095)&~4095);u.mem_write(base,data[:1536]);sections=[]
for i in range(struct.unpack_from('<H',data,pe+6)[0]):
 at=sect+40*i;vs,rva,rs,ro=struct.unpack_from('<IIII',data,at+8);name=data[at:at+8].rstrip(b'\0').decode();sections.append({'index':i,'name':name,'rva':rva,'virtualSize':vs})
 if rs:u.mem_write(base+rva,data[ro:ro+rs])
 if name=='.dungeon':u.mem_write(base+rva,stage)
stack=0x70000000;stacksize=0x400000;u.mem_map(stack,stacksize);u.reg_write(UC_X86_REG_RSP,stack+stacksize-0x1000);u.mem_write(stack+stacksize-0x1000,struct.pack('<Q',0xdead0000));u.reg_write(UC_X86_REG_EFLAGS,0x202)
mode=sys.argv[1] if len(sys.argv)>1 else 'firmware-success-size'
profiles=['firmware-success-size','firmware-zero-size','firmware-alt-size','firmware-data-generic','firmware-registry-failure','firmware-registry-success','firmware-registry-first-failure']
if mode not in profiles: raise SystemExit('choose one of: '+', '.join(profiles))
outdir=w/'firmware-experiments'/mode
outdir.mkdir(parents=True,exist_ok=True)
if True:
 teb=0x71000000;peb=0x71010000;u.mem_map(teb,0x20000);u.reg_write(UC_X86_REG_GS_BASE,teb);u.mem_write(teb+0x30,struct.pack('<Q',teb));u.mem_write(teb+0x60,struct.pack('<Q',peb));u.mem_write(peb+0x10,struct.pack('<Q',base))

import re
# Build export-only synthetic modules from Wine symbol lists. No DLL code is loaded.
guestDirectory='C:'+chr(92)+'ResearchGame';virtualNext=0xa0000000;virtualAllocations={};heapNext=0x80000000;allocations={};exceptionHandlers=[];vehProbe=[];u.mem_map(0x72000000,0x1000);commandLine=chr(34)+chr(92).join(['C:','ResearchGame','Dungeons','Binaries','Win64','Dungeons-Win64-Shipping.exe'])+chr(34);u.mem_write(0x72000000,(commandLine+'\0').encode('ascii'));modules={};symbols={};stubmap={};stub=0x78000000;u.mem_map(stub,0x100000);u.mem_write(stub,b'\xc3'*0x100000)
for idx,lib in enumerate(['kernel32','user32','ntdll','advapi32','shell32','shlwapi']):
 names=[]
 for line in (w/(lib+'.spec')).read_text().splitlines():
  if line.startswith('#') or '-i386' in line or '-noname' in line:continue
  m=re.search(r'\b(?:stdcall|cdecl|varargs)\b.*?\b([A-Za-z_][A-Za-z_0-9]*)\(',line)
  if m:names.append(m[1])
 names=sorted(set(names));mb=0x73000000+idx*0x100000;modules[lib+'.dll']=mb;h=bytearray(0x80000);h[:2]=b'MZ';struct.pack_into('<I',h,0x3c,0x80);h[0x80:0x84]=b'PE\0\0';struct.pack_into('<H',h,0x98,0x20b);struct.pack_into('<II',h,0x108,0x400,0x100)
 struct.pack_into('<IIIIII',h,0x410,1,len(names),len(names),0x1000,0x4000,0x7000);pos=0x10000
 for j,name in enumerate(names):
  target=stub+len(stubmap)*16;stubmap[target]=(lib+'.dll',name);symbols[(mb,name)]=target;struct.pack_into('<I',h,0x1000+j*4,target-mb);struct.pack_into('<I',h,0x4000+j*4,pos);struct.pack_into('<H',h,0x7000+j*2,j);raw=name.encode()+b'\0';h[pos:pos+len(raw)]=raw;pos+=len(raw)
 u.mem_map(mb,len(h));u.mem_write(mb,bytes(h))
for imp in json.loads((w/'imports.json').read_text()):
 if imp['dll'].lower() in modules and (modules[imp['dll'].lower()],imp['function']) in symbols:u.mem_write(base+imp['iatRva'],struct.pack('<Q',symbols[(modules[imp['dll'].lower()],imp['function'])]))
u.mem_protect(stub,0x100000,un.UC_PROT_READ|un.UC_PROT_EXEC)
initialSections={s['index']:hashlib.sha256(bytes(u.mem_read(base+s['rva'],s['virtualSize']))).hexdigest() for s in sections if s['virtualSize']}
smbiosReads=[];registryOpenCalls=0
postContextBlocks=[];contextReads=[];contextProbeStarted=False
registerCheckpoints=[]
cs=Cs(CS_ARCH_X86,CS_MODE_64);blocks=collections.Counter();tail=collections.deque(maxlen=25);events=[];writes=collections.Counter();reason=None;count=0;start=time.monotonic();timers=0;lastblock=None;hooked=set()
def stop(s):
 global reason
 reason=s;u.emu_stop()
def cstring(addr,wide=False):
 raw=bytes(u.mem_read(addr,512))
 if wide:
  end=next(i for i in range(0,len(raw)-1,2) if raw[i:i+2]==b'\0\0');return raw[:end].decode('utf-16le')
 return raw.split(b'\0')[0].decode('ascii')
def ret(value):
 sp=u.reg_read(UC_X86_REG_RSP);target=struct.unpack('<Q',u.mem_read(sp,8))[0];u.reg_write(UC_X86_REG_RAX,value);u.reg_write(UC_X86_REG_RSP,sp+8);u.reg_write(UC_X86_REG_RIP,target)
def api(u,addr,size,_):
 global heapNext,guestDirectory,virtualNext,contextProbeStarted,registryOpenCalls
 if addr not in stubmap:stop('unknown synthetic stub');return
 lib,fn=stubmap[addr];regs=[u.reg_read(x) for x in [UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9]];event={'dll':lib,'name':fn,'args':[hex(x) for x in regs]};events.append(event)
 spAtEntry=u.reg_read(UC_X86_REG_RSP)
 if spAtEntry and fn not in []:
  event['returnAddress']=hex(struct.unpack('<Q',u.mem_read(spAtEntry,8))[0])
  event['returnRva']=hex(struct.unpack('<Q',u.mem_read(spAtEntry,8))[0]-base)
 if fn in ['LoadLibraryA','LoadLibraryW','GetModuleHandleA','GetModuleHandleW']:
  name=cstring(regs[0],fn.endswith('W')).lower() if regs[0] else None;event['moduleName']=name
  if name is None and fn.startswith('GetModuleHandle'):ret(base)
  elif name in modules:ret(modules[name])
  else:stop('unmodeled module '+str(name))
 elif fn=='GetProcAddress':
  name=cstring(regs[1]) if regs[1]>=65536 else '#'+str(regs[1]);event['symbol']=name;target=symbols.get((regs[0],name))
  if target:ret(target)
  else:stop('symbol outside synthetic exports: '+name)
 elif fn=='GetCurrentThreadId':
  event['modeledReturn']=0x1234;ret(0x1234)
 elif fn=='GetCurrentProcessId':
  event['modeledReturn']=0x5678;ret(0x5678)
 elif fn=='OpenThread' and regs[2]==0x1234:
  event['modeledReturn']=0x900001;ret(0x900001)
 elif fn=='CloseHandle' and regs[0] in [0x900001,0x930000]:ret(1)
 elif fn=='GetUserDefaultUILanguage':
  event['modeledReturn']=0x409;ret(0x409)
 elif fn=='GetProcessHeap':
  event['modeledReturn']=0x910000;ret(0x910000)
 elif fn=='RtlFreeHeap' and regs[0]==0x910000 and regs[2] in allocations:
  ptr=regs[2];length=allocations.pop(ptr);pages=(max(length,1)+4095)&~4095;u.mem_unmap(ptr,pages);event['freedPointer']=hex(ptr);event['freedBytes']=length;ret(1)
 elif fn in ['HeapAlloc','RtlAllocateHeap'] and regs[0]==0x910000:
  length=regs[2];pages=(max(length,1)+4095)&~4095
  if heapNext+pages>0xa0000000:stop('virtual heap budget');return
  ptr=heapNext;heapNext+=pages;u.mem_map(ptr,pages);allocations[ptr]=length
  if not regs[1]&8:u.mem_write(ptr,b'\xcc'*pages)
  event['modeledReturn']=hex(ptr);event['allocationBytes']=length;ret(ptr)
 elif fn=='GetCurrentDirectoryW':
  path=guestDirectory;raw=(path+'\0').encode('utf-16le');event['modeledPath']=path
  if regs[0]<len(path)+1:ret(len(path)+1)
  else:u.mem_write(regs[1],raw);ret(len(path))
 elif fn=='GetModuleFileNameW' and regs[0]==0:
  path=chr(92).join(['C:','ResearchGame','Dungeons','Binaries','Win64','Dungeons-Win64-Shipping.exe']);event['modeledPath']=path
  if regs[2]<=len(path):stop('module path buffer too small');return
  u.mem_write(regs[1],(path+'\0').encode('utf-16le'));ret(len(path))
 elif fn=='SetCurrentDirectoryW':
  path=cstring(regs[0],True);event['requestedPath']=path
  if path in ['C:'+chr(92)+'ResearchGame',chr(92).join(['C:','ResearchGame','Dungeons','Binaries','Win64'])]:guestDirectory=path;ret(1)
  else:stop('unmodeled virtual directory: '+path)
 elif fn=='GetCommandLineA':
  event['modeledCommandLine']=commandLine;ret(0x72000000)
 elif fn in ['RtlAddVectoredExceptionHandler','AddVectoredExceptionHandler']:
  exceptionHandlers.append({'first':regs[0],'handler':hex(regs[1])});event['modeledRegistrationOnly']=True;ret(0x920000+len(exceptionHandlers))
 elif fn=='GetVersion':
  event['modeledReturn']=(19045<<16)|10;ret((19045<<16)|10)
 elif fn=='VirtualProtect':
  address,length,protection,oldPointer=regs;mapping={1:0,2:1,4:3,0x10:4,0x20:5,0x40:7}
  if protection not in mapping or length<=0 or length>imageSize:stop('unmodeled protection request');return
  first=address&~4095;end=(address+length+4095)&~4095;region=next((r for r in u.mem_regions() if r[0]<=address<=r[1]),None)
  if region is None:stop('protection outside mapped memory');return
  previous=next((k for k,v in mapping.items() if v==region[2]),None)
  if previous is None:stop('unmodeled previous protection');return
  u.mem_write(oldPointer,struct.pack('<I',previous));u.mem_protect(first,end-first,mapping[protection]);event['modeledOldProtection']=previous;event['syntheticSymbol']=stubmap.get(address);ret(1)
 elif fn in ['IsBadWritePtr','IsBadReadPtr']:
  pointer,length=regs[:2];permission=un.UC_PROT_WRITE if fn=='IsBadWritePtr' else un.UC_PROT_READ
  if length>imageSize:stop('pointer probe budget');return
  regions=list(u.mem_regions());valid=all(any(lo<=p<=hi and perms&permission for lo,hi,perms in regions) for p in range(pointer&~4095,(pointer+length+4095)&~4095,4096));event['modeledReturn']=int(not valid);ret(int(not valid))
 elif fn in ['ZwSetInformationThread','NtSetInformationThread'] and regs==[0xfffffffffffffffe,0x11,0,0]:
  event['modeledThreadAttributeOnly']='ThreadHideFromDebugger';event['modeledReturn']=0;ret(0)
 elif fn=='RaiseException' and regs==[0xc000008e,0,0,0]:
  global pendingContext,recordBefore
  er=0x72010000;cr=er+0x200;ep=er+0x900;u.mem_map(er,0x2000);record=bytearray(0xa0);struct.pack_into('<IIQQI',record,0,regs[0],regs[1],0,addr,0);u.mem_write(er,bytes(record));ctx=bytearray(0x4d0);struct.pack_into('<I',ctx,0x30,0x10001f)
  sp=u.reg_read(UC_X86_REG_RSP);resume=struct.unpack('<Q',u.mem_read(sp,8))[0];pendingContext=u.context_save()
  for offset,reg in contextRegs.items():struct.pack_into('<Q',ctx,offset,u.reg_read(reg))
  struct.pack_into('<Q',ctx,0x98,sp+8);struct.pack_into('<Q',ctx,0xf8,resume);struct.pack_into('<I',ctx,0x44,u.reg_read(UC_X86_REG_EFLAGS));recordBefore=bytes(ctx);u.mem_write(cr,recordBefore);u.mem_write(ep,struct.pack('<QQ',er,cr));handler=int(exceptionHandlers[-1]['handler'],16);event['handlerProbe']=hex(handler)
  handlerStack=((sp-0x300)&~15)+8;u.mem_write(handlerStack,struct.pack('<Q',handlerReturn));u.reg_write(UC_X86_REG_RCX,ep);u.reg_write(UC_X86_REG_RSP,handlerStack);u.reg_write(UC_X86_REG_RIP,handler)
 elif fn in ['RtlRemoveVectoredExceptionHandler','RemoveVectoredExceptionHandler'] and regs[0]==0x920000+len(exceptionHandlers):
  event['removedHandler']=exceptionHandlers.pop();ret(1)
 elif fn=='GetCurrentThread':ret(0xfffffffffffffffe)
 elif fn=='OpenThreadToken' and regs[:3]==[0xfffffffffffffffe,8,1]:
  event['modeledCondition']='no impersonation token';u.mem_write(teb+0x68,struct.pack('<I',1008));ret(0)
 elif fn=='GetCurrentProcess':ret(0xffffffffffffffff)
 elif fn=='OpenProcessToken' and regs[:2]==[0xffffffffffffffff,8]:
  event['modeledToken']='synthetic primary token, query access';u.mem_write(regs[2],struct.pack('<Q',0x930000));ret(1)
 elif fn=='GetTokenInformation' and regs[:2]==[0x930000,2]:
  sp=u.reg_read(UC_X86_REG_RSP);lengthPointer=struct.unpack('<Q',u.mem_read(sp+0x28,8))[0];groupDefs=[(1,[0]),(5,[32,545]),(5,[11])];sids=[bytes([1,len(sub)])+authority.to_bytes(6,'big')+b''.join(struct.pack('<I',x) for x in sub) for authority,sub in groupDefs];needed=8+16*len(sids)+sum(map(len,sids));u.mem_write(lengthPointer,struct.pack('<I',needed));event['modeledGroups']=['Everyone','Builtin Users','Authenticated Users'];event['requiredBytes']=needed
  if not regs[2] or regs[3]<needed:u.mem_write(teb+0x68,struct.pack('<I',122));ret(0)
  else:
   buffer=bytearray(needed);struct.pack_into('<I',buffer,0,len(sids));offset=8+16*len(sids)
   for j,sid in enumerate(sids):struct.pack_into('<QI',buffer,8+j*16,regs[2]+offset,7);buffer[offset:offset+len(sid)]=sid;offset+=len(sid)
   u.mem_write(regs[2],bytes(buffer));ret(1)
 elif fn=='VirtualAlloc' and regs[0]==0 and regs[2] in [0x1000,0x3000] and regs[3] in [2,4,0x20,0x40]:
  length=regs[1];pages=(max(length,1)+4095)&~4095
  if virtualNext+pages>0xc0000000:stop('virtual allocation budget');return
  ptr=virtualNext;virtualNext=(ptr+pages+65535)&~65535;u.mem_map(ptr,pages,{2:1,4:3,0x20:5,0x40:7}[regs[3]]);virtualAllocations[ptr]=pages;event['modeledReturn']=hex(ptr);event['allocationBytes']=length;ret(ptr)
 elif fn=='AllocateAndInitializeSid' and 0<=regs[1]<=8:
  sp=u.reg_read(UC_X86_REG_RSP);outPointer=struct.unpack('<Q',u.mem_read(sp+0x58,8))[0];sub=[regs[2]&0xffffffff,regs[3]&0xffffffff]+[struct.unpack('<I',u.mem_read(sp+0x28+j*8,4))[0] for j in range(6)];authority=bytes(u.mem_read(regs[0],6));sid=bytes([1,regs[1]])+authority+b''.join(struct.pack('<I',x) for x in sub[:regs[1]]);ptr=heapNext;heapNext+=4096;u.mem_map(ptr,4096);u.mem_write(ptr,sid);u.mem_write(outPointer,struct.pack('<Q',ptr));allocations[ptr]=len(sid);event['sid']='S-1-'+str(int.from_bytes(authority,'big'))+''.join('-'+str(x) for x in sub[:regs[1]]);ret(1)
 elif fn in ['EqualSid','RtlEqualSid']:
  def sidBytes(ptr):return bytes(u.mem_read(ptr,8+4*u.mem_read(ptr+1,1)[0]))
  ret(int(sidBytes(regs[0])==sidBytes(regs[1])))
 elif fn=='FreeSid' and regs[0] in allocations:
  u.mem_unmap(regs[0],4096);del allocations[regs[0]];ret(0)
 elif fn=='VirtualFree' and regs[0] in virtualAllocations and regs[1:3]==[0,0x8000]:
  u.mem_unmap(regs[0],virtualAllocations.pop(regs[0]));ret(1)
 elif fn=='IsUserAnAdmin':
  event['modeledCondition']='standard user, non-admin';ret(0)
 elif fn=='GetForegroundWindow':
  event['modeledCondition']='no foreground window in synthetic session';ret(0)
 elif fn=='GetWindowTextA' and regs[0]==0:
  if regs[2]:u.mem_write(regs[1],b'\0')
  u.mem_write(teb+0x68,struct.pack('<I',1400));event['modeledCondition']='invalid/null synthetic window';ret(0)
 elif fn=='SetLastError':
  u.mem_write(teb+0x68,struct.pack('<I',regs[0]&0xffffffff));ret(0)
 elif fn=='GetLastError':ret(struct.unpack('<I',u.mem_read(teb+0x68,4))[0])
 elif fn in ['NtQueryInformationProcess','ZwQueryInformationProcess'] and regs[0]==0xffffffffffffffff and regs[1]==7 and regs[3]==8:
  sp=u.reg_read(UC_X86_REG_RSP);lengthPointer=struct.unpack('<Q',u.mem_read(sp+0x28,8))[0]
  u.mem_write(regs[2],struct.pack('<Q',0))
  if lengthPointer:u.mem_write(lengthPointer,struct.pack('<I',8))
  event['modeledCondition']='ProcessDebugPort zero in synthetic process';ret(0)
 elif fn in ['NtQueryInformationProcess','ZwQueryInformationProcess'] and regs[0]==0xffffffffffffffff and regs[1]==0x1e and regs[3]==8:
  sp=u.reg_read(UC_X86_REG_RSP);lengthPointer=struct.unpack('<Q',u.mem_read(sp+0x28,8))[0];event['returnLengthPointer']=hex(lengthPointer)
  if lengthPointer:stop('unmodeled failure return-length behavior');return
  u.mem_write(regs[2],struct.pack('<Q',0));event['modeledCondition']='hypothesis: no debug object, STATUS_PORT_NOT_SET';ret(0xc0000353)
 elif fn=='CheckRemoteDebuggerPresent' and regs[0]==0xffffffffffffffff:
  event['modeledCondition']='synthetic process has no attached debugger';u.mem_write(regs[1],struct.pack('<I',0));ret(1)
 elif fn=='IsDebuggerPresent':
  event['modeledCondition']='synthetic process has no attached debugger';ret(0)
 elif fn=='GetThreadContext':
  event['requestedContextFlags']=hex(struct.unpack('<I',u.mem_read(regs[1]+0x30,4))[0])
  if mode=='stop-context':stop('current-thread context boundary')
  elif regs[0]!=0xfffffffffffffffe or event['requestedContextFlags']!='0x100010':stop('context probe outside narrow scope')
  else:
   event['counterfactualProfile']=mode;contextProbeStarted=True
   u.hook_add(un.UC_HOOK_MEM_READ,lambda u,access,address,size,value,_:contextReads.append({'offset':hex(address-regs[1]),'size':size,'rip':hex(u.reg_read(UC_X86_REG_RIP))}) if len(contextReads)<100 else None,begin=regs[1]+0x48,end=regs[1]+0x77)
   u.hook_add(un.UC_HOOK_BLOCK,lambda u,address,size,_:postContextBlocks.append(hex(address)) if len(postContextBlocks)<1000 else None)
   if mode=='failed-context':u.mem_write(teb+0x68,struct.pack('<I',87));ret(0)
   else:
    u.mem_write(regs[1]+0x48,b'\0'*48)
    if mode=='marker-debug':u.mem_write(regs[1]+0x48,struct.pack('<Q',0x12345678))
    ret(1)
 elif fn=='GetSystemFirmwareTable' and regs[0]==0x52534d42 and regs[1]==0:
  event['provider']='RSMB';event['tableId']=0
  if regs[2]==0 and regs[3]==0:
   modeledSize={'firmware-success-size':4096,'firmware-zero-size':0,'firmware-alt-size':1024,'firmware-data-generic':4096,'firmware-registry-failure':4096,'firmware-registry-success':4096,'firmware-registry-first-failure':4096}[mode]
   event['counterfactualModel']=mode;event['modeledReturn']=modeledSize
   ret(modeledSize)
  elif mode in ['firmware-data-generic','firmware-registry-failure','firmware-registry-success','firmware-registry-first-failure'] and regs[2] and regs[3]>0:
   import hashlib
   n=min(regs[3],0x10000);buf=bytearray(n)
   smbios=bytearray()
   system=bytearray(0x1b);system[0]=1;system[1]=0x1b;system[2:4]=b'\x00\x00';system[4:9]=bytes([1,2,3,4,6]);system[9:25]=bytes(range(16));system[25:27]=bytes([5,6])
   smbios.extend(system);smbios.extend(b'CodexTest\0MCDSynthetic\0RevA\0SerialX\0SKU\0Family\0\0')
   smbios.extend(bytes([127,4,0,0,0]))
   buf[:8]=bytes([0,3,2,0])+struct.pack('<I',len(smbios))
   buf[8:8+len(smbios)]=smbios;u.mem_write(regs[2],bytes(buf))
   event['counterfactualModel']=mode;event['syntheticSmbiosBytes']=n;event['syntheticSmbiosSha256']=hashlib.sha256(bytes(buf)).hexdigest()
   def smbios_read(emu,access,address,size,value,_):
    if len(smbiosReads)<1000:smbiosReads.append({'offset':hex(address-regs[2]),'size':size,'rip':hex(emu.reg_read(UC_X86_REG_RIP))})
   u.hook_add(un.UC_HOOK_MEM_READ,smbios_read,begin=regs[2],end=regs[2]+n-1)
   event['modeledReturn']=min(regs[3],len(smbios));ret(min(regs[3],len(smbios)))
  else:
   event['stopAt']='SMBIOS buffer-fill call without local data model'
   stop('SMBIOS buffer-fill boundary');return
 elif fn=='RegOpenKeyA' and regs[0]==0x80000002:
  registryOpenCalls+=1
  event['requestedPath']=cstring(regs[1]);event['accessMask']=hex(regs[3])
  if mode not in ['firmware-registry-failure','firmware-registry-success','firmware-registry-first-failure']:stop('unmodeled API: RegOpenKeyA');return
  event['counterfactualModel']=mode
  if mode=='firmware-registry-first-failure' and registryOpenCalls>1:stop('unmodeled API: RegOpenKeyA');return
  if mode in ['firmware-registry-failure','firmware-registry-first-failure']:event['modeledStatus']='ERROR_FILE_NOT_FOUND';ret(2)
  elif mode=='firmware-registry-success':u.mem_write(regs[2],struct.pack('<Q',0x940000));event['modeledStatus']='ERROR_SUCCESS';event['syntheticHandle']='0x940000';ret(0)
  else:stop('unmodeled API: RegOpenKeyA');return
 else:stop('unmodeled API: '+fn)
def environment(u,addr,size,_):
 global timers
 raw=bytes(u.mem_read(addr,size));ins=next(cs.disasm(raw,addr));
 if ins.mnemonic=='rdtsc':
  timers+=1;value=0x100000+timers*100000;events.append({'instruction':'rdtsc','address':hex(addr),'value':value});u.reg_write(UC_X86_REG_RAX,value);u.reg_write(UC_X86_REG_RDX,0);u.reg_write(UC_X86_REG_RIP,addr+size)
 else:stop('unmodeled instruction: '+ins.mnemonic)
def block(u,addr,size,_):
 global count,lastblock
 count+=1;lastblock=addr;
 if count==120000:
  u.hook_del(block_handle)
  print('switching to bounded fast trace',events[:2],flush=True)
 blocks[addr]+=1;tail.append(hex(addr))
 if count>=15000000 or time.monotonic()-start>40:stop('bounded trace budget')
checkpointAddresses={
 base+rva:hex(rva) for rva in [
  0x50d0fe9,0x50d115d,0x50d1349,0x50d1496,
  0x4ebd3c1,0x4ebd71a,0x4ebdde7,0x4eb176a,0x4eff202,
  0x4e9934f,0x4e99355,0x4e9935b,0x4e9938c,
 ]
}
checkpointRegisters={
 'rax':UC_X86_REG_RAX,'rbx':UC_X86_REG_RBX,'rcx':UC_X86_REG_RCX,
 'rdx':UC_X86_REG_RDX,'rsp':UC_X86_REG_RSP,'rbp':UC_X86_REG_RBP,
 'rsi':UC_X86_REG_RSI,'rdi':UC_X86_REG_RDI,'r8':UC_X86_REG_R8,
 'r9':UC_X86_REG_R9,'r10':UC_X86_REG_R10,'r11':UC_X86_REG_R11,
 'r12':UC_X86_REG_R12,'r13':UC_X86_REG_R13,'r14':UC_X86_REG_R14,
 'r15':UC_X86_REG_R15,'eflags':UC_X86_REG_EFLAGS,
}
def checkpoint(u,addr,size,_):
 if addr not in checkpointAddresses or len(registerCheckpoints)>=256:return
 snapshot={
  'rva':checkpointAddresses[addr],
  'eventCount':len(events),
  'registers':{name:hex(u.reg_read(reg)) for name,reg in checkpointRegisters.items()},
 }
 if addr in {base+0x4ebdde7,base+0x4eb176a,base+0x4eff202}:
  pointer=u.reg_read(UC_X86_REG_RAX)
  snapshot['indirectPointer']=hex(pointer)
  try:snapshot['indirectTarget']=hex(struct.unpack('<Q',u.mem_read(pointer,8))[0])
  except un.UcError:snapshot['indirectTarget']='unreadable'
 registerCheckpoints.append(snapshot)
def invalid(u,access,addr,size,value,_):stop({'invalidMemory':hex(addr),'access':access,'rip':hex(u.reg_read(UC_X86_REG_RIP))});return False
def wr(u,access,addr,size,value,_):
 if not stack<=addr<stack+stacksize:writes[addr&~4095]+=1

contextRegs={offset:reg for offset,reg in zip(range(0x78,0x100,8),[UC_X86_REG_RAX,UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_RBX,UC_X86_REG_RSP,UC_X86_REG_RBP,UC_X86_REG_RSI,UC_X86_REG_RDI,UC_X86_REG_R8,UC_X86_REG_R9,UC_X86_REG_R10,UC_X86_REG_R11,UC_X86_REG_R12,UC_X86_REG_R13,UC_X86_REG_R14,UC_X86_REG_R15,UC_X86_REG_RIP])}
handlerReturn=0x79000000;u.mem_map(handlerReturn,0x1000);u.mem_write(handlerReturn,b'\xc3')
def handler_result(u,addr,size,_):
 result=u.reg_read(UC_X86_REG_RAX)&0xffffffff;ctx=bytes(u.mem_read(0x72010200,0x4d0));changed=[i for i,(a,b) in enumerate(zip(recordBefore,ctx)) if a!=b];vehProbe.append({'returnValue':hex(result),'changedContextBytes':changed})
 if result==0xffffffff and not changed:
  u.context_restore(pendingContext);ret(0)
 else:stop('exception handling beyond verified narrow model')
u.hook_add(un.UC_HOOK_CODE,handler_result,begin=handlerReturn,end=handlerReturn)

u.hook_add(un.UC_HOOK_CODE,lambda u,addr,size,_:stop({'originalRegionEntry':hex(addr)}),begin=base,end=base+0x4bb8000-1)
u.hook_add(un.UC_HOOK_CODE,environment,begin=0x144d0434b,end=0x144d0434b)
for address in checkpointAddresses:
 u.hook_add(un.UC_HOOK_CODE,checkpoint,begin=address,end=address)
u.hook_add(un.UC_HOOK_INSN,lambda u,_: (stop('cpuid boundary'),True)[1],None,1,0,UC_X86_INS_CPUID)
u.hook_add(un.UC_HOOK_INSN,lambda u,_: stop('syscall boundary'),None,1,0,UC_X86_INS_SYSCALL)
block_handle=u.hook_add(un.UC_HOOK_BLOCK,block);u.hook_add(un.UC_HOOK_CODE,api,begin=stub,end=stub+0xfffff);u.hook_add(un.UC_HOOK_MEM_WRITE,wr,begin=stub,end=stub+0xfffff);u.hook_add(un.UC_HOOK_MEM_INVALID,invalid);u.hook_add(un.UC_HOOK_MEM_WRITE,wr,begin=base,end=base+imageSize-1);u.hook_add(un.UC_HOOK_INTR,lambda u,n,_:stop('interrupt '+str(n)))
try:u.emu_start(base+0x4bb8000+0x2c495f,0,timeout=40000000,count=500000000)
except un.UcError as e:
 if reason is None:reason=str(e)
if reason is None:reason='bounded run ended at '+hex(u.reg_read(UC_X86_REG_RIP))
memory=bytes(u.mem_read(base+0x4bb8000,len(stage)));(outdir/'api-dungeon.bin').write_bytes(memory)
report={'profile':mode,'postContextBlocks':postContextBlocks,'registerCheckpoints':registerCheckpoints,'contextReads':contextReads,'sectionHashes':[dict(s,initial=initialSections[s['index']],final=hashlib.sha256(bytes(u.mem_read(base+s['rva'],s['virtualSize']))).hexdigest()) for s in sections if s['virtualSize']],'registers':{name:hex(u.reg_read(reg)) for name,reg in [('rax',UC_X86_REG_RAX),('rbx',UC_X86_REG_RBX),('rcx',UC_X86_REG_RCX),('rdx',UC_X86_REG_RDX),('rsi',UC_X86_REG_RSI),('rdi',UC_X86_REG_RDI),('rbp',UC_X86_REG_RBP)]},'hotBlocks':[(hex(k),v) for k,v in blocks.most_common(10)],'vehProbe':vehProbe,'exceptionHandlers':exceptionHandlers,'status':'conditional-emulation','blockVisits':count,'uniqueBlocks':len(blocks),'stopReason':reason,'events':events,'smbiosReads':smbiosReads,'rip':hex(u.reg_read(UC_X86_REG_RIP)),'tailBlocks':list(tail),'writtenPages':{hex(k):v for k,v in writes.items()},'dungeonSha256':hashlib.sha256(memory).hexdigest(),'elapsedSeconds':time.monotonic()-start,'syntheticExports':{lib:sum(k[0]==mb for k in symbols) for lib,mb in modules.items()}}
(outdir/'api-trace.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='writtenPages'},indent=2))
