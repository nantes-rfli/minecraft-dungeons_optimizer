import { useEffect, useMemo } from 'react'
import type { Inventory, Scenario } from '../core/types'
import type { ReadinessStatus } from '../core/readiness'
import { inventoryGridItems } from '../inventory/gridPresentation'
import { useOptimizer } from '../optimizer/useOptimizer'

const READINESS_LABELS: Record<ReadinessStatus, string> = {
  evaluated: '評価可能', 'input-required': '入力不足', unsupported: '未対応', constrained: '条件・組み合わせ制約', failed: '評価処理失敗',
}

export function InventoryReadinessPanel({ inventory, scenario, onEdit, onOpenScenario }: {
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly onEdit: (name: string, instanceId: string) => void
  readonly onOpenScenario: () => void
}) {
  const search = useOptimizer(inventory, scenario, false, undefined, undefined, undefined, undefined, true)
  const { status, start } = search
  useEffect(() => {
    if (status !== 'idle') return
    const timer = setTimeout(start, 350)
    return () => clearTimeout(timer)
  }, [status, start])
  const items = useMemo(() => new Map(inventoryGridItems(inventory).map((item) => [item.instanceId, item])), [inventory])
  return <section className="inventory-readiness" aria-labelledby="inventory-readiness-title">
    <h2 id="inventory-readiness-title">所持装備の評価可能性</h2>
    <p>現在の最適化条件「{scenario.name}」と所持装備全体で確認します。評価可能は、この個体を含む構成の数値評価が成功したことを示します。未評価は0点ではありません。</p>
    <p role="status">{status === 'idle' || status === 'working' ? '評価可能性を確認しています…' : status === 'complete' ? '評価可能性を確認しました。入力・条件を変えると再確認します。' : status === 'cancelled' ? '確認を中止しました。' : '評価可能性の確認処理が失敗しました。'}</p>
    {status === 'working' && <button type="button" onClick={search.cancel}>確認を中止</button>}
    {(status === 'error' || status === 'cancelled') && <button type="button" onClick={start}>評価可能性を再確認</button>}
    {search.error && <p role="alert">{search.error}</p>}
    {search.readiness && <>
      <dl className="readiness-counts">{Object.entries(READINESS_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{search.readiness!.equipment.filter((entry) => entry.status === key).length}件</dd></div>)}</dl>
      {search.readiness.error && <p className="readiness-blocker">所持装備全体の探索を完了できませんでした。各個体の理由に加え、次を解決してください: {search.readiness.error}</p>}
      <details><summary>個体ごとの理由と必要な入力（全{search.readiness.equipment.length}件）</summary>
        <ul className="readiness-items">{search.readiness.equipment.map((entry) => {
          const item = items.get(entry.instanceId)
          return <li key={entry.instanceId}>
            <strong>{item?.catalog.name.ja ?? entry.instanceId} · {READINESS_LABELS[entry.status]}</strong>
            <small>{entry.instanceId}{item ? ` · Power ${item.powerLevel}` : ''}</small>
            {entry.status === 'evaluated' ? <p>この個体を含む構成を評価できました。最適化・用途別評価でスコアと構成を比較できます。</p> : <ul>{entry.issues.map((issue, index) => <li key={index}>
              <p>{READINESS_LABELS[issue.kind]}: {issue.message}</p>
              {issue.fields && <p>入力する項目: {issue.fields.join(' / ')}</p>}
            </li>)}</ul>}
            {entry.issues.some((issue) => issue.target === 'equipment') && item && <button type="button" onClick={() => onEdit(item.catalog.name.ja ?? item.catalog.name.en ?? entry.instanceId, entry.instanceId)}>{entry.instanceId}の入力を編集</button>}
            {entry.issues.some((issue) => issue.target === 'scenario') && <button type="button" onClick={onOpenScenario}>最適化条件を確認</button>}
          </li>
        })}</ul>
      </details>
    </>}
    <a href="#/optimize">最適化・装備比較へ進む</a>
  </section>
}
