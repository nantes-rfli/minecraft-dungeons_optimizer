import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance'
import {
  RAW_PACKAGE_CODE_PATHS, RAW_PACKAGE_SPECS, buildRawPackageCodeIdentity,
  collectRawPackageSnapshotErrors, serializeRawPackageSnapshot, type RawPackageSnapshot,
} from '../scripts/game-data-raw-package'

const provenance = JSON.parse(fs.readFileSync('research/sources/game-data-source-provenance.json', 'utf8')) as GameDataSourceProvenance
const snapshots = new Map(RAW_PACKAGE_SPECS.map((spec) => [
  spec.id, JSON.parse(fs.readFileSync(spec.artifactPath, 'utf8')) as RawPackageSnapshot,
]))
const fighters = snapshots.get('fighters-bindings-instance')!
const instance = snapshots.get('scatter-crossbow-instance')!
const projectile = snapshots.get('scatter-crossbow-projectile')!

describe('Step 3A Raw package snapshots', () => {
  it('validates all three package contracts without local game files', () => {
    for (const spec of RAW_PACKAGE_SPECS) {
      const snapshot = snapshots.get(spec.id)!
      expect(collectRawPackageSnapshotErrors(snapshot, provenance, process.cwd(), spec)).toEqual([])
      expect(snapshot.extraction.configuration.propertySelection).toBe('none')
      expect(snapshot.boundaries).toEqual({
        semanticFiltering: 'not-applied', domainIdentityMapping: 'not-applied',
        manualAnnotations: 'separate-not-included', rawBinaryBytes: 'not-committed',
      })
    }
  })

  it('keeps package-specific audit knowledge behind package specs', () => {
    expect(RAW_PACKAGE_SPECS.find((spec) => spec.id === 'fighters-bindings-instance')?.auditAssertions).toEqual(expect.any(Function))
    expect(RAW_PACKAGE_SPECS.find((spec) => spec.id === 'scatter-crossbow-instance')?.auditAssertions).toEqual(expect.any(Function))
    const sharedCollector = collectRawPackageSnapshotErrors.toString()
    expect(sharedCollector).not.toContain("spec.id === 'scatter-crossbow-instance'")
    expect(sharedCollector).not.toContain("serialized.includes('fighters-bindings')")
  })

  it('fingerprints snapshot-affecting code and detects code/run drift', () => {
    const current = buildRawPackageCodeIdentity(process.cwd())
    expect(fighters.extraction.codeIdentity).toEqual(current)
    expect(current.files.map((file) => file.path)).toEqual([...RAW_PACKAGE_CODE_PATHS].sort())
    const stale = { ...fighters, extraction: { ...fighters.extraction, codeIdentity: { ...fighters.extraction.codeIdentity, value: '0'.repeat(64) } } }
    const errors = collectRawPackageSnapshotErrors(stale, provenance, process.cwd(), RAW_PACKAGE_SPECS[0])
    expect(errors).toContain('Extractor/parser code identity does not match the current source code')
    expect(errors).toContain('Extraction run ID is not the deterministic content address')
  })

  it('isolates core/parser drift from package-spec and report-only changes', () => {
    const baseline = buildRawPackageCodeIdentity(process.cwd())
    const identityAfter = (relativePath: string, mutate: (source: string) => string) => buildRawPackageCodeIdentity(
      process.cwd(),
      (absolutePath) => {
        const bytes = fs.readFileSync(absolutePath)
        if (!absolutePath.endsWith(relativePath)) return bytes
        const source = bytes.toString('utf8')
        const changed = mutate(source)
        if (changed === source) throw new Error(`Drift fixture did not change ${relativePath}`)
        return Buffer.from(changed)
      },
    )
    const rawPackagePath = 'scripts/game-data-raw-package.ts'

    const specOnly = identityAfter(rawPackagePath, (source) => source.replace(
      "'scatter-crossbow-projectile',\n    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow'",
      "'another-package-spec',\n    'Dungeons/Content/Actors/Equipment/RangedWeapons/AnotherPackage'",
    ))
    const reportOnly = identityAfter(rawPackagePath, (source) => source.replace(
      'This generated artifact covers the deliberately small three-package Raw flow:',
      'Report-only wording changed.',
    ))
    const coreDrift = identityAfter(rawPackagePath, (source) => source.replace(
      'strictPropertyTermination: false', 'strictPropertyTermination: true',
    ))
    const parserDrift = identityAfter('src/research/ue4/propertyReader.ts', (source) => `${source}\n// parser drift fixture\n`)

    expect(specOnly).toEqual(baseline)
    expect(reportOnly).toEqual(baseline)
    expect(coreDrift.value).not.toBe(baseline.value)
    expect(parserDrift.value).not.toBe(baseline.value)
  })

  it('keeps Fighter’s Bindings auditable under the unchanged Raw contract', () => {
    const cdo = fighters.package.objects.find((object) => object.extraction.state === 'decoded')
    const variants = cdo?.properties?.[0]
    const firstDamage = variants?.decoding.elements?.[0]?.properties?.find((property) => property.name.value === 'Damage')
    expect(variants).toMatchObject({ order: 0, name: { value: 'ConfiguredAttackVariants' }, type: { value: 'ArrayProperty' } })
    expect(variants?.decoding.elements).toHaveLength(4)
    expect(firstDamage?.decoding).toEqual({ state: 'decoded', value: 25 })
    expect(serializeRawPackageSnapshot(fighters)).not.toContain('fighters-bindings')
  })

  it('retains Scatter Crossbow Instance raw observations without interpretation', () => {
    expect(rawValue(instance, 'ItemIdName')).toBe('ScatterCrossbow')
    expect(rawValue(instance, 'ItemId.SerializedId')).toBe('ScatterCrossbow')
    expect(rawValue(instance, 'AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles')).toBe(3)
    expect(rawValue(instance, 'AttackDefintion.ProjectileDefinition[0].AngleSpan')).toBe(20)
    expect(rawValue(instance, 'AttackDefintion.AttackRateSeconds')).toBe(0.6000000238418579)
    expect(rawValue(instance, 'ProjectileStackCount')).toBe(40)
    expect(serializeRawPackageSnapshot(instance)).not.toMatch(/ammo|quiver|effectiveCadence|spread|chargeable/i)
  })

  it('retains the package-local projectile index, Import Table, and outer chain', () => {
    expect(rawValue(instance, 'AttackDefintion.ProjectileDefinition[0].Projectile')).toEqual({
      rawPackageIndex: -5, kind: 'import', index: 4,
      objectName: 'BP_ScatterCrossBow_Arrow_C', className: 'BlueprintGeneratedClass',
    })
    expect(instance.package.imports[4]).toMatchObject({
      rawPackageIndex: -5, outerIndex: -21, objectName: { value: 'BP_ScatterCrossBow_Arrow_C' },
      outerReference: { rawPackageIndex: -21, kind: 'import' },
    })
    expect(instance.package.imports[20]).toMatchObject({
      rawPackageIndex: -21, outerIndex: 0,
      objectName: { value: '/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow' },
      outerReference: { rawPackageIndex: 0, kind: 'null' },
    })
  })

  it('retains projectile values and independent identities', () => {
    expect(rawValue(projectile, 'damage')).toBe(50)
    expect(rawValue(projectile, 'pushback.enablePushback')).toBe(true)
    expect(rawValue(projectile, 'pushback.pushbackStrength')).toBe(0.6000000238418579)
    expect(rawValue(projectile, 'IgnoreFriendlyFire')).toBe(true)
    expect(rawValue(projectile, 'HomingThreshold')).toBe(150)
    expect(new Set([fighters, instance, projectile].map((snapshot) => snapshot.logicalPackage.contentHash.value)).size).toBe(3)
    expect(new Set([fighters, instance, projectile].map((snapshot) => snapshot.extraction.runId)).size).toBe(3)
    expect(new Set([fighters, instance, projectile].flatMap((snapshot) => snapshot.logicalPackage.sourceFiles.map((file) => file.path))).size).toBe(6)
  })
})

function rawValue(snapshot: RawPackageSnapshot, propertyPath: string): unknown {
  const cdo = snapshot.package.objects.find((object) => object.extraction.state === 'decoded')
  const queue = [...(cdo?.properties ?? [])]
  while (queue.length) {
    const property = queue.shift()!
    if (property.path === propertyPath) return property.decoding.value
    queue.push(...(property.decoding.properties ?? []))
    property.decoding.elements?.forEach((element) => queue.push(...(element.properties ?? [])))
  }
  return undefined
}
