import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'
import { validateWeaponSoulLegality } from '../core/soulLegality'
import type {
  ArtifactId,
  EnchantmentId,
  EnchantmentSlot,
  EnchantmentTier,
  Inventory,
  OwnedArtifact,
  OwnedWeapon,
  WeaponId,
} from '../core'

const STORAGE_KEY = 'minecraft-dungeons-optimizer.inventory.v1'

interface InventoryDocument {
  readonly version: 1
  readonly inventory: Inventory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field}は空でない文字列にしてください。`)
  }
  return value
}

function requirePower(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${field}は1以上の整数にしてください。`)
  }
  return value
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field}は0より大きい数値にしてください。`)
  }
  return value
}

function parseEnchantmentId(value: unknown, field: string): EnchantmentId {
  const id = requireString(value, field)
  if (!(id in ENCHANTMENTS)) throw new Error(`${field}に未対応ID「${id}」があります。`)
  return id as EnchantmentId
}

function parseSlot(value: unknown, field: string): EnchantmentSlot {
  if (!isRecord(value) || !Array.isArray(value.candidates) || value.candidates.length === 0) {
    throw new Error(`${field}.candidatesには候補を1つ以上指定してください。`)
  }
  const candidates = value.candidates.map((candidate, index) =>
    parseEnchantmentId(candidate, `${field}.candidates[${index}]`),
  )
  const locked = value.locked === undefined ? undefined : parseEnchantmentId(value.locked, `${field}.locked`)
  if (locked && !candidates.includes(locked)) {
    throw new Error(`${field}.lockedは候補内から選択してください。`)
  }
  return { candidates: [...new Set(candidates)], locked }
}

function parseWeapon(value: unknown, index: number): OwnedWeapon {
  const field = `inventory.weapons[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const weaponId = requireString(value.weaponId, `${field}.weaponId`)
  if (!(weaponId in WEAPONS)) throw new Error(`${field}.weaponIdに未対応ID「${weaponId}」があります。`)
  if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length < 1 || value.enchantmentSlots.length > 3) {
    throw new Error(`${field}.enchantmentSlotsは1〜3スロットにしてください。`)
  }
  const locked = value.locked === undefined ? {} : { locked: value.locked === true }
  const observedDamage = value.observedDamagePerHit === undefined
    ? {}
    : { observedDamagePerHit: requirePositiveNumber(value.observedDamagePerHit, `${field}.observedDamagePerHit`) }
  let gilded: OwnedWeapon['gilded']
  if (value.gilded !== undefined) {
    if (!isRecord(value.gilded) || ![1, 2, 3].includes(value.gilded.tier as number)) {
      throw new Error(`${field}.gildedの形式が正しくありません。`)
    }
    gilded = {
      enchantmentId: parseEnchantmentId(value.gilded.enchantmentId, `${field}.gilded.enchantmentId`),
      tier: value.gilded.tier as EnchantmentTier,
    }
  }
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    weaponId: weaponId as WeaponId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...observedDamage,
    enchantmentSlots: value.enchantmentSlots.map((slot, slotIndex) => parseSlot(slot, `${field}.enchantmentSlots[${slotIndex}]`)),
    ...(gilded ? { gilded } : {}),
    ...locked,
  }
}

function parseArtifact(value: unknown, index: number): OwnedArtifact {
  const field = `inventory.artifacts[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const artifactId = requireString(value.artifactId, `${field}.artifactId`)
  if (!(artifactId in ARTIFACTS)) throw new Error(`${field}.artifactIdに未対応ID「${artifactId}」があります。`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    artifactId: artifactId as ArtifactId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
  }
}

export function serializeInventory(inventory: Inventory): string {
  return JSON.stringify({ version: 1, inventory } satisfies InventoryDocument, null, 2)
}

export function deserializeInventory(json: string): Inventory {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSONの構文が正しくありません。')
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.inventory)) {
    throw new Error('対応していないデータ形式です（version 1 が必要です）。')
  }
  const { weapons, artifacts } = parsed.inventory
  if (!Array.isArray(weapons) || !Array.isArray(artifacts)) {
    throw new Error('inventoryにはweaponsとartifactsの配列が必要です。')
  }
  const inventory = {
    weapons: weapons.map(parseWeapon),
    artifacts: artifacts.map(parseArtifact),
  }
  inventory.weapons.forEach(validateWeaponSoulLegality)
  const allIds = [...inventory.weapons, ...inventory.artifacts].map((item) => item.instanceId)
  if (new Set(allIds).size !== allIds.length) throw new Error('装備の管理IDが重複しています。')
  return inventory
}

export function loadInventory(fallback: Inventory): Inventory {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return stored ? deserializeInventory(stored) : fallback
  } catch {
    return fallback
  }
}

export function saveInventory(inventory: Inventory): void {
  inventory.weapons.forEach(validateWeaponSoulLegality)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, serializeInventory(inventory))
  } catch (error) {
    throw new Error(
      `ブラウザへの保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      { cause: error },
    )
  }
}
