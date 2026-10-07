import { estimatedParametersForBuild, type ParameterEvidence } from '../core/evidenceStatus'
import type { Evaluation } from '../core/types'

const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' } as const

export function EstimatedParameterDetails({ parameters }: { parameters: readonly ParameterEvidence[] }) {
  return parameters.length > 0
    ? <><p>次のmechanic / parameterに推定値を使用しました。</p><ul>{parameters.map((parameter) => <li key={`${parameter.mechanicId}-${parameter.parameterId}`}><strong>{parameter.label}</strong><code>{parameter.mechanicId} / {parameter.parameterId}</code><span>{parameter.basis}</span><small>{parameter.conditions} · version: {parameter.gameVersion} · confidence: {parameter.confidence}</small></li>)}</ul></>
    : <p>この結果には登録済みのEstimated parameterを使用していません。</p>
}

export function BuildEvidenceDetails({ evaluation }: { evaluation: Evaluation }) {
  const parameters = estimatedParametersForBuild(evaluation.build)
  return <details className="alternative-evidence">
    <summary>Evidenceと計算上の注意を見る（Estimated {parameters.length}件）</summary>
    <div className={`evidence-result ${parameters.length ? 'estimated' : 'strict'}`}>
      <p>この候補のEvidence coverage {Math.round(evaluation.confidence.coverageScore * 100)} / 100（{CONFIDENCE_LABELS[evaluation.confidence.label]}）</p>
      <EstimatedParameterDetails parameters={parameters} />
      <p>Estimatedの件数やEvidence coverageは、すべての効果が独立検証済みであることを意味しません。</p>
    </div>
    {evaluation.confidence.caveats.length > 0 && <><h4>この候補の計算上の注意</h4><ul>{evaluation.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></>}
  </details>
}
