import { calculateArtifactEffects } from './artifact'
import { calculateDamage } from './damage'
import { calculateDefense } from './defense'
import { calculateHealing } from './healing'
import { getArtifactDefinition, getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { summarizeConfidence } from './confidence'
import type { Build, Evaluation, Scenario } from './types'
import { validateBuild, validateScenario } from './validation'

export function evaluate(build: Build, scenario: Scenario): Evaluation {
  validateBuild(build)
  validateScenario(scenario)

  const artifactEffects = calculateArtifactEffects(build.artifacts, scenario)
  const damage = calculateDamage(
    build.weapon.weaponId,
    build.enchantments,
    artifactEffects,
    scenario,
  )
  const healing = calculateHealing(build.enchantments, damage, scenario)
  const defense = calculateDefense(build.enchantments, artifactEffects, scenario)
  const weightTotal = scenario.weights.damage + scenario.weights.healing + scenario.weights.defense
  const damageUtility = damage.aoeDps / scenario.averageEnemyHealth
  const healingUtility =
    scenario.incomingDamagePerSecond > 0
      ? healing.totalPerSecond / scenario.incomingDamagePerSecond
      : 0
  const defenseUtility =
    scenario.incomingDamagePerSecond > 0
      ? defense.preventedDamagePerSecond / scenario.incomingDamagePerSecond
      : 0
  const objectiveScore =
    (100 *
      (damageUtility * scenario.weights.damage +
        healingUtility * scenario.weights.healing +
        defenseUtility * scenario.weights.defense)) /
    weightTotal

  const reasons: string[] = []
  const weapon = getWeaponDefinition(build.weapon.weaponId)
  if (weapon.area.value >= 12) reasons.push(`${weapon.name}の広い攻撃範囲をAoE評価へ反映`)
  if (build.enchantments.includes('radiance') && damage.hitsPerSecond >= 4) {
    reasons.push('高い攻撃頻度によりRadianceの期待回復量が上昇')
  }
  if (build.enchantments.includes('void-strike') && damage.hitsPerSecond <= 2) {
    reasons.push('遅い攻撃間隔によりVoid Strikeの増幅時間を確保')
  }
  if (build.enchantments.includes('guarding-strike')) {
    reasons.push(`Guarding Strikeの推定稼働率${Math.round(defense.guardingStrikeUptime * 100)}%`)
  }
  for (const artifactId of build.artifacts) {
    const uptime = artifactEffects.uptimes.find((entry) => entry.artifactId === artifactId)
    if (uptime) {
      reasons.push(`${getArtifactDefinition(artifactId).name}の推定稼働率${Math.round(uptime.uptime * 100)}%`)
    }
  }
  if (reasons.length === 0) {
    reasons.push(
      build.enchantments.map((id) => getEnchantmentDefinition(id).name).join(' / '),
    )
  }

  return {
    build,
    damage,
    healing,
    defense,
    artifactEffects,
    objectiveScore,
    confidence: summarizeConfidence(build.enchantments),
    reasons,
  }
}
