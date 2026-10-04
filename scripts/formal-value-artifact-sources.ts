import { artifactValueMappings } from '../src/domain/formal/artifactValueMappings.ts'
import { formalIdentityDefinitions } from '../src/domain/formal/identityDefinitions.ts'
import { matchedIdentityDomainIdFromSource } from '../src/domain/formal/boundarySource.ts'
import type { FormalIdentityEvidenceArtifact } from '../src/domain/formal/identityEvidence.ts'
import type { FormalArtifactConfiguredValueSource } from '../src/domain/formal/valueAvailability.ts'
import type { Field, RawTrace, UnavailableState } from '../src/domain/formal/rawProjection.ts'
import { committedIdentity } from './formal-value-horizontal-wave-sources.ts'
import { readHorizontalRawFactInventory, resolveDirectHorizontalSourceFact, horizontalScalarFieldFromResolved } from './formal-value-horizontal-source.ts'
import type { HorizontalRawFactInventory } from './game-data-horizontal-fact-inventory.ts'
import { readVerifiedStructuralShard, verifyValueRawTraceProvenance } from './formal-value-source-provenance.ts'

export interface ArtifactHorizontalInventory extends HorizontalRawFactInventory {
  items: { category: string; catalogId: string; rawCandidate: { candidates: { packagePath: string; facts: { sourceFactId: string; source: { candidatePackage: string; sourcePackage: string; relationPathId: string } }[] }[] } }[]
  sourceFacts: { factId: string; factKind: string; propertyName: string; propertyPath: string; decodedValue?: unknown; source: { sourcePackage: string; sourcePackageHash: string; propertyPointer: string } }[]
}

/** Missing/drifted Horizontal observations never acquire a value from a guessed locator. */
export function readArtifactConfiguredValueSources(args: {
  repositoryRoot: string
  identity: FormalIdentityEvidenceArtifact
  inventory?: HorizontalRawFactInventory
}): FormalArtifactConfiguredValueSource[] {
  const inventory = (args.inventory ?? readHorizontalRawFactInventory(args.repositoryRoot)) as ArtifactHorizontalInventory
  return artifactValueMappings.map((mapping) => {
    const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === mapping.domainId)!
    const identities = args.identity.semantic.identities.filter(({ assertionId }) => assertionId === definition.assertion.id)
    if (identities.length !== 1) throw new Error(`${mapping.domainId}: Identity is missing or ambiguous`)
    const identity = identities[0]!
    const identityEvidence = committedIdentity(args.identity, definition, identity)
    const provenance = identityEvidence.find(({ field }) => field === 'ItemIdName')!.provenance
    if (!provenance.datasetId || !provenance.extractionRunId || !provenance.packagePath || !provenance.packageHash || !provenance.nodePointer) throw new Error('Incomplete Artifact Identity provenance')
    const identitySource: RawTrace = { artifactPath: provenance.artifactPath, datasetId: provenance.datasetId, extractionRunId: provenance.extractionRunId, packagePath: provenance.packagePath, packageHash: provenance.packageHash, nodePointer: provenance.nodePointer }
    if (!matchedIdentityDomainIdFromSource(identitySource, definition, identity, identityEvidence)) {
      throw new Error(`${mapping.domainId}: Artifact Value failed matched Identity gate`)
    }
    verifyValueRawTraceProvenance(args.repositoryRoot, identitySource)
    const { shard } = readVerifiedStructuralShard(args.repositoryRoot, identitySource.artifactPath, identitySource.datasetId)
    const packages = shard.packages.map((pkg, index) => ({ pkg, index })).filter(({ pkg }) => pkg.path === definition.assertion.applicationScope.packagePath)
    if (packages.length !== 1) throw new Error(`${mapping.domainId}: Structural source package is ambiguous`)
    const { pkg, index } = packages[0]!
    const properties = pkg.cdoPropertyInventory.flatMap((cdo, cdoIndex) => cdo.properties
      .map((property, propertyIndex) => ({ property, pointer: `/packages/${index}/cdoPropertyInventory/${cdoIndex}/properties/${propertyIndex}` })))
      .filter(({ property }) => property.name.value === mapping.rawField && property.path === mapping.rawField)
    const occurrence = properties.length === 1 ? properties[0] : undefined
    const raw: RawTrace = { ...identitySource, nodePointer: occurrence?.pointer ?? `/packages/${index}/cdoPropertyInventory` }
    const trace = { raw, mappingId: mapping.id, identityAssertionId: definition.assertion.id }
    const decodingState: string | undefined = occurrence?.property.decoding.state
    const state: UnavailableState = decodingState === 'unsupported' || decodingState === 'parse-failed' || decodingState === 'not-extracted' ? decodingState : 'unknown'
    let field: Field<number | boolean>
    try {
      const items = inventory.items.filter((item) => item.category === 'artifact' && item.catalogId === mapping.domainId)
      if (items.length !== 1) throw new Error('Horizontal Artifact item is missing or ambiguous')
      const candidates = items[0]!.rawCandidate.candidates.filter((candidate) => candidate.packagePath === definition.assertion.applicationScope.packagePath)
      if (candidates.length !== 1) throw new Error('Horizontal selected candidate is missing or ambiguous')
      const facts = candidates[0]!.facts.filter((reference) => reference.source.candidatePackage === pkg.path
        && reference.source.sourcePackage === pkg.path && reference.source.relationPathId === 'rp-root')
        .flatMap((reference) => inventory.sourceFacts.filter((fact) => fact.factId === reference.sourceFactId))
        .filter((fact) => fact.factKind === 'property-occurrence' && fact.propertyName === mapping.rawField && fact.propertyPath === mapping.rawField)
      if (!occurrence || facts.length !== 1) throw new Error('Artifact root property occurrence is missing or ambiguous')
      const resolved = resolveDirectHorizontalSourceFact(args.repositoryRoot, inventory, {
        category: 'artifact', catalogId: mapping.domainId, candidatePackage: pkg.path, sourceFactId: facts[0]!.factId,
      })
      if (resolved.raw.nodePointer !== raw.nodePointer
        || !matchedIdentityDomainIdFromSource(resolved.raw, definition, identity, identityEvidence)) throw new Error('Artifact root source binding drift')
      field = horizontalScalarFieldFromResolved<number | boolean>(resolved, mapping.id, definition.assertion.id, mapping.rawField, mapping.rawType, mapping.rawType === 'BoolProperty' ? 'boolean' : 'number')
    } catch (error) {
      field = { state, reason: `Artifact source unavailable: ${error instanceof Error ? error.message : String(error)}`, trace }
    }
    return { sourceProvenance: raw, definition, identity, identityEvidence, mapping, field }
  })
}
