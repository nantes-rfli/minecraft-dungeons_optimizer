import { useState } from 'react'
import type { EquipmentCategory } from '../core/types'
import { inventoryGridItemMatchesQuery, type InventoryGridItem } from '../inventory/gridPresentation'

export function InventorySearchScope({ items, categoryLabels, excludedIds, excludedCount, onChange }: {
  readonly items: readonly InventoryGridItem[]
  readonly categoryLabels: Readonly<Record<EquipmentCategory, string>>
  readonly excludedIds: ReadonlySet<string>
  readonly excludedCount: number
  readonly onChange: (ids: ReadonlySet<string>) => void
}) {
  const [query, setQuery] = useState('')
  if (!items.length) return null

  return <details className="advanced-settings inventory-search-scope">
    <summary><span><strong>探索に使う所持品</strong><small>{excludedCount > 0 ? `${excludedCount}件を探索対象から外しています` : '登録した全候補を使用中'}</small></span><span aria-hidden="true">＋</span></summary>
    <div className="inventory-search-scope-controls">
      <p>選んだ個体を、最適化・用途別評価・ドロップ比較に使います。所持品と保存済み条件はそのままです。登録済みの各カテゴリから1件以上を残してください。</p>
      <label>探索対象の所持品を検索<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {excludedCount > 0 && <button type="button" onClick={() => onChange(new Set())}>全件を探索対象に戻す</button>}
      {(['melee', 'armor', 'ranged', 'artifact'] as const).map((category) => {
        const group = items.filter((item) => item.category === category)
        const visible = group.filter((item) => inventoryGridItemMatchesQuery(item, query))
        if (!visible.length) return null
        const activeCount = group.filter((item) => !excludedIds.has(item.instanceId)).length
        return <fieldset key={category}><legend>{categoryLabels[category]} · {activeCount}/{group.length}件</legend>
          <ul>{visible.map((item) => {
            const included = !excludedIds.has(item.instanceId)
            return <li key={item.instanceId}>
              <label><input type="checkbox" checked={included}
                disabled={included && activeCount === 1} onChange={() => {
                  const next = new Set(excludedIds)
                  if (included) next.add(item.instanceId)
                  else next.delete(item.instanceId)
                  onChange(next)
                }} />{item.catalog.name.ja} · Power {item.powerLevel} · {item.instanceId}</label>
              {group.length > 1 && <button type="button" aria-label={`この個体だけ（${item.instanceId}）`} onClick={() => {
                const next = new Set(excludedIds)
                for (const other of group) next.add(other.instanceId)
                next.delete(item.instanceId)
                onChange(next)
              }}>この個体だけ</button>}
            </li>
          })}</ul>
        </fieldset>
      })}
      {!items.some((item) => inventoryGridItemMatchesQuery(item, query)) && <p>検索に一致する所持品がありません。</p>}
    </div>
  </details>
}
