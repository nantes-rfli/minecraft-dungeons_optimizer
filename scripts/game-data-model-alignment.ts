import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { CANONICAL_GAME_DATA_PROPERTIES, ALIGNED_RULE_DECISIONS, auditCanonicalProperties, type CanonicalResearchProperty } from '../src/research/gameDataCanonicalProperties.ts'
import { resolveAlignedGameDataEntity, type AlignedEntityResolution, type ResearchEntityIdentity } from '../src/research/gameDataEntityResolver.ts'
import { GAME_DATA_SEMANTIC_RULES } from '../src/research/gameDataSemanticRules.ts'
import type { EvidenceGap } from '../src/research/evidenceGapMap.ts'
import { loadInputs, classifyGap, serialize, type buildFinalCoverage } from './game-data-final-coverage.ts'
import { buildGapReconciliationArtifact, collectGapReconciliationErrors, type BulkSemanticMapping } from './game-data-gap-reconciliation.ts'

const unique = (xs: readonly string[]) => [...new Set(xs)].sort()
const counts = (xs: readonly string[]) => Object.fromEntries(unique(xs).map(key => [key, xs.filter(x => x === key).length]))
type BaselineDifferences = ReturnType<typeof buildFinalCoverage>['modelDifferences']
interface CatalogRecord { category: CanonicalResearchProperty['category']; id: string; known: { property: string; sourceIds: string[] }[] }

export const REVIEWED_ARTIFACT_ALIAS_BRIDGES = [
  { domainId: 'blast-fungus', rawIdentity: 'NetherWartSporeGrenade', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/NetherWartSporeGrenade/BP_NetherWartSporeGrenadeInstance' },
  { domainId: 'corrupted-pumpkin', rawIdentity: 'CorruptedBeacon_Spooky1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/CorruptedBeacon_Spooky1/BP_CorruptedBeacon_Spooky1Instance' },
  { domainId: 'enchanted-grass', rawIdentity: 'RainbowGrass', packagePath: 'Dungeons/Content/Patch2/Actors/Items/RainbowGrass/BP_RainbowGrassInstance' },
  { domainId: 'eye-of-the-guardian', rawIdentity: 'GuardianEye', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/GuardianEye/BP_GuardianEyeInstance' },
  { domainId: 'harpoon-quiver', rawIdentity: 'HeavyHarpoonQuiver', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/HeavyHarpoonQuiver/BP_HeavyHarpoonQuiverInstance' },
  { domainId: 'powershaker', rawIdentity: 'MobMasher', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/MobMasher/BP_MobMasherInstance' },
  { domainId: 'satchel-of-elements', rawIdentity: 'SatchelOfTheElements', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/SatchelOfTheElements/BP_SatchelOfTheElementsInstance' },
  { domainId: 'scatter-mines', rawIdentity: 'ChargedRedstoneMines', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMinesInstance' },
  { domainId: 'shadow-shifter', rawIdentity: 'ShadowSplinter', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Items/ShadowSplinter/BP_ShadowSplinterInstance' },
  { domainId: 'spinblade', rawIdentity: 'SpinWheel', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance' },
  { domainId: 'totem-of-casting', rawIdentity: 'SoulTotemOfCasting', packagePath: 'Dungeons/Content/Actors/Items/SoulTotemOfCasting/BP_SoulTotemOfCastingInstance' },
  { domainId: 'vexing-chant', rawIdentity: 'LostEvocation', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Items/LostEvocation/BP_LostEvocationInstance' },
  { domainId: 'buzzy-nest', rawIdentity: 'BeeNest', packagePath: 'Dungeons/Content/Patch2/Actors/Items/Beenest/BP_BeenestInstance' },
  { domainId: 'satchel-of-elixirs', rawIdentity: 'SatchelOfNeed', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/BP_SatchelOfNeedInstance' },
  { domainId: 'satchel-of-snacks', rawIdentity: 'SatchelOfNourishment', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/BP_SatchelofNourishmentInstance' },
] as const

export const REVIEWED_ARTIFACT_INDEPENDENT_SOURCE_BRIDGES = [
  { domainId: 'corrupted-seeds', rawIdentity: 'CorruptedSeeds', packagePath: 'Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance' },
] as const

export const INDEPENDENT_SOURCE_ARTIFACT_ALIAS_BASIS = 'serialized-item-id + independent-source-internal-id + catalog-category-evidence' as const

export const REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES = [
  {
    domainId: 'broken-sawblade',
    displayName: 'Broken Sawblade',
    rawIdentity: 'Chainsword',
    packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword/BP_ChainswordInstance',
    canonicalSource: { artifactPath: 'research/source-harvest.json', locator: 'records[category=melee-weapon,id=broken-sawblade]' },
    relationProperty: 'InventoryDropSound',
    edgeKind: 'soft-object-property',
    targetPackage: 'Dungeons/Content/AudioForce/D4/04_playback_soundCue/D4_sfx_item_brokensawbladePlace',
  },
  {
    domainId: 'mechanized-sawblade',
    displayName: 'Mechanized Sawblade',
    rawIdentity: 'Chainsword_Unique1',
    packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword_Unique1/BP_Chainsword_Unique1Instance',
    canonicalSource: { artifactPath: 'research/source-harvest.json', locator: 'records[category=melee-weapon,id=mechanized-sawblade]' },
    relationProperty: 'InventoryDropSound',
    edgeKind: 'soft-object-property',
    targetPackage: 'Dungeons/Content/AudioForce/D4/04_playback_soundCue/D4_sfx_item_mechanisedsawbladePlace',
  },
] as const

export const TYPED_RELATION_MELEE_ALIAS_BASIS = 'serialized-item-id + reviewed-typed-raw-relation + catalog-category-evidence' as const

export function loadAlignmentInputs(root: string) {
  const input = loadInputs(root)
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, `research/${baselineArtifactPaths[name] ?? name}.json`), 'utf8'))
  const baselineArtifactPaths: Record<string, string> = { 'game-data-bulk-harvest': 'raw/game-data-bulk-harvest', 'game-data-bulk-semantic-mappings': 'domain/game-data-bulk-semantic-mappings', 'game-data-gap-reconciliation': 'analysis/game-data-gap-reconciliation', 'game-data-final-coverage': 'analysis/game-data-final-coverage', 'game-data-model-differences': 'analysis/game-data-model-differences' }
  return { ...input, differences: read('game-data-model-differences') as BaselineDifferences,
    finalCoverage: read('game-data-final-coverage') as ReturnType<typeof buildFinalCoverage>['finalCoverage'],
    catalog: (read('source-harvest') as { records: CatalogRecord[] }).records,
    baselineHashes: Object.fromEntries(['game-data-final-coverage', 'game-data-model-differences', 'game-data-bulk-harvest', 'game-data-bulk-semantic-mappings', 'game-data-gap-reconciliation', 'evidence-gap-map'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, `research/${baselineArtifactPaths[name] ?? name}.json`))).digest('hex')])) }
}
export type AlignmentInputs = ReturnType<typeof loadAlignmentInputs>

const BOUNDARIES: Readonly<Record<string, 'runtime-required' | 'empirical-required'>> = {
  powerScaling: 'runtime-required', powerScalingEvidence: 'runtime-required', healthPowerCurve: 'runtime-required', powerDependence: 'runtime-required',
  attackSpeedScaling: 'empirical-required', intrinsicMechanicOwnership: 'empirical-required', timing: 'empirical-required',
  procOwnership: 'empirical-required', triggerOwnership: 'empirical-required', stacking: 'empirical-required',
  shotsPerSecond: 'empirical-required', recoverySeconds: 'empirical-required', spread: 'empirical-required', chargeTimeSeconds: 'empirical-required',
  duration: 'empirical-required', cooldown: 'empirical-required', procChance: 'empirical-required',
  interactions: 'empirical-required', ammoChargeInteractions: 'empirical-required', runtimeInteraction: 'empirical-required',
  neutralProjectileDamageDistribution: 'empirical-required', maxCopies: 'empirical-required',
}
const namespace = (category: string) => category === 'ranged-weapon' ? 'ranged' : category === 'melee-weapon' ? 'melee' : category
export function alignGapProperty(gaps: readonly EvidenceGap[]) {
  const first = gaps[0]!
  const layer = BOUNDARIES[first.property]
  const direct = first.category === 'ranged-weapon' && first.property === 'projectileCount'
  const related = first.category === 'ranged-weapon' ? ({ spread: ['ranged.angleSpanDegrees'], shotsPerSecond: ['ranged.configuredAttackIntervalSeconds'], recoverySeconds: ['ranged.configuredAttackIntervalSeconds'] } as Record<string, string[]>)[first.property] ?? []
    : first.category === 'melee-weapon' && first.property === 'timing' ? ['melee.attackAnimationDurationSeconds'] : []
  return { category: first.category, legacyProperty: first.property, gapIds: gaps.map(g => g.gapId).sort(),
    status: direct ? 'alias' : layer === 'runtime-required' ? 'runtime-only' : layer ? 'empirical-only' : 'unmapped',
    canonicalPropertyId: direct ? 'ranged.projectileCount' : layer ? `${namespace(first.category)}.${first.property}` : null,
    relatedCanonicalPropertyIds: related,
    reason: direct ? 'Explicit configured count alias; per-Gap expected outcome and closure gate still apply.'
      : layer ? 'Keep the requested runtime/empirical concept separate from configured raw fields; original protocol survives.'
        : 'No approved equivalent canonical concept. Keep legacy property and source attempts; absence is not deprecation.',
  }
}

export function recommendDeepResearch(potentials: readonly { level: 'high' | 'medium' | 'low' | 'none'; evidenceIds: readonly string[]; propertySpecificBlocker?: string }[]) {
  const high = potentials.filter(p => p.level === 'high' && p.evidenceIds.length && p.propertySpecificBlocker).length
  const medium = potentials.filter(p => p.level === 'medium').length
  return { status: high > 0 ? 'recommended' : medium > 0 ? 'optional' : 'not-recommended', highPotential: high, mediumPotential: medium,
    lowPotential: potentials.filter(p => p.level === 'low' || (p.level === 'high' && (!p.evidenceIds.length || !p.propertySpecificBlocker))).length,
    none: potentials.filter(p => p.level === 'none').length,
    reason: high > 0 ? 'Property-specific retained evidence identifies a bounded deeper research target.' : 'No retained property-specific blocker proves static closure potential. Reference existence and entity matches alone do not justify Phase 6.7.',
    nextPhase: high > 0 ? 'Phase 6.7' : 'Phase 7' }
}

export function buildModelAlignment(input: AlignmentInputs) {
  const { bulk, gaps, differences } = input
  const common = { schemaVersion: 1, datasetId: bulk.datasetId, sourceFingerprint: bulk.sourceFingerprint, runtimePromotion: 'not-performed' as const }
  const catalog: ResearchEntityIdentity[] = input.catalog.map(r => ({ entity: `${r.category}:${r.id}`, sourceIds: unique(r.known.filter(k => k.property === 'identity').flatMap(k => k.sourceIds)) }))
  const assets = new Map(bulk.assets.map(a => [a.path, a]))
  const records = new Map(bulk.records.map(r => [r.id, r]))
  const aliasMap = new Map<string, AlignedEntityResolution & { id: string; rawIdentity: string; category: string; assetPaths: string[]; sourceRecordIds: string[] }>()
  const aliasForRecord = new Map<string, string>()
  for (const record of bulk.records) {
    const asset = assets.get(record.asset.path)!
    const rawIdentity = asset.serializedItemId ?? asset.entity ?? asset.path.split('/').at(-1)!
    // Missing asset-index identity is deliberately not replaced with an asset filename guess.
    const id = `${asset.category}:${rawIdentity}`
    let alias = aliasMap.get(id)
    if (!alias) {
      let resolution = resolveAlignedGameDataEntity({ category: asset.category, serializedItemId: asset.serializedItemId, assetIndexEntity: asset.entity, catalog })
      if (asset.category === 'armor-property' && asset.entity && asset.path.includes('/Components/ArmorProperties/')) {
        const entity = `armor-property:${asset.entity.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`
        resolution = { status: 'accepted', canonicalEntity: entity, candidates: [entity], basis: 'Exact indexed ArmorProperties component identity; independent research entity, never an enchantment alias.', confidence: 'high', variant: 'separate-gameplay-entity', evidenceIds: [] }
      }
      alias = { id, rawIdentity, category: asset.category, ...resolution, assetPaths: [], sourceRecordIds: [] }
      aliasMap.set(id, alias)
    }
    alias.assetPaths.push(asset.path); alias.sourceRecordIds.push(record.id); aliasForRecord.set(record.id, id)
  }
  const aliases = [...aliasMap.values()].map(a => ({ ...a, assetPaths: unique(a.assetPaths), sourceRecordIds: unique(a.sourceRecordIds) })).sort((a,b) => a.id.localeCompare(b.id))
  const researchEntities = aliases.filter(a => a.canonicalEntity?.startsWith('armor-property:')).map(a => ({ entity: a.canonicalEntity!, sourceIds: a.sourceRecordIds }))
  const rejectedAliases = [{ rawIdentity: 'armor-property:ItemCooldownDecrease', proposedEntity: 'armor-enchantment:cool-down', status: 'rejected', reason: 'Intrinsic component and rollable enchantment are different entity kinds. Similar cooldown semantics is a relation, not identity.' }]
  const families = unique(gaps.map(g => `${g.category}:${g.property}`)).map(key => alignGapProperty(gaps.filter(g => `${g.category}:${g.property}` === key)))
  const properties: CanonicalResearchProperty[] = [...CANONICAL_GAME_DATA_PROPERTIES,
    ...families.filter(f => f.canonicalPropertyId && ['runtime-only','empirical-only'].includes(f.status)).map(f => ({
      id: f.canonicalPropertyId!, category: f.category, valueKind: 'runtime-derived' as const,
      semanticMeaning: `Legacy research requirement ${f.legacyProperty} for ${f.category}; requires original protocol/outcome, not a configured scalar substitute.`,
      sourceLayer: BOUNDARIES[f.legacyProperty]!, aliases: [f.legacyProperty], runtimePromotion: 'not-eligible' as const, status: 'active' as const,
      change: f.status as 'runtime-only' | 'empirical-only', lineage: f.gapIds, decisionReason: f.reason,
    }))].sort((a,b) => a.id.localeCompare(b.id))
  const canonicalMappings = bulk.records.map(record => {
    const asset = assets.get(record.asset.path)!, raw = { assetPath: asset.path, propertyPath: record.extraction!.propertyPath!, propertyType: record.extraction!.propertyType!, value: record.rawObservation!.value }
    const rule = GAME_DATA_SEMANTIC_RULES.find(r => r.category === asset.category && r.assetNamePattern.test(asset.path.split('/').at(-1)!) && r.propertyPathPattern.test(raw.propertyPath))
    const decision = ALIGNED_RULE_DECISIONS.find(d => d.ruleId === rule?.id)
    const alias = aliasMap.get(aliasForRecord.get(record.id)!)!
    const value = raw.value
    const reference = raw.propertyPath === 'Effect' && value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.objectName === 'string' ? value : null
    const validType = decision && (decision.types as readonly string[]).includes(raw.propertyType)
      && (reference ? reference.kind === 'import' || reference.kind === 'export' : typeof value === 'number' && Number.isFinite(value) && (raw.propertyPath.endsWith('.AngleSpan') || value >= 0))
      && (!raw.propertyPath.endsWith('NumberOfProjectiles') || (typeof value === 'number' && Number.isInteger(value)))
    const status = decision?.status === 'rejected' ? 'rejected' : decision?.status === 'approved' && validType && alias.status === 'accepted' ? 'accepted' : 'unresolved'
    const propertyId = decision && 'propertyId' in decision ? decision.propertyId : null
    return { id: `canonical-${record.id}`, sourceRecordId: record.id, raw, aliasId: alias.id, canonicalEntity: alias.canonicalEntity ?? null,
      ruleId: rule?.id ?? null, status, canonical: status === 'accepted' && propertyId ? { propertyId, value } : null,
      candidatePropertyId: propertyId, confidence: { ...record.confidence, semantics: rule?.semanticConfidence ?? 'unknown' },
      source: { datasetId: record.datasetId, sourceFingerprint: bulk.sourceFingerprint, assetContentHash: record.asset.contentHash },
      structuralReference: status === 'accepted' && reference ? { sourceEntity: alias.canonicalEntity!, sourceProperty: propertyId!, targetAssetClass: reference.objectName, relation: 'gameplay-effect', targetAssetPath: null, reason: 'Package-local reference retains class name/index. No full target path or traversal proven.' } : null,
      variantIndex: /\[(\d+)\]/.exec(raw.propertyPath)?.[1] ?? null,
      boundary: 'Research-only. Raw magnitude, timing reciprocal and reference effect semantics are not runtime facts.' }
  }).sort((a,b) => a.id.localeCompare(b.id))
  const canonicalBySource = new Map(canonicalMappings.map(m => [m.sourceRecordId, m]))
  const alignedMappings: BulkSemanticMapping[] = input.semantic.mappings.map(m => {
    const c = canonicalBySource.get(m.sourceRecordIds[0]!)!, alias = aliasMap.get(c.aliasId)!
    const entityResolution = alias.status === 'accepted' ? { status: 'resolved' as const, entity: alias.canonicalEntity!, basis: 'explicit-alias' as const }
      : alias.status === 'tentative' ? { status: 'ambiguous' as const, candidates: alias.candidates, reason: alias.basis }
        : { status: 'unresolved' as const, reason: alias.basis }
    // A→B approval for configuration does not approve B→effective-cadence semantics.
    return { ...m, id: `aligned-${m.id}`, entity: alias.canonicalEntity ?? m.entity, entityResolution,
      interpretation: c.canonical ? { ...m.interpretation, normalizedProperty: c.canonical.propertyId }
        : { status: c.status === 'rejected' ? 'rejected' : 'unresolved', mappingBasis: m.interpretation.mappingBasis,
          note: `${m.interpretation.note} Canonical approval withheld: ${alias.basis}` },
      confidence: { ...m.confidence, extraction: records.get(c.sourceRecordId)!.confidence.extraction },
      closePolicy: c.status === 'accepted' ? m.closePolicy : 'evidence-only' }
  })
  // Re-resolved identities must pass conflict checks again; distinct configured values cannot close one scalar Gap.
  for (const m of alignedMappings) {
    const peers = alignedMappings.filter(p => p.entityResolution.status === 'resolved' && p.entity === m.entity && p.interpretation.normalizedProperty && p.interpretation.normalizedProperty === m.interpretation.normalizedProperty)
    if (m.closePolicy === 'may-close-static-gap' && new Set(peers.map(p => JSON.stringify(p.interpretation.normalizedValue))).size > 1) {
      const index = alignedMappings.indexOf(m)
      alignedMappings[index] = { ...m, crossCheck: { status: 'conflicts', note: 'Aligned identity has multiple distinct configured values; scalar closure is not justified.' } }
    }
  }
  const semantic = { ...input.semantic, mappings: alignedMappings }
  const reconciliation = buildGapReconciliationArtifact(bulk.datasetId, gaps, semantic)
  const resolutionMap = new Map(reconciliation.resolutions.map(r => [r.gapId, r]))
  const dispositionRecords = gaps.map(g => {
    const resolution = resolutionMap.get(g.gapId)
    const aligned = classifyGap(g, resolution, alignedMappings.filter(m => resolution?.semanticMappingIds.includes(m.id)))
    const family = families.find(f => f.category === g.category && f.legacyProperty === g.property)!
    return { ...aligned, disposition: aligned.disposition === 'phase-6.6-model-alignment' ? 'manual-review' : aligned.disposition,
      canonicalPropertyId: family.canonicalPropertyId, relatedCanonicalPropertyIds: family.relatedCanonicalPropertyIds,
      before: differences.gapClassifications.find(b => b.gapId === g.gapId)! }
  })
  const remaining = dispositionRecords.filter(d => d.reconciliationStatus !== 'closed')
  const handoff = remaining.filter(d => ['phase-7-observe','phase-7-measure','phase-7-experiment'].includes(d.disposition)).map(d => {
    const g = gaps.find(g => g.gapId === d.gapId)!
    const context = canonicalMappings.filter(m => m.canonicalEntity === g.entity && (m.canonical?.propertyId === d.canonicalPropertyId || d.relatedCanonicalPropertyIds.includes(m.candidatePropertyId ?? '')))
    return { gapId: g.gapId, entity: g.entity, property: g.property, canonicalPropertyId: d.canonicalPropertyId,
      resolutionClass: g.resolutionClass, expectedOutcome: g.expectedOutcome, protocolId: g.protocolId,
      directGameDataEvidenceIds: unique([...d.evidence.sourceRecordIds, ...context.map(c => c.sourceRecordId)]),
      canonicalMappingIds: context.map(c => c.id), remainingNeed: resolutionMap.get(g.gapId)?.remainingNeed ?? d.reason,
      sourceAttempts: g.sourceAttempts }
  })
  const potentials = remaining.map(d => ({ gapId: d.gapId, level: d.gameDataFurtherResearchPotential.level, evidenceIds: d.evidence.sourceRecordIds }))
  const recommendation = recommendDeepResearch(potentials)
  const beforeUnresolved = differences.factDifferences.filter(f => f.differenceKind === 'entity-resolution-failed')
  const resolvedBeforeIds = new Set(beforeUnresolved.flatMap(f => f.sourceRecordIds))
  const reviewFacts = canonicalMappings.map(m => ({ sourceRecordId: m.sourceRecordId, aliasId: m.aliasId,
    baselineDifference: differences.factDifferences.find(f => f.sourceRecordIds.includes(m.sourceRecordId))?.differenceKind ?? 'no-semantic-rule',
    decision: m.status === 'accepted' ? m.structuralReference ? 'research-metadata-only' : 'add-canonical-property'
      : m.status === 'rejected' ? m.raw.propertyPath === 'PropertyColorPrio.Prio' ? 'ignore-presentation-metadata' : 'reject'
        : m.raw.propertyPath === '$cdo.declaredPropertyCount' ? 'research-metadata-only' : 'unresolved',
    reason: m.status === 'accepted' ? properties.find(p => p.id === m.canonical?.propertyId)!.semanticMeaning : m.boundary }))
  const missingReview = families.map(f => {
    const relevant = gaps.filter(g => f.gapIds.includes(g.gapId) && differences.missingExpectedPropertyReview.affectedGapIds.includes(g.gapId))
    return { category: f.category, property: f.legacyProperty, gapIds: relevant.map(g => g.gapId), canonicalPropertyId: f.canonicalPropertyId,
      classification: f.status === 'runtime-only' ? 'C-runtime-derived' : f.status === 'empirical-only' ? 'D-empirical-only'
        : relevant.length && relevant.every(g => g.gapCause === 'version-unknown') ? 'E-public-history-only'
          : relevant.length && relevant.every(g => g.resolutionClass === 'implementation') ? 'F-implementation-only' : 'H-unknown',
      reason: f.reason, sourceAttemptIds: unique(relevant.flatMap(g => g.sourceAttempts.map(a => a.sourceId))), deprecated: false }
  }).filter(f => f.gapIds.length)
  const newlyClosed = reconciliation.closedGapIds.filter(id => !input.reconciliation.closedGapIds.includes(id))
  const summary = {
    entity: { beforeUnresolved: beforeUnresolved.length, resolvedIn66: canonicalMappings.filter(m => resolvedBeforeIds.has(m.sourceRecordId) && m.canonicalEntity).length,
      stillUnresolved: canonicalMappings.filter(m => resolvedBeforeIds.has(m.sourceRecordId) && !m.canonicalEntity).length,
      ambiguous: aliases.filter(a => a.status === 'tentative').reduce((n,a) => n+a.sourceRecordIds.length,0), rejectedAliases: rejectedAliases.length,
      topUnresolvedIdentityPatterns: counts(aliases.filter(a => a.status !== 'accepted').flatMap(a => a.sourceRecordIds.map(() => `${a.category}:${a.variant}`))) },
    canonicalProperties: { total: properties.length, changes: counts(properties.map(p => p.change)) },
    gameOnlyReview: counts(reviewFacts.filter(f => f.baselineDifference === 'game-only-property').map(f => f.decision)),
    missingExpectedReview: { total: missingReview.reduce((n,f) => n+f.gapIds.length,0), classifications: Object.fromEntries(unique(missingReview.map(f => f.classification)).map(c => [c, missingReview.filter(f => f.classification === c).reduce((n,f)=>n+f.gapIds.length,0)])), mappedToCanonical: missingReview.filter(f => f.canonicalPropertyId).reduce((n,f)=>n+f.gapIds.length,0), deprecated: 0 },
    structuralReferences: counts(canonicalMappings.filter(m => m.raw.propertyPath === 'Effect').map(m => m.status)),
    timing: { canonicalStatus: 'accepted configured metadata only', effectiveShotsPerSecondInferred: false },
    rules: { before: input.semantic.ruleRegistry.length, decisions: counts(ALIGNED_RULE_DECISIONS.map(r => r.status)) },
    reconciliation: { ...reconciliation.summary, baselineClosed: input.reconciliation.summary.closedCount, newlyClosed: newlyClosed.length },
    newlyMappedCanonical: canonicalMappings.filter(m => m.status === 'accepted' && resolvedBeforeIds.has(m.sourceRecordId)).length,
    remainingDispositions: counts(remaining.map(d => d.disposition)),
    highRuntimeRelevance: reconciliation.impact.byRuntimeRelevance.high,
    rankAccuracy: reconciliation.impact.byUnlockEffect['rank-accuracy'],
    phase7: counts(handoff.map(h => h.resolutionClass)), phase7Total: handoff.length, recommendation,
  }
  return { common, summary, properties, aliases, rejectedAliases, researchEntities, catalog, canonicalMappings, families, semantic, reconciliation,
    dispositionRecords, handoff, potentials, newlyClosed, reviewFacts, missingReview,
    inputs: { baselineHashes: input.baselineHashes, phase66Workstreams: differences.phase66Workstreams,
      missingExpectedPropertyReview: differences.missingExpectedPropertyReview, previousRecommendation: differences.deepGameDataFollowupRecommendation,
      previousCoverage: input.finalCoverage.gapCoverage },
    changeDecisions: [
      { change: 'split', status: 'approved', from: ['legacy effective timing expectation'], to: ['ranged.configuredAttackIntervalSeconds','ranged.shotsPerSecond','ranged.recoverySeconds'], evidenceIds: canonicalMappings.filter(m => m.candidatePropertyId === 'ranged.configuredAttackIntervalSeconds').map(m => m.sourceRecordId), reason: 'Separate configured interval metadata from two distinct empirical outcomes; no legacy Gap rewritten.' },
      { change: 'merge', status: 'rejected', from: ['armor-property:ItemCooldownDecrease','armor-enchantment:cool-down'], to: [], evidenceIds: aliases.find(a => a.id === 'armor-property:ItemCooldownDecrease')?.sourceRecordIds ?? [], reason: 'Component identity is not rollable enchantment identity.' },
      { change: 'deprecated', status: 'rejected', from: ['missing expected properties'], to: [], evidenceIds: [], reason: 'No positive evidence of obsolescence; all legacy requirements preserved.' },
    ] }
}
export type ModelAlignment = ReturnType<typeof buildModelAlignment>

export function alignmentOutputs(result: ModelAlignment): Record<string, string> {
  const { common, summary } = result
  const reviewedDocumentedIdentityBridges = new Map<string, string>([
    ['melee-weapon:SkeletonHammer', 'melee-weapon:bonehead-hammer'],
    ['melee-weapon:Sword_Spooky1', 'melee-weapon:sinister-sword'],
    ['ranged-weapon:BatCrossbow', 'ranged-weapon:shrieking-crossbow'],
    ...REVIEWED_ARTIFACT_ALIAS_BRIDGES.map(({ domainId, rawIdentity }) => [`artifact:${rawIdentity}`, `artifact:${domainId}`] as const),
  ])
  const reviewedAliases = result.aliases.map((alias) => {
    const canonicalEntity = reviewedDocumentedIdentityBridges.get(alias.id)
    if (!canonicalEntity) return alias
    const catalogEvidence = result.catalog.find((entry) => entry.entity === canonicalEntity)?.sourceIds ?? []
    if (catalogEvidence.length === 0) throw new Error(`${alias.id}: reviewed documented bridge lacks catalog identity/category evidence`)
    return {
      ...alias,
      status: 'accepted' as const,
      canonicalEntity,
      candidates: [canonicalEntity],
      basis: 'serialized-item-id + documented-entity-alias + catalog-category-evidence',
      confidence: 'high' as const,
      evidenceIds: [...new Set(catalogEvidence)].sort(),
    }
  })
  for (const input of REVIEWED_ARTIFACT_ALIAS_BRIDGES) {
    const aliasId = `artifact:${input.rawIdentity}`
    if (reviewedAliases.some((alias) => alias.id === aliasId)) continue
    const canonicalEntity = `artifact:${input.domainId}`
    const catalogEvidence = result.catalog.find((entry) => entry.entity === canonicalEntity)?.sourceIds ?? []
    if (catalogEvidence.length === 0) throw new Error(`${aliasId}: reviewed Artifact bridge lacks catalog identity/category evidence`)
    reviewedAliases.push({
      id: aliasId,
      rawIdentity: input.rawIdentity,
      category: 'artifact',
      status: 'accepted',
      candidates: [canonicalEntity],
      basis: 'serialized-item-id + documented-entity-alias + catalog-category-evidence',
      confidence: 'high',
      variant: 'separate-gameplay-entity',
      evidenceIds: [...new Set(catalogEvidence)].sort(),
      assetPaths: [input.packagePath],
      sourceRecordIds: [],
      canonicalEntity,
    })
  }
  for (const input of REVIEWED_ARTIFACT_INDEPENDENT_SOURCE_BRIDGES) {
    const aliasId = `artifact:${input.rawIdentity}`
    const canonicalEntity = `artifact:${input.domainId}`
    const catalogEvidence = result.catalog.find((entry) => entry.entity === canonicalEntity)?.sourceIds ?? []
    if (catalogEvidence.length === 0) throw new Error(`${aliasId}: independent-source Artifact bridge lacks catalog identity/category evidence`)
    const existingIndex = reviewedAliases.findIndex((alias) => alias.id === aliasId)
    const independentSourceAlias = {
      id: aliasId,
      rawIdentity: input.rawIdentity,
      category: 'artifact',
      status: 'accepted' as const,
      candidates: [canonicalEntity],
      basis: INDEPENDENT_SOURCE_ARTIFACT_ALIAS_BASIS,
      confidence: 'high' as const,
      variant: 'separate-gameplay-entity' as const,
      evidenceIds: [...new Set(catalogEvidence)].sort(),
      assetPaths: [input.packagePath],
      sourceRecordIds: [],
      canonicalEntity,
    }
    if (existingIndex >= 0) reviewedAliases[existingIndex] = independentSourceAlias
    else reviewedAliases.push(independentSourceAlias)
  }
  for (const input of REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES) {
    const aliasId = `melee-weapon:${input.rawIdentity}`
    const canonicalEntity = `melee-weapon:${input.domainId}`
    const catalogEvidence = result.catalog.find((entry) => entry.entity === canonicalEntity)?.sourceIds ?? []
    if (catalogEvidence.length === 0) throw new Error(`${aliasId}: typed-relation Melee bridge lacks catalog identity/category evidence`)
    const matchingIndexes = reviewedAliases.map((alias, index) => alias.id === aliasId ? index : -1).filter((index) => index >= 0)
    if (matchingIndexes.length !== 1) throw new Error(`${aliasId}: typed-relation Melee bridge requires exactly one generated alias source`)
    const existing = reviewedAliases[matchingIndexes[0]!]!
    reviewedAliases[matchingIndexes[0]!] = {
      ...existing,
      status: 'accepted' as const,
      canonicalEntity,
      candidates: [canonicalEntity],
      basis: TYPED_RELATION_MELEE_ALIAS_BASIS,
      confidence: 'high' as const,
      evidenceIds: [...new Set(catalogEvidence)].sort(),
      assetPaths: [input.packagePath],
    }
  }
  reviewedAliases.sort((a, b) => a.id.localeCompare(b.id))
  const artifacts = {
    'domain/game-data-canonical-properties': { ...common, properties: result.properties, ruleDecisions: ALIGNED_RULE_DECISIONS, changeDecisions: result.changeDecisions },
    'domain/game-data-entity-aliases': { ...common, aliases: reviewedAliases, rejectedAliases: result.rejectedAliases, researchEntities: result.researchEntities, summary: summary.entity },
    'domain/game-data-canonical-mappings': { ...common, mappings: result.canonicalMappings },
    'analysis/game-data-gap-property-alignment': { ...common, families: result.families, byCategory: Object.fromEntries(unique(result.families.map(f=>f.category)).map(c=>[c, { total: result.families.filter(f=>f.category===c).length, ...counts(result.families.filter(f=>f.category===c).map(f=>f.status)) }])) },
    'domain/game-data-aligned-semantic-mappings': { ...common, mappings: result.semantic.mappings },
    'analysis/game-data-aligned-gap-reconciliation': { ...result.reconciliation, newlyClosedGapIds: result.newlyClosed },
    'analysis/game-data-aligned-gap-disposition': { ...common, summary, records: result.dispositionRecords, potentials: result.potentials },
    'workflow/phase7-research-handoff': { ...common, summary: summary.phase7, records: result.handoff },
    'analysis/game-data-model-alignment-review': { ...common, inputs: result.inputs, summary, retainedFactReview: result.reviewFacts, missingExpectedPropertyReview: result.missingReview, changeDecisions: result.changeDecisions },
  }
  const table = (rows: readonly (readonly unknown[])[], headers: string[]) => `| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.map(x=>String(x).replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')} |`).join('\n')}\n`
  const propertyDocs = `# Canonical Research Properties — Phase 6.6\n\nRaw Game Property → Canonical Research Property → Runtime Optimizer Property. Only the research layer is approved here.\n\n${table(result.properties.map(p=>[p.id,p.category,p.sourceLayer,p.valueKind,p.aliases.join(', '),p.semanticMeaning]),['ID','Category','Source layer','Value kind','Aliases','Meaning'])}\nAliases are category-scoped. Deprecated and merged properties: zero; no absence-based deprecation. Configured array indexes remain on every mapping. Runtime/empirical concepts retain their original protocol and expected outcome; no computed value is supplied.\n`
  const report = `# Game Data Model Alignment — Phase 6.6\n\n## Before / After\n\nBefore: public/Web-derived Gap names and direct raw implementation fields shared an implicit normalization boundary. After: **Raw Game Property → Canonical Research Property → Runtime Optimizer Property**. A→B is reviewed here. B→C remains Phase 9. Phase 5 and 6.5 artifacts are immutable; their hashes and all five 6.5F workstream inputs are retained in the review artifact.\n\n## Entity identity\n\nSerialized identity takes precedence over indexed identity, followed by reviewed alias/exact catalog ID with public identity/category evidence. Missing indexed identity is not guessed from a filename. Shared enchantment names remain ambiguous. Unique/Spooky/Year/Winter/seasonal suffixes are preserved, never removed to match a base item. ArmorProperties components receive independent research identities; ItemCooldownDecrease → cool-down is rejected.\n\n${table(Object.entries(summary.entity).filter(([,v])=>typeof v==='number'),['Metric','Count'])}\nUnresolved pattern counts: ${JSON.stringify(summary.entity.topUnresolvedIdentityPatterns)}. Every retained fact and alias has a decision and trace.\n\n## Canonical registry / aliases / renames\n\nSee [registry](./game-data-canonical-properties.md). NumberOfProjectiles is configured count. AngleSpan preserves ranged.angleSpanDegrees with an explicit alternate alias. AttackRateSeconds is renamed to ranged.configuredAttackIntervalSeconds, while effective cadence remains empirical. Approved A→B rules: ${summary.rules.decisions.approved}; experimental: ${summary.rules.decisions.experimental}; rejected negative controls: ${summary.rules.decisions.rejected}. Historical 6.5 rules remain unchanged for audit reproducibility.\n\n## Structural references\n\nEffect normalizes as a GameplayEffect reference with its original objectName, package index and class. A full target asset path is unknown and is null, never invented. Class existence proves neither magnitude nor duration nor stacking. ${JSON.stringify(summary.structuralReferences)}.\n\n## Game-only useful fields\n\nEvery retained fact is reviewed, including all baseline game-only facts: ${JSON.stringify(summary.gameOnlyReview)}. Configured animation duration is useful research metadata, preserved per asset/variant index under its established ID. No variant average or final speed is generated. Empty CDO counts are structural metadata with unresolved value storage; raw damage remains unresolved/rejected for canonical magnitude, and presentation priority is excluded.\n\n## Missing expected fields / split / merge / deprecate\n\n${summary.missingExpectedReview.total} baseline manual-review Gaps reviewed by all affected property families: ${JSON.stringify(summary.missingExpectedReview.classifications)}. Unknowns remain unknown; inherited/native existence is not asserted without evidence. Split configured timing from effective cadence/recovery requirements; retain all original Gap IDs. Reject merging intrinsic components with enchantments. No positive obsolescence evidence exists, so deprecations are zero. Review rows retain public source attempts.\n\n## Runtime-only / empirical-only and source authority\n\nPower scaling and health curves are runtime-required; effective cadence, ownership, stacking and interaction require original empirical protocols. Public sources remain necessary for history, runtime behavior, cross-checks and interpretation. No final damage scalar, reciprocal AttackRateSeconds, or GameplayEffect magnitude is adopted.\n\n## Gap reconciliation impact\n\n${table(Object.entries(summary.reconciliation),['Metric','Count'])}\nNew closures: ${result.newlyClosed.join(', ') || 'none'}. Exact identity/property, accepted mapping, actual extraction confidence, compatible outcome, explicit empirical replacement and version/conflict/implementation/objective gates remain mandatory. Identity alignment is not closure. High runtime relevance: ${JSON.stringify(summary.highRuntimeRelevance)}. Rank accuracy: ${JSON.stringify(summary.rankAccuracy)}.\n\n## Phase 7 handoff\n\n${summary.phase7Total} remaining original protocols: ${JSON.stringify(summary.phase7)}. Only remaining Observe/Measure/Experiment dispositions enter the handoff; version/conflict and closed Gaps are excluded. Evidence context includes raw configured timing and animation metadata where relevant, so the static observation need not be repeated.\n\n## Phase 6.7 recommendation\n\n${summary.recommendation.status}. ${summary.recommendation.reason} High ${summary.recommendation.highPotential}; medium ${summary.recommendation.mediumPotential}; low ${summary.recommendation.lowPotential}; none ${summary.recommendation.none}. Next: **${summary.recommendation.nextPhase}**. Optional deep traversal stays backlog, not a formal phase. Counts are artifact-derived; no closure improvement target.\n\n## Reproduction / safety\n\nRun npm run generate:game-data-model-alignment, then npm run audit:game-data-model-alignment. All nine JSON artifacts and both reports are deterministic without raw assets. The audit validates complete partitions, provenance, alias/category boundaries, negative controls and historical hashes. Runtime catalog, support manifests, scoring, workers and objective weights are unchanged. No raw asset committed.\n`
  return { ...Object.fromEntries(Object.entries(artifacts).map(([name,value])=>[`research/${name}.json`,serialize(value)])), 'docs/game-data-canonical-properties.md': propertyDocs, 'docs/game-data-model-alignment.md': report }
}

export function auditModelAlignment(input: AlignmentInputs, result: ModelAlignment): string[] {
  const errors = [...auditCanonicalProperties(result.properties), ...collectGapReconciliationErrors(result.reconciliation, input.gaps, result.semantic)]
  const check = (ok: boolean, reason: string) => { if (!ok) errors.push(reason) }
  const records = new Map(input.bulk.records.map(r=>[r.id,r]))
  const entities = new Set([...result.catalog,...result.researchEntities].map(e=>e.entity))
  const properties = new Set(result.properties.map(p=>p.id))
  check(new Set(result.aliases.map(a=>a.id)).size===result.aliases.length,'Duplicate raw alias')
  for (const a of result.aliases) {
    check(['accepted','tentative','rejected','unresolved'].includes(a.status) && ['high','medium','unknown'].includes(a.confidence), `${a.id}: invalid alias status/confidence`)
    if (a.status==='accepted') {
      check(entities.has(a.canonicalEntity!) && Boolean(a.basis) && a.confidence==='high',`${a.id}: missing canonical entity/basis`)
      check(a.variant==='separate-gameplay-entity',`${a.id}: variant collapsed`)
      check(a.category!=='armor-property' || a.canonicalEntity!.startsWith('armor-property:'),`${a.id}: armor/enchantment conflated`)
    }
    check(a.sourceRecordIds.every(id=>records.has(id)),`${a.id}: missing alias source`)
  }
  check(result.canonicalMappings.length===records.size && new Set(result.canonicalMappings.map(m=>m.sourceRecordId)).size===records.size,'Retained facts do not partition')
  for (const m of result.canonicalMappings) {
    const record = records.get(m.sourceRecordId)
    check(Boolean(record) && serialize(record!.rawObservation!.value)===serialize(m.raw.value),`${m.id}: raw value mismatch`)
    check(serialize(record?.asset.contentHash)===serialize(m.source.assetContentHash) && m.source.datasetId===input.bulk.datasetId && serialize(m.source.sourceFingerprint)===serialize(input.bulk.sourceFingerprint),`${m.id}: provenance mismatch`)
    check(record?.asset.path===m.raw.assetPath && record?.extraction?.propertyPath===m.raw.propertyPath,`${m.id}: raw path mismatch`)
    if (m.status==='accepted') check(Boolean(m.canonical) && properties.has(m.canonical!.propertyId) && entities.has(m.canonicalEntity!),`${m.id}: missing canonical linkage`)
    if (/^(?:Damage|damage|PropertyColorPrio\.Prio)$/.test(m.raw.propertyPath)) check(!m.canonical,`${m.id}: negative control normalized`)
    if (m.raw.propertyPath.includes('AttackRateSeconds')) check(String(m.canonical?.propertyId)!=='ranged.shotsPerSecond',`${m.id}: effective cadence inferred`)
    if (m.canonical) check(serialize(m.canonical.value)===serialize(m.raw.value),`${m.id}: configured value transformed`)
  }
  check(result.families.flatMap(f=>f.gapIds).length===input.gaps.length && new Set(result.families.flatMap(f=>f.gapIds)).size===input.gaps.length,'Gap property alignment incomplete')
  check(result.dispositionRecords.length===input.gaps.length && new Set(result.dispositionRecords.map(d=>d.gapId)).size===input.gaps.length,'Disposition partition incomplete')
  check(input.reconciliation.closedGapIds.every(id=>result.reconciliation.closedGapIds.includes(id)),'Historical closed Gap lost')
  check(result.missingReview.flatMap(f=>f.gapIds).sort().join()===input.differences.missingExpectedPropertyReview.affectedGapIds.slice().sort().join(),'Missing expected review incomplete')
  check(new Set(result.handoff.map(h=>h.gapId)).size===result.handoff.length,'Duplicate handoff')
  for (const h of result.handoff) {
    check(!result.reconciliation.closedGapIds.includes(h.gapId) && ['observe','measure','experiment'].includes(h.resolutionClass),`${h.gapId}: invalid handoff`)
    check(h.directGameDataEvidenceIds.every(id=>records.has(id)),`${h.gapId}: handoff evidence missing`)
  }
  // Recompute independently from input to catch status, count, approval, trace and handoff tampering.
  check(serialize(result)===serialize(buildModelAlignment(input)),'Model alignment differs from deterministic approved decisions')
  return errors.sort()
}
