import { MODEL } from '../data/model'
import { DAMAGE_CHANNEL_KILL_ATTRIBUTION, PROC_DAMAGE_DEFINITIONS, PROC_TARGET_CONTACT } from '../data/damageEvents'
import { isProcDamageId } from './damageEvents'
import { CROSS_WEAPON_DAMAGE_SCALING, GEAR_POWER_CURVE } from '../data/powerScaling'
import { DEFAULT_SCENARIO_EVIDENCE } from '../data/scenarios'
import { DIRECT_WEAPON_COMPOSITION, UNCHANTING_MIXTURE, UNCHANTING_TARGET_CONDITION } from '../data/damageModifiers'
import { AMBUSH_TARGET_CONDITION, AMBUSH_VERSION, SMITING_TARGET_CONDITION, SMITING_VERSION, CONDITIONAL_STATE_FACTORIZATION, COMMITTED_HEALTH_SCALING, COMMITTED_ANALYTIC_INTEGRATION, COMMITTED_FRESH_TARGET, COMMITTED_AOE_TRAJECTORY } from '../data/enemyStateDamage'
import { HEALTH_POTION_BASE_COOLDOWN, HEALTH_POTION_HEAL_FRACTION, REFRESHMENT_COOLDOWN_RATE_MODEL, REFRESHMENT_DIRECT_KILL_CONDITION, REFRESHMENT_INDIRECT_KILL_EXCLUSIONS } from '../data/potions'
import { WEAKENING_APPLICATION, WEAKENING_DURATION, WEAKENING_HERO_DR_COMPOSITION } from '../data/enemyDebuffs'
import {
  VOID_STRIKE_CURVE,
  VOID_STRIKE_ARMED_MINIMUM,
  VOID_STRIKE_EXPIRATION,
  VOID_STRIKE_EXTERNAL_DAMAGE_CONSUMPTION,
  VOID_STRIKE_RESET_SEMANTICS,
  VOID_STRIKE_TIER_SCALING,
} from '../data/voidStrike'
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
    addEvidence('internal-power-rating', '武器の内部Power rating', weapon.internalPowerRating, 2)
    addEvidence('gear-power-curve', 'Gear Power Curve', GEAR_POWER_CURVE, 3)
    addEvidence(
      'cross-weapon-scaling',
      '内部Power比による武器間換算',
      CROSS_WEAPON_DAMAGE_SCALING,
      3,
    )
    caveats.push('Power換算は公開Anchor表のPower 50〜263をlog補間し、1.17.0.0の内部Power rating比を適用します。Wikiのversion不明damage表とは最大45.06%ずれるため、正確な個体値には表示ダメージ入力を優先してください。')
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
    if (enchantmentsById(build.enchantments, enchantmentId).length > 1 || ['refreshment', 'weakening', 'ambush', 'smiting', 'committed'].includes(enchantmentId)) {
      addEvidence(
        `enchant-stacking-${enchantmentId}`,
        `${definition.name.ja}のstacking`,
        definition.stacking,
        2,
      )
    }
  }

  const procIds = [...uniqueEnchantments].filter(isProcDamageId)
  for (const id of procIds) {
    const proc = PROC_DAMAGE_DEFINITIONS[id]
    addEvidence(`proc-samples-${id}`, `${id}の公開Power表`, proc.samples, 2)
    addEvidence(`proc-power-${id}`, `${id}のPower補間`, proc.damageCurve, 3)
    addEvidence(`proc-targeting-${id}`, `${id}の平均命中数`, proc.targeting, 2)
    addEvidence(`proc-attribution-${id}`, `${id}の間接撃破条件`, proc.attribution)
    if (hasEnchantment(build.enchantments, 'void-strike')) {
      addEvidence(`proc-void-${id}`, `${id}とVoidの未確定interaction`, proc.voidInteraction, 2)
    }
  }
  if (procIds.length > 0) {
    addEvidence('damage-channel-kill-attribution', 'damage shareによる撃破帰属近似', DAMAGE_CHANNEL_KILL_ATTRIBUTION, 3)
    addEvidence('proc-target-contact', '有効targetへの継続命中仮定', PROC_TARGET_CONTACT, 2)
    caveats.push('Phase 2-1D partial: Shockwave Power 210–252、Swirling 210–263、Thundering 248–263のみ。個別Tier I表をlog-linear補間しTier比率を適用、範囲外は外挿しません。同Powerの個体差と表のversion不明のため絶対精度は未検証です。')
    caveats.push('proc平均命中数は全種初期値1体のlow-confidence仮定（範囲の実測なし）。武器Areaは使いません。Swirlingはfinisher命中100%を仮定し、空振り・knockback・target switchingとShockwaveの壁は未モデル化です。')
    caveats.push('間接撃破は直接撃破効果に加算しません。直接AoE/総AoEをfinal blow割合の代用とするlow-confidence近似で、hit/proc timing・残HP・overkill・対象分布は再現しません。')
    caveats.push('procへSharpness・Critical・Unchanting・Smiting・Ambush・Committed・Void倍率を掛けません。Void増幅と消費は別々にuncertainのまま、増幅なし・状態変更なしの限定モデルです。ThunderingのLightning Focusも未実装です。')
  }
  const usesUnchanting = hasEnchantment(build.enchantments, 'unchanting')
  const directModifierCount = ['sharpness', 'unchanting', 'critical-hit', 'void-strike', 'ambush', 'smiting', 'committed']
    .filter((id) => build.enchantments.some((selected) => selected.enchantmentId === id)).length
  if (directModifierCount > 1) {
    addEvidence('direct-weapon-composition', '直接近接ダメージのmodifier合成', DIRECT_WEAPON_COMPOSITION, 2)
    caveats.push('Sharpness・Critical・Void・Unchanting・Smiting・Ambushの独立期待倍率から直接DPSを求め、その後CommittedのHP推移を適用します。全interactionの1.17.0.0実機検証は未完了で、proc/DoT・Strength・防具damage auraへ倍率を拡張しません。')
  }
  if (usesUnchanting) {
    addEvidence('unchanting-target-condition', 'Unchantingのenchanted条件', UNCHANTING_TARGET_CONDITION)
    addEvidence('unchanting-mixture', 'Unchantingの等baseline期待値モデル', UNCHANTING_MIXTURE, 2)
    addEvidence('enchanted-enemy-share', `${scenario.name}のエンチャント敵割合`, DEFAULT_SCENARIO_EVIDENCE.enchantedShare, 2)
    caveats.push(`エンチャント敵割合${Number((scenario.enemyComposition.enchantedShare * 100).toFixed(2))}%はシナリオ仮定です（全profileの初期値25%、実測ではありません）。敵ごとのHP・enchanted敵のHP偏り・target priority・遭遇順序を無視した期待値です。`)
  }

  const usesAmbush = hasEnchantment(build.enchantments, 'ambush')
  const usesSmiting = hasEnchantment(build.enchantments, 'smiting')
  if (usesAmbush) {
    addEvidence('ambush-target-condition', 'Ambushの非targeting条件', AMBUSH_TARGET_CONDITION)
    addEvidence('ambush-version', 'Ambushの1.16.2.0以降のTier値', AMBUSH_VERSION)
    addEvidence('ambush-eligible-share', 'Ambush有効攻撃割合', DEFAULT_SCENARIO_EVIDENCE.ambushEligibleDirectDamageShare, 2)
    caveats.push(`Ambush有効攻撃割合${Number((scenario.enemyState.ambushEligibleDirectDamageShare * 100).toFixed(2))}%は編集可能な仮定（全profile初期値25%、実測なし）。他player・pet・CC・透明化・初期aggro前をまとめ、targeting挙動は再現しません。`)
  }
  if (usesSmiting) {
    addEvidence('smiting-target-condition', 'SmitingのUndead条件', SMITING_TARGET_CONDITION)
    addEvidence('smiting-version', 'Smitingの1.16.2.0以降のTier値', SMITING_VERSION)
    addEvidence('undead-enemy-share', 'アンデッドの割合', DEFAULT_SCENARIO_EVIDENCE.undeadShare, 2)
    caveats.push(`アンデッド割合${Number((scenario.enemyComposition.undeadShare * 100).toFixed(2))}%はdamage-weighted仮定（全profile初期値50%、実測なし）。コピーは同じ敵条件を共有し、active倍率を乗算した後に割合を一度だけ適用します。`)
  }
  if ([usesUnchanting, usesAmbush, usesSmiting].filter(Boolean).length > 1) {
    addEvidence('conditional-state-factorization', '敵条件の独立近似（相関未モデル化）', CONDITIONAL_STATE_FACTORIZATION, 3)
    caveats.push('MVP independent-condition approximation: enchanted・undead・targetingの相関を無視して期待倍率を乗算します。joint distributionに基づく厳密な期待値ではありません。')
  }
  if (hasEnchantment(build.enchantments, 'committed')) {
    addEvidence('committed-health-scaling', 'CommittedのHP損失比例', COMMITTED_HEALTH_SCALING)
    addEvidence('committed-analytic-integration', 'Committed積分の数学的検証（実戦精度とは別）', COMMITTED_ANALYTIC_INTEGRATION)
    addEvidence('committed-fresh-target', 'Committedのfull HPから撃破までの連続攻撃仮定', COMMITTED_FRESH_TARGET, 3)
    addEvidence('committed-aoe-trajectory', 'CommittedのAoE同一HP推移近似', COMMITTED_AOE_TRAJECTORY, 3)
    caveats.push('Committedはfull HPの敵を倒すまで継続攻撃する連続rateモデルです。戦闘終了までに倒せない敵・離脱・切替・overkill・burst・離散hitを再現しません。負傷済みの敵やco-op集中攻撃では過小評価し得ます。AoEは敵ごとのHPとdirect/proc coverageを一つの推移へ近似します。')
    caveats.push('proc自体へCommittedを掛けず、procがHPを減らす効果だけを積分のPに含めます。数式の検証済みという意味と実戦精度は別です。')
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
    hasEnchantment(build.enchantments, 'guarding-strike') ||
    hasEnchantment(build.enchantments, 'refreshment')
  if (usesDirectWeaponKills) {
    addEvidence(
      'direct-kill-share',
      '直接撃破率',
      DEFAULT_SCENARIO_EVIDENCE.directKillShare,
    )
  }
  if (hasEnchantment(build.enchantments, 'refreshment')) {
    addEvidence('refreshment-direct-kill-condition', 'Refreshmentの直接撃破条件', REFRESHMENT_DIRECT_KILL_CONDITION)
    addEvidence('refreshment-indirect-kill-exclusions', '間接撃破の除外境界', REFRESHMENT_INDIRECT_KILL_EXCLUSIONS)
    addEvidence('health-potion-base-cooldown', 'Health Potionの基礎CD', HEALTH_POTION_BASE_COOLDOWN)
    addEvidence('health-potion-heal-fraction', 'Health Potionの概算回復割合', HEALTH_POTION_HEAL_FRACTION, 2)
    addEvidence('refreshment-cooldown-rate-model', 'Refreshmentの連続撃破・追加回復容量モデル', REFRESHMENT_COOLDOWN_RATE_MODEL, 3)
    caveats.push('RefreshmentはCD 45秒・回復約75%を用いたlow-confidenceの追加回復容量です。一定の直接撃破と即再使用を仮定し、実回復・HP不足・離散撃破・ready中の短縮破棄・戦闘開始終了は再現しません。baselineのポーション回復はスコアへ追加せず、ArtifactのCD短縮も適用しません。')
  }
  if (hasEnchantment(build.enchantments, 'weakening')) {
    addEvidence('weakening-application', 'Weakeningの周囲の敵への攻撃力低下', WEAKENING_APPLICATION)
    addEvidence('weakening-duration', 'Weakeningの5秒継続', WEAKENING_DURATION)
    addEvidence('weakening-affected-incoming-damage-share', '弱体化中の敵から受ける被ダメージ割合', DEFAULT_SCENARIO_EVIDENCE.weakeningAffectedIncomingDamageShare, 3)
    if (hasEnchantment(build.enchantments, 'guarding-strike') || build.artifacts.some((item) => item.artifactId === 'iron-hide-amulet')) {
      addEvidence('weakening-hero-dr-composition', '敵攻撃力低下とhero防御の時間平均合成', WEAKENING_HERO_DR_COMPOSITION, 2)
    }
    caveats.push(`Weakening対象の被ダメージ割合${Number((scenario.enemyDebuffs.weakeningAffectedIncomingDamageShare * 100).toFixed(2))}%は位置・攻撃対象・5秒継続・攻撃稼働率を含むlow-confidence仮定です（全profileの初期値50%）。durationやHPSを再度掛けず、常時40%軽減とはしません。hero防御とは別の段階です。`)
    caveats.push('Weakeningの重複は依頼仕様とWikiの明示的なnon-stackable記述に従い最大1個。dungeons.toolsのSTACKS Yesと矛盾するためstackingはmedium confidenceです。')
  }
  if (hasEnchantment(build.enchantments, 'void-strike')) {
    addEvidence('void-strike-curve', 'Void Strike時間曲線', VOID_STRIKE_CURVE, 3)
    addEvidence('void-strike-minimum', 'Void Strike armed minimum', VOID_STRIKE_ARMED_MINIMUM, 2)
    addEvidence('void-strike-expiration', 'Void Strike消滅時刻', VOID_STRIKE_EXPIRATION, 2)
    addEvidence('void-strike-reset', 'Void Strike再適用', VOID_STRIKE_RESET_SEMANTICS, 2)
    addEvidence(
      'void-strike-external-consume',
      'Void Strikeの外部damage消費',
      VOID_STRIKE_EXTERNAL_DAMAGE_CONSUMPTION,
    )
    addEvidence('void-strike-tier-scaling', 'Void Strike tier換算', VOID_STRIKE_TIER_SCALING, 2)
    addEvidence(
      'encounter-duration',
      '戦闘時間',
      DEFAULT_SCENARIO_EVIDENCE.encounterDurationSeconds,
    )
    caveats.push(VOID_STRIKE_CURVE.value.method === 'frame-measured'
      ? '「虚無の一撃」はフレーム計測した時間曲線を補間しています。'
      : '「虚無の一撃」は公開community測定に基づく低信頼モデルです。付与hitは1倍、次frameから1.25倍、3.6秒でTier III 7倍、5秒で消滅としてper-hit間隔ごとに再適用します。厳密なcurve形状とtier別minimumは未確定です。')
    caveats.push('外部damageによるVoid Strike消費は未実装です。現在は同じVoid Strike付き武器の直接hitだけをeventとして扱います。')
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
