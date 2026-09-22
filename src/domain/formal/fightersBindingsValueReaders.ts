import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { fightersBindingsFormalIdentity } from './identityDefinitions.ts'
import { fightersBindingsValueMappings as mapping } from './fightersBindingsValueMappings.ts'
import {
  locateRawNode, projectionTrace, rawCdoCandidates, readRawValue, topLevelRawNode,
  type Field, type Located,
} from './rawProjection.ts'

const assertionId = fightersBindingsFormalIdentity.assertion.id
const cdo = (raw: RawPackageSnapshot) => {
  const candidates = rawCdoCandidates(raw)
  return candidates.length === 1 ? candidates[0] : undefined
}
const read = (raw: RawPackageSnapshot, located: Located, id: string) =>
  readRawValue<number>(raw, located, id, assertionId, 'FloatProperty', 'number')

export function readFightersBindingsValues(raw: RawPackageSnapshot) {
  const selected = cdo(raw)
  const parent = topLevelRawNode(selected, mapping.entries.rawField)
  const trace = projectionTrace(raw, parent, mapping.entries.id, assertionId)
  type Entry = {
    sourceIndex: number
    configuredDamage: Field<number>
    configuredAnimationDurationSeconds: Field<number>
  }
  let configuredAttacks: Field<Entry[]>
  if (!parent.node) {
    configuredAttacks = {
      state: parent.unavailable ?? 'unknown',
      reason: 'Raw configured entries missing or parent unavailable',
      trace,
    }
  } else if (parent.node.decoding.state !== 'decoded') {
    configuredAttacks = {
      state: parent.node.decoding.state,
      reason: 'Raw configured entries unavailable',
      trace,
    }
  } else if (parent.node.type.value !== 'ArrayProperty' || !parent.node.decoding.elements) {
    configuredAttacks = {
      state: 'unknown',
      reason: 'Expected decoded Raw array elements',
      trace,
    }
  } else {
    configuredAttacks = {
      state: 'known',
      trace,
      value: parent.node.decoding.elements.map((element, position) => {
        const pointer = `${parent.pointer}/decoding/elements/${position}`
        const child = (name: string): Located => element.decoding.state === 'decoded'
          ? locateRawNode(element.properties, `${pointer}/properties`, name)
          : { pointer, unavailable: element.decoding.state }
        return {
          sourceIndex: element.index,
          configuredDamage: read(raw, child(mapping.damage.rawField), mapping.damage.id),
          configuredAnimationDurationSeconds: read(raw, child(mapping.duration.rawField), mapping.duration.id),
        }
      }),
    }
  }
  return { configuredAttacks }
}
