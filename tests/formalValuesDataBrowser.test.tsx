import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import identityJson from '../research/domain/formal/identity-evidence-v1.json'
import valueJson from '../research/domain/formal/value-availability-v2.json'
import { evidenceFingerprint, type FormalIdentityEvidenceArtifact } from '../src/domain/formal/identityEvidence'
import { collectSemanticOccurrences, type FormalValueAvailabilityArtifact } from '../src/domain/formal/valueAvailability'
import { createFormalValuesBrowserIndex, formalValuesBrowserIndex } from '../src/screens/dataBrowser/formalValuesBrowserModel'
import { FormalValuesDataBrowser, FormalValuesPanel } from '../src/screens/dataBrowser/FormalValuesDataBrowser'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

const identity = identityJson as FormalIdentityEvidenceArtifact
const values = valueJson as unknown as FormalValueAvailabilityArtifact
const clone = () => structuredClone(values)
function unavailable(state: 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted' | 'dependency') {
  const artifact = clone()
  const record = artifact.valueProjections.find((p) => state === 'dependency'
    ? p.mappingId === 'scatter-crossbow:configured-pushback-strength@1'
    : p.occurrence.domainId === 'corrupted-seeds')!
  if (state === 'dependency') delete artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions![0]!.configuredPushbackStrength
  else artifact.semantic.artifact['corrupted-seeds'] = {}
  const common = { projectionId: record.projectionId, mappingId: record.mappingId, occurrence: record.occurrence, relationProjectionRef: record.relationProjectionRef }
  if (state === 'dependency') {
    artifact.valueProjections[artifact.valueProjections.indexOf(record)] = { ...common, result: 'unavailable', failureKind: 'dependency', reason: 'Relation target snapshot not supplied' }
  } else {
    artifact.valueProjections[artifact.valueProjections.indexOf(record)] = { ...common, result: 'unavailable', failureKind: 'raw', sourceState: state, reason: 'Raw value not available', evidenceRefs: record.evidenceRefs! }
    const evidence = artifact.provenance.evidence.find((e) => e.id === record.evidenceRefs![0])!
    evidence.observation = { sourceState: state, reason: 'Raw value not available' }
    const { fingerprint: _, ...content } = evidence
    void _
    evidence.fingerprint = evidenceFingerprint(content)
  }
  return artifact
}

describe('shared Formal Value browser', () => {
  it('covers every current Value domain and projection without changing ordering or values', () => {
    expect(formalValuesBrowserIndex.size).toBe(62)
    expect([...formalValuesBrowserIndex.values()].flatMap((model) => model.rows)).toHaveLength(1128)
    const sourceValues = new Map(collectSemanticOccurrences(values.semantic).map((entry) => [entry.value.projectionRef, entry.value.value]))
    for (const [domainId, model] of formalValuesBrowserIndex) {
      expect(model.rows.map((row) => row.projectionRef)).toEqual(values.valueProjections.filter((p) => p.occurrence.domainId === domainId).map((p) => p.projectionId))
      expect(model.rows.every((row) => row.state === 'known')).toBe(true)
      for (const row of model.rows) if (row.state === 'known') expect(row.value).toEqual(sourceValues.get(row.projectionRef))
    }
    expect(formalValuesBrowserIndex.has('battle-robe')).toBe(false)
    expect(renderToStaticMarkup(createElement(FormalValuesDataBrowser, { domainId: 'missing' }))).toBe('')
  })

  it('shows Powershaker configured stacks with source trace and the effective-behavior limitation', () => {
    const model = formalValuesBrowserIndex.get('powershaker')!
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).toMatchObject({ state: 'known', value: 5, mappingId: 'powershaker:configured-attack-stacks@1' })
    const html = renderToStaticMarkup(createElement(FormalValuesPanel, { model }))
    expect(html).toContain('<code>5</code>')
    expect(html).toContain('設定攻撃スタック数')
    expect(html).toContain('Raw node')
    expect(html).toContain('最終ダメージ・実効攻撃間隔・実際の効果やOptimizerでの採用を意味しません')
  })

  it.each(['unknown', 'unsupported', 'parse-failed', 'not-extracted', 'dependency'] as const)('preserves %s without a numeric fallback or invented evidence', (state) => {
    const model = createFormalValuesBrowserIndex(identity, unavailable(state)).get(state === 'dependency' ? 'scatter-crossbow' : 'corrupted-seeds')!
    const row = model.rows.find((entry) => entry.state === state)!
    expect(row.state).toBe(state)
    expect(row).not.toHaveProperty('value')
    expect(row.evidence.length).toBe(state === 'dependency' ? 0 : 1)
    const html = renderToStaticMarkup(createElement(FormalValuesPanel, { model }))
    expect(html).toContain(`取得不能（${state}）`)
    expect(html).toContain(state === 'dependency' ? 'Relation target snapshot not supplied' : 'Raw value not available')
    if (state !== 'dependency') expect(html).not.toContain('<code>0</code>')
  })

  it('keeps decoded zero, false, empty arrays and raw sourceIndex identity visible', () => {
    const decoded = clone()
    decoded.semantic.ranged['scatter-crossbow']!.projectileDefinitions![0]!.configuredPushbackEnabled!.value = false
    const model = createFormalValuesBrowserIndex(identity, decoded).get('scatter-crossbow')!
    expect(model.rows.some((row) => row.state === 'known' && row.value === false)).toBe(true)
    expect(model.rows.some((row) => row.state === 'known' && row.value === 0)).toBe(true)
    const html = renderToStaticMarkup(createElement(FormalValuesPanel, { model }))
    expect(html).toContain('<code>false</code>')
    expect(html).toContain('<code>0</code>')
    const empty = clone()
    empty.semantic.melee['fighters-bindings']!.configuredAttacks!.value = []
    empty.semantic.melee['fighters-bindings']!.attacks = []
    empty.valueProjections = empty.valueProjections.filter((p) => p.occurrence.domainId !== 'fighters-bindings' || 'scopeRef' in p.occurrence)
    const emptyModel = createFormalValuesBrowserIndex(identity, empty).get('fighters-bindings')!
    expect(renderToStaticMarkup(createElement(FormalValuesPanel, { model: emptyModel }))).toContain('<code>[]</code>')
    expect(html).toContain('エントリ 0')
  })

  it('rejects dangling/duplicate/conflicting provenance and identity or occurrence drift', () => {
    const mutations: ((value: FormalValueAvailabilityArtifact) => void)[] = [
      (v) => { v.provenance.evidence.pop() },
      (v) => { v.valueProjections.push(v.valueProjections[0]!) },
      (v) => { v.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage!.evidenceRefs = ['missing'] },
      (v) => { v.valueProjections[0]!.occurrence.domainId = 'wrong-domain' },
      (v) => { v.provenance.evidence[0]!.observation.sourceState = 'unknown' },
      (v) => { v.semantic.melee['fighters-bindings']!.attacks![0]!.sourceIndex = 99 },
    ]
    for (const mutation of mutations) {
      const artifact = clone()
      mutation(artifact)
      expect(() => createFormalValuesBrowserIndex(identity, artifact)).toThrow()
    }
    const unresolved = structuredClone(identity)
    unresolved.semantic.identities.find((i) => i.assertionId === 'identity:corrupted-seeds@1')!.resolution.state = 'unresolved'
    expect(() => createFormalValuesBrowserIndex(unresolved, values)).toThrow()
  })

  it('connects the entire eligible population to catalog rows, preserves representatives and shows trace boundaries', () => {
    const routes = ['/data/melee', '/data/ranged', '/data/artifacts'] as const
    const html = routes.map((route) => renderToStaticMarkup(createElement(DataBrowserPage, { route }))).join('')
    for (const domainId of formalValuesBrowserIndex.keys()) expect(html).toContain(`data-formal-values-domain="${domainId}"`)
    expect(html.match(/data-formal-projection=/g)).toHaveLength(1128)
    expect(html).toContain('最終ダメージ・実効攻撃間隔・実際の効果やOptimizerでの採用を意味しません')
    expect(html).toContain('Extraction run')
    expect(html).toContain('Raw node')
    expect(html).toContain('data-domain-scope="formal-domain"')
    const sources = ['formalValuesBrowserModel.ts', 'FormalValuesDataBrowser.tsx'].map((file) => fs.readFileSync(`src/screens/dataBrowser/${file}`, 'utf8')).join('')
    expect(sources).not.toMatch(/research\/raw\/|domain\/temporary|scripts\//)
  })
})
