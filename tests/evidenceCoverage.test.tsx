import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCoverageAdapters, collectAdapterSourceErrors, COVERAGE_SOURCE_DOCUMENTS } from '../src/research/evidenceCoverage/adapters'
import { buildEvidenceCoverage, buildCoverageDashboard, renderCoverageReport } from '../src/research/evidenceCoverage/report'
import { collectCoverageErrors, collectProtocolErrors, collectSummaryErrors } from '../src/research/evidenceCoverage/validation'
import { buildMeasurementProtocols, markdownSection, resolveProtocolCloseConditions } from '../src/research/evidenceCoverage/protocols'
import { collectBacklogMigrationErrors, readTableRows, renderBacklogTable, RUNTIME_BACKLOG } from '../src/research/evidenceCoverage/backlog'
import { DataCoverageSection } from '../src/views/DataCoverage'
import type { JsonValue } from '../src/research/evidenceCoverage/model'
import backlogJson from '../research/runtime/runtime-backlog.json'

const adapters = buildCoverageAdapters()
const snapshot = buildEvidenceCoverage(adapters)
const modelDoc = fs.readFileSync(new URL('../docs/model-regression.md', import.meta.url), 'utf8')
const protocols = buildMeasurementProtocols(modelDoc, '1.17.0.0')
const sourceDocuments: Readonly<Record<string, JsonValue>> = { ...COVERAGE_SOURCE_DOCUMENTS, 'research/runtime/runtime-backlog.json': backlogJson }
const resolve = (ref: string) => {
  const [file, fragment] = ref.split('#')
  if (!file || !fs.existsSync(new URL(`../${file}`, import.meta.url))) return { valid: false }
  if (!fragment?.startsWith('/')) return { valid: true }
  let value: JsonValue | undefined = sourceDocuments[file]
  for (const part of fragment.slice(1).split('/')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return { valid: false }
    value = (value as Record<string, JsonValue>)[part]
  }
  return { valid: true, value }
}

describe('Evidence & Coverage read model', () => {
  it('reconciles all populations with support sources and keeps source facets lossless', () => {
    expect(collectAdapterSourceErrors(adapters)).toEqual([])
    expect(collectCoverageErrors(snapshot, adapters, resolve)).toEqual([])
    expect(snapshot.categories.map((c) => [c.id, c.population, c.runtime.full, c.runtime.limited, c.runtime.researchOnly])).toEqual([
      ['melee-attack-profile', 82, 0, 0, 0], ['melee-enchantment', 33, 19, 9, 5], ['artifact', 45, 2, 1, 42], ['armor', 73, 0, 10, 63], ['armor-enchantment', 41, 0, 7, 34], ['dps-regression', 10, 0, 0, 0],
      ['ranged-weapon', 71, 0, 2, 69], ['ranged-enchantment', 41, 0, 3, 38],
    ])
  })
  it('does not treat exact profiles or Full runtime as verified evidence', () => {
    const profile = snapshot.records.find((r) => r.category === 'melee-attack-profile' && r.evidence.verificationStatus === 'exact')!
    expect(profile.runtimeSupport).toBe('unknown')
    expect(profile.evidence.sampleCount).toBeNull()
    const full = snapshot.records.find((r) => r.runtimeSupport === 'full')!
    expect(full.evidence.verificationStatus).toBeNull()
    expect(snapshot.records.find((r) => r.category === 'dps-regression')!.runtimeSupport).toBe('not-applicable')
  })
  it('counts shared backlog once globally and retains acquisition negative results', () => {
    expect(snapshot.backlogSummary).toMatchObject({ total: 26, p1EvidenceBlocked: 8, notImplemented: 4, priorities: { P0: 1, P1: 8, P2: 7, P3: 10 } })
    const dr = snapshot.blockers.filter((b) => b.id === 'backlog:armor-dr')
    expect(dr).toHaveLength(1)
    expect(dr[0]!.categories).toEqual(['armor', 'armor-enchantment'])
    const acquisition = snapshot.blockers.filter((b) => b.origin === 'acquisition')
    expect(acquisition).toHaveLength(6)
    expect(acquisition.every((b) => b.kind === 'evidence-blocked' && b.priority === null)).toBe(true)
    const details = snapshot.categories.find((c) => c.id === 'artifact')!.details
    expect(details.publicEvidenceConclusion).toBe('public-evidence-exhausted')
    expect(JSON.stringify(details.conflicts)).toContain('"selectedValue":null')
  })
  it('preserves historical armor audit blockers as evidence after promotion', () => {
    const healthSynergy = snapshot.records.find((r) => r.category === 'armor-enchantment' && r.id === 'health-synergy')!
    expect(healthSynergy.runtimeSupport).toBe('limited')
    expect(healthSynergy.evidence.facets.length).toBeGreaterThan(0)
    expect(healthSynergy.blockerIds).toEqual([])
  })
  it('detects dropped adapter entries independently of aggregate counts', () => {
    const broken = adapters.map((adapter, index) => index === 0 ? { ...adapter, records: adapter.records.slice(1) } : adapter)
    expect(collectAdapterSourceErrors(broken)).toContain('melee-attack-profile: adapter population/support does not match its source')
  })
  it('rejects duplicate IDs, unknown-to-zero/full conversion, malformed priorities and dangling refs', () => {
    const duplicate = { ...snapshot, records: [...snapshot.records, snapshot.records[0]!] }
    expect(collectCoverageErrors(duplicate, adapters, resolve).join('\n')).toContain('Duplicate record ID')
    const record = snapshot.records[0]!
    const converted = { ...snapshot, records: [{ ...record, runtimeSupport: 'full', evidence: { ...record.evidence, sampleCount: 0 } }, ...snapshot.records.slice(1)] }
    expect(collectCoverageErrors(converted, adapters, resolve).join('\n')).toContain('unknown must not become Full')
    expect(collectCoverageErrors(converted, adapters, resolve).join('\n')).toContain('unknown must not become zero')
    const broken = { ...snapshot, blockers: [{ ...snapshot.blockers[0], priority: 'P4', kind: 'verified', recordKeys: ['armor:missing'] }, ...snapshot.blockers.slice(1)] }
    const errors = collectCoverageErrors(broken, adapters, resolve).join('\n')
    expect(errors).toContain('invalid priority')
    expect(errors).toContain('invalid blocker kind')
    expect(errors).toContain('unknown entity reference')
    expect(collectCoverageErrors(snapshot, adapters, () => ({ valid: false })).join('\n')).toContain('untraceable')
  })
  it('detects summary drift and deterministically generates the same report', () => {
    expect(renderCoverageReport(snapshot)).toBe(renderCoverageReport(buildEvidenceCoverage()))
    expect(collectSummaryErrors({ ...snapshot, backlogSummary: { ...snapshot.backlogSummary, total: 0 } }, snapshot)).toEqual(['Derived backlogSummary drift'])
    expect(buildCoverageDashboard(snapshot, protocols).regression).toEqual({ eligible: 0, minimum: 5, candidates: 10 })
  })
})

describe('Backlog migration and measurement protocol foundation', () => {
  it('round-trips every legacy cell and catches omissions or altered close gates', () => {
    const original = renderBacklogTable()
    expect(collectBacklogMigrationErrors(original, RUNTIME_BACKLOG)).toEqual([])
    expect(collectBacklogMigrationErrors(original, RUNTIME_BACKLOG.slice(1))).not.toEqual([])
    expect(collectBacklogMigrationErrors(original, RUNTIME_BACKLOG.map((r, i) => i ? r : { ...r, closeCondition: 'lost' }))).not.toEqual([])
    expect(() => readTableRows('| malformed |')).toThrow('column count')
    const escaped = [{ ...RUNTIME_BACKLOG[0]!, blocked: 'A | B' }]
    expect(readTableRows(renderBacklogTable(escaped))[2]![3]).toBe('A | B')
  })
  it('derives DPS eligibility verbatim from its source and binds all protocols to live blockers', () => {
    expect(collectProtocolErrors(protocols, snapshot.blockers, resolve)).toEqual([])
    const dps = protocols[0]!
    for (const requirement of dps.acceptance) expect(markdownSection(modelDoc, 'Eligibility')).toContain(`- ${requirement}`)
    expect(dps.observations.join(' ')).toContain('observedDamagePerHit')
    expect(dps.invalidatingConditions).toContain('runtime model output')
    for (const protocol of protocols) expect(resolveProtocolCloseConditions(protocol, snapshot.blockers).every((item) => item.closeCondition !== null)).toBe(true)
    expect(() => buildMeasurementProtocols('# No Eligibility', '1.17.0.0')).toThrow('Missing protocol source section')
  })
  it('rejects missing metadata, invalid repetition, unknown blocker and invented results', () => {
    const broken = [{ ...protocols[0], submissionMetadata: [], repetition: { minimumIndependentRuns: -1, rule: '' }, blockerIds: ['missing'], results: [123] }]
    const errors = collectProtocolErrors(broken, snapshot.blockers, resolve).join('\n')
    expect(errors).toContain('submissionMetadata required')
    expect(errors).toContain('repetition requirements invalid')
    expect(errors).toContain('missing blocker')
    expect(errors).toContain('must not contain invented results')
  })
  it('renders a read-only dashboard with separate runtime, empirical and priority meanings', () => {
    const html = renderToStaticMarkup(<DataCoverageSection />)
    expect(html).toContain('正解確率でも、Roadmapの完成率でもありません')
    expect(html).toContain('独立DPS実測: 0 / 5')
    expect(html).toContain('public-evidence-exhausted')
    expect(html).toContain('P1 8')
    expect(html).toContain('Armor cooldown ownership')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<form')
  })
})
