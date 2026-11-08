import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import source from '../research/sources/observed-fixed-power-bows.json' with { type: 'json' }
import catalog from '../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import { GREAT_HAMMER_LOCALIZATION_SOURCE, parseLocresV2 } from './locres-identity-source.ts'
import type { RawStructuralInventoryManifest, RawStructuralInventoryShard } from './game-data-raw-structural-inventory.ts'

const sha256 = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')
const directory = 'research/raw/game-data-raw-structural-inventory'
export const fixedPowerBowBridges = source.rows.map((row) => ({ ...row, category: 'ranged-weapon' as const }))
export const FIXED_POWER_BOW_ALIAS_BASIS = 'serialized-item-id + reviewed-package-and-localization-key + catalog-category-evidence'

export function fixedPowerBowCatalogEvidence(row: (typeof source.rows)[number]): string[] {
  const matches = catalog.weapons.rows.filter((item) => item.id === row.id && item.name === row.displayName && item.sourceUrl === row.sourceUrl)
  assert.equal(matches.length, 1, `${row.id}: missing own ranged catalog identity`)
  return ['research/sources/ranged-source-snapshot.json#/weapons/rows[id=' + row.id + ']']
}

export function verifyFixedPowerBowSources(root: string): void {
  const localizationSource = Object.fromEntries(Object.entries(GREAT_HAMMER_LOCALIZATION_SOURCE).filter(([key]) => key !== 'bridge'))
  assert.deepEqual(source.localizationSource, localizationSource)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, 'manifest.json'), 'utf8')) as RawStructuralInventoryManifest
  const bytes = fs.readFileSync(path.join(root, directory, source.rawShard.path))
  assert.equal(sha256(bytes), source.rawShard.sha256)
  assert.equal(manifest.shards.find(({ path }) => path === source.rawShard.path)?.compressedSha256, source.rawShard.sha256)
  const shard = JSON.parse(gunzipSync(bytes).toString()) as RawStructuralInventoryShard
  assert.deepEqual(source.rows.map(({ id, rawIdentity, localization }) => [id, rawIdentity, localization.key, localization.value, localization.localizedStringIndex]), [
    ['elite-power-bow', 'Powerbow_Unique1', 'PowerBow_Unique1', 'Elite Power Bow', 2883],
    ['phantom-bow', 'PowerBow_Spooky2', 'PowerBow_Spooky2', 'Phantom Bow', 1741],
  ])
  for (const row of source.rows) {
    fixedPowerBowCatalogEvidence(row)
    const [actor, arrow, instance] = row.ownPackages
    assert.ok(actor && arrow && instance && row.ownPackages.length === 3)
    assert.equal(row.localization.namespace, 'ItemType')
    assert.equal(row.localization.value, row.displayName)
    assert.equal(row.packagePath, instance.path)
    for (const review of row.ownPackages) {
      const pkg = shard.packages[review.index]!
      assert.equal(pkg.path, review.path)
      assert.deepEqual(pkg.sourceFiles, review.sourceFiles)
      assert.equal(pkg.exports.length, review.exportCount)
      const classes = pkg.exports.filter((entry) => entry.references.class.objectName === 'BlueprintGeneratedClass')
      assert.equal(classes.length, 1)
      assert.equal(classes[0]!.references.super.objectName, review.parentClass)
      const functions = pkg.exports.filter((entry) => entry.references.class.objectName === 'Function')
      assert.deepEqual(functions.map((entry) => entry.objectName.value), review.functions.map(({ name }) => name))
      for (const fn of review.functions) assert.ok(fn.failure === null && fn.decodedTo === fn.size && fn.size > 0)
    }
    const arrowPkg = shard.packages[arrow.index]!
    const instancePkg = shard.packages[instance.index]!
    assert.deepEqual(shard.packages[actor.index]!.cdoPropertyInventory[0]!.properties.map((field) => field.name.value), ['Paperdoll', 'SlotType', 'RootComponent'])
    assert.deepEqual(arrowPkg.cdoPropertyInventory[0]!.properties.map((field) => field.name.value), [
      ...(row.id === 'elite-power-bow' ? ['UberGraphFrame'] : []), 'NormalWooshSound', 'ChargedWooshSound', 'NormalImpactSound', 'ChargedImpactSound', 'ProjectileMovementComponent', 'ImpactActionHandler',
    ])
    const properties = instancePkg.cdoPropertyInventory[0]!.properties
    assert.deepEqual(properties.map((field) => field.name.value), ['AttackDefintion', 'AnimNotifyStateData', 'GearActor', 'InventoryDropSound', 'ItemIdName', 'ItemId', 'RootComponent'])
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
    assert.equal(field(field(properties, 'ItemId', 'StructProperty').properties ?? [], 'SerializedId', 'NameProperty').value, row.rawIdentity)
    const attack = field(properties, 'AttackDefintion', 'StructProperty').properties ?? []
    assert.deepEqual(attack.map((property) => property.name.value), ['ProjectileDefinition'])
    const definitions = field(attack, 'ProjectileDefinition', 'ArrayProperty').elements
    assert.ok(definitions?.length === 1 && definitions[0]?.index === 0)
    const configured = definitions[0].properties ?? []
    const projectile = field(configured, 'Projectile', 'ObjectProperty').value
    const actorRef = field(properties, 'GearActor', 'ObjectProperty').value
    const objectName = (value: unknown) => (value as { objectName?: string })?.objectName
    assert.equal(objectName(projectile), `${path.basename(arrow.path)}_C`)
    assert.equal(objectName(actorRef), `${path.basename(actor.path)}_C`)
    for (const name of ['DelaySeconds', 'DelaySecondsPerProjectile', 'AngleSpan', 'AngleOffset', 'MaxRandomizedAngleFactor']) assert.equal(field(configured, name, 'FloatProperty').value, 0)
    assert.equal(field(configured, 'NumberOfProjectiles', 'IntProperty').value, 1)
    assert.equal(field(configured, 'NonRandomFirstArrow', 'BoolProperty').value, true)
    assert.deepEqual(row.reviewedComponents.map((component) => component.class), ['DungeonsProjectileMovementComp', 'ImpactActionHandler', 'InheritableComponentHandler'])
    for (const component of row.reviewedComponents) {
      const e = arrowPkg.exports.find((entry) => entry.exportIndex === component.exportIndex)
      assert.equal(e?.references.class.objectName, component.class)
      assert.deepEqual(e?.serialized.sourceRange, component.sourceRange)
      if (component.class === 'InheritableComponentHandler') {
        assert.deepEqual(component.ownPropertyNames, ['Records'])
        assert.deepEqual(component.overrides, ['ParticleSystemComponent', row.id === 'elite-power-bow' ? 'AudioComponent' : 'ParticleSystemComponent'])
      } else {
        assert.deepEqual(component.ownPropertyNames, [])
        assert.equal(component.sourceRange.end - component.sourceRange.start, 12)
      }
    }
  }
  const functions = source.rows[0]!.ownPackages[1]!.functions
  assert.deepEqual(functions.map(({ scriptSha256 }) => scriptSha256), ['b9350b47e5f743e87a155406825645bb26ed0b5e51698bfb1d0bbd588b8d8df9', 'faab608e8940e17d32892b59b3703f0b49bf494e81778773d938a9c6b804149a'])
  assert.deepEqual(functions.map(({ expressions }) => expressions.map(({ op }) => op)), [
    ['computed-jump', 'local-final-call', 'return', 'end-script'], ['persistent-frame-copy', 'local-final-call', 'return', 'end-script'],
  ])
  const call = functions[0]?.expressions[1]
  assert.deepEqual(call?.function, { index: -26, name: 'ToggleCharged', class: 'Function', outer: -3 })
  assert.equal(arrowParentOfImport(shard, source.rows[0]!.ownPackages[1]!.index, -3), 'BP_PlayerPowerBowArrow_C')
  const charged = call?.args?.[0]
  assert.ok(charged && 'property' in charged)
  assert.equal(charged.property.name, 'K2Node_Event_charged')
}

function arrowParentOfImport(shard: RawStructuralInventoryShard, packageIndex: number, rawPackageIndex: number): string | undefined {
  return shard.packages[packageIndex]?.imports[-rawPackageIndex - 1]?.objectName.value
}

export function replayFixedPowerBowLocalization(bytes: Buffer): void {
  assert.equal(sha256(bytes), source.localizationSource.source.sha256)
  const { entries } = parseLocresV2(bytes)
  for (const row of source.rows) {
    assert.deepEqual(entries.filter((entry) => entry.namespace === 'ItemType' && entry.key.toLowerCase() === row.localization.key.toLowerCase()), [row.localization])
  }
}
