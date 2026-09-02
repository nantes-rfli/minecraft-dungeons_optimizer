import { describe, expect, it } from 'vitest'
import {
  ARMOR_CORE_RUNTIME_AUDIT,
  collectArmorRuntimeAuditErrors,
} from '../src/research/armorRuntimeAudit'

const clone = <T>(value: T): T => structuredClone(value)

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
