import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core/optimizer'
import { estimatedParametersForBuild } from '../src/core/evidenceStatus'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { BuildAlternative } from '../src/views/RecommendedBuild'
import { OptimizeResults } from '../src/screens/OptimizeResults'
import type { Inventory } from '../src/core/types'

const inventory: Inventory = {
  weapons: [{ instanceId: 'evidence-comparison', weaponId: 'double-axe', powerLevel: 251,
    enchantmentSlots: [{ candidates: ['critical-hit', 'guarding-strike'] }] }], artifacts: [],
}
const scenario = { ...DEFAULT_SCENARIO, weights: { damage: 1, healing: 0, defense: 0, control: 0 } }

describe('candidate-local Evidence disclosure', () => {
  it('shows the alternative estimate even when the best uses none, without changing results', () => {
    const result = optimize(inventory, scenario)
    expect(estimatedParametersForBuild(result.best.build)).toEqual([])
    const alternative = result.alternatives[0]!
    expect(estimatedParametersForBuild(alternative.build)).toHaveLength(1)
    const saved = JSON.stringify(result)
    const html = renderToStaticMarkup(<BuildAlternative evaluation={alternative} best={result.best} weights={scenario.weights} />)
    expect(html).toContain('Evidenceと計算上の注意を見る（Estimated 1件）')
    expect(html).toContain('melee-enchantment:guarding-strike / activation-coverage-model')
    expect(html).toContain('direct kill rateと効果時間から期待coverageを近似。')
    expect(html).toContain('proc chance・cooldown・current-version interactionの独立検証前。')
    expect(html).toContain('1.17.0.0 applicability not independently verified')
    expect(html).toContain('confidence: low')
    for (const caveat of alternative.confidence.caveats) expect(html).toContain(renderToStaticMarkup(<li>{caveat}</li>))
    expect(JSON.stringify(result)).toBe(saved)
  })

  it('does not transfer the best estimate to an estimate-free alternative or claim verification', () => {
    const result = optimize(inventory, scenario)
    const html = renderToStaticMarkup(<BuildAlternative evaluation={result.best} best={result.alternatives[0]!} weights={scenario.weights} />)
    expect(html).toContain('Evidenceと計算上の注意を見る（Estimated 0件）')
    expect(html).toContain('登録済みのEstimated parameterを使用していません。')
    expect(html).not.toContain('activation-coverage-model')
    expect(html).toContain('独立検証済みであることを意味しません。')
  })

  it('keeps copy-dependent Artifact estimates deduplicated and local to the candidate', () => {
    const result = optimize({ ...inventory, artifacts: [
      { instanceId: 'mushroom-a', artifactId: 'death-cap-mushroom', powerLevel: 251 },
      { instanceId: 'mushroom-b', artifactId: 'death-cap-mushroom', powerLevel: 251 },
      { instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 },
    ] }, scenario)
    const html = renderToStaticMarkup(<BuildAlternative evaluation={result.best} best={result.best} weights={scenario.weights} />)
    expect(html.match(/death-cap-mushroom \/ duration-curve/g)).toHaveLength(1)
    expect(html.match(/death-cap-mushroom \/ duplicate-stacking/g)).toHaveLength(1)
    expect(html).toContain('iron-hide-amulet / duration-curve')
    expect(html).not.toContain('iron-hide-amulet / duplicate-stacking')
    expect(html).toContain('version: unknown')
  })

  it('discloses each visible alternative and Pareto candidate while preserving strict exclusions', () => {
    const result = optimize(inventory, scenario)
    const html = renderToStaticMarkup(<OptimizeResults weights={scenario.weights} result={result} error={null} status="complete" />)
    expect(html.match(/class="alternative-evidence"/g)).toHaveLength(result.alternatives.slice(0, 4).length + result.paretoFrontier.slice(0, 3).length)
    const strict = optimize(inventory, { ...scenario, evidencePolicy: 'high-confidence-only' })
    expect(strict.alternatives).toHaveLength(0)
    expect(strict.unsupportedChoices.join(' ')).toContain('guarding-strike')
    const strictHtml = renderToStaticMarkup(<OptimizeResults weights={scenario.weights} result={strict} error={null} status="complete" evidencePolicy="high-confidence-only" />)
    expect(strictHtml).not.toContain('melee-enchantment:guarding-strike / activation-coverage-model')
    expect(strictHtml).toContain('0点として採用しません')
  })
})
