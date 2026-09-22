import identityArtifact from '../../../research/domain/formal/identity-evidence-v1.json'
import valueArtifact from '../../../research/domain/formal/value-availability-v1.json'

type Provenance = {
  packagePath: string
  datasetId: string
  extractionRunId: string
  nodePointer: string
}

export type BrowserField<T> = { value: T; provenance: Provenance; rawProperty: string; projectionRef?: string }

const assertionId = 'identity:fighters-bindings@1'
const identity = identityArtifact.semantic.identities.find((entry) => entry.assertionId === assertionId)
const assertion = identityArtifact.identityAssertions.find((entry) => entry.id === assertionId)

if (!identity || identity.resolution.state !== 'matched' || !identity.resolution.domainId || !assertion) {
  throw new Error('Fighter’s Bindings matched Formal identity is unavailable')
}

function identityField(field: { value: string; evidenceRef: string }, rawProperty: string): BrowserField<string> {
  const evidence = identityArtifact.provenance.evidence.find((entry) => entry.id === field.evidenceRef)
  if (!evidence || !('provenance' in evidence) || !evidence.provenance) {
    throw new Error(`Formal identity evidence missing: ${field.evidenceRef}`)
  }
  return { value: field.value, rawProperty, provenance: evidence.provenance }
}

function valueField(field: { value: number; projectionRef: string; evidenceRefs: string[] }, rawProperty: string): BrowserField<number> {
  const projection = valueArtifact.valueProjections.find((entry) => entry.projectionId === field.projectionRef)
  if (!projection || !field.evidenceRefs.every((ref) => projection.evidenceRefs.includes(ref))) {
    throw new Error(`Formal value projection missing: ${field.projectionRef}`)
  }
  const evidenceRef = field.evidenceRefs[0]
  const evidence = valueArtifact.provenance.evidence.find((entry) => entry.id === evidenceRef)
  if (!evidence) throw new Error(`Formal value evidence missing: ${evidenceRef}`)
  return { value: field.value, rawProperty, projectionRef: field.projectionRef, provenance: evidence.provenance }
}

const configuredAttacks = valueArtifact.semantic.fightersBindings.configuredAttacks
const attacksProjection = valueArtifact.valueProjections.find((entry) => entry.projectionId === configuredAttacks.projectionRef)
const attacksEvidenceRef = configuredAttacks.evidenceRefs[0]
const attacksEvidence = valueArtifact.provenance.evidence.find((entry) => entry.id === attacksEvidenceRef)
if (!attacksProjection || !attacksEvidence || !configuredAttacks.evidenceRefs.every((ref) => attacksProjection.evidenceRefs.includes(ref))) {
  throw new Error('Fighter’s Bindings configured attacks Formal evidence is unavailable')
}

export const fightersBindingsBrowserProjection = {
  scope: 'formal-domain',
  identity: {
    domainId: identity.resolution.domainId,
    displayName: identity.presentation.displayName,
    status: assertion.reviewState,
    rawItemName: identityField(identity.rawEvidence.itemIdName, 'ItemIdName'),
    rawSerializedId: identityField(identity.rawEvidence.serializedId, 'ItemId.SerializedId'),
  },
  configuredAttacks: {
    value: configuredAttacks.value,
    projectionRef: configuredAttacks.projectionRef,
    rawProperty: 'AttackCombo',
    provenance: attacksEvidence.provenance,
    attacks: valueArtifact.semantic.fightersBindings.attacks.map((entry) => ({
      sourceIndex: entry.sourceIndex,
      configuredDamage: valueField(entry.configuredDamage, 'Damage'),
      configuredAnimationDurationSeconds: valueField(entry.configuredAnimationDurationSeconds, 'AttackAnimationTimeDurationSeconds'),
    })),
  },
  // These mechanics are intentionally outside this Data Browser's assertions.
  unresolved: ['final-damage', 'power-scaling', 'effective-attack-cadence', 'complete-combo-mechanic'],
}
