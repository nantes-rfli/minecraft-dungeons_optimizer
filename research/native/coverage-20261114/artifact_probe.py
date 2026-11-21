#!/usr/bin/env python3
"""Bounded private-image Artifact research. No game startup, payload output or runtime promotion."""
import argparse, hashlib, json, struct, sys
from pathlib import Path
BASE=0x140000000
IMAGE_HASH='04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
SPANS=[
 ('duration-scalar',0xb8a5f0,0xb8a649),
 ('power-callback-dispatch',0xb903e0,0xb90409),
 ('power-callback-functor',0xa7a3a0,0xa7a3ab),
 ('power-effect-index-reader',0xaf7440,0xaf74e7),
 ('duration-constructor-callback-binding',0xb78ac1,0xb78af4),
 ('duration-class-registration',0xf1c9e0,0xf1ca82),
 ('boots-class-registration',0xeb7930,0xeb79d2),
 ('boots-constructor',0xad8270,0xad8311),
 ('mushroom-constructor',0xad8820,0xad88c1),
 ('iron-hide-constructor',0xb18b40,0xb18c17),
 ('gong-constructor',0xb18500,0xb185e1),
 ('shadow-shifter-constructor',0xb19730,0xb19837),
 ('enchanters-tome-constructor',0xad8980,0xad8ab8),
 ('totem-shielding-constructor',0xb1a6c0,0xb1a74e),
 ('boots-duration-to-spec',0xae5fd7,0xae601b),
 ('boots-owner-and-application',0xae5e9a,0xae5edb),
 ('boots-spec-application',0xae6037,0xae6075),
 ('mushroom-duration-to-spec',0xae7b8b,0xae7be9),
 ('iron-hide-duration-to-spec',0xb41f0c,0xb41f4d),
 ('gong-duration-to-spec',0xb4e2fa,0xb4e327),
 ('gong-duration-setbycaller',0xb4e417,0xb4e429),
 ('shadow-shifter-duration-to-spec',0xb439c4,0xb43a00),
 ('item-type-default-duration-reader',0x6df400,0x6df409),
 ('item-type-default-cooldown-reader',0x6df440,0x6df449),
 ('boots-catalog-defaults',0x14d966,0x14d9b0),
 ('iron-hide-catalog-defaults',0x1635f6,0x163640),
 ('type-builder-cooldown-duration-arguments',0xb6500d,0xb65037),
 ('named-default-duration-wrapper',0xf20370,0xf2042c),
 ('named-default-duration-reader',0xb532c0,0xb5332c),
 ('status-duration-constructor-positive-capture',0x7a51bc,0x7a51e7),
 ('status-duration-constructor-negative-capture',0x7a5232,0x7a525c),
 ('status-duration-attribute-names',0x7a532e,0x7a540d),
 ('status-duration-calculation',0x7b0ab0,0x7b0ce9),
 ('status-positive-negative-tag-choice',0x7bf9e0,0x7bfba9),
 ('mushroom-duration-calculator-assignment',0xadf19b,0xadf25d),
 ('common-activation-cooldown-start',0xae8ce3,0xae8d24),
 ('named-cooldown-reduction-wrapper',0xf20210,0xf2023d),
 ('cooldown-reduction-reader',0xb531e0,0xb531e9),
]
SPANS += [
 ('power-normalization',0xb8f610,0xb8f67f),
 ('integer19',0xa3fa50,0xa3fa56),
 ('type-builder-call',0xb65089,0xb65094),
 ('type-constructor-prologue',0xb1b390,0xb1b3c9),
 ('type-constructor-cooldown-duration-store',0xb1b5ab,0xb1b5cb),
 ('cooldown-candidate-getter',0xaecae0,0xaecc7d),
 ('item-cooldown-multiplier-attribute',0x7c3404,0x7c343e),
 ('item-cooldown-override-attribute',0x7c34c4,0x7c34fe),
 ('potion-cooldown-multiplier-attribute',0x7cea24,0x7cea5e),
 ('item-type-category-equality',0xb66890,0xb6689a),
 ('boots-effect-registration',0xeb7870,0xeb7912),
 ('boots-effect-constructor-thunk',0xeb8da0,0xeb8db4),
 ('boots-effect-duration-and-modifier-construction',0xadb32f,0xadb6ff),
 ('boots-effect-positive-tag',0xadb700,0xadb73a),
 ('boots-speed-setbycaller',0xae601b,0xae6037),
 ('speed-multiplier-attribute',0x7d3e94,0x7d3ece),
 ('setbycaller-map-insertion',0x3ca070,0x3ca111),
 ('status-duration-class-registration',0xf8a610,0xf8a6b2),
 ('status-duration-constructor-thunk',0xf8cb20,0xf8cb2d),
 ('boots-name-binding',0x14d844,0x14d874),
]
POINTERS=[('callback-functor-dispatch',0x3290ff0,0xa7a3a0),('boots-activation',0x32c4688+0x6d8,0xae5e60),('mushroom-activation',0x32c80a8+0x6d8,0xae7a10),('iron-hide-activation',0x32fbb68+0x6d8,0xb41c90),('status-duration-calculator',0x31bdbb8+0x240,0x7b0ab0),('default-duration-name',0x3443270,0x3440268),('default-duration-exec',0x3443278,0xf20370),('cooldown-reduction-name',0x34443f0,0x3441030),('cooldown-reduction-exec',0x34443f8,0xf20210)]
CALLS=[('boots-duration-class',0xad82bc,0xf1c9e0),('mushroom-duration-class',0xad8876,0xf1c9e0),('iron-hide-duration-class',0xb18bcc,0xf1c9e0),('gong-duration-class',0xb18596,0xf1c9e0),('shadow-duration-class',0xb197da,0xf1c9e0),('tome-duration-class',0xad8a6d,0xf1c9e0),('shielding-duration-class',0xb1a703,0xf1c9e0),('boots-power-index',0xae5fdc,0xaf7440),('boots-power-callback',0xae5fec,0xb903e0),('boots-base-duration',0xae5ffb,0x6df400),('boots-duration-store',0xae6016,0x3ca070),('mushroom-power-callback',0xae7ba0,0xb903e0),('mushroom-base-duration',0xae7bb3,0x6df400),('iron-hide-power-callback',0xb41f22,0xb903e0),('gong-power-callback',0xb4e31b,0xb903e0),('shadow-power-callback',0xb439d4,0xb903e0),('named-default-duration',0xf20406,0xb532c0),('common-cooldown-getter',0xae8d0d,0xaecae0),('cooldown-reduction-read',0xf2022e,0xb531e0)]

STRINGS=[('boots-native-class',0x33d5a7a,'utf-16le','BootsOfSwiftnessInstance'),('boots-native-effect',0x33d5992,'utf-16le','BootsOfSwiftnessGameplayEffect'),('status-calculator-class',0x34a8a52,'utf-16le','StatusDurationModCalculation'),('item-cooldown-multiplier',0x31b7250,'utf-16le','ItemCooldownMultiplier'),('item-cooldown-override',0x31b7280,'utf-16le','ItemCooldownOverride'),('potion-cooldown-multiplier',0x31b7360,'utf-16le','PotionCooldownMultiplier'),('positive-duration-attribute',0x31b7a80,'utf-16le','PositiveStatusDurationMagnitude'),('negative-duration-attribute',0x31b7ac0,'utf-16le','NegativeStatusDurationMagnitude'),('speed-attribute',0x31b7600,'utf-16le','SpeedMultiplier'),('positive-status-tag',0x31bde08,'ascii','StatusEffect.Positive'),('duration-key',0x30d0f50,'utf-16le','Duration')]
CALLS += [('type-construction',0xb6508f,0xb1b390),('boots-duration-calc-class',0xadb39b,0xf8a610),('boots-speed-attribute',0xadb4c9,0x7d3e40),('boots-speed-payload',0xae6032,0x3ca070),('candidate-base-cooldown',0xaecc47,0x6df440),('normal-item-cooldown-attribute',0xaecbd0,0x7c33b0),('normal-item-override-attribute',0xaecbe7,0x7c3470),('potion-cooldown-attribute',0xaecbc9,0x7ce9d0),('status-duration-setbycaller-lookup',0x7b0af0,0x3b5140)]

def main():
 p=argparse.ArgumentParser();p.add_argument('--local-root',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.local_root)
 im=(root/'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes();assert hashlib.sha256(im).hexdigest()==IMAGE_HASH
 sys.path.insert(0,str(root/'phase6.8/native-stage2/tools'));import capstone
 cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64)
 spans=[dict(role=role,startRva=hex(st),endRvaExclusive=hex(en),sha256=hashlib.sha256(im[st:en]).hexdigest()) for role,st,en in SPANS]
 pointers=[]
 for role,rva,target in POINTERS:
  actual=struct.unpack_from('<Q',im,rva)[0];assert actual==BASE+target,(role,hex(actual));pointers.append(dict(role=role,rva=hex(rva),targetRva=hex(target)))
 calls=[]
 for role,rva,target in CALLS:
  ins=next(cs.disasm(im[rva:rva+15],rva));assert ins.mnemonic=='call' and ins.op_str==hex(target),(role,ins.mnemonic,ins.op_str)
  calls.append(dict(role=role,rva=hex(rva),targetRva=hex(target),bytes=im[rva:rva+ins.size].hex()))
 strings=[]
 for role,rva,enc,value in STRINGS:
  expected=value.encode(enc)+(b'\0\0' if enc=='utf-16le' else b'\0');assert im[rva:rva+len(expected)]==expected,role
  strings.append(dict(role=role,rva=hex(rva),encoding=enc,value=value))
 result=dict(schemaVersion=1,status='READY_FOR_INDEPENDENT_FOUNDATION_VERIFICATION',baselineMain='6bf212dc5ea8f686f981c9882657874264e41791',imageSha256=IMAGE_HASH,originalExeSha256='eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8',nativeSpans=spans,pointers=pointers,directCalls=calls,strings=strings,actualGameplay=None,independentValidation=None,runtimePromotion=False,interpretation='Static bounded Artifact duration and cooldown foundation; full-item runtime READY remains zero. Conditional replay recorded separately in artifact-replay.json.',cohort=dict(formalRelationUnionCount=16,formalRelationUnsupportedCount=13,nativeDurationClassCount=7,nativeDurationClassUnsupportedIds=['boots-of-swiftness','enchanters-tome','gong-of-weakening','shadow-shifter','totem-of-shielding'],runtimeReadyCount=0))
 Path(a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'spans':len(spans),'pointers':len(pointers),'calls':len(calls),'output':a.output}))
if __name__=='__main__':main()
