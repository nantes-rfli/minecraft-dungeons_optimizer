import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EnemyCompositionControl } from '../src/views/EnemyCompositionControl'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import type { EnemyComposition } from '../src/core/types'

// This hook-free controlled component exposes the same change callback used by the page.
describe('enemy composition control', () => {
  it.each(Object.values(SCENARIO_PROFILES))('renders and accepts edits after selecting $profileId', (profile) => {
    const onChange = vi.fn<(value: EnemyComposition) => void>()
    const control = EnemyCompositionControl({ value: profile.enemyComposition, onChange })
    const markup = renderToStaticMarkup(control)
    expect(markup).toContain('エンチャントされた敵の割合')
    expect(markup).toContain('25%')
    expect(markup).toContain('Unchantingなど、敵の状態に依存する効果の期待値計算に使用')
    expect(markup).toContain('min="0" max="1"')
    const input = control.props.children[1]
    for (const value of ['0', '0.5', '1']) {
      input.props.onChange({ target: { value } })
      expect(onChange).toHaveBeenLastCalledWith({ ...profile.enemyComposition, enchantedShare: Number(value) })
      expect(renderToStaticMarkup(<EnemyCompositionControl value={{ ...profile.enemyComposition, enchantedShare: Number(value) }} onChange={onChange} />)).toContain(`${Number(value) * 100}%`)
    }
    expect(profile.enemyComposition.enchantedShare).toBe(0.25)
  })
})
