import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import type { FormalIdentityDefinition, FormalSemanticIdentity, RawObservationEvidenceRecord } from './identityEvidence.ts'

type Provenance = { artifactPath: string; packagePath?: string; datasetId?: string; extractionRunId?: string; packageHash?: { algorithm: string; value: string } }

export function sameRawSource(a: Provenance, b: Provenance): boolean {
  return Boolean(a.artifactPath && a.packagePath && a.datasetId && a.extractionRunId && a.packageHash?.algorithm && a.packageHash.value)
    && a.artifactPath === b.artifactPath && a.packagePath === b.packagePath
    && a.datasetId === b.datasetId && a.extractionRunId === b.extractionRunId
    && a.packageHash?.algorithm === b.packageHash?.algorithm && a.packageHash?.value === b.packageHash?.value
}

export function snapshotSource(raw: RawPackageSnapshot): Provenance {
  return { artifactPath: `research/raw/packages/${raw.logicalPackage.path}.raw.json`, packagePath: raw.logicalPackage.path,
    datasetId: raw.dataset.id, extractionRunId: raw.extraction.runId, packageHash: raw.logicalPackage.contentHash }
}

/** Only the reviewed assertion, matched resolution, and its two same-source Raw observations gate a slice. */
export function matchedIdentityDomainId(raw: RawPackageSnapshot, definition: FormalIdentityDefinition,
  identity: FormalSemanticIdentity | undefined, evidence: RawObservationEvidenceRecord[] | undefined): string | undefined {
  if (!identity || !evidence || raw.schemaVersion !== definition.assertion.applicationScope.rawSchemaVersion
    || raw.logicalPackage.path !== definition.assertion.applicationScope.packagePath
    || identity.assertionId !== definition.assertion.id || identity.resolution.state !== 'matched'
    || identity.resolution.assertionId !== definition.assertion.id || identity.resolution.domainId !== definition.assertion.domainId) return undefined
  const observations = [identity.rawEvidence.itemIdName, identity.rawEvidence.serializedId]
  const fields = ['ItemIdName', 'ItemId.SerializedId'] as const
  if (observations.some((observation) => observation.state !== 'known' || observation.value !== definition.assertion.rawIdentity)) return undefined
  if (identity.resolution.evidenceRefs.length !== 2 || new Set(identity.resolution.evidenceRefs).size !== 2) return undefined
  for (let index = 0; index < 2; index += 1) {
    const observation = observations[index]!
    const matches = evidence.filter((record) => record.id === observation.evidenceRef && record.field === fields[index])
    if (matches.length !== 1 || !identity.resolution.evidenceRefs.includes(observation.evidenceRef)
      || matches[0]!.observation.state !== 'known' || matches[0]!.observation.value !== definition.assertion.rawIdentity
      || !sameRawSource(matches[0]!.provenance, snapshotSource(raw))) return undefined
  }
  return identity.resolution.domainId
}
