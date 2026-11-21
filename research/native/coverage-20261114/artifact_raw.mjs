#!/usr/bin/env node
// Narrow metadata summary for two existing local Boots packages; no payload mirror.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [repositoryRoot, localRoot, output] = process.argv.slice(2);
if (!repositoryRoot || !localRoot || !output) throw new Error('Usage: node artifact_raw.mjs REPOSITORY_ROOT LOCAL_ROOT OUTPUT_JSON');
const { parseUePackage } = await import(pathToFileURL(path.join(repositoryRoot,'src/research/ue4/packageReader.ts')).href);
const { PackageObjectResolver } = await import(pathToFileURL(path.join(repositoryRoot,'src/research/ue4/objectResolver.ts')).href);
const records = [];
for (const name of ['BP_BootsOfSwiftnessInstance','BP_BootsOfSwiftnessGameplayEffect']) {
 const packagePath='Dungeons/Content/Actors/Items/BootsOfSwiftness/'+name;
 const files=['uasset','uexp'].map(ext=>fs.readFileSync(path.join(localRoot,'QuickBMS 1.17.0.0',packagePath+'.'+ext)));
 const p=parseUePackage(files[0],files[1],{assetPath:packagePath,strict:true});
 const resolver=new PackageObjectResolver(p.imports,p.exports);
 records.push({packagePath,files:files.map((b,i)=>({extension:['uasset','uexp'][i],size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')})),diagnostics:p.diagnostics,
  exports:p.exports.filter(e=>e.objectName.value===name+'_C'||e.objectName.value==='Default__'+name+'_C').map(e=>({name:e.objectName.value,super:resolver.resolve(e.superIndex),template:resolver.resolve(e.templateIndex)})),
  cdoProperties:p.objects.map(o=>({name:o.objectName,termination:o.propertyStream.termination,unparsedByteRanges:o.propertyStream.unparsedByteRanges,propertyNames:o.properties.map(x=>x.name),selectedProperties:o.properties.filter(x=>['Effect','ItemIdName','UIData'].includes(x.name)).map(x=>({name:x.name,type:x.type,value:x.value}))}))});
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,scope:'existing local Boots package metadata only',records},null,2)+'\n');
console.log(JSON.stringify({packages:records.length,output}));
