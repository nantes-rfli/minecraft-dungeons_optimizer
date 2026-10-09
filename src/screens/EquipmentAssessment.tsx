import { useEffect, useMemo, useState } from 'react'
import type { Inventory, Scenario } from '../core/types'
import { summarizeMultiConditionBestScores, type AssessmentCondition, type EquipmentAssessment } from '../core/equipmentAssessment'
import { estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../core/searchBudget'
import { inventoryGridItemMatchesQuery, inventoryGridItems } from '../inventory/gridPresentation'
import { useOptimizer } from '../optimizer/useOptimizer'
import type { SavedScenarioPreset } from '../scenario/presets'
import { BuildAlternative, RecommendedBuild } from '../views/RecommendedBuild'

const format = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const formatGap = (gap: number) => gap > 0 && gap < 0.005 ? '0.01未満' : format.format(gap)
const categoryOptions = [
  { id: 'all', label: 'すべて' },
  { id: 'melee', label: '近接武器' },
  { id: 'armor', label: '防具' },
  { id: 'ranged', label: '遠距離武器' },
  { id: 'artifact', label: 'Artifact' },
] as const

function AssessmentValue({ equipment, instanceId, conditionId, conditionName, onInspect }: {
  readonly equipment: EquipmentAssessment | undefined
  readonly instanceId: string
  readonly conditionId: string
  readonly conditionName: string
  readonly onInspect: (instanceId: string, conditionId: string) => void
}) {
  if (equipment?.status !== 'evaluated') return <><strong>未評価</strong><small>{equipment?.status === 'excluded' ? equipment.reasons.join(' / ') : '条件の評価に失敗しました。上の条件詳細を確認してください。'}</small></>
  return <>
    <strong>{equipment.scoreGap === 0 ? '最良と同点' : `最良との差 ${formatGap(equipment.scoreGap)}pt`}</strong>
    <small>この装備を使う最良: {format.format(equipment.best.objectiveScore)}</small>
    <button type="button" onClick={() => onInspect(instanceId, conditionId)} aria-label={`${instanceId}の${conditionName}の構成を見る`}>構成を見る</button>
  </>
}

export function EquipmentAssessmentPanel({ inventory, scenario, presets }: {
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly presets: readonly SavedScenarioPreset[]
}) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [inspected, setInspected] = useState<{ instanceId: string; conditionId: string } | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<(typeof categoryOptions)[number]['id']>('all')
  const [itemQuery, setItemQuery] = useState('')
  const [sortBy, setSortBy] = useState('inventory')
  const conditions = useMemo<readonly AssessmentCondition[]>(() => [
    { id: 'current', name: '現在の条件', scenario },
    ...presets.filter((preset) => selectedIds.includes(preset.id)).map((preset) => ({ ...preset, id: `saved:${preset.id}` })),
  ], [scenario, presets, selectedIds])
  const search = useOptimizer(inventory, scenario, false, conditions)
  const [removalTargetId, setRemovalTargetId] = useState<string | null>(null)
  const removalBaseline = useMemo(() => {
    if (!removalTargetId || !search.assessments) return undefined
    return search.assessments.map((assessment) => {
      if (assessment.status === 'error') return { conditionId: assessment.condition.id, status: 'error' as const, error: assessment.error }
      const target = assessment.equipment.find((equipment) => equipment.instanceId === removalTargetId)
      return {
        conditionId: assessment.condition.id,
        status: 'complete' as const,
        best: assessment.best,
        target: target?.status === 'evaluated' ? { status: 'evaluated' as const }
          : { status: 'excluded' as const, reasons: target?.status === 'excluded' ? target.reasons : ['この条件の基準評価に対象装備がありません。'] },
      }
    })
  }, [removalTargetId, search.assessments])
  const removalInput = useMemo(() => removalTargetId && removalBaseline ? { instanceId: removalTargetId, baseline: removalBaseline } : undefined, [removalTargetId, removalBaseline])
  const removalSearch = useOptimizer(inventory, scenario, false, removalInput ? conditions : undefined, undefined, removalInput)
  const removalStatus = removalSearch.status
  const startRemoval = removalSearch.start
  useEffect(() => {
    if (removalInput && removalStatus === 'idle') startRemoval()
  }, [removalInput, removalStatus, startRemoval])
  const items = useMemo(() => inventoryGridItems(inventory), [inventory])
  const itemById = useMemo(() => new Map(items.map((item) => [item.instanceId, item])), [items])
  const multiConditionBestScores = useMemo(() => search.assessments ? summarizeMultiConditionBestScores(search.assessments) : null, [search.assessments])
  const selectedConditionId = sortBy.startsWith('gap-') ? sortBy.slice(sortBy.indexOf(':') + 1) : null
  const selectedSortBy = selectedConditionId && !conditions.some((condition) => condition.id === selectedConditionId) ? 'inventory' : sortBy
  const canCompareRemoval = (instanceId: string) => search.assessments?.some((assessment) => assessment.status === 'complete'
    && assessment.equipment.some((equipment) => equipment.instanceId === instanceId && equipment.status === 'evaluated')) ?? false
  const tableItems = useMemo(() => {
    const categoryItems = items.filter((item) => (categoryFilter === 'all' || item.category === categoryFilter)
      && inventoryGridItemMatchesQuery(item, itemQuery))
    if (!selectedSortBy.startsWith('gap-')) return categoryItems
    const separator = selectedSortBy.indexOf(':')
    const direction = selectedSortBy.slice(4, separator)
    const conditionId = selectedSortBy.slice(separator + 1)
    const condition = search.assessments?.find((assessment) => assessment.condition.id === conditionId)
    const byInstance = new Map(condition?.status === 'complete' ? condition.equipment.map((item) => [item.instanceId, item]) : [])
    return categoryItems.map((item, index) => ({ item, index, assessment: byInstance.get(item.instanceId) }))
      .sort((a, b) => {
        const aGap = a.assessment?.status === 'evaluated' ? a.assessment.scoreGap : null
        const bGap = b.assessment?.status === 'evaluated' ? b.assessment.scoreGap : null
        if (aGap === null) return bGap === null ? a.index - b.index : 1
        if (bGap === null) return -1
        const difference = direction === 'desc' ? bGap - aGap : aGap - bGap
        return difference || a.index - b.index
      })
      .map(({ item }) => item)
  }, [categoryFilter, itemQuery, items, search.assessments, selectedSortBy])
  const overBudget = estimateSearchCandidates(inventory) > SEARCH_MAX_CANDIDATES
  const inspectedCondition = search.assessments?.find((assessment) => assessment.condition.id === inspected?.conditionId)
  const inspectedEquipment = inspectedCondition?.status === 'complete'
    ? inspectedCondition.equipment.find((item) => item.instanceId === inspected?.instanceId) : undefined
  const inspectedItem = items.find((item) => item.instanceId === inspected?.instanceId)
  const removalTargetItem = items.find((item) => item.instanceId === removalTargetId)

  return <section className="equipment-assessment" aria-labelledby="equipment-assessment-title">
    <p className="section-label">EQUIPMENT VALUE</p><h2 id="equipment-assessment-title">装備の用途別評価</h2>
    <p>各装備を必ず使う最良構成を探し、同じ条件の最良スコアとの差を比べます。次点に出ない装備も、別用途で残す価値を確認できます。</p>
    <fieldset><legend>比較する条件</legend><p>現在の条件は常に含めます。別用途は条件を保存して追加してください。</p>
      {presets.map((preset) => <label key={preset.id}><input type="checkbox" checked={selectedIds.includes(preset.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, preset.id] : current.filter((id) => id !== preset.id))} />{preset.name}</label>)}
      {presets.length === 0 && <small>追加できる保存済み条件はありません。</small>}
    </fieldset>
    <div className="assessment-actions"><button className="primary-button" type="button" onClick={search.start} disabled={search.status === 'working' || overBudget}>用途別に評価する</button><button type="button" onClick={search.cancel} disabled={search.status !== 'working'}>用途別評価を中止</button></div>
    <p role="status">{search.status === 'working' ? `${conditions.length}条件を全探索しています…` : search.status === 'complete' ? '用途別評価が完了しました。' : search.status === 'cancelled' ? '用途別評価を中止しました。' : search.status === 'error' ? '用途別評価に失敗しました。入力を確認してください。' : '条件を選び、用途別評価を開始してください。'}</p>
    {overBudget && <p role="alert">探索上限 {SEARCH_MAX_CANDIDATES.toLocaleString()} 通りを超えています。装備や候補を減らしてください。</p>}
    {search.error && <p role="alert">{search.error}</p>}
    <p className="assessment-limitations">差は用途ごとに読む値です。用途間のスコアは合算しません。最良と同点でも効果や性能が同じとは限らず、差があっても売却してよいという意味ではありません。未評価は0点にせず、売却判断を保留してください。</p>
    {search.assessments && <>
      {search.assessments.map((assessment, conditionIndex) => <details key={assessment.condition.id} className="assessment-condition">
        <summary>{assessment.condition.name} · {assessment.status === 'complete' ? `${assessment.evaluatedBuildCount}通りを全探索` : '評価できませんでした'}</summary>
        <p>{assessment.condition.scenario.name} · {assessment.condition.scenario.evidencePolicy === 'high-confidence-only' ? '確度の高い情報のみ' : 'Estimatedを含める'}</p>
        {assessment.status === 'error' ? <p role="alert">{assessment.error}</p> : <>
          <p>この条件の最良スコア: {format.format(assessment.best.objectiveScore)}</p>
          {assessment.unsupportedChoices.map((reason) => <p key={reason}>{reason}</p>)}
          <details className="assessment-best-build">
            <summary>{assessment.condition.name}のおすすめ構成を見る</summary>
            <RecommendedBuild evaluation={assessment.best} weights={assessment.condition.scenario.weights} idPrefix={`assessment-best-build-${conditionIndex}`} />
          </details>
        </>}
      </details>)}
      {multiConditionBestScores && multiConditionBestScores.completedConditionCount > 1 && <section className="assessment-cross-condition" aria-label="複数条件で最良スコアに届く装備">
        <h3>複数条件で最良スコアの構成に使える装備</h3>
        <p>装備個体を1つずつ必須にした最良構成を各条件で調べ、条件ごとの最良スコアと同点になった装備を表示します。複数の表示装備を同じ構成で同時に使えるとは限らず、条件間のスコアも比べたり合算したりしません。未評価の装備は含まず、ここにない装備が不要という意味ではありません。</p>
        {multiConditionBestScores.items.length > 0
          ? <ul>{multiConditionBestScores.items.map((entry) => {
            const item = itemById.get(entry.instanceId)
            return <li key={entry.instanceId}>
              <span className="cross-condition-equipment-name"><strong>{item?.catalog.name.ja ?? entry.instanceId}</strong><small>{item ? `${categoryOptions.find((option) => option.id === item.category)?.label ?? item.category} · Power ${item.powerLevel} · ${entry.instanceId}` : entry.instanceId}</small></span>
              <span className="cross-condition-equipment-conditions"><strong>{entry.conditionIds.length} / {multiConditionBestScores.completedConditionCount}条件</strong><small>{entry.conditionNames.join(' · ')}</small></span>
            </li>
          })}</ul>
          : <p>完了した{multiConditionBestScores.completedConditionCount}条件では、同じ装備個体が複数条件でそれぞれ最良スコアに届く構成はありませんでした。</p>}
      </section>}
      <fieldset className="assessment-view-controls"><legend>表示する装備</legend>
        <label>カテゴリ<select aria-label="表示カテゴリ" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as (typeof categoryOptions)[number]['id'])}>
          {categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        <label>装備を検索<input type="search" aria-label="装備を検索" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="名前・Power・Enchant・個体ID" /></label>
        <label>並び順<select aria-label="装備の並び順" value={selectedSortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="inventory">所持品順</option>
          {conditions.map((condition) => <optgroup key={condition.id} label={condition.name}>
            <option value={`gap-asc:${condition.id}`}>最良との差が小さい順</option>
            <option value={`gap-desc:${condition.id}`}>最良との差が大きい順</option>
          </optgroup>)}
        </select></label>
        <p>{tableItems.length} / {items.length}件を表示。数値で評価できない装備は並べ替え時に末尾へ残り、同じ差の装備は所持品順です。</p>
      </fieldset>
      <div className="assessment-table-scroll"><table className="assessment-table"><caption>装備個体ごとの最良スコアとの差 · {tableItems.length}件</caption>
        <thead><tr><th scope="col">装備</th>{search.assessments.map(({ condition }) => <th scope="col" key={condition.id}>{condition.name}</th>)}</tr></thead>
        <tbody>{tableItems.length === 0 && <tr><td colSpan={search.assessments.length + 1}>条件に一致する装備はありません。検索語を変えるかカテゴリを見直してください。</td></tr>}{tableItems.map((item) => <tr key={item.instanceId}>
          <th scope="row">{item.catalog.name.ja}<small>{item.category} · Power {item.powerLevel} · {item.instanceId}</small>{canCompareRemoval(item.instanceId) && <button type="button" aria-pressed={removalTargetId === item.instanceId} aria-label={`${item.instanceId}を外した場合を比較`} onClick={() => setRemovalTargetId((current) => current === item.instanceId ? null : item.instanceId)}>{removalTargetId === item.instanceId ? '比較結果を閉じる' : '外した場合を比較'}</button>}</th>
          {search.assessments!.map((assessment) => {
            const equipment = assessment.status === 'complete' ? assessment.equipment.find((entry) => entry.instanceId === item.instanceId) : undefined
            return <td key={assessment.condition.id}>
              <AssessmentValue equipment={equipment} instanceId={item.instanceId} conditionId={assessment.condition.id} conditionName={assessment.condition.name} onInspect={(nextInstanceId, conditionId) => setInspected({ instanceId: nextInstanceId, conditionId })} />
            </td>
          })}
        </tr>)}</tbody>
      </table></div>
      <section className="assessment-cards" aria-label="装備個体ごとの用途別評価">
        {tableItems.length === 0 && <p>条件に一致する装備はありません。検索語を変えるかカテゴリを見直してください。</p>}{tableItems.map((item) => <article className="assessment-card" key={item.instanceId}>
          <h3>{item.catalog.name.ja}</h3>
          <p>{item.category} · Power {item.powerLevel} · {item.instanceId}</p>
          {canCompareRemoval(item.instanceId) && <button type="button" aria-pressed={removalTargetId === item.instanceId} aria-label={`${item.instanceId}を外した場合を比較`} onClick={() => setRemovalTargetId((current) => current === item.instanceId ? null : item.instanceId)}>{removalTargetId === item.instanceId ? '比較結果を閉じる' : '外した場合を比較'}</button>}
          <dl>
            {search.assessments!.map((assessment) => {
              const equipment = assessment.status === 'complete' ? assessment.equipment.find((entry) => entry.instanceId === item.instanceId) : undefined
              return <div key={assessment.condition.id}>
                <dt>{assessment.condition.name}</dt>
                <dd><AssessmentValue equipment={equipment} instanceId={item.instanceId} conditionId={assessment.condition.id} conditionName={assessment.condition.name} onInspect={(nextInstanceId, conditionId) => setInspected({ instanceId: nextInstanceId, conditionId })} /></dd>
              </div>
            })}
          </dl>
        </article>)}
      </section>
      {removalTargetId && <section className="assessment-removal" aria-label="所持装備を外した場合の比較">
        <h3>{removalTargetItem?.catalog.name.ja ?? removalTargetId}を外した場合</h3>
        <p>比較結果は選んだ条件だけに適用されます。未知の効果は数値化せず、Inventoryは変更しません。評価結果だけで売却を判断しないでください。</p>
        <div className="assessment-actions"><button type="button" onClick={() => removalSearch.cancel()} disabled={removalSearch.status !== 'working'}>比較を中止</button><button type="button" onClick={() => setRemovalTargetId(null)}>比較結果を閉じる</button></div>
        <p role="status">{removalSearch.status === 'working' ? '外した後の構成を比較しています…' : removalSearch.status === 'complete' ? '比較が完了しました。' : removalSearch.status === 'cancelled' ? '比較を中止しました。' : removalSearch.status === 'error' ? '比較できませんでした。' : '比較を開始しています…'}</p>
        {removalSearch.error && <p role="alert">{removalSearch.error}</p>}
        {removalSearch.removalComparisons?.map((comparison) => <article className="assessment-removal-condition" key={comparison.condition.id}>
          <h4>{comparison.condition.name}</h4>
          {comparison.status === 'error' ? <p role="alert">この条件では比較できませんでした: {comparison.error}</p>
            : comparison.status === 'excluded' ? <><p>この条件では対象装備を数値評価できないため、外した後との差は表示しません。</p><ul>{comparison.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>
              : <><p>現在の最良構成は対象個体を{comparison.baselineBestUsesInstance ? '含みます' : '含みません'}。</p><BuildAlternative title="外した後の最良構成" evaluation={comparison.afterRemovalBest} best={comparison.baselineBest} weights={comparison.condition.scenario.weights} /></>}
        </article>)}
      </section>}
      {inspectedCondition?.status === 'complete' && inspectedEquipment?.status === 'evaluated' && <section aria-label="用途別の個体必須構成">
        <h3>{inspectedItem?.catalog.name.ja} · {inspected?.instanceId} · {inspectedCondition.condition.name}</h3>
        <BuildAlternative title="この個体を使う最良構成" evaluation={inspectedEquipment.best} best={inspectedCondition.best} weights={inspectedCondition.condition.scenario.weights} />
      </section>}
    </>}
  </section>
}
