import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core'
import type { Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { ARMOR_ENCHANTMENTS } from '../src/data/armors'
import { RANGED_ENCHANTMENTS } from '../src/data/ranged'
import { BuildAlternative } from '../src/views/RecommendedBuild'
import { OptimizeResults } from '../src/screens/OptimizeResults'

// Synthetic input fixtures, not independent gameplay evidence.
const inventory: Inventory = {
  weapons: [{ instanceId: 'melee', weaponId: 'double-axe', powerLevel: 250,
    enchantmentSlots: [{ candidates: ['radiance', 'sharpness'] }],
    gilded: { enchantmentId: 'critical-hit', tier: 2 } }],
  armors: [{ instanceId: 'armor', armorId: 'battle-robe', powerLevel: 249, observedHealthBonus: 400,
    enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 1 } }],
    gilded: { enchantmentId: 'potion-barrier', tier: 2 } }],
  rangedWeapons: [{ instanceId: 'ranged', weaponId: 'bow', powerLevel: 248,
    enchantmentSlots: [{ candidates: ['power'], selected: { enchantmentId: 'power', tier: 1 } }],
    gilded: { enchantmentId: 'critical-hit', tier: 2 },
    observation: { gameVersion: '1.17.0.0', mode: 'charged', projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 100, sourceNote: 'SYNTHETIC ONLY' } }],
  artifacts: [{ instanceId: 'm1', artifactId: 'death-cap-mushroom', powerLevel: 200 }, { instanceId: 'm2', artifactId: 'death-cap-mushroom', powerLevel: 251 }],
}
const scenario = { ...DEFAULT_SCENARIO, rangedTimeShare: 0.5 }
const tiers = { 1: 'I', 2: 'II', 3: 'III' } as const
const sources = { slot: '通常枠', gilded: 'Gilded', 'built-in': 'Built-in' } as const
const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

function formattedDelta(value: number) {
  const formatted = numberFormat.format(value)
  if (formatted === '0' || formatted === '-0') return '0'
  return value > 0 ? `+${formatted}` : formatted
}

describe('reproducible alternative equipment', () => {
  it('shows each evaluated choice, its tier/source and all equipment powers, without displaying unselected rolls', () => {
    const result = optimize(inventory, scenario)
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.paretoFrontier.length).toBeGreaterThan(0)
    const before = JSON.stringify(result)
    for (const evaluation of [...result.alternatives, ...result.paretoFrontier]) {
      const html = renderToStaticMarkup(<BuildAlternative evaluation={evaluation} best={result.best} weights={scenario.weights} />)
      const composition = html.split('<summary>装備とEnchantの構成を見る</summary>')[1]?.split('</details>')[0]
      expect(composition).toBeDefined()
      expect(html).toContain('<summary>この候補に含まれる効果の評価メモを見る</summary>')
      const evaluationNotes = html.split('この候補に含まれる効果の評価メモを見る</summary>')[1]?.split('</details>')[0]
      expect(evaluationNotes).toBeDefined()
      for (const reason of evaluation.reasons) expect(evaluationNotes).toContain(reason)
      const deltas = html.split('class="alternative-deltas"')[1]?.split('</dl>')[0]
      expect(html).toContain('1位との差（候補 − 1位）')
      expect(deltas).toBeDefined()
      const expectedDeltas = [
        ['単体DPS', evaluation.damage.singleTargetDps - result.best.damage.singleTargetDps],
        ['AoE DPS', evaluation.damage.aoeDps - result.best.damage.aoeDps],
        ['回復 / 秒', evaluation.healing.totalPerSecond - result.best.healing.totalPerSecond],
        ['実効HP', evaluation.defense.effectiveHealth - result.best.defense.effectiveHealth],
        ['Control / 100', (evaluation.control.utility - result.best.control.utility) * 100],
      ] as const
      for (const [label, value] of expectedDeltas) {
        expect(deltas).toContain(`<dt>${label}</dt><dd>${formattedDelta(value)}</dd>`)
      }
      for (const [choices, catalog] of [
        [evaluation.build.enchantments, ENCHANTMENTS],
        [evaluation.build.armorEnchantments ?? [], ARMOR_ENCHANTMENTS],
        [evaluation.build.rangedEnchantments ?? [], RANGED_ENCHANTMENTS],
      ] as const) {
        for (const choice of choices) {
          const definition = (catalog as Record<string, { name: { ja?: string } }>)[choice.enchantmentId]!
          expect(composition).toContain(`${definition.name.ja} ${tiers[choice.tier]}`)
          expect(composition).toContain(`>${sources[choice.source]}</span>`)
        }
      }
      for (const power of [250, 249, 248, 200, 251]) expect(composition).toContain(`Power ${power}`)
      const melee = composition!.split('<dt>防具</dt>')[0]!
      const selectedId = evaluation.build.enchantments[0]!.enchantmentId
      expect(melee).not.toContain(`${ENCHANTMENTS[selectedId === 'radiance' ? 'sharpness' : 'radiance'].name.ja} `)
    }
    expect(JSON.stringify(result)).toBe(before)
  })

  it('connects composition disclosure to every displayed next-best and Pareto card', () => {
    const result = optimize(inventory, scenario)
    const html = renderToStaticMarkup(<OptimizeResults weights={scenario.weights} result={result} error={null} status="complete" />)
    expect(html.match(/<summary>装備とEnchantの構成を見る<\/summary>/g)).toHaveLength(result.alternatives.slice(0, 4).length + result.paretoFrontier.slice(0, 3).length)
    expect(html).toContain('Estimatedを含めて評価')
  })

  it('shows only equipment-slot changes against first place, including power and selected enchantments', () => {
    const result = optimize(inventory, scenario)
    const best = result.best
    const selectedSlotEnchantment = best.build.enchantments.find((item) => item.source === 'slot')
    expect(selectedSlotEnchantment).toBeDefined()
    const alternativeEnchantmentId: 'radiance' | 'sharpness' = selectedSlotEnchantment?.enchantmentId === 'radiance' ? 'sharpness' : 'radiance'
    const armor = best.build.armor ?? inventory.armors![0]!
    const ranged = best.build.rangedWeapon ?? inventory.rangedWeapons![0]!
    const artifacts = best.build.artifacts.length > 0 ? best.build.artifacts : [inventory.artifacts[0]!]
    // Renderer-only specimen; mutating these copies is not gameplay evidence.
    const candidate = {
      ...best,
      build: {
        ...best.build,
        weapon: { ...best.build.weapon, powerLevel: best.build.weapon.powerLevel - 1 },
        enchantments: best.build.enchantments.map((item) => item.source === 'slot'
          ? { ...item, enchantmentId: alternativeEnchantmentId }
          : item),
        armor: { ...armor, powerLevel: armor.powerLevel + 1 },
        rangedWeapon: { ...ranged, powerLevel: ranged.powerLevel + 1 },
        artifacts: artifacts.map((item) => ({ ...item, powerLevel: item.powerLevel + 1 })),
      },
    }
    const html = renderToStaticMarkup(<BuildAlternative evaluation={candidate} best={best} weights={scenario.weights} />)
    const differences = html.split('<summary>1位との装備差を見る</summary>')[1]?.split('</details>')[0]
    expect(differences).toBeDefined()
    expect(differences).toContain('<dt>近接</dt>')
    expect(differences).toContain('<dt>防具</dt>')
    expect(differences).toContain('<dt>遠距離</dt>')
    expect(differences).toContain('<dt>Artifact</dt>')
    expect(differences).toContain('1位')
    expect(differences).toContain('候補')
    expect(differences).toContain(`Power ${best.build.weapon.powerLevel}`)
    expect(differences).toContain(`Power ${candidate.build.weapon.powerLevel}`)
    expect(differences).toContain(ENCHANTMENTS[selectedSlotEnchantment!.enchantmentId].name.ja)
    expect(differences).toContain(ENCHANTMENTS[alternativeEnchantmentId].name.ja)
  })

  it('treats artifact display order as unchanged and labels identical visible equipment', () => {
    const result = optimize(inventory, scenario)
    const candidate = { ...result.best, build: { ...result.best.build, artifacts: [...result.best.build.artifacts].reverse() } }
    const html = renderToStaticMarkup(<BuildAlternative evaluation={candidate} best={result.best} weights={scenario.weights} />)
    const differences = html.split('<summary>1位との装備差を見る</summary>')[1]?.split('</details>')[0]
    expect(differences).toContain('表示されている装備・Enchantの差はありません。')
    expect(differences).not.toContain('<dt>Artifact</dt>')
  })

  it('keeps absent equipment and enchantment-free builds explicit', () => {
    const result = optimize({ weapons: [{ instanceId: 'plain', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['sharpness'] }] }], artifacts: [] }, DEFAULT_SCENARIO)
    // Renderer-only empty composition specimen; not an engine-supported build.
    const empty = { ...result.best, build: { ...result.best.build, enchantments: [] } }
    const html = renderToStaticMarkup(<BuildAlternative evaluation={empty} best={result.best} weights={DEFAULT_SCENARIO.weights} />)
    expect(html).toContain('Enchantなし')
    expect(html).toContain('<dt>防具</dt><dd>なし</dd>')
    expect(html).toContain('<dt>遠距離</dt><dd>なし</dd>')
    expect(html).toContain('<dt>Artifact</dt><dd>なし</dd>')
    expect(html).not.toMatch(/undefined|NaN/)
  })

  it('shows absolute signed deltas when the first-place metric is zero', () => {
    const result = optimize(inventory, scenario)
    const zeroBaseline = {
      ...result.best,
      damage: { ...result.best.damage, singleTargetDps: 0, aoeDps: 0 },
      healing: { ...result.best.healing, totalPerSecond: 0 },
      defense: { ...result.best.defense, effectiveHealth: 0 },
      control: { ...result.best.control, utility: 0 },
    }
    const html = renderToStaticMarkup(<BuildAlternative evaluation={result.best} best={zeroBaseline} weights={scenario.weights} />)
    const deltas = html.split('class="alternative-deltas"')[1]?.split('</dl>')[0]
    expect(deltas).toContain(`<dt>単体DPS</dt><dd>${formattedDelta(result.best.damage.singleTargetDps)}</dd>`)
    expect(deltas).toContain(`<dt>AoE DPS</dt><dd>${formattedDelta(result.best.damage.aoeDps)}</dd>`)
    expect(deltas).toContain(`<dt>回復 / 秒</dt><dd>${formattedDelta(result.best.healing.totalPerSecond)}</dd>`)
    expect(deltas).toContain(`<dt>実効HP</dt><dd>${formattedDelta(result.best.defense.effectiveHealth)}</dd>`)
    expect(deltas).toContain(`<dt>Control / 100</dt><dd>${formattedDelta(result.best.control.utility * 100)}</dd>`)
    expect(html).not.toContain('比較不可')
  })
})
