export type RoadmapTrackId = 'research' | 'product'
export type RoadmapWorkStatus = 'done' | 'current' | 'next' | 'blocked' | 'later'

export interface RoadmapWorkUnit {
  readonly id: string
  readonly track: RoadmapTrackId
  readonly title: string
  readonly status: RoadmapWorkStatus
  readonly goal: string
  readonly dependsOn?: readonly string[]
  readonly unlocks?: readonly string[]
  readonly dependencyCondition?: string
  readonly completionCriteria: string
  readonly nextAction?: string
}

export interface FutureCandidate {
  readonly id: string
  readonly title: string
  readonly goal: string
}

export const ROADMAP_TRACKS: Readonly<Record<RoadmapTrackId, { readonly title: string; readonly goal: string }>> = {
  research: {
    title: 'Research Track',
    goal: 'Optimizerが使用するparameter / mechanicの根拠を取得・検証し、採用判断可能な状態にする。Runtime実装そのものはこのTrackの完了条件に含めない。',
  },
  product: {
    title: 'Product Track',
    goal: '現在利用可能なEvidenceを安全な境界で製品へ反映し、coverage・推薦品質・説明・UXを改善する。Research全体の完了を待たず、eligibleな単位だけを扱う。',
  },
}

export const ROADMAP_WORK_UNITS: readonly RoadmapWorkUnit[] = [
  {
    id: 'R1',
    track: 'research',
    title: 'Research Infrastructure',
    status: 'done',
    goal: 'Source Harvest、Gap Map、Priority、game-file artifact、Research Quest、Evidence Repository、validation / auditを再現可能にする。',
    unlocks: ['R2', 'R3'],
    completionCriteria: 'checked-in artifactから監査を再実行でき、raw traceとadoption decisionをruntimeから分離できる。',
  },
  {
    id: 'R2',
    track: 'research',
    title: 'Evidence Acquisition',
    status: 'current',
    goal: 'Personal Research Quest、独立raw trace、Measure / Experimentを優先度順に取得する。',
    dependsOn: ['R1'],
    unlocks: ['R3'],
    completionCriteria: '対象parameterごとにversion・conditions・unit・run identityを備えた独立Evidenceを保存できる。',
    nextAction: 'Limited DRの8条件を別runとして取得する。',
  },
  {
    id: 'R3',
    track: 'research',
    title: 'Evidence Validation / Adoption',
    status: 'next',
    goal: '取得済みEvidenceをsemantic / version / conflict / holdout gateで評価し、parameter単位のAdoptionDecisionを確定する。',
    dependsOn: ['R2'],
    dependencyCondition: '対象parameter / mechanicについて独立Evidenceが取得済み',
    unlocks: ['P3B'],
    completionCriteria: 'accepted / rejected / heldと理由が再現可能で、未検証値を昇格対象にしない。',
  },
  {
    id: 'R3B',
    track: 'research',
    title: 'Limited DR Adoption Decision',
    status: 'blocked',
    goal: '固定済みの独立holdout gateでLimited DRの採用可否を判断する。',
    dependsOn: ['R2'],
    unlocks: ['P3B'],
    completionCriteria: '1.17.0.0、同一incoming hit、全8条件、3独立run×各10 hit以上を取得し、gateを変えず再監査できる。',
    nextAction: '独立raw traceの取得を待つ。',
  },
  {
    id: 'R4',
    track: 'research',
    title: 'Targeted Deep Research',
    status: 'later',
    goal: '外部観測でも解けないruntime-relevantな問いに限りnative計算・effective timingを追加調査する。',
    dependsOn: ['R2', 'R3'],
    dependencyCondition: 'R2 / R3で追加のnative調査が必要と判断された対象に限る',
    completionCriteria: '対象の問い、停止条件、runtime relevanceを先に固定し、推測値を生成せず結論を記録する。',
  },
  {
    id: 'R5',
    track: 'research',
    title: 'Evidence Maintenance / Version Drift',
    status: 'later',
    goal: 'source revision、game version、conflict、採用済みEvidenceのdriftを追跡する。',
    dependsOn: ['R1'],
    completionCriteria: 'drift検出と再検証条件がparameter単位で記録される。',
  },
  {
    id: 'P1',
    track: 'product',
    title: 'Catalog / Inventory Foundation',
    status: 'done',
    goal: 'runtime未対応の監査済み装備を所持品とResearch対象として保持し、Optimizer候補へ混ぜない。',
    unlocks: ['P2', 'P4'],
    completionCriteria: '保存・JSON移行・装備カテゴリ入力が既存回帰を維持する。',
  },
  {
    id: 'P2',
    track: 'product',
    title: 'Evidence-aware Runtime Boundary',
    status: 'done',
    goal: 'Full / Limited / Research-onlyとEvidence Statusを分離し、Unknown / Estimatedを0や1へ代替しない。',
    dependsOn: ['P1'],
    unlocks: ['P3'],
    completionCriteria: '利用者がEvidence適用方針と制限理由を確認できる。',
  },
  {
    id: 'P3',
    track: 'product',
    title: 'Runtime Promotion Pipeline Foundation',
    status: 'done',
    goal: 'parameter単位のeligibility、manifest更新、説明、coverage、regressionを一つの反復可能な変更として扱う。',
    dependsOn: ['P2'],
    unlocks: ['P3B', 'P4'],
    completionCriteria: '未検証値を昇格せず、対象0件を表現し、最初のeligible単位にatomic bundleと内容hashを必須化して安全に受け入れられる。',
  },
  {
    id: 'P3B',
    track: 'product',
    title: 'First Eligible Runtime Promotion',
    status: 'blocked',
    goal: 'R3でacceptedになった最初の1 parameter / mechanicをEnd-to-Endで昇格し、reference implementationにする。',
    dependsOn: ['P3', 'R3'],
    dependencyCondition: '対象parameter / mechanicがR3でaccepted',
    unlocks: ['P4'],
    completionCriteria: '同一変更でruntime、manifest、説明、coverage、regressionが同期し、既存挙動を保護する。',
    nextAction: 'eligible targetなし。P3の基盤整備を継続し、acceptedな対象を待つ。',
  },
  {
    id: 'P4',
    track: 'product',
    title: 'Runtime Coverage Expansion',
    status: 'next',
    goal: 'P3Bを通過した小さい単位ごとにruntime coverageを拡張する。巨大な全装備Promotion Phaseは作らない。',
    dependsOn: ['P3B'],
    dependencyCondition: '対象単位についてP3BのEnd-to-End promotion reference implementationが成立済み',
    completionCriteria: '追加単位ごとにsupport boundaryとregressionが明示され、Research-onlyを0点候補へ混ぜない。',
  },
  {
    id: 'P5',
    track: 'product',
    title: 'Recommendation / Optimizer Quality',
    status: 'current',
    goal: 'available runtime scope内でobjective、scoring、推薦品質、説明を改善する。Researchやruntime coverage全体の完了は待たない。',
    dependsOn: ['P2'],
    completionCriteria: '変更した目的・順位・説明を代表fixtureと回帰で検証でき、現在の対応範囲だけでも利用者の装備判断が改善する。',
    nextAction: '現行Full / Limited範囲で、比較・推薦・残す価値の判断を妨げる最大の不足を再評価し、最小の検証可能な改善を選ぶ。',
  },
  {
    id: 'P6',
    track: 'product',
    title: 'Product UX / Public-use Readiness',
    status: 'later',
    goal: 'Inventory workflow、UX、performance、regression、本人実利用での有用性を継続改善する。',
    dependsOn: ['P1', 'P2'],
    completionCriteria: '主要フローがaccessibility・performance・E2E基準を満たし、公開判断は別途明示される。',
  },
] as const

export const FUTURE_CANDIDATES: readonly FutureCandidate[] = [
  { id: 'generalization', title: 'Optimizer Engine Generalization', goal: 'Dungeons 1で実証後、必要になった境界だけを段階的に分離する。' },
  { id: 'new-drop-comparison', title: 'New Drop Comparison / Keep-Salvage', goal: '新しく拾った装備を仮追加し、現在Bestとの差と残す価値を判断する。' },
  { id: 'public-availability', title: 'Public Availability', goal: '本人実利用でCoverageとUXが十分に有用だと確認できた時点で再判断する。' },
  { id: 'future-games', title: 'Minecraft Dungeons II / other future game support', goal: '新しいゲーム要件が具体化した時点でResearchまたはProductへ正式移行する。' },
] as const

export const ROADMAP_STATUS_ORDER: readonly RoadmapWorkStatus[] = ['done', 'current', 'next', 'blocked', 'later']

const ROADMAP_TRACK_IDS = new Set<string>(['research', 'product'])
const ROADMAP_STATUS_IDS = new Set<string>(ROADMAP_STATUS_ORDER)

export function collectRoadmapWorkUnitErrors(workUnits: readonly RoadmapWorkUnit[]): string[] {
  const errors: string[] = []
  const ids = workUnits.map((unit) => unit.id)
  const knownIds = new Set(ids)

  if (!workUnits.length) errors.push('Roadmap work units must not be empty')
  if (ids.some((id) => !id.trim())) errors.push('Roadmap work unit IDs must be present')
  if (knownIds.size !== ids.length) errors.push('Roadmap work unit IDs must be unique')

  for (const unit of workUnits) {
    const unitId = unit.id || '(missing ID)'
    if (!ROADMAP_TRACK_IDS.has(unit.track)) errors.push(`${unitId}: invalid roadmap track`)
    if (!ROADMAP_STATUS_IDS.has(unit.status)) errors.push(`${unitId}: invalid roadmap status`)
    if (!unit.completionCriteria?.trim()) errors.push(`${unitId}: missing completion criteria`)

    for (const [references, label] of [[unit.dependsOn, 'dependency'], [unit.unlocks, 'unlock']] as const) {
      if (!references) continue
      const seen = new Set<string>()
      for (const reference of references) {
        if (seen.has(reference)) errors.push(`${unitId}: duplicate ${label} ${reference}`)
        seen.add(reference)
        if (reference === unit.id) errors.push(`${unitId}: self-reference in ${label}`)
        else if (!knownIds.has(reference)) errors.push(`${unitId}: unknown ${label} ${reference}`)
      }
    }
  }

  return errors
}

export function workUnitsForTrack(track: RoadmapTrackId): readonly RoadmapWorkUnit[] {
  return ROADMAP_WORK_UNITS.filter((unit) => unit.track === track)
}
