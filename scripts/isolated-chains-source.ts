import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import source from '../research/sources/observed-isolated-chains.json' with { type: 'json' }
import native from '../research/native/coverage-integration-20261121/chains-dispatch-proof.json' with { type: 'json' }
import original from '../research/native/coverage-20261114/chains-evidence.json' with { type: 'json' }
import handoff from '../research/native/coverage-20261114/manifest.json' with { type: 'json' }
import independent from '../research/native/coverage-integration-20261121/source-independent-review.json' with { type: 'json' }

/** Public metadata/hash gate. Private replay is explicit and separate; CI cannot
 * manufacture a successful class load, world query, or gameplay observation.
 */
export function verifyIsolatedChainsSourceProof(repositoryRoot: string): void {
  const bytes = (relative: string) => fs.readFileSync(path.join(repositoryRoot, relative))
  const digest = (relative: string) => crypto.createHash('sha256').update(bytes(relative)).digest('hex')
  assert.equal(digest(source.nativeProofRef), source.nativeProofSha256)
  for (const record of independent.reviewedArtifacts) assert.equal(digest(record.path), record.sha256, `Chains independent source review: ${record.path}`)
  assert.deepEqual(independent.findings, [])
  assert.equal(independent.baseline, handoff.baselineCommit)
  for (const record of handoff.files) {
    const relative = `research/native/coverage-20261114/${record.path}`
    assert.equal(bytes(relative).length, record.size)
    assert.equal(digest(relative), record.sha256, `Original Astra bundle drift: ${relative}`)
  }
  assert.equal(handoff.privateInputs.length, 14)
  assert.equal(native.imageSha256, original.image.sha256)
  assert.deepEqual(native.fixedRecords, original.items.map((item) => ({ id: item.id, rawIdentity: item.rawIdentity, enum: item.fixedRecord.enumId, tier: item.fixedRecord.tier })))
  assert.equal(native.registry.assetCount, 49397)
  assert.equal(native.registry.nameCount, 146784)
  assert.equal(native.registry.record.assetName, 'BP_Chains')
  assert.equal(native.registry.record.tags.GeneratedClass, "BlueprintGeneratedClass'/Game/Components/Enchantments/Chains/BP_Chains.BP_Chains_C'")
  assert.equal(native.registry.record.tags.NativeParentClass, "Class'/Script/Dungeons.Chains'")
  assert.equal(native.gameplayObserved, false)
  assert.equal(native.r3Accepted, false)
  assert.equal(native.newNumericMechanicAdopted, false)
  assert.equal(native.requiredCondition, 'single target, initial Chains absent, and no other eligible query candidates for the entire evaluation interval')
  assert.equal(native.privateFiles.length, 6)
  assert.equal(native.directCalls.length, 26)
  assert.equal(native.pointers.length, 8)
  assert.equal(native.nativeSpans.length, 29)
  for (const row of source.rows) {
    const own = original.items.find((r) => r.id === row.id)
    assert.equal(own?.rawIdentity, row.rawIdentity)
    assert.equal(own?.packagePath, row.packagePath)
    assert.equal(own?.fixedRecord.enumName, 'EEnchantmentTypeID::Chains')
    assert.equal(own?.fixedRecord.tier, 1)
  }
}
