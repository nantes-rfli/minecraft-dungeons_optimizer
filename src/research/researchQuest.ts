import type { CatalogInventoryItem, Inventory, OwnedWeapon } from '../core/types.ts'
import type { ArmorId } from '../core/armor.ts'
import { ARMORS } from '../data/armors.ts'
import { auditedArmorIntrinsicProperties } from './auditedCatalog.ts'
import {
  buildEvidenceRepository,
  type EvidenceOriginKind,
  type EvidenceIntakeRecord,
  type EvidenceRepository,
} from './evidenceIntake.ts'
import {
  evaluateLimitedDrValidation,
  LIMITED_DR_ACCEPTANCE_PLAN,
  selectIndependentLimitedDrRuns,
  type LimitedDrConditionId,
  type LimitedDrRun,
} from './limitedDrValidation.ts'

export type ResearchQuestMode = 'observe' | 'measure' | 'experiment'
export type ResearchQuestStatus = 'not-started' | 'active' | 'paused' | 'skipped'

export interface ResearchQuestRunDraft {
  readonly id: string
  readonly condition: LimitedDrConditionId
  readonly originGroup: string
  readonly incomingHitId: string
  readonly originKind: EvidenceOriginKind
  readonly rawTraceUrl: string
  readonly rawTraceSha256: string
  readonly rawTraceRecord: string | null
  readonly activationFrameLocators: readonly string[]
  readonly baselineDamage: number
  readonly observedDamage: readonly number[]
  readonly platform: string
  readonly difficulty: string
  readonly capturedAt: string
  readonly reviewed: boolean
  readonly equipment: readonly { readonly id: string; readonly power: number }[]
}

export interface ResearchQuestState {
  readonly schemaVersion: 1
  readonly questId: 'limited-dr-composition'
  readonly status: ResearchQuestStatus
  readonly mode: ResearchQuestMode
  readonly runs: readonly ResearchQuestRunDraft[]
  readonly draft: ResearchQuestRunDraft | null
  readonly updatedAt: string
}

export interface ResearchQuestReadiness {
  readonly ready: boolean
  readonly guardingStrikeStatus: 'usable' | 'selection-required' | 'missing'
  readonly armorInstanceId: string | null
  readonly ironHideInstanceId: string | null
  readonly guardingWeaponInstanceId: string | null
  readonly missing: readonly string[]
  readonly selectionRequired: readonly string[]
}

export interface GeneratedRawRecord {
  readonly locator: string
  readonly sha256: string
  readonly content: string
}

export interface Phase7Submission {
  readonly schemaVersion: 1
  readonly phase: '7B'
  readonly questId: 'limited-dr-composition'
  readonly generatedAt: string
  readonly evidenceRepository: EvidenceRepository
  readonly runs: readonly LimitedDrRun[]
  readonly rawRecords: readonly GeneratedRawRecord[]
  readonly validation: ReturnType<typeof evaluateLimitedDrValidation>
}

export const RESEARCH_QUEST_STORAGE_KEY = 'minecraft-dungeons-optimizer:research-quest:v1'

export const LIMITED_DR_CONDITION_LABELS: Readonly<Record<LimitedDrConditionId, string>> = {
  baseline: 'Baseline（軽減なし）',
  'armor-35': '35% Armor',
  'iron-hide': 'Iron Hide',
  'guarding-strike': 'Guarding Strike',
  'armor-iron': '35% Armor + Iron Hide',
  'armor-guarding': '35% Armor + Guarding Strike',
  'iron-guarding': 'Iron Hide + Guarding Strike',
  'armor-iron-guarding': '3効果すべて',
}

const CONDITION_EQUIPMENT_COUNT: Readonly<Record<LimitedDrConditionId, number>> = {
  baseline: 0, 'armor-35': 1, 'iron-hide': 1, 'guarding-strike': 1,
  'armor-iron': 2, 'armor-guarding': 2, 'iron-guarding': 2, 'armor-iron-guarding': 3,
}

export const PHASE7_GAP_IDS = [
  'artifact:iron-hide-amulet:interactions',
  'melee-enchantment:guarding-strike:procChance',
  'melee-enchantment:guarding-strike:cooldown',
  'melee-enchantment:guarding-strike:powerDependence',
  'melee-enchantment:guarding-strike:currentVersionGameplayVerification',
] as const

export function defaultResearchQuestState(now = new Date().toISOString()): ResearchQuestState {
  return { schemaVersion: 1, questId: 'limited-dr-composition', status: 'not-started', mode: 'experiment', runs: [], draft: null, updatedAt: now }
}

function hasUsableGuardingStrike(weapon: OwnedWeapon): boolean {
  return weapon.enchantmentSlots.some((slot) => slot.selected?.enchantmentId === 'guarding-strike' || (slot as { locked?: string }).locked === 'guarding-strike') || weapon.gilded?.enchantmentId === 'guarding-strike'
}

function hasGuardingStrikeCandidate(weapon: OwnedWeapon): boolean {
  return weapon.enchantmentSlots.some((slot) => slot.candidates.some((candidate) => (typeof candidate === 'string' ? candidate : (candidate as { enchantmentId: string }).enchantmentId) === 'guarding-strike'))
}

function catalogHasGuardingStrike(item: CatalogInventoryItem): boolean {
  if (item.category !== 'melee') return false
  return item.research?.enchantments?.some((enchantment) => enchantment.enchantmentId === 'guarding-strike') ?? false
}

function catalogArmorHas35PercentDr(item: CatalogInventoryItem): boolean {
  if (item.category !== 'armor') return false
  const catalogProperties = auditedArmorIntrinsicProperties(item.catalogId)
  const instanceProperties = item.research?.intrinsicProperties ?? []
  return [...catalogProperties, ...instanceProperties].some((property) => property.kind === 'damage-reduction' && /(?:^|\D)35\s*%/.test(property.raw))
}

export function resolveResearchQuestReadiness(inventory: Inventory): ResearchQuestReadiness {
  const runtimeArmor = (inventory.armors ?? []).find((item) => item.armorId in ARMORS && ARMORS[item.armorId as ArmorId].armorDamageReduction === 0.35)
  const catalogArmor = (inventory.catalogItems ?? []).find(catalogArmorHas35PercentDr)
  const armorInstanceId = runtimeArmor?.instanceId ?? catalogArmor?.instanceId ?? null
  const ironHide = inventory.artifacts.find((item) => item.artifactId === 'iron-hide-amulet')
  const guardingWeapon = inventory.weapons.find(hasUsableGuardingStrike)
  const catalogGuardingWeapon = (inventory.catalogItems ?? []).find(catalogHasGuardingStrike)
  const guardingCandidate = inventory.weapons.find(hasGuardingStrikeCandidate)
  const guardingStrikeStatus = guardingWeapon || catalogGuardingWeapon ? 'usable' : guardingCandidate ? 'selection-required' : 'missing'
  const missing = [
    ...(!armorInstanceId ? ['35% damage reduction付き防具'] : []),
    ...(!ironHide ? ['アイアンハイドアミュレット'] : []),
    ...(guardingStrikeStatus === 'missing' ? ['ガードストライクを持つ近接武器'] : []),
  ]
  const selectionRequired = guardingStrikeStatus === 'selection-required' ? ['近接武器の候補からガードストライクを選択'] : []
  return {
    ready: missing.length === 0 && selectionRequired.length === 0,
    guardingStrikeStatus,
    armorInstanceId,
    ironHideInstanceId: ironHide?.instanceId ?? null,
    guardingWeaponInstanceId: guardingWeapon?.instanceId ?? catalogGuardingWeapon?.instanceId ?? null,
    missing,
    selectionRequired,
  }
}

function normalizeRun(run: ResearchQuestRunDraft): ResearchQuestRunDraft {
  return {
    ...run,
    originKind: run.originKind ?? 'self-observation',
    rawTraceRecord: run.rawTraceRecord ?? null,
  }
}

function requireValidState(value: ResearchQuestState): void {
  if (!value || value.schemaVersion !== 1 || value.questId !== 'limited-dr-composition') throw new Error('未対応のResearch Questデータです。')
  if (!['not-started', 'active', 'paused', 'skipped'].includes(value.status)) throw new Error('Research Questの状態が不正です。')
  if (!['observe', 'measure', 'experiment'].includes(value.mode) || !Array.isArray(value.runs)) throw new Error('Research Questの記録形式が不正です。')
  for (const run of value.runs) {
    if (!run || typeof run.id !== 'string' || !(run.condition in LIMITED_DR_CONDITION_LABELS) || !['external', 'self-observation'].includes(run.originKind) || (run.rawTraceRecord !== null && typeof run.rawTraceRecord !== 'string') || !Array.isArray(run.observedDamage) || !Array.isArray(run.activationFrameLocators) || !Array.isArray(run.equipment)) {
      throw new Error('Research Questのrun記録が不正です。')
    }
  }
  if (value.draft !== null && (!value.draft || typeof value.draft.id !== 'string' || !(value.draft.condition in LIMITED_DR_CONDITION_LABELS) || !['external', 'self-observation'].includes(value.draft.originKind) || (value.draft.rawTraceRecord !== null && typeof value.draft.rawTraceRecord !== 'string') || !Array.isArray(value.draft.observedDamage) || !Array.isArray(value.draft.activationFrameLocators) || !Array.isArray(value.draft.equipment))) {
    throw new Error('Research Questの入力途中データが不正です。')
  }
}

export function parseResearchQuestState(serialized: string): ResearchQuestState {
  let value: unknown
  try { value = JSON.parse(serialized) } catch { throw new Error('Research Questの保存データを読み取れません。') }
  const parsed = value as ResearchQuestState
  const normalized = { ...parsed, runs: parsed.runs?.map(normalizeRun), draft: parsed.draft ? normalizeRun(parsed.draft) : null }
  requireValidState(normalized)
  return normalized
}

export function loadResearchQuestState(): ResearchQuestState {
  const serialized = globalThis.localStorage?.getItem(RESEARCH_QUEST_STORAGE_KEY)
  return serialized ? parseResearchQuestState(serialized) : defaultResearchQuestState()
}

export function saveResearchQuestState(state: ResearchQuestState): void {
  requireValidState(state)
  globalThis.localStorage?.setItem(RESEARCH_QUEST_STORAGE_KEY, JSON.stringify(state))
}

function equipmentForCondition(draft: ResearchQuestRunDraft, inventory: Inventory) {
  const readiness = resolveResearchQuestReadiness(inventory)
  const armor = (inventory.armors ?? []).find((item) => item.instanceId === readiness.armorInstanceId)
  const catalogArmor = (inventory.catalogItems ?? []).find((item) => item.instanceId === readiness.armorInstanceId && item.category === 'armor')
  const ironHide = inventory.artifacts.find((item) => item.instanceId === readiness.ironHideInstanceId)
  const guardingWeapon = inventory.weapons.find((item) => item.instanceId === readiness.guardingWeaponInstanceId)
  const catalogGuardingWeapon = (inventory.catalogItems ?? []).find((item) => item.instanceId === readiness.guardingWeaponInstanceId && item.category === 'melee')
  const guardingSlotIndex = guardingWeapon?.enchantmentSlots.findIndex((slot) => slot.selected?.enchantmentId === 'guarding-strike' || (slot as { locked?: string }).locked === 'guarding-strike') ?? -1
  const guardingSlot = guardingWeapon?.enchantmentSlots[guardingSlotIndex]
  const guardingSource = guardingWeapon?.gilded?.enchantmentId === 'guarding-strike'
    ? `gilded:tier-${guardingWeapon.gilded.tier}`
    : `slot-${guardingSlotIndex + 1}:tier-${guardingSlot?.selected?.tier ?? 3}`
  const usesArmor = draft.condition.includes('armor')
  const usesIron = draft.condition.includes('iron')
  const usesGuarding = draft.condition.includes('guarding')
  return [
    ...(usesArmor && armor ? [{ id: `armor:${armor.armorId}`, power: armor.powerLevel }] : []),
    ...(usesArmor && !armor && catalogArmor ? [{ id: `armor:${catalogArmor.catalogId}`, power: catalogArmor.powerLevel }] : []),
    ...(usesIron && ironHide ? [{ id: `artifact:${ironHide.artifactId}`, power: ironHide.powerLevel }] : []),
    ...(usesGuarding && guardingWeapon ? [{ id: `melee:${guardingWeapon.weaponId}:guarding-strike:${guardingSource}`, power: guardingWeapon.powerLevel }] : []),
    ...(usesGuarding && !guardingWeapon && catalogGuardingWeapon ? [{ id: `melee:${catalogGuardingWeapon.catalogId}:guarding-strike:research-record`, power: catalogGuardingWeapon.powerLevel }] : []),
  ]
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function selfObservationRecord(draft: ResearchQuestRunDraft): string {
  return JSON.stringify({
    schemaVersion: 1,
    kind: 'limited-dr-self-observation',
    run: {
      id: draft.id, condition: draft.condition, originGroup: draft.originGroup,
      incomingHitId: draft.incomingHitId, activationFrameLocators: draft.activationFrameLocators,
      baselineDamage: draft.baselineDamage, observedDamage: draft.observedDamage,
      platform: draft.platform, difficulty: draft.difficulty, capturedAt: draft.capturedAt,
      reviewed: draft.reviewed, equipment: draft.equipment,
    },
  })
}

export async function captureResearchQuestRun(draft: ResearchQuestRunDraft, inventory: Inventory): Promise<ResearchQuestRunDraft> {
  const readiness = resolveResearchQuestReadiness(inventory)
  const blockers = [...readiness.missing, ...readiness.selectionRequired]
  if (!readiness.ready) throw new Error(`調査の準備が完了していません: ${blockers.join('、')}`)
  const captured = { ...draft, equipment: draft.condition === 'baseline' ? [] : equipmentForCondition(draft, inventory) }
  if (captured.originKind === 'external') return { ...captured, rawTraceRecord: null }
  const rawTraceUrl = `urn:minecraft-dungeons-optimizer:phase7:raw-trace:${encodeURIComponent(captured.id)}`
  const rawTraceRecord = selfObservationRecord({ ...captured, rawTraceUrl, rawTraceSha256: '', rawTraceRecord: null })
  return { ...captured, rawTraceUrl, rawTraceSha256: await sha256(rawTraceRecord), rawTraceRecord }
}

export function validateResearchQuestRun(draft: ResearchQuestRunDraft): string[] {
  const errors: string[] = []
  if (!draft.id.trim()) errors.push('run IDを入力してください。')
  if (!draft.originGroup.trim()) errors.push('Evidenceのorigin groupを入力してください。')
  if (!draft.incomingHitId.trim()) errors.push('incoming hit IDを入力してください。')
  if (draft.originKind === 'external') {
    try { if (new URL(draft.rawTraceUrl).protocol !== 'https:') errors.push('外部Evidenceのraw trace URLはHTTPSで入力してください。') } catch { errors.push('外部Evidenceのraw trace URLは有効なHTTPS URLで入力してください。') }
  } else if (!draft.rawTraceUrl.startsWith('urn:minecraft-dungeons-optimizer:phase7:raw-trace:') && !draft.rawTraceUrl.startsWith('https:')) {
    errors.push('自前測定のraw record locatorが不正です。')
  }
  if (!/^[a-f0-9]{64}$/.test(draft.rawTraceSha256)) errors.push('raw traceのSHA-256を64桁の小文字16進数で入力してください。')
  if (!(draft.baselineDamage > 0)) errors.push('baseline damageは0より大きい値が必要です。')
  if (draft.observedDamage.length < LIMITED_DR_ACCEPTANCE_PLAN.minimumHitsPerRun) errors.push('1 runにつき10 hit以上が必要です。')
  if (draft.observedDamage.some((value) => !Number.isFinite(value) || value < 0)) errors.push('被ダメージ列には0以上の数値だけを入力してください。')
  if (!draft.platform.trim() || !draft.difficulty.trim()) errors.push('platformとdifficultyを入力してください。')
  if (!draft.reviewed) errors.push('raw traceを見直したことを確認してください。')
  if (draft.condition !== 'baseline' && draft.activationFrameLocators.every((value) => !value.trim())) errors.push('発動条件ではactivation frame locatorが必要です。')
  const expectedEquipmentCount = CONDITION_EQUIPMENT_COUNT[draft.condition]
  if (draft.equipment.length !== expectedEquipmentCount || draft.equipment.some((item) => !item.id.trim() || !Number.isFinite(item.power) || item.power < 0)) errors.push('この条件に必要な装備snapshotが不正です。')
  return errors
}

export function toLimitedDrRun(draft: ResearchQuestRunDraft): LimitedDrRun {
  const errors = validateResearchQuestRun(draft)
  if (errors.length) throw new Error(errors.join(' '))
  return {
    id: draft.id,
    condition: draft.condition,
    partition: 'holdout',
    originGroup: draft.originGroup,
    gameVersion: LIMITED_DR_ACCEPTANCE_PLAN.gameVersion,
    damageChannel: LIMITED_DR_ACCEPTANCE_PLAN.damageChannel,
    incomingHitId: draft.incomingHitId,
    equipment: draft.equipment,
    activationFrameLocators: draft.condition === 'baseline' ? [] : draft.activationFrameLocators.filter((value) => value.trim()),
    rawTraceLocator: draft.rawTraceUrl,
    rawTraceSha256: draft.rawTraceSha256,
    capturedAt: draft.capturedAt,
    baselineDamage: draft.baselineDamage,
    observedDamage: draft.observedDamage,
  }
}

export function independentResearchQuestRuns(runs: readonly ResearchQuestRunDraft[]): readonly ResearchQuestRunDraft[] {
  const byId = new Map(runs.map((run) => [run.id, run]))
  return selectIndependentLimitedDrRuns(runs.map(toLimitedDrRun)).independentRuns.map((run) => byId.get(run.id)!)
}

export interface ResearchQuestConditionProgress {
  readonly eligibleRunCount: number
  readonly completedConditionCount: number
  readonly runsByCondition: Readonly<Record<LimitedDrConditionId, number>>
}

export function researchQuestConditionProgress(runs: readonly ResearchQuestRunDraft[]): ResearchQuestConditionProgress {
  const eligibleRuns = independentResearchQuestRuns(runs)
    .filter((run) => run.observedDamage.length >= LIMITED_DR_ACCEPTANCE_PLAN.minimumHitsPerRun)
  const runsByCondition = Object.fromEntries(LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.map((condition) => [
    condition,
    eligibleRuns.filter((run) => run.condition === condition).length,
  ])) as Record<LimitedDrConditionId, number>
  return {
    eligibleRunCount: eligibleRuns.length,
    completedConditionCount: LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.filter((condition) => runsByCondition[condition] >= LIMITED_DR_ACCEPTANCE_PLAN.minimumIndependentRunsPerCondition).length,
    runsByCondition,
  }
}

export function nextResearchQuestCondition(runs: readonly ResearchQuestRunDraft[], fallback: LimitedDrConditionId = 'baseline'): LimitedDrConditionId {
  const { runsByCondition } = researchQuestConditionProgress(runs)
  return LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.find((condition) => runsByCondition[condition] < LIMITED_DR_ACCEPTANCE_PLAN.minimumIndependentRunsPerCondition) ?? fallback
}

export function prepareNextResearchQuestRunDraft(
  previous: ResearchQuestRunDraft,
  savedRuns: readonly ResearchQuestRunDraft[],
  capturedAt = new Date().toISOString(),
): ResearchQuestRunDraft {
  return {
    ...previous,
    id: '',
    condition: nextResearchQuestCondition(savedRuns, previous.condition),
    rawTraceUrl: '',
    rawTraceSha256: '',
    rawTraceRecord: null,
    activationFrameLocators: [],
    observedDamage: [],
    capturedAt,
    reviewed: false,
    equipment: [],
  }
}

function toEvidenceRecord(draft: ResearchQuestRunDraft, run: LimitedDrRun): EvidenceIntakeRecord {
  const selfGenerated = draft.originKind === 'self-observation' && draft.rawTraceUrl.startsWith('urn:')
  return {
    id: `phase7-${draft.id}@1`, recordId: `phase7-${draft.id}`, revision: 1,
    source: {
      sourceId: `phase7-source-${draft.id}`, revision: 1, url: draft.rawTraceUrl,
      label: `Personal Research Quest raw trace ${draft.id}`, retrievedAt: draft.capturedAt,
      snapshotSha256: draft.rawTraceSha256, originKind: draft.originKind, originGroup: draft.originGroup,
      repostOfSourceRevisionId: null, reviewed: draft.reviewed,
    },
    claim: {
      claimId: `phase7-limited-dr-${draft.id}`, entity: 'mechanic:limited-dr-composition',
      property: 'raw-damage-trace', statement: `${LIMITED_DR_CONDITION_LABELS[draft.condition]}の被ダメージ列`, value: draft.observedDamage,
    },
    context: {
      gameVersion: LIMITED_DR_ACCEPTANCE_PLAN.gameVersion, equipment: run.equipment,
      conditions: { condition: draft.condition, runId: draft.id, damageChannel: LIMITED_DR_ACCEPTANCE_PLAN.damageChannel, incomingHitId: draft.incomingHitId, platform: draft.platform, difficulty: draft.difficulty },
    },
    measurement: {
      unit: 'raw-damage-per-hit', repetitions: draft.observedDamage.length,
      observations: draft.observedDamage.map((value, index) => ({ value, locator: `${draft.rawTraceUrl}#hit-${index + 1}` })), missingReasons: [],
    },
    locators: [{ kind: 'table', locator: draft.rawTraceUrl, url: selfGenerated ? null : draft.rawTraceUrl }], partition: 'holdout',
    corrects: null, correctionReason: null, capturedAt: draft.capturedAt,
  }
}

export function buildPhase7Submission(state: ResearchQuestState, generatedAt = new Date().toISOString()): Phase7Submission {
  requireValidState(state)
  const ids = new Set<string>()
  for (const draft of state.runs) {
    if (ids.has(draft.id)) throw new Error(`run IDが重複しています: ${draft.id}`)
    ids.add(draft.id)
  }
  const runs = state.runs.map(toLimitedDrRun)
  const evidenceRepository = buildEvidenceRepository(state.runs.map((draft, index) => toEvidenceRecord(draft, runs[index]!)))
  return {
    schemaVersion: 1, phase: '7B', questId: 'limited-dr-composition', generatedAt,
    evidenceRepository, runs,
    rawRecords: state.runs.flatMap((draft) => draft.rawTraceRecord === null ? [] : [{ locator: draft.rawTraceUrl, sha256: draft.rawTraceSha256, content: draft.rawTraceRecord }]),
    validation: evaluateLimitedDrValidation({ plan: LIMITED_DR_ACCEPTANCE_PLAN, calibrationOriginGroups: ['shin-dr', 'caramel-dr-guide', 'anotherraalt'], runs, excludedReferenceRows: [] }),
  }
}
