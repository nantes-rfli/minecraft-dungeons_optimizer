import { afterEach, describe, expect, it, vi } from 'vitest'
import audit from '../research/melee-enchantment-audit.json'
import { calculateDamage } from '../src/core/damage'
import { combineDirectWeaponBonuses, hasValidEnchantmentStacking } from '../src/core/enchantment'
import { evaluate, optimize, OptimizerInputError } from '../src/core'
import { validateBuild, validateScenario } from '../src/core/validation'
import type { Build, EnchantmentId, EnchantmentTier, Inventory, Scenario, SelectedEnchantment } from '../src/core'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'

const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const effects = { attackSpeedMultiplier: 1, damageTakenMultiplier: 1, uptimes: [], stackingGroups: [] }
const weapon = { weaponId: 'double-axe' as const, powerLevel: 251, observedDamagePerHit: 100 }
const scenarioWithShare = (enchantedShare: number): Scenario => ({ ...DEFAULT_SCENARIO, enemyComposition: { enchantedShare } })
const damage = (enchantments: SelectedEnchantment[], enchantedShare = 0.25) => calculateDamage(weapon, enchantments, effects, scenarioWithShare(enchantedShare))
function buildFor(enchantments: SelectedEnchantment[]): Build {
  const slots = enchantments.filter((item) => item.source === 'slot')
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return {
    weapon: { ...weapon, instanceId: 'modifier-test', enchantmentSlots: slots.map((item) => ({ candidates: [item.enchantmentId] })), ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}) },
    enchantments,
    artifacts: [],
  }
}

describe('audit-backed direct weapon effects', () => {
  it.each(['sharpness', 'unchanting'] as const)('preserves %s tier, applicability, stacking and provenance from audit', (id) => {
    const entry = audit.entries.find((item) => item.id === id)!
    const definition = ENCHANTMENTS[id]
    expect(definition.stacking.value).toEqual(entry.stacking)
    expect(definition.applicability?.value).toEqual(entry.applicability)
    expect(definition.tiers.source.url).toBe(entry.sources[0]!.url)
    expect(definition.tiers.confidence).toBe(entry.sources[0]!.confidence)
    for (const tier of [1, 2, 3] as const) {
      const expected = id === 'sharpness' ? [0.1, 0.21, 0.33][tier - 1] : [0.5, 0.75, 1][tier - 1]
      const interpreted = entry.tierValues[tier].interpreted as Record<string, unknown>
      expect(expected).toBe(interpreted[id === 'sharpness' ? 'damageBonus' : 'enchantedEnemyDamageBonus'])
      expect(definition.tiers.value[tier].directWeaponEffect?.bonus).toBe(expected)
    }
  })

  it.each([1, 2, 3] as const)('Sharpness Tier %s scales both observed and Power curve damage', (tier) => {
    const multiplier = [1.1, 1.21, 1.33][tier - 1]!
    for (const observedDamagePerHit of [undefined, 100]) {
      const input = { ...weapon, observedDamagePerHit }
      const plain = calculateDamage(input, [], effects, DEFAULT_SCENARIO)
      const result = calculateDamage(input, [selected('sharpness', tier, 'gilded')], effects, DEFAULT_SCENARIO)
      expect(result.sharpnessMultiplier).toBeCloseTo(multiplier)
      expect(result.singleTargetDps).toBeCloseTo(plain.singleTargetDps * multiplier)
      expect(result.damagePerHit).toBe(plain.damagePerHit)
      expect(result.hitsPerSecond).toBe(plain.hitsPerSecond)
      expect(result.aoeDps).toBeCloseTo(plain.aoeDps * multiplier)
      expect(result.damageSource).toBe(observedDamagePerHit === undefined ? 'power-curve-estimate' : 'observed-input')
    }
  })

  it.each([1, 2, 3, 4])('supports %s legal Sharpness copies including gilded', (count) => {
    const enchantments = Array.from({ length: count }, (_, index) => selected('sharpness', 3, index === 3 ? 'gilded' : 'slot'))
    expect(() => validateBuild(buildFor(enchantments))).not.toThrow()
    expect(damage(enchantments).sharpnessMultiplier).toBeCloseTo(1.33 ** count)
  })

  it('multiplies mixed tiers without giving significance to input order', () => {
    const copies = [selected('sharpness'), selected('sharpness', 1, 'gilded')]
    expect(() => validateBuild(buildFor(copies))).not.toThrow()
    expect(damage(copies).sharpnessMultiplier).toBeCloseTo(1.33 * 1.1)
    expect(combineDirectWeaponBonuses(copies, 'sharpness')).toBe(combineDirectWeaponBonuses([...copies].reverse(), 'sharpness'))
    expect(hasValidEnchantmentStacking(Array.from({ length: 5 }, () => selected('sharpness')))).toBe(false)
  })

  it.each([1, 2, 3] as const)('Unchanting Tier %s has zero, full and linear mixed-target bonuses', (tier) => {
    const bonus = [0.5, 0.75, 1][tier - 1]!
    const plain = damage([])
    for (const share of [0, 0.25, 0.5, 1]) {
      const result = damage([selected('unchanting', tier, 'gilded')], share)
      expect(result.unchantingMultiplier).toBe(1 + share * bonus)
      expect(result.enchantedShare).toBe(share)
      expect(result.nonEnchantedTargetDps).toBe(plain.singleTargetDps)
      expect(result.enchantedTargetDps).toBe(plain.singleTargetDps * (1 + bonus))
      expect(result.singleTargetDps).toBeCloseTo((1 - share) * result.nonEnchantedTargetDps + share * result.enchantedTargetDps)
    }
  })

  it.each([
    ['sharpness'], ['unchanting'], ['sharpness', 'unchanting'],
    ['sharpness', 'critical-hit'], ['sharpness', 'void-strike'],
    ['unchanting', 'critical-hit'], ['unchanting', 'void-strike'],
    ['sharpness', 'unchanting', 'critical-hit', 'void-strike'],
  ] satisfies EnchantmentId[][])('composes independent direct modifiers for %s', (...ids) => {
    const enchantments = ids.map((id, index) => selected(id, 3, index === 3 ? 'gilded' : 'slot'))
    expect(() => validateBuild(buildFor(enchantments))).not.toThrow()
    for (const share of [0, 0.25, 1]) {
      const result = damage(enchantments, share)
      const crit = ids.includes('critical-hit') ? 1.4 : 1
      const voidMultiplier = ids.includes('void-strike') ? damage([selected('void-strike')]).voidStrikeMultiplier : 1
      const sharp = ids.includes('sharpness') ? 1.33 : 1
      const unchant = ids.includes('unchanting') ? 1 + share : 1
      expect(result.singleTargetDps).toBeCloseTo(result.baseDps * sharp * crit * voidMultiplier * unchant)
      expect(result.criticalMultiplier).toBeCloseTo(crit)
      expect(result.voidStrikeMultiplier).toBeCloseTo(voidMultiplier)
      expect(damage([...enchantments].reverse(), share).singleTargetDps).toBe(result.singleTargetDps)
    }
  })

  it('fails clearly if a non-damage effect is sent to the direct weapon helper', () => {
    expect(() => combineDirectWeaponBonuses([selected('radiance')], 'radiance')).toThrow('Missing direct weapon effect')
  })
})

describe('enemy composition input and confidence', () => {
  it.each([-0.01, 1.01, NaN, Infinity, -Infinity])('rejects invalid share %s at evaluation and optimizer boundaries', (share) => {
    const build = buildFor([selected('unchanting')])
    const scenario = scenarioWithShare(share)
    expect(() => validateScenario(scenario)).toThrow('enemyComposition.enchantedShare')
    expect(() => evaluate(build, scenario)).toThrow(OptimizerInputError)
    expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, scenario)).toThrow(OptimizerInputError)
  })

  it('rejects missing composition from an old API caller instead of producing NaN', () => {
    const { enemyComposition: _omitted, ...legacy } = DEFAULT_SCENARIO
    expect(_omitted).toBeDefined()
    expect(() => validateScenario(legacy as Scenario)).toThrow('enemyComposition.enchantedShare')
  })

  it.each(Object.values(SCENARIO_PROFILES))('keeps an editable generic assumption in profile $profileId', (profile) => {
    expect(profile.enemyComposition.enchantedShare).toBe(0.25)
    expect(() => validateScenario(profile)).not.toThrow()
    for (const share of [0, 1]) {
      const result = calculateDamage(weapon, [selected('unchanting')], effects, { ...profile, enemyComposition: { enchantedShare: share } })
      expect(result.unchantingMultiplier).toBe(1 + share)
    }
  })

  it('adds mixture/condition/share evidence only when Unchanting is selected', () => {
    for (const id of ['sharpness', 'radiance', 'critical-hit'] as const) {
      const result = evaluate(buildFor([selected(id)]), DEFAULT_SCENARIO)
      expect(result.confidence.factors.some((factor) => /enchanted-enemy-share|unchanting/.test(factor.id))).toBe(false)
      expect(result.confidence.caveats.some((caveat) => caveat.includes('エンチャント敵割合'))).toBe(false)
    }
    const result = evaluate(buildFor([selected('sharpness'), selected('unchanting'), selected('critical-hit'), selected('void-strike', 3, 'gilded')]), DEFAULT_SCENARIO)
    for (const id of ['enchanted-enemy-share', 'unchanting-mixture', 'direct-weapon-composition']) {
      expect(result.confidence.factors.find((factor) => factor.id === id)?.confidence).toBe('low')
    }
    expect(result.confidence.factors.find((factor) => factor.id === 'enchant-unchanting')?.confidence).toBe('high')
    expect(result.confidence.factors.find((factor) => factor.id === 'unchanting-target-condition')?.confidence).toBe('high')
    const stacked = evaluate(buildFor([selected('sharpness'), selected('sharpness', 1, 'gilded')]), DEFAULT_SCENARIO)
    expect(stacked.confidence.factors.find((factor) => factor.id === 'enchant-stacking-sharpness')?.confidence).toBe('high')
  })

  it('shows positive Sharpness and share-dependent Unchanting contributions and reasons', () => {
    const build = buildFor([selected('sharpness'), selected('unchanting')])
    for (const share of [0, 0.25, 1]) {
      const result = evaluate(build, scenarioWithShare(share))
      const unchant = result.contributions.find((item) => item.sourceId === 'unchanting')!
      expect(result.reasons.some((reason) => reason.includes(`エンチャント敵割合${share * 100}%`))).toBe(true)
      expect(result.contributions.find((item) => item.sourceId === 'sharpness')!.singleTargetDpsDelta).toBeGreaterThan(0)
      if (share === 0) {
        expect(unchant).toMatchObject({ objectiveDelta: 0, singleTargetDpsDelta: 0, aoeDpsDelta: 0, healingPerSecondDelta: 0, effectiveHealthDelta: 0 })
      } else {
        expect(unchant.singleTargetDpsDelta).toBeCloseTo(result.damage.nonEnchantedTargetDps * share)
      }
    }
  })
})

describe('new enchantment inventory and exhaustive legality', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each(['sharpness', 'unchanting'] as const)('round-trips %s candidates, locks and all gilded tiers through storage and search', (id) => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
    for (const tier of [1, 2, 3] as const) {
      const inventory: Inventory = {
        weapons: [{ ...weapon, instanceId: 'stored', enchantmentSlots: [{ candidates: ['sharpness', 'unchanting'], locked: id === 'sharpness' ? 'unchanting' : 'sharpness' }], gilded: { enchantmentId: id, tier } }],
        artifacts: [],
      }
      expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
      saveInventory(inventory)
      const restored = loadInventory({ weapons: [], artifacts: [] })
      expect(restored).toEqual(inventory)
      const result = optimize(restored, DEFAULT_SCENARIO)
      expect(result.evaluatedBuildCount).toBe(1)
      expect(result.best.build.enchantments.at(-1)).toEqual(selected(id, tier, 'gilded'))
    }
  })

  it('does not allow a second Unchanting copy across normal and gilded slots', () => {
    const build = buildFor([selected('unchanting'), selected('unchanting', 1, 'gilded')])
    expect(() => validateBuild(build)).toThrow('最大1個')
    expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow('stacking制約')
    const result = optimize({ weapons: [{ ...build.weapon, enchantmentSlots: [{ candidates: ['unchanting', 'sharpness'] }] }], artifacts: [] }, DEFAULT_SCENARIO)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.best.build.enchantments[0]!.enchantmentId).toBe('sharpness')
  })

  it('searches all seven candidates within the existing bounded Cartesian product', () => {
    const candidates = Object.keys(ENCHANTMENTS) as EnchantmentId[]
    const inventory: Inventory = { weapons: [{ ...weapon, instanceId: 'all-seven', enchantmentSlots: Array.from({ length: 3 }, () => ({ candidates })) }], artifacts: [] }
    const started = performance.now()
    const result = optimize(inventory, DEFAULT_SCENARIO)
    // 7^3 minus 4 non-stackable IDs × (3 positions for a pair × 6 other IDs + one triple).
    expect(result.evaluatedBuildCount).toBe(343 - 4 * 19)
    expect(result.searchMode).toBe('exhaustive')
    expect(result.best.objectiveScore).toBeGreaterThan(0)
    console.info(`Seven-candidate exhaustive search: ${result.evaluatedBuildCount} builds in ${(performance.now() - started).toFixed(1)}ms`)
  })

  it('rejects every remaining unsupported enchantment through JSON input', () => {
    const inventory: Inventory = { weapons: [buildFor([selected('sharpness')]).weapon], artifacts: [] }
    for (const entry of audit.entries.filter((item) => item.runtimeStatus !== 'implemented')) {
      expect(() => deserializeInventory(serializeInventory(inventory).replace('sharpness', entry.id))).toThrow('未対応ID')
    }
  })
})
