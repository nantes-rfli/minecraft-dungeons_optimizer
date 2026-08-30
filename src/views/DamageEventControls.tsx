import type { DamageEventTargetingAssumptions, Evaluation, OwnedWeapon } from '../core/types'
import { enchantmentUnsupportedReason, procPowerRange } from '../core/damageEvents'
import { PROC_DAMAGE_IDS } from '../data/damageEvents'
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
  return <details className="scenario-values"><summary>追加ダメージの対応Power（Phase 2-1D partial）</summary>
    <p>表示ダメージ入力は武器hit専用です。procは常に武器Powerから算出し、範囲外の候補は評価しません。確定・金色の範囲外指定はエラーになります。</p>
    {PROC_DAMAGE_IDS.map((id) => {
      const range = procPowerRange(id)
      const reason = enchantmentUnsupportedReason(weapon, id)
      return <p key={id}>{ENCHANTMENTS[id].name.en}: {range.min}–{range.max} {reason ? '（現在のPowerは未対応）' : '（対応）'}</p>
    })}
  </details>
}

export function DamageEventDetails({ evaluation }: { evaluation: Evaluation }) {
  const { damage, combatState } = evaluation
  if (damage.damageEvents.length === 0) return null
  return <details className="contributions"><summary>直接／間接ダメージと撃破帰属</summary>
    <p>直接 単体 {damage.directWeaponSingleTargetDps.toFixed(1)} / AoE {damage.directWeaponAoeDps.toFixed(1)} DPS</p>
    <p>間接 単体 {damage.indirectSingleTargetDps.toFixed(1)} / AoE {damage.indirectAoeDps.toFixed(1)} DPS</p>
    {damage.damageEvents.map((event) => <p key={event.sourceId}>
      {ENCHANTMENTS[event.sourceId].name.en} Tier {event.tier}: {event.eventsPerSecond.toFixed(3)}回/秒 × {event.damagePerEvent.toFixed(1)} damage/event
      → 単体 {event.singleTargetDps.toFixed(1)} / AoE {event.aoeDps.toFixed(1)} DPS（平均{event.expectedTargetsHit}体）
    </p>)}
    <p>直接damage share {(combatState.directDamageShare * 100).toFixed(1)}%。
      総撃破 {combatState.estimatedKillsPerSecond.toFixed(3)}/秒のうち直接武器撃破 {combatState.directWeaponKillsPerSecond.toFixed(3)}/秒を吸血・ガードストライク・Refreshmentへ使用します。</p>
    <p>damage割合によるlow-confidence代理計算で、実際のfinal blowの再現ではありません。procへ直接hit倍率は適用せず、Voidの増幅・消費も未モデル化です。</p>
  </details>
}
