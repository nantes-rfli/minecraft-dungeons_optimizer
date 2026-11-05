import { describe, expect, it } from 'vitest'
import { inspectInventoryReadiness, optimize, optimizeWithMetadata } from '../src/core/optimizer'
import { evaluate } from '../src/core/evaluate'
import { parseRangedWeapon } from '../src/core/ranged'
import { serializeInventory, deserializeInventory } from '../src/inventory/storage'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { RANGED_WEAPONS } from '../src/data/ranged'
import type { Inventory, Scenario } from '../src/core/types'
import { readinessMelee, readinessRanged } from './inventoryReadinessFixtures'

const scenario = { ...DEFAULT_SCENARIO, rangedTimeShare: 0.4 }
const statusFor = (inventory: Inventory, id: string, condition: Scenario = scenario) => inspectInventoryReadiness(inventory, condition).equipment.find((entry) => entry.instanceId === id)!

describe('Inventory readiness shares runtime evaluation and exclusions', () => {
  it('counts only actually evaluated instances, including ones beyond recommendation limits', () => {
    const inventory: Inventory = { ...readinessMelee, rangedWeapons: [readinessRanged(), { ...readinessRanged('crossbow'), observation: undefined }, { ...readinessRanged('harp-crossbow'), observation: undefined }], artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }], catalogItems: [{ instanceId: 'unknown', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }] }
    const report = inspectInventoryReadiness(inventory, scenario)
    expect(report.error).toBeUndefined()
    expect(report.equipment.map((entry) => [entry.instanceId, entry.status])).toEqual([['melee', 'evaluated'], ['bow', 'evaluated'], ['crossbow', 'input-required'], ['harp-crossbow', 'unsupported'], ['mushroom', 'evaluated'], ['unknown', 'unsupported']])
    expect(report.equipment.filter((entry) => entry.status === 'evaluated').map((entry) => entry.instanceId).sort()).toEqual([...optimizeWithMetadata(inventory, scenario).evaluatedInstanceIds].sort())
  })

  it.each(Object.keys(RANGED_WEAPONS))('makes existing Limited %s usable after the correct observations are entered', (id) => {
    const ranged = readinessRanged(id)
    const before: Inventory = { ...readinessMelee, rangedWeapons: [{ ...ranged, observation: undefined }] }
    const entry = statusFor(before, id)
    expect(entry.status).toBe('input-required')
    expect(entry.issues[0]).toMatchObject({ target: 'equipment', fields: expect.arrayContaining([expect.stringContaining('ダメージ'), expect.stringContaining('完全発射周期'), expect.stringContaining('矢数'), expect.stringContaining('観測メモ')]) })
    expect(() => optimize(before, scenario)).toThrow('No supported Ranged')
    const after = { ...before, rangedWeapons: [ranged] }
    expect(statusFor(after, id).status).toBe('evaluated')
    const best = optimize(after, scenario).best
    expect(evaluate(best.build, scenario)).toEqual(best)
    expect(best.damage.ranged?.supportLevel).toBe('limited')
  })

  it('never suggests filling observations to repair research-only intrinsic effects', () => {
    const inventory: Inventory = { ...readinessMelee, rangedWeapons: [{ ...readinessRanged('harp-crossbow'), observation: undefined }] }
    expect(statusFor(inventory, 'harp-crossbow')).toMatchObject({ status: 'unsupported', issues: [{ kind: 'unsupported' }] })
    expect(statusFor(inventory, 'harp-crossbow').issues.some((issue) => issue.fields)).toBe(false)
    expect(statusFor({ ...inventory, rangedWeapons: [readinessRanged('harp-crossbow')] }, 'harp-crossbow').status).toBe('unsupported')
  })

  it('reports unsupported Gilded alongside missing observations, and preserves locks and Gilded', () => {
    const ranged = { ...readinessRanged(), observation: undefined, enchantmentSlots: [{ candidates: ['power', 'multishot'], selected: { enchantmentId: 'power', tier: 2 as const } }], gilded: { enchantmentId: 'multishot', tier: 1 as const } }
    const inventory: Inventory = { ...readinessMelee, rangedWeapons: [ranged] }
    const before = JSON.stringify(inventory)
    const entry = statusFor(inventory, 'bow')
    expect(entry.status).toBe('unsupported')
    expect(entry.issues.map((issue) => issue.kind)).toEqual(['input-required', 'unsupported'])
    expect(JSON.stringify(inventory)).toBe(before)
    const supported = { ...inventory, rangedWeapons: [{ ...ranged, observation: readinessRanged().observation, gilded: { enchantmentId: 'critical-hit', tier: 1 as const } }] }
    expect(statusFor(supported, 'bow').status).toBe('evaluated')
    expect(optimize(supported, scenario).best.build.rangedEnchantments).toEqual([{ enchantmentId: 'power', tier: 2, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 1, source: 'gilded' }])
  })

  it('distinguishes wrong shot mode and scenario/interaction restrictions', () => {
    const ranged = readinessRanged('shortbow')
    const inventory = { ...readinessMelee, rangedWeapons: [ranged] }
    expect(statusFor({ ...inventory, rangedWeapons: [{ ...ranged, observation: { ...ranged.observation!, mode: 'uncharged' } }] }, 'shortbow')).toMatchObject({ status: 'input-required', issues: [{ target: 'equipment', fields: ['発射モード: charged'] }] })
    expect(statusFor(inventory, 'shortbow', { ...scenario, rangedTimeShare: undefined })).toMatchObject({ status: 'constrained', issues: [{ target: 'scenario' }] })
    const incompatible: Inventory = { ...inventory, weapons: [{ ...readinessMelee.weapons[0]!, gilded: undefined, enchantmentSlots: [{ candidates: ['void-strike'] }] }] }
    expect(statusFor(incompatible, 'shortbow').status).toBe('constrained')
    expect(statusFor(incompatible, 'shortbow').issues[0]?.message).toContain('interaction')
  })

  it('matches missing Armor HP to the exact armor and updates without erasing any inventory data', () => {
    const inventory: Inventory = { ...readinessMelee, armors: [{ instanceId: 'armor-missing', armorId: 'scale-mail', powerLevel: 251, enchantmentSlots: [{ candidates: ['cool-down'] }] }, { instanceId: 'armor-ready', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 200, enchantmentSlots: [{ candidates: ['cool-down'] }] }] }
    expect(statusFor(inventory, 'armor-missing')).toMatchObject({ status: 'input-required', issues: [{ target: 'equipment', fields: ['カード表示の追加HP（0以上の有限値）'] }] })
    expect(statusFor(inventory, 'armor-ready').status).toBe('evaluated')
    const after: Inventory = { ...inventory, armors: inventory.armors!.map((item) => ({ ...item, observedHealthBonus: 200 })) }
    expect(inspectInventoryReadiness(after, scenario).equipment.every((entry) => entry.status === 'evaluated')).toBe(true)
    const json = serializeInventory(after)
    expect(deserializeInventory(json)).toEqual(after)
    expect(after.weapons).toEqual(readinessMelee.weapons)
  })

  it('does not hide unsupported Armor effects behind missing health', () => {
    const inventory: Inventory = { ...readinessMelee, armors: [{ instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, enchantmentSlots: [{ candidates: ['cool-down'] }], gilded: { enchantmentId: 'unknown-effect', tier: 1 } }] }
    expect(statusFor(inventory, 'armor').status).toBe('unsupported')
    expect(statusFor(inventory, 'armor').issues.some((issue) => issue.kind === 'input-required')).toBe(true)
  })

  it('points mixed damage scales only at the missing melee instance', () => {
    const inventory: Inventory = { ...readinessMelee, weapons: [...readinessMelee.weapons, { ...readinessMelee.weapons[0]!, instanceId: 'other', observedDamagePerHit: undefined }] }
    expect(statusFor(inventory, 'other')).toMatchObject({ status: 'input-required', issues: [{ target: 'equipment', fields: ['表示ダメージ（正の有限値）'] }] })
    expect(statusFor(inventory, 'melee').status).toBe('constrained')
    expect(inspectInventoryReadiness({ ...inventory, weapons: inventory.weapons.map((item) => ({ ...item, observedDamagePerHit: 100 })) }, scenario).equipment.every((entry) => entry.status === 'evaluated')).toBe(true)
  })

  it('identifies Cowardice scenario inputs separately from equipment inputs', () => {
    const inventory: Inventory = { ...readinessMelee, armors: [{ instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 200, enchantmentSlots: [{ candidates: ['cowardice'] }] }] }
    expect(statusFor(inventory, 'armor')).toMatchObject({ status: 'input-required', issues: [{ target: 'scenario', fields: ['Cowardice 満タンHP時間割合（0〜1）'] }] })
    expect(statusFor(inventory, 'armor', { ...scenario, cowardiceFullHealthShare: 0.5 }).status).toBe('evaluated')
  })

  it('uses existing Evidence exclusions and never upgrades missing Evidence from user inputs', () => {
    const inventory: Inventory = { ...readinessMelee, artifacts: [{ instanceId: 'artifact', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }
    const condition = { ...scenario, evidencePolicy: 'high-confidence-only' as const }
    const report = inspectInventoryReadiness(inventory, condition)
    const evaluated = optimizeWithMetadata(inventory, condition).evaluatedInstanceIds
    expect(report.equipment.filter((entry) => entry.status === 'evaluated').map((entry) => entry.instanceId).sort()).toEqual([...evaluated].sort())
    expect(statusFor(inventory, 'artifact', condition).issues.every((issue) => !issue.fields)).toBe(true)
  })

  it.each([0, -1, NaN, Infinity, 'unknown', 'unsupported'])('rejects invalid observation damage %s, never scoring the inventory', (damage) => {
    const invalid = { ...readinessRanged(), observation: { ...readinessRanged().observation!, projectileDamage: damage } }
    expect(() => parseRangedWeapon(invalid)).toThrow()
    const inventory = { ...readinessMelee, rangedWeapons: [invalid] } as unknown as Inventory
    expect(inspectInventoryReadiness(inventory, scenario).equipment.some((entry) => entry.status === 'evaluated')).toBe(false)
    expect(() => optimize(inventory, scenario)).toThrow()
  })

  it('distinguishes actual calculation failure and does not attribute failure to an unrelated unused item', () => {
    const huge = { ...readinessRanged(), observation: { ...readinessRanged().observation!, projectileDamage: Number.MAX_VALUE } }
    const inventory: Inventory = { ...readinessMelee, rangedWeapons: [huge, readinessRanged('crossbow')] }
    expect(statusFor(inventory, 'bow').status).toBe('failed')
    expect(statusFor(inventory, 'crossbow').status).toBe('constrained')
    expect(() => optimize(inventory, scenario)).toThrow()
  })

  it('keeps nonfatal alternatives separate from item blockers when another item stops the search', () => {
    const inventory: Inventory = { ...readinessMelee, weapons: [{ ...readinessMelee.weapons[0]!, powerLevel: 1, gilded: undefined, enchantmentSlots: [{ candidates: ['critical-hit', 'shockwave'] }] }], armors: [{ instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, enchantmentSlots: [{ candidates: ['cool-down'] }] }] }
    expect(statusFor(inventory, 'melee').status).toBe('constrained')
    expect(statusFor(inventory, 'melee').issues.some((issue) => issue.kind === 'unsupported')).toBe(false)
    expect(statusFor(inventory, 'armor').status).toBe('input-required')
  })

  it.each(['melee', 'armor'] as const)('offers the exact %s editor for unfilled enchantment slots', (category) => {
    const inventory: Inventory = category === 'melee'
      ? { ...readinessMelee, weapons: [{ ...readinessMelee.weapons[0]!, enchantmentSlots: [], gilded: undefined }] }
      : { ...readinessMelee, armors: [{ instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [] }] }
    expect(statusFor(inventory, category)).toMatchObject({ status: 'input-required', issues: expect.arrayContaining([{ kind: 'input-required', target: 'equipment', message: expect.stringContaining('1〜3'), fields: expect.any(Array) }]) })
  })

  it('points invalid Armor health at the correct individual instead of treating it as a calculation failure', () => {
    const inventory: Inventory = { ...readinessMelee, armors: [{ instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: -1, enchantmentSlots: [{ candidates: ['cool-down'] }] }] }
    expect(statusFor(inventory, 'armor')).toMatchObject({ status: 'input-required', issues: [{ target: 'equipment', message: expect.stringContaining('observedHealthBonus') }] })
    expect(statusFor(inventory, 'melee').status).toBe('constrained')
  })

  it.each([1, 300])('offers observed damage for melee Power %s without falsifying Power', (powerLevel) => {
    const inventory: Inventory = { ...readinessMelee, weapons: [{ ...readinessMelee.weapons[0]!, powerLevel, observedDamagePerHit: undefined }] }
    expect(statusFor(inventory, 'melee')).toMatchObject({ status: 'input-required', issues: [{ target: 'equipment', fields: [expect.stringContaining('表示ダメージ')] }] })
    expect(statusFor({ ...inventory, weapons: [{ ...inventory.weapons[0]!, observedDamagePerHit: 100 }] }, 'melee').status).toBe('evaluated')
  })

  it('attributes unsupported artifact Power to the artifact without inventing editable internal values', () => {
    const inventory: Inventory = { ...readinessMelee, artifacts: [{ instanceId: 'powder', artifactId: 'shock-powder', powerLevel: 263 }] }
    expect(statusFor(inventory, 'powder')).toMatchObject({ status: 'unsupported', issues: [{ kind: 'unsupported' }] })
    expect(statusFor(inventory, 'powder').issues.some((issue) => issue.fields || issue.target)).toBe(false)
    expect(statusFor(inventory, 'melee').status).toBe('constrained')
  })

  it('classifies duplicate hard-control artifacts as a combination restriction on those instances', () => {
    const inventory: Inventory = { ...readinessMelee, artifacts: [1, 2].map((index) => ({ instanceId: `powder${index}`, artifactId: 'shock-powder', powerLevel: 251 })) }
    expect(statusFor(inventory, 'powder1').status).toBe('constrained')
    expect(statusFor(inventory, 'powder2').status).toBe('constrained')
    expect(statusFor(inventory, 'melee').status).toBe('constrained')
    expect(inspectInventoryReadiness(inventory, scenario).equipment.some((entry) => entry.status === 'failed')).toBe(false)
  })

  it('keeps invalid scenarios, empty inventory and oversized searches unevaluated', () => {
    expect(inspectInventoryReadiness(readinessMelee, { ...scenario, maxHealth: 0 }).equipment[0]?.status).toBe('constrained')
    expect(inspectInventoryReadiness({ weapons: [], artifacts: [] }, scenario)).toMatchObject({ equipment: [], error: expect.any(String) })
    const huge: Inventory = { ...readinessMelee, weapons: Array.from({ length: 25001 }, (_, i) => ({ ...readinessMelee.weapons[0]!, instanceId: `w${i}` })) }
    const report = inspectInventoryReadiness(huge, scenario)
    expect(report.error).toContain('安全上限')
    expect(report.equipment.some((entry) => entry.status === 'evaluated')).toBe(false)
  })
})
