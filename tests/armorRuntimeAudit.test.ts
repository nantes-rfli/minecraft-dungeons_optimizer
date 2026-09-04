import { describe, expect, it } from 'vitest'
import {
  ARMOR_CORE_RUNTIME_AUDIT,
  collectArmorRuntimeAuditErrors,
} from '../src/research/armorRuntimeAudit'
import { ARMOR_EXPANSION_AUDIT, collectArmorExpansionAuditErrors } from '../src/research/armorExpansionAudit'

const clone = <T>(value: T): T => structuredClone(value)

describe('Armor expansion fix-up audit', () => {
  it('pins shared Soul properties, steady-state healing semantics, CDR rejection, and 7/7 counts', () => {
    expect(collectArmorExpansionAuditErrors()).toEqual([])
    const property = clone(ARMOR_EXPANSION_AUDIT)
    property.armorExpansion.find((entry) => entry.id === 'grim-armor')!.properties.soulGatheringMultiplier = 1
    expect(collectArmorExpansionAuditErrors(property)).toContain('Armor expansion runtime property mismatch')
    const semantic = clone(ARMOR_EXPANSION_AUDIT)
    semantic.armorEnchantments.find((entry) => entry.id === 'health-synergy')!.state = 'realized-artifact-activation-times-resolved-max-health'
    expect(collectArmorExpansionAuditErrors(semantic)).toContain('Health Synergy steady-state capacity semantics drift')
    const cdr = clone(ARMOR_EXPANSION_AUDIT)
    cdr.cooldownStacking.status = 'complete'
    expect(collectArmorExpansionAuditErrors(cdr)).toContain('CDR rejection policy drift')
    const count = clone(ARMOR_EXPANSION_AUDIT)
    count.completion.runtimeArmorCount = 8
    count.completion.runtimeArmorEnchantmentCount = 8
    expect(collectArmorExpansionAuditErrors(count)).toContain('Armor expansion completion counts drift')
  })
})

describe('Phase 2-3C Armor runtime audit', () => {
  it('pins the catalog, evidence conflicts, bounded formulas, and completion counts', () => {
    expect(collectArmorRuntimeAuditErrors()).toEqual([])
    expect(ARMOR_CORE_RUNTIME_AUDIT.runtimeArmorIds).toEqual([
      'battle-robe',
      'renegade-armor',
      'wither-armor',
      'mercenary-armor',
      'grim-armor',
      'scale-mail',
      'spider-armor',
    ])
    expect(ARMOR_CORE_RUNTIME_AUDIT.runtimeArmorEnchantmentIds).toEqual([
      'cool-down',
      'potion-barrier',
      'chilling',
      'health-synergy',
      'snowball',
      'cowardice',
      'protection',
    ])
    expect(ARMOR_CORE_RUNTIME_AUDIT.decisions.coolDownTierThree).toMatchObject({
      gameFileValue: 0.37,
      currentWikiDisplay: 0.38,
      runtimeValue: 0.37,
    })
    expect(ARMOR_CORE_RUNTIME_AUDIT.completion).toEqual({
      runtimeArmorCount: 7,
      runtimeArmorEnchantmentCount: 7,
      supportLevel: 'limited',
    })
  })

  it('fails when a conflict decision or runtime count drifts', () => {
    const conflict = clone(ARMOR_CORE_RUNTIME_AUDIT) as unknown as {
      decisions: { coolDownTierThree: { runtimeValue: number } }
    }
    conflict.decisions.coolDownTierThree.runtimeValue = 0.38
    expect(collectArmorRuntimeAuditErrors(conflict)).toContain('Cool Down III conflict/decision drift')

    const count = clone(ARMOR_CORE_RUNTIME_AUDIT) as unknown as {
      completion: { runtimeArmorCount: number }
    }
    count.completion.runtimeArmorCount = 2
    expect(collectArmorRuntimeAuditErrors(count)).toContain('Armor runtime completion counts drift')
  })
})
