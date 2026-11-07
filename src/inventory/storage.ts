import { isObservedMeleeComboId } from '../data/observedMeleeCombo'
import { parseCatalogResearch } from '../core/catalogResearch'
import { ARTIFACTS } from '../data/artifacts'
import { WEAPONS } from '../data/weapons'
import { validateWeaponSoulLegality } from '../core/soulLegality'
import type {
  ArtifactId,
  CatalogInventoryItem,
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
import { CATALOG_ONLY_EQUIPMENT, getEquipmentCatalogEntry } from '../data/equipmentCatalog'
import { resolveEnchantment } from '../data/enchantmentCatalog'

const STORAGE_KEY = 'minecraft-dungeons-optimizer.inventory.v1'

// Previously valid Catalog documents must survive these runtime additions.
// This historical migration list is finite; runtime membership alone grants no migration.
const DARK_ARMOR_CATALOG_MIGRATION_IDS: readonly string[] = ['dark-armor', 'titan-s-shroud']
const LIMITED_MELEE_CATALOG_MIGRATION_IDS: readonly string[] = ['cutlass', 'pickaxe', 'soul-knife', 'whip', 'great-hammer', 'whirlwind', 'stormlander']
const migratesLimitedMelee = (item: { category: string; catalogId: string }) => item.category === 'melee' && (LIMITED_MELEE_CATALOG_MIGRATION_IDS.includes(item.catalogId) || isObservedMeleeComboId(item.catalogId))
const migratesRapidCrossbow = (item: { category: string; catalogId: string }) => item.category === 'ranged' && item.catalogId === 'rapid-crossbow'
const migratesDarkArmor = (item: { category: string; catalogId: string }) =>
  item.category === 'armor' && DARK_ARMOR_CATALOG_MIGRATION_IDS.includes(item.catalogId)

interface InventoryDocument {
  readonly version: 6
  readonly inventory: Inventory
}

function parseRarity(value: unknown, field: string): EquipmentRarity | undefined {
  if (value === undefined) return undefined
  if (!['common', 'rare', 'unique'].includes(value as string)) throw new Error(`${field}はcommon / rare / uniqueのいずれかにしてください。`)
  return value as EquipmentRarity
}

function parseFavorite(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`${field}はbooleanにしてください。`)
  return value
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined
  return requireString(value, field)
}


function parseCatalogItem(value: unknown, index: number): CatalogInventoryItem {
  const field = `inventory.catalogItems[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const category = requireString(value.category, `${field}.category`)
  const catalogId = requireString(value.catalogId, `${field}.catalogId`)
  const catalog = CATALOG_ONLY_EQUIPMENT.find((item) => item.category === category && item.id === catalogId)
    ?? (migratesDarkArmor({ category, catalogId }) ? getEquipmentCatalogEntry('armor', catalogId) : migratesLimitedMelee({ category, catalogId }) ? getEquipmentCatalogEntry('melee', catalogId) : migratesRapidCrossbow({ category, catalogId }) ? getEquipmentCatalogEntry('ranged', catalogId) : undefined)
  if (!catalog) throw new Error(`${field}は監査済みのruntime未対応Catalogにありません。`)
  const notes = value.notes === undefined ? undefined : requireString(value.notes, `${field}.notes`)
  const isFavorite = parseFavorite(value.isFavorite, `${field}.isFavorite`)
  const research = parseCatalogResearch(value.research, `${field}.research`)
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  const enchantmentSlots = value.enchantmentSlots === undefined ? undefined : (() => {
    if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length > 3) throw new Error(`${field}.enchantmentSlotsは0〜3スロットにしてください。`)
    return value.enchantmentSlots.map((slot, slotIndex) => parseGenericSlot(slot, `${field}.enchantmentSlots[${slotIndex}]`, catalog.category))
  })()
  const gilded = value.gilded === undefined ? undefined : parseGenericSelection(value.gilded, `${field}.gilded`, catalog.category)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`), category: catalog.category,
    catalogId, powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`), ...(isFavorite === undefined ? {} : { isFavorite }), ...(notes ? { notes } : {}), ...(research ? { research } : {}), ...(rarity ? { rarity } : {}),
    ...(enchantmentSlots ? { enchantmentSlots } : {}), ...(gilded ? { gilded } : {}),
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

function parseGenericSelection(value: unknown, field: string, category: 'melee' | 'armor' | 'ranged' | 'artifact') {
  if (!isRecord(value) || ![1, 2, 3].includes(value.tier as number)) throw new Error(`${field}の形式が正しくありません。`)
  const enchantmentId = parseOwnedEnchantmentId(value.enchantmentId, `${field}.enchantmentId`)
  const definition = resolveEnchantment(enchantmentId)
  if (category === 'artifact' || !definition?.applicableCategories.includes(category)) throw new Error(`${field}は${category}に適用できません。`)
  return { enchantmentId, tier: value.tier as EnchantmentTier }
}

function parseGenericSlot(value: unknown, field: string, category: 'melee' | 'armor' | 'ranged' | 'artifact') {
  if (!isRecord(value) || !Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 3) throw new Error(`${field}.candidatesには候補を1〜3件指定してください。`)
  const candidates = value.candidates.map((candidate, index) => parseOwnedEnchantmentId(candidate, `${field}.candidates[${index}]`))
  if (new Set(candidates).size !== candidates.length) throw new Error(`${field}.candidatesに同じIDを重複して指定できません。`)
  if (category === 'artifact' || candidates.some((id) => !resolveEnchantment(id)?.applicableCategories.includes(category))) throw new Error(`${field}に${category}へ適用できない候補があります。`)
  const selected = value.selected === undefined ? undefined : parseGenericSelection(value.selected, `${field}.selected`, category)
  if (selected && !candidates.includes(selected.enchantmentId)) throw new Error(`${field}.selectedは候補内から選択してください。`)
  return { candidates, ...(selected ? { selected } : {}) }
}

function parseOwnedEnchantmentId(value: unknown, field: string): string {
  const id = requireString(value, field)
  if (!resolveEnchantment(id)) throw new Error(`${field}にゲームデータ未登録ID「${id}」があります。`)
  return id
}

function validateSoulOnlyOwnedEnchantments(category: 'melee' | 'armor' | 'ranged', catalogId: string, slots: readonly EnchantmentSlot[], gilded?: { readonly enchantmentId: string }): void {
  if (getEquipmentCatalogEntry(category, catalogId)?.soulGear) return
  const ids = [...slots.flatMap((slot) => slot.candidates), ...(gilded ? [gilded.enchantmentId] : [])]
  const invalid = ids.find((id) => resolveEnchantment(id)?.soulGearOnly)
  if (invalid) throw new Error(`${invalid}はSoul gear限定です。${catalogId}には設定できません。`)
}

function parseSlot(value: unknown, field: string): EnchantmentSlot {
  if (!isRecord(value) || !Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 3) {
    throw new Error(`${field}.candidatesには候補を1〜3件指定してください。`)
  }
  const candidates = value.candidates.map((candidate, index) =>
    parseOwnedEnchantmentId(candidate, `${field}.candidates[${index}]`),
  )
  if (candidates.some((id) => !resolveEnchantment(id)?.applicableCategories.includes('melee'))) throw new Error(`${field}.candidatesに近接へ適用できないIDがあります。`)
  if (new Set(candidates).size !== candidates.length) throw new Error(`${field}.candidatesに同じIDを重複して指定できません。`)
  const rawSelected = value.selected ?? (value.locked === undefined ? undefined : { enchantmentId: value.locked, tier: 3 })
  // Legacy melee `locked` had no tier because the old UI always treated it as Tier III.
  const selected = rawSelected === undefined ? undefined : (() => {
    if (!isRecord(rawSelected) || ![1, 2, 3].includes(rawSelected.tier as number)) throw new Error(`${field}.selectedの形式が正しくありません。`)
    return { enchantmentId: parseOwnedEnchantmentId(rawSelected.enchantmentId, `${field}.selected.enchantmentId`), tier: rawSelected.tier as EnchantmentTier }
  })()
  if (selected && !candidates.includes(selected.enchantmentId)) {
    throw new Error(`${field}.selectedは候補内から選択してください。`)
  }
  return { candidates, ...(selected ? { selected } : {}) }
}

function parseWeapon(value: unknown, index: number): OwnedWeapon {
  const field = `inventory.weapons[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const weaponId = requireString(value.weaponId, `${field}.weaponId`)
  if (!(weaponId in WEAPONS)) throw new Error(`${field}.weaponIdに未対応ID「${weaponId}」があります。`)
  if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length > 3) {
    throw new Error(`${field}.enchantmentSlotsは0〜3スロットにしてください。`)
  }
  const locked = value.locked === undefined ? {} : { locked: value.locked === true }
  const observedDamage = value.observedDamagePerHit === undefined
    ? {}
    : { observedDamagePerHit: requirePositiveNumber(value.observedDamagePerHit, `${field}.observedDamagePerHit`) }
  if ((value.observedComboDamage !== undefined && !isObservedMeleeComboId(weaponId))
    || (value.observedDamagePerHit !== undefined && isObservedMeleeComboId(weaponId))) {
    throw new Error(`${field}: 武器IDと観測ダメージの入力形式が一致しません。`)
  }
  const observedCombo = value.observedComboDamage === undefined
    ? {}
    : { observedComboDamage: requirePositiveNumber(value.observedComboDamage, `${field}.observedComboDamage`) }
  let gilded: OwnedWeapon['gilded']
  if (value.gilded !== undefined) {
    if (!isRecord(value.gilded) || ![1, 2, 3].includes(value.gilded.tier as number)) {
      throw new Error(`${field}.gildedの形式が正しくありません。`)
    }
    gilded = {
      enchantmentId: parseOwnedEnchantmentId(value.gilded.enchantmentId, `${field}.gilded.enchantmentId`),
      tier: value.gilded.tier as EnchantmentTier,
    }
    if (!resolveEnchantment(gilded.enchantmentId)?.applicableCategories.includes('melee')) throw new Error(`${field}.gildedは近接へ適用できません。`)
  }
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  const notes = optionalString(value.notes, `${field}.notes`)
  const isFavorite = parseFavorite(value.isFavorite, `${field}.isFavorite`)
  const research = parseCatalogResearch(value.research, `${field}.research`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    weaponId: weaponId as WeaponId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...observedDamage,
    ...observedCombo,
    ...(research ? { research } : {}),
    enchantmentSlots: value.enchantmentSlots.map((slot, slotIndex) => parseSlot(slot, `${field}.enchantmentSlots[${slotIndex}]`)),
    ...(gilded ? { gilded } : {}),
    ...(isFavorite === undefined ? {} : { isFavorite }),
    ...locked,
    ...(rarity ? { rarity } : {}),
    ...(notes ? { notes } : {}),
  }
}

function parseArtifact(value: unknown, index: number): OwnedArtifact {
  const field = `inventory.artifacts[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  const artifactId = requireString(value.artifactId, `${field}.artifactId`)
  if (!(artifactId in ARTIFACTS)) throw new Error(`${field}.artifactIdに未対応ID「${artifactId}」があります。`)
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  const notes = optionalString(value.notes, `${field}.notes`)
  const isFavorite = parseFavorite(value.isFavorite, `${field}.isFavorite`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    artifactId: artifactId as ArtifactId,
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...(isFavorite === undefined ? {} : { isFavorite }),
    ...(rarity ? { rarity } : {}),
    ...(notes ? { notes } : {}),
  }
}

function parseArmor(value: unknown, index: number): OwnedArmor {
  const field = `inventory.armors[${index}]`
  if (!isRecord(value)) throw new Error(`${field}の形式が正しくありません。`)
  if (!Array.isArray(value.enchantmentSlots) || value.enchantmentSlots.length > 3) throw new Error(`${field}.enchantmentSlotsは0〜3スロットにしてください。`)
  const enchantmentSlots = value.enchantmentSlots.map((slot, slotIndex) => {
    const slotField = `${field}.enchantmentSlots[${slotIndex}]`
    if (!isRecord(slot) || !Array.isArray(slot.candidates) || slot.candidates.length < 1 || slot.candidates.length > 3) throw new Error(`${slotField}.candidatesには候補を1〜3件指定してください。`)
    const legacyTiers = new Map<string, ArmorEnchantmentTier>()
    const candidates = slot.candidates.map((candidate, candidateIndex) => {
      const candidateField = `${slotField}.candidates[${candidateIndex}]`
      const enchantmentId = isRecord(candidate) ? requireString(candidate.enchantmentId, `${candidateField}.enchantmentId`) : requireString(candidate, candidateField)
      if (!isAuditedArmorEnchantmentId(enchantmentId)) throw new Error(`${candidateField}.enchantmentIdに未監査ID「${enchantmentId}」があります。`)
      if (isRecord(candidate)) {
        if (![1, 2, 3].includes(candidate.tier as number)) throw new Error(`${candidateField}.tierの形式が正しくありません。`)
        legacyTiers.set(enchantmentId, candidate.tier as ArmorEnchantmentTier)
      }
      return enchantmentId
    })
    if (new Set(candidates).size !== candidates.length) throw new Error(`${slotField}.candidatesに同じIDを重複して指定できません。`)
    const rawSelected = slot.selected ?? (slot.locked === undefined ? undefined : { enchantmentId: slot.locked, tier: legacyTiers.get(String(slot.locked)) })
    const selected = rawSelected === undefined ? undefined : (() => {
      if (!isRecord(rawSelected) || ![1, 2, 3].includes(rawSelected.tier as number)) throw new Error(`${slotField}.selectedの形式が正しくありません。`)
      const enchantmentId = requireString(rawSelected.enchantmentId, `${slotField}.selected.enchantmentId`)
      if (!isAuditedArmorEnchantmentId(enchantmentId)) throw new Error(`${slotField}.selectedに未監査ID「${enchantmentId}」があります。`)
      return { enchantmentId, tier: rawSelected.tier as ArmorEnchantmentTier }
    })()
    if (selected && !candidates.includes(selected.enchantmentId)) throw new Error(`${slotField}.selectedは候補内から選択してください。`)
    return { candidates, ...(selected ? { selected } : {}) }
  })
  let gilded: OwnedArmor['gilded']
  if (value.gilded !== undefined) {
    if (!isRecord(value.gilded) || ![1, 2, 3].includes(value.gilded.tier as number)) throw new Error(`${field}.gildedの形式が正しくありません。`)
    const enchantmentId = requireString(value.gilded.enchantmentId, `${field}.gilded.enchantmentId`)
    if (!isAuditedArmorEnchantmentId(enchantmentId)) throw new Error(`${field}.gilded.enchantmentIdに未監査ID「${enchantmentId}」があります。`)
    gilded = { enchantmentId, tier: value.gilded.tier as ArmorEnchantmentTier }
  }
  const rarity = parseRarity(value.rarity, `${field}.rarity`)
  const notes = optionalString(value.notes, `${field}.notes`)
  const isFavorite = parseFavorite(value.isFavorite, `${field}.isFavorite`)
  const research = parseCatalogResearch(value.research, `${field}.research`)
  return {
    instanceId: requireString(value.instanceId, `${field}.instanceId`),
    armorId: requireString(value.armorId, `${field}.armorId`),
    powerLevel: requirePower(value.powerLevel, `${field}.powerLevel`),
    ...(value.observedHealthBonus === undefined ? {} : { observedHealthBonus: requireNonNegativeNumber(value.observedHealthBonus, `${field}.observedHealthBonus`) }),
    enchantmentSlots,
    ...(gilded ? { gilded } : {}),
    ...(research ? { research } : {}),
    ...(value.locked === undefined ? {} : { locked: value.locked === true }),
    ...(isFavorite === undefined ? {} : { isFavorite }),
    ...(rarity ? { rarity } : {}),
    ...(notes ? { notes } : {}),
  }
}

export function serializeInventory(inventory: Inventory): string {
  return JSON.stringify({ version: 6, inventory } satisfies InventoryDocument, null, 2)
}

export function deserializeInventory(json: string): Inventory {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSONの構文が正しくありません。')
  }
  if (!isRecord(parsed) || ![1, 2, 3, 4, 5, 6].includes(parsed.version as number) || !isRecord(parsed.inventory)) {
    throw new Error('対応していないデータ形式です（version 1〜6が必要です）。')
  }
  const { weapons, armors, artifacts, rangedWeapons, catalogItems } = parsed.inventory
  if (rangedWeapons !== undefined && !Array.isArray(rangedWeapons)) throw new Error('rangedWeaponsは配列にしてください。')
  if (catalogItems !== undefined && !Array.isArray(catalogItems)) throw new Error('catalogItemsは配列にしてください。')
  if (!Array.isArray(weapons) || !Array.isArray(artifacts) || (armors !== undefined && !Array.isArray(armors))) {
    throw new Error('inventoryにはweaponsとartifactsの配列が必要です。')
  }
  const parsedCatalog = Array.isArray(catalogItems) ? catalogItems.map(parseCatalogItem) : undefined
  const parsedArmors = Array.isArray(armors) ? armors.map(parseArmor) : []
  const parsedWeapons = weapons.map(parseWeapon)
  const parsedRanged = Array.isArray(rangedWeapons) ? rangedWeapons.map(parseRangedWeapon) : []
  for (const item of parsedCatalog ?? []) if (migratesRapidCrossbow(item)) {
    // Carry facts verbatim; no observation (including cost) is inferred from Research/Native.
    parsedRanged.push(parseRangedWeapon({ ...item, weaponId: item.catalogId, enchantmentSlots: item.enchantmentSlots ?? [] }))
  }
  for (const item of parsedCatalog ?? []) if (migratesLimitedMelee(item)) {
    // Transfer recorded facts only; Research never supplies damage or actual rolls.
    parsedWeapons.push(parseWeapon({ ...item, weaponId: item.catalogId, enchantmentSlots: item.enchantmentSlots ?? [] }, parsedWeapons.length))
  }
  for (const item of parsedCatalog ?? []) if (migratesDarkArmor(item)) {
    // Carry only explicitly recorded rolls; no HP, Tier or effective value is inferred from Research.
    parsedArmors.push(parseArmor({ ...item, armorId: item.catalogId, enchantmentSlots: item.enchantmentSlots ?? [] }, parsedArmors.length))
  }
  const inventory = {
    weapons: parsedWeapons,
    ...(Array.isArray(rangedWeapons) || parsedRanged.length ? { rangedWeapons: parsedRanged } : {}),
    ...(Array.isArray(armors) || parsedArmors.length ? { armors: parsedArmors } : {}),
    artifacts: artifacts.map(parseArtifact),
    ...(parsedCatalog ? { catalogItems: parsedCatalog.filter((item) => !migratesDarkArmor(item) && !migratesLimitedMelee(item) && !migratesRapidCrossbow(item)) } : {}),
  }
  inventory.weapons.forEach(validateWeaponSoulLegality)
  inventory.armors?.forEach((armor) => validateSoulOnlyOwnedEnchantments('armor', armor.armorId, armor.enchantmentSlots, armor.gilded))
  inventory.rangedWeapons?.forEach((weapon) => validateSoulOnlyOwnedEnchantments('ranged', weapon.weaponId, weapon.enchantmentSlots, weapon.gilded))
  inventory.catalogItems?.forEach((item) => {
    if (item.category !== 'artifact') validateSoulOnlyOwnedEnchantments(item.category, item.catalogId, item.enchantmentSlots ?? [], item.gilded)
  })
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
