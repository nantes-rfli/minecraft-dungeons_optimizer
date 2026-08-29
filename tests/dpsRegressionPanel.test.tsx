import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ModelErrorSummary } from '../src/core/types'
import { DpsRegressionPanel } from '../src/views/DpsRegressionPanel'

describe('DPS regression panel', () => {
  it('shows sample shortage and suppresses the range while pending', () => {
    const markup = renderToStaticMarkup(<DpsRegressionPanel summary={{
      status: 'pending', sampleCount: 3, minimumSampleCount: 5,
    }} predictedDps={1_000_000} />)
    expect(markup).toContain('3 / 5')
    expect(markup).toContain('参考範囲はまだ表示しません')
    expect(markup).not.toContain('実測誤差P90ベース参考範囲')
  })

  it('shows metrics, count, and the empirical range when available', () => {
    const summary: ModelErrorSummary = {
      status: 'available',
      sampleCount: 8,
      minimumSampleCount: 5,
      meanAbsolutePercentageError: 0.087,
      medianAbsolutePercentageError: 0.08,
      p90AbsolutePercentageError: 0.142,
      maximumAbsolutePercentageError: 0.19,
      meanSignedPercentageError: 0.021,
      medianSignedPercentageError: 0.01,
    }
    const markup = renderToStaticMarkup(
      <DpsRegressionPanel summary={summary} predictedDps={1_250_000} />,
    )
    expect(markup).toContain('±14.2%')
    expect(markup).toContain('8.7%')
    expect(markup).toContain('+2.1%')
    expect(markup).toContain('n = 8')
    expect(markup).toContain('1,072,500–1,427,500')
    expect(markup).toContain('90%信頼区間ではありません')
  })
})
