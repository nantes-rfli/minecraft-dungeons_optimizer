import type { Build, Confidence, Scenario } from './types'

export const EVIDENCE_STATUSES = ['verified', 'measured', 'derived', 'estimated', 'unknown'] as const
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]
export type EvidencePolicy = 'high-confidence-only' | 'include-estimated'

export interface ParameterEvidence {
  readonly mechanicId: string
  readonly parameterId: string
  readonly label: string
  readonly status: EvidenceStatus
  readonly basis: string
  readonly conditions: string
  readonly gameVersion: string
  readonly confidence: Confidence
}

export const ESTIMATED_PARAMETER_EVIDENCE: readonly ParameterEvidence[] = [
  {
    mechanicId: 'death-cap-mushroom', parameterId: 'duration-curve', label: 'シロタマゴテングタケ / 効果時間',
    status: 'estimated', basis: '公開サンプルに対する線形近似（8 + 0.052 × Power）',
    conditions: 'Powerごとの実測曲線が揃うまでの近似。外部クールダウン短縮は別計算。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'medium',
  },
  {
    mechanicId: 'death-cap-mushroom', parameterId: 'duplicate-stacking', label: 'シロタマゴテングタケ / 複数個の更新挙動',
    status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化',
    conditions: '最大3個、効果量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low',
  },
  {
    mechanicId: 'iron-hide-amulet', parameterId: 'duration-curve', label: 'アイアンハイドアミュレット / 効果時間',
    status: 'estimated', basis: '公開durationサンプルに対する線形近似（8 + 0.052 × Power）',
    conditions: 'Powerごとの実測曲線が揃うまでの近似。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'low',
  },
  {
    mechanicId: 'iron-hide-amulet', parameterId: 'duplicate-stacking', label: 'アイアンハイドアミュレット / 複数個の更新挙動',
    status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化',
    conditions: '最大3個、軽減量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low',
  },
]

export function evidencePolicy(scenario: Scenario): EvidencePolicy {
  return scenario.evidencePolicy ?? 'include-estimated'
}

export function estimatedParametersForBuild(build: Pick<Build, 'artifacts'>): readonly ParameterEvidence[] {
  const artifactIds = new Set(build.artifacts.map((artifact) => artifact.artifactId))
  return ESTIMATED_PARAMETER_EVIDENCE.filter((parameter) => artifactIds.has(parameter.mechanicId as Build['artifacts'][number]['artifactId']))
}

export function artifactUsesEstimatedParameters(artifactId: Build['artifacts'][number]['artifactId']): boolean {
  return ESTIMATED_PARAMETER_EVIDENCE.some((parameter) => parameter.mechanicId === artifactId)
}
