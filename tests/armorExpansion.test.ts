import { describe, expect, it } from 'vitest'
import { evaluate, optimize } from '../src/core'
import { healthSynergyCapacity } from '../src/core/healing'
import type { Build, Scenario, SelectedEnchantment } from '../src/core'
import type { ArmorEnchantmentId, ArmorId, OwnedArmor, SelectedArmorEnchantment } from '../src/core/armor'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../src/data/armors'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { ARMOR_ENCHANTMENT_REFERENCE_IDS } from '../src/research/armorEnchantmentAudit'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario: Scenario = { ...DEFAULT_SCENARIO, cooldownReduction: 0, incomingDamagePerSecond: 100, maxHealth: 500 }
const weapon = { instanceId: 'weapon', weaponId: 'double-axe' as const, powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit' as const], locked: 'critical-hit' as const }] }
const selected: SelectedEnchantment[] = [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }]

function ownedArmor(armorId: ArmorId, enchantmentId: string = 'chilling', tier: 1 | 2 | 3 = 3): OwnedArmor {
  return { instanceId: armorId, armorId, powerLevel: 251, observedHealthBonus: 400, enchantmentSlots: [{ candidates: [{ enchantmentId, tier }], locked: enchantmentId }] }
}

function build(armorId: ArmorId, enchantmentId: ArmorEnchantmentId = 'chilling', tier: 1 | 2 | 3 = 3): Build {
  const armor = ownedArmor(armorId, enchantmentId, tier)
  const armorEnchantments: SelectedArmorEnchantment[] = [{ enchantmentId, tier, source: 'slot' }]
  return { weapon, enchantments: selected, armor, armorEnchantments, artifacts: [] }
}

describe('Phase 2-3C Armor property reuse', () => {
  it('reuses aura, Soul, Life Steal, melee, speed, and DR components', () => {
    const mercenary = evaluate(build('mercenary-armor'), scenario)
    const renegade = evaluate(build('renegade-armor'), scenario)
    expect(mercenary.armorState?.weaponDamageAuraMultiplier).toBe(renegade.armorState?.weaponDamageAuraMultiplier)
    expect(mercenary.armorState?.meleeAttackSpeedBonus).toBe(0)
    expect(mercenary.defense.damageTakenMultiplier).toBe(renegade.defense.damageTakenMultiplier)

    const grim = evaluate(build('grim-armor'), scenario)
    const wither = evaluate(build('wither-armor'), scenario)
    expect(grim.soulState).toBeUndefined()
    expect(grim.armorState?.soulGatheringMultiplier).toBe(wither.armorState?.soulGatheringMultiplier)
    expect(grim.healing.lifeStealPerSecond).toBe(wither.healing.lifeStealPerSecond)
    expect(grim.defense.damageTakenMultiplier).toBe(1)

    const scale = evaluate(build('scale-mail'), scenario)
    const robe = evaluate(build('battle-robe'), scenario)
    expect(scale.armorState?.meleeDamageMultiplier).toBe(robe.armorState?.meleeDamageMultiplier)
    expect(scale.defense.damageTakenMultiplier).toBe(0.65)

    const spider = evaluate(build('spider-armor'), scenario)
    expect(spider.armorState?.meleeAttackSpeedBonus).toBe(renegade.armorState?.meleeAttackSpeedBonus)
    expect(spider.damage.hitsPerSecond).toBe(renegade.damage.hitsPerSecond)
    expect(spider.healing.lifeStealPerSecond).toBeCloseTo(spider.damage.directWeaponAoeDps * 0.06)
    expect(spider.defense.damageTakenMultiplier).toBe(1)
  })

  it('keeps Scale Mail melee damage out of proc and DoT channels', () => {
    const damageEnchantments: SelectedEnchantment[] = [
      { enchantmentId: 'thundering', tier: 3, source: 'slot' },
      { enchantmentId: 'fire-aspect', tier: 3, source: 'slot' },
    ]
    const damageWeapon = {
      ...weapon,
      enchantmentSlots: [
        { candidates: ['thundering' as const], locked: 'thundering' as const },
        { candidates: ['fire-aspect' as const], locked: 'fire-aspect' as const },
      ],
    }
    const scale = evaluate({ ...build('scale-mail'), weapon: damageWeapon, enchantments: damageEnchantments }, scenario)
    const withoutMeleeBonus = evaluate({ ...build('grim-armor'), weapon: damageWeapon, enchantments: damageEnchantments }, scenario)
    expect(scale.damage.directWeaponSingleTargetDps / withoutMeleeBonus.damage.directWeaponSingleTargetDps).toBeCloseTo(1.3)
    expect(scale.damage.indirectSingleTargetDps).toBe(withoutMeleeBonus.damage.indirectSingleTargetDps)
    expect(scale.damage.indirectAoeDps).toBe(withoutMeleeBonus.damage.indirectAoeDps)
  })

  it('keeps speed, Soul, and DR combination boundaries property-driven', () => {
    const mushroom = [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom' as const, powerLevel: 251 }]
    expect(() => evaluate({ ...build('spider-armor'), artifacts: mushroom }, scenario)).toThrow(/UNSUPPORTED_ATTACK_SPEED_COMBINATION/)
    const soulWeapon = { ...weapon, weaponId: 'soul-scythe' as const, enchantmentSlots: [{ candidates: ['soul-siphon' as const], locked: 'soul-siphon' as const }] }
    expect(() => evaluate({ ...build('grim-armor'), weapon: soulWeapon, enchantments: [{ enchantmentId: 'soul-siphon', tier: 3, source: 'slot' }] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_COMBINATION/)
    expect(() => evaluate(build('scale-mail', 'protection'), scenario)).toThrow(/UNSUPPORTED_PROTECTION_COMBINATION/)
  })
})

describe('Phase 2-3C state Armor Enchantments', () => {
  it.each([[1, 0.03], [2, 0.04], [3, 0.05]] as const)('uses Health Synergy Tier %s realized Artifact activation', (tier, fraction) => {
    expect(ARMOR_ENCHANTMENTS['health-synergy'].tiers[tier]).toBe(fraction)
    expect(healthSynergyCapacity(1, 1000, fraction)).toBe(1000 * fraction)
    const noArtifact = evaluate(build('grim-armor', 'health-synergy', tier), scenario)
    expect(noArtifact.healing.healthSynergyCapacityPerSecond).toBe(0)
    const withArtifact = evaluate({ ...build('grim-armor', 'health-synergy', tier), artifacts: [{ instanceId: 'powder', artifactId: 'shock-powder', powerLevel: 251 }] }, scenario)
    expect(withArtifact.healing.healthSynergyCapacityPerSecond).toBeCloseTo(withArtifact.temporalState.artifactActivation.totalActivationsPerSecond * 500 * fraction)
  })

  it('increases Health Synergy capacity from the shared realized activation rate', () => {
    const baseBuild = build('grim-armor', 'health-synergy', 3)
    const artifacts = [{ instanceId: 'powder', artifactId: 'shock-powder' as const, powerLevel: 251 }]
    const base = evaluate({ ...baseBuild, artifacts }, scenario)
    const cooledArmor = {
      ...baseBuild.armor!,
      enchantmentSlots: [
        ...baseBuild.armor!.enchantmentSlots,
        { candidates: [{ enchantmentId: 'cool-down', tier: 3 as const }], locked: 'cool-down' },
      ],
    }
    const cooled = evaluate({
      ...baseBuild,
      armor: cooledArmor,
      armorEnchantments: [
        ...baseBuild.armorEnchantments!,
        { enchantmentId: 'cool-down', tier: 3, source: 'slot' },
      ],
      artifacts,
    }, scenario)
    expect(cooled.temporalState.artifactActivation.totalActivationsPerSecond).toBeGreaterThan(base.temporalState.artifactActivation.totalActivationsPerSecond)
    expect(cooled.healing.healthSynergyCapacityPerSecond).toBeGreaterThan(base.healing.healthSynergyCapacityPerSecond!)
  })

  it('models Snowball as one-target Control only with boss immunity and union composition', () => {
    const settings = { ...scenario, averageTargetsInReach: 4, crowdControl: { ...scenario.crowdControl, snowballEligibleTargetShare: 1 } }
    const snowball = evaluate(build('grim-armor', 'snowball', 3), settings)
    expect(snowball.control.snowball).toMatchObject({ triggerIntervalSeconds: 1, stunDurationSeconds: 2, temporalCoverage: 1, affectedTargetFraction: 0.25, hardDisableCoverage: 0.25 })
    expect(snowball.damage).toEqual(evaluate(build('grim-armor', 'chilling', 1), { ...settings, crowdControl: { ...settings.crowdControl, chillingEligibleTargetShare: 0 } }).damage)
    expect(snowball.defense.damageTakenMultiplier).toBe(1)
    expect(evaluate(build('grim-armor', 'snowball', 3), { ...settings, profileId: 'boss', crowdControl: { ...settings.crowdControl, snowballEligibleTargetShare: 0 } }).control.snowball?.hardDisableCoverage).toBe(0)
  })

  it('unions Snowball with another hard-disable source without exceeding 100%', () => {
    const settings = { ...scenario, averageTargetsInReach: 1, crowdControl: { ...scenario.crowdControl, snowballEligibleTargetShare: 1 } }
    const withShockPowder = evaluate({
      ...build('grim-armor', 'snowball', 3),
      artifacts: [{ instanceId: 'powder', artifactId: 'shock-powder', powerLevel: 251 }],
    }, settings)
    const snowballCoverage = withShockPowder.control.snowball?.hardDisableCoverage ?? 0
    const shockCoverage = withShockPowder.control.shockPowder?.hardDisableCoverage ?? 0
    expect(withShockPowder.control.hardDisableCoverage).toBeCloseTo(1 - (1 - snowballCoverage) * (1 - shockCoverage))
    expect(withShockPowder.control.hardDisableCoverage).toBeLessThanOrEqual(1)
  })

  it.each([[0, 1], [0.5, 1.2], [1, 1.4]] as const)('requires and applies Cowardice full-health share %s', (share, multiplier) => {
    const cowardice = evaluate(build('grim-armor', 'cowardice', 3), { ...scenario, cowardiceFullHealthShare: share })
    const plain = evaluate(build('grim-armor', 'chilling', 1), { ...scenario, crowdControl: { ...scenario.crowdControl, chillingEligibleTargetShare: 0 } })
    expect(cowardice.damage.cowardiceExpectedMultiplier).toBe(multiplier)
    expect(cowardice.damage.directWeaponSingleTargetDps / plain.damage.directWeaponSingleTargetDps).toBeCloseTo(multiplier)
  })

  it('rejects missing Cowardice state and keeps indirect damage unchanged', () => {
    expect(() => evaluate(build('grim-armor', 'cowardice'), scenario)).toThrow(/MISSING_COWARDICE_FULL_HEALTH_SHARE/)
    const procWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['thundering' as const], locked: 'thundering' as const }] }
    const procEnchantments: SelectedEnchantment[] = [{ enchantmentId: 'thundering', tier: 3, source: 'slot' }]
    const cowardice = evaluate({ ...build('grim-armor', 'cowardice'), weapon: procWeapon, enchantments: procEnchantments }, { ...scenario, cowardiceFullHealthShare: 1 })
    const plain = evaluate({ ...build('grim-armor', 'chilling'), weapon: procWeapon, enchantments: procEnchantments }, scenario)
    expect(cowardice.damage.indirectAoeDps).toBe(plain.damage.indirectAoeDps)
  })

  it.each([[1, 0.94], [2, 0.89], [3, 0.85]] as const)('supports Protection Tier %s only as the sole DR source', (tier, taken) => {
    expect(evaluate(build('grim-armor', 'protection', tier), scenario).defense.damageTakenMultiplier).toBe(taken)
  })

  it('rejects Protection with every modeled DR family', () => {
    expect(() => evaluate(build('mercenary-armor', 'protection'), scenario)).toThrow(/UNSUPPORTED_PROTECTION_COMBINATION/)
    expect(() => evaluate({ ...build('grim-armor', 'protection'), artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }] }, scenario)).toThrow(/UNSUPPORTED_PROTECTION_COMBINATION/)
    const guardWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['guarding-strike' as const], locked: 'guarding-strike' as const }] }
    expect(() => evaluate({ ...build('grim-armor', 'protection'), weapon: guardWeapon, enchantments: [{ enchantmentId: 'guarding-strike', tier: 3, source: 'slot' }] }, scenario)).toThrow(/UNSUPPORTED_PROTECTION_COMBINATION/)
  })
})

describe('Phase 2-3C inventory and contribution policy', () => {
  it('exposes all 41 audited Armor Enchants and rejects only unknown IDs at import', () => {
    expect(ARMOR_ENCHANTMENT_REFERENCE_IDS).toHaveLength(41)
    expect(ARMOR_ENCHANTMENT_REFERENCE_IDS).toEqual(expect.arrayContaining(['protection', 'thorns']))
    const inventory = { weapons: [weapon], armors: [ownedArmor('grim-armor', 'thorns')], artifacts: [] }
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
    expect(() => deserializeInventory(serializeInventory({ ...inventory, armors: [ownedArmor('grim-armor', 'unknown-enchant')] }))).toThrow(/未監査ID/)
    expect(() => deserializeInventory(serializeInventory({ ...inventory, armors: [ownedArmor('grim-armor', 'toString')] }))).toThrow(/未監査ID/)
  })

  it('keeps unsupported free alternatives strict while allowing a supported lock', () => {
    const armor = ownedArmor('grim-armor', 'chilling')
    const mixed = { ...armor, enchantmentSlots: [{ candidates: [{ enchantmentId: 'chilling', tier: 3 as const }, { enchantmentId: 'thorns', tier: 3 as const }] }] }
    expect(() => optimize({ weapons: [weapon], armors: [mixed], artifacts: [] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_ENCHANT_ALTERNATIVE/)
    const locked = { ...mixed, enchantmentSlots: [{ ...mixed.enchantmentSlots[0]!, locked: 'chilling' }] }
    expect(optimize({ weapons: [weapon], armors: [locked], artifacts: [] }, scenario).best.build.armorEnchantments?.[0]?.enchantmentId).toBe('chilling')
  })

  it('removes the misleading whole-Armor contribution and keeps Armor Enchant contribution', () => {
    const result = evaluate(build('grim-armor', 'health-synergy'), scenario)
    expect(result.contributions.some((entry) => entry.sourceType === 'armor')).toBe(false)
    expect(result.contributions).toContainEqual(expect.objectContaining({ sourceType: 'armor-enchantment', sourceId: 'health-synergy' }))
    expect(Object.keys(ARMORS)).toHaveLength(7)
    expect(Object.keys(ARMOR_ENCHANTMENTS)).toHaveLength(7)
  })

  it('keeps CDR stacking inconclusive and rejects Battle Robe plus Cool Down and multiple copies', () => {
    expect(() => evaluate(build('battle-robe', 'cool-down'), scenario)).toThrow(/UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION/)
    const armor = ownedArmor('grim-armor', 'cool-down')
    const twoSlots = { ...armor, enchantmentSlots: [...armor.enchantmentSlots, { candidates: [{ enchantmentId: 'cool-down' as const, tier: 3 as const }], locked: 'cool-down' as const }] }
    expect(() => evaluate({ ...build('grim-armor', 'cool-down'), armor: twoSlots, armorEnchantments: [{ enchantmentId: 'cool-down', tier: 3, source: 'slot' }, { enchantmentId: 'cool-down', tier: 3, source: 'slot' }] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_COMBINATION/)
  })
})
