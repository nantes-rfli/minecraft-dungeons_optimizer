import type { AttackProfile, Evidence, SourceReference, WeaponDefinition } from '../core/types'
import { japaneseEquipmentName } from './equipmentNames.ja'

/** Finite reviewed population. Registration alone is not a reuse approval. */
export const PLAIN_MELEE_IDS = ['cutlass', 'pickaxe', 'soul-knife', 'whip', 'great-hammer'] as const
export type PlainMeleeId = (typeof PLAIN_MELEE_IDS)[number]
export const isPlainMeleeId = (id: string): id is PlainMeleeId => (PLAIN_MELEE_IDS as readonly string[]).includes(id)

const statSource = (id: PlainMeleeId): SourceReference => ({ id: `plain-melee-${id}-117`, label: `${id} / 1.17.0.0 own serialized calculator row`, url: 'https://www.dungeons.tools/damage-calculator', kind: 'game-files' })
const profileSource = (id: PlainMeleeId, page: string): SourceReference => ({ id: `plain-melee-${id}-profile`, label: `${id} / published complete uniform-hit timings`, url: `https://minecraft.wiki/w/Dungeons%3A${page}`, kind: 'published-reference' })
const definition = (id: PlainMeleeId, en: string, power: number, speed: number, area: number, soul: 0 | 1): WeaponDefinition => ({
  id, name: { en, ja: japaneseEquipmentName('melee', id)! },
  internalPowerRating: { value: power, source: statSource(id), confidence: 'high', note: 'Target-owned exact float; existing Model G only. Not an independently validated damage curve.' },
  speed: { value: speed, source: statSource(id), confidence: 'high', note: 'Rating retained as metadata; never used as effective cadence.' },
  area: { value: area, source: statSource(id), confidence: 'high', note: 'Rating retained, but multi-target evaluation is rejected; no splash/reach conversion.' },
  soul: { acceptsSoulEnchantments: soul === 1, baseSoulGathering: { value: soul, source: { ...statSource(id), url: `https://www.dungeons.tools/weapons/${id}` }, confidence: 'high', note: 'Own plain intrinsic scope; no donor-only effects inherited.' } },
})

export const PLAIN_MELEE_WEAPONS: Readonly<Record<PlainMeleeId, WeaponDefinition>> = {
  cutlass: definition('cutlass', 'Cutlass', 6.473, 3.944, 4.576, 0),
  pickaxe: definition('pickaxe', 'Pickaxe', 11.343, 1.518, 2.386, 0),
  'soul-knife': definition('soul-knife', 'Soul Knife', 12.229, 1, 3.189, 1),
  whip: definition('whip', 'Whip', 8.686, 1.113, 1, 0),
  'great-hammer': definition('great-hammer', 'Great Hammer', 8.686, 1, 7.762, 0),
}

const profile = (id: PlainMeleeId, page: string, durations: readonly number[]): Evidence<AttackProfile> => ({
  value: { method: 'published-hit-timings', hitDurationsSeconds: durations, comboFinisherHit: durations.length },
  source: profileSource(id, page), confidence: 'medium',
  note: 'Target-owned complete published equal-damage hit sequence. Single-target Limited reuse; base cadence only; attack-speed effects rejected. No effective Native timing claim.',
})
export const PLAIN_MELEE_PROFILES: Readonly<Record<PlainMeleeId, Evidence<AttackProfile>>> = {
  cutlass: profile('cutlass', 'Cutlass', [0.4, 0.4]),
  pickaxe: profile('pickaxe', 'Pickaxe', [0.7]),
  'soul-knife': profile('soul-knife', 'Soul_Knife', [0.85]),
  whip: profile('whip', 'Whip', [0.8]),
  'great-hammer': profile('great-hammer', 'Great_Hammer', [0.7]),
}
