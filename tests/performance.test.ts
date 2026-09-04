import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core/optimizer'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import { PERFORMANCE_SCENARIO, PERFORMANCE_SIZES, performanceInventory } from './performanceFixtures'

describe('synthetic performance baseline', () => {
  for (const size of PERFORMANCE_SIZES) it(`${size}: exhaustive count remains stable`, () => {
    const inventory = performanceInventory(size)
    const expected = { small: 32, medium: 864, large: 6912 }[size]
    expect(estimateSearchCandidates(inventory)).toBe(expected)
    const start = performance.now()
    const result = optimize(inventory, PERFORMANCE_SCENARIO)
    const durationMs = performance.now() - start
    console.info(JSON.stringify({ fixture: size, estimatedCandidates: expected, evaluatedCandidates: result.evaluatedBuildCount, durationMs: Math.round(durationMs), evidence: false, excluded: result.unsupportedChoices }))
    expect(result.searchMode).toBe('exhaustive')
    expect(result.evaluatedBuildCount).toBe(expected)
    // Only a runaway guard; timings are informational across machines/runners.
  }, 60_000)
})
