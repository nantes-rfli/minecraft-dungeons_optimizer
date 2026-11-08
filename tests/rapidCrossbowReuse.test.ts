import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import grants from '../research/runtime/ranged-observed-reuse.json'
import review from '../research/sources/rapid-crossbow-source-review.json'
import source from '../research/sources/ranged-source-snapshot.json'
import identities from '../research/domain/formal/identity-evidence-v1.json'
import promotion from '../research/runtime/runtime-promotion-manifest.json'
import { rapidCrossbowReuseIsEligible, rangedReuseIsEligible } from '../src/core/rangedReuse'
import { RANGED_WEAPONS, isRuntimeRangedWeapon } from '../src/data/ranged'
import { evaluate } from '../src/core/evaluate'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { calculateRangedDamage, parseRangedWeapon, rangedOptions, rangedWeaponIssues, requiresExplicitRangedAmmoCost } from '../src/core/ranged'
import { nativeRangedReference } from '../src/domain/rangedNative'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { inventoryGridItemMatchesQuery, inventoryGridItems } from '../src/inventory/gridPresentation'
import { inventoryStatistics } from '../src/inventory/collection'
import { OwnedRangedEditor } from '../src/views/RangedEquipment'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { readinessMelee, readinessRanged } from './inventoryReadinessFixtures'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import type { Build, CatalogResearchAttributes, Inventory } from '../src/core/types'

// Synthetic software arithmetic, not gameplay captures or Native resource-cost evidence.
const scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 10, rangedTimeShare: 0.5 }
const ranged = (): OwnedRangedWeapon => ({ ...readinessRanged('rapid-crossbow'), observation: { ...readinessRanged('rapid-crossbow').observation!, projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 10, arrowsConsumedPerShot: 1 } })
const inventory = (weapon = ranged()): Inventory => ({ ...readinessMelee, rangedWeapons: [weapon] })
const build = (weapon = ranged()): Build => ({ weapon: readinessMelee.weapons[0]!, enchantments: [{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }, { enchantmentId: 'radiance', tier: 1, source: 'gilded' }], artifacts: [], rangedWeapon: weapon, rangedEnchantments: rangedOptions(weapon)[0] ?? [] })

describe('Rapid Crossbow source-bound observed one-arrow model reuse', () => {
  it('adds exactly one equipment/mode pair, keeping Native numbers and Promotion unknown/ineligible', () => {
    expect(isRuntimeRangedWeapon('rapid-crossbow')).toBe(true)
    expect(rapidCrossbowReuseIsEligible()).toBe(true)
    expect(rangedReuseIsEligible('rapid-crossbow', 'single')).toBe(true)
    expect(rangedReuseIsEligible('rapid-crossbow', 'charged')).toBe(false)
    expect(rangedReuseIsEligible('rapid-crossbow', 'uncharged')).toBe(false)
    expect(Object.keys(RANGED_WEAPONS)).toHaveLength(11)
    expect(Object.values(RANGED_WEAPONS).reduce((sum, row) => sum + row.modes.length, 0)).toBe(18)
    for (const id of ['auto-crossbow', 'butterfly-crossbow']) expect(isRuntimeRangedWeapon(id)).toBe(false)
    expect(grants.approvals.find((entry) => entry.targetId === 'rapid-crossbow')?.nonInheritedEffects).toContain('Butterfly Crossbow Bonus Shot')
    expect(review.intrinsicDisposition).toContain('No Accelerate or Bonus Shot variant effect is inherited.')
    expect(review.nativeResourceCost).toEqual({ state: 'unknown', runtimeNumericInput: false })
    expect(review.nativeFinalProjectileDamage.state).toBe('unknown')
    expect(review.nativeEffectiveShotCycleSeconds.state).toBe('unknown')
    expect(nativeRangedReference('rapid-crossbow').state).toBe('unknown')
    expect(promotion.summary).toMatchObject({ candidates: 1, eligible: 0, promoted: 0 })
  })

  it('uses own observed complete cycles and finite arrows, including legitimate stock 0', () => {
    const result = evaluate(build(), scenario)
    expect(result.damage.ranged).toMatchObject({ shots: 2, ammoConsumed: 2, directSingleTargetDps: 20, shotCycleSeconds: 2, ammoLimited: false })
    expect(optimize(inventory(), scenario).best.damage.ranged).toEqual(result.damage.ranged)
    expect(evaluate(build({ ...ranged(), observation: { ...ranged().observation!, availableAmmo: 1 } }), scenario).damage.ranged).toMatchObject({ shots: 1, directSingleTargetDps: 10, ammoLimited: true })
    const empty = { ...ranged(), observation: { ...ranged().observation!, availableAmmo: 0 } }
    expect(evaluate(build(empty), scenario).damage.ranged).toMatchObject({ shots: 0, directSingleTargetDps: 0, ammoConsumed: 0 })
    expect(inspectInventoryReadiness(inventory(empty), scenario).equipment.find((entry) => entry.instanceId === empty.instanceId)?.status).toBe('evaluated')
    const evidence = parameterEvidenceForBuild(build()).find((entry) => entry.parameterId === 'arrows-consumed-per-shot')!
    expect(evidence).toMatchObject({ status: 'measured', gameVersion: '1.17.0.0' })
    expect(evidence.conditions).toContain('1通常矢の明示観測')
  })

  it.each([0, 10])('rejects missing cost even with %s arrows and never persists a default 1', (availableAmmo) => {
    const weapon = { ...ranged(), observation: { ...ranged().observation!, availableAmmo, arrowsConsumedPerShot: undefined } }
    const parsed = parseRangedWeapon(weapon)
    expect(parsed.observation).not.toHaveProperty('arrowsConsumedPerShot')
    expect(rangedWeaponIssues(parsed)).toContainEqual(expect.objectContaining({ kind: 'input-required', fields: expect.arrayContaining([expect.stringContaining('消費数')]) }))
    expect(() => evaluate(build(parsed), scenario)).toThrow('消費矢数')
    expect(() => optimize(inventory(parsed), scenario)).toThrow('消費矢数')
    expect(() => calculateRangedDamage(build(parsed), scenario)).toThrow('消費矢数')
    expect(parameterEvidenceForBuild(build(parsed)).find((entry) => entry.parameterId === 'arrows-consumed-per-shot')?.status).toBe('unclassified')
  })

  it.each(Object.keys(RANGED_WEAPONS))('retains explicit cost 0/2 but rejects it on %s; preserves old field-absent shape', (id) => {
    const original = readinessRanged(id)
    for (const cost of [0, 2]) {
      const weapon = parseRangedWeapon({ ...original, observation: { ...original.observation!, arrowsConsumedPerShot: cost, availableAmmo: 0 } })
      expect(weapon.observation?.arrowsConsumedPerShot).toBe(cost)
      expect(rangedWeaponIssues(weapon)).toContainEqual(expect.objectContaining({ kind: 'unsupported', message: expect.stringContaining(`消費数${cost}`) }))
      expect(() => evaluate(build(weapon), scenario)).toThrow('消費数')
      expect(() => optimize(inventory(weapon), scenario)).toThrow('消費数')
      expect(deserializeInventory(serializeInventory(inventory(weapon))).rangedWeapons?.[0]?.observation?.arrowsConsumedPerShot).toBe(cost)
    }
    if (!requiresExplicitRangedAmmoCost(id)) {
      expect(parseRangedWeapon(original).observation).not.toHaveProperty('arrowsConsumedPerShot')
      expect(deserializeInventory(serializeInventory(inventory(original))).rangedWeapons?.[0]).toEqual(original)
      expect(parameterEvidenceForBuild(build(original)).some((entry) => entry.parameterId === 'arrows-consumed-per-shot')).toBe(false)
      const declared = { ...original, observation: { ...original.observation!, arrowsConsumedPerShot: 1 } }
      expect(evaluate(build(original), scenario).damage.ranged).toEqual(evaluate(build(declared), scenario).damage.ranged)
    }
  })

  it.each([null, -1, 0.5, '1', Number.NaN, Infinity])('rejects malformed consumption authority %s before arithmetic', (cost) => {
    expect(() => parseRangedWeapon({ ...ranged(), observation: { ...ranged().observation!, arrowsConsumedPerShot: cost } })).toThrow('arrowsConsumedPerShot')
  })

  it('fails closed on source review withdrawal, source identity, values, mode duplicate and Native overclaim', () => {
    expect(rapidCrossbowReuseIsEligible(grants.approvals.filter((entry) => entry.targetId !== 'rapid-crossbow'))).toBe(false)
    const duplicate = [...grants.approvals, grants.approvals.find((entry) => entry.targetId === 'rapid-crossbow')!]
    expect(rapidCrossbowReuseIsEligible(duplicate)).toBe(false)
    const changed = structuredClone(review)
    changed.packages[1]!.sources[0]!.sha256 = 'wrong'
    expect(rapidCrossbowReuseIsEligible(grants.approvals, source, changed)).toBe(false)
    const functionAdded = structuredClone(review)
    functionAdded.packages[1]!.ownFunctionExports = 1
    expect(rapidCrossbowReuseIsEligible(grants.approvals, source, functionAdded)).toBe(false)
    const extraComponent = structuredClone(review)
    extraComponent.knownComponents.overrideClasses.push('DamageComponent')
    expect(rapidCrossbowReuseIsEligible(grants.approvals, source, extraComponent)).toBe(false)
    const nativeOverclaim = structuredClone(review)
    nativeOverclaim.nativeResourceCost.state = 'known'
    expect(rapidCrossbowReuseIsEligible(grants.approvals, source, nativeOverclaim)).toBe(false)
    const identity = structuredClone(identities)
    identity.identityAssertions.find((entry) => entry.domainId === 'rapid-crossbow')!.reviewState = 'held'
    expect(rapidCrossbowReuseIsEligible(grants.approvals, source, review, identity)).toBe(false)
    const extraIntrinsic = structuredClone(source)
    extraIntrinsic.weapons.rows.find((entry) => entry.id === 'rapid-crossbow')!.facts.push('unreviewed extra effect')
    expect(rapidCrossbowReuseIsEligible(grants.approvals, extraIntrinsic)).toBe(false)
    expect(rangedReuseIsEligible('shortbow', 'charged', grants.approvals.filter((entry) => entry.targetId !== 'rapid-crossbow'))).toBe(true)
  })

  it('keeps all existing unsupported combinations and input requirements fail closed', () => {
    expect(() => evaluate({ ...build(), rangedWeapon: { ...ranged(), gilded: { enchantmentId: 'accelerate', tier: 1 } } }, scenario)).toThrow('Research-only')
    expect(() => evaluate(build(), { ...scenario, rangedTimeShare: undefined })).toThrow('時間割合')
    expect(() => evaluate({ ...build(), rangedWeapon: { ...ranged(), observation: { ...ranged().observation!, mode: 'charged' } } }, scenario)).toThrow('mode')
  })
})

describe('Rapid Catalog migration, retained Research and per-mode observation UI', () => {
  it.each([1, 2, 3, 4, 5, 6])('migrates only old Rapid Catalog records in v%s without inferring observations', (version) => {
    const research: CatalogResearchAttributes = { enchantments: [{ enchantmentId: 'power', tier: 2, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 1, source: 'gilded' }], intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'High Firerate' }], observations: [{ parameterId: 'arrowsConsumedPerShot', value: '1' }, { parameterId: 'damage', value: '99999' }] }
    const item = { instanceId: 'saved-rapid', category: 'ranged', catalogId: 'rapid-crossbow', powerLevel: 251, rarity: 'rare', isFavorite: true, notes: 'keep exact notes', research, enchantmentSlots: [{ candidates: ['power', 'accelerate'], selected: { enchantmentId: 'power', tier: 2 } }], gilded: { enchantmentId: 'critical-hit', tier: 1 } }
    const result = deserializeInventory(JSON.stringify({ version, inventory: { ...readinessMelee, catalogItems: [item, { instanceId: 'unique', category: 'ranged', catalogId: 'auto-crossbow', powerLevel: 251 }] } }))
    expect(result.rangedWeapons?.[0]).toEqual({ instanceId: item.instanceId, weaponId: item.catalogId, powerLevel: item.powerLevel, rarity: item.rarity, isFavorite: true, notes: item.notes, research, enchantmentSlots: item.enchantmentSlots, gilded: item.gilded })
    expect(result.rangedWeapons?.[0]).not.toHaveProperty('observation')
    expect(result.catalogItems?.map((entry) => entry.catalogId)).toEqual(['auto-crossbow'])
    expect(deserializeInventory(serializeInventory(result))).toEqual(result)
    const observed = { ...result.rangedWeapons![0]!, observation: ranged().observation }
    expect(evaluate(build(observed), scenario).damage.ranged?.shots).toBe(2)
  })

  it('preserves research-only slot/Gilded facts in search/statistics while keeping observations absent', () => {
    const result = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [{ instanceId: 'research-rapid', category: 'ranged', catalogId: 'rapid-crossbow', powerLevel: 251, research: { enchantments: [{ enchantmentId: 'power', tier: 2, source: 'slot' }, { enchantmentId: 'accelerate', tier: 1, source: 'gilded' }] } }] } }))
    expect(result.rangedWeapons?.[0]).toMatchObject({ enchantmentSlots: [] })
    expect(result.rangedWeapons?.[0]).not.toHaveProperty('gilded')
    expect(result.rangedWeapons?.[0]).not.toHaveProperty('observation')
    const item = inventoryGridItems(result).find((entry) => entry.instanceId === 'research-rapid')!
    expect(item.gilded).toBe(true)
    expect(inventoryGridItemMatchesQuery(item, 'accelerate')).toBe(true)
    expect(inventoryStatistics(result)).toMatchObject({ gildedItems: 2, enchantments: expect.arrayContaining([{ id: 'accelerate', name: expect.any(String), count: 1 }]) })
    expect(rangedWeaponIssues(result.rangedWeapons![0]!).some((issue) => issue.kind === 'unsupported' && issue.message.includes('RESEARCH'))).toBe(true)
  })

  it.each([
    { enchantments: [{ enchantmentId: 'accelerate', tier: 1, source: 'built-in' }] },
    { enchantments: [{ enchantmentId: 'power', tier: 1, source: 'gilded' }] },
    { enchantments: [{ enchantmentId: 'power', tier: 2, source: 'slot' }] },
    { enchantments: [{ enchantmentId: 'power', tier: 3, source: 'slot' }, { enchantmentId: 'power', tier: 3, source: 'slot' }] },
    { intrinsicProperties: [{ kind: 'other', raw: 'unmodeled effect' }] },
  ] as CatalogResearchAttributes[])('rejects unmatched retained effects in evaluate and optimizer: %j', (research) => {
    const weapon = { ...ranged(), research }
    expect(() => evaluate(build(weapon), scenario)).toThrow('UNSUPPORTED_RANGED_RESEARCH')
    expect(() => optimize(inventory(weapon), scenario)).toThrow('UNSUPPORTED_RANGED_RESEARCH')
  })

  it('rejects malformed Research and cross-category duplicate IDs; old field-absent categories retain shape', () => {
    expect(() => parseRangedWeapon({ ...ranged(), research: { enchantments: [{ enchantmentId: 'power', tier: 9, source: 'slot' }] } })).toThrow('research')
    expect(() => deserializeInventory(JSON.stringify({ version: 6, inventory: { ...inventory(), catalogItems: [{ instanceId: 'rapid-crossbow', category: 'ranged', catalogId: 'rapid-crossbow', powerLevel: 251 }] } }))).toThrow('重複')
    expect(deserializeInventory(serializeInventory(readinessMelee))).toEqual(readinessMelee)
  })

  it('shows the cost field only for Rapid or explicitly recorded legacy observations, preserving 0 in the editor', () => {
    const render = (weapon: OwnedRangedWeapon) => renderToStaticMarkup(createElement(OwnedRangedEditor, { weapon, onChange: () => undefined, onRemove: () => undefined }))
    expect(render(ranged())).toContain('rapid-crossbow arrowsConsumedPerShot')
    expect(render(readinessRanged('bow'))).not.toContain('bow arrowsConsumedPerShot')
    const zero = { ...readinessRanged('bow'), observation: { ...readinessRanged('bow').observation!, arrowsConsumedPerShot: 0 } }
    expect(render(zero)).toMatch(/aria-label="bow arrowsConsumedPerShot"[^>]*value="0"/)
  })
})
