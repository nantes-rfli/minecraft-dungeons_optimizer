import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectDeathCapMushroom } from '../src/domain/temporary/deathCapMushroom.ts'
import { deathCapMushroomIdentity as assertion } from '../src/domain/temporary/deathCapMushroomIdentity.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'

const instanceText = fs.readFileSync(`research/raw/packages/${assertion.instancePackagePath}.raw.json`, 'utf8')
const effectText = fs.readFileSync(`research/raw/packages/${assertion.effectPackagePath}.raw.json`, 'utf8')
const instanceFixture = () => JSON.parse(instanceText)
const effectFixture = () => JSON.parse(effectText)
const project = (instance: RawPackageSnapshot, effect: RawPackageSnapshot) => projectDeathCapMushroom(instance, effect)
function pointer(raw: unknown, path: string): unknown {
  return path.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], raw)
}
function properties(raw: ReturnType<typeof instanceFixture>) {
  return raw.package.objects.find((object: { isClassDefaultObject: boolean }) => object.isClassDefaultObject).properties
}
function property(raw: ReturnType<typeof instanceFixture>, name: string) {
  return properties(raw).find((node: { name: { value: string } }) => node.name.value === name)
}

describe('Death Cap Mushroom temporary Domain', () => {
  it('accepts identity only when both exact serialized identifiers match', () => {
    const identity = project(instanceFixture(), effectFixture()).identity
    expect(identity).toMatchObject({ status: 'accepted', confidence: 'high', domainId: 'death-cap-mushroom', displayName: 'Death Cap Mushroom' })
    for (const mutate of [
      (raw: ReturnType<typeof instanceFixture>) => { property(raw, 'ItemIdName').decoding.value = 'Other' },
      (raw: ReturnType<typeof instanceFixture>) => { property(raw, 'ItemId').decoding.properties = [] },
      (raw: ReturnType<typeof instanceFixture>) => { property(raw, 'ItemIdName').decoding = { state: 'unsupported' } },
    ]) {
      const raw = instanceFixture()
      mutate(raw)
      const unresolved = project(raw, effectFixture()).identity
      expect(unresolved.status).toBe('unresolved')
      expect(unresolved).not.toHaveProperty('confidence')
      expect(unresolved).not.toHaveProperty('domainId')
      expect(unresolved).not.toHaveProperty('displayName')
    }
  })

  it('validates and separately traces the exact Effect chain and target snapshot provenance', () => {
    const instance = instanceFixture()
    const effect = effectFixture()
    const reference = project(instance, effect).effectReference
    expect(reference.state).toBe('known')
    if (reference.state !== 'known') throw new Error('missing Effect reference')
    expect(reference.value).toEqual({
      rawPackageIndex: -3,
      objectName: assertion.effectObjectName,
      className: assertion.effectClassName,
      targetRawPackagePath: assertion.effectPackagePath,
    })
    expect(pointer(instance, reference.trace.objectProperty.nodePointer)).toMatchObject({ name: { value: 'Effect' }, type: { value: 'ObjectProperty' }, decoding: { value: { rawPackageIndex: -3, index: 2 } } })
    expect(pointer(instance, reference.trace.classImport.nodePointer)).toMatchObject({ rawPackageIndex: -3, objectName: { value: assertion.effectObjectName }, className: { value: assertion.effectClassName }, outerIndex: -19 })
    expect(pointer(instance, reference.trace.outerPackageImport.nodePointer)).toMatchObject({ rawPackageIndex: -19, className: { value: 'Package' }, objectName: { value: assertion.effectGamePackagePath } })
    expect(reference.trace.targetRawSnapshot).toMatchObject({
      artifactPath: `research/raw/packages/${assertion.effectPackagePath}.raw.json`,
      datasetId: instance.dataset.id,
      sourceFingerprint: instance.dataset.sourceFingerprint,
      packagePath: effect.logicalPackage.path,
      packageHash: effect.logicalPackage.contentHash,
    })
  })

  it('never knows an Effect reference with a broken chain or mismatched target snapshot', () => {
    const cases: Array<[ReturnType<typeof instanceFixture>, ReturnType<typeof effectFixture>]> = []
    const brokenIndex = instanceFixture()
    property(brokenIndex, 'Effect').decoding.value.rawPackageIndex = -4
    cases.push([brokenIndex, effectFixture()])
    const wrongClass = instanceFixture()
    wrongClass.package.imports[2].objectName.value = 'Other_C'
    cases.push([wrongClass, effectFixture()])
    const wrongOuter = instanceFixture()
    wrongOuter.package.imports[18].objectName.value = '/Game/Other'
    cases.push([wrongOuter, effectFixture()])
    const wrongTarget = effectFixture()
    wrongTarget.logicalPackage.path = 'Dungeons/Content/Other'
    cases.push([instanceFixture(), wrongTarget])
    const differentDataset = effectFixture()
    differentDataset.dataset.id = 'different-dataset'
    cases.push([instanceFixture(), differentDataset])
    const differentFingerprint = effectFixture()
    differentFingerprint.dataset.sourceFingerprint.value = 'different-fingerprint'
    cases.push([instanceFixture(), differentFingerprint])

    for (const [instance, effect] of cases) {
      const reference = project(instance, effect).effectReference
      expect(reference.state).toBe('unknown')
      expect(reference).not.toHaveProperty('value')
    }
  })

  it.each(['unsupported', 'parse-failed'] as const)('preserves %s Effect decoding state', (state) => {
    const instance = instanceFixture()
    property(instance, 'Effect').decoding = { state }
    expect(project(instance, effectFixture()).effectReference).toMatchObject({ state })
    expect(project(instance, effectFixture()).effectReference).not.toHaveProperty('value')
  })

  it('preserves not-extracted CDO state without reading stale children', () => {
    const instance = instanceFixture()
    instance.package.objects.find((object: { isClassDefaultObject: boolean }) => object.isClassDefaultObject).extraction = { state: 'not-extracted' }
    const result = project(instance, effectFixture())
    expect(result.identity.status).toBe('unresolved')
    expect(result.effectReference).toMatchObject({ state: 'not-extracted' })
  })

  it('keeps identity and Effect reference resolution independent', () => {
    const wrongIdentity = instanceFixture()
    property(wrongIdentity, 'ItemIdName').decoding.value = 'Other'
    const referenceResolved = project(wrongIdentity, effectFixture())
    expect(referenceResolved.identity.status).toBe('unresolved')
    expect(referenceResolved.effectReference.state).toBe('known')

    const wrongEffect = instanceFixture()
    property(wrongEffect, 'Effect').decoding.value.rawPackageIndex = -4
    const identityResolved = project(wrongEffect, effectFixture())
    expect(identityResolved.identity.status).toBe('accepted')
    expect(identityResolved.effectReference.state).toBe('unknown')
  })

  it('marks gameplay semantics unresolved and does not project prohibited fields or UIData', () => {
    const result = project(instanceFixture(), effectFixture())
    expect(result.unresolved).toEqual(['gameplay-effect-semantics'])
    const serialized = JSON.stringify(result)
    for (const prohibited of [
      'duration', 'attackSpeed', 'movementSpeed', 'attackSpeedMagnitude', 'movementSpeedMagnitude',
      'powerScaling', 'stacking', 'effectiveUptime', 'buff', 'modifier', 'effectMagnitude',
      'gameplayEffectSemantics', 'UIData',
    ]) expect(serialized).not.toContain(prohibited)
  })

  it('does not mutate either Raw snapshot', () => {
    const instance = instanceFixture()
    const effect = effectFixture()
    const before = [JSON.stringify(instance), JSON.stringify(effect)]
    project(instance, effect)
    expect([JSON.stringify(instance), JSON.stringify(effect)]).toEqual(before)
  })
})
