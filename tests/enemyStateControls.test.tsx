import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AmbushShareControl, UndeadShareControl } from '../src/views/EnemyStateControls'
import { MethodologyPage } from '../src/views/MethodologyPage'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { DirectDamageDetails } from '../src/views/DirectDamageDetails'
import { evaluate } from '../src/core'

describe('enemy-state controlled inputs', () => {
  it.each(['ambush', 'smiting', 'committed'] as const)('shows %s result details even without Sharpness or Unchanting', (id) => {
    const evaluation = evaluate({
      weapon: { weaponId: 'double-axe', instanceId: 'details', powerLevel: 251, enchantmentSlots: [{ candidates: [id] }] },
      enchantments: [{ enchantmentId: id, tier: 3, source: 'slot' }], artifacts: [],
    }, SCENARIO_PROFILES.balanced)
    const html = renderToStaticMarkup(<DirectDamageDetails evaluation={evaluation} />)
    expect(html).toContain('直接近接ダメージの倍率を見る')
    expect(html).toContain('Committed適用前')
    expect(html).toContain(id === 'ambush' ? '1.150' : id === 'smiting' ? '1.22500' : '1.4427')
    if (id === 'committed') expect(html).toContain('full HPから撃破まで')
  })
  it.each(Object.values(SCENARIO_PROFILES))('shows assumptions and edits both shares in $profileId without changing other fields', (profile) => {
    const onUndead = vi.fn()
    const onAmbush = vi.fn()
    const undead = UndeadShareControl({ value: profile.enemyComposition, onChange: onUndead })
    const ambush = AmbushShareControl({ value: profile.enemyState, onChange: onAmbush })
    for (const control of [undead, ambush]) {
      const html = renderToStaticMarkup(control)
      expect(html).toContain('min="0" max="1"')
      expect(html).toContain('全シナリオ共通')
      expect(html).toContain('low-confidence')
      expect(html).toContain('実測値ではありません')
    }
    expect(renderToStaticMarkup(undead)).toContain('50%')
    expect(renderToStaticMarkup(ambush)).toContain('25%')
    for (const value of ['0', '0.5', '1']) {
      undead.props.children[1].props.onChange({ target: { value } })
      ambush.props.children[1].props.onChange({ target: { value } })
      expect(onUndead).toHaveBeenLastCalledWith({ ...profile.enemyComposition, undeadShare: Number(value) })
      expect(onAmbush).toHaveBeenLastCalledWith({ ambushEligibleDirectDamageShare: Number(value) })
      expect(renderToStaticMarkup(<UndeadShareControl value={onUndead.mock.lastCall![0]} onChange={onUndead} />)).toContain(`${Number(value) * 100}%`)
      expect(renderToStaticMarkup(<AmbushShareControl value={onAmbush.mock.lastCall![0]} onChange={onAmbush} />)).toContain(`${Number(value) * 100}%`)
    }
  })
  it('explains fresh-target and AoE assumptions without a Committed slider or full-support claim', () => {
    const html = renderToStaticMarkup(<MethodologyPage />)
    expect(html).toContain('1.4427')
    expect(html).toContain('full HP')
    expect(html).toContain('相関')
    expect(html).toContain('Catalog runtime 28 / 33')
    expect(html).toContain('Damage Eventsはpartial')
    expect(html).toContain('Research Track')
    expect(html).toContain('Product Track')
    expect(html).toContain('Runtime Promotion Pipeline Foundation')
    expect(html).toContain('eligible targetなし')
    expect(html).not.toContain('current implementation checklist')
    expect(html).not.toContain('15 / 33 fully supported')
  })
})
