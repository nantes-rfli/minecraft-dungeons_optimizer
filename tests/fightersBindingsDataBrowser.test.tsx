import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { fightersBindingsDomainArtifact } from '../src/screens/dataBrowser/fightersBindingsBrowserModel'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

const rawArtifactPath = `research/raw/packages/${fightersBindingsDomainArtifact.projection.configuredAttacks.trace.raw.packagePath}.raw.json`

function fightersBindingsRow(html: string): string {
  const start = html.indexOf('data-equipment-id="fighters-bindings"')
  const end = html.indexOf('data-equipment-id="', start + 30)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Fighter’s Bindings Data Browser vertical slice', () => {
  it('renders identity and configured fields from the temporary Domain projection', () => {
    const rawBefore = fs.readFileSync(rawArtifactPath)
    const row = fightersBindingsRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/melee' })))

    expect(row).toContain('data-domain-scope="temporary-domain-only"')
    expect(row).toContain('Fighter’s Bindings')
    expect(row).toContain('<code>fighters-bindings</code>')
    expect(row).toContain('provisional')
    expect(row).toContain('Gauntlets_Unique3')
    expect(row.match(/data-domain-field="configuredAttacks\[\d\]\.configuredDamage"/g)).toHaveLength(4)
    expect(row.match(/>25</g)).toHaveLength(4)
    expect(row).toContain('0.15000000596046448 s')
    expect(row).toContain('0.125 s')
    expect(fs.readFileSync(rawArtifactPath).equals(rawBefore)).toBe(true)
  })

  it('keeps unresolved mechanics explicit instead of presenting derived values', () => {
    const row = fightersBindingsRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/melee' })))

    expect(row).toContain('最終ダメージ')
    expect(row).toContain('Power scaling')
    expect(row).toContain('実効攻撃間隔')
    expect(row).toContain('完全なコンボ挙動')
    expect(row).toContain('数値を推定・導出していません')
    expect(row).not.toContain('毎秒約')
  })

  it('exposes Domain-to-Raw provenance without importing or parsing Raw artifacts in the application', () => {
    const row = fightersBindingsRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/melee' })))
    const browserSources = [
      fs.readFileSync('src/screens/DataBrowserPage.tsx', 'utf8'),
      fs.readFileSync('src/screens/dataBrowser/FightersBindingsDataBrowser.tsx', 'utf8'),
      fs.readFileSync('src/screens/dataBrowser/fightersBindingsBrowserModel.ts', 'utf8'),
    ].join('\n')

    expect(row).toContain('Domain field')
    expect(row).toContain('Raw property')
    expect(row).toContain('<code>Damage</code>')
    expect(row).toContain('<code>AttackAnimationTimeDurationSeconds</code>')
    expect(row).toContain('Raw package')
    expect(row).toContain('Dataset')
    expect(row).toContain('Extraction run')
    expect(browserSources).toContain("research/domain/temporary/fighters-bindings.json")
    expect(browserSources).not.toContain('research/raw/')
    expect(browserSources).not.toContain('projectFightersBindings')
    expect(browserSources).not.toContain('game-data-raw-package')
    expect(fs.readdirSync('src/domain/temporary').sort()).toEqual([
      'battleRobe.ts',
      'battleRobeIdentity.ts',
      'deathCapMushroom.ts',
      'deathCapMushroomIdentity.ts',
      'fightersBindings.ts',
      'fightersBindingsIdentity.ts',
      'projectionPrimitives.ts',
      'scatterCrossbow.ts',
      'scatterCrossbowIdentity.ts',
    ])
  })
})
