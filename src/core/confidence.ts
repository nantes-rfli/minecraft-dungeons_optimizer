import { MODEL } from '../data/model'
import { DEFAULT_SCENARIO_EVIDENCE } from '../data/scenarios'
import { VOID_STRIKE_CURVE } from '../data/voidStrike'
import {
  getArtifactDefinition,
  getAttackProfile,
  getEnchantmentDefinition,
  getWeaponDefinition,
} from './catalog'
import { enchantmentsById, hasEnchantment } from './enchantment'
import type {
  ArtifactId,
  Build,
  Confidence,
  ConfidenceFactor,
  ConfidenceSummary,
  Evidence,
  Scenario,
} from './types'

const CONFIDENCE_SCORE: Readonly<Record<Confidence, number>> = {
  high: 0.9,
  medium: 0.65,
  low: 0.35,
}

export function summarizeConfidence(build: Build, scenario: Scenario): ConfidenceSummary {
  const factors: ConfidenceFactor[] = []
  const caveats: string[] = []
  const add = (
    id: string,
    label: string,
    confidence: Confidence,
    weight = 1,
  ) => factors.push({ id, label, confidence, weight })
  const addEvidence = (
    id: string,
    label: string,
    evidence: Pick<Evidence<unknown>, 'confidence'>,
    weight = 1,
  ) => add(id, label, evidence.confidence, weight)

  const weapon = getWeaponDefinition(build.weapon.weaponId)
  const attackProfile = getAttackProfile(build.weapon.weaponId)
  addEvidence('weapon-speed', '武器Speedデータ', weapon.speed)
  addEvidence('weapon-area', '武器Areaデータ', weapon.area)
  addEvidence('attack-profile', 'Attack Profile', attackProfile, 3)
  addEvidence('aoe-model', 'AoE平均命中モデル', MODEL.maximumAreaRating, 2)
  addEvidence(
    'average-targets',
    '射程内の平均敵数',
    DEFAULT_SCENARIO_EVIDENCE.averageTargetsInReach,
    1.5,
  )

  if (build.weapon.observedDamagePerHit === undefined) {
    addEvidence('weapon-rating', '武器Power Rating', weapon.power)
    add('power-scaling', 'Powerから実ダメージへの換算', 'low', 3)
    caveats.push('Power Levelの絶対ダメージ曲線が未取得のため、比較用の正規化値です。')
  } else {
    add('observed-damage', '入力した表示ダメージ', 'medium', 2)
    caveats.push('敵HP・最大HP・被ダメージ・回復量も、表示ダメージと同じゲーム内単位で入力してください。')
  }

  addEvidence('kill-rate-model', 'Build依存kill rateモデル', MODEL.killRateModel, 2)
  addEvidence(
    'average-enemy-health',
    `${scenario.name}の平均敵HP`,
    DEFAULT_SCENARIO_EVIDENCE.averageEnemyHealth,
    1.5,
  )
  addEvidence(
    'enemy-supply',
    `${scenario.name}の敵供給上限`,
    DEFAULT_SCENARIO_EVIDENCE.enemySupplyPerSecond,
    1.5,
  )
  addEvidence(
    'incoming-damage',
    '被ダメージ/秒',
    DEFAULT_SCENARIO_EVIDENCE.incomingDamagePerSecond,
  )
  addEvidence('maximum-health', '最大HP', DEFAULT_SCENARIO_EVIDENCE.maxHealth)

  const uniqueEnchantments = new Set(build.enchantments.map((item) => item.enchantmentId))
  for (const enchantmentId of uniqueEnchantments) {
    const definition = getEnchantmentDefinition(enchantmentId)
    addEvidence(
      `enchant-${enchantmentId}`,
      `${definition.name.ja}のtier値`,
      definition.tiers,
    )
    if (enchantmentsById(build.enchantments, enchantmentId).length > 1) {
      addEvidence(
        `enchant-stacking-${enchantmentId}`,
        `${definition.name.ja}のstacking`,
        definition.stacking,
        2,
      )
    }
  }

  if (hasEnchantment(build.enchantments, 'radiance')) {
    addEvidence(
      'radiance-heal',
      '輝き1回の回復量',
      DEFAULT_SCENARIO_EVIDENCE.radianceHealPerProc,
      2,
    )
  }
  const usesDirectWeaponKills = hasEnchantment(build.enchantments, 'leeching') ||
    hasEnchantment(build.enchantments, 'guarding-strike')
  if (usesDirectWeaponKills) {
    addEvidence(
      'direct-kill-share',
      '直接撃破率',
      DEFAULT_SCENARIO_EVIDENCE.directKillShare,
    )
  }
  if (hasEnchantment(build.enchantments, 'void-strike')) {
    addEvidence('void-strike-curve', 'Void Strike時間曲線', VOID_STRIKE_CURVE, 3)
    addEvidence(
      'encounter-duration',
      '戦闘時間',
      DEFAULT_SCENARIO_EVIDENCE.encounterDurationSeconds,
    )
    caveats.push(VOID_STRIKE_CURVE.value.method === 'linear-proxy'
      ? '「虚無の一撃」は3秒の線形ランプで近似し、武器が命中するたびにリセットしています。'
      : '「虚無の一撃」はフレーム計測した時間曲線を補間しています。')
  }

  const artifactCounts = new Map<ArtifactId, number>()
  for (const ownedArtifact of build.artifacts) {
    const artifact = getArtifactDefinition(ownedArtifact.artifactId)
    artifactCounts.set(artifact.id, (artifactCounts.get(artifact.id) ?? 0) + 1)
    addEvidence(
      `artifact-cooldown-${ownedArtifact.instanceId}`,
      `${artifact.name.ja}のCooldown`,
      artifact.cooldownSeconds,
    )
    addEvidence(
      `artifact-duration-i-${ownedArtifact.instanceId}`,
      `${artifact.name.ja}の継続時間切片`,
      artifact.durationIntercept,
    )
    addEvidence(
      `artifact-duration-p-${ownedArtifact.instanceId}`,
      `${artifact.name.ja}のPower別継続時間`,
      artifact.durationPerPower,
    )
    if (artifact.attackSpeedBonus) {
      addEvidence(
        `artifact-speed-${ownedArtifact.instanceId}`,
        `${artifact.name.ja}の攻撃速度`,
        artifact.attackSpeedBonus,
      )
    }
    if (artifact.damageReduction) {
      addEvidence(
        `artifact-defense-${ownedArtifact.instanceId}`,
        `${artifact.name.ja}のダメージ軽減`,
        artifact.damageReduction,
      )
    }
  }
  for (const [artifactId, count] of artifactCounts) {
    if (count > 1) {
      const artifact = getArtifactDefinition(artifactId)
      addEvidence(
        `artifact-stacking-${artifactId}`,
        `${artifact.name.ja}のstacking`,
        artifact.stacking,
        2,
      )
    }
  }
  if (build.artifacts.length > 0) {
    addEvidence(
      'cooldown-reduction',
      'Cooldown短縮',
      DEFAULT_SCENARIO_EVIDENCE.cooldownReduction,
    )
  }

  if (attackProfile.value.method === 'speed-rating-proxy') {
    caveats.unshift('攻撃回数は武器別の暫定Attack Profileであり、フレーム計測が必要です。')
  } else if (attackProfile.value.method === 'published-hit-timings') {
    caveats.unshift('攻撃回数は公開Stats表のhit timingから算出しています。独立した実機検証は未実施です。')
  }

  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0)
  const coverageScore = Math.exp(factors.reduce(
    (sum, factor) => sum + factor.weight * Math.log(CONFIDENCE_SCORE[factor.confidence]),
    0,
  ) / totalWeight)
  const label: Confidence = coverageScore >= 0.78
    ? 'high'
    : coverageScore >= 0.55
      ? 'medium'
      : 'low'
  const uncertainFactors = [...factors]
    .filter((factor) => factor.confidence === 'low')
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((factor) => factor.label)
  if (uncertainFactors.length > 0) {
    caveats.push(`主な不確実要因: ${uncertainFactors.join(' / ')}`)
  }

  return { coverageScore, label, factors, caveats }
}
