/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Mutation fixtures intentionally corrupt readonly Raw snapshots.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { buildFormalSerializedRelationArtifact as build, collectFormalSerializedRelationErrors as audit, type FormalRelationInputs, type FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { scatterCrossbowIdentity } from '../src/domain/temporary/scatterCrossbowIdentity.ts'
import { battleRobeIdentity } from '../src/domain/temporary/battleRobeIdentity.ts'
import { deathCapMushroomIdentity } from '../src/domain/temporary/deathCapMushroomIdentity.ts'
import { battleRobeFormalIdentity, deathCapMushroomFormalIdentity, scatterCrossbowFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { evidenceFingerprint, projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'

const read = (path: string): RawPackageSnapshot => JSON.parse(fs.readFileSync(new URL(`../research/raw/packages/${path}.raw.json`, import.meta.url), 'utf8'))
const clone = <T>(value: T): T => structuredClone(value)
// Mutation fixtures intentionally operate on readonly parsed Raw shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutable = <T>(value: T): any => value
const withIdentity = (source: RawPackageSnapshot, definition: typeof scatterCrossbowFormalIdentity) => {
  const projected = projectFormalIdentity(source, definition)
  return { source, identity: projected.semantic, identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
}
const inputs = (): FormalRelationInputs => ({
  scatter: { ...withIdentity(read(scatterCrossbowIdentity.instancePackagePath), scatterCrossbowFormalIdentity), target: read(scatterCrossbowIdentity.projectilePackagePath) },
  battleRobe: withIdentity(read(battleRobeIdentity.packagePath), battleRobeFormalIdentity),
  deathCapMushroom: { ...withIdentity(read(deathCapMushroomIdentity.instancePackagePath), deathCapMushroomFormalIdentity), target: read(deathCapMushroomIdentity.effectPackagePath) },
})
const scatterElements = (raw: RawPackageSnapshot) => {
  const cdo = raw.package.objects.find((object) => object.isClassDefaultObject)!
  return mutable(cdo.properties!.find((node) => node.name.value === 'AttackDefintion')!.decoding.properties!.find((node) => node.name.value === 'ProjectileDefinition')!.decoding.elements!)
}
const field = (input: FormalRelationInputs, slice: 'battleRobe' | 'deathCapMushroom') => mutable(input[slice].source.package.objects.find((object) => object.isClassDefaultObject)!.properties!.find((node) => node.name.value === (slice === 'battleRobe' ? 'GearActor' : 'Effect'))!)
const result = (input: FormalRelationInputs, slice: string) => build(input).relationProjections.filter((record) => record.occurrence.slice === slice)
const alter = (artifact: FormalSerializedRelationArtifact, change: (artifact: FormalSerializedRelationArtifact) => void) => { const changed = clone(artifact); change(changed); return changed }

describe('Formal Serialized Relation v1', () => {
  it('projects exactly the three committed outcomes and grounds the artifact', () => {
    const input = inputs(); const artifact = build(input)
    expect(artifact.semantic.relations.map((r) => r.target.gamePackagePath)).toHaveLength(3)
    expect(artifact.relationProjections.map((r) => r.result === 'projected' && r.targetResolution.result)).toEqual(['resolved', 'not-resolved', 'resolved'])
    expect(audit(artifact, input)).toEqual([])
  })
  it('keeps internally consistent drift projected independently of target resolution', () => {
    const input = inputs(); const raw = mutable(input.battleRobe.source)
    const node = field(input, 'battleRobe'); const reference = node.decoding.value as Record<string, unknown>
    reference.objectName = 'BP_Alternate_C'
    const cls = raw.package.imports.find((entry) => entry.rawPackageIndex === reference.rawPackageIndex)!
    cls.objectName.value = 'BP_Alternate_C'
    const record = result(input, 'battle-robe')[0]!
    expect(record.result).toBe('projected')
  })
  it('projects a consistent alternate className without fixing BlueprintGeneratedClass', () => {
    const input = inputs(); const raw = mutable(input.battleRobe.source)
    const reference = field(input, 'battleRobe').decoding.value as Record<string, unknown>
    const cls = raw.package.imports.find((entry) => entry.rawPackageIndex === reference.rawPackageIndex)!
    reference.className = 'AlternateSerializedClass'
    cls.className.value = 'AlternateSerializedClass'
    expect(result(input, 'battle-robe')[0]?.result).toBe('projected')
    input.battleRobe.identity!.presentation!.displayName = 'Renamed display only'
    expect(result(input, 'battle-robe')[0]?.result).toBe('projected')
  })
  it.each(['object mismatch', 'class mismatch', 'missing import', 'ambiguous import', 'class import index', 'classPackage shape', 'outer mismatch', 'non-package outer', 'invalid root'])(`rejects %s`, (mode) => {
    const input = inputs(); const raw = mutable(input.battleRobe.source)
    const node = field(input, 'battleRobe'); const reference = node.decoding.value as Record<string, unknown>
    const cls = raw.package.imports.find((entry) => entry.rawPackageIndex === reference.rawPackageIndex)!
    const outer = raw.package.imports.find((entry) => entry.rawPackageIndex === cls.outerIndex)!
    if (mode === 'object mismatch') reference.objectName = 'Bad'
    if (mode === 'class mismatch') cls.className.value = 'Bad'
    if (mode === 'missing import') reference.rawPackageIndex = -999
    if (mode === 'ambiguous import') raw.package.imports.push(clone(cls))
    if (mode === 'class import index') cls.index += 1
    if (mode === 'classPackage shape') cls.classPackage.value = 17
    if (mode === 'outer mismatch') cls.outerReference.objectName = 'Bad'
    if (mode === 'non-package outer') outer.className.value = 'BlueprintGeneratedClass'
    if (mode === 'invalid root') outer.outerReference.rawPackageIndex = -1
    expect(result(input, 'battle-robe')[0]?.result).toBe('unavailable')
  })
  it('enumerates sourceIndex, retains siblings, and handles absent or invalid parents', () => {
    const input = inputs(); const elements = scatterElements(input.scatter.source)
    const second = clone(elements[0]!); second.index = 3; elements.push(second)
    expect(result(input, 'scatter-crossbow').map((r) => r.occurrence)).toEqual([{ slice: 'scatter-crossbow', sourceIndex: 0 }, { slice: 'scatter-crossbow', sourceIndex: 3 }])
    elements.reverse()
    expect(result(input, 'scatter-crossbow').map((r) => r.occurrence)).toEqual([{ slice: 'scatter-crossbow', sourceIndex: 3 }, { slice: 'scatter-crossbow', sourceIndex: 0 }])
    second.properties!.find((p) => p.name.value === 'Projectile')!.decoding.value = null
    expect(result(input, 'scatter-crossbow').map((r) => r.result)).toEqual(['unavailable', 'projected'])
    elements[0]!.index = elements[1]!.index
    expect(result(input, 'scatter-crossbow')).toEqual([])
    elements[0]!.index = -1
    expect(result(input, 'scatter-crossbow')).toEqual([])
    elements.splice(0)
    expect(result(input, 'scatter-crossbow')).toEqual([])
    const cdo = mutable(input.scatter.source.package.objects.find((o) => o.isClassDefaultObject)!)
    cdo.properties = cdo.properties!.filter((p) => p.name.value !== 'AttackDefintion')
    expect(result(input, 'scatter-crossbow')).toEqual([])
  })
  it('shares import EvidenceRefs when two occurrences reference the same target', () => {
    const input = inputs(); const elements = scatterElements(input.scatter.source)
    const second = clone(elements[0]!); second.index = 4; elements.push(second)
    const artifact = build(input)
    const [first, next] = artifact.relationProjections.filter((record) => record.occurrence.slice === 'scatter-crossbow')
    expect(first!.result).toBe('projected')
    expect(next!.result).toBe('projected')
    expect(first!.evidenceRefs[0]).not.toBe(next!.evidenceRefs[0])
    expect(first!.evidenceRefs.slice(1)).toEqual(next!.evidenceRefs.slice(1))
    expect(audit(artifact, input)).toEqual([])
  })
  it('requires same-source matched Identity and allows provisional matched', () => {
    const input = inputs()
    expect(result(input, 'battle-robe')[0]?.result).toBe('projected')
    const omitted = inputs(); delete omitted.battleRobe.identity
    expect(result(omitted, 'battle-robe')).toEqual([])
    const missingEvidence = inputs(); delete missingEvidence.battleRobe.identityEvidence
    expect(result(missingEvidence, 'battle-robe')).toEqual([])
    input.battleRobe.identity!.resolution = { state: 'unresolved', assertionId: input.battleRobe.identity!.assertionId, evidenceRefs: [] }
    expect(result(input, 'battle-robe')).toEqual([])
    const other = inputs(); mutable(other.battleRobe.identityEvidence![0]!).provenance.packageHash.value = 'other'
    expect(result(other, 'battle-robe')).toEqual([])
    const fallback = inputs(); fallback.battleRobe.identity!.resolution = { state: 'unresolved', assertionId: fallback.battleRobe.identity!.assertionId, evidenceRefs: [] }
    expect(result(fallback, 'battle-robe')).toEqual([])
  })
  it('resolves only the fixed slice path correspondence while retaining drifted relations', () => {
    const input = inputs()
    expect(result(input, 'scatter-crossbow')[0]).toMatchObject({ result: 'projected', targetResolution: { input: 'supplied', result: 'resolved' } })
    expect(result(input, 'death-cap-mushroom')[0]).toMatchObject({ result: 'projected', targetResolution: { input: 'supplied', result: 'resolved' } })
    const raw = mutable(input.deathCapMushroom.source)
    const reference = field(input, 'deathCapMushroom').decoding.value as Record<string, unknown>
    const cls = raw.package.imports.find((entry) => entry.rawPackageIndex === reference.rawPackageIndex)!
    const outer = raw.package.imports.find((entry) => entry.rawPackageIndex === cls.outerIndex)!
    outer.objectName.value = '/Game/Actors/Items/DeathCapMushroom/AlternateEffect'
    cls.outerReference.objectName = outer.objectName.value
    const record = result(input, 'death-cap-mushroom')[0]!
    expect(record).toMatchObject({ result: 'projected', targetResolution: { input: 'supplied', result: 'not-resolved' } })
  })
  it.each(['schema', 'path', 'dataset', 'algorithm', 'fingerprint'])(`keeps relation projected when target %s mismatches`, (mode) => {
    const input = inputs(); const target = mutable(input.deathCapMushroom.target!)
    if (mode === 'schema') target.schemaVersion = 1 as 2
    if (mode === 'path') target.logicalPackage.path = 'Dungeons/Content/Other'
    if (mode === 'dataset') target.dataset.id = 'other'
    if (mode === 'algorithm') target.dataset.sourceFingerprint.algorithm = 'other'
    if (mode === 'fingerprint') target.dataset.sourceFingerprint.value = 'other'
    const record = result(input, 'death-cap-mushroom')[0]!
    expect(record.result).toBe('projected')
    if (record.result === 'projected') expect(record.targetResolution).toMatchObject({ input: 'supplied', result: 'not-resolved' })
  })
  it('keeps projection identity across target resolution changes', () => {
    const input = inputs(); const withTarget = result(input, 'death-cap-mushroom')[0]!
    delete input.deathCapMushroom.target
    const without = result(input, 'death-cap-mushroom')[0]!
    expect(without.projectionRef).toBe(withTarget.projectionRef)
    if (without.result === 'projected') expect(without.targetResolution).toEqual({ input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' })
  })
  it('rejects coverage and semantic/projection tampering', () => {
    const input = inputs(); const original = build(input)
    const cases = [
      (a: FormalSerializedRelationArtifact) => { a.relationProjections.pop() },
      (a: FormalSerializedRelationArtifact) => { a.relationProjections.pop(); a.semantic.relations.pop() },
      (a: FormalSerializedRelationArtifact) => { a.relationProjections.push({ ...a.relationProjections[0]!, projectionRef: 'extra' }) },
      (a: FormalSerializedRelationArtifact) => { a.relationProjections.push(clone(a.relationProjections[0]!)) },
      (a: FormalSerializedRelationArtifact) => { if (a.relationProjections[0]!.result === 'projected') a.relationProjections[0]!.targetResolution = { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' } },
      (a: FormalSerializedRelationArtifact) => { if (a.relationProjections[0]!.result === 'projected') delete (a.relationProjections[0] as { targetResolution?: unknown }).targetResolution },
      (a: FormalSerializedRelationArtifact) => { a.relationProjections[0] = { ...a.relationProjections[0]!, result: 'unavailable', reason: 'fabricated', failureStage: 'object-property', targetResolution: { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' } } as unknown as typeof a.relationProjections[number] },
      (a: FormalSerializedRelationArtifact) => { if (a.relationProjections[0]!.result === 'projected') a.relationProjections[0]!.targetResolution = { input: 'supplied', result: 'not-resolved', reason: 'target-snapshot-mismatch', targetEvidenceRef: 'missing' } },
      (a: FormalSerializedRelationArtifact) => { a.relationProjections[0]!.evidenceRefs = ['missing'] },
      (a: FormalSerializedRelationArtifact) => { a.provenance.evidence.push(clone(a.provenance.evidence[0]!)) },
      (a: FormalSerializedRelationArtifact) => { a.provenance.evidence[0]!.observed = 'tampered' },
      (a: FormalSerializedRelationArtifact) => { a.provenance.evidence[0]!.observed = 'tampered'; const e = a.provenance.evidence[0]!; const base = { ...e } as Record<string, unknown>; delete base.fingerprint; e.fingerprint = evidenceFingerprint(base) },
      (a: FormalSerializedRelationArtifact) => { a.provenance.evidence[0]!.provenance.nodePointer = '/fabricated'; const e = a.provenance.evidence[0]!; const base = { ...e } as Record<string, unknown>; delete base.fingerprint; e.fingerprint = evidenceFingerprint(base) },
      (a: FormalSerializedRelationArtifact) => { (a.provenance.evidence[0] as unknown as Record<string, unknown>).failureStage = 'object-property' },
    ]
    for (const change of cases) expect(audit(alter(original, change), input).length).toBeGreaterThan(0)
  })
})
