import fs from 'node:fs'
import path from 'node:path'
import {
  battleRobeFormalIdentity,
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
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import { readFormalIdentityInventoryBindings, type FormalIdentityInventoryBindingInput } from './formal-identity-inventory-source.ts'

type Alias = {
  id?: string
  rawIdentity?: string
  category?: string
  status?: string
  confidence?: string
  canonicalEntity?: string
  basis?: string
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
type ArtifactEntry = { id?: string; name?: string }
type ArmorAuditEntry = { id?: string; name?: string; levelId?: string }
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
  artifactAudit?: { entries?: ArtifactEntry[] }
  armorAudit?: { entries?: ArmorAuditEntry[] }
  rawStructuralSeeds?: { catalogSeeds?: RawStructuralSeed[] }
  armorReadinessAuditSource?: string
  armorInventoryBindings: FormalIdentityInventoryBindingInput[]
  reviewedArtifactInventoryBindings: FormalIdentityInventoryBindingInput[]
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
  const artifactAudit = readJson<{ entries?: ArtifactEntry[] }>('research/artifact-audit.json')
  const armorAudit = readJson<{ entries?: ArmorAuditEntry[] }>('research/armor-audit.json')
  const rawStructuralSeeds = readJson<{ catalogSeeds?: RawStructuralSeed[] }>('research/raw/game-data-raw-structural-inventory/manifest.json')
  const armorReadinessAuditSource = readText('docs/remaining_formal_identity_breadth_readiness_audit.md')
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
    historicalMappingSource: readText(historicalPath),
    equipmentIconSource: readText('scripts/equipment-icons.ts'),
    presentations: {
      fightersBindings: fightersBlock?.[1],
      scatterCrossbow: rangedAudit?.entries?.find((entry) => entry.id === 'scatter-crossbow')?.name?.en,
      battleRobe: battleRobeBlock?.[2],
      deathCapMushroom: mushroomBlock?.[1],
      melee: Object.fromEntries([...readyMeleeFormalIdentityInputs, ...reviewedBridgeMeleeFormalIdentityInputs].map(({ domainId }) => [
        domainId,
        meleeAudit?.weapons?.find((entry) => entry.weaponId === domainId)?.name?.en,
      ])),
      ranged: Object.fromEntries([...readyRangedFormalIdentityInputs, ...reviewedBridgeRangedFormalIdentityInputs].map(({ domainId }) => [
        domainId,
        rangedAudit?.entries?.find((entry) => entry.id === domainId)?.name?.en,
      ])),
      artifact: Object.fromEntries([...readyArtifactFormalIdentityInputs, ...reviewedBridgeArtifactFormalIdentityInputs].map(({ domainId }) => [
        domainId,
        artifactAudit?.entries?.find((entry) => entry.id === domainId)?.name,
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
  }
  check(reviewedBridgeMeleeFormalIdentities.length === 2, 'reviewed bridge Melee population drift')
  check(reviewedBridgeRangedFormalIdentities.length === 1, 'reviewed bridge Ranged population drift')
  check(reviewedBridgeArtifactFormalIdentities.length === 12, 'reviewed bridge Artifact population drift')
  check(bridgeCases.length === 15, 'reviewed bridge total population drift')

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
    check(observation?.packagePath === packagePath && observation.rawSchemaVersion === 2, `${assertion.id}: Structural observation package/schema drift`)
    check(observation?.itemIdName.observation.state === 'known' && observation.itemIdName.observation.value === rawIdentity, `${assertion.id}: Structural ItemIdName differs from bridge Raw identity`)
    check(observation?.serializedId.observation.state === 'known' && observation.serializedId.observation.value === rawIdentity, `${assertion.id}: Structural SerializedId differs from bridge Raw identity`)
    check(observation?.itemIdName.provenance.packagePath === packagePath && observation.itemIdName.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: ItemIdName is not from the exact Structural shard/package`)
    check(observation?.serializedId.provenance.packagePath === packagePath && observation.serializedId.provenance.artifactPath === `research/raw/game-data-raw-structural-inventory/${binding?.shardPath}`, `${assertion.id}: SerializedId is not from the exact Structural shard/package`)
    check(definition.presentation.displayName === canonicalEntries[0]?.name, `${assertion.id}: presentation displayName differs from artifact-audit`)
  }

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

  check(formalIdentityDefinitions.length === 140, 'Formal identity definition population drift')
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 27,
    'Formal matched Melee definition population drift',
  )
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'scatter-crossbow' || readyRangedFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeRangedFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 23,
    'Formal matched Ranged definition population drift',
  )
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'death-cap-mushroom' || readyArtifactFormalIdentities.some((definition) => definition.assertion.id === assertion.id) || reviewedBridgeArtifactFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 19,
    'Formal matched Artifact definition population drift',
  )
  check(formalIdentityDefinitions.filter(({ assertion }) => readyArmorFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 70, 'Formal matched Armor definition population drift')
  const excludedArtifactIds = [
    'buzzy-nest', 'satchel-of-elixirs', 'satchel-of-snacks',
    'corrupted-beacon', 'corrupted-seeds', 'enchanters-tome', 'flaming-quiver', 'golem-kit', 'gong-of-weakening',
    'harvester', 'ice-wand', 'lightning-rod', 'love-medallion', 'soul-healer', 'soul-lantern', 'tasty-bone',
    'thundering-quiver', 'tome-of-duplication', 'torment-quiver', 'totem-of-regeneration', 'totem-of-shielding',
    'updraft-tome', 'void-quiver', 'wind-horn', 'wonderful-wheat',
  ]
  check(!formalIdentityDefinitions.some(({ assertion }) => excludedArtifactIds.includes(assertion.domainId)), 'excluded Artifact identity entered the Formal population')
  check(!aliases.some((entry) => entry.status === 'accepted' && entry.confidence === 'high' && excludedArtifactIds.includes(entry.canonicalEntity?.replace(/^artifact:/, '') ?? '')), 'excluded Artifact identity received an accepted/high canonical alias')
  return errors
}
