import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { evaluate } from '../src/core'
import type { Build, EnemyDebuffAssumptions } from '../src/core'
import { SCENARIO_PROFILES, DEFAULT_SCENARIO } from '../src/data/scenarios'
import { EnemyDebuffControl } from '../src/views/EnemyDebuffControl'
import { StateModelDetails } from '../src/views/StateModelDetails'

describe('state model UI', () => {
  it.each(Object.values(SCENARIO_PROFILES))('exposes a 50% editable assumption after selecting $profileId', (profile) => {
    const onChange = vi.fn<(value: EnemyDebuffAssumptions) => void>()
    const control = EnemyDebuffControl({ value: profile.enemyDebuffs, onChange })
    const markup = renderToStaticMarkup(control)
    expect(markup).toContain('弱体化の影響を受ける被ダメージ割合')
    expect(markup).toContain('50%')
    expect(markup).toContain('5秒の効果時間')
    expect(markup).toContain('実測値ではありません')
    expect(markup).toContain('min="0" max="1"')
    const input = control.props.children[1]
    for (const value of ['0', '0.5', '1']) {
      input.props.onChange({ target: { value } })
      const updated = { weakeningAffectedIncomingDamageShare: Number(value) }
      expect(onChange).toHaveBeenLastCalledWith(updated)
      expect(renderToStaticMarkup(<EnemyDebuffControl value={updated} onChange={onChange} />)).toContain(`${Number(value) * 100}%`)
    }
    expect(profile.enemyDebuffs.weakeningAffectedIncomingDamageShare).toBe(0.5)
  })

  it('shows the evaluated potion state and defense stages while labelling capacity as approximate', () => {
    const build: Build = {
      weapon: { instanceId: 'ui-test', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['refreshment'] }, { candidates: ['weakening'] }] },
      enchantments: [{ enchantmentId: 'refreshment', tier: 3, source: 'slot' }, { enchantmentId: 'weakening', tier: 3, source: 'slot' }],
      artifacts: [],
    }
    const evaluation = evaluate(build, DEFAULT_SCENARIO)
    const markup = renderToStaticMarkup(<StateModelDetails evaluation={evaluation} />)
    expect(markup).toContain(`推定CD ${evaluation.potionState.effectiveCooldownSeconds.toFixed(2)}秒`)
    expect(markup).toContain(`+${evaluation.potionState.incrementalHealingCapacityPerSecond.toFixed(2)}/秒`)
    expect(markup).toContain('実回復量ではありません')
    expect(markup).toContain('ArtifactのCD短縮は適用しません')
    expect(markup).toContain('敵攻撃ダメージ倍率 0.800')
    expect(markup).toContain('効果時間を再度掛けません')
    const without = evaluate({ ...build, weapon: { ...build.weapon, enchantmentSlots: [{ candidates: ['radiance'] }] }, enchantments: [{ enchantmentId: 'radiance', tier: 3, source: 'slot' }] }, DEFAULT_SCENARIO)
    expect(renderToStaticMarkup(<StateModelDetails evaluation={without} />)).toBe('')
  })
})
