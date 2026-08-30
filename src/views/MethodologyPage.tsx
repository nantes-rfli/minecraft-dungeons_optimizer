import auditJson from '../../research/dps-regression-audit.json'
import { summarizeDamageRegression } from '../core/modelError'
import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { DAMAGE_REGRESSION_SAMPLES } from '../data/regressionSamples'
import { ROADMAP_PHASES, ROADMAP_PROGRESS, type RoadmapStatus } from '../data/roadmap'
import { WEAPONS } from '../data/weapons'
import { SHARPNESS_SOURCE, UNCHANTING_SOURCE } from '../data/sources'
import {
  summarizeDpsRegressionAudit,
  type DpsRegressionAudit,
} from '../research/dpsRegressionAudit'
import { DpsRegressionPanel } from './DpsRegressionPanel'

const Formula = ({ children }: { children: string }) => <code className="formula">{children}</code>
const STATUS_LABELS: Readonly<Record<RoadmapStatus, string>> = {
  done: '完了',
  'in-progress': '進行中',
  planned: '未着手',
}
const DPS_AUDIT = auditJson as unknown as DpsRegressionAudit
const DPS_AUDIT_SUMMARY = summarizeDpsRegressionAudit(DPS_AUDIT)
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)
const DPS_AUDIT_SOURCES = [...new Map(
  DPS_AUDIT.entries.map((entry) => [entry.source.id, entry.source]),
).values()]

export function MethodologyPage() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">MODEL & IMPLEMENTATION / v0.1</p>
        <h1>計算ロジックと<br />実装状況</h1>
        <p className="lede">
          このツールが何を入力にし、どの式で比較し、どこからが推定なのかを公開します。
          数値だけでなく「なぜその装備なのか」を検証できる設計です。
        </p>
      </header>

      <section className="method-grid">
        <article className="method-card">
          <p className="section-label">01 / 探索</p>
          <h2>手持ち候補を全組み合わせ</h2>
          <p>各武器の3スロットから候補を1つずつ選び、最大3個のアーティファクトと組み合わせます。tierと通常・金色の出所を保持し、non-stackableな重複は候補から除外します。現在は近似探索ではなく全探索です。</p>
          <Formula>候補数 = Σ（各スロット候補数の積 × アーティファクト構成数）</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">02 / 火力</p>
          <h2>単体DPSとAoEを分離</h2>
          <p>表示ダメージまたはPower換算値とAttack Profileからbase DPSを求め、Sharpness、Critical、Void、敵割合に依存するUnchantingを直接近接hitだけへ合成します。Voidは最初のhitを1倍、以後は各hit間隔の倍率を使い、毎hit再適用します。平均命中数からAoEを別指標にします。</p>
          <Formula>Crit期待倍率 = 1 + 0.20 × (3.0 − 1) = 1.4</Formula>
          <Formula>単体DPS = baseDps × Sharpness × Crit × Void × (1 + enchantedShare × Unchanting bonus)</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">03 / 回復</p>
          <h2>Proc型と撃破型を分離</h2>
          <p>輝きは攻撃回数に比例し、複数コピーは発動率を増やさず回復量へ100%・75%・50%・25%の係数を適用します。吸血はCombat Stateが算出した武器本体の直接撃破数に比例します。</p>
          <Formula>直接撃破/s = min（敵供給/s, AoE DPS ÷ 平均敵HP）× 直接撃破率</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">04 / 防御</p>
          <h2>稼働率から実効HPへ</h2>
          <p>ガードストライクは武器本体の直接撃破数から稼働率を求め、アイアンハイドとともに被ダメ倍率へ反映します。同種Artifactは効果量を重ねず、交互使用による継続時間の更新として扱います。</p>
          <Formula>EHP = 最大HP ÷ 被ダメ倍率</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">05 / スコア</p>
          <h2>過剰回復を飽和させる</h2>
          <p>火力・回復は無制限に直線加点せず、目標値を超えるほど追加価値を小さくします。シナリオごとの重みで最後に0〜100へ統合します。</p>
          <Formula>Utility(x) = 1 − exp(−x ÷ target)</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">06 / 説明可能性</p>
          <h2>効果を1つずつ外して再計算</h2>
          <p>選ばれたエンチャントとアーティファクトを1つずつ除外し、スコア・DPS・回復・実効HPの差分を表示します。</p>
          <Formula>寄与度 = 完成ビルド − その効果を外したビルド</Formula>
        </article>
      </section>

      <section className="method-section">
        <p className="section-label">PHASE 2-1B / DIRECT MELEE MODIFIERS</p>
        <h2>敵の割合を含めた期待値</h2>
        <p>切れ味（Sharpness）はTier I / II / IIIで+10% / +21% / +33%。最大4コピーを乗算し、通常Tier III＋金色Tier Iなら1.33 × 1.1です。エンチャント解除（Unchanting）は+50% / +75% / +100%をエンチャント敵だけへ適用し、重複不可です。</p>
        <Formula>Unchanting期待倍率 = (1 − e) × 1 + e × (1 + b) = 1 + e × b</Formula>
        <p>eは直接武器ダメージの対象に占めるエンチャント敵の期待割合、bはTier bonusです。両群を同じbaseline damageで重み付けし、敵ごとのHP・エンチャント敵のHP偏り・優先target・遭遇順序を無視します。Tier IIIで割合0%なら1倍、25%なら1.25倍、100%なら2倍です。</p>
        <p>全6profile（ボスを含む）の初期値25%はMVP model assumption / confidence lowで、実測値ではありません。「エンチャントされた敵の割合」で0〜100%に変更できます。Unchanting選択時だけ敵割合と期待値モデルをEvidenceへ追加し、割合0の寄与0も正常な結果として表示します。</p>
        <p>倍率はこのモデルの直接hit上では数値上交換可能です。ただしCritical判定・Voidの攻撃間隔・敵状態の独立性と全interactionの実機確認は未完了のため、合成Evidenceはlowです。proc/DoT、Shockwave、Swirling、Thundering、Strengthや防具の加算bonusへ一般化しません。</p>
        <p>Tier・stacking・対象条件の根拠はhighで、合成や敵割合の仮定と分けています。出典: <a href={SHARPNESS_SOURCE.url} target="_blank" rel="noreferrer">Sharpness</a> / <a href={UNCHANTING_SOURCE.url} target="_blank" rel="noreferrer">Unchanting</a>（1.17.0.0由来公開データ）。runtime対応は7 / 33、未対応26種は候補に登録しません。</p>
      </section>

      <section className="method-section regression-methodology">
        <p className="section-label">DPS実測回帰 / EMPIRICAL MODEL ERROR</p>
        <h2>公開観測値だけでend-to-end誤差を測る</h2>
        <DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} />
        <div className="regression-audit-grid">
          <div><span>公開候補</span><strong>{DPS_AUDIT_SUMMARY.candidateCount}</strong></div>
          <div><span>eligible</span><strong>{DPS_AUDIT_SUMMARY.eligibleCount}</strong></div>
          <div><span>rejected</span><strong>{DPS_AUDIT_SUMMARY.rejectedCount}</strong></div>
          <div><span>1.17.0.0 verified</span><strong>{DPS_AUDIT_SUMMARY.versionConfidenceCounts.verified}</strong></div>
        </div>
        <p>対象は同一targetへの連続hitを再現するsingle-target controlled measurementです。表示ダメージ、attack speed、Enchant / Artifact、計測時間またはDPS、target条件が揃う公開runだけを採用します。Power Curve、Wiki理論表、dungeons.tools計算値、runtime Attack Profile、既存Void Strike curveから作った値は回帰sampleへ入れません。</p>
        <p>今回の監査では条件を再現できる公開sampleは0件でした。武器別coverageは Fighter&apos;s Bindings {DPS_AUDIT_SUMMARY.eligibleByWeapon['fighters-bindings']}件、Double Axe {DPS_AUDIT_SUMMARY.eligibleByWeapon['double-axe']}件、Anchor {DPS_AUDIT_SUMMARY.eligibleByWeapon.anchor}件です。主な除外理由はrun-level raw total / duration不足、observedDamagePerHit不足、完全な速度・build・target条件不足、旧版またはversion不明、計算表の再掲、component validationのみ、です。</p>
        <p>Power scaling・Attack timing・Void Strike timingのcomponent validationは別に存在しますが、full DPS sample数には加算しません。5件に達するまでMAPE / P90 / biasと予測参考範囲はavailable扱いにしません。</p>
        <details className="audit-sources"><summary>監査した公開source（{DPS_AUDIT_SOURCES.length}件）</summary><ul>{DPS_AUDIT_SOURCES.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul></details>
      </section>

      <section className="method-section">
        <p className="section-label">対応データ / SUPPORTED DATA</p>
        <div className="support-columns">
          <div><h3>武器（{Object.keys(WEAPONS).length}）</h3>{Object.values(WEAPONS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>エンチャント（{Object.keys(ENCHANTMENTS).length}）</h3>{Object.values(ENCHANTMENTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>アーティファクト（{Object.keys(ARTIFACTS).length}）</h3>{Object.values(ARTIFACTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
        </div>
      </section>

      <section className="status-section">
        <p className="section-label">仕様書に対する現在地</p>
        <div className="progress-heading"><div><h2>v1.0 Roadmap</h2><p>Phase 0 / 0.5 / 0.5.1 / 1A / 2-1A / 2-1Bを完了。近接runtimeは7 / 33。次はPhase 2-1Cです。近接25〜30種への拡張とPhase 1の公開実測回帰は未完了です。</p></div><strong>{ROADMAP_PROGRESS.percentage}%<small>{ROADMAP_PROGRESS.completed} / {ROADMAP_PROGRESS.total} 項目</small></strong></div>
        <div className="progress-track" aria-label={`ロードマップ進捗${ROADMAP_PROGRESS.percentage}%`}><span style={{ width: `${ROADMAP_PROGRESS.percentage}%` }} /></div>
        <div className="roadmap-grid">
          {ROADMAP_PHASES.map((phase) => {
            const completed = phase.items.filter((item) => item.status === 'done').length
            return <article className="roadmap-phase" key={phase.id}><div><p>{completed} / {phase.items.length}</p><h3>{phase.title}</h3></div><p>{phase.goal}</p><ul>{phase.items.map((item) => <li key={item.label}><span className={`status ${item.status}`}>{STATUS_LABELS[item.status]}</span>{item.label}</li>)}</ul></article>
          })}
        </div>
      </section>

      <section className="warning-panel">
        <h2>精度上の重要な制約</h2>
        <p>Power換算は公開Anchor表をlog補間し、1.17.0.0の内部Power rating比を適用するmedium-confidence値です。Void Strikeは公開community測定に基づくlow-confidenceのDecision Bモデル（付与hit 1倍、armed後1.25倍、3.6秒でTier III 7倍、5秒で消滅）で、frame実測済みではありません。厳密なcurve、tier別minimum、外部damage消費は未確定です。同じtargetへの連続hitを前提とするため、target switchingがあるmobbingではVoid Strike DPSを過大評価し得ます。version不明のWiki damage表29件とは最大45.06%ずれます。Evidence coverageとDPS実測回帰は別指標で、前者は正解確率ではありません。</p>
      </section>
    </main>
  )
}
