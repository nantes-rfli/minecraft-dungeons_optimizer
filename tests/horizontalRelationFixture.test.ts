import { describe, expect, it } from 'vitest'
import type { HorizontalRawFactInventory } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { cloneHorizontalRelationFixture } from './helpers/horizontalRelationFixture.ts'

function inventoryFixture(): HorizontalRawFactInventory {
  const item = { category: 'artifact', catalogId: 'selected', rawCandidate: {
    candidates: [{ relations: [{ edgeId: 'selected-edge' }] }],
  } }
  return {
    schemaVersion: 1, artifactKind: 'horizontal-raw-fact-inventory',
    inventoryIdentity: { datasetId: 'fixture' },
    // Both item ambiguity and edge ambiguity must survive the optimization.
    items: [item, structuredClone(item), { ...structuredClone(item), catalogId: 'foreign' }],
    sourceRelations: [{ edgeId: 'selected-edge', targetObject: 'A' },
      { edgeId: 'selected-edge', targetObject: 'B' }, { edgeId: 'foreign-edge' }],
    sourceFacts: [{ factId: 'foreign-fact' }],
  }
}

describe('Horizontal Relation mutation fixture isolation', () => {
  it('preserves the full population and duplicate matches while isolating family mutations', () => {
    const original = inventoryFixture()
    const first = cloneHorizontalRelationFixture(original, 'artifact', 'selected')
    const second = cloneHorizontalRelationFixture(original, 'artifact', 'selected')
    expect(first).toEqual(original)
    first.items[0]!.rawCandidate.candidates[0].relations[0].edgeId = 'changed'
    first.sourceRelations[0].targetObject = 'changed'
    first.sourceRelations.push({ edgeId: 'duplicate' })
    first.sourceRelations.splice(1, 1)
    expect(second).toEqual(original)
    expect(second.items).toHaveLength(3)
    expect(second.sourceRelations.filter((row: { edgeId: string }) => row.edgeId === 'selected-edge')).toHaveLength(2)
  })

  it('fails on accidental mutation of the shared population', () => {
    const original = inventoryFixture()
    const fixture = cloneHorizontalRelationFixture(original, 'artifact', 'selected')
    expect(() => { fixture.items[2]!.catalogId = 'changed' }).toThrow(TypeError)
    expect(() => { fixture.sourceRelations[2].edgeId = 'changed' }).toThrow(TypeError)
    expect(() => { fixture.sourceFacts[0].factId = 'changed' }).toThrow(TypeError)
    expect(() => { fixture.inventoryIdentity.datasetId = 'changed' }).toThrow(TypeError)
    expect(fixture).toEqual(original)
  })
})
