import type { Scenario, ScenarioProfileId } from '../core/types'
import { validateScenario } from '../core/validation'
import { SCENARIO_PROFILES } from '../data/scenarios'

export const SCENARIO_PRESETS_STORAGE_KEY = 'minecraft-dungeons-optimizer.scenario-presets.v1'
export const MAX_SCENARIO_PRESETS = 8
const SCENARIO_PRESET_DOCUMENT_VERSION = 1

export interface SavedScenarioPreset {
  readonly id: string
  readonly name: string
  readonly scenario: Scenario
}

export interface ScenarioPresetsLoadResult {
  readonly presets: readonly SavedScenarioPreset[]
  readonly error: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 128) throw new Error(`${field}は1〜128文字にしてください。`)
  return value
}

function normalizePresetName(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field}は文字列にしてください。`)
  const name = value.trim()
  if (name.length < 1 || name.length > 40 || /[\r\n]/.test(name)) throw new Error(`${field}は1〜40文字の1行にしてください。`)
  return name
}

function isScenarioProfileId(value: unknown): value is ScenarioProfileId {
  return typeof value === 'string' && Object.hasOwn(SCENARIO_PROFILES, value)
}

function parsePreset(value: unknown, index: number): SavedScenarioPreset {
  const field = `presets[${index}]`
  if (!isRecord(value) || !isRecord(value.scenario)) throw new Error(`${field}の形式が正しくありません。`)
  const id = requireId(value.id, `${field}.id`)
  const name = normalizePresetName(value.name, `${field}.name`)
  const scenario = value.scenario
  if (!isScenarioProfileId(scenario.profileId) || typeof scenario.name !== 'string') throw new Error(`${field}.scenarioの目的が正しくありません。`)
  try {
    validateScenario(scenario as unknown as Scenario)
  } catch {
    throw new Error(`${field}.scenarioは現在のOptimizerで使える条件ではありません。`)
  }
  return { id, name, scenario: scenario as unknown as Scenario }
}

function normalizePresets(value: unknown): readonly SavedScenarioPreset[] {
  if (!Array.isArray(value) || value.length > MAX_SCENARIO_PRESETS) throw new Error(`保存できる条件は最大${MAX_SCENARIO_PRESETS}件です。`)
  const presets = value.map(parsePreset)
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const preset of presets) {
    const normalizedName = preset.name.toLowerCase()
    if (ids.has(preset.id)) throw new Error('保存済み条件のIDが重複しています。')
    if (names.has(normalizedName)) throw new Error('保存済み条件の名前が重複しています。')
    ids.add(preset.id)
    names.add(normalizedName)
  }
  return presets
}

export function addScenarioPreset(
  presets: readonly SavedScenarioPreset[],
  preset: SavedScenarioPreset,
): readonly SavedScenarioPreset[] {
  const normalized = normalizePresets([...presets, preset])
  return normalized
}

export function mergeScenarioPresets(
  presets: readonly SavedScenarioPreset[],
  importedPresets: readonly SavedScenarioPreset[],
): readonly SavedScenarioPreset[] {
  return normalizePresets([...presets, ...importedPresets])
}

export function removeScenarioPreset(
  presets: readonly SavedScenarioPreset[],
  presetId: string,
): readonly SavedScenarioPreset[] {
  return presets.filter((preset) => preset.id !== presetId)
}

export function serializeScenarioPresets(presets: readonly SavedScenarioPreset[]): string {
  return JSON.stringify({ version: SCENARIO_PRESET_DOCUMENT_VERSION, presets: normalizePresets(presets) })
}

export function deserializeScenarioPresets(json: string): readonly SavedScenarioPreset[] {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('保存済み条件のJSONを読み取れません。')
  }
  if (!isRecord(value) || value.version !== SCENARIO_PRESET_DOCUMENT_VERSION) throw new Error('保存済み条件の形式に対応していません。')
  return normalizePresets(value.presets)
}

export function loadScenarioPresets(): ScenarioPresetsLoadResult {
  try {
    if (typeof window === 'undefined') return { presets: [], error: null }
    const json = window.localStorage.getItem(SCENARIO_PRESETS_STORAGE_KEY)
    return { presets: json === null ? [] : deserializeScenarioPresets(json), error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : '不明なエラー'
    return { presets: [], error: `保存済み条件を読み込めませんでした。元のデータは上書きしていません: ${detail}` }
  }
}

export function saveScenarioPresets(presets: readonly SavedScenarioPreset[]): void {
  const json = serializeScenarioPresets(presets)
  try {
    window.localStorage.setItem(SCENARIO_PRESETS_STORAGE_KEY, json)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '不明なエラー'
    throw new Error(`条件を保存できませんでした: ${detail}`, { cause: error })
  }
}

export function clearScenarioPresets(): void {
  try {
    window.localStorage.removeItem(SCENARIO_PRESETS_STORAGE_KEY)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '不明なエラー'
    throw new Error(`保存済み条件を初期化できませんでした: ${detail}`, { cause: error })
  }
}
