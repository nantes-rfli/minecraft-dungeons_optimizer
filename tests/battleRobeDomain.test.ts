import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectBattleRobe, battleRobeMappings } from '../src/domain/temporary/battleRobe.ts'
import { battleRobeIdentity as assertion } from '../src/domain/temporary/battleRobeIdentity.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'

const text = fs.readFileSync(`research/raw/packages/${assertion.packagePath}.raw.json`, 'utf8')
const fixture = () => JSON.parse(text)
const project = (raw: RawPackageSnapshot) => projectBattleRobe(raw)
function pointer(raw: unknown, path: string): unknown {
  return path.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], raw)
}
function properties(raw: ReturnType<typeof fixture>) {
  return raw.package.objects.find((object: { isClassDefaultObject: boolean }) => object.isClassDefaultObject).properties
}

describe('Battle Robe temporary Domain', () => {
  it('projects exact identity evidence and resolves it only provisionally', () => {
    const raw = fixture()
    const before = JSON.stringify(raw)
    const identity = project(raw).identity
    expect(JSON.stringify(raw)).toBe(before)
    expect(identity).toMatchObject({ status: 'provisional', domainId: 'battle-robe', displayName: 'Battle Robe', assertionId: assertion.id })
    expect(identity).not.toHaveProperty('confidence')
    expect(identity.evidence.itemName).toMatchObject({ state: 'known', value: 'BattleRobe' })
    expect(identity.evidence.serializedId).toMatchObject({ state: 'known', value: 'BattleRobe' })
    for (const field of Object.values(identity.evidence)) {
      expect(pointer(raw, field.trace.raw.nodePointer)).toMatchObject({ decoding: { value: assertion.rawIdentity } })
      expect(field.trace.mappingId).toBe(battleRobeMappings.identity.id)
    }
  })

  it('leaves identity unresolved when either exact Raw identifier is missing or conflicting', () => {
    for (const mutate of [
      (raw: ReturnType<typeof fixture>) => { properties(raw).find((node: { name: { value: string } }) => node.name.value === 'ItemIdName').decoding.value = 'Other' },
      (raw: ReturnType<typeof fixture>) => { properties(raw).find((node: { name: { value: string } }) => node.name.value === 'ItemId').decoding.properties = [] },
    ]) {
      const raw = fixture()
      mutate(raw)
      const identity = project(raw).identity
      expect(identity.status).toBe('unresolved')
      expect(identity).not.toHaveProperty('domainId')
      expect(identity).not.toHaveProperty('displayName')
      expect(identity).not.toHaveProperty('confidence')
    }
  })

  it('validates and traces the GearActor ObjectProperty, class import, and outer package import', () => {
    const raw = fixture()
    const reference = project(raw).gearActorReference
    expect(reference.state).toBe('known')
    if (reference.state !== 'known') throw new Error('missing GearActor reference')
    expect(reference.value).toEqual({
      rawPackageIndex: -2,
      objectName: assertion.gearActorObjectName,
      className: assertion.gearActorClassName,
      gamePackagePath: assertion.gearActorGamePackagePath,
    })
    expect(pointer(raw, reference.trace.objectProperty.nodePointer)).toMatchObject({ name: { value: 'GearActor' }, type: { value: 'ObjectProperty' }, decoding: { value: { rawPackageIndex: -2 } } })
    expect(pointer(raw, reference.trace.classImport.nodePointer)).toMatchObject({ rawPackageIndex: -2, objectName: { value: assertion.gearActorObjectName }, className: { value: assertion.gearActorClassName }, outerIndex: -12 })
    expect(pointer(raw, reference.trace.outerPackageImport.nodePointer)).toMatchObject({ rawPackageIndex: -12, className: { value: 'Package' }, objectName: { value: assertion.gearActorGamePackagePath } })
  })

  it('does not mark broken or unavailable GearActor chains as known', () => {
    for (const mutate of [
      (raw: ReturnType<typeof fixture>) => { properties(raw).find((node: { name: { value: string } }) => node.name.value === 'GearActor').decoding.value.rawPackageIndex = -3 },
      (raw: ReturnType<typeof fixture>) => { raw.package.imports[1].objectName.value = 'Other_C' },
      (raw: ReturnType<typeof fixture>) => { raw.package.imports[11].objectName.value = '/Game/Other' },
      (raw: ReturnType<typeof fixture>) => { properties(raw).find((node: { name: { value: string } }) => node.name.value === 'GearActor').decoding = { state: 'unsupported' } },
    ]) {
      const raw = fixture()
      mutate(raw)
      const reference = project(raw).gearActorReference
      expect(reference.state).not.toBe('known')
      expect(reference).not.toHaveProperty('value')
    }
  })

  it('declares ownership unresolved without inventing an empty or gameplay-valued field', () => {
    const result = project(fixture())
    expect(result.unresolved).toEqual(['armor-property-ownership'])
    const serialized = JSON.stringify(result)
    for (const prohibited of ['armorProperties', 'configuredArmorProperties', 'armorPropertyOwnership', 'MeleeDamageBoost', 'ItemCooldownDecrease', '+30%', '-40%']) expect(serialized).not.toContain(prohibited)
    expect(result.unresolved).not.toEqual([])
  })

  it('uses only the supplied matching Raw package and preserves unavailable CDO state', () => {
    const other = fixture()
    other.logicalPackage.path = 'another-package'
    expect(() => project(other)).toThrow('Unsupported Raw package')
    const unavailable = fixture()
    unavailable.package.objects.find((object: { isClassDefaultObject: boolean }) => object.isClassDefaultObject).extraction = { state: 'not-extracted' }
    const result = project(unavailable)
    expect(result.identity.status).toBe('unresolved')
    expect(result.gearActorReference).toMatchObject({ state: 'not-extracted' })
  })
})
