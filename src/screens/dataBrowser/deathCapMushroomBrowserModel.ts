import identityArtifact from '../../../research/domain/formal/identity-evidence-v1.json'
import relationArtifact from '../../../research/domain/formal/serialized-relation-v1.json'

type Hash = {
  algorithm: string
  value: string
}

type Provenance = {
  artifactPath: string
  packagePath: string
  datasetId: string
  extractionRunId: string
  packageHash: Hash
  nodePointer?: string
  sourceFingerprint?: Hash
}

export type DeathCapMushroomBrowserField<T> = {
  value: T
  rawProperty: string
  provenance: Provenance
}

export type DeathCapMushroomRelationTraceStep = {
  label: 'ObjectProperty' | 'class import' | 'outer package import' | 'target Raw snapshot'
  provenance: Provenance
}

type ClassImportObserved = {
  className?: { value?: string }
}

type TargetSnapshotObserved = {
  dataset?: { sourceFingerprint?: Hash }
}

const assertionId = 'identity:death-cap-mushroom@1'
const relationRef = 'relation:death-cap-mushroom:effect@1'

const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === assertionId)
const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === assertionId)

if (!identity || identity.resolution.state !== 'matched' || !identity.resolution.domainId || !identity.presentation || !assertion) {
  throw new Error('Death Cap Mushroom matched Formal identity is unavailable')
}

function identityField(field: { value: string; evidenceRef: string }, rawProperty: string): DeathCapMushroomBrowserField<string> {
  const evidence = identityArtifact.provenance.evidence.find((entry) => entry.id === field.evidenceRef)
  if (!evidence || !('provenance' in evidence) || !evidence.provenance) {
    throw new Error(`Formal identity evidence missing: ${field.evidenceRef}`)
  }
  return { value: field.value, rawProperty, provenance: evidence.provenance }
}

const relation = relationArtifact.semantic.relations.find((entry) => entry.relationRef === relationRef)
const relationProjection = relationArtifact.relationProjections.find((entry) => entry.relationRef === relationRef)

if (!relation || !relationProjection || relationProjection.result !== 'projected') {
  throw new Error('Death Cap Mushroom Formal Effect relation is unavailable')
}

const relationEvidence = relation.evidenceRefs.map((evidenceRef) => {
  const evidence = relationArtifact.provenance.evidence.find((entry) => entry.id === evidenceRef)
  if (!evidence) throw new Error(`Formal relation evidence missing: ${evidenceRef}`)
  return evidence
})

if (relationEvidence.length !== 3) {
  throw new Error('Death Cap Mushroom Formal Effect relation provenance is incomplete')
}

const objectPropertyEvidence = relationEvidence[0]
const classImportEvidence = relationEvidence[1]
const outerPackageEvidence = relationEvidence[2]

if (!objectPropertyEvidence || !classImportEvidence || !outerPackageEvidence) {
  throw new Error('Death Cap Mushroom Formal Effect relation provenance is incomplete')
}

const className = (classImportEvidence.observed as ClassImportObserved).className?.value
if (!className) throw new Error('Death Cap Mushroom Formal class import display value is unavailable')

const targetResolution = relationProjection.targetResolution
if (targetResolution.input !== 'supplied' || targetResolution.result !== 'resolved' || !('targetEvidenceRef' in targetResolution)) {
  throw new Error('Death Cap Mushroom Formal target Raw resolution is unavailable')
}

const targetEvidence = relationArtifact.provenance.evidence.find((entry) => entry.id === targetResolution.targetEvidenceRef)
if (!targetEvidence) throw new Error(`Formal target evidence missing: ${targetResolution.targetEvidenceRef}`)

const sourceFingerprint = (targetEvidence.observed as TargetSnapshotObserved).dataset?.sourceFingerprint
if (!sourceFingerprint) throw new Error('Death Cap Mushroom Formal target source fingerprint is unavailable')

export const deathCapMushroomBrowserProjection = {
  scope: 'formal-domain',
  identity: {
    domainId: identity.resolution.domainId,
    displayName: identity.presentation.displayName,
    status: assertion.reviewState,
    rawItemName: identityField(identity.rawEvidence.itemIdName, 'ItemIdName'),
    rawSerializedId: identityField(identity.rawEvidence.serializedId, 'ItemId.SerializedId'),
  },
  effectRelation: {
    relationRef: relation.relationRef,
    projectionRef: relation.projectionRef,
    result: relationProjection.result,
    target: {
      objectName: relation.target.objectName,
      className,
      gamePackagePath: relation.target.gamePackagePath,
    },
    targetResolution,
    rawProperty: 'Effect',
    provenance: [
      { label: 'ObjectProperty', provenance: objectPropertyEvidence.provenance },
      { label: 'class import', provenance: classImportEvidence.provenance },
      { label: 'outer package import', provenance: outerPackageEvidence.provenance },
      {
        label: 'target Raw snapshot',
        provenance: {
          ...targetEvidence.provenance,
          sourceFingerprint,
        },
      },
    ] satisfies DeathCapMushroomRelationTraceStep[],
  },
  gameplayEffectBoundary: {
    explanation: 'Effect serialized relationはFormal v1でprojectedされ、target Raw snapshotもresolvedです。ただしGameplayEffect semanticsはFormal v1ではassertしていません。Applicationでは効果内容を解釈・推測しません。',
  },
} as const
