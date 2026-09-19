import auditJson from '../../research/runtime/armor-core-runtime-audit.json'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'

export const ARMOR_CORE_RUNTIME_AUDIT = auditJson

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function collectArmorRuntimeAuditErrors(value: unknown = ARMOR_CORE_RUNTIME_AUDIT): string[] {
  if (!record(value)) return ['Armor runtime audit must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0' && value.phaseStatus === 'complete', 'invalid Armor runtime audit identity/status')
  check(Array.isArray(value.sources) && value.sources.length >= 10, 'Armor runtime sources missing')
  const armorIds = Object.keys(ARMORS)
  const enchantmentIds = Object.keys(ARMOR_ENCHANTMENTS)
  check(Array.isArray(value.runtimeArmorIds) && value.runtimeArmorIds.join('|') === armorIds.join('|') && armorIds.length >= 2, 'runtime Armor catalog/audit mismatch')
  check(Array.isArray(value.runtimeArmorEnchantmentIds) && value.runtimeArmorEnchantmentIds.join('|') === enchantmentIds.join('|') && enchantmentIds.length >= 2, 'runtime Armor Enchantment catalog/audit mismatch')
  check(Object.values(ARMORS).every((armor) => armor.supportLevel === 'limited'), 'runtime Armor must remain Limited')
  check(Object.values(ARMOR_ENCHANTMENTS).every((enchantment) => enchantment.supportLevel === 'limited' && enchantment.runtimeMaxCopies === 1), 'runtime Armor Enchant boundary drift')
  const decisions = value.decisions
  check(record(decisions), 'Armor runtime decisions missing')
  if (record(decisions)) {
    check(record(decisions.coolDownTierThree) && decisions.coolDownTierThree.gameFileValue === 0.37 && decisions.coolDownTierThree.currentWikiDisplay === 0.38 && decisions.coolDownTierThree.runtimeValue === ARMOR_ENCHANTMENTS['cool-down'].tiers[3], 'Cool Down III conflict/decision drift')
    check(record(decisions.coolDownStacking) && decisions.coolDownStacking.runtimeMaxCopies === 1 && decisions.coolDownStacking.multipleCopies === 'unsupported', 'Cool Down runtime copy boundary missing')
    check(record(decisions.artifactCooldownComposition) && decisions.artifactCooldownComposition.battleRobeWithCoolDown === 'unsupported' && decisions.artifactCooldownComposition.externalWithArmorSource === 'unsupported', 'cooldown composition gate missing')
    check(record(decisions.damageReductionComposition) && decisions.damageReductionComposition.armorWithOtherRuntimeDefense === 'unsupported' && decisions.damageReductionComposition.protection === 'sole-source-only', 'Armor DR composition gate missing')
    check(record(decisions.renegadeAttackSpeed) && decisions.renegadeAttackSpeed.appliedTo === 'attack-cadence' && decisions.renegadeAttackSpeed.deathCapOrRampaging === 'unsupported', 'Renegade cadence boundary missing')
    check(record(decisions.witherSouls) && decisions.witherSouls.multiplier === 1.5 && decisions.witherSouls.zeroFlatGatheringRemainsZero === true && decisions.witherSouls.pickupEventsUnchanged === true && decisions.witherSouls.soulSiphon === 'unsupported', 'Wither Soul boundary missing')
    check(record(decisions.witherLifeSteal) && decisions.witherLifeSteal.fraction === 0.06 && Array.isArray(decisions.witherLifeSteal.eligibleChannels) && decisions.witherLifeSteal.eligibleChannels.join('|') === 'direct-melee', 'Wither Life Steal boundary missing')
    check(record(decisions.chilling) && decisions.chilling.rawTemporalCoverage === 0.5 && decisions.chilling.objective === 'control-only', 'Chilling periodic/control decision drift')
  }
  check(record(value.completion) && value.completion.runtimeArmorCount === armorIds.length && value.completion.runtimeArmorEnchantmentCount === enchantmentIds.length && value.completion.supportLevel === 'limited', 'Armor runtime completion counts drift')
  return errors
}
