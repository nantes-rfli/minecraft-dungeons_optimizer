import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { RADIANCE_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { updateMeleePower } from '../src/inventory/updateMeleePower'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { undeadShare: 0, enchantedShare: 0 } }
const cycle = 1.65
const weapon: OwnedWeapon = {
  instanceId: 'sun', weaponId: 'suns-grace', powerLevel: 251,
  observedComboDamage: { powerLevel: 251, total: 825 }, observedFixedRadiance: { powerLevel: 251, healPerProc: 44 },
  enchantmentSlots: [{ candidates: ['unchanting'] }],
}
const build: Build = { weapon, artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'radiance', tier: 1, source: 'built-in' }] }
const inventory = (item: OwnedWeapon): Inventory => ({ weapons: [item], artifacts: [] })

describe('Sun’s Grace observed fixed Radiance I', () => {
  it('uses the absolute per-proc observation once, independent of the existing scenario estimate', () => {
    expect(fixedObservedMeleeComboIsEligible('suns-grace')).toBe(true)
    const result = evaluate(build, { ...scenario, radianceHealPerProc: 0 })
    const hps = 3 / cycle
    const healing = hps * 0.2 * 44
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(825 / cycle, 10)
    expect(result.healing.radiancePerSecond).toBeCloseTo(healing, 10)
    expect(evaluate(build, { ...scenario, radianceHealPerProc: 9999 }).healing).toEqual(result.healing)
    expect(result.contributions).toContainEqual(expect.objectContaining({ sourceId: 'radiance', enchantmentSource: 'built-in', healingPerSecondDelta: expect.closeTo(healing, 10) }))
    expect(parameterEvidenceForBuild(build)).toContainEqual(expect.objectContaining({ mechanicId: 'melee:suns-grace', parameterId: 'radiance-heal-per-proc', status: 'measured' }))
    expect(optimize(inventory(weapon), scenario).best.build.enchantments).toEqual(build.enchantments)
    expect(assessEquipment(inventory(weapon), [{ id: 'single', name: 'Single target', scenario }])[0]).toMatchObject({ status: 'complete', equipment: [{ instanceId: 'sun', status: 'evaluated', scoreGap: 0 }] })
  })

  it('requires a positive heal observation from the current Power and rejects duplicate ownership', () => {
    const held = [{ ...weapon, observedFixedRadiance: undefined }, { ...weapon, observedFixedRadiance: { powerLevel: 250, healPerProc: 44 } }]
    for (const item of held) {
      expect(() => evaluate({ ...build, weapon: item }, scenario)).toThrow('現在のPowerでの固定「輝き I」')
      expect(inspectInventoryReadiness(inventory(item), scenario).equipment[0]?.status).toBe('input-required')
      expect(parameterEvidenceForBuild({ ...build, weapon: item })).toContainEqual(expect.objectContaining({ parameterId: 'radiance-heal-per-proc', status: 'unclassified' }))
    }
    expect(() => evaluate({ ...build, enchantments: build.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate({ ...build, enchantments: [build.enchantments[0]!, { enchantmentId: 'radiance', tier: 2, source: 'built-in' }] }, scenario)).toThrow()
    expect(inspectInventoryReadiness(inventory({ ...weapon, gilded: { enchantmentId: 'radiance', tier: 1 } }), scenario).equipment[0]?.status).toBe('unsupported')
    expect(() => evaluate(build, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    const changed = structuredClone(RADIANCE_OBSERVED_MELEE_COMBO_SOURCE)
    changed.rows[0]!.fixed.triggerChance = 0.5
    expect(fixedObservedMeleeComboIsEligible('suns-grace', { radianceSource: changed })).toBe(false)
  })

  it('round-trips typed observations and migrates older ownership without deriving healing', () => {
    expect(deserializeInventory(serializeInventory(inventory(weapon))).weapons).toEqual([weapon])
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [{ instanceId: 'old', category: 'melee', catalogId: 'suns-grace', powerLevel: 251, isFavorite: true }] } }))
    expect(migrated.weapons[0]).toEqual({ instanceId: 'old', weaponId: 'suns-grace', powerLevel: 251, isFavorite: true, enchantmentSlots: [] })
    expect(migrated.catalogItems).toEqual([])
    const updated = updateMeleePower(weapon, 252)
    expect(updated.observedComboDamage).toBeUndefined()
    expect(updated.observedFixedRadiance).toBeUndefined()
    const malformed = { ...weapon, observedFixedRadiance: { powerLevel: 251, healPerProc: 0 } }
    expect(() => deserializeInventory(JSON.stringify({ version: 6, inventory: inventory(malformed) }))).toThrow('healPerProc')
  })

  it('preserves the existing Radiance tier multiplier on other weapons', () => {
    const other: OwnedWeapon = { instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100,
      enchantmentSlots: [{ candidates: ['radiance'], selected: { enchantmentId: 'radiance', tier: 1 } }] }
    const result = evaluate({ ...build, weapon: other, enchantments: [{ enchantmentId: 'radiance', tier: 1, source: 'slot' }] }, { ...scenario, radianceHealPerProc: 44 })
    expect(result.healing.radiancePerSecond).toBeCloseTo(result.damage.hitsPerSecond * 0.2 * 0.5 * 44, 10)
  })
})
