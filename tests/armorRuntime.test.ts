import { describe, expect, it } from 'vitest'
import { evaluate, optimize, optimizeWithMetadata } from '../src/core'
import type { Build, Scenario, SelectedEnchantment } from '../src/core'
import type { ArmorEnchantmentId, ArmorId, OwnedArmor, SelectedArmorEnchantment } from '../src/core/armor'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario: Scenario = { ...DEFAULT_SCENARIO, cooldownReduction: 0, incomingDamagePerSecond: 100, maxHealth: 999_999 }
const weapon = { instanceId: 'weapon', weaponId: 'double-axe' as const, powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit' as const], selected: { enchantmentId: 'critical-hit' as const, tier: 3 as const } }] }
const selected: SelectedEnchantment[] = [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }]

function armor(armorId: ArmorId, enchantmentId: ArmorEnchantmentId = 'chilling', tier: 1 | 2 | 3 = 3): OwnedArmor {
  return { instanceId: armorId, armorId, powerLevel: 251, observedHealthBonus: 400, enchantmentSlots: [{ candidates: [enchantmentId], selected: { enchantmentId, tier } }] }
}

function build(armorId: ArmorId, enchantmentId: ArmorEnchantmentId = 'chilling', tier: 1 | 2 | 3 = 3): Build {
  const owned = armor(armorId, enchantmentId, tier)
  const armorEnchantments: SelectedArmorEnchantment[] = [{ enchantmentId, tier, source: 'slot' }]
  return { weapon, enchantments: selected, armor: owned, armorEnchantments, artifacts: [] }
}

describe('Phase 2-3B Armor runtime', () => {
  it('uses observed Armor health instead of adding scenario.maxHealth', () => {
    const result = evaluate(build('battle-robe', 'chilling'), scenario)
    expect(result.armorState?.finalMaxHealth).toBe(500)
    expect(result.defense.effectiveHealth).toBe(500)
    expect(result.potionState.healPerUse).toBe(375)
  })

  it('preserves health-dependent mechanics when legacy and Armor routes resolve to the same max health', () => {
    const pain: SelectedEnchantment[] = [{ enchantmentId: 'pain-cycle', tier: 3, source: 'slot' }]
    const painWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['pain-cycle' as const], locked: 'pain-cycle' as const }] }
    const legacy = evaluate({ weapon: painWeapon, enchantments: pain, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const armored = evaluate({ ...build('battle-robe', 'chilling'), weapon: painWeapon, enchantments: pain }, scenario)
    expect(armored.damage.painCycleState?.selfDamagePerSecond).toBe(legacy.damage.painCycleState?.selfDamagePerSecond)

    const anima: SelectedEnchantment[] = [{ enchantmentId: 'anima-conduit', tier: 3, source: 'slot' }]
    const soulWeapon = { ...weapon, weaponId: 'soul-scythe' as const, enchantmentSlots: [{ candidates: ['anima-conduit' as const], locked: 'anima-conduit' as const }] }
    const legacySoul = evaluate({ weapon: soulWeapon, enchantments: anima, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const armoredSoul = evaluate({ ...build('battle-robe', 'chilling'), weapon: soulWeapon, enchantments: anima }, scenario)
    expect(armoredSoul.healing.animaHealingCapacityPerSecond).toBe(legacySoul.healing.animaHealingCapacityPerSecond)
    expect(armoredSoul.potionState.healPerUse).toBe(legacySoul.potionState.healPerUse)
    expect(armoredSoul.defense.effectiveHealth).toBe(legacySoul.defense.effectiveHealth)
  })

  it('applies Battle Robe damage only to direct melee and centralizes its cooldown', () => {
    const plain = evaluate({ weapon, enchantments: selected, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const directRobe = evaluate(build('battle-robe', 'chilling'), scenario)
    const artifacts = [
      { instanceId: 'mushroom', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 },
      { instanceId: 'amulet', artifactId: 'iron-hide-amulet' as const, powerLevel: 251 },
      { instanceId: 'powder', artifactId: 'shock-powder' as const, powerLevel: 251 },
    ]
    const robe = evaluate({ ...build('battle-robe', 'chilling'), artifacts }, scenario)
    expect(robe.damage.armorDirectMeleeMultiplier).toBe(1.3)
    expect(directRobe.damage.directWeaponSingleTargetDps / plain.damage.directWeaponSingleTargetDps).toBeCloseTo(1.3)
    expect(robe.artifactEffects.uptimes.find((item) => item.artifactId === 'death-cap-mushroom')?.effectiveCooldownSeconds).toBe(18)
    expect(robe.artifactEffects.uptimes.find((item) => item.artifactId === 'iron-hide-amulet')?.effectiveCooldownSeconds).toBe(15)
    expect(robe.control.shockPowder?.effectiveCooldownSeconds).toBe(9)
    expect(robe.temporalState.artifactActivation.activations.map((item) => item.effectiveCooldownSeconds)).toEqual([18, 15, 9])

    const thundering: SelectedEnchantment[] = [{ enchantmentId: 'thundering', tier: 3, source: 'slot' }]
    const procWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['thundering' as const], locked: 'thundering' as const }] }
    const plainProc = evaluate({ weapon: procWeapon, enchantments: thundering, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const robeProc = evaluate({ ...build('battle-robe', 'chilling'), weapon: procWeapon, enchantments: thundering }, scenario)
    expect(robeProc.damage.damageEvents[0]?.damagePerEvent).toBe(plainProc.damage.damageEvents[0]?.damagePerEvent)
    expect(robeProc.damage.indirectAoeDps).toBe(plainProc.damage.indirectAoeDps)
  })

  it('routes Renegade speed through cadence, applies its aura to direct damage, and resolves 35% DR alone', () => {
    const plain = evaluate({ weapon, enchantments: selected, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const renegade = evaluate(build('renegade-armor', 'chilling'), scenario)
    expect(renegade.damage.hitsPerSecond / plain.damage.hitsPerSecond).toBeCloseTo(1.25)
    expect(renegade.damage.directWeaponSingleTargetDps / plain.damage.directWeaponSingleTargetDps).toBeCloseTo(1.5)
    expect(renegade.defense.damageTakenMultiplier).toBeCloseTo(0.65)
    expect(renegade.defense.effectiveHealth).toBeCloseTo(500 / 0.65)
    expect(renegade.confidence.factors).toContainEqual(expect.objectContaining({ id: 'renegade-runtime-boundary', confidence: 'low' }))
  })

  it('event-replica-positive: Hungry variants match Renegade and Spooky Gourdian matches Wither inside existing Limited boundaries', () => {
    const renegade = evaluate(build('renegade-armor'), scenario)
    const renegadeBoundaryCaveat = renegade.confidence.caveats.find((item) => item.startsWith('Renegade Armorは単独speed bucket'))
    expect(renegadeBoundaryCaveat).toBeDefined()
    for (const [armorId, displayName] of [
      ['hungry-horror', 'Hungry Horror'],
      ['hungriest-horror', 'Hungriest Horror'],
    ] as const) {
      const replica = evaluate(build(armorId), scenario)
      expect(replica.damage.hitsPerSecond).toBe(renegade.damage.hitsPerSecond)
      expect(replica.damage.directWeaponSingleTargetDps).toBe(renegade.damage.directWeaponSingleTargetDps)
      expect(replica.defense.damageTakenMultiplier).toBe(renegade.defense.damageTakenMultiplier)
      expect(replica.armorState?.weaponDamageAuraMultiplier).toBe(renegade.armorState?.weaponDamageAuraMultiplier)
      expect(replica.confidence.coverageScore).toBeCloseTo(renegade.confidence.coverageScore, 12)
      expect(replica.confidence.label).toBe(renegade.confidence.label)
      expect(replica.confidence.factors).toContainEqual(expect.objectContaining({
        id: 'renegade-runtime-boundary',
        label: `${displayName}の単独speed bucketとself aura ownership`,
        confidence: 'low',
        weight: 2,
      }))
      const replicaBoundaryCaveat = replica.confidence.caveats.find((item) => item.startsWith(`${displayName}は単独speed bucket`))
      expect(replicaBoundaryCaveat?.replace(displayName, '<armor>')).toBe(
        renegadeBoundaryCaveat?.replace('Renegade Armor', '<armor>'),
      )
      const optimized = optimize({ weapons: [weapon], armors: [armor(armorId)], artifacts: [] }, scenario)
      expect(optimized.best.build.armor?.armorId).toBe(armorId)
    }

    const wither = evaluate(build('wither-armor'), scenario)
    const spooky = evaluate(build('the-spooky-gourdian'), scenario)
    expect(spooky.defense.damageTakenMultiplier).toBe(wither.defense.damageTakenMultiplier)
    expect(spooky.armorState?.soulGatheringMultiplier).toBe(wither.armorState?.soulGatheringMultiplier)
    expect(spooky.armorState?.lifeStealFraction).toBe(wither.armorState?.lifeStealFraction)
    expect(spooky.healing.lifeStealPerSecond).toBe(wither.healing.lifeStealPerSecond)
    expect(spooky.confidence.coverageScore).toBeCloseTo(wither.confidence.coverageScore, 12)
    expect(spooky.confidence.label).toBe(wither.confidence.label)
    expect(spooky.confidence.factors).toContainEqual(expect.objectContaining({
      id: 'wither-life-steal-eligibility',
      label: 'The Spooky GourdianのLife Steal対象channel',
      confidence: 'low',
      weight: 2,
    }))
    const witherBoundaryCaveat = wither.confidence.caveats.find((item) => item.startsWith('Wither ArmorのLife Steal'))
    const spookyBoundaryCaveat = spooky.confidence.caveats.find((item) => item.startsWith('The Spooky GourdianのLife Steal'))
    expect(witherBoundaryCaveat).toBeDefined()
    expect(spookyBoundaryCaveat?.replace('The Spooky Gourdian', '<armor>')).toBe(
      witherBoundaryCaveat?.replace('Wither Armor', '<armor>'),
    )

    const soulWeapon = { ...weapon, weaponId: 'soul-scythe' as const }
    const witherSoul = evaluate({ ...build('wither-armor'), weapon: soulWeapon }, scenario)
    const spookySoul = evaluate({ ...build('the-spooky-gourdian'), weapon: soulWeapon }, scenario)
    expect(spookySoul.soulState?.totalSoulGathering).toBe(witherSoul.soulState?.totalSoulGathering)
    expect(spookySoul.soulState?.totalPickupEventsPerSecond).toBe(witherSoul.soulState?.totalPickupEventsPerSecond)
  })

  it('event-replica-negative: exact replicas inherit donor fail-closed speed and DR composition boundaries', () => {
    expect(() => evaluate({
      ...build('hungry-horror'),
      artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }],
    }, scenario)).toThrow(/UNSUPPORTED_ATTACK_SPEED_COMBINATION/)
    expect(() => evaluate({
      ...build('hungriest-horror'),
      artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    }, scenario)).toThrow(/UNSUPPORTED_ARMOR_DR_COMBINATION/)
    expect(() => evaluate({
      ...build('the-spooky-gourdian'),
      artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    }, scenario)).toThrow(/UNSUPPORTED_ARMOR_DR_COMBINATION/)
  })

  it('keeps an unequipped runtime Armor with missing observed health out of evaluated builds', () => {
    const baselineArmor = armor('battle-robe')
    const stagedArmor: OwnedArmor = { ...armor('scale-mail'), instanceId: 'drop-armor', observedHealthBonus: undefined }
    const { result, evaluatedInstanceIds } = optimizeWithMetadata({ weapons: [weapon], armors: [baselineArmor, stagedArmor], artifacts: [] }, scenario)

    expect(evaluatedInstanceIds).toContain(baselineArmor.instanceId)
    expect(evaluatedInstanceIds).not.toContain(stagedArmor.instanceId)
    expect(result.unsupportedChoices).toContain('drop-armor: MISSING_OBSERVED_ARMOR_HEALTH')
  })

  it('keeps unsupported Renegade speed and Armor DR combinations explicit', () => {
    expect(() => evaluate({ ...build('renegade-armor'), artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow(/UNSUPPORTED_ATTACK_SPEED_COMBINATION/)
    expect(() => evaluate({ ...build('wither-armor'), artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_DR_COMBINATION/)
  })

  it('models Wither Soul units without creating collection and credits life steal only to direct melee', () => {
    const noSoul = evaluate(build('wither-armor'), scenario)
    expect(noSoul.soulState).toBeUndefined()
    expect(noSoul.healing.lifeStealPerSecond).toBeCloseTo(noSoul.damage.directWeaponAoeDps * 0.06)
    expect(noSoul.confidence.factors).toContainEqual(expect.objectContaining({ id: 'wither-life-steal-eligibility', confidence: 'low' }))
    const soulWeapon = { ...weapon, weaponId: 'soul-scythe' as const }
    const plain = evaluate({ weapon: soulWeapon, enchantments: selected, artifacts: [] }, { ...scenario, maxHealth: 500 })
    const wither = evaluate({ ...build('wither-armor'), weapon: soulWeapon }, scenario)
    expect(wither.soulState?.totalSoulGathering).toBe((plain.soulState?.totalSoulGathering ?? 0) * 1.5)
    expect(wither.soulState?.totalPickupEventsPerSecond).toBe(plain.soulState?.totalPickupEventsPerSecond)
  })

  it.each([[1, 0.18], [2, 0.29], [3, 0.37]] as const)('uses audited Cool Down tier %s value and rejects unverified composition', (tier, reduction) => {
    const cooled = evaluate({ ...build('wither-armor', 'cool-down', tier), artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)
    expect(cooled.artifactEffects.uptimes[0]?.effectiveCooldownSeconds).toBeCloseTo(30 * (1 - reduction))
    expect(() => evaluate(build('battle-robe', 'cool-down', tier), scenario)).toThrow(/UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION/)
    expect(() => evaluate(build('wither-armor', 'cool-down', tier), { ...scenario, cooldownReduction: 0.1 })).toThrow(/UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION/)
  })

  it('rejects multiple Cool Down copies instead of applying an unverified stacking formula', () => {
    const owned = armor('wither-armor', 'cool-down')
    const armorWithTwoSlots = { ...owned, enchantmentSlots: [...owned.enchantmentSlots, { candidates: ['cool-down' as const], selected: { enchantmentId: 'cool-down' as const, tier: 2 as const } }] }
    expect(() => evaluate({ ...build('wither-armor', 'cool-down'), armor: armorWithTwoSlots, armorEnchantments: [
      { enchantmentId: 'cool-down', tier: 3, source: 'slot' },
      { enchantmentId: 'cool-down', tier: 2, source: 'slot' },
    ] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_COMBINATION/)
  })

  it.each([[1, 5], [2, 7], [3, 9]] as const)('uses Potion Barrier tier %s duration from PotionState', (tier, duration) => {
    const barrier = evaluate(build('battle-robe', 'potion-barrier', tier), scenario)
    expect(barrier.defense.potionBarrierCoverage).toBeCloseTo(duration / barrier.potionState.effectiveCooldownSeconds)
    expect(barrier.defense.damageTakenMultiplier).toBeCloseTo(1 - 0.9 * duration / barrier.potionState.effectiveCooldownSeconds)
  })

  it('derives Potion Barrier coverage from PotionState and keeps Chilling on Control only', () => {
    const barrier = evaluate(build('battle-robe', 'potion-barrier', 3), scenario)
    expect(barrier.defense.potionBarrierCoverage).toBeCloseTo(9 / 45)
    expect(barrier.defense.damageTakenMultiplier).toBeCloseTo(0.82)
    const refreshmentWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['refreshment' as const], selected: { enchantmentId: 'refreshment' as const, tier: 3 as const } }] }
    const refreshment = evaluate({ ...build('battle-robe', 'potion-barrier', 3), weapon: refreshmentWeapon, enchantments: [{ enchantmentId: 'refreshment', tier: 3, source: 'slot' }] }, { ...scenario, averageEnemyHealth: 50, enemySupplyPerSecond: 10 })
    expect(refreshment.defense.potionBarrierCoverage).toBeGreaterThan(barrier.defense.potionBarrierCoverage!)
    const noTargets = evaluate(build('battle-robe', 'chilling', 3), { ...scenario, crowdControl: { ...scenario.crowdControl, chillingEligibleTargetShare: 0, chillingAffectedTargetShare: 1 } })
    const allTargets = evaluate(build('battle-robe', 'chilling', 3), { ...scenario, crowdControl: { ...scenario.crowdControl, chillingEligibleTargetShare: 1, chillingAffectedTargetShare: 1 } })
    expect(noTargets.control.chilling?.attackSlowEquivalentCoverage).toBe(0)
    expect(allTargets.control.chilling?.attackSlowEquivalentCoverage).toBeCloseTo(0.3)
    expect(allTargets.defense.damageTakenMultiplier).toBe(noTargets.defense.damageTakenMultiplier)
    expect(allTargets.confidence.factors).toContainEqual(expect.objectContaining({ id: 'chilling-periodic-target-model', confidence: 'low' }))
  })

  it.each([[1, 0.2], [2, 0.4], [3, 0.6]] as const)('uses Chilling tier %s as periodic Control and union-composes Freezing', (tier, reduction) => {
    const chilled = evaluate(build('battle-robe', 'chilling', tier), { ...scenario, crowdControl: { ...scenario.crowdControl, chillingEligibleTargetShare: 1, chillingAffectedTargetShare: 1 } })
    expect(chilled.control.chilling?.attackSlowEquivalentCoverage).toBeCloseTo(0.5 * reduction)
    const freezingWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['freezing' as const], selected: { enchantmentId: 'freezing' as const, tier: 3 as const } }] }
    const combined = evaluate({ ...build('battle-robe', 'chilling', tier), weapon: freezingWeapon, enchantments: [{ enchantmentId: 'freezing', tier: 3, source: 'slot' }] }, { ...scenario, crowdControl: { ...scenario.crowdControl, freezingEligibleTargetShare: 1, chillingEligibleTargetShare: 1, chillingAffectedTargetShare: 1 } })
    const freezingCoverage = combined.control.freezing!.attackSlowEquivalentCoverage
    expect(combined.control.attackSlowEquivalentCoverage).toBeCloseTo(1 - (1 - freezingCoverage) * (1 - 0.5 * reduction))
    expect(combined.control.attackSlowEquivalentCoverage).toBeLessThanOrEqual(1)
  })

  it('enumerates actual Armor rolls, honors locks, rejects unsupported alternatives and missing observed health', () => {
    const supported = armor('battle-robe', 'chilling')
    const optimized = optimize({ weapons: [weapon], armors: [supported], artifacts: [] }, scenario)
    expect(optimized.best.build.armor?.armorId).toBe('battle-robe')
    expect(optimized.best.build.armorEnchantments).toEqual([{ enchantmentId: 'chilling', tier: 3, source: 'slot' }])
    const mixed = { ...supported, enchantmentSlots: [{ candidates: ['chilling', 'thorns'] }] }
    expect(() => optimize({ weapons: [weapon], armors: [mixed], artifacts: [] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_ENCHANT_ALTERNATIVE/)
    const locked = { ...mixed, enchantmentSlots: [{ ...mixed.enchantmentSlots[0]!, selected: { enchantmentId: 'chilling', tier: 3 as const } }] }
    expect(optimize({ weapons: [weapon], armors: [locked], artifacts: [] }, scenario).best.build.armorEnchantments?.[0]?.enchantmentId).toBe('chilling')
    const lockedUnsupported = { ...mixed, enchantmentSlots: [{ ...mixed.enchantmentSlots[0]!, selected: { enchantmentId: 'thorns', tier: 3 as const } }] }
    expect(() => optimize({ weapons: [weapon], armors: [lockedUnsupported], artifacts: [] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_ENCHANTMENT/)
    const supportedGilded = { ...armor('wither-armor', 'chilling'), gilded: { enchantmentId: 'cool-down', tier: 2 as const } }
    expect(optimize({ weapons: [weapon], armors: [supportedGilded], artifacts: [] }, scenario).best.build.armorEnchantments).toContainEqual({ enchantmentId: 'cool-down', tier: 2, source: 'gilded' })
    const unsupportedGilded = { ...armor('wither-armor', 'chilling'), gilded: { enchantmentId: 'thorns', tier: 3 as const } }
    expect(() => optimize({ weapons: [weapon], armors: [unsupportedGilded], artifacts: [] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_GILDED_ENCHANTMENT/)
    expect(() => optimize({ weapons: [weapon], armors: [{ ...supported, observedHealthBonus: undefined }], artifacts: [] }, scenario)).toThrow(/MISSING_OBSERVED_ARMOR_HEALTH/)
  })

  it('round-trips canonical Armor JSON without changing its shape', () => {
    const inventory = { weapons: [weapon], armors: [armor('battle-robe')], artifacts: [] }
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
    const legacy = { weapons: [weapon], artifacts: [] }
    expect(deserializeInventory(serializeInventory(legacy))).toEqual(legacy)
  })
})
