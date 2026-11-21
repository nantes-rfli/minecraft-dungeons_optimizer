// Independent original-file/ID review; no runtime or Formal writes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseUePackage } from '../../../src/research/ue4/packageReader.ts';

const localRoot = process.argv[2];
if (!localRoot) throw new Error('Usage: node review_chains_raw.mjs LOCAL_GAME_DATA_ROOT');
const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceBytes = fs.readFileSync(path.join(here, 'chains-evidence.json'));
const evidence = JSON.parse(evidenceBytes);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = { rawFiles: 0, rawNumericFields: 0, parsedIdentityFields: 0 };
const items = [];
for (const item of evidence.items) {
  const files = new Map();
  for (const source of item.sourceFiles) {
    const bytes = fs.readFileSync(path.join(localRoot, 'QuickBMS 1.17.0.0', source.path));
    if (bytes.length !== source.size || hash(bytes) !== source.sha256) throw new Error('Original source mismatch: ' + source.path);
    files.set(source.path, bytes);
    checks.rawFiles++;
  }
  const parsed = parseUePackage(files.get(item.packagePath + '.uasset'), files.get(item.packagePath + '.uexp'), { assetPath: item.packagePath });
  const properties = parsed.objects.find(object => object.isClassDefaultObject).properties;
  const name = properties.find(property => property.name === 'ItemIdName');
  const serialized = properties.find(property => property.name === 'ItemId').value.find(property => property.name === 'SerializedId');
  for (const field of [name, serialized]) {
    if (field.type !== 'NameProperty' || field.value !== item.rawIdentity) throw new Error('Own identity mismatch: ' + item.id);
    checks.parsedIdentityFields++;
  }
  for (const field of item.ownFields) {
    if (['Damage', 'AttackAnimationTimeDurationSeconds'].includes(field.path.split('.').at(-1))) {
      const range = field.valueRange;
      if (range.end - range.start !== 4 || files.get(range.file).readFloatLE(range.start) !== field.value) throw new Error('Original numeric field mismatch: ' + field.path);
      checks.rawNumericFields++;
    }
  }
  items.push({ id: item.id, rawIdentity: item.rawIdentity, sourceFiles: item.sourceFiles,
    parsedIdentity: [name, serialized].map(field => ({ path: field.path, value: field.value, valueByteRange: field.valueByteRange })) });
}
console.log(JSON.stringify({ status: 'passed', evidenceSha256: hash(evidenceBytes), checks, items,
  scope: 'Original-file SHA/size, reparsed own serialized identities, and damage/timing byte comparison. Native string/call semantics reviewed separately. No gameplay, Formal adoption or Runtime Promotion.' }, null, 2));
