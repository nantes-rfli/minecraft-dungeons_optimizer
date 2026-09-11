import type { Build, Confidence, Scenario } from './types'

export const EVIDENCE_STATUSES = ['verified', 'measured', 'derived', 'estimated', 'unknown', 'unclassified'] as const
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

export const HIGH_CONFIDENCE_EVIDENCE_STATUSES: readonly EvidenceStatus[] = ['verified', 'measured', 'derived']

export function isEvidenceStatusAllowed(status: EvidenceStatus, policy: EvidencePolicy): boolean {
  if (HIGH_CONFIDENCE_EVIDENCE_STATUSES.includes(status)) return true
  return policy === 'include-estimated' && status === 'estimated'
}

const derived = (mechanicId: string, parameterId: string, label = mechanicId): ParameterEvidence => ({
  mechanicId, parameterId, label, status: 'derived',
  basis: '版付きの監査資料とruntime定義から導出した実装値。Runtime support levelとは独立に分類。',
  conditions: '現在のOptimizerが明示的に対応するmechanic境界内。',
  gameVersion: '1.17.0.0', confidence: 'medium',
})

const runtimeParameterGroups: readonly ParameterEvidence[] = [
  ...(['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe'] as const).map((id) => derived(`melee:${id}`, 'damage-and-attack-profile')),
  ...(['critical-hit', 'radiance', 'leeching', 'void-strike', 'guarding-strike', 'sharpness', 'unchanting', 'refreshment', 'weakening', 'shockwave', 'swirling', 'thundering', 'ambush', 'smiting', 'committed', 'artifact-synergy', 'rampaging', 'anima-conduit', 'soul-siphon', 'fire-aspect', 'poison-cloud', 'exploding', 'chains', 'stunning', 'freezing', 'gravity', 'pain-cycle', 'dynamo'] as const).map((id) => derived(`melee-enchantment:${id}`, 'tier-values-and-runtime-semantics')),
  ...(['battle-robe', 'renegade-armor', 'wither-armor', 'mercenary-armor', 'grim-armor', 'scale-mail', 'spider-armor'] as const).map((id) => derived(`armor:${id}`, 'intrinsic-runtime-parameters')),
  ...(['cool-down', 'potion-barrier', 'chilling', 'health-synergy', 'snowball', 'cowardice', 'protection'] as const).map((id) => derived(`armor-enchantment:${id}`, 'tier-values-and-runtime-semantics')),
  ...(['bow', 'crossbow'] as const).map((id) => derived(`ranged:${id}`, 'observed-shot-input-and-runtime-semantics')),
  ...(['power', 'critical-hit', 'unchanting'] as const).map((id) => derived(`ranged-enchantment:${id}`, 'tier-values-and-runtime-semantics')),
  derived('shock-powder', 'duration-and-control-model', 'ショックパウダー / 効果時間とControl'),
  derived('death-cap-mushroom', 'attack-speed-and-damage-bonus', 'シロタマゴテングタケ / 効果量'),
  derived('iron-hide-amulet', 'damage-reduction', 'アイアンハイドアミュレット / 軽減量'),
]

export const ESTIMATED_PARAMETER_EVIDENCE: readonly ParameterEvidence[] = [
  { mechanicId: 'death-cap-mushroom', parameterId: 'duration-curve', label: 'シロタマゴテングタケ / 効果時間', status: 'estimated', basis: '公開サンプルに対する線形近似（8 + 0.052 × Power）', conditions: 'Powerごとの実測曲線が揃うまでの近似。外部クールダウン短縮は別計算。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'medium' },
  { mechanicId: 'death-cap-mushroom', parameterId: 'duplicate-stacking', label: 'シロタマゴテングタケ / 複数個の更新挙動', status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化', conditions: '最大3個、効果量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low' },
  { mechanicId: 'iron-hide-amulet', parameterId: 'duration-curve', label: 'アイアンハイドアミュレット / 効果時間', status: 'estimated', basis: '公開durationサンプルに対する線形近似（8 + 0.052 × Power）', conditions: 'Powerごとの実測曲線が揃うまでの近似。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'low' },
  { mechanicId: 'iron-hide-amulet', parameterId: 'duplicate-stacking', label: 'アイアンハイドアミュレット / 複数個の更新挙動', status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化', conditions: '最大3個、軽減量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low' },
]

export const PARAMETER_EVIDENCE: readonly ParameterEvidence[] = [...runtimeParameterGroups, ...ESTIMATED_PARAMETER_EVIDENCE]

const unclassified = (mechanicId: string): ParameterEvidence => ({ mechanicId, parameterId: 'runtime-parameters', label: mechanicId, status: 'unclassified', basis: 'parameter単位のEvidence分類が未登録。', conditions: '数値評価へ投入しない。', gameVersion: 'unknown', confidence: 'low' })

function evidenceForMechanic(mechanicId: string): readonly ParameterEvidence[] {
  const registered = PARAMETER_EVIDENCE.filter((parameter) => parameter.mechanicId === mechanicId)
  return registered.length ? registered : [unclassified(mechanicId)]
}

export function evidencePolicy(scenario: Scenario): EvidencePolicy { return scenario.evidencePolicy ?? 'include-estimated' }

export function parameterEvidenceForBuild(build: Build): readonly ParameterEvidence[] {
  return [
    ...evidenceForMechanic(`melee:${build.weapon.weaponId}`),
    ...build.enchantments.flatMap((item) => evidenceForMechanic(`melee-enchantment:${item.enchantmentId}`)),
    ...(build.armor ? evidenceForMechanic(`armor:${build.armor.armorId}`) : []),
    ...(build.armorEnchantments ?? []).flatMap((item) => evidenceForMechanic(`armor-enchantment:${item.enchantmentId}`)),
    ...(build.rangedWeapon ? evidenceForMechanic(`ranged:${build.rangedWeapon.weaponId}`) : []),
    ...(build.rangedEnchantments ?? []).flatMap((item) => evidenceForMechanic(`ranged-enchantment:${item.enchantmentId}`)),
    ...build.artifacts.flatMap((item) => evidenceForMechanic(item.artifactId)),
  ]
}

export function blockedParameterEvidenceForBuild(build: Build, policy: EvidencePolicy): readonly ParameterEvidence[] { return parameterEvidenceForBuild(build).filter((parameter) => !isEvidenceStatusAllowed(parameter.status, policy)) }

export function estimatedParametersForBuild(build: Pick<Build, 'artifacts'>): readonly ParameterEvidence[] {
  const artifactIds = new Set(build.artifacts.map((artifact) => artifact.artifactId))
  return ESTIMATED_PARAMETER_EVIDENCE.filter((parameter) => artifactIds.has(parameter.mechanicId as Build['artifacts'][number]['artifactId']))
}

export function artifactEvidenceAllowed(artifactId: Build['artifacts'][number]['artifactId'], policy: EvidencePolicy): boolean { return evidenceForMechanic(artifactId).every((parameter) => isEvidenceStatusAllowed(parameter.status, policy)) }
