import { calculateArtifactEffects } from './artifact'
import { getArtifactDefinition, getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { summarizeConfidence } from './confidence'
import { calculateDamage } from './damage'
import { calculateDefense } from './defense'
import { calculateHealing } from './healing'
import type {
  Build,
  ArtifactId,
  EffectContribution,
  EnchantmentId,
  Evaluation,
  ObjectiveUtilities,
  Scenario,
} from './types'
import { validateBuild, validateScenario } from './validation'

interface EvaluationCore {
  readonly damage: Evaluation['damage']
  readonly healing: Evaluation['healing']
  readonly defense: Evaluation['defense']
  readonly artifactEffects: Evaluation['artifactEffects']
  readonly utilities: ObjectiveUtilities
  readonly objectiveScore: number
}

export function saturatingUtility(value: number, target: number): number {
  if (value <= 0 || target <= 0) return 0
  return 1 - Math.exp(-value / target)
}

function calculateCore(build: Build, scenario: Scenario): EvaluationCore {
  const artifactEffects = calculateArtifactEffects(build.artifacts, scenario)
  const damage = calculateDamage(build.weapon.weaponId, build.enchantments, artifactEffects, scenario)
  const healing = calculateHealing(build.enchantments, damage, scenario)
  const defense = calculateDefense(build.enchantments, artifactEffects, scenario)
  const damageTarget = scenario.averageEnemyHealth * Math.max(0.1, scenario.killsPerSecond)
  const utilities = {
    damage: saturatingUtility(damage.aoeDps, damageTarget),
    healing: saturatingUtility(healing.totalPerSecond, Math.max(1, scenario.incomingDamagePerSecond)),
    defense: Math.max(0, Math.min(1, 1 - defense.damageTakenMultiplier)),
  }
  const weightTotal = scenario.weights.damage + scenario.weights.healing + scenario.weights.defense
  const objectiveScore =
    (100 *
      (utilities.damage * scenario.weights.damage +
        utilities.healing * scenario.weights.healing +
        utilities.defense * scenario.weights.defense)) /
    weightTotal

  return { damage, healing, defense, artifactEffects, utilities, objectiveScore }
}

function toContribution(
  sourceType: EffectContribution['sourceType'],
  sourceId: EffectContribution['sourceId'],
  baseline: EvaluationCore,
  withoutEffect: EvaluationCore,
): EffectContribution {
  const label =
    sourceType === 'enchantment'
      ? getEnchantmentDefinition(sourceId as EnchantmentId).name
      : getArtifactDefinition(sourceId as ArtifactId).name

  return {
    sourceType,
    sourceId,
    label,
    objectiveDelta: baseline.objectiveScore - withoutEffect.objectiveScore,
    singleTargetDpsDelta: baseline.damage.singleTargetDps - withoutEffect.damage.singleTargetDps,
    aoeDpsDelta: baseline.damage.aoeDps - withoutEffect.damage.aoeDps,
    healingPerSecondDelta: baseline.healing.totalPerSecond - withoutEffect.healing.totalPerSecond,
    effectiveHealthDelta: baseline.defense.effectiveHealth - withoutEffect.defense.effectiveHealth,
  }
}

function calculateContributions(
  build: Build,
  scenario: Scenario,
  baseline: EvaluationCore,
): EffectContribution[] {
  const enchantmentContributions = build.enchantments.map((enchantmentId, index) => {
    const enchantments = build.enchantments.filter((_, currentIndex) => currentIndex !== index)
    const withoutEffect = calculateCore({ ...build, enchantments }, scenario)
    return toContribution('enchantment', enchantmentId, baseline, withoutEffect)
  })
  const artifactContributions = build.artifacts.map((artifact) => {
    const artifacts = build.artifacts.filter((item) => item.instanceId !== artifact.instanceId)
    const withoutEffect = calculateCore({ ...build, artifacts }, scenario)
    return toContribution('artifact', artifact.artifactId, baseline, withoutEffect)
  })
  return [...enchantmentContributions, ...artifactContributions].sort(
    (left, right) => right.objectiveDelta - left.objectiveDelta,
  )
}

export function evaluate(build: Build, scenario: Scenario): Evaluation {
  validateBuild(build)
  validateScenario(scenario)
  const core = calculateCore(build, scenario)
  const reasons: string[] = []
  const weapon = getWeaponDefinition(build.weapon.weaponId)

  if (weapon.area.value >= 12) reasons.push(`${weapon.name.ja}の広い攻撃範囲をAoE評価へ反映`)
  if (build.enchantments.includes('radiance') && core.damage.hitsPerSecond >= 4) {
    reasons.push('高い攻撃頻度により「輝き」の期待回復量が上昇')
  }
  if (build.enchantments.includes('void-strike') && core.damage.hitsPerSecond <= 2) {
    reasons.push('遅い攻撃間隔により「虚無の一撃」の増幅時間を確保')
  }
  if (build.enchantments.includes('guarding-strike')) {
    reasons.push(`「ガードストライク」の推定稼働率${Math.round(core.defense.guardingStrikeUptime * 100)}%`)
  }
  for (const artifact of build.artifacts) {
    const uptime = core.artifactEffects.uptimes.find((entry) => entry.instanceId === artifact.instanceId)
    if (uptime) {
      reasons.push(`${getArtifactDefinition(artifact.artifactId).name.ja}の推定稼働率${Math.round(uptime.uptime * 100)}%`)
    }
  }
  if (reasons.length === 0) {
    reasons.push(build.enchantments.map((id) => getEnchantmentDefinition(id).name.ja).join(' / '))
  }

  return {
    build,
    ...core,
    confidence: summarizeConfidence(build.enchantments),
    reasons,
    contributions: calculateContributions(build, scenario, core),
  }
}
