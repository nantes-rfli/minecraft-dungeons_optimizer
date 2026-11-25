import { useState } from 'react'
import type { Scenario } from '../core/types'

export function RangedTimeAllocationControls({ scenario, onChange }: {
  readonly scenario: Scenario
  readonly onChange: (scenario: Scenario) => void
}) {
  const [draft, setDraft] = useState('')
  const alternatives = scenario.rangedTimeShareAlternatives ?? []
  const proposed = Number(draft)
  const canAdd = proposed > 0 && proposed < 1 && proposed !== scenario.rangedTimeShare
    && !alternatives.includes(proposed)
  return <fieldset>
    <legend>遠距離の攻撃時間</legend>
    <label>基本の時間割合<input aria-label="遠距離時間割合" type="number" min="0.01" max="0.99" step="0.05" value={scenario.rangedTimeShare ?? ''} placeholder="明示入力が必要"
      onChange={(event) => {
        const share = event.target.value === '' ? undefined : Number(event.target.value)
        const remaining = alternatives.filter((alternative) => alternative !== share)
        onChange({ ...scenario, rangedTimeShare: share, rangedTimeShareAlternatives: remaining.length ? remaining : undefined })
      }} /></label>
    <label>比較する追加の時間割合<input aria-label="比較に追加する時間割合" type="number" min="0.01" max="0.99" step="any" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
    <button type="button" disabled={!canAdd} onClick={() => {
      onChange({ ...scenario, rangedTimeShareAlternatives: [...alternatives, proposed] })
      setDraft('')
    }}>時間割合を候補に追加</button>
    {alternatives.length > 0 && <ul aria-label="追加した遠距離時間割合">
      {alternatives.map((share) => <li key={share}>
        {share} <button type="button" aria-label={`時間割合 ${share} を候補から外す`} onClick={() => {
          const remaining = alternatives.filter((alternative) => alternative !== share)
          onChange({ ...scenario, rangedTimeShareAlternatives: remaining.length ? remaining : undefined })
        }}>候補から外す</button>
      </li>)}
    </ul>}
  </fieldset>
}
