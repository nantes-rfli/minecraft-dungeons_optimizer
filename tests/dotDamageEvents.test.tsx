import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import audit from '../research/dot-damage-event-audit.json'
import { calculateDamage } from '../src/core/damage'
import { calculateDotDamageEvents, calculateExplosionDamageEvents, finiteBurnUptime, interpolateDotDps, saturatedTargetExposure } from '../src/core/dotDamageEvents'
import { enchantmentUnsupportedReason } from '../src/core/damageEvents'
import { solveBracketedUnitFixedPoint } from '../src/core/fixedPoint'
import { evaluate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { validateScenario } from '../src/core/validation'
import { getAttackProfile } from '../src/core/catalog'
import type { Build, EnchantmentId, EnchantmentTier, Scenario, SelectedEnchantment, WeaponId } from '../src/core/types'
import { DOT_DAMAGE_CURVES, DOT_DAMAGE_IDS, DOT_EXCLUDED_RUNTIME_POWERS, DOT_EXPLOSION_IDS, DOT_PUBLISHED_ROWS, DOT_TIER_MULTIPLIERS } from '../src/data/dotDamageEvents'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'
import { DamageEventDetails, PersistentAreaTargetingControl, ProcPowerSupport } from '../src/views/DamageEventControls'

const effects = { attackSpeedMultiplier: 1, damageTakenMultiplier: 1, uptimes: [], stackingGroups: [] }
const selected = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
const scenario: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 100, directKillShare: 1, enemySupplyPerSecond: 1, averageTargetsInReach: 2 }
function buildFor(ids: SelectedEnchantment[], weaponId: WeaponId = 'double-axe', observedDamagePerHit = 100): Build {
  const gilded = ids.find((item) => item.source === 'gilded')
  return { weapon: { weaponId, instanceId: 'dot-test', powerLevel: 251, observedDamagePerHit,
    enchantmentSlots: ids.filter((s) => s.source === 'slot').map((s) => ({ candidates: [s.enchantmentId] })),
    ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}),
  }, enchantments: ids, artifacts: [] }
}
const run = (ids: SelectedEnchantment[], context = scenario) => evaluate(buildFor(ids), context)
const damage = (ids: SelectedEnchantment[], speed = 1, context = scenario) => calculateDamage(buildFor(ids).weapon, ids, effects, context, speed)
afterEach(() => vi.unstubAllGlobals())

describe('DoT source units, raw tables and support boundary', () => {
  it.each(DOT_DAMAGE_IDS)('%s matches every included knot and tier within rounding tolerance', (id) => {
    const entry = audit.entries.find((e) => e.id === id)!
    expect(entry.powerScaling.publishedRows).toEqual(DOT_PUBLISHED_ROWS[id])
    expect(entry.powerScaling.excludedRuntimePowers).toEqual(DOT_EXCLUDED_RUNTIME_POWERS[id])
    for (const [power, ...tiers] of DOT_PUBLISHED_ROWS[id]) {
      if (DOT_EXCLUDED_RUNTIME_POWERS[id].includes(power)) continue
      const base = interpolateDotDps(DOT_DAMAGE_CURVES[id].value, power)
      expect(base).toBe(tiers[0])
      for (const tier of [1, 2, 3] as const) {
        const actual = base * DOT_TIER_MULTIPLIERS[id][tier]
        expect(Math.abs(actual - tiers[tier - 1]!)).toBeLessThanOrEqual(Math.max(1, tiers[tier - 1]! * 0.001))
      }
    }
  })
  it('retains 126649 only in raw Fire250 and interpolates neighboring knots monotonically', () => {
    const curve = DOT_DAMAGE_CURVES['fire-aspect'].value
    expect(DOT_PUBLISHED_ROWS['fire-aspect'].find(([power]) => power === 250)![1]).toBe(126649)
    expect(curve.points.some((p) => p.powerLevel === 250)).toBe(false)
    expect(interpolateDotDps(curve, 250)).toBeCloseTo(Math.sqrt(206102 * 226443), 6)
    expect(interpolateDotDps(curve, 250)).toBeGreaterThan(interpolateDotDps(curve, 249))
    expect(interpolateDotDps(curve, 250)).toBeLessThan(interpolateDotDps(curve, 251))
    expect(audit.fireOutlier.cause).toBe('unconfirmed')
  })
  it.each(DOT_DAMAGE_IDS)('%s rejects out-of-range Power even with observed hit damage', (id) => {
    const minimum = id === 'fire-aspect' ? 70 : 184
    for (const powerLevel of [minimum - 1, 252, NaN, Infinity]) {
      const build = buildFor([selected(id)])
      expect(enchantmentUnsupportedReason({ ...build.weapon, powerLevel }, id)).toContain('外挿しません')
      expect(() => calculateDamage({ ...build.weapon, powerLevel }, build.enchantments, effects, scenario)).toThrow(/範囲外/)
    }
    for (const powerLevel of [minimum, 251]) expect(enchantmentUnsupportedReason({ ...buildFor([selected(id)]).weapon, powerLevel }, id)).toBeUndefined()
  })
  it('rejects invalid DPS curves instead of propagating invalid values', () => {
    for (const points of [[], [{ powerLevel: 1, tierOneDps: 1 }], [{ powerLevel: 2, tierOneDps: 1 }, { powerLevel: 1, tierOneDps: 2 }], [{ powerLevel: 1, tierOneDps: NaN }, { powerLevel: 2, tierOneDps: 2 }]]) {
      expect(() => interpolateDotDps({ method: 'log-linear', points }, 1)).toThrow()
    }
  })
})

describe('attached burn coverage', () => {
  it('integrates finite cycles including a clipped final burn tail', () => {
    expect(finiteBurnUptime([5], 1, 10)).toBe(0.6)
    expect(finiteBurnUptime([5], 1, 6)).toBeCloseTo(4 / 6)
    expect(finiteBurnUptime([5], 1, 2)).toBe(1) // first hit at zero
    expect(finiteBurnUptime([1, 5], 1, 12)).toBeCloseTo(4 / 6)
    expect(finiteBurnUptime([5], 2, 10)).toBe(1)
    expect(finiteBurnUptime([5], 1, 1e9)).toBe(0.6)
  })
  it.each(['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe'] as const)('%s saturates without HPS × three-second stacking', (weaponId) => {
    const profile = getAttackProfile(weaponId).value
    const events = (speed: number) => calculateDotDamageEvents(251, [selected('fire-aspect')], profile, speed, scenario, 1)[0]!
    const slow = events(0.02)
    const normal = events(1)
    const fast = events(100)
    expect(slow.kind).toBe('attached-dot')
    expect(slow.singleTargetDps).toBeLessThan(normal.singleTargetDps)
    expect(normal.singleTargetDps).toBeCloseTo(339664.5)
    expect(fast.singleTargetDps).toBe(normal.singleTargetDps)
  })
  it.each([[], [0], [-1], [Infinity], [NaN]].map((intervals) => ({ intervals })))('rejects invalid cadence $intervals', ({ intervals }) => {
    expect(() => finiteBurnUptime(intervals, 1, 10)).toThrow()
  })
  it('rejects invalid speed, duration and encounter and has no modifier/proc leakage', () => {
    for (const invalid of [0, -1, NaN, Infinity]) {
      expect(() => finiteBurnUptime([1], invalid, 10)).toThrow()
      expect(() => finiteBurnUptime([1], 1, invalid)).toThrow()
    }
    expect(() => finiteBurnUptime([1], 1, 10, -1)).toThrow()
    for (const id of ['shockwave', 'swirling', 'thundering'] as const) {
      expect(damage([selected(id), selected('fire-aspect')]).damageEvents).toEqual(damage([selected(id)]).damageEvents)
    }
    for (const id of ['sharpness', 'critical-hit', 'unchanting', 'artifact-synergy', 'committed'] as const) {
      expect(damage([selected(id), selected('fire-aspect')]).dotDamageEvents).toEqual(damage([selected('fire-aspect')]).dotDamageEvents)
    }
  })
})

describe('persistent-area exposure and saturation', () => {
  it('rolls once per profile hit: HPS10 gives three clouds per second, without AoE multiplication', () => {
    const event = calculateDotDamageEvents(251, [selected('poison-cloud')], { method: 'speed-rating-proxy', hitsPerSecond: 10 }, 1, scenario, 2)[0]!
    expect(event).toMatchObject({ kind: 'persistent-area-dot', cloudSpawnsPerSecond: 3, damagePerSecond: 340794, durationSeconds: 3, overlapModel: 'poisson-saturation-assumption' })
    expect(event.singleTargetDps).toBeLessThan(340794)
    expect(event.aoeDps).toBeLessThan(2 * 340794)
  })
  it('uses residence and target-seconds, conserves units at low occupancy, and caps overlapping damage', () => {
    expect(saturatedTargetExposure(1, 3, 2) * 100).toBeCloseTo(200 * (1 - Math.exp(-1.5)))
    expect(saturatedTargetExposure(1e-6, 3, 2) * 100).toBeCloseTo(0.0003, 8)
    expect(saturatedTargetExposure(1, 0, 1)).toBe(0)
    expect(saturatedTargetExposure(1, 1, 1)).toBeLessThan(saturatedTargetExposure(1, 3, 1))
    expect(saturatedTargetExposure(100, 3, 1)).toBe(1)
    expect(saturatedTargetExposure(100, 6, 2)).toBe(2)
  })
  it('lets moving targets leave immediately without assigning cloud damage', () => {
    const result = damage([selected('poison-cloud')], 1, { ...scenario, persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: 0, poisonCloudTargetSecondsPerEvent: 0 } })
    expect(result.dotSingleTargetDps).toBe(0)
    expect(result.dotAoeDps).toBe(0)
  })
  it('validates finite residence, target-seconds and logical limits', () => {
    for (const residence of [-1, 3.1, NaN, Infinity]) expect(() => validateScenario({ ...scenario, persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: residence, poisonCloudTargetSecondsPerEvent: 3 } })).toThrow()
    for (const targetSeconds of [-1, 0, 6.1, NaN, Infinity]) expect(() => validateScenario({ ...scenario, persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: 1, poisonCloudTargetSecondsPerEvent: targetSeconds } })).toThrow()
    expect(() => validateScenario({ ...scenario, persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: 3, poisonCloudTargetSecondsPerEvent: 6 } })).not.toThrow()
  })
})

describe('explosion source kills and coupled feedback', () => {
  it.each([1, 2, 3] as const)('Tier%s uses defeated health and excludes the dead source', (tier) => {
    expect(calculateExplosionDamageEvents([selected('exploding', tier)], scenario, 1)[0]).toMatchObject({ damagePerSecondaryTarget: tier * 20, expectedSecondaryTargets: 1, aoeDps: tier * 20, singleTargetDps: 0, chainReaction: false })
    expect(calculateExplosionDamageEvents([selected('exploding', tier)], { ...scenario, averageTargetsInReach: 1 }, 1)[0]).toMatchObject({ singleTargetDps: 0, aoeDps: 0, expectedSecondaryTargets: 0 })
  })
  it('solves against a closed-form capped-supply solution instead of one-pass DPS', () => {
    const result = run([selected('exploding')])
    const direct = result.damage.directWeaponAoeDps
    // k = D/(D+60k), with one supplied kill/sec, source HP100 and one neighbor.
    const expectedK = 2 * direct / (direct + Math.sqrt(direct ** 2 + 240 * direct))
    expect(result.combatState.directWeaponKillsPerSecond).toBeCloseTo(expectedK, 7)
    expect(result.damage.explosionAoeDps).toBeCloseTo(60 * expectedK, 5)
    expect(result.damage.explosionAoeDps).toBeLessThan(result.temporalState.exploding!.firstExplodingAoeDps)
    expect(result.temporalState.exploding!.iterations).toBeGreaterThan(1)
    expect(result.temporalState.exploding!.residual).toBeLessThanOrEqual(1e-8)
  })
  it('uses the same converged direct kills for Exploding, Rampaging and Refreshment', () => {
    const result = run([selected('exploding'), selected('rampaging'), selected('refreshment')])
    const k = result.combatState.directWeaponKillsPerSecond
    expect(result.damage.explosionDamageEvents[0]!.sourceKillsPerSecond).toBeCloseTo(k, 7)
    expect(result.temporalState.rampaging.directWeaponKillsPerSecond).toBe(k)
    expect(result.temporalState.rampaging.uptime).toBeCloseTo(1 - Math.exp(-1.5 * k), 7)
    expect(result.temporalState.rampaging.residual).toBeLessThanOrEqual(1e-8)
    expect(result.damage.explosionAoeDps).toBeCloseTo(k * 60, 5)
    const baseline = run([selected('rampaging'), selected('refreshment')])
    expect(result.damage.aoeDps).toBeGreaterThan(baseline.damage.aoeDps)
    expect(k).toBeLessThan(baseline.combatState.directWeaponKillsPerSecond)
    expect(result.healing.refreshmentPotionCapacityPerSecond).toBeLessThan(baseline.healing.refreshmentPotionCapacityPerSecond)
  })
  it('never feeds indirect kills into sources and handles zero supply / huge supply', () => {
    const result = run([selected('exploding'), selected('fire-aspect')])
    expect(result.damage.explosionDamageEvents[0]!.sourceKillsPerSecond).toBeCloseTo(result.combatState.directWeaponKillsPerSecond, 7)
    expect(result.combatState.indirectEstimatedKillsPerSecond).toBeGreaterThan(result.combatState.directWeaponKillsPerSecond)
    expect(run([selected('exploding')], { ...scenario, enemySupplyPerSecond: 0 }).damage.explosionAoeDps).toBe(0)
    expect(run([selected('exploding')], { ...scenario, directKillShare: 0 }).damage.explosionAoeDps).toBe(0)
    expect(run([selected('exploding')], { ...scenario, enemySupplyPerSecond: 1e20 }).damage.explosionAoeDps).toBeGreaterThan(0)
  })
  it('converges with Committed and all three indirect effects', () => {
    const result = run([selected('fire-aspect'), selected('poison-cloud'), selected('exploding'), selected('committed', 3, 'gilded')])
    expect(result.damage.explosionDamageEvents[0]!.sourceKillsPerSecond).toBeCloseTo(result.combatState.directWeaponKillsPerSecond, 7)
    expect(result.damage.indirectAoeDps).toBe(result.damage.instantIndirectAoeDps + result.damage.dotAoeDps + result.damage.explosionAoeDps)
    expect(result.damage.singleTargetDps).toBe(result.damage.directWeaponSingleTargetDps + result.damage.dotSingleTargetDps)
  })
  it('rejects missing/invalid source rates and invalid solver mappings', () => {
    expect(() => damage([selected('exploding')])).toThrow('steady-state solver')
    for (const rate of [-1, NaN, Infinity]) expect(() => calculateExplosionDamageEvents([selected('exploding')], scenario, rate)).toThrow()
    for (const nextValue of [-1, 2, NaN, Infinity]) expect(() => solveBracketedUnitFixedPoint(() => ({ nextValue, result: 0 }))).toThrow()
    expect(() => solveBracketedUnitFixedPoint((x) => ({ nextValue: x < 0.123456789 ? 1 : 0, result: 0 }))).toThrow('did not converge')
  })
})

describe('optimizer, storage, descriptions and confidence', () => {
  it.each(DOT_EXPLOSION_IDS)('%s supports normal and gilded tiers, JSON and browser storage', (id) => {
    for (const tier of [1, 2, 3] as const) {
      const build = buildFor([selected('radiance'), selected(id, tier, 'gilded')])
      const inventory = { weapons: [build.weapon], artifacts: [] }
      const imported = deserializeInventory(serializeInventory(inventory))
      expect(imported).toEqual(inventory)
      const storage = new Map<string, string>()
      vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
      saveInventory(inventory)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(inventory)
      const result = optimize(imported, scenario)
      expect(result.evaluatedBuildCount).toBe(1)
      expect(result.best.contributions.find((c) => c.sourceId === id)!.aoeDpsDelta).toBeGreaterThan(0)
      expect(result.best.reasons.join(' ')).toContain(id === 'fire-aspect' ? 'Fire Aspect' : id === 'poison-cloud' ? 'Poison Cloud' : 'Exploding')
    }
    const build = buildFor([selected(id)])
    const locked = { ...build.weapon, enchantmentSlots: [{ candidates: [id], selected: { enchantmentId: id, tier: 3 as const } }] }
    expect(optimize({ weapons: [locked], artifacts: [] }, scenario).best.build.enchantments[0]!.enchantmentId).toBe(id)
  })
  it.each(DOT_EXPLOSION_IDS)('%s rejects normal/gilded duplicates and Void combinations, never zero-scores them', (id) => {
    const duplicate = buildFor([selected(id), selected(id, 1, 'gilded')])
    expect(() => evaluate(duplicate, scenario)).toThrow(/最大1個|1個限定/)
    expect(() => optimize({ weapons: [duplicate.weapon], artifacts: [] }, scenario)).toThrow()
    const invalid = buildFor([selected(id), selected('void-strike', 3, 'gilded')])
    expect(() => evaluate(invalid, scenario)).toThrow('Void Strike')
    expect(() => optimize({ weapons: [invalid.weapon], artifacts: [] }, scenario)).toThrow('Void Strike')
    const weapon = { ...invalid.weapon, enchantmentSlots: [{ candidates: [id, 'radiance'] as EnchantmentId[] }] }
    const result = optimize({ weapons: [weapon], artifacts: [] }, scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join(' ')).toContain('Void Strike')
    expect(result.best.build.enchantments.some((e) => e.enchantmentId === id)).toBe(false)
  })
  it.each(DOT_DAMAGE_IDS)('%s excludes unsupported free Power choices and rejects locked/gilded ones', (id) => {
    const build = buildFor([selected(id)])
    const weapon = { ...build.weapon, powerLevel: 263, enchantmentSlots: [{ candidates: [id, 'radiance'] as EnchantmentId[] }] }
    const result = optimize({ weapons: [weapon], artifacts: [] }, scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join(' ')).toContain('外挿')
    expect(() => optimize({ weapons: [{ ...weapon, enchantmentSlots: [{ candidates: [id], selected: { enchantmentId: id, tier: 3 as const } }] }], artifacts: [] }, scenario)).toThrow('外挿')
    expect(() => optimize({ weapons: [{ ...weapon, gilded: { enchantmentId: id, tier: 1 } }], artifacts: [] }, scenario)).toThrow('外挿')
  })
  it.each(DOT_DAMAGE_IDS)('%s reduces direct-kill effects at the supply cap', (id) => {
    for (const killEffect of ['leeching', 'guarding-strike', 'refreshment', 'rampaging'] as const) {
      const baseline = run([selected(killEffect)])
      const result = run([selected(killEffect), selected(id)])
      expect(result.combatState.directWeaponKillsPerSecond).toBeLessThan(baseline.combatState.directWeaponKillsPerSecond)
      expect(result.damage.aoeDps).toBeGreaterThan(baseline.damage.aoeDps)
    }
  })
  it('scopes new assumptions to selected effects and displays the different units', () => {
    const baseline = run([selected('radiance')])
    expect(baseline.confidence.factors.some((f) => /fire-|poison-|exploding-|dot-/.test(f.id))).toBe(false)
    for (const id of DOT_EXPLOSION_IDS) {
      const result = run([selected(id)])
      expect(result.confidence.factors.some((f) => f.id === 'damage-channel-kill-attribution' && f.confidence === 'low')).toBe(true)
      const html = renderToStaticMarkup(<DamageEventDetails evaluation={result} />)
      expect(html).toContain(id === 'fire-aspect' ? 'refresh coverage' : id === 'poison-cloud' ? 'target-seconds/cloud' : '爆発固定点')
    }
    expect(renderToStaticMarkup(<ProcPowerSupport weapon={buildFor([selected('fire-aspect')]).weapon} />)).toContain('70–251')
    expect(renderToStaticMarkup(<PersistentAreaTargetingControl maximum={2} onChange={() => {}} />)).toContain('max="6"')
  })
})
