import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { battleRobeIdentity as assertion } from './battleRobeIdentity.ts'
import {
  nestedRawNode, projectionTrace, rawCdoCandidates, rawTrace, readRawValue, topLevelRawNode,
  type Field, type Located, type RawTrace, type Trace, type UnavailableState,
} from './projectionPrimitives.ts'

export const battleRobeMappings = {
  identity: {
    id: 'battle-robe:identity@1',
    rawFields: ['ItemIdName', 'ItemId.SerializedId'],
    meaning: 'Internal identifiers support only the provisional Battle Robe identity assertion.',
  },
  gearActorReference: {
    id: 'battle-robe:gear-actor-reference@1',
    rawField: 'GearActor',
    meaning: 'Serialized ObjectProperty → class import → outer package import chain; the target package contents are not resolved.',
  },
} as const

type GearActorReferenceTrace = {
  mappingId: typeof battleRobeMappings.gearActorReference.id
  identityAssertionId: typeof assertion.id
  objectProperty: RawTrace
  classImport: RawTrace
  outerPackageImport: RawTrace
}

type GearActorReference =
  | {
      state: 'known'
      value: {
        rawPackageIndex: number
        objectName: string
        className: string
        gamePackagePath: string
      }
      trace: GearActorReferenceTrace
    }
  | { state: UnavailableState; reason: string; trace: Trace }

/** Pure projection from the committed Battle Robe Instance Raw snapshot and fixed assertions. */
export function projectBattleRobe(raw: RawPackageSnapshot) {
  if (raw.schemaVersion !== 2 || raw.logicalPackage.path !== assertion.packagePath) throw new Error('Unsupported Raw package for Battle Robe projection')
  const candidates = rawCdoCandidates(raw)
  if (candidates.length !== 1) throw new Error('Expected one unambiguous Raw CDO')
  const selected = candidates[0]!
  const top = (name: string): Located => topLevelRawNode(selected, name)
  const trace = (located: Located, mappingId: string): Trace => projectionTrace(raw, located, mappingId, assertion.id)
  const read = (located: Located): Field<string> => readRawValue<string>(raw, located, battleRobeMappings.identity.id, assertion.id, 'NameProperty', 'string')

  const itemName = read(top('ItemIdName'))
  const serializedId = read(nestedRawNode(top('ItemId'), 'SerializedId'))
  const identityResolved = [itemName, serializedId].every((field) => field.state === 'known' && field.value === assertion.rawIdentity)

  function resolveGearActorReference(located: Located): GearActorReference {
    const fallbackTrace = trace(located, battleRobeMappings.gearActorReference.id)
    if (!located.node) return { state: located.unavailable ?? 'unknown', reason: 'GearActor ObjectProperty missing, ambiguous, or parent unavailable', trace: fallbackTrace }
    if (located.node.decoding.state !== 'decoded') return { state: located.node.decoding.state, reason: 'GearActor ObjectProperty unavailable', trace: fallbackTrace }
    const value = located.node.decoding.value
    if (located.node.type.value !== 'ObjectProperty' || !value || typeof value !== 'object' || Array.isArray(value)) return { state: 'unknown', reason: 'GearActor is not a decoded ObjectProperty reference', trace: fallbackTrace }
    const reference = value as Record<string, unknown>
    if (reference.kind !== 'import' || typeof reference.rawPackageIndex !== 'number' || typeof reference.index !== 'number' || typeof reference.objectName !== 'string' || typeof reference.className !== 'string') return { state: 'unknown', reason: 'GearActor ObjectProperty is not an import reference', trace: fallbackTrace }

    const classMatches = raw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === reference.rawPackageIndex && entry.index === reference.index)
    if (classMatches.length !== 1) return { state: 'unknown', reason: 'GearActor class import is missing or ambiguous', trace: fallbackTrace }
    const classImport = classMatches[0]!
    const outerMatches = raw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === classImport.entry.outerIndex)
    if (outerMatches.length !== 1) return { state: 'unknown', reason: 'GearActor outer package import is missing or ambiguous', trace: fallbackTrace }
    const outer = outerMatches[0]!
    const validKnownChain = reference.objectName === assertion.gearActorObjectName
      && reference.className === assertion.gearActorClassName
      && classImport.entry.objectName.value === assertion.gearActorObjectName
      && classImport.entry.className.value === assertion.gearActorClassName
      && classImport.entry.outerIndex === outer.entry.rawPackageIndex
      && outer.entry.className.value === 'Package'
      && outer.entry.objectName.value === assertion.gearActorGamePackagePath
      && outer.entry.outerIndex === 0
      && outer.entry.outerReference.rawPackageIndex === 0
    if (!validKnownChain) return { state: 'unknown', reason: 'GearActor import chain does not match the fixed Battle Robe assertion', trace: fallbackTrace }

    return {
      state: 'known',
      value: {
        rawPackageIndex: reference.rawPackageIndex,
        objectName: reference.objectName,
        className: reference.className,
        gamePackagePath: outer.entry.objectName.value,
      },
      trace: {
        mappingId: battleRobeMappings.gearActorReference.id,
        identityAssertionId: assertion.id,
        objectProperty: rawTrace(raw, located.pointer),
        classImport: rawTrace(raw, `/package/imports/${classImport.index}`),
        outerPackageImport: rawTrace(raw, `/package/imports/${outer.index}`),
      },
    }
  }

  return {
    kind: 'temporary-battle-robe-projection' as const,
    identity: {
      status: identityResolved ? assertion.status : 'unresolved' as const,
      ...(identityResolved ? { domainId: assertion.domainId, displayName: assertion.displayName } : {}),
      assertionId: assertion.id,
      evidence: { itemName, serializedId },
    },
    gearActorReference: resolveGearActorReference(top(battleRobeMappings.gearActorReference.rawField)),
    unresolved: ['armor-property-ownership'] as const,
  }
}
