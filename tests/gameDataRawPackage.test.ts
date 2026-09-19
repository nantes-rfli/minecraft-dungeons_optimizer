import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance'
import {
  collectRawPackageSnapshotErrors, serializeRawPackageSnapshot, type RawPackageSnapshot,
} from '../scripts/game-data-raw-package'

const snapshot = JSON.parse(fs.readFileSync('research/raw/packages/Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.raw.json', 'utf8')) as RawPackageSnapshot
const provenance = JSON.parse(fs.readFileSync('research/sources/game-data-source-provenance.json', 'utf8')) as GameDataSourceProvenance

describe('Step 3A Raw package snapshot', () => {
  it('retains one complete generated package result before semantics', () => {
    expect(collectRawPackageSnapshotErrors(snapshot, provenance)).toEqual([])
    expect(snapshot.extraction.configuration.propertySelection).toBe('none')
    expect(snapshot.boundaries.semanticFiltering).toBe('not-applied')
    expect(snapshot.boundaries.domainIdentityMapping).toBe('not-applied')
    expect(snapshot.boundaries.manualAnnotations).toBe('separate-not-included')
  })

  it('preserves source identity and explicit extraction states', () => {
    expect(snapshot.logicalPackage.sourceFiles).toEqual([
      expect.objectContaining({ size: 5607, sha256: '5d69dd6957b23704f35c5b5fca315c7b6bf53b9f8994445acf2547bd5065226c' }),
      expect.objectContaining({ size: 5558, sha256: 'a4793e11abfa8e5ecea3fab7f86f46cc9aa8a91486c6f6b5d78f85016952e86c' }),
    ])
    expect(snapshot.package.objects.map((object) => object.extraction.state)).toEqual([
      'not-extracted', 'decoded', 'not-extracted', 'not-extracted', 'not-extracted',
    ])
    expect(snapshot.package.objects.filter((object) => object.extraction.state === 'not-extracted').every((object) => object.unavailableRanges.length === 1)).toBe(true)
  })

  it('keeps the Raw property tree, ordering, indexes, metadata, ranges, and internal ID', () => {
    const cdo = snapshot.package.objects.find((object) => object.extraction.state === 'decoded')
    const variants = cdo?.properties?.[0]
    const firstDamage = variants?.decoding.elements?.[0]?.properties?.find((property) => property.name.value === 'Damage')
    const itemId = cdo?.properties?.find((property) => property.name.value === 'ItemIdName')

    expect(variants).toMatchObject({ order: 0, name: { value: 'ConfiguredAttackVariants' }, type: { value: 'ArrayProperty' }, arrayIndex: 0 })
    expect(variants?.metadata?.arrayStruct?.structType.value).toBe('MeleeAttackComponentAttackVariant')
    expect(firstDamage).toMatchObject({ type: { value: 'FloatProperty' }, decoding: { state: 'decoded', value: 25 } })
    expect(firstDamage?.byteRanges.tag.sourceFile).toMatch(/\.uexp$/)
    expect(itemId?.decoding).toEqual({ state: 'decoded', value: 'Gauntlets_Unique3' })
    expect(serializeRawPackageSnapshot(snapshot)).not.toContain('fighters-bindings')
  })
})
