import { afterEach, describe, expect, it, vi } from 'vitest'
import audit from '../research/melee-enchantment-audit.json'
import { evaluate, optimize } from '../src/core'
import { calculateDamage } from '../src/core/damage'
import { committedTrajectory, conditionExposure, instantCommittedMultiplier } from '../src/core/enemyStateDamage'
import { hasValidEnchantmentStacking } from '../src/core/enchantment'
import { validateBuild, validateScenario } from '../src/core/validation'
import type { Build, EnchantmentId, EnchantmentTier, Inventory, Scenario, SelectedEnchantment } from '../src/core'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'

const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const effects = { attackSpeedMultiplier: 1, damageTakenMultiplier: 1, uptimes: [], stackingGroups: [] }
const weapon = { weaponId: 'double-axe' as const, powerLevel: 251, observedDamagePerHit: 100000 }
const withShares = (undeadShare = 0.5, ambushEligibleDirectDamageShare = 0.25, enchantedShare = 0.25): Scenario => ({
  ...DEFAULT_SCENARIO, enemyComposition: { enchantedShare, undeadShare }, enemyState: { ambushEligibleDirectDamageShare },
})
const damage = (enchantments: SelectedEnchantment[], scenario = withShares()) => calculateDamage(weapon, enchantments, effects, scenario)
function buildFor(enchantments: SelectedEnchantment[]): Build {
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return {
    weapon: { ...weapon, instanceId: 'enemy-state', enchantmentSlots: enchantments.filter((item) => item.source === 'slot').map((item) => ({ candidates: [item.enchantmentId] })), ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}) },
    enchantments, artifacts: [],
  }
}

describe('source-backed enemy state effects and shared-condition expectations', () => {
  it.each(['ambush', 'smiting', 'committed'] as const)('%s retains audit values, stacking and applicability', (id) => {
    const entry = audit.entries.find((item) => item.id === id)!
    const definition = ENCHANTMENTS[id]
    expect(entry.runtimeStatus).toBe('implemented')
    expect(definition.stacking.value).toEqual(entry.stacking)
    expect(definition.applicability?.value).toEqual(entry.applicability)
    expect(definition.tiers.source.url).toBe(entry.sources[0]!.url)
    expect(entry.sources.some((source) => source.url === definition.stacking.source.url)).toBe(true)
    for (const tier of [1, 2, 3] as const) {
      const values = entry.tierValues[tier].interpreted as Record<string, unknown>
      expect(definition.tiers.value[tier].effect).toEqual(id === 'committed'
        ? { kind: 'target-health-weapon-damage', maxBonus: values.maxDamageBonus }
        : { kind: 'conditional-weapon-damage', condition: id === 'ambush' ? 'not-targeting-hero' : 'undead-enemy', bonus: values[id === 'ambush' ? 'damageBonus' : 'undeadDamageBonus'] })
    }
  })

  it.each([1, 2, 3] as const)('Ambush Tier %s mixes only eligible attacks', (tier) => {
    for (const share of [0, 0.25, 1]) {
      const result = damage([selected('ambush', tier)], withShares(0.5, share))
      expect(result.ambushMultiplier).toBeCloseTo(1 + share * [0.2, 0.4, 0.6][tier - 1]!, 12)
      expect(result.singleTargetDps).toBeCloseTo(result.baseDps * result.ambushMultiplier)
    }
    expect(damage([selected('ambush')]).ambushMultiplier).toBe(1.15)
  })

  it.each([1, 2, 3] as const)('Smiting Tier %s mixes undead and other targets', (tier) => {
    for (const share of [0, 0.5, 1]) {
      const result = damage([selected('smiting', tier)], withShares(share))
      expect(result.smitingMultiplier).toBeCloseTo(1 + share * [0.25, 0.35, 0.45][tier - 1]!, 12)
    }
    expect(damage([selected('smiting')]).smitingMultiplier).toBe(1.225)
  })

  it.each([2, 3, 4])('%s Smiting copies share a single condition, including gilded', (copies) => {
    const enchantments = Array.from({ length: copies }, (_, index) => selected('smiting', 3, index === 3 ? 'gilded' : 'slot'))
    expect(() => validateBuild(buildFor(enchantments))).not.toThrow()
    for (const share of [0, 0.1, 0.5, 0.9, 1]) {
      const result = damage(enchantments, withShares(share))
      expect(result.smitingActiveUndeadMultiplier).toBeCloseTo(1.45 ** copies, 12)
      expect(result.smitingMultiplier).toBeCloseTo(1 - share + share * 1.45 ** copies, 12)
      if (share > 0 && share < 1) expect(result.smitingMultiplier).not.toBeCloseTo((1 + share * 0.45) ** copies, 8)
    }
    expect(damage([selected('smiting'), selected('smiting')]).smitingMultiplier).toBeCloseTo(1.55125, 12)
  })

  it('mixed Smiting tiers are order-independent and limited to four copies', () => {
    const copies = [selected('smiting'), selected('smiting', 2, 'gilded')]
    expect(() => validateBuild(buildFor(copies))).not.toThrow()
    expect(damage(copies).smitingMultiplier).toBeCloseTo(0.5 + 0.5 * 1.45 * 1.35, 12)
    expect(damage(copies)).toEqual(damage([...copies].reverse()))
    expect(hasValidEnchantmentStacking(Array.from({ length: 5 }, () => selected('smiting')))).toBe(false)
  })

  it('uses MVP independent-condition approximation, not an exact joint distribution', () => {
    const scenario = withShares(0.5, 0.25, 0.75)
    expect(conditionExposure('enchanted-enemy', scenario)).toBe(0.75)
    expect(conditionExposure('undead-enemy', scenario)).toBe(0.5)
    expect(conditionExposure('not-targeting-hero', scenario)).toBe(0.25)
    const result = damage([selected('unchanting'), selected('smiting'), selected('ambush')], scenario)
    expect(result.singleTargetDps).toBeCloseTo(result.baseDps * 1.75 * 1.225 * 1.15)
    expect(result.nonEnchantedTargetDps).toBeCloseTo(result.baseDps * 1.225 * 1.15)
    expect(result.enchantedTargetDps).toBeCloseTo(result.nonEnchantedTargetDps * 2)
  })
})

describe('Committed continuous fresh-target trajectory, not arithmetic HP averaging', () => {
  it.each([[0.5, 1.2331517311882159], [0.75, 1.3402052196685823], [1, 1.4426950408889634]])('direct-only b=%s matches the closed form and golden value', (bonus, expected) => {
    const result = committedTrajectory(100, 0, bonus)
    expect(result.directMultiplier).toBeCloseTo(expected, 12)
    expect(result.directMultiplier).toBeCloseTo(bonus / Math.log1p(bonus), 12)
    expect(result.effectiveTotalDps).toBe(result.effectiveDirectDps)
  })
  it('uses published instantaneous endpoints rather than permanent maximum bonus', () => {
    expect(instantCommittedMultiplier(1, 1)).toBe(1)
    expect(instantCommittedMultiplier(0.5, 1)).toBe(1.5)
    expect(instantCommittedMultiplier(0, 1)).toBe(2)
    expect(committedTrajectory(100, 0, 1).directMultiplier).not.toBeCloseTo(1.5, 6)
  })
  it('D=100, P=100 integrates proc HP loss without increasing P', () => {
    const result = committedTrajectory(100, 100, 1)
    expect(result.effectiveTotalDps).toBeCloseTo(100 / Math.log(1.5), 10)
    expect(result.effectiveDirectDps).toBeCloseTo(100 / Math.log(1.5) - 100, 10)
    expect(result.directMultiplier).toBeGreaterThan(committedTrajectory(100, 0, 1).directMultiplier)
    expect(result.effectiveTotalDps - result.effectiveDirectDps).toBeCloseTo(100)
  })
  it('matches independent numerical integration of reciprocal instantaneous rates', () => {
    for (const direct of [0.1, 100, 1e6]) for (const procRatio of [0, 0.01, 1, 1000]) for (const bonus of [0.5, 0.75, 1]) {
      const proc = direct * procRatio
      const steps = 10000
      let timePerHealth = 0
      for (let i = 0; i < steps; i++) {
        const h = (i + 0.5) / steps
        timePerHealth += 1 / (proc + direct * (1 + bonus * (1 - h))) / steps
      }
      expect(committedTrajectory(direct, proc, bonus).effectiveTotalDps * timePerHealth).toBeCloseTo(1, 8)
    }
  })
  it('is finite for zero, tiny bonus, extreme magnitudes and proc-dominated rates', () => {
    for (const direct of [0, 1e-300, 1e-12, 100, 1e200]) for (const proc of [0, 1e-300, 100, 1e200]) for (const bonus of [0, 1e-300, 1e-12, 0.0001, 1]) {
      const result = committedTrajectory(direct, proc, bonus)
      expect(Object.values(result).every(Number.isFinite)).toBe(true)
      expect(result.directMultiplier).toBeGreaterThanOrEqual(1)
      expect(result.directMultiplier).toBeLessThanOrEqual(1 + bonus)
      expect(result.effectiveDirectDps).toBeGreaterThanOrEqual(direct)
      if (bonus === 0) expect(result.directMultiplier).toBe(1)
    }
    expect(committedTrajectory(1e-300, 1e200, 1).directMultiplier).toBe(1.5)
    expect(committedTrajectory(100, 0, 1e-12).directMultiplier).toBeCloseTo(1, 10)
  })
  it('rejects invalid numerical inputs and unrepresentable output explicitly', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      expect(() => committedTrajectory(bad, 100, 1)).toThrow()
      expect(() => committedTrajectory(100, bad, 1)).toThrow()
      expect(() => committedTrajectory(100, 100, bad)).toThrow()
      expect(() => instantCommittedMultiplier(bad, 1)).toThrow()
    }
    expect(() => instantCommittedMultiplier(1.1, 1)).toThrow()
    expect(() => committedTrajectory(100, 0, 1.1)).toThrow()
    expect(() => committedTrajectory(Number.MAX_VALUE, Number.MAX_VALUE, 1)).toThrow('finite numeric range')
  })
})

describe('direct/proc boundary, existing modifiers and nonlinear recalculation', () => {
  it.each([1, 2, 3] as const)('Committed Tier %s uses its health maximum in the runtime channel', (tier) => {
    const bonus = [0.5, 0.75, 1][tier - 1]!
    const result = damage([selected('committed', tier)])
    expect(result.committedSingleTargetMultiplier).toBeCloseTo(bonus / Math.log1p(bonus), 12)
    expect(result.directWeaponSingleTargetDps).toBeCloseTo(result.baseDps * bonus / Math.log1p(bonus))
  })
  it('proc removal recomputes the Committed trajectory rather than subtracting proc DPS', () => {
    const scenario = { ...withShares(), averageEnemyHealth: 1e6, enemySupplyPerSecond: 100 }
    const result = evaluate(buildFor([selected('committed'), selected('shockwave'), selected('leeching')]), scenario)
    const without = evaluate(buildFor([selected('committed'), selected('leeching')]), scenario)
    expect(result.damage.committedSingleTargetMultiplier).toBeGreaterThan(without.damage.committedSingleTargetMultiplier)
    const contribution = result.contributions.find((item) => item.sourceId === 'shockwave')!
    expect(contribution.singleTargetDpsDelta).toBeCloseTo(result.damage.singleTargetDps - without.damage.singleTargetDps)
    expect(contribution.singleTargetDpsDelta).toBeGreaterThan(result.damage.indirectSingleTargetDps)
    expect(contribution.healingPerSecondDelta).toBeCloseTo(result.healing.totalPerSecond - without.healing.totalPerSecond)
  })
  it.each(['shockwave', 'swirling', 'thundering'] as const)('%s damage, cadence and targeting never inherit new modifiers', (proc) => {
    const base = damage([selected(proc)])
    for (const id of ['ambush', 'smiting', 'committed'] as const) {
      const result = damage([selected(proc), selected(id)])
      expect(result.damageEvents).toEqual(base.damageEvents)
      expect(result.indirectSingleTargetDps).toBe(base.indirectSingleTargetDps)
      expect(result.indirectAoeDps).toBe(base.indirectAoeDps)
      expect(result.directWeaponSingleTargetDps).toBeGreaterThan(base.directWeaponSingleTargetDps)
    }
  })
  it.each([
    ['ambush', 'sharpness'], ['smiting', 'critical-hit'], ['smiting', 'unchanting'],
    ['ambush', 'unchanting'], ['committed', 'void-strike'], ['committed', 'shockwave'],
  ] satisfies [EnchantmentId, EnchantmentId][])('preserves %s + %s integration and effect order', (first, second) => {
    const enchantments = [selected(first!), selected(second!)]
    const result = damage(enchantments)
    expect(damage([...enchantments].reverse())).toEqual(result)
    expect(result.preCommittedDirectWeaponSingleTargetDps).toBeCloseTo(result.baseDps * result.sharpnessMultiplier * result.criticalMultiplier * result.voidStrikeMultiplier * result.unchantingMultiplier * result.smitingMultiplier * result.ambushMultiplier)
    expect(result.singleTargetDps).toBeCloseTo(result.preCommittedDirectWeaponSingleTargetDps * result.committedSingleTargetMultiplier + result.indirectSingleTargetDps)
  })
  it('applies the homogeneous AoE approximation separately using its own D/P ratio', () => {
    const scenario = { ...withShares(), averageTargetsInReach: 4, damageEventTargeting: { shockwave: 3, swirling: 1, thundering: 1 } }
    const result = damage([selected('committed'), selected('shockwave')], scenario)
    expect(result.committedSingleTargetMultiplier).not.toBeCloseTo(result.committedAoeMultiplier, 6)
    expect(result.directWeaponAoeDps).toBeCloseTo(committedTrajectory(result.preCommittedDirectWeaponAoeDps, result.indirectAoeDps, 1).effectiveDirectDps)
    expect(result.aoeDps).toBe(result.directWeaponAoeDps + result.indirectAoeDps)
    expect(result.nonEnchantedTargetDps).toBe(result.preCommittedDirectWeaponSingleTargetDps)
  })
  it.each(['ambush', 'smiting', 'committed'] as const)('removing %s recomputes DPS, kills, Leeching, Guarding and Refreshment', (id) => {
    const scenario = { ...withShares(), averageEnemyHealth: 1e6, enemySupplyPerSecond: 100 }
    const base = [selected('leeching'), selected('guarding-strike'), selected('refreshment')]
    const without = evaluate(buildFor(base), scenario)
    const result = evaluate(buildFor([...base, selected(id, 3, 'gilded')]), scenario)
    expect(result.combatState.directWeaponKillsPerSecond).toBeGreaterThan(without.combatState.directWeaponKillsPerSecond)
    expect(result.healing.leechingPerSecond).toBeGreaterThan(without.healing.leechingPerSecond)
    expect(result.defense.guardingStrikeUptime).toBeGreaterThan(without.defense.guardingStrikeUptime)
    expect(result.potionState.effectiveCooldownSeconds).toBeLessThan(without.potionState.effectiveCooldownSeconds)
    const contribution = result.contributions.find((item) => item.sourceId === id)!
    expect(contribution.singleTargetDpsDelta).toBeCloseTo(result.damage.singleTargetDps - without.damage.singleTargetDps)
    expect(contribution.healingPerSecondDelta).toBeCloseTo(result.healing.totalPerSecond - without.healing.totalPerSecond)
    expect(contribution.effectiveHealthDelta).toBeCloseTo(result.defense.effectiveHealth - without.defense.effectiveHealth)
    const plainProc = evaluate(buildFor([selected('shockwave')]), scenario)
    const boostedProc = evaluate(buildFor([selected('shockwave'), selected(id)]), scenario)
    expect(boostedProc.combatState.directDamageShare).toBeGreaterThan(plainProc.combatState.directDamageShare)
  })
})

describe('enemy-state validation, evidence and inventory integration', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each([-0.01, 1.01, NaN, Infinity, -Infinity, undefined, null])('rejects invalid or missing shares %s', (bad) => {
    for (const field of ['undead', 'ambush']) {
      const scenario = (field === 'undead'
        ? { ...withShares(), enemyComposition: { enchantedShare: 0.25, undeadShare: bad } }
        : { ...withShares(), enemyState: { ambushEligibleDirectDamageShare: bad } }) as unknown as Scenario
      const path = field === 'undead' ? 'undeadShare' : 'ambushEligibleDirectDamageShare'
      expect(() => validateScenario(scenario)).toThrow(path)
      expect(() => evaluate(buildFor([selected('ambush')]), scenario)).toThrow(path)
      expect(() => optimize({ weapons: [buildFor([selected('smiting')]).weapon], artifacts: [] }, scenario)).toThrow(path)
    }
  })
  it('keeps editable defaults consistent and rejects absent enemyState', () => {
    for (const profile of Object.values(SCENARIO_PROFILES)) {
      expect(profile.enemyComposition.undeadShare).toBe(0.5)
      expect(profile.enemyState.ambushEligibleDirectDamageShare).toBe(0.25)
      expect(() => validateScenario(profile)).not.toThrow()
    }
    expect(() => validateScenario({ ...DEFAULT_SCENARIO, enemyState: undefined } as unknown as Scenario)).toThrow('enemyState')
  })
  it('adds low-confidence assumptions only to relevant builds and separates mathematical confidence', () => {
    const ids = ['ambush', 'smiting', 'committed', 'radiance'] as const
    for (const id of ids) {
      const result = evaluate(buildFor([selected(id)]), withShares())
      const factors = new Map(result.confidence.factors.map((factor) => [factor.id, factor.confidence]))
      expect(factors.has('ambush-eligible-share')).toBe(id === 'ambush')
      expect(factors.has('undead-enemy-share')).toBe(id === 'smiting')
      expect(factors.has('committed-fresh-target')).toBe(id === 'committed')
      expect(factors.has('conditional-state-factorization')).toBe(false)
      if (id === 'committed') {
        expect(factors.get('committed-analytic-integration')).toBe('high')
        expect(factors.get('committed-fresh-target')).toBe('low')
        expect(factors.get('committed-aoe-trajectory')).toBe('low')
        expect(result.reasons.join(' ')).toContain('1.4427')
      }
    }
    const combined = evaluate(buildFor([selected('ambush'), selected('smiting'), selected('unchanting')]), withShares())
    expect(combined.confidence.factors.find((factor) => factor.id === 'conditional-state-factorization')?.confidence).toBe('low')
    expect(combined.reasons.join(' ')).toContain('1.150')
    expect(combined.reasons.join(' ')).toContain('1.22500')
  })
  it.each(['ambush', 'smiting', 'committed'] as const)('%s works through free choices, locks, all gilded tiers and storage/JSON', (id) => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    for (const tier of [1, 2, 3] as const) {
      const inventory: Inventory = { weapons: [{ ...weapon, instanceId: id, enchantmentSlots: [{ candidates: [id, 'sharpness'], selected: { enchantmentId: 'sharpness', tier: 3 } }], gilded: { enchantmentId: id, tier } }], artifacts: [] }
      expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
      saveInventory(inventory)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory)
      const result = optimize(inventory, withShares())
      expect(result.evaluatedBuildCount).toBe(1)
      expect(result.best.build.enchantments.at(-1)).toEqual(selected(id, tier, 'gilded'))
      const locked: Build['weapon'] = { ...inventory.weapons[0]!, gilded: undefined, enchantmentSlots: [{ candidates: [id, 'sharpness'], selected: { enchantmentId: id, tier: 3 as const } }] }
      expect(optimize({ weapons: [locked], artifacts: [] }, withShares()).best.build.enchantments[0]!.enchantmentId).toBe(id)
      const free: Build['weapon'] = { ...locked, enchantmentSlots: [{ candidates: [id, 'sharpness'] }] }
      expect(optimize({ weapons: [free], artifacts: [] }, withShares()).evaluatedBuildCount).toBe(2)
    }
  })
  it.each(['ambush', 'committed'] as const)('rejects a second %s across normal and gilded', (id) => {
    const build = buildFor([selected(id), selected(id, 1, 'gilded')])
    expect(() => validateBuild(build)).toThrow('最大1個')
    expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, withShares())).toThrow('stacking制約')
  })
  it('optimizes four Smiting copies and respects proc Power-range exclusions', () => {
    const build = buildFor([selected('smiting'), selected('smiting'), selected('smiting'), selected('smiting', 2, 'gilded')])
    const result = optimize({ weapons: [build.weapon], artifacts: [] }, withShares())
    expect(result.best.damage.smitingMultiplier).toBeCloseTo(0.5 + 0.5 * 1.45 ** 3 * 1.35)
    const lowPower = { ...weapon, instanceId: 'low', powerLevel: 50, enchantmentSlots: [{ candidates: ['shockwave', 'ambush', 'smiting', 'committed'] as EnchantmentId[] }] }
    expect(optimize({ weapons: [lowPower], artifacts: [] }, withShares()).evaluatedBuildCount).toBe(3)
    expect(() => optimize({ weapons: [{ ...lowPower, gilded: { enchantmentId: 'shockwave', tier: 3 } }], artifacts: [] }, withShares())).toThrow('Power')
  })
  it.each(['ambush', 'smiting'] as const)('%s zero exposure has zero contribution and changes ranking when active', (id) => {
    const zero = withShares(0, 0)
    const build = buildFor([selected(id)])
    expect(evaluate(build, zero).contributions[0]!.singleTargetDpsDelta).toBe(0)
    const inventory: Inventory = { weapons: [{ ...build.weapon, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: [id, 'sharpness'] }] }], artifacts: [] }
    expect(optimize(inventory, zero).best.build.enchantments[0]!.enchantmentId).toBe('sharpness')
    expect(optimize(inventory, withShares(1, 1)).best.build.enchantments[0]!.enchantmentId).toBe(id)
  })
})
