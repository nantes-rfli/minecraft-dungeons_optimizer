import { afterEach, describe, expect, it, vi } from 'vitest'
import audit from '../research/temporal-enchantment-audit.json'
import meleeAudit from '../research/melee-enchantment-audit.json'
import { evaluate, optimize } from '../src/core'
import type { Build, EnchantmentId, EnchantmentTier, Inventory, Scenario, SelectedEnchantment } from '../src/core'
import { calculateArtifactActivationState, calculateArtifactEffects } from '../src/core/artifact'
import { solveUnitIntervalFixedPoint } from '../src/core/fixedPoint'
import { combineRampagingEffects, deriveArtifactSynergyState, temporaryBuffUptime } from '../src/core/temporalEnchantments'
import { validateBuild } from '../src/core/validation'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'

const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const scenario: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 100, enemySupplyPerSecond: 100, directKillShare: 1, averageTargetsInReach: 1 }
const mushroom = { instanceId: 'mushroom', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 }
const amulet = { instanceId: 'amulet', artifactId: 'iron-hide-amulet' as const, powerLevel: 251 }
function buildFor(enchantments: SelectedEnchantment[], artifacts: Build['artifacts'] = []): Build {
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return { weapon: {
    instanceId: 'temporal', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 30,
    enchantmentSlots: enchantments.filter((item) => item.source === 'slot').map((item) => ({ candidates: [item.enchantmentId] })),
    ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}),
  }, enchantments, artifacts }
}
const run = (enchantments: SelectedEnchantment[], artifacts: Build['artifacts'] = [], settings = scenario) => evaluate(buildFor(enchantments, artifacts), settings)

describe('temporal audit and source/runtime boundary', () => {
  it.each(['artifact-synergy', 'rampaging'] as const)('%s keeps all tier values and stacking consistent with both audits', (id) => {
    const entry = audit.entries.find((item) => item.id === id)!
    const melee = meleeAudit.entries.find((item) => item.id === id)!
    expect(entry.runtimeStatus).toBe('implemented')
    expect(melee.runtimeStatus).toBe('implemented')
    expect(ENCHANTMENTS[id].stacking.value).toEqual(entry.stacking)
    expect(melee.stacking).toEqual(entry.stacking)
    for (const tier of [1, 2, 3] as const) {
      const effect = ENCHANTMENTS[id].tiers.value[tier].effect!
      const values = melee.tierValues[tier].interpreted as Record<string, unknown>
      expect(effect).toEqual(id === 'artifact-synergy'
        ? { kind: 'artifact-next-attack-damage', bonus: entry.tiers[tier - 1] }
        : { kind: 'on-direct-kill-attack-speed', triggerChance: 0.1, attackSpeedBonus: 0.5, durationSeconds: entry.tiers[tier - 1] })
      expect(entry.tiers[tier - 1]).toBe(values[id === 'artifact-synergy' ? 'nextAttackDamageBonus' : 'durationSeconds'])
    }
  })
  it('keeps Echo entirely unsupported, including Void/Shockwave combinations and JSON import', () => {
    const echo = audit.entries.find((item) => item.id === 'echo')!
    expect(echo.tiers).toEqual([5, 4, 3])
    expect(echo.stacking).toEqual({ maxCopies: 1, behavior: 'non-stackable' })
    expect(echo.runtimeStatus).toBe('needs-state-model')
    expect(echo.blockers.length).toBeGreaterThanOrEqual(7)
    expect(Object.keys(ENCHANTMENTS)).not.toContain('echo')
    for (const companion of ['void-strike', 'shockwave'] as const) {
      const build = buildFor([selected('echo' as EnchantmentId), selected(companion)])
      expect(() => evaluate(build, scenario)).toThrow()
      expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, scenario)).toThrow()
      const restored = deserializeInventory(serializeInventory({ weapons: [build.weapon], artifacts: [] }))
      expect(restored.weapons[0]?.enchantmentSlots.flatMap((slot) => slot.candidates)).toContain('echo')
      expect(() => optimize(restored, scenario)).toThrow()
    }
  })
})

describe('Artifact Synergy activation rather than duration', () => {
  it.each([1, 2, 3] as const)('Tier %s without an artifact has no charge, bonus or contribution', (tier) => {
    const result = run([selected('radiance'), selected('artifact-synergy', tier, 'gilded')])
    expect(result.temporalState.artifactActivation.totalActivationsPerSecond).toBe(0)
    expect(result.temporalState.artifactSynergy).toMatchObject({ chargedAttacksPerSecond: 0, chargedAttackShare: 0, expectedDirectMultiplier: 1 })
    expect(result.contributions.find((item) => item.sourceId === 'artifact-synergy')).toMatchObject({ objectiveDelta: 0, singleTargetDpsDelta: 0, aoeDpsDelta: 0 })
    expect(result.reasons.join(' ')).toContain('Artifact未装備')
  })
  it('sums every instance at 1/effective CD, even with saturated duration uptime', () => {
    const effects = calculateArtifactEffects([mushroom, { ...mushroom, instanceId: 'second' }], scenario)
    const first = calculateArtifactActivationState(effects.uptimes.slice(0, 1))
    const all = calculateArtifactActivationState(effects.uptimes)
    expect(all.totalActivationsPerSecond).toBe(2 * first.totalActivationsPerSecond)
    expect(all.activations).toHaveLength(2)
    const twenty = calculateArtifactActivationState([{ ...effects.uptimes[0]!, effectiveCooldownSeconds: 20 }])
    expect(twenty.totalActivationsPerSecond).toBe(0.05)
    const changedDuration = calculateArtifactActivationState(effects.uptimes.map((item) => ({ ...item, durationSeconds: 1000, uptime: 1 })))
    expect(changedDuration).toEqual(all)
  })
  it.each([1, 2, 3] as const)('Tier %s saturates at one bonus per eligible attack and handles no attacks', (tier) => {
    const activation = { totalActivationsPerSecond: 10, activations: [] }
    const result = deriveArtifactSynergyState([selected('artifact-synergy', tier)], activation, 0.2)
    expect(result.chargedAttacksPerSecond).toBe(0.2)
    expect(result.chargedAttackShare).toBe(1)
    expect(result.expectedDirectMultiplier).toBe(1 + [0.4, 0.6, 0.8][tier - 1]!)
    expect(deriveArtifactSynergyState([selected('artifact-synergy')], activation, 0).expectedDirectMultiplier).toBe(1)
  })
  it('A=.12, H=1, Tier III gives 12% charged and 1.096x direct', () => {
    expect(deriveArtifactSynergyState([selected('artifact-synergy')], { totalActivationsPerSecond: 0.12, activations: [] }, 1)).toMatchObject({ chargedAttackShare: 0.12, expectedDirectMultiplier: 1.096 })
  })
  it('cooldown reduction increases contribution; extra AoE targets do not consume more charges', () => {
    const normal = run([selected('artifact-synergy')], [amulet])
    const reduced = run([selected('artifact-synergy')], [amulet], { ...scenario, cooldownReduction: 0.5 })
    expect(reduced.temporalState.artifactActivation.totalActivationsPerSecond).toBe(2 * normal.temporalState.artifactActivation.totalActivationsPerSecond)
    expect(reduced.contributions.find((x) => x.sourceId === 'artifact-synergy')!.singleTargetDpsDelta).toBeGreaterThan(normal.contributions.find((x) => x.sourceId === 'artifact-synergy')!.singleTargetDpsDelta)
    const aoe = run([selected('artifact-synergy')], [amulet], { ...scenario, averageTargetsInReach: 8 })
    expect(aoe.temporalState.artifactSynergy).toEqual(normal.temporalState.artifactSynergy)
  })
  it.each(['fighters-bindings', 'double-axe', 'anchor'] as const)('%s uses per-hit opportunities, not combo or target rate', (weaponId) => {
    const build = buildFor([selected('artifact-synergy')], [amulet])
    const result = evaluate({ ...build, weapon: { ...build.weapon, weaponId } }, scenario)
    expect(result.temporalState.artifactSynergy.eligibleDirectAttacksPerSecond).toBe(result.damage.hitsPerSecond)
    expect(result.temporalState.artifactSynergy.chargedAttacksPerSecond).toBe(result.temporalState.artifactActivation.totalActivationsPerSecond)
  })
  it.each(['shockwave', 'swirling', 'thundering'] as const)('does not amplify %s; integrates before Committed and recalculates removal', (proc) => {
    const baseline = run([selected(proc), selected('committed')], [amulet])
    const result = run([selected(proc), selected('committed'), selected('artifact-synergy')], [amulet])
    expect(result.damage.damageEvents).toEqual(baseline.damage.damageEvents)
    expect(result.damage.preCommittedDirectWeaponSingleTargetDps).toBeCloseTo(baseline.damage.preCommittedDirectWeaponSingleTargetDps * result.temporalState.artifactSynergy.expectedDirectMultiplier, 10)
    expect(result.damage.committedSingleTargetMultiplier).not.toBe(baseline.damage.committedSingleTargetMultiplier)
    const contribution = result.contributions.find((x) => x.sourceId === 'artifact-synergy')!
    expect(contribution.singleTargetDpsDelta).toBeCloseTo(result.damage.singleTargetDps - baseline.damage.singleTargetDps, 10)
    const withoutArtifact = run([selected(proc), selected('committed'), selected('artifact-synergy')])
    expect(result.contributions.find((x) => x.sourceId === 'iron-hide-amulet')!.singleTargetDpsDelta).toBeCloseTo(result.damage.singleTargetDps - withoutArtifact.damage.singleTargetDps)
  })
})

describe('Rampaging Poisson uptime and feedback', () => {
  it('matches the one direct kill/s golden and adds duration without chance or magnitude stacking', () => {
    expect(temporaryBuffUptime(0.1, 15)).toBeCloseTo(0.7768698398515702, 12)
    expect(temporaryBuffUptime(0, 15)).toBe(0)
    for (const tiers of [[3, 3], [3, 2], [1, 2, 3, 3]] as const) {
      const effect = combineRampagingEffects(tiers.map((tier, index) => selected('rampaging', tier, index === 3 ? 'gilded' : 'slot')))!
      expect(effect.durationSeconds).toBe(tiers.reduce((sum, tier) => sum + tier * 5, 0))
      expect(effect.triggerChance).toBe(0.1)
      expect(effect.attackSpeedBonus).toBe(0.5)
    }
  })
  it('no kills mean zero proc, uptime, speed bonus and contribution', () => {
    for (const settings of [{ ...scenario, enemySupplyPerSecond: 0 }, { ...scenario, directKillShare: 0 }]) {
      const result = run([selected('rampaging')], [], settings)
      expect(result.temporalState.rampaging).toMatchObject({ triggerEventsPerSecond: 0, uptime: 0, averageAttackSpeedBonus: 0, iterations: 1 })
      expect(result.temporalState.attackSpeedMultiplier).toBe(1)
      expect(result.contributions[0]!.singleTargetDpsDelta).toBe(0)
    }
  })
  it('solves genuine feedback, not one pass, with a deterministic numerical golden', () => {
    const result = run([selected('rampaging')])
    const state = result.temporalState.rampaging
    // Baseline 30 damage / .6 seconds = 50 DPS, k=.5. Solve u=1-exp(-.75*(1+.5u)).
    expect(state.firstIterationUptime).toBeCloseTo(0.5276334472589853, 12)
    expect(state.uptime).toBeCloseTo(0.6265435284214822, 8)
    expect(state.uptime).toBeGreaterThan(state.firstIterationUptime + 0.09)
    expect(state.uptime).toBeCloseTo(temporaryBuffUptime(state.triggerEventsPerSecond, 15), 8)
    expect(result.damage.singleTargetDps).toBeCloseTo(50 * (1 + 0.5 * state.uptime), 12)
    expect(result.temporalState.attackSpeedMultiplier).toBe(1 + 0.5 * state.uptime)
    expect(state.iterations).toBeGreaterThan(2)
    expect(state.iterations).toBeLessThanOrEqual(100)
    expect(state.residual).toBeLessThanOrEqual(1e-8)
    expect(run([selected('rampaging')])).toEqual(result)
    expect(run([selected('radiance')]).temporalState.rampaging.iterations).toBe(0)
  })
  it('enemy supply caps feedback and proc kills do not get added to its trigger', () => {
    const settings = { ...scenario, enemySupplyPerSecond: 0.1 }
    const direct = run([selected('rampaging')], [], settings)
    const proc = run([selected('rampaging'), selected('shockwave')], [], settings)
    expect(proc.combatState.estimatedKillsPerSecond).toBe(0.1)
    expect(proc.combatState.directDamageShare).toBeLessThan(direct.combatState.directDamageShare)
    expect(proc.temporalState.rampaging.triggerEventsPerSecond).toBeCloseTo(0.1 * proc.combatState.directWeaponKillsPerSecond, 12)
    expect(proc.temporalState.rampaging.uptime).toBeLessThan(direct.temporalState.rampaging.uptime)
    expect(proc.temporalState.rampaging.triggerEventsPerSecond).toBeLessThan(0.01)
  })
  it('adds +0.5*u alongside Death Cap, giving smaller relative gain at equal capped kills', () => {
    const settings = { ...scenario, averageEnemyHealth: 1, enemySupplyPerSecond: 1 }
    const plain = run([selected('rampaging')], [], settings)
    const shroom = run([selected('rampaging')], [mushroom], settings)
    expect(shroom.temporalState.rampaging.uptime).toBe(plain.temporalState.rampaging.uptime)
    expect(shroom.temporalState.attackSpeedMultiplier).toBe(shroom.artifactEffects.attackSpeedMultiplier + 0.5 * shroom.temporalState.rampaging.uptime)
    const relativeGain = (result: ReturnType<typeof run>) => result.damage.singleTargetDps / run([selected('radiance')], result.build.artifacts, settings).damage.singleTargetDps - 1
    expect(relativeGain(shroom)).toBeLessThan(relativeGain(plain))
  })
  it.each(['fighters-bindings', 'double-axe', 'anchor'] as const)('%s feeds final speed into Void and on-hit healing', (weaponId) => {
    const original = buildFor([selected('void-strike'), selected('radiance')])
    const build = { ...original, weapon: { ...original.weapon, weaponId } }
    const baseline = evaluate(build, scenario)
    const enhanced = buildFor([...build.enchantments, selected('rampaging')])
    const result = evaluate({ ...enhanced, weapon: { ...enhanced.weapon, weaponId } }, scenario)
    expect(result.damage.hitsPerSecond).toBeGreaterThan(baseline.damage.hitsPerSecond)
    expect(result.damage.voidStrikeMultiplier).toBeLessThan(baseline.damage.voidStrikeMultiplier)
    expect(result.healing.radiancePerSecond).toBeGreaterThan(baseline.healing.radiancePerSecond)
  })
  it.each(['leeching', 'guarding-strike', 'refreshment', 'artifact-synergy', 'shockwave', 'swirling', 'thundering', 'committed'] as const)('removal fully recalculates %s and contribution', (id) => {
    const settings = { ...scenario, averageEnemyHealth: 1e6 }
    const before = run([selected(id)], [amulet], settings)
    const after = run([selected(id), selected('rampaging')], [amulet], settings)
    const delta = after.contributions.find((item) => item.sourceId === 'rampaging')!
    expect(delta.singleTargetDpsDelta).toBeCloseTo(after.damage.singleTargetDps - before.damage.singleTargetDps, 10)
    expect(delta.healingPerSecondDelta).toBeCloseTo(after.healing.totalPerSecond - before.healing.totalPerSecond, 10)
    expect(delta.effectiveHealthDelta).toBeCloseTo(after.defense.effectiveHealth - before.defense.effectiveHealth, 10)
    if (['shockwave', 'swirling', 'thundering'].includes(id)) {
      expect(after.damage.damageEvents[0]!.damagePerEvent).toBe(before.damage.damageEvents[0]!.damagePerEvent)
      expect(after.damage.damageEvents[0]!.eventsPerSecond).toBeGreaterThan(before.damage.damageEvents[0]!.eventsPerSecond)
    }
    if (id === 'artifact-synergy') expect(after.temporalState.artifactSynergy.chargedAttackShare).toBeLessThan(before.temporalState.artifactSynergy.chargedAttackShare)
    if (id === 'leeching') expect(after.healing.leechingPerSecond).toBeGreaterThan(before.healing.leechingPerSecond)
    if (id === 'guarding-strike') expect(after.defense.guardingStrikeUptime).toBeGreaterThan(before.defense.guardingStrikeUptime)
    if (id === 'refreshment') expect(after.potionState.effectiveCooldownSeconds).toBeLessThan(before.potionState.effectiveCooldownSeconds)
  })
})

describe('bounded solver and numeric failure handling', () => {
  it('rejects oscillation and explicit iteration exhaustion without fallback', () => {
    expect(() => solveUnitIntervalFixedPoint((value) => ({ nextValue: 1 - value, result: null }))).toThrow('did not converge after 100')
    expect(() => solveUnitIntervalFixedPoint(() => ({ nextValue: 0.5, result: null }), { maxIterations: 1 })).toThrow('did not converge')
  })
  it.each([NaN, Infinity, -Infinity, -1, 1.01])('rejects invalid fixed point %s', (bad) => {
    expect(() => solveUnitIntervalFixedPoint(() => ({ nextValue: bad, result: null }))).toThrow('finite and in [0, 1]')
  })
  it.each([0, -1, NaN, Infinity])('rejects invalid convergence tolerance/limit %s', (bad) => {
    expect(() => solveUnitIntervalFixedPoint(() => ({ nextValue: 0, result: null }), { tolerance: bad })).toThrow('Invalid fixed-point')
    expect(() => solveUnitIntervalFixedPoint(() => ({ nextValue: 0, result: null }), { maxIterations: bad })).toThrow('Invalid fixed-point')
  })
  it.each([-1, NaN, Infinity])('rejects invalid temporal rates %s', (bad) => {
    expect(() => temporaryBuffUptime(bad, 15)).toThrow()
    expect(() => temporaryBuffUptime(0.1, bad)).toThrow()
    expect(() => deriveArtifactSynergyState([], { totalActivationsPerSecond: bad, activations: [] }, 1)).toThrow()
    expect(() => deriveArtifactSynergyState([], { totalActivationsPerSecond: 1, activations: [] }, bad)).toThrow()
    expect(() => calculateArtifactActivationState([{ instanceId: 'bad', artifactId: 'iron-hide-amulet', effectiveCooldownSeconds: bad }])).toThrow()
  })
  it('rejects zero CD and numeric overflow', () => {
    expect(() => calculateArtifactActivationState([{ instanceId: 'bad', artifactId: 'iron-hide-amulet', effectiveCooldownSeconds: 0 }])).toThrow()
    expect(() => temporaryBuffUptime(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow('finite numeric range')
  })
})

describe('inventory, optimizer, confidence and copy boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each(['artifact-synergy', 'rampaging'] as const)('%s supports free/locked/gilded tiers and storage', (id) => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    for (const tier of [1, 2, 3] as const) {
      const build = buildFor([selected('sharpness'), selected(id, tier, 'gilded')], [amulet])
      const inventory: Inventory = { weapons: [build.weapon], artifacts: build.artifacts }
      expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
      saveInventory(inventory)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory)
      expect(optimize(inventory, scenario).best.build.enchantments).toContainEqual(selected(id, tier, 'gilded'))
      const weapon = { ...build.weapon, gilded: undefined, enchantmentSlots: [{ candidates: [id, 'sharpness'] as EnchantmentId[], locked: id }] }
      expect(optimize({ ...inventory, weapons: [weapon] }, scenario).best.build.enchantments[0]!.enchantmentId).toBe(id)
      const free = { ...weapon, enchantmentSlots: [{ candidates: [id, 'sharpness'] as EnchantmentId[] }] }
      expect(optimize({ weapons: [free], artifacts: [] }, scenario).evaluatedBuildCount).toBe(2)
    }
  })
  it('rejects Synergy normal/gilded duplicates, allows four duration-only Rampaging copies', () => {
    const invalid = buildFor([selected('artifact-synergy'), selected('artifact-synergy', 1, 'gilded')])
    expect(() => validateBuild(invalid)).toThrow('最大1個')
    expect(() => optimize({ weapons: [invalid.weapon], artifacts: [] }, scenario)).toThrow('stacking制約')
    const copies = [selected('rampaging'), selected('rampaging'), selected('rampaging'), selected('rampaging', 2, 'gilded')]
    const result = run(copies)
    expect(result.temporalState.rampaging.effectiveDurationSeconds).toBe(55)
    expect(result.temporalState.rampaging.activeAttackSpeedBonus).toBe(0.5)
    expect(combineRampagingEffects([...copies].reverse())).toEqual(combineRampagingEffects(copies))
    expect(optimize({ weapons: [result.build.weapon], artifacts: [] }, scenario).best.temporalState.rampaging.effectiveDurationSeconds).toBe(55)
  })
  it('attaches temporal model assumptions only when used', () => {
    for (const id of ['radiance', 'artifact-synergy', 'rampaging'] as const) {
      const result = run([selected(id)])
      const factors = new Map(result.confidence.factors.map((item) => [item.id, item.confidence]))
      expect(factors.has('artifact-use-rate-model')).toBe(id === 'artifact-synergy')
      expect(factors.has('rampaging-uptime-model')).toBe(id === 'rampaging')
      if (id === 'artifact-synergy') {
        expect(factors.get('artifact-synergy-trigger')).toBe('high')
        expect(factors.get('artifact-synergy-pending-charge')).toBe('low')
        expect(factors.get('artifact-synergy-direct-composition')).toBe('low')
      }
      if (id === 'rampaging') {
        expect(factors.get('rampaging-fixed-point')).toBe('high')
        expect(factors.get('rampaging-uptime-model')).toBe('low')
        expect(factors.get('direct-kill-share')).toBe('low')
      }
    }
  })
})
