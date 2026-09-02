import auditJson from '../../research/armor-enchantment-audit.json'

export const ARMOR_ENCHANTMENT_AUDIT = auditJson
export const ARMOR_ENCHANTMENT_REFERENCE_CATALOG = Object.fromEntries(
  ARMOR_ENCHANTMENT_AUDIT.entries.map((entry) => [entry.id, entry]),
) as Readonly<Record<string, (typeof ARMOR_ENCHANTMENT_AUDIT.entries)[number]>>
export const ARMOR_ENCHANTMENT_REFERENCE_IDS = ARMOR_ENCHANTMENT_AUDIT.entries.map((entry) => entry.id)
export const isAuditedArmorEnchantmentId = (id: string): boolean => Object.hasOwn(ARMOR_ENCHANTMENT_REFERENCE_CATALOG, id)
export const ARMOR_ENCHANTMENT_FAMILIES = ['defense', 'healing', 'cooldown', 'damage-modifier', 'control', 'roll', 'soul', 'pet', 'potion', 'economy', 'utility', 'other'] as const
export const ARMOR_ENCHANTMENT_READINESS = ['ready', 'ready-with-limits', 'needs-state-model', 'needs-damage-event-model', 'needs-roll-model', 'needs-pet-model', 'needs-objective', 'utility-only', 'research-only'] as const

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)

export function collectArmorEnchantmentAuditErrors(value: unknown = ARMOR_ENCHANTMENT_AUDIT, armorAudit?: { entries: readonly { id: string; builtInEnchantments: readonly { enchantmentId: string; classification: string }[] }[] }): string[] {
  if (!record(value)) return ['Armor enchantment audit must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0', 'invalid Armor enchantment schema/version')
  check(record(value.population) && value.population.allPlayerEnchantments === 97 && value.population.heroAccessibleArmorCount === 41, 'Armor enchantment population drift')
  if (!Array.isArray(value.sources) || !Array.isArray(value.entries)) return [...errors, 'Armor enchantment sources/entries must be arrays']
  const sourceIds = new Set(value.sources.filter(record).map((source) => String(source.id)))
  const ids = new Set<string>()
  check(value.entries.length === 41, 'Armor enchantment entry count must be 41')
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string') { errors.push('Armor enchantment entry must have ID'); continue }
    const id = entry.id
    check(!ids.has(id), `${id}: duplicate Armor enchantment ID`); ids.add(id)
    check(typeof entry.name === 'string' && Array.isArray(entry.tiers) && entry.tiers.length === 3 && entry.tiers.every((tier) => typeof tier === 'string' && tier.length > 0), `${id}: invalid tiers`)
    check(typeof entry.powerful === 'boolean' && typeof entry.stackable === 'boolean' && Number.isInteger(entry.maxCopies) && entry.maxCopies === (entry.stackable ? 4 : 1), `${id}: invalid rarity/stacking`)
    check(['none', 'soul-armor-only', 'special'].includes(String(entry.soulRestriction)), `${id}: invalid Soul restriction`)
    check((ARMOR_ENCHANTMENT_FAMILIES as readonly unknown[]).includes(entry.mechanicFamily), `${id}: invalid mechanic family`)
    check((ARMOR_ENCHANTMENT_READINESS as readonly unknown[]).includes(entry.runtimeReadiness), `${id}: invalid runtime readiness`)
    check(strings(entry.blockers) && strings(entry.sourceIds) && entry.sourceIds.every((sourceId) => sourceIds.has(sourceId)), `${id}: blockers/source IDs required`)
    check(Array.isArray(entry.builtIntoArmorIds) && entry.builtIntoArmorIds.every((armorId) => typeof armorId === 'string'), `${id}: built-in Armor refs invalid`)
    if (armorAudit && Array.isArray(entry.builtIntoArmorIds)) for (const armorId of entry.builtIntoArmorIds) {
      const armor = armorAudit.entries.find((item) => item.id === armorId)
      check(Boolean(armor) && armor!.builtInEnchantments.some((builtIn) => builtIn.classification === 'armor-enchantment' && builtIn.enchantmentId === id), `${id}: built-in reference missing from ${String(armorId)}`)
    }
  }
  check(value.entries.filter((entry) => entry.powerful).length === 11 && value.entries.filter((entry) => !entry.powerful).length === 30, 'Armor enchantment rarity counts drift')
  check(value.entries.filter((entry) => entry.soulRestriction === 'soul-armor-only').map((entry) => entry.id).join('|') === 'soul-speed', 'Soul-only Armor enchantment count drift')
  check(Array.isArray(value.deepAuditIds) && value.deepAuditIds.length === 14 && value.deepAuditIds.every((id) => ids.has(id)), 'deep Armor enchantment audit set drift')
  if (armorAudit) for (const armor of armorAudit.entries) for (const builtIn of armor.builtInEnchantments) if (builtIn.classification === 'armor-enchantment') check(ids.has(builtIn.enchantmentId), `${armor.id}: unknown built-in Armor enchantment ${builtIn.enchantmentId}`)
  return errors
}

export function summarizeArmorEnchantmentAudit() {
  const entries = ARMOR_ENCHANTMENT_AUDIT.entries
  const readiness = Object.fromEntries([...new Set(entries.map((entry) => entry.runtimeReadiness))].sort().map((status) => [status, entries.filter((entry) => entry.runtimeReadiness === status).length]))
  const families = Object.fromEntries([...new Set(entries.map((entry) => entry.mechanicFamily))].sort().map((family) => [family, entries.filter((entry) => entry.mechanicFamily === family).length]))
  return { population: entries.length, common: entries.filter((entry) => !entry.powerful).length, powerful: entries.filter((entry) => entry.powerful).length, soulOnly: entries.filter((entry) => entry.soulRestriction === 'soul-armor-only').length, utilityOnly: entries.filter((entry) => entry.runtimeReadiness === 'utility-only').length, readiness, families }
}
