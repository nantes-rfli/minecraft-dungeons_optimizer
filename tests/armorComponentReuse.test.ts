import { describe, expect, it } from 'vitest'
import { ARMORS, type RuntimeArmorDefinition } from '../src/data/armors'
import type { ArmorId } from '../src/core/armor'
import { ARMOR_EVIDENCE_BINDINGS, armorNumericEvidenceRows } from '../src/core/armorEvidence'
import { evaluate, optimizeWithMetadata } from '../src/core'
import type { Build, Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import {
  collectLimitedArmorCatalogErrors, collectLimitedDarkArmorComponentReuseErrors,
  LIMITED_DARK_ARMOR_COMPONENT_REUSE_APPROVALS, LIMITED_ARMOR_REUSE_APPROVALS,
} from '../src/research/limitedMechanicReuse'
import { ARMOR_CORE_RUNTIME_AUDIT, collectArmorRuntimeAuditErrors } from '../src/research/armorRuntimeAudit'

// Synthetic software fixtures only; these are not independent gameplay Evidence.
const scenario = { ...DEFAULT_SCENARIO, cooldownReduction: 0, incomingDamagePerSecond: 100, enemySupplyPerSecond: 1000, averageEnemyHealth: 10000, maxHealth: 500 }
const weapon: Build['weapon'] = { instanceId: 'weapon', weaponId: 'soul-scythe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } }] }
function build(armorId: ArmorId): Build {
  return { weapon, enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [],
    armor: { instanceId: armorId, armorId, powerLevel: 251, observedHealthBonus: 400, enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 3 } }] },
    armorEnchantments: [{ enchantmentId: 'chilling', tier: 3, source: 'slot' }] }
}

describe('Dark Armor family existing-channel Limited reuse', () => {
  it('positive: source-bound grants cover every target property with independent Derived declarations', () => {
    expect(collectLimitedArmorCatalogErrors()).toEqual([])
    expect(collectArmorRuntimeAuditErrors()).toEqual([])
    expect(LIMITED_DARK_ARMOR_COMPONENT_REUSE_APPROVALS.map((entry) => entry.targetId)).toEqual(['dark-armor', 'titan-s-shroud'])
    for (const approval of LIMITED_DARK_ARMOR_COMPONENT_REUSE_APPROVALS) {
      expect(collectLimitedDarkArmorComponentReuseErrors(approval, ARMORS[approval.targetId])).toEqual([])
      const rows = armorNumericEvidenceRows(ARMORS[approval.targetId])
      expect(rows).toHaveLength(approval.properties.length)
      expect(rows.every((row) => row.binding?.status === 'derived' && row.binding.sourceId === 'dungeons-tools-armor-index')).toBe(true)
    }
  })

  it('positive: Dark exactly retains Wither DR/Soul while excluding donor Life Steal', () => {
    const dark = evaluate(build('dark-armor'), scenario)
    const wither = evaluate(build('wither-armor'), scenario)
    expect(dark.damage).toEqual(wither.damage)
    expect(dark.defense).toEqual(wither.defense)
    expect(dark.soulState).toEqual(wither.soulState)
    expect(dark.healing.lifeStealPerSecond).toBeUndefined()
    expect(wither.healing.lifeStealPerSecond).toBeGreaterThan(0)
    expect(dark.armorState?.lifeStealFraction).toBe(0)
    expect(dark.armorState?.finalMaxHealth).toBe(500)
  })

  it('positive: Titan uses the existing Mercenary aura→damage→kills→Soul pipeline with the Wither gathering multiplier', () => {
    const titan = evaluate(build('titan-s-shroud'), scenario)
    const mercenary = evaluate(build('mercenary-armor'), scenario)
    const dark = evaluate(build('dark-armor'), scenario)
    const wither = evaluate(build('wither-armor'), scenario)
    expect(titan.damage).toEqual(mercenary.damage)
    expect(titan.combatState).toEqual(mercenary.combatState)
    expect(titan.soulState!.normalResourceUnitsPerSecond).toBeCloseTo(mercenary.soulState!.normalResourceUnitsPerSecond * 1.5)
    expect(titan.soulState!.normalPickupEventsPerSecond).toBe(mercenary.soulState!.normalPickupEventsPerSecond)
    expect(titan.damage.directWeaponAoeDps / dark.damage.directWeaponAoeDps).toBeCloseTo(1.2)
    expect(titan.soulState!.normalResourceUnitsPerSecond / dark.soulState!.normalResourceUnitsPerSecond).toBeCloseTo(1.2)
    expect(titan.soulState!.totalSoulGathering).toBe(wither.soulState!.totalSoulGathering)
    expect(titan.healing.lifeStealPerSecond).toBeUndefined()
    expect(titan.defense.damageTakenMultiplier).toBe(0.65)
    const sharpBuild: Build = { ...build('wither-armor'), weapon: { ...weapon, enchantmentSlots: [{ candidates: ['sharpness'], selected: { enchantmentId: 'sharpness', tier: 2 } }] }, enchantments: [{ enchantmentId: 'sharpness', tier: 2, source: 'slot' }] }
    const sharp = evaluate(sharpBuild, scenario)
    expect(sharp.soulState!.totalSoulGathering).toBe(wither.soulState!.totalSoulGathering)
    expect(sharp.soulState!.normalResourceUnitsPerSecond / wither.soulState!.normalResourceUnitsPerSecond).toBeCloseTo(sharp.damage.aoeDps / wither.damage.aoeDps)
  })

  it('positive: both armors reach the optimizer, and Soul bonuses cannot create collection from zero', () => {
    const builds = ['dark-armor', 'titan-s-shroud'].map((id) => build(id as ArmorId))
    const inventory: Inventory = { weapons: [weapon], armors: builds.map((entry) => entry.armor!), artifacts: [] }
    const optimized = optimizeWithMetadata(inventory, scenario)
    expect(optimized.evaluatedInstanceIds).toEqual(expect.arrayContaining(['dark-armor', 'titan-s-shroud']))
    expect(optimized.result.best.build.armor?.armorId).toBe('titan-s-shroud')
    for (const entry of builds) expect(evaluate({ ...entry, weapon: { ...weapon, weaponId: 'double-axe' } }, scenario).soulState).toBeUndefined()
  })

  for (const approval of LIMITED_DARK_ARMOR_COMPONENT_REUSE_APPROVALS) {
    const target = ARMORS[approval.targetId]
    it(`negative: ${approval.targetId} rejects property, parameter, provenance, channel and ownership drift`, () => {
      for (let index = 0; index < approval.properties.length; index++) {
        for (const patch of [{ value: 0 }, { sourceId: 'missing' }, { raw: 'unknown' }, { kind: 'other' }, { channel: 'direct-melee-damage' as const, scope: 'sole-dr-source' as const }, { ownership: 'base' as const, donorId: 'mercenary-armor' as const }]) {
          const changed = { ...approval, properties: approval.properties.map((property, position) => position === index ? { ...property, ...patch } : property) }
          expect(collectLimitedDarkArmorComponentReuseErrors(changed, target).length).toBeGreaterThan(0)
        }
        expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, properties: approval.properties.filter((_, position) => position !== index) }, target).length).toBeGreaterThan(0)
        const property = approval.properties[index]!
        const donors = { ...ARMORS, [property.donorId]: { ...ARMORS[property.donorId], [property.parameter]: 0 } }
        expect(collectLimitedDarkArmorComponentReuseErrors(approval, target, donors)).toContain(`component reuse donor model/source mismatch: ${property.parameter}`)
      }
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, properties: [...approval.properties, approval.properties[0]!] }, target).length).toBeGreaterThan(0)
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, rawIdentity: 'GrimArmor' }, target)).toContain('component reuse Formal Identity mismatch')
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, gameVersion: 'unknown' as '1.17.0.0' }, target)).toContain('component reuse source/version mismatch')
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, sourceRef: 'unknown' as 'research/armor-audit.json' }, target)).toContain('component reuse source/version mismatch')
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, excludedDonorProperties: [] }, target)).toContain('component reuse must not inherit donor Life Steal')
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, rejectedInteractions: [] }, target)).toContain('component reuse does not reject every unverified interaction')
      expect(collectLimitedDarkArmorComponentReuseErrors({ ...approval, targetId: 'spider-armor' as 'dark-armor' }, target)).toContain('component reuse target is outside the reviewed Dark Armor family')
    })

    it(`negative: ${approval.targetId} rejects hidden effects, lost Evidence, duplicate grants and conflicting routes`, () => {
      const wrongTargets: RuntimeArmorDefinition[] = [
        { ...target, intrinsicProperties: [...target.intrinsicProperties, { kind: 'other', raw: 'unknown' }] },
        { ...target, intrinsicProperties: target.intrinsicProperties.slice(1) },
        { ...target, builtInEnchantments: [{ enchantmentId: 'chilling', tier: 1 }] },
        { ...target, soul: { acceptsSoulEnchantments: false } },
        { ...target, soul: { acceptsSoulEnchantments: true, intrinsicSoulModifier: 0 } },
        { ...target, lifeStealFraction: 0.06 }, { ...target, meleeAttackSpeedBonus: 0.25 },
      ]
      for (const wrong of wrongTargets) expect(collectLimitedDarkArmorComponentReuseErrors(approval, wrong).length).toBeGreaterThan(0)
      const declarations = { ...ARMOR_EVIDENCE_BINDINGS, [approval.targetId]: {} }
      expect(armorNumericEvidenceRows(target, declarations).every((row) => row.binding === undefined)).toBe(true)
      expect(collectLimitedArmorCatalogErrors(ARMORS, undefined, undefined, undefined, declarations).some((error) => error.startsWith(`${approval.targetId}/`) && error.includes('Evidence'))).toBe(true)
      expect(collectLimitedArmorCatalogErrors(ARMORS, undefined, undefined, undefined, undefined, undefined, [approval, approval])).toContain(`${approval.targetId}: duplicate component reuse approval`)
      const otherRoute = { ...LIMITED_ARMOR_REUSE_APPROVALS[0]!, targetId: approval.targetId }
      expect(collectLimitedArmorCatalogErrors(ARMORS, [otherRoute])).toContain(`${approval.targetId}: choose exactly one P4 route`)
    })

    it(`negative: ${approval.targetId} preserves all DR, Soul and Ranged fail-closed conditions`, () => {
      const entry = build(approval.targetId)
      expect(() => evaluate({ ...entry, armor: { ...entry.armor!, observedHealthBonus: undefined } }, scenario)).toThrow(expect.objectContaining({ code: 'MISSING_OBSERVED_ARMOR_HEALTH' }))
      expect(() => evaluate({ ...entry, artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }] }, scenario)).toThrow(/UNSUPPORTED_ARMOR_DR_COMBINATION/)
      for (const enchantmentId of ['guarding-strike', 'weakening', 'soul-siphon'] as const) {
        const conflict: Build = { ...entry, weapon: { ...weapon, enchantmentSlots: [{ candidates: [enchantmentId], selected: { enchantmentId, tier: 3 } }] }, enchantments: [{ enchantmentId, tier: 3, source: 'slot' }] }
        expect(() => evaluate(conflict, scenario)).toThrow(/UNSUPPORTED_ARMOR/)
      }
      for (const enchantmentId of ['potion-barrier', 'protection'] as const) {
        const conflict: Build = { ...entry, armor: { ...entry.armor!, enchantmentSlots: [{ candidates: [enchantmentId], selected: { enchantmentId, tier: 3 } }] }, armorEnchantments: [{ enchantmentId, tier: 3, source: 'slot' }] }
        expect(() => evaluate(conflict, scenario)).toThrow(/UNSUPPORTED_(ARMOR_DR|PROTECTION)_COMBINATION/)
      }
      const ranged: Build = { ...entry, weapon: { ...weapon, weaponId: 'double-axe' }, rangedWeapon: { instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [], observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 20, sourceNote: 'synthetic fixture' } }, rangedEnchantments: [] }
      expect(() => evaluate(ranged, { ...scenario, rangedTimeShare: 0.4 })).toThrow(/aura\/Life Steal\/Soul/)
    })
  }

  it('preservation: core audit rejects changed B3 decisions without altering historical decisions', () => {
    const changed = structuredClone(ARMOR_CORE_RUNTIME_AUDIT)
    changed.decisions.darkArmorComponentReuse[0]!.properties[0]!.value = 0
    expect(collectArmorRuntimeAuditErrors(changed)).toContain('Dark Armor existing-channel component reuse decisions drift')
    const absent = { ...ARMOR_CORE_RUNTIME_AUDIT, decisions: { ...ARMOR_CORE_RUNTIME_AUDIT.decisions, darkArmorComponentReuse: [] } }
    expect(collectArmorRuntimeAuditErrors(absent)).toContain('Dark Armor existing-channel component reuse decisions drift')
    expect(ARMOR_CORE_RUNTIME_AUDIT.decisions.damageReductionComposition.armorWithOtherRuntimeDefense).toBe('unsupported')
    expect(ARMOR_CORE_RUNTIME_AUDIT.decisions.witherSouls.soulSiphon).toBe('unsupported')
  })
})
