import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import source from '../research/sources/observed-rapid-fire-variants.json' with { type: 'json' }
import catalog from '../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import { GREAT_HAMMER_LOCALIZATION_SOURCE, parseLocresV2 } from './locres-identity-source.ts'
import type { RawStructuralInventoryManifest, RawStructuralInventoryShard } from './game-data-raw-structural-inventory.ts'

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const directory = 'research/raw/game-data-raw-structural-inventory'
export const fixedRapidFireBridges = source.rows.map((row) => ({ ...row, category: 'ranged-weapon' as const, domainId: row.id }))

export function fixedRapidFireCatalogEvidence(row: (typeof source.rows)[number]): string[] {
  const matches = catalog.weapons.rows.filter((item) => item.id === row.id && item.name === row.displayName && item.sourceUrl === row.sourceUrl)
  assert.equal(matches.length, 1, `${row.id}: missing own ranged catalog identity`)
  return [`research/sources/ranged-source-snapshot.json#/weapons/rows[id=${row.id}]`]
}

export function verifyFixedRapidFireSources(root: string): void {
  const locres = Object.fromEntries(Object.entries(GREAT_HAMMER_LOCALIZATION_SOURCE).filter(([key]) => key !== 'bridge'))
  assert.deepEqual(source.localizationSource, locres)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, 'manifest.json'), 'utf8')) as RawStructuralInventoryManifest
  const shards = new Map<string, RawStructuralInventoryShard>()
  assert.deepEqual(source.rows.map(({ id, rawIdentity, localization }) => [id, rawIdentity, localization.key, localization.value, localization.localizedStringIndex]), [
    ['azure-seeker', 'Crossbow_Unique2', 'Crossbow_Unique2', 'Azure Seeker', 2754],
    ['purple-storm', 'Shortbow_Unique1', 'Shortbow_Unique1', 'Purple Storm', 3156],
  ])
  for (const row of source.rows) {
    fixedRapidFireCatalogEvidence(row)
    const packages = row.ownPackages.map((review) => {
      if (!shards.has(review.shard)) {
        const bytes = fs.readFileSync(path.join(root, directory, review.shard))
        assert.equal(hash(bytes), review.sha256)
        shards.set(review.shard, JSON.parse(gunzipSync(bytes).toString()) as RawStructuralInventoryShard)
      }
      assert.equal(manifest.shards.find(({ path }) => path === review.shard)?.compressedSha256, review.sha256)
      const pkg = shards.get(review.shard)!.packages[review.index]!
      assert.equal(pkg.path, review.path)
      assert.deepEqual(pkg.sourceFiles, review.sourceFiles)
      assert.equal(pkg.exports.length, review.exportCount)
      assert.equal(pkg.exports.filter((e) => e.references.class.objectName === 'Function').length, 0)
      const classes = pkg.exports.filter((e) => e.references.class.objectName === 'BlueprintGeneratedClass')
      assert.equal(classes.length, 1)
      assert.equal(classes[0]!.references.super.objectName, review.parentClass)
      return pkg
    })
    const [actor, arrow, instance] = packages
    assert.ok(actor && arrow && instance && packages.length === 3)
    assert.equal(instance.path, row.packagePath)
    assert.deepEqual(actor.cdoPropertyInventory[0]?.properties.map((p) => p.name.value), ['Paperdoll', 'SlotType', 'RootComponent'])
    const purple = row.id === 'purple-storm'
    assert.deepEqual(arrow.cdoPropertyInventory[0]?.properties.map((p) => p.name.value), [
      ...(purple ? ['NormalWooshSound'] : []), 'NormalImpactSound', 'ChargedImpactSound', 'ProjectileMovementComponent', 'ImpactActionHandler',
    ])
    const props = instance.cdoPropertyInventory[0]!.properties
    assert.deepEqual(props.map((p) => p.name.value), [
      ...(purple ? ['ChargeShootEffectTag'] : []), 'AttackDefintion', 'AnimNotifyStateData', 'GearActor', 'InventoryDropSound', 'ItemIdName', 'ItemId', 'RootComponent',
    ])
    type Prop = (typeof props)[number]
    function field(fields: readonly Prop[], name: string, type: string) {
      const entries = fields.filter((p) => p.name.value === name && p.arrayIndex === 0)
      assert.equal(entries.length, 1, `${row.id}: ${name} is missing or ambiguous`)
      const p = entries[0]!
      assert.equal(p.type.value, type)
      assert.ok(p.decoding.state === 'decoded', `${row.id}: ${name} is not decoded`)
      return p.decoding
    }
    assert.equal(field(props, 'ItemIdName', 'NameProperty').value, row.rawIdentity)
    assert.equal(field(field(props, 'ItemId', 'StructProperty').properties ?? [], 'SerializedId', 'NameProperty').value, row.rawIdentity)
    if (purple) assert.equal(field(field(props, 'ChargeShootEffectTag', 'StructProperty').properties ?? [], 'TagName', 'NameProperty').value, source.purpleChargeCue.tag)
    const attack = field(props, 'AttackDefintion', 'StructProperty').properties ?? []
    assert.deepEqual(attack.map((property) => property.name.value), ['ProjectileDefinition'])
    const definitions = field(attack, 'ProjectileDefinition', 'ArrayProperty').elements
    assert.ok(definitions?.length === 1 && definitions[0]?.index === 0)
    const configured = definitions[0].properties ?? []
    const objectName = (value: unknown) => (value as { objectName?: string })?.objectName
    assert.equal(objectName(field(configured, 'Projectile', 'ObjectProperty').value), `${path.basename(arrow.path)}_C`)
    assert.equal(objectName(field(props, 'GearActor', 'ObjectProperty').value), `${path.basename(actor.path)}_C`)
    for (const name of ['DelaySeconds', 'DelaySecondsPerProjectile', 'AngleSpan', 'AngleOffset', 'MaxRandomizedAngleFactor']) assert.equal(field(configured, name, 'FloatProperty').value, 0)
    assert.equal(field(configured, 'NumberOfProjectiles', 'IntProperty').value, 1)
    assert.equal(field(configured, 'NonRandomFirstArrow', 'BoolProperty').value, true)
    assert.deepEqual(row.reviewedComponents.map((c) => c.class), ['DungeonsProjectileMovementComp', 'ImpactActionHandler', 'InheritableComponentHandler'])
    for (const component of row.reviewedComponents) {
      const e: (typeof arrow.exports)[number] | undefined = arrow.exports.find((entry) => entry.exportIndex === component.exportIndex)
      assert.equal(e?.references.class.objectName, component.class)
      assert.equal(e?.references.template.objectName, component.template)
      assert.deepEqual(e?.serialized.sourceRange, component.sourceRange)
      if (component.class === 'InheritableComponentHandler' && purple) {
        assert.deepEqual(component.propertyNames, ['Records'])
        assert.deepEqual(component.overrideClasses, ['ParticleSystemComponent'])
      } else {
        assert.deepEqual(component.propertyNames, [])
        assert.equal(component.sourceRange.end - component.sourceRange.start, 12)
      }
    }
  }
  const cue = source.purpleChargeCue
  assert.equal(cue.path, 'Dungeons/Content/Cues/BP_PurpleRainChargeShotNotifyStatic')
  assert.equal(cue.parent, 'BP_BaseBowChargeShotNotifyStatic_C')
  assert.equal(cue.particle, 'PS_PurpleRain_ChargedArrowLaunch')
  assert.deepEqual(cue.onlyExports, ['BP_PurpleRainChargeShotNotifyStatic_C', 'Default__BP_PurpleRainChargeShotNotifyStatic_C'])
  assert.deepEqual(cue.base.range, [140, 414])
  assert.equal(cue.base.byteCount, 274)
  assert.equal(cue.base.expanded, 446)
  assert.equal(cue.base.scriptSha256, '657ec0923ae6dda480edc38044031fcd0715485f82dd86cef50f506662da029f')
  assert.deepEqual(cue.base.callList, [
    ['GetActorForwardVector', 'Actor'], ['Multiply_VectorFloat', 'KismetMathLibrary'], ['K2_GetActorLocation', 'Actor'],
    ['K2_GetActorRotation', 'Actor'], ['Add_VectorVector', 'KismetMathLibrary'], ['SpawnEmitterAtLocation', 'GameplayStatics'],
    ['SetColorParameter', 'ParticleSystemComponent'], ['OnExecute', 'GameplayCueNotify_Static'],
  ])
}

/** Local replay checks the retained original package and localization bytes. */
export function replayFixedRapidFireLocalSources(dataset: string): void {
  const read = (asset: string) => fs.readFileSync(path.join(dataset, asset))
  const bytes = read(source.localizationSource.source.relativePath)
  assert.equal(hash(bytes), source.localizationSource.source.sha256)
  const { entries } = parseLocresV2(bytes)
  for (const row of source.rows) assert.deepEqual(entries.filter((entry) => entry.namespace === 'ItemType' && entry.key === row.rawIdentity), [row.localization])
  const cue = source.purpleChargeCue
  for (const file of cue.sourceFiles) assert.equal(hash(read(`${cue.path}.${file.extension}`)), file.sha256)
  for (const [index, extension] of ['uasset', 'uexp'].entries()) assert.equal(hash(read(`${cue.base.path}.${extension}`)), cue.base.sourceFiles[index])
  assert.equal(hash(read(`${cue.base.path}.uexp`).subarray(...cue.base.range as [number, number])), cue.base.scriptSha256)
}
