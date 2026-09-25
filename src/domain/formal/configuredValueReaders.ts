import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import {
  locateRawNode, nestedRawNode, projectionTrace, rawCdoCandidates, readRawValue, topLevelRawNode,
  type Field, type Located,
} from './rawProjection.ts'

type ValueMapping = { readonly id: string; readonly rawField: string }

export type MeleeConfiguredValueMappings = {
  readonly entries: ValueMapping
  readonly damage: ValueMapping
  readonly duration: ValueMapping
  readonly attackRange: ValueMapping
  readonly coneAngle: ValueMapping
  readonly coneOffset: ValueMapping
  readonly splashMultiplier: ValueMapping
  readonly damageDelay: ValueMapping
  readonly variantType: ValueMapping
  readonly variantLoopAmount: ValueMapping
}

export type RangedConfiguredValueMappings = {
  readonly definitions: ValueMapping
  readonly projectileCount: ValueMapping
  readonly angleSpan: ValueMapping
  readonly delayPerProjectile: ValueMapping
  readonly delaySeconds: ValueMapping
}

export type MeleeConfiguredEntry = {
  sourceIndex: number
  configuredDamage: Field<number>
  configuredAnimationDurationSeconds: Field<number>
  configuredAttackRange: Field<number>
  configuredConeAngleDegrees: Field<number>
  configuredConeOffsetUnits: Field<number>
  configuredDamageSplashMultiplier: Field<number>
  configuredDamageDelaySeconds: Field<number>
  configuredAttackVariantType: Field<string>
  configuredVariantLoopAmount: Field<number>
}

export type RangedConfiguredEntry = {
  sourceIndex: number
  count: Field<number>
  angle: Field<number>
  delay: Field<number>
  delaySeconds: Field<number>
}

export type MeleeConfiguredValues = {
  configuredAttacks: Field<MeleeConfiguredEntry[]>
}

export type RangedConfiguredValues = {
  definitions: Field<RangedConfiguredEntry[]>
}

const cdo = (raw: RawPackageSnapshot) => {
  const candidates = rawCdoCandidates(raw)
  return candidates.length === 1 ? candidates[0] : undefined
}

export function readMeleeConfiguredValues(
  raw: RawPackageSnapshot,
  identityAssertionId: string,
  mapping: MeleeConfiguredValueMappings,
): MeleeConfiguredValues {
  const parent = topLevelRawNode(cdo(raw), mapping.entries.rawField)
  const trace = projectionTrace(raw, parent, mapping.entries.id, identityAssertionId)
  if (!parent.node) return { configuredAttacks: {
    state: parent.unavailable ?? 'unknown', reason: 'Raw configured entries missing or parent unavailable', trace,
  } }
  if (parent.node.decoding.state !== 'decoded') return { configuredAttacks: {
    state: parent.node.decoding.state, reason: 'Raw configured entries unavailable', trace,
  } }
  if (parent.node.type.value !== 'ArrayProperty' || !parent.node.decoding.elements) return { configuredAttacks: {
    state: 'unknown', reason: 'Expected decoded Raw array elements', trace,
  } }

  return {
    configuredAttacks: {
      state: 'known',
      trace,
      value: parent.node.decoding.elements.map((element, position) => {
        const pointer = `${parent.pointer}/decoding/elements/${position}`
        const locate = (name: string): Located => element.decoding.state === 'decoded'
          ? locateRawNode(element.properties, `${pointer}/properties`, name)
          : { pointer, unavailable: element.decoding.state }
        return {
          sourceIndex: element.index,
          configuredDamage: readRawValue<number>(raw, locate(mapping.damage.rawField), mapping.damage.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredAnimationDurationSeconds: readRawValue<number>(raw, locate(mapping.duration.rawField), mapping.duration.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredAttackRange: readRawValue<number>(raw, locate(mapping.attackRange.rawField), mapping.attackRange.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredConeAngleDegrees: readRawValue<number>(raw, locate(mapping.coneAngle.rawField), mapping.coneAngle.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredConeOffsetUnits: readRawValue<number>(raw, locate(mapping.coneOffset.rawField), mapping.coneOffset.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredDamageSplashMultiplier: readRawValue<number>(raw, locate(mapping.splashMultiplier.rawField), mapping.splashMultiplier.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredDamageDelaySeconds: readRawValue<number>(raw, locate(mapping.damageDelay.rawField), mapping.damageDelay.id, identityAssertionId, 'FloatProperty', 'number'),
          configuredAttackVariantType: readRawValue<string>(raw, locate(mapping.variantType.rawField), mapping.variantType.id, identityAssertionId, 'EnumProperty', 'string'),
          configuredVariantLoopAmount: readRawValue<number>(raw, locate(mapping.variantLoopAmount.rawField), mapping.variantLoopAmount.id, identityAssertionId, 'IntProperty', 'number'),
        }
      }),
    },
  }
}

export function readRangedConfiguredValues(
  raw: RawPackageSnapshot,
  identityAssertionId: string,
  mapping: RangedConfiguredValueMappings,
  attackDefinitionRawField: string,
): RangedConfiguredValues {
  const attack = topLevelRawNode(cdo(raw), attackDefinitionRawField)
  const parent = nestedRawNode(attack, mapping.definitions.rawField)
  const trace = projectionTrace(raw, parent, mapping.definitions.id, identityAssertionId)

  let definitions: Field<RangedConfiguredEntry[]>
  if (!parent.node) definitions = {
    state: parent.unavailable ?? 'unknown', reason: 'Raw projectile definitions missing or parent unavailable', trace,
  }
  else if (parent.node.decoding.state !== 'decoded') definitions = {
    state: parent.node.decoding.state, reason: 'Raw projectile definitions unavailable', trace,
  }
  else if (parent.node.type.value !== 'ArrayProperty' || !parent.node.decoding.elements) definitions = {
    state: 'unknown', reason: 'Expected decoded Raw array elements', trace,
  }
  else definitions = {
    state: 'known',
    trace,
    value: parent.node.decoding.elements.map((element, position) => {
      const pointer = `${parent.pointer}/decoding/elements/${position}`
      const locate = (name: string): Located => element.decoding.state === 'decoded'
        ? locateRawNode(element.properties, `${pointer}/properties`, name)
        : { pointer, unavailable: element.decoding.state }
      return {
        sourceIndex: element.index,
        count: readRawValue<number>(raw, locate(mapping.projectileCount.rawField), mapping.projectileCount.id, identityAssertionId, 'IntProperty', 'number'),
        angle: readRawValue<number>(raw, locate(mapping.angleSpan.rawField), mapping.angleSpan.id, identityAssertionId, 'FloatProperty', 'number'),
        delay: readRawValue<number>(raw, locate(mapping.delayPerProjectile.rawField), mapping.delayPerProjectile.id, identityAssertionId, 'FloatProperty', 'number'),
        delaySeconds: readRawValue<number>(raw, locate(mapping.delaySeconds.rawField), mapping.delaySeconds.id, identityAssertionId, 'FloatProperty', 'number'),
      }
    }),
  }
  return { definitions }
}
