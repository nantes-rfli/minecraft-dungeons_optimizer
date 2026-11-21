import type { Evaluation, Scenario, CrowdControlAssumptions, ControlPolicyWeights } from '../core/types'
import { CHAINS_ISOLATION_REQUIREMENT } from '../core/isolatedChainsReuse'
import { describeControl } from '../core/control'

const percent = (value: number) => `${(value * 100).toFixed(2)}%`
export function ControlDetails({ evaluation }: { evaluation: Evaluation }) {
  const { control } = evaluation
  return <details className="contributions">
    <summary>Control — 行動阻害・集敵の内訳</summary>
    <p>Control utility {percent(control.utility)}。4指標の重み付き平均による好みのスコアです。被ダメージ削減率ではありません。</p>
    <dl className="control-metrics">
      <div><dt>Hard disable / 移動・攻撃不能</dt><dd>{percent(control.hardDisableCoverage)}</dd></div>
      <div><dt>Attack slow / 敵攻撃速度低下</dt><dd>{percent(control.attackSlowEquivalentCoverage)}</dd></div>
      <div><dt>Root / 移動束縛</dt><dd>{percent(control.rootCoverage)}</dd></div>
      <div><dt>Grouping / 集敵</dt><dd>{percent(control.groupingCoverage)}</dd></div>
    </dl>
    <ul>{describeControl(control).map((reason) => <li key={reason}>{reason}</li>)}</ul>
    <p>異なるCCの重なりは敵行動の抑制率として合算しません。攻撃速度にはDeath Capと収束後のRampagingを使用しますが、CCからDPS・回復・防御・撃破数への補正はありません。</p>
  </details>
}

const SHARES = [
  ['stunningEligibleTargetShare', 'Stunning 適用可能な対象割合'],
  ['chainsEligibleTargetShare', 'Chains 適用可能な対象割合'],
  ['freezingEligibleTargetShare', 'Freezing 適用可能な対象割合'],
  ['gravityEligibleTargetShare', 'Gravity 適用可能な対象割合'],
  ['stunningEffectiveDurationMultiplier', 'Stunning 持続時間補正'],
  ['shockPowderEligibleTargetShare', 'Shock Powder 適用可能な対象割合'],
  ['shockPowderAffectedTargetShare', 'Shock Powder 影響対象割合'],
  ['snowballEligibleTargetShare', 'Snowball 適用可能な対象割合'],
] as const satisfies readonly (readonly [keyof CrowdControlAssumptions, string])[]
const POLICIES = [
  ['hardDisable', '移動・攻撃不能の重み'], ['attackSlow', '敵攻撃速度低下の重み'],
  ['root', '移動束縛の重み'], ['grouping', '集敵の重み'],
] as const satisfies readonly (readonly [keyof ControlPolicyWeights, string])[]

export function ControlSettings({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const assumptions = scenario.crowdControl
  const changeAssumption = (key: keyof CrowdControlAssumptions, value: number) => onChange({ ...scenario, crowdControl: { ...assumptions, [key]: value } })
  const isolation = assumptions.chainsIsolation?.encounterDurationSeconds === scenario.encounterDurationSeconds ? assumptions.chainsIsolation : undefined
  const confirmIsolation = (key: 'noOtherEligibleCandidates' | 'initiallyUnchained', value: string) => {
    const next = { ...isolation, encounterDurationSeconds: scenario.encounterDurationSeconds, [key]: value === 'unknown' ? undefined : value === 'true' }
    onChange({ ...scenario, crowdControl: { ...assumptions, chainsIsolation: next } })
  }
  return <details className="scenario-values">
    <summary>詳細設定 / Controlの仮定と評価方針</summary>
    <fieldset>
      <legend>Flail / Jailor’s Scytheの孤立条件</legend>
      <p>{CHAINS_ISOLATION_REQUIREMENT} 距離や平均敵数から自動判定しません。敵・味方・召喚物を含む候補や、途中で入ってくる候補が不明なら未確認を選んでください。</p>
      {([['noOtherEligibleCandidates', 'Chains 孤立条件（全評価期間）'], ['initiallyUnchained', '開始時のChains状態なし']] as const).map(([key, label]) => <label key={key}>
        <span>{label}</span><select aria-label={label} value={isolation?.[key] === undefined ? 'unknown' : String(isolation[key])} onChange={(event) => confirmIsolation(key, event.target.value)}>
          <option value="unknown">未確認</option><option value="true">確認済み・条件を満たす</option><option value="false">条件を満たさない</option>
        </select>
      </label>)}
      <small>現在の評価時間 {scenario.encounterDurationSeconds} 秒に対する確認です。評価時間を変えたら両条件を確認し直してください。</small>
    </fieldset>
    <p>適用割合は免疫などをまとめた対象・時間の仮定です。初期値は共通50%、bossのStunningとShock Powderのみ0%。powerful mobとApocalypse+の耐性は未確定です。</p>
    {SHARES.map(([key, label]) => {
      const value = assumptions[key] ?? (key === 'snowballEligibleTargetShare' && scenario.profileId === 'boss' ? 0 : 1)
      return <label key={key}><span>{label}<output>{percent(value)}</output></span>
        <input aria-label={label} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => changeAssumption(key, Number(event.target.value))} />
      </label>
    })}
    <small>Stunningは低信頼度の基準2秒 × 持続時間補正。初期補正1は耐性がないことの証明ではありません。</small>
    <small>Shock Powderは適用可能割合 × 使用時に範囲内で影響を受ける割合を分離します。敵数やstun tickをArtifact使用回数へ掛けません。</small>
    {([['chainsExpectedTargetsPerProc', 'Chains 平均対象数 / proc'], ['gravityExpectedTargetsPerHit', 'Gravity 平均対象数 / hit']] as const).map(([key, label]) => <label key={key}>
      <span>{label}</span><input aria-label={label} type="number" min="1" max={scenario.averageTargetsInReach} step="any" value={assumptions[key]} onChange={(event) => changeAssumption(key, Number(event.target.value))} />
    </label>)}
    <small>範囲は1〜射程内の敵数。初期1体は半径・密度の実測がないための保守的な仮定です。</small>
    <p>以下はゲームの強さの証拠ではなく、Control utility内の順位付けの好みです。初期値は等重み。全て0ならControl utilityは0です。</p>
    {POLICIES.map(([key, label]) => <label key={key}><span>{label}</span><input aria-label={label} type="number" min="0" step="0.1" value={scenario.controlPolicy[key]} onChange={(event) => onChange({ ...scenario, controlPolicy: { ...scenario.controlPolicy, [key]: Number(event.target.value) } })} /></label>)}
  </details>
}
