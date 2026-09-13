import meleeAudit from '../../research/melee-attack-profile-audit.json'
import armorAudit from '../../research/armor-audit.json'
import rangedAudit from '../../research/ranged-weapon-audit.json'
import artifactAudit from '../../research/artifact-audit.json'
import equipmentIconManifest from '../../generated/equipment-icons/manifest.json'
import { WEAPONS } from './weapons'
import { ARMORS } from './armors'
import { RANGED_WEAPONS } from './ranged'
import { ARTIFACTS } from './artifacts'
import type { EquipmentCategory } from '../core/types'
import { japaneseEquipmentName } from './equipmentNames.ja'

export type RuntimeSupportLevel = 'full' | 'limited' | 'unsupported'

export interface EquipmentCatalogEntry {
  readonly category: EquipmentCategory
  readonly id: string
  readonly name: { readonly ja?: string; readonly en: string }
  readonly runtimeSupport: RuntimeSupportLevel
  readonly legacyRuntimeSupport: 'full' | 'limited' | 'research-only'
  readonly auditStatus: string
  readonly intrinsicProperties: readonly { readonly kind: string; readonly raw: string }[]
  readonly builtInEnchantments: readonly { readonly enchantmentId: string; readonly tier?: number }[]
  readonly family?: string
  /** Catalog-confirmed class only. Common and Rare remain per-instance choices. */
  readonly rarityFamily: 'normal' | 'unique' | 'not-applicable'
  /** True only when the audited catalog explicitly identifies Soul equipment. */
  readonly soulGear?: true
  /** Local, licensed asset path. The UI uses a category fallback when omitted. */
  readonly icon?: string
}

const runtimeLevel = (category: EquipmentCategory, id: string): RuntimeSupportLevel => {
  if (category === 'melee') return id in WEAPONS ? 'full' : 'unsupported'
  if (category === 'armor') return id in ARMORS ? 'limited' : 'unsupported'
  if (category === 'ranged') return id in RANGED_WEAPONS ? 'limited' : 'unsupported'
  return id in ARTIFACTS ? (id === 'shock-powder' ? 'limited' : 'full') : 'unsupported'
}

// Existing accepted melee audit values explicitly record Soul gathering for these items.
const AUDITED_MELEE_SOUL_GEAR_IDS = new Set(['moon-daggers', 'soul-fists', 'soul-knife', 'eternal-knife', 'truthseeker', 'soul-scythe', 'frost-scythe', 'jailors-scythe', 'skull-scythe'])

const equipmentIcons = new Map(equipmentIconManifest.entries.filter((item) => item.status === 'matched' && item.outputWebp).map((item) => [`${item.category}:${item.catalogId}`, `/${item.outputWebp!.replace(/^public\//, '')}`]))

const entry = (category: EquipmentCategory, id: string, name: EquipmentCatalogEntry['name'], auditStatus: string, details: Pick<EquipmentCatalogEntry, 'intrinsicProperties' | 'builtInEnchantments'> & Partial<Pick<EquipmentCatalogEntry, 'family' | 'rarityFamily' | 'soulGear'>> = { intrinsicProperties: [], builtInEnchantments: [] }): EquipmentCatalogEntry => {
  const runtimeSupport = runtimeLevel(category, id)
  return { category, id, name: { en: name.en, ja: japaneseEquipmentName(category, id, name.ja) }, runtimeSupport, legacyRuntimeSupport: runtimeSupport === 'unsupported' ? 'research-only' : runtimeSupport, auditStatus, rarityFamily: category === 'artifact' ? 'not-applicable' : 'normal', icon: equipmentIcons.get(`${category}:${id}`), ...details }
}

export const EQUIPMENT_CATALOG: readonly EquipmentCatalogEntry[] = [
  ...meleeAudit.weapons.map((item) => entry('melee', item.weaponId, { en: item.name.en, ...(item.name.ja ? { ja: item.name.ja } : {}) }, item.status, {
    intrinsicProperties: [], builtInEnchantments: [], family: item.family,
    rarityFamily: 'variantOf' in item && item.variantOf ? 'unique' : 'normal',
    ...(AUDITED_MELEE_SOUL_GEAR_IDS.has(item.weaponId) ? { soulGear: true as const } : {}),
  })),
  ...armorAudit.entries.map((item) => entry('armor', item.id, { en: item.name }, item.runtimeReadiness, {
    intrinsicProperties: item.intrinsicProperties.map(({ kind, raw }) => ({ kind, raw })),
    builtInEnchantments: item.builtInEnchantments.map(({ enchantmentId, tier }) => ({ enchantmentId, tier })),
    family: item.family, rarityFamily: item.rarity === 'unique' ? 'unique' : 'normal', ...(item.soulGear ? { soulGear: true as const } : {}),
  })),
  ...rangedAudit.entries.map((item) => entry('ranged', item.id, { en: item.name.en, ...(item.name.ja ? { ja: item.name.ja } : {}) }, item.auditStatus, {
    intrinsicProperties: [], builtInEnchantments: [], family: item.family, rarityFamily: item.rarity === 'unique' ? 'unique' : 'normal', ...(item.soul.related ? { soulGear: true as const } : {}),
  })),
  ...artifactAudit.entries.map((item) => entry('artifact', item.id, { en: item.name }, item.runtimeReadiness, { intrinsicProperties: [], builtInEnchantments: [], ...(item.soul?.required ? { soulGear: true as const } : {}) })),
  ...artifactAudit.populationDifferences.map((item) => entry('artifact', item.id, { en: item.name }, item.runtimeReadiness)),
].sort((left, right) => left.category.localeCompare(right.category) || left.name.en.localeCompare(right.name.en))

export const CATALOG_ONLY_EQUIPMENT = EQUIPMENT_CATALOG.filter((item) => item.runtimeSupport === 'unsupported')

export function getEquipmentCatalogEntry(category: EquipmentCategory, id: string): EquipmentCatalogEntry | undefined {
  return EQUIPMENT_CATALOG.find((item) => item.category === category && item.id === id)
}
