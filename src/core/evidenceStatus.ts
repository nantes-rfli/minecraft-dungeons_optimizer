import { ATTACK_PROFILES } from '../data/attackProfiles'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'
import { armorNumericEvidenceRows } from './armorEvidence'
import { ENCHANTMENTS } from '../data/enchantments'
import { CROSS_WEAPON_DAMAGE_SCALING, GEAR_POWER_CURVE } from '../data/powerScaling'
import { RANGED_ENCHANTMENTS } from '../data/ranged'
import { WEAPONS } from '../data/weapons'
import type { Build, Confidence, Evidence, Scenario } from './types'

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

function evidenceStatusForSource(evidence: Evidence<unknown>): EvidenceStatus {
  if (evidence.source.kind === 'model-assumption') return 'estimated'
  if (evidence.source.kind === 'frame-analysis' || evidence.source.kind === 'community-test') return 'measured'
  // Reaching this function means the parameter has its own Evidence<T> record.
  // The status is derived from that explicit source, never from runtime support.
  return 'derived'
}

function fromEvidence(mechanicId: string, parameterId: string, label: string, evidence: Evidence<unknown>, status = evidenceStatusForSource(evidence)): ParameterEvidence {
  return {
    mechanicId, parameterId, label, status,
    basis: evidence.note ? `${evidence.source.label} — ${evidence.note}` : evidence.source.label,
    conditions: '登録sourceが示すparameterの範囲に限定。Runtime support levelからは分類しない。',
    gameVersion: evidence.source.label.includes('1.17') ? '1.17.0.0' : 'source version; applicability requires review',
    confidence: evidence.confidence,
  }
}

function unclassified(mechanicId: string, parameterId: string, label: string, basis = 'parameter単位の再評価済みEvidenceが未登録。'): ParameterEvidence {
  return { mechanicId, parameterId, label, status: 'unclassified', basis, conditions: '数値評価へ投入しない。', gameVersion: 'unknown', confidence: 'low' }
}

const sharedWeaponEvidence: readonly ParameterEvidence[] = [
  fromEvidence('melee:shared', 'gear-power-curve', '近接共通 / Gear Power曲線', GEAR_POWER_CURVE),
  fromEvidence('melee:shared', 'cross-weapon-damage-scaling', '近接共通 / 武器間damage scaling', CROSS_WEAPON_DAMAGE_SCALING),
]

const weaponEvidence = Object.values(WEAPONS).flatMap((weapon): readonly ParameterEvidence[] => {
  const mechanicId = `melee:${weapon.id}`
  const profile = ATTACK_PROFILES[weapon.id]
  return [
    fromEvidence(mechanicId, 'internal-power-rating', `${weapon.name.ja} / internal Power`, weapon.internalPowerRating),
    fromEvidence(mechanicId, 'area-rating', `${weapon.name.ja} / area`, weapon.area),
    fromEvidence(mechanicId, 'attack-timing', `${weapon.name.ja} / attack timing`, profile),
    fromEvidence(mechanicId, 'hit-sequence', `${weapon.name.ja} / hit sequence`, profile),
    fromEvidence(mechanicId, 'base-soul-gathering', `${weapon.name.ja} / base soul gathering`, weapon.soul.baseSoulGathering),
  ]
})

const camelToKebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const enchantmentEvidence = Object.values(ENCHANTMENTS).flatMap((enchantment): readonly ParameterEvidence[] => {
  const mechanicId = `melee-enchantment:${enchantment.id}`
  const tierParameterIds = new Set(Object.values(enchantment.tiers.value).flatMap((tier) => Object.keys(tier).map(camelToKebab)))
  return [
    ...[...tierParameterIds].map((parameterId) => fromEvidence(mechanicId, parameterId, `${enchantment.name.ja} / ${parameterId}`, enchantment.tiers)),
    fromEvidence(mechanicId, 'stacking-interaction', `${enchantment.name.ja} / stacking`, enchantment.stacking),
    ...(enchantment.applicability ? [fromEvidence(mechanicId, 'applicability', `${enchantment.name.ja} / applicability`, enchantment.applicability)] : []),
    ...(enchantment.soul ? [fromEvidence(mechanicId, 'soul-gathering', `${enchantment.name.ja} / soul gathering`, enchantment.soul.soulGathering)] : []),
  ]
})

const armorEvidence = Object.values(ARMORS).flatMap((armor): readonly ParameterEvidence[] =>
  armorNumericEvidenceRows(armor).map(({ parameterId, binding }): ParameterEvidence => {
    const mechanicId = `armor:${armor.id}`
    const label = `${armor.name.ja} / ${parameterId}`
    if (!binding) return unclassified(mechanicId, parameterId, label, 'runtime数値は登録済みだが、独立したsource-bound parameter Evidence宣言がないか値・意味がdrift。')
    return {
      mechanicId, parameterId, label, status: binding.status,
      basis: `research/armor-audit.json: ${binding.sourceId} / ${binding.propertyKind}「${binding.propertyRaw}」`,
      conditions: binding.conditions, gameVersion: binding.gameVersion, confidence: 'medium',
    }
  }),
)

const armorEnchantmentEvidence = Object.values(ARMOR_ENCHANTMENTS).flatMap((enchantment): readonly ParameterEvidence[] => [
  { mechanicId: `armor-enchantment:${enchantment.id}`, parameterId: 'tier-values', label: `${enchantment.name.ja} / tier values`, status: 'derived', basis: `Armor Enchantment auditで${enchantment.effect}のtier値を個別採用。`, conditions: 'runtimeMaxCopies=1の実装範囲。', gameVersion: '1.17.0.0', confidence: 'medium' },
  { mechanicId: `armor-enchantment:${enchantment.id}`, parameterId: 'stacking-interaction', label: `${enchantment.name.ja} / stacking`, status: 'unclassified', basis: '複数copyのinteractionは未再評価。', conditions: '複数copyを数値評価へ投入しない。', gameVersion: 'unknown', confidence: 'low' },
])

const rangedEnchantmentEvidence = Object.entries(RANGED_ENCHANTMENTS).flatMap(([id, enchantment]): readonly ParameterEvidence[] => [
  { mechanicId: `ranged-enchantment:${id}`, parameterId: 'tier-values', label: `${enchantment.name.ja} / tier values`, status: 'derived', basis: `${enchantment.sourceUrl}の公開tier値を個別に正規化。`, conditions: 'neutral single-projectile runtime scope。', gameVersion: 'source version; applicability requires review', confidence: 'medium' },
  { mechanicId: `ranged-enchantment:${id}`, parameterId: 'effect-semantics', label: `${enchantment.name.ja} / effect semantics`, status: 'derived', basis: `${enchantment.sourceUrl}の効果記述を${enchantment.kind}として個別に正規化。`, conditions: 'neutral single-projectile runtime scope。', gameVersion: 'source version; applicability requires review', confidence: 'medium' },
])

export const ESTIMATED_PARAMETER_EVIDENCE: readonly ParameterEvidence[] = [
  { mechanicId: 'death-cap-mushroom', parameterId: 'duration-curve', label: 'シロタマゴテングタケ / 効果時間', status: 'estimated', basis: '公開サンプルに対する線形近似（8 + 0.052 × Power）', conditions: 'Powerごとの実測曲線が揃うまでの近似。外部クールダウン短縮は別計算。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'medium' },
  { mechanicId: 'death-cap-mushroom', parameterId: 'duplicate-stacking', label: 'シロタマゴテングタケ / 複数個の更新挙動', status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化', conditions: '最大3個、効果量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low' },
  { mechanicId: 'iron-hide-amulet', parameterId: 'duration-curve', label: 'アイアンハイドアミュレット / 効果時間', status: 'estimated', basis: '公開durationサンプルに対する線形近似（8 + 0.052 × Power）', conditions: 'Powerごとの実測曲線が揃うまでの近似。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'low' },
  { mechanicId: 'iron-hide-amulet', parameterId: 'duplicate-stacking', label: 'アイアンハイドアミュレット / 複数個の更新挙動', status: 'estimated', basis: '公開コミュニティ記述からrefreshとしてモデル化', conditions: '最大3個、軽減量は重複せず、時間だけをずらして更新する想定。', gameVersion: 'unknown', confidence: 'low' },
  { mechanicId: 'melee-enchantment:guarding-strike', parameterId: 'activation-coverage-model', label: 'ガードストライク / activation coverage', status: 'estimated', basis: 'direct kill rateと効果時間から期待coverageを近似。', conditions: 'proc chance・cooldown・current-version interactionの独立検証前。', gameVersion: '1.17.0.0 applicability not independently verified', confidence: 'low' },
]

const artifactEvidence: readonly ParameterEvidence[] = [
  ...ESTIMATED_PARAMETER_EVIDENCE.filter((item) => item.mechanicId === 'death-cap-mushroom' || item.mechanicId === 'iron-hide-amulet'),
  { mechanicId: 'death-cap-mushroom', parameterId: 'attack-speed-bonus', label: 'シロタマゴテングタケ / attack speed', status: 'measured', basis: 'Minecraft Wikiのcommunity test記録。', conditions: '自己attack speed効果。', gameVersion: 'source version; applicability requires review', confidence: 'high' },
  { mechanicId: 'iron-hide-amulet', parameterId: 'damage-reduction', label: 'アイアンハイドアミュレット / damage reduction', status: 'measured', basis: 'Minecraft Wikiのcommunity test記録。', conditions: '自己damage reduction効果。', gameVersion: 'source version; applicability requires review', confidence: 'medium' },
  { mechanicId: 'shock-powder', parameterId: 'duration-curve', label: 'ショックパウダー / duration', status: 'derived', basis: '公開されたPower別duration表を範囲内補間。', conditions: 'Power 12〜262のみ。', gameVersion: 'source version; applicability requires review', confidence: 'medium' },
  unclassified('shock-powder', 'stacking-interaction', 'ショックパウダー / stacking', '重複時のrefresh / overlap挙動が未解決。'),
]

export const PARAMETER_EVIDENCE: readonly ParameterEvidence[] = [
  ...sharedWeaponEvidence, ...weaponEvidence, ...enchantmentEvidence,
  ...ESTIMATED_PARAMETER_EVIDENCE.filter((item) => item.mechanicId.startsWith('melee-enchantment:')),
  ...armorEvidence, ...armorEnchantmentEvidence, ...rangedEnchantmentEvidence, ...artifactEvidence,
]

function evidenceForMechanic(mechanicId: string): readonly ParameterEvidence[] {
  const registered = PARAMETER_EVIDENCE.filter((parameter) => parameter.mechanicId === mechanicId)
  return registered.length ? registered : [unclassified(mechanicId, 'runtime-parameters', mechanicId)]
}

const isDuplicateInteractionParameter = (parameter: ParameterEvidence) => parameter.parameterId === 'stacking-interaction' || parameter.parameterId === 'duplicate-stacking'

export function evidencePolicy(scenario: Scenario): EvidencePolicy { return scenario.evidencePolicy ?? 'include-estimated' }

function uniqueParameterEvidence(parameters: readonly ParameterEvidence[]): readonly ParameterEvidence[] {
  const seen = new Set<string>()
  return parameters.filter((parameter) => {
    const key = `${parameter.mechanicId}/${parameter.parameterId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parameterEvidenceForBuild(build: Build): readonly ParameterEvidence[] {
  const weaponParameters = build.weapon.observedDamagePerHit === undefined
    ? sharedWeaponEvidence
    : [{ mechanicId: 'melee:observed-input', parameterId: 'damage-per-hit', label: '入力済み表示damage', status: 'measured', basis: '利用者が実物から入力した観測値。', conditions: '登録した個体とPowerに限定。', gameVersion: 'user supplied', confidence: 'medium' } satisfies ParameterEvidence]
  return uniqueParameterEvidence([
    ...weaponParameters,
    ...evidenceForMechanic(`melee:${build.weapon.weaponId}`),
    ...build.enchantments.flatMap((item) => evidenceForMechanic(`melee-enchantment:${item.enchantmentId}`)),
    ...(build.armor ? evidenceForMechanic(`armor:${build.armor.armorId}`) : []),
    ...(build.armorEnchantments ?? []).flatMap((item, _, items) => evidenceForMechanic(`armor-enchantment:${item.enchantmentId}`).filter((parameter) => parameter.parameterId !== 'stacking-interaction' || items.filter((candidate) => candidate.enchantmentId === item.enchantmentId).length > 1)),
    ...(build.rangedWeapon ? [
      { mechanicId: `ranged:${build.rangedWeapon.weaponId}`, parameterId: 'projectile-damage', label: '遠距離 / projectile damage', status: build.rangedWeapon.observation ? 'measured' : 'unclassified', basis: build.rangedWeapon.observation?.sourceNote ?? '利用者観測値が未登録。', conditions: 'neutral single projectile', gameVersion: build.rangedWeapon.observation?.gameVersion ?? 'unknown', confidence: build.rangedWeapon.observation ? 'medium' : 'low' },
      { mechanicId: `ranged:${build.rangedWeapon.weaponId}`, parameterId: 'shot-cycle', label: '遠距離 / shot cycle', status: build.rangedWeapon.observation ? 'measured' : 'unclassified', basis: build.rangedWeapon.observation?.sourceNote ?? '利用者観測値が未登録。', conditions: 'complete shot cycle', gameVersion: build.rangedWeapon.observation?.gameVersion ?? 'unknown', confidence: build.rangedWeapon.observation ? 'medium' : 'low' },
    ] as ParameterEvidence[] : []),
    ...(build.rangedEnchantments ?? []).flatMap((item) => evidenceForMechanic(`ranged-enchantment:${item.enchantmentId}`)),
    ...build.artifacts.flatMap((item, _, items) => evidenceForMechanic(item.artifactId).filter((parameter) => !isDuplicateInteractionParameter(parameter) || items.filter((candidate) => candidate.artifactId === item.artifactId).length > 1)),
  ])
}

export function blockedParameterEvidenceForBuild(build: Build, policy: EvidencePolicy): readonly ParameterEvidence[] { return parameterEvidenceForBuild(build).filter((parameter) => !isEvidenceStatusAllowed(parameter.status, policy)) }

export function estimatedParametersForBuild(build: Build): readonly ParameterEvidence[] { return parameterEvidenceForBuild(build).filter((parameter) => parameter.status === 'estimated') }

export function artifactEvidenceAllowed(artifactId: Build['artifacts'][number]['artifactId'], policy: EvidencePolicy): boolean { return evidenceForMechanic(artifactId).filter((parameter) => !isDuplicateInteractionParameter(parameter)).every((parameter) => isEvidenceStatusAllowed(parameter.status, policy)) }
