import { summarizeDamageRegression } from '../core/modelError'
import { DAMAGE_REGRESSION_SAMPLES } from '../data/regressionSamples'
import {
  FUTURE_CANDIDATES,
  ROADMAP_STATUS_ORDER,
  ROADMAP_TRACKS,
  workUnitsForTrack,
  type RoadmapTrackId,
  type RoadmapWorkStatus,
} from '../data/roadmap'
import { hrefFor } from '../app/routes'
import { ArtifactRuntimeSupportSection } from './ArtifactRuntimeSupport'
import { DataCoverageSection } from './DataCoverage'
import { DpsRegressionPanel } from './DpsRegressionPanel'
import { RuntimeSupportSection } from './RuntimeSupport'

const Formula = ({ children }: { children: string }) => <code className="formula">{children}</code>
const STATUS_LABELS: Readonly<Record<RoadmapWorkStatus, string>> = {
  done: '完了',
  current: '進行中',
  next: '次',
  blocked: '保留',
  later: '将来',
}
const TRACK_ORDER: readonly RoadmapTrackId[] = ['research', 'product']
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)
const DOC_BASE = 'https://github.com/nantes-rfli/minecraft-dungeons_optimizer/blob/main/docs'
const MODEL_DETAIL_GROUPS = [
  {
    title: 'Damage / State',
    description: '直接倍率、敵状態、追加damage、DoT、時間状態、charge/consume。',
    docs: [
      ['Direct modifiers', 'damage-modifiers.md'],
      ['Enemy-state damage', 'enemy-state-damage.md'],
      ['Damage events', 'damage-events.md'],
      ['DoT / explosion', 'dot-and-explosion-damage.md'],
      ['Temporal state', 'temporal-enchantments.md'],
      ['Charge / consume', 'charge-consume-enchantments.md'],
    ],
  },
  {
    title: 'Control / Soul',
    description: 'Controlを独立指標として扱う境界と、Soulの取得・蓄積・消費。',
    docs: [
      ['CC utility', 'cc-utility.md'],
      ['Soul subsystem', 'soul-subsystem.md'],
      ['Soul scheduler', 'soul-resource-scheduler.md'],
    ],
  },
  {
    title: 'Equipment Runtime',
    description: 'Ranged、Armor、Artifactの入力契約、runtime対応範囲、未対応境界。',
    docs: [
      ['Ranged runtime', 'ranged-runtime.md'],
      ['Armor model', 'armor-model.md'],
      ['Armor runtime', 'armor-runtime-support.md'],
      ['Artifact model', 'artifact-model.md'],
      ['Artifact runtime', 'artifact-runtime-support.md'],
    ],
  },
  {
    title: 'Evidence / Validation',
    description: '独立回帰、runtime limitation、Evidenceからruntimeへの採用境界。',
    docs: [
      ['DPS regression', 'model-regression.md'],
      ['Runtime limitations', 'runtime-limitations.md'],
      ['Runtime promotion', 'runtime-promotion-pipeline.md'],
    ],
  },
] as const

export function MethodologyPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <header className="page-header">
        <p className="eyebrow">MODEL & IMPLEMENTATION</p>
        <h1>計算ロジックと<br />実装状況</h1>
        <p className="lede">
          このツールが何を入力にし、どの流れで比較し、どこからが推定なのかを公開します。
          個別mechanicの詳細は再掲せず、現在の全体像と正本への導線をまとめます。
        </p>
      </header>
      <a className="back-link" href={hrefFor('/model/evidence')}>← Evidence / 精度の概要へ戻る</a>

      <DataCoverageSection />
      <p className="methodology-history-note">このページは現在仕様の概要です。旧Phaseの実装順序と完了履歴は<a href={`${DOC_BASE}/historical-roadmap.md`} target="_blank" rel="noreferrer">Historical Roadmap</a>、mechanicごとの詳細は下記の技術文書へ分離しています。</p>

      <RuntimeSupportSection />
      <ArtifactRuntimeSupportSection />

      <section className="method-section">
        <p className="section-label">CALCULATION FLOW</p>
        <h2>Optimizer全体の計算フロー</h2>
        <p>個別の係数や例外条件は各モデル文書へ寄せ、ここでは現在の評価pipelineだけを示します。</p>
      </section>

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
          <p>表示ダメージまたは検証済みPower経路とAttack Profileからbase DPSを求め、直接hitと追加damageを分離して評価します。敵状態や時間状態を使う効果は、それぞれのモデル境界に従って合成します。</p>
          <Formula>total damage = direct weapon damage + supported indirect damage</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">03 / 回復</p>
          <h2>回復容量と実回復を混同しない</h2>
          <p>Radiance、Leeching、Potion系などを発動条件ごとに計算します。overhealや有限戦闘を完全再現していない経路はcapacity / proxyとして明示し、未知値を補完しません。</p>
          <Formula>net sustain = supported healing capacity − modeled self damage</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">04 / 防御・Control</p>
          <h2>被ダメージと行動阻害を分離</h2>
          <p>DR familyは確認済みの合成境界だけを使い、ControlはHard disable / slow / root / groupingの独立指標として扱います。Controlを根拠なくDRへ換算しません。</p>
          <Formula>EHP = 最大HP ÷ 被ダメ倍率</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">05 / スコア</p>
          <h2>目的別Utilityへ変換</h2>
          <p>Damage / Healing / Defense / ControlをScenarioの目標と重みに沿って比較します。未対応効果やunknown値を0や倍率1へ置き換えて候補へ混ぜません。</p>
          <Formula>score = weighted supported utilities</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">06 / 説明可能性</p>
          <h2>効果を外して差分を見る</h2>
          <p>選ばれた効果を1つずつ除外して再計算し、スコア・DPS・回復・実効HP・Control utilityの差分を表示します。</p>
          <Formula>寄与度 = 完成ビルド − その効果を外したビルド</Formula>
        </article>
      </section>

      <section className="method-section">
        <p className="section-label">MODEL DETAILS</p>
        <h2>モデル別の詳細仕様</h2>
        <p>以下は現在の実装を支える技術文書です。数式、Evidence、support gate、未解決事項はここへ集約し、この画面では重複掲載しません。</p>
        <div className="method-grid">
          {MODEL_DETAIL_GROUPS.map((group) => <article className="method-card" key={group.title}>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <ul>{group.docs.map(([label, file]) => <li key={file}><a href={`${DOC_BASE}/${file}`} target="_blank" rel="noreferrer">{label}</a></li>)}</ul>
          </article>)}
        </div>
      </section>

      <section className="method-section regression-methodology">
        <p className="section-label">DPS実測回帰 / EMPIRICAL MODEL ERROR</p>
        <h2>独立した観測値が揃うまで誤差範囲を出さない</h2>
        <DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} />
        <p>理論表や既存モデルから作った値を独立sampleとして数えません。採用条件、除外理由、集計方法は<a href={`${DOC_BASE}/model-regression.md`} target="_blank" rel="noreferrer">DPS regression文書</a>を正本とします。</p>
      </section>

      <section className="method-section">
        <p className="section-label">DATA CATALOG</p>
        <h2>収録データはデータ画面で確認</h2>
        <p>装備・Enchantの件数や個別の既知/未知PropertyはMethodologyへ重複掲載せず、<a href={hrefFor('/data')}>データ画面</a>で確認できます。</p>
      </section>

      <section className="status-section">
        <p className="section-label">DUAL-TRACK ROADMAP</p>
        <div className="roadmap-heading"><div><h2>ResearchとProductを並行して進める</h2><p>Research全体の完了を待たず、採用条件を満たしたparameter / mechanicだけをProductへ渡します。</p></div><a href={`${DOC_BASE}/historical-roadmap.md`} target="_blank" rel="noreferrer">Historical Roadmap</a></div>
        <div className="track-grid">
          {TRACK_ORDER.map((trackId) => {
            const track = ROADMAP_TRACKS[trackId]
            const units = workUnitsForTrack(trackId)
            return <article className={`roadmap-track ${trackId}`} key={trackId}><header><p>{trackId.toUpperCase()}</p><h3>{track.title}</h3><span>{track.goal}</span></header>{ROADMAP_STATUS_ORDER.map((status) => {
              const matching = units.filter((unit) => unit.status === status)
              if (!matching.length) return null
              return <section className="roadmap-status-group" key={status}><h4>{STATUS_LABELS[status]}</h4><div>{matching.map((unit) => <article className="roadmap-unit" key={unit.id}><div><strong>{unit.id}</strong><span className={`status ${unit.status}`}>{STATUS_LABELS[unit.status]}</span></div><h5>{unit.title}</h5><p>{unit.goal}</p>{unit.nextAction && <small>Next: {unit.nextAction}</small>}</article>)}</div></section>
            })}</article>
          })}
        </div>
        <div className="handoff-flow" aria-label="ResearchからProductへのhandoff"><span>Research Evidence</span><b>→</b><span>Adoption Decision</span><b>→</b><span>Promotion Eligibility</span><b>→</b><span>Runtime / Coverage</span></div>
      </section>

      <section className="method-section"><h2>Future Candidates</h2><p>以下は実施決定前の候補で、Current / Nextには含めません。</p>{FUTURE_CANDIDATES.map((candidate) => <article key={candidate.id}><h3>{candidate.title}</h3><p>{candidate.goal}</p></article>)}</section>

      <section className="warning-panel">
        <h2>精度上の重要な制約</h2>
        <p>Coverageは正解確率ではありません。Limited / unsupported、Evidence confidence、独立回帰は別軸です。target switching、overheal、複数効果の相関などを完全再現していないモデルがあり、未確認値を0や倍率1へ置換しません。個別の制約とclose条件は<a href={`${DOC_BASE}/runtime-limitations.md`} target="_blank" rel="noreferrer">Runtime limitations</a>を参照してください。</p>
      </section>
    </main>
  )
}
