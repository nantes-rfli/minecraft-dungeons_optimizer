import type { Inventory, ScenarioProfileId } from '../core/types'
import type { EvidenceGap, EvidenceGapMap } from './evidenceGapMap'
import { buildEvidenceGapMap, buildPhase5MeasurementProtocols } from './evidenceGapMap'
import type { MeasurementProtocol } from './evidenceCoverage/protocols'
import { buildSourceHarvest } from './sourceHarvest'

export const PRIORITY_WEIGHTS = {
  runtimeUnlockValue: 0.3,
  rankSensitivity: 0.25,
  ownershipSignal: 0.2,
  coverageGain: 0.1,
  nearUnlockBonus: 0.1,
  acquisitionEase: 0.05,
} as const

export const PRIORITY_THRESHOLDS = { P0: 81.5, P1: 60, P2: 42, P3: 0 } as const
export const SYNTHETIC_OWNED_ENTITY_IDS = ['ranged-weapon:harp-crossbow', 'ranged-weapon:bow', 'armor:wither-armor'] as const
export const PRIORITY_OBJECTIVES: readonly ScenarioProfileId[] = ['balanced', 'damage', 'survival', 'boss', 'mobbing', 'apocalypse-plus']

export type PriorityTier = keyof typeof PRIORITY_THRESHOLDS
export type Availability = 'owned' | 'same-family-only' | 'not-owned' | 'unknown'
export type RankSensitivityStatus = 'computed' | 'not-applicable' | 'insufficient-range' | 'unsupported'
export type RankSensitivityMethod = 'optimizer-perturbation' | 'bounded-proxy' | 'not-applicable' | 'unsupported'
export type PriorityStabilityLevel = 'high' | 'medium' | 'low'

export interface RankSensitivity {
  readonly status: RankSensitivityStatus
  readonly method: RankSensitivityMethod
  readonly winnerFlipProxyRate?: number
  readonly top3ChangeProxyRate?: number
  readonly scoreSpreadImpact?: number
  readonly affectedObjectives?: readonly ScenarioProfileId[]
  readonly range?: { readonly low: number; readonly nominal: number; readonly high: number; readonly unit: string }
  readonly rangeSource?: readonly string[]
  readonly notes?: readonly string[]
}

export interface PriorityStabilityScope {
  readonly topSetRetention: number
  readonly scoreRange: number
  readonly tierStable: boolean
  readonly level: PriorityStabilityLevel
}

export interface PriorityStability {
  readonly global: PriorityStabilityScope
  readonly personal: PriorityStabilityScope
}

export interface WeightSensitivityResult {
  readonly scope: 'global' | 'personal'
  readonly variant: string
  readonly top20OverlapWithDefault: number
  readonly top20GapIds: readonly string[]
}

export interface PriorityCost {
  readonly setupCost: number
  readonly perEntityCost: number
  readonly repetitionCost: number
  readonly specialRequirementPenalty: number
  readonly totalEstimatedMinutes: number
}

export interface PriorityScore {
  readonly total: number
  readonly components: {
    readonly runtimeUnlockValue: number
    readonly rankSensitivity: number
    readonly ownershipSignal: number
    readonly coverageGain: number
    readonly nearUnlockBonus: number
    readonly acquisitionEase: number
  }
  readonly confidence: 'high' | 'medium' | 'low'
  readonly reasons: readonly string[]
}

export interface UnlockBundle {
  readonly id: string
  readonly entityIds: readonly string[]
  readonly requiredGapIds: readonly string[]
  readonly resolvedGapIds: readonly string[]
  readonly remainingGapIds: readonly string[]
  readonly targetSupport: 'limited-candidate' | 'full-candidate' | 'rank-accuracy' | 'model-improvement'
  readonly completionRatio: number
}

export interface GapPriority {
  readonly gapId: string
  readonly entityId: string
  readonly taskFamilyId: string
  readonly protocolId?: string
  readonly resolutionClass: EvidenceGap['resolutionClass']
  readonly availability: Availability
  readonly availabilityBasis?: { readonly familyId: string; readonly ownedEntityIds: readonly string[] }
  readonly cost: PriorityCost
  readonly rankSensitivity: RankSensitivity
  readonly stability: PriorityStability
  readonly global: PriorityScore & { readonly tier: PriorityTier }
  readonly personal: PriorityScore & { readonly tier: PriorityTier }
  readonly prerequisites: readonly string[]
}

export interface ResearchQueueItem {
  readonly gapId: string
  readonly entityId: string
  readonly protocolId: string
  readonly priorityTier: PriorityTier
  readonly priorityScore: number
  readonly estimatedMinutes: number
  readonly reasons: readonly string[]
  readonly prerequisites: readonly string[]
}

type RankingItem = { readonly id: string; readonly gapCount: number; readonly entityCount: number; readonly score: number; readonly tier: PriorityTier; readonly reasons: readonly string[] }

const round = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number) => Math.max(0, Math.min(1, value))
type ScoreComponents = PriorityScore['components']
type PriorityWeights = Readonly<Record<keyof ScoreComponents, number>>

const GLOBAL_WEIGHT_VARIANTS: Readonly<Record<string, PriorityWeights>> = {
  default: PRIORITY_WEIGHTS,
  'rank-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.2, rankSensitivity: 0.4 },
  'unlock-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.5, rankSensitivity: 0.15 },
  'coverage-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.2, coverageGain: 0.3 },
}

const PERSONAL_WEIGHT_VARIANTS: Readonly<Record<string, PriorityWeights>> = {
  default: PRIORITY_WEIGHTS,
  'ownership-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.2, ownershipSignal: 0.4 },
  'rank-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.2, rankSensitivity: 0.4 },
  'unlock-heavy': { ...PRIORITY_WEIGHTS, runtimeUnlockValue: 0.5, rankSensitivity: 0.15 },
}

const FAMILY_ELIGIBLE_CATEGORIES = new Set(['melee-weapon', 'ranged-weapon', 'armor'])

function isJsonRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sourceFamilyByEntity(): Map<string, string> {
  const families = new Map<string, string>()
  for (const record of buildSourceHarvest().records) {
    if (!FAMILY_ELIGIBLE_CATEGORIES.has(record.category)) continue
    const fact = record.known.find((item) => item.property === 'family' && item.status === 'accepted' && item.sourceIds.length > 0)
    const value = fact?.value
    const family = typeof value === 'string' ? value : isJsonRecord(value) && typeof value.family === 'string' ? value.family : undefined
    if (family) families.set(`${record.category}:${record.id}`, family.trim().toLowerCase())
  }
  return families
}

function availabilityFor(entityId: string, owned: ReadonlySet<string>, familyByEntity: ReadonlyMap<string, string>): { availability: Availability; basis?: GapPriority['availabilityBasis'] } {
  if (owned.has(entityId)) return { availability: 'owned' }
  if (owned.size === 0) return { availability: 'unknown' }
  const familyId = familyByEntity.get(entityId)
  if (!familyId) return { availability: 'not-owned' }
  const ownedEntityIds = [...owned].filter((ownedId) => ownedId !== entityId && familyByEntity.get(ownedId) === familyId).sort()
  return ownedEntityIds.length ? { availability: 'same-family-only', basis: { familyId, ownedEntityIds } } : { availability: 'not-owned' }
}

function tier(score: number): PriorityTier {
  if (score >= PRIORITY_THRESHOLDS.P0) return 'P0'
  if (score >= PRIORITY_THRESHOLDS.P1) return 'P1'
  if (score >= PRIORITY_THRESHOLDS.P2) return 'P2'
  return 'P3'
}

function entityIdsFromInventory(inventory: Inventory): Set<string> {
  const ids = new Set<string>()
  for (const weapon of inventory.weapons) {
    ids.add(`melee-weapon:${weapon.weaponId}`)
    for (const slot of weapon.enchantmentSlots) for (const id of slot.candidates) ids.add(`melee-enchantment:${id}`)
    if (weapon.gilded) ids.add(`melee-enchantment:${weapon.gilded.enchantmentId}`)
  }
  for (const armor of inventory.armors ?? []) {
    ids.add(`armor:${armor.armorId}`)
    for (const slot of armor.enchantmentSlots) for (const id of slot.candidates) ids.add(`armor-enchantment:${id}`)
    if (armor.gilded) ids.add(`armor-enchantment:${armor.gilded.enchantmentId}`)
  }
  for (const ranged of inventory.rangedWeapons ?? []) {
    ids.add(`ranged-weapon:${ranged.weaponId}`)
    for (const slot of ranged.enchantmentSlots) for (const id of slot.candidates) ids.add(`ranged-enchantment:${id}`)
    if (ranged.gilded) ids.add(`ranged-enchantment:${ranged.gilded.enchantmentId}`)
  }
  for (const artifact of inventory.artifacts) ids.add(`artifact:${artifact.artifactId}`)
  return ids
}

function sensitivityFor(gap: EvidenceGap): RankSensitivity {
  if (gap.resolutionClass === 'objective-design' || gap.unlockEffect === 'metadata-only' || gap.unlockEffect === 'explanation-only') {
    return { status: 'not-applicable', method: 'not-applicable', notes: ['現行Optimizer scoreへ直接接続しないため計算対象外。'] }
  }
  if (gap.resolutionClass === 'implementation') {
    return { status: 'unsupported', method: 'unsupported', notes: ['未実装mechanicをruntimeへ注入せず、implementation rankingで別評価する。'] }
  }
  const property = gap.property.toLowerCase()
  const ranges: readonly [readonly string[], number, string, string][] = [
    [['chance', 'proc'], 0.2, 'ratio', 'mechanic constraint（0〜1）を中心値±20%へ制限'],
    [['duration', 'cooldown', 'seconds', 'timing', 'speed', 'cadence', 'cycle'], 0.2, 'relative', 'same-family timingのconservative analysis bound（nominal±20%）'],
    [['damage', 'health', 'power', 'scaling'], 0.15, 'relative', '同familyの丸め・Power差を含むconservative analysis bound（nominal±15%）'],
    [['count', 'projectile', 'distribution'], 0.25, 'relative', '離散mechanic制約を近似したconservative analysis bound（nominal±25%）'],
  ]
  const found = ranges.find(([needles]) => needles.some((needle) => property.includes(needle) || gap.notes.toLowerCase().includes(needle)))
  if (!found) return { status: 'insufficient-range', method: 'unsupported', notes: ['公開bound・same-family range・mechanic constraintのいずれも安全に設定できない。'] }
  const [, delta, unit, provenance] = found
  const relevance = gap.runtimeRelevance === 'high' ? 1 : gap.runtimeRelevance === 'medium' ? 0.62 : 0.25
  const objectiveWeights: Readonly<Record<ScenarioProfileId, number>> = {
    balanced: 0.8, damage: gap.category === 'armor' || gap.category === 'armor-enchantment' ? 0.35 : 1,
    survival: gap.category === 'armor' || gap.category === 'armor-enchantment' ? 1 : 0.35,
    boss: 0.9, mobbing: property.includes('target') || property.includes('projectile') ? 1 : 0.65, 'apocalypse-plus': 0.9,
  }
  const impacts = PRIORITY_OBJECTIVES.map((objective) => delta * relevance * objectiveWeights[objective])
  const affectedObjectives = PRIORITY_OBJECTIVES.filter((_, index) => impacts[index]! >= 0.08)
  const winnerFlipProxyRate = impacts.filter((impact) => impact >= 0.1).length / impacts.length
  const top3ChangeProxyRate = impacts.filter((impact) => impact >= 0.06).length / impacts.length
  return {
    status: 'computed', method: 'bounded-proxy', winnerFlipProxyRate: round(winnerFlipProxyRate), top3ChangeProxyRate: round(top3ChangeProxyRate), scoreSpreadImpact: round(Math.max(...impacts)), affectedObjectives,
    range: { low: round(1 - delta), nominal: 1, high: round(1 + delta), unit }, rangeSource: [provenance],
    notes: ['analysis-onlyの3候補fixture（winner margin 10%、Top3 margin 6%）で比較。Evidenceやruntime値ではない。'],
  }
}

function priorityCost(gap: EvidenceGap, protocol?: MeasurementProtocol): PriorityCost {
  const fallback: Record<EvidenceGap['acquisitionCost'], number> = { trivial: 3, low: 8, medium: 20, high: 45, 'very-high': 90 }
  const midpoint = protocol?.estimatedMinutes ? (protocol.estimatedMinutes.min + protocol.estimatedMinutes.max) / 2 : fallback[gap.acquisitionCost]
  const setupCost = protocol ? Math.max(1, protocol.setup?.length ?? protocol.scenario.length) : gap.resolutionClass === 'implementation' ? 20 : 2
  const runs = protocol?.repetition.minimumIndependentRuns ?? 1
  const repetitionCost = Math.max(0, runs - 1) * Math.max(1, midpoint * 0.12)
  const specialRequirementPenalty = (protocol?.variants?.length ?? 0) * 2 + (protocol?.controls?.length ?? 0) * 2
  return { setupCost: round(setupCost), perEntityCost: round(midpoint), repetitionCost: round(repetitionCost), specialRequirementPenalty, totalEstimatedMinutes: round(midpoint + setupCost + repetitionCost + specialRequirementPenalty) }
}

function scoreTotal(components: ScoreComponents, weights: PriorityWeights, personal: boolean): number {
  const keys = Object.keys(components) as (keyof typeof components)[]
  const active = personal ? keys : keys.filter((key) => key !== 'ownershipSignal')
  const denominator = active.reduce((sum, key) => sum + weights[key], 0)
  return round(100 * active.reduce((sum, key) => sum + components[key] * weights[key], 0) / denominator)
}

function stabilityFor(scores: readonly number[], defaultTop: boolean, variantTop: readonly boolean[]): PriorityStabilityScope {
  const defaultTier = tier(scores[0]!)
  const scoreRange = round(Math.max(...scores) - Math.min(...scores))
  const tierStable = scores.every((score) => tier(score) === defaultTier)
  const topSetRetention = round(variantTop.filter((included) => included === defaultTop).length / variantTop.length)
  const level: PriorityStabilityLevel = scoreRange >= 20 || topSetRetention < 0.5 ? 'low' : !tierStable || scoreRange >= 8 || topSetRetention < 1 ? 'medium' : 'high'
  return { topSetRetention, scoreRange, tierStable, level }
}

function confidenceFor(sensitivity: RankSensitivity, stability: PriorityStabilityScope, availability: Availability, personal: boolean): PriorityScore['confidence'] {
  if (sensitivity.status === 'insufficient-range' || stability.level === 'low' || (personal && availability === 'unknown')) return 'low'
  if (sensitivity.method === 'bounded-proxy' || sensitivity.method === 'unsupported' || stability.level === 'medium' || (personal && availability === 'same-family-only')) return 'medium'
  return 'high'
}

function ranking(id: string, gaps: readonly GapPriority[], mode: 'global' | 'personal'): RankingItem {
  const score = round(gaps.reduce((sum, gap) => sum + gap[mode].total, 0) / gaps.length)
  const entities = new Set(gaps.map((gap) => gap.entityId)).size
  const reasons = [`${gaps.length} Gap / ${entities} Entityへ波及`, `平均score ${score}`]
  return { id, gapCount: gaps.length, entityCount: entities, score, tier: tier(score), reasons }
}

function groupRanking(priorities: readonly GapPriority[], key: (gap: GapPriority) => string | undefined, mode: 'global' | 'personal'): RankingItem[] {
  const groups = new Map<string, GapPriority[]>()
  for (const gap of priorities) {
    const id = key(gap)
    if (!id) continue
    const entries = groups.get(id) ?? []
    entries.push(gap)
    groups.set(id, entries)
  }
  return [...groups].map(([id, gaps]) => ranking(id, gaps, mode)).sort((a, b) => b.score - a.score || b.entityCount - a.entityCount || a.id.localeCompare(b.id, 'en'))
}

export function buildCoveragePriority(options: { readonly ownedEntityIds?: ReadonlySet<string>; readonly inventory?: Inventory } = {}) {
  const map = buildEvidenceGapMap()
  const protocols = buildPhase5MeasurementProtocols()
  const protocolById = new Map(protocols.map((protocol) => [protocol.id, protocol]))
  const owned = options.inventory ? entityIdsFromInventory(options.inventory) : new Set(options.ownedEntityIds ?? SYNTHETIC_OWNED_ENTITY_IDS)
  const familyByEntity = sourceFamilyByEntity()
  const familyEntityCounts = new Map<string, number>()
  for (const family of map.taskFamilies) familyEntityCounts.set(family.id, new Set(map.gaps.filter((gap) => gap.taskFamilyId === family.id).map((gap) => gap.entity)).size)
  const maxCoverage = Math.max(...familyEntityCounts.values())
  const unlockBundles: UnlockBundle[] = [...new Set(map.gaps.map((gap) => gap.entity))].sort().map((entity) => {
    const relevant = map.gaps.filter((gap) => gap.entity === entity && ['runtime-eligibility', 'rank-accuracy'].includes(gap.unlockEffect))
    const required = (relevant.length ? relevant : map.gaps.filter((gap) => gap.entity === entity)).map((gap) => gap.gapId)
    const hasEligibility = relevant.some((gap) => gap.unlockEffect === 'runtime-eligibility')
    return { id: `unlock:${entity}`, entityIds: [entity], requiredGapIds: required, resolvedGapIds: [], remainingGapIds: required,
      targetSupport: hasEligibility ? 'limited-candidate' : relevant.length ? 'rank-accuracy' : 'model-improvement', completionRatio: 0 }
  })
  const bundleByEntity = new Map(unlockBundles.map((bundle) => [bundle.entityIds[0]!, bundle]))

  const basePriorities = map.gaps.map((gap) => {
    const sensitivity = sensitivityFor(gap)
    const protocol = gap.protocolId ? protocolById.get(gap.protocolId) : undefined
    const cost = priorityCost(gap, protocol)
    const bundle = bundleByEntity.get(gap.entity)!
    const availabilityResult = availabilityFor(gap.entity, owned, familyByEntity)
    const availability = availabilityResult.availability
    const runtimeUnlockValue = gap.unlockEffect === 'runtime-eligibility' ? 1 : gap.unlockEffect === 'rank-accuracy' ? 0.78 : gap.unlockEffect === 'explanation-only' ? 0.28 : 0.12
    const rankSensitivity = sensitivity.status === 'computed' ? clamp(0.35 + (sensitivity.winnerFlipProxyRate ?? 0) * 0.4 + (sensitivity.top3ChangeProxyRate ?? 0) * 0.25) : sensitivity.status === 'insufficient-range' ? 0.32 : sensitivity.status === 'unsupported' ? 0.45 : 0.18
    const ownershipSignal = availability === 'owned' ? 1 : availability === 'same-family-only' ? 0.55 : availability === 'unknown' ? 0.5 : 0.12
    const coverageGain = clamp(Math.sqrt(familyEntityCounts.get(gap.taskFamilyId) ?? 1) / Math.sqrt(maxCoverage))
    const nearUnlockBonus = clamp(1 / Math.sqrt(Math.max(1, bundle.remainingGapIds.length)))
    const acquisitionEase = clamp(1 - Math.log1p(cost.totalEstimatedMinutes) / Math.log1p(150))
    const components = { runtimeUnlockValue, rankSensitivity, ownershipSignal, coverageGain, nearUnlockBonus, acquisitionEase }
    const reasonParts = [
      gap.unlockEffect === 'runtime-eligibility' ? '解決するとruntime候補化を前進' : gap.unlockEffect === 'rank-accuracy' ? '順位精度へ直接影響' : '説明・metadata改善',
      `${familyEntityCounts.get(gap.taskFamilyId)} Entityへ同じTask Familyを適用可能`,
      bundle.remainingGapIds.length === 1 ? '残り1 Gapのnear-unlock' : `bundle残り${bundle.remainingGapIds.length} Gap`,
      protocol ? `推定${cost.totalEstimatedMinutes}分（setup・反復・variant補正込み）` : `比較cost ${cost.totalEstimatedMinutes}分`,
    ]
    if (availability === 'owned') reasonParts.unshift('所持装備')
    if (availability === 'same-family-only') reasonParts.unshift('同family装備を所持')
    if (sensitivity.method === 'bounded-proxy') reasonParts.push('Rank Sensitivity: bounded proxy')
    if (sensitivity.status === 'computed' && (sensitivity.winnerFlipProxyRate ?? 0) > 0) reasonParts.push(`${sensitivity.affectedObjectives?.join(' / ')}でwinner flip proxyあり`)
    return { gapId: gap.gapId, entityId: gap.entity, taskFamilyId: gap.taskFamilyId, ...(gap.protocolId ? { protocolId: gap.protocolId } : {}), resolutionClass: gap.resolutionClass, availability,
      ...(availabilityResult.basis ? { availabilityBasis: availabilityResult.basis } : {}), cost, rankSensitivity: sensitivity, components, reasonParts, prerequisites: protocol?.prerequisites ?? [] }
  })

  const rankedIds = (weights: PriorityWeights, personal: boolean) => basePriorities.map((gap) => ({ id: gap.gapId, score: scoreTotal(gap.components, weights, personal) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en')).map((item) => item.id)
  const rankingsFor = (variants: Readonly<Record<string, PriorityWeights>>, personal: boolean) => Object.fromEntries(Object.entries(variants).map(([variant, weights]) => [variant, rankedIds(weights, personal)])) as Record<string, string[]>
  const globalRankings = rankingsFor(GLOBAL_WEIGHT_VARIANTS, false)
  const personalRankings = rankingsFor(PERSONAL_WEIGHT_VARIANTS, true)
  const sensitivityResults = (scope: 'global' | 'personal', rankings: Readonly<Record<string, readonly string[]>>): WeightSensitivityResult[] => {
    const defaultTop = new Set(rankings.default!.slice(0, 20))
    return Object.entries(rankings).map(([variant, ids]) => {
      const top20GapIds = ids.slice(0, 20)
      return { scope, variant, top20OverlapWithDefault: top20GapIds.filter((id) => defaultTop.has(id)).length, top20GapIds }
    })
  }
  const weightSensitivity = [...sensitivityResults('global', globalRankings), ...sensitivityResults('personal', personalRankings)]
  const globalTopSets = Object.values(globalRankings).map((ids) => new Set(ids.slice(0, 20)))
  const personalTopSets = Object.values(personalRankings).map((ids) => new Set(ids.slice(0, 20)))

  const gapPriorities: GapPriority[] = basePriorities.map((gap) => {
    const globalScores = Object.values(GLOBAL_WEIGHT_VARIANTS).map((weights) => scoreTotal(gap.components, weights, false))
    const personalScores = Object.values(PERSONAL_WEIGHT_VARIANTS).map((weights) => scoreTotal(gap.components, weights, true))
    const stability: PriorityStability = {
      global: stabilityFor(globalScores, globalTopSets[0]!.has(gap.gapId), globalTopSets.map((set) => set.has(gap.gapId))),
      personal: stabilityFor(personalScores, personalTopSets[0]!.has(gap.gapId), personalTopSets.map((set) => set.has(gap.gapId))),
    }
    const globalTotal = globalScores[0]!
    const personalTotal = personalScores[0]!
    const globalReasons = [...gap.reasonParts.filter((reason) => reason !== '所持装備' && reason !== '同family装備を所持'), `Weight stability: ${stability.global.level}`]
    const personalReasons = [...gap.reasonParts, `Weight stability: ${stability.personal.level}`]
    return {
      gapId: gap.gapId, entityId: gap.entityId, taskFamilyId: gap.taskFamilyId, ...(gap.protocolId ? { protocolId: gap.protocolId } : {}), resolutionClass: gap.resolutionClass,
      availability: gap.availability, ...(gap.availabilityBasis ? { availabilityBasis: gap.availabilityBasis } : {}), cost: gap.cost, rankSensitivity: gap.rankSensitivity, stability,
      global: { total: globalTotal, components: gap.components, confidence: confidenceFor(gap.rankSensitivity, stability.global, gap.availability, false), tier: tier(globalTotal), reasons: globalReasons },
      personal: { total: personalTotal, components: gap.components, confidence: confidenceFor(gap.rankSensitivity, stability.personal, gap.availability, true), tier: tier(personalTotal), reasons: personalReasons },
      prerequisites: gap.prerequisites,
    }
  }).sort((a, b) => b.global.total - a.global.total || a.gapId.localeCompare(b.gapId, 'en'))

  const entityPriorities = groupRanking(gapPriorities, (gap) => gap.entityId, 'global')
  const familyPriorities = groupRanking(gapPriorities, (gap) => gap.taskFamilyId, 'global')
  const protocolPriorities = groupRanking(gapPriorities, (gap) => gap.protocolId, 'global')
  const implementationPriorities = groupRanking(gapPriorities.filter((gap) => gap.resolutionClass === 'implementation'), (gap) => gap.taskFamilyId, 'global')
  const objectiveDesignPriorities = groupRanking(gapPriorities.filter((gap) => gap.resolutionClass === 'objective-design'), (gap) => gap.taskFamilyId, 'global')
  const ownedResearchQueue: ResearchQueueItem[] = gapPriorities.filter((gap) => gap.availability === 'owned' && gap.protocolId && ['observe', 'measure', 'experiment'].includes(gap.resolutionClass))
    .map((gap) => ({ gapId: gap.gapId, entityId: gap.entityId, protocolId: gap.protocolId!, priorityTier: gap.personal.tier, priorityScore: gap.personal.total, estimatedMinutes: gap.cost.totalEstimatedMinutes, reasons: gap.personal.reasons, prerequisites: gap.prerequisites }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.gapId.localeCompare(b.gapId, 'en'))
  const groupedResearchQueue = groupRanking(gapPriorities.filter((gap) => gap.availability === 'owned' && gap.protocolId), (gap) => gap.protocolId, 'personal')
    .map((group) => ({ ...group, entityIds: [...new Set(ownedResearchQueue.filter((item) => item.protocolId === group.id).map((item) => item.entityId))].sort() }))
  const priorityById = new Map(gapPriorities.map((gap) => [gap.gapId, gap]))

  const potentiallyUsable = (allowedTiers: readonly PriorityTier[]) => unlockBundles.filter((bundle) => bundle.remainingGapIds.every((id) => {
    const priority = priorityById.get(id)
    return priority ? allowedTiers.includes(priority.global.tier) : false
  })).length

  return {
    schemaVersion: 2, generatedFromGapMap: 'research/evidence-gap-map.json', generatedAt: map.generatedAt,
    gapPriorities, entityPriorities, familyPriorities, protocolPriorities, implementationPriorities, objectiveDesignPriorities, unlockBundles,
    ownedResearchQueue, groupedResearchQueue,
    potentialUsability: { currentRuntimePromotions: 0, entitiesAfterGlobalP0Closed: potentiallyUsable(['P0']), entitiesAfterGlobalP0P1Closed: potentiallyUsable(['P0', 'P1']), label: 'potential-analysis-only' },
    weightSensitivity,
    methodology: {
      formula: 'normalized weighted sum; global excludes and renormalizes ownershipSignal', weights: PRIORITY_WEIGHTS,
      normalization: 'all components 0..1; score rounded to one decimal', thresholds: PRIORITY_THRESHOLDS,
      rankSensitivityPolicy: 'bounded-proxy analysis-only 3-candidate fixture; not optimizer perturbation; never injected into runtime or Evidence', inventoryPolicy: 'synthetic in CI; local caller may pass Inventory; never persisted by this model',
      familyPolicy: 'same-family-only requires an accepted Source Harvest family relation; category equality is never sufficient',
    },
  }
}

export type CoveragePriorityModel = ReturnType<typeof buildCoveragePriority>

export function collectCoveragePriorityErrors(model: CoveragePriorityModel, map: EvidenceGapMap = buildEvidenceGapMap(), protocols: readonly MeasurementProtocol[] = buildPhase5MeasurementProtocols()): string[] {
  const errors: string[] = []
  if (model.gapPriorities.length !== map.gaps.length) errors.push(`gap count mismatch: ${model.gapPriorities.length} != ${map.gaps.length}`)
  if (new Set(model.gapPriorities.map((gap) => gap.gapId)).size !== model.gapPriorities.length) errors.push('duplicate gap priority')
  const protocolIds = new Set(protocols.map((protocol) => protocol.id))
  const familyByEntity = sourceFamilyByEntity()
  for (const gap of model.gapPriorities) {
    if (!Number.isFinite(gap.global.total) || !Number.isFinite(gap.personal.total)) errors.push(`${gap.gapId}: invalid score`)
    if (!['P0', 'P1', 'P2', 'P3'].includes(gap.global.tier) || !['P0', 'P1', 'P2', 'P3'].includes(gap.personal.tier)) errors.push(`${gap.gapId}: invalid tier`)
    if (gap.protocolId && !protocolIds.has(gap.protocolId)) errors.push(`${gap.gapId}: orphan protocol ${gap.protocolId}`)
    if (!gap.rankSensitivity.method) errors.push(`${gap.gapId}: sensitivity method is required`)
    if (gap.rankSensitivity.method === 'bounded-proxy' && (!gap.rankSensitivity.rangeSource?.length || !gap.rankSensitivity.range)) errors.push(`${gap.gapId}: bounded proxy lacks range provenance`)
    if (gap.rankSensitivity.status === 'computed' && gap.rankSensitivity.method !== 'bounded-proxy') errors.push(`${gap.gapId}: computed sensitivity must identify the bounded proxy`)
    if (gap.rankSensitivity.status === 'not-applicable' && gap.rankSensitivity.method !== 'not-applicable') errors.push(`${gap.gapId}: not-applicable sensitivity method mismatch`)
    if (['unsupported', 'insufficient-range'].includes(gap.rankSensitivity.status) && gap.rankSensitivity.method !== 'unsupported') errors.push(`${gap.gapId}: unsupported sensitivity method mismatch`)
    if (gap.rankSensitivity.method === 'bounded-proxy' && (gap.global.confidence === 'high' || gap.personal.confidence === 'high')) errors.push(`${gap.gapId}: bounded proxy cannot have high confidence`)
    if (gap.rankSensitivity.status === 'insufficient-range' && (gap.global.confidence === 'high' || gap.personal.confidence === 'high')) errors.push(`${gap.gapId}: insufficient range cannot have high confidence`)
    if ((gap.stability.global.level === 'low' && gap.global.confidence === 'high') || (gap.stability.personal.level === 'low' && gap.personal.confidence === 'high')) errors.push(`${gap.gapId}: unstable ranking cannot have high confidence`)
    if (gap.availability === 'same-family-only') {
      const basis = gap.availabilityBasis
      if (!basis || familyByEntity.get(gap.entityId) !== basis.familyId || !basis.ownedEntityIds.length || basis.ownedEntityIds.some((id) => familyByEntity.get(id) !== basis.familyId)) errors.push(`${gap.gapId}: same-family-only lacks a confirmed family relation`)
    }
  }
  const globalVariants = model.weightSensitivity.filter((item) => item.scope === 'global')
  const personalVariants = model.weightSensitivity.filter((item) => item.scope === 'personal')
  if (!globalVariants.some((item) => item.variant === 'default') || !personalVariants.some((item) => item.variant === 'default')) errors.push('weight sensitivity lacks a default comparison')
  if (globalVariants.some((item) => item.variant === 'ownership-heavy')) errors.push('global weight sensitivity must not use ownership-heavy')
  if (!personalVariants.some((item) => item.variant === 'ownership-heavy')) errors.push('personal weight sensitivity lacks ownership-heavy')
  const ownedGap = model.gapPriorities.find((gap) => gap.availability === 'owned')
  if (ownedGap && scoreTotal(ownedGap.personal.components, PERSONAL_WEIGHT_VARIANTS['ownership-heavy']!, true) <= scoreTotal(ownedGap.personal.components, PERSONAL_WEIGHT_VARIANTS.default!, true)) errors.push('personal ownership-heavy does not increase an owned gap score')
  if (model.ownedResearchQueue.some((item) => !model.gapPriorities.find((gap) => gap.gapId === item.gapId && gap.availability === 'owned'))) errors.push('personal queue contains a non-owned entity')
  const p0 = model.gapPriorities.filter((gap) => gap.global.tier === 'P0').length
  if (p0 > Math.ceil(map.gaps.length * 0.1)) errors.push(`global P0 is excessive: ${p0}`)
  return errors
}

export function summarizeCoveragePriority(model: CoveragePriorityModel) {
  const tierCounts = Object.fromEntries((['P0', 'P1', 'P2', 'P3'] as const).map((value) => [value, model.gapPriorities.filter((gap) => gap.global.tier === value).length]))
  const sensitivity = Object.fromEntries((['computed', 'insufficient-range', 'not-applicable', 'unsupported'] as const).map((value) => [value, model.gapPriorities.filter((gap) => gap.rankSensitivity.status === value).length]))
  const methods = Object.fromEntries((['optimizer-perturbation', 'bounded-proxy', 'not-applicable', 'unsupported'] as const).map((value) => [value, model.gapPriorities.filter((gap) => gap.rankSensitivity.method === value).length]))
  const personalConfidence = Object.fromEntries((['high', 'medium', 'low'] as const).map((value) => [value, model.gapPriorities.filter((gap) => gap.personal.confidence === value).length]))
  return { totalGaps: model.gapPriorities.length, tierCounts, sensitivity, methods, personalConfidence, sameFamilyOnly: model.gapPriorities.filter((gap) => gap.availability === 'same-family-only').length, unlockBundles: model.unlockBundles.length, globalP0TaskFamilies: model.familyPriorities.filter((item) => item.tier === 'P0').length,
    personalP0Entities: new Set(model.gapPriorities.filter((gap) => gap.availability === 'owned' && gap.personal.tier === 'P0').map((gap) => gap.entityId)).size,
    personalP0Gaps: model.gapPriorities.filter((gap) => gap.availability === 'owned' && gap.personal.tier === 'P0').length,
    ownedActionableGaps: model.ownedResearchQueue.length, ownedP0: model.ownedResearchQueue.filter((item) => item.priorityTier === 'P0').length,
    topProtocol: model.protocolPriorities[0]?.id ?? null, potentialUsabilityGain: model.potentialUsability.entitiesAfterGlobalP0Closed,
    potentialUsabilityGainP0P1: model.potentialUsability.entitiesAfterGlobalP0P1Closed }
}

export function renderCoveragePriority(model: CoveragePriorityModel): string {
  const summary = summarizeCoveragePriority(model)
  const table = (items: readonly RankingItem[], limit = 20) => ['| # | ID | Score | Tier | Gap | Entity |', '|---:|---|---:|:---:|---:|---:|', ...items.slice(0, limit).map((item, index) => `| ${index + 1} | ${item.id} | ${item.score.toFixed(1)} | ${item.tier} | ${item.gapCount} | ${item.entityCount} |`)].join('\n')
  const globalGaps = groupRanking(model.gapPriorities, (gap) => gap.gapId, 'global')
  const personalGaps = groupRanking(model.gapPriorities.filter((gap) => gap.availability === 'owned'), (gap) => gap.gapId, 'personal')
  const nearUnlock = model.unlockBundles.find((bundle) => bundle.remainingGapIds.length === 1)
  const winnerFlips = model.gapPriorities.filter((gap) => (gap.rankSensitivity.winnerFlipProxyRate ?? 0) > 0).length
  const sensitivityTable = (scope: 'global' | 'personal') => model.weightSensitivity.filter((item) => item.scope === scope).map((item) => `| ${item.variant} | ${item.top20OverlapWithDefault} / 20 |`).join('\n')
  return `# Coverage Priority\n\nPhase 6のanalysis-only priority read model。未知値をruntimeへ投入せず、Evidenceやruntime supportを変更しない。Priority confidenceとEvidence confidenceは別の指標である。\n\n## Summary\n\n- Gap: ${summary.totalGaps}\n- Global tier: P0 ${summary.tierCounts.P0} / P1 ${summary.tierCounts.P1} / P2 ${summary.tierCounts.P2} / P3 ${summary.tierCounts.P3}\n- Rank sensitivity: computed ${summary.sensitivity.computed} / insufficient-range ${summary.sensitivity['insufficient-range']} / not-applicable ${summary.sensitivity['not-applicable']} / unsupported ${summary.sensitivity.unsupported}\n- Method: bounded-proxy ${summary.methods['bounded-proxy']} / optimizer-perturbation ${summary.methods['optimizer-perturbation']} / not-applicable ${summary.methods['not-applicable']} / unsupported ${summary.methods.unsupported}\n- Winner flip proxyあり: ${winnerFlips} Gap\n- same-family-only: ${summary.sameFamilyOnly} Gap\n- Personal confidence: high ${summary.personalConfidence.high} / medium ${summary.personalConfidence.medium} / low ${summary.personalConfidence.low}\n- Unlock Bundle: ${summary.unlockBundles}\n- Synthetic owned queue: ${summary.ownedActionableGaps} actionable Gap（P0 ${summary.ownedP0}）\n- Potential usability: Global P0を全てcloseした場合 ${summary.potentialUsabilityGain} Entity candidate、P0+P1では ${summary.potentialUsabilityGainP0P1} Entity candidate（いずれもruntime昇格ではない）\n\n## Formula\n\nWeighted sum: runtime unlock 30%、rank sensitivity 25%、ownership 20%、coverage 10%、near-unlock 10%、acquisition ease 5%。Globalはownershipを除外して残りを再正規化する。閾値はP0 >= 81.5、P1 >= 60、P2 >= 42、P3 < 42。\n\n## Global Top 20 Gap\n\n${table(globalGaps)}\n\nP0理由は各Gapのglobal.reasonsに、unlock効果、family coverage、bundle残数、補正後cost、Rank Sensitivity method、weight stabilityを保持する。\n\n## Global Top 20 Entity\n\n${table(model.entityPriorities)}\n\n## Synthetic Personal Top 20 Gap\n\nSynthetic inventoryは Harp Crossbow / Bow / Wither Armor。本人Inventoryは保存せず、ブラウザから同じbuilderへ渡す。Globalではownershipを除外し、Personalだけowned / actual same-family / not-ownedを反映する。\n\n${table(personalGaps)}\n\n**same-family-only**はSource Harvestでacceptedな同一family relationが確認できる装備だけに付ける。同categoryであるだけでは付けず、Enchant / Artifactには適用しない。Owned Research Queueは引き続き **availability === owned** だけを含む。\n\n## Task Family ranking\n\n${table(model.familyPriorities, model.familyPriorities.length)}\n\nImplementation Gapはmeasurementと混ぜずimplementationPriorities、Objective-designはPersonal Research Queueへ入れずobjectiveDesignPrioritiesに分離する。最大のimplementation familyをupstream critical pathとしてcoverage gainとruntime unlockへ反映する。\n\n${table(model.implementationPriorities, model.implementationPriorities.length)}\n\n## Protocol ranking\n\n${table(model.protocolPriorities, model.protocolPriorities.length)}\n\nTop Protocolは ${summary.topProtocol}。同一Protocolのowned EntityはgroupedResearchQueueにまとめる。\n\n## Rank sensitivity\n\n現在のmethodは **bounded-proxy**。明示できるpropertyだけをnominal 1.0の保守的なrelative rangeで評価し、6 objectiveごとに3候補fixtureのwinner margin 10% / Top3 margin 6%と比較する。Optimizerを直接perturbしてBest Buildを再計算した値ではないため、**winnerFlipProxyRate** / **top3ChangeProxyRate** として保持し、これだけでPriority confidenceをhighにしない。score接続不能・range不明はunsupported / insufficient-rangeとして計算せず、計算済みproxyはrange provenanceを保持する。\n\n## Unlock and critical path\n\n${nearUnlock ? `${nearUnlock.id} は必要Gapが1件だけのnear-unlock例。` : '残り1件のnear-unlock bundleはない。'} implementation familyはdownstream Entity数をcoverage gainとして持ち、runtime-eligibilityと合わせてcritical pathを優先する。解決はcandidate化までで、runtime supportを自動昇格しない。\n\n## Cost and queue\n\nProtocolのestimated minutesにsetup、minimum repetitions、controls、variantsの補正を加える。同じProtocolのowned EntityをgroupedResearchQueueへ束ね、Phase 7がentity / gap / protocol / priority / reason / cost / prerequisitesを直接読める。Availabilityはowned / same-family-only / not-owned / unknownを区別する。Personal reasonには所持relation、Rank Sensitivity method、weight stability、推定時間を含める。\n\n## Global Weight Sensitivity\n\n| Variant | Default Top 20との重複 |\n|---|---:|\n${sensitivityTable('global')}\n\nGlobalはownership componentを除外し、ownership-heavy variantを持たない。\n\n## Personal Weight Sensitivity\n\n| Variant | Default Top 20との重複 |\n|---|---:|\n${sensitivityTable('personal')}\n\nPersonalはsynthetic ownershipを含め、ownership-heavyで所持Gapへの寄与を増やす。各Gapのscore range、tier stability、Top 20 membership retentionからweight stabilityを決め、不安定なrankingをhigh confidenceにしない。\n\n## Priority confidence\n\nPriority confidenceはRank Sensitivity method、range充足、ownership relation、cost、weight stabilityから決める。bounded-proxyは最大medium、insufficient-rangeまたは大幅なweight変動はlow。同familyだけの場合もownership確定とは区別する。Priority tierがP0でもconfidence lowを許容し、Evidence confidenceとは混同しない。\n\n## Safety boundary\n\nRuntime、Optimizer formula、Inventory schema、Evidence、Research Quest UI、Public Availabilityは変更していない。Priorityは候補選定のanalysis metadataであり、support昇格を意味しない。\n`
}
