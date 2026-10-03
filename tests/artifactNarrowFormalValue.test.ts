import os from 'node:os'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { artifactValueMappings } from '../src/domain/formal/artifactValueMappings.ts'
import { readArtifactConfiguredValueSources, type ArtifactHorizontalInventory } from '../scripts/formal-value-artifact-sources.ts'
import { readHorizontalRawFactInventory, horizontalScalarFieldFromResolved, resolveDirectHorizontalSourceFact } from '../scripts/formal-value-horizontal-source.ts'
import { verifyValueRawTraceProvenance } from '../scripts/formal-value-source-provenance.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, readyArtifactFormalIdentities, reviewedBridgeArtifactFormalIdentities, deathCapMushroomFormalIdentity, corruptedSeedsFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { buildFormalValueAvailabilityArtifact, collectFormalValueAvailabilityErrors, type FormalValueAvailabilityArtifact, type FormalValueInputs } from '../src/domain/formal/valueAvailability.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { collectFormalIntegrationErrors } from '../src/domain/formal/integrationAudit.ts'
import baseline from './fixtures/artifact-narrow-value-baseline.json'

const read = <T>(path: string): T => JSON.parse(fs.readFileSync(path, 'utf8')) as T
const repositoryRoot = fs.realpathSync('.')
const identity = read<FormalIdentityEvidenceArtifact>('research/domain/formal/identity-evidence-v1.json')
const relations = read<FormalSerializedRelationArtifact>('research/domain/formal/serialized-relation-v2.json')
const value = read<FormalValueAvailabilityArtifact>('research/domain/formal/value-availability-v2.json')
const inventory = readHorizontalRawFactInventory(repositoryRoot) as ArtifactHorizontalInventory
const sources = readArtifactConfiguredValueSources({ repositoryRoot, identity, inventory })
function build(artifactConfiguredSources = sources) {
  const committed = (definition: typeof fightersBindingsFormalIdentity) => {
    const semantic = identity.semantic.identities.find(({ assertionId }) => assertionId === definition.assertion.id)!
    return { semantic, evidence: identity.provenance.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(record.id)) }
  }
  const fighters = committed(fightersBindingsFormalIdentity), scatter = committed(scatterCrossbowFormalIdentity)
  const inputs: FormalValueInputs = {
    fightersBindingsRaw: read<RawPackageSnapshot>(`research/raw/packages/${fightersBindingsFormalIdentity.assertion.applicationScope.packagePath}.raw.json`),
    scatterCrossbowInstanceRaw: read<RawPackageSnapshot>(`research/raw/packages/${scatterCrossbowFormalIdentity.assertion.applicationScope.packagePath}.raw.json`),
    fightersBindingsIdentity: fighters.semantic, fightersBindingsIdentityEvidence: fighters.evidence,
    scatterCrossbowIdentity: scatter.semantic, scatterCrossbowIdentityEvidence: scatter.evidence,
    relations, artifactConfiguredSources,
  }
  return buildFormalValueAvailabilityArtifact(inputs)
}
const canonical = (input: unknown): string => {
  if (Array.isArray(input)) return `[${input.map(canonical).join(',')}]`
  if (input !== null && typeof input === 'object') return `{${Object.entries(input).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(input)
}
const hash = (input: unknown) => crypto.createHash('sha256').update(canonical(input)).digest('hex')

describe('Artifact narrow Formal Value v2', () => {
  it('populates exactly four independent source occurrences with unique mappings and exact provenance', () => {
    expect(value.schemaVersion).toBe(2)
    expect(Object.keys(value.semantic.artifact).sort()).toEqual(artifactValueMappings.map(({ domainId }) => domainId).sort())
    const artifactDomains = [deathCapMushroomFormalIdentity, corruptedSeedsFormalIdentity, ...readyArtifactFormalIdentities, ...reviewedBridgeArtifactFormalIdentities]
    expect(artifactDomains).toHaveLength(23)
    const excluded = artifactDomains.filter(({ assertion }) => !artifactValueMappings.some(({ domainId }) => domainId === assertion.domainId))
    expect(excluded).toHaveLength(19)
    for (const { assertion } of excluded) {
      expect(value.semantic.artifact).not.toHaveProperty(assertion.domainId)
      expect(value.valueProjections.some(({ occurrence }) => occurrence.domainId === assertion.domainId)).toBe(false)
    }
    expect(new Set(artifactValueMappings.map(({ id }) => id)).size).toBe(4)
    for (const [index, mapping] of artifactValueMappings.entries()) {
      const semantic = value.semantic.artifact[mapping.domainId]!
      expect(Object.keys(semantic)).toEqual([mapping.field])
      expect(semantic[mapping.field]?.value).toBe([8, 2.5, 5, 3][index])
      const projections = value.valueProjections.filter(({ occurrence }) => occurrence.domainId === mapping.domainId)
      expect(projections).toHaveLength(1)
      expect(projections[0]).toMatchObject({ mappingId: mapping.id, result: 'projected', occurrence: { domainId: mapping.domainId, scopeRef: 'source' } })
      expect(projections[0]?.relationProjectionRef).toBeUndefined()
      expect(sources[index]!.field.trace.raw.nodePointer).toMatch(/\/cdoPropertyInventory\/\d+\/properties\/\d+$/)
      expect(() => verifyValueRawTraceProvenance(repositoryRoot, sources[index]!.field.trace.raw)).not.toThrow()
    }
    expect(collectFormalValueAvailabilityErrors(value)).toEqual([])
    expect(collectFormalIntegrationErrors(identity, value, relations)).toEqual([])
  })

  it('binds Powershaker stacks to its root IntProperty and retains unavailable states', () => {
    const source = sources.find(({ mapping }) => mapping.domainId === 'powershaker')!
    expect(source.mapping.rawField).toBe('AttackStacks')
    expect(source.field).toMatchObject({ state: 'known', value: 5 })
    expect(source.sourceProvenance.packagePath).toBe(source.definition.assertion.applicationScope.packagePath)
    const fact = inventory.sourceFacts.find((entry) => entry.propertyName === 'AttackStacks'
      && entry.source.sourcePackage === source.sourceProvenance.packagePath)!
    const resolved = resolveDirectHorizontalSourceFact(repositoryRoot, inventory, {
      category: 'artifact', catalogId: 'powershaker', candidatePackage: source.sourceProvenance.packagePath,
      sourceFactId: fact.factId,
    })
    expect(resolved.propertyType).toBe('IntProperty')
    expect(resolved.propertyPath).toBe('AttackStacks')
    for (const state of ['unknown', 'unsupported', 'parse-failed', 'not-extracted'] as const) {
      const field = { state, reason: 'Powershaker count unavailable', trace: source.field.trace }
      const result = build(sources.map((entry) => entry === source ? { ...entry, field } : entry))
      expect(result.semantic.artifact.powershaker).toEqual({})
      expect(result.semantic.artifact['vexing-chant']).toEqual(value.semantic.artifact['vexing-chant'])
      expect(result.valueProjections.find(({ mappingId }) => mappingId === source.mapping.id))
        .toMatchObject({ result: 'unavailable', sourceState: state })
      expect(collectFormalValueAvailabilityErrors(result)).toEqual([])
    }
  })

  it('preserves every pre-extension Value record, Identity and Relation byte for byte', () => {
    const readBaseline = (file: string) => execFileSync('git', ['show', `f9033fc826fcb46ce22273cbe917adff9211aba8:${file}`], { maxBuffer: 16 * 1024 * 1024 })
    const previous = JSON.parse(readBaseline('research/domain/formal/value-availability-v2.json').toString()) as FormalValueAvailabilityArtifact
    const newMapping = artifactValueMappings.find(({ domainId }) => domainId === 'powershaker')!
    const preserved = structuredClone(value)
    delete preserved.semantic.artifact.powershaker
    const newRecord = preserved.valueProjections.find(({ mappingId }) => mappingId === newMapping.id)!
    preserved.valueProjections = preserved.valueProjections.filter(({ mappingId }) => mappingId !== newMapping.id)
    preserved.provenance.evidence = preserved.provenance.evidence.filter(({ id }) => !newRecord.evidenceRefs?.includes(id))
    expect(preserved).toEqual(previous)
    expect(Buffer.from(`${JSON.stringify(preserved, null, 2)}\n`).equals(readBaseline('research/domain/formal/value-availability-v2.json'))).toBe(true)
    for (const file of ['identity-evidence-v1.json', 'serialized-relation-v2.json']) {
      const filePath = `research/domain/formal/${file}`
      expect(fs.readFileSync(filePath).equals(readBaseline(filePath))).toBe(true)
    }
  })

  it('preserves all existing semantic lanes, projection/evidence bytes, Identity and Relation contents/counts', () => {
    expect(hash(value.semantic.melee)).toBe(baseline.semantic.melee)
    expect(hash(value.semantic.ranged)).toBe(baseline.semantic.ranged)
    const records = value.valueProjections.filter(({ mappingId }) => !artifactValueMappings.some(({ id }) => id === mappingId))
    expect(hash(records)).toBe(baseline.value.valueProjections)
    const newRefs = new Set(sources.map(({ field }) => field.trace.raw.nodePointer))
    expect(hash({ evidence: value.provenance.evidence.filter(({ provenance }) => !newRefs.has(provenance.nodePointer)) })).toBe(baseline.value.provenance)
    for (const [path, expected] of Object.entries(baseline.files)) {
      // This historical Value wave also locked Relation bytes before SpinWheel population.
      const bytes = path === 'research/domain/formal/serialized-relation-v2.json'
        ? execFileSync('git', ['show', `07160c289dcf987ab5bee5ae69e448d906724aef:${path}`]) : fs.readFileSync(path)
      expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(expected.sha256)
    }
    expect(identity.semantic.identities.length).toBe(baseline.files['research/domain/formal/identity-evidence-v1.json'].semanticCount)
    expect(relations.semantic.relations.filter((entry) => !entry.relationRef.endsWith(':spin-wheel-actor@1') && !entry.relationRef.endsWith(':fish-hook@1') && !entry.relationRef.endsWith(':spore-grenade-spawn-class@1')).length)
      .toBe(baseline.files['research/domain/formal/serialized-relation-v2.json'].semanticCount)
  })

  it.each(['value', 'hash', 'pointer', 'candidate', 'missing', 'duplicate'] as const)('fails closed on Horizontal %s drift', (kind) => {
    const mapping = artifactValueMappings[0]
    const original = inventory.sourceFacts.find((fact) => fact.propertyName === mapping.rawField && fact.source.sourcePackage === sources[0]!.definition.assertion.applicationScope.packagePath)!
    const changedFact = structuredClone(original)
    const changed = { ...inventory, sourceFacts: inventory.sourceFacts.map((fact) => fact === original ? changedFact : fact), items: inventory.items }
    if (kind === 'value') changedFact.decodedValue = 999
    if (kind === 'hash') changedFact.source.sourcePackageHash = 'drift'
    if (kind === 'pointer') changedFact.source.propertyPointer = '/cdoPropertyInventory/0/properties/0'
    if (kind === 'missing') changed.sourceFacts = changed.sourceFacts.filter((fact) => fact.factId !== original.factId)
    if (kind === 'duplicate') changed.sourceFacts = [...changed.sourceFacts, changedFact]
    if (kind === 'candidate') changed.items = inventory.items.map((item) => item.catalogId === mapping.domainId ? { ...item, rawCandidate: { ...item.rawCandidate, candidates: [] } } : item)
    const result = build(readArtifactConfiguredValueSources({ repositoryRoot, identity, inventory: changed }))
    expect(result.semantic.artifact[mapping.domainId]).toEqual({})
    expect(result.valueProjections.find(({ mappingId }) => mappingId === mapping.id)).toMatchObject({ result: 'unavailable', failureKind: 'raw', sourceState: 'unknown' })
    expect(collectFormalValueAvailabilityErrors(result)).toEqual([])
  })

  it.each(['missing', 'unsupported', 'parse-failed'] as const)('reads actual Structural %s state without inventing a value', (state) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-value-'))
    try {
      const directory = 'research/raw/game-data-raw-structural-inventory'
      fs.mkdirSync(path.join(temporaryRoot, directory, 'shards'), { recursive: true })
      const manifest = read<{ shards: { path: string; compressedBytes: number; compressedSha256: string; uncompressedBytes: number; uncompressedSha256: string }[] }>(`${directory}/manifest.json`)
      for (const source of sources) fs.copyFileSync(source.sourceProvenance.artifactPath, path.join(temporaryRoot, source.sourceProvenance.artifactPath))
      const raw = sources[0]!.sourceProvenance
      const compressed = fs.readFileSync(raw.artifactPath)
      const shard = JSON.parse(gunzipSync(compressed).toString('utf8')) as { packages: { cdoPropertyInventory: { properties: { decoding: { state: string; value?: unknown } }[] }[] }[] }
      const indices = raw.nodePointer.match(/packages\/(\d+)\/cdoPropertyInventory\/(\d+)\/properties\/(\d+)/)!
      const properties = shard.packages[Number(indices[1])]!.cdoPropertyInventory[Number(indices[2])]!.properties
      if (state === 'missing') properties.splice(Number(indices[3]), 1)
      else properties[Number(indices[3])]!.decoding = { state }
      const bytes = Buffer.from(JSON.stringify(shard)), gz = gzipSync(bytes)
      fs.writeFileSync(path.join(temporaryRoot, raw.artifactPath), gz)
      const meta = manifest.shards.find(({ path: shardPath }) => `${directory}/${shardPath}` === raw.artifactPath)!
      const digest = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex')
      Object.assign(meta, { compressedBytes: gz.length, compressedSha256: digest(gz), uncompressedBytes: bytes.length, uncompressedSha256: digest(bytes) })
      fs.writeFileSync(path.join(temporaryRoot, directory, 'manifest.json'), JSON.stringify(manifest))
      // The matched Identity's ItemIdName pointer also moves when a preceding property is absent.
      const fixtureIdentity = structuredClone(identity)
      if (state === 'missing') {
        for (const record of fixtureIdentity.provenance.evidence) {
          if (record.kind === 'raw-observation' && record.provenance.packagePath === raw.packagePath && record.provenance.nodePointer) {
            record.provenance.nodePointer = record.provenance.nodePointer.replace(/(properties\/)(\d+)/, (_, prefix: string, number: string) => `${prefix}${Number(number) - 1}`)
          }
        }
      }
      const actual = readArtifactConfiguredValueSources({ repositoryRoot: temporaryRoot, identity: fixtureIdentity, inventory })
      const result = build(actual)
      expect(result.semantic.artifact['corrupted-seeds']).toEqual({})
      expect(result.valueProjections.find(({ mappingId }) => mappingId === artifactValueMappings[0].id)).toMatchObject({ result: 'unavailable', failureKind: 'raw', sourceState: state === 'missing' ? 'unknown' : state })
      expect(() => verifyValueRawTraceProvenance(temporaryRoot, actual[0]!.field.trace.raw)).not.toThrow()
    } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }) }
  })

  it.each(['unsupported', 'parse-failed', 'not-extracted'] as const)('retains actual %s Raw state for undecoded observations', (state) => {
    const mapping = artifactValueMappings[0]
    const fact = inventory.sourceFacts.find((entry) => entry.propertyName === mapping.rawField && entry.source.sourcePackage === sources[0]!.definition.assertion.applicationScope.packagePath)!
    const resolved = resolveDirectHorizontalSourceFact(repositoryRoot, inventory, { category: 'artifact', catalogId: mapping.domainId, candidatePackage: fact.source.sourcePackage, sourceFactId: fact.factId })
    const field = horizontalScalarFieldFromResolved<number>({ ...resolved, availabilityState: 'parser-boundary', decodingState: state }, mapping.id, sources[0]!.definition.assertion.id, mapping.rawField, mapping.rawType, 'number')
    const result = build([{ ...sources[0]!, field }, ...sources.slice(1)])
    expect(result.semantic.artifact[mapping.domainId]).toEqual({})
    expect(result.valueProjections.find(({ mappingId }) => mappingId === mapping.id)).toMatchObject({ result: 'unavailable', sourceState: state })
  })

  it('rejects wrong Identity, mapping, and source bindings; generation is deterministic', () => {
    for (const key of ['mappingId', 'identityAssertionId'] as const) {
      const altered = structuredClone(sources)
      altered[0]!.field.trace[key] = 'drift'
      expect(() => build(altered)).toThrow(/mismatch/)
    }
    const altered = structuredClone(sources)
    altered[0]!.field.trace.raw.packagePath = 'wrong'
    expect(() => build(altered)).toThrow(/source mismatch/)
    const unmatched = structuredClone(sources)
    unmatched[0]!.identity.resolution = { ...unmatched[0]!.identity.resolution, state: 'matched', assertionId: unmatched[0]!.definition.assertion.id, domainId: 'wrong' }
    expect(build(unmatched).semantic.artifact).not.toHaveProperty('corrupted-seeds')
    expect(JSON.stringify(build())).toBe(JSON.stringify(build(readArtifactConfiguredValueSources({ repositoryRoot, identity }))))
  })

  it('audits missing scope coverage, unsupported domains/fields and evidence/projection corruption', () => {
    const missing = structuredClone(value)
    missing.valueProjections = missing.valueProjections.filter(({ mappingId }) => mappingId !== artifactValueMappings[0].id)
    expect(collectFormalValueAvailabilityErrors(missing).join('\n')).toMatch(/missing required Artifact scope/)
    const wrong = structuredClone(value)
    wrong.semantic.artifact.spinblade = { configuredPetAmountCap: value.semantic.artifact['vexing-chant']!.configuredPetAmountCap }
    expect(collectFormalValueAvailabilityErrors(wrong).join('\n')).toMatch(/unsupported Artifact Value domain/)
    const wrongField = structuredClone(value)
    wrongField.semantic.artifact['corrupted-seeds']!.configuredPetAmountCap = value.semantic.artifact['vexing-chant']!.configuredPetAmountCap
    expect(collectFormalValueAvailabilityErrors(wrongField).join('\n')).toMatch(/unsupported Artifact Value field/)
    const wrongEvidence = structuredClone(value)
    wrongEvidence.semantic.artifact['corrupted-seeds']!.configuredTargetCount!.evidenceRefs = ['missing']
    expect(collectFormalValueAvailabilityErrors(wrongEvidence).join('\n')).toMatch(/EvidenceRef mismatch/)
  })
})
