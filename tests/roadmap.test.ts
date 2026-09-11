import { describe, expect, it } from 'vitest'
import { collectRoadmapWorkUnitErrors, ROADMAP_WORK_UNITS, type RoadmapWorkUnit } from '../src/data/roadmap'

function unit(id: string, track: RoadmapWorkUnit['track'] = 'research'): RoadmapWorkUnit {
  return {
    id,
    track,
    title: id,
    status: 'current',
    goal: id,
    completionCriteria: `${id} complete`,
  }
}

describe('roadmap work unit validation', () => {
  it('accepts the current dependency and unlock graph', () => {
    expect(collectRoadmapWorkUnitErrors(ROADMAP_WORK_UNITS)).toEqual([])
  })

  it('does not require every status to appear in each track', () => {
    expect(collectRoadmapWorkUnitErrors([unit('R1'), unit('P1', 'product')])).toEqual([])
  })

  it('still rejects invalid status and track values', () => {
    const invalidStatus = { ...unit('R1'), status: 'paused' } as unknown as RoadmapWorkUnit
    const invalidTrack = { ...unit('P1'), track: 'delivery' } as unknown as RoadmapWorkUnit
    expect(collectRoadmapWorkUnitErrors([invalidStatus])).toContain('R1: invalid roadmap status')
    expect(collectRoadmapWorkUnitErrors([invalidTrack])).toContain('P1: invalid roadmap track')
  })

  it.each([
    ['dependsOn', 'dependency'],
    ['unlocks', 'unlock'],
  ] as const)('rejects an unknown %s reference', (field, label) => {
    const source = { ...unit('R1'), [field]: ['R99'] }
    expect(collectRoadmapWorkUnitErrors([source])).toContain(`R1: unknown ${label} R99`)
  })

  it.each([
    ['dependsOn', 'dependency'],
    ['unlocks', 'unlock'],
  ] as const)('rejects a self-reference in %s', (field, label) => {
    const source = { ...unit('R1'), [field]: ['R1'] }
    expect(collectRoadmapWorkUnitErrors([source])).toContain(`R1: self-reference in ${label}`)
  })

  it.each([
    ['dependsOn', 'dependency'],
    ['unlocks', 'unlock'],
  ] as const)('rejects duplicate %s references', (field, label) => {
    const source = { ...unit('R1'), [field]: ['R2', 'R2'] }
    expect(collectRoadmapWorkUnitErrors([source, unit('R2')])).toContain(`R1: duplicate ${label} R2`)
  })
})
