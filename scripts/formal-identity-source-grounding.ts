import fs from 'node:fs'
import path from 'node:path'
import {
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'

type Alias = {
  id?: string
  rawIdentity?: string
  status?: string
  confidence?: string
  canonicalEntity?: string
}

type IconEntry = {
  catalogId?: string
  sourcePackage?: string
  status?: string
  matchMethod?: string
}

type RangedEntry = { id?: string; name?: { en?: string } }

export type FormalReviewedSources = {
  existingPaths: Set<string>
  aliases?: { aliases?: Alias[] }
  icons?: { entries?: IconEntry[] }
  rangedAudit?: { entries?: RangedEntry[] }
  historicalMappingSource?: string
  presentations: {
    fightersBindings?: string
    scatterCrossbow?: string
    battleRobe?: string
    deathCapMushroom?: string
  }
  battleRobeCatalogId?: string
}

const knownPaths = [
  'research/domain/game-data-entity-aliases.json',
  'generated/equipment-icons/manifest.json',
  'scripts/audit-attack-event-comparison.ts',
  'src/data/weapons.ts',
  'research/ranged-weapon-audit.json',
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
    historicalMappingSource: readText(historicalPath),
    presentations: {
      fightersBindings: fightersBlock?.[1],
      scatterCrossbow: rangedAudit?.entries?.find((entry) => entry.id === 'scatter-crossbow')?.name?.en,
      battleRobe: battleRobeBlock?.[2],
      deathCapMushroom: mushroomBlock?.[1],
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

  const fighters = fightersBindingsFormalIdentity.assertion
  const fightersAlias = aliases.find((entry) => entry.id === 'melee-weapon:Gauntlets_Unique3')
  check(fighters.rawIdentity === 'Gauntlets_Unique3' && fighters.domainId === 'fighters-bindings' && fighters.reviewState === 'provisional', `${fighters.id}: Formal provisional assertion drift`)
  check(Boolean(fightersAlias), `${fighters.id}: provisional alias source missing`)
  check(fightersAlias?.rawIdentity === fighters.rawIdentity, `${fighters.id}: provisional alias rawIdentity drift`)
  check(fightersAlias?.status === 'unresolved' && fightersAlias?.confidence === 'unknown' && fightersAlias?.canonicalEntity === undefined, `${fighters.id}: provisional alias changed; identity review required`)

  const mappingSource = sources.historicalMappingSource ?? ''
  for (const marker of [
    'id: fightersBindingsIdentity.domainId',
    'assetSuffix: fightersBindingsIdentity.packagePath.slice(',
    'mapping: fightersBindingsIdentity.status',
    'identityAssertionId: fightersBindingsIdentity.id',
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

  check(formalIdentityDefinitions.length === 4, 'Formal identity definition population drift')
  return errors
}
