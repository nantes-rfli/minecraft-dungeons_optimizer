import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'
import audit from '../../research/melee-enchantment-audit.json'
import { enchantmentCombinationUnsupportedReason, enchantmentUnsupportedReason } from '../core/damageEvents'
import { RUNTIME_SUPPORT_LEVELS, RUNTIME_SUPPORT_REASONS, type MeleeRuntimeSupportManifest } from '../core/runtimeSupport'
import type { EnchantmentId, SelectedEnchantment } from '../core/types'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)

export function collectRuntimeSupportErrors(value: unknown): string[] {
  if (!record(value)) return ['manifest must be an object']
  const errors: string[] = []
  const check = (valid: boolean, message: string) => { if (!valid) errors.push(message) }
  check(value.schemaVersion === 1, 'schemaVersion must be 1')
  check(value.gameVersion === audit.gameVersion, 'gameVersion must match mechanics audit')
  check(value.population === 33, 'population must be 33')
  if (!Array.isArray(value.entries)) return [...errors, 'entries must be an array']
  check(value.entries.length === 33, 'entries must contain 33 entries')
  const ids = new Set<string>()
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string') { errors.push('entry must have an id'); continue }
    const id = entry.id
    check(!ids.has(id), `${id}: duplicate id`)
    ids.add(id)
    check((RUNTIME_SUPPORT_LEVELS as readonly unknown[]).includes(entry.supportLevel), `${id}: invalid supportLevel`)
    check(strings(entry.reasons) && entry.reasons.length > 0 && new Set(entry.reasons).size === entry.reasons.length && entry.reasons.every((reason) => (RUNTIME_SUPPORT_REASONS as readonly string[]).includes(reason)), `${id}: invalid reasons`)
    check(strings(entry.unsupportedCombinations) && new Set(entry.unsupportedCombinations).size === entry.unsupportedCombinations.length, `${id}: invalid unsupportedCombinations`)
    check(strings(entry.assumptionRefs) && entry.assumptionRefs.length > 0, `${id}: assumptionRefs required`)
    check(typeof entry.phaseOrigin === 'string' && /^(0|2-1[A-J])$/.test(entry.phaseOrigin), `${id}: invalid phaseOrigin`)
    check(entry.runtimePowerRange === null || (record(entry.runtimePowerRange) && Number.isInteger(entry.runtimePowerRange.min) && Number.isInteger(entry.runtimePowerRange.max) && Number(entry.runtimePowerRange.min) <= Number(entry.runtimePowerRange.max)), `${id}: invalid Power range`)
    check(Number.isInteger(entry.gameMaxCopies) && Number(entry.gameMaxCopies) >= 1 && Number(entry.gameMaxCopies) <= 4, `${id}: invalid gameMaxCopies`)
    check(entry.runtimeMaxCopies === null || (Number.isInteger(entry.runtimeMaxCopies) && Number(entry.runtimeMaxCopies) >= 1 && Number(entry.runtimeMaxCopies) <= Number(entry.gameMaxCopies)), `${id}: invalid runtimeMaxCopies`)
    check(['melee', 'soul-gear'].includes(String(entry.weaponLegality)), `${id}: invalid weaponLegality`)
    check([null, 'mechanics', 'objective'].includes(entry.blockerCategory as string | null), `${id}: invalid blockerCategory`)
  }
  for (const entry of audit.entries) check(ids.has(entry.id), `${entry.id}: missing population entry`)
  if (errors.length) return errors

  const data = value as unknown as MeleeRuntimeSupportManifest
  for (const entry of data.entries) {
    const id = entry.id as EnchantmentId
    const mechanics = audit.entries.find((item) => item.id === id)
    if (!mechanics) { errors.push(`${id}: unknown population id`); continue }
    const runtime = ENCHANTMENTS[id]
    const research = entry.supportLevel === 'research-only'
    check(Boolean(runtime) === !research, `${id}: catalog membership mismatch`)
    check((mechanics.runtimeStatus === 'implemented') === !research, `${id}: mechanics audit runtimeStatus mismatch`)
    check(entry.name === mechanics.name.en, `${id}: name mismatch`)
    check(entry.gameMaxCopies === mechanics.stacking.maxCopies, `${id}: game copies mismatch`)
    check(entry.weaponLegality === (mechanics.applicability.soulGearOnly ? 'soul-gear' : 'melee'), `${id}: weapon legality mismatch`)
    check(JSON.stringify(entry.runtimePowerRange) === JSON.stringify(mechanics.runtimePowerRange ?? null), `${id}: Power range mismatch`)
    check(entry.reasons.includes('power-range-limited') === (entry.runtimePowerRange !== null), `${id}: power-range-limited reason mismatch`)
    check(entry.reasons.includes('copy-count-limited') === (entry.runtimeMaxCopies !== null && entry.runtimeMaxCopies < entry.gameMaxCopies), `${id}: copy-count-limited reason mismatch`)
    check(entry.reasons.includes('combination-limited') === (entry.unsupportedCombinations.length > 0), `${id}: combination-limited reason mismatch`)
    check(entry.unsupportedCombinations.every((other) => other !== id && data.entries.some((candidate) => candidate.id === other && candidate.supportLevel !== 'research-only')), `${id}: invalid combination partner`)
    if (research) {
      check(entry.runtimeMaxCopies === null && entry.runtimePowerRange === null && entry.unsupportedCombinations.length === 0, `${id}: research-only cannot expose runtime boundaries`)
      const objective = mechanics.runtimeStatus === 'utility-only'
      check(entry.blockerCategory === (objective ? 'objective' : 'mechanics'), `${id}: blocker category mismatch`)
      check(entry.reasons.includes(objective ? 'objective-missing' : 'state-model-missing'), `${id}: missing research blocker reason`)
      check(entry.reasons.every((reason) => objective ? reason === 'objective-missing' : ['state-model-missing', 'interaction-evidence-limited', 'source-data-missing'].includes(reason)), `${id}: incompatible research reason`)
      continue
    }
    check(entry.blockerCategory === null && !entry.reasons.some((reason) => ['objective-missing', 'state-model-missing', 'source-data-missing'].includes(reason)), `${id}: runtime cannot have missing objective/state/source`)
    check(entry.runtimeMaxCopies === runtime?.stacking.value.maxCopies, `${id}: runtime copies mismatch`)
    const limited = entry.runtimePowerRange !== null || entry.runtimeMaxCopies! < entry.gameMaxCopies || entry.unsupportedCombinations.length > 0
    check(entry.supportLevel === (limited ? 'limited' : 'full'), `${id}: support level does not match concrete boundaries`)
    check(entry.reasons.includes('broad-runtime') === !limited, `${id}: broad-runtime reason mismatch`)
    if (!limited) check(entry.reasons.length === 1, `${id}: Full must use broad-runtime alone; assumptions are separate`)
    // Execute the actual boundary across the current gear scope, not a regex copy of rules.
    for (const weapon of Object.values(WEAPONS)) {
      for (let powerLevel = 50; powerLevel <= 263; powerLevel++) {
        const legal = entry.weaponLegality !== 'soul-gear' || weapon.soul.acceptsSoulEnchantments
        const range = entry.runtimePowerRange
        const within = !range || (powerLevel >= range.min && powerLevel <= range.max)
        check(Boolean(enchantmentUnsupportedReason({ weaponId: weapon.id, powerLevel }, id)) === !(legal && within), `${id}: runtime weapon/Power boundary drift at ${weapon.id}/${powerLevel}`)
      }
    }
  }
  for (const id of Object.keys(ENCHANTMENTS)) check(ids.has(id), `${id}: catalog entry lacks support metadata`)
  const runtimeEntries = data.entries.filter((entry) => entry.supportLevel !== 'research-only')
  check(runtimeEntries.length >= 25 && runtimeEntries.length <= 30, 'parent goal requires 25–30 meaningful runtime entries')
  // Both directions are checked. An owner edge suffices; Full partners are not demoted.
  for (const left of runtimeEntries) for (const right of runtimeEntries) {
    const pair: SelectedEnchantment[] = [left, right].map((entry) => ({ enchantmentId: entry.id as EnchantmentId, tier: 3, source: 'slot' }))
    const declared = left.unsupportedCombinations.includes(right.id) || right.unsupportedCombinations.includes(left.id)
      || (left.id === right.id && left.reasons.includes('copy-count-limited'))
    check(Boolean(enchantmentCombinationUnsupportedReason(pair)) === declared, `${left.id}+${right.id}: runtime combination boundary drift`)
  }
  return errors
}
