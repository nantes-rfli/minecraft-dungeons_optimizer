import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import {
  addScenarioPreset,
  deserializeScenarioPresets,
  mergeScenarioPresets,
  MAX_SCENARIO_PRESETS,
  removeScenarioPreset,
  serializeScenarioPresets,
  type SavedScenarioPreset,
} from '../src/scenario/presets'

function preset(id: string, name: string, overrides: Partial<typeof DEFAULT_SCENARIO> = {}): SavedScenarioPreset {
  return { id, name, scenario: { ...DEFAULT_SCENARIO, ...overrides } }
}

describe('saved optimizer scenario presets', () => {
  it('round-trips the complete valid scenario, including nested assumptions and evidence policy', () => {
    const scenario = {
      ...DEFAULT_SCENARIO,
      profileId: 'boss' as const,
      name: 'ボス',
      evidencePolicy: 'high-confidence-only' as const,
      averageEnemyHealth: 777,
      enemyComposition: { ...DEFAULT_SCENARIO.enemyComposition, enchantedShare: 0.35 },
      weights: { ...DEFAULT_SCENARIO.weights, damage: 0.7 },
    }
    const saved = addScenarioPreset([], { id: 'preset-boss', name: '深層ボス', scenario })

    expect(deserializeScenarioPresets(serializeScenarioPresets(saved))).toEqual(saved)
  })

  it('rejects invalid optimizer inputs and unsupported document versions', () => {
    expect(() => addScenarioPreset([], preset('invalid', '不正条件', { averageEnemyHealth: 0 }))).toThrow(/現在のOptimizerで使える条件ではありません/)
    expect(() => deserializeScenarioPresets(JSON.stringify({ version: 2, presets: [] }))).toThrow(/対応していません/)
    expect(() => deserializeScenarioPresets(JSON.stringify({ version: 1, presets: [preset('invalid', '不正条件', { averageEnemyHealth: 0 })] }))).toThrow(/現在のOptimizerで使える条件ではありません/)
  })

  it('requires unique names and identifiers and caps the list at eight presets', () => {
    const existing = [preset('one', '火力')]
    expect(() => addScenarioPreset(existing, preset('two', '火力'))).toThrow(/名前が重複/)
    expect(() => addScenarioPreset(existing, preset('one', '別名'))).toThrow(/IDが重複/)
    const full = Array.from({ length: MAX_SCENARIO_PRESETS }, (_, index) => preset(`preset-${index}`, `条件${index}`))
    expect(() => addScenarioPreset(full, preset('extra', '追加'))).toThrow(/最大8件/)
  })

  it('merges imported presets only when the complete addition is valid', () => {
    const existing = [preset('one', '近接')]
    const imported = [preset('two', 'ボス')]
    expect(mergeScenarioPresets(existing, imported)).toEqual([...existing, ...imported])
    expect(existing).toHaveLength(1)
    expect(() => mergeScenarioPresets(existing, [preset('three', '近接')])).toThrow(/名前が重複/)

    const seven = Array.from({ length: 7 }, (_, index) => preset(`existing-${index}`, `既存${index}`))
    expect(() => mergeScenarioPresets(seven, [preset('incoming-1', '追加1'), preset('incoming-2', '追加2')])).toThrow(/最大8件/)
    expect(seven).toHaveLength(7)
  })

  it('removes only the explicitly selected preset', () => {
    const presets = [preset('one', '火力'), preset('two', 'ボス')]
    expect(removeScenarioPreset(presets, 'one')).toEqual([presets[1]])
    expect(presets).toHaveLength(2)
  })
})
