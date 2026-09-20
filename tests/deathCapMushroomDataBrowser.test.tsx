import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function deathCapRow(html: string): string {
  const start = html.indexOf('data-equipment-id="death-cap-mushroom"')
  const end = html.indexOf('data-equipment-id="', start + 40)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Death Cap Mushroom Data Browser vertical slice', () => {
  it('connects the artifact row to accepted temporary Domain identity and Effect reference', () => {
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))
    expect(row).toContain('data-domain-scope="temporary-domain-only"')
    expect(row).toContain('Death Cap Mushroom')
    expect(row).toContain('<code>death-cap-mushroom</code>')
    expect(row).toContain('accepted')
    expect(row).toContain('ItemIdName')
    expect(row).toContain('ItemId.SerializedId')
    expect(row.match(/<code>DeathCapMushroom<\/code>/g)).toHaveLength(2)
    expect(row).toContain('BP_DeathCapMushroomGameplayEffect_C')
    expect(row).toContain('Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect')
  })

  it('shows all four committed provenance steps including the target snapshot provenance', () => {
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))
    for (const label of ['ObjectProperty', 'class import', 'outer package import', 'target Raw snapshot', 'Artifact path', 'Raw package', 'Dataset', 'Extraction run', 'Package hash', 'Source fingerprint']) expect(row).toContain(label)
    expect(row).toContain('research/raw/packages/Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect.raw.json')
    expect(row).toContain('sha256-path-size-v1')
  })

  it('preserves unresolved gameplay semantics and does not leak runtime or research values', () => {
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))
    expect(row).toContain('gameplay-effect-semantics')
    expect(row).toContain('Applicationでは解決・解釈していません')
    expect(row).toContain('serialized relationは確認済み')
    for (const prohibited of ['duration', 'attack speed', 'movement speed', 'Power scaling', 'stacking', 'effective uptime', 'buff / modifier magnitude', '8 + 0.052', '30秒', 'UIData']) expect(row).not.toContain(prohibited)
  })

  it('reads only the committed temporary Domain artifact at the Death Cap Application boundary', () => {
    const modelSource = fs.readFileSync('src/screens/dataBrowser/deathCapMushroomBrowserModel.ts', 'utf8')
    const componentSource = fs.readFileSync('src/screens/dataBrowser/DeathCapMushroomDataBrowser.tsx', 'utf8')
    const boundarySources = `${modelSource}\n${componentSource}`
    expect(modelSource).toContain("research/domain/temporary/death-cap-mushroom.json")
    expect(modelSource).toContain('import type { deathCapMushroomMappings, projectDeathCapMushroom }')
    expect(modelSource).not.toMatch(/import \{ deathCapMushroomMappings, projectDeathCapMushroom \}/)
    for (const prohibited of ['research/raw/', 'projectDeathCapMushroom(', 'data/artifacts', 'artifactAudit', 'source-harvest', 'UIData']) expect(boundarySources).not.toContain(prohibited)
  })
})
