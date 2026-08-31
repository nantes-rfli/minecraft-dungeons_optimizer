import manifest from '../../research/melee-runtime-support.json'
import { runtimeSupportSummaryDataText, summarizeRuntimeSupportData } from '../research/runtimeSupportSummary'

export const RUNTIME_SUPPORT_LEVELS = ['full', 'limited', 'research-only'] as const
export type RuntimeSupportLevel = (typeof RUNTIME_SUPPORT_LEVELS)[number]
export const RUNTIME_SUPPORT_REASONS = [
  'broad-runtime', 'power-range-limited', 'copy-count-limited', 'combination-limited',
  'interaction-evidence-limited', 'state-model-missing', 'objective-missing', 'source-data-missing',
] as const
export type RuntimeSupportReason = (typeof RUNTIME_SUPPORT_REASONS)[number]

export interface EnchantmentRuntimeSupport {
  readonly id: string
  readonly name: string
  readonly supportLevel: RuntimeSupportLevel
  readonly reasons: readonly RuntimeSupportReason[]
  readonly runtimePowerRange: { readonly min: number; readonly max: number } | null
  readonly gameMaxCopies: number
  readonly runtimeMaxCopies: number | null
  /** Restrictions belong to the limited effect, not every full counterpart. */
  readonly unsupportedCombinations: readonly string[]
  readonly blockerCategory: 'mechanics' | 'objective' | null
  readonly weaponLegality: 'melee' | 'soul-gear'
  readonly phaseOrigin: string
  readonly assumptionRefs: readonly string[]
}
export interface MeleeRuntimeSupportManifest {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly population: number
  readonly entries: readonly EnchantmentRuntimeSupport[]
}

// The checked-in manifest is validated against the live catalog and rejection rules in CI.
export const MELEE_RUNTIME_SUPPORT = manifest as MeleeRuntimeSupportManifest
const supportById = new Map(MELEE_RUNTIME_SUPPORT.entries.map((entry) => [entry.id, entry]))

export function getEnchantmentRuntimeSupport(id: string): EnchantmentRuntimeSupport {
  const entry = supportById.get(id)
  if (!entry) throw new Error(`Runtime support metadata is missing: ${id}`)
  return entry
}

export function summarizeRuntimeSupport(data: MeleeRuntimeSupportManifest = MELEE_RUNTIME_SUPPORT) {
  return summarizeRuntimeSupportData(data)
}

export function runtimeSupportSummaryText(data: MeleeRuntimeSupportManifest = MELEE_RUNTIME_SUPPORT): string {
  return runtimeSupportSummaryDataText(data)
}

export function runtimeLimitationLines(entry: EnchantmentRuntimeSupport): string[] {
  const lines: string[] = []
  if (entry.runtimePowerRange) lines.push(`Power ${entry.runtimePowerRange.min}–${entry.runtimePowerRange.max}のみ`)
  if (entry.runtimeMaxCopies !== null && entry.runtimeMaxCopies < entry.gameMaxCopies) lines.push(`ゲーム最大${entry.gameMaxCopies}コピー / runtime ${entry.runtimeMaxCopies}コピー限定`)
  if (entry.unsupportedCombinations.length) lines.push(`併用未対応: ${entry.unsupportedCombinations.map((id) => getEnchantmentRuntimeSupport(id).name).join(' / ')}`)
  if (entry.blockerCategory) lines.push(entry.blockerCategory === 'objective' ? 'objective blocker: 対応する収集・稼ぎ目的が未実装' : 'mechanics blocker: 状態モデル・interactionの根拠不足')
  return lines
}

/** Includes reverse edges so Full does not hide a Limited counterpart's boundary. */
export function runtimeCombinationPartners(id: string): string[] {
  return [...new Set([
    ...getEnchantmentRuntimeSupport(id).unsupportedCombinations,
    ...MELEE_RUNTIME_SUPPORT.entries.filter((entry) => entry.unsupportedCombinations.includes(id)).map((entry) => entry.id),
  ])]
}
