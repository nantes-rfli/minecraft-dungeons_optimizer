import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { deathCapMushroomIdentity as assertion } from './deathCapMushroomIdentity.ts'
import {
  nestedRawNode, projectionTrace, rawCdoCandidates, rawTrace, readRawValue, topLevelRawNode,
  type Field, type Located, type RawTrace, type Trace, type UnavailableState,
} from './projectionPrimitives.ts'

export const deathCapMushroomMappings = {
  identity: {
    id: 'death-cap-mushroom:identity@1',
    rawFields: ['ItemIdName', 'ItemId.SerializedId'],
    meaning: 'Both serialized internal identifiers must exactly equal DeathCapMushroom.',
  },
  effectReference: {
    id: 'death-cap-mushroom:effect-reference@1',
    rawField: 'Effect',
    meaning: 'Explicitly validated ObjectProperty → class import → outer package import → supplied Raw snapshot chain.',
  },
} as const

type TargetRawSnapshotTrace = Omit<RawTrace, 'nodePointer'> & {
  sourceFingerprint: RawPackageSnapshot['dataset']['sourceFingerprint']
}

type EffectReferenceTrace = {
  mappingId: typeof deathCapMushroomMappings.effectReference.id
  identityAssertionId: typeof assertion.id
  objectProperty: RawTrace
  classImport: RawTrace
  outerPackageImport: RawTrace
  targetRawSnapshot: TargetRawSnapshotTrace
}

type EffectReference =
  | {
      state: 'known'
      value: {
        rawPackageIndex: number
        objectName: string
        className: string
        targetRawPackagePath: string
      }
      trace: EffectReferenceTrace
    }
  | { state: UnavailableState; reason: string; trace: Trace }

/** Pure projection from the two committed Death Cap Mushroom Raw snapshots and fixed assertions. */
export function projectDeathCapMushroom(instanceRaw: RawPackageSnapshot, effectRaw: RawPackageSnapshot) {
  if (instanceRaw.schemaVersion !== 2 || instanceRaw.logicalPackage.path !== assertion.instancePackagePath) throw new Error('Unsupported instance Raw package for Death Cap Mushroom projection')

  const candidates = rawCdoCandidates(instanceRaw)
  const selected = candidates.length === 1 ? candidates[0] : undefined
  const top = (name: string): Located => topLevelRawNode(selected, name)
  const trace = (located: Located, mappingId: string): Trace => projectionTrace(instanceRaw, located, mappingId, assertion.id)
  const readIdentity = (located: Located): Field<string> => readRawValue<string>(instanceRaw, located, deathCapMushroomMappings.identity.id, assertion.id, 'NameProperty', 'string')

  const itemName = readIdentity(top('ItemIdName'))
  const serializedId = readIdentity(nestedRawNode(top('ItemId'), 'SerializedId'))
  const identityResolved = [itemName, serializedId].every((field) => field.state === 'known' && field.value === assertion.rawIdentity)

  function resolveEffectReference(located: Located): EffectReference {
    const fallbackTrace = trace(located, deathCapMushroomMappings.effectReference.id)
    if (!located.node) return { state: located.unavailable ?? 'unknown', reason: 'Effect ObjectProperty missing, ambiguous, or parent unavailable', trace: fallbackTrace }
    if (located.node.decoding.state !== 'decoded') return { state: located.node.decoding.state, reason: 'Effect ObjectProperty unavailable', trace: fallbackTrace }
    const value = located.node.decoding.value
    if (located.node.type.value !== 'ObjectProperty' || !value || typeof value !== 'object' || Array.isArray(value)) return { state: 'unknown', reason: 'Effect is not a decoded ObjectProperty reference', trace: fallbackTrace }
    const reference = value as Record<string, unknown>
    if (reference.kind !== 'import' || typeof reference.rawPackageIndex !== 'number' || typeof reference.index !== 'number' || typeof reference.objectName !== 'string' || typeof reference.className !== 'string') return { state: 'unknown', reason: 'Effect ObjectProperty is not an import reference', trace: fallbackTrace }

    const classMatches = instanceRaw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === reference.rawPackageIndex && entry.index === reference.index)
    if (classMatches.length !== 1) return { state: 'unknown', reason: 'Effect class import is missing or ambiguous', trace: fallbackTrace }
    const classImport = classMatches[0]!
    const outerMatches = instanceRaw.package.imports.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.rawPackageIndex === classImport.entry.outerIndex)
    if (outerMatches.length !== 1) return { state: 'unknown', reason: 'Effect outer package import is missing or ambiguous', trace: fallbackTrace }
    const outer = outerMatches[0]!
    const sameDataset = instanceRaw.dataset.id === effectRaw.dataset.id
      && instanceRaw.dataset.sourceFingerprint.algorithm === effectRaw.dataset.sourceFingerprint.algorithm
      && instanceRaw.dataset.sourceFingerprint.value === effectRaw.dataset.sourceFingerprint.value
    const validKnownChain = reference.objectName === assertion.effectObjectName
      && reference.className === assertion.effectClassName
      && classImport.entry.objectName.value === assertion.effectObjectName
      && classImport.entry.className.value === assertion.effectClassName
      && classImport.entry.outerIndex === outer.entry.rawPackageIndex
      && outer.entry.className.value === 'Package'
      && outer.entry.objectName.value === assertion.effectGamePackagePath
      && outer.entry.outerIndex === 0
      && outer.entry.outerReference.rawPackageIndex === 0
      && effectRaw.schemaVersion === 2
      && effectRaw.logicalPackage.path === assertion.effectPackagePath
      && sameDataset
    if (!validKnownChain) return { state: 'unknown', reason: 'Effect import chain does not match the supplied known Raw snapshot', trace: fallbackTrace }

    const target = rawTrace(effectRaw, '')
    return {
      state: 'known',
      value: {
        rawPackageIndex: reference.rawPackageIndex,
        objectName: reference.objectName,
        className: reference.className,
        targetRawPackagePath: effectRaw.logicalPackage.path,
      },
      trace: {
        mappingId: deathCapMushroomMappings.effectReference.id,
        identityAssertionId: assertion.id,
        objectProperty: rawTrace(instanceRaw, located.pointer),
        classImport: rawTrace(instanceRaw, `/package/imports/${classImport.index}`),
        outerPackageImport: rawTrace(instanceRaw, `/package/imports/${outer.index}`),
        targetRawSnapshot: {
          artifactPath: target.artifactPath,
          datasetId: target.datasetId,
          sourceFingerprint: effectRaw.dataset.sourceFingerprint,
          extractionRunId: target.extractionRunId,
          packagePath: target.packagePath,
          packageHash: target.packageHash,
        },
      },
    }
  }

  return {
    kind: 'temporary-death-cap-mushroom-projection' as const,
    identity: {
      status: identityResolved ? assertion.status : 'unresolved' as const,
      ...(identityResolved ? { confidence: assertion.confidence, domainId: assertion.domainId, displayName: assertion.displayName } : {}),
      assertionId: assertion.id,
      evidence: { itemName, serializedId },
    },
    effectReference: resolveEffectReference(top(deathCapMushroomMappings.effectReference.rawField)),
    unresolved: ['gameplay-effect-semantics'] as const,
  }
}
