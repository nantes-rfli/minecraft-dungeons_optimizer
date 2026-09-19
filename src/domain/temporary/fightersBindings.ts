import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { fightersBindingsIdentity as assertion } from './fightersBindingsIdentity.ts'

type RawObject = RawPackageSnapshot['package']['objects'][number]
type RawNode = NonNullable<RawObject['properties']>[number]

export const fightersBindingsMappings = {
  identity: { id: 'fighters-bindings:identity@1', rawFields: ['ItemIdName', 'ItemId.SerializedId'], meaning: 'Internal identifiers support only the provisional identity assertion.' },
  entries: { id: 'fighters-bindings:configured-attacks@1', rawField: 'ConfiguredAttackVariants', meaning: 'Serialized configured attack entries in source order; not a complete combo mechanic.' },
  damage: { id: 'fighters-bindings:configured-damage@1', rawField: 'Damage', meaning: 'Configured damage parameter; not final damage or power-scaled damage.' },
  duration: { id: 'fighters-bindings:animation-duration@1', rawField: 'AttackAnimationTimeDurationSeconds', meaning: 'Configured animation duration in seconds; not effective attack speed or cadence.' },
} as const

type Trace = {
  mappingId: string
  identityAssertionId: typeof assertion.id
  raw: { artifactPath: string; datasetId: string; extractionRunId: string; packagePath: string; packageHash: RawPackageSnapshot['logicalPackage']['contentHash']; nodePointer: string }
}
type Field<T> = { state: 'known'; value: T; trace: Trace } | { state: 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted'; reason: string; trace: Trace }
type Located = { node?: RawNode; pointer: string; unavailable?: Exclude<Field<never>['state'], 'known'> }

/** Pure projection from a supplied Raw snapshot. No catalog/runtime imports or value fallbacks. */
export function projectFightersBindings(raw: RawPackageSnapshot) {
  if (raw.schemaVersion !== 2 || raw.logicalPackage.path !== assertion.packagePath) throw new Error('Unsupported Raw package for Fighter’s Bindings projection')
  const objects = raw.package.objects.map((object, index) => ({ object, index })).filter(({ object }) => object.isClassDefaultObject)
  if (objects.length !== 1) throw new Error('Expected one unambiguous Raw CDO')
  const { object, index } = objects[0]!
  const root = `/package/objects/${index}`
  function locate(nodes: readonly RawNode[] | undefined, pointer: string, name: string): Located {
    const matches = nodes?.map((node, i) => ({ node, pointer: `${pointer}/${i}` })).filter(({ node }) => node.name.value === name && node.arrayIndex === 0) ?? []
    return matches.length === 1 ? matches[0]! : { pointer, unavailable: 'unknown' }
  }
  function top(name: string): Located {
    return object.extraction.state === 'decoded' ? locate(object.properties, `${root}/properties`, name) : { pointer: root, unavailable: object.extraction.state }
  }
  function trace(located: Located, mappingId: string): Trace {
    return { mappingId, identityAssertionId: assertion.id, raw: { artifactPath: `research/raw/packages/${raw.logicalPackage.path}.raw.json`, datasetId: raw.dataset.id, extractionRunId: raw.extraction.runId, packagePath: raw.logicalPackage.path, packageHash: raw.logicalPackage.contentHash, nodePointer: located.pointer } }
  }
  function read<T extends string | number>(located: Located, mappingId: string, type: string, valueType: 'string' | 'number'): Field<T> {
    const provenance = trace(located, mappingId)
    if (!located.node) return { state: located.unavailable ?? 'unknown', reason: 'Raw node missing, ambiguous, or parent unavailable', trace: provenance }
    const { node } = located
    if (node.decoding.state !== 'decoded') return { state: node.decoding.state, reason: 'Raw node unavailable', trace: provenance }
    const value = node.decoding.value
    if (node.type.value !== type || typeof value !== valueType || (typeof value === 'number' && !Number.isFinite(value))) return { state: 'unknown', reason: 'Unexpected Raw type or value', trace: provenance }
    return { state: 'known', value: value as T, trace: provenance }
  }
  const itemName = read<string>(top('ItemIdName'), fightersBindingsMappings.identity.id, 'NameProperty', 'string')
  const itemId = top('ItemId')
  let serialized: Located
  if (!itemId.node) serialized = itemId
  else if (itemId.node.decoding.state !== 'decoded') serialized = { pointer: itemId.pointer, unavailable: itemId.node.decoding.state }
  else if (itemId.node.type.value !== 'StructProperty') serialized = { pointer: itemId.pointer, unavailable: 'unknown' }
  else serialized = locate(itemId.node.decoding.properties, `${itemId.pointer}/decoding/properties`, 'SerializedId')
  const serializedId = read<string>(serialized, fightersBindingsMappings.identity.id, 'NameProperty', 'string')
  const resolved = [itemName, serializedId].every((field) => field.state === 'known' && field.value === assertion.rawIdentity)
  const array = top(fightersBindingsMappings.entries.rawField)
  const arrayTrace = trace(array, fightersBindingsMappings.entries.id)
  type Entry = { sourceIndex: number; configuredDamage: Field<number>; configuredAnimationDurationSeconds: Field<number> }
  let configuredAttacks: Field<Entry[]>
  if (!array.node) {
    configuredAttacks = { state: array.unavailable ?? 'unknown', reason: 'Raw configured entries missing or parent unavailable', trace: arrayTrace }
  } else if (array.node.decoding.state !== 'decoded') {
    configuredAttacks = { state: array.node.decoding.state, reason: 'Raw configured entries unavailable', trace: arrayTrace }
  } else if (array.node.type.value !== 'ArrayProperty' || !array.node.decoding.elements) {
    configuredAttacks = { state: 'unknown', reason: 'Expected decoded Raw array elements', trace: arrayTrace }
  } else {
    configuredAttacks = { state: 'known', trace: arrayTrace, value: array.node.decoding.elements.map((element, i) => {
      const pointer = `${array.pointer}/decoding/elements/${i}`
      const child = (name: string): Located => element.decoding.state === 'decoded' ? locate(element.properties, `${pointer}/properties`, name) : { pointer, unavailable: element.decoding.state }
      return { sourceIndex: element.index, configuredDamage: read<number>(child(fightersBindingsMappings.damage.rawField), fightersBindingsMappings.damage.id, 'FloatProperty', 'number'), configuredAnimationDurationSeconds: read<number>(child(fightersBindingsMappings.duration.rawField), fightersBindingsMappings.duration.id, 'FloatProperty', 'number') }
    }) }
  }
  return {
    kind: 'temporary-fighters-bindings-projection' as const,
    identity: { status: resolved ? assertion.status : 'unresolved' as const, ...(resolved ? { domainId: assertion.domainId, displayName: assertion.displayName } : {}), assertionId: assertion.id, evidence: { itemName, serializedId } },
    configuredAttacks,
    unresolved: ['final-damage', 'power-scaling', 'effective-attack-cadence', 'complete-combo-mechanic'] as const,
  }
}
