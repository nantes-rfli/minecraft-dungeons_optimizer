import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import identityArtifact from '../research/domain/formal/identity-evidence-v1.json'
import valueArtifact from '../research/domain/formal/value-availability-v2.json'
import relationArtifact from '../research/domain/formal/serialized-relation-v1.json'
import { scatterCrossbowBrowserProjection } from '../src/screens/dataBrowser/scatterCrossbowBrowserModel'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

function scatterCrossbowRow(html: string): string {
  const start = html.indexOf('data-equipment-id="scatter-crossbow"')
  const end = html.indexOf('data-equipment-id="', start + 40)
  return html.slice(start, end === -1 ? undefined : end)
}

function renderedRow(): string {
  return scatterCrossbowRow(renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/ranged' })))
}

describe('Scatter Crossbow Formal Data Browser consumer', () => {
  it('uses the matched Formal identity and preserves accepted Raw identity presentation', () => {
    const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === 'identity:scatter-crossbow@1')!
    const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === identity.assertionId)!
    const row = renderedRow()

    expect(identity.resolution.state).toBe('matched')
    expect(scatterCrossbowBrowserProjection.identity.domainId).toBe(identity.resolution.domainId)
    expect(scatterCrossbowBrowserProjection.identity.status).toBe(assertion.reviewState)
    expect(assertion.reviewState).toBe('accepted')
    expect(row).toContain('data-domain-scope="formal-domain"')
    expect(row).toContain('FORMAL GAME DOMAIN')
    expect(row).toContain('Scatter Crossbow')
    expect(row).toContain('<code>scatter-crossbow</code>')
    expect(row).toContain('accepted')
    expect(row).toContain('ItemIdName')
    expect(row).toContain('ItemId.SerializedId')
    expect(row.match(/<code>ScatterCrossbow<\/code>/g)).toHaveLength(2)
  })

  it('renders source-side configured Formal Values without deriving effective behavior', () => {
    const formal = valueArtifact.semantic.ranged['scatter-crossbow']
    const definition = scatterCrossbowBrowserProjection.configuredProjectileDefinitions.definitions[0]!
    const row = renderedRow()

    expect(scatterCrossbowBrowserProjection.configuredProjectileDefinitions.value).toEqual(formal.configuredProjectileDefinitions.value)
    expect(definition.sourceIndex).toBe(formal.projectileDefinitions[0]!.sourceIndex)
    expect(definition.configuredProjectileCount.value).toBe(3)
    expect(definition.configuredAngleSpan.value).toBe(20)
    expect(definition.configuredDelaySecondsPerProjectile.value).toBe(0.029999999329447746)
    expect(scatterCrossbowBrowserProjection.configuredProjectileVelocityFactor.value).toBe(1.100000023841858)

    expect(row).toContain('Configured projectile count')
    expect(row).toContain('>3<')
    expect(row).toContain('>20<')
    expect(row).not.toContain('20°')
    expect(row).toContain('0.029999999329447746 s')
    expect(row).toContain('1.100000023841858')
  })

  it('renders the same-sourceIndex Formal Projectile relation and resolved target result', () => {
    const definition = scatterCrossbowBrowserProjection.configuredProjectileDefinitions.definitions[0]!
    const relation = relationArtifact.semantic.relations.find((entry) => entry.projectionRef === definition.projectileRelation.projectionRef)!
    const relationProjection = relationArtifact.relationProjections.find((entry) => entry.projectionRef === relation.projectionRef)!
    const row = renderedRow()

    expect(definition.projectileRelation.sourceIndex).toBe(definition.sourceIndex)
    expect(definition.projectileRelation.relationRef).toBe(relation.relationRef)
    expect(definition.projectileRelation.target).toMatchObject(relation.target)
    expect(relationProjection.result).toBe('projected')
    expect(relationProjection.targetResolution).toMatchObject({ input: 'supplied', result: 'resolved' })

    expect(row).toContain('Projectile serialized relation')
    expect(row).toContain('<code>projected</code>')
    expect(row).toContain('BP_ScatterCrossBow_Arrow_C')
    expect(row).toContain('BlueprintGeneratedClass')
    expect(row).toContain('/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow')
    expect(row).toContain('<code>supplied</code>')
    expect(row).toContain('<code>resolved</code>')
  })

  it('renders target-side Formal Values and keeps relationProjectionRef as a presentation reference', () => {
    const formalDefinition = valueArtifact.semantic.ranged['scatter-crossbow'].projectileDefinitions[0]!
    const definition = scatterCrossbowBrowserProjection.configuredProjectileDefinitions.definitions[0]!
    const row = renderedRow()

    expect(definition.configuredPushbackEnabled.value).toBe(true)
    expect(definition.configuredPushbackStrength.value).toBe(0.6000000238418579)
    expect(definition.configuredIgnoreFriendlyFire.value).toBe(true)
    expect(definition.configuredPushbackEnabled.relationProjectionRef).toBe(formalDefinition.configuredPushbackEnabled.relationProjectionRef)
    expect(definition.configuredPushbackStrength.relationProjectionRef).toBe(formalDefinition.configuredPushbackStrength.relationProjectionRef)
    expect(definition.configuredIgnoreFriendlyFire.relationProjectionRef).toBe(formalDefinition.configuredIgnoreFriendlyFire.relationProjectionRef)
    expect(definition.projectileRelation.projectionRef).toBe(formalDefinition.configuredPushbackEnabled.relationProjectionRef)

    expect(row).toContain('Configured referenced projectile parameters')
    expect(row).toContain('Configured pushback enabled')
    expect(row).toContain('Configured pushback strength')
    expect(row).toContain('Configured ignore friendly fire')
    expect(row).toContain('0.6000000238418579')
    expect(row.match(/>true</g)).toHaveLength(2)
    expect(row).toContain('Relation projection ref')
  })

  it('keeps Value and Relation provenance separate and traceable from Formal EvidenceRefs', () => {
    const definition = scatterCrossbowBrowserProjection.configuredProjectileDefinitions.definitions[0]!
    const row = renderedRow()

    for (const label of [
      'Value EvidenceRef',
      'Relation EvidenceRef',
      'Artifact path',
      'Raw property',
      'Raw package',
      'Dataset',
      'Extraction run',
      'Package hash',
      'Raw node',
      'ObjectProperty',
      'class import',
      'outer package import',
      'target Raw snapshot',
      'Source fingerprint',
    ]) expect(row).toContain(label)

    expect(definition.configuredPushbackEnabled.evidenceRefs).not.toEqual(definition.projectileRelation.evidenceRefs)
    expect(row).toContain('/package/objects/1/properties/0/decoding/properties/1/decoding/elements/0/properties/0')
    expect(row).toContain('/package/imports/4')
    expect(row).toContain('/package/imports/20')
    expect(row).toContain('BP_ScatterCrossbowInstance')
    expect(row).toContain('BP_ScatterCrossBow_Arrow')
    expect(row).toContain('sha256-path-content-v1')
    expect(row).toContain('sha256-path-size-v1')
  })

  it('keeps effective gameplay semantics as Scatter-specific Application boundary presentation', () => {
    const row = renderedRow()

    for (const label of ['final damage', 'effective projectile behavior', 'effective firing cadence', 'final gameplay behavior']) {
      expect(row).toContain(label)
    }
    expect(row).toContain('Data Browser固有のApplication boundary presentation')
    expect(row).toContain('generic unknownを推論していません')
  })

  it('keeps the Scatter Crossbow Application boundary on committed Formal artifacts only', () => {
    const browserSources = [
      'src/screens/DataBrowserPage.tsx',
      'src/screens/dataBrowser/ScatterCrossbowDataBrowser.tsx',
      'src/screens/dataBrowser/scatterCrossbowBrowserModel.ts',
    ].map((sourcePath) => fs.readFileSync(sourcePath, 'utf8')).join('\n')

    expect(browserSources).toContain('research/domain/formal/identity-evidence-v1.json')
    expect(browserSources).toContain('research/domain/formal/value-availability-v2.json')
    expect(browserSources).not.toContain('research/domain/formal/value-availability-v1.json')
    expect(browserSources).toContain('research/domain/formal/serialized-relation-v1.json')
    expect(browserSources).not.toMatch(/research\/domain\/temporary\/scatter-crossbow\.json|src\/domain\/temporary/)
    expect(browserSources).not.toMatch(/research\/raw\//)
    expect(browserSources).not.toMatch(/src\/domain\/formal|projectScatterCrossbow\(|projectSerializedRelation\(|buildFormalSerializedRelationArtifact\(|buildFormalValueAvailabilityArtifact\(|extract:game-data-raw-package/)
    expect(browserSources).not.toMatch(/ObjectProperty import identity mismatch|classImportMatches|outerMatches|sameDataset|target Raw package, dataset, or fingerprint mismatch/)
    expect(browserSources).not.toMatch(/targetResolution\.result\s*[!=]=|relationProjection\.result\s*[!=]=|valueProjections\.[^\n]*result/)
  })
})
