import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/core'
import type { Build } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { SoulStateDetails } from '../src/views/SoulStateDetails'

const build: Build = {
  weapon: { instanceId: 'soul-ui', weaponId: 'soul-scythe', powerLevel: 251, enchantmentSlots: [{ candidates: ['soul-siphon'] }, { candidates: ['anima-conduit'] }] },
  enchantments: [{ enchantmentId: 'soul-siphon', tier: 3, source: 'slot' }, { enchantmentId: 'anima-conduit', tier: 3, source: 'slot' }], artifacts: [],
}
describe('SoulState details', () => {
  it('shows resolved pickup/resource/trajectory separately and qualifies healing capacity', () => {
    const result = evaluate(build, DEFAULT_SCENARIO)
    const state = result.soulState!
    const html = renderToStaticMarkup(<SoulStateDetails evaluation={result} />)
    expect(html).toContain(`吸収 ${state.totalPickupEventsPerSecond.toFixed(3)}回/秒`)
    expect(html).toContain(`Resource収入 ${state.totalResourceUnitsPerSecond.toFixed(3)}/秒`)
    expect(html).toContain(`平均Soul ${(state.encounterAverageSoulFraction * state.capacity).toFixed(2)}（${(state.encounterAverageSoulFraction * 100).toFixed(2)}%）`)
    expect(html).toContain(`Anima回復容量 ${result.healing.animaHealingCapacityPerSecond.toFixed(3)}/秒`)
    expect(html).toContain('満タン時の実回復は未確認')
    expect(html).toContain('吸収遅延・overheal')
    expect(html).toContain('消費 0.00')
    expect(html).toContain('overflow')
    expect(html).toContain('research-only')
  })
  it('does not show Soul details for non-soul builds', () => {
    const plain: Build = { weapon: { ...build.weapon, weaponId: 'anchor', enchantmentSlots: [{ candidates: ['critical-hit'] }] }, enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [] }
    expect(renderToStaticMarkup(<SoulStateDetails evaluation={evaluate(plain, DEFAULT_SCENARIO)} />)).toBe('')
  })
})
