import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { scatterValueMappings as mapping } from './scatterValueMappings.ts'
import { locateRawNode, nestedRawNode, projectionTrace, rawCdoCandidates, readRawValue, topLevelRawNode, type Field, type Located } from '../temporary/projectionPrimitives.ts'
import { scatterCrossbowFormalIdentity } from './identityDefinitions.ts'

const assertionId = scatterCrossbowFormalIdentity.assertion.id
const cdo = (raw: RawPackageSnapshot) => { const candidates = rawCdoCandidates(raw); return candidates.length === 1 ? candidates[0] : undefined }
const read = <T extends number | boolean>(raw: RawPackageSnapshot, located: Located, id: string, type: string, valueType: 'number' | 'boolean') =>
  readRawValue<T>(raw, located, id, assertionId, type, valueType)

export function readScatterSource(raw: RawPackageSnapshot) {
  const attack = topLevelRawNode(cdo(raw), 'AttackDefintion')
  const velocity = read<number>(raw, nestedRawNode(attack, mapping.velocityFactor.rawField), mapping.velocityFactor.id, 'FloatProperty', 'number')
  const parent = nestedRawNode(attack, mapping.definitions.rawField)
  const trace = projectionTrace(raw, parent, mapping.definitions.id, assertionId)
  type Entry = { sourceIndex: number; count: Field<number>; angle: Field<number>; delay: Field<number> }
  let definitions: Field<Entry[]>
  if (!parent.node) definitions = { state: parent.unavailable ?? 'unknown', reason: 'Raw projectile definitions missing or parent unavailable', trace }
  else if (parent.node.decoding.state !== 'decoded') definitions = { state: parent.node.decoding.state, reason: 'Raw projectile definitions unavailable', trace }
  else if (parent.node.type.value !== 'ArrayProperty' || !parent.node.decoding.elements) definitions = { state: 'unknown', reason: 'Expected decoded Raw array elements', trace }
  else {
    const elements = parent.node.decoding.elements
    const indices = elements.map((element) => element.index)
    if (indices.some((index) => !Number.isInteger(index) || index < 0) || new Set(indices).size !== indices.length) {
      definitions = { state: 'unknown', reason: 'Missing, negative, or duplicate Raw element.index', trace }
    } else definitions = { state: 'known', trace, value: elements.map((element, position) => {
      const pointer = `${parent.pointer}/decoding/elements/${position}`
      const child = (name: string): Located => element.decoding.state === 'decoded'
        ? locateRawNode(element.properties, `${pointer}/properties`, name) : { pointer, unavailable: element.decoding.state }
      return { sourceIndex: element.index,
        count: read<number>(raw, child(mapping.projectileCount.rawField), mapping.projectileCount.id, 'IntProperty', 'number'),
        angle: read<number>(raw, child(mapping.angleSpan.rawField), mapping.angleSpan.id, 'FloatProperty', 'number'),
        delay: read<number>(raw, child(mapping.delayPerProjectile.rawField), mapping.delayPerProjectile.id, 'FloatProperty', 'number') }
    }) }
  }
  return { velocity, definitions }
}

export function readScatterTarget(raw: RawPackageSnapshot) {
  const selected = cdo(raw)
  const pushback = topLevelRawNode(selected, 'pushback')
  return {
    pushbackEnabled: read<boolean>(raw, nestedRawNode(pushback, 'enablePushback'), mapping.pushbackEnabled.id, 'BoolProperty', 'boolean'),
    pushbackStrength: read<number>(raw, nestedRawNode(pushback, 'pushbackStrength'), mapping.pushbackStrength.id, 'FloatProperty', 'number'),
    ignoreFriendlyFire: read<boolean>(raw, topLevelRawNode(selected, 'IgnoreFriendlyFire'), mapping.ignoreFriendlyFire.id, 'BoolProperty', 'boolean'),
  }
}
