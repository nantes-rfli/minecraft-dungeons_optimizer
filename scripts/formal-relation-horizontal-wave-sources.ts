import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  fightersBindingsFormalIdentity,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type FormalIdentityDefinition, type FormalIdentityEvidenceArtifact, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import { horizontalRelationDefinition, type HorizontalRelationInput } from '../src/domain/formal/serializedRelation.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import { readHorizontalRawFactInventory } from './formal-value-horizontal-source.ts'
import { ownsHorizontalRelationCollectionChild, resolveHorizontalRelationSource } from './formal-relation-horizontal-source.ts'
import type { HorizontalRawFactInventory } from './game-data-horizontal-fact-inventory.ts'

type RelationReference = { edgeId: string; sourcePackage: string; sourceRelationPathId: string }
type Candidate = { packagePath: string; relations: RelationReference[] }
type Item = { category: string; catalogId: string; rawCandidate: { candidates: Candidate[] } }
type SourceRelation = { edgeId: string; propertyPath: string | null; arrayIndex: number | null }
type Inventory = HorizontalRawFactInventory & { items: Item[]; sourceRelations: SourceRelation[] }

const canonical = (value: unknown): string => JSON.stringify(value)

function committedIdentity(artifact: FormalIdentityEvidenceArtifact, definition: FormalIdentityDefinition) {
  const assertion = artifact.identityAssertions.filter((entry) => entry.id === definition.assertion.id)
  assert.equal(assertion.length, 1, `${definition.assertion.id}: committed Identity assertion missing or duplicated`)
  assert.equal(canonical(assertion[0]), canonical(definition.assertion), `${definition.assertion.id}: committed Identity assertion drift`)
  const matches = artifact.semantic.identities.filter((entry) => entry.assertionId === definition.assertion.id)
  assert.equal(matches.length, 1, `${definition.assertion.id}: committed Identity missing or duplicated`)
  const identity = matches[0]!
  assert.equal(identity.resolution.state, 'matched', `${definition.assertion.id}: Identity is not matched`)
  const identityEvidence = artifact.provenance.evidence.filter((entry): entry is RawObservationEvidenceRecord =>
    entry.kind === 'raw-observation' && identity.resolution.evidenceRefs.includes(entry.id))
  return { identity, identityEvidence }
}

/** Re-enumerates first-wave occurrences from committed Horizontal references and verifies each exact Structural edge. */
export function readHorizontalRelationWaveSources(args: {
  repositoryRoot: string
  identity: FormalIdentityEvidenceArtifact
  inventory?: HorizontalRawFactInventory
}): { melee: HorizontalRelationInput[]; ranged: HorizontalRelationInput[] } {
  const inventory = (args.inventory ?? readHorizontalRawFactInventory(args.repositoryRoot)) as Inventory
  const byEdgeId = new Map<string, SourceRelation[]>()
  for (const source of inventory.sourceRelations) {
    const matches = byEdgeId.get(source.edgeId) ?? []
    matches.push(source)
    byEdgeId.set(source.edgeId, matches)
  }
  const categories = [
    { category: 'melee' as const, definitions: [fightersBindingsFormalIdentity, ...readyMeleeFormalIdentities, ...reviewedBridgeMeleeFormalIdentities] },
    { category: 'ranged' as const, definitions: [scatterCrossbowFormalIdentity, ...readyRangedFormalIdentities, ...reviewedBridgeRangedFormalIdentities] },
  ]
  const result = { melee: [] as HorizontalRelationInput[], ranged: [] as HorizontalRelationInput[] }
  for (const { category, definitions } of categories) {
    for (const definition of definitions) {
      const domainId = definition.assertion.domainId
      const packagePath = definition.assertion.applicationScope.packagePath
      const items = inventory.items.filter((item) => item.category === category && item.catalogId === domainId)
      assert.equal(items.length, 1, `${domainId}: Horizontal catalog item missing or duplicated`)
      const candidates = items[0]!.rawCandidate.candidates.filter((candidate) => candidate.packagePath === packagePath)
      assert.equal(candidates.length, 1, `${domainId}: Horizontal candidate package missing or duplicated`)
      const expected = horizontalRelationDefinition(domainId, category)
      const occurrences = candidates[0]!.relations.flatMap((reference) => {
        const sourceMatches = byEdgeId.get(reference.edgeId) ?? []
        return sourceMatches.flatMap((source) => reference.sourceRelationPathId === 'rp-root'
          && reference.sourcePackage === packagePath && Number.isInteger(source.arrayIndex)
          && ownsHorizontalRelationCollectionChild(source, expected.parentRawField, expected.childRawField, source.arrayIndex!)
          ? [{ edgeId: reference.edgeId, sourceIndex: source.arrayIndex! }] : [])
      }).sort((left, right) => left.sourceIndex - right.sourceIndex)
      assert.ok(occurrences.length > 0, `${domainId}: no exact ${expected.childRawField} occurrence`)
      const { identity, identityEvidence } = committedIdentity(args.identity, definition)
      const directPath = `research/raw/packages/${packagePath}.raw.json`
      const direct = identityEvidence.length === 2
        && identityEvidence.every(({ provenance }) => provenance.artifactPath === directPath)
        ? JSON.parse(fs.readFileSync(path.join(args.repositoryRoot, directPath), 'utf8')) as RawPackageSnapshot
        : undefined
      if (direct) assert.equal(canonical(projectFormalIdentity(direct, definition).semantic), canonical(identity),
        `${domainId}: committed full Raw Identity does not match current snapshot`)
      for (const { edgeId, sourceIndex } of occurrences) {
        try {
          result[category].push(resolveHorizontalRelationSource(args.repositoryRoot, inventory, {
            category, catalogId: domainId, candidatePackage: packagePath, edgeId, sourceIndex,
            definition, identity, identityEvidence, identitySource: direct,
          }))
        } catch (error) {
          throw new Error(`${domainId} sourceIndex=${sourceIndex} edgeId=${edgeId}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error })
        }
      }
    }
  }
  return result
}
