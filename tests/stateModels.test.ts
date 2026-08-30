import { afterEach, describe, expect, it, vi } from 'vitest'
import audit from '../research/melee-enchantment-audit.json'
import { derivePotionState, evaluate, optimize } from '../src/core'
import { calculateArtifactEffects } from '../src/core/artifact'
import { calculateDamage } from '../src/core/damage'
import { calculateDefense } from '../src/core/defense'
import { hasValidEnchantmentStacking } from '../src/core/enchantment'
import { validateBuild, validateScenario } from '../src/core/validation'
import type { Build, CombatState, EnchantmentId, EnchantmentTier, Inventory, Scenario, SelectedEnchantment } from '../src/core'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { WEAKENING_APPLICATION, WEAKENING_DURATION } from '../src/data/enemyDebuffs'
import { HEALTH_POTION_BASE_COOLDOWN, HEALTH_POTION_HEAL_FRACTION, REFRESHMENT_COOLDOWN_RATE_MODEL, REFRESHMENT_DIRECT_KILL_CONDITION } from '../src/data/potions'
import { DEFAULT_SCENARIO, DEFAULT_SCENARIO_EVIDENCE, SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'

const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const effects = { attackSpeedMultiplier: 1, damageTakenMultiplier: 1, uptimes: [], stackingGroups: [] }
const directKills = (rate: number): CombatState => ({ effectiveDamagePerSecond: 100, damageLimitedKillsPerSecond: 10, estimatedKillsPerSecond: 10, directWeaponKillsPerSecond: rate })
const withShare = (share: number): Scenario => ({ ...DEFAULT_SCENARIO, enemyDebuffs: { weakeningAffectedIncomingDamageShare: share } })
const uncapped: Scenario = { ...DEFAULT_SCENARIO, enemySupplyPerSecond: 100, averageEnemyHealth: 1000, directKillShare: 1 }

function buildFor(enchantments: SelectedEnchantment[]): Build {
  const slots = enchantments.filter((item) => item.source === 'slot')
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return {
    weapon: {
      instanceId: 'state-test', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100,
      enchantmentSlots: slots.map((item) => ({ candidates: [item.enchantmentId] })),
      ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}),
    },
    enchantments, artifacts: [],
  }
}

describe('source-backed state effects', () => {
  it.each(['refreshment', 'weakening'] as const)('%s preserves audit tiers, applicability and chosen stacking', (id) => {
    const entry = audit.entries.find((item) => item.id === id)!
    const definition = ENCHANTMENTS[id]
    expect(entry.runtimeStatus).toBe('implemented')
    expect(definition.stacking.value).toEqual(entry.stacking)
    expect(definition.applicability?.value).toEqual(entry.applicability)
    expect(definition.tiers.source.url).toBe(entry.sources[0]!.url)
    expect(definition.tiers.confidence).toBe('high')
    for (const tier of [1, 2, 3] as const) {
      const values = entry.tierValues[tier].interpreted as Record<string, unknown>
      expect(definition.tiers.value[tier].effect).toEqual(id === 'refreshment'
        ? { kind: 'potion-cooldown-on-direct-kill', potionCooldownReductionSeconds: values.potionCooldownReductionSecondsPerKill }
        : { kind: 'enemy-damage-debuff', enemyDamageReduction: values.enemyDamageReduction, durationSeconds: values.durationSeconds })
    }
  })

  it('keeps Weakening stacking source conflict explicit instead of claiming high-confidence game-file agreement', () => {
    const entry = audit.entries.find((item) => item.id === 'weakening')!
    expect(entry.sources[0]!.note).toContain('STACKS Yes')
    expect(entry.sources.some((source) => source.url === ENCHANTMENTS.weakening.stacking.source.url)).toBe(true)
    expect(ENCHANTMENTS.weakening.stacking.confidence).toBe('medium')
    expect(WEAKENING_DURATION).toMatchObject({ value: 5, confidence: 'high' })
    expect(WEAKENING_APPLICATION.value).toContain('all-nearby-enemies')
  })

  it('separates approximate healing and rate-model Evidence from exact cooldown and direct-kill mechanics', () => {
    expect(HEALTH_POTION_BASE_COOLDOWN.value).toBeGreaterThan(0)
    expect(HEALTH_POTION_HEAL_FRACTION.value).toBeGreaterThan(0)
    expect(HEALTH_POTION_HEAL_FRACTION.value).toBeLessThanOrEqual(1)
    expect(HEALTH_POTION_BASE_COOLDOWN).toMatchObject({ value: 45, confidence: 'high' })
    expect(HEALTH_POTION_HEAL_FRACTION).toMatchObject({ value: 0.75, confidence: 'medium' })
    expect(HEALTH_POTION_BASE_COOLDOWN.source.url).toMatch(/^https:/)
    expect(HEALTH_POTION_HEAL_FRACTION.source.url).toMatch(/^https:/)
    expect(REFRESHMENT_DIRECT_KILL_CONDITION.confidence).toBe('high')
    expect(REFRESHMENT_COOLDOWN_RATE_MODEL.confidence).toBe('low')
  })
})

describe('Refreshment potion availability', () => {
  it.each([1, 2, 3] as const)('Tier %s at one direct kill/sec has the published reduction and expected capacity', (tier) => {
    const potion = derivePotionState([selected('refreshment', tier)], directKills(1), DEFAULT_SCENARIO)
    expect(potion.refreshmentReductionPerDirectKillSeconds).toBe(tier)
    expect(potion.cooldownProgressRate).toBe(1 + tier)
    expect(potion.effectiveCooldownSeconds).toBe([22.5, 15, 11.25][tier - 1])
    expect(potion.baseUsesPerSecond).toBeCloseTo(1 / 45)
    expect(potion.estimatedUsesPerSecond).toBeCloseTo([2 / 45, 3 / 45, 4 / 45][tier - 1]!)
    expect(potion.healPerUse).toBe(75)
    expect(potion.incrementalHealingCapacityPerSecond).toBeCloseTo([5 / 3, 10 / 3, 5][tier - 1]!)
  })

  it('keeps baseline score unchanged without Refreshment even when total/direct kills exist', () => {
    const plain = evaluate(buildFor([selected('radiance'), selected('leeching')]), uncapped)
    expect(plain.potionState.effectiveCooldownSeconds).toBe(45)
    expect(plain.potionState.incrementalHealingCapacityPerSecond).toBe(0)
    expect(plain.healing.totalPerSecond).toBe(plain.healing.radiancePerSecond + plain.healing.leechingPerSecond)
  })

  it('does not credit indirect kills even with a positive total kill rate', () => {
    const result = evaluate(buildFor([selected('refreshment')]), { ...uncapped, directKillShare: 0 })
    expect(result.combatState.estimatedKillsPerSecond).toBeGreaterThan(0)
    expect(result.combatState.directWeaponKillsPerSecond).toBe(0)
    expect(result.potionState.effectiveCooldownSeconds).toBe(45)
    expect(result.healing.refreshmentPotionCapacityPerSecond).toBe(0)
    expect(result.contributions[0]).toMatchObject({ objectiveDelta: 0, healingPerSecondDelta: 0, singleTargetDpsDelta: 0 })
  })

  it.each(['sharpness', 'unchanting', 'critical-hit', 'void-strike'] as const)('%s increases capacity through damage -> direct kills without Refreshment changing DPS', (id) => {
    const plain = evaluate(buildFor([selected('refreshment')]), uncapped)
    const improved = evaluate(buildFor([selected('refreshment'), selected(id)]), uncapped)
    const damageOnly = evaluate(buildFor([selected(id)]), uncapped)
    expect(improved.combatState.directWeaponKillsPerSecond).toBeGreaterThan(plain.combatState.directWeaponKillsPerSecond)
    expect(improved.healing.refreshmentPotionCapacityPerSecond).toBeGreaterThan(plain.healing.refreshmentPotionCapacityPerSecond)
    expect(improved.damage).toEqual(damageOnly.damage)
    expect(improved.combatState).toEqual(damageOnly.combatState)
    expect(improved.contributions.find((item) => item.sourceId === 'refreshment')).toMatchObject({ singleTargetDpsDelta: 0, aoeDpsDelta: 0 })
  })

  it('respects directKillShare, enemy supply caps and maximum health', () => {
    const build = buildFor([selected('refreshment')])
    const full = evaluate(build, { ...DEFAULT_SCENARIO, directKillShare: 1 })
    const half = evaluate(build, { ...DEFAULT_SCENARIO, directKillShare: 0.5 })
    expect(half.healing.refreshmentPotionCapacityPerSecond).toBeCloseTo(full.healing.refreshmentPotionCapacityPerSecond / 2)
    const zeroSupply = evaluate(build, { ...DEFAULT_SCENARIO, enemySupplyPerSecond: 0 })
    expect(zeroSupply.potionState.incrementalHealingCapacityPerSecond).toBe(0)
    const doubledHealth = evaluate(build, { ...DEFAULT_SCENARIO, directKillShare: 1, maxHealth: 200 })
    expect(doubledHealth.healing.refreshmentPotionCapacityPerSecond).toBeCloseTo(full.healing.refreshmentPotionCapacityPerSecond * 2)
  })

  it('never applies artifact cooldownReduction to potion cooldown, including with Iron Hide equipped', () => {
    const base = buildFor([selected('refreshment')])
    const build: Build = { ...base, artifacts: [{ artifactId: 'iron-hide-amulet', instanceId: 'iron', powerLevel: 251 }] }
    const normal = evaluate(build, DEFAULT_SCENARIO)
    const reduced = evaluate(build, { ...DEFAULT_SCENARIO, cooldownReduction: 0.75 })
    expect(reduced.potionState).toEqual(normal.potionState)
    expect(reduced.artifactEffects.uptimes[0]!.effectiveCooldownSeconds).toBeLessThan(normal.artifactEffects.uptimes[0]!.effectiveCooldownSeconds)
  })
})

describe('Weakening time-weighted enemy damage coverage', () => {
  it.each([1, 2, 3] as const)('Tier %s gives correct full/zero/half coverage multipliers', (tier) => {
    const reduction = [0.2, 0.3, 0.4][tier - 1]!
    for (const share of [0, 0.5, 1]) {
      const result = calculateDefense([selected('weakening', tier)], effects, directKills(1), withShare(share))
      expect(result.weakeningDamageReduction).toBe(reduction)
      expect(result.weakeningDurationSeconds).toBe(5)
      expect(result.weakeningEnemyDamageMultiplier).toBeCloseTo(1 - share * reduction)
      expect(result.damageTakenMultiplier).toBeCloseTo(1 - share * reduction)
    }
  })

  it.each([[false, false], [true, false], [false, true], [true, true]])('composes enemy damage with Guarding=%s and Iron Hide=%s as separate stages', (guarding, ironHide) => {
    const scenario = withShare(0.5)
    const selections = [selected('weakening'), ...(guarding ? [selected('guarding-strike')] : [])]
    const artifacts: Build['artifacts'] = ironHide ? [{ artifactId: 'iron-hide-amulet', instanceId: 'iron', powerLevel: 251 }] : []
    const artifactEffects = calculateArtifactEffects(artifacts, scenario)
    const defense = calculateDefense(selections, artifactEffects, directKills(0.5), scenario)
    const guard = guarding ? 1 - (1 - Math.exp(-2)) * 0.5 : 1
    const expected = 0.8 * guard * artifactEffects.damageTakenMultiplier
    expect(defense.weakeningEnemyDamageMultiplier).toBeCloseTo(0.8)
    expect(defense.guardingStrikeDamageTakenMultiplier).toBeCloseTo(guard)
    expect(defense.damageTakenMultiplier).toBeCloseTo(expected)
    expect(defense.damageTakenPerSecond).toBeCloseTo(20 * expected)
    expect(defense.preventedDamagePerSecond).toBeCloseTo(20 * (1 - expected))
    expect(defense.effectiveHealth).toBeCloseTo(100 / expected)
  })

  it('does not modify direct DPS, Radiance, Leeching or kill rate and never derives coverage from HPS/duration', () => {
    const base = buildFor([selected('radiance'), selected('leeching')])
    const weak = buildFor([...base.enchantments, selected('weakening')])
    const normal = evaluate(base, uncapped)
    const weakened = evaluate(weak, uncapped)
    expect(weakened.damage).toEqual(normal.damage)
    expect(weakened.combatState).toEqual(normal.combatState)
    expect(weakened.healing).toEqual(normal.healing)
    const fast = calculateDamage(weak.weapon, weak.enchantments, { ...effects, attackSpeedMultiplier: 2 }, uncapped)
    expect(fast.hitsPerSecond).toBeGreaterThan(weakened.damage.hitsPerSecond)
    const withMushroom: Build = { ...weak, artifacts: [{ artifactId: 'death-cap-mushroom', instanceId: 'mushroom', powerLevel: 251 }] }
    expect(evaluate(withMushroom, uncapped).defense.weakeningEnemyDamageMultiplier).toBe(weakened.defense.weakeningEnemyDamageMultiplier)
    expect(evaluate(weak, { ...uncapped, encounterDurationSeconds: 1 }).defense.weakeningEnemyDamageMultiplier).toBe(0.8)
  })

  it.each([-0.01, 1.01, NaN, Infinity, -Infinity, undefined, null])('rejects invalid incoming damage share %s', (share) => {
    const scenario = { ...DEFAULT_SCENARIO, enemyDebuffs: { weakeningAffectedIncomingDamageShare: share } } as unknown as Scenario
    expect(() => validateScenario(scenario)).toThrow(/weakeningAffectedIncomingDamageShare/)
    expect(() => evaluate(buildFor([selected('weakening')]), scenario)).toThrow(/weakeningAffectedIncomingDamageShare/)
  })

  it('rejects missing assumptions and gives every profile the same editable low-confidence default', () => {
    expect(() => validateScenario({ ...DEFAULT_SCENARIO, enemyDebuffs: undefined } as unknown as Scenario)).toThrow(/weakeningAffectedIncomingDamageShare/)
    for (const scenario of Object.values(SCENARIO_PROFILES)) {
      expect(scenario.enemyDebuffs.weakeningAffectedIncomingDamageShare).toBe(0.5)
      expect(() => validateScenario(scenario)).not.toThrow()
    }
    expect(DEFAULT_SCENARIO_EVIDENCE.weakeningAffectedIncomingDamageShare.confidence).toBe('low')
  })
})

describe('state-model contributions, confidence and inventory paths', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each(['refreshment', 'weakening'] as const)('%s affects optimizer ranking only when its scenario permits it', (id) => {
    const active = evaluate(buildFor([selected(id)]), DEFAULT_SCENARIO)
    const zeroScenario = id === 'refreshment' ? { ...DEFAULT_SCENARIO, directKillShare: 0 } : withShare(0)
    const zero = evaluate(buildFor([selected(id)]), zeroScenario)
    expect(active.contributions[0]!.objectiveDelta).toBeGreaterThan(0)
    expect(zero.contributions[0]!.objectiveDelta).toBe(0)
    if (id === 'refreshment') {
      expect(active.contributions[0]!.healingPerSecondDelta).toBeGreaterThan(0)
      expect(active.reasons.join(' ')).toContain('直接撃破')
      expect(active.reasons.join(' ')).toContain(active.potionState.effectiveCooldownSeconds.toFixed(2))
    } else {
      expect(active.contributions[0]!.effectiveHealthDelta).toBeGreaterThan(0)
      expect(active.defense.preventedDamagePerSecond).toBeGreaterThan(0)
      expect(zero.contributions[0]!.effectiveHealthDelta).toBe(0)
      expect(active.reasons.join(' ')).toContain('割合50%')
      expect(active.reasons.join(' ')).toContain('20%削減')
    }
    const inactiveId = id === 'refreshment' ? 'weakening' : 'refreshment'
    const inventory: Inventory = {
      weapons: [{ ...active.build.weapon, enchantmentSlots: [{ candidates: [inactiveId, id] }] }], artifacts: [],
    }
    const scenario = id === 'refreshment' ? withShare(0) : { ...DEFAULT_SCENARIO, directKillShare: 0 }
    const result = optimize(inventory, scenario)
    expect(result.best.build.enchantments[0]!.enchantmentId).toBe(id)
    expect(result.evaluatedBuildCount).toBe(2)
    expect(result.paretoFrontier.every((item) => item.build.enchantments[0]!.enchantmentId === id)).toBe(true)
  })

  it('adds state-model evidence only for selected effects, including directKillShare for Refreshment', () => {
    const normal = evaluate(buildFor([selected('radiance')]), DEFAULT_SCENARIO)
    const refresh = evaluate(buildFor([selected('refreshment')]), DEFAULT_SCENARIO)
    const weak = evaluate(buildFor([selected('weakening')]), DEFAULT_SCENARIO)
    const factors = (value: typeof normal) => value.confidence.factors.map((item) => item.id)
    expect(factors(normal).some((id) => /weakening|potion|refreshment/.test(id))).toBe(false)
    expect(factors(refresh)).toEqual(expect.arrayContaining(['direct-kill-share', 'kill-rate-model', 'health-potion-base-cooldown', 'health-potion-heal-fraction', 'refreshment-direct-kill-condition', 'refreshment-cooldown-rate-model']))
    expect(factors(refresh).some((id) => id.startsWith('weakening'))).toBe(false)
    expect(factors(weak)).toEqual(expect.arrayContaining(['weakening-application', 'weakening-duration', 'weakening-affected-incoming-damage-share', 'enchant-stacking-weakening']))
    expect(factors(weak)).not.toContain('direct-kill-share')
    expect(factors(weak)).not.toContain('weakening-hero-dr-composition')
    const combined = evaluate(buildFor([selected('weakening'), selected('guarding-strike')]), DEFAULT_SCENARIO)
    expect(factors(combined)).toContain('weakening-hero-dr-composition')
    expect(refresh.confidence.caveats.join(' ')).toContain('実回復')
    expect(weak.confidence.caveats.join(' ')).toContain('5秒')
  })

  it.each(['refreshment', 'weakening'] as const)('%s rejects normal+normal and normal+gilded duplicates in evaluate and optimization', (id) => {
    for (const source of ['slot', 'gilded'] as const) {
      const build = buildFor([selected(id), selected(id, 3, source)])
      expect(hasValidEnchantmentStacking(build.enchantments)).toBe(false)
      expect(() => validateBuild(build)).toThrow(/最大1個/)
      expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow(/最大1個/)
      expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow()
    }
  })

  it.each(['refreshment', 'weakening'] as const)('%s preserves locked slots and all gilded tiers through JSON, storage and optimizer', (id) => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    for (const tier of [1, 2, 3] as const) {
      const build = buildFor([selected('radiance'), selected(id, tier, 'gilded')])
      const inventory: Inventory = { weapons: [{ ...build.weapon, enchantmentSlots: [{ candidates: ['radiance', id], locked: 'radiance' }] }], artifacts: [] }
      const roundTrip = deserializeInventory(serializeInventory(inventory))
      expect(roundTrip).toEqual(inventory)
      saveInventory(roundTrip)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory)
      const result = optimize(roundTrip, DEFAULT_SCENARIO)
      expect(result.best.build.enchantments.at(-1)).toEqual(selected(id, tier, 'gilded'))
      expect(result.evaluatedBuildCount).toBe(1)
      if (id === 'refreshment') expect(result.best.potionState.refreshmentReductionPerDirectKillSeconds).toBe(tier)
      else expect(result.best.defense.weakeningDamageReduction).toBe([0.2, 0.3, 0.4][tier - 1])
    }
  })
})
