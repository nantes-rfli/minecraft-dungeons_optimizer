import identityArtifact from '../../../research/domain/formal/identity-evidence-v1.json'
import valueArtifact from '../../../research/domain/formal/value-availability-v1.json'
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

export type ScatterCrossbowBrowserField<T> = {
  value: T
  rawProperty: string
  provenance: Provenance
  evidenceRefs: string[]
  projectionRef?: string
  relationProjectionRef?: string
}

export type ScatterCrossbowRelationTraceStep = {
  label: 'ObjectProperty' | 'class import' | 'outer package import' | 'target Raw snapshot'
  provenance: Provenance
}

type ClassImportObserved = {
  className?: { value?: string }
}

type TargetSnapshotObserved = {
  dataset?: { sourceFingerprint?: Hash }
}

type FormalValueField<T> = {
  value: T
  projectionRef: string
  evidenceRefs: string[]
  relationProjectionRef?: string
}

const assertionId = 'identity:scatter-crossbow@1'
const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === assertionId)
const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === assertionId)

if (!identity || identity.resolution.state !== 'matched' || !identity.resolution.domainId || !identity.presentation || !assertion) {
  throw new Error('Scatter Crossbow matched Formal identity is unavailable')
}

function identityField(field: { value: string; evidenceRef: string }, rawProperty: string): ScatterCrossbowBrowserField<string> {
  const evidence = identityArtifact.provenance.evidence.find((entry) => entry.id === field.evidenceRef)
  if (!evidence || !('provenance' in evidence) || !evidence.provenance) {
    throw new Error(`Formal identity evidence missing: ${field.evidenceRef}`)
  }

  return {
    value: field.value,
    rawProperty,
    evidenceRefs: [field.evidenceRef],
    provenance: evidence.provenance,
  }
}

function valueField<T>(field: FormalValueField<T>, rawProperty: string): ScatterCrossbowBrowserField<T> {
  const evidenceRef = field.evidenceRefs[0]
  const evidence = valueArtifact.provenance.evidence.find((entry) => entry.id === evidenceRef)
  if (!evidence) throw new Error(`Formal value evidence missing: ${evidenceRef}`)

  return {
    value: field.value,
    rawProperty,
    projectionRef: field.projectionRef,
    relationProjectionRef: field.relationProjectionRef,
    evidenceRefs: field.evidenceRefs,
    provenance: evidence.provenance,
  }
}

function projectileRelationPresentation(projectionRef: string, sourceIndex: number) {
  const relation = relationArtifact.semantic.relations.find((entry) =>
    entry.projectionRef === projectionRef
    && entry.occurrence.slice === 'scatter-crossbow'
    && 'sourceIndex' in entry.occurrence
    && entry.occurrence.sourceIndex === sourceIndex
  )
  const projection = relationArtifact.relationProjections.find((entry) => entry.projectionRef === projectionRef)

  if (!relation || !projection) {
    throw new Error(`Scatter Crossbow Formal Projectile relation missing: ${projectionRef}`)
  }

  const relationEvidence = relation.evidenceRefs.map((evidenceRef) => {
    const evidence = relationArtifact.provenance.evidence.find((entry) => entry.id === evidenceRef)
    if (!evidence) throw new Error(`Formal relation evidence missing: ${evidenceRef}`)
    return evidence
  })
  const objectPropertyEvidence = relationEvidence[0]
  const classImportEvidence = relationEvidence[1]
  const outerPackageEvidence = relationEvidence[2]

  if (!objectPropertyEvidence || !classImportEvidence || !outerPackageEvidence) {
    throw new Error('Scatter Crossbow Formal Projectile relation provenance is incomplete')
  }

  const className = (classImportEvidence.observed as ClassImportObserved).className?.value
  if (!className) throw new Error('Scatter Crossbow Formal class import display value is unavailable')

  const targetResolution = projection.targetResolution
  if (!('targetEvidenceRef' in targetResolution)) {
    throw new Error('Scatter Crossbow Formal target EvidenceRef is unavailable')
  }

  const targetEvidence = relationArtifact.provenance.evidence.find((entry) => entry.id === targetResolution.targetEvidenceRef)
  if (!targetEvidence) throw new Error(`Formal target evidence missing: ${targetResolution.targetEvidenceRef}`)

  const sourceFingerprint = (targetEvidence.observed as TargetSnapshotObserved).dataset?.sourceFingerprint

  return {
    relationRef: relation.relationRef,
    projectionRef: relation.projectionRef,
    sourceIndex,
    result: projection.result,
    target: {
      objectName: relation.target.objectName,
      className,
      gamePackagePath: relation.target.gamePackagePath,
    },
    targetResolution,
    rawProperty: 'Projectile',
    evidenceRefs: relation.evidenceRefs,
    provenance: [
      { label: 'ObjectProperty', provenance: objectPropertyEvidence.provenance },
      { label: 'class import', provenance: classImportEvidence.provenance },
      { label: 'outer package import', provenance: outerPackageEvidence.provenance },
      {
        label: 'target Raw snapshot',
        provenance: {
          ...targetEvidence.provenance,
          ...(sourceFingerprint ? { sourceFingerprint } : {}),
        },
      },
    ] satisfies ScatterCrossbowRelationTraceStep[],
  }
}

const scatterValues = valueArtifact.semantic.scatterCrossbow
const configuredProjectileDefinitions = valueField(scatterValues.configuredProjectileDefinitions, 'ProjectileDefinition')

const projectileDefinitions = scatterValues.projectileDefinitions.map((entry) => {
  const configuredProjectileCount = valueField(entry.configuredProjectileCount, 'NumberOfProjectiles')
  const configuredAngleSpan = valueField(entry.configuredAngleSpan, 'AngleSpan')
  const configuredDelaySecondsPerProjectile = valueField(entry.configuredDelaySecondsPerProjectile, 'DelaySecondsPerProjectile')
  const configuredPushbackEnabled = valueField(entry.configuredPushbackEnabled, 'pushback.enablePushback')
  const configuredPushbackStrength = valueField(entry.configuredPushbackStrength, 'pushback.pushbackStrength')
  const configuredIgnoreFriendlyFire = valueField(entry.configuredIgnoreFriendlyFire, 'IgnoreFriendlyFire')

  return {
    sourceIndex: entry.sourceIndex,
    configuredProjectileCount,
    configuredAngleSpan,
    configuredDelaySecondsPerProjectile,
    configuredPushbackEnabled,
    configuredPushbackStrength,
    configuredIgnoreFriendlyFire,
    projectileRelation: projectileRelationPresentation(entry.configuredPushbackEnabled.relationProjectionRef, entry.sourceIndex),
  }
})

export const scatterCrossbowBrowserProjection = {
  scope: 'formal-domain',
  identity: {
    domainId: identity.resolution.domainId,
    displayName: identity.presentation.displayName,
    status: assertion.reviewState,
    rawItemName: identityField(identity.rawEvidence.itemIdName, 'ItemIdName'),
    rawSerializedId: identityField(identity.rawEvidence.serializedId, 'ItemId.SerializedId'),
  },
  configuredProjectileDefinitions: {
    ...configuredProjectileDefinitions,
    definitions: projectileDefinitions,
  },
  configuredProjectileVelocityFactor: valueField(scatterValues.configuredProjectileVelocityFactor, 'ProjectileVelocityFactor'),
  boundary: [
    'final damage',
    'effective projectile behavior',
    'effective firing cadence',
    'final gameplay behavior',
  ],
} as const
