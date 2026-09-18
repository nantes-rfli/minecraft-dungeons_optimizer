import { afterEach, describe, expect, it, vi } from 'vitest'
import audit from '../research/soul-subsystem-audit.json'
import melee from '../research/melee-enchantment-audit.json'
import profiles from '../research/melee-attack-profile-audit.json'
import { animaHealingCapacity, deriveSoulState, evaluate, optimize, siphonIncome, simulateSoulResourceSchedule, soulIncome, soulTrajectory } from '../src/core'
import type { Build, EnchantmentId, EnchantmentTier, Scenario, SelectedEnchantment, WeaponId } from '../src/core'
import { calculateArtifactActivationState, calculateArtifactEffects, calculateSoulArtifactActivationOpportunities } from '../src/core/artifact'
import * as catalog from '../src/core/catalog'
import { calculateDamage } from '../src/core/damage'
import { solveUnitIntervalFixedPoint } from '../src/core/fixedPoint'
import { resolveOffensiveSteadyState } from '../src/core/offensiveSteadyState'
import { soulEnchantmentUnsupportedReason } from '../src/core/soulLegality'
import { temporaryBuffUptime } from '../src/core/temporalEnchantments'
import { validateBuild, validateScenario } from '../src/core/validation'
import { ARTIFACTS } from '../src/data/artifacts'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { SOUL_ENCHANTMENT_METADATA } from '../src/data/souls'
import { WEAPONS } from '../src/data/weapons'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'

const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const scenario: Scenario = { ...DEFAULT_SCENARIO, maxHealth: 100, averageEnemyHealth: 100, enemySupplyPerSecond: 100, directKillShare: 1, averageTargetsInReach: 1, encounterDurationSeconds: 30 }
function buildFor(enchantments = [selected('soul-siphon'), selected('anima-conduit'), selected('rampaging')], weaponId: WeaponId = 'soul-scythe'): Build {
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return { weapon: { instanceId: 'soul-test', weaponId, powerLevel: 251, observedDamagePerHit: 26,
    enchantmentSlots: enchantments.filter((item) => item.source === 'slot').map((item) => ({ candidates: [item.enchantmentId] })),
    ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}),
  }, enchantments, artifacts: [] }
}
const run = (enchantments?: SelectedEnchantment[], settings = scenario) => evaluate(buildFor(enchantments), settings)
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Soul gear promotion and legality', () => {
  it('promotes exactly one strict-ready common soul weapon and preserves source coefficients', () => {
    expect(Object.values(WEAPONS).filter((weapon) => weapon.soul.acceptsSoulEnchantments).map((weapon) => weapon.id)).toEqual(['soul-scythe'])
    const profile = profiles.weapons.find((weapon) => weapon.weaponId === 'soul-scythe')!
    expect(profile.status).toBe('exact')
    expect(profile.specialHandlingRequired).toBe(false)
    expect(profile.damageProfile?.hitDamageRatios).toEqual([1, 1])
    expect(ATTACK_PROFILES['soul-scythe'].value).toMatchObject({ hitDurationsSeconds: profile.attackProfile?.hitDurationsSeconds, comboFinisherHit: 2 })
    expect(WEAPONS['soul-scythe'].internalPowerRating.value).toBe(6.915)
    expect(WEAPONS['soul-scythe'].soul.baseSoulGathering.value).toBe(1)
    const build = buildFor([selected('critical-hit')])
    const result = evaluate({ ...build, weapon: { ...build.weapon, observedDamagePerHit: undefined } }, scenario)
    expect(result.damage.damagePerHit).toBe(Math.round(1_792_941 * 6.915 / 14))
  })
  it.each(['fighters-bindings', 'double-axe', 'anchor'] as const)('rejects all soul enchants on %s at every input boundary', (weaponId) => {
    for (const id of ['anima-conduit', 'soul-siphon', 'enigma-resonator']) {
      expect(soulEnchantmentUnsupportedReason(weaponId, id)).toContain('Soul gear限定')
      for (const source of ['slot', 'gilded'] as const) {
        const build = buildFor([selected('critical-hit'), selected(id as EnchantmentId, 3, source)], weaponId)
        const inventory = { weapons: [build.weapon], artifacts: [] }
        expect(() => evaluate(build, scenario)).toThrow()
        expect(() => optimize(inventory, scenario)).toThrow()
        expect(() => deserializeInventory(serializeInventory(inventory))).toThrow()
        expect(() => saveInventory(inventory)).toThrow()
      }
    }
  })
  it('rejects illegal unselected candidates and locked slots instead of silently dropping them', () => {
    const build = buildFor([selected('critical-hit')], 'anchor')
    for (const slot of [{ candidates: ['critical-hit', 'soul-siphon'] as EnchantmentId[] }, { candidates: ['critical-hit', 'soul-siphon'] as EnchantmentId[], selected: { enchantmentId: 'soul-siphon' as const, tier: 3 as const } }]) {
      const weapon = { ...build.weapon, enchantmentSlots: [slot] }
      expect(() => validateBuild({ ...build, weapon })).toThrow('Soul gear限定')
      expect(() => optimize({ weapons: [weapon], artifacts: [] }, scenario)).toThrow('Soul gear限定')
    }
  })
  it.each(['anima-conduit', 'soul-siphon'] as const)('%s survives legal normal/gilded JSON, storage and optimizer paths', (id) => {
    for (const source of ['slot', 'gilded'] as const) {
      const build = buildFor([selected('critical-hit'), selected(id, 3, source)])
      const inventory = { weapons: [build.weapon], artifacts: [] }
      expect(() => validateBuild(build)).not.toThrow()
      expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
      const storage = new Map<string, string>()
      vi.stubGlobal('localStorage', { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) })
      saveInventory(inventory)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory)
      expect(optimize(inventory, scenario).best.soulState?.enchantmentSoulGathering).toBe(1)
      expect(() => validateBuild(buildFor([selected(id), selected(id, 3, 'gilded')]))).toThrow('最大1個')
    }
  })
  it('keeps Enigma research-only even on legal Soul gear', () => {
    expect(soulEnchantmentUnsupportedReason('soul-scythe', 'enigma-resonator')).toContain('research-only')
    expect(Object.keys(ENCHANTMENTS)).not.toContain('enigma-resonator')
    const build = buildFor([selected('enigma-resonator' as EnchantmentId)])
    expect(() => evaluate(build, scenario)).toThrow('research-only')
    expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, scenario)).toThrow('research-only')
    expect(deserializeInventory(serializeInventory({ weapons: [build.weapon], artifacts: [] })).weapons[0]?.enchantmentSlots[0]?.candidates).toEqual(['enigma-resonator'])
    expect(audit.entries.find((entry) => entry.id === 'enigma-resonator')?.blockers.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Soul income and encounter trajectory', () => {
  const consumer = { instanceId: 'soul-artifact', artifactId: 'death-cap-mushroom' as const, costPerUse: 50, effectiveCooldownSeconds: 5 }
  it('schedules finite continuous income and discrete spending against independent golden times', () => {
    const runSchedule = (initialSouls: number, incomeUnitsPerSecond: number) => simulateSoulResourceSchedule({ durationSeconds: 30, initialSouls, capacity: 300, incomeUnitsPerSecond, consumers: [consumer] })
    expect(runSchedule(0, 0).consumers[0]).toMatchObject({ realizedUses: 0, cooldownLimitedUses: 7, missedForInsufficientSouls: 7, useTimesSeconds: [] })
    expect(runSchedule(100, 0).consumers[0]).toMatchObject({ realizedUses: 2, spentSoulUnits: 100, useTimesSeconds: [0, 5] })
    expect(runSchedule(0, 10).consumers[0]!.useTimesSeconds[0]).toBe(5)
    expect(runSchedule(0, 100).consumers[0]).toMatchObject({ realizedUses: 6, cooldownLimitedUses: 7 })
    expect(runSchedule(0, 5).consumers[0]).toMatchObject({ realizedUses: 3, resourceLimitedUses: 3 })
  })
  it('integrates average Souls across fill plateaus, reports overflow, and conserves resources', () => {
    const schedule = simulateSoulResourceSchedule({ durationSeconds: 10, initialSouls: 250, capacity: 300, incomeUnitsPerSecond: 20, consumers: [] })
    expect(schedule.endSouls).toBe(300)
    expect(schedule.overflowUnits).toBe(150)
    expect(schedule.averageSouls).toBeCloseTo((250 + 300) / 2 * 2.5 / 10 + 300 * 7.5 / 10)
    expect(schedule.initialSouls + schedule.totalIncomeUnits).toBeCloseTo(schedule.endSouls + schedule.totalSpentUnits + schedule.overflowUnits)
  })
  it('rejects implicit shared-pool priority and invalid resource bounds', () => {
    expect(() => simulateSoulResourceSchedule({ durationSeconds: 30, initialSouls: 0, capacity: 300, incomeUnitsPerSecond: 10, consumers: [consumer, { ...consumer, instanceId: 'second' }] })).toThrow(/priority/)
    for (const initialSouls of [-1, 301, NaN, Infinity]) expect(() => simulateSoulResourceSchedule({ durationSeconds: 30, initialSouls, capacity: 300, incomeUnitsPerSecond: 10, consumers: [] })).toThrow()
  })
  it('feeds Artifact Synergy only realized Soul Artifact uses, never cooldown capacity', () => {
    const empty = simulateSoulResourceSchedule({ durationSeconds: 30, initialSouls: 0, capacity: 300, incomeUnitsPerSecond: 0, consumers: [consumer] })
    const activation = calculateArtifactActivationState(calculateSoulArtifactActivationOpportunities(empty))
    expect(activation.totalActivationsPerSecond).toBe(0)
    expect(activation.activations[0]).toMatchObject({
      activationsPerSecond: 0,
      cooldownLimitedActivationsPerSecond: 0.2,
      resourceLimitedActivationsPerSecond: 0,
    })
  })
  it('creates SoulState on a non-Soul weapon from synthetic Artifact Gathering without multiplying pickups', () => {
    const plainBuild = buildFor([selected('critical-hit')], 'fighters-bindings')
    const plain = evaluate(plainBuild, scenario)
    const base = ARTIFACTS['death-cap-mushroom']
    vi.spyOn(catalog, 'getArtifactDefinition').mockReturnValue({
      ...base,
      use: { kind: 'soul-spending', cooldownStarts: 'use', soulGathering: { ...base.cooldownSeconds, value: 1 }, cost: { ...base.cooldownSeconds, value: 50 } },
    } as unknown as ReturnType<typeof catalog.getArtifactDefinition>)
    const build = { ...plainBuild, artifacts: [{ instanceId: 'synthetic-soul', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 }] }
    const state = deriveSoulState(build, plain.damage, plain.combatState, scenario)!
    expect(state.baseSoulGathering).toBe(0)
    expect(state.artifactSoulGathering).toBe(1)
    expect(state.totalSoulGathering).toBe(1)
    expect(state.totalPickupEventsPerSecond).toBe(state.normalPickupEventsPerSecond)
    expect(state.totalResourceUnitsPerSecond).toBe(state.totalPickupEventsPerSecond)
    expect(state.schedule?.consumers[0]?.artifactId).toBe('death-cap-mushroom')
  })
  it('validates editable initial Soul bounds while legacy omission still means zero', () => {
    expect(() => validateScenario({ ...scenario, initialSoulUnits: undefined })).not.toThrow()
    for (const initialSoulUnits of [-1, 301, NaN, Infinity]) expect(() => validateScenario({ ...scenario, initialSoulUnits })).toThrow(/initialSoulUnits/)
  })
  it('matches zero, partial, exact-full and early-full golden trajectories', () => {
    expect(soulTrajectory(0, 300, 30)).toEqual({ encounterAverageSoulFraction: 0, endSoulFraction: 0 })
    expect(soulTrajectory(10, 300, 10)).toEqual({ fillTimeSeconds: 30, endSoulFraction: 1 / 3, encounterAverageSoulFraction: 1 / 6 })
    expect(soulTrajectory(30, 300, 30)).toEqual({ fillTimeSeconds: 10, endSoulFraction: 1, encounterAverageSoulFraction: 5 / 6 })
    expect(soulTrajectory(30, 300, 10).encounterAverageSoulFraction).toBe(0.5)
    expect(soulTrajectory(10, 600, 10).endSoulFraction).toBe(1 / 6)
  })
  it('rejects invalid and overflowing inputs explicitly', () => {
    for (const bad of [-1, NaN, Infinity]) {
      expect(() => soulTrajectory(bad, 300, 10)).toThrow()
      expect(() => soulIncome(1, bad)).toThrow()
      expect(() => animaHealingCapacity(bad, 100, 0.06)).toThrow()
    }
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(() => soulTrajectory(1, bad, 10)).toThrow()
      expect(() => soulTrajectory(1, 300, bad)).toThrow()
    }
    expect(() => soulIncome(Number.MAX_VALUE, 2)).toThrow()
    expect(() => soulTrajectory(Number.MIN_VALUE, 300, 10)).toThrow()
    expect(() => animaHealingCapacity(100, Number.MAX_VALUE, 0.06)).toThrow()
    expect(() => siphonIncome(1, { kind: 'on-hit-soul-generation', triggerChance: 2, extraPickupCount: 5 }, 1)).toThrow()
  })
  it.each([1, 2, 3] as const)('Siphon Tier %s uses 20%, distinct pickups, and gathering resource multiplier', (tier) => {
    const effect = SOUL_ENCHANTMENT_METADATA['soul-siphon'].tiers.value[tier]
    const income = siphonIncome(5, effect, 5)
    expect(income.procEventsPerSecond).toBe(1)
    expect(income.pickupEventsPerSecond).toBe([1, 3, 5][tier - 1])
    expect(income.resourceUnitsPerSecond).toBe(income.pickupEventsPerSecond * 5)
    expect(siphonIncome(10, effect, 5).pickupEventsPerSecond).toBe(income.pickupEventsPerSecond * 2)
  })
  it('does not multiply Siphon rolls by AoE targets and counts indirect kills for normal income', () => {
    const single = run([selected('soul-siphon')])
    const aoe = run([selected('soul-siphon'), selected('thundering')], { ...scenario, averageTargetsInReach: 8, directKillShare: 0 })
    expect(aoe.soulState?.siphonProcEventsPerSecond).toBe(single.soulState?.siphonProcEventsPerSecond)
    expect(aoe.combatState.directWeaponKillsPerSecond).toBe(0)
    expect(aoe.soulState?.normalPickupEventsPerSecond).toBe(aoe.combatState.estimatedKillsPerSecond)
    expect(aoe.soulState!.normalPickupEventsPerSecond).toBeGreaterThan(0)
  })
  it('Siphon can generate income with no kills; no Siphon and no kills leaves meter empty', () => {
    const noKills = { ...scenario, enemySupplyPerSecond: 0 }
    expect(run([selected('anima-conduit')], noKills).soulState?.endSoulFraction).toBe(0)
    expect(run([selected('soul-siphon')], noKills).soulState!.endSoulFraction).toBeGreaterThan(0)
  })
})

describe('Anima healing capacity, not resource or actual healing', () => {
  it.each([1, 2, 3] as const)('melee Tier %s scales with max HP and pickup events only', (tier) => {
    const effect = SOUL_ENCHANTMENT_METADATA['anima-conduit'].tiers.value[tier]
    expect(effect.maxHealthFractionPerPickup).toBe([0.02, 0.04, 0.06][tier - 1])
    expect(animaHealingCapacity(10, 100, effect.maxHealthFractionPerPickup)).toBe(20 * tier)
    const build = buildFor([selected('soul-siphon'), selected('anima-conduit', tier, 'gilded')])
    const result = evaluate(build, scenario)
    expect(result.healing.animaHealingCapacityPerSecond).toBeCloseTo(result.soulState!.totalPickupEventsPerSecond * 100 * effect.maxHealthFractionPerPickup)
    expect(evaluate(build, { ...scenario, maxHealth: 200 }).healing.animaHealingCapacityPerSecond).toBeCloseTo(result.healing.animaHealingCapacityPerSecond * 2)
  })
  it('five pickups heal nominal 30% max HP, even when they carry 25 resources', () => {
    const income = siphonIncome(5, SOUL_ENCHANTMENT_METADATA['soul-siphon'].tiers.value[3], 5)
    expect(income).toEqual({ pickupEventsPerSecond: 5, resourceUnitsPerSecond: 25, procEventsPerSecond: 1 })
    expect(animaHealingCapacity(income.pickupEventsPerSecond, 100, 0.06)).toBe(30)
    expect(animaHealingCapacity(soulIncome(10, 10).pickupEventsPerSecond, 100, 0.06)).toBe(60)
  })
  it('explicitly keeps nominal capacity at full meter and warns about timing/overheal', () => {
    const short = run(undefined, { ...scenario, encounterDurationSeconds: 1 })
    const long = run(undefined, { ...scenario, encounterDurationSeconds: 10000 })
    expect(short.soulState!.endSoulFraction).toBeLessThan(1)
    expect(long.soulState!.endSoulFraction).toBe(1)
    expect(long.healing.animaHealingCapacityPerSecond).toBe(short.healing.animaHealingCapacityPerSecond)
    expect(long.confidence.caveats.join(' ')).toMatch(/満タン.*実回復.*吸収遅延.*overheal/)
  })
})

describe('resolved offensive integration and evidence scope', () => {
  it('shares converged Rampaging speed/HPS/kills with Siphon, SoulState and Anima', () => {
    const result = run()
    const state = result.soulState!
    const rampaging = result.temporalState.rampaging
    expect(result.damage.hitsPerSecond).toBeCloseTo(2 / 1.04 * result.temporalState.attackSpeedMultiplier)
    expect(state.siphonProcEventsPerSecond).toBeCloseTo(result.damage.hitsPerSecond * 0.2)
    expect(state.totalSoulGathering).toBe(3)
    expect(state.totalResourceUnitsPerSecond).toBeCloseTo(state.totalPickupEventsPerSecond * 3)
    expect(state.normalPickupEventsPerSecond).toBe(result.combatState.estimatedKillsPerSecond)
    expect(state.encounterAverageSoulFraction).toBe(soulTrajectory(state.totalResourceUnitsPerSecond, 300, 30).encounterAverageSoulFraction)
    expect(rampaging.iterations).toBeGreaterThan(1)
    expect(rampaging.residual).toBeLessThanOrEqual(1e-8)
    expect(rampaging.uptime).toBeCloseTo(temporaryBuffUptime(result.combatState.directWeaponKillsPerSecond * 0.1, 15), 7)
    expect(result.healing.totalPerSecond).toBe(result.healing.animaHealingCapacityPerSecond)
    expect(result.reasons.join(' ')).toContain(state.siphonProcEventsPerSecond.toFixed(3))
  })
  it.each(['critical-hit', 'committed', 'artifact-synergy', 'rampaging'] as const)('removal of %s recalculates Soul and healing contribution', (id) => {
    const build = buildFor([selected('anima-conduit'), selected('soul-siphon'), selected(id)])
    const withArtifacts = { ...build, artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 }] }
    const result = evaluate(withArtifacts, scenario)
    const reduced = { ...withArtifacts, enchantments: build.enchantments.slice(0, 2) }
    const effects = calculateArtifactEffects(reduced.artifacts, scenario)
    const without = resolveOffensiveSteadyState(reduced, scenario, effects)
    const contribution = result.contributions.find((item) => item.sourceId === id)!
    expect(contribution.singleTargetDpsDelta).toBeCloseTo(result.damage.singleTargetDps - without.damage.singleTargetDps)
    expect(contribution.healingPerSecondDelta).toBeCloseTo(result.healing.animaHealingCapacityPerSecond - animaHealingCapacity(without.soulState!.totalPickupEventsPerSecond, 100, 0.06))
  })
  it('Siphon alone reports income without invented utility; interactions produce real modeled capacity', () => {
    const alone = run([selected('soul-siphon')])
    expect(alone.contributions[0]?.objectiveDelta).toBe(0)
    expect(run().contributions.find((item) => item.sourceId === 'soul-siphon')!.healingPerSecondDelta).toBeGreaterThan(0)
  })
  it('retains no-iteration path, unchanged proc damage, and scopes low-confidence factors', () => {
    const plain = evaluate(buildFor([selected('critical-hit')], 'anchor'), scenario)
    expect(plain.soulState).toBeUndefined()
    expect(plain.temporalState.rampaging.iterations).toBe(0)
    expect(plain.confidence.factors.some((factor) => factor.id.startsWith('soul-') || factor.id.startsWith('anima-'))).toBe(false)
    expect(run([selected('soul-siphon')]).temporalState.rampaging.iterations).toBe(0)
    const build = buildFor([selected('soul-siphon'), selected('anima-conduit'), selected('shockwave')])
    const effects = calculateArtifactEffects([], scenario)
    expect(calculateDamage(build.weapon, build.enchantments, effects, scenario).damageEvents).toEqual(calculateDamage(build.weapon, [selected('shockwave')], effects, scenario).damageEvents)
    expect(() => solveUnitIntervalFixedPoint((value) => ({ nextValue: 1 - value, result: 0 }), { maxIterations: 2 })).toThrow('did not converge')
  })
  it('keeps typed effects, metadata and audit in agreement', () => {
    for (const id of ['anima-conduit', 'soul-siphon'] as const) {
      const entry = audit.entries.find((item) => item.id === id)!
      expect(melee.entries.find((item) => item.id === id)?.runtimeStatus).toBe('implemented')
      expect(ENCHANTMENTS[id].soul?.soulGearOnly).toBe(true)
      expect(ENCHANTMENTS[id].stacking.value).toEqual(entry.stacking)
      for (const tier of [1, 2, 3] as const) {
        const effect = ENCHANTMENTS[id].tiers.value[tier].effect!
        expect(effect.kind === 'soul-pickup-healing' ? effect.maxHealthFractionPerPickup : effect.kind === 'on-hit-soul-generation' ? effect.extraPickupCount : undefined).toBe(entry.tiers[tier - 1])
      }
    }
  })
})
