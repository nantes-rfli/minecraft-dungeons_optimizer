// Read-only private Raw check, emitting compact facts only.
// node check_armor_raw.mjs REPO_ROOT LOCAL_GAME_DATA_ROOT
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [repo,local]=process.argv.slice(2);
if(!repo||!local)throw Error('usage: node check_armor_raw.mjs REPO_ROOT LOCAL_GAME_DATA_ROOT');
const {parseUePackage}=await import(pathToFileURL(path.join(repo,'src/research/ue4/packageReader.ts')));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const result=[];
for(const [name,field,expected] of [['IncreasedArrowBundleSize','ArrowIncreaseAmount',10],['MissChance','Chance',Math.fround(.3)]]){
 const relative=`QuickBMS 1.17.0.0/Dungeons/Content/Components/ArmorProperties/${name}/BP_${name}`;
 const ua=fs.readFileSync(path.join(local,relative+'.uasset')),ue=fs.readFileSync(path.join(local,relative+'.uexp'));
 const parsed=parseUePackage(ua,ue,{assetPath:relative});
 const cdo=parsed.objects.find(x=>x.isClassDefaultObject),p=cdo.properties.find(x=>x.name===field);
 const cls=parsed.exports.find(x=>x.objectName.value===`BP_${name}_C`),imp=parsed.imports[-cls.superIndex-1];
 const parentPackage=parsed.imports[-imp.outerIndex-1].objectName.value;
 if(imp.objectName.value!==name||parentPackage!='/Script/Dungeons'||p.value!==expected)throw Error('binding/value mismatch');
 const r=p.valueByteRange;
 const raw=field==='Chance'?ue.readFloatLE(r.start):ue.readInt32LE(r.start);
 if(raw!==expected)throw Error('raw numeric mismatch');
 result.push({blueprintClass:cls.objectName.value,parentClass:`${parentPackage}.${name}`,classExportRange:cls.byteRange,parentImportRange:imp.byteRange,cdoName:cdo.objectName,field,propertyType:p.type,value:p.value,valueByteRange:r,valueHex:ue.subarray(r.start,r.end).toString('hex'),files:[{path:relative+'.uasset',sha256:hash(ua)},{path:relative+'.uexp',sha256:hash(ue)}]});
}
console.log(JSON.stringify({status:'passed',bindings:result},null,2));
