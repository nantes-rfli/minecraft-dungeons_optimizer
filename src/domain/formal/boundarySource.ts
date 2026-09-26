import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import type { FormalIdentityDefinition, FormalSemanticIdentity, RawObservationEvidenceRecord } from './identityEvidence.ts'

export type RawSourceProvenance = {
  artifactPath: string
  packagePath?: string
  datasetId?: string
  extractionRunId?: string
  packageHash?: { algorithm: string; value: string }
}

export function sameRawSource(a: RawSourceProvenance, b: RawSourceProvenance): boolean {
  return Boolean(a.artifactPath && a.packagePath && a.datasetId && a.extractionRunId && a.packageHash?.algorithm && a.packageHash.value)
    && a.artifactPath === b.artifactPath && a.packagePath === b.packagePath
    && a.datasetId === b.datasetId && a.extractionRunId === b.extractionRunId
    && a.packageHash?.algorithm === b.packageHash?.algorithm && a.packageHash?.value === b.packageHash?.value
}

/** Full snapshot and Structural shard can have separate extraction runs for identical package content. */
export function sameLogicalRawPackage(a: RawSourceProvenance, b: RawSourceProvenance): boolean {
  return Boolean(a.packagePath && a.datasetId && a.packageHash?.algorithm && a.packageHash.value)
    && a.packagePath === b.packagePath && a.datasetId === b.datasetId
    && a.packageHash?.algorithm === b.packageHash?.algorithm && a.packageHash?.value === b.packageHash?.value
}

export function snapshotSource(raw: RawPackageSnapshot): RawSourceProvenance {
  return { artifactPath: `research/raw/packages/${raw.logicalPackage.path}.raw.json`, packagePath: raw.logicalPackage.path,
    datasetId: raw.dataset.id, extractionRunId: raw.extraction.runId, packageHash: raw.logicalPackage.contentHash }
}

/** Applies the matched Formal Identity gate to an exact source provenance without assuming a RawPackageSnapshot representation. */
export function matchedIdentityDomainIdFromSource(source: RawSourceProvenance, definition: FormalIdentityDefinition,
  identity: FormalSemanticIdentity | undefined, evidence: RawObservationEvidenceRecord[] | undefined): string | undefined {
  if (!identity || !evidence || source.packagePath !== definition.assertion.applicationScope.packagePath
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
      || !sameRawSource(matches[0]!.provenance, source)) return undefined
  }
  return identity.resolution.domainId
}

/** Only the reviewed assertion, matched resolution, and its two same-source Raw observations gate a slice. */
export function matchedIdentityDomainId(raw: RawPackageSnapshot, definition: FormalIdentityDefinition,
  identity: FormalSemanticIdentity | undefined, evidence: RawObservationEvidenceRecord[] | undefined): string | undefined {
  if (raw.schemaVersion !== definition.assertion.applicationScope.rawSchemaVersion
    || raw.logicalPackage.path !== definition.assertion.applicationScope.packagePath) return undefined
  return matchedIdentityDomainIdFromSource(snapshotSource(raw), definition, identity, evidence)
}
