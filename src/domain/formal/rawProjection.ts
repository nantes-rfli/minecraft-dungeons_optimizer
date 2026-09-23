import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'

type RawObject = RawPackageSnapshot['package']['objects'][number]
type RawNode = NonNullable<RawObject['properties']>[number]

export type UnavailableState = 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted'

export type RawTrace = {
  artifactPath: string
  datasetId: string
  extractionRunId: string
  packagePath: string
  packageHash: RawPackageSnapshot['logicalPackage']['contentHash']
  nodePointer: string
}

export type Trace = {
  mappingId: string
  identityAssertionId: string
  raw: RawTrace
}

export type Field<T, TTrace = Trace> =
  | { state: 'known'; value: T; trace: TTrace }
  | { state: UnavailableState; reason: string; trace: TTrace }

export type Located = { node?: RawNode; pointer: string; unavailable?: UnavailableState }
export type RawCdoCandidate = { object: RawObject; index: number }

export function rawCdoCandidates(raw: RawPackageSnapshot): RawCdoCandidate[] {
  return raw.package.objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => object.isClassDefaultObject)
}

export function locateRawNode(nodes: readonly RawNode[] | undefined, pointer: string, name: string): Located {
  const matches = nodes
    ?.map((node, index) => ({ node, pointer: `${pointer}/${index}` }))
    .filter(({ node }) => node.name.value === name && node.arrayIndex === 0) ?? []
  return matches.length === 1 ? matches[0]! : { pointer, unavailable: 'unknown' }
}

export function topLevelRawNode(selected: RawCdoCandidate | undefined, name: string): Located {
  if (!selected) return { pointer: '/package/objects', unavailable: 'unknown' }
  const root = `/package/objects/${selected.index}`
  return selected.object.extraction.state === 'decoded'
    ? locateRawNode(selected.object.properties, `${root}/properties`, name)
    : { pointer: root, unavailable: selected.object.extraction.state }
}

export function nestedRawNode(parent: Located, name: string, expectedParentType = 'StructProperty'): Located {
  if (!parent.node) return parent
  if (parent.node.decoding.state !== 'decoded') return { pointer: parent.pointer, unavailable: parent.node.decoding.state }
  if (parent.node.type.value !== expectedParentType) return { pointer: parent.pointer, unavailable: 'unknown' }
  return locateRawNode(parent.node.decoding.properties, `${parent.pointer}/decoding/properties`, name)
}

export function rawTrace(raw: RawPackageSnapshot, pointer: string): RawTrace {
  return {
    artifactPath: `research/raw/packages/${raw.logicalPackage.path}.raw.json`,
    datasetId: raw.dataset.id,
    extractionRunId: raw.extraction.runId,
    packagePath: raw.logicalPackage.path,
    packageHash: raw.logicalPackage.contentHash,
    nodePointer: pointer,
  }
}

export function projectionTrace(raw: RawPackageSnapshot, located: Located, mappingId: string, identityAssertionId: string): Trace {
  return { mappingId, identityAssertionId, raw: rawTrace(raw, located.pointer) }
}

export function readRawValue<T extends string | number | boolean>(
  raw: RawPackageSnapshot,
  located: Located,
  mappingId: string,
  identityAssertionId: string,
  expectedType: string,
  valueType: 'string' | 'number' | 'boolean',
): Field<T> {
  const trace = projectionTrace(raw, located, mappingId, identityAssertionId)
  if (!located.node) return { state: located.unavailable ?? 'unknown', reason: 'Raw node missing, ambiguous, or parent unavailable', trace }
  if (located.node.decoding.state !== 'decoded') return { state: located.node.decoding.state, reason: 'Raw node unavailable', trace }
  const value = located.node.decoding.value
  if (located.node.type.value !== expectedType || typeof value !== valueType || (typeof value === 'number' && !Number.isFinite(value))) {
    return { state: 'unknown', reason: 'Unexpected Raw type or value', trace }
  }
  return { state: 'known', value: value as T, trace }
}
