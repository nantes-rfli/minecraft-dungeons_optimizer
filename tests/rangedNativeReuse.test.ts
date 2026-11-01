import { describe, expect, it } from 'vitest'
import { evaluate, optimize } from '../src/core'
import { parseRangedWeapon } from '../src/core/ranged'
import { rangedReuseIsEligible } from '../src/core/rangedReuse'
import { nativeRangedReference } from '../src/domain/rangedNative'
import source from '../research/sources/ranged-source-snapshot.json'
import { buildRangedWeaponAudit } from '../src/research/rangedAudit'
import grants from '../research/runtime/ranged-observed-reuse.json'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Build, Inventory, Scenario } from '../src/core/types'
import type { OwnedRangedWeapon, RangedShotMode } from '../src/core/rangedTypes'

// Synthetic arithmetic only; neither game observations nor R3 regression.
const scenario: Scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 20, rangedTimeShare: 0.5 }
const melee: Build = { weapon: { instanceId: 'm', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }, enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [] }
const weapon = (id: string, mode: RangedShotMode = 'charged'): OwnedRangedWeapon => ({ instanceId: id, weaponId: id, powerLevel: 251, enchantmentSlots: [], observation: { gameVersion: '1.17.0.0', mode, projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 3, sourceNote: 'SYNTHETIC ONLY' } })
const build = (w: OwnedRangedWeapon): Build => ({ ...melee, rangedWeapon: w, rangedEnchantments: [] })
const inventory = (items: OwnedRangedWeapon[]): Inventory => ({ weapons: [melee.weapon], artifacts: [], rangedWeapons: items })
const targets = ['shortbow', 'longbow', 'power-bow', 'heavy-crossbow']

describe('source-bound observed Ranged reuse', () => {
  it.each(targets)('positive: evaluate and optimize %s using only target observation', (id) => {
    const item = weapon(id, id === 'heavy-crossbow' ? 'single' : 'charged')
    const evaluated = evaluate(build(item), scenario)
    expect(evaluated.damage.ranged).toMatchObject({ shots: 3, ammoLimited: true, directSingleTargetDps: 15, damageSource: 'user-observed-unmodified-projectile' })
    expect(optimize(inventory([item]), scenario).best.damage).toEqual(evaluated.damage)
    expect(evaluate(build({ ...item, powerLevel: 1 }), scenario).damage.ranged).toEqual(evaluated.damage.ranged)
    expect(parseRangedWeapon(JSON.parse(JSON.stringify(item)))).toEqual(item)
  })
  it.each(targets)('negative: %s requires observation and exact mode; native CDO cannot substitute', (id) => {
    const item = weapon(id, id === 'heavy-crossbow' ? 'single' : 'charged')
    expect(() => evaluate(build({ ...item, observation: undefined }), scenario)).toThrow('必要')
    expect(() => optimize(inventory([{ ...item, observation: undefined }]), scenario)).toThrow('No supported Ranged')
    expect(() => evaluate(build({ ...item, observation: { ...item.observation!, mode: 'uncharged' } }), scenario)).toThrow('mode')
    const reference = nativeRangedReference(id)
    expect(reference.state).toBe('known')
    if (reference.state === 'known') {
      expect(reference.finalProjectileDamage.state).toBe('unknown')
      expect(reference.effectiveShotCycleSeconds.state).toBe('unknown')
    }
  })
  it('negative: rejects withdrawn, duplicated, unclassified, wrong-version and mismatched intrinsic/source grants', () => {
    const grant = grants.approvals.find((item) => item.targetId === 'longbow')!
    expect(rangedReuseIsEligible('longbow', 'charged', [])).toBe(false)
    expect(rangedReuseIsEligible('longbow', 'charged', [grant, grant])).toBe(false)
    for (const patch of [{ classification: 'unclassified' }, { gameVersion: 'other' }, { sourceUrl: 'fake' }, { rawIdentity: 'Bow' }, { intrinsicFacts: [] }, { mechanic: 'native-damage' }, { donorId: 'shortbow' }]) {
      expect(rangedReuseIsEligible('longbow', 'charged', [{ ...grant, ...patch }])).toBe(false)
    }
    expect(rangedReuseIsEligible('longbow', 'charged', [grant], { ...source, weapons: { ...source.weapons, claimedGameVersion: 'other' } })).toBe(false)
    expect(rangedReuseIsEligible('guardian-bow', 'charged')).toBe(false)
    expect(nativeRangedReference('guardian-bow').state).toBe('unknown')
    expect(nativeRangedReference('constructor').state).toBe('unknown')
  })
  it.each(targets)('negative: %s keeps unsupported free slots, fixed effects and shared interactions rejected', (id) => {
    const item = weapon(id, id === 'heavy-crossbow' ? 'single' : 'charged')
    expect(() => optimize(inventory([{ ...item, enchantmentSlots: [{ candidates: ['power', 'multishot'] }] }]), scenario)).toThrow('未対応候補')
    expect(() => optimize(inventory([{ ...item, gilded: { enchantmentId: 'growing', tier: 3 } }]), scenario)).toThrow('Research-only')
    const voidBuild: Build = { ...build(item), weapon: { ...melee.weapon, enchantmentSlots: [{ candidates: ['void-strike'] }] }, enchantments: [{ enchantmentId: 'void-strike', tier: 3, source: 'slot' }] }
    expect(() => evaluate(voidBuild, scenario)).toThrow('未検証')
  })
  it('preservation: old Bow/Crossbow unchanged; unknown uniques remain unsupported in mixed optimize', () => {
    for (const [id, mode] of [['bow', 'charged'], ['crossbow', 'single']] as const) {
      expect(evaluate(build(weapon(id, mode)), scenario).damage.ranged?.directSingleTargetDps).toBe(15)
    }
    const result = optimize(inventory([weapon('guardian-bow'), weapon('shortbow')]), scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join(' ')).toContain('guardian-bow')
    expect(evaluate(melee, scenario).damage).not.toHaveProperty('ranged')
  })
  it('keeps source taxonomy unknown instead of closing Evidence gaps from runtime membership', () => {
    const audit = buildRangedWeaponAudit()
    for (const id of targets) {
      expect(audit.entries.find((entry) => entry.id === id)).toMatchObject({ supportLevel: 'limited', projectileCount: null, multiHitPossibility: null, ammo: { consumptionPerShot: null } })
    }
  })
  it.each(targets)('optimizes supported Tier/Gilded choices for %s without adding intrinsic multipliers', (id) => {
    const item = { ...weapon(id, id === 'heavy-crossbow' ? 'single' : 'charged'), enchantmentSlots: [{ candidates: ['power', 'unchanting'] }], gilded: { enchantmentId: 'critical-hit', tier: 1 as const } }
    const result = optimize(inventory([item]), scenario)
    expect(result.evaluatedBuildCount).toBe(2)
    expect(result.best.build.rangedEnchantments?.[0]?.enchantmentId).toBe('power')
    expect(result.best.damage.ranged?.directSingleTargetDps).toBeCloseTo(15 * 1.33 * 1.2)
  })
  it('preserves binary32 base distinctions and absence of charged Heavy Crossbow', () => {
    const short = nativeRangedReference('shortbow')
    const long = nativeRangedReference('longbow')
    const heavy = nativeRangedReference('heavy-crossbow')
    if (short.state !== 'known' || long.state !== 'known' || heavy.state !== 'known') throw new Error('missing model')
    expect(short.baselineBeforePower.charged).toBe(61.874996185302734)
    expect(long.baselineBeforePower.uncharged).toBe(60.000003814697266)
    expect(heavy.baselineBeforePower.charged).toBeNull()
  })
})
