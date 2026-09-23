import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import identityArtifact from '../research/domain/formal/identity-evidence-v1.json'
import valueArtifact from '../research/domain/formal/value-availability-v2.json'
import { fightersBindingsBrowserProjection } from '../src/screens/dataBrowser/fightersBindingsBrowserModel'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function fightersBindingsRow(): string {
  const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/melee' }))
  const start = html.indexOf('data-equipment-id="fighters-bindings"')
  const end = html.indexOf('data-equipment-id="', start + 30)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Fighter’s Bindings Formal Data Browser consumer', () => {
  it('uses matched Formal identity and configured Formal values', () => {
    const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === 'identity:fighters-bindings@1')!
    const row = fightersBindingsRow()
    expect(identity.resolution.state).toBe('matched')
    expect(fightersBindingsBrowserProjection.identity.domainId).toBe(identity.resolution.domainId)
    expect(fightersBindingsBrowserProjection.configuredAttacks.value).toEqual(valueArtifact.semantic.melee['fighters-bindings'].configuredAttacks.value)
    expect(row).toContain('data-domain-scope="formal-domain"')
    expect(row).toContain('FORMAL GAME DOMAIN')
    expect(row).toContain('Fighter&#x27;s Bindings')
    expect(row).toContain('<code>fighters-bindings</code>')
    expect(row).toContain('provisional')
    expect(row).toContain('Gauntlets_Unique3')
    expect(row.match(/data-domain-field="configuredAttacks\[\d\]\.configuredDamage"/g)).toHaveLength(4)
    expect(row.match(/>25</g)).toHaveLength(4)
    expect(row.match(/0\.15000000596046448 s/g)).toHaveLength(3)
    expect(row.match(/0\.125 s/g)).toHaveLength(1)
  })

  it('keeps the four mechanics as explicit Application boundary presentation', () => {
    const row = fightersBindingsRow()
    expect(row).toContain('最終ダメージ')
    expect(row).toContain('Power scaling')
    expect(row).toContain('実効攻撃間隔')
    expect(row).toContain('完全なコンボ挙動')
    expect(row).toContain('Data Browserでは導出・assertしていません')
    expect(row).toContain('数値を推定・導出していません')
    expect(row).not.toContain('毎秒約')
  })

  it('shows Formal evidence provenance and keeps Application imports within the Formal boundary', () => {
    const row = fightersBindingsRow()
    const browserSources = [
      'src/screens/DataBrowserPage.tsx',
      'src/screens/dataBrowser/FightersBindingsDataBrowser.tsx',
      'src/screens/dataBrowser/fightersBindingsBrowserModel.ts',
    ].map((path) => fs.readFileSync(path, 'utf8')).join('\n')
    expect(row).toContain('Domain field')
    expect(row).toContain('Raw property')
    expect(row).toContain('<code>Damage</code>')
    expect(row).toContain('<code>AttackAnimationTimeDurationSeconds</code>')
    expect(row).toContain('Raw package')
    expect(row).toContain('Dataset')
    expect(row).toContain('Extraction run')
    expect(row).toContain('Raw node')
    expect(browserSources).toContain('research/domain/formal/identity-evidence-v1.json')
    expect(browserSources).toContain('research/domain/formal/value-availability-v2.json')
    expect(browserSources).not.toContain('research/domain/formal/value-availability-v1.json')
    expect(browserSources).not.toMatch(/research\/domain\/temporary\/fighters-bindings\.json|research\/raw\/|src\/domain\/temporary|projectFightersBindings|extract:game-data-raw-package/)
  })
})
