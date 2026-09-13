import catalogSnapshot from '../../generated/enchantment-icons/catalog.json'
import iconManifest from '../../generated/enchantment-icons/manifest.json'

export type EnchantmentCatalogCategory = 'melee' | 'ranged' | 'armor'

export interface EnchantmentCatalogEntry {
  readonly id: string
  readonly name: { readonly en: string; readonly ja?: string }
  readonly applicableCategories: readonly EnchantmentCatalogCategory[]
  readonly icon?: string
}

const iconPaths = new Map(iconManifest.entries.filter((entry) => entry.status === 'matched' && entry.outputWebp).map((entry) => [entry.enchantmentId, `/${entry.outputWebp!.replace(/^public\//, '')}`]))
export const ENCHANTMENT_CATALOG: readonly EnchantmentCatalogEntry[] = catalogSnapshot.entries
  .map((item) => ({ id: item.id, name: item.name, applicableCategories: item.applicableCategories as readonly EnchantmentCatalogCategory[], ...(iconPaths.get(item.id) ? { icon: iconPaths.get(item.id) } : {}) }))
  .sort((left, right) => left.id.localeCompare(right.id))

const normalize = (value: string): string => value.normalize('NFKC').replace(/\s+(?:tier\s*)?(?:i{1,3}|[1-3])$/i, '').replace(/[^\p{Letter}\p{Number}]/gu, '').toLocaleLowerCase()
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
