import type { MeasurementProtocol } from './evidenceCoverage/protocols'
import { buildSourceHarvest, HARVEST_CATEGORIES, type GapCandidate, type HarvestCategory, type PropertySourceAttempt, type UnknownKind } from './sourceHarvest'

export const RESOLUTION_CLASSES = ['source-extractable', 'public-research', 'observe', 'measure', 'experiment', 'implementation', 'objective-design', 'defer'] as const
export type ResolutionClass = typeof RESOLUTION_CLASSES[number]
export type ExpectedOutcome = 'numeric-value' | 'categorical-value' | 'boolean' | 'timing' | 'distribution' | 'interaction-rule' | 'version-resolution' | 'implementation-decision' | 'objective-definition'
export type AcquisitionCost = 'trivial' | 'low' | 'medium' | 'high' | 'very-high'
export type UnlockEffect = 'runtime-eligibility' | 'rank-accuracy' | 'explanation-only' | 'metadata-only'

export interface EvidenceGap {
  readonly gapId: string
  readonly entity: string
  readonly category: HarvestCategory
  readonly property: string
  readonly gapCause: UnknownKind
  readonly resolutionClass: ResolutionClass
  readonly taskFamilyId: string
  readonly protocolId?: string
  readonly sourceAttempts: readonly PropertySourceAttempt[]
  readonly runtimeRelevance: GapCandidate['runtimeRelevance']
  readonly expectedOutcome: ExpectedOutcome
  readonly acquisitionCost: AcquisitionCost
  readonly unlockEffect: UnlockEffect
  readonly notes: string
}

export interface TaskFamily {
  readonly id: string
  readonly title: string
  readonly resolutionClass: ResolutionClass
  readonly protocolId?: string
  readonly implementationFamily?: string
  readonly requiredEvidence?: string
  readonly affectedRuntimeSubsystem?: string
  readonly objectiveFamily?: string
  readonly missingUserGoal?: string
  readonly requiredMetric?: string
  readonly productDecisionRequired?: string
  readonly researchSteps?: readonly string[]
  readonly researchRecordFields?: readonly string[]
  readonly researchCloseCondition?: readonly string[]
}

export interface GapMapOverride {
  readonly gapId: string
  readonly resolutionClass: ResolutionClass
  readonly taskFamilyId: string
  readonly reason: string
  readonly reviewedAt: string
}

type Classification = Pick<EvidenceGap, 'resolutionClass' | 'taskFamilyId' | 'protocolId'>
type FamilySeed = Omit<TaskFamily, 'title'> & { readonly title?: string }

const FAMILY_TITLES: Readonly<Record<string, string>> = {
  'structured-source-reconciliation': '既存structured sourceの未採用値照合',
  'version-history-research': '版履歴の公開調査',
  'source-conflict-resolution': '公開source競合解消',
  'public-property-research': '未掲載propertyの公開調査',
  'ranged-card-observation': '遠距離カード・可視property観測',
  'current-mechanic-observation': '現行版mechanic観測',
  'artifact-behavior-observation': 'Artifact挙動観測',
  'ranged-shot-cycle-measurement': '遠距離発射cycle測定',
  'melee-attack-scaling-measurement': '近接attack speed測定',
  'enchant-timing-measurement': 'Enchant時間測定',
  'enchant-proc-measurement': 'Enchant発動率測定',
  'artifact-duration-measurement': 'Artifact持続時間測定',
  'artifact-timing-measurement': 'Artifact timing測定',
  'power-scaling-experiment': 'Power scaling比較実験',
  'projectile-distribution-experiment': 'Projectile配分実験',
  'proc-ownership-experiment': 'Proc帰属実験',
  'ranged-mechanic-experiment': '遠距離mechanic比較実験',
  'enchant-stacking-experiment': 'Enchant stacking実験',
  'enchant-power-dependence-experiment': 'Enchant Power依存実験',
  'artifact-interaction-experiment': 'Artifact相互作用実験',
  'artifact-scaling-experiment': 'Artifact curve実験',
}

const MANUAL_OVERRIDES: readonly GapMapOverride[] = []

const protocolClassification = (resolutionClass: 'observe' | 'measure' | 'experiment', taskFamilyId: string, protocolId: string): Classification => ({ resolutionClass, taskFamilyId, protocolId })

function nonMeasurementClassification(gap: GapCandidate): Classification | null {
  if (gap.likelyAcquisitionType === 'implementation-related') return { resolutionClass: 'implementation', taskFamilyId: implementationFamily(gap.notes) }
  if (gap.likelyAcquisitionType === 'objective-related') return { resolutionClass: 'objective-design', taskFamilyId: objectiveFamily(gap.notes) }
  if (gap.likelyAcquisitionType === 'conflicting-public-sources') return { resolutionClass: 'public-research', taskFamilyId: 'source-conflict-resolution' }
  if (gap.likelyAcquisitionType === 'version-unknown') return { resolutionClass: 'public-research', taskFamilyId: 'version-history-research' }
  if (gap.likelyAcquisitionType === 'source-missing' && gap.sourceAttempts.some((attempt) => attempt.result === 'value-found')) return { resolutionClass: 'source-extractable', taskFamilyId: 'structured-source-reconciliation' }
  return null
}

function implementationFamily(notes: string): string {
  const text = notes.toLowerCase()
  if (text.includes('damage reduction') || text.includes('hit-negation')) return 'implementation-defense-composition'
  if (text.includes('cooldown') || text.includes('potion-use')) return 'implementation-cooldown-scheduler'
  if (text.includes('soul')) return 'implementation-soul-economy'
  if (text.includes('pet') || text.includes('summon')) return 'implementation-summon-runtime'
  if (text.includes('roll') || text.includes('position')) return 'implementation-position-event-model'
  if (text.includes('life-steal')) return 'implementation-life-steal-policy'
  if (text.includes('ranged')) return 'implementation-ranged-runtime'
  if (text.includes('attack-speed') || text.includes('melee-damage') || text.includes('weapon damage aura')) return 'implementation-modifier-ownership'
  if (text.includes('threat') || text.includes('party targeting')) return 'implementation-targeting-model'
  if (text.includes('artifact damage')) return 'implementation-artifact-runtime'
  return 'implementation-mechanic-family'
}

function objectiveFamily(notes: string): string {
  const text = notes.toLowerCase()
  if (text.includes('arrow')) return 'objective-arrow-economy'
  if (text.includes('movement') || text.includes('roll animation')) return 'objective-mobility'
  if (text.includes('party healing')) return 'objective-party-support'
  if (text.includes('environmental') || text.includes('displacement')) return 'objective-resistance-utility'
  return 'objective-control-utility'
}

function artifactObservation(notes: string): Classification {
  const text = notes.toLowerCase()
  const experimentWords = ['overlap', 'ownership', 'attribution', 'probability', 'distribution', 'semantics', 'immunity', 'target model', 'targeting', 'party', 'duplicate', 'consumption', 'feedback', 'dynamo', 'void']
  const timingWords = ['duration', 'lifetime', 'cadence', 'delay', 'tick', 'cooldown', ' cd', 'residence', 'per-second', 'aim', 'beam']
  if (experimentWords.some((word) => text.includes(word))) return protocolClassification('experiment', 'artifact-interaction-experiment', 'EXP-ARTIFACT-INTERACTION')
  if (timingWords.some((word) => text.includes(word))) return protocolClassification('measure', 'artifact-timing-measurement', 'MEAS-ARTIFACT-TIMING')
  return protocolClassification('observe', 'artifact-behavior-observation', 'OBS-ARTIFACT-BEHAVIOR')
}

function classifyGap(gap: GapCandidate): Classification {
  const base = nonMeasurementClassification(gap)
  if (base) return base
  const [category] = gap.entity.split(':') as [HarvestCategory]
  const property = gap.property

  if (gap.likelyAcquisitionType === 'source-missing') {
    if (category === 'ranged-weapon' && ['projectileCount', 'burstCount', 'spread'].includes(property)) return protocolClassification('observe', 'ranged-card-observation', 'OBS-RANGED-CARD')
    if (category === 'ranged-enchantment' && property === 'maxCopies') return protocolClassification('observe', 'ranged-card-observation', 'OBS-RANGED-CARD')
    if (['melee-enchantment', 'armor-enchantment'].includes(category) && ['duration', 'cooldown'].includes(property)) return protocolClassification('measure', 'enchant-timing-measurement', 'MEAS-ENCHANT-TIMING')
    if (['melee-enchantment', 'armor-enchantment'].includes(category) && property === 'procChance') return protocolClassification('measure', 'enchant-proc-measurement', 'MEAS-ENCHANT-PROC')
    if (['melee-enchantment', 'armor-enchantment'].includes(category) && property === 'powerDependence') return protocolClassification('experiment', 'enchant-power-dependence-experiment', 'EXP-ENCHANT-POWER')
    if (category === 'artifact' && property === 'stacking') return protocolClassification('experiment', 'artifact-interaction-experiment', 'EXP-ARTIFACT-INTERACTION')
    return { resolutionClass: 'public-research', taskFamilyId: 'public-property-research' }
  }

  if (gap.likelyAcquisitionType === 'requires-game-observation') {
    if (category === 'ranged-weapon') return protocolClassification('measure', 'ranged-shot-cycle-measurement', 'MEAS-RANGED-SHOT-CYCLE')
    if (category === 'melee-weapon') return protocolClassification('measure', 'melee-attack-scaling-measurement', 'MEAS-MELEE-ATTACK-SCALING')
    if (category === 'melee-enchantment' || category === 'armor-enchantment') return protocolClassification('observe', 'current-mechanic-observation', 'OBS-CURRENT-MECHANIC')
    if (category === 'artifact') return artifactObservation(gap.notes)
  }

  if (gap.likelyAcquisitionType === 'likely-requires-experiment') {
    if ((category === 'melee-weapon' && property === 'powerScaling') || (category === 'armor' && property === 'healthPowerCurve')) return protocolClassification('experiment', 'power-scaling-experiment', 'EXP-POWER-SCALING')
    if (category === 'ranged-weapon' && property === 'neutralProjectileDamageDistribution') return protocolClassification('experiment', 'projectile-distribution-experiment', 'EXP-RANGED-PROJECTILE-DISTRIBUTION')
    if ((category === 'ranged-weapon' && property === 'procOwnership') || (category === 'ranged-enchantment' && property === 'triggerOwnership')) return protocolClassification('experiment', 'proc-ownership-experiment', 'EXP-RANGED-PROC-OWNERSHIP')
    if (category === 'ranged-enchantment' && property === 'ammoChargeInteractions') return protocolClassification('experiment', 'ranged-mechanic-experiment', 'EXP-RANGED-MECHANIC')
    if (category === 'artifact') return artifactObservation(gap.notes)
  }
  throw new Error(`No Phase 5 classification rule for ${gap.entity}:${gap.property}:${gap.likelyAcquisitionType}`)
}

function expectedOutcome(gap: GapCandidate, classification: Classification): ExpectedOutcome {
  if (classification.resolutionClass === 'implementation') return 'implementation-decision'
  if (classification.resolutionClass === 'objective-design') return 'objective-definition'
  if (gap.likelyAcquisitionType === 'version-unknown' || gap.likelyAcquisitionType === 'conflicting-public-sources') return 'version-resolution'
  const property = gap.property.toLowerCase()
  if (classification.resolutionClass === 'experiment') return property.includes('chance') || property.includes('distribution') || property.includes('curve') || property.includes('scaling') ? 'distribution' : 'interaction-rule'
  if (property.includes('seconds') || property.includes('timing') || property.includes('duration') || property.includes('cooldown') || property.includes('speed')) return 'timing'
  if (property.includes('chance') || property.includes('count') || property.includes('power') || property.includes('damage') || property.includes('health')) return 'numeric-value'
  if (property.includes('stack') || property.includes('ownership') || property.includes('interaction') || property.includes('duplication') || property.includes('pierce') || property.includes('ricochet')) return 'boolean'
  return 'categorical-value'
}

const COSTS: Readonly<Record<ResolutionClass, AcquisitionCost>> = { 'source-extractable': 'trivial', 'public-research': 'low', observe: 'low', measure: 'medium', experiment: 'high', implementation: 'very-high', 'objective-design': 'medium', defer: 'very-high' }

function unlockEffect(gap: GapCandidate, classification: Classification): UnlockEffect {
  if (classification.resolutionClass === 'objective-design') return 'explanation-only'
  if (classification.resolutionClass === 'implementation') return 'runtime-eligibility'
  if (gap.runtimeRelevance === 'high') return classification.resolutionClass === 'public-research' && gap.property.toLowerCase().includes('version') ? 'metadata-only' : 'rank-accuracy'
  if (gap.runtimeRelevance === 'low') return 'explanation-only'
  return gap.property.toLowerCase().includes('version') ? 'metadata-only' : 'runtime-eligibility'
}

function implementationFamilyDetails(id: string): FamilySeed {
  const labels: Readonly<Record<string, readonly [string, string]>> = {
    'implementation-defense-composition': ['防御合成と離散hit model', 'defense / incoming damage'],
    'implementation-cooldown-scheduler': ['CooldownとPotion event scheduler', 'artifact / potion scheduler'],
    'implementation-soul-economy': ['Soul単位とresource economy', 'soul scheduler'],
    'implementation-summon-runtime': ['Pet / summon runtime', 'artifact summon runtime'],
    'implementation-position-event-model': ['Roll・位置・event model', 'combat state / control'],
    'implementation-life-steal-policy': ['Life Steal対象channel policy', 'healing / damage events'],
    'implementation-ranged-runtime': ['Ranged catalog/runtime接続', 'ranged optimizer adapter'],
    'implementation-modifier-ownership': ['Modifier bucket ownership', 'damage modifier composition'],
    'implementation-targeting-model': ['Threat / party targeting model', 'target selection'],
    'implementation-artifact-runtime': ['Artifact damage runtime', 'artifact evaluator'],
    'implementation-mechanic-family': ['未対応mechanic family', 'runtime support manifest'],
  }
  const [requiredEvidence, subsystem] = labels[id] ?? ['該当mechanicの実装判断', 'runtime support manifest']
  return { id, resolutionClass: 'implementation', implementationFamily: id, requiredEvidence, affectedRuntimeSubsystem: subsystem }
}

function objectiveFamilyDetails(id: string): FamilySeed {
  const labels: Readonly<Record<string, readonly [string, string]>> = {
    'objective-arrow-economy': ['矢消費を評価するか', 'ammo efficiency / encounter duration'],
    'objective-mobility': ['移動・rollの価値を評価するか', 'travel time / survival utility'],
    'objective-party-support': ['solo最適化とparty貢献をどう分離するか', 'ally healing / team uptime'],
    'objective-resistance-utility': ['環境・ノックバック耐性の価値をどう扱うか', 'prevented displacement / effective uptime'],
    'objective-control-utility': ['Controlをdamageへ偽変換せずどう評価するか', 'target-seconds / control uptime'],
  }
  const [decision, metric] = labels[id] ?? ['目的関数への採否を決める', '明示的なutility metric']
  return { id, resolutionClass: 'objective-design', objectiveFamily: id, missingUserGoal: decision, requiredMetric: metric, productDecisionRequired: 'Phase 6以降でユーザー価値と重みを決定する。Phase 5ではscoreを計算しない。' }
}

function researchFamilyDetails(id: string): Partial<TaskFamily> {
  if (id === 'structured-source-reconciliation') return {
    researchSteps: ['Gapのproperty-level sourceAttemptsを確認する。', 'value-foundの元claim・locator・解釈を照合する。', '現行版への適用可否を決め、採用しない場合は理由を残す。'],
    researchRecordFields: ['source ID / URL', 'source locator', 'raw value', 'normalized value', 'game version', '採否と理由'],
    researchCloseCondition: ['値とversionをaccepted factへ昇格できる、または取得不能理由を確定して別Resolution Classへ再分類できる。'],
  }
  const shared = {
    researchSteps: ['dungeons.toolsの既存attemptを確認する。', '公式patch notesを確認する。', 'Wiki本文と履歴を確認する。', '再現可能な定量公開test・videoを確認する。', '必要ならarchived pageを確認する。'],
    researchRecordFields: ['source URL', '公開日・対象version', '原文またはlocator', '対象property', '候補値', '競合と採否理由'],
    researchCloseCondition: ['現行版へ帰属できる複数sourceまたは一次sourceで値を確定する。', '確定不能なら調査済みsourceと理由を残し、observe / measure / experimentへ送る。'],
  }
  return id === 'source-conflict-resolution' ? { ...shared, researchCloseCondition: ['競合する全候補をversion・unit・条件で分離し、現行版の採用値または未解決理由を確定する。'] } : shared
}

export function buildEvidenceGapMap() {
  const harvest = buildSourceHarvest()
  const overrideById = new Map(MANUAL_OVERRIDES.map((override) => [override.gapId, override]))
  const gaps: EvidenceGap[] = harvest.gaps.map((gap) => {
    const [category] = gap.entity.split(':') as [HarvestCategory]
    const gapId = `${gap.entity}:${gap.property}`
    const automatic = classifyGap(gap)
    const override = overrideById.get(gapId)
    const classification = override ? { resolutionClass: override.resolutionClass, taskFamilyId: override.taskFamilyId } : automatic
    return { gapId, entity: gap.entity, category, property: gap.property, gapCause: gap.likelyAcquisitionType, ...classification, sourceAttempts: gap.sourceAttempts, runtimeRelevance: gap.runtimeRelevance,
      expectedOutcome: expectedOutcome(gap, classification), acquisitionCost: COSTS[classification.resolutionClass], unlockEffect: unlockEffect(gap, classification), notes: gap.notes }
  })
  const familyIds = [...new Set(gaps.map((gap) => gap.taskFamilyId))].sort((a, b) => a.localeCompare(b, 'en'))
  const taskFamilies: TaskFamily[] = familyIds.map((id) => {
    const sample = gaps.find((gap) => gap.taskFamilyId === id)!
    if (id.startsWith('implementation-')) return { ...implementationFamilyDetails(id), title: FAMILY_TITLES[id] ?? id }
    if (id.startsWith('objective-')) return { ...objectiveFamilyDetails(id), title: FAMILY_TITLES[id] ?? id }
    return { id, title: FAMILY_TITLES[id] ?? id, resolutionClass: sample.resolutionClass, ...(sample.protocolId ? { protocolId: sample.protocolId } : {}), ...(['source-extractable', 'public-research'].includes(sample.resolutionClass) ? researchFamilyDetails(id) : {}) }
  })
  return { schemaVersion: 1, targetGameVersion: harvest.targetGameVersion, generatedFrom: 'research/source-harvest.json', generatedAt: harvest.generatedAt, methodology: { priorityCalculated: false, ownershipSignalUsed: false, runtimePromotionAllowed: false, unknownValuePolicy: harvest.methodology.unknownValuePolicy }, manualOverrides: MANUAL_OVERRIDES, taskFamilies, gaps }
}

export type EvidenceGapMap = ReturnType<typeof buildEvidenceGapMap>

const countBy = <T extends string>(values: readonly T[]): Record<T, number> => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length])) as Record<T, number>

export function summarizeEvidenceGapMap(map: EvidenceGapMap) {
  const protocols = new Set(map.gaps.flatMap((gap) => gap.protocolId ? [gap.protocolId] : []))
  return {
    totalGaps: map.gaps.length,
    resolutionClasses: countBy(map.gaps.map((gap) => gap.resolutionClass)),
    gapCauses: countBy(map.gaps.map((gap) => gap.gapCause)),
    categories: countBy(map.gaps.map((gap) => gap.category)),
    acquisitionCosts: countBy(map.gaps.map((gap) => gap.acquisitionCost)),
    runtimeRelevance: countBy(map.gaps.map((gap) => gap.runtimeRelevance)),
    unlockEffects: countBy(map.gaps.map((gap) => gap.unlockEffect)),
    taskFamilyCount: map.taskFamilies.length,
    protocolCount: protocols.size,
    protocolBackedActionableGaps: map.gaps.filter((gap) => ['observe', 'measure', 'experiment'].includes(gap.resolutionClass) && gap.protocolId).length,
    actionableGaps: map.gaps.filter((gap) => ['observe', 'measure', 'experiment'].includes(gap.resolutionClass)).length,
    unclassified: map.gaps.filter((gap) => !gap.resolutionClass || !gap.taskFamilyId).length,
  }
}

const commonMetadata = ['game versionと確度、platform、difficulty、記録日時', 'entity ID、Power、全装備・Enchant・Artifactとmodifier', '未編集のscreenshot/video、frame rate、timestamps、run ID、除外runと理由']
const protocol = (value: Omit<MeasurementProtocol, 'purpose' | 'requiredGameVersion' | 'submissionMetadata' | 'sourceRefs'> & { purpose?: string }): MeasurementProtocol => ({
  ...value, prerequisites: value.equipment, setup: value.scenario,
  steps: ['対象entity・版・Powerと全modifierを記録する。', '同じ条件でbaselineを取得する。', ...(value.variants?.length ? ['指定variantを1条件ずつ変更して取得する。'] : []), 'raw記録から指定fieldを転記し、除外runと理由を残す。', '必要回数とclose条件を満たすか確認する。'],
  recordFields: value.observations, closeCondition: value.acceptance, failureModes: value.invalidatingConditions,
  purpose: value.purpose ?? 'Source HarvestのGapを再現可能な観測または実験で解決する。測定結果そのものは含まない。', requiredGameVersion: '1.17.0.0', submissionMetadata: commonMetadata,
  sourceRefs: ['docs/source-harvest.md', 'research/source-harvest.json'],
})

export function buildPhase5MeasurementProtocols(): readonly MeasurementProtocol[] {
  return [
    protocol({ id: 'OBS-RANGED-CARD', title: '遠距離カード・可視property観測', resolutionClass: 'observe', taskFamilyIds: ['ranged-card-observation'], subsystem: 'ranged-weapon / ranged-enchantment', targetMechanic: 'projectile count・burst・spread・max copies', appliesTo: { categories: ['ranged-weapon', 'ranged-enchantment'], properties: ['projectileCount', 'burstCount', 'spread', 'maxCopies'] }, estimatedMinutes: { min: 1, max: 5 }, equipment: ['対象装備と比較用の同family装備。'], scenario: ['Inventoryと装備カードを開き、Power・rarity・built-inを同時に確認する。'], observations: ['表示projectile/burst/spread、copy上限、画面名、screenshot参照。'], repetition: { minimumIndependentRuns: 1, rule: '同一版・同一装備を1回確認し、表示が条件で変わる場合は各条件を追加確認する。' }, acceptance: ['対象ID・版・表示値を含むscreenshotでpropertyを一意に読める。'], invalidatingConditions: ['版・装備ID・Powerが不明、tooltipの推測、別familyからの転記。'], blockerIds: [] }),
    protocol({ id: 'OBS-CURRENT-MECHANIC', title: '現行版mechanic観測', resolutionClass: 'observe', taskFamilyIds: ['current-mechanic-observation'], subsystem: 'melee-enchantment / armor-enchantment', targetMechanic: '現行版のtrigger・state requirement・visible behavior', appliesTo: { categories: ['melee-enchantment', 'armor-enchantment'], properties: ['currentVersionGameplayVerification', 'stateRequirement'] }, estimatedMinutes: { min: 1, max: 5 }, equipment: ['対象Enchantを単独装着できる装備。'], scenario: ['発動前後が見える安全な固定条件。'], observations: ['発動アイコン、必要state、対象、表示文、screenshot/video timestamp。'], repetition: { minimumIndependentRuns: 1, rule: '表示だけなら1確認、発動確認を含む場合は3回。' }, acceptance: ['必要stateと可視挙動を対象IDへ帰属できる。'], invalidatingConditions: ['複数候補を同時装着し帰属不能、旧版映像。'], blockerIds: [] }),
    protocol({ id: 'OBS-ARTIFACT-BEHAVIOR', title: 'Artifact挙動観測', resolutionClass: 'observe', taskFamilyIds: ['artifact-behavior-observation'], subsystem: 'artifact', targetMechanic: 'target count・ammo・soul・可視挙動', appliesTo: { categories: ['artifact'], properties: ['mechanicGap.*'] }, estimatedMinutes: { min: 1, max: 5 }, equipment: ['対象Artifact、効果を混同しないneutral装備。'], scenario: ['単体と必要時のみ複数target。'], observations: ['対象数、生成物、消費resource、可視status、screenshot/video。'], repetition: { minimumIndependentRuns: 3, rule: '同条件で3回、ランダム選択が見える場合は結果が安定するまで追加。' }, acceptance: ['対象Artifactだけに帰属できる可視ルールを記録する。'], invalidatingConditions: ['別Artifact/Enchant混入、target数やSoul残量不明。'], blockerIds: [] }),
    protocol({ id: 'MEAS-RANGED-SHOT-CYCLE', title: '遠距離発射cycle測定', resolutionClass: 'measure', taskFamilyIds: ['ranged-shot-cycle-measurement'], legacyProtocolIds: ['ranged-cadence'], subsystem: 'ranged-weapon', targetMechanic: 'charge・shot・recovery・shots per second', appliesTo: { categories: ['ranged-weapon'], properties: ['chargeTimeSeconds', 'recoverySeconds', 'shotsPerSecond'] }, estimatedMinutes: { min: 5, max: 15 }, equipment: ['attack speed modifier・関連Artifact・Enchantなし、通常矢。'], scenario: ['固定距離で連続発射し、N shotを録画する。'], observations: ['最初と最後の発射frame、shots、elapsed time、charge/recovery境界、計算cycle。'], repetition: { minimumIndependentRuns: 3, rule: '3 series以上、各series 20射以上。BowとCrossbowを別runにする。' }, acceptance: ['平均cycleをraw frameから再計算でき、chargeとrecoveryを分離できる。'], invalidatingConditions: ['入力遅延・特殊矢・speed modifier混入、shotとprojectileの混同。'], blockerIds: [] }),
    protocol({ id: 'MEAS-MELEE-ATTACK-SCALING', title: '近接attack speed測定', resolutionClass: 'measure', taskFamilyIds: ['melee-attack-scaling-measurement'], subsystem: 'melee-weapon', targetMechanic: 'attackSpeedScaling', appliesTo: { categories: ['melee-weapon'], properties: ['attackSpeedScaling'] }, estimatedMinutes: { min: 5, max: 15 }, equipment: ['対象武器、attack speed modifierなしのbaselineと既知modifier条件。'], scenario: ['同じtargetへ完全comboを連続実行。'], observations: ['各hit frame、combo開始/終了、modifier、combo数、elapsed time。'], repetition: { minimumIndependentRuns: 3, rule: 'baselineと各variantで3 run以上、各run 10 combo以上。' }, acceptance: ['baseline比と各hit intervalを独立runで再現できる。'], invalidatingConditions: ['空振り、combo中断、未知modifier、異なる武器family混在。'], blockerIds: [] }),
    protocol({ id: 'MEAS-ENCHANT-TIMING', title: 'Enchant時間測定', resolutionClass: 'measure', taskFamilyIds: ['enchant-timing-measurement'], subsystem: 'melee-enchantment / armor-enchantment', targetMechanic: 'duration・cooldown・tick interval', appliesTo: { categories: ['melee-enchantment', 'armor-enchantment'], properties: ['duration', 'cooldown'] }, estimatedMinutes: { min: 5, max: 15 }, equipment: ['対象Enchantを単独装着、Tier/copy/Gildedを固定。'], scenario: ['trigger前のbaselineから発動・失効・再発動を録画。'], observations: ['trigger/effect end/再使用可能frame、各interval、Tier、失敗trigger。'], repetition: { minimumIndependentRuns: 3, rule: '各Tier/条件で3独立run、各run 5周期以上。' }, acceptance: ['開始点と終了点を定義し、全intervalをraw timestampから再計算できる。'], invalidatingConditions: ['別cooldown/duration modifier混入、発動失敗を周期へ算入。'], blockerIds: [] }),
    protocol({ id: 'MEAS-ENCHANT-PROC', title: 'Enchant発動率測定', resolutionClass: 'measure', taskFamilyIds: ['enchant-proc-measurement'], subsystem: 'melee-enchantment / armor-enchantment', targetMechanic: 'proc chance', appliesTo: { categories: ['melee-enchantment', 'armor-enchantment'], properties: ['procChance'] }, estimatedMinutes: { min: 15, max: 30 }, equipment: ['対象Enchant単独、Tier/copy/Gilded固定。'], scenario: ['同じ有効triggerを反復し、無効trialを分離する。'], observations: ['eligible trials、proc count、非proc count、除外理由、推定率と区間。'], repetition: { minimumIndependentRuns: 3, rule: '3 run以上、合計100 eligible trials以上。rare procは必要に応じ追加する。' }, acceptance: ['trial母数とproc帰属が再計算可能で、run間のばらつきを報告する。'], invalidatingConditions: ['eligibleでないhitを母数化、複数proc source、成功例だけの記録。'], blockerIds: [] }),
    protocol({ id: 'MEAS-ARTIFACT-TIMING', title: 'Artifact timing測定', resolutionClass: 'measure', taskFamilyIds: ['artifact-timing-measurement'], subsystem: 'artifact', targetMechanic: 'delay・cadence・lifetime・tick', appliesTo: { categories: ['artifact'], properties: ['mechanicGap.*'] }, estimatedMinutes: { min: 5, max: 15 }, equipment: ['対象Artifact、timing modifierなし。'], scenario: ['開始・tick・終了を識別できる固定条件で録画。'], observations: ['入力/発動/tick/終了frame、周期数、elapsed time、resource消費。'], repetition: { minimumIndependentRuns: 3, rule: '各条件3 run以上、周期効果は各run 10 interval以上。' }, acceptance: ['全timestampとevent定義からtimingを再計算できる。'], invalidatingConditions: ['lag・入力遅延・別status更新・画面外event。'], blockerIds: [] }),
    protocol({ id: 'EXP-POWER-SCALING', title: '装備Power scaling比較', resolutionClass: 'experiment', taskFamilyIds: ['power-scaling-experiment'], subsystem: 'melee-weapon / armor', targetMechanic: 'damage・health Power curve', appliesTo: { categories: ['melee-weapon', 'armor'], properties: ['powerScaling', 'healthPowerCurve'] }, estimatedMinutes: { min: 30, max: 60 }, equipment: ['同一familyの複数Power、他modifierなし。'], scenario: ['baseline Powerと低・中・高Power variantを同じ条件で比較。'], observations: ['Power、card/observed値、raw hit/health、候補curve残差。'], repetition: { minimumIndependentRuns: 3, rule: '各Powerで3 run以上、最低5 Power anchor。' }, controls: ['同一entity/family・difficulty・target・modifier。'], variants: ['低Power', '中Power', '高Power'], hypothesis: ['単一curve', 'family固有curve', 'band/roundingあり'], acceptance: ['hold-out Powerを含め、支持範囲と外挿禁止境界を明記する。'], invalidatingConditions: ['別family混在、card値を内部式と断定、版不明sample。'], blockerIds: [] }),
    protocol({ id: 'EXP-RANGED-PROJECTILE-DISTRIBUTION', title: 'Projectile damage配分実験', resolutionClass: 'experiment', taskFamilyIds: ['projectile-distribution-experiment'], legacyProtocolIds: ['ranged-projectiles'], subsystem: 'ranged-weapon', targetMechanic: 'neutral projectile damage distribution', appliesTo: { categories: ['ranged-weapon'], properties: ['neutralProjectileDamageDistribution'] }, estimatedMinutes: { min: 15, max: 30 }, equipment: ['対象武器、Enchantなし、通常矢。'], scenario: ['単体baseline、十分離した複数target、重なった複数target。'], observations: ['1入力のprojectile数、各projectile/target damage、total damage、ammo。'], repetition: { minimumIndependentRuns: 3, rule: 'baselineと各variantで3 run以上、各run 20入力。' }, controls: ['同一Power・距離・target armor/DR。'], variants: ['単体', '分離複数target', '重複複数target'], hypothesis: ['card値は1 projectile', 'card値は全projectile合計', 'projectileごとに非均等配分'], acceptance: ['projectileとtargetの帰属を追跡し、card値の単位を一意にする。'], invalidatingConditions: ['proc/爆発/特殊矢混入、missを0 damage projectileと混同。'], blockerIds: [] }),
    protocol({ id: 'EXP-RANGED-PROC-OWNERSHIP', title: '遠距離Proc帰属実験', resolutionClass: 'experiment', taskFamilyIds: ['proc-ownership-experiment'], legacyProtocolIds: ['ranged-interactions'], subsystem: 'ranged-weapon / ranged-enchantment', targetMechanic: 'per-shot・per-projectile・per-hit ownership', appliesTo: { categories: ['ranged-weapon', 'ranged-enchantment'], properties: ['procOwnership', 'triggerOwnership'] }, estimatedMinutes: { min: 15, max: 30 }, equipment: ['単発武器とmulti-projectile武器、対象Enchant単独。'], scenario: ['baseline 0 copy、1 copy、必要なら2 copyを同じtarget条件で比較。'], observations: ['shots、projectiles、hits、eligible trials、proc、kill attribution。'], repetition: { minimumIndependentRuns: 3, rule: '各条件3 run以上、合計100 eligible units以上。' }, controls: ['同一Power・target・距離・Tier。'], variants: ['単発', 'multi-projectile', 'multi-hit'], hypothesis: ['per-shot', 'per-projectile', 'per-hit'], acceptance: ['どの母数で率が安定するかを独立runで再現する。'], invalidatingConditions: ['shot/projectile/hitの混同、複数proc source。'], blockerIds: [] }),
    protocol({ id: 'EXP-RANGED-MECHANIC', title: '遠距離mechanic比較実験', resolutionClass: 'experiment', taskFamilyIds: ['ranged-mechanic-experiment'], subsystem: 'ranged-enchantment', targetMechanic: 'ammo・charge interaction', appliesTo: { categories: ['ranged-enchantment'], properties: ['ammoChargeInteractions'] }, estimatedMinutes: { min: 15, max: 30 }, equipment: ['対象EnchantとBow/Crossbow各1、通常矢。'], scenario: ['0 copy baselineと1 copy、未charge/partial/full chargeを比較。'], observations: ['ammo消費、charge段階、projectile、damage、proc。'], repetition: { minimumIndependentRuns: 3, rule: '各baseline/variantで3 run以上、各run 20入力。' }, controls: ['同一Power・target・距離。'], variants: ['未charge', 'partial charge', 'full charge'], hypothesis: ['ammo単位', 'shot単位', 'charge段階依存'], acceptance: ['ammoとchargeの影響を別々に識別する。'], invalidatingConditions: ['特殊矢・別ammo効果・入力失敗。'], blockerIds: [] }),
    protocol({ id: 'EXP-ENCHANT-POWER', title: 'Enchant Power依存実験', resolutionClass: 'experiment', taskFamilyIds: ['enchant-power-dependence-experiment'], subsystem: 'melee-enchantment / armor-enchantment', targetMechanic: 'absolute outputのPower依存', appliesTo: { categories: ['melee-enchantment', 'armor-enchantment'], properties: ['powerDependence'] }, estimatedMinutes: { min: 30, max: 60 }, equipment: ['同一Enchant/Tierを持つ複数Power装備。'], scenario: ['同じtarget・triggerでPowerだけを変える。'], observations: ['Power、Tier、raw output、baseline、ratio、rounding。'], repetition: { minimumIndependentRuns: 3, rule: '最低5 Power anchor、各Power 3 run以上。' }, controls: ['同一Tier・target・difficulty・他modifier。'], variants: ['低Power', '中Power', '高Power'], hypothesis: ['Power非依存', '装備Power依存', '別Power curve依存'], acceptance: ['hold-out Powerを含め依存有無と適用範囲を示す。'], invalidatingConditions: ['TierとPowerを同時変更、別damage source混入。'], blockerIds: [] }),
    protocol({ id: 'EXP-ARTIFACT-INTERACTION', title: 'Artifact相互作用・stacking実験', resolutionClass: 'experiment', taskFamilyIds: ['artifact-interaction-experiment'], subsystem: 'artifact', targetMechanic: 'stacking・targeting・ownership・overlap', appliesTo: { categories: ['artifact'], properties: ['stacking', 'interactions', 'mechanicGap.*'] }, estimatedMinutes: { min: 15, max: 30 }, equipment: ['対象Artifact 1個/複数copy、比較対象効果。'], scenario: ['0 copy baseline、1 copy、2 copy、順序入替を同じ条件で比較。'], observations: ['各source単独値、pair結果、発動順、target、owner、overlap window。'], repetition: { minimumIndependentRuns: 3, rule: 'baselineと各variantで3独立run以上。確率挙動は100 eligible trials以上。' }, controls: ['同一Power・target・difficulty・buff。'], variants: ['0 copy', '1 copy', '2 copy', '発動順逆転'], hypothesis: ['加算', '乗算', '上限', '更新', 'stackしない'], acceptance: ['単独baselineからpairを説明し、target/owner/refresh規則を分離する。'], invalidatingConditions: ['単独値なし、Powerやtargetを同時変更、kill帰属不明。'], blockerIds: [] }),
  ]
}

export function collectEvidenceGapMapErrors(map: EvidenceGapMap, protocols: readonly MeasurementProtocol[]): string[] {
  const errors: string[] = []
  const harvest = buildSourceHarvest()
  const protocolIds = new Set(protocols.map((protocol) => protocol.id))
  const familyIds = new Set(map.taskFamilies.map((family) => family.id))
  const sourceKeys = new Set(harvest.gaps.map((gap) => `${gap.entity}:${gap.property}`))
  const gapIds = new Set<string>()
  if (map.gaps.length !== harvest.gaps.length) errors.push(`Gap count drift: ${map.gaps.length} / ${harvest.gaps.length}`)
  if (map.methodology.priorityCalculated || map.methodology.ownershipSignalUsed || map.methodology.runtimePromotionAllowed) errors.push('Phase 5 boundary violated')
  for (const gap of map.gaps) {
    if (gapIds.has(gap.gapId)) errors.push(`Duplicate gapId: ${gap.gapId}`)
    gapIds.add(gap.gapId)
    if (!sourceKeys.has(gap.gapId)) errors.push(`${gap.gapId}: invalid entity/property`)
    if (!HARVEST_CATEGORIES.includes(gap.category)) errors.push(`${gap.gapId}: invalid category`)
    if (!RESOLUTION_CLASSES.includes(gap.resolutionClass)) errors.push(`${gap.gapId}: unclassified`)
    if (!familyIds.has(gap.taskFamilyId)) errors.push(`${gap.gapId}: invalid task family`)
    const actionable = ['observe', 'measure', 'experiment'].includes(gap.resolutionClass)
    if (actionable && (!gap.protocolId || !protocolIds.has(gap.protocolId))) errors.push(`${gap.gapId}: actionable gap lacks protocol`)
    if (!actionable && gap.protocolId) errors.push(`${gap.gapId}: non-measurement gap has protocol`)
    if (gap.resolutionClass === 'implementation' && gap.gapCause !== 'implementation-related') errors.push(`${gap.gapId}: implementation cause mismatch`)
    if (gap.resolutionClass === 'objective-design' && gap.gapCause !== 'objective-related') errors.push(`${gap.gapId}: objective cause mismatch`)
  }
  for (const family of map.taskFamilies) {
    if (!map.gaps.some((gap) => gap.taskFamilyId === family.id)) errors.push(`Orphan task family: ${family.id}`)
    if (family.protocolId && !protocolIds.has(family.protocolId)) errors.push(`Invalid family protocol: ${family.id}`)
    if (family.resolutionClass === 'implementation' && (!family.implementationFamily || !family.requiredEvidence || !family.affectedRuntimeSubsystem)) errors.push(`${family.id}: implementation metadata missing`)
    if (family.resolutionClass === 'objective-design' && (!family.objectiveFamily || !family.missingUserGoal || !family.requiredMetric || !family.productDecisionRequired)) errors.push(`${family.id}: objective metadata missing`)
    if (['source-extractable', 'public-research'].includes(family.resolutionClass) && (!family.researchSteps?.length || !family.researchRecordFields?.length || !family.researchCloseCondition?.length)) errors.push(`${family.id}: public research procedure missing`)
  }
  for (const protocol of protocols.filter((item) => item.resolutionClass)) {
    if (!map.gaps.some((gap) => gap.protocolId === protocol.id)) errors.push(`Orphan protocol: ${protocol.id}`)
    if (!protocol.prerequisites?.length || !protocol.setup?.length || !protocol.steps?.length) errors.push(`${protocol.id}: executable procedure missing`)
    if (!protocol.recordFields?.length) errors.push(`${protocol.id}: record fields missing`)
    if (!protocol.closeCondition?.length) errors.push(`${protocol.id}: close condition missing`)
    if (!protocol.failureModes?.length) errors.push(`${protocol.id}: failure modes missing`)
    if (!protocol.estimatedMinutes || protocol.estimatedMinutes.min <= 0 || protocol.estimatedMinutes.max < protocol.estimatedMinutes.min) errors.push(`${protocol.id}: estimated time missing`)
    if (!protocol.repetition.rule || !protocol.repetition.minimumIndependentRuns) errors.push(`${protocol.id}: repetitions missing`)
  }
  for (const override of map.manualOverrides) if (!sourceKeys.has(override.gapId) || !override.reason || !override.reviewedAt) errors.push(`Invalid manual override: ${override.gapId}`)
  return errors
}

const table = (headers: readonly string[], rows: readonly (readonly (string | number)[])[]) => [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n')
const orderedCounts = (keys: readonly string[], values: readonly string[]) => keys.map((key) => [key, values.filter((value) => value === key).length] as const)

export function renderEvidenceGapMap(map: EvidenceGapMap): string {
  const summary = summarizeEvidenceGapMap(map)
  const resolutionRows = orderedCounts(RESOLUTION_CLASSES, map.gaps.map((gap) => gap.resolutionClass))
  const matrix = HARVEST_CATEGORIES.map((category) => [category, ...RESOLUTION_CLASSES.map((resolution) => map.gaps.filter((gap) => gap.category === category && gap.resolutionClass === resolution).length)])
  const familyRows = map.taskFamilies.map((family) => { const gaps = map.gaps.filter((gap) => gap.taskFamilyId === family.id); return [family.id, gaps.length, new Set(gaps.map((gap) => gap.entity)).size, family.resolutionClass, family.protocolId ?? '—'] })
  const publicResearch = map.taskFamilies.filter((family) => ['source-extractable', 'public-research'].includes(family.resolutionClass)).map((family) => `### ${family.id}\n\n調査順:\n\n${family.researchSteps!.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n記録: ${family.researchRecordFields!.join(' / ')}\n\nClose: ${family.researchCloseCondition!.join(' / ')}`).join('\n\n')
  const implementationRows = map.taskFamilies.filter((family) => family.resolutionClass === 'implementation').map((family) => [family.id, family.requiredEvidence!, family.affectedRuntimeSubsystem!])
  const objectiveRows = map.taskFamilies.filter((family) => family.resolutionClass === 'objective-design').map((family) => [family.id, family.missingUserGoal!, family.requiredMetric!, family.productDecisionRequired!])
  return `# Evidence Gap Map\n\nGenerated from [Source Harvest](../research/source-harvest.json) by \`npm run generate:evidence-gap-map\`. Phase 5は取得方法を構造化する派生層で、Gapの削除、Priority計算、ownership signal、runtime昇格、測定結果を含みません。\n\n## Overview\n\n- Total Gap: ${summary.totalGaps.toLocaleString('en')}\n- Classified: ${summary.totalGaps - summary.unclassified} / ${summary.totalGaps}\n- Task Family: ${summary.taskFamilyCount}\n- Protocol: ${summary.protocolCount}\n- Protocol-backed actionable gaps: ${summary.protocolBackedActionableGaps} / ${summary.actionableGaps}\n- Gap / Protocol ratio: ${(summary.totalGaps / summary.protocolCount).toFixed(1)}\n- Manual override: ${map.manualOverrides.length}\n- Unclassified: ${summary.unclassified}\n\n## Resolution Class\n\n${table(['Resolution', 'Gap count'], resolutionRows)}\n\n## Category × Resolution Class\n\n${table(['Category', ...RESOLUTION_CLASSES], matrix)}\n\n## Gap Cause\n\n${table(['Gap Cause', 'Count'], Object.entries(summary.gapCauses))}\n\n## Task Family\n\n${table(['Task Family', 'Gap count', 'Entity count', 'Resolution', 'Protocol'], familyRows)}\n\n## Public Research Families\n\n${publicResearch}\n\n## Implementation Families\n\n${table(['Family', 'Required evidence / decision', 'Affected runtime subsystem'], implementationRows)}\n\n## Objective-design Families\n\n${table(['Family', 'Missing user goal', 'Required metric', 'Product decision'], objectiveRows)}\n\n## Acquisition Cost\n\n${table(['Cost', 'Count'], Object.entries(summary.acquisitionCosts))}\n\n## Runtime Relevance\n\n${table(['Relevance', 'Count'], Object.entries(summary.runtimeRelevance))}\n\n## Unlock Effect\n\n${table(['Unlock effect', 'Count'], Object.entries(summary.unlockEffects))}\n\n## Classification policy\n\n- \`source-missing\`でも既存attemptに\`value-found\`がある63件は、未採用・未正規化を再確認する\`source-extractable\`へ分離します。\n- \`requires-game-observation\`は画面確認、時間計測、条件比較の必要性から\`observe / measure / experiment\`へ分けます。\n- \`likely-requires-experiment\`も、単純な時間計測でcloseできるArtifact Gapは\`measure\`へ落とします。\n- implementation / objective-design familyは必要Evidence・影響subsystemまたは不足する目的・metricを保持し、Measurement Protocolを付けません。\n- 例外は\`manualOverrides\`へ理由とreviewedAtを残します。現在はルールだけで全件分類できるため0件です。\n\n## Phase 6 handoff\n\n各Gapの\`runtimeRelevance\`、\`unlockEffect\`、\`acquisitionCost\`をread modelとして提供します。rank sensitivity、所持・利用signal、Priority scoreは未計算です。\n`
}

export function renderPhase5ProtocolReport(protocols: readonly MeasurementProtocol[]): string {
  const phase5 = protocols.filter((protocol) => protocol.resolutionClass)
  const bullets = (lines: readonly string[]) => lines.map((line) => `- ${line}`).join('\n')
  return `# Phase 5 Measurement Protocols\n\n[構造化protocol](../research/workflow/measurement-protocols.json) / [Gap Map](evidence-gap-map.md)\n\nゲーム内で結果を集める前の再利用可能な手順です。各protocolはbaseline、必要なvariant、反復、記録項目、close条件を定義し、結果やruntime昇格を含みません。\n\n${phase5.map((p) => {
    const controlSteps = p.controls?.map((line, index) => `${p.steps!.length + index + 1}. Control: ${line}`).join('\n') ?? ''
    const hypothesis = p.hypothesis?.length ? `\n\n### 仮説\n\n${bullets(p.hypothesis)}` : ''
    const legacy = p.legacyProtocolIds?.length ? `\n\n既存protocolの再利用: ${p.legacyProtocolIds.join(', ')} をcanonical手順へ統合。旧IDはmappingとして保持します。` : ''
    return `## ${p.id} — ${p.title}\n\n**何を調べる？** ${p.targetMechanic}\n\n**なぜ必要？** ${p.purpose}\n\n**対象:** ${p.appliesTo!.categories.join(' / ')} — ${p.appliesTo!.properties.join(', ')}\n\n**所要時間:** ${p.estimatedMinutes!.min}〜${p.estimatedMinutes!.max}分\n\n### 必要な装備\n\n${bullets(p.prerequisites!)}\n\n### 準備\n\n${bullets(p.setup!)}\n\n### 手順\n\n${p.steps!.map((line, index) => `${index + 1}. ${line}`).join('\n')}\n${controlSteps}\n\n### 記録項目\n\n${bullets([...p.recordFields!, ...p.submissionMetadata])}\n\n### 必要回数\n\n${p.repetition.rule}\n\n### 成功条件\n\n${bullets(p.closeCondition!)}\n\n### 失敗しやすい点\n\n${bullets(p.failureModes!)}${hypothesis}${legacy}`
  }).join('\n\n')}\n`
}
