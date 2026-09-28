/* eslint-disable @typescript-eslint/no-explicit-any -- This auditor reads several versioned JSON artifacts with different shapes, then validates their runtime contracts against committed hashes and counts. */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inventoryDirectory = 'research/raw/game-data-raw-structural-inventory'
const reportPath = 'docs/remaining_ambiguous_formal_identity_resolution_audit.md'
const baseline = '791cf9305fbc2fcf15737ef793f3cafeaf8c0133'
const rawUnavailableIds = ['sword', 'ender-armor', 'vanguard-armor'] as const

// These are per-domain reviewed observations, not a name-matching rule. Each entry binds one
// canonical source record to one exact candidate CDO property and one dedicated Raw target.
const reviewedTypedRelationSelectors = [
  {
    domainId: 'melee-weapon:chill-gale-knife', rawIdentity: 'TempestKnife_Unique2',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique2/BP_TempestKnife_Unique2Instance',
    property: 'ConfiguredAttackVariants[].HitSoundCue',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ChillKnife_Swing',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ChillKnife_Swing.DLC_sfx_wpn_ChillKnife_Swing',
  },
  {
    domainId: 'melee-weapon:chill-gale-knife', rawIdentity: 'TempestKnife_Unique2',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique2/BP_TempestKnife_Unique2Instance',
    property: 'InventoryDropSound',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ChillKnife_Place',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ChillKnife_Place.DLC_sfx_wpn_ChillKnife_Place',
  },
  {
    domainId: 'melee-weapon:resolute-tempest-knife', rawIdentity: 'TempestKnife_Unique1',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique1/BP_TempestKnife_Unique1Instance',
    property: 'ConfiguredAttackVariants[].HitSoundCue',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ResTempKnife_Swing',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ResTempKnife_Swing.DLC_sfx_wpn_ResTempKnife_Swing',
  },
  {
    domainId: 'melee-weapon:resolute-tempest-knife', rawIdentity: 'TempestKnife_Unique1',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique1/BP_TempestKnife_Unique1Instance',
    property: 'InventoryDropSound',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ResTempKnife_Place',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_ResTempKnife_Place.DLC_sfx_wpn_ResTempKnife_Place',
  },
  {
    domainId: 'ranged-weapon:bonebow', rawIdentity: 'Bow_Unique1',
    packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique1/BP_Bow_Unique1Instance',
    property: 'AnimNotifyStateData[].TriggerSound',
    targetPackage: 'Dungeons/Content/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_BoneBowShoot',
    targetObject: '/Game/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_BoneBowShoot.sfx_item_BoneBowShoot',
  },
  {
    domainId: 'ranged-weapon:bonebow', rawIdentity: 'Bow_Unique1',
    packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique1/BP_Bow_Unique1Instance',
    property: 'AnimNotifyStateData[].TriggerSound',
    targetPackage: 'Dungeons/Content/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_BoneBowChargedShoot',
    targetObject: '/Game/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_BoneBowChargedShoot.sfx_item_BoneBowChargedShoot',
  },
  {
    domainId: 'ranged-weapon:twin-bow', rawIdentity: 'Bow_Unique2',
    packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique2/BP_Bow_Unique2Instance',
    property: 'AnimNotifyStateData[].TriggerSound',
    targetPackage: 'Dungeons/Content/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_twinBowShoot',
    targetObject: '/Game/AudioForce/04_playback_soundCue/04_sfx_item_bow/sfx_item_twinBowShoot.sfx_item_twinBowShoot',
  },
  {
    domainId: 'ranged-weapon:twin-bow', rawIdentity: 'Bow_Unique2',
    packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique2/BP_Bow_Unique2Instance',
    property: 'InventoryDropSound',
    targetPackage: 'Dungeons/Content/AudioForce/04_playback_soundCue/04_sfx_item_place/sfx_item_TwinbowPlace',
    targetObject: '/Game/AudioForce/04_playback_soundCue/04_sfx_item_place/sfx_item_TwinbowPlace.sfx_item_TwinbowPlace',
  },
  {
    domainId: 'ranged-weapon:burst-gale-bow', rawIdentity: 'WindBow_Unique2',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow_Unique2/BP_WindBow_Unique2Instance',
    property: 'InventoryDropSound',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_BurstBow_Place',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_BurstBow_Place.DLC_sfx_wpn_BurstBow_Place',
  },
  {
    domainId: 'ranged-weapon:echo-of-the-valley', rawIdentity: 'WindBow_Unique1',
    packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow_Unique1/BP_WindBow_Unique1Instance',
    property: 'InventoryDropSound',
    targetPackage: 'Dungeons/Content/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_EchoBow_Place',
    targetObject: '/Game/AudioForce/DLC_3/Item/Cues/Weapons/DLC_sfx_wpn_EchoBow_Place.DLC_sfx_wpn_EchoBow_Place',
  },
] as const

const reviewedSelectorDomains = new Set(reviewedTypedRelationSelectors.map(({ domainId, rawIdentity, packagePath }) => `${domainId}\u0000${rawIdentity}\u0000${packagePath}`))

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as T
}

function sha256(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function valueOfName(value: { value?: string } | undefined): string | undefined {
  return value?.value
}

function findUniqueProperty(properties: readonly any[], name: string): any | undefined {
  const matches = properties.filter((property) => valueOfName(property.name) === name && property.arrayIndex === 0)
  assert.equal(matches.length, 1, `Expected one ${name} property; got ${matches.length}`)
  return matches[0]
}

function inline(value: string): string {
  return `\`${value.replaceAll('`', '\\`')}\``
}

function relationPropertyFamily(propertyPath: string): string {
  return propertyPath.replace(/\[\d+\]/g, '[]')
}

function relationSignature(relation: { property: string; targetPackage: string; targetObject: string }): string {
  return JSON.stringify([relation.property, relation.targetPackage, relation.targetObject])
}

const manifest = readJson<any>(`${inventoryDirectory}/manifest.json`)
const formalArtifact = readJson<any>('research/domain/formal/identity-evidence-v1.json')
const sourceHarvest = readJson<any>('research/source-harvest.json')
const aliases = readJson<any>('research/domain/game-data-entity-aliases.json')
const assetIndex = readJson<any>('research/raw/game-data-asset-index.json')
const armorAudit = readJson<any>('research/armor-audit.json')
const meleeAudit = readJson<any>('research/melee-attack-profile-audit.json')
const rangedAudit = readJson<any>('research/ranged-weapon-audit.json')
const equipmentIconSource = fs.readFileSync(path.join(repositoryRoot, 'scripts/equipment-icons.ts'), 'utf8')

assert.equal(manifest.schemaVersion, 1)
assert.equal(manifest.catalogSeeds.length, 271)
assert.equal(formalArtifact.identityAssertions.length, 146)

const formalDomainIds = new Set(formalArtifact.identityAssertions.map((assertion: any) => assertion.domainId))
const ambiguousSeeds = manifest.catalogSeeds
  .filter((seed: any) => ['melee', 'ranged'].includes(seed.category) && seed.status === 'ambiguous' && !formalDomainIds.has(seed.catalogId))
  .sort((left: any, right: any) => left.category.localeCompare(right.category) || left.catalogId.localeCompare(right.catalogId))
const meleeSeeds = ambiguousSeeds.filter((seed: any) => seed.category === 'melee')
const rangedSeeds = ambiguousSeeds.filter((seed: any) => seed.category === 'ranged')
assert.equal(meleeSeeds.length, 38, 'Current Melee ambiguous target set drift')
assert.equal(rangedSeeds.length, 34, 'Current Ranged ambiguous target set drift')
assert.equal(ambiguousSeeds.length, 72, 'Current Melee/Ranged ambiguous target set drift')
assert.ok(!ambiguousSeeds.some((seed: any) => seed.catalogId === 'fireworks-arrow'))

const seedsById = new Map(manifest.catalogSeeds.map((seed: any) => [seed.catalogId, seed]))
const swordSeed = seedsById.get('sword')
const enderArmorSeed = seedsById.get('ender-armor')
const vanguardArmorSeed = seedsById.get('vanguard-armor')
assert.ok(swordSeed && enderArmorSeed && vanguardArmorSeed)
assert.equal(enderArmorSeed.status, 'not-found')
assert.equal(vanguardArmorSeed.status, 'not-found')
assert.deepEqual(enderArmorSeed.candidates, [])
assert.deepEqual(vanguardArmorSeed.candidates, [])
assert.equal(swordSeed.status, 'provisional')
assert.equal(swordSeed.candidates.length, 1)
assert.deepEqual(rawUnavailableIds.map((id) => id), ['sword', 'ender-armor', 'vanguard-armor'])

const wantedPackages = new Set<string>([
  ...ambiguousSeeds.flatMap((seed: any) => seed.candidates.map((candidate: any) => candidate.packagePath)),
  ...swordSeed.candidates.map((candidate: any) => candidate.packagePath),
])
const packages = new Map<string, { pkg: any; shardPath: string; packageIndex: number; cdoInventoryIndex: number; edges: any[] }>()
const edgesBySource = new Map<string, any[]>()
let tableLikePackageCount = 0

for (const shardMeta of manifest.shards) {
  const shardPath = path.join(repositoryRoot, inventoryDirectory, shardMeta.path)
  const compressed = fs.readFileSync(shardPath)
  assert.equal(sha256(compressed), shardMeta.compressedSha256, `${shardMeta.path}: compressed hash drift`)
  const uncompressed = gunzipSync(compressed)
  assert.equal(sha256(uncompressed), shardMeta.uncompressedSha256, `${shardMeta.path}: uncompressed hash drift`)
  const shard = JSON.parse(uncompressed.toString('utf8')) as any
  assert.equal(shard.schemaVersion, 1)
  assert.equal(shard.packages.length, shardMeta.packageCount)
  for (const [packageIndex, pkg] of shard.packages.entries()) {
    if (pkg.payloadCoverage.tableLikePackage) tableLikePackageCount += 1
    if (wantedPackages.has(pkg.path)) {
      const cdoExports = pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
      const inventories = pkg.cdoPropertyInventory
        .map((entry: any, index: number) => ({ entry, index }))
        .filter(({ entry }: any) => entry.exportIndex === cdoExports[0]?.exportIndex)
      packages.set(pkg.path, {
        pkg,
        shardPath: shardMeta.path,
        packageIndex,
        cdoInventoryIndex: inventories[0]?.index ?? -1,
        edges: [],
      })
    }
  }
  for (const edge of shard.edges) {
    if (!wantedPackages.has(edge.sourcePackage)) continue
    const sourceEdges = edgesBySource.get(edge.sourcePackage) ?? []
    sourceEdges.push(edge)
    edgesBySource.set(edge.sourcePackage, sourceEdges)
  }
}

assert.equal(packages.size, wantedPackages.size, 'A candidate package is missing or duplicated in Raw Structural Inventory')
for (const [packagePath, loaded] of packages) loaded.edges = edgesBySource.get(packagePath) ?? []

function observedName(properties: readonly any[], name: string): string {
  const property = findUniqueProperty(properties, name)
  assert.equal(property.type.value, 'NameProperty', `${name}: expected NameProperty`)
  assert.equal(property.decoding.state, 'decoded', `${name}: expected decoded observation`)
  assert.equal(typeof property.decoding.value, 'string', `${name}: expected string observation`)
  return property.decoding.value
}

function inspectCandidate(seed: any, candidate: any) {
  const loaded = packages.get(candidate.packagePath)
  assert.ok(loaded, `${seed.catalogId}: candidate package missing: ${candidate.packagePath}`)
  const { pkg, shardPath, packageIndex, cdoInventoryIndex, edges } = loaded
  assert.equal(candidate.role, 'instance', `${seed.catalogId}: candidate role drift`)
  const cdoExports = pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
  assert.equal(cdoExports.length, 1, `${seed.catalogId}: expected exactly one CDO in ${candidate.packagePath}`)
  assert.notEqual(cdoInventoryIndex, -1, `${seed.catalogId}: CDO property inventory missing`)
  const cdo = cdoExports[0]
  const cdoInventory = pkg.cdoPropertyInventory[cdoInventoryIndex]
  const itemIdName = observedName(cdoInventory.properties, 'ItemIdName')
  const itemId = findUniqueProperty(cdoInventory.properties, 'ItemId')
  assert.equal(itemId.type.value, 'StructProperty')
  assert.equal(itemId.decoding.state, 'decoded')
  const serializedId = observedName(itemId.decoding.properties, 'SerializedId')
  assert.equal(itemIdName, serializedId, `${seed.catalogId}: serialized identity fields conflict`)
  const evidenceIds = candidate.evidence
    .filter((entry: string) => entry.startsWith('serialized-identifier:'))
    .map((entry: string) => entry.slice('serialized-identifier:'.length))
    .sort()
  assert.deepEqual(evidenceIds, [`ItemId.SerializedId=${serializedId}`, `ItemIdName=${itemIdName}`].sort())

  const generatedClass = pkg.exports.find((entry: any) => !entry.isClassDefaultObject && entry.objectName.value === candidate.objectName)
  assert.ok(generatedClass, `${seed.catalogId}: generated class export missing`)
  const superObject = generatedClass.references.super.objectName
  const templateObject = cdo.references.template.objectName
  const inheritance = pkg.inheritanceChains.find((chain: any) => chain.sourceObject === candidate.objectName)
  const inheritanceTargets = inheritance?.hops.map((hop: any) => hop.targetObject ?? hop.targetPackageName ?? hop.targetPackage ?? 'unresolved') ?? []
  const classImports = pkg.imports
    .filter((entry: any) => entry.className.value === 'BlueprintGeneratedClass')
    .map((entry: any) => entry.objectName.value)
  const edgeFields = [...new Set(edges
    .filter((edge: any) => edge.kind.endsWith('-property'))
    .map((edge: any) => edge.sourceOccurrence.propertyPath?.replace(/\[\d+\]/g, '[]'))
    .filter(Boolean))] as string[]
  const typedReferences = edges.filter((edge: any) => edge.kind.endsWith('-property'))
  const typedRelationMap = new Map<string, any>()
  for (const edge of edges) {
    const propertyPath = edge.sourceOccurrence?.propertyPath
    if (!edge.kind.endsWith('-property') || edge.sourceOccurrence?.kind !== 'cdo-property' || !propertyPath) continue
    if (propertyPath === 'RootComponent' || propertyPath === 'GearActor') continue
    const targetPackage = edge.targetPackage ?? edge.targetPackageName
    const targetObject = edge.targetObject
    if (!targetPackage && !targetObject) continue
    const relation = {
      property: relationPropertyFamily(propertyPath),
      targetPackage: targetPackage ?? 'unresolved-target-package',
      targetObject: targetObject ?? 'unresolved-target-object',
      edgeKind: edge.kind,
      rawPropertyPath: propertyPath,
      rawEdgeLocator: `${inventoryDirectory}/${shardPath}#/edges[id=${edge.id}]`,
    }
    const signature = relationSignature(relation)
    const current = typedRelationMap.get(signature)
    if (current) {
      current.rawPropertyPaths.add(propertyPath)
    } else {
      typedRelationMap.set(signature, { ...relation, rawPropertyPaths: new Set([propertyPath]) })
    }
  }
  const typedRelations = [...typedRelationMap.values()].map((relation) => ({
    ...relation,
    rawPropertyPaths: [...relation.rawPropertyPaths].sort(),
  }))
  const referenceTargets = [...new Set(edges.flatMap((edge: any) => [edge.targetPackage, edge.targetPackageName, edge.targetObject])
    .filter((target: unknown): target is string => typeof target === 'string' && /^(?:Dungeons\/|\/Game\/|\/Script\/)/.test(target)))]
  const rawLocator = `${inventoryDirectory}/${shardPath}#/packages/${packageIndex}/cdoPropertyInventory/${cdoInventoryIndex}`
  const categoryAlias = seed.category === 'melee' ? 'melee-weapon' : 'ranged-weapon'
  const aliasId = `${categoryAlias}:${serializedId}`
  const alias = aliases.aliases.find((entry: any) => entry.id === aliasId)
  const aliasState = alias
    ? `${alias.status}/${alias.confidence}; canonicalEntity=${alias.canonicalEntity ?? '—'}; candidates=${alias.candidates.join(',') || '—'}`
    : 'no exact rawIdentity alias row'

  return {
    packagePath: candidate.packagePath,
    role: candidate.role,
    itemIdName,
    serializedId,
    generatedClass: candidate.objectName,
    superObject,
    templateObject,
    inheritanceTargets,
    classImports,
    edgeFields,
    typedReferenceCount: typedReferences.length,
    referenceTargetCount: referenceTargets.length,
    referenceTargets,
    typedRelations,
    rawLocator,
    aliasId,
    aliasState,
    package: pkg,
  }
}

const overrideBlock = equipmentIconSource.match(/const ENTITY_OVERRIDES:[\s\S]*?=\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
const entityOverrides = new Map([...overrideBlock.matchAll(/^\s*'([^']+)'\s*:\s*'([^']+)'\s*,?\s*$/gm)]
  .map((match) => [match[1]!, match[2]!]))
const sourceByEntity = new Map(sourceHarvest.records.map((record: any) => [`${record.category}:${record.id}`, record]))
const meleeById = new Map(meleeAudit.weapons.map((entry: any) => [entry.weaponId, entry]))
const rangedById = new Map(rangedAudit.entries.map((entry: any) => [entry.id, entry]))
const selectorRationales = new Map([
  ['melee-weapon:chill-gale-knife', 'The dedicated ChillKnife place/swing targets on the exact CDO are candidate-specific; the competing CDO points to the separately item-specific ResTempKnife targets. The canonical source name is Chill Gale Knife.'],
  ['melee-weapon:resolute-tempest-knife', 'The dedicated ResTempKnife place/swing targets on the exact CDO are candidate-specific; this is the explicit item abbreviation for Resolute Tempest Knife, and the competing CDO points to the separately item-specific ChillKnife targets.'],
  ['ranged-weapon:bonebow', 'The dedicated BoneBow shoot and charged-shoot cues occur only on this exact CDO; the competing CDO has TwinBow-specific shoot/place cues. The canonical source name is Bonebow.'],
  ['ranged-weapon:twin-bow', 'The dedicated TwinBow shoot/place cues occur only on this exact CDO; the competing CDO has BoneBow-specific shoot cues. The canonical source name is Twin Bow.'],
  ['ranged-weapon:burst-gale-bow', 'The dedicated BurstBow place cue occurs only on this exact CDO; the competing CDO has an EchoBow-specific place cue. The canonical source name is Burst Gale Bow.'],
  ['ranged-weapon:echo-of-the-valley', 'The dedicated EchoBow place cue occurs only on this exact CDO; the competing CDO has a BurstBow-specific place cue. The canonical source name is Echo of the Valley.'],
])
assert.equal(selectorRationales.size, reviewedSelectorDomains.size)
assert.equal(reviewedSelectorDomains.size, 6, 'Reviewed selector ledger drift')

const targetRows = ambiguousSeeds.map((seed: any) => {
  const domainId = `${seed.category === 'melee' ? 'melee-weapon' : 'ranged-weapon'}:${seed.catalogId}`
  const sourceRecord = sourceByEntity.get(domainId)
  assert.ok(sourceRecord, `${domainId}: source-harvest record missing`)
  const identityFact = sourceRecord.known.find((entry: any) => entry.property === 'identity')
  assert.ok(identityFact, `${domainId}: canonical identity source missing`)
  const categoryRecord = seed.category === 'melee' ? meleeById.get(seed.catalogId) : rangedById.get(seed.catalogId)
  assert.ok(categoryRecord, `${domainId}: category audit record missing`)
  const candidates = seed.candidates.map((candidate: any) => inspectCandidate(seed, candidate))
  assert.ok(candidates.length === 2 || candidates.length === 3, `${domainId}: unexpected candidate count`)
  assert.equal(new Set(candidates.map((candidate: any) => candidate.serializedId)).size, candidates.length, `${domainId}: candidate identities collapsed`)
  const overrideKey = `${seed.category}:${seed.catalogId}`
  assert.equal(entityOverrides.has(overrideKey), false, `${domainId}: an ENTITY_OVERRIDES mapping requires separate adjudication`)
  const relationCounts = new Map<string, number>()
  for (const candidate of candidates) {
    for (const relation of candidate.typedRelations) {
      const signature = relationSignature(relation)
      relationCounts.set(signature, (relationCounts.get(signature) ?? 0) + 1)
    }
  }
  const matchedSelectorSignatures = new Set<string>()
  let reviewedRelationCount = 0
  for (const candidate of candidates) {
    candidate.candidateSpecificRelations = candidate.typedRelations
      .filter((relation: any) => relationCounts.get(relationSignature(relation)) === 1)
      .map((relation: any) => {
        reviewedRelationCount += 1
        const signature = relationSignature(relation)
        const selected = reviewedTypedRelationSelectors.filter((selector) =>
          selector.domainId === domainId
          && selector.rawIdentity === candidate.serializedId
          && selector.packagePath === candidate.packagePath
          && selector.property === relation.property
          && selector.targetPackage === relation.targetPackage
          && selector.targetObject === relation.targetObject)
        assert.ok(selected.length <= 1, `${domainId}: duplicate reviewed selector for ${signature}`)
        const selector = selected[0]
        if (selector) matchedSelectorSignatures.add(`${domainId}\u0000${candidate.serializedId}\u0000${candidate.packagePath}\u0000${signature}`)
        const siblingSelector = reviewedTypedRelationSelectors.find((entry) =>
          entry.domainId !== domainId
          && entry.property === relation.property
          && entry.targetPackage === relation.targetPackage
          && entry.targetObject === relation.targetObject)
        const status = selector ? 'accepted' : 'rejected'
        const canonicalCorrespondence = selector
          ? `${seed.catalogName} (${domainId})`
          : siblingSelector
            ? `${siblingSelector.domainId} only; not ${domainId}`
            : 'none established for this canonical item'
        const rationale = selector
          ? selectorRationales.get(domainId)!
          : siblingSelector
            ? `This exact dedicated target is reviewed for the distinct sibling canonical item ${siblingSelector.domainId}; it conflicts with selecting this candidate for ${domainId}.`
            : /Projectile/.test(relation.property)
              ? 'The exact target is a candidate-bound projectile implementation. Neither the canonical identity source nor this projectile object supplies a canonical item selector.'
              : /Sound|SFX/.test(relation.property)
                ? 'The exact sound target is generic, family-level, or tracks the Raw family/variant label; it does not name this canonical item independently.'
                : 'The exact target is candidate-specific implementation/effect/animation data; no independent canonical source connects that target to this item.'
        return { ...relation, status, canonicalCorrespondence, rationale, selected: Boolean(selector) }
      })
  }
  const expectedSelectorSignatures = reviewedTypedRelationSelectors.filter((selector) => selector.domainId === domainId).map((selector) =>
    `${selector.domainId}\u0000${selector.rawIdentity}\u0000${selector.packagePath}\u0000${relationSignature(selector)}`)
  assert.deepEqual([...matchedSelectorSignatures].sort(), expectedSelectorSignatures.sort(), `${domainId}: reviewed selector evidence drift`)
  assert.ok(reviewedRelationCount > 0, `${domainId}: candidate-specific typed relations were not reviewed`)
  const acceptedCandidates = candidates.filter((candidate: any) => candidate.candidateSpecificRelations.some((relation: any) => relation.selected))
  assert.ok(acceptedCandidates.length <= 1, `${domainId}: reviewed relations select multiple candidates`)
  const decision = acceptedCandidates.length === 1
    ? 'ready-with-new-explicit-reviewed-bridge'
    : reviewedRelationCount > 0
      ? 'true-ambiguity'
      : 'needs-additional-identity-evidence'
  const sourceLocator = seed.category === 'melee'
    ? `research/melee-attack-profile-audit.json#/weapons[weaponId=${seed.catalogId}]`
    : `research/ranged-weapon-audit.json#/entries[id=${seed.catalogId}]`
  const canonicalLocator = `research/source-harvest.json#/records[category=${sourceRecord.category},id=${seed.catalogId}]/known[property=identity]`
  const sourceIds = identityFact.sourceIds.join(', ') || '—'
  const bridgeFacts = candidates.map((candidate: any) => `${inline(candidate.aliasId)}: ${candidate.aliasState}`).join('<br>')
  const candidateFacts = candidates.map((candidate: any) => {
    const inheritance = candidate.inheritanceTargets.length ? candidate.inheritanceTargets.join(' → ') : 'no serialized super hop'
    const imports = candidate.classImports.join(', ') || 'none'
    const relationFacts = candidate.candidateSpecificRelations.length
      ? candidate.candidateSpecificRelations.map((relation: any) => `${inline(relation.property)} → ${inline(relation.targetPackage)} :: ${inline(relation.targetObject)}; ${inline(relation.status)}; canonical correspondence=${inline(relation.canonicalCorrespondence)}; ${relation.rationale} Raw edge=${inline(relation.rawEdgeLocator)}`).join('<br>')
      : 'none; all scoped exact targets are shared by the current candidates'
    return [
      `${inline(candidate.packagePath)} — role=${inline(candidate.role)}; ItemIdName=${inline(candidate.itemIdName)}; SerializedId=${inline(candidate.serializedId)}; CDO=1`,
      `class=${inline(candidate.generatedClass)}; super=${inline(candidate.superObject)}; template=${inline(candidate.templateObject)}; inheritance=${inline(inheritance)}`,
      `BlueprintGeneratedClass imports=${inline(imports)}; typed CDO reference edges=${candidate.typedReferenceCount}; property families=${candidate.edgeFields.map(inline).join(', ') || 'none'}; exact Raw target objects=${candidate.referenceTargetCount}`,
      `Candidate-specific typed targets reviewed (${candidate.candidateSpecificRelations.length}):<br>${relationFacts}`,
      `Raw locator: ${inline(candidate.rawLocator)}`,
    ].join('<br>')
  }).join('<br><br>')
  const survivorCandidates = acceptedCandidates.length ? acceptedCandidates : candidates
  const survivorList = survivorCandidates.map((candidate: any) => `${candidate.serializedId} @ ${candidate.packagePath}`).map(inline).join('<br>')
  const selector = acceptedCandidates[0]
  const selectedRelationCount = selector?.candidateSpecificRelations.filter((relation: any) => relation.selected).length ?? 0
  const candidateSpecificRelationCount = candidates.reduce((sum: number, candidate: any) => sum + candidate.candidateSpecificRelations.length, 0)
  const selectorRationale = selectorRationales.get(domainId)
  return {
    domainId,
    category: seed.category,
    canonicalName: seed.catalogName,
    candidateCount: candidates.length,
    candidateSpecificRelationCount,
    selectedRelationCount,
    candidateFacts,
    survivorList,
    bridgeFacts,
    canonicalSource: `${inline(canonicalLocator)}<br>sourceIds=${sourceIds}<br>${inline(sourceLocator)}; canonical record supplies the independent item name/category; it does not assert a Raw ID/package path${selector ? `<br>Reviewed selector: ${selector.serializedId}; ${selectedRelationCount} exact candidate-specific target(s); ${selectorRationale}` : ''}`,
    conflict: selector
      ? `${candidates.length} equal-rank candidates; the dedicated typed target selects ${selector.serializedId}, while the competing candidate-specific targets were rejected or map to a distinct canonical sibling.`
      : `${candidates.length} equal-rank instance candidates; ${candidateSpecificRelationCount} candidate-specific typed relation target(s) were inspected, but none selects this canonical item.`,
    decision,
    candidates,
    sourceRecord,
  }
})

const candidateOccurrences = targetRows.flatMap((row: any) => row.candidates)
const uniqueCandidatePackages = new Set(candidateOccurrences.map((candidate: any) => candidate.packagePath))
const candidateRoles = candidateOccurrences.reduce((counts: Record<string, number>, candidate: any) => {
  counts[candidate.role] = (counts[candidate.role] ?? 0) + 1
  return counts
}, {})
const aliasStates = new Map<string, number>()
for (const candidate of candidateOccurrences) {
  const key = candidate.aliasState.startsWith('no exact') ? 'missing exact alias' : candidate.aliasState.split(';')[0]!
  aliasStates.set(key, (aliasStates.get(key) ?? 0) + 1)
}
const edgeCounts = [...uniqueCandidatePackages].reduce((counts: Record<string, number>, packagePath) => {
  for (const edge of edgesBySource.get(packagePath) ?? []) {
    counts[edge.kind] = (counts[edge.kind] ?? 0) + 1
  }
  return counts
}, {})
const existingMeleeOverrides = [...entityOverrides.keys()].filter((key) => key.startsWith('melee:'))
const existingRangedOverrides = [...entityOverrides.keys()].filter((key) => key.startsWith('ranged:'))
assert.deepEqual(existingMeleeOverrides.sort(), ['melee:bonehead-hammer', 'melee:sinister-sword'].sort())
assert.deepEqual(existingRangedOverrides, ['ranged:shrieking-crossbow'])
const reviewedRelationTargetCount = targetRows.filter((row: any) => row.candidateSpecificRelationCount > 0).length
const candidateSpecificRelationCount = targetRows.reduce((sum: number, row: any) => sum + row.candidateSpecificRelationCount, 0)
const readyRows = targetRows.filter((row: any) => row.decision === 'ready-with-new-explicit-reviewed-bridge')
const readyRelationRows = candidateOccurrences.flatMap((candidate: any) => candidate.candidateSpecificRelations).filter((relation: any) => relation.selected)
const unsupportedOrdinalFamilyInference = readyRelationRows.filter((relation: any) => /Unique\d+|family|ordinal/i.test(`${relation.targetPackage} ${relation.targetObject}`)).length
assert.equal(reviewedRelationTargetCount, 72, 'Every ambiguous target needs candidate-specific typed-relation adjudication')
assert.equal(readyRows.length, reviewedSelectorDomains.size, 'Selector domains must be generated from the exact reviewed evidence ledger')
assert.equal(readyRelationRows.length, reviewedTypedRelationSelectors.length, 'Accepted relation observations must match the explicit selector ledger')
assert.equal(unsupportedOrdinalFamilyInference, 0, 'A reviewed selector cannot rely on an ordinal or family-only target')
assert.equal(targetRows.filter((row: any) => row.decision === 'true-ambiguity').length, 66)
assert.equal(targetRows.filter((row: any) => row.decision === 'needs-additional-identity-evidence').length, 0)

const swordSeedCandidate = swordSeed.candidates[0]
const loadedSword = packages.get(swordSeedCandidate.packagePath)
assert.ok(loadedSword)
const swordCdo = loadedSword.pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
assert.equal(swordCdo.length, 1)
const swordCdoProperties = loadedSword.pkg.cdoPropertyInventory
  .find((entry: any) => entry.exportIndex === swordCdo[0].exportIndex).properties
assert.equal(swordCdoProperties.filter((property: any) => valueOfName(property.name) === 'ItemIdName').length, 0)
assert.equal(swordCdoProperties.filter((property: any) => valueOfName(property.name) === 'ItemId').length, 0)
const swordCandidate = {
  packagePath: swordSeedCandidate.packagePath,
  role: swordSeedCandidate.role,
  rawLocator: `${inventoryDirectory}/${loadedSword.shardPath}#/packages/${loadedSword.packageIndex}/cdoPropertyInventory/${loadedSword.cdoInventoryIndex}`,
}
const swordAliasId = 'melee-weapon:Sword_Steel'
const swordAlias = aliases.aliases.find((entry: any) => entry.id === swordAliasId)
assert.ok(swordAlias)
assert.equal(swordAlias.status, 'unresolved')
assert.equal(swordAlias.confidence, 'unknown')

const armorById = new Map(armorAudit.entries.map((entry: any) => [entry.id, entry]))
const enderRecord = armorById.get('ender-armor')
const vanguardRecord = armorById.get('vanguard-armor')
assert.ok(enderRecord && vanguardRecord)
assert.equal(enderRecord.levelId, 'CuriousArmor')
assert.equal(vanguardRecord.levelId, 'DesertArmor')
const enderAssets = assetIndex.assets.filter((asset: any) => /CuriousArmor|EnderArmor/i.test(asset.path))
const vanguardAssets = assetIndex.assets.filter((asset: any) => /DesertArmor/i.test(asset.path))
assert.equal(enderAssets.length, 0, 'A committed Ender Armor package/asset candidate exists')
assert.equal(vanguardAssets.length, 0, 'A committed Vanguard Armor package/asset candidate exists in the asset index')
const vanguardPresentationPath = 'Dungeons/Content/Actors/Characters/Enemies/SkeletonVanguard/T_DesertArmor'
assert.deepEqual(vanguardArmorSeed.presentationHint.candidates, [vanguardPresentationPath])

const unavailableRows = [
  {
    domainId: 'melee-weapon:sword', category: 'melee', canonicalName: 'Sword', rawState: 'candidate package exists; both identity fields are absent from its decoded CDO',
    candidate: `${inline(swordCandidate.packagePath)} — role=${inline(swordCandidate.role)}; CDO=1; ItemIdName=unavailable; ItemId.SerializedId=unavailable; Raw locator=${inline(swordCandidate.rawLocator)}`,
    source: `${inline('research/source-harvest.json#/records[category=melee-weapon,id=sword]/known[property=identity]')}<br>alias ${inline(swordAliasId)} is unresolved/unknown; ${inline("scripts/equipment-icons.ts#INTERNAL_FAMILY_ALIASES['sword']")} is icon-candidate search input only`,
    classification: 'raw-observation-required',
    reason: 'The only committed instance package has no serialized identity fields. The committed asset index, extractor samples, and semantic samples contain no exact serialized identity to restore.',
  },
  {
    domainId: 'armor:ender-armor', category: 'armor', canonicalName: 'Ender Armor', rawState: 'no Raw package candidate; asset index has no CuriousArmor/EnderArmor path',
    candidate: 'none; seed status=not-found; candidates=[]',
    source: `${inline('research/armor-audit.json#/entries[id=ender-armor]')}<br>levelId=${inline('CuriousArmor')}; sourceIds=${(enderRecord.sourceIds ?? []).join(', ')}<br>${inline('research/raw/game-data-raw-structural-inventory/manifest.json#/catalogSeeds[catalogId=ender-armor]')}; ${inline('research/raw/game-data-asset-index.json#/assets')} contains no matching asset`,
    classification: 'raw-observation-required',
    reason: 'The current committed source describes an Arcade-only/unused item but has no exact game Raw package or CDO. The committed full asset index has no candidate.',
  },
  {
    domainId: 'armor:vanguard-armor', category: 'armor', canonicalName: 'Vanguard Armor', rawState: 'asset index has no equipment package; icon search has only an enemy body texture hint',
    candidate: `none; seed status=not-found; candidates=[]; icon-search presentation hint points to ${inline(vanguardPresentationPath)}`,
    source: `${inline('research/armor-audit.json#/entries[id=vanguard-armor]')}<br>levelId=${inline('DesertArmor')}; sourceIds=${(vanguardRecord.sourceIds ?? []).join(', ')}<br>${inline('research/raw/game-data-raw-structural-inventory/manifest.json#/catalogSeeds[catalogId=vanguard-armor]')}; icon-search hint is ${inline(vanguardPresentationPath)}, outside the equipment package/Raw candidate set`,
    classification: 'raw-observation-required',
    reason: 'The only retained presentation hint points to an enemy body texture, not an inventory instance/CDO. Category audit says mob-only; no existing committed package or serialized identity supports Formal population.',
  },
]
assert.equal(unavailableRows.length, 3)

const classifications = [...targetRows.map((row: any) => row.decision), ...unavailableRows.map((row) => row.classification)]
const classificationCounts = Object.fromEntries([
  'ready-with-existing-independent-source',
  'ready-with-existing-reviewed-bridge-pattern',
  'ready-with-new-explicit-reviewed-bridge',
  'needs-additional-identity-evidence',
  'true-ambiguity',
  'raw-observation-required',
].map((classification) => [classification, classifications.filter((value) => value === classification).length]))
assert.equal(Object.values(classificationCounts).reduce((sum, count) => sum + count, 0), 75)
assert.equal(classificationCounts['ready-with-new-explicit-reviewed-bridge'], 6)
assert.equal(classificationCounts['needs-additional-identity-evidence'], 0)
assert.equal(classificationCounts['true-ambiguity'], 66)
assert.equal(classificationCounts['raw-observation-required'], 3)

const remainingPartition = {
  'Artifact slug-only': 21,
  ambiguous: 73,
  'Melee/Ranged needs-additional-identity-evidence': 28,
  'raw-unavailable': 3,
}
const remainingCount = Object.values(remainingPartition).reduce((sum, count) => sum + count, 0)
assert.equal(remainingCount, 125)
assert.equal(146 + remainingCount, 271)

const rowMarkdown = targetRows.map((row: any) => {
  const candidateDisposition = row.decision === 'ready-with-new-explicit-reviewed-bridge'
    ? `selected by reviewed candidate-specific targets:<br>${row.survivorList}`
    : `none; all ${row.candidateCount} survive typed-relation review:<br>${row.survivorList}`
  return `| ${inline(row.domainId)}<br>${inline(row.category)} — ${inline(row.canonicalName)} | ${row.candidateFacts} | ${candidateDisposition} | ${row.canonicalSource}<br>Candidate alias rows:<br>${row.bridgeFacts}<br>ENTITY_OVERRIDES has no row for this key; no alias/FI population was performed. | ${row.conflict}<br>candidate-specific targets reviewed=${row.candidateSpecificRelationCount}; accepted selectors=${row.selectedRelationCount}<br>${inline(row.decision)} |`
}).join('\n')
const unavailableMarkdown = unavailableRows.map((row) =>
  `| ${inline(row.domainId)}<br>${inline(row.category)} — ${inline(row.canonicalName)} | ${row.rawState}<br>${row.candidate} | ${row.source} | ${inline(row.classification)}<br>${row.reason} |`,
).join('\n')
const aliasStateSummary = [...aliasStates.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  .map(([state, count]) => `${inline(state)}: ${count} candidate observations`).join('; ')
const nextWaveMarkdown = readyRows.map((row: any) => {
  const selectedCandidate = row.candidates.find((candidate: any) => candidate.candidateSpecificRelations.some((relation: any) => relation.selected))
  assert.ok(selectedCandidate, `${row.domainId}: reviewed wave candidate missing`)
  const acceptedRelations = selectedCandidate.candidateSpecificRelations.filter((relation: any) => relation.selected)
  return `### ${inline(row.domainId)} — ${inline(row.canonicalName)}\n\n- Raw identity: ${inline(selectedCandidate.serializedId)}\n- Exact candidate package: ${inline(selectedCandidate.packagePath)}\n- Exact reviewed bridge relations:\n${acceptedRelations.map((relation: any) => `  - ${inline(relation.property)} → ${inline(relation.targetPackage)} :: ${inline(relation.targetObject)} (Raw edge ${inline(relation.rawEdgeLocator)})`).join('\n')}\n- Canonical source: ${row.canonicalSource}\n- Review: ${selectorRationales.get(row.domainId)}\n`
}).join('\n')
const acceptedRelationCount = readyRelationRows.length
const report = `# MCD Optimizer — Remaining Ambiguous Formal Identity Resolution Audit

## Scope and baseline

- Verified current main baseline: ${baseline}.
- Formal Identity at baseline: **146 / 271** — Melee 29, Ranged 23, Armor 71, Artifact 23.
- Remaining partition: **125** = Artifact slug-only 21 + ambiguous 73 + Melee/Ranged needs-additional-identity-evidence 28 + raw-unavailable 3.
- Reacquired this audit from current Raw Structural Inventory and Formal Identity: **38 Melee + 34 Ranged = 72 ambiguous identities**. Fireworks Arrow is outside this sweep.
- Raw-unavailable checks: sword, ender-armor, vanguard-armor. No Raw extraction or re-extraction was performed.

## Classification

| Classification | Count | Result |
| --- | ---: | --- |
| ready-with-existing-independent-source | 0 | No independent canonical-to-Raw edge selects an exact candidate. |
| ready-with-existing-reviewed-bridge-pattern | 0 | None of the targets has an accepted/high reviewed canonical alias or an applicable bridge pattern. |
| ready-with-new-explicit-reviewed-bridge | ${classificationCounts['ready-with-new-explicit-reviewed-bridge']} | Six domains have a candidate-specific dedicated typed target whose reviewed item cue selects one exact candidate. No Formal population is performed in this fix-up. |
| needs-additional-identity-evidence | ${classificationCounts['needs-additional-identity-evidence']} | No target has an unresolved potentially canonical-specific typed selector after adjudication. |
| true-ambiguity | ${classificationCounts['true-ambiguity']} | Each remaining target had its candidate-specific typed references reviewed; none supplies a canonical-specific selector. |
| raw-observation-required | ${classificationCounts['raw-observation-required']} | Existing committed sources cannot supply the exact missing package plus serialized identity observations. |
| **Total** | **75** | **38 Melee + 34 Ranged + 3 raw-unavailable.** |

Audit reconciliation: 75 / 75 targets; Melee 38 / 38; Ranged 34 / 34; raw-unavailable 3 / 3; candidate-specific typed-relation review 72 / 72; classification sum 75; accepted selector domains ${readyRows.length}; accepted exact typed relation observations ${acceptedRelationCount}; unsupported ordinal/family inference: **${unsupportedOrdinalFamilyInference}**.

## Source scan and evidence boundary

| Source | Check | Finding |
| --- | --- | --- |
| research/raw/game-data-raw-structural-inventory/manifest.json and candidate shards | Re-read all 72 current seeds and every retained candidate package; verified shard hashes and CDO property records. | 158 target-candidate observations across ${uniqueCandidatePackages.size} exact packages; all roles are instance; each package has exactly one CDO; both decoded NameProperty values match exactly within that candidate, while IDs differ between candidates of the same target. Roles: ${Object.entries(candidateRoles).map(([role, count]) => `${role} ${count}`).join(', ')}. |
| Candidate-specific CDO typed references | Compared exact property family + target package + target object sets between every candidate for all 72 domains; generic RootComponent and GearActor references were excluded. Every differentiating target was individually marked accepted or rejected with a canonical correspondence and reason. | Reviewed ${reviewedRelationTargetCount}/72 target sets and ${candidateSpecificRelationCount} candidate-specific relation observations. Accepted ${acceptedRelationCount} observations form ${readyRows.length} explicit selectors; the remaining differentiating references identify family/ordinal cues or Raw implementation data, not a canonical selector. All referenced Raw edge IDs and exact target package/object paths are in the per-domain rows. |
| Raw class, super, template, imports and inheritance | Inspected each unique candidate package's generated class export, serialized super chain, CDO template, BlueprintGeneratedClass imports and inheritance. | Candidate role and class structure remain instance-compatible across surviving candidates; no class-role evidence eliminates a candidate. Unique-package outgoing edge kinds: ${Object.entries(edgeCounts).map(([kind, count]) => `${kind} ${count}`).join(', ')}. |
| Canonical source and category audit | research/source-harvest.json identity record plus the Melee/Ranged category row for every target. | These sources support canonical domain ID/name and category. No row asserts a candidate's exact ItemIdName, ItemId.SerializedId, or Raw package path. Family, variantOf, mechanics, and display name do not bridge identities. |
| Game-data aliases and model alignment | Checked exact category + Raw identity alias rows and the current model-alignment resolver. | ${aliasStateSummary}. Rows with candidate identities are unresolved/unknown and have no canonical entity; missing rows remain missing. Model alignment therefore exposes unresolved/ambiguous candidates rather than a canonical Raw mapping. |
| scripts/equipment-icons.ts | Checked exact ENTITY_OVERRIDES keys for every target and the family/icon candidate logic. | No target has an override. Existing Melee/Ranged overrides are only Bonehead Hammer, Sinister Sword and Shrieking Crossbow, outside this 72-item set. Icon path, family-ordinal selection and internal family aliases are presentation/search hints. |
| Asset index and DataTable metadata | Checked research/raw/game-data-asset-index.json, Structural package references and table-like package metadata. | Asset paths describe source packages and presentation hints. The Structural inventory reaches ${tableLikePackageCount} table-like packages in its full graph; current parser does not decode DataTable row payloads, and no committed row/serialized mapping supplies a canonical-to-Raw edge. |
| Existing committed mapping inputs | Reviewed current source-harvest/category records, aliases, icon overrides, model-alignment resolver and explicit identity bridge definitions. | No existing alias/identity mapping selects these targets. The Sawblade precedent is referenced below as a committed code pattern; this audit does not claim a Git history scan. |

### Candidate adjudication rule

All ${ambiguousSeeds.length} target seed rows retain ${candidateOccurrences.length} candidate observations, each with role instance. Every candidate has one CDO, a decoded ItemIdName, and a decoded ItemId.SerializedId; those two exact fields agree within the package. Every target still has 2 or 3 distinct serialized Raw identities. No candidate is a helper, effect, projectile, actor, storable, template, or base class in the seed set, so role-based elimination is not justified. Candidate-specific sound/effect/projectile/animation references were compared by exact property and target. Six explicit item-specific cue sets select one candidate; the other ${classificationCounts['true-ambiguity']} target sets do not.

The Sawblade baseline pattern is defined in \`scripts/game-data-model-alignment.ts#REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES\`: an independent canonical source record plus exact candidate CDO plus candidate-specific \`InventoryDropSound\` plus dedicated target package. That pattern is only a review precedent here. The six results below are separate per-domain entries; no sound-name resolver or generic matching rule was added.

No accepted selector relies on \`Unique1\`/\`Unique2\` ordinal, candidate order, family, icon path, package basename, variantOf, suffix stripping, or normalized-catalog-name matching. Candidate-specific relations with those shapes were rejected individually in their rows.

## 72 ambiguous identities

For each candidate, the row records exact package, role, ItemIdName, SerializedId, class, super, template and Raw CDO locator. The candidate-specific relation subsection lists each property/target signature present on that candidate and absent from its competitors, with exact target package/object, canonical correspondence, accepted/rejected decision, rationale and Raw edge locator. Shared targets do not select a candidate.

| Domain / category / canonical name | Current candidates, roles, Raw identities, class relations and Raw locators | Candidate elimination and surviving candidates | Canonical bridge evidence, source locator and independence | Conflicting evidence and decision |
| --- | --- | --- | --- | --- |
${rowMarkdown}

## Raw-unavailable identities

| Domain / category / canonical name | Current Raw observation | Canonical/source locator and bridge check | Decision |
| --- | --- | --- | --- |
${unavailableMarkdown}

## NEXT IDENTITY WAVE — reviewed candidates only

Count: **${readyRows.length} domains**, with ${acceptedRelationCount} accepted exact typed relation observations. The mappings below are explicit and are not populated in this fix-up.

${nextWaveMarkdown}

Before a later implementation, fail closed on the exact candidate set and role, one CDO, ItemIdName/SerializedId agreement, every exact property and target package/object above, one canonical source record, one selected candidate, and then one accepted/high alias and one exact Formal Identity assertion. Candidate or target drift must stop that later wave.

Formal Identity population in this fix-up: **none**. No aliases or Formal assertions were written. Formal Identity remains 146 / 271 (Melee 29, Ranged 23, Armor 71, Artifact 23). Value v2, Relation v2, Raw Structural Inventory, Application and Optimizer remain unchanged.

## Final reconciliation

| Partition | Count |
| --- | ---: |
| Formal Identity | 146 |
| Artifact slug-only | 21 |
| Ambiguous (72 Melee/Ranged + Fireworks Arrow) | 73 |
| Melee/Ranged needs-additional-identity-evidence | 28 |
| Raw-unavailable | 3 |
| **Catalog total** | **271** |

The unpopulated remainder is still 125 (21 + 73 + 28 + 3), because no identity was populated. Within this sweep, six are reviewed wave candidates, ${classificationCounts['true-ambiguity']} are true ambiguities, and three require new Raw observations. The catalog's 73 ambiguous seeds remain unchanged until a future population task.

## Reproduction

npm run generate:remaining-formal-identity-resolution
npm run audit:remaining-formal-identity-resolution
npm run audit:game-data-raw-structural-inventory
npm run audit:formal-identity-evidence
`

const serializedReport = `${report.replaceAll('\r\n', '\n').trimEnd()}\n`
const absoluteReportPath = path.join(repositoryRoot, reportPath)
if (process.argv.includes('--write')) {
  fs.writeFileSync(absoluteReportPath, serializedReport)
}
assert.equal(fs.readFileSync(absoluteReportPath, 'utf8'), serializedReport, `Audit report drift; run generate:remaining-formal-identity-resolution`)

console.log(`Remaining Formal Identity audit passed: 75/75 targets (Melee 38/38; Ranged 34/34; raw-unavailable 3/3); candidate-specific typed relation review ${reviewedRelationTargetCount}/72 (${candidateSpecificRelationCount} observations); reviewed selectors ${readyRows.length} domains/${acceptedRelationCount} exact targets; classification sum 75; unsupported ordinal/family inference ${unsupportedOrdinalFamilyInference}; Formal Identity 146/271; remainder 125; catalog reconciliation 271.`)
