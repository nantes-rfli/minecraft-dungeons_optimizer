import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'

export type EvidenceRef = string
export type AssertionReviewState = 'accepted' | 'provisional'

export type IdentityAssertion = {
  id: string
  rawIdentity: string
  domainId: string
  reviewState: AssertionReviewState
  confidence?: 'high'
  applicationScope: {
    rawSchemaVersion: number
    packagePath: string
    requireUnambiguousCdo: true
    identityFields: {
      itemIdName: 'ItemIdName'
      serializedId: 'ItemId.SerializedId'
    }
  }
  evidenceRefs: EvidenceRef[]
}

type RawIdentityObservationValue = { state: 'known'; value: string } | { state: 'unavailable' }
export type RawIdentityObservation = RawIdentityObservationValue & { evidenceRef: EvidenceRef }

export type IdentityResolution =
  | { state: 'matched'; assertionId: string; domainId: string; evidenceRefs: EvidenceRef[] }
  | { state: 'unresolved'; assertionId: string; evidenceRefs: EvidenceRef[] }

export type IdentityPresentation = {
  domainId: string
  displayName: string
  evidenceRefs: EvidenceRef[]
}

export type RawEvidenceProvenance = {
  artifactPath: string
  datasetId?: string
  extractionRunId?: string
  packagePath?: string
  packageHash?: RawPackageSnapshot['logicalPackage']['contentHash']
  nodePointer: string
}

type EvidenceBase = {
  id: EvidenceRef
  fingerprint: string
}

export type ReviewedEvidenceRecord = EvidenceBase & {
  kind: 'reviewed'
  role: 'support' | 'limitation' | 'conflict'
  detail: string
  source: { artifactPath: string; locator: string; revision?: string }
}

export type RawObservationEvidenceRecord = EvidenceBase & {
  kind: 'raw-observation'
  field: 'ItemIdName' | 'ItemId.SerializedId'
  observation: RawIdentityObservationValue
  unavailableReason?: 'unsupported-schema' | 'unexpected-package' | 'ambiguous-cdo' | 'missing-cdo' | 'parent-unavailable' | 'missing-or-ambiguous-field' | 'wrong-type'
  provenance: RawEvidenceProvenance
}

export type EvidenceRecord = ReviewedEvidenceRecord | RawObservationEvidenceRecord

export type FormalSemanticIdentity = {
  assertionId: string
  rawEvidence: {
    itemIdName: RawIdentityObservation
    serializedId: RawIdentityObservation
  }
  resolution: IdentityResolution
  presentation?: IdentityPresentation
}

export type FormalIdentityEvidenceArtifact = {
  schemaVersion: 1
  artifactKind: 'formal-domain-identity-evidence'
  semantic: { identities: FormalSemanticIdentity[] }
  identityAssertions: IdentityAssertion[]
  provenance: { evidence: EvidenceRecord[] }
}

export type ReviewedEvidenceInput = Omit<ReviewedEvidenceRecord, 'fingerprint'>

export type FormalIdentityDefinition = {
  assertion: IdentityAssertion
  presentation: IdentityPresentation
  reviewedEvidence: ReviewedEvidenceInput[]
}

export type FormalIdentityObservationFieldInput = {
  observation: RawIdentityObservationValue
  unavailableReason?: RawObservationEvidenceRecord['unavailableReason']
  provenance: RawEvidenceProvenance
}

export type FormalIdentityObservationInput = {
  rawSchemaVersion: number
  packagePath: string
  itemIdName: FormalIdentityObservationFieldInput
  serializedId: FormalIdentityObservationFieldInput
}

export type FormalIdentityProjectionInput =
  | { raw: RawPackageSnapshot; definition: FormalIdentityDefinition; observation?: never }
  | { observation: FormalIdentityObservationInput; definition: FormalIdentityDefinition; raw?: never }

type JsonRecord = Record<string, unknown>
type RawNode = NonNullable<RawPackageSnapshot['package']['objects'][number]['properties']>[number]
const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

/** A drift tripwire, not a security primitive. It makes an evidence ID's content replacement explicit. */
export function evidenceFingerprint(record: unknown): string {
  let hash = 0x811c9dc5
  const text = canonicalJson(record)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`
}

export function sealEvidence<T extends Omit<EvidenceRecord, 'fingerprint'>>(record: T): T & { fingerprint: string } {
  return { ...record, fingerprint: evidenceFingerprint(record) }
}

function rawProvenance(raw: unknown, nodePointer: string): RawEvidenceProvenance {
  const candidate = raw as Partial<RawPackageSnapshot>
  const logicalPackage = isRecord(candidate.logicalPackage) ? candidate.logicalPackage : undefined
  const dataset = isRecord(candidate.dataset) ? candidate.dataset : undefined
  const extraction = isRecord(candidate.extraction) ? candidate.extraction : undefined
  return {
    artifactPath: typeof logicalPackage?.path === 'string' ? `research/raw/packages/${logicalPackage.path}.raw.json` : 'supplied-raw-snapshot',
    ...(typeof dataset?.id === 'string' ? { datasetId: dataset.id } : {}),
    ...(typeof extraction?.runId === 'string' ? { extractionRunId: extraction.runId } : {}),
    ...(typeof logicalPackage?.path === 'string' ? { packagePath: logicalPackage.path } : {}),
    ...(isRecord(logicalPackage?.contentHash) ? { packageHash: { ...(logicalPackage.contentHash as RawPackageSnapshot['logicalPackage']['contentHash']) } } : {}),
    nodePointer,
  }
}

type LocatedIdentityField = {
  pointer: string
  node?: RawNode
  reason?: RawObservationEvidenceRecord['unavailableReason']
}

function exactField(nodes: RawPackageSnapshot['package']['objects'][number]['properties'], parentPointer: string, name: string): LocatedIdentityField {
  const matches = nodes?.map((node, index) => ({ node, pointer: `${parentPointer}/${index}` }))
    .filter(({ node }) => node.name.value === name && node.arrayIndex === 0) ?? []
  return matches.length === 1 ? matches[0]! : { pointer: parentPointer, reason: 'missing-or-ambiguous-field' }
}

function observeField(
  raw: RawPackageSnapshot,
  assertion: IdentityAssertion,
  field: 'ItemIdName' | 'ItemId.SerializedId',
  located: LocatedIdentityField,
): { observation: RawIdentityObservation; evidence: RawObservationEvidenceRecord } {
  const id = `evidence:raw:${assertion.id}:${field}`
  const node = located.node
  let observation: RawIdentityObservationValue
  let unavailableReason = located.reason
  if (!node || unavailableReason) observation = { state: 'unavailable' }
  else if (node.decoding.state !== 'decoded') {
    observation = { state: 'unavailable' }
    unavailableReason = 'parent-unavailable'
  } else if (node.type.value !== 'NameProperty' || typeof node.decoding.value !== 'string') {
    observation = { state: 'unavailable' }
    unavailableReason = 'wrong-type'
  } else observation = { state: 'known', value: node.decoding.value }
  const evidence = sealEvidence({
    id,
    kind: 'raw-observation' as const,
    field,
    observation,
    ...(unavailableReason ? { unavailableReason } : {}),
    provenance: rawProvenance(raw, located.pointer),
  })
  return { observation: { ...observation, evidenceRef: id } as RawIdentityObservation, evidence }
}

/** Applies only the fixed v1 ItemIdName + ItemId.SerializedId identity contract. */
export function projectFormalIdentity(rawInput: RawPackageSnapshot, definition: FormalIdentityDefinition): {
  semantic: FormalSemanticIdentity
  evidence: EvidenceRecord[]
} {
  const { assertion } = definition
  const reviewedEvidence = definition.reviewedEvidence.map(sealEvidence)
  const raw = rawInput as RawPackageSnapshot
  let itemLocated: LocatedIdentityField
  let serializedLocated: LocatedIdentityField

  if ((raw as { schemaVersion?: number }).schemaVersion !== assertion.applicationScope.rawSchemaVersion) {
    itemLocated = { pointer: '', reason: 'unsupported-schema' }
    serializedLocated = { pointer: '', reason: 'unsupported-schema' }
  } else if (raw.logicalPackage.path !== assertion.applicationScope.packagePath) {
    itemLocated = { pointer: '', reason: 'unexpected-package' }
    serializedLocated = { pointer: '', reason: 'unexpected-package' }
  } else {
    const candidates = raw.package.objects.map((object, index) => ({ object, index })).filter(({ object }) => object.isClassDefaultObject)
    if (candidates.length !== 1) {
      const reason = candidates.length === 0 ? 'missing-cdo' : 'ambiguous-cdo'
      itemLocated = { pointer: '/package/objects', reason }
      serializedLocated = { pointer: '/package/objects', reason }
    } else {
      const candidate = candidates[0]!
      const root = `/package/objects/${candidate.index}`
      if (candidate.object.extraction.state !== 'decoded') {
        itemLocated = { pointer: root, reason: 'parent-unavailable' }
        serializedLocated = { pointer: root, reason: 'parent-unavailable' }
      } else {
        itemLocated = exactField(candidate.object.properties, `${root}/properties`, assertion.applicationScope.identityFields.itemIdName)
        const itemId = exactField(candidate.object.properties, `${root}/properties`, 'ItemId')
        if (!itemId.node || itemId.reason) serializedLocated = { pointer: itemId.pointer, reason: itemId.reason }
        else if (itemId.node.decoding.state !== 'decoded' || itemId.node.type.value !== 'StructProperty') serializedLocated = { pointer: itemId.pointer, reason: itemId.node.decoding.state === 'decoded' ? 'wrong-type' : 'parent-unavailable' }
        else serializedLocated = exactField(itemId.node.decoding.properties, `${itemId.pointer}/decoding/properties`, 'SerializedId')
      }
    }
  }

  const itemIdName = observeField(raw, assertion, 'ItemIdName', itemLocated)
  const serializedId = observeField(raw, assertion, 'ItemId.SerializedId', serializedLocated)
  const evidenceRefs = [itemIdName.observation.evidenceRef, serializedId.observation.evidenceRef]
  const matched = itemIdName.observation.state === 'known'
    && serializedId.observation.state === 'known'
    && itemIdName.observation.value === assertion.rawIdentity
    && serializedId.observation.value === assertion.rawIdentity
  const resolution: IdentityResolution = matched
    ? { state: 'matched', assertionId: assertion.id, domainId: assertion.domainId, evidenceRefs }
    : { state: 'unresolved', assertionId: assertion.id, evidenceRefs }
  return {
    semantic: {
      assertionId: assertion.id,
      rawEvidence: { itemIdName: itemIdName.observation, serializedId: serializedId.observation },
      resolution,
      ...(matched ? { presentation: definition.presentation } : {}),
    },
    evidence: [...reviewedEvidence, itemIdName.evidence, serializedId.evidence],
  }
}


function projectObservationField(
  assertion: IdentityAssertion,
  field: 'ItemIdName' | 'ItemId.SerializedId',
  input: FormalIdentityObservationFieldInput,
  forcedReason?: RawObservationEvidenceRecord['unavailableReason'],
): { observation: RawIdentityObservation; evidence: RawObservationEvidenceRecord } {
  const id = `evidence:raw:${assertion.id}:${field}`
  const observation: RawIdentityObservationValue = forcedReason ? { state: 'unavailable' } : input.observation
  const unavailableReason = forcedReason ?? input.unavailableReason
  const evidence = sealEvidence({
    id,
    kind: 'raw-observation' as const,
    field,
    observation,
    ...(unavailableReason ? { unavailableReason } : {}),
    provenance: input.provenance,
  })
  return { observation: { ...observation, evidenceRef: id } as RawIdentityObservation, evidence }
}

/** Projects the same v1 identity contract from source-backed observations such as Raw Structural Inventory shards. */
export function projectFormalIdentityObservation(input: FormalIdentityObservationInput, definition: FormalIdentityDefinition): {
  semantic: FormalSemanticIdentity
  evidence: EvidenceRecord[]
} {
  const { assertion } = definition
  const forcedReason = input.rawSchemaVersion !== assertion.applicationScope.rawSchemaVersion
    ? 'unsupported-schema' as const
    : input.packagePath !== assertion.applicationScope.packagePath
      ? 'unexpected-package' as const
      : undefined
  const itemIdName = projectObservationField(assertion, 'ItemIdName', input.itemIdName, forcedReason)
  const serializedId = projectObservationField(assertion, 'ItemId.SerializedId', input.serializedId, forcedReason)
  const evidenceRefs = [itemIdName.observation.evidenceRef, serializedId.observation.evidenceRef]
  const matched = itemIdName.observation.state === 'known'
    && serializedId.observation.state === 'known'
    && itemIdName.observation.value === assertion.rawIdentity
    && serializedId.observation.value === assertion.rawIdentity
  const resolution: IdentityResolution = matched
    ? { state: 'matched', assertionId: assertion.id, domainId: assertion.domainId, evidenceRefs }
    : { state: 'unresolved', assertionId: assertion.id, evidenceRefs }
  return {
    semantic: {
      assertionId: assertion.id,
      rawEvidence: { itemIdName: itemIdName.observation, serializedId: serializedId.observation },
      resolution,
      ...(matched ? { presentation: definition.presentation } : {}),
    },
    evidence: [...definition.reviewedEvidence.map(sealEvidence), itemIdName.evidence, serializedId.evidence],
  }
}

export function buildFormalIdentityEvidenceArtifact(
  inputs: readonly FormalIdentityProjectionInput[],
): FormalIdentityEvidenceArtifact {
  const projected = inputs.map((input) => 'raw' in input && input.raw
    ? projectFormalIdentity(input.raw, input.definition)
    : projectFormalIdentityObservation(input.observation, input.definition))
  return {
    schemaVersion: 1,
    artifactKind: 'formal-domain-identity-evidence',
    semantic: { identities: projected.map(({ semantic }) => semantic) },
    identityAssertions: inputs.map(({ definition }) => definition.assertion),
    provenance: { evidence: projected.flatMap(({ evidence }) => evidence) },
  }
}

export function collectFormalIdentityEvidenceErrors(value: FormalIdentityEvidenceArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.artifactKind === 'formal-domain-identity-evidence', 'invalid Formal artifact header')
  const evidence = new Map<string, EvidenceRecord>()
  for (const record of value.provenance.evidence) {
    check(!evidence.has(record.id), `duplicate evidence ID: ${record.id}`)
    if (!evidence.has(record.id)) evidence.set(record.id, record)
    const content: Record<string, unknown> = { ...record }
    delete content.fingerprint
    check(record.fingerprint === evidenceFingerprint(content), `evidence ID content replaced without fingerprint update: ${record.id}`)
  }
  const assertions = new Map<string, IdentityAssertion>()
  for (const assertion of value.identityAssertions) {
    check(!assertions.has(assertion.id), `duplicate assertion ID: ${assertion.id}`)
    assertions.set(assertion.id, assertion)
    check(assertion.confidence === undefined || assertion.confidence === 'high', `${assertion.id}: invalid confidence taxonomy`)
    for (const ref of assertion.evidenceRefs) check(evidence.get(ref)?.kind === 'reviewed', `${assertion.id}: dangling or non-reviewed assertion EvidenceRef ${ref}`)
  }
  for (const semantic of value.semantic.identities) {
    const assertion = assertions.get(semantic.assertionId)
    check(Boolean(assertion), `${semantic.assertionId}: semantic identity has no assertion`)
    for (const observation of Object.values(semantic.rawEvidence)) {
      const record = evidence.get(observation.evidenceRef)
      check(record?.kind === 'raw-observation', `${semantic.assertionId}: raw observation EvidenceRef does not resolve to Raw evidence`)
      if (record?.kind === 'raw-observation') {
        const semanticObservation: RawIdentityObservationValue = observation.state === 'known'
          ? { state: 'known', value: observation.value }
          : { state: 'unavailable' }
        check(canonicalJson(record.observation) === canonicalJson(semanticObservation), `${semantic.assertionId}: semantic Raw observation differs from provenance`)
      }
    }
    for (const ref of semantic.resolution.evidenceRefs) check(evidence.get(ref)?.kind === 'raw-observation', `${semantic.assertionId}: resolution EvidenceRef is not Raw observation evidence: ${ref}`)
    check(semantic.resolution.evidenceRefs.length === 2 && new Set(semantic.resolution.evidenceRefs).size === 2, `${semantic.assertionId}: resolution must cite both Raw observations`)
    const rawRefs = Object.values(semantic.rawEvidence).map((observation) => observation.evidenceRef).sort()
    check(canonicalJson([...semantic.resolution.evidenceRefs].sort()) === canonicalJson(rawRefs), `${semantic.assertionId}: resolution does not cite the actual semantic Raw observations`)
    check(!semantic.resolution.evidenceRefs.some((ref) => assertion?.evidenceRefs.includes(ref)), `${semantic.assertionId}: assertion and resolution evidence must remain separate`)
    const observationsMatch = Boolean(assertion)
      && semantic.rawEvidence.itemIdName.state === 'known'
      && semantic.rawEvidence.serializedId.state === 'known'
      && semantic.rawEvidence.itemIdName.value === assertion?.rawIdentity
      && semantic.rawEvidence.serializedId.value === assertion?.rawIdentity
    check((semantic.resolution.state === 'matched') === observationsMatch, `${semantic.assertionId}: resolution state differs from exact Raw identity observations`)
    if (semantic.resolution.state === 'matched') {
      check(semantic.resolution.domainId === assertion?.domainId, `${semantic.assertionId}: matched domainId differs from assertion`)
      check(semantic.presentation?.domainId === semantic.resolution.domainId, `${semantic.assertionId}: matched presentation domainId differs from resolution`)
      check((semantic.presentation?.evidenceRefs.length ?? 0) > 0, `${semantic.assertionId}: matched presentation has no evidence`)
      for (const ref of semantic.presentation?.evidenceRefs ?? []) check(evidence.get(ref)?.kind === 'reviewed', `${semantic.assertionId}: dangling or non-reviewed presentation EvidenceRef ${ref}`)
    } else check(semantic.presentation === undefined, `${semantic.assertionId}: unresolved identity exposes presentation`)
  }
  return errors
}

export function applicationIdentity(semantic: FormalSemanticIdentity):
  | { state: 'matched'; domainId: string; displayName: string }
  | { state: 'unresolved' } {
  if (semantic.resolution.state !== 'matched') return { state: 'unresolved' }
  if (!semantic.presentation || semantic.presentation.domainId !== semantic.resolution.domainId) throw new Error('Matched Formal identity lacks a consistent presentation')
  return { state: 'matched', domainId: semantic.resolution.domainId, displayName: semantic.presentation.displayName }
}
