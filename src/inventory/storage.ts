import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'
import { validateWeaponSoulLegality } from '../core/soulLegality'
import type {
  ArtifactId,
  CatalogInventoryItem,
  EnchantmentId,
  EnchantmentSlot,
  EnchantmentTier,
  Inventory,
  EquipmentRarity,
  OwnedArtifact,
  OwnedWeapon,
  WeaponId,
} from '../core'
import type { ArmorEnchantmentTier, OwnedArmor } from '../core/armor'
import { isAuditedArmorEnchantmentId } from '../research/armorEnchantmentAudit'
import { parseRangedWeapon } from '../core/ranged'
import { CATALOG_ONLY_EQUIPMENT } from '../data/equipmentCatalog'

const STORAGE_KEY = 'minecraft-dungeons-optimizer.inventory.v1'

interface InventoryDocument {
  readonly version: 4
  readonly inventory: Inventory
}

function parseRarity(value: unknown, field: string): EquipmentRarity | undefined {
  if (value === undefined) return undefined
  if (!['common', 'rare', 'unique'].includes(value as string)) throw new Error(`${field}はcommon / rare / uniqueのいずれかにしてください。`)
  return value as EquipmentRarity
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined
  return requireString(value, field)
}

function parseCatalogResearch(value: unknown, field: string): CatalogInventoryItem['research'] {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const enchantments = value.enchantments === undefined ? undefined : (() => {
    if (!Array.isArray(value.enchantments)) throw new Error(`${field}.enchantmentsは配列にしてください。`)
    return value.enchantments.map((item, index) => {
      const itemField = `${field}.enchantments[${index}]`
      if (!isRecord(item) || ![1, 2, 3].includes(item.tier as number) || !['slot', 'gilded', 'built-in'].includes(item.source as string)) throw new Error(`${itemField}の形式が正しくありません。`)
      return { enchantmentId: requireString(item.enchantmentId, `${itemField}.enchantmentId`), tier: item.tier as EnchantmentTier, source: item.source as 'slot' | 'gilded' | 'built-in' }
    })
  })()
  const intrinsicProperties = value.intrinsicProperties === undefined ? undefined : (() => {
    if (!Array.isArray(value.intrinsicProperties)) throw new Error(`${field}.intrinsicPropertiesは配列にしてください。`)
    return value.intrinsicProperties.map((item, index) => {
      const itemField = `${field}.intrinsicProperties[${index}]`
      if (!isRecord(item)) throw new Error(`${itemField}の形式が正しくありません。`)
      return { kind: requireString(item.kind, `${itemField}.kind`), raw: requireString(item.raw, `${itemField}.raw`) }
    })
  })()
  const observations = value.observations === undefined ? undefined : (() => {
    if (!Array.isArray(value.observations)) throw new Error(`${field}.observationsは配列にしてください。`)
    return value.observations.map((item, index) => {
      const itemField = `${field}.observations[${index}]`
      if (!isRecord(item)) throw new Error(`${itemField}の形式が正しくありません。`)
      return {
        parameterId: requireString(item.parameterId, `${itemField}.parameterId`), value: requireString(item.value, `${itemField}.value`),
        ...(optionalString(item.unit, `${itemField}.unit`) ? { unit: optionalString(item.unit, `${itemField}.unit`) } : {}),
        ...(optionalString(item.conditions, `${itemField}.conditions`) ? { conditions: optionalString(item.conditions, `${itemField}.conditions`) } : {}),
        ...(optionalString(item.gameVersion, `${itemField}.gameVersion`) ? { gameVersion: optionalString(item.gameVersion, `${itemField}.gameVersion`) } : {}),
        ...(optionalString(item.notes, `${itemField}.notes`) ? { notes: optionalString(item.notes, `${itemField}.notes`) } : {}),
      }
    })
  })()
  return { ...(enchantments ? { enchantments } : {}), ...(intrinsicProperties ? { intrinsicProperties } : {}), ...(observations ? { observations } : {}) }
}

function parseCatalogItem(value: unknown, index: number): CatalogInventoryItem {
  const field = `inventory.catalogItems[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const category = requireString(value.category, `${field}.category`)
  const catalogId = requireString(value.catalogId, `${field}.catalogId`)
  const catalog = CATALOG_ONLY_EQUIPMENT.find((item) => item.category === category && item.id === catalogId)
  if (!catalog) throw new Error(`${field}は監査済みのruntime未対応Catalogにありません。`)
  const notes = value.notes === undefined ? undefined : requireString(value.notes, `${field}.notes`)
  const research = parseCatalogResearch(value.research, `${field}.research`)
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`), category: catalog.category,
    catalogId, powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`), ...(notes ? { notes } : {}), ...(research ? { research } : {}), ...(rarity ? { rarity } : {}),
  }
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

function requireNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field}は0以上の数値にしてください。`)
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
  return { candidates: [...new Set(candidates)], ...(locked ? { locked } : {}) }
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
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    weaponId: weaponId as WeaponId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...observedDamage,
    enchantmentSlots: value.enchantmentSlots.map((slot, slotIndex) => parseSlot(slot, `${field}.enchantmentSlots[${slotIndex}]`)),
    ...(gilded ? { gilded } : {}),
    ...locked,
    ...(rarity ? { rarity } : {}),
  }
}

function parseArtifact(value: unknown, index: number): OwnedArtifact {
  const field = `inventory.artifacts[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const artifactId = requireString(value.artifactId, `${field}.artifactId`)
  if (!(artifactId in ARTIFACTS)) throw new Error(`${field}.artifactIdに未対応ID「${artifactId}」があります。`)
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    artifactId: artifactId as ArtifactId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...(rarity ? { rarity } : {}),
  }
}

function parseArmor(value: unknown, index: number): OwnedArmor {
  const field = `inventory.armors[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length < 1 || value.enchantmentSlots.length > 3) throw new Error(`${field}.enchantmentSlotsは1〜3スロットにしてください。`)
  const enchantmentSlots = value.enchantmentSlots.map((slot, slotIndex) => {
    const slotField = `${field}.enchantmentSlots[${slotIndex}]`
    if (!isRecord(slot) || !Array.isArray(slot.candidates) || slot.candidates.length === 0) throw new Error(`${slotField}.candidatesには候補を1つ以上指定してください。`)
    const candidates = slot.candidates.map((candidate, candidateIndex) => {
      const candidateField = `${slotField}.candidates[${candidateIndex}]`
      if (!isRecord(candidate) || ![1, 2, 3].includes(candidate.tier as number)) throw new Error(`${candidateField}の形式が正しくありません。`)
      const enchantmentId = requireString(candidate.enchantmentId, `${candidateField}.enchantmentId`)
      if (!isAuditedArmorEnchantmentId(enchantmentId)) throw new Error(`${candidateField}.enchantmentIdに未監査ID「${enchantmentId}」があります。`)
      return { enchantmentId, tier: candidate.tier as ArmorEnchantmentTier }
    })
    const locked = slot.locked === undefined ? undefined : requireString(slot.locked, `${slotField}.locked`)
    if (locked && !candidates.some((candidate) => candidate.enchantmentId === locked)) throw new Error(`${slotField}.lockedは候補内から選択してください。`)
    return { candidates, ...(locked ? { locked } : {}) }
  })
  let gilded: OwnedArmor['gilded']
  if (value.gilded !== undefined) {
    if (!isRecord(value.gilded) || ![1, 2, 3].includes(value.gilded.tier as number)) throw new Error(`${field}.gildedの形式が正しくありません。`)
    const enchantmentId = requireString(value.gilded.enchantmentId, `${field}.gilded.enchantmentId`)
    if (!isAuditedArmorEnchantmentId(enchantmentId)) throw new Error(`${field}.gilded.enchantmentIdに未監査ID「${enchantmentId}」があります。`)
    gilded = { enchantmentId, tier: value.gilded.tier as ArmorEnchantmentTier }
  }
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    armorId: requireString(value.armorId, `${field}.armorId`),
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...(value.observedHealthBonus === undefined ? {} : { observedHealthBonus: requireNonNegativeNumber(value.observedHealthBonus, `${field}.observedHealthBonus`) }),
    enchantmentSlots,
    ...(gilded ? { gilded } : {}),
    ...(value.locked === undefined ? {} : { locked: value.locked === true }),
    ...(rarity ? { rarity } : {}),
  }
}

export function serializeInventory(inventory: Inventory): string {
  return JSON.stringify({ version: 4, inventory } satisfies InventoryDocument, null, 2)
}

export function deserializeInventory(json: string): Inventory {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSONの構文が正しくありません。')
  }
  if (!isRecord(parsed) || ![1, 2, 3, 4].includes(parsed.version as number) || !isRecord(parsed.inventory)) {
    throw new Error('対応していないデータ形式です（version 1〜4が必要です）。')
  }
  const { weapons, armors, artifacts, rangedWeapons, catalogItems } = parsed.inventory
  if (rangedWeapons !== undefined && !Array.isArray(rangedWeapons)) throw new Error('rangedWeaponsは配列にしてください。')
  if (catalogItems !== undefined && !Array.isArray(catalogItems)) throw new Error('catalogItemsは配列にしてください。')
  if (!Array.isArray(weapons) || !Array.isArray(artifacts) || (armors !== undefined && !Array.isArray(armors))) {
    throw new Error('inventoryにはweaponsとartifactsの配列が必要です。')
  }
  const inventory = {
    weapons: weapons.map(parseWeapon),
    ...(Array.isArray(rangedWeapons) ? { rangedWeapons: rangedWeapons.map(parseRangedWeapon) } : {}),
    ...(Array.isArray(armors) ? { armors: armors.map(parseArmor) } : {}),
    artifacts: artifacts.map(parseArtifact),
    ...(Array.isArray(catalogItems) ? { catalogItems: catalogItems.map(parseCatalogItem) } : {}),
  }
  inventory.weapons.forEach(validateWeaponSoulLegality)
  const allIds = [...inventory.weapons, ...(inventory.armors ?? []), ...(inventory.rangedWeapons ?? []), ...inventory.artifacts, ...(inventory.catalogItems ?? [])].map((item) => item.instanceId)
  if (new Set(allIds).size !== allIds.length) throw new Error('装備の管理IDが重複しています。')
  return inventory
}

export function loadInventory(fallback: Inventory): Inventory {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
  return stored === null || stored === undefined ? fallback : deserializeInventory(stored)
}

export function loadInventoryState(fallback: Inventory): { inventory: Inventory; error: string | null; storedJson: string } {
  let storedJson = ''
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    storedJson = stored ?? ''
    return { inventory: stored === null || stored === undefined ? fallback : deserializeInventory(stored), error: null, storedJson }
  } catch (error) {
    return { inventory: fallback, storedJson, error: `保存データを読み込めません。元データを保持して自動保存を停止しました。保存データ / JSONから内容を修正して読み込んでください: ${error instanceof Error ? error.message : '不明なエラー'}` }
  }
}

export function saveInventory(inventory: Inventory): void {
  // A partially edited form must not overwrite the last valid saved document.
  const json = serializeInventory(inventory)
  deserializeInventory(json)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, json)
  } catch (error) {
    throw new Error(
      `ブラウザへの保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      { cause: error },
    )
  }
}
