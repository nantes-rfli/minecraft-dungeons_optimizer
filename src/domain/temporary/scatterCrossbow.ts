import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { scatterCrossbowIdentity as assertion } from './scatterCrossbowIdentity.ts'
import {
  locateRawNode, nestedRawNode, projectionTrace, rawCdoCandidates, rawTrace, readRawValue, topLevelRawNode,
  type Field, type Located, type RawCdoCandidate, type RawTrace, type Trace, type UnavailableState,
} from './projectionPrimitives.ts'

export const scatterCrossbowMappings = {
  identity: { id: 'scatter-crossbow:identity@1', rawFields: ['ItemIdName', 'ItemId.SerializedId'], meaning: 'Both serialized internal identifiers must exactly equal ScatterCrossbow.' },
  definitions: { id: 'scatter-crossbow:configured-projectile-definitions@1', rawField: 'ProjectileDefinition', rawPath: 'AttackDefintion.ProjectileDefinition', meaning: 'Serialized projectile definitions in source order.' },
  projectileCount: { id: 'scatter-crossbow:configured-projectile-count@1', rawField: 'NumberOfProjectiles', meaning: 'Serialized configured projectile count; not an effective hit count.' },
  angleSpan: { id: 'scatter-crossbow:configured-angle-span@1', rawField: 'AngleSpan', meaning: 'Serialized configured angle span; no trajectory outcome is inferred.' },
  delayPerProjectile: { id: 'scatter-crossbow:configured-delay-per-projectile@1', rawField: 'DelaySecondsPerProjectile', meaning: 'Serialized configured delay parameter in seconds; not effective cadence.' },
  velocityFactor: { id: 'scatter-crossbow:configured-projectile-velocity-factor@1', rawField: 'ProjectileVelocityFactor', meaning: 'Serialized configured velocity factor; no effective velocity is inferred.' },
  projectileReference: { id: 'scatter-crossbow:projectile-reference@1', rawField: 'Projectile', meaning: 'Explicitly validated ObjectProperty → class import → outer package import → supplied Raw snapshot chain.' },
  pushbackEnabled: { id: 'scatter-crossbow:configured-pushback-enabled@1', rawField: 'pushback.enablePushback', meaning: 'Serialized configured pushback enable flag.' },
  pushbackStrength: { id: 'scatter-crossbow:configured-pushback-strength@1', rawField: 'pushback.pushbackStrength', meaning: 'Serialized configured pushback strength parameter; no effective displacement is inferred.' },
  ignoreFriendlyFire: { id: 'scatter-crossbow:configured-ignore-friendly-fire@1', rawField: 'IgnoreFriendlyFire', meaning: 'Serialized configured friendly-fire ignore flag.' },
} as const

type ReferenceTrace = {
  mappingId: typeof scatterCrossbowMappings.projectileReference.id
  identityAssertionId: typeof assertion.id
  objectProperty: RawTrace
  classImport: RawTrace
  outerPackageImport: RawTrace
  targetRawSnapshot: Omit<RawTrace, 'nodePointer'>
}
type ProjectileReference =
  | { state: 'known'; value: { rawPackageIndex: number; objectName: string; className: string; targetRawPackagePath: string }; trace: ReferenceTrace }
  | { state: UnavailableState; reason: string; trace: Trace }

/** Pure two-snapshot projection. The Raw extractor remains unaware of cross-package resolution. */
export function projectScatterCrossbow(instanceRaw: RawPackageSnapshot, projectileRaw: RawPackageSnapshot) {
  if (instanceRaw.schemaVersion !== 2 || instanceRaw.logicalPackage.path !== assertion.instancePackagePath) throw new Error('Unsupported instance Raw package for Scatter Crossbow projection')
  if (projectileRaw.schemaVersion !== 2 || projectileRaw.logicalPackage.path !== assertion.projectilePackagePath) throw new Error('Unsupported projectile Raw package for Scatter Crossbow projection')

  function cdo(raw: RawPackageSnapshot): RawCdoCandidate | undefined {
    const matches = rawCdoCandidates(raw)
    return matches.length === 1 ? matches[0] : undefined
  }
  const top = (_raw: RawPackageSnapshot, selected: RawCdoCandidate | undefined, name: string): Located => topLevelRawNode(selected, name)
  const nested = nestedRawNode
  function trace(raw: RawPackageSnapshot, located: Located, mappingId: string): Trace {
    return projectionTrace(raw, located, mappingId, assertion.id)
  }
  function read<T extends string | number | boolean>(raw: RawPackageSnapshot, located: Located, mappingId: string, expectedType: string, valueType: 'string' | 'number' | 'boolean'): Field<T> {
    return readRawValue<T>(raw, located, mappingId, assertion.id, expectedType, valueType)
  }

  const instanceCdo = cdo(instanceRaw)
  const projectileCdo = cdo(projectileRaw)
  const itemName = read<string>(instanceRaw, top(instanceRaw, instanceCdo, 'ItemIdName'), scatterCrossbowMappings.identity.id, 'NameProperty', 'string')
  const serializedId = read<string>(instanceRaw, nested(top(instanceRaw, instanceCdo, 'ItemId'), 'SerializedId'), scatterCrossbowMappings.identity.id, 'NameProperty', 'string')
  const identityResolved = [itemName, serializedId].every((field) => field.state === 'known' && field.value === assertion.rawIdentity)

  const attackDefinition = top(instanceRaw, instanceCdo, 'AttackDefintion')
  const velocity = nested(attackDefinition, scatterCrossbowMappings.velocityFactor.rawField)
  const configuredProjectileVelocityFactor = read<number>(instanceRaw, velocity, scatterCrossbowMappings.velocityFactor.id, 'FloatProperty', 'number')
  const definitions = nested(attackDefinition, scatterCrossbowMappings.definitions.rawField)
  const definitionsTrace = trace(instanceRaw, definitions, scatterCrossbowMappings.definitions.id)

  function projectileConfiguration() {
    const pushback = top(projectileRaw, projectileCdo, 'pushback')
    return {
      configuredPushbackEnabled: read<boolean>(projectileRaw, nested(pushback, 'enablePushback'), scatterCrossbowMappings.pushbackEnabled.id, 'BoolProperty', 'boolean'),
      configuredPushbackStrength: read<number>(projectileRaw, nested(pushback, 'pushbackStrength'), scatterCrossbowMappings.pushbackStrength.id, 'FloatProperty', 'number'),
      configuredIgnoreFriendlyFire: read<boolean>(projectileRaw, top(projectileRaw, projectileCdo, 'IgnoreFriendlyFire'), scatterCrossbowMappings.ignoreFriendlyFire.id, 'BoolProperty', 'boolean'),
    }
  }

  function resolveProjectileReference(located: Located): ProjectileReference {
    const fallbackTrace = trace(instanceRaw, located, scatterCrossbowMappings.projectileReference.id)
    if (!located.node) return { state: located.unavailable ?? 'unknown', reason: 'Projectile ObjectProperty missing, ambiguous, or parent unavailable', trace: fallbackTrace }
    if (located.node.decoding.state !== 'decoded') return { state: located.node.decoding.state, reason: 'Projectile ObjectProperty unavailable', trace: fallbackTrace }
    const value = located.node.decoding.value
    if (located.node.type.value !== 'ObjectProperty' || !value || typeof value !== 'object' || Array.isArray(value)) return { state: 'unknown', reason: 'Projectile is not a decoded ObjectProperty reference', trace: fallbackTrace }
    const reference = value as Record<string, unknown>
    if (reference.kind !== 'import' || typeof reference.rawPackageIndex !== 'number' || typeof reference.index !== 'number' || typeof reference.objectName !== 'string' || typeof reference.className !== 'string') return { state: 'unknown', reason: 'Projectile ObjectProperty is not an import reference', trace: fallbackTrace }
    const classImportMatches = instanceRaw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === reference.rawPackageIndex && entry.index === reference.index)
    if (classImportMatches.length !== 1) return { state: 'unknown', reason: 'Projectile class import is missing or ambiguous', trace: fallbackTrace }
    const classImport = classImportMatches[0]!
    const outerMatches = instanceRaw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === classImport.entry.outerIndex)
    if (outerMatches.length !== 1) return { state: 'unknown', reason: 'Projectile outer package import is missing or ambiguous', trace: fallbackTrace }
    const outer = outerMatches[0]!
    const sameDataset = instanceRaw.dataset.id === projectileRaw.dataset.id && instanceRaw.dataset.sourceFingerprint.value === projectileRaw.dataset.sourceFingerprint.value
    const validKnownChain = reference.objectName === assertion.projectileObjectName && reference.className === assertion.projectileClassName
      && classImport.entry.objectName.value === assertion.projectileObjectName && classImport.entry.className.value === assertion.projectileClassName
      && classImport.entry.outerIndex === outer.entry.rawPackageIndex
      && outer.entry.className.value === 'Package' && outer.entry.objectName.value === assertion.projectileGamePackagePath
      && outer.entry.outerIndex === 0 && outer.entry.outerReference.rawPackageIndex === 0
      && projectileRaw.logicalPackage.path === assertion.projectilePackagePath && sameDataset
    if (!validKnownChain) return { state: 'unknown', reason: 'Projectile import chain does not match the supplied known Raw snapshot', trace: fallbackTrace }
    const target = rawTrace(projectileRaw, '')
    const targetRawSnapshot = {
      artifactPath: target.artifactPath,
      datasetId: target.datasetId,
      extractionRunId: target.extractionRunId,
      packagePath: target.packagePath,
      packageHash: target.packageHash,
    }
    return {
      state: 'known',
      value: {
        rawPackageIndex: reference.rawPackageIndex,
        objectName: reference.objectName,
        className: reference.className,
        targetRawPackagePath: projectileRaw.logicalPackage.path,
      },
      trace: {
        mappingId: scatterCrossbowMappings.projectileReference.id,
        identityAssertionId: assertion.id,
        objectProperty: rawTrace(instanceRaw, located.pointer),
        classImport: rawTrace(instanceRaw, `/package/imports/${classImport.index}`),
        outerPackageImport: rawTrace(instanceRaw, `/package/imports/${outer.index}`),
        targetRawSnapshot,
      },
    }
  }

  type Entry = {
    sourceIndex: number
    configuredProjectileCount: Field<number>
    configuredAngleSpan: Field<number>
    configuredDelaySecondsPerProjectile: Field<number>
    projectile: { reference: ProjectileReference; configuration?: ReturnType<typeof projectileConfiguration> }
  }
  let configuredProjectileDefinitions: Field<Entry[]>
  if (!definitions.node) configuredProjectileDefinitions = { state: definitions.unavailable ?? 'unknown', reason: 'Raw projectile definitions missing or parent unavailable', trace: definitionsTrace }
  else if (definitions.node.decoding.state !== 'decoded') configuredProjectileDefinitions = { state: definitions.node.decoding.state, reason: 'Raw projectile definitions unavailable', trace: definitionsTrace }
  else if (definitions.node.type.value !== 'ArrayProperty' || !definitions.node.decoding.elements) configuredProjectileDefinitions = { state: 'unknown', reason: 'Expected decoded Raw array elements', trace: definitionsTrace }
  else configuredProjectileDefinitions = {
    state: 'known',
    trace: definitionsTrace,
    value: definitions.node.decoding.elements.map((element, arrayPosition) => {
      const pointer = `${definitions.pointer}/decoding/elements/${arrayPosition}`
      const child = (name: string): Located => element.decoding.state === 'decoded' ? locateRawNode(element.properties, `${pointer}/properties`, name) : { pointer, unavailable: element.decoding.state }
      const reference = resolveProjectileReference(child(scatterCrossbowMappings.projectileReference.rawField))
      return {
        sourceIndex: element.index,
        configuredProjectileCount: read<number>(instanceRaw, child(scatterCrossbowMappings.projectileCount.rawField), scatterCrossbowMappings.projectileCount.id, 'IntProperty', 'number'),
        configuredAngleSpan: read<number>(instanceRaw, child(scatterCrossbowMappings.angleSpan.rawField), scatterCrossbowMappings.angleSpan.id, 'FloatProperty', 'number'),
        configuredDelaySecondsPerProjectile: read<number>(instanceRaw, child(scatterCrossbowMappings.delayPerProjectile.rawField), scatterCrossbowMappings.delayPerProjectile.id, 'FloatProperty', 'number'),
        projectile: { reference, ...(reference.state === 'known' ? { configuration: projectileConfiguration() } : {}) },
      }
    }),
  }

  return {
    kind: 'temporary-scatter-crossbow-projection' as const,
    identity: { status: identityResolved ? assertion.status : 'unresolved' as const, ...(identityResolved ? { confidence: assertion.confidence, domainId: assertion.domainId, displayName: assertion.displayName } : {}), assertionId: assertion.id, evidence: { itemName, serializedId } },
    configuredProjectileDefinitions,
    configuredProjectileVelocityFactor,
  }
}
