import coverage from '../../research/evidence-coverage-dashboard.json'

const category = (id: string) => {
  const item = coverage.categories.find((entry) => entry.id === id)
  if (!item) throw new Error(`Coverage category is missing: ${id}`)
  return item
}
const melee = category('melee-attack-profile')
const armor = category('armor')
const ranged = category('ranged-weapon')
const artifact = category('artifact')
const enchantCategories = [category('melee-enchantment'), category('armor-enchantment'), category('ranged-enchantment')]
const enchantPopulation = enchantCategories.reduce((sum, item) => sum + item.population, 0)

export function DataSummary() {
  return <>
    <section className="summary-grid data-summary" aria-label="収録データ件数">
      <article><span>近接武器</span><strong>{melee.population}</strong><p>日本語名・武器系統・攻撃データ</p></article>
      <article><span>防具</span><strong>{armor.population}</strong><p>日本語名・固有効果・装備データ</p></article>
      <article><span>遠距離武器</span><strong>{ranged.population}</strong><p>日本語名・武器系統・発射方法</p></article>
      <article><span>アーティファクト</span><strong>{artifact.population}</strong><p>日本語名・再使用時間・効果分類</p></article>
      <article className="enchant-summary"><span>エンチャント</span><strong>{enchantPopulation}</strong><dl><div><dt>近接</dt><dd>{enchantCategories[0]!.population}</dd></div><div><dt>防具</dt><dd>{enchantCategories[1]!.population}</dd></div><div><dt>遠距離</dt><dd>{enchantCategories[2]!.population}</dd></div></dl><p>装備の種類ごとに探せます。</p></article>
    </section>
  </>
}
