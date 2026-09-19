import coverage from '../../research/analysis/evidence-coverage-dashboard.json'
import auditJson from '../../research/dps-regression-audit.json'
import { hrefFor } from '../app/routes'
import { RUNTIME_BACKLOG } from '../research/evidenceCoverage/backlog'
import { summarizeDpsRegressionAudit, type DpsRegressionAudit } from '../research/dpsRegressionAudit'
import { ESTIMATED_PARAMETER_EVIDENCE } from '../core/evidenceStatus'

const CATEGORY_IDS = ['melee-enchantment', 'armor', 'ranged-weapon', 'artifact'] as const
const CATEGORY_LABELS: Record<typeof CATEGORY_IDS[number], string> = {
  'melee-enchantment': '近接Enchant', armor: '防具', 'ranged-weapon': '遠距離武器', artifact: 'Artifact',
}
const DPS_SUMMARY = summarizeDpsRegressionAudit(auditJson as unknown as DpsRegressionAudit)
const coverageCategory = (id: typeof CATEGORY_IDS[number]) => {
  const item = coverage.categories.find((entry) => entry.id === id)
  if (!item) throw new Error(`Coverage category is missing: ${id}`)
  return item
}

export function ModelEvidencePage() {
  const categories = CATEGORY_IDS.map(coverageCategory)
  const priorityGaps = RUNTIME_BACKLOG.filter((item) => item.priority === 'P0' || item.priority === 'P1')
  return <main id="main-content" tabIndex={-1} className="page-main evidence-page">
    <header className="page-intro"><p className="eyebrow">EVIDENCE / ACCURACY</p><h1>Evidence / 精度</h1><p>確定値と根拠のある推定値を区別し、Unknownを0や×1へ置き換えずに計算します。</p></header>
    <section className="evidence-axis-grid" aria-label="EvidenceとRuntime supportの読み方">
      <article><p className="section-label">EVIDENCE STATUS</p><h2>parameterごとの根拠</h2><dl><dt>Verified</dt><dd>独立した再現や照合まで確認済み</dd><dt>Measured</dt><dd>条件を記録した測定値</dd><dt>Derived</dt><dd>根拠から導出した値</dd><dt>Estimated</dt><dd>根拠・条件・version・confidence付きの推定</dd><dt>Unknown</dt><dd>根拠不足。0や×1で補完しない</dd></dl></article>
      <article><p className="section-label">RUNTIME SUPPORT</p><h2>Optimizerで使える範囲</h2><dl><dt>Full</dt><dd>現在のscopeで通常対応</dd><dt>Limited</dt><dd>Power・組合せ・観測入力などに制限</dd><dt>Unsupported</dt><dd>所持品・Researchでは扱い、計算候補にはしない</dd></dl><p>Evidence statusとは別軸です。旧Full / Limited / Research-onlyはlegacy runtime statusとして保持し、正確性ラベルには使いません。</p></article>
    </section>
    <section className="priority-gaps" aria-labelledby="estimated-parameters-title"><p className="section-label">ESTIMATED PARAMETERS</p><h2 id="estimated-parameters-title">現在Optimizerで選択利用できる推定値</h2><ul>{ESTIMATED_PARAMETER_EVIDENCE.map((parameter) => <li key={`${parameter.mechanicId}-${parameter.parameterId}`}><span className="priority p1">{parameter.confidence}</span><div><strong>{parameter.label}</strong><p>{parameter.basis}。{parameter.conditions} version: {parameter.gameVersion}</p></div></li>)}</ul></section>
    <section aria-labelledby="evidence-current-title"><div className="section-heading"><div><p className="section-label">CURRENT COVERAGE</p><h2 id="evidence-current-title">現在の状態</h2></div></div><div className="evidence-coverage-grid">{categories.map((item) => <article key={item.id}><h3>{CATEGORY_LABELS[item.id as typeof CATEGORY_IDS[number]]}</h3><strong>{item.population}</strong><p><b>{item.runtime.full}</b> Full · <b>{item.runtime.limited}</b> Limited · <b>{item.runtime.researchOnly}</b> Research-only</p></article>)}</div></section>
    <section className="dps-evidence-card" aria-labelledby="dps-evidence-title"><div><p className="section-label">DPS REGRESSION</p><h2 id="dps-evidence-title">独立sample {DPS_SUMMARY.eligibleCount} / 5</h2></div><p>再現条件を満たす独立sampleが5件に達していないため、end-to-endの誤差範囲はまだ表示できません。component単位の検証は、この件数へ加算しません。</p></section>
    <section className="priority-gaps" aria-labelledby="priority-gaps-title"><p className="section-label">P0 / P1 GAPS</p><h2 id="priority-gaps-title">主要な未確定事項</h2><ul>{priorityGaps.map((item) => <li key={item.id}><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span><div><strong>{item.label}</strong><p>{item.blocked}</p></div></li>)}</ul></section>
    <a className="evidence-details-link" href={hrefFor('/model/evidence/details')}>詳細な実装・Evidenceを見る <span aria-hidden="true">→</span></a>
  </main>
}
