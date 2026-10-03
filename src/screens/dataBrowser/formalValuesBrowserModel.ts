import identityJson from '../../../research/domain/formal/identity-evidence-v1.json'
import valueJson from '../../../research/domain/formal/value-availability-v2.json'
import { collectFormalIdentityEvidenceErrors, type FormalIdentityEvidenceArtifact } from '../../domain/formal/identityEvidence'
import { collectFormalValueAvailabilityErrors, collectSemanticOccurrences, type FormalValueAvailabilityArtifact, type ValueEvidenceRecord, type ValueOccurrence } from '../../domain/formal/valueAvailability'

export type FormalBrowserRow = {
  projectionRef: string
  mappingId: string
  occurrence: ValueOccurrence
  relationProjectionRef?: string
  evidence: ValueEvidenceRecord[]
} & ({ state: 'known'; value: unknown } | { state: 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted' | 'dependency'; reason: string })

export type FormalValuesBrowserModel = {
  domainId: string
  identityStatus: 'accepted' | 'provisional'
  rows: FormalBrowserRow[]
}

/** Read only audited Domain artifacts; never re-extract Raw or infer effective behavior. */
export function createFormalValuesBrowserIndex(
  identity: FormalIdentityEvidenceArtifact,
  values: FormalValueAvailabilityArtifact,
): ReadonlyMap<string, FormalValuesBrowserModel> {
  // A malformed bundle must not expose partially trusted numbers.
  const errors = [...collectFormalIdentityEvidenceErrors(identity), ...collectFormalValueAvailabilityErrors(values)]
  if (errors.length) throw new Error(`Invalid Formal browser bundle: ${errors.join('; ')}`)
  const occurrences = new Map(collectSemanticOccurrences(values.semantic).map((entry) => [entry.value.projectionRef, entry.value]))
  const evidence = new Map(values.provenance.evidence.map((entry) => [entry.id, entry]))
  const index = new Map<string, FormalValuesBrowserModel>()
  for (const category of Object.values(values.semantic)) {
    for (const domainId of Object.keys(category)) {
      const identities = identity.semantic.identities.filter((entry) => entry.resolution.state === 'matched' && entry.resolution.domainId === domainId)
      if (identities.length !== 1) throw new Error(`Formal browser requires one matched identity: ${domainId}`)
      const assertion = identity.identityAssertions.find((entry) => entry.id === identities[0]!.assertionId)!
      const records = values.valueProjections.filter((entry) => entry.occurrence.domainId === domainId)
      const rows: FormalBrowserRow[] = records.map((record) => {
        const trace = {
          projectionRef: record.projectionId,
          mappingId: record.mappingId,
          occurrence: record.occurrence,
          relationProjectionRef: record.relationProjectionRef,
          evidence: (record.evidenceRefs ?? []).map((ref) => evidence.get(ref)!),
        }
        if (record.result === 'unavailable') return {
          ...trace,
          state: record.failureKind === 'dependency' ? 'dependency' : record.sourceState,
          reason: record.reason,
        }
        return { ...trace, state: 'known', value: occurrences.get(record.projectionId)!.value }
      })
      index.set(domainId, { domainId, identityStatus: assertion.reviewState, rows })
    }
  }
  return index
}

export const formalValuesBrowserIndex = createFormalValuesBrowserIndex(
  identityJson as FormalIdentityEvidenceArtifact,
  valueJson as unknown as FormalValueAvailabilityArtifact,
)
