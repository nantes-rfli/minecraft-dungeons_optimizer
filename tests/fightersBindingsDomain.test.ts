import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectFightersBindings, fightersBindingsMappings } from '../src/domain/temporary/fightersBindings.ts'
import { fightersBindingsIdentity as assertion } from '../src/domain/temporary/fightersBindingsIdentity.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'

const text = fs.readFileSync(`research/raw/packages/${assertion.packagePath}.raw.json`, 'utf8')
// Mutable JSON fixture for deliberate unavailable/type/identity corruption tests.
const fixture = () => JSON.parse(text)
const project = (raw: RawPackageSnapshot) => projectFightersBindings(raw)
function pointer(raw: unknown, path: string): unknown {
  return path.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], raw)
}

describe('one-package temporary Domain', () => {
  it('retains Raw identity and resolves only provisionally with conflict evidence', () => {
    const raw = fixture()
    const before = JSON.stringify(raw)
    const result = project(raw)
    expect(JSON.stringify(raw)).toBe(before)
    expect(before).not.toContain('fighters-bindings')
    expect(result.identity).toMatchObject({ status: 'provisional', domainId: 'fighters-bindings', assertionId: assertion.id })
    expect(result.identity.evidence.itemName).toMatchObject({ state: 'known', value: 'Gauntlets_Unique3' })
    expect(assertion.evidence.some((evidence) => evidence.role === 'conflict')).toBe(true)
    for (const field of Object.values(result.identity.evidence)) {
      expect(pointer(raw, field.trace.raw.nodePointer)).toMatchObject({ decoding: { value: assertion.rawIdentity } })
      expect(field.trace.mappingId).toBe(fightersBindingsMappings.identity.id)
    }
  })
  it('projects exact configured values and resolves every field back to its Raw node', () => {
    const raw = fixture()
    const result = project(raw)
    expect(result.configuredAttacks.state).toBe('known')
    if (result.configuredAttacks.state !== 'known') throw new Error('missing entries')
    expect(result.configuredAttacks.value.map((entry) => entry.sourceIndex)).toEqual([0, 1, 2, 3])
    expect(result.configuredAttacks.value.map((entry) => entry.configuredDamage)).toEqual(Array.from({ length: 4 }, () => expect.objectContaining({ state: 'known', value: 25 })))
    expect(result.configuredAttacks.value.map((entry) => entry.configuredAnimationDurationSeconds)).toEqual([0.15000000596046448, 0.15000000596046448, 0.15000000596046448, 0.125].map((value) => expect.objectContaining({ state: 'known', value })))
    for (const entry of result.configuredAttacks.value) for (const field of [entry.configuredDamage, entry.configuredAnimationDurationSeconds]) {
      if (field.state !== 'known') throw new Error('missing configured field')
      expect(pointer(raw, field.trace.raw.nodePointer)).toMatchObject({ decoding: { value: field.value } })
      expect(field.trace.raw).toMatchObject({ extractionRunId: raw.extraction.runId, datasetId: raw.dataset.id, packagePath: raw.logicalPackage.path, packageHash: raw.logicalPackage.contentHash })
      expect(Object.values(fightersBindingsMappings).some((mapping) => mapping.id === field.trace.mappingId)).toBe(true)
    }
    expect(result.unresolved).toEqual(['final-damage', 'power-scaling', 'effective-attack-cadence', 'complete-combo-mechanic'])
  })
  it('reads source changes including decoded zero instead of copying constants or fitting values', () => {
    const raw = fixture()
    const elements = raw.package.objects[1].properties[0].decoding.elements
    elements[0].properties.find((node: { name: { value: string } }) => node.name.value === 'Damage').decoding.value = 0
    elements.pop()
    const result = project(raw)
    if (result.configuredAttacks.state !== 'known') throw new Error('missing entries')
    expect(result.configuredAttacks.value).toHaveLength(3)
    expect(result.configuredAttacks.value[0]!.configuredDamage).toMatchObject({ state: 'known', value: 0 })
  })
  it.each(['unsupported', 'parse-failed'])('preserves %s on fields and array elements', (state) => {
    const raw = fixture()
    const elements = raw.package.objects[1].properties[0].decoding.elements
    elements[0].properties.find((node: { name: { value: string } }) => node.name.value === 'Damage').decoding = { state }
    elements[1].decoding = { state }
    const result = project(raw)
    if (result.configuredAttacks.state !== 'known') throw new Error('missing entries')
    for (const i of [0, 1]) {
      expect(result.configuredAttacks.value[i]!.configuredDamage.state).toBe(state)
      expect(result.configuredAttacks.value[i]!.configuredDamage).not.toHaveProperty('value')
    }
  })
  it.each(['not-extracted', 'parse-failed'])('preserves CDO %s and leaves identity unresolved', (state) => {
    const raw = fixture()
    raw.package.objects[1].extraction = { state }
    const result = project(raw)
    expect(result.identity.status).toBe('unresolved')
    expect(result.identity).not.toHaveProperty('domainId')
    expect(result.configuredAttacks.state).toBe(state)
    expect(result.configuredAttacks).not.toHaveProperty('value')
  })
  it('leaves conflicting internal identifiers unresolved', () => {
    const raw = fixture()
    raw.package.objects[1].properties[4].decoding.properties[0].decoding.value = 'different-id'
    expect(project(raw).identity.status).toBe('unresolved')
    expect(project(raw).identity).not.toHaveProperty('domainId')
  })
  it('does not fill missing, duplicate, or wrongly typed configured fields', () => {
    for (const change of ['missing', 'duplicate', 'type']) {
      const raw = fixture()
      const properties = raw.package.objects[1].properties[0].decoding.elements[0].properties
      const index = properties.findIndex((node: { name: { value: string } }) => node.name.value === 'Damage')
      if (change === 'missing') properties.splice(index, 1)
      if (change === 'duplicate') properties.push(properties[index])
      if (change === 'type') properties[index].type.value = 'IntProperty'
      const result = project(raw)
      if (result.configuredAttacks.state !== 'known') throw new Error('missing entries')
      expect(result.configuredAttacks.value[0]!.configuredDamage.state).toBe('unknown')
      expect(result.configuredAttacks.value[0]!.configuredDamage).not.toHaveProperty('value')
    }
  })
  it('rejects other packages and ambiguous CDOs without generalizing', () => {
    const raw = fixture()
    raw.logicalPackage.path = 'another-package'
    expect(() => project(raw)).toThrow('Unsupported Raw package')
    const ambiguous = fixture()
    ambiguous.package.objects.push(ambiguous.package.objects[1])
    expect(() => project(ambiguous)).toThrow('unambiguous Raw CDO')
  })
})
