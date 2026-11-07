import type { AttackProfile, Evidence, SelectedEnchantment, SourceReference, WeaponDefinition } from '../core/types'
import { japaneseEquipmentName } from './equipmentNames.ja'

/** Exact reviewed population. These required effects never disappear on source withdrawal. */
export const BUILTIN_PROC_MELEE_IDS = ['whirlwind', 'stormlander'] as const
export type BuiltinProcMeleeId = typeof BUILTIN_PROC_MELEE_IDS[number]
export const isBuiltinProcMeleeId = (id: string): id is BuiltinProcMeleeId => (BUILTIN_PROC_MELEE_IDS as readonly string[]).includes(id)
export const BUILTIN_PROC_MELEE_FACTS = {
  whirlwind: { rawIdentity: 'DoubleAxe_Unique1', name: 'Whirlwind', power: 8.686, speed: 2.057, area: 12.927, durations: [0.6, 0.6], intrinsic: ['Spin attack', 'Casts shockwaves'], enchantmentId: 'shockwave', min: 210, max: 252 },
  stormlander: { rawIdentity: 'Hammer_Unique1', name: 'Stormlander', power: 8.686, speed: 1, area: 7.762, durations: [0.7], intrinsic: ['Great splash', 'Fires lighting bolts'], enchantmentId: 'thundering', min: 248, max: 263 },
} as const
export function builtinProcMeleeEnchantments(id: string): readonly SelectedEnchantment[] {
  return isBuiltinProcMeleeId(id) ? [{ enchantmentId: BUILTIN_PROC_MELEE_FACTS[id].enchantmentId, tier: 1, source: 'built-in' }] : []
}
export const builtinProcStatSource = (id: BuiltinProcMeleeId): SourceReference => ({ id: `builtin-proc-${id}-117`, label: `${id} / 1.17.0.0 own serialized calculator row`, url: 'https://www.dungeons.tools/damage-calculator', kind: 'game-files' })
export const builtinProcProfileSource = (id: BuiltinProcMeleeId): SourceReference => ({ id: `builtin-proc-${id}-profile`, label: `${id} / published complete uniform-hit timings`, url: `https://minecraft.wiki/w/Dungeons%3A${BUILTIN_PROC_MELEE_FACTS[id].name}`, kind: 'published-reference' })
export const BUILTIN_PROC_MELEE_WEAPONS = Object.fromEntries(BUILTIN_PROC_MELEE_IDS.map((id) => {
  const fact = BUILTIN_PROC_MELEE_FACTS[id], source = builtinProcStatSource(id)
  return [id, { id, name: { en: fact.name, ja: japaneseEquipmentName('melee', id)! },
    internalPowerRating: { value: fact.power, source, confidence: 'high', note: 'Own exact rating; existing Model G only, no new Power conversion.' },
    speed: { value: fact.speed, source, confidence: 'high', note: 'Metadata only; never effective cadence.' },
    area: { value: fact.area, source, confidence: 'high', note: 'Metadata only; single target, no reach or splash conversion.' },
    soul: { acceptsSoulEnchantments: false, baseSoulGathering: { value: 0, source: { ...source, url: `https://www.dungeons.tools/weapons/${id}` }, confidence: 'high' } },
  } satisfies WeaponDefinition]
})) as Record<BuiltinProcMeleeId, WeaponDefinition>
const profile = (id: BuiltinProcMeleeId): Evidence<AttackProfile> => ({
  value: { method: 'published-hit-timings', hitDurationsSeconds: BUILTIN_PROC_MELEE_FACTS[id].durations, comboFinisherHit: BUILTIN_PROC_MELEE_FACTS[id].durations.length },
  source: builtinProcProfileSource(id), confidence: 'medium', note: 'Own complete equal-damage profile; single target and base cadence only. No Native timing adoption.',
})
export const BUILTIN_PROC_MELEE_PROFILES = { whirlwind: profile('whirlwind'), stormlander: profile('stormlander') }
