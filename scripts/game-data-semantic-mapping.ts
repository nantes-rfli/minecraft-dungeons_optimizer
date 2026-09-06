import fs from 'node:fs'
import path from 'node:path'
import {
  createPhase65CExtractionRecord, validateGameDataProvenanceRecord,
  type CrossCheckStatus, type GameDataConfidence, type GameDataProvenanceRecord,
  type JsonValue, type MappingBasis,
} from '../src/research/gameDataProvenance.ts'
import {
  NORMALIZED_GAME_DATA_PROPERTIES, SEMANTIC_MAPPING_SCHEMA_VERSION,
  buildSemanticMappingSummary, serializeSemanticMapping,
  type GameDataSemanticMappingArtifact, type GameDataSemanticMappingRecord,
  type SemanticMappingCategory, type SemanticMappingStatus,
} from '../src/research/gameDataSemanticMapping.ts'
import { parseUePackage } from '../src/research/ue4/packageReader.ts'
import type { UeDiagnostic } from '../src/research/ue4/packageTypes.ts'
import {
  PARSER_ID, PARSER_SCHEMA_VERSION, assertSafeAssetPath, flattenProperties,
  hashLogicalAsset, localDatasetRoot,
} from './game-data-extractor.ts'

export const SEMANTIC_SOURCE_SCHEMA_VERSION = 1 as const

interface SemanticSourceSelection {
  readonly propertyPath: string
  readonly structuralPropertyCount?: true
}

export const SEMANTIC_SAMPLE_ASSETS: Readonly<Record<string, readonly SemanticSourceSelection[]>> = {
  'Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance': [
    { propertyPath: 'ConfiguredAttackVariants[0].AttackAnimationTimeDurationSeconds' },
    { propertyPath: 'ConfiguredAttackVariants[0].Damage' },
  ],
  'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance': [
    { propertyPath: 'Effect' },
  ],
  'Dungeons/Content/Components/ArmorProperties/ItemCooldownDecrease/BP_ItemCooldownDecrease': [
    { propertyPath: 'Effect' },
    { propertyPath: 'PropertyColorPrio.Prio' },
  ],
  'Dungeons/Content/Components/Enchantments/RapidFire/BP_RapidFire': [
    { propertyPath: '$cdo.declaredPropertyCount', structuralPropertyCount: true },
  ],
} as const

export interface GameDataSemanticSourceAsset {
  readonly path: string
  readonly files: readonly string[]
  readonly contentHash: { readonly algorithm: 'sha256'; readonly value: string }
  readonly objectName: string
  readonly className?: string
  readonly parsedPropertyCount: number
  readonly selectedRecordCount: number
  readonly diagnosticCount: number
}

export interface GameDataSemanticSourceArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly parser: { readonly id: typeof PARSER_ID; readonly schemaVersion: typeof PARSER_SCHEMA_VERSION }
  readonly selection: {
    readonly purpose: 'phase-6.5d-representative-semantic-source'
    readonly maximumReferenceDepth: 2
  }
  readonly assets: readonly GameDataSemanticSourceAsset[]
  readonly records: readonly GameDataProvenanceRecord[]
  readonly diagnostics: readonly UeDiagnostic[]
}

export function hasSemanticLocalSource(repositoryRoot: string): boolean {
  const root = localDatasetRoot(repositoryRoot)
  return Object.keys(SEMANTIC_SAMPLE_ASSETS).every((assetPath) => ['.uasset', '.uexp'].every((extension) => fs.existsSync(path.join(root, `${assetPath}${extension}`))))
}

export function buildGameDataSemanticSourceArtifact(repositoryRoot: string, datasetId: string): GameDataSemanticSourceArtifact {
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const assetPaths = Object.keys(SEMANTIC_SAMPLE_ASSETS).sort()
  const records: GameDataProvenanceRecord[] = []
  const diagnostics: UeDiagnostic[] = []
  const assets = assetPaths.map((assetPath): GameDataSemanticSourceAsset => {
    assertSafeAssetPath(assetPath)
    const files = ['.uasset', '.uexp'].map((extension) => `${assetPath}${extension}`)
    const parsed = parseUePackage(fs.readFileSync(path.join(datasetRoot, files[0]!)), fs.readFileSync(path.join(datasetRoot, files[1]!)), { assetPath })
    const cdo = parsed.objects[0]
    if (!cdo) throw new Error(`No class default object found for ${assetPath}`)
    const properties = flattenProperties(cdo.properties)
    const contentHash = { algorithm: 'sha256' as const, value: hashLogicalAsset(datasetRoot, files) }
    const assetName = assetPath.slice(assetPath.lastIndexOf('/') + 1)
    const sourceRecords = SEMANTIC_SAMPLE_ASSETS[assetPath]!.map((selection) => {
      const property = selection.structuralPropertyCount ? undefined : properties.find((candidate) => candidate.path === selection.propertyPath)
      if (!selection.structuralPropertyCount && !property) throw new Error(`Selected property ${selection.propertyPath} was not found in ${assetPath}`)
      return createPhase65CExtractionRecord({
        id: `${slug(assetName)}--${slug(selection.propertyPath)}`,
        datasetId,
        assetPath,
        sourceFiles: files,
        contentHash,
        extraction: {
          parserId: PARSER_ID,
          parserSchemaVersion: PARSER_SCHEMA_VERSION,
          objectName: cdo.objectName,
          ...(cdo.className ? { className: cdo.className } : {}),
          propertyName: selection.structuralPropertyCount ? '$cdo.declaredPropertyCount' : property!.name,
          propertyPath: selection.propertyPath,
          propertyType: selection.structuralPropertyCount ? 'StructuralObservation' : property!.type,
        },
        rawObservation: { value: selection.structuralPropertyCount ? properties.length : property!.value },
        confidence: { source: 'medium', extraction: 'high', semantics: 'unknown', version: 'low' },
        crossCheckStatus: 'not-compared',
        status: 'extracted',
      })
    })
    records.push(...sourceRecords)
    diagnostics.push(...parsed.diagnostics)
    return {
      path: assetPath,
      files,
      contentHash,
      objectName: cdo.objectName,
      ...(cdo.className ? { className: cdo.className } : {}),
      parsedPropertyCount: properties.length,
      selectedRecordCount: sourceRecords.length,
      diagnosticCount: parsed.diagnostics.length,
    }
  })
  return {
    schemaVersion: SEMANTIC_SOURCE_SCHEMA_VERSION,
    datasetId,
    parser: { id: PARSER_ID, schemaVersion: PARSER_SCHEMA_VERSION },
    selection: { purpose: 'phase-6.5d-representative-semantic-source', maximumReferenceDepth: 2 },
    assets,
    records: records.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics: diagnostics.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  }
}

export function collectSemanticSourceErrors(artifact: GameDataSemanticSourceArtifact, expectedDatasetId: string): string[] {
  const errors: string[] = []
  const serialized = serializeSemanticMapping(artifact)
  const expectedAssets = Object.keys(SEMANTIC_SAMPLE_ASSETS).sort()
  if (artifact.schemaVersion !== SEMANTIC_SOURCE_SCHEMA_VERSION) errors.push('Unsupported semantic source schema version')
  if (artifact.datasetId !== expectedDatasetId) errors.push('Semantic source datasetId does not match provenance')
  if (artifact.parser.id !== PARSER_ID || artifact.parser.schemaVersion !== PARSER_SCHEMA_VERSION) errors.push('Semantic source parser identity is invalid')
  if (artifact.selection.maximumReferenceDepth !== 2) errors.push('Semantic source reference depth boundary changed')
  if (JSON.stringify(artifact.assets.map((asset) => asset.path)) !== JSON.stringify(expectedAssets)) errors.push('Semantic sample assets are missing or out of order')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(serialized)) errors.push('Semantic source artifact contains a local absolute or private path')
  if (serialized.includes('NaN') || serialized.includes('Infinity')) errors.push('Semantic source artifact contains a non-finite number')
  const recordIds = artifact.records.map((record) => record.id)
  if (new Set(recordIds).size !== recordIds.length) errors.push('Semantic source artifact contains duplicate record IDs')
  if (JSON.stringify(recordIds) !== JSON.stringify([...recordIds].sort())) errors.push('Semantic source records are not deterministically ordered')
  for (const record of artifact.records) {
    errors.push(...validateGameDataProvenanceRecord(record).map((error) => `${record.id}: ${error}`))
    if (record.datasetId !== expectedDatasetId) errors.push(`${record.id}: datasetId does not match provenance`)
    if (record.status !== 'extracted' || record.interpretation || record.promotionStatus !== 'research-only') errors.push(`${record.id}: semantic source must remain immutable extracted evidence`)
    if (record.confidence.semantics !== 'unknown' || record.confidence.version !== 'low') errors.push(`${record.id}: source confidence boundary changed`)
  }
  for (const asset of artifact.assets) {
    if (asset.files.length !== 2 || !asset.files.includes(`${asset.path}.uasset`) || !asset.files.includes(`${asset.path}.uexp`)) errors.push(`${asset.path}: semantic source companion files are invalid`)
    if (!/^[a-f0-9]{64}$/.test(asset.contentHash.value)) errors.push(`${asset.path}: semantic source content hash is invalid`)
    if (asset.selectedRecordCount !== artifact.records.filter((record) => record.asset.path === asset.path).length) errors.push(`${asset.path}: selected record count is inconsistent`)
  }
  if (artifact.records.length !== artifact.assets.reduce((total, asset) => total + asset.selectedRecordCount, 0)) errors.push('Semantic source selected record counts do not match')
  return [...new Set(errors)].sort()
}

interface MappingDefinition {
  readonly id: string
  readonly sourceRecordId: string
  readonly category: SemanticMappingCategory
  readonly entity: string
  readonly statement: string
  readonly normalizedProperty?: string
  readonly normalizedValue?: JsonValue
  readonly normalizationRule?: string
  readonly mappingBasis: readonly MappingBasis[]
  readonly status: SemanticMappingStatus
  readonly note: string
  readonly semantics: GameDataConfidence
  readonly crossCheckStatus: CrossCheckStatus
  readonly crossCheckSourceIds?: readonly string[]
  readonly crossCheckNote: string
}

const MAPPING_DEFINITIONS: readonly MappingDefinition[] = [
  {
    id: 'armor-item-cooldown--effect--gameplay-effect-class',
    sourceRecordId: 'bp-item-cooldown-decrease--effect', category: 'armor-property', entity: 'Item Cooldown Decrease',
    statement: 'The armor property structurally references ItemCooldownDecreaseGameplayEffect as its applied effect class.',
    normalizedProperty: 'armor.gameplayEffectClass', normalizedValue: 'ItemCooldownDecreaseGameplayEffect',
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'accepted',
    note: 'This accepts only the effect-class relationship; no cooldown reduction magnitude or stacking rule is inferred.',
    semantics: 'high', crossCheckStatus: 'semantics-not-comparable',
    crossCheckNote: 'Existing public evidence discusses cooldown reduction behavior, not the internal gameplay-effect class reference.',
  },
  {
    id: 'armor-item-cooldown--property-color-prio--rejected-reduction',
    sourceRecordId: 'bp-item-cooldown-decrease--property-color-prio-prio', category: 'armor-property', entity: 'Item Cooldown Decrease',
    statement: 'PropertyColorPrio.Prio=13 is presentation priority metadata and is rejected as a cooldown-reduction magnitude.',
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'rejected',
    note: 'The enclosing PropertyColorPrio structure identifies UI color/priority context; treating 13 as a percentage would cross the semantic boundary.',
    semantics: 'high', crossCheckStatus: 'semantics-not-comparable',
    crossCheckNote: 'Public cooldown values do not make UI priority metadata a gameplay modifier.',
  },
  {
    id: 'death-cap-mushroom--effect--gameplay-effect-class',
    sourceRecordId: 'bp-death-cap-mushroom-instance--effect', category: 'artifact', entity: 'Death Cap Mushroom',
    statement: 'The artifact instance structurally references BP_DeathCapMushroomGameplayEffect_C as its gameplay effect class.',
    normalizedProperty: 'artifact.gameplayEffectClass', normalizedValue: 'BP_DeathCapMushroomGameplayEffect_C',
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'accepted',
    note: 'The link supports the artifact-to-effect relationship only; duration, attack speed, and movement speed remain outside this mapping.',
    semantics: 'high', crossCheckStatus: 'semantics-not-comparable',
    crossCheckSourceIds: ['external:external-dungeons-tools:artifact:death-cap-mushroom'],
    crossCheckNote: 'The public artifact page supports the artifact identity and buff role but does not expose this internal class reference.',
  },
  {
    id: 'double-axe--attack-animation-duration--attack-animation-duration-seconds',
    sourceRecordId: 'bp-double-axe-instance--configured-attack-variants-0-attack-animation-time-duration-seconds', category: 'melee-weapon', entity: 'Double Axe',
    statement: 'The first configured Double Axe attack variant serializes an attack animation duration of 0.6000000238418579 seconds.',
    normalizedProperty: 'melee.attackAnimationDurationSeconds', normalizedValue: 0.6000000238418579,
    normalizationRule: 'Raw float precision retained; the public table displays the equivalent value as 0.6 seconds.',
    mappingBasis: ['property-name-direct', 'class-context', 'cross-source-match', 'manual-review'], status: 'accepted',
    note: 'This is a configured variant duration, not proof of the complete effective attack cycle under all modifiers.',
    semantics: 'high', crossCheckStatus: 'matches',
    crossCheckSourceIds: ['melee-weapon:https-minecraft-wiki-w-dungeons-3adouble-axe'],
    crossCheckNote: 'The existing source harvest records a 0.6-second first hit and two-hit 1.2-second combo.',
  },
  {
    id: 'double-axe--damage--final-damage',
    sourceRecordId: 'bp-double-axe-instance--configured-attack-variants-0-damage', category: 'melee-weapon', entity: 'Double Axe',
    statement: 'The configured attack variant contains Damage=100, but final card or Power-scaled damage semantics are not established.',
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'unresolved',
    note: 'Power scaling, difficulty, buffs, and native calculation context are not resolved, so no normalized final-damage property is created.',
    semantics: 'unknown', crossCheckStatus: 'semantics-not-comparable',
    crossCheckSourceIds: ['melee-weapon:https-minecraft-wiki-w-dungeons-3adouble-axe'],
    crossCheckNote: 'The public per-hit ratio table cannot identify the serialized base scalar as a final displayed damage value.',
  },
  {
    id: 'rapid-fire--empty-cdo--ranged-attack-speed-modifier',
    sourceRecordId: 'bp-rapid-fire--cdo-declared-property-count', category: 'enchantment', entity: 'Rapid Fire',
    statement: 'The Rapid Fire CDO exposes zero parsed declared properties in this package, so no raw attack-speed modifier can be mapped.',
    mappingBasis: ['class-context', 'inheritance-context', 'manual-review'], status: 'unresolved',
    note: 'The tier values may be inherited, native, or stored in a referenced/default object not resolved within the representative depth-two boundary.',
    semantics: 'unknown', crossCheckStatus: 'partially-matches',
    crossCheckSourceIds: ['external:external-dungeons-tools:ranged-enchantment:rapid-fire'],
    crossCheckNote: 'Public evidence confirms +10%/+15%/+20% attack-speed tiers, but the representative asset contains no serialized property linking those values.',
  },
  {
    id: 'scatter-crossbow--attack-rate-seconds--attack-rate-seconds',
    sourceRecordId: 'bp-scatter-crossbow-instance--attack-defintion-attack-rate-seconds', category: 'ranged-weapon', entity: 'Scatter Crossbow',
    statement: 'AttackDefintion.AttackRateSeconds serializes 0.6000000238418579 seconds for the Scatter Crossbow instance.',
    normalizedProperty: 'ranged.attackRateSeconds', normalizedValue: 0.6000000238418579,
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'tentative',
    note: 'The field name supplies the unit, but whether it represents fire-cycle cadence, input cooldown, or another effective interval remains unresolved.',
    semantics: 'medium', crossCheckStatus: 'public-source-missing',
    crossCheckSourceIds: ['external:external-dungeons-tools:ranged-weapon:scatter-crossbow'],
    crossCheckNote: 'The existing public detail source does not expose a quantitative cadence value for comparison.',
  },
  {
    id: 'scatter-crossbow--damage--final-damage',
    sourceRecordId: 'bp-scatter-cross-bow-arrow--damage', category: 'ranged-weapon', entity: 'Scatter Crossbow projectile',
    statement: 'The raw projectile class contains FloatProperty damage=50, but final displayed or runtime damage semantics are not established.',
    mappingBasis: ['property-name-direct', 'class-context', 'manual-review'], status: 'unresolved',
    note: 'The scalar may participate in Power scaling or native calculations; raw value presence is not sufficient to create finalDamage=50.',
    semantics: 'unknown', crossCheckStatus: 'semantics-not-comparable',
    crossCheckSourceIds: ['external:external-dungeons-tools:ranged-weapon:scatter-crossbow'],
    crossCheckNote: 'The public source identifies three projectiles but does not establish how the raw damage scalar becomes displayed damage.',
  },
  {
    id: 'scatter-crossbow--number-of-projectiles--projectile-count',
    sourceRecordId: 'bp-scatter-crossbow-instance--attack-defintion-projectile-definition-0-number-of-projectiles', category: 'ranged-weapon', entity: 'Scatter Crossbow',
    statement: 'NumberOfProjectiles=3 specifies three projectile spawn entries for the configured ranged attack definition.',
    normalizedProperty: 'ranged.projectileCount', normalizedValue: 3,
    mappingBasis: ['property-name-direct', 'class-context', 'cross-source-match', 'manual-review'], status: 'accepted',
    note: 'The direct property name, nested projectile-definition context, and independent public count agree.',
    semantics: 'high', crossCheckStatus: 'matches',
    crossCheckSourceIds: ['external:external-dungeons-tools:ranged-weapon:scatter-crossbow'],
    crossCheckNote: 'The existing source harvest independently records projectileCount=3 for Scatter Crossbow.',
  },
] as const

export function buildGameDataSemanticMappingArtifact(datasetId: string, sourceRecords: readonly GameDataProvenanceRecord[]): GameDataSemanticMappingArtifact {
  const sourceById = new Map(sourceRecords.map((record) => [record.id, record]))
  const mappings = MAPPING_DEFINITIONS.map((definition): GameDataSemanticMappingRecord => {
    const source = sourceById.get(definition.sourceRecordId)
    if (!source?.extraction?.propertyPath || !source.extraction.propertyType || source.rawObservation === undefined) throw new Error(`Semantic source record is incomplete: ${definition.sourceRecordId}`)
    return {
      id: definition.id,
      datasetId,
      sourceRecordIds: [definition.sourceRecordId],
      category: definition.category,
      entity: definition.entity,
      raw: {
        assetPath: source.asset.path,
        ...(source.extraction.objectName ? { objectName: source.extraction.objectName } : {}),
        propertyPath: source.extraction.propertyPath,
        propertyType: source.extraction.propertyType,
        value: source.rawObservation.value,
      },
      interpretation: {
        statement: definition.statement,
        ...(definition.normalizedProperty ? { normalizedProperty: definition.normalizedProperty } : {}),
        ...(definition.normalizedValue !== undefined ? { normalizedValue: definition.normalizedValue } : {}),
        ...(definition.normalizationRule ? { normalizationRule: definition.normalizationRule } : {}),
        mappingBasis: definition.mappingBasis,
        status: definition.status,
        note: definition.note,
      },
      confidence: { source: 'medium', extraction: 'high', semantics: definition.semantics, version: 'low' },
      crossCheck: {
        status: definition.crossCheckStatus,
        ...(definition.crossCheckSourceIds ? { sourceIds: definition.crossCheckSourceIds } : {}),
        note: definition.crossCheckNote,
      },
      runtimePromotion: 'not-performed',
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
  return {
    schemaVersion: SEMANTIC_MAPPING_SCHEMA_VERSION,
    datasetId,
    sourceExtractor: { parserId: PARSER_ID, parserSchemaVersion: PARSER_SCHEMA_VERSION },
    normalizedProperties: [...NORMALIZED_GAME_DATA_PROPERTIES].sort((left, right) => left.id.localeCompare(right.id)),
    mappings,
    summary: buildSemanticMappingSummary(mappings),
  }
}

export function renderGameDataSemanticMappingReport(source: GameDataSemanticSourceArtifact, artifact: GameDataSemanticMappingArtifact): string {
  const table = (mappings: readonly GameDataSemanticMappingRecord[]): string => mappings.map((mapping) => {
    const normalized = mapping.interpretation.normalizedProperty ? `\`${mapping.interpretation.normalizedProperty}\` = \`${formatValue(mapping.interpretation.normalizedValue)}\`` : '—'
    return `| ${mapping.entity} | \`${mapping.raw.propertyPath}\` | \`${formatValue(mapping.raw.value)}\` | ${normalized} | ${mapping.interpretation.status} | ${mapping.confidence.semantics} | ${mapping.crossCheck.status} |`
  }).join('\n')
  const byStatus = (status: SemanticMappingStatus) => artifact.mappings.filter((mapping) => mapping.interpretation.status === status)
  const representativeRows: Readonly<Record<SemanticMappingCategory, string>> = {
    'ranged-weapon': 'Scatter Crossbow instance and projectile — direct projectile count, tentative cadence field, and raw damage boundary.',
    enchantment: 'Rapid Fire — zero declared CDO properties; inherited/native/default storage remains unresolved.',
    artifact: 'Death Cap Mushroom instance — artifact-to-GameplayEffect structural reference only.',
    'armor-property': 'Item Cooldown Decrease — effect-class reference plus rejected UI-priority-as-magnitude control.',
    'melee-weapon': 'Double Axe instance — first attack animation duration plus unresolved raw damage scalar.',
  }
  const assetRows = source.assets.map((asset) => `| \`${asset.path}\` | ${asset.parsedPropertyCount} | ${asset.selectedRecordCount} | ${asset.diagnosticCount} |`).join('\n')
  return `# Game Data Semantic Mapping — Phase 6.5D

## Overview

Phase 6.5D keeps the Phase 6.5C extracted records immutable and adds a separate semantic layer. It maps representative raw structural facts to normalized **research** properties only when the meaning is supportable. No runtime catalog, Optimizer value, support manifest, evidence Gap, or score is changed.

## Method

\`Extracted structural fact → context review → public/project evidence cross-check → semantic status → normalized research property\`

The parser remains \`${artifact.sourceExtractor.parserId}\` schema ${artifact.sourceExtractor.parserSchemaVersion}. Source and extraction confidence remain medium/high, while the dataset version stays low-confidence and publisher-claimed. Reference following is bounded to depth ${source.selection.maximumReferenceDepth}; inherited effective values and native behavior are not resolved automatically.

## Representative categories

${Object.entries(representativeRows).map(([category, description]) => `### ${category}\n\n${description}`).join('\n\n')}

## Representative source samples

| Parsed asset | Raw properties read | Selected records | Diagnostics |
| --- | ---: | ---: | ---: |
${assetRows}

The additional semantic sample set parses ${source.assets.length} logical assets and commits ${source.records.length} extracted source records. The three Scatter Crossbow source records remain in the unchanged Phase 6.5C artifact, for ${source.records.length + 3} linked records across ${source.assets.length + 2} representative logical assets.

## Accepted mappings

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
${table(byStatus('accepted'))}

## Tentative mappings

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
${table(byStatus('tentative'))}

The Scatter Crossbow \`AttackRateSeconds\` unit is supported by the property name, but effective cadence ownership is not established.

## Unresolved / rejected

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
${table([...byStatus('unresolved'), ...byStatus('rejected')])}

Rapid Fire's public +10%/+15%/+20% tiers are not copied into the game-data mapping because the representative CDO exposes no serialized property that links those values. The Item Cooldown Decrease \`PropertyColorPrio.Prio=13\` candidate is rejected because its surrounding structure is presentation metadata, not a gameplay percentage.

## Negative controls

- Scatter Crossbow projectile \`damage = 50\` remains unresolved; it is not mapped to final displayed or Power-scaled damage.
- Double Axe \`Damage = 100\` remains unresolved for the same scaling/native-context reason.
- Item Cooldown Decrease \`PropertyColorPrio.Prio = 13\` is explicitly rejected as a cooldown-reduction magnitude.

These controls enforce \`raw value present != semantic fact accepted\`.

## Cross-check sources

- Existing Source Harvest: dungeons.tools Scatter Crossbow (three projectiles), Rapid Fire (public tier values), and Death Cap Mushroom (artifact role).
- Existing Source Harvest: Minecraft Wiki Double Axe timing table (0.6 seconds per configured hit).
- Project evidence and runtime models were read only; no evidence hierarchy automatically overrides a conflict.

No cross-check conflict was found. Missing or non-comparable evidence remains explicit instead of being treated as agreement.

## Normalized property dictionary

| ID | Category | Unit | Boundary |
| --- | --- | --- | --- |
${artifact.normalizedProperties.map((property) => `| \`${property.id}\` | ${property.category} | ${property.unit ?? '—'} | ${property.description} |`).join('\n')}

## Limits

- No runtime promotion, runtime catalog change, Optimizer value change, or score/objective change.
- No bulk harvest, Gap reconciliation, or \`resolved-by-game-data\` assignment.
- Dataset version remains claimed \`1.17.0.0\` with low confidence.
- Inheritance, native behavior, complete GameplayEffect modifier traversal, and effective values may remain unresolved.
- This sample is representative, not exhaustive.
- Raw game assets and binary excerpts are not committed.

## Next step

Phase 6.5E — Bulk Harvest & Gap Reconciliation.
`
}

function slug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

function formatValue(value: JsonValue | undefined): string {
  return JSON.stringify(value).replaceAll('|', '\\|')
}

export { serializeSemanticMapping }
