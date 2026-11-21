// Metadata-only strict replay of the exact two Blueprint packages.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseUePackage } from '../../../src/research/ue4/packageReader.ts';
import { PackageObjectResolver } from '../../../src/research/ue4/objectResolver.ts';
const local = process.argv[2];
if (!local) throw Error('usage: node verify_chains_blueprints.mjs LOCAL_GAME_DATA_ROOT');
const proof = JSON.parse(fs.readFileSync(new URL('./chains-dispatch-proof.json', import.meta.url)));
const results = [];
for (const [name, parent, fields] of [['BP_Chains', 'Chains', ['Effect']], ['BP_ChainsGameplayEffect', 'ChainsGameplayEffect', ['UIData']]]) {
  const relative = `QuickBMS 1.17.0.0/Dungeons/Content/Components/Enchantments/Chains/${name}`;
  const files = ['uasset', 'uexp'].map((ext) => {
    const relativePath = `${relative}.${ext}`;
    const b = fs.readFileSync(path.join(local, relativePath));
    const expected = proof.privateFiles.find((r) => r.path === relativePath);
    if (!expected || b.length !== expected.size || crypto.createHash('sha256').update(b).digest('hex') !== expected.sha256) throw Error('Blueprint input hash mismatch');
    return b;
  });
  const p = parseUePackage(files[0], files[1], { assetPath: relative, strict: true });
  const resolver = new PackageObjectResolver(p.imports, p.exports);
  const cls = p.exports.find((e) => e.objectName.value === `${name}_C`);
  const functions = p.exports.filter((e) => resolver.resolve(e.classIndex).objectName === 'Function');
  const cdo = p.objects.find((o) => o.isClassDefaultObject);
  const actualFields = cdo?.properties.map((v) => v.name);
  const parentRef = cls && resolver.resolve(cls.superIndex);
  const parentImport = cls && p.imports[-cls.superIndex - 1];
  const parentPackage = parentImport && p.imports[-parentImport.outerIndex - 1]?.objectName.value;
  if (parentRef?.objectName !== parent || parentPackage !== '/Script/Dungeons' || functions.length || p.diagnostics.length
    || cdo?.propertyStream.termination !== 'terminated' || cdo.propertyStream.unparsedByteRanges.length || JSON.stringify(actualFields) !== JSON.stringify(fields)) throw Error(`Blueprint class/override scope mismatch: ${name}`);
  if (name === 'BP_Chains') {
    const effect = cdo.properties[0].value;
    if (effect?.objectName !== 'BP_ChainsGameplayEffect_C') throw Error('Chains Effect binding mismatch');
  }
  results.push({ name, parent, functionExports: 0, fields, terminated: true, diagnostics: 0 });
}
console.log(JSON.stringify({ status: 'passed', scope: 'strict metadata only; no engine/Blueprint execution', verifier: fileURLToPath(import.meta.url), results }));
