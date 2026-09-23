import { describe, expect, it } from 'vitest'
import {
  breadthFirstPackageWalk, classifySeedCandidateStatus,
} from '../scripts/game-data-raw-structural-inventory.ts'

describe('Raw structural inventory traversal', () => {
  it('visits a cyclic graph once while retaining a deterministic breadth-first discovery edge', () => {
    const graph: Record<string, { id: string; targetPath: string }[]> = {
      A: [{ id: 'a-b', targetPath: 'B' }, { id: 'a-c', targetPath: 'C' }],
      B: [{ id: 'b-a', targetPath: 'A' }, { id: 'b-d', targetPath: 'D' }],
      C: [{ id: 'c-d', targetPath: 'D' }],
      D: [{ id: 'd-b', targetPath: 'B' }],
    }
    const result = breadthFirstPackageWalk(['A'], (packagePath) => graph[packagePath] ?? [])

    expect(result.visitedPaths).toEqual(['A', 'B', 'C', 'D'])
    expect(result.depths).toEqual({ A: 0, B: 1, C: 1, D: 2 })
    expect([...result.discoveryEdgeIds].sort()).toEqual(['a-b', 'a-c', 'b-d'])
  })

  it('keeps equally ranked seed candidates ambiguous instead of selecting one', () => {
    const candidates = [{ role: 'instance' as const }, { role: 'instance' as const }]
    expect(classifySeedCandidateStatus(candidates, 'asset-semantic-name')).toBe('ambiguous')
    expect(classifySeedCandidateStatus([], 'asset-semantic-name')).toBe('not-found')
    expect(classifySeedCandidateStatus([{ role: 'storable' }], 'asset-semantic-name')).toBe('provisional')
    expect(classifySeedCandidateStatus([{ role: 'instance' }], 'asset-semantic-name')).toBe('exact')
    expect(classifySeedCandidateStatus([{ role: 'instance' }], 'family-unique-ordinal')).toBe('provisional')
  })
})
