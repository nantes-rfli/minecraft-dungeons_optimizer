import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GameDataProvenanceRecord, GameDataSourceProvenance } from '../src/research/gameDataProvenance'
import {
  collectSemanticMappingErrors, serializeSemanticMapping,
  type GameDataSemanticMappingArtifact,
} from '../src/research/gameDataSemanticMapping'
import type { GameDataExtractorArtifact } from '../scripts/game-data-extractor'
import {
  buildGameDataSemanticMappingArtifact,
  type GameDataSemanticSourceArtifact,
} from '../scripts/game-data-semantic-mapping'

const provenance = JSON.parse(fs.readFileSync('research/sources/game-data-source-provenance.json', 'utf8')) as GameDataSourceProvenance
const extractor = JSON.parse(fs.readFileSync('research/raw/game-data-extractor-samples.json', 'utf8')) as GameDataExtractorArtifact
const semanticSource = JSON.parse(fs.readFileSync('research/raw/game-data-semantic-source-samples.json', 'utf8')) as GameDataSemanticSourceArtifact
const sourceHarvest = JSON.parse(fs.readFileSync('research/source-harvest.json', 'utf8')) as { sources: readonly { id: string }[] }
const sourceRecords: GameDataProvenanceRecord[] = [...extractor.records, ...semanticSource.records]
const sourceIds = new Set(sourceHarvest.sources.map((source) => source.id))

const validate = (artifact: GameDataSemanticMappingArtifact): string[] => collectSemanticMappingErrors(artifact, sourceRecords, sourceIds)

describe('Phase 6.5D representative semantic mapping', () => {
  it('accepts a linked mapping while retaining separate raw and normalized layers', () => {
    const artifact = buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords)
    const projectileCount = artifact.mappings.find((mapping) => mapping.id === 'scatter-crossbow--number-of-projectiles--projectile-count')

    expect(validate(artifact)).toEqual([])
    expect(projectileCount?.raw.value).toBe(3)
    expect(projectileCount?.interpretation).toMatchObject({ status: 'accepted', normalizedProperty: 'ranged.projectileCount', normalizedValue: 3 })
    expect(projectileCount?.runtimePromotion).toBe('not-performed')
  })

  it('keeps damage=50 as an unresolved negative control', () => {
    const artifact = buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords)
    const damage = artifact.mappings.find((mapping) => mapping.raw.propertyPath === 'damage' && mapping.raw.value === 50)

    expect(damage?.interpretation.status).toBe('unresolved')
    expect(damage?.interpretation.normalizedProperty).toBeUndefined()
    expect(damage?.interpretation.normalizedValue).toBeUndefined()
  })

  it('rejects a missing source record link', () => {
    const artifact = structuredClone(buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords))
    Object.assign(artifact.mappings[0]!, { sourceRecordIds: ['missing-record'] })

    expect(validate(artifact)).toEqual(expect.arrayContaining([
      expect.stringContaining('source record does not exist: missing-record'),
    ]))
  })

  it('rejects raw value drift from the extracted source', () => {
    const artifact = structuredClone(buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords))
    Object.assign(artifact.mappings[0]!.raw, { value: 'changed' })

    expect(validate(artifact)).toContain(`${artifact.mappings[0]!.id}: raw property or value does not match a linked extracted record`)
  })

  it('rejects an accepted mapping with conflicting cross-check evidence', () => {
    const artifact = structuredClone(buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords))
    const accepted = artifact.mappings.find((mapping) => mapping.interpretation.status === 'accepted')!
    Object.assign(accepted.crossCheck, { status: 'conflicts' })

    expect(validate(artifact)).toContain(`${accepted.id}: accepted mapping cannot conflict with cross-check evidence`)
  })

  it('rejects an accepted mapping without a registered normalized property', () => {
    const artifact = structuredClone(buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords))
    const accepted = artifact.mappings.find((mapping) => mapping.interpretation.status === 'accepted')!
    Object.assign(accepted.interpretation, { normalizedProperty: undefined, normalizedValue: undefined })

    expect(validate(artifact)).toContain(`${accepted.id}: accepted mapping requires a normalized property and value`)
  })

  it('generates deterministically from committed extracted records', () => {
    const first = buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords)
    const second = buildGameDataSemanticMappingArtifact(provenance.dataset.id, structuredClone(sourceRecords))

    expect(serializeSemanticMapping(first)).toBe(serializeSemanticMapping(second))
  })

  it('does not allow version confidence to silently become verified', () => {
    const artifact = structuredClone(buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords))
    Object.assign(artifact.mappings[0]!.confidence, { version: 'verified' })

    expect(validate(artifact)).toContain(`${artifact.mappings[0]!.id}: version confidence must preserve the unverified 6.5B boundary`)
  })
})
