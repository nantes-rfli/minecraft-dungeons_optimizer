import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { fightersBindingsIdentity as assertion } from './fightersBindingsIdentity.ts'
import {
  locateRawNode, nestedRawNode, projectionTrace, rawCdoCandidates, readRawValue, topLevelRawNode,
  type Field, type Located, type Trace,
} from './projectionPrimitives.ts'

export const fightersBindingsMappings = {
  identity: { id: 'fighters-bindings:identity@1', rawFields: ['ItemIdName', 'ItemId.SerializedId'], meaning: 'Internal identifiers support only the provisional identity assertion.' },
  entries: { id: 'fighters-bindings:configured-attacks@1', rawField: 'ConfiguredAttackVariants', meaning: 'Serialized configured attack entries in source order; not a complete combo mechanic.' },
  damage: { id: 'fighters-bindings:configured-damage@1', rawField: 'Damage', meaning: 'Configured damage parameter; not final damage or power-scaled damage.' },
  duration: { id: 'fighters-bindings:animation-duration@1', rawField: 'AttackAnimationTimeDurationSeconds', meaning: 'Configured animation duration in seconds; not effective attack speed or cadence.' },
} as const

/** Pure projection from a supplied Raw snapshot. No catalog/runtime imports or value fallbacks. */
export function projectFightersBindings(raw: RawPackageSnapshot) {
  if (raw.schemaVersion !== 2 || raw.logicalPackage.path !== assertion.packagePath) throw new Error('Unsupported Raw package for Fighter’s Bindings projection')
  const objects = rawCdoCandidates(raw)
  if (objects.length !== 1) throw new Error('Expected one unambiguous Raw CDO')
  const selected = objects[0]!
  function top(name: string): Located {
    return topLevelRawNode(selected, name)
  }
  function trace(located: Located, mappingId: string): Trace {
    return projectionTrace(raw, located, mappingId, assertion.id)
  }
  function read<T extends string | number>(located: Located, mappingId: string, type: string, valueType: 'string' | 'number'): Field<T> {
    return readRawValue<T>(raw, located, mappingId, assertion.id, type, valueType)
  }
  const itemName = read<string>(top('ItemIdName'), fightersBindingsMappings.identity.id, 'NameProperty', 'string')
  const itemId = top('ItemId')
  const serialized = nestedRawNode(itemId, 'SerializedId')
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
      const child = (name: string): Located => element.decoding.state === 'decoded' ? locateRawNode(element.properties, `${pointer}/properties`, name) : { pointer, unavailable: element.decoding.state }
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
