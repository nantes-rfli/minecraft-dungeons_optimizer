import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function battleRobeRow(html: string): string {
  const start = html.indexOf('data-equipment-id="battle-robe"')
  const end = html.indexOf('data-equipment-id="', start + 35)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Battle Robe Data Browser vertical slice', () => {
  it('renders provisional identity and the serialized GearActor target from the committed Domain artifact', () => {
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))
    expect(row).toContain('data-domain-scope="temporary-domain-only"')
    expect(row).toContain('Battle Robe')
    expect(row).toContain('provisional')
    expect(row).toContain('ItemIdName')
    expect(row).toContain('ItemId.SerializedId')
    expect(row.match(/<code>BattleRobe<\/code>/g)).toHaveLength(2)
    expect(row).toContain('BP_BattleRobe_C')
    expect(row).toContain('/Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe')
    expect(row).toContain('参照先Actor packageの内容を解決した表示ではありません')
  })

  it('preserves unresolved Armor Property ownership without inventing gameplay effects', () => {
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))
    expect(row).toContain('armor-property-ownership')
    expect(row).toContain('Armor Property所有関係を確立できていません')
    expect(row).toContain('propertyの件数や有無は判断していません')
    for (const prohibited of ['MeleeDamageBoost', 'ItemCooldownDecrease', '+30%', '-40%', '現在Domainでは未投影', '効果なし']) expect(row).not.toContain(prohibited)
  })

  it('uses only the committed Domain artifact at the Application projection boundary', () => {
    const modelSource = fs.readFileSync('src/screens/dataBrowser/battleRobeBrowserModel.ts', 'utf8')
    const componentSource = fs.readFileSync('src/screens/dataBrowser/BattleRobeDataBrowser.tsx', 'utf8')
    const boundarySources = `${modelSource}\n${componentSource}`
    expect(modelSource).toContain("research/domain/temporary/battle-robe.json")
    expect(modelSource).toContain('import type { battleRobeMappings, projectBattleRobe }')
    expect(modelSource).not.toMatch(/import \{ battleRobeMappings, projectBattleRobe \}/)
    for (const prohibited of ['research/raw/', 'projectBattleRobe(', 'game-data', 'data/armors', 'MeleeDamageBoost', 'ItemCooldownDecrease']) expect(boundarySources).not.toContain(prohibited)
  })

  it('keeps identity and the three GearActor trace steps distinct without provenance on unresolved ownership', () => {
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))
    for (const label of ['Domain field', 'Raw property', 'Raw package', 'Dataset', 'Extraction run', 'ObjectProperty', 'class import', 'outer package import']) expect(row).toContain(label)
    expect(row.match(/<summary>provenanceを確認<\/summary>/g)).toHaveLength(2)
    expect(row.match(/reference provenanceを確認/g)).toHaveLength(1)
    const unresolved = row.slice(row.indexOf('id="battle-robe-unresolved-title"'))
    expect(unresolved).not.toContain('Raw package')
    expect(unresolved).not.toContain('Raw node')
  })
})
