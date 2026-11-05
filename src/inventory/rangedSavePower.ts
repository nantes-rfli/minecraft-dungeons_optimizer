import model from '../../research/domain/ranged-native-model.json' with { type: 'json' }
import { float32Bits } from '../domain/rangedFinalNative.ts'

/** Staging contract, not an encrypted-save importer or a game-version detector. */
export interface RangedSaveContext {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly saveVersion: number
  readonly versionSourceNote: string
  readonly sourceNote: string
  readonly origin: 'synthetic-fixture' | 'existing-save'
}
export interface RangedSaveLocator {
  readonly snapshotSha256: string
  readonly collection: 'items' | 'storageChestItems'
  /** Array position in this exact snapshot; inventoryIndex is not a persistent ID. */
  readonly recordIndex: number
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const index = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const unknown = (reason: string) => ({ state: 'unknown' as const, reason, runtimePromotion: false as const })

/** Hashes decoded JSON text, NOT the original encrypted file or its authenticity. */
export async function rangedSaveSnapshotId(jsonText: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jsonText))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Only Bow is reviewed here. No search by type, display Power, equipment slot,
 * inventoryIndex or nearest Power. No arbitrary existing Inventory ID rebinding.
 * Known means conditional transport; actual item/parser/version evidence stays unknown.
 */
export async function resolveRangedSavePower(jsonText: unknown, context: unknown, locator: unknown) {
  if (typeof jsonText !== 'string' || jsonText.length > 16 * 1024 * 1024) return unknown('missing-or-oversized-decoded-save-json')
  if (!record(context)) return unknown('unsupported-or-unproven-save-context')
  // Snapshot primitives BEFORE validation and the first await. Never re-read mutable
  // caller objects after hashing; that could change the validated version/selection.
  const c = { schemaVersion: context.schemaVersion, gameVersion: context.gameVersion, saveVersion: context.saveVersion,
    versionSourceNote: context.versionSourceNote, sourceNote: context.sourceNote, origin: context.origin }
  if (c.schemaVersion !== 1 || c.gameVersion !== model.gameVersion
    || !index(c.saveVersion) || c.saveVersion === 0 || !nonempty(c.versionSourceNote)
    || !nonempty(c.sourceNote) || (c.origin !== 'synthetic-fixture' && c.origin !== 'existing-save')) return unknown('unsupported-or-unproven-save-context')
  if (!record(locator)) return unknown('invalid-save-record-locator')
  const selection = { collection: locator.collection, recordIndex: locator.recordIndex, snapshotSha256: locator.snapshotSha256 }
  if ((selection.collection !== 'items' && selection.collection !== 'storageChestItems')
    || !index(selection.recordIndex) || typeof selection.snapshotSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(selection.snapshotSha256)) return unknown('invalid-save-record-locator')
  const snapshotSha256 = await rangedSaveSnapshotId(jsonText)
  if (snapshotSha256 !== selection.snapshotSha256) return unknown('save-snapshot-mismatch')
  let document: unknown
  try { document = JSON.parse(jsonText) } catch { return unknown('invalid-save-json') }
  if (!record(document) || !Object.hasOwn(document, 'version') || document.version !== c.saveVersion) return unknown('save-format-version-mismatch')
  if (Object.hasOwn(document, 'gameVersion') && document.gameVersion !== c.gameVersion) return unknown('save-game-version-mismatch')
  // A numeric save-format version is never interpreted as a game-version number.
  const collection = selection.collection
  const rows = document[collection]
  if (!Array.isArray(rows) || selection.recordIndex >= rows.length) return unknown('missing-save-record')
  const item = rows[selection.recordIndex]
  if (!record(item) || item.type !== model.profiles.bow.rawIdentity) return unknown('unsupported-save-weapon-type')
  if (item.inventoryIndex !== undefined && item.inventoryIndex !== null && !index(item.inventoryIndex)) return unknown('invalid-save-inventory-index')
  if (item.equipmentSlot !== undefined && item.equipmentSlot !== null && item.equipmentSlot !== 'RangedGear') return unknown('save-equipment-slot-mismatch')
  if (!Object.hasOwn(item, 'power') || typeof item.power !== 'number' || !Number.isFinite(item.power)
    || item.power < 0 || item.power > 40) return unknown('missing-or-invalid-saved-power')
  const power = Math.fround(item.power)
  if ((power === 0 && item.power !== 0) || (power !== 0 && Math.abs(power) < 2 ** -126)) return unknown('saved-power-outside-reviewed-normal-domain')
  const instanceId = `native-save-v1:${c.gameVersion}:${c.saveVersion}:${snapshotSha256}:${collection}:${selection.recordIndex}`
  return { state: 'known' as const, runtimePromotion: false as const, instanceId, weaponId: 'bow' as const,
    power: { kind: 'internal-f32-bits' as const, bits: float32Bits(power), sourceNote: `${c.sourceNote}; decoded-json-sha256=${snapshotSha256}; ${collection}[${selection.recordIndex}].power; JSON.parse binary64 -> binary32` },
    provenance: { snapshotSha256, collection, recordIndex: selection.recordIndex, saveVersion: c.saveVersion,
      gameVersion: c.gameVersion, versionSourceNote: c.versionSourceNote, origin: c.origin,
      parser: 'ECMAScript-JSON.parse-binary64-to-f32', nativeNumericVariant: 'unverified' as const,
      actualItemVerification: { state: 'unknown' as const, reason: 'no-authenticated-real-save-parser-version-and-selection-evidence' } },
  }
}
