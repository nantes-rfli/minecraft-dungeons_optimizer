import { FIXED_OBSERVED_MELEE_COMBO_SOURCE, SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE, RADIANCE_OBSERVED_MELEE_COMBO_SOURCE, FREEZING_OBSERVED_MELEE_COMBO_SOURCE, POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE, WEAKENING_OBSERVED_MELEE_COMBO_SOURCE, isFixedObservedMeleeComboId, type FixedObservedMeleeComboId } from './fixedObservedMeleeCombo'
import source from '../../research/sources/observed-melee-combo-source.json' with { type: 'json' }
import type { AttackProfile, Evidence, SourceReference, WeaponDefinition } from '../core/types'
import { japaneseEquipmentName } from './equipmentNames.ja'

export const OBSERVED_MELEE_COMBO_IDS = ['battlestaff', 'coral-blade', 'gauntlets', 'glaive', 'katana', 'mace', 'obsidian-claymore', 'rapier', 'sickles', 'spear'] as const
type PlainObservedMeleeComboId = (typeof OBSERVED_MELEE_COMBO_IDS)[number]
export type ObservedMeleeComboId = PlainObservedMeleeComboId | FixedObservedMeleeComboId
export const isPlainObservedMeleeComboId = (id: string): id is PlainObservedMeleeComboId =>
  (OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)
export const isObservedMeleeComboId = (id: string): id is ObservedMeleeComboId =>
  isPlainObservedMeleeComboId(id) || isFixedObservedMeleeComboId(id)

export const OBSERVED_MELEE_COMBO_SOURCE = source
const rows = [...source.rows, ...FIXED_OBSERVED_MELEE_COMBO_SOURCE.rows, ...SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE.rows, ...RADIANCE_OBSERVED_MELEE_COMBO_SOURCE.rows, ...FREEZING_OBSERVED_MELEE_COMBO_SOURCE.rows, ...POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE.rows, ...WEAKENING_OBSERVED_MELEE_COMBO_SOURCE.rows]
export const observedMeleeComboRow = (id: string) => rows.find((row) => row.id === id)
export const OBSERVED_MELEE_COMBO_LIMITATION = 'Limited: 単体に基本速度で中断せず通常コンボを繰り返す条件。個体のコンボ全段の観測合計が必須。速度効果・遠距離併用・ヒット順や撃破に依存するEnchantは対象外。'

export const OBSERVED_MELEE_COMBO_WEAPONS = Object.fromEntries(rows.map((row) => {
  const id = row.id as ObservedMeleeComboId
  const soul = FREEZING_OBSERVED_MELEE_COMBO_SOURCE.rows.find((scythe) => scythe.id === id)?.soul
  const stats: SourceReference = { id: `observed-melee-combo-${id}-117`, label: `${row.calculatorRow.name} / 1.17.0.0 own calculator row`, url: source.calculatorSource.url, kind: 'game-files' }
  const metadata = (value: number): Evidence<number> => ({ value, source: stats, confidence: 'high', note: 'Equipment rating only. No Power-to-combo damage, speed, or splash conversion.' })
  const weapon: WeaponDefinition = {
    id, name: { en: row.calculatorRow.name, ja: japaneseEquipmentName('melee', id)! },
    internalPowerRating: metadata(row.calculatorRow.power), speed: metadata(row.calculatorRow.speed), area: metadata(row.calculatorRow.area),
    soul: {
      acceptsSoulEnchantments: soul?.acceptsSoulEnchantments ?? false,
      baseSoulGathering: { value: soul?.baseSoulGathering ?? 0, source: { ...stats, url: row.sourceUrl }, confidence: 'high', note: soul ? 'Target-owned published +1 Soul Gathering.' : 'No intrinsic Soul Gathering.' },
    },
  }
  return [id, weapon]
})) as Record<ObservedMeleeComboId, WeaponDefinition>

export const OBSERVED_MELEE_COMBO_PROFILES = Object.fromEntries(rows.map((row) => {
  const profile: Evidence<AttackProfile> = {
    value: { method: 'published-hit-timings', hitDurationsSeconds: row.hitDurationsSeconds, comboFinisherHit: row.hitDurationsSeconds.length },
    source: { id: `observed-melee-combo-${row.id}-profile`, label: 'Published complete hit timing cross-checked against 1.17.0.0 configured sequence', url: row.wikiTimingSource, kind: 'published-reference' },
    confidence: 'medium',
    note: 'Sustained complete combos at base cadence. Configured damage is a source cross-check and never supplies gameplay damage.',
  }
  return [row.id, profile]
})) as Record<ObservedMeleeComboId, Evidence<AttackProfile>>
