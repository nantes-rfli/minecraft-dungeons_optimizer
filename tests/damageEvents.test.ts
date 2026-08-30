import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import audit from '../research/damage-event-audit.json'
import { calculateComboFinisherRate, calculateBaseHitsPerSecond } from '../src/core/attackProfile'
import { getAttackProfile } from '../src/core/catalog'
import { calculateDamage } from '../src/core/damage'
import { calculateDamageEvents, enchantmentUnsupportedReason, interpolateProcDamage } from '../src/core/damageEvents'
import { deriveCombatState } from '../src/core/combatState'
import { evaluate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { validateScenario } from '../src/core/validation'
import type { Build, EnchantmentId, EnchantmentTier, Inventory, Scenario, SelectedEnchantment, WeaponId } from '../src/core/types'
import { PROC_DAMAGE_DEFINITIONS, PROC_DAMAGE_IDS, PROC_TIER_MULTIPLIERS } from '../src/data/damageEvents'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory, saveInventory, loadInventory } from '../src/inventory/storage'
import { DamageEventDetails, DamageEventTargetingControl, ProcPowerSupport } from '../src/views/DamageEventControls'

const effects = { attackSpeedMultiplier: 1, damageTakenMultiplier: 1, uptimes: [], stackingGroups: [] }
const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const weapon = { weaponId: 'fighters-bindings' as const, powerLevel: 251, observedDamagePerHit: 100000 }
const scenario: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 1000000, maxHealth: 1000000, incomingDamagePerSecond: 100000, enemySupplyPerSecond: 100 }
const damage = (ids: SelectedEnchantment[], speed = 1, context = scenario) => calculateDamage(weapon, ids, { ...effects, attackSpeedMultiplier: speed }, context)
function buildFor(ids: SelectedEnchantment[], weaponId: WeaponId = 'fighters-bindings'): Build {
  const gilded = ids.find((item) => item.source === 'gilded')
  return {
    weapon: { ...weapon, weaponId, instanceId: 'proc-test', enchantmentSlots: ids.filter((item) => item.source === 'slot').map((item) => ({ candidates: [item.enchantmentId] })),
      ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}) },
    enchantments: ids, artifacts: [],
  }
}

describe('proc source tables and no extrapolation', () => {
  it.each(PROC_DAMAGE_IDS)('%s matches every source sample within explicit 0.3% tier reconstruction tolerance', (id) => {
    const definition = PROC_DAMAGE_DEFINITIONS[id]
    const entry = audit.entries.find((item) => item.id === id)!
    expect(definition.samples.value).toEqual(entry.powerScaling.publishedSamples.map(({ powerLevel, tier, damage }) => ({ powerLevel, tier, damage })))
    for (const sample of definition.samples.value) {
      const actual = interpolateProcDamage(definition.damageCurve.value, sample.powerLevel) * PROC_TIER_MULTIPLIERS[id][sample.tier]
      expect(Math.abs(actual / sample.damage - 1)).toBeLessThanOrEqual(0.003)
      if (sample.tier === 1) expect(actual).toBe(sample.damage)
      if (sample.powerLevel === 251) expect(Math.abs(actual - sample.damage)).toBeLessThanOrEqual(1)
    }
  })
  it.each(PROC_DAMAGE_IDS)('%s uses the correct tier ratios independent of weapon hit damage', (id) => {
    const values = ([1, 2, 3] as const).map((tier) => damage([selected(id, tier, 'gilded')]).damageEvents[0]!.damagePerEvent)
    expect(values[1]! / values[0]!).toBe(PROC_TIER_MULTIPLIERS[id][2])
    expect(values[2]! / values[0]!).toBe(PROC_TIER_MULTIPLIERS[id][3])
    const lowHit = calculateDamage({ ...weapon, observedDamagePerHit: 1 }, [selected(id)], effects, scenario)
    const highHit = calculateDamage({ ...weapon, observedDamagePerHit: 1e9 }, [selected(id)], effects, scenario)
    expect(lowHit.damageEvents).toEqual(highHit.damageEvents)
    expect(highHit.directWeaponSingleTargetDps).toBeGreaterThan(lowHit.directWeaponSingleTargetDps)
  })
  it('interpolates in log space, not weapon or linear damage space', () => {
    expect(interpolateProcDamage({ method: 'log-linear', points: [{ powerLevel: 10, tierOneDamage: 100 }, { powerLevel: 20, tierOneDamage: 400 }] }, 15)).toBeCloseTo(200)
  })
  it.each(PROC_DAMAGE_IDS)('%s rejects both out-of-range ends, NaN and Infinity even with observed hit damage', (id) => {
    const range = audit.entries.find((entry) => entry.id === id)!.powerScaling.supportedPowerRange
    for (const powerLevel of [range.min - 1, range.max + 1, NaN, Infinity]) {
      expect(() => calculateDamage({ ...weapon, powerLevel }, [selected(id)], effects, scenario)).toThrow(/範囲外|のみ対応/)
      expect(enchantmentUnsupportedReason({ ...weapon, powerLevel }, id)).toBeDefined()
    }
    for (const powerLevel of [range.min, range.max]) {
      expect(() => calculateDamage({ ...weapon, powerLevel }, [selected(id)], effects, scenario)).not.toThrow()
    }
  })
  it('rejects invalid curve knots instead of propagating NaN', () => {
    for (const points of [[], [{ powerLevel: 1, tierOneDamage: 1 }], [{ powerLevel: 2, tierOneDamage: 1 }, { powerLevel: 1, tierOneDamage: 2 }], [{ powerLevel: 1, tierOneDamage: 0 }, { powerLevel: 2, tierOneDamage: Infinity }]]) {
      expect(() => interpolateProcDamage({ method: 'log-linear', points }, 1)).toThrow()
    }
  })
})

describe('steady-state cadence and isolated damage channels', () => {
  it.each([
    ['fighters-bindings', 1 / 0.575], ['double-axe', 1 / 1.2], ['anchor', 0.4],
  ] as const)('%s uses actual combo durations', (id, rate) => {
    const profile = getAttackProfile(id).value
    expect(calculateComboFinisherRate(profile)).toBeCloseTo(rate, 8)
    expect(calculateComboFinisherRate(profile, 2)).toBeCloseTo(rate * 2, 8)
    for (const proc of PROC_DAMAGE_IDS) {
      const result = calculateDamage({ ...weapon, weaponId: id }, [selected(proc)], effects, scenario)
      const event = result.damageEvents[0]!
      const expectedRate = proc === 'thundering' ? calculateBaseHitsPerSecond(profile) * 0.3 : rate
      expect(event.eventsPerSecond).toBeCloseTo(expectedRate)
      const plain = calculateDamage({ ...weapon, weaponId: id }, [], effects, scenario)
      expect(result.directWeaponSingleTargetDps).toBe(plain.singleTargetDps)
      expect(result.directWeaponAoeDps).toBe(plain.aoeDps)
      expect(result.singleTargetDps).toBeGreaterThan(plain.singleTargetDps)
      expect(result.aoeDps).toBeGreaterThan(plain.aoeDps)
      expect(result.singleTargetDps).toBe(result.directWeaponSingleTargetDps + result.indirectSingleTargetDps)
      expect(result.aoeDps).toBe(result.directWeaponAoeDps + result.indirectAoeDps)
    }
  })
  it('supports measured combos and rejects a speed-only proxy', () => {
    expect(calculateComboFinisherRate({ method: 'frame-measured', hitsPerCombo: 4, framesPerSecond: 60, comboFrameSamples: [60, 60, 60, 60, 60] }, 2)).toBe(2)
    expect(() => calculateComboFinisherRate({ method: 'speed-rating-proxy', hitsPerSecond: 10 })).toThrow('unsupported attack profile')
    for (const multiplier of [0, -1, NaN, Infinity]) expect(() => calculateComboFinisherRate(getAttackProfile('anchor').value, multiplier)).toThrow()
    expect(() => calculateComboFinisherRate({ method: 'published-hit-timings', comboFinisherHit: 0, hitDurationsSeconds: [1] })).toThrow()
    expect(() => calculateDamageEvents(251, [selected('swirling')], { method: 'speed-rating-proxy', hitsPerSecond: 10 }, 1, scenario)).toThrow()
    expect(calculateDamageEvents(251, [selected('thundering')], { method: 'speed-rating-proxy', hitsPerSecond: 10 }, 1, scenario)[0]!.eventsPerSecond).toBe(3)
  })
  it('Thundering rolls only on direct hits, never on other proc events', () => {
    const single = damage([selected('thundering')]).damageEvents[0]!
    expect(single.eventsPerSecond).toBeCloseTo(2.0869565217)
    expect(damage(PROC_DAMAGE_IDS.map((id) => selected(id))).damageEvents.find((event) => event.sourceId === 'thundering')).toEqual(single)
  })
  it.each(PROC_DAMAGE_IDS)('%s doubles cadence with attack speed, including actual Mushroom effects', (id) => {
    const base = damage([selected(id)]).damageEvents[0]!
    const fast = damage([selected(id)], 2).damageEvents[0]!
    expect(fast.eventsPerSecond).toBeCloseTo(base.eventsPerSecond * 2)
    expect(fast.damagePerEvent).toBe(base.damagePerEvent)
    const build = buildFor([selected(id)])
    const mushroom = evaluate({ ...build, artifacts: [{ artifactId: 'death-cap-mushroom', instanceId: 'mushroom', powerLevel: 251 }] }, scenario)
    expect(mushroom.damage.damageEvents[0]!.eventsPerSecond).toBeCloseTo(base.eventsPerSecond * mushroom.artifactEffects.attackSpeedMultiplier)
  })
  it.each(PROC_DAMAGE_IDS)('%s never inherits any direct modifier or modifies Void cadence', (id) => {
    const base = damage([selected(id)])
    for (const modifier of ['sharpness', 'critical-hit', 'unchanting', 'void-strike'] as const) {
      const withModifier = damage([selected(id), selected(modifier)])
      expect(withModifier.damageEvents).toEqual(base.damageEvents)
      expect(withModifier.directWeaponSingleTargetDps).toBeGreaterThan(base.directWeaponSingleTargetDps)
      expect(withModifier.voidStrikeMultiplier).toBe(damage([selected(modifier)]).voidStrikeMultiplier)
    }
  })
  it('proc targeting is independent of weapon.area and changes AoE only', () => {
    const context = { ...scenario, averageTargetsInReach: 4, damageEventTargeting: { shockwave: 2, swirling: 3, thundering: 4 } }
    for (const id of PROC_DAMAGE_IDS) {
      const aoe = damage([selected(id)], 1, context)
      const base = damage([selected(id)])
      expect(aoe.indirectSingleTargetDps).toBe(base.indirectSingleTargetDps)
      expect(aoe.indirectAoeDps).toBe(aoe.indirectSingleTargetDps * context.damageEventTargeting[id])
      const anchor = calculateDamage({ ...weapon, weaponId: 'anchor' }, [selected(id)], effects, context)
      expect(anchor.damageEvents[0]!.expectedTargetsHit).toBe(context.damageEventTargeting[id])
    }
  })
})

describe('kill attribution, healing and nonlinear contribution', () => {
  it('reproduces the documented supply-capped direct/indirect example', () => {
    const result = evaluate(buildFor([selected('leeching'), selected('guarding-strike'), selected('refreshment'), selected('shockwave', 3, 'gilded')]), { ...scenario, enemySupplyPerSecond: 0.5 })
    expect(result.damage.directWeaponAoeDps).toBeCloseTo(800000)
    expect(result.damage.indirectAoeDps).toBeCloseTo(790246.9565217393)
    expect(result.combatState.directDamageShare).toBeCloseTo(0.5030665185172223)
    expect(result.combatState.directWeaponKillsPerSecond).toBeCloseTo(0.22637993333275)
    expect(result.healing.leechingPerSecond).toBeCloseTo(20374.1939999475)
    expect(result.defense.guardingStrikeUptime).toBeCloseTo(0.595668314169939)
    expect(result.potionState.effectiveCooldownSeconds).toBeCloseTo(26.799436235176426)
  })
  it('no proc retains prior metrics and direct share 1, including zero damage', () => {
    const plain = damage([])
    const state = deriveCombatState(plain, scenario)
    expect(state.directDamageShare).toBe(1)
    expect(state.indirectEstimatedKillsPerSecond).toBe(0)
    expect(state.directWeaponKillsPerSecond).toBe(state.estimatedKillsPerSecond * scenario.directKillShare)
    expect(deriveCombatState({ ...plain, aoeDps: 0, directWeaponAoeDps: 0 }, scenario).directDamageShare).toBe(1)
  })
  it.each(PROC_DAMAGE_IDS)('%s raises damage-limited total kills but not direct kills', (id) => {
    const plain = deriveCombatState(damage([]), scenario)
    const proc = deriveCombatState(damage([selected(id)]), scenario)
    expect(proc.estimatedKillsPerSecond).toBeGreaterThan(plain.estimatedKillsPerSecond)
    expect(proc.directWeaponKillsPerSecond).toBeCloseTo(plain.directWeaponKillsPerSecond)
    expect(proc.directDamageShare).toBeGreaterThan(0)
    expect(proc.directDamageShare).toBeLessThan(1)
    expect(proc.indirectEstimatedKillsPerSecond).toBeCloseTo(proc.estimatedKillsPerSecond * proc.indirectDamageShare)
  })
  it.each(PROC_DAMAGE_IDS)('%s blocks direct-kill healing/defense at the supply cap, but not Radiance', (id) => {
    const capped = { ...scenario, enemySupplyPerSecond: 0.1 }
    for (const effect of ['leeching', 'guarding-strike', 'refreshment', 'radiance'] as const) {
      const plain = evaluate(buildFor([selected(effect)]), capped)
      const proc = evaluate(buildFor([selected(effect), selected(id)]), capped)
      expect(proc.combatState.directWeaponKillsPerSecond).toBeLessThan(plain.combatState.directWeaponKillsPerSecond)
      if (effect === 'leeching') expect(proc.healing.leechingPerSecond).toBeLessThan(plain.healing.leechingPerSecond)
      if (effect === 'guarding-strike') expect(proc.defense.guardingStrikeUptime).toBeLessThan(plain.defense.guardingStrikeUptime)
      if (effect === 'refreshment') expect(proc.potionState.effectiveCooldownSeconds).toBeGreaterThan(plain.potionState.effectiveCooldownSeconds)
      if (effect === 'radiance') expect(proc.healing.radiancePerSecond).toBe(plain.healing.radiancePerSecond)
      const contribution = proc.contributions.find((item) => item.sourceId === id)!
      expect(contribution.singleTargetDpsDelta).toBeCloseTo(proc.damage.indirectSingleTargetDps)
      expect(contribution.aoeDpsDelta).toBeCloseTo(proc.damage.indirectAoeDps)
      expect(contribution.objectiveDelta).toBeCloseTo(proc.objectiveScore - plain.objectiveScore)
      if (effect === 'leeching' || effect === 'refreshment') expect(contribution.healingPerSecondDelta).toBeLessThan(0)
    }
  })
  it('adds proc Evidence only to builds using a proc', () => {
    const plain = evaluate(buildFor([selected('radiance')]), scenario)
    expect(plain.confidence.factors.some((factor) => factor.id.startsWith('proc-') || factor.id === 'damage-channel-kill-attribution')).toBe(false)
    const proc = evaluate(buildFor([selected('radiance'), selected('swirling'), selected('void-strike')]), scenario)
    for (const id of ['proc-power-swirling', 'proc-targeting-swirling', 'proc-attribution-swirling', 'proc-target-contact', 'damage-channel-kill-attribution', 'proc-void-swirling']) {
      expect(proc.confidence.factors.find((factor) => factor.id === id)?.confidence).toBe('low')
    }
    expect(proc.reasons.some((reason) => reason.includes('コンボ終了') && reason.includes('間接damage'))).toBe(true)
    expect(proc.confidence.caveats.some((reason) => reason.includes('partial'))).toBe(true)
  })
})

describe('input boundaries, storage and UI', () => {
  it.each(Object.values(SCENARIO_PROFILES))('$profileId defaults all proc targeting to generic 1', (profile) => {
    expect(profile.damageEventTargeting).toEqual({ shockwave: 1, swirling: 1, thundering: 1 })
    expect(() => validateScenario(profile)).not.toThrow()
  })
  it.each(PROC_DAMAGE_IDS)('%s rejects missing, nonfinite and out-of-bound target assumptions', (id) => {
    for (const value of [0, 0.9, NaN, Infinity, -1, scenario.averageTargetsInReach + 0.1, undefined]) {
      const invalid = { ...scenario, damageEventTargeting: { ...scenario.damageEventTargeting, [id]: value } } as Scenario
      expect(() => validateScenario(invalid)).toThrow()
      expect(() => damage([selected(id)], 1, invalid)).toThrow()
    }
  })
  it.each(PROC_DAMAGE_IDS)('%s preserves slots, locks, gilded tiers and localStorage', (id) => {
    for (const tier of [1, 2, 3] as const) {
      const build = buildFor([selected('radiance'), selected(id, tier, 'gilded')])
      const inventory: Inventory = { weapons: [{ ...build.weapon, enchantmentSlots: [{ candidates: ['radiance', id], locked: 'radiance' }] }], artifacts: [] }
      const restored = deserializeInventory(serializeInventory(inventory))
      expect(restored).toEqual(inventory)
      const memory = new Map<string, string>()
      vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key), setItem: (key: string, value: string) => memory.set(key, value) })
      try { saveInventory(inventory); expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory) } finally { vi.unstubAllGlobals() }
      const result = optimize(restored, scenario)
      expect(result.best.build.enchantments.at(-1)).toEqual(selected(id, tier, 'gilded'))
      expect(result.best.damage.damageEvents[0]!.damagePerEvent).toBe(damage([selected(id, tier)]).damageEvents[0]!.damagePerEvent)
    }
    for (const source of ['slot', 'gilded'] as const) expect(() => evaluate(buildFor([selected(id), selected(id, 3, source)]), scenario)).toThrow('最大1')
  })
  it('filters unsupported free choices explicitly, rejects unsupported locks/gilded/empty choices', () => {
    const base = buildFor([selected('radiance')]).weapon
    const mixed = { ...base, powerLevel: 200, enchantmentSlots: [{ candidates: ['radiance', 'shockwave'] as EnchantmentId[] }] }
    const result = optimize({ weapons: [mixed], artifacts: [] }, scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices[0]).toContain('210–252')
    expect(result.best.build.enchantments.map((item) => item.enchantmentId)).toEqual(['radiance'])
    for (const weapon of [
      { ...mixed, enchantmentSlots: [{ candidates: ['shockwave'] as EnchantmentId[] }] },
      { ...mixed, enchantmentSlots: [{ candidates: ['shockwave', 'radiance'] as EnchantmentId[], locked: 'shockwave' as const }] },
      { ...mixed, gilded: { enchantmentId: 'shockwave' as const, tier: 1 as const } },
    ]) expect(() => optimize({ weapons: [weapon], artifacts: [] }, scenario)).toThrow(/対応|評価可能/)
    const build = buildFor([selected('shockwave')])
    expect(() => evaluate({ ...build, weapon: { ...build.weapon, powerLevel: 200 } }, scenario)).toThrow('210–252')
    expect(deserializeInventory(serializeInventory({ weapons: [mixed], artifacts: [] })).weapons[0]).toEqual(mixed)
  })
  it('renders range limits, adjustable targeting and direct/indirect result details', () => {
    const onChange = vi.fn()
    const control = DamageEventTargetingControl({ value: scenario.damageEventTargeting, maximum: 3, onChange })
    expect(renderToStaticMarkup(control)).toContain('全種の初期値1体')
    const labels = control.props.children[2]
    labels[0].props.children[1].props.onChange({ target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({ shockwave: 2, swirling: 1, thundering: 1 })
    expect(renderToStaticMarkup(ProcPowerSupport({ weapon: { ...buildFor([selected('radiance')]).weapon, powerLevel: 200 } }))).toContain('現在のPowerは未対応')
    const evaluation = evaluate(buildFor([selected('swirling')]), scenario)
    const markup = renderToStaticMarkup(DamageEventDetails({ evaluation }))
    expect(markup).toContain('直接／間接')
    expect(markup).toContain('Swirling Tier 3')
    expect(markup).toContain('damage/event')
    expect(DamageEventDetails({ evaluation: evaluate(buildFor([selected('radiance')]), scenario) })).toBeNull()
  })
})
