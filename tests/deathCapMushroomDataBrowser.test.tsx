import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import identityArtifact from '../research/domain/formal/identity-evidence-v1.json'
import relationArtifact from '../research/domain/formal/serialized-relation-v2.json'
import { deathCapMushroomBrowserProjection } from '../src/screens/dataBrowser/deathCapMushroomBrowserModel'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function deathCapRow(html: string): string {
  const start = html.indexOf('data-equipment-id="death-cap-mushroom"')
  const end = html.indexOf('data-equipment-id="', start + 40)
  return html.slice(start, end === -1 ? undefined : end)
}

describe('Death Cap Mushroom Formal Data Browser consumer', () => {
  it('uses the matched Formal identity and preserves accepted presentation', () => {
    const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === 'identity:death-cap-mushroom@1')!
    const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === identity.assertionId)!
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))

    expect(identity.resolution.state).toBe('matched')
    expect(deathCapMushroomBrowserProjection.identity.domainId).toBe(identity.resolution.domainId)
    expect(deathCapMushroomBrowserProjection.identity.status).toBe(assertion.reviewState)
    expect(assertion.reviewState).toBe('accepted')
    expect(row).toContain('data-domain-scope="formal-domain"')
    expect(row).toContain('FORMAL GAME DOMAIN')
    expect(row).toContain('Formal Domain')
    expect(row).toContain('Death Cap Mushroom')
    expect(row).toContain('<code>death-cap-mushroom</code>')
    expect(row).toContain('accepted')
    expect(row).toContain('ItemIdName')
    expect(row).toContain('ItemId.SerializedId')
    expect(row.match(/<code>DeathCapMushroom<\/code>/g)).toHaveLength(2)
  })

  it('renders the projected Formal Effect relation and resolved target Raw snapshot', () => {
    const relation = relationArtifact.semantic.relations.find((entry) => entry.relationRef === 'relation:death-cap-mushroom:effect@1')!
    const relationProjection = relationArtifact.relationProjections.find((entry) => entry.relationRef === relation.relationRef)!
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))

    expect(deathCapMushroomBrowserProjection.effectRelation.relationRef).toBe(relation.relationRef)
    expect(deathCapMushroomBrowserProjection.effectRelation.target).toMatchObject(relation.target)
    expect(relationProjection.result).toBe('projected')
    expect(relationProjection.targetRawVerification).toMatchObject({
      input: 'supplied',
      result: 'resolved',
    })
    expect(row).toContain('Effect serialized relation')
    expect(row).toContain('<code>projected</code>')
    expect(row).toContain('BP_DeathCapMushroomGameplayEffect_C')
    expect(row).toContain('BlueprintGeneratedClass')
    expect(row).toContain('/Game/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect')
    expect(row).toContain('<code>supplied</code>')
    expect(row).toContain('<code>resolved</code>')
    expect(row).toContain('target Raw snapshotもresolvedです')
  })

  it('renders relation and target provenance from Formal EvidenceRefs', () => {
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))
    for (const label of ['ObjectProperty', 'class import', 'outer package import', 'target Raw snapshot', 'Artifact path', 'Raw package', 'Dataset', 'Extraction run', 'Package hash', 'Source fingerprint']) {
      expect(row).toContain(label)
    }
    expect(row).toContain('/package/objects/1/properties/0')
    expect(row).toContain('/package/imports/2')
    expect(row).toContain('/package/imports/18')
    expect(row).toContain('research/raw/packages/Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect.raw.json')
    expect(row).toContain('sha256-path-content-v1')
    expect(row).toContain('sha256-path-size-v1')
  })

  it('keeps GameplayEffect semantics outside Formal v2 and does not infer unsupported gameplay values', () => {
    const row = deathCapRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/artifacts' })))

    expect(JSON.stringify(relationArtifact.semantic)).not.toContain('gameplay-effect-semantics')
    expect(row).toContain('GameplayEffect semanticsはFormal v2ではassertしていません')
    expect(row).toContain('Applicationでは効果内容を解釈・推測しません')
    expect(row).toContain('これはGameplayEffect semanticsが既知であることを意味しません')
    for (const prohibited of ['duration', 'attack speed', 'movement speed', 'Power scaling', 'stacking', 'effective uptime', 'buff / modifier magnitude', '8 + 0.052', '30秒', 'UIData']) {
      expect(row).not.toContain(prohibited)
    }
  })

  it('keeps the Death Cap Application boundary on committed Formal artifacts only', () => {
    const browserSources = [
      'src/screens/DataBrowserPage.tsx',
      'src/screens/dataBrowser/DeathCapMushroomDataBrowser.tsx',
      'src/screens/dataBrowser/deathCapMushroomBrowserModel.ts',
    ].map((sourcePath) => fs.readFileSync(sourcePath, 'utf8')).join('\n')

    expect(browserSources).toContain('research/domain/formal/identity-evidence-v1.json')
    expect(browserSources).toContain('research/domain/formal/serialized-relation-v2.json')
    expect(browserSources).not.toMatch(/research\/domain\/temporary\/death-cap-mushroom\.json|src\/domain\/temporary/)
    expect(browserSources).not.toMatch(/research\/raw\//)
    expect(browserSources).not.toMatch(/src\/domain\/formal|projectDeathCapMushroom\(|buildFormalSerializedRelationArtifact\(|collectFormalSerializedRelationErrors\(|extract:game-data-raw-package/)
  })
})
