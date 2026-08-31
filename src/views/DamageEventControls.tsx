import { describeDotOrExplosion } from '../core/dotDamageReasons'
import { dotPowerRange, isDotDamageId } from '../core/dotDamageEvents'
import { DEFAULT_PERSISTENT_AREA_TARGETING, DOT_DAMAGE_IDS } from '../data/dotDamageEvents'
import type { PersistentAreaTargetingAssumptions } from '../core/types'
import type { DamageEventTargetingAssumptions, Evaluation, OwnedWeapon } from '../core/types'
import { enchantmentUnsupportedReason, procPowerRange } from '../core/damageEvents'
import { PROC_DAMAGE_IDS } from '../data/damageEvents'
import { DYNAMO_POWER_RANGE } from '../data/chargeConsume'
import { ENCHANTMENTS } from '../data/enchantments'

export function DamageEventTargetingControl({ value, maximum, onChange }: {
  value: DamageEventTargetingAssumptions
  maximum: number
  onChange: (value: DamageEventTargetingAssumptions) => void
}) {
  return <details className="scenario-values"><summary>追加ダメージの詳細設定（仮定）</summary>
    <p>1イベントが平均何体へ命中するか。全種の初期値1体は範囲の実測がないための共通仮定（low）。武器Areaとは別です。</p>
    {PROC_DAMAGE_IDS.map((id) => <label key={id}><span>{ENCHANTMENTS[id].name.en} 平均命中数</span>
      <input aria-label={`${ENCHANTMENTS[id].name.en} 平均命中数`} type="number" min="1" max={maximum} step="0.1" value={value[id]}
        onChange={(event) => onChange({ ...value, [id]: Number(event.target.value) })} />
    </label>)}
  </details>
}

export function ProcPowerSupport({ weapon }: { weapon: OwnedWeapon }) {
  return <details className="scenario-values"><summary>追加ダメージの対応Power（Phase 2-1D / 2-1H partial）</summary>
    <p>表示ダメージ入力は武器hit専用です。instant procとDoTは武器Powerから算出し、範囲外の候補は評価しません。ExplodingはPower非依存です。確定・金色の範囲外指定はエラーになります。</p>
    {[...PROC_DAMAGE_IDS, ...DOT_DAMAGE_IDS, 'dynamo' as const].map((id) => {
      const range = id === 'dynamo' ? DYNAMO_POWER_RANGE : isDotDamageId(id) ? dotPowerRange(id) : procPowerRange(id)
      const reason = enchantmentUnsupportedReason(weapon, id)
      return <p key={id}>{ENCHANTMENTS[id].name.en}: {range.min}–{range.max} {reason ? '（現在のPowerは未対応）' : '（対応）'}</p>
    })}
  </details>
}

export function DamageEventDetails({ evaluation }: { evaluation: Evaluation }) {
  const { damage, combatState } = evaluation
  if (damage.damageEvents.length + damage.dotDamageEvents.length + damage.explosionDamageEvents.length === 0) return null
  return <details className="contributions"><summary>直接／間接ダメージと撃破帰属</summary>
    <p>直接 単体 {damage.directWeaponSingleTargetDps.toFixed(1)} / AoE {damage.directWeaponAoeDps.toFixed(1)} DPS</p>
    <p>間接 単体 {damage.indirectSingleTargetDps.toFixed(1)} / AoE {damage.indirectAoeDps.toFixed(1)} DPS</p>
    <p>内訳: instant AoE {damage.instantIndirectAoeDps.toFixed(1)} / DoT AoE {damage.dotAoeDps.toFixed(1)} / 爆発 AoE {damage.explosionAoeDps.toFixed(1)} DPS</p>
    {[...damage.dotDamageEvents, ...damage.explosionDamageEvents].map((event) => <p key={event.sourceId}>{describeDotOrExplosion(event)}</p>)}
    {evaluation.temporalState.exploding && <p>爆発固定点: 初期直接撃破 {evaluation.temporalState.exploding.initialDirectKillsPerSecond.toFixed(6)}/秒、初回爆発 {evaluation.temporalState.exploding.firstExplodingAoeDps.toFixed(3)} DPS → 収束 {damage.explosionAoeDps.toFixed(3)} DPS。内側反復累計 {evaluation.temporalState.exploding.iterations}回、最終正規化残差 {evaluation.temporalState.exploding.residual.toExponential(2)}。</p>}
    {damage.damageEvents.map((event) => <p key={event.sourceId}>
      {ENCHANTMENTS[event.sourceId].name.en} Tier {event.tier}: {event.eventsPerSecond.toFixed(3)}回/秒 × {event.damagePerEvent.toFixed(1)} damage/event
      → 単体 {event.singleTargetDps.toFixed(1)} / AoE {event.aoeDps.toFixed(1)} DPS（平均{event.expectedTargetsHit}体）
    </p>)}
    <p>直接damage share {(combatState.directDamageShare * 100).toFixed(1)}%。
      総撃破 {combatState.estimatedKillsPerSecond.toFixed(3)}/秒のうち直接武器撃破 {combatState.directWeaponKillsPerSecond.toFixed(3)}/秒を吸血・ガードストライク・Refreshment・Rampaging・Explodingへ使用します。</p>
    <p>damage割合によるlow-confidence代理計算で、実際のfinal blowの再現ではありません。procへ直接hit倍率は適用せず、instant procとVoidの増幅・消費は未モデル化、DoT／爆発とVoidの併用は未対応です。</p>
  </details>
}

export function PersistentAreaTargetingControl({ value = DEFAULT_PERSISTENT_AREA_TARGETING, maximum, onChange }: {
  value?: PersistentAreaTargetingAssumptions
  maximum: number
  onChange: (value: PersistentAreaTargetingAssumptions) => void
}) {
  return <details className="scenario-values"><summary>Poison Cloudの滞在時間・雲の重なり（仮定）</summary>
    <p>3秒cloud。単体の滞在と、AoEの合計target-seconds/cloudを別に指定します。初期値は実測でなく1.5秒／1.5 target-seconds。重なりはPoisson定常飽和近似（low）です。全3種とVoidの併用、Fire Aspectの複数copyは未対応。</p>
    <label><span>単体の滞在秒数</span><input aria-label="Poison Cloud 単体滞在秒数" type="number" min="0" max="3" step="0.1" value={value.poisonCloudSingleTargetResidenceSeconds}
      onChange={(event) => onChange({ ...value, poisonCloudSingleTargetResidenceSeconds: Number(event.target.value) })} /></label>
    <label><span>AoE target-seconds / cloud</span><input aria-label="Poison Cloud target-seconds" type="number" min={value.poisonCloudSingleTargetResidenceSeconds} max={maximum * 3} step="0.1" value={value.poisonCloudTargetSecondsPerEvent}
      onChange={(event) => onChange({ ...value, poisonCloudTargetSecondsPerEvent: Number(event.target.value) })} /></label>
    <p>AoE target-secondsは単体滞在以上・射程内敵数×3以下。Exploding二次対象は自動で {Math.min(1, Math.max(0, maximum - 1))}体（死亡sourceを除く最大1体の基準値）です。</p>
  </details>
}
