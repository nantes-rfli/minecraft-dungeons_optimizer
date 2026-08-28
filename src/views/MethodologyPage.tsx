import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { ROADMAP_PHASES, ROADMAP_PROGRESS, type RoadmapStatus } from '../data/roadmap'
import { WEAPONS } from '../data/weapons'

const Formula = ({ children }: { children: string }) => <code className="formula">{children}</code>
const STATUS_LABELS: Readonly<Record<RoadmapStatus, string>> = {
  done: '完了',
  'in-progress': '進行中',
  planned: '未着手',
}

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
          <p>Power換算したbase hit damage、per-hit Attack Profile、クリティカル期待値、虚無の一撃の経過時間モデルを合成します。範囲値から平均命中数を推定しAoEを別指標にします。</p>
          <Formula>Crit期待倍率 = 1 + 0.20 × (3.0 − 1) = 1.4</Formula>
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
        <p className="section-label">対応データ / SUPPORTED DATA</p>
        <div className="support-columns">
          <div><h3>武器（{Object.keys(WEAPONS).length}）</h3>{Object.values(WEAPONS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>エンチャント（{Object.keys(ENCHANTMENTS).length}）</h3>{Object.values(ENCHANTMENTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
          <div><h3>アーティファクト（{Object.keys(ARTIFACTS).length}）</h3>{Object.values(ARTIFACTS).map((item) => <p key={item.id}>{item.name.ja}<small>{item.name.en}</small></p>)}</div>
        </div>
      </section>

      <section className="status-section">
        <p className="section-label">仕様書に対する現在地</p>
        <div className="progress-heading"><div><h2>v1.0 Roadmap</h2><p>Phase 0 / 0.5 / 0.5.1 / 1Aを完了し、Phase 1 Accuracyを進行中です。</p></div><strong>{ROADMAP_PROGRESS.percentage}%<small>{ROADMAP_PROGRESS.completed} / {ROADMAP_PROGRESS.total} 項目</small></strong></div>
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
        <p>Power換算は公開Anchor表のPower 50〜263をlog補間したmedium-confidence値です。同Powerでもitem cardの表示値には幅があり、正確な個体値には表示ダメージ入力が必要です。平均敵HPなどもdamageと同じゲーム内単位で入力してください。Evidence coverageは正解確率ではなく、実際の計算経路に含まれるEvidenceの品質指標です。実測回帰サンプルが5件揃うまでは誤差率を推測しません。</p>
      </section>
    </main>
  )
}
