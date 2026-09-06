import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createPhase65CExtractionRecord, EVIDENCE_LAYERS,
  validateGameDataProvenanceRecord, type GameDataProvenanceRecord,
} from '../src/research/gameDataProvenance'
import {
  buildGameDataSourceProvenance, collectGameDataProvenanceErrors, serializeProvenance,
} from '../scripts/game-data-provenance'
import type { GameDataInventory } from '../scripts/game-data-inventory'

const inventory = JSON.parse(fs.readFileSync('research/game-data-inventory.json', 'utf8')) as GameDataInventory

describe('Phase 6.5B game data provenance', () => {
  it('generates deterministic provenance linked to the committed inventory', () => {
    const first = buildGameDataSourceProvenance(inventory)
    const second = buildGameDataSourceProvenance(structuredClone(inventory))

    expect(serializeProvenance(first)).toBe(serializeProvenance(second))
    expect(first.dataset.sourceFingerprint).toEqual(inventory.sourceFingerprint)
    expect(first.dataset.totals).toEqual({ files: inventory.totals.files, bytes: inventory.totals.bytes })
    expect(collectGameDataProvenanceErrors(first, inventory)).toEqual([])
  })

  it('does not serialize local paths and preserves the default trust boundary', () => {
    const provenance = buildGameDataSourceProvenance(inventory)
    const serialized = serializeProvenance(provenance)

    expect(serialized).not.toMatch(/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//)
    expect(provenance.verification.claimedVersion.status).toBe('claimed')
    expect(provenance.verification.archiveOrigin.status).toBe('unknown')
    expect(provenance.verification.originalPackageIdentity.status).toBe('unknown')
    expect(provenance.verification.extractionProcedure.status).toBe('unknown')
    expect(provenance.verification.extractionTool.status).toBe('claimed')
    expect(provenance.boundaries.runtimePromotionAutomatic).toBe(false)
    expect(provenance.boundaries.ciRequiresLocalSource).toBe(false)
  })

  it('keeps evidence layers ordered and all confidence axes distinct', () => {
    const provenance = buildGameDataSourceProvenance(inventory)

    expect(provenance.evidenceLayers.map((layer) => layer.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(provenance.evidenceLayers.map((layer) => layer.id)).toEqual(EVIDENCE_LAYERS.map((layer) => layer.id))
    expect(provenance.confidenceAxes.map((axis) => axis.id)).toEqual(['source', 'extraction', 'semantics', 'version'])
  })

  it('creates a valid Phase 6.5C extracted record without semantic promotion', () => {
    const record = createPhase65CExtractionRecord({
      id: 'scatter-crossbow-number-of-projectiles',
      datasetId: buildGameDataSourceProvenance(inventory).dataset.id,
      assetPath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance',
      sourceFiles: [
        'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uasset',
        'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uexp',
      ],
      extraction: {
        parserId: 'ue4-package-property-parser',
        parserSchemaVersion: 1,
        objectName: 'Default__BP_ScatterCrossbowInstance_C',
        propertyName: 'NumberOfProjectiles',
        propertyType: 'IntProperty',
      },
      rawObservation: { value: 3 },
      confidence: { source: 'medium', extraction: 'high', semantics: 'unknown', version: 'low' },
      crossCheckStatus: 'not-compared',
      status: 'extracted',
    })

    expect(record.status).toBe('extracted')
    expect(record.promotionStatus).toBe('research-only')
    expect(record.interpretation).toBeUndefined()
    expect(validateGameDataProvenanceRecord(record)).toEqual([])
  })

  it('rejects absolute paths and normalized values that overwrite the raw layer', () => {
    const invalid = {
      id: 'invalid', datasetId: 'dataset',
      asset: { path: '/Users/example/asset', files: ['/Users/example/asset.uasset'] },
      extraction: { parserId: 'parser', parserSchemaVersion: 1 },
      rawObservation: { value: 0.6000000238418579 },
      interpretation: { normalizedProperty: 'attackIntervalSeconds', mappingBasis: ['property-name-direct'] },
      confidence: { source: 'medium', extraction: 'medium', semantics: 'medium', version: 'low' },
      promotionStatus: 'research-only', status: 'normalized',
    } as GameDataProvenanceRecord

    expect(validateGameDataProvenanceRecord(invalid)).toEqual(expect.arrayContaining([
      'Asset path must be a canonical dataset-relative path',
      'Source files must be non-empty dataset-relative paths',
      'Normalized records require a separate normalized property and value',
    ]))
  })

  it('rejects interpretation on an extracted record', () => {
    const record = createPhase65CExtractionRecord({
      id: 'raw-damage', datasetId: buildGameDataSourceProvenance(inventory).dataset.id,
      assetPath: 'Dungeons/Content/example',
      sourceFiles: ['Dungeons/Content/example.uasset', 'Dungeons/Content/example.uexp'],
      extraction: { parserId: 'parser', parserSchemaVersion: 1, propertyName: 'damage', propertyType: 'FloatProperty' },
      rawObservation: { value: 50 },
      confidence: { source: 'medium', extraction: 'high', semantics: 'unknown', version: 'low' },
      status: 'extracted',
    })
    const invalid = { ...record, interpretation: { statement: 'weapon damage', mappingBasis: ['property-name-direct'] } } as GameDataProvenanceRecord

    expect(validateGameDataProvenanceRecord(invalid)).toContain('Extracted records must not contain interpretation')
  })
})
