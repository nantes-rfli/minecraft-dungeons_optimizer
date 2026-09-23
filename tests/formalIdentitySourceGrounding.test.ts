import { describe, expect, it } from 'vitest'
import {
  collectFormalReviewedSourceGroundingErrors,
  readFormalReviewedSources,
  type FormalReviewedSources,
} from '../scripts/formal-identity-source-grounding.ts'

const repositoryRoot = process.cwd()
const fixture = (): FormalReviewedSources => structuredClone(readFormalReviewedSources(repositoryRoot))
const errors = (sources: FormalReviewedSources) => collectFormalReviewedSourceGroundingErrors(sources)
const alias = (sources: FormalReviewedSources, id: string) => sources.aliases!.aliases!.find((entry) => entry.id === id)!

describe('Formal Identity reviewed-source grounding', () => {
  it('grounds the current four Formal definitions in their known reviewed sources', () => {
    expect(errors(fixture())).toEqual([])
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
