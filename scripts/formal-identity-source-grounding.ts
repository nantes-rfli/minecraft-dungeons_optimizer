import fs from 'node:fs'
import path from 'node:path'
import {
  battleRobeFormalIdentity,
  corruptedSeedsFormalIdentity,
  deathCapMushroomFormalIdentity,
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
  readyMeleeFormalIdentities,
  readyMeleeFormalIdentityInputs,
  readyRangedFormalIdentities,
  readyRangedFormalIdentityInputs,
  readyArtifactFormalIdentities,
  readyArtifactFormalIdentityInputs,
  readyArmorFormalIdentities,
  readyArmorFormalIdentityInputs,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeMeleeFormalIdentityInputs,
  reviewedBridgeRangedFormalIdentities,
  reviewedBridgeRangedFormalIdentityInputs,
  reviewedBridgeArtifactFormalIdentities,
  reviewedBridgeArtifactFormalIdentityInputs,
  reviewedTypedRelationMeleeFormalIdentities,
  reviewedTypedRelationMeleeFormalIdentityInputs,
  reviewedTypedRelationFormalIdentities,
  reviewedTypedRelationFormalIdentityInputs,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import { readFormalIdentityInventoryBindings, type FormalIdentityInventoryBindingInput } from './formal-identity-inventory-source.ts'
import {
  INDEPENDENT_SOURCE_ARTIFACT_ALIAS_BASIS,
  REVIEWED_ARTIFACT_ALIAS_BRIDGES,
  REVIEWED_ARTIFACT_INDEPENDENT_SOURCE_BRIDGES,
  REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES,
  REVIEWED_TYPED_RELATION_ALIAS_BRIDGES,
  TYPED_RELATION_ALIAS_BASIS,
  TYPED_RELATION_MELEE_ALIAS_BASIS,
} from './game-data-model-alignment.ts'

type Alias = {
  id?: string
  rawIdentity?: string
  category?: string
  status?: string
  confidence?: string
  canonicalEntity?: string
  basis?: string
  evidenceIds?: string[]
  candidates?: string[]
  assetPaths?: string[]
}

type IconEntry = {
  catalogId?: string
  sourcePackage?: string
  status?: string
  matchMethod?: string
}

type RangedEntry = { id?: string; name?: { en?: string } }
type MeleeEntry = { weaponId?: string; name?: { en?: string } }
type ArtifactEntry = { id?: string; name?: string; internalGameIds?: string[]; sourceIds?: string[] }
type ArtifactSource = { id?: string; kind?: string }
type ArmorAuditEntry = { id?: string; name?: string; levelId?: string }
type SourceHarvestRecord = {
  category?: string
  id?: string
  label?: string
  known?: { property?: string; value?: { canonicalId?: string; names?: { en?: string } } }[]
}
type RawStructuralSeed = {
  catalogId?: string
  category?: string
  catalogInternalId?: string
  status?: string
  matchBasis?: string[]
  candidates?: { packagePath?: string; objectName?: string; role?: string; evidence?: string[] }[]
}

export type FormalReviewedSources = {
  existingPaths: Set<string>
  aliases?: { aliases?: Alias[] }
  icons?: { entries?: IconEntry[] }
  rangedAudit?: { entries?: RangedEntry[] }
  meleeAudit?: { weapons?: MeleeEntry[] }
  artifactAudit?: { entries?: ArtifactEntry[]; populationDifferences?: ArtifactEntry[]; sources?: ArtifactSource[] }
  armorAudit?: { entries?: ArmorAuditEntry[] }
  rawStructuralSeeds?: { catalogSeeds?: RawStructuralSeed[] }
  armorReadinessAuditSource?: string
  armorInventoryBindings: FormalIdentityInventoryBindingInput[]
  reviewedArtifactInventoryBindings: FormalIdentityInventoryBindingInput[]
  sourceBackedArtifactInventoryBindings: FormalIdentityInventoryBindingInput[]
  typedRelationMeleeInventoryBindings: FormalIdentityInventoryBindingInput[]
  typedRelationCanonicalRecords: SourceHarvestRecord[]
  reviewedTypedRelationMeleeBridges: {
    domainId: string
    displayName: string
    rawIdentity: string
    packagePath: string
    canonicalSource: { artifactPath: string; locator: string }
    relationProperty: string
    edgeKind: string
    targetPackage: string
  }[]
  reviewedTypedRelationInventoryBindings: FormalIdentityInventoryBindingInput[]
  reviewedTypedRelationCanonicalRecords: SourceHarvestRecord[]
  reviewedTypedRelationBridges: {
    category: 'melee-weapon' | 'ranged-weapon'
    domainId: string
    displayName: string
    rawIdentity: string
    packagePath: string
    canonicalSource: { artifactPath: string; locator: string }
    relations: {
      property: string
      targetPackage: string
      targetObject: string
      rawEdgeLocator: string
    }[]
    reviewRationale: string
  }[]
  typedRelationReviewAuditSource?: string
  reviewedArtifactAliasBridges: { domainId: string; rawIdentity: string; packagePath: string }[]
  independentSourceArtifactBridges: { domainId: string; rawIdentity: string; packagePath: string }[]
  historicalMappingSource?: string
  equipmentIconSource?: string
  presentations: {
    fightersBindings?: string
    scatterCrossbow?: string
    battleRobe?: string
    deathCapMushroom?: string
    melee: Record<string, string | undefined>
    ranged: Record<string, string | undefined>
    artifact: Record<string, string | undefined>
    armor: Record<string, string | undefined>
  }
  battleRobeCatalogId?: string
}

const knownPaths = [
  'research/domain/game-data-entity-aliases.json',
  'research/source-harvest.json',
  'scripts/game-data-model-alignment.ts',
  'generated/equipment-icons/manifest.json',
  'scripts/equipment-icons.ts',
  'scripts/audit-attack-event-comparison.ts',
  'src/data/weapons.ts',
  'research/ranged-weapon-audit.json',
  'research/melee-attack-profile-audit.json',
  'research/artifact-audit.json',
  'research/armor-audit.json',
  'src/data/armors.ts',
  'src/data/artifacts.ts',
  'research/raw/game-data-raw-structural-inventory/manifest.json',
  'docs/remaining_formal_identity_breadth_readiness_audit.md',
  'docs/remaining_ambiguous_formal_identity_resolution_audit.md',
] as const

export function readFormalReviewedSources(repositoryRoot: string): FormalReviewedSources {
  const existingPaths = new Set<string>(knownPaths.filter((sourcePath) => fs.existsSync(path.join(repositoryRoot, sourcePath))))
  const readJson = <T>(sourcePath: string): T | undefined => existingPaths.has(sourcePath)
    ? JSON.parse(fs.readFileSync(path.join(repositoryRoot, sourcePath), 'utf8')) as T
    : undefined
  const readText = (sourcePath: string) => existingPaths.has(sourcePath) ? fs.readFileSync(path.join(repositoryRoot, sourcePath), 'utf8') : undefined
  const historicalPath = 'scripts/audit-attack-event-comparison.ts'
  const rangedAudit = readJson<{ entries?: RangedEntry[] }>('research/ranged-weapon-audit.json')
  const meleeAudit = readJson<{ weapons?: MeleeEntry[] }>('research/melee-attack-profile-audit.json')
  const artifactAudit = readJson<{ entries?: ArtifactEntry[]; populationDifferences?: ArtifactEntry[]; sources?: ArtifactSource[] }>('research/artifact-audit.json')
  const armorAudit = readJson<{ entries?: ArmorAuditEntry[] }>('research/armor-audit.json')
  const rawStructuralSeeds = readJson<{ catalogSeeds?: RawStructuralSeed[] }>('research/raw/game-data-raw-structural-inventory/manifest.json')
  const sourceHarvest = readJson<{ records?: SourceHarvestRecord[] }>('research/source-harvest.json')
  const typedRelationDomainIds = new Set<string>(REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES.map(({ domainId }) => domainId))
  const reviewedTypedRelationDomainKeys = new Set<string>(REVIEWED_TYPED_RELATION_ALIAS_BRIDGES.map(({ category, domainId }) => `${category}:${domainId}`))
  const armorReadinessAuditSource = readText('docs/remaining_formal_identity_breadth_readiness_audit.md')
  const typedRelationReviewAuditSource = readText('docs/remaining_ambiguous_formal_identity_resolution_audit.md')
  const weaponsSource = readText('src/data/weapons.ts') ?? ''
  const armorsSource = readText('src/data/armors.ts') ?? ''
  const artifactsSource = readText('src/data/artifacts.ts') ?? ''
  const fightersBlock = weaponsSource.match(/'fighters-bindings':\s*\{[\s\S]*?name:\s*\{[^}]*?en:\s*"([^"]+)"/)
  const battleRobeBlock = armorsSource.match(/'battle-robe':\s*\{[\s\S]*?id:\s*'([^']+)'[\s\S]*?name:\s*\{[^}]*?en:\s*'([^']+)'/)
  const mushroomBlock = artifactsSource.match(/'death-cap-mushroom':\s*\{[\s\S]*?name:\s*\{[^}]*?en:\s*'([^']+)'/)
  return {
    existingPaths,
    aliases: readJson('research/domain/game-data-entity-aliases.json'),
    icons: readJson('generated/equipment-icons/manifest.json'),
    rangedAudit,
    meleeAudit,
    artifactAudit,
    armorAudit,
    rawStructuralSeeds,
    armorReadinessAuditSource,
    armorInventoryBindings: readFormalIdentityInventoryBindings(repositoryRoot, readyArmorFormalIdentities),
    reviewedArtifactInventoryBindings: readFormalIdentityInventoryBindings(repositoryRoot, reviewedBridgeArtifactFormalIdentities),
    sourceBackedArtifactInventoryBindings: readFormalIdentityInventoryBindings(repositoryRoot, [corruptedSeedsFormalIdentity]),
    typedRelationMeleeInventoryBindings: readFormalIdentityInventoryBindings(repositoryRoot, reviewedTypedRelationMeleeFormalIdentities),
    typedRelationCanonicalRecords: (sourceHarvest?.records ?? []).filter((record) => record.category === 'melee-weapon' && typeof record.id === 'string' && typedRelationDomainIds.has(record.id)),
    reviewedTypedRelationMeleeBridges: REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES.map((bridge) => ({ ...bridge, canonicalSource: { ...bridge.canonicalSource } })),
    reviewedTypedRelationInventoryBindings: readFormalIdentityInventoryBindings(repositoryRoot, reviewedTypedRelationFormalIdentities),
    reviewedTypedRelationCanonicalRecords: (sourceHarvest?.records ?? []).filter((record) => typeof record.category === 'string' && typeof record.id === 'string' && reviewedTypedRelationDomainKeys.has(`${record.category}:${record.id}`)),
    reviewedTypedRelationBridges: REVIEWED_TYPED_RELATION_ALIAS_BRIDGES.map((bridge) => ({ ...bridge, canonicalSource: { ...bridge.canonicalSource }, relations: bridge.relations.map((relation) => ({ ...relation })) })),
    typedRelationReviewAuditSource,
    reviewedArtifactAliasBridges: REVIEWED_ARTIFACT_ALIAS_BRIDGES.map(({ domainId, rawIdentity, packagePath }) => ({ domainId, rawIdentity, packagePath })),
    independentSourceArtifactBridges: REVIEWED_ARTIFACT_INDEPENDENT_SOURCE_BRIDGES.map(({ domainId, rawIdentity, packagePath }) => ({ domainId, rawIdentity, packagePath })),
    historicalMappingSource: readText(historicalPath),
    equipmentIconSource: readText('scripts/equipment-icons.ts'),
    presentations: {
      fightersBindings: fightersBlock?.[1],
      scatterCrossbow: rangedAudit?.entries?.find((entry) => entry.id === 'scatter-crossbow')?.name?.en,
      battleRobe: battleRobeBlock?.[2],
      deathCapMushroom: mushroomBlock?.[1],
      melee: Object.fromEntries([...readyMeleeFormalIdentityInputs, ...reviewedBridgeMeleeFormalIdentityInputs, ...reviewedTypedRelationMeleeFormalIdentityInputs, ...reviewedTypedRelationFormalIdentityInputs.filter(({ category }) => category === 'melee')].map(({ domainId }) => [
        domainId,
        meleeAudit?.weapons?.find((entry) => entry.weaponId === domainId)?.name?.en,
      ])),
      ranged: Object.fromEntries([...readyRangedFormalIdentityInputs, ...reviewedBridgeRangedFormalIdentityInputs, ...reviewedTypedRelationFormalIdentityInputs.filter(({ category }) => category === 'ranged')].map(({ domainId }) => [
        domainId,
        rangedAudit?.entries?.find((entry) => entry.id === domainId)?.name?.en,
      ])),
      artifact: Object.fromEntries([...readyArtifactFormalIdentityInputs, ...reviewedBridgeArtifactFormalIdentityInputs, { domainId: corruptedSeedsFormalIdentity.assertion.domainId }].map(({ domainId }) => [
        domainId,
        artifactAudit?.entries?.find((entry) => entry.id === domainId)?.name
          ?? artifactAudit?.populationDifferences?.find((entry) => entry.id === domainId)?.name,
      ])),
      armor: Object.fromEntries(readyArmorFormalIdentityInputs.map(({ domainId }) => [
        domainId,
        armorAudit?.entries?.find((entry) => entry.id === domainId)?.name,
      ])),
    },
    battleRobeCatalogId: battleRobeBlock?.[1],
  }
}

export function collectFormalReviewedSourceGroundingErrors(sources: FormalReviewedSources): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  for (const sourcePath of knownPaths) check(sources.existingPaths.has(sourcePath), `reviewed source artifact missing: ${sourcePath}`)

  const aliases = sources.aliases?.aliases ?? []
  const acceptedChecks = [
    {
      definition: scatterCrossbowFormalIdentity,
      aliasId: 'ranged-weapon:ScatterCrossbow',
      canonicalEntity: 'ranged-weapon:scatter-crossbow',
    },
    {
      definition: deathCapMushroomFormalIdentity,
      aliasId: 'artifact:DeathCapMushroom',
      canonicalEntity: 'artifact:death-cap-mushroom',
    },
  ] as const
  for (const { definition, aliasId, canonicalEntity } of acceptedChecks) {
    const alias = aliases.find((entry) => entry.id === aliasId)
    const assertion = definition.assertion
    check(Boolean(alias), `${assertion.id}: accepted alias source missing`)
    check(alias?.rawIdentity === assertion.rawIdentity, `${assertion.id}: accepted alias rawIdentity drift`)
    check(alias?.status === assertion.reviewState && assertion.reviewState === 'accepted', `${assertion.id}: accepted alias status drift`)
    check(alias?.confidence === assertion.confidence && assertion.confidence === 'high', `${assertion.id}: accepted alias confidence drift`)
    check(alias?.canonicalEntity === canonicalEntity && canonicalEntity.endsWith(assertion.domainId), `${assertion.id}: accepted alias canonicalEntity drift`)
  }

  for (const definition of readyArtifactFormalIdentities) {
    const assertion = definition.assertion
    const aliasId = `artifact:${assertion.rawIdentity}`
    const matchingAliases = aliases.filter((entry) => entry.id === aliasId)
    const alias = matchingAliases[0]
    check(matchingAliases.length === 1, `${assertion.id}: accepted Artifact alias must exist exactly once`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: Artifact breadth assertion must be accepted/high`)
    check(alias?.category === 'artifact', `${assertion.id}: accepted Artifact alias category drift`)
    check(alias?.status === 'accepted', `${assertion.id}: accepted Artifact alias status drift`)
    check(alias?.confidence === 'high', `${assertion.id}: accepted Artifact alias confidence drift`)
    check(alias?.rawIdentity === assertion.rawIdentity, `${assertion.id}: accepted Artifact alias rawIdentity drift`)
    check(alias?.canonicalEntity === `artifact:${assertion.domainId}`, `${assertion.id}: accepted Artifact alias canonicalEntity drift`)
    check(alias?.assetPaths?.includes(assertion.applicationScope.packagePath) === true, `${assertion.id}: accepted Artifact alias package/source drift`)
    check(
      assertion.evidenceRefs.length === 1 && definition.reviewedEvidence.some((record) =>
        record.id === assertion.evidenceRefs[0]
        && record.kind === 'reviewed'
        && record.role === 'support'
        && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json'
        && record.source.locator === `aliases[id=${aliasId}]`),
      `${assertion.id}: Artifact assertion is not grounded in its reviewed alias record`,
    )
    check(
      definition.presentation.displayName === sources.presentations.artifact[assertion.domainId],
      `${assertion.id}: presentation displayName drift`,
    )
  }
  check(readyArtifactFormalIdentities.length === 6, 'ready Artifact Formal identity population drift')
  check(new Set(readyArtifactFormalIdentities.map(({ assertion }) => assertion.domainId)).size === 6, 'ready Artifact Formal domainId uniqueness drift')


  const allowedMeleeAliasBases = new Set([
    'serialized-item-id + exact-catalog-slug + catalog-category-evidence',
    'serialized-item-id + reviewed-alias + catalog-category-evidence',
  ])
  for (const definition of readyMeleeFormalIdentities) {
    const assertion = definition.assertion
    const aliasId = `melee-weapon:${assertion.rawIdentity}`
    const alias = aliases.find((entry) => entry.id === aliasId)
    check(Boolean(alias), `${assertion.id}: accepted Melee alias source missing`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: breadth assertion must be accepted/high`)
    check(alias?.category === 'melee-weapon', `${assertion.id}: accepted Melee alias category drift`)
    check(alias?.status === 'accepted', `${assertion.id}: accepted Melee alias status drift`)
    check(alias?.confidence === 'high', `${assertion.id}: accepted Melee alias confidence drift`)
    check(alias?.rawIdentity === assertion.rawIdentity, `${assertion.id}: accepted Melee alias rawIdentity drift`)
    check(alias?.canonicalEntity === `melee-weapon:${assertion.domainId}`, `${assertion.id}: accepted Melee alias canonicalEntity drift`)
    check(alias?.assetPaths?.includes(assertion.applicationScope.packagePath) === true, `${assertion.id}: accepted Melee alias package/source drift`)
    check(allowedMeleeAliasBases.has(alias?.basis ?? ''), `${assertion.id}: accepted Melee alias basis is not reviewed for this wave`)
    check(
      assertion.evidenceRefs.length === 1 && definition.reviewedEvidence.some((record) =>
        record.id === assertion.evidenceRefs[0]
        && record.kind === 'reviewed'
        && record.role === 'support'
        && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json'
        && record.source.locator === `aliases[id=${aliasId}]`),
      `${assertion.id}: breadth assertion is not grounded in its reviewed alias record`,
    )
    check(
      definition.presentation.displayName === sources.presentations.melee[assertion.domainId],
      `${assertion.id}: presentation displayName drift`,
    )
  }
  check(readyMeleeFormalIdentities.length === 24, 'ready Melee Formal identity population drift')
  check(new Set(readyMeleeFormalIdentities.map(({ assertion }) => assertion.domainId)).size === 24, 'ready Melee Formal domainId uniqueness drift')

  const allowedRangedAliasBases = new Set([
    'serialized-item-id + exact-catalog-slug + catalog-category-evidence',
    'asset-index-entity + exact-catalog-slug + catalog-category-evidence',
    'serialized-item-id + reviewed-alias + catalog-category-evidence',
    'asset-index-entity + reviewed-alias + catalog-category-evidence',
  ])
  for (const definition of readyRangedFormalIdentities) {
    const assertion = definition.assertion
    const aliasId = `ranged-weapon:${assertion.rawIdentity}`
    const alias = aliases.find((entry) => entry.id === aliasId)
    check(Boolean(alias), `${assertion.id}: accepted Ranged alias source missing`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: Ranged breadth assertion must be accepted/high`)
    check(alias?.category === 'ranged-weapon', `${assertion.id}: accepted Ranged alias category drift`)
    check(alias?.status === 'accepted', `${assertion.id}: accepted Ranged alias status drift`)
    check(alias?.confidence === 'high', `${assertion.id}: accepted Ranged alias confidence drift`)
    check(alias?.rawIdentity === assertion.rawIdentity, `${assertion.id}: accepted Ranged alias rawIdentity drift`)
    check(alias?.canonicalEntity === `ranged-weapon:${assertion.domainId}`, `${assertion.id}: accepted Ranged alias canonicalEntity drift`)
    check(alias?.assetPaths?.includes(assertion.applicationScope.packagePath) === true, `${assertion.id}: accepted Ranged alias package/source drift`)
    check(allowedRangedAliasBases.has(alias?.basis ?? ''), `${assertion.id}: accepted Ranged alias basis is not reviewed for this wave`)
    check(
      assertion.evidenceRefs.length === 1 && definition.reviewedEvidence.some((record) =>
        record.id === assertion.evidenceRefs[0]
        && record.kind === 'reviewed'
        && record.role === 'support'
        && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json'
        && record.source.locator === `aliases[id=${aliasId}]`),
      `${assertion.id}: Ranged breadth assertion is not grounded in its reviewed alias record`,
    )
    check(
      definition.presentation.displayName === sources.presentations.ranged[assertion.domainId],
      `${assertion.id}: presentation displayName drift`,
    )
  }
  check(readyRangedFormalIdentities.length === 21, 'ready Ranged Formal identity population drift')
  check(new Set(readyRangedFormalIdentities.map(({ assertion }) => assertion.domainId)).size === 21, 'ready Ranged Formal domainId uniqueness drift')

  const armorReadinessBlock = sources.armorReadinessAuditSource
    ?.split('### ready-with-existing-source-adapter (70)\n')[1]
    ?.split('\n### ready-with-small-reviewed-bridge')[0]
  const expectedArmorIds = [...(armorReadinessBlock ?? '').matchAll(/`([^`]+)`/g)].map(([, id]) => id!)
  const actualArmorIds = readyArmorFormalIdentityInputs.map(({ domainId }) => domainId)
  check(expectedArmorIds.length === 70, 'Armor readiness authority must enumerate exactly 70 adapter-ready identities')
  check(JSON.stringify(actualArmorIds) === JSON.stringify(expectedArmorIds), 'Armor Formal IDs differ from the audited ready-with-existing-source-adapter set')
  check(readyArmorFormalIdentities.length === 70, 'ready Armor Formal identity population drift')
  check(new Set(actualArmorIds).size === 70, 'ready Armor Formal domainId uniqueness drift')
  check(!actualArmorIds.some((id) => ['battle-robe', 'ender-armor', 'vanguard-armor'].includes(id)), 'excluded Armor identity entered the Phase B population')

  const armorEntries = sources.armorAudit?.entries ?? []
  const rawSeeds = sources.rawStructuralSeeds?.catalogSeeds ?? []
  for (const definition of readyArmorFormalIdentities) {
    const assertion = definition.assertion
    const armorInput = readyArmorFormalIdentityInputs.find((input) => input.domainId === assertion.domainId)
    const matchingArmorEntries = armorEntries.filter((entry) => entry.id === assertion.domainId)
    const armorEntry = matchingArmorEntries[0]
    const matchingSeeds = rawSeeds.filter((seed) => seed.category === 'armor' && seed.catalogId === assertion.domainId)
    const seed = matchingSeeds[0]
    const candidates = seed?.candidates ?? []
    const candidate = candidates[0]
    const matchingBindings = sources.armorInventoryBindings.filter((binding) => binding.definition.assertion.id === assertion.id)
    const binding = matchingBindings[0]
    const cdoExports = binding?.structuralPackage.exports.filter((entry) => entry.isClassDefaultObject) ?? []
    const cdo = cdoExports[0]
    const cdoClass = cdo?.references.class
    const cdoClassObjectName = cdoClass && typeof cdoClass === 'object' && 'objectName' in cdoClass ? cdoClass.objectName : undefined
    const cdoInventories = cdo
      ? binding?.structuralPackage.cdoPropertyInventory.filter((entry) => entry.exportIndex === cdo.exportIndex) ?? []
      : []
    const observation = binding?.observation
    const expectedRawIdentity = armorEntry?.levelId

    check(matchingArmorEntries.length === 1, `${assertion.id}: armor-audit entry must exist exactly once`)
    check(typeof expectedRawIdentity === 'string' && expectedRawIdentity.length > 0, `${assertion.id}: armor-audit levelId is missing`)
    check(Boolean(armorInput), `${assertion.id}: Armor identity is outside the audited ready set`)
    check(assertion.domainId === armorInput?.domainId, `${assertion.id}: Armor Formal domainId drift`)
    check(assertion.rawIdentity === expectedRawIdentity, `${assertion.id}: Formal rawIdentity differs from armor-audit levelId`)
    check(assertion.rawIdentity === armorInput?.rawIdentity, `${assertion.id}: Armor identity rawIdentity differs from its reviewed input`)
    check(assertion.applicationScope.packagePath === armorInput?.packagePath, `${assertion.id}: Formal applicationScope package drift`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: Armor assertion must be accepted/high from the explicit catalog bridge`)
    check(matchingSeeds.length === 1, `${assertion.id}: Raw Structural armor catalog seed must exist exactly once`)
    check(seed?.catalogInternalId === expectedRawIdentity, `${assertion.id}: Raw Structural catalog internal ID differs from armor-audit levelId`)
    check(seed?.status === 'exact' && seed.matchBasis?.includes('serialized-catalog-identifier-match') === true, `${assertion.id}: Raw Structural seed lacks serialized catalog identity evidence`)
    check(candidates.length === 1, `${assertion.id}: Raw Structural candidate must exist exactly once`)
    check(candidate?.role === 'instance', `${assertion.id}: Raw Structural candidate is not an instance package`)
    check(candidate?.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: candidate/package binding drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemIdName=${expectedRawIdentity}`) === true, `${assertion.id}: candidate ItemIdName bridge evidence drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemId.SerializedId=${expectedRawIdentity}`) === true, `${assertion.id}: candidate SerializedId bridge evidence drift`)
    check(candidate?.evidence?.includes(`serialized-identity-match:ItemIdName->catalog:${assertion.domainId}`) === true, `${assertion.id}: candidate ItemIdName catalog binding drift`)
    check(candidate?.evidence?.includes(`serialized-identity-match:ItemId.SerializedId->catalog:${assertion.domainId}`) === true, `${assertion.id}: candidate SerializedId catalog binding drift`)
    check(matchingBindings.length === 1, `${assertion.id}: exact Structural package binding must exist exactly once`)
    check(binding?.structuralPackage.path === candidate?.packagePath, `${assertion.id}: Structural package path differs from the exact candidate`)
    check(cdoExports.length === 1, `${assertion.id}: Structural package must contain exactly one CDO`)
    check(cdoClassObjectName === candidate?.objectName, `${assertion.id}: candidate object does not bind to the Structural CDO class`)
    check(cdoInventories.length === 1, `${assertion.id}: Structural package must contain exactly one CDO property inventory`)
    check(observation?.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: observation package differs from application scope`)
    check(observation?.rawSchemaVersion === assertion.applicationScope.rawSchemaVersion, `${assertion.id}: observation schema version differs from application scope`)
    check(observation?.itemIdName.observation.state === 'known' && observation.itemIdName.observation.value === expectedRawIdentity, `${assertion.id}: Structural ItemIdName differs from armor-audit levelId`)
    check(observation?.itemIdName.provenance.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: Structural ItemIdName package provenance drift`)
    check(observation?.serializedId.observation.state === 'known' && observation.serializedId.observation.value === expectedRawIdentity, `${assertion.id}: Structural SerializedId differs from armor-audit levelId`)
    check(observation?.serializedId.provenance.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: Structural SerializedId package provenance drift`)
    check(observation?.itemIdName.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: ItemIdName does not come from the exact Structural shard`)
    check(observation?.serializedId.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: SerializedId does not come from the exact Structural shard`)
    check(!!armorEntry && definition.presentation.displayName === armorEntry.name && definition.presentation.displayName === sources.presentations.armor[assertion.domainId], `${assertion.id}: presentation displayName drift`)
    check(
      assertion.evidenceRefs.length === 1
      && definition.reviewedEvidence.some((record) => record.id === assertion.evidenceRefs[0] && record.kind === 'reviewed' && record.role === 'support' && record.source.artifactPath === 'research/armor-audit.json' && record.source.locator === `entries[id=${assertion.domainId}].levelId`)
      && definition.reviewedEvidence.some((record) => record.kind === 'reviewed' && record.role === 'support' && record.source.artifactPath === 'research/armor-audit.json' && record.source.locator === `entries[id=${assertion.domainId}].name`),
      `${assertion.id}: Armor identity evidence must use the armor-audit canonical bridge and presentation source`,
    )
  }

  const entityOverrideValues = (source: string, key: string): string[] => {
    const block = source.match(/const ENTITY_OVERRIDES:[\s\S]*?=\s*\{([\s\S]*?)\n\}/)?.[1]
    if (!block) return []
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...block.matchAll(new RegExp(`^\\s*'${escapedKey}'\\s*:\\s*'([^']+)'\\s*,?\\s*$`, 'gm'))].map((match) => match[1]!)
  }
  const reviewedBridgeBasis = 'serialized-item-id + documented-entity-alias + catalog-category-evidence'
  const bridgeCases = [
    ...reviewedBridgeMeleeFormalIdentities.map((definition, index) => ({
      definition,
      input: reviewedBridgeMeleeFormalIdentityInputs[index]!,
      aliasCategory: 'melee-weapon' as const,
      overrideCategory: 'melee' as const,
      sourceDisplayName: sources.presentations.melee[definition.assertion.domainId],
    })),
    ...reviewedBridgeRangedFormalIdentities.map((definition, index) => ({
      definition,
      input: reviewedBridgeRangedFormalIdentityInputs[index]!,
      aliasCategory: 'ranged-weapon' as const,
      overrideCategory: 'ranged' as const,
      sourceDisplayName: sources.presentations.ranged[definition.assertion.domainId],
    })),
    ...reviewedBridgeArtifactFormalIdentities.map((definition, index) => ({
      definition,
      input: reviewedBridgeArtifactFormalIdentityInputs[index]!,
      aliasCategory: 'artifact' as const,
      overrideCategory: 'artifact' as const,
      sourceDisplayName: sources.presentations.artifact[definition.assertion.domainId],
    })),
  ]
  for (const { definition, input, aliasCategory, overrideCategory, sourceDisplayName } of bridgeCases) {
    const assertion = definition.assertion
    const aliasId = `${aliasCategory}:${input.rawIdentity}`
    const canonicalEntity = `${aliasCategory}:${input.domainId}`
    const overrideKey = `${overrideCategory}:${input.domainId}`
    const matchingAliases = aliases.filter((entry) => entry.id === aliasId)
    const alias = matchingAliases[0]
    const aliasEvidenceRef = `evidence:reviewed:${input.domainId}:accepted-alias`
    const overrideEvidenceRef = `evidence:reviewed:${input.domainId}:documented-entity-alias`
    check(matchingAliases.length === 1, `${assertion.id}: reviewed bridge alias must exist exactly once`)
    check(Boolean(alias), `${assertion.id}: reviewed bridge alias source missing`)
    check(assertion.domainId === input.domainId && assertion.rawIdentity === input.rawIdentity, `${assertion.id}: reviewed bridge Formal identity drift`)
    check(assertion.applicationScope.packagePath === input.packagePath, `${assertion.id}: reviewed bridge Formal package drift`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: reviewed bridge assertion must be accepted/high`)
    check(alias?.category === aliasCategory, `${assertion.id}: reviewed bridge alias category drift`)
    check(alias?.status === 'accepted', `${assertion.id}: reviewed bridge alias status drift`)
    check(alias?.confidence === 'high', `${assertion.id}: reviewed bridge alias confidence drift`)
    check(alias?.rawIdentity === input.rawIdentity, `${assertion.id}: reviewed bridge alias rawIdentity drift`)
    check(alias?.canonicalEntity === canonicalEntity, `${assertion.id}: reviewed bridge alias canonicalEntity drift`)
    check(alias?.candidates?.length === 1 && alias.candidates[0] === canonicalEntity, `${assertion.id}: reviewed bridge alias candidates drift`)
    check(alias?.assetPaths?.includes(input.packagePath) === true, `${assertion.id}: reviewed bridge alias package/source drift`)
    check((alias?.evidenceIds?.length ?? 0) > 0, `${assertion.id}: reviewed bridge alias catalog evidence missing`)
    check(alias?.basis === reviewedBridgeBasis, `${assertion.id}: reviewed bridge basis drift`)
    const overrideValues = entityOverrideValues(sources.equipmentIconSource ?? '', overrideKey)
    check(overrideValues.length === 1 && overrideValues[0] === input.rawIdentity, `${assertion.id}: documented ENTITY_OVERRIDES key must exist exactly once with the exact Raw identity`)
    check(
      assertion.evidenceRefs.length === 2
      && assertion.evidenceRefs[0] === aliasEvidenceRef
      && assertion.evidenceRefs[1] === overrideEvidenceRef
      && definition.reviewedEvidence.some((record) => record.id === aliasEvidenceRef && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json' && record.source.locator === `aliases[id=${aliasId}]`)
      && definition.reviewedEvidence.some((record) => record.id === overrideEvidenceRef && record.source.artifactPath === 'scripts/equipment-icons.ts' && record.source.locator === `ENTITY_OVERRIDES['${overrideKey}']`),
      `${assertion.id}: reviewed bridge evidence chain drift`,
    )
    check(definition.presentation.displayName === sourceDisplayName, `${assertion.id}: reviewed bridge presentation displayName drift`)
    if (aliasCategory === 'artifact') {
      const researchMappings = sources.reviewedArtifactAliasBridges.filter((mapping) => mapping.domainId === input.domainId)
      check(researchMappings.length === 1, `${assertion.id}: research-owned Artifact bridge mapping must exist exactly once`)
      check(
        researchMappings[0]?.rawIdentity === input.rawIdentity && researchMappings[0]?.packagePath === input.packagePath,
        `${assertion.id}: research-owned Artifact bridge mapping drift`,
      )
    }
  }
  check(reviewedBridgeMeleeFormalIdentities.length === 2, 'reviewed bridge Melee population drift')
  check(reviewedBridgeRangedFormalIdentities.length === 1, 'reviewed bridge Ranged population drift')
  check(reviewedBridgeArtifactFormalIdentities.length === 15, 'reviewed bridge Artifact population drift')
  check(REVIEWED_ARTIFACT_ALIAS_BRIDGES.length === 15, 'documented Artifact bridge population drift')
  check(sources.reviewedArtifactAliasBridges.length === 15, 'documented Artifact bridge source set population drift')
  check(REVIEWED_ARTIFACT_INDEPENDENT_SOURCE_BRIDGES.length === 1, 'independent-source Artifact bridge population drift')
  check(bridgeCases.length === 18, 'reviewed bridge total population drift')

  check(REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES.length === 2, 'reviewed typed-relation Melee bridge source population drift')
  check(sources.reviewedTypedRelationMeleeBridges.length === 2, 'reviewed typed-relation Melee bridge population drift')
  check(reviewedTypedRelationMeleeFormalIdentities.length === 2, 'reviewed typed-relation Melee Formal population drift')
  for (const definition of reviewedTypedRelationMeleeFormalIdentities) {
    const assertion = definition.assertion
    const input = reviewedTypedRelationMeleeFormalIdentityInputs.find((candidate) => candidate.domainId === assertion.domainId)
    const bridgeMatches = sources.reviewedTypedRelationMeleeBridges.filter((bridge) => bridge.domainId === assertion.domainId)
    const rawBridgeMatches = sources.reviewedTypedRelationMeleeBridges.filter((bridge) => bridge.rawIdentity === assertion.rawIdentity)
    const bridge = bridgeMatches[0]
    const canonicalRecords = sources.typedRelationCanonicalRecords.filter((record) => record.category === 'melee-weapon' && record.id === assertion.domainId)
    const canonicalRecord = canonicalRecords[0]
    const identityKnown = canonicalRecord?.known?.filter((known) => known.property === 'identity') ?? []
    const identityValue = identityKnown[0]?.value
    const aliasId = `melee-weapon:${assertion.rawIdentity}`
    const canonicalEntity = `melee-weapon:${assertion.domainId}`
    const matchingAliases = aliases.filter((entry) => entry.id === aliasId)
    const alias = matchingAliases[0]
    const matchingSeeds = rawSeeds.filter((seed) => seed.category === 'melee' && seed.catalogId === assertion.domainId)
    const seed = matchingSeeds[0]
    const candidates = seed?.candidates ?? []
    const candidate = candidates[0]
    const matchingBindings = sources.typedRelationMeleeInventoryBindings.filter((binding) => binding.definition.assertion.id === assertion.id)
    const binding = matchingBindings[0]
    const cdoExports = binding?.structuralPackage.exports.filter((entry) => entry.isClassDefaultObject) ?? []
    const cdo = cdoExports[0]
    const cdoClass = cdo?.references.class
    const cdoClassObjectName = cdoClass && typeof cdoClass === 'object' && 'objectName' in cdoClass ? cdoClass.objectName : undefined
    const cdoInventories = cdo
      ? binding?.structuralPackage.cdoPropertyInventory.filter((entry) => entry.exportIndex === cdo.exportIndex) ?? []
      : []
    const relationProperties = cdoInventories[0]?.properties.filter((property) => property.name.value === bridge?.relationProperty && property.arrayIndex === 0) ?? []
    const relationEdges = binding?.structuralEdges.filter((edge) =>
      edge.sourcePackage === bridge?.packagePath
      && edge.sourceOccurrence.kind === 'cdo-property'
      && edge.sourceOccurrence.propertyPath === bridge?.relationProperty) ?? []
    const relationEdge = relationEdges[0]
    const observation = binding?.observation
    const aliasEvidenceRef = `evidence:reviewed:${assertion.domainId}:accepted-alias`
    const bridgeEvidenceRef = `evidence:reviewed:${assertion.domainId}:typed-raw-relation-bridge`

    check(Boolean(input), `${assertion.id}: typed-relation identity is outside the reviewed input set`)
    check(bridgeMatches.length === 1 && rawBridgeMatches.length === 1, `${assertion.id}: research-owned typed-relation bridge must exist exactly once by domain and Raw identity`)
    check(bridge?.displayName === input?.displayName && bridge?.rawIdentity === input?.rawIdentity && bridge?.packagePath === input?.packagePath, `${assertion.id}: research-owned typed-relation bridge domain/raw/package drift`)
    check(bridge?.canonicalSource.artifactPath === 'research/source-harvest.json' && bridge.canonicalSource.locator === `records[category=melee-weapon,id=${assertion.domainId}]`, `${assertion.id}: typed-relation canonical source locator drift`)
    check(bridge?.relationProperty === 'InventoryDropSound', `${assertion.id}: typed relation property drift`)
    check(bridge?.edgeKind === 'soft-object-property', `${assertion.id}: typed relation edge kind drift`)
    check(typeof bridge?.targetPackage === 'string' && bridge.targetPackage.length > 0, `${assertion.id}: typed relation target package missing`)
    check(canonicalRecords.length === 1, `${assertion.id}: canonical source record must exist exactly once`)
    check(canonicalRecord?.category === 'melee-weapon' && canonicalRecord?.id === assertion.domainId && canonicalRecord?.label === input?.displayName, `${assertion.id}: canonical source category/domain/displayName drift`)
    check(identityKnown.length === 1 && identityValue?.canonicalId === assertion.domainId && identityValue?.names?.en === input?.displayName, `${assertion.id}: canonical source identity value drift`)
    check(matchingAliases.length === 1, `${assertion.id}: typed-relation alias must exist exactly once`)
    check(alias?.category === 'melee-weapon' && alias?.status === 'accepted' && alias?.confidence === 'high', `${assertion.id}: typed-relation alias must be Melee accepted/high`)
    check(alias?.rawIdentity === assertion.rawIdentity && alias?.canonicalEntity === canonicalEntity, `${assertion.id}: typed-relation alias raw/canonical identity drift`)
    check(alias?.candidates?.length === 1 && alias.candidates[0] === canonicalEntity, `${assertion.id}: typed-relation alias canonical candidate drift`)
    check(alias?.assetPaths?.length === 1 && alias.assetPaths[0] === bridge?.packagePath, `${assertion.id}: typed-relation alias package must match exactly`)
    check(alias?.basis === TYPED_RELATION_MELEE_ALIAS_BASIS, `${assertion.id}: typed-relation alias basis drift`)
    check((alias?.evidenceIds?.length ?? 0) > 0, `${assertion.id}: typed-relation alias catalog evidence missing`)
    check(matchingSeeds.length === 1, `${assertion.id}: Raw Structural Melee catalog seed must exist exactly once`)
    check(candidates.length === 1, `${assertion.id}: Raw Structural candidate must exist exactly once`)
    check(candidate?.role === 'instance', `${assertion.id}: Raw Structural candidate role must be instance`)
    check(candidate?.packagePath === bridge?.packagePath && candidate?.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: Raw Structural candidate package drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemIdName=${assertion.rawIdentity}`) === true, `${assertion.id}: Raw Structural candidate ItemIdName evidence drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemId.SerializedId=${assertion.rawIdentity}`) === true, `${assertion.id}: Raw Structural candidate SerializedId evidence drift`)
    check(matchingBindings.length === 1, `${assertion.id}: exact Structural package binding must exist exactly once`)
    check(binding?.structuralPackage.path === bridge?.packagePath, `${assertion.id}: Structural package path drift`)
    check(cdoExports.length === 1, `${assertion.id}: Structural package must contain exactly one CDO`)
    check(cdoClassObjectName === candidate?.objectName, `${assertion.id}: candidate object does not bind to the Structural CDO class`)
    check(cdoInventories.length === 1, `${assertion.id}: Structural package must contain exactly one CDO property inventory`)
    check(relationProperties.length === 1 && relationProperties[0]?.type.value === 'SoftObjectProperty', `${assertion.id}: CDO InventoryDropSound SoftObjectProperty must exist exactly once`)
    check(relationEdges.length === 1, `${assertion.id}: typed InventoryDropSound Structural edge must exist exactly once`)
    check(relationEdge?.kind === bridge?.edgeKind, `${assertion.id}: typed relation Structural edge kind drift`)
    check(relationEdge?.targetPackage === bridge?.targetPackage, `${assertion.id}: typed relation cue target drift`)
    check(observation?.packagePath === bridge?.packagePath && observation?.rawSchemaVersion === 2, `${assertion.id}: Structural observation package/schema drift`)
    check(observation?.itemIdName.observation.state === 'known' && observation.itemIdName.observation.value === assertion.rawIdentity, `${assertion.id}: Structural ItemIdName differs from typed-relation Raw identity`)
    check(observation?.serializedId.observation.state === 'known' && observation.serializedId.observation.value === assertion.rawIdentity, `${assertion.id}: Structural SerializedId differs from typed-relation Raw identity`)
    check(assertion.domainId === input?.domainId && assertion.rawIdentity === input?.rawIdentity && assertion.applicationScope.packagePath === input?.packagePath, `${assertion.id}: typed-relation Formal identity drift`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: typed-relation Formal assertion must be accepted/high`)
    check(
      assertion.evidenceRefs.length === 2
      && assertion.evidenceRefs[0] === aliasEvidenceRef
      && assertion.evidenceRefs[1] === bridgeEvidenceRef
      && definition.reviewedEvidence.some((record) => record.id === aliasEvidenceRef && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json' && record.source.locator === `aliases[id=${aliasId}]`)
      && definition.reviewedEvidence.some((record) => record.id === bridgeEvidenceRef && record.source.artifactPath === 'scripts/game-data-model-alignment.ts' && record.source.locator === `REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES[domainId=${assertion.domainId}]`),
      `${assertion.id}: typed-relation Formal evidence chain drift`,
    )
    check(definition.presentation.displayName === input?.displayName && definition.presentation.displayName === sources.presentations.melee[assertion.domainId], `${assertion.id}: typed-relation presentation displayName drift`)
  }

  check(REVIEWED_TYPED_RELATION_ALIAS_BRIDGES.length === 6, 'reviewed typed-relation bridge source population drift')
  check(sources.reviewedTypedRelationBridges.length === 6, 'reviewed typed-relation bridge population drift')
  check(reviewedTypedRelationFormalIdentities.length === 6, 'reviewed typed-relation Formal population drift')
  check(sources.reviewedTypedRelationBridges.reduce((sum, bridge) => sum + bridge.relations.length, 0) === 10, 'reviewed typed-relation exact observation population drift')
  const normalizeTypedRelationProperty = (value: string | undefined) => value?.replace(/\[\d+\]/g, '[]') ?? ''
  for (const definition of reviewedTypedRelationFormalIdentities) {
    const assertion = definition.assertion
    const input = reviewedTypedRelationFormalIdentityInputs.find((candidate) => candidate.domainId === assertion.domainId)
    const expectedCategory = input?.category === 'melee' ? 'melee-weapon' : input?.category === 'ranged' ? 'ranged-weapon' : undefined
    const rawSeedCategory = input?.category
    const bridgeMatches = sources.reviewedTypedRelationBridges.filter((bridge) => bridge.category === expectedCategory && bridge.domainId === assertion.domainId)
    const rawBridgeMatches = sources.reviewedTypedRelationBridges.filter((bridge) => bridge.category === expectedCategory && bridge.rawIdentity === assertion.rawIdentity)
    const bridge = bridgeMatches[0]
    const canonicalRecords = sources.reviewedTypedRelationCanonicalRecords.filter((record) => record.category === expectedCategory && record.id === assertion.domainId)
    const canonicalRecord = canonicalRecords[0]
    const identityKnown = canonicalRecord?.known?.filter((known) => known.property === 'identity') ?? []
    const identityValue = identityKnown[0]?.value
    const aliasId = expectedCategory ? `${expectedCategory}:${assertion.rawIdentity}` : ''
    const canonicalEntity = expectedCategory ? `${expectedCategory}:${assertion.domainId}` : ''
    const matchingAliases = aliases.filter((entry) => entry.id === aliasId)
    const alias = matchingAliases[0]
    const matchingSeeds = rawSeeds.filter((seed) => seed.category === rawSeedCategory && seed.catalogId === assertion.domainId)
    const seed = matchingSeeds[0]
    const candidates = seed?.candidates ?? []
    const selectedCandidates = candidates.filter((candidate) =>
      candidate.packagePath === bridge?.packagePath
      && candidate.evidence?.includes(`serialized-identifier:ItemIdName=${assertion.rawIdentity}`) === true
      && candidate.evidence?.includes(`serialized-identifier:ItemId.SerializedId=${assertion.rawIdentity}`) === true)
    const candidate = selectedCandidates[0]
    const matchingBindings = sources.reviewedTypedRelationInventoryBindings.filter((binding) => binding.definition.assertion.id === assertion.id)
    const binding = matchingBindings[0]
    const cdoExports = binding?.structuralPackage.exports.filter((entry) => entry.isClassDefaultObject) ?? []
    const cdo = cdoExports[0]
    const cdoClass = cdo?.references.class
    const cdoClassObjectName = cdoClass && typeof cdoClass === 'object' && 'objectName' in cdoClass ? cdoClass.objectName : undefined
    const cdoInventories = cdo
      ? binding?.structuralPackage.cdoPropertyInventory.filter((entry) => entry.exportIndex === cdo.exportIndex) ?? []
      : []
    const observation = binding?.observation
    const aliasEvidenceRef = `evidence:reviewed:${assertion.domainId}:accepted-alias`
    const bridgeEvidenceRef = `evidence:reviewed:${assertion.domainId}:typed-raw-relation-bridge`
    const presentationSource = input?.category === 'melee' ? sources.presentations.melee[assertion.domainId] : sources.presentations.ranged[assertion.domainId]

    check(Boolean(input) && Boolean(expectedCategory), `${assertion.id}: typed-relation identity is outside the reviewed six-domain input set`)
    check(bridgeMatches.length === 1 && rawBridgeMatches.length === 1, `${assertion.id}: reviewed typed-relation bridge must exist exactly once by category/domain and Raw identity`)
    check(bridge?.displayName === input?.displayName && bridge?.rawIdentity === input?.rawIdentity && bridge?.packagePath === input?.packagePath, `${assertion.id}: reviewed typed-relation bridge domain/raw/package drift`)
    check(bridge?.canonicalSource.artifactPath === 'research/source-harvest.json' && bridge?.canonicalSource.locator === `records[category=${expectedCategory},id=${assertion.domainId}]/known[property=identity]`, `${assertion.id}: reviewed typed-relation canonical source locator drift`)
    check(Boolean(bridge?.reviewRationale) && sources.typedRelationReviewAuditSource?.includes(bridge?.reviewRationale ?? '') === true, `${assertion.id}: reviewed typed-relation rationale is not grounded in the PR #139 audit`)
    check((bridge?.relations.length ?? 0) > 0, `${assertion.id}: reviewed typed-relation exact relation set missing`)
    check(canonicalRecords.length === 1, `${assertion.id}: reviewed typed-relation canonical source record must exist exactly once`)
    check(canonicalRecord?.category === expectedCategory && canonicalRecord?.id === assertion.domainId && canonicalRecord?.label === input?.displayName, `${assertion.id}: reviewed typed-relation canonical source category/domain/displayName drift`)
    check(identityKnown.length === 1 && identityValue?.canonicalId === assertion.domainId && identityValue?.names?.en === input?.displayName, `${assertion.id}: reviewed typed-relation canonical source identity value drift`)
    check(matchingAliases.length === 1, `${assertion.id}: reviewed typed-relation alias must exist exactly once`)
    check(alias?.category === expectedCategory && alias?.status === 'accepted' && alias?.confidence === 'high', `${assertion.id}: reviewed typed-relation alias must be category-correct accepted/high`)
    check(alias?.rawIdentity === assertion.rawIdentity && alias?.canonicalEntity === canonicalEntity, `${assertion.id}: reviewed typed-relation alias raw/canonical identity drift`)
    check(alias?.candidates?.length === 1 && alias.candidates[0] === canonicalEntity, `${assertion.id}: reviewed typed-relation alias canonical candidate drift`)
    check(alias?.assetPaths?.length === 1 && alias.assetPaths[0] === bridge?.packagePath, `${assertion.id}: reviewed typed-relation alias package must match exactly`)
    check(alias?.basis === TYPED_RELATION_ALIAS_BASIS, `${assertion.id}: reviewed typed-relation alias basis drift`)
    check((alias?.evidenceIds?.length ?? 0) > 0, `${assertion.id}: reviewed typed-relation alias catalog evidence missing`)
    check(matchingSeeds.length === 1, `${assertion.id}: Raw Structural catalog seed must exist exactly once`)
    check(seed?.status === 'ambiguous' && candidates.length >= 2, `${assertion.id}: reviewed typed-relation source must remain an ambiguous multi-candidate seed`)
    check(selectedCandidates.length === 1, `${assertion.id}: reviewed typed-relation selected candidate must resolve exactly once from exact package and serialized identities`)
    check(candidate?.role === 'instance', `${assertion.id}: reviewed typed-relation selected candidate role must be instance`)
    check(candidate?.packagePath === bridge?.packagePath && candidate?.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: reviewed typed-relation selected candidate package drift`)
    check(matchingBindings.length === 1, `${assertion.id}: reviewed typed-relation exact Structural package binding must exist exactly once`)
    check(binding?.structuralPackage.path === bridge?.packagePath, `${assertion.id}: reviewed typed-relation Structural package path drift`)
    check(cdoExports.length === 1, `${assertion.id}: reviewed typed-relation Structural package must contain exactly one CDO`)
    check(cdoClassObjectName === candidate?.objectName, `${assertion.id}: reviewed typed-relation candidate object does not bind to the Structural CDO class`)
    check(cdoInventories.length === 1, `${assertion.id}: reviewed typed-relation Structural package must contain exactly one CDO property inventory`)
    for (const relation of bridge?.relations ?? []) {
      const exactEdges = binding?.structuralEdges.filter((edge) =>
        edge.sourcePackage === bridge?.packagePath
        && edge.sourceOccurrence.kind === 'cdo-property'
        && normalizeTypedRelationProperty(edge.sourceOccurrence.propertyPath) === relation.property
        && (edge.targetPackage ?? edge.targetPackageName) === relation.targetPackage
        && edge.targetObject === relation.targetObject
        && `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}#/edges[id=${edge.id}]` === relation.rawEdgeLocator) ?? []
      const auditTuple = `\`${relation.property}\` → \`${relation.targetPackage}\` :: \`${relation.targetObject}\``
      check(exactEdges.length === 1, `${assertion.id}: reviewed exact typed relation edge must exist exactly once: ${relation.property}`)
      check(exactEdges[0]?.kind.endsWith('-property') === true, `${assertion.id}: reviewed exact typed relation edge kind drift: ${relation.property}`)
      check(sources.typedRelationReviewAuditSource?.includes(auditTuple) === true && sources.typedRelationReviewAuditSource?.includes(`Raw edge=\`${relation.rawEdgeLocator}\``) === true, `${assertion.id}: reviewed exact typed relation is not grounded in the PR #139 audit: ${relation.property}`)
    }
    check(observation?.packagePath === bridge?.packagePath && observation?.rawSchemaVersion === 2, `${assertion.id}: reviewed typed-relation Structural observation package/schema drift`)
    check(observation?.itemIdName.observation.state === 'known' && observation.itemIdName.observation.value === assertion.rawIdentity, `${assertion.id}: Structural ItemIdName differs from reviewed typed-relation Raw identity`)
    check(observation?.serializedId.observation.state === 'known' && observation.serializedId.observation.value === assertion.rawIdentity, `${assertion.id}: Structural SerializedId differs from reviewed typed-relation Raw identity`)
    check(assertion.domainId === input?.domainId && assertion.rawIdentity === input?.rawIdentity && assertion.applicationScope.packagePath === input?.packagePath, `${assertion.id}: reviewed typed-relation Formal identity drift`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: reviewed typed-relation Formal assertion must be accepted/high`)
    check(assertion.applicationScope.rawSchemaVersion === 2 && assertion.applicationScope.identityFields.itemIdName === 'ItemIdName' && assertion.applicationScope.identityFields.serializedId === 'ItemId.SerializedId', `${assertion.id}: reviewed typed-relation Formal Raw identity scope drift`)
    check(
      assertion.evidenceRefs.length === 2
      && assertion.evidenceRefs[0] === aliasEvidenceRef
      && assertion.evidenceRefs[1] === bridgeEvidenceRef
      && definition.reviewedEvidence.some((record) => record.id === aliasEvidenceRef && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json' && record.source.locator === `aliases[id=${aliasId}]`)
      && definition.reviewedEvidence.some((record) => record.id === bridgeEvidenceRef && record.source.artifactPath === 'scripts/game-data-model-alignment.ts' && record.source.locator === `REVIEWED_TYPED_RELATION_ALIAS_BRIDGES[domainId=${assertion.domainId}]`),
      `${assertion.id}: reviewed typed-relation Formal evidence chain drift`,
    )
    check(definition.presentation.displayName === input?.displayName && definition.presentation.displayName === presentationSource, `${assertion.id}: reviewed typed-relation presentation displayName drift`)
  }

  const reviewedArtifactSeeds = rawSeeds.filter((seed) => seed.category === 'artifact')
  for (const definition of reviewedBridgeArtifactFormalIdentities) {
    const assertion = definition.assertion
    const input = reviewedBridgeArtifactFormalIdentityInputs.find((candidate) => candidate.domainId === assertion.domainId)
    const canonicalEntries = (sources.artifactAudit?.entries ?? []).filter((entry) => entry.id === assertion.domainId)
    const matchingSeeds = reviewedArtifactSeeds.filter((seed) => seed.catalogId === assertion.domainId)
    const seed = matchingSeeds[0]
    const candidates = seed?.candidates ?? []
    const candidate = candidates[0]
    const matchingBindings = sources.reviewedArtifactInventoryBindings.filter((binding) => binding.definition.assertion.id === assertion.id)
    const binding = matchingBindings[0]
    const cdoExports = binding?.structuralPackage.exports.filter((entry) => entry.isClassDefaultObject) ?? []
    const cdo = cdoExports[0]
    const cdoClass = cdo?.references.class
    const cdoClassObjectName = cdoClass && typeof cdoClass === 'object' && 'objectName' in cdoClass ? cdoClass.objectName : undefined
    const cdoInventories = cdo
      ? binding?.structuralPackage.cdoPropertyInventory.filter((entry) => entry.exportIndex === cdo.exportIndex) ?? []
      : []
    const observation = binding?.observation
    const rawIdentity = input?.rawIdentity
    const packagePath = input?.packagePath

    check(Boolean(input), `${assertion.id}: Artifact identity is outside the reviewed-bridge input set`)
    check(canonicalEntries.length === 1, `${assertion.id}: artifact-audit canonical entry must exist exactly once`)
    check(assertion.domainId === input?.domainId && assertion.rawIdentity === rawIdentity, `${assertion.id}: Formal canonical or Raw identity drift`)
    check(assertion.applicationScope.packagePath === packagePath, `${assertion.id}: Formal applicationScope package drift`)
    check(assertion.applicationScope.rawSchemaVersion === 2, `${assertion.id}: Formal Raw schema version drift`)
    check(assertion.applicationScope.identityFields.itemIdName === 'ItemIdName' && assertion.applicationScope.identityFields.serializedId === 'ItemId.SerializedId', `${assertion.id}: Formal Raw identity field scope drift`)
    check(assertion.reviewState === 'accepted' && assertion.confidence === 'high', `${assertion.id}: reviewed bridge assertion must be accepted/high`)
    check(matchingSeeds.length === 1, `${assertion.id}: Raw Structural Artifact catalog seed must exist exactly once`)
    check(candidates.length === 1, `${assertion.id}: Raw Structural candidate must exist exactly once`)
    check(candidate?.role === 'instance', `${assertion.id}: Raw Structural candidate role must be instance`)
    check(candidate?.packagePath === packagePath && candidate?.packagePath === assertion.applicationScope.packagePath, `${assertion.id}: Raw Structural candidate package drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemIdName=${rawIdentity}`) === true, `${assertion.id}: Raw Structural candidate ItemIdName evidence drift`)
    check(candidate?.evidence?.includes(`serialized-identifier:ItemId.SerializedId=${rawIdentity}`) === true, `${assertion.id}: Raw Structural candidate SerializedId evidence drift`)
    check(matchingBindings.length === 1, `${assertion.id}: exact Structural package binding must exist exactly once`)
    check(binding?.structuralPackage.path === packagePath, `${assertion.id}: Structural package path differs from the exact candidate`)
    check(cdoExports.length === 1, `${assertion.id}: Structural package must contain exactly one CDO`)
    check(cdoClassObjectName === candidate?.objectName, `${assertion.id}: candidate object does not bind to the Structural CDO class`)
    check(cdoInventories.length === 1, `${assertion.id}: Structural package must contain exactly one CDO property inventory`)
    check(observation?.packagePath === packagePath && observation?.rawSchemaVersion === 2, `${assertion.id}: Structural observation package/schema drift`)
    check(observation?.itemIdName.observation.state === 'known' && observation?.itemIdName.observation.value === rawIdentity, `${assertion.id}: Structural ItemIdName differs from bridge Raw identity`)
    check(observation?.serializedId.observation.state === 'known' && observation?.serializedId.observation.value === rawIdentity, `${assertion.id}: Structural SerializedId differs from bridge Raw identity`)
    check(observation?.itemIdName.provenance.packagePath === packagePath && observation?.itemIdName.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: ItemIdName is not from the exact Structural shard/package`)
    check(observation?.serializedId.provenance.packagePath === packagePath && observation?.serializedId.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: SerializedId is not from the exact Structural shard/package`)
    check(definition.presentation.displayName === canonicalEntries[0]?.name, `${assertion.id}: presentation displayName differs from artifact-audit`)
  }

  const corruptedSeedsDefinition = corruptedSeedsFormalIdentity
  const corruptedAssertion = corruptedSeedsDefinition.assertion
  const corruptedDomainId = 'corrupted-seeds'
  const corruptedRawIdentity = 'CorruptedSeeds'
  const corruptedPackage = 'Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance'
  const corruptedCanonicalEntity = 'artifact:corrupted-seeds'
  const corruptedSourceId = 'wiki-corrupted-seeds'
  const corruptedAuditRecords = [
    ...(sources.artifactAudit?.entries ?? []),
    ...(sources.artifactAudit?.populationDifferences ?? []),
  ].filter((entry) => entry.id === corruptedDomainId)
  const corruptedResearchRecords = (sources.artifactAudit?.populationDifferences ?? []).filter((entry) => entry.id === corruptedDomainId)
  const corruptedResearchRecord = corruptedResearchRecords[0]
  const corruptedSourceIds = corruptedResearchRecord?.sourceIds ?? []
  const corruptedSourceRecords = (sources.artifactAudit?.sources ?? []).filter((source) => source.id === corruptedSourceId)
  const corruptedMappingsByDomain = sources.independentSourceArtifactBridges.filter((mapping) => mapping.domainId === corruptedDomainId)
  const corruptedMappingsByRaw = sources.independentSourceArtifactBridges.filter((mapping) => mapping.rawIdentity === corruptedRawIdentity)
  const corruptedMapping = corruptedMappingsByDomain[0]
  const corruptedAliases = aliases.filter((entry) => entry.id === `artifact:${corruptedRawIdentity}`)
  const corruptedAlias = corruptedAliases[0]
  const corruptedSeedMatches = rawSeeds.filter((seed) => seed.category === 'artifact' && seed.catalogId === corruptedDomainId)
  const corruptedSeed = corruptedSeedMatches[0]
  const corruptedCandidates = corruptedSeed?.candidates ?? []
  const corruptedCandidate = corruptedCandidates[0]
  const corruptedBindings = sources.sourceBackedArtifactInventoryBindings.filter((binding) => binding.definition.assertion.id === corruptedAssertion.id)
  const corruptedBinding = corruptedBindings[0]
  const corruptedCdos = corruptedBinding?.structuralPackage.exports.filter((entry) => entry.isClassDefaultObject) ?? []
  const corruptedCdo = corruptedCdos[0]
  const corruptedCdoClass = corruptedCdo?.references.class
  const corruptedCdoClassName = corruptedCdoClass && typeof corruptedCdoClass === 'object' && 'objectName' in corruptedCdoClass ? corruptedCdoClass.objectName : undefined
  const corruptedCdoInventories = corruptedCdo
    ? corruptedBinding?.structuralPackage.cdoPropertyInventory.filter((entry) => entry.exportIndex === corruptedCdo.exportIndex) ?? []
    : []
  const corruptedObservation = corruptedBinding?.observation
  const corruptedAliasEvidenceRef = 'evidence:reviewed:corrupted-seeds:accepted-alias'
  const corruptedSourceEvidenceRef = 'evidence:reviewed:corrupted-seeds:independent-source-id'
  const corruptedPresentationEvidenceRef = 'evidence:presentation:corrupted-seeds:artifact-audit'

  check(corruptedAuditRecords.length === 1 && corruptedResearchRecords.length === 1, `${corruptedAssertion.id}: independent Artifact research domain record must exist exactly once in populationDifferences`)
  check(corruptedResearchRecord?.internalGameIds?.includes(corruptedRawIdentity) === true, `${corruptedAssertion.id}: independent Artifact research must contain exact CorruptedSeeds internalGameId`)
  check(corruptedSourceIds.includes(corruptedSourceId), `${corruptedAssertion.id}: independent Artifact research source ID is missing`)
  check(corruptedSourceRecords.length === 1 && corruptedSourceRecords[0]?.kind === 'wiki', `${corruptedAssertion.id}: independent Artifact source evidence must resolve exactly once to the Wiki source record`)
  check(sources.independentSourceArtifactBridges.length === 1, `${corruptedAssertion.id}: independent-source Artifact bridge set must contain exactly one mapping`)
  check(corruptedMappingsByDomain.length === 1 && corruptedMappingsByRaw.length === 1, `${corruptedAssertion.id}: research-owned bridge mapping must be unique by domain and Raw identity`)
  check(corruptedMapping?.rawIdentity === corruptedRawIdentity && corruptedMapping?.packagePath === corruptedPackage, `${corruptedAssertion.id}: research-owned bridge mapping domain/raw/package drift`)
  check(corruptedAliases.length === 1, `${corruptedAssertion.id}: generated reviewed alias must exist exactly once`)
  check(corruptedAlias?.category === 'artifact' && corruptedAlias?.status === 'accepted' && corruptedAlias?.confidence === 'high', `${corruptedAssertion.id}: generated reviewed alias must be Artifact accepted/high`)
  check(corruptedAlias?.rawIdentity === corruptedRawIdentity && corruptedAlias?.canonicalEntity === corruptedCanonicalEntity, `${corruptedAssertion.id}: generated reviewed alias raw/canonical identity drift`)
  check(corruptedAlias?.basis === INDEPENDENT_SOURCE_ARTIFACT_ALIAS_BASIS, `${corruptedAssertion.id}: generated reviewed alias independent-source basis drift`)
  check(corruptedAlias?.candidates?.length === 1 && corruptedAlias.candidates[0] === corruptedCanonicalEntity, `${corruptedAssertion.id}: generated reviewed alias canonical candidate drift`)
  check(corruptedAlias?.assetPaths?.length === 1 && corruptedAlias.assetPaths[0] === corruptedPackage, `${corruptedAssertion.id}: generated reviewed alias package must match exactly`)
  check(corruptedSeedMatches.length === 1 && corruptedSeed?.category === 'artifact', `${corruptedAssertion.id}: Raw Structural catalog seed must match the exact Artifact domain exactly once`)
  check(corruptedCandidates.length === 1, `${corruptedAssertion.id}: Raw Structural candidate must exist exactly once`)
  check(corruptedCandidate?.role === 'instance' && corruptedCandidate?.packagePath === corruptedPackage, `${corruptedAssertion.id}: Raw Structural candidate role/package drift`)
  check(corruptedCandidate?.evidence?.includes(`serialized-identifier:ItemIdName=${corruptedRawIdentity}`) === true, `${corruptedAssertion.id}: Raw Structural ItemIdName candidate evidence drift`)
  check(corruptedCandidate?.evidence?.includes(`serialized-identifier:ItemId.SerializedId=${corruptedRawIdentity}`) === true, `${corruptedAssertion.id}: Raw Structural SerializedId candidate evidence drift`)
  check(corruptedBindings.length === 1, `${corruptedAssertion.id}: exact Structural package binding must exist exactly once`)
  check(corruptedBinding?.structuralPackage.path === corruptedPackage, `${corruptedAssertion.id}: Structural package path drift`)
  check(corruptedCdos.length === 1, `${corruptedAssertion.id}: Structural package must contain exactly one CDO`)
  check(corruptedCdoClassName === corruptedCandidate?.objectName, `${corruptedAssertion.id}: Raw Structural candidate must bind to the CDO class`)
  check(corruptedCdoInventories.length === 1, `${corruptedAssertion.id}: Structural package must contain exactly one CDO property inventory`)
  check(corruptedObservation?.packagePath === corruptedPackage && corruptedObservation?.rawSchemaVersion === 2, `${corruptedAssertion.id}: Structural observation package/schema drift`)
  check(corruptedObservation?.itemIdName.observation.state === 'known' && corruptedObservation?.itemIdName.observation.value === corruptedRawIdentity, `${corruptedAssertion.id}: Raw Structural ItemIdName must equal CorruptedSeeds`)
  check(corruptedObservation?.serializedId.observation.state === 'known' && corruptedObservation?.serializedId.observation.value === corruptedRawIdentity, `${corruptedAssertion.id}: Raw Structural ItemId.SerializedId must equal CorruptedSeeds`)
  check(corruptedObservation?.itemIdName.provenance.packagePath === corruptedPackage && corruptedObservation?.itemIdName.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${corruptedBinding?.shardPath}`, `${corruptedAssertion.id}: ItemIdName must come from the exact Structural shard/package`)
  check(corruptedObservation?.serializedId.provenance.packagePath === corruptedPackage && corruptedObservation?.serializedId.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${corruptedBinding?.shardPath}`, `${corruptedAssertion.id}: SerializedId must come from the exact Structural shard/package`)
  check(corruptedAssertion.domainId === corruptedDomainId && corruptedAssertion.rawIdentity === corruptedRawIdentity, `${corruptedAssertion.id}: Formal domain/raw identity drift`)
  check(corruptedAssertion.applicationScope.packagePath === corruptedPackage && corruptedAssertion.applicationScope.rawSchemaVersion === 2, `${corruptedAssertion.id}: Formal package/schema scope drift`)
  check(corruptedAssertion.reviewState === 'accepted' && corruptedAssertion.confidence === 'high', `${corruptedAssertion.id}: Formal identity must be accepted/high`)
  check(corruptedAssertion.evidenceRefs.length === 2 && corruptedAssertion.evidenceRefs[0] === corruptedAliasEvidenceRef && corruptedAssertion.evidenceRefs[1] === corruptedSourceEvidenceRef, `${corruptedAssertion.id}: Formal evidence must retain the reviewed alias and independent source`)
  check(corruptedSeedsDefinition.reviewedEvidence.some((record) => record.id === corruptedAliasEvidenceRef && record.source.artifactPath === 'research/domain/game-data-entity-aliases.json' && record.source.locator === 'aliases[id=artifact:CorruptedSeeds]'), `${corruptedAssertion.id}: Formal alias evidence locator drift`)
  check(corruptedSeedsDefinition.reviewedEvidence.some((record) => record.id === corruptedSourceEvidenceRef && record.source.artifactPath === 'research/artifact-audit.json' && record.source.locator === 'populationDifferences[id=corrupted-seeds].internalGameIds'), `${corruptedAssertion.id}: Formal independent source evidence locator drift`)
  check(corruptedSeedsDefinition.reviewedEvidence.some((record) => record.id === corruptedPresentationEvidenceRef && record.source.artifactPath === 'research/artifact-audit.json' && record.source.locator === 'populationDifferences[id=corrupted-seeds].name'), `${corruptedAssertion.id}: Formal presentation evidence locator drift`)
  check(corruptedSeedsDefinition.presentation.displayName === corruptedResearchRecord?.name && corruptedSeedsDefinition.presentation.displayName === sources.presentations.artifact[corruptedDomainId], `${corruptedAssertion.id}: Formal presentation must match its independent Artifact research record`)

  const fighters = fightersBindingsFormalIdentity.assertion
  const fightersAlias = aliases.find((entry) => entry.id === 'melee-weapon:Gauntlets_Unique3')
  check(fighters.rawIdentity === 'Gauntlets_Unique3' && fighters.domainId === 'fighters-bindings' && fighters.reviewState === 'provisional', `${fighters.id}: Formal provisional assertion drift`)
  check(Boolean(fightersAlias), `${fighters.id}: provisional alias source missing`)
  check(fightersAlias?.rawIdentity === fighters.rawIdentity, `${fighters.id}: provisional alias rawIdentity drift`)
  check(fightersAlias?.status === 'unresolved' && fightersAlias?.confidence === 'unknown' && fightersAlias?.canonicalEntity === undefined, `${fighters.id}: provisional alias changed; identity review required`)

  const mappingSource = sources.historicalMappingSource ?? ''
  for (const marker of [
    'id: fightersBindingsFormalIdentity.assertion.domainId',
    'assetSuffix: fightersBindingsFormalIdentity.assertion.applicationScope.packagePath.slice(',
    'mapping: fightersBindingsFormalIdentity.assertion.reviewState',
    'identityAssertionId: fightersBindingsFormalIdentity.assertion.id',
  ]) check(mappingSource.includes(marker), `${fighters.id}: historical mapping no longer preserves the provisional identity wiring`)

  const fighterPackageDirectory = fighters.applicationScope.packagePath.slice(0, fighters.applicationScope.packagePath.lastIndexOf('/'))
  const iconConflict = sources.icons?.entries?.find((entry) => entry.catalogId === 'soul-fists' && entry.sourcePackage === fighterPackageDirectory)
  check(iconConflict?.status === 'matched' && iconConflict?.matchMethod === 'family-unique-ordinal', `${fighters.id}: known icon conflict drift; identity review required`)

  const battleRobe = battleRobeFormalIdentity.assertion
  check(battleRobe.rawIdentity === 'BattleRobe' && battleRobe.domainId === 'battle-robe' && battleRobe.reviewState === 'provisional', `${battleRobe.id}: Formal provisional assertion drift`)
  check(sources.battleRobeCatalogId === battleRobe.domainId, `${battleRobe.id}: repository armor catalog identity drift`)
  const battleBridge = aliases.find((entry) => entry.rawIdentity === battleRobe.rawIdentity && entry.status === 'accepted')
  check(!battleBridge, `${battleRobe.id}: authoritative accepted bridge appeared; identity review required`)

  const presentations = [
    [fightersBindingsFormalIdentity, sources.presentations.fightersBindings],
    [scatterCrossbowFormalIdentity, sources.presentations.scatterCrossbow],
    [battleRobeFormalIdentity, sources.presentations.battleRobe],
    [deathCapMushroomFormalIdentity, sources.presentations.deathCapMushroom],
  ] as const
  for (const [definition, sourceDisplayName] of presentations) {
    check(definition.presentation.displayName === sourceDisplayName, `${definition.assertion.id}: presentation displayName drift`)
  }

  check(formalIdentityDefinitions.length === 152, 'Formal identity definition population drift')
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedTypedRelationMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedTypedRelationFormalIdentityInputs.some((input) => input.category === 'melee' && input.domainId === assertion.domainId)).length === 31,
    'Formal matched Melee definition population drift',
  )
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'scatter-crossbow' || readyRangedFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeRangedFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedTypedRelationFormalIdentityInputs.some((input) => input.category === 'ranged' && input.domainId === assertion.domainId)).length === 27,
    'Formal matched Ranged definition population drift',
  )
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'death-cap-mushroom' || assertion.id === corruptedAssertion.id || readyArtifactFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeArtifactFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 23,
    'Formal matched Artifact definition population drift',
  )
  check(formalIdentityDefinitions.filter(({ assertion }) => readyArmorFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 70, 'Formal matched Armor definition population drift')
  check(formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'battle-robe' || readyArmorFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 71, 'Formal total Armor identity population drift')
  const excludedArtifactIds = [
    'corrupted-beacon', 'enchanters-tome', 'flaming-quiver', 'golem-kit', 'gong-of-weakening',
    'harvester', 'ice-wand', 'lightning-rod', 'love-medallion', 'soul-healer', 'soul-lantern', 'tasty-bone',
    'thundering-quiver', 'tome-of-duplication', 'torment-quiver', 'totem-of-regeneration', 'totem-of-shielding',
    'updraft-tome', 'void-quiver', 'wind-horn', 'wonderful-wheat',
  ]
  check(excludedArtifactIds.length === 21, 'remaining slug-only Artifact exclusion population drift')
  check(!formalIdentityDefinitions.some(({ assertion }) => excludedArtifactIds.includes(assertion.domainId)), 'excluded Artifact identity entered the Formal population')
  check(!aliases.some((entry) => entry.status === 'accepted' && entry.confidence === 'high' && excludedArtifactIds.includes(entry.canonicalEntity?.replace(/^artifact:/, '') ?? '')), 'excluded Artifact identity received an accepted/high canonical alias')
  return errors
}
