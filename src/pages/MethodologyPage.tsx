import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'

const Formula = ({ children }: { children: string }) => <code className="formula">{children}</code>

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
          <p>各武器の3スロットから候補を1つずつ選び、最大3個のアーティファクトと組み合わせます。現在は近似探索ではなく全探索です。</p>
          <Formula>候補数 = Σ（各スロット候補数の積 × アーティファクト構成数）</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">02 / 火力</p>
          <h2>単体DPSとAoEを分離</h2>
          <p>攻撃力、暫定Attack Profile、クリティカル期待値、虚無の一撃の経過時間モデルを合成します。範囲値から平均命中数を推定しAoEを別指標にします。</p>
          <Formula>Crit期待倍率 = 1 + 0.20 × (3.0 − 1) = 1.4</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">03 / 回復</p>
          <h2>Proc型と撃破型を分離</h2>
          <p>輝きは攻撃回数に、吸血は直接撃破数に比例します。撃破を伴わないボス戦では吸血が自然に低く評価されます。</p>
          <Formula>輝きHPS = hit/s × 発動率 × 1回の回復量</Formula>
        </article>
        <article className="method-card">
          <p className="section-label">04 / 防御</p>
          <h2>稼働率から実効HPへ</h2>
          <p>ガードストライクとアイアンハイドの平均稼働率を被ダメ倍率へ反映し、実効HPとして比較します。</p>
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
        <h2>Phase 0 — Optimizer Core検証版</h2>
        <div className="status-list">
          <p><span className="status done">実装済み</span>個体別の手持ち登録、候補エンチャント、装備パワー、localStorage、JSON入出力</p>
          <p><span className="status done">実装済み</span>evaluate / optimize、全探索、目的別シナリオ、Pareto前線、数値寄与度、根拠と信頼度</p>
          <p><span className="status partial">暫定</span>武器Attack Profile、虚無の一撃、範囲命中数、装備パワーと実ダメージの換算</p>
          <p><span className="status todo">次段階</span>防具・遠距離、25〜30エンチャント、10〜15アーティファクト、Web Worker</p>
        </div>
      </section>

      <section className="warning-panel">
        <h2>精度上の重要な制約</h2>
        <p>現在のDPSは比較用の正規化値です。ゲーム内表示と同じ実ダメージではありません。特に武器ごとのコンボ時間は暫定換算で、実測Attack Profileへ置き換える必要があります。推測値は計算コードへ直接埋め込まず、source / confidence付きのデータとして分離しています。</p>
      </section>
    </main>
  )
}
