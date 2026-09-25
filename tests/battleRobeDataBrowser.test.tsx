import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import identityArtifact from '../research/domain/formal/identity-evidence-v1.json'
import relationArtifact from '../research/domain/formal/serialized-relation-v2.json'
import { battleRobeBrowserProjection } from '../src/screens/dataBrowser/battleRobeBrowserModel'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function battleRobeRow(html: string): string {
  const start = html.indexOf('data-equipment-id="battle-robe"')
  const end = html.indexOf('data-equipment-id="', start + 35)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Battle Robe Formal Data Browser consumer', () => {
  it('uses matched Formal identity and preserves provisional presentation', () => {
    const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === 'identity:battle-robe@1')!
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))

    expect(identity.resolution.state).toBe('matched')
    expect(battleRobeBrowserProjection.identity.domainId).toBe(identity.resolution.domainId)
    expect(row).toContain('data-domain-scope="formal-domain"')
    expect(row).toContain('FORMAL GAME DOMAIN')
    expect(row).toContain('Battle Robe')
    expect(row).toContain('<code>battle-robe</code>')
    expect(row).toContain('provisional')
    expect(row).toContain('ItemIdName')
    expect(row).toContain('ItemId.SerializedId')
    expect(row.match(/<code>BattleRobe<\/code>/g)).toHaveLength(2)
  })

  it('renders the Formal GearActor relation without resolving the target Raw snapshot', () => {
    const relation = relationArtifact.semantic.relations.find((entry) => entry.relationRef === 'relation:battle-robe:gear-actor@1')!
    const relationProjection = relationArtifact.relationProjections.find((entry) => entry.relationRef === relation.relationRef)!
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))

    expect(battleRobeBrowserProjection.gearActorRelation.relationRef).toBe(relation.relationRef)
    expect(battleRobeBrowserProjection.gearActorRelation.target).toMatchObject(relation.target)
    expect(relationProjection.result).toBe('projected')
    expect(relationProjection.targetRawVerification).toEqual({
      input: 'not-supplied',
      result: 'not-resolved',
      reason: 'target-snapshot-not-supplied',
    })
    expect(row).toContain('GearActor serialized relation')
    expect(row).toContain('BP_BattleRobe_C')
    expect(row).toContain('BlueprintGeneratedClass')
    expect(row).toContain('/Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe')
    expect(row).toContain('<code>not-supplied</code>')
    expect(row).toContain('<code>not-resolved</code>')
    expect(row).toContain('target-snapshot-not-supplied')
    expect(row).toContain('targetはresolvedではありません')
  })

  it('keeps Armor Property ownership as Battle Robe-specific presentation rather than Formal semantics', () => {
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))
    const battleRelation = relationArtifact.semantic.relations.find((entry) => entry.relationRef === 'relation:battle-robe:gear-actor@1')!

    expect(JSON.stringify(battleRelation)).not.toContain('armor-property-ownership')
    expect(row).toContain('armor-property-ownership')
    expect(row).toContain('Armor Property ownership semanticsはFormal v2ではassertしていません')
    expect(row).toContain('propertyの有無・件数・gameplay effectを推測しません')
    for (const prohibited of ['MeleeDamageBoost', 'ItemCooldownDecrease', '+30%', '-40%', '効果なし', 'propertyは0件', 'propertyがない']) {
      expect(row).not.toContain(prohibited)
    }
  })

  it('renders relation provenance from Formal EvidenceRefs', () => {
    const row = battleRobeRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' })))
    for (const label of ['Domain field', 'Raw property', 'Raw package', 'Dataset', 'Extraction run', 'Raw node', 'ObjectProperty', 'class import', 'outer package import']) {
      expect(row).toContain(label)
    }
    expect(row.match(/<summary>provenanceを確認<\/summary>/g)).toHaveLength(2)
    expect(row.match(/reference provenanceを確認/g)).toHaveLength(1)
    expect(row).toContain('/package/objects/1/properties/0')
    expect(row).toContain('/package/imports/1')
    expect(row).toContain('/package/imports/11')

    const boundary = row.slice(row.indexOf('id="battle-robe-unresolved-title"'))
    expect(boundary).not.toContain('Raw package')
    expect(boundary).not.toContain('Raw node')
  })

  it('keeps the Application boundary on committed Formal artifacts only', () => {
    const browserSources = [
      'src/screens/DataBrowserPage.tsx',
      'src/screens/dataBrowser/BattleRobeDataBrowser.tsx',
      'src/screens/dataBrowser/battleRobeBrowserModel.ts',
    ].map((sourcePath) => fs.readFileSync(sourcePath, 'utf8')).join('\n')

    expect(browserSources).toContain('research/domain/formal/identity-evidence-v1.json')
    expect(browserSources).toContain('research/domain/formal/serialized-relation-v2.json')
    expect(browserSources).not.toMatch(/research\/domain\/temporary\/battle-robe\.json|src\/domain\/temporary|research\/raw\//)
    expect(browserSources).not.toMatch(/projectBattleRobe\(|projectSerializedRelation\(|projectIdentity\(|src\/domain\/formal/)
  })
})
