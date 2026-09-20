import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectScatterCrossbow } from '../src/domain/temporary/scatterCrossbow.ts'
import { scatterCrossbowIdentity as assertion } from '../src/domain/temporary/scatterCrossbowIdentity.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'

const instanceText = fs.readFileSync(`research/raw/packages/${assertion.instancePackagePath}.raw.json`, 'utf8')
const projectileText = fs.readFileSync(`research/raw/packages/${assertion.projectilePackagePath}.raw.json`, 'utf8')
const instanceFixture = () => JSON.parse(instanceText)
const projectileFixture = () => JSON.parse(projectileText)
const project = (instance: RawPackageSnapshot, projectile: RawPackageSnapshot) => projectScatterCrossbow(instance, projectile)
function pointer(raw: unknown, path: string): unknown {
  return path.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], raw)
}
function definitionProperties(raw: ReturnType<typeof instanceFixture>) {
  return raw.package.objects[1].properties[0].decoding.properties[1].decoding.elements[0].properties
}

describe('Scatter Crossbow temporary Domain', () => {
  it('accepts only two matching Raw identifiers and never falls back to a domain ID', () => {
    const result = project(instanceFixture(), projectileFixture())
    expect(result.identity).toMatchObject({ status: 'accepted', confidence: 'high', domainId: 'scatter-crossbow' })
    for (const mutate of [
      (raw: ReturnType<typeof instanceFixture>) => { raw.package.objects[1].properties[5].decoding.value = 'Other' },
      (raw: ReturnType<typeof instanceFixture>) => { raw.package.objects[1].properties[6].decoding.properties = [] },
      (raw: ReturnType<typeof instanceFixture>) => { raw.package.objects[1].properties[5].decoding.value = 'Other'; raw.package.objects[1].properties[6].decoding.properties[0].decoding.value = 'Different' },
    ]) {
      const raw = instanceFixture()
      mutate(raw)
      const unresolved = project(raw, projectileFixture()).identity
      expect(unresolved.status).toBe('unresolved')
      expect(unresolved).not.toHaveProperty('domainId')
      expect(unresolved).not.toHaveProperty('displayName')
    }
  })

  it('projects exact values in source order without mutating either Raw snapshot', () => {
    const instance = instanceFixture()
    const projectile = projectileFixture()
    const definition = instance.package.objects[1].properties[0].decoding.properties[1].decoding.elements[0]
    const second = structuredClone(definition)
    second.index = 7
    definition.index = 3
    instance.package.objects[1].properties[0].decoding.properties[1].decoding.elements.push(second)
    const before = [JSON.stringify(instance), JSON.stringify(projectile)]
    const result = project(instance, projectile)
    expect([JSON.stringify(instance), JSON.stringify(projectile)]).toEqual(before)
    expect(result.configuredProjectileVelocityFactor).toMatchObject({ state: 'known', value: 1.100000023841858 })
    expect(result.configuredProjectileDefinitions.state).toBe('known')
    if (result.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
    expect(result.configuredProjectileDefinitions.value.map((entry) => entry.sourceIndex)).toEqual([3, 7])
    for (const entry of result.configuredProjectileDefinitions.value) {
      expect(entry.configuredProjectileCount).toMatchObject({ state: 'known', value: 3 })
      expect(entry.configuredAngleSpan).toMatchObject({ state: 'known', value: 20 })
      expect(entry.configuredDelaySecondsPerProjectile).toMatchObject({ state: 'known', value: 0.029999999329447746 })
      expect(entry.projectile.configuration).toMatchObject({
        configuredPushbackEnabled: { state: 'known', value: true },
        configuredPushbackStrength: { state: 'known', value: 0.6000000238418579 },
        configuredIgnoreFriendlyFire: { state: 'known', value: true },
      })
    }
  })

  it('traces the ObjectProperty, class import, outer package import, target snapshot, and projectile fields separately', () => {
    const instance = instanceFixture()
    const projectile = projectileFixture()
    const result = project(instance, projectile)
    if (result.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
    const projected = result.configuredProjectileDefinitions.value[0]!.projectile
    expect(projected.reference.state).toBe('known')
    if (projected.reference.state !== 'known' || !projected.configuration) throw new Error('missing linked projectile')
    expect(projected.reference.value).toEqual({
      rawPackageIndex: -5,
      objectName: 'BP_ScatterCrossBow_Arrow_C',
      className: 'BlueprintGeneratedClass',
      targetRawPackagePath: assertion.projectilePackagePath,
    })
    expect(pointer(instance, projected.reference.trace.objectProperty.nodePointer)).toMatchObject({ name: { value: 'Projectile' }, decoding: { value: { rawPackageIndex: -5 } } })
    expect(pointer(instance, projected.reference.trace.classImport.nodePointer)).toMatchObject({ rawPackageIndex: -5, objectName: { value: assertion.projectileObjectName }, className: { value: assertion.projectileClassName }, outerIndex: -21 })
    expect(pointer(instance, projected.reference.trace.outerPackageImport.nodePointer)).toMatchObject({ rawPackageIndex: -21, objectName: { value: assertion.projectileGamePackagePath } })
    expect(projected.reference.trace.targetRawSnapshot).toMatchObject({ packagePath: projectile.logicalPackage.path, packageHash: projectile.logicalPackage.contentHash })
    for (const field of Object.values(projected.configuration)) {
      expect(pointer(projectile, field.trace.raw.nodePointer)).toMatchObject({ decoding: { value: field.state === 'known' ? field.value : undefined } })
    }
    expect(instance.extraction.configuration.crossPackageReferenceResolution).toBe('not-performed')
  })

  it('does not associate projectile configuration when the explicit reference chain fails', () => {
    for (const mutate of [
      (raw: ReturnType<typeof instanceFixture>) => { definitionProperties(raw)[0].decoding.value.rawPackageIndex = -4 },
      (raw: ReturnType<typeof instanceFixture>) => { raw.package.imports[4].objectName.value = 'Other_C' },
      (raw: ReturnType<typeof instanceFixture>) => { raw.package.imports[20].objectName.value = '/Game/Other' },
    ]) {
      const instance = instanceFixture()
      mutate(instance)
      const result = project(instance, projectileFixture())
      if (result.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
      expect(result.configuredProjectileDefinitions.value[0]!.projectile.reference.state).toBe('unknown')
      expect(result.configuredProjectileDefinitions.value[0]!.projectile).not.toHaveProperty('configuration')
    }
    const projectile = projectileFixture()
    projectile.dataset.id = 'different-dataset'
    const result = project(instanceFixture(), projectile)
    if (result.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
    expect(result.configuredProjectileDefinitions.value[0]!.projectile).not.toHaveProperty('configuration')
  })

  it('preserves zero and false and does not fill missing, duplicate, or wrong-type fields', () => {
    const zeroInstance = instanceFixture()
    const zeroProperties = definitionProperties(zeroInstance)
    zeroProperties.find((node: { name: { value: string } }) => node.name.value === 'NumberOfProjectiles').decoding.value = 0
    zeroProperties.find((node: { name: { value: string } }) => node.name.value === 'DelaySecondsPerProjectile').decoding.value = 0
    zeroInstance.package.objects[1].properties[0].decoding.properties.find((node: { name: { value: string } }) => node.name.value === 'ProjectileVelocityFactor').decoding.value = 0
    const falseProjectile = projectileFixture()
    falseProjectile.package.objects[2].properties[3].decoding.properties[0].decoding.value = false
    falseProjectile.package.objects[2].properties[5].decoding.value = false
    const zero = project(zeroInstance, falseProjectile)
    if (zero.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
    expect(zero.configuredProjectileVelocityFactor).toMatchObject({ state: 'known', value: 0 })
    expect(zero.configuredProjectileDefinitions.value[0]!.configuredProjectileCount).toMatchObject({ state: 'known', value: 0 })
    expect(zero.configuredProjectileDefinitions.value[0]!.configuredDelaySecondsPerProjectile).toMatchObject({ state: 'known', value: 0 })
    expect(zero.configuredProjectileDefinitions.value[0]!.projectile.configuration).toMatchObject({ configuredPushbackEnabled: { state: 'known', value: false }, configuredIgnoreFriendlyFire: { state: 'known', value: false } })

    for (const change of ['missing', 'duplicate', 'type']) {
      const raw = instanceFixture()
      const properties = definitionProperties(raw)
      const index = properties.findIndex((node: { name: { value: string } }) => node.name.value === 'AngleSpan')
      if (change === 'missing') properties.splice(index, 1)
      if (change === 'duplicate') properties.push(structuredClone(properties[index]))
      if (change === 'type') properties[index].type.value = 'IntProperty'
      const projected = project(raw, projectileFixture())
      if (projected.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
      expect(projected.configuredProjectileDefinitions.value[0]!.configuredAngleSpan.state).toBe('unknown')
      expect(projected.configuredProjectileDefinitions.value[0]!.configuredAngleSpan).not.toHaveProperty('value')
    }

    for (const change of ['missing', 'duplicate', 'type']) {
      const projectile = projectileFixture()
      const properties = projectile.package.objects[2].properties[3].decoding.properties
      const index = properties.findIndex((node: { name: { value: string } }) => node.name.value === 'pushbackStrength')
      if (change === 'missing') properties.splice(index, 1)
      if (change === 'duplicate') properties.push(structuredClone(properties[index]))
      if (change === 'type') properties[index].type.value = 'IntProperty'
      const projected = project(instanceFixture(), projectile)
      if (projected.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
      expect(projected.configuredProjectileDefinitions.value[0]!.projectile.configuration?.configuredPushbackStrength.state).toBe('unknown')
      expect(projected.configuredProjectileDefinitions.value[0]!.projectile.configuration?.configuredPushbackStrength).not.toHaveProperty('value')
    }
  })

  it.each(['unsupported', 'parse-failed'])('preserves %s without values', (state) => {
    const instance = instanceFixture()
    definitionProperties(instance)[1].decoding = { state }
    const projectile = projectileFixture()
    projectile.package.objects[2].properties[3].decoding.properties[1].decoding = { state }
    const result = project(instance, projectile)
    if (result.configuredProjectileDefinitions.state !== 'known') throw new Error('missing definitions')
    expect(result.configuredProjectileDefinitions.value[0]!.configuredProjectileCount).toMatchObject({ state })
    expect(result.configuredProjectileDefinitions.value[0]!.projectile.configuration?.configuredPushbackStrength).toMatchObject({ state })
  })

  it('preserves not-extracted parents without reading stale children', () => {
    const instance = instanceFixture()
    instance.package.objects[1].extraction = { state: 'not-extracted' }
    const result = project(instance, projectileFixture())
    expect(result.identity.status).toBe('unresolved')
    expect(result.configuredProjectileDefinitions).toMatchObject({ state: 'not-extracted' })
    expect(result.configuredProjectileVelocityFactor).toMatchObject({ state: 'not-extracted' })
  })

  it('keeps prohibited gameplay fields out of the projection', () => {
    const serialized = JSON.stringify(project(instanceFixture(), projectileFixture()))
    for (const prohibited of ['AttackRateSeconds', 'ProjectileStackCount', 'damage', 'HomingThreshold', 'chargeable', 'ammo', 'effectiveCadence', 'finalDamage', 'Power']) expect(serialized).not.toContain(prohibited)
  })
})
