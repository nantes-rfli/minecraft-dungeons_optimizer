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

function RuntimeSummary({ item }: { item: typeof armor }) {
  return <p><b>{item.runtime.full}</b> Full · <b>{item.runtime.limited}</b> Limited · <b>{item.runtime.researchOnly}</b> Research-only</p>
}

export function DataSummary() {
  return <>
    <section className="summary-grid data-summary" aria-label="データ対応状況">
      <article><span>近接武器</span><strong>{melee.population}</strong><p>監査対象の入手可能武器 · Attack profileは別軸で確認</p></article>
      <article><span>防具</span><strong>{armor.population}</strong><RuntimeSummary item={armor} /></article>
      <article><span>遠距離武器</span><strong>{ranged.population}</strong><RuntimeSummary item={ranged} /></article>
      <article><span>Artifact</span><strong>{artifact.population}</strong><RuntimeSummary item={artifact} /></article>
      <article className="enchant-summary"><span>Enchant</span><strong>{enchantPopulation}</strong><dl><div><dt>近接</dt><dd>{enchantCategories[0]!.population}</dd></div><div><dt>防具</dt><dd>{enchantCategories[1]!.population}</dd></div><div><dt>遠距離</dt><dd>{enchantCategories[2]!.population}</dd></div></dl><p>用途別catalogの件数合計です。同じIDが複数カテゴリに属する場合は、各カテゴリで1件ずつ数えます。</p></article>
    </section>
  </>
}
