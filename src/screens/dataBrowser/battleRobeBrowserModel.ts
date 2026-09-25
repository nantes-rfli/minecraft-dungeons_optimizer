import identityArtifact from '../../../research/domain/formal/identity-evidence-v1.json'
import relationArtifact from '../../../research/domain/formal/serialized-relation-v2.json'

type Provenance = {
  packagePath: string
  datasetId: string
  extractionRunId: string
  nodePointer?: string
}

export type BattleRobeBrowserField<T> = {
  value: T
  rawProperty: string
  provenance: Provenance
}

export type BattleRobeRelationTraceStep = {
  label: 'ObjectProperty' | 'class import' | 'outer package import'
  provenance: Provenance
}

const assertionId = 'identity:battle-robe@1'
const relationRef = 'relation:battle-robe:gear-actor@1'

const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === assertionId)
const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === assertionId)

if (!identity || identity.resolution.state !== 'matched' || !identity.resolution.domainId || !assertion) {
  throw new Error('Battle Robe matched Formal identity is unavailable')
}

function identityField(field: { value: string; evidenceRef: string }, rawProperty: string): BattleRobeBrowserField<string> {
  const evidence = identityArtifact.provenance.evidence.find((entry) => entry.id === field.evidenceRef)
  if (!evidence || !('provenance' in evidence) || !evidence.provenance) {
    throw new Error(`Formal identity evidence missing: ${field.evidenceRef}`)
  }
  return { value: field.value, rawProperty, provenance: evidence.provenance }
}

const relation = relationArtifact.semantic.relations.find((entry) => entry.relationRef === relationRef)
const relationProjection = relationArtifact.relationProjections.find((entry) => entry.relationRef === relationRef)

if (!relation || !relationProjection || relationProjection.result !== 'projected') {
  throw new Error('Battle Robe Formal GearActor relation is unavailable')
}

const relationEvidence = relation.evidenceRefs.map((evidenceRef) => {
  const evidence = relationArtifact.provenance.evidence.find((entry) => entry.id === evidenceRef)
  if (!evidence) throw new Error(`Formal relation evidence missing: ${evidenceRef}`)
  return evidence
})

if (relationEvidence.length !== 3) {
  throw new Error('Battle Robe Formal GearActor relation provenance is incomplete')
}

const objectPropertyEvidence = relationEvidence[0]
const classImportEvidence = relationEvidence[1]
const outerPackageEvidence = relationEvidence[2]

if (!objectPropertyEvidence || !classImportEvidence || !outerPackageEvidence) {
  throw new Error('Battle Robe Formal GearActor relation provenance is incomplete')
}

const className = classImportEvidence.observed && 'className' in classImportEvidence.observed
  ? classImportEvidence.observed.className?.value
  : undefined

if (!className) throw new Error('Battle Robe Formal class import display value is unavailable')

export const battleRobeBrowserProjection = {
  scope: 'formal-domain',
  identity: {
    domainId: identity.resolution.domainId,
    displayName: identity.presentation.displayName,
    status: assertion.reviewState,
    rawItemName: identityField(identity.rawEvidence.itemIdName, 'ItemIdName'),
    rawSerializedId: identityField(identity.rawEvidence.serializedId, 'ItemId.SerializedId'),
  },
  gearActorRelation: {
    relationRef: relation.relationRef,
    projectionRef: relation.projectionRef,
    result: relationProjection.result,
    target: {
      objectName: relation.target.objectName,
      className,
      gamePackagePath: relation.target.gamePackagePath,
    },
    targetRawVerification: relationProjection.targetRawVerification,
    rawProperty: 'GearActor',
    provenance: [
      { label: 'ObjectProperty', provenance: objectPropertyEvidence.provenance },
      { label: 'class import', provenance: classImportEvidence.provenance },
      { label: 'outer package import', provenance: outerPackageEvidence.provenance },
    ] satisfies BattleRobeRelationTraceStep[],
  },
  armorPropertyBoundary: {
    key: 'armor-property-ownership',
    explanation: 'GearActor serialized relationは確認済みですが、target RawはFormal v2ではresolvedではありません。Armor Property ownership semanticsはFormal v2ではassertしていません。propertyの有無・件数・gameplay effectを推測しません。',
  },
} as const
