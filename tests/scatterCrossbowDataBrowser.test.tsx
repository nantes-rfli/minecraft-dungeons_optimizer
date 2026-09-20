import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function scatterCrossbowRow(html: string): string {
  const start = html.indexOf('data-equipment-id="scatter-crossbow"')
  const end = html.indexOf('data-equipment-id="', start + 40)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Scatter Crossbow Data Browser vertical slice', () => {
  it('renders configured serialized parameters from the temporary Domain artifact', () => {
    const row = scatterCrossbowRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/ranged' })))
    expect(row).toContain('data-domain-scope="temporary-domain-only"')
    expect(row).toContain('Scatter Crossbow')
    expect(row).toContain('<code>scatter-crossbow</code>')
    expect(row).toContain('accepted')
    expect(row).toContain('ScatterCrossbow')
    expect(row).toContain('Configured projectile count')
    expect(row).toContain('>3<')
    expect(row).toContain('>20<')
    expect(row).not.toContain('20°')
    expect(row).toContain('0.029999999329447746 s')
    expect(row).toContain('1.100000023841858')
    expect(row).toContain('BP_ScatterCrossBow_Arrow_C')
    expect(row).toContain('BlueprintGeneratedClass')
    expect(row).toContain('0.6000000238418579')
    expect(row.match(/>true</g)).toHaveLength(2)
  })

  it('exposes normal and cross-package provenance from Domain traces', () => {
    const row = scatterCrossbowRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/ranged' })))
    for (const label of ['Domain field', 'Raw property', 'Raw package', 'Dataset', 'Extraction run', 'ObjectProperty', 'class import', 'outer package import', 'target Raw snapshot']) expect(row).toContain(label)
    expect(row).toContain('BP_ScatterCrossbowInstance')
    expect(row).toContain('BP_ScatterCrossBow_Arrow')
  })

  it('uses the committed Domain artifact without adding application-side projection judgments', () => {
    const row = scatterCrossbowRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/ranged' })))
    const modelSource = fs.readFileSync('src/screens/dataBrowser/scatterCrossbowBrowserModel.ts', 'utf8')
    const browserSources = [fs.readFileSync('src/screens/DataBrowserPage.tsx', 'utf8'), fs.readFileSync('src/screens/dataBrowser/ScatterCrossbowDataBrowser.tsx', 'utf8'), modelSource].join('\n')
    expect(browserSources).toContain("research/domain/temporary/scatter-crossbow.json")
    expect(browserSources).not.toContain('research/raw/')
    expect(browserSources).not.toContain('game-data-raw-package')
    expect(modelSource).toContain('import type { projectScatterCrossbow, scatterCrossbowMappings }')
    expect(modelSource).not.toMatch(/import \{ projectScatterCrossbow/)
    expect(row).not.toContain('現在Domainでは未投影')
    expect(browserSources).not.toContain('notProjected')
  })
})
