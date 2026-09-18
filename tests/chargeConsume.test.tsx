import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import legacy from './fixtures/charge-legacy-baseline.json'
import audit from '../research/charge-consume-enchantment-audit.json'
import { calculatePainCycle, calculateDynamo, dynamoDamagePerStack, finiteAttackCadence } from '../src/core/chargeConsume'
import { calculateDamage } from '../src/core/damage'
import { calculateArtifactEffects } from '../src/core/artifact'
import { evaluate, evaluateCandidate } from '../src/core/evaluate'
import { calculateParetoFrontier, optimize } from '../src/core/optimizer'
import { enchantmentCombinationUnsupportedReason, enchantmentUnsupportedReason } from '../src/core/damageEvents'
import { validateScenario } from '../src/core/validation'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { CHARGE_UNVERIFIED_MODIFIERS, CHARGE_WEAPONS, DYNAMO_DAMAGE_POINTS } from '../src/data/chargeConsume'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { ChargeConsumeControls, ChargeConsumeDetails } from '../src/views/ChargeConsumeDetails'
import type { Build, EnchantmentId, Scenario, SelectedEnchantment } from '../src/core/types'

const selected = (enchantmentId: EnchantmentId): SelectedEnchantment => ({ enchantmentId, tier: 3, source: 'slot' })
function buildFor(ids: EnchantmentId[], weaponId: Build['weapon']['weaponId'] = 'double-axe'): Build {
  return { weapon: { instanceId: 'charge', weaponId, powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: ids.map((id) => ({ candidates: [id] })) }, enchantments: ids.map(selected), artifacts: [] }
}
const settings: Scenario = { ...DEFAULT_SCENARIO, maxHealth: 100, encounterDurationSeconds: 3.6, averageEnemyHealth: 1e8, enemySupplyPerSecond: 100, directKillShare: 1, averageTargetsInReach: 1 }
const damageFor = (ids: EnchantmentId[], scenario = settings) => calculateDamage(buildFor(ids).weapon, ids.map(selected), calculateArtifactEffects([], scenario), scenario)
const dynamoFor = (hps: number, rolls: number, initial = 0, duration = 1000) => calculateDynamo(finiteAttackCadence([1 / hps], 1, duration), duration, rolls, initial, dynamoDamagePerStack(251, 3))

describe('Pain Cycle finite charge → ready → consume', () => {
  it.each([1, 2, 3] as const)('six B100 attacks Tier%s: 800/900/1000', (tier) => {
    const state = calculatePainCycle(6, tier, 100, 100, 6)
    expect(state.finiteTotalDamage).toBe([800, 900, 1000][tier - 1])
    expect(state.selfDamage).toBe(15)
    expect(state.finiteTotalDamage / 600).toBeCloseTo([4 / 3, 1.5, 5 / 3][tier - 1]!)
  })
  it.each([[0, 0, 0, 0], [1, 1, 0, 1], [5, 5, 0, 5], [6, 5, 1, 0], [7, 6, 1, 1], [11, 10, 1, 5], [12, 10, 2, 0]])('N%s: C%s E%s unused%s', (n, charging, empowered, unused) => {
    expect(calculatePainCycle(n, 3, 100, 100, 10)).toMatchObject({ totalAttackActions: n, chargingAttacks: charging, empoweredAttacks: empowered, unusedStacksAtEncounterEnd: unused, selfDamage: 3 * charging, bonusDamage: empowered * 400, endPhase: unused === 5 ? 'ready' : 'charging' })
  })
  it('five attacks leave paid health and ready stacks, never an empowered fifth', () => {
    const state = damageFor(['pain-cycle'], { ...settings, encounterDurationSeconds: 3 }).painCycleState!
    expect(state).toMatchObject({ totalAttackActions: 5, empoweredAttacks: 0, unusedStacksAtEncounterEnd: 5, selfDamage: 15, directDps: 0 })
    expect(damageFor(['pain-cycle']).painCycleState).toMatchObject({ totalAttackActions: 6, empoweredAttacks: 1, unusedStacksAtEncounterEnd: 0, selfDamage: 15 })
    expect(damageFor(['pain-cycle'], { ...settings, encounterDurationSeconds: 4.2 }).painCycleState!.selfDamage).toBe(18)
  })
  it.each(CHARGE_WEAPONS)('%s uses one action per profile hit, never one per target', (weaponId) => {
    const build = buildFor(['pain-cycle'], weaponId)
    const one = evaluate(build, settings)
    const many = evaluate(build, { ...settings, averageTargetsInReach: 6 })
    expect(many.damage.painCycleState).toEqual(one.damage.painCycleState)
    expect(many.damage.directWeaponAoeDps).toBeCloseTo(many.damage.directWeaponSingleTargetDps * many.damage.expectedTargetsHit)
  })
  it('Death Cap and Rampaging increase empowered and self-damage rates', () => {
    const build = buildFor(['pain-cycle'])
    const scenario = { ...settings, encounterDurationSeconds: 60, averageEnemyHealth: 10 }
    const base = evaluate(build, scenario)
    const mushroom = { instanceId: 'mushroom', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 }
    const fast = evaluate({ ...build, artifacts: [mushroom] }, scenario)
    const rampaging = evaluate(buildFor(['pain-cycle', 'rampaging']), scenario)
    for (const result of [fast, rampaging]) {
      expect(result.damage.painCycleState!.empoweredAttacksPerSecond).toBeGreaterThan(base.damage.painCycleState!.empoweredAttacksPerSecond)
      expect(result.healing.selfDamagePerSecond).toBeGreaterThan(base.healing.selfDamagePerSecond)
    }
  })
  it('gross healing minus full cost affects objective and Pareto, including zero healing', () => {
    const scenario = { ...settings, encounterDurationSeconds: 3 }
    const base = evaluate(buildFor(['stunning']), scenario)
    const pain = evaluate(buildFor(['stunning', 'pain-cycle']), scenario)
    expect(pain.damage.singleTargetDps).toBe(base.damage.singleTargetDps)
    expect(pain.healing).toMatchObject({ grossHealingCapacityPerSecond: 0, selfDamagePerSecond: 5, netSustainPerSecond: -5, totalPerSecond: -5 })
    expect(pain.utilities.healing).toBeLessThan(0)
    expect(pain.objectiveScore).toBeLessThan(base.objectiveScore)
    expect(calculateParetoFrontier([pain, base])).toEqual([base])
    const result = evaluate(buildFor(['radiance', 'pain-cycle']), scenario)
    expect(result.healing.netSustainPerSecond).toBe(result.healing.grossHealingCapacityPerSecond - result.healing.selfDamagePerSecond)
    expect(result.contributions.find((item) => item.sourceId === 'pain-cycle')).toMatchObject({ selfDamagePerSecondDelta: 5, netSustainPerSecondDelta: -5, healingPerSecondDelta: -5 })
  })
  it('enemy defenses never mitigate Pain self damage', () => {
    const plain = evaluate(buildFor(['pain-cycle']), settings)
    const defended = evaluate({ ...buildFor(['pain-cycle', 'guarding-strike', 'weakening']), artifacts: [{ instanceId: 'iron', artifactId: 'iron-hide-amulet', powerLevel: 251 }] }, settings)
    expect(defended.healing.selfDamagePerSecond).toBe(plain.healing.selfDamagePerSecond)
    expect(defended.defense.damageTakenMultiplier).toBeLessThan(plain.defense.damageTakenMultiplier)
  })
})

describe('bounded periodic cadence and Dynamo independent curves', () => {
  it('counts t=0 through exclusive endpoint and rejects invalid or unsafe cadences', () => {
    expect(finiteAttackCadence([1], 1, 0).totalAttackActions).toBe(0)
    expect(finiteAttackCadence([1], 1, 5).totalAttackActions).toBe(5)
    expect(finiteAttackCadence([0.6, 0.6], 1, 3.6).totalAttackActions).toBe(6)
    expect(finiteAttackCadence([1], 1, 0.00001).totalAttackActions).toBe(1)
    for (const intervals of [[], [0], [-1], [NaN], [Infinity]]) expect(() => finiteAttackCadence(intervals, 1, 3)).toThrow()
    expect(() => finiteAttackCadence([1], 1, 1e30)).toThrow()
    expect(() => calculatePainCycle(1.5, 3, 100, 100, 10)).toThrow()
  })
  it('matches a small event oracle for mixed timings, counts, capped flow and tail', () => {
    for (const intervals of [[0.48, 0.56], [0.15, 0.15, 0.15, 0.125], [0.6, 0.6], [2.5]]) {
      for (const speed of [1, 1.5, 2.3]) for (const duration of [0.01, 1, 3.6, 30]) for (const rolls of [0, 0.5, 50]) {
        let time = 0, count = 0, balance = 7, consumed = 0, overflow = 0
        while (time < duration - 1e-10) {
          consumed += balance
          const gap = Math.min(intervals[count % intervals.length]! / speed, duration - time)
          balance = Math.min(20, rolls * gap)
          overflow += Math.max(0, rolls * gap - 20)
          time += gap
          count++
        }
        const cadence = finiteAttackCadence(intervals, speed, duration)
        const result = calculateDynamo(cadence, duration, rolls, 7, 100)
        expect(cadence.totalAttackActions).toBe(count)
        expect(result.totalConsumedStacks).toBeCloseTo(consumed, 8)
        expect(result.overflowStacks).toBeCloseTo(overflow, 8)
        expect(result.unusedStacksAtEncounterEnd).toBeCloseTo(balance, 8)
        expect(result.totalConsumedStacks + result.overflowStacks + result.unusedStacksAtEncounterEnd).toBeCloseTo(7 + rolls * duration, 8)
      }
    }
  })
  it.each(DYNAMO_DAMAGE_POINTS)('Power $powerLevel: all exact tier knots', (point) => {
    for (const tier of [1, 2, 3] as const) expect(dynamoDamagePerStack(point.powerLevel, tier)).toBe(point.damage[tier - 1])
  })
  it('keeps public table and runtime knots identical; UI ratios are not numeric ratios', () => {
    expect(DYNAMO_DAMAGE_POINTS).toEqual(audit.entries.find((entry) => entry.id === 'dynamo')!.numericSamples)
    expect(dynamoDamagePerStack(251, 2)).not.toBe(dynamoDamagePerStack(251, 1) * 1.25)
    expect(dynamoDamagePerStack(251, 3)).not.toBe(dynamoDamagePerStack(251, 1) * 1.5)
    for (const tier of [1, 2, 3] as const) expect(dynamoDamagePerStack(250, tier)).toBeCloseTo(Math.sqrt(dynamoDamagePerStack(249, tier) * dynamoDamagePerStack(251, tier)), 6)
  })
  it.each([209, 264, NaN, Infinity])('Power%s is rejected without extrapolation', (power) => expect(() => dynamoDamagePerStack(power, 3)).toThrow())
  it('consumes initial20 on first attack with no invented rolls or weapon scaling', () => {
    expect(dynamoFor(2, 0, 20)).toMatchObject({ totalConsumedStacks: 20, firstAttackBonusDamage: 8407820, bonusDamage: 8407820 })
    expect(20 * dynamoDamagePerStack(263, 3)).toBe(13203960)
    for (const power of [210, 263]) expect(enchantmentUnsupportedReason({ powerLevel: power, weaponId: 'anchor' }, 'dynamo')).toBeUndefined()
    const scenario = { ...settings, dynamoInitialStacks: 20 }
    const base = damageFor(['dynamo'], scenario)
    const weapon = { ...buildFor(['dynamo']).weapon, observedDamagePerHit: 1 }
    expect(calculateDamage(weapon, [selected('dynamo')], calculateArtifactEffects([], scenario), scenario).dynamoState).toEqual(base.dynamoState)
  })
  it('default zero is supported zero, not unsupported or a hidden positive roll rate', () => {
    for (const scenario of Object.values(SCENARIO_PROFILES)) {
      expect(scenario.rollsPerSecond).toBe(0)
      expect(scenario.dynamoInitialStacks).toBe(0)
      expect(evaluate(buildFor(['dynamo']), scenario).damage.dynamoState!.bonusDamage).toBe(0)
    }
  })
  it('roll1/s attack2/s consumes about1/s and .5/attack without charging the first hit', () => {
    expect(dynamoFor(2, 1)).toMatchObject({ sustainedConsumedStacksPerSecond: 1, firstAttackBonusDamage: 0, totalConsumedStacks: 999.5 })
    expect(dynamoFor(2, 1).averageStacksPerAttack).toBeCloseTo(0.5, 3)
  })
  it('roll5/s attack.1/s saturates at20/attack and overflows at least3/s', () => {
    const result = dynamoFor(0.1, 5)
    expect(result.consumptionCapacityPerSecond).toBe(2)
    expect(result.sustainedConsumedStacksPerSecond).toBe(2)
    expect(result.overflowStacksPerSecond).toBeGreaterThanOrEqual(3)
    expect(result.averageStacksPerAttack).toBeLessThanOrEqual(20)
    expect(dynamoFor(0.1, 5, 20).averageStacksPerAttack).toBe(20)
  })
  it('faster attacks decrease stacks per attack without exceeding roll income', () => {
    const slow = dynamoFor(1, 0.5)
    const fast = dynamoFor(2, 0.5)
    expect(fast.averageStacksPerAttack).toBeLessThan(slow.averageStacksPerAttack)
    expect(fast.totalConsumedStacks).toBeLessThanOrEqual(500)
    expect(fast.sustainedConsumedStacksPerSecond).toBe(slow.sustainedConsumedStacksPerSecond)
  })
})

describe('integration and rejection boundaries', () => {
  it.each(['pain-cycle', 'dynamo'] as const)('%s: all gilded tiers survive persistence and reach evaluation', (id) => {
    for (const tier of [1, 2, 3] as const) {
      const base = buildFor(['radiance'])
      const build: Build = { ...base, weapon: { ...base.weapon, gilded: { enchantmentId: id, tier } }, enchantments: [...base.enchantments, { enchantmentId: id, tier, source: 'gilded' }] }
      const inventory = { weapons: [build.weapon], artifacts: [] }
      expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
      const result = optimize(inventory, { ...settings, dynamoInitialStacks: 20 }).best
      if (id === 'pain-cycle') expect(result.damage.painCycleState!.finiteTotalDamage).toBe([800, 900, 1000][tier - 1])
      else expect(result.damage.dynamoState!.firstAttackBonusDamage).toBe([191087, 305739, 420391][tier - 1]! * 20)
    }
  })
  it('rejects null external inputs but accepts omitted legacy inputs', () => {
    expect(() => validateScenario({ ...settings, rollsPerSecond: null } as unknown as Scenario)).toThrow(/rollsPerSecond/)
    expect(() => validateScenario({ ...settings, dynamoInitialStacks: null } as unknown as Scenario)).toThrow(/dynamoInitialStacks/)
    expect(() => validateScenario({ ...settings, rollsPerSecond: undefined, dynamoInitialStacks: undefined })).not.toThrow()
  })
  it.each(['pain-cycle', 'dynamo'] as const)('%s: every uncertain pair rejects, independent indirect formulas stay unchanged', (id) => {
    for (const modifier of [...CHARGE_UNVERIFIED_MODIFIERS, id === 'pain-cycle' ? 'dynamo' : 'pain-cycle'] as EnchantmentId[]) {
      expect(enchantmentCombinationUnsupportedReason([selected(id), selected(modifier)])).toContain('未対応')
      expect(() => evaluate(buildFor([id, modifier]), settings)).toThrow(/Evidence/)
    }
    for (const indirect of ['shockwave', 'swirling', 'thundering', 'fire-aspect', 'poison-cloud'] as const) {
      const base = damageFor([indirect])
      const charged = damageFor([indirect, id], { ...settings, rollsPerSecond: 1 })
      expect(charged.damageEvents).toEqual(base.damageEvents)
      expect(charged.dotDamageEvents).toEqual(base.dotDamageEvents)
      expect(charged.indirectAoeDps).toBe(base.indirectAoeDps)
    }
  })
  it.each(['pain-cycle', 'dynamo'] as const)('%s: normal+gilded non-stackable and inventory roundtrip', (id) => {
    const base = buildFor([id])
    expect(ENCHANTMENTS[id].stacking.value).toEqual({ maxCopies: 1, behavior: 'non-stackable' })
    const duplicate: Build = { ...base, weapon: { ...base.weapon, gilded: { enchantmentId: id, tier: 3 } }, enchantments: [...base.enchantments, { enchantmentId: id, tier: 3, source: 'gilded' }] }
    expect(() => evaluate(duplicate, settings)).toThrow(/最大1個/)
    const inventory = { weapons: [base.weapon], artifacts: [] }
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
    const core = evaluateCandidate(base, settings)
    const full = evaluate(base, settings)
    expect(core.objectiveScore).toBe(full.objectiveScore)
    expect(core).not.toHaveProperty('contributions')
    expect(core).not.toHaveProperty('confidence')
  })
  it.each([-1, NaN, Infinity])('invalid roll%s rejects', (rollsPerSecond) => expect(() => validateScenario({ ...settings, rollsPerSecond })).toThrow(/rollsPerSecond/))
  it.each([-1, 0.1, 21, NaN, Infinity])('invalid initial%s rejects', (dynamoInitialStacks) => expect(() => validateScenario({ ...settings, dynamoInitialStacks })).toThrow(/dynamoInitialStacks/))
  it('filters free out-of-range choices, rejects locked/gilded and all-unsupported combinations', () => {
    const weapon = { ...buildFor(['radiance']).weapon, powerLevel: 209, enchantmentSlots: [{ candidates: ['dynamo', 'radiance'] as EnchantmentId[] }] }
    const result = optimize({ weapons: [weapon], artifacts: [] }, settings)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join()).toContain('210–263')
    expect(() => optimize({ weapons: [{ ...weapon, enchantmentSlots: [{ ...weapon.enchantmentSlots[0]!, selected: { enchantmentId: 'dynamo', tier: 3 as const } }] }], artifacts: [] }, settings)).toThrow(/210–263/)
    expect(() => optimize({ weapons: [{ ...weapon, gilded: { enchantmentId: 'dynamo', tier: 3 } }], artifacts: [] }, settings)).toThrow(/210–263/)
    expect(() => optimize({ weapons: [buildFor(['pain-cycle', 'dynamo']).weapon], artifacts: [] }, settings)).toThrow(/Evidence/)
    const mixed = { ...buildFor(['pain-cycle', 'radiance']).weapon, enchantmentSlots: [{ candidates: ['pain-cycle', 'critical-hit'] as EnchantmentId[] }, { candidates: ['critical-hit', 'radiance'] as EnchantmentId[] }] }
    expect(optimize({ weapons: [mixed], artifacts: [] }, settings).unsupportedChoices.join()).toContain('Evidence')
  })
  it('Dynamo enters direct/AoE and direct-kill downstream systems; does not inflate Control', () => {
    const scenario = { ...settings, encounterDurationSeconds: 30, rollsPerSecond: 1, averageTargetsInReach: 4 }
    const base = evaluate(buildFor(['dynamo', 'leeching', 'guarding-strike']), { ...scenario, rollsPerSecond: 0 })
    const result = evaluate(base.build, scenario)
    expect(result.damage.indirectAoeDps).toBe(0)
    expect(result.damage.directWeaponSingleTargetDps - base.damage.directWeaponSingleTargetDps).toBeCloseTo(result.damage.dynamoState!.directDps)
    expect(result.damage.directWeaponAoeDps - base.damage.directWeaponAoeDps).toBeCloseTo(result.damage.dynamoState!.directDps * result.damage.expectedTargetsHit)
    expect(result.combatState.directWeaponKillsPerSecond).toBeGreaterThan(base.combatState.directWeaponKillsPerSecond)
    expect(result.healing.leechingPerSecond).toBeGreaterThan(base.healing.leechingPerSecond)
    expect(result.defense.guardingStrikeUptime).toBeGreaterThan(base.defense.guardingStrikeUptime)
    expect(result.control).toEqual(base.control)
    const refresh = evaluate(buildFor(['dynamo', 'refreshment', 'exploding']), scenario)
    const noRoll = evaluate(refresh.build, { ...scenario, rollsPerSecond: 0 })
    expect(refresh.potionState.effectiveCooldownSeconds).toBeLessThan(noRoll.potionState.effectiveCooldownSeconds)
    expect(refresh.damage.explosionAoeDps).toBeGreaterThan(noRoll.damage.explosionAoeDps)
    expect(refresh.damage.explosionDamageEvents[0]!.damagePerSecondaryTarget).toBe(noRoll.damage.explosionDamageEvents[0]!.damagePerSecondaryTarget)
    const ramp = evaluate(buildFor(['dynamo', 'rampaging']), scenario)
    expect(ramp.temporalState.rampaging.uptime).toBeGreaterThan(evaluate(ramp.build, { ...scenario, rollsPerSecond: 0 }).temporalState.rampaging.uptime)
  })
  it('UI displays separate gross/cost/net and default external roll controls', () => {
    const result = evaluate(buildFor(['pain-cycle', 'radiance']), settings)
    const html = renderToStaticMarkup(<ChargeConsumeDetails evaluation={result} />)
    for (const label of ['Gross healing', 'Pain Cycle self damage', 'Net sustain', '6回目', 'HP消費なし']) expect(html).toContain(label)
    expect(renderToStaticMarkup(<ChargeConsumeDetails evaluation={evaluate(buildFor(['radiance']), settings)} />)).toBe('')
    const onChange = vi.fn()
    const controls = ChargeConsumeControls({ scenario: DEFAULT_SCENARIO, onChange })
    const inputs = controls.props.children.filter((child: { type?: string }) => child?.type === 'label').map((label: { props: { children: { props: { onChange: (event: unknown) => void } }[] } }) => label.props.children[1])
    inputs[0].props.onChange({ target: { value: '0.5' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SCENARIO, rollsPerSecond: 0.5 })
    inputs[1].props.onChange({ target: { value: '20' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SCENARIO, dynamoInitialStacks: 20 })
    const controlsHtml = renderToStaticMarkup(controls)
    for (const label of ['平均ロール回数/秒', 'Dynamo開始stack', '上限寄り', 'value="0"']) expect(controlsHtml).toContain(label)
  })
})

describe('exact full-output regression against c24f377 (not game evidence)', () => {
  it.each(legacy.cases)('$name: all legacy metrics, confidence, reasons and contributions unchanged', (fixture) => {
    const result = evaluate(fixture.build as Build, fixture.scenario as Scenario)
    const { grossHealingCapacityPerSecond, selfDamagePerSecond, netSustainPerSecond, ...healing } = result.healing
    expect(selfDamagePerSecond).toBe(0)
    expect(grossHealingCapacityPerSecond).toBe(healing.totalPerSecond)
    expect(netSustainPerSecond).toBe(healing.totalPerSecond)
    const contributions = result.contributions.map((contribution) => {
      const { selfDamagePerSecondDelta, netSustainPerSecondDelta, ...old } = contribution
      expect(selfDamagePerSecondDelta).toBe(0)
      expect(netSustainPerSecondDelta).toBe(old.healingPerSecondDelta)
      return old
    })
    expect({ ...result, healing, contributions }).toEqual(fixture.expected)
    expect(result.confidence.factors.some((factor) => /^(pain-|dynamo-|charge-)/.test(factor.id))).toBe(false)
  })
})
