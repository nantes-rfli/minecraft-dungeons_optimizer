import { describe, expect, it } from 'vitest'
import approvals from '../research/runtime/plain-melee-reuse.json'
import source from '../research/sources/plain-melee-source-snapshot.json'
import identities from '../research/domain/formal/identity-evidence-v1.json'
import intrinsicSource from '../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json'
import auditProfiles from '../research/melee-attack-profile-audit.json'
import promotion from '../research/runtime/runtime-promotion-manifest.json'
import { PLAIN_MELEE_IDS, type PlainMeleeId } from '../src/data/plainMelee'
import { WEAPONS } from '../src/data/weapons'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { collectPlainMeleeReuseErrors, plainMeleeReuseIsEligible } from '../src/core/plainMeleeReuse'
import { evaluate } from '../src/core/evaluate'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { summarizeDamageRegressionByScope } from '../src/core/modelError'
import { summarizePowerScalingValidation } from '../src/core/powerScalingValidation'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { inventoryGridItemMatchesQuery, inventoryGridItems } from '../src/inventory/gridPresentation'
import { inventoryStatistics } from '../src/inventory/collection'
import { readinessRanged } from './inventoryReadinessFixtures'
import type { Build, CatalogResearchAttributes, EnchantmentId, Inventory, OwnedWeapon, WeaponId } from '../src/core/types'

// Software arithmetic only: these fixtures are not game observations or R3 Evidence.
const scenario = SCENARIO_PROFILES.boss
const build = (id: WeaponId, enchantmentId: EnchantmentId = 'critical-hit'): Build => ({
  weapon: { instanceId: id, weaponId: id, powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: [enchantmentId] }] },
  enchantments: [{ enchantmentId, tier: 3, source: 'slot' }], artifacts: [],
})
const inventory = (weapon: OwnedWeapon): Inventory => ({ weapons: [weapon], artifacts: [] })
const withResearch = (research: CatalogResearchAttributes, id: WeaponId = 'cutlass'): Build => {
  const value = build(id)
  return { ...value, weapon: { ...value.weapon, research } }
}

describe('source-bound single-target plain melee population', () => {
  it('binds exactly four own identities, stats, complete intrinsic scopes and published uniform profiles', () => {
    expect(collectPlainMeleeReuseErrors()).toEqual([])
    expect(approvals.approvals.map((entry) => entry.targetId)).toEqual([...PLAIN_MELEE_IDS])
    for (const id of PLAIN_MELEE_IDS) expect(plainMeleeReuseIsEligible(id)).toBe(true)
    for (const id of ['great-hammer', 'diamond-pickaxe', 'frost-scythe', 'cursed-axe', 'vine-whip']) expect(plainMeleeReuseIsEligible(id)).toBe(false)
    expect(promotion.summary).toMatchObject({ candidates: 1, eligible: 0, promoted: 0 })
  })

  it.each(PLAIN_MELEE_IDS)('evaluates and optimizes %s using own base timing, never the Speed rating', (id) => {
    const value = build(id), result = evaluate(value, scenario)
    const row = source.rows.find((entry) => entry.id === id)!
    const expectedHps = row.hitDurationsSeconds.length / row.hitDurationsSeconds.reduce((sum, seconds) => sum + seconds, 0)
    expect(result.damage.hitsPerSecond).toBeCloseTo(expectedHps, 12)
    expect(result.damage.singleTargetDps).toBeCloseTo(100 * expectedHps * 1.4, 10)
    expect(result.damage.aoeDps).toBe(result.damage.singleTargetDps)
    expect(result.damage.expectedTargetsHit).toBe(1)
    expect(result.reasons.some((reason) => reason.includes('Limited') && reason.includes('pending'))).toBe(true)
    const optimized = optimize(inventory(value.weapon), scenario)
    expect(optimized.best.damage.singleTargetDps).toBe(result.damage.singleTargetDps)
    expect(inspectInventoryReadiness(inventory(value.weapon), scenario).equipment[0]?.status).toBe('evaluated')
    expect(parameterEvidenceForBuild(value).filter((entry) => entry.mechanicId === `melee:${id}`).every((entry) => entry.status === 'derived')).toBe(true)
  })

  it.each(PLAIN_MELEE_IDS)('uses the existing bounded Power curve or explicit neutral observed hit for %s', (id) => {
    const value = build(id), curve = { ...value, weapon: { ...value.weapon, observedDamagePerHit: undefined } }
    expect(evaluate(curve, scenario).damage.damagePerHit).toBe(Math.round(1_792_941 * WEAPONS[id].internalPowerRating.value / 14))
    expect(() => evaluate({ ...curve, weapon: { ...curve.weapon, powerLevel: 264 } }, scenario)).toThrow('Power')
    expect(evaluate({ ...value, weapon: { ...value.weapon, powerLevel: 264 } }, scenario).damage.damagePerHit).toBe(100)
    expect(() => optimize({ weapons: [value.weapon, { ...curve.weapon, instanceId: 'mixed' }], artifacts: [] }, scenario)).toThrow()
    expect(() => evaluate(value, { ...scenario, averageTargetsInReach: 1.01 })).toThrow('averageTargetsInReach=1')
    expect(() => optimize(inventory(value.weapon), { ...scenario, averageTargetsInReach: 2 })).toThrow('No supported Melee')
    const readiness = inspectInventoryReadiness(inventory(value.weapon), { ...scenario, averageTargetsInReach: 2 })
    expect(readiness.equipment[0]).toMatchObject({ status: 'constrained', issues: expect.arrayContaining([expect.objectContaining({ target: 'scenario' })]) })
  })

  it('keeps old Full equipment eligible when new Limited gear is constrained', () => {
    const old = build('double-axe'), limited = build('cutlass')
    const result = optimize({ weapons: [old.weapon, limited.weapon], artifacts: [] }, DEFAULT_SCENARIO)
    expect(result.best.build.weapon.weaponId).toBe('double-axe')
    expect(result.unsupportedChoices.join(' ')).toContain('averageTargetsInReach=1')
    for (const id of ['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe'] as const) {
      expect(getEquipmentCatalogEntry('melee', id)?.runtimeSupport).toBe('full')
      expect(evaluate(build(id), DEFAULT_SCENARIO).damage.damagePerHit).toBe(100)
    }
    for (const id of PLAIN_MELEE_IDS) expect(getEquipmentCatalogEntry('melee', id)?.runtimeSupport).toBe('limited')
    expect(PLAIN_MELEE_IDS.map((id) => WEAPONS[id].name.ja)).toEqual(['カトラス', 'ツルハシ', '魂のナイフ', '鞭'])
  })

  it.each(['pain-cycle', 'dynamo', 'rampaging'] as const)('rejects unreviewed %s on every new plain target', (enchantmentId) => {
    for (const id of PLAIN_MELEE_IDS) {
      expect(() => evaluate(build(id, enchantmentId), scenario)).toThrow()
      expect(() => optimize(inventory(build(id, enchantmentId).weapon), scenario)).toThrow()
    }
  })

  it('rejects Mushroom and every registered Armor speed source; preserves non-speed health/DR armor', () => {
    for (const id of PLAIN_MELEE_IDS) {
      const value = build(id)
      expect(() => evaluate({ ...value, artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow('SPEED_OR_CHARGE')
      for (const armorId of ['renegade-armor', 'spider-armor', 'thief-armor', 'hungry-horror', 'hungriest-horror'] as const) {
        const armor = { instanceId: armorId, armorId, powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] }
        expect(() => evaluate({ ...value, armor, armorEnchantments: [{ enchantmentId: 'cool-down', tier: 3, source: 'slot' }] }, scenario)).toThrow('SPEED_OR_CHARGE')
        expect(() => optimize({ ...inventory(value.weapon), armors: [armor] }, scenario)).toThrow()
      }
      const armor = { instanceId: 'scale', armorId: 'scale-mail' as const, powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] }
      expect(optimize({ ...inventory(value.weapon), armors: [armor] }, scenario).best.build.armor?.armorId).toBe('scale-mail')
    }
  })

  it('reuses Soul Knife own +1 gathering without granting Soul effects to other targets or Ranged attribution', () => {
    expect(evaluate(build('soul-knife', 'anima-conduit'), scenario).soulState?.totalSoulGathering).toBe(2)
    for (const id of ['cutlass', 'pickaxe', 'whip'] as const) expect(() => evaluate(build(id, 'anima-conduit'), scenario)).toThrow('Soul')
    expect(() => evaluate({ ...build('soul-knife'), rangedWeapon: readinessRanged(), rangedEnchantments: [] }, { ...scenario, rangedTimeShare: 0.4 })).toThrow('Soul Gathering')
    expect(() => optimize({ ...inventory(build('soul-knife').weapon), rangedWeapons: [readinessRanged()] }, { ...scenario, rangedTimeShare: 0.4 })).toThrow('Ranged')
  })

  it.each(['cutlass', 'pickaxe', 'soul-knife', 'whip'] as PlainMeleeId[])('does not fabricate independent DPS/error or Power samples for %s', (id) => {
    expect(summarizeDamageRegressionByScope([]).byWeapon[id]).toEqual({ status: 'pending', sampleCount: 0, minimumSampleCount: 5 })
    expect(() => summarizePowerScalingValidation(id, [])).toThrow('sampleがありません')
  })

  it('fails closed on source/version/identity/parameter/timing/intrinsic/effect-classification drift', () => {
    const changedSource = structuredClone(source)
    changedSource.gameVersion = 'wrong-version'
    expect(plainMeleeReuseIsEligible('cutlass', { source: changedSource })).toBe(false)
    const changedStats = structuredClone(source)
    changedStats.rows[0]!.calculatorRow.power += 1
    expect(plainMeleeReuseIsEligible('cutlass', { source: changedStats })).toBe(false)
    const extraIntrinsic = structuredClone(source)
    extraIntrinsic.rows[0]!.intrinsicFacts.push('unknown extra effect')
    expect(plainMeleeReuseIsEligible('cutlass', { source: extraIntrinsic })).toBe(false)
    const changedGrants = structuredClone(approvals)
    changedGrants.approvals[0]!.classification = 'verified'
    expect(plainMeleeReuseIsEligible('cutlass', { approvals: changedGrants })).toBe(false)
    const changedIdentity = structuredClone(identities)
    changedIdentity.identityAssertions.find((entry) => entry.domainId === 'cutlass')!.reviewState = 'held'
    expect(plainMeleeReuseIsEligible('cutlass', { identities: changedIdentity })).toBe(false)
    const changedDefinition = { ...WEAPONS, 'soul-knife': { ...WEAPONS['soul-knife'], soul: { ...WEAPONS['soul-knife'].soul, baseSoulGathering: { ...WEAPONS['soul-knife'].soul.baseSoulGathering, source: { ...WEAPONS['soul-knife'].soul.baseSoulGathering.source, kind: 'frame-analysis' as const } } } } }
    expect(plainMeleeReuseIsEligible('soul-knife', { weapons: changedDefinition })).toBe(false)
    const changedProfiles = { ...ATTACK_PROFILES, cutlass: { ...ATTACK_PROFILES.cutlass, value: { method: 'published-hit-timings' as const, hitDurationsSeconds: [0.8], comboFinisherHit: 1 } } }
    expect(plainMeleeReuseIsEligible('cutlass', { runtimeProfiles: changedProfiles })).toBe(false)
    const duplicate = structuredClone(approvals)
    duplicate.approvals.push(duplicate.approvals[0]!)
    expect(collectPlainMeleeReuseErrors({ approvals: duplicate }).length).toBeGreaterThan(0)
    const rogueWeapons = { ...WEAPONS, rogue: WEAPONS.cutlass }
    expect(collectPlainMeleeReuseErrors({ weapons: rogueWeapons }).join(' ')).toContain('finite reviewed')
    const changedIntrinsic = structuredClone(intrinsicSource)
    changedIntrinsic.claims.find((claim) => claim.entityId === 'melee-weapon:cutlass' && claim.property === 'intrinsicMechanicOwnership')!.sourceId = 'wrong-source'
    expect(plainMeleeReuseIsEligible('cutlass', { intrinsicSource: changedIntrinsic })).toBe(false)
    const changedTimingSource = structuredClone(auditProfiles)
    changedTimingSource.weapons.find((entry) => entry.weaponId === 'cutlass')!.sources[0]!.type = 'inference'
    expect(plainMeleeReuseIsEligible('cutlass', { profiles: changedTimingSource })).toBe(false)
  })

  it.each(['target-version', 'claim-id', 'claim-version', 'claim-locator', 'claim-interpretation', 'source-url', 'source-version', 'source-type', 'source-status', 'withdraw-claim', 'withdraw-source'])('rejects independent intrinsic provenance drift: %s', (field) => {
    const changed = structuredClone(intrinsicSource)
    const claimIndex = changed.claims.findIndex((entry) => entry.entityId === 'melee-weapon:cutlass' && entry.property === 'intrinsicMechanicOwnership')
    const sourceIndex = changed.sources.findIndex((entry) => entry.id === 'external-dungeons-tools:melee-weapon:cutlass')
    const claim = changed.claims[claimIndex]!, record = changed.sources[sourceIndex]!
    if (field === 'target-version') changed.targetGameVersion = 'unknown'
    if (field === 'claim-id') claim.sourceId = 'other-source'
    if (field === 'claim-version') claim.sourceGameVersion = 'unknown'
    if (field === 'claim-locator') claim.sourceLocator = 'unreviewed section'
    if (field === 'claim-interpretation') claim.interpretation = 'inferred'
    if (field === 'source-url') record.url = 'https://example.com/unrelated'
    if (field === 'source-version') record.gameVersion = 'unknown'
    if (field === 'source-type') record.sourceType = 'inference'
    if (field === 'source-status') record.versionStatus = 'unknown'
    if (field === 'withdraw-claim') changed.claims.splice(claimIndex, 1)
    if (field === 'withdraw-source') changed.sources.splice(sourceIndex, 1)
    expect(plainMeleeReuseIsEligible('cutlass', { intrinsicSource: changed })).toBe(false)
  })
})

describe('lossless finite plain melee Catalog migration and no-ignore Research', () => {
  it.each([1, 2, 3, 4, 5, 6])('migrates only the reviewed four old Catalog identities in version %s', (version) => {
    const items = PLAIN_MELEE_IDS.map((id) => ({ instanceId: id, category: 'melee', catalogId: id, powerLevel: 251, rarity: 'rare', isFavorite: true, notes: 'keep me', enchantmentSlots: [{ candidates: ['critical-hit', 'echo'], selected: { enchantmentId: 'critical-hit', tier: 2 } }], gilded: { enchantmentId: 'radiance', tier: 1 }, research: { observations: [{ parameterId: 'damage', value: '99999', unit: 'unverified' }] } }))
    const result = deserializeInventory(JSON.stringify({ version, inventory: { weapons: [], artifacts: [], catalogItems: [...items, { instanceId: 'diamond', category: 'melee', catalogId: 'diamond-pickaxe', powerLevel: 251 }] } }))
    expect(result.weapons).toHaveLength(4)
    for (const weapon of result.weapons) {
      expect(weapon).toMatchObject({ isFavorite: true, rarity: 'rare', notes: 'keep me', enchantmentSlots: items[0]!.enchantmentSlots, gilded: items[0]!.gilded, research: items[0]!.research })
      expect(weapon.observedDamagePerHit).toBeUndefined()
    }
    expect(result.catalogItems?.map((entry) => entry.catalogId)).toEqual(['diamond-pickaxe'])
    expect(deserializeInventory(serializeInventory(result))).toEqual(result)
  })

  it('retains unfilled old Research records, searchable Gilded facts and stats without inventing runtime rolls', () => {
    const research: CatalogResearchAttributes = { enchantments: [{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }, { enchantmentId: 'echo', tier: 1, source: 'gilded' }], observations: [{ parameterId: 'damage', value: '999' }] }
    const result = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [{ instanceId: 'cutlass', category: 'melee', catalogId: 'cutlass', powerLevel: 251, research }] } }))
    expect(result.weapons[0]).toMatchObject({ enchantmentSlots: [], research })
    expect(result.weapons[0]?.gilded).toBeUndefined()
    const item = inventoryGridItems(result)[0]!
    expect(item.gilded).toBe(true)
    expect(inventoryGridItemMatchesQuery(item, 'echo')).toBe(true)
    expect(inventoryStatistics(result)).toMatchObject({ gildedItems: 1, enchantments: expect.arrayContaining([{ id: 'echo', name: expect.any(String), count: 1 }, { id: 'critical-hit', name: expect.any(String), count: 1 }]) })
    expect(() => optimize(result, scenario)).toThrow()
  })

  it.each([
    { enchantments: [{ enchantmentId: 'echo', tier: 1, source: 'built-in' }] },
    { enchantments: [{ enchantmentId: 'radiance', tier: 1, source: 'gilded' }] },
    { enchantments: [{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }] },
    { enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 3, source: 'slot' }] },
    { intrinsicProperties: [{ kind: 'unknown', raw: 'unmodeled fixed effect' }] },
  ] as CatalogResearchAttributes[])('rejects retained unmatched Research in both direct evaluation and optimization: %j', (research) => {
    const value = withResearch(research)
    expect(() => evaluate(value, scenario)).toThrow('UNSUPPORTED_MELEE_RESEARCH')
    expect(() => optimize(inventory(value.weapon), scenario)).toThrow('UNSUPPORTED_MELEE_RESEARCH')
  })

  it('permits only explicitly reconciled recorded slot/Gilded/Tier and exact reviewed intrinsic facts', () => {
    const research: CatalogResearchAttributes = { enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }, { enchantmentId: 'radiance', tier: 1, source: 'gilded' }], intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'Reliable Combo' }], observations: [{ parameterId: 'damage', value: '99999' }] }
    const value = withResearch(research)
    const reconciled: Build = { ...value, weapon: { ...value.weapon, gilded: { enchantmentId: 'radiance', tier: 1 } }, enchantments: [...value.enchantments, { enchantmentId: 'radiance', tier: 1, source: 'gilded' }] }
    expect(evaluate(reconciled, scenario).damage.damagePerHit).toBe(100)
    expect(optimize(inventory(reconciled.weapon), scenario).best.damage.damagePerHit).toBe(100)
    const duplicate = { ...reconciled, weapon: { ...reconciled.weapon, research: { enchantments: [...research.enchantments!, research.enchantments![1]!] } } }
    expect(() => evaluate(duplicate, scenario)).toThrow('UNSUPPORTED_MELEE_RESEARCH')
  })

  it('rejects malformed Research and duplicate instance IDs, and preserves legacy weapon JSON shape', () => {
    expect(() => deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [{ ...build('cutlass').weapon, research: { enchantments: [{ enchantmentId: 'echo', tier: 9, source: 'built-in' }] } }], artifacts: [] } }))).toThrow('research')
    expect(() => deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [build('cutlass').weapon], artifacts: [], catalogItems: [{ instanceId: 'cutlass', category: 'melee', catalogId: 'cutlass', powerLevel: 251 }] } }))).toThrow('重複')
    const old = inventory(build('double-axe').weapon)
    expect(deserializeInventory(serializeInventory(old))).toEqual(old)
    expect(deserializeInventory(serializeInventory(old)).weapons[0]).not.toHaveProperty('research')
  })
})
