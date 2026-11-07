import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import source from '../research/sources/fixed-observed-melee-combo-source.json' with { type: 'json' }
import { GREAT_HAMMER_LOCALIZATION_SOURCE, parseLocresV2 } from './locres-identity-source.ts'
import type { RawStructuralInventoryManifest, RawStructuralInventoryShard } from './game-data-raw-structural-inventory.ts'

const sha256 = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')
const directory = 'research/raw/game-data-raw-structural-inventory'
const disabledObject = { rawPackageIndex: 0, kind: 'null' }

export const fixedComboLocalizationBridges = source.rows.flatMap((row) => row.localization ? [{
  category: 'melee-weapon' as const, domainId: row.id, rawIdentity: row.rawIdentity,
  packagePath: row.packagePath, displayName: row.calculatorRow.name, localization: row.localization,
}] : [])

export function verifyFixedObservedComboSources(repositoryRoot: string): void {
  const expectedLocalization = Object.fromEntries(Object.entries(GREAT_HAMMER_LOCALIZATION_SOURCE).filter(([key]) => key !== 'bridge'))
  assert.deepEqual(source.localizationSource, expectedLocalization)
  assert.deepEqual(fixedComboLocalizationBridges.map(({ domainId, rawIdentity }) => [domainId, rawIdentity]), [
    ['cackling-broom', 'Glaive_Spooky2'], ['dark-katana', 'Katana_Unique2'],
    ['grave-bane', 'Glaive_Unique1'], ['hawkbrand', 'Sword_Unique2'],
  ])
  for (const { localization, rawIdentity, displayName } of fixedComboLocalizationBridges) {
    assert.equal(localization.namespace, 'ItemType')
    assert.equal(localization.key, rawIdentity)
    assert.equal(localization.value, displayName)
  }

  const read = (relative: string) => fs.readFileSync(path.join(repositoryRoot, directory, relative))
  const manifest = JSON.parse(read('manifest.json').toString()) as RawStructuralInventoryManifest
  const shards = new Map<string, RawStructuralInventoryShard>()
  for (const row of source.rows) {
    const { shard, sha256: expectedHash, packageIndex } = row.rawSource
    if (!shards.has(shard)) {
      const bytes = read(shard)
      assert.equal(sha256(bytes), expectedHash, `${row.id}: compressed shard digest`)
      shards.set(shard, JSON.parse(gunzipSync(bytes).toString()) as RawStructuralInventoryShard)
    }
    assert.equal(manifest.shards.find((entry) => entry.path === shard)?.compressedSha256, expectedHash, row.id)
    const pkg = shards.get(shard)!.packages[packageIndex]
    assert.equal(pkg?.path, row.packagePath)
    const exports = pkg!.exports.filter((entry) => entry.isClassDefaultObject)
    const inventories = pkg!.cdoPropertyInventory.filter((entry) => entry.exportIndex === exports[0]?.exportIndex)
    assert.equal(exports.length, 1)
    assert.equal(inventories.length, 1)
    const properties = inventories[0]!.properties
    type Property = (typeof properties)[number]
    function field(fields: readonly Property[], name: string, type: string) {
      const matches = fields.filter((p) => p.name.value === name && p.arrayIndex === 0)
      assert.equal(matches.length, 1, `${row.id}: ${name} must be unique`)
      assert.equal(matches[0]!.type.value, type)
      const decoding = matches[0]!.decoding
      assert.ok(decoding.state === 'decoded', `${row.id}: ${name} must be decoded`)
      return decoding
    }
    assert.equal(field(properties, 'ItemIdName', 'NameProperty').value, row.rawIdentity)
    const item = field(properties, 'ItemId', 'StructProperty')
    assert.equal(field(item.properties ?? [], 'SerializedId', 'NameProperty').value, row.rawIdentity)
    const elements = field(properties, 'ConfiguredAttackVariants', 'ArrayProperty').elements
    assert.ok(elements?.length === row.hitDurationsSeconds.length)
    for (const [index, entry] of elements.entries()) {
      assert.equal(entry.index, index)
      const props = entry.properties ?? []
      assert.equal(field(props, 'Damage', 'FloatProperty').value, row.publishedBaseDamage[index])
      assert.equal(field(props, 'AttackAnimationTimeDurationSeconds', 'FloatProperty').value, Math.fround(row.hitDurationsSeconds[index]!))
      assert.equal(field(props, 'VariantLoopAmount', 'IntProperty').value, 1)
      assert.equal(field(props, 'AttackVariantType', 'EnumProperty').value, 'EMeleeAttackVariantType::TargetAndSplash')
      assert.deepEqual(field(props, 'VariantActiveEffect', 'ObjectProperty').value, disabledObject)
      assert.deepEqual(field(props, 'VariantChangeEffect', 'ObjectProperty').value, disabledObject)
      assert.equal(field(props, 'ContinuousDamageInterval', 'FloatProperty').value, 0)
    }
  }
}

/** Local replay uses the retained original resource. CI uses the finite sidecar. */
export function replayFixedComboLocalization(bytes: Buffer): void {
  assert.equal(sha256(bytes), source.localizationSource.source.sha256)
  const { entries } = parseLocresV2(bytes)
  for (const { localization } of fixedComboLocalizationBridges) {
    assert.deepEqual(entries.filter((entry) => entry.namespace === localization.namespace && entry.key === localization.key), [localization])
  }
}
