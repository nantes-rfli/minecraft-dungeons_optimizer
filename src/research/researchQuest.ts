import type { Inventory, OwnedWeapon } from '../core/types.ts'
import type { ArmorId } from '../core/armor.ts'
import { ARMORS } from '../data/armors.ts'
import {
  buildEvidenceRepository,
  type EvidenceIntakeRecord,
  type EvidenceRepository,
} from './evidenceIntake.ts'
import {
  evaluateLimitedDrValidation,
  LIMITED_DR_ACCEPTANCE_PLAN,
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
  readonly rawTraceUrl: string
  readonly rawTraceSha256: string
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
  readonly armorInstanceId: string | null
  readonly ironHideInstanceId: string | null
  readonly guardingWeaponInstanceId: string | null
  readonly missing: readonly string[]
}

export interface Phase7Submission {
  readonly schemaVersion: 1
  readonly phase: '7B'
  readonly questId: 'limited-dr-composition'
  readonly generatedAt: string
  readonly evidenceRepository: EvidenceRepository
  readonly runs: readonly LimitedDrRun[]
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

function hasGuardingStrike(weapon: OwnedWeapon): boolean {
  return weapon.enchantmentSlots.some((slot) => slot.candidates.includes('guarding-strike')) || weapon.gilded?.enchantmentId === 'guarding-strike'
}

export function resolveResearchQuestReadiness(inventory: Inventory): ResearchQuestReadiness {
  const armor = (inventory.armors ?? []).find((item) => item.armorId in ARMORS && ARMORS[item.armorId as ArmorId].armorDamageReduction === 0.35)
  const ironHide = inventory.artifacts.find((item) => item.artifactId === 'iron-hide-amulet')
  const guardingWeapon = inventory.weapons.find(hasGuardingStrike)
  const missing = [
    ...(!armor ? ['35% damage reduction付き防具'] : []),
    ...(!ironHide ? ['アイアンハイドアミュレット'] : []),
    ...(!guardingWeapon ? ['ガードストライクを候補または金色枠に持つ近接武器'] : []),
  ]
  return {
    ready: missing.length === 0,
    armorInstanceId: armor?.instanceId ?? null,
    ironHideInstanceId: ironHide?.instanceId ?? null,
    guardingWeaponInstanceId: guardingWeapon?.instanceId ?? null,
    missing,
  }
}

function requireValidState(value: ResearchQuestState): void {
  if (!value || value.schemaVersion !== 1 || value.questId !== 'limited-dr-composition') throw new Error('未対応のResearch Questデータです。')
  if (!['not-started', 'active', 'paused', 'skipped'].includes(value.status)) throw new Error('Research Questの状態が不正です。')
  if (!['observe', 'measure', 'experiment'].includes(value.mode) || !Array.isArray(value.runs)) throw new Error('Research Questの記録形式が不正です。')
  for (const run of value.runs) {
    if (!run || typeof run.id !== 'string' || !(run.condition in LIMITED_DR_CONDITION_LABELS) || !Array.isArray(run.observedDamage) || !Array.isArray(run.activationFrameLocators) || !Array.isArray(run.equipment)) {
      throw new Error('Research Questのrun記録が不正です。')
    }
  }
  if (value.draft !== null && (!value.draft || typeof value.draft.id !== 'string' || !(value.draft.condition in LIMITED_DR_CONDITION_LABELS) || !Array.isArray(value.draft.observedDamage) || !Array.isArray(value.draft.activationFrameLocators) || !Array.isArray(value.draft.equipment))) {
    throw new Error('Research Questの入力途中データが不正です。')
  }
}

export function parseResearchQuestState(serialized: string): ResearchQuestState {
  let value: unknown
  try { value = JSON.parse(serialized) } catch { throw new Error('Research Questの保存データを読み取れません。') }
  requireValidState(value as ResearchQuestState)
  return value as ResearchQuestState
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
  const ironHide = inventory.artifacts.find((item) => item.instanceId === readiness.ironHideInstanceId)
  const guardingWeapon = inventory.weapons.find((item) => item.instanceId === readiness.guardingWeaponInstanceId)
  const guardingSlotIndex = guardingWeapon?.enchantmentSlots.findIndex((slot) => slot.candidates.includes('guarding-strike')) ?? -1
  const guardingSource = guardingWeapon?.gilded?.enchantmentId === 'guarding-strike'
    ? `gilded:tier-${guardingWeapon.gilded.tier}`
    : `slot-${guardingSlotIndex + 1}:tier-3`
  const usesArmor = draft.condition.includes('armor')
  const usesIron = draft.condition.includes('iron')
  const usesGuarding = draft.condition.includes('guarding')
  return [
    ...(usesArmor && armor ? [{ id: `armor:${armor.armorId}`, power: armor.powerLevel }] : []),
    ...(usesIron && ironHide ? [{ id: `artifact:${ironHide.artifactId}`, power: ironHide.powerLevel }] : []),
    ...(usesGuarding && guardingWeapon ? [{ id: `melee:${guardingWeapon.weaponId}:guarding-strike:${guardingSource}`, power: guardingWeapon.powerLevel }] : []),
  ]
}

export function captureResearchQuestRun(draft: ResearchQuestRunDraft, inventory: Inventory): ResearchQuestRunDraft {
  const readiness = resolveResearchQuestReadiness(inventory)
  if (!readiness.ready) throw new Error(`調査に必要な所持装備が不足しています: ${readiness.missing.join('、')}`)
  return { ...draft, equipment: draft.condition === 'baseline' ? [] : equipmentForCondition(draft, inventory) }
}

export function validateResearchQuestRun(draft: ResearchQuestRunDraft): string[] {
  const errors: string[] = []
  if (!draft.id.trim()) errors.push('run IDを入力してください。')
  if (!draft.originGroup.trim()) errors.push('独立origin IDを入力してください。')
  if (!draft.incomingHitId.trim()) errors.push('incoming hit IDを入力してください。')
  try { if (new URL(draft.rawTraceUrl).protocol !== 'https:') errors.push('raw trace URLはHTTPSで入力してください。') } catch { errors.push('raw trace URLは有効なHTTPS URLで入力してください。') }
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
    baselineDamage: draft.baselineDamage,
    observedDamage: draft.observedDamage,
  }
}

function toEvidenceRecord(draft: ResearchQuestRunDraft, run: LimitedDrRun): EvidenceIntakeRecord {
  return {
    id: `phase7-${draft.id}@1`, recordId: `phase7-${draft.id}`, revision: 1,
    source: {
      sourceId: `phase7-source-${draft.id}`, revision: 1, url: draft.rawTraceUrl,
      label: `Personal Research Quest raw trace ${draft.id}`, retrievedAt: draft.capturedAt,
      snapshotSha256: draft.rawTraceSha256, originKind: 'self-observation', originGroup: draft.originGroup,
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
    locators: [{ kind: 'table', locator: draft.rawTraceUrl, url: draft.rawTraceUrl }], partition: 'holdout',
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
    validation: evaluateLimitedDrValidation({ plan: LIMITED_DR_ACCEPTANCE_PLAN, calibrationOriginGroups: ['shin-dr', 'caramel-dr-guide', 'anotherraalt'], runs, excludedReferenceRows: [] }),
  }
}
