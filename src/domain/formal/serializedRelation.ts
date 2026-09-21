import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { locateRawNode, nestedRawNode, rawCdoCandidates, topLevelRawNode, type Located } from '../temporary/projectionPrimitives.ts'
import { battleRobeFormalIdentity, deathCapMushroomFormalIdentity, scatterCrossbowFormalIdentity } from './identityDefinitions.ts'
import { evidenceFingerprint, projectFormalIdentity, type FormalSemanticIdentity, type RawObservationEvidenceRecord } from './identityEvidence.ts'

export type RelationRef = 'relation:scatter-crossbow:projectile@1' | 'relation:battle-robe:gear-actor@1' | 'relation:death-cap-mushroom:effect@1'
export type RelationProjectionRef = string
export type RelationEvidenceRef = string
export type RelationOccurrence = { slice: 'scatter-crossbow'; sourceIndex: number } | { slice: 'battle-robe' | 'death-cap-mushroom'; scope: 'source' }
export type SerializedTarget = { objectName: string; gamePackagePath: string }
export type SemanticRelation = { projectionRef: RelationProjectionRef; relationRef: RelationRef; occurrence: RelationOccurrence; sourceDomainId: string; target: SerializedTarget; evidenceRefs: RelationEvidenceRef[] }
export type TargetResolution = { input: 'not-supplied'; result: 'not-resolved'; reason: 'target-snapshot-not-supplied' } | { input: 'supplied'; targetEvidenceRef: RelationEvidenceRef; result: 'resolved' | 'not-resolved'; reason?: 'target-snapshot-mismatch' }
export type RelationProjectionRecord = { projectionRef: RelationProjectionRef; relationRef: RelationRef; occurrence: RelationOccurrence; evidenceRefs: RelationEvidenceRef[] } & (
  | { result: 'projected'; targetResolution: TargetResolution }
  | { result: 'unavailable'; reason: string; failureStage: 'object-property' | 'class-import' | 'outer-package' }
)
export type RelationEvidenceRecord = { id: RelationEvidenceRef; kind: 'raw-relation-observation'; fingerprint: string; provenance: { artifactPath: string; datasetId: string; extractionRunId: string; packagePath: string; packageHash: RawPackageSnapshot['logicalPackage']['contentHash']; nodePointer?: string }; observed: unknown }
export type FormalSerializedRelationArtifact = { schemaVersion: 1; artifactKind: 'formal-domain-serialized-relation'; semantic: { relations: SemanticRelation[] }; scatterParent?: { result: 'projected' | 'unavailable'; evidenceRef: RelationEvidenceRef; sourceIndices?: number[]; reason?: string }; relationProjections: RelationProjectionRecord[]; provenance: { evidence: RelationEvidenceRecord[] } }
export type RelationSliceInput = { source: RawPackageSnapshot; identity?: FormalSemanticIdentity; identityEvidence?: RawObservationEvidenceRecord[]; target?: RawPackageSnapshot }
export type FormalRelationInputs = { scatter: RelationSliceInput; battleRobe: RelationSliceInput; deathCapMushroom: RelationSliceInput }

const definitions = [
  { key: 'scatter', slice: 'scatter-crossbow', relationRef: 'relation:scatter-crossbow:projectile@1', field: 'Projectile', identity: scatterCrossbowFormalIdentity },
  { key: 'battleRobe', slice: 'battle-robe', relationRef: 'relation:battle-robe:gear-actor@1', field: 'GearActor', identity: battleRobeFormalIdentity },
  { key: 'deathCapMushroom', slice: 'death-cap-mushroom', relationRef: 'relation:death-cap-mushroom:effect@1', field: 'Effect', identity: deathCapMushroomFormalIdentity },
] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const at = (root: unknown, pointer: string) => pointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], root)
const pathFor = (raw: RawPackageSnapshot) => `research/raw/packages/${raw.logicalPackage.path}.raw.json`
const provenance = (raw: RawPackageSnapshot, pointer?: string) => ({ artifactPath: pathFor(raw), datasetId: raw.dataset.id, extractionRunId: raw.extraction.runId, packagePath: raw.logicalPackage.path, packageHash: raw.logicalPackage.contentHash, ...(pointer === undefined ? {} : { nodePointer: pointer }) })
export function relationProjectionRef(relationRef: RelationRef, occurrence: RelationOccurrence): RelationProjectionRef { return `projection:${relationRef}:${'sourceIndex' in occurrence ? occurrence.sourceIndex : 'source'}` }
function identityMatches(input: RelationSliceInput, expected: typeof definitions[number]['identity']): string | undefined {
  const calculated = projectFormalIdentity(input.source, expected)
  const identity = input.identity ?? calculated.semantic
  if (identity.resolution.state !== 'matched' || !same(identity, calculated.semantic)) return undefined
  if (input.identity && !input.identityEvidence) return undefined
  if (input.identityEvidence) {
    const expectedRaw = calculated.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation')
    if (!same(input.identityEvidence, expectedRaw)) return undefined
    for (const evidence of input.identityEvidence) {
      if (evidence.provenance.artifactPath !== pathFor(input.source) || evidence.provenance.datasetId !== input.source.dataset.id || evidence.provenance.extractionRunId !== input.source.extraction.runId || !same(evidence.provenance.packageHash, input.source.logicalPackage.contentHash)) return undefined
    }
  }
  return identity.resolution.domainId
}
function targetPath(slice: string, gamePath: string): string | undefined {
  const allowed = slice === 'scatter-crossbow' ? '/Game/Actors/Equipment/RangedWeapons/' : slice === 'battle-robe' ? '/Game/Actors/Equipment/Armor/' : '/Game/Actors/Items/'
  return gamePath.startsWith(allowed) && !gamePath.includes('..') ? `Dungeons/Content/${gamePath.slice('/Game/'.length)}` : undefined
}
export function buildFormalSerializedRelationArtifact(inputs: FormalRelationInputs): FormalSerializedRelationArtifact {
  const relations: SemanticRelation[] = []
  const records: RelationProjectionRecord[] = []
  let scatterParent: FormalSerializedRelationArtifact['scatterParent']
  const evidence = new Map<string, RelationEvidenceRecord>()
  const observe = (raw: RawPackageSnapshot, pointer?: string): string => {
    const p = provenance(raw, pointer)
    const id = `evidence:relation:${evidenceFingerprint(p)}`
    const base = { id, kind: 'raw-relation-observation' as const, provenance: p, observed: pointer === undefined ? { schemaVersion: raw.schemaVersion, dataset: raw.dataset, logicalPackage: raw.logicalPackage } : at(raw, pointer) }
    evidence.set(id, { ...base, fingerprint: evidenceFingerprint(base) })
    return id
  }
  for (const definition of definitions) {
    const input = inputs[definition.key]
    const raw = input.source
    const sourceDomainId = identityMatches(input, definition.identity)
    if (!sourceDomainId) continue
    const cdo = rawCdoCandidates(raw)
    const selected = cdo.length === 1 ? cdo[0] : undefined
    let occurrences: { occurrence: RelationOccurrence; located: Located }[]
    if (definition.key === 'scatter') {
      const parent = nestedRawNode(topLevelRawNode(selected, 'AttackDefintion'), 'ProjectileDefinition')
      const elements = parent.node?.type.value === 'ArrayProperty' && parent.node.decoding.state === 'decoded' ? parent.node.decoding.elements : undefined
      const evidenceRef = observe(raw, parent.pointer)
      if (!elements || !elements.every((element) => Number.isInteger(element.index) && element.index >= 0) || new Set(elements.map((element) => element.index)).size !== elements.length) {
        scatterParent = { result: 'unavailable', evidenceRef, reason: 'missing-or-ambiguous-projectile-definition-collection' }
        continue
      }
      scatterParent = { result: 'projected', evidenceRef, sourceIndices: elements.map((element) => element.index) }
      occurrences = elements.map((element, position) => ({ occurrence: { slice: 'scatter-crossbow', sourceIndex: element.index }, located: element.decoding.state === 'decoded' ? locateRawNode(element.properties, `${parent.pointer}/decoding/elements/${position}/properties`, 'Projectile') : { pointer: `${parent.pointer}/decoding/elements/${position}`, unavailable: element.decoding.state } }))
    } else occurrences = [{ occurrence: { slice: definition.slice, scope: 'source' } as RelationOccurrence, located: topLevelRawNode(selected, definition.field) }]
    for (const { occurrence, located } of occurrences) {
      const projectionRef = relationProjectionRef(definition.relationRef, occurrence)
      const refs = [observe(raw, located.pointer)]
      const unavailable = (reason: string, failureStage: 'object-property' | 'class-import' | 'outer-package') => records.push({ projectionRef, relationRef: definition.relationRef, occurrence, evidenceRefs: [...new Set(refs)], result: 'unavailable', reason, failureStage })
      const node = located.node
      const value = node?.decoding.state === 'decoded' ? node.decoding.value : undefined
      if (!node || node.type.value !== 'ObjectProperty' || !value || typeof value !== 'object' || Array.isArray(value)) { unavailable('missing-or-invalid-object-property', 'object-property'); continue }
      const ref = value as Record<string, unknown>
      if (ref.kind !== 'import' || !Number.isInteger(ref.rawPackageIndex) || (ref.rawPackageIndex as number) >= 0 || !Number.isInteger(ref.index) || (ref.index as number) < 0 || typeof ref.objectName !== 'string' || typeof ref.className !== 'string') { unavailable('invalid-import-reference', 'object-property'); continue }
      const classes = raw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === ref.rawPackageIndex && entry.index === ref.index)
      if (classes.length !== 1) { refs.push(observe(raw, '/package/imports')); unavailable('missing-or-ambiguous-class-import', 'class-import'); continue }
      const cls = classes[0]!
      refs.push(observe(raw, `/package/imports/${cls.index}`))
      if (cls.entry.rawPackageIndex !== -(cls.index + 1) || cls.entry.rawPackageIndex !== ref.rawPackageIndex || cls.entry.index !== ref.index || cls.entry.objectName.value !== ref.objectName || cls.entry.className.value !== ref.className || cls.entry.className.value !== 'BlueprintGeneratedClass' || cls.entry.outerReference.rawPackageIndex !== cls.entry.outerIndex) { unavailable('class-import-inconsistent', 'class-import'); continue }
      const outers = raw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === cls.entry.outerIndex)
      if (outers.length !== 1) { refs.push(observe(raw, '/package/imports')); unavailable('missing-or-ambiguous-outer-package', 'outer-package'); continue }
      const outer = outers[0]!
      refs.push(observe(raw, `/package/imports/${outer.index}`))
      if (cls.entry.outerReference.kind !== 'import' || cls.entry.outerReference.index !== outer.entry.index || cls.entry.outerReference.objectName !== outer.entry.objectName.value || cls.entry.outerReference.className !== outer.entry.className.value || outer.entry.rawPackageIndex !== -(outer.index + 1) || outer.entry.index !== outer.index || outer.entry.className.value !== 'Package' || outer.entry.outerIndex !== 0 || outer.entry.outerReference.kind !== 'null' || outer.entry.outerReference.rawPackageIndex !== 0 || typeof outer.entry.objectName.value !== 'string' || !outer.entry.objectName.value.startsWith('/Game/')) { unavailable('outer-package-inconsistent', 'outer-package'); continue }
      const target = { objectName: ref.objectName, gamePackagePath: outer.entry.objectName.value }
      let targetResolution: TargetResolution
      if (!input.target) targetResolution = { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' }
      else {
        const targetEvidenceRef = observe(input.target)
        const targetRaw = input.target
        const matched = targetRaw.schemaVersion === 2 && targetRaw.logicalPackage.path === targetPath(definition.slice, target.gamePackagePath) && targetRaw.dataset.id === raw.dataset.id && targetRaw.dataset.sourceFingerprint.algorithm === raw.dataset.sourceFingerprint.algorithm && targetRaw.dataset.sourceFingerprint.value === raw.dataset.sourceFingerprint.value
        targetResolution = matched ? { input: 'supplied', targetEvidenceRef, result: 'resolved' } : { input: 'supplied', targetEvidenceRef, result: 'not-resolved', reason: 'target-snapshot-mismatch' }
      }
      relations.push({ projectionRef, relationRef: definition.relationRef, occurrence, sourceDomainId, target, evidenceRefs: refs })
      records.push({ projectionRef, relationRef: definition.relationRef, occurrence, evidenceRefs: refs, result: 'projected', targetResolution })
    }
  }
  return { schemaVersion: 1, artifactKind: 'formal-domain-serialized-relation', semantic: { relations }, ...(scatterParent ? { scatterParent } : {}), relationProjections: records, provenance: { evidence: [...evidence.values()] } }
}

export function collectFormalSerializedRelationErrors(artifact: FormalSerializedRelationArtifact, inputs: FormalRelationInputs): string[] {
  const errors: string[] = []
  const expected = buildFormalSerializedRelationArtifact(inputs)
  if (artifact.schemaVersion !== 1 || artifact.artifactKind !== expected.artifactKind) errors.push('invalid artifact header')
  const required = expected.relationProjections.map((record) => record.projectionRef).sort()
  const actual = artifact.relationProjections.map((record) => record.projectionRef).sort()
  if (!same(required, actual)) errors.push('required relation occurrence coverage mismatch')
  if (!same(artifact.scatterParent, expected.scatterParent)) errors.push('Scatter parent collection mismatch')
  if (new Set(actual).size !== actual.length) errors.push('duplicate occurrence')
  const evidence = new Map<string, RelationEvidenceRecord>()
  for (const record of artifact.provenance.evidence) {
    if (evidence.has(record.id)) errors.push(`duplicate EvidenceRef ${record.id}`)
    evidence.set(record.id, record)
    const { fingerprint, ...base } = record
    if (fingerprint !== evidenceFingerprint(base)) errors.push(`fingerprint mismatch ${record.id}`)
    if (!same(record, expected.provenance.evidence.find((item) => item.id === record.id))) errors.push(`Raw evidence mismatch ${record.id}`)
  }
  for (const record of artifact.relationProjections) {
    if (!record.evidenceRefs.length || record.evidenceRefs.some((ref) => !evidence.has(ref))) errors.push(`dangling EvidenceRef ${record.projectionRef}`)
    const count = artifact.semantic.relations.filter((relation) => relation.projectionRef === record.projectionRef).length
    if (count !== (record.result === 'projected' ? 1 : 0)) errors.push(`semantic relation count mismatch ${record.projectionRef}`)
    if (!same(record, expected.relationProjections.find((item) => item.projectionRef === record.projectionRef))) errors.push(`relation projection mismatch ${record.projectionRef}`)
  }
  if (!same(artifact.semantic.relations, expected.semantic.relations)) errors.push('semantic relation mismatch')
  if (!same(artifact.provenance.evidence, expected.provenance.evidence)) errors.push('relation evidence mismatch')
  return errors
}
