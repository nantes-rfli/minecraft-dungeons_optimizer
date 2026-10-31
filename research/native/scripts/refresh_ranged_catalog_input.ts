/** Narrow provenance refresh for the observed-Ranged catalog change.
 * Proves the generator's complete catalog projection and parser/code identity
 * unchanged before updating input metadata. Never reparses private packages.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RAW_STRUCTURAL_INPUT_PATHS, RAW_STRUCTURAL_INVENTORY_PATH,
  loadRawCatalog, makeRawStructuralCodeIdentity, makeRawStructuralInputIdentity,
  serializeRawStructuralInventoryManifest, type RawStructuralInventoryManifest,
} from '../../../scripts/game-data-raw-structural-inventory.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const baseline = 'e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a'
const rangedPath = 'research/ranged-weapon-audit.json'
const oldFile = (file: string) => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 })
const original = JSON.parse(oldFile(RAW_STRUCTURAL_INVENTORY_PATH).toString()) as RawStructuralInventoryManifest
assert.deepEqual(makeRawStructuralCodeIdentity(root), original.scope.codeIdentity, 'Parser/generator changed: refresh forbidden')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-catalog-input-'))
try {
  for (const file of RAW_STRUCTURAL_INPUT_PATHS) {
    const destination = path.join(temporary, file)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    if (file === rangedPath) fs.writeFileSync(destination, oldFile(file))
    else fs.symlinkSync(path.join(root, file), destination)
  }
  assert.deepEqual(makeRawStructuralInputIdentity(temporary), original.scope.inputIdentity, 'Another input changed: refresh forbidden')
  const before = loadRawCatalog(temporary)
  const after = loadRawCatalog(root)
  assert.deepEqual(after, before, 'Raw seed catalog changed: refresh forbidden')
  const refreshed = { ...original, scope: { ...original.scope, inputIdentity: makeRawStructuralInputIdentity(root) } }
  const catalogSha256 = createHash('sha256').update(JSON.stringify(after)).digest('hex')
  const proof = {
    schemaVersion: 1, baselineCommit: baseline,
    reason: 'Ranged support/labels changed; complete Raw seed catalog projection is identical',
    catalogItems: after.length, unchangedCatalogProjectionSha256: catalogSha256,
    changedInput: rangedPath, previousInputIdentity: original.scope.inputIdentity,
    refreshedInputIdentity: refreshed.scope.inputIdentity,
    parserCodeIdentityUnchanged: true, rawShardsUnchanged: true, privateReparse: false,
  }
  const proofPath = path.join(root, 'research/native/ranged-20261031/catalog-input-refresh.json')
  const manifestPath = path.join(root, RAW_STRUCTURAL_INVENTORY_PATH)
  const manifestText = serializeRawStructuralInventoryManifest(refreshed)
  const proofText = JSON.stringify(proof, null, 2) + '\n'
  if (process.argv.includes('--write')) {
    const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    current.scope.inputIdentity = original.scope.inputIdentity
    assert.deepEqual(current, original, 'Raw manifest changed outside input metadata: refresh forbidden')
    fs.writeFileSync(manifestPath, manifestText)
    fs.writeFileSync(proofPath, proofText)
  }
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestText, 'Raw input metadata drift')
  assert.equal(fs.readFileSync(proofPath, 'utf8'), proofText, 'Catalog refresh proof drift')
  console.log(`Raw catalog input refresh PASS: ${after.length} identical seed items; parser, packages and shards unchanged`)
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
