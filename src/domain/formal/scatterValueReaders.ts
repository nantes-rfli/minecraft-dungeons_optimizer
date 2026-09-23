import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { scatterValueMappings as mapping } from './scatterValueMappings.ts'
import { nestedRawNode, rawCdoCandidates, readRawValue, topLevelRawNode } from './rawProjection.ts'
import { scatterCrossbowFormalIdentity } from './identityDefinitions.ts'

const assertionId = scatterCrossbowFormalIdentity.assertion.id
const cdo = (raw: RawPackageSnapshot) => {
  const candidates = rawCdoCandidates(raw)
  return candidates.length === 1 ? candidates[0] : undefined
}

export function readScatterVelocity(raw: RawPackageSnapshot) {
  const attack = topLevelRawNode(cdo(raw), 'AttackDefintion')
  return readRawValue<number>(
    raw,
    nestedRawNode(attack, mapping.velocityFactor.rawField),
    mapping.velocityFactor.id,
    assertionId,
    'FloatProperty',
    'number',
  )
}

export function readScatterTarget(raw: RawPackageSnapshot) {
  const selected = cdo(raw)
  const pushback = topLevelRawNode(selected, 'pushback')
  return {
    pushbackEnabled: readRawValue<boolean>(raw, nestedRawNode(pushback, 'enablePushback'), mapping.pushbackEnabled.id, assertionId, 'BoolProperty', 'boolean'),
    pushbackStrength: readRawValue<number>(raw, nestedRawNode(pushback, 'pushbackStrength'), mapping.pushbackStrength.id, assertionId, 'FloatProperty', 'number'),
    ignoreFriendlyFire: readRawValue<boolean>(raw, topLevelRawNode(selected, 'IgnoreFriendlyFire'), mapping.ignoreFriendlyFire.id, assertionId, 'BoolProperty', 'boolean'),
  }
}
