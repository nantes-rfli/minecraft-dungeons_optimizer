import { describe, expect, it } from 'vitest'
import { resolveRangedSavePower, rangedSaveSnapshotId } from '../src/inventory/rangedSavePower'
import type { RangedSaveContext } from '../src/inventory/rangedSavePower'
import { resolveBareBowEffectiveAttributes } from '../src/domain/rangedEffectiveAttributes'
import { rangedNativeReadinessFromSave } from '../src/core/rangedNativeReadiness'
import { parseRangedWeapon, rangedWeaponUnsupportedReason } from '../src/core/ranged'
import { calculateConditionalRanged } from '../src/domain/rangedFinalNative'
import type { ConditionalRangedInput } from '../src/domain/rangedFinalNative'
import example from '../research/native/ranged-final-20261101/conditional-input.example.json'
import replay from '../research/native/ranged-final-20261101/verification.json'
import promotion from '../research/runtime/runtime-promotion-manifest.json'

// Deliberately invented save version and data; never a real item/version observation.
const context: RangedSaveContext = { schemaVersion: 1, gameVersion: '1.17.0.0', saveVersion: 999,
  sourceNote: 'synthetic fixture only', versionSourceNote: 'synthetic game-version assertion only', origin: 'synthetic-fixture' }
const item = { type: 'Bow', power: 10.9, inventoryIndex: 0 }
const profile = (patch = {}) => JSON.stringify({ version: 999, items: [item, { ...item, power: 10.90000057220459 }], storageChestItems: [item], ...patch })
const locator = async (text: string, recordIndex = 0, collection = 'items') => ({ snapshotSha256: await rangedSaveSnapshotId(text), collection, recordIndex })
const resolve = async (text: string, index = 0, collection = 'items') => resolveRangedSavePower(text, context, await locator(text, index, collection))
const input = example as ConditionalRangedInput
const conditions = { mode: input.mode, attributes: input.attributes, provider: input.provider, projectile: input.projectile, powerEffect: input.powerEffect }

describe('snapshot-bound Bow save Power, conditional transport only', () => {
  it('selects by content hash + collection + array position, not duplicate type/power/index', async () => {
    const text = profile()
    const a = await resolve(text)
    const b = await resolve(text, 1)
    const chest = await resolve(text, 0, 'storageChestItems')
    expect(a).toMatchObject({ state: 'known', power: { kind: 'internal-f32-bits', bits: '412e6666' }, runtimePromotion: false })
    expect(b).toMatchObject({ state: 'known', power: { bits: '412e6667' } })
    if (a.state !== 'known' || b.state !== 'known' || chest.state !== 'known') throw Error('fixture transport failed')
    expect(new Set([a.instanceId, b.instanceId, chest.instanceId]).size).toBe(3)
    expect(a.provenance.actualItemVerification.state).toBe('unknown')
    expect(a.provenance.nativeNumericVariant).toBe('unverified')
    expect(a.provenance.origin).toBe('synthetic-fixture')
    expect(await resolveRangedSavePower(text, { ...context, origin: 'existing-save' }, await locator(text))).toMatchObject({ provenance: { actualItemVerification: { state: 'unknown' } } })
    expect(await resolve(profile({ items: [{ ...item, inventoryIndex: undefined }] }))).toMatchObject({ state: 'known' })
    expect(await resolve(profile({ items: [{ ...item, inventoryIndex: null }] }))).toMatchObject({ state: 'known' })
    // Even byte/format changes create another snapshot, never a persistent cross-save ID.
    expect((await resolve(text + ' '))).not.toMatchObject({ instanceId: a.instanceId })
  })

  it('preserves all 104 prior synthetic numeric transport bit patterns within the reviewed domain', async () => {
    for (const [numeric, bits] of replay.inputTransport) {
      const value = Number(numeric)
      const result = await resolve(profile({ items: [{ ...item, power: value }] }))
      if (value >= 0 && value <= 40 && (value === 0 || Math.fround(value) >= 2 ** -126)) {
        expect(result).toMatchObject({ state: 'known', power: { bits } })
      } else expect(result.state).toBe('unknown')
    }
    expect(await resolve(profile({ items: [{ type: 'Bow', power: 0 }] }))).toMatchObject({ state: 'known', power: { bits: '00000000' } })
  })

  it('uses the validated context and selection even if the caller mutates them during hashing', async () => {
    const text = profile()
    const c = { ...context } as Record<string, unknown>
    const loc = await locator(text)
    const pending = resolveRangedSavePower(text, c, loc)
    c.gameVersion = '1.16.0.0'
    c.origin = 'unsupported'
    c.sourceNote = ''
    c.versionSourceNote = ''
    c.saveVersion = 998
    loc.collection = 'storageChestItems'
    loc.recordIndex = 1
    loc.snapshotSha256 = '0'.repeat(64)
    expect(await pending).toMatchObject({ state: 'known', power: { bits: '412e6666' },
      provenance: { collection: 'items', recordIndex: 0, gameVersion: '1.17.0.0', saveVersion: 999,
        origin: 'synthetic-fixture', versionSourceNote: context.versionSourceNote } })
  })

  it('rejects missing/non-numeric/out-of-range Power without display fallback', async () => {
    for (const value of [undefined, null, '10.9', true, {}, [], -1, 41, 1e100, 2 ** -149, 1e-100]) {
      const text = profile({ items: [{ ...item, power: value, powerLevel: 100 }] })
      expect((await resolve(text)).state).toBe('unknown')
    }
    for (const text of ['{"version":999,"items":[{"type":"Bow","power":1e999}]}', 'NaN', '{', '[]', 'null']) expect((await resolve(text)).state).toBe('unknown')
  })

  it('rejects other/missing context versions, schemas, records and snapshot identities', async () => {
    const text = profile()
    const loc = await locator(text)
    for (const patch of [{ schemaVersion: 2 }, { gameVersion: '1.16.0.0' }, { gameVersion: undefined }, { saveVersion: undefined }, { saveVersion: 1 }, { saveVersion: 0 }, { versionSourceNote: '' }, { sourceNote: '' }, { origin: 'verified' }]) {
      expect((await resolveRangedSavePower(text, { ...context, ...patch }, loc)).state).toBe('unknown')
    }
    for (const patch of [{ recordIndex: -1 }, { recordIndex: 0.5 }, { recordIndex: 2 }, { recordIndex: Number.MAX_SAFE_INTEGER + 1 }, { collection: 'merchantData' }, { snapshotSha256: '0'.repeat(64) }]) {
      expect((await resolveRangedSavePower(text, context, { ...loc, ...patch })).state).toBe('unknown')
    }
    for (const patch of [{ version: undefined }, { version: '999' }, { version: 998 }, { gameVersion: '1.16.0.0' }, { items: null }, { items: [null] }, { items: [{ ...item, type: 'bow' }] }, { items: [{ ...item, type: 'Shortbow' }] }, { items: [{ ...item, inventoryIndex: '0' }] }, { items: [{ ...item, equipmentSlot: 'MeleeGear' }] }]) {
      expect((await resolve(profile(patch))).state).toBe('unknown')
    }
    expect(await resolveRangedSavePower(profile({ timestamp: 1 }), context, loc)).toMatchObject({ state: 'unknown', reason: 'save-snapshot-mismatch' })
  })

  it('never resolves any of seven effective attributes from constructor defaults', () => {
    const result = resolveBareBowEffectiveAttributes()
    expect(result.state).toBe('unknown')
    if (result.state !== 'unknown') throw Error('defaults became effective values')
    expect([...result.unresolved].sort()).toEqual(Object.keys(input.attributes).sort())
    expect(resolveBareBowEffectiveAttributes(input.attributes)).toMatchObject({ state: 'known', valueSource: 'explicit-conditional-input' })
    for (const name of Object.keys(input.attributes)) {
      const attrs = { ...input.attributes } as Record<string, number>
      delete attrs[name]
      expect(resolveBareBowEffectiveAttributes(attrs)).toMatchObject({ state: 'unknown', unresolved: [name] })
      for (const value of [NaN, Infinity, -1, 0.1, 2 ** -149]) expect(resolveBareBowEffectiveAttributes({ ...attrs, [name]: value }).state).toBe('unknown')
    }
  })

  it('connects the selected Power to #221 only with explicit conditions and matching Inventory identity', async () => {
    const text = profile()
    const loc = await locator(text)
    const selected = await resolve(text)
    if (selected.state !== 'known') throw Error(selected.reason)
    const weapon = parseRangedWeapon({ instanceId: selected.instanceId, weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] })
    const before = JSON.stringify(weapon)
    const ready = await rangedNativeReadinessFromSave(weapon, text, context, loc, conditions)
    expect(ready.calculation).toEqual(calculateConditionalRanged({ ...conditions, weaponId: 'bow', power: selected.power }))
    expect(ready.calculation).toMatchObject({ state: 'known', positiveCustomMagnitude: 10217.6025390625, combatDps: { state: 'unknown' }, hpLoss: { state: 'unknown' } })
    expect(ready.runtimeEligible).toBe(false)
    const changingWeapon = { ...weapon }
    const changingConditions = { ...conditions, attributes: { ...conditions.attributes } }
    const pending = rangedNativeReadinessFromSave(changingWeapon, text, context, loc, changingConditions)
    changingWeapon.instanceId = 'different-during-hash'
    changingConditions.provider = ''
    changingConditions.attributes.DamageMultiplier = 2
    expect((await pending).calculation).toMatchObject({ state: 'known', positiveCustomMagnitude: 10217.6025390625 })
    expect(ready.remainingRuntimeInputs).toContain('observed-neutral-projectile-damage')
    expect(rangedWeaponUnsupportedReason(weapon)).toContain('必要')
    expect((await rangedNativeReadinessFromSave(weapon, text, context, loc)).calculation.state).toBe('unknown')
    for (const changed of [{ ...weapon, instanceId: 'manual-bow' }, { ...weapon, weaponId: 'shortbow' }]) expect((await rangedNativeReadinessFromSave(changed, text, context, loc, conditions)).calculation.state).toBe('unknown')
    expect((await rangedNativeReadinessFromSave(weapon, text, context, await locator(text, 1), conditions)).calculation.state).toBe('unknown')
    expect((await rangedNativeReadinessFromSave(weapon, text, context, loc, { ...conditions, provider: '' })).calculation.state).toBe('unknown')
    expect((await rangedNativeReadinessFromSave(weapon, text, context, loc, { ...conditions, attributes: {} as ConditionalRangedInput['attributes'] })).calculation.state).toBe('unknown')
    expect(JSON.stringify(weapon)).toBe(before)
    // Native failure must not affect the user's existing observation or eligibility.
    const observed = { ...weapon, observation: { gameVersion: '1.17.0.0' as const, mode: 'charged' as const, projectileDamage: 17, shotCycleSeconds: 1, availableAmmo: 4, sourceNote: 'synthetic observation' } }
    const failed = await rangedNativeReadinessFromSave(observed, text, context, { ...loc, recordIndex: 999 }, conditions)
    expect(failed.damageSource).toBe('user-observed-unmodified-projectile')
    expect(failed.remainingRuntimeInputs).toEqual([])
    expect(rangedWeaponUnsupportedReason(observed)).toBeNull()
    expect(observed.observation.projectileDamage).toBe(17)
    expect(promotion.summary).toEqual({ candidates: 1, eligible: 0, promoted: 0 })
  })
})
