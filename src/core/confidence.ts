import { isControlId, CC_REFRESH_MODEL, CC_ELIGIBILITY_MODEL, CC_CLUSTER_MODEL, STUNNING_DURATION } from '../data/control'
import { PAIN_HEALTH_COST, DYNAMO_NUMERIC_EVIDENCE } from '../data/chargeConsume'
import { DOT_DAMAGE_CURVES, DOT_EXPLOSION_IDS, FIRE_REFRESH_MODEL, FIRE_TARGET_MODEL, POISON_SATURATION_MODEL, EXPLOSION_TARGET_MODEL, EXPLOSION_KILL_SOURCE } from '../data/dotDamageEvents'
import { isDotDamageId } from './dotDamageEvents'
import { BASE_SOUL_CAPACITY, INITIAL_SOULS, SOUL_GATHERING_PER_ENCHANTMENT, SOUL_TRAJECTORY_MODEL, SOUL_NORMAL_KILL_MODEL, SOUL_SIPHON_ROLL_MODEL, SOUL_SIPHON_PICKUPS, ANIMA_CAPACITY_MODEL, SOUL_GILDED_GATHERING_MODEL, isSoulEnchantmentId } from '../data/souls'
import {
  ARTIFACT_USE_RATE_MODEL, ARTIFACT_SYNERGY_PENDING_CHARGE, ARTIFACT_SYNERGY_STAGGERING,
  ARTIFACT_SYNERGY_ATTACK_OPPORTUNITY, ARTIFACT_SYNERGY_DIRECT_COMPOSITION, ARTIFACT_SYNERGY_TRIGGER,
  RAMPAGING_DIRECT_KILL, RAMPAGING_SHARED_TRIGGER, RAMPAGING_UPTIME_MODEL,
  RAMPAGING_SPEED_COMPOSITION, RAMPAGING_MEAN_CADENCE, RAMPAGING_FIXED_POINT,
} from '../data/temporalEnchantments'
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
  if (uniqueEnchantments.has('pain-cycle') || uniqueEnchantments.has('dynamo')) {
    add('charge-action-proxy', '4武器限定: profile hitを1攻撃とみなす有限cadence', 'low', 3)
    add('charge-direct-attribution', '強化武器攻撃をdirectへ分類（公開記述とcommunity報告からの推論）', 'medium', 2)
    add('charge-aoe', '強化攻撃の各近接対象へbonusを適用', 'low', 2)
    caveats.push('charge/consumeは4武器のprofile hit=1攻撃、初撃t=0、戦闘終了時刻の攻撃を除外、全攻撃命中・均一hit damageの限定モデルです。空振り、対象交代、Sawblade、Light Feather、roll armorは対象外。Critical/Void/Sharpness/Unchanting/Ambush/Smiting/Artifact Synergy/Committedとの併用、およびPain + DynamoはEvidence不足で除外します。間接damageへ倍率を掛けません。')
  }
  if (uniqueEnchantments.has('pain-cycle')) {
    addEvidence('pain-health-cost', 'chargingごとの最大HP3%消費（公開仕様）', PAIN_HEALTH_COST)
    add('pain-consume-health-timing', '5回HP消費→6回目消費なし・stack0へreset', 'low', 3)
    add('pain-finite-cycle', '有限charge数とbonus・自己damage（モデル導出）', 'low', 2)
    caveats.push('Pain Cycleは5回充填した次の攻撃が3/4/5倍。6回目にHP消費・次周期の加算なしとするタイミングはcommunity説明からの低信頼度採用で、独立実測未済。基本DPSは従来の平均rate、加算bonusとHP消費だけ有限攻撃列で計算します。gross回復容量−自己damageをnet sustainとしてranking/Paretoへ使用し、負値も減点します。敵攻撃用の防御は適用せず、死亡・最低HP・overhealの時系列は再現しません。')
  }
  if (uniqueEnchantments.has('dynamo')) {
    addEvidence('dynamo-table', 'Tier別公開30数値・同Power個体差とversion不明', DYNAMO_NUMERIC_EVIDENCE, 2)
    add('dynamo-interpolation', 'Power210–263のTier別log補間', 'low', 2)
    add('dynamo-roll-input', 'ユーザー指定roll頻度・初期stack', 'low', 2)
    add('dynamo-roll-flow', '攻撃間の連続stack収入・cap20・終了時残量', 'low', 3)
    add('dynamo-roll-opportunity', 'ロールanimationによる攻撃機会損失を省略', 'low', 3)
    caveats.push('Dynamoは10 Power点×3独立Tier値。表示1/1.25/1.5では数値表を再現できず、別々にlog補間し外挿しません。初期stack0〜20、roll頻度は全scenario初期0。攻撃間min(20,roll頻度×間隔)を消費する連続期待量モデルで、小数stackを許します。最初の攻撃は初期stackだけ消費、戦闘末尾の蓄積はdamageにしません。rollの時間コストを省き上限寄りです。直接撃破への帰属とAoE各対象への加算は公開記述・community報告からの限定解釈で、Jungle Poisonへ一般化しません。')
  }
  for (const enchantmentId of uniqueEnchantments) {
    const definition = getEnchantmentDefinition(enchantmentId)
    addEvidence(
      `enchant-${enchantmentId}`,
      `${definition.name.ja}の${enchantmentId === 'stunning' ? 'tier発動率（持続は別Evidence）' : 'tier値'}`,
      definition.tiers,
    )
    if (enchantmentsById(build.enchantments, enchantmentId).length > 1 || ['refreshment', 'weakening', 'ambush', 'smiting', 'committed', 'artifact-synergy', 'rampaging'].includes(enchantmentId)) {
      addEvidence(
        `enchant-stacking-${enchantmentId}`,
        `${definition.name.ja}のstacking`,
        definition.stacking,
        2,
      )
    }
  }

  const ccIds = [...uniqueEnchantments].filter(isControlId)
  if (ccIds.length > 0) {
    addEvidence('cc-refresh-model', 'CCの有限cadence・同一対象refresh仮定', CC_REFRESH_MODEL, 3)
    caveats.push('CCはprofile hitごと・モデル対象ごとの抽選。AoE敵数をHPSへ掛けず、初撃t=0から有限戦闘内の期待coverageを積分します。target switching・cluster移動・roll粒度・refreshは未検証、GravityによるDPS増加やCCによる防御換算は行いません。Controlの重みは好みのpolicyでEvidenceではありません。')
  }
  for (const id of ccIds) {
    addEvidence(`cc-eligibility-${id}`, `${id}の適用対象割合・耐性仮定`, CC_ELIGIBILITY_MODEL, 2)
    addEvidence(`cc-stacking-${id}`, `${id}のruntime stacking境界`, getEnchantmentDefinition(id).stacking)
    if (id === 'chains' || id === 'gravity') addEvidence(`cc-targets-${id}`, `${id}の平均対象数`, CC_CLUSTER_MODEL, 2)
  }
  if (ccIds.includes('stunning')) {
    addEvidence('cc-stunning-duration', 'Stunning 2秒（community計算・低信頼度）', STUNNING_DURATION, 3)
    caveats.push('Stunning 2秒は2022/2023 community計算を採用した限定値です（著者重複、独立測定ではない）。bossは初期適用割合0、他は共通50%の仮定。powerful mobの免疫は一律断定せず、Apocalypse+のstagger耐性をstun耐性へ自動転用しません。適用割合と持続補正を調整してください。')
  }
  if (ccIds.includes('chains')) caveats.push('Chainsは30%で1/2/3秒の移動束縛。近くには攻撃できます。game最大4copyですが、同時proc・mixed tier・3/4copy・再発動の持続式が未確定のためruntime1copy限定です。')
  if (ccIds.includes('freezing')) caveats.push('Freezingは3秒の敵攻撃速度低下30/40/50%。移動速度低下ではなく、Defenseの被ダメージ倍率も変更しません。')
  if (ccIds.includes('gravity')) caveats.push('Gravityは1/1.5/2秒の集敵coverage。初期平均1体は半径未測定の保守仮定です。Stunningの発動確率、AoE命中数、Poison滞在量、爆発対象数、AmbushやWeakeningの割合へ自動接続しません。内蔵Gravityも今回の自動追加対象外です。')

  if (build.enchantments.some((item) => isSoulEnchantmentId(item.enchantmentId))) {
    addEvidence('soul-capacity', 'Soul基礎容量', BASE_SOUL_CAPACITY)
    addEvidence('soul-start', 'Soul開始0', INITIAL_SOULS)
    addEvidence('soul-gathering', 'Soul Gatheringの加算', SOUL_GATHERING_PER_ENCHANTMENT)
    addEvidence('soul-trajectory', '一定収入・消費なしのSoul推移', SOUL_TRAJECTORY_MODEL, 2)
    addEvidence('soul-normal-kills', '通常Soul pickupと撃破源', SOUL_NORMAL_KILL_MODEL, 2)
    if (build.enchantments.some((item) => item.source === 'gilded' && isSoulEnchantmentId(item.enchantmentId))) addEvidence('soul-gilded-gathering', '金色のSoul Gathering加算仮定', SOUL_GILDED_GATHERING_MODEL)
    caveats.push('Soulは開始0・容量300・消費0。通常pickupは推定総撃破/秒を採用し、直接撃破だけに限定しません。吸収回数とGathering倍したresource量を分離します。Soul消費Artifactの撃破除外は将来対応、現在は対象装備を登録していません。')
    caveats.push('Soulゲージは一定収入の連続近似です。orb移動・吸収遅延・離散撃破・target switching・開始時のRampaging立ち上がりは再現しません。Enigma Resonatorは換算式の根拠不足のため未対応です。')
  }
  if (hasEnchantment(build.enchantments, 'soul-siphon')) {
    addEvidence('soul-siphon-roll', 'Siphon profile hitごとの抽選近似', SOUL_SIPHON_ROLL_MODEL, 2)
    addEvidence('soul-siphon-pickups', 'Siphon Tier値をpickup数と解釈', SOUL_SIPHON_PICKUPS, 2)
    caveats.push('Soul Siphonは20%・Tier 1/3/5 pickups、各pickupのresource量へGatheringを掛けます。AoEのtarget別抽選を示唆する報告はありますが現行実測不足のためprofile hitごとに1回とし、広範囲武器のSoul生成を過小評価し得ます。proc damageは抽選機会へ加算しません。Soul単独の資源量自体には架空の効用点を付けず、Animaとの相互作用を評価します。')
  }
  if (hasEnchantment(build.enchantments, 'anima-conduit')) {
    addEvidence('anima-capacity', 'Animaの満タン時を含む名目回復容量', ANIMA_CAPACITY_MODEL, 3)
    caveats.push('Animaは近接2/4/6%×最大HP×pickup/秒の名目回復容量です。満タン後も計上する楽観的な容量モデルであり実回復は未保証。吸収遅延・overheal・HPが満タンに近い場合の減衰は省略し、回復utilityを過大評価し得ます。遠距離4/6/8%とは別です。')
  }

  const dotExplosionIds = [...uniqueEnchantments].filter((id) => (DOT_EXPLOSION_IDS as readonly string[]).includes(id))
  for (const id of dotExplosionIds.filter(isDotDamageId)) {
    const curve = DOT_DAMAGE_CURVES[id]
    addEvidence(`dot-samples-${id}`, `${id}の公開DPS表（version/roll不明）`, { confidence: 'medium' }, 2)
    addEvidence(`dot-power-${id}`, `${id}の範囲限定Power補間`, curve, 3)
  }
  if (dotExplosionIds.length > 0) {
    if (![...uniqueEnchantments].some(isProcDamageId)) addEvidence('damage-channel-kill-attribution', 'damage shareによる撃破帰属近似', DAMAGE_CHANNEL_KILL_ATTRIBUTION, 3)
    caveats.push('DoT／爆発のfinal blowは直接武器撃破に含めません。damage-share代理計算（low）はtick timing・残HP・移動・他プレイヤーを再現しません。3種とVoid Strikeの併用は増幅・消費・再適用が未検証のため評価から除外します。')
  }
  if (hasEnchantment(build.enchantments, 'fire-aspect')) {
    addEvidence('fire-refresh', 'Fire Aspectの再付与と有限burn coverage', FIRE_REFRESH_MODEL, 3)
    addEvidence('fire-target-persistence', 'Fire Aspectの同一対象への継続命中仮定', FIRE_TARGET_MODEL, 2)
    caveats.push('Fire AspectはPower70–251・1copy限定。Power250のTier I 126649は異常値としてrawに保持し、行全体を補間点から除外（249–251間をlog補間）。最初のhitはt=0、各hit後min(間隔,3秒)を有限encounter内で積分し、範囲外のburn tailを除外します。初撃待ち・tick位相・対象交代は未再現。AoEは同じ対象へ継続命中するlow仮定。重複copyとFire Focusは未実装。')
  }
  if (hasEnchantment(build.enchantments, 'poison-cloud')) {
    addEvidence('poison-overlap-residence', 'Poison Cloudの抽選・滞在・雲重複の飽和仮定', POISON_SATURATION_MODEL, 3)
    caveats.push('Poison CloudはPower184–251・1copy。profile hitごと30%抽選、3秒cloud。初期滞在1.5秒・1.5 target-seconds/cloudは編集可能な仮定。Poisson定常近似で単体1-exp(-発生率×滞在)、AoE=N×(1-exp(-発生率×target-seconds/N))。重なりで独立加算せず飽和させますが、実ゲームのoverlap挙動は未検証。実際のBernoulli cadence・cloud位置・戦闘開始transient・Poison Focusは未再現です。')
  }
  if (hasEnchantment(build.enchantments, 'exploding')) {
    addEvidence('exploding-targets-health', 'Explodingのsource HPと二次対象', EXPLOSION_TARGET_MODEL, 3)
    addEvidence('exploding-source-kills', 'Explodingの直接撃破限定・no-chain', EXPLOSION_KILL_SOURCE, 2)
    caveats.push('ExplodingはPower非依存、倒した敵の最大HPの20/40/60%。平均敵HPをsource max HPと近似し、二次対象=min(1,max(0,射程内敵数-1))、単体DPSは0。直接撃破のみをsourceとして内側固定点で爆発→damage share→直接撃破を解き、外側Rampaging固定点でも再計算。爆発killは新たな爆発を起こしません。遅延・遭遇終了・boss/add HP偏りは未再現です。')
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
  if (hasEnchantment(build.enchantments, 'artifact-synergy')) {
    addEvidence('artifact-synergy-trigger', 'Artifact Synergyの次攻撃条件', ARTIFACT_SYNERGY_TRIGGER)
    addEvidence('artifact-use-rate-model', 'ArtifactのCDごとの使用頻度', ARTIFACT_USE_RATE_MODEL, 2)
    addEvidence('artifact-synergy-pending-charge', 'Artifact Synergyのpending capacity 1仮定', ARTIFACT_SYNERGY_PENDING_CHARGE, 2)
    addEvidence('artifact-synergy-staggering', 'Artifact使用の最適な分散仮定', ARTIFACT_SYNERGY_STAGGERING, 2)
    addEvidence('artifact-synergy-attack-opportunity', 'profile hitを1攻撃とする近似', ARTIFACT_SYNERGY_ATTACK_OPPORTUNITY, 2)
    addEvidence('artifact-synergy-direct-composition', 'Artifact Synergyのdirect倍率合成', ARTIFACT_SYNERGY_DIRECT_COMPOSITION, 2)
    caveats.push('Artifact Synergyは持続時間でなく各Artifactの1/推定CDを合算。pending 1個・最適な分散使用・profile hit=1攻撃・均一hit damage/AoEを仮定し、強化割合=min(使用頻度,HPS)/HPSとします。連打時のqueue/倍率stack、空振り消費、実際のaction粒度は未検証です。')
    caveats.push('Synergyはdirect期待倍率をCommitted前へ適用し、proc damageは増幅しません。Critical/Void等との厳密な合成、Artifact使用animation、戦闘開始burst、実操作による待機は未再現です。')
  }
  if (hasEnchantment(build.enchantments, 'rampaging')) {
    addEvidence('rampaging-direct-kill', 'Rampagingの直接撃破条件', RAMPAGING_DIRECT_KILL, 2)
    addEvidence('rampaging-shared-trigger', 'Rampagingの共通10%発動・duration加算', RAMPAGING_SHARED_TRIGGER, 2)
    addEvidence('rampaging-uptime-model', 'RampagingのPoisson・再発動refresh仮定', RAMPAGING_UPTIME_MODEL, 3)
    addEvidence('rampaging-speed-composition', 'RampagingとArtifact攻撃速度の加算', RAMPAGING_SPEED_COMPOSITION, 2)
    addEvidence('rampaging-mean-cadence', '平均速度によるhit間隔の線形近似', RAMPAGING_MEAN_CADENCE, 3)
    addEvidence('rampaging-fixed-point', '固定点の数値的整合性（実測精度とは別）', RAMPAGING_FIXED_POINT)
    caveats.push('Rampagingは直接撃破の10%で発動、Tier秒数だけ加算し+50%の強さは重ねません。Wikiの10%/30秒例に従う限定モデルで、独立rollと実ゲームのrefresh挙動は未検証です。Poisson uptime=1-exp(-0.1×直接撃破/秒×合計秒数)を固定点で解きます。')
    caveats.push('RampagingはDeath Capと同じ速度bonusへ+0.5×uptimeを加算。平均速度でVoid・proc・撃破を再計算しますが、buffのon/off分布、開始時の立ち上がり、frame上限・Fighter’s Bindingsの非線形速度を再現しません。実際の高速武器の寄与を過大評価し得ます。Armorは対象外です。')
  }
  const usesUnchanting = hasEnchantment(build.enchantments, 'unchanting')
  const directModifierCount = ['sharpness', 'unchanting', 'critical-hit', 'void-strike', 'ambush', 'smiting', 'committed', 'artifact-synergy']
    .filter((id) => build.enchantments.some((selected) => selected.enchantmentId === id)).length
  if (directModifierCount > 1) {
    addEvidence('direct-weapon-composition', '直接近接ダメージのmodifier合成', DIRECT_WEAPON_COMPOSITION, 2)
    caveats.push('Sharpness・Critical・Void・Unchanting・Smiting・Ambush・Artifact Synergyの独立期待倍率から直接DPSを求め、その後CommittedのHP推移を適用します。全interactionの1.17.0.0実機検証は未完了で、proc/DoT・Strength・防具damage auraへ倍率を拡張しません。')
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
    hasEnchantment(build.enchantments, 'refreshment') || hasEnchantment(build.enchantments, 'rampaging')
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
