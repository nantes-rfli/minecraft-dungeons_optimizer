import { calculateArtifactEffects } from './artifact'
import { deriveCombatState } from './combatState'
import { getArtifactDefinition, getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { summarizeConfidence } from './confidence'
import { calculateDamage } from './damage'
import { calculateDefense } from './defense'
import { hasEnchantment } from './enchantment'
import { calculateHealing } from './healing'
import { derivePotionState } from './potion'
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
  readonly combatState: Evaluation['combatState']
  readonly potionState: Evaluation['potionState']
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
  const damage = calculateDamage(build.weapon, build.enchantments, artifactEffects, scenario)
  const combatState = deriveCombatState(damage, scenario)
  const potionState = derivePotionState(build.enchantments, combatState, scenario)
  const healing = calculateHealing(build.enchantments, damage, combatState, scenario, potionState)
  const defense = calculateDefense(build.enchantments, artifactEffects, combatState, scenario)
  const damageTarget =
    scenario.averageEnemyHealth * Math.max(0.1, scenario.enemySupplyPerSecond)
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

  return { damage, combatState, potionState, healing, defense, artifactEffects, utilities, objectiveScore }
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
  const enchantmentContributions = build.enchantments.map((selected, index) => {
    const enchantments = build.enchantments.filter((_, currentIndex) => currentIndex !== index)
    const withoutEffect = calculateCore({ ...build, enchantments }, scenario)
    return toContribution('enchantment', selected.enchantmentId, baseline, withoutEffect)
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
  for (const event of core.damage.damageEvents) {
    const trigger = event.triggerKind === 'combo-finisher'
      ? `コンボ終了 ${event.opportunitiesPerSecond.toFixed(3)}回/秒`
      : `HPS ${event.opportunitiesPerSecond.toFixed(3)} × 30%`
    reasons.push(`${getEnchantmentDefinition(event.sourceId).name.en}: ${trigger} → proc ${event.eventsPerSecond.toFixed(3)}回/秒 × ${event.damagePerEvent.toFixed(1)} damage/event = 単体${event.singleTargetDps.toFixed(1)} DPS / AoE ${event.aoeDps.toFixed(1)} DPS（平均${event.expectedTargetsHit}体、間接damageは直接撃破効果と別扱い）`)
  }

  const refreshment = build.enchantments.find((item) => item.enchantmentId === 'refreshment')
  if (refreshment) {
    reasons.push(`Refreshment ${['I', 'II', 'III'][refreshment.tier - 1]}: 直接撃破${core.combatState.directWeaponKillsPerSecond.toFixed(2)}/秒 → ポーション推定CD ${core.potionState.effectiveCooldownSeconds.toFixed(2)}秒、追加回復容量${core.healing.refreshmentPotionCapacityPerSecond.toFixed(2)}/秒（実回復ではなくcapacity近似）`)
  }
  if (hasEnchantment(build.enchantments, 'weakening')) {
    const share = Number((core.defense.weakeningAffectedIncomingDamageShare * 100).toFixed(2))
    const reduction = Number(((1 - core.defense.weakeningEnemyDamageMultiplier) * 100).toFixed(2))
    reasons.push(`「弱体化」は対象の被ダメージ割合${share}%の想定で、敵の攻撃ダメージ期待値を${reduction}%削減（hero防御適用前）`)
  }

  if (hasEnchantment(build.enchantments, 'sharpness')) {
    reasons.push(`「切れ味」で直接近接ダメージを${core.damage.sharpnessMultiplier.toFixed(3)}倍に増幅`)
  }
  if (hasEnchantment(build.enchantments, 'unchanting')) {
    const share = Number((scenario.enemyComposition.enchantedShare * 100).toFixed(2))
    reasons.push(`「エンチャント解除」はエンチャント敵割合${share}%の想定で期待倍率${core.damage.unchantingMultiplier.toFixed(3)}倍${share === 0 ? '（火力寄与0）' : ''}`)
  }

  if (weapon.area.value >= 12) reasons.push(`${weapon.name.ja}の広い攻撃範囲をAoE評価へ反映`)
  if (hasEnchantment(build.enchantments, 'radiance') && core.damage.hitsPerSecond >= 4) {
    reasons.push('高い攻撃頻度により「輝き」の期待回復量が上昇')
  }
  if (hasEnchantment(build.enchantments, 'void-strike') && core.damage.hitsPerSecond <= 2) {
    reasons.push('遅い攻撃間隔により「虚無の一撃」の増幅時間を確保')
  }
  if (hasEnchantment(build.enchantments, 'guarding-strike')) {
    reasons.push(`「ガードストライク」の推定稼働率${Math.round(core.defense.guardingStrikeUptime * 100)}%`)
  }
  for (const group of core.artifactEffects.stackingGroups) {
    const countLabel = group.instanceIds.length > 1
      ? `${group.instanceIds.length}個を${group.behavior}運用した`
      : ''
    reasons.push(
      `${getArtifactDefinition(group.artifactId).name.ja}${countLabel}推定稼働率${Math.round(group.combinedUptime * 100)}%`,
    )
  }
  if (reasons.length === 0) {
    reasons.push(build.enchantments.map((selected) =>
      getEnchantmentDefinition(selected.enchantmentId).name.ja,
    ).join(' / '))
  }

  return {
    build,
    ...core,
    confidence: summarizeConfidence(build, scenario),
    reasons,
    contributions: calculateContributions(build, scenario, core),
  }
}
