import catalogSnapshot from '../../generated/enchantment-icons/catalog.json'
import iconManifest from '../../generated/enchantment-icons/manifest.json'
import meleeAudit from '../../research/melee-enchantment-audit.json'
import armorAudit from '../../research/armor-enchantment-audit.json'
import rangedAudit from '../../research/ranged-enchantment-audit.json'
import { ENCHANTMENTS } from './enchantments'
import { ARMOR_ENCHANTMENTS } from './armors'
import { RANGED_ENCHANTMENTS } from './ranged'
import { ENCHANTMENT_NAMES_JA } from './enchantmentNames.ja'

export type EnchantmentCatalogCategory = 'melee' | 'ranged' | 'armor'
export type EnchantmentRarity = 'common' | 'powerful'

export interface EnchantmentCatalogEntry {
  readonly id: string
  readonly name: { readonly en: string; readonly ja: string }
  readonly applicableCategories: readonly EnchantmentCatalogCategory[]
  readonly icon?: string
  readonly iconsByCategory?: Partial<Record<EnchantmentCatalogCategory, string>>
  readonly rarity: EnchantmentRarity
  readonly soulGearOnly: boolean
  readonly availability: { readonly normalSlot: boolean; readonly gilded: boolean; readonly builtIn: boolean }
  readonly tierValuesByCategory: Partial<Record<EnchantmentCatalogCategory, readonly string[]>>
}

const iconPaths = new Map(iconManifest.entries.filter((entry) => entry.status === 'matched' && entry.outputWebp).map((entry) => [entry.enchantmentId, `/${entry.outputWebp!.replace(/^public\//, '')}`]))
const categoryIconPaths = new Map(iconManifest.entries.filter((entry) => entry.categoryOutputs).map((entry) => [entry.enchantmentId, Object.fromEntries(Object.entries(entry.categoryOutputs!).map(([category, output]) => [category, `/${output.outputWebp.replace(/^public\//, '')}`]))]))
type MeleeAuditEntry = { id: string; name: { en: string; ja?: string }; rarity: EnchantmentRarity; soul?: { soulGearOnly?: boolean }; obtainable?: { normalSlot?: boolean; gilded?: boolean; builtInUnique?: boolean }; tierValues?: Record<string, { raw?: string }> }
type ArmorAuditEntry = { id: string; name: string; powerful: boolean; soulRestriction?: string; tiers: readonly string[]; builtIntoArmorIds?: readonly string[] }
type RangedAuditEntry = { id: string; name: { en: string; ja?: string | null }; rarity?: string | null; tierValues?: string }
const meleeById = new Map((meleeAudit.entries as readonly MeleeAuditEntry[]).map((entry) => [entry.id, entry]))
const armorById = new Map((armorAudit.entries as readonly ArmorAuditEntry[]).map((entry) => [entry.id, entry]))
const rangedById = new Map((rangedAudit.entries as readonly RangedAuditEntry[]).map((entry) => [entry.id, entry]))
const verifiedJapaneseNames = new Map<string, string>([
  ...Object.values(ENCHANTMENTS).map((entry) => [entry.id, entry.name.ja] as const),
  ...Object.entries(ARMOR_ENCHANTMENTS).map(([id, entry]) => [id, entry.name.ja] as const),
  ...Object.entries(RANGED_ENCHANTMENTS).map(([id, entry]) => [id, entry.name.ja] as const),
])

const splitTierValues = (value?: string): readonly string[] => value ? value.split(/\s*\/\s*/) : []
export const ENCHANTMENT_CATALOG: readonly EnchantmentCatalogEntry[] = catalogSnapshot.entries
  .map((item) => {
    const melee = meleeById.get(item.id)
    const armor = armorById.get(item.id)
    const ranged = rangedById.get(item.id)
    const rarity = melee?.rarity ?? (armor ? (armor.powerful ? 'powerful' : 'common') : ranged?.rarity?.toLocaleLowerCase() as EnchantmentRarity | undefined)
    const ja = item.name.ja ?? melee?.name.ja ?? ranged?.name.ja ?? verifiedJapaneseNames.get(item.id) ?? ENCHANTMENT_NAMES_JA[item.id]
    if (!rarity || !ja) throw new Error(`Canonical enchantment metadata is incomplete: ${item.id}`)
    const meleeTiers = melee?.tierValues ? [1, 2, 3].map((tier) => melee.tierValues?.[String(tier)]?.raw ?? '—') : undefined
    return {
      id: item.id,
      name: { en: item.name.en, ...(ja ? { ja } : {}) },
      applicableCategories: item.applicableCategories as readonly EnchantmentCatalogCategory[],
      ...(iconPaths.get(item.id) ? { icon: iconPaths.get(item.id) } : {}),
      ...(categoryIconPaths.get(item.id) ? { iconsByCategory: categoryIconPaths.get(item.id) } : {}),
      rarity,
      soulGearOnly: Boolean(melee?.soul?.soulGearOnly || armor?.soulRestriction === 'soul-gear-only'),
      availability: {
        normalSlot: melee?.obtainable?.normalSlot ?? true,
        gilded: melee?.obtainable?.gilded ?? true,
        builtIn: melee?.obtainable?.builtInUnique ?? Boolean(armor?.builtIntoArmorIds?.length),
      },
      tierValuesByCategory: {
        ...(meleeTiers ? { melee: meleeTiers } : {}),
        ...(armor?.tiers ? { armor: armor.tiers } : {}),
        ...(ranged?.tierValues ? { ranged: splitTierValues(ranged.tierValues) } : {}),
      },
    }
  })
  .sort((left, right) => left.id.localeCompare(right.id))

const normalize = (value: string): string => String(value).normalize('NFKC').replace(/\s+(?:tier\s*)?(?:i{1,3}|[1-3])$/i, '').replace(/[^\p{Letter}\p{Number}]/gu, '').toLocaleLowerCase()
const aliases: Readonly<Record<string, string>> = { cooldown: 'cool-down', 'radiancemelee': 'radiance', 'radianceranged': 'radiance-shot' }
const lookup = new Map<string, EnchantmentCatalogEntry>()

for (const entry of ENCHANTMENT_CATALOG) {
  for (const identity of [entry.id, entry.name.en, entry.name.ja].filter((value): value is string => Boolean(value))) lookup.set(normalize(identity), entry)
}
for (const [alias, id] of Object.entries(aliases)) {
  const entry = ENCHANTMENT_CATALOG.find((candidate) => candidate.id === id)
  if (entry) lookup.set(normalize(alias), entry)
}

export function resolveEnchantment(value: string): EnchantmentCatalogEntry | undefined {
  return lookup.get(normalize(value))
}
