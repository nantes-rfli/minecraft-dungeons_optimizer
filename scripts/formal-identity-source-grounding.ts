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
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'

type Alias = {
  id?: string
  rawIdentity?: string
  category?: string
  status?: string
  confidence?: string
  canonicalEntity?: string
  basis?: string
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

export type FormalReviewedSources = {
  existingPaths: Set<string>
  aliases?: { aliases?: Alias[] }
  icons?: { entries?: IconEntry[] }
  rangedAudit?: { entries?: RangedEntry[] }
  meleeAudit?: { weapons?: MeleeEntry[] }
  historicalMappingSource?: string
  presentations: {
    fightersBindings?: string
    scatterCrossbow?: string
    battleRobe?: string
    deathCapMushroom?: string
    melee: Record<string, string | undefined>
    ranged: Record<string, string | undefined>
  }
  battleRobeCatalogId?: string
}

const knownPaths = [
  'research/domain/game-data-entity-aliases.json',
  'generated/equipment-icons/manifest.json',
  'scripts/audit-attack-event-comparison.ts',
  'src/data/weapons.ts',
  'research/ranged-weapon-audit.json',
  'research/melee-attack-profile-audit.json',
  'src/data/armors.ts',
  'src/data/artifacts.ts',
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
    historicalMappingSource: readText(historicalPath),
    presentations: {
      fightersBindings: fightersBlock?.[1],
      scatterCrossbow: rangedAudit?.entries?.find((entry) => entry.id === 'scatter-crossbow')?.name?.en,
      battleRobe: battleRobeBlock?.[2],
      deathCapMushroom: mushroomBlock?.[1],
      melee: Object.fromEntries(readyMeleeFormalIdentityInputs.map(({ domainId }) => [
        domainId,
        meleeAudit?.weapons?.find((entry) => entry.weaponId === domainId)?.name?.en,
      ])),
      ranged: Object.fromEntries(readyRangedFormalIdentityInputs.map(({ domainId }) => [
        domainId,
        rangedAudit?.entries?.find((entry) => entry.id === domainId)?.name?.en,
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

  check(formalIdentityDefinitions.length === 49, 'Formal identity definition population drift')
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 25,
    'Formal matched Melee definition population drift',
  )
  check(
    formalIdentityDefinitions.filter(({ assertion }) => assertion.domainId === 'scatter-crossbow' || readyRangedFormalIdentities.some((definition) => definition.assertion.id === assertion.id)).length === 22,
    'Formal matched Ranged definition population drift',
  )
  return errors
}
