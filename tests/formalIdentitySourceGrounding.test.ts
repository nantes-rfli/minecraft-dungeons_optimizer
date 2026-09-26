import { describe, expect, it } from 'vitest'
import {
  collectFormalReviewedSourceGroundingErrors,
  readFormalReviewedSources,
  type FormalReviewedSources,
} from '../scripts/formal-identity-source-grounding.ts'
import { readyArtifactFormalIdentities } from '../src/domain/formal/identityDefinitions.ts'

const repositoryRoot = process.cwd()
const fixture = (): FormalReviewedSources => structuredClone(readFormalReviewedSources(repositoryRoot))
const errors = (sources: FormalReviewedSources) => collectFormalReviewedSourceGroundingErrors(sources)
const alias = (sources: FormalReviewedSources, id: string) => sources.aliases!.aliases!.find((entry) => entry.id === id)!

describe('Formal Identity reviewed-source grounding', () => {
  it('grounds the current Formal definitions in their known reviewed sources', () => {
    expect(errors(fixture())).toEqual([])
  })

  it('grounds exactly the six ready-direct Artifact aliases without using presentation or icon metadata as identity evidence', () => {
    const sources = fixture()
    expect(readyArtifactFormalIdentities).toHaveLength(6)
    for (const definition of readyArtifactFormalIdentities) {
      const assertion = definition.assertion
      const matching = sources.aliases!.aliases!.filter((entry) => entry.id === `artifact:${assertion.rawIdentity}`)
      expect(matching).toHaveLength(1)
      expect(matching[0]).toMatchObject({
        category: 'artifact',
        status: 'accepted',
        confidence: 'high',
        rawIdentity: assertion.rawIdentity,
        canonicalEntity: `artifact:${assertion.domainId}`,
      })
      expect(matching[0]!.assetPaths).toContain(assertion.applicationScope.packagePath)
    }
  })

  it.each([
    ['category', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').category = 'armor' }, 'accepted Artifact alias category drift'],
    ['status', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').status = 'unresolved' }, 'accepted Artifact alias status drift'],
    ['confidence', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').confidence = 'medium' }, 'accepted Artifact alias confidence drift'],
    ['rawIdentity', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').rawIdentity = 'Other' }, 'accepted Artifact alias rawIdentity drift'],
    ['canonicalEntity', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').canonicalEntity = 'artifact:wrong' }, 'accepted Artifact alias canonicalEntity drift'],
    ['package', (sources: FormalReviewedSources) => { alias(sources, 'artifact:BootsOfSwiftness').assetPaths = ['Dungeons/Content/Other'] }, 'accepted Artifact alias package/source drift'],
  ])('rejects ready-direct Artifact alias %s drift', (_label, mutate, message) => {
    const sources = fixture()
    mutate(sources)
    expect(errors(sources).some((error) => error.includes(message))).toBe(true)
  })

  it('rejects duplicate ready-direct Artifact alias records', () => {
    const sources = fixture()
    sources.aliases!.aliases!.push(structuredClone(alias(sources, 'artifact:BootsOfSwiftness')))
    expect(errors(sources).some((error) => error.includes('accepted Artifact alias must exist exactly once'))).toBe(true)
  })

  it.each([
    ['ranged-weapon:ScatterCrossbow', 'provisional'],
    ['artifact:DeathCapMushroom', 'unresolved'],
  ])('fails when accepted alias %s status drifts', (id, status) => {
    const sources = fixture()
    alias(sources, id).status = status
    expect(errors(sources).some((error) => error.includes('accepted alias status drift'))).toBe(true)
  })

  it.each(['ranged-weapon:ScatterCrossbow', 'artifact:DeathCapMushroom'])('fails when accepted alias %s confidence drifts', (id) => {
    const sources = fixture()
    alias(sources, id).confidence = 'medium'
    expect(errors(sources).some((error) => error.includes('accepted alias confidence drift'))).toBe(true)
  })

  it.each(['ranged-weapon:ScatterCrossbow', 'artifact:DeathCapMushroom'])('fails when accepted alias %s canonicalEntity drifts', (id) => {
    const sources = fixture()
    alias(sources, id).canonicalEntity = 'wrong:entity'
    expect(errors(sources).some((error) => error.includes('accepted alias canonicalEntity drift'))).toBe(true)
  })


  it('does not promote a Raw-exact Melee row when its reviewed alias is absent', () => {
    const sources = fixture()
    sources.aliases!.aliases = sources.aliases!.aliases!.filter((entry) => entry.id !== 'melee-weapon:Anchor')
    expect(errors(sources).some((error) => error.includes('identity:anchor@1: accepted Melee alias source missing'))).toBe(true)
  })

  it.each([
    ['status', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').status = 'unresolved' }, 'accepted Melee alias status drift'],
    ['confidence', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').confidence = 'medium' }, 'accepted Melee alias confidence drift'],
    ['canonicalEntity', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').canonicalEntity = 'melee-weapon:wrong' }, 'accepted Melee alias canonicalEntity drift'],
    ['category', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').category = 'ranged-weapon' }, 'accepted Melee alias category drift'],
    ['rawIdentity', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').rawIdentity = 'Other' }, 'accepted Melee alias rawIdentity drift'],
    ['package', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').assetPaths = ['Dungeons/Content/Other'] }, 'accepted Melee alias package/source drift'],
    ['heuristic basis', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:Anchor').basis = 'family-unique-ordinal' }, 'accepted Melee alias basis is not reviewed for this wave'],
  ])('rejects ready Melee reviewed-source %s drift', (_label, mutate, message) => {
    const sources = fixture()
    mutate(sources)
    expect(errors(sources).some((error) => error.includes(message))).toBe(true)
  })

  it('grounds every new Melee presentation in the 82-item Melee audit rather than package or slug fallback', () => {
    const sources = fixture()
    sources.presentations.melee.anchor = 'Derived From Package Name'
    expect(errors(sources).some((error) => error.includes('identity:anchor@1: presentation displayName drift'))).toBe(true)
  })

  it('does not promote a Raw-exact Ranged row when its reviewed alias is absent', () => {
    const sources = fixture()
    sources.aliases!.aliases = sources.aliases!.aliases!.filter((entry) => entry.id !== 'ranged-weapon:Bow')
    expect(errors(sources).some((error) => error.includes('identity:bow@1: accepted Ranged alias source missing'))).toBe(true)
  })

  it.each([
    ['status', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').status = 'unresolved' }, 'accepted Ranged alias status drift'],
    ['confidence', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').confidence = 'medium' }, 'accepted Ranged alias confidence drift'],
    ['canonicalEntity', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').canonicalEntity = 'ranged-weapon:wrong' }, 'accepted Ranged alias canonicalEntity drift'],
    ['category', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').category = 'melee-weapon' }, 'accepted Ranged alias category drift'],
    ['rawIdentity', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').rawIdentity = 'Other' }, 'accepted Ranged alias rawIdentity drift'],
    ['package', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').assetPaths = ['Dungeons/Content/Other'] }, 'accepted Ranged alias package/source drift'],
    ['heuristic basis', (sources: FormalReviewedSources) => { alias(sources, 'ranged-weapon:Bow').basis = 'family-unique-ordinal' }, 'accepted Ranged alias basis is not reviewed for this wave'],
  ])('rejects ready Ranged reviewed-source %s drift', (_label, mutate, message) => {
    const sources = fixture()
    mutate(sources)
    expect(errors(sources).some((error) => error.includes(message))).toBe(true)
  })

  it('grounds every new Ranged presentation in the ranged audit rather than package or slug fallback', () => {
    const sources = fixture()
    sources.presentations.ranged.bow = 'Derived From Package Name'
    expect(errors(sources).some((error) => error.includes('identity:bow@1: presentation displayName drift'))).toBe(true)
  })

  it.each([
    ['melee-weapon:SkeletonHammer', 'melee:bonehead-hammer', 'SkeletonHammer', 'melee-weapon:bonehead-hammer', 'Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance'],
    ['melee-weapon:Sword_Spooky1', 'melee:sinister-sword', 'Sword_Spooky1', 'melee-weapon:sinister-sword', 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance'],
    ['ranged-weapon:BatCrossbow', 'ranged:shrieking-crossbow', 'BatCrossbow', 'ranged-weapon:shrieking-crossbow', 'Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance'],
  ])('pins reviewed bridge %s to the exact accepted alias, package, and documented override', (aliasId, overrideKey, rawIdentity, canonicalEntity, packagePath) => {
    const sources = fixture()
    const entry = alias(sources, aliasId)
    expect(entry).toMatchObject({ status: 'accepted', confidence: 'high', rawIdentity, canonicalEntity, basis: 'serialized-item-id + documented-entity-alias + catalog-category-evidence' })
    expect(entry.candidates).toEqual([canonicalEntity])
    expect(entry.assetPaths).toContain(packagePath)
    expect(sources.equipmentIconSource).toContain(`'${overrideKey}': '${rawIdentity}'`)
    expect(errors(sources)).toEqual([])
  })

  it.each([
    ['status', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').status = 'unresolved' }, 'reviewed bridge alias status drift'],
    ['confidence', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').confidence = 'medium' }, 'reviewed bridge alias confidence drift'],
    ['canonicalEntity', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').canonicalEntity = 'melee-weapon:wrong' }, 'reviewed bridge alias canonicalEntity drift'],
    ['rawIdentity', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').rawIdentity = 'Other' }, 'reviewed bridge alias rawIdentity drift'],
    ['candidates', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').candidates = ['melee-weapon:wrong'] }, 'reviewed bridge alias candidates drift'],
    ['package', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').assetPaths = ['Dungeons/Content/Other'] }, 'reviewed bridge alias package/source drift'],
    ['basis', (sources: FormalReviewedSources) => { alias(sources, 'melee-weapon:SkeletonHammer').basis = 'serialized-item-id + reviewed-alias + catalog-category-evidence' }, 'reviewed bridge basis drift'],
  ])('rejects reviewed bridge alias %s drift', (_label, mutate, message) => {
    const sources = fixture()
    mutate(sources)
    expect(errors(sources).some((error) => error.includes(message))).toBe(true)
  })

  it.each([
    ['melee:bonehead-hammer', 'SkeletonHammer'],
    ['melee:sinister-sword', 'Sword_Spooky1'],
    ['ranged:shrieking-crossbow', 'BatCrossbow'],
  ])('rejects documented ENTITY_OVERRIDES drift for %s', (overrideKey, rawIdentity) => {
    const sources = fixture()
    sources.equipmentIconSource = sources.equipmentIconSource!.replace(`'${overrideKey}': '${rawIdentity}'`, `'${overrideKey}': 'Other'`)
    expect(errors(sources).some((error) => error.includes('documented ENTITY_OVERRIDES mapping drift'))).toBe(true)
  })

  it('requires review when the provisional Fighter’s Bindings alias becomes accepted', () => {
    const sources = fixture()
    const entry = alias(sources, 'melee-weapon:Gauntlets_Unique3')
    entry.status = 'accepted'
    entry.confidence = 'high'
    entry.canonicalEntity = 'melee-weapon:fighters-bindings'
    expect(errors(sources).some((error) => error.includes('provisional alias changed; identity review required'))).toBe(true)
  })

  it('fails when the known historical mapping or icon conflict no longer supports provisional review', () => {
    const mapping = fixture()
    mapping.historicalMappingSource = mapping.historicalMappingSource!.replace('mapping: fightersBindingsFormalIdentity.assertion.reviewState', "mapping: 'accepted'")
    expect(errors(mapping).some((error) => error.includes('historical mapping'))).toBe(true)

    const icon = fixture()
    icon.icons!.entries!.find((entry) => entry.catalogId === 'soul-fists')!.matchMethod = 'asset-semantic-name'
    expect(errors(icon).some((error) => error.includes('known icon conflict drift'))).toBe(true)
  })

  it('requires review if an accepted Battle Robe bridge appears in the known alias source', () => {
    const sources = fixture()
    sources.aliases!.aliases!.push({
      id: 'armor:BattleRobe', rawIdentity: 'BattleRobe', status: 'accepted', confidence: 'high', canonicalEntity: 'armor:battle-robe',
    })
    expect(errors(sources).some((error) => error.includes('authoritative accepted bridge appeared'))).toBe(true)
  })

  it.each(['fightersBindings', 'scatterCrossbow', 'battleRobe', 'deathCapMushroom'] as const)('fails when %s presentation displayName drifts', (key) => {
    const sources = fixture()
    sources.presentations[key] = 'Changed Name'
    expect(errors(sources).some((error) => error.includes('presentation displayName drift'))).toBe(true)
  })

  it('fails when a reviewed source artifact is missing', () => {
    const sources = fixture()
    sources.existingPaths.delete('research/domain/game-data-entity-aliases.json')
    expect(errors(sources)).toContain('reviewed source artifact missing: research/domain/game-data-entity-aliases.json')
  })
})
