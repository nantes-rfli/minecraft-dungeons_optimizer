import auditJson from '../../research/armor-expansion-state-enchant-audit.json'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'
import { ARMOR_ENCHANTMENT_REFERENCE_IDS } from './armorEnchantmentAudit'

export const ARMOR_EXPANSION_AUDIT = auditJson
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function collectArmorExpansionAuditErrors(value: unknown = ARMOR_EXPANSION_AUDIT): string[] {
  if (!record(value)) return ['Armor expansion audit must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0' && value.phaseStatus === 'complete', 'invalid Armor expansion identity/status')
  check(Array.isArray(value.sources) && value.sources.length >= 9, 'Armor expansion sources missing')
  check(Array.isArray(value.armorExpansion) && value.armorExpansion.length === 4, 'new runtime Armor count drift')
  if (Array.isArray(value.armorExpansion)) for (const entry of value.armorExpansion) {
    check(record(entry) && typeof entry.id === 'string' && entry.id in ARMORS && entry.supportLevel === 'limited' && record(entry.properties) && Object.keys(entry.properties).length === 2, 'invalid property-driven Armor expansion entry')
  }
  check(Array.isArray(value.armorEnchantments) && value.armorEnchantments.length === 4, 'new runtime Armor Enchantment count drift')
  if (Array.isArray(value.armorEnchantments)) for (const entry of value.armorEnchantments) {
    check(record(entry) && typeof entry.id === 'string' && entry.id in ARMOR_ENCHANTMENTS && entry.supportLevel === 'limited' && Array.isArray(entry.tiers) && entry.tiers.join('|') === Object.values(ARMOR_ENCHANTMENTS[entry.id as keyof typeof ARMOR_ENCHANTMENTS].tiers).join('|'), 'invalid Armor Enchantment runtime entry')
  }
  check(record(value.contributionPolicy) && value.contributionPolicy.wholeArmorLeaveOneOut === 'removed' && value.contributionPolicy.armorEnchantmentLeaveOneOut === 'retained' && value.contributionPolicy.rankingMetricsChanged === false, 'Armor contribution display policy drift')
  check(record(value.inventoryPolicy) && value.inventoryPolicy.referenceCatalogCount === ARMOR_ENCHANTMENT_REFERENCE_IDS.length && value.inventoryPolicy.referenceCatalogCount === 41 && value.inventoryPolicy.runtimeCatalogCount === Object.keys(ARMOR_ENCHANTMENTS).length && value.inventoryPolicy.unsupportedFreeAlternative === 'reject', 'Armor Enchantment inventory policy drift')
  check(record(value.cooldownStacking) && value.cooldownStacking.status === 'inconclusive' && record(value.cooldownStacking.runtimePolicy) && value.cooldownStacking.runtimePolicy.battleRobeWithCoolDown === 'unsupported' && value.cooldownStacking.runtimePolicy.multipleCoolDownCopies === 'unsupported' && value.cooldownStacking.runtimePolicy.runtimeMaxCopies === 1, 'CDR rejection policy drift')
  check(record(value.completion) && value.completion.runtimeArmorCount === Object.keys(ARMORS).length && value.completion.newRuntimeArmorCount === 4 && value.completion.runtimeArmorEnchantmentCount === Object.keys(ARMOR_ENCHANTMENTS).length && value.completion.newRuntimeArmorEnchantmentCount === 4, 'Armor expansion completion counts drift')
  return errors
}
