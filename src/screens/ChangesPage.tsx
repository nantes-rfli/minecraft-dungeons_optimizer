import { hrefFor } from '../app/routes'
import { CHANGE_ENTRIES } from '../data/changes'

export function ChangesPage() {
  return <main id="main-content" tabIndex={-1} className="page-main narrow-page">
    <header className="page-intro">
      <p className="eyebrow">CHANGELOG</p>
      <h1>変更履歴</h1>
      <p>意味のある変更を簡潔に記録します。Git履歴が詳細の正本で、この一覧は <code>docs/changes.md</code> から表示しています。</p>
    </header>
    <section className="timeline">
      {CHANGE_ENTRIES.map((entry) => <article key={`${entry.date}:${entry.title}`}>
        <time>{entry.date}</time>
        <div>
          <h2>{entry.title}</h2>
          {entry.bullets.length > 0 && <ul>{entry.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
        </div>
      </article>)}
    </section>
    <section className="about-card">
      <h2>このツールについて</h2>
      <p>手持ち装備を、根拠と制限を明示した計算モデルで比較する個人用ツールです。Minecraft、Mojang、Microsoftの公式ツールではありません。</p>
      <p><a href={hrefFor('/data')}>データを見る</a> · <a href={hrefFor('/model')}>モデルを見る</a> · <a href="https://github.com/nantes-rfli/minecraft-dungeons_optimizer/blob/main/docs/changes.md" target="_blank" rel="noreferrer">Changes document</a> · <a href="https://github.com/nantes-rfli/minecraft-dungeons_optimizer" target="_blank" rel="noreferrer">GitHub</a></p>
    </section>
  </main>
}
