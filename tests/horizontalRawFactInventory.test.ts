import { describe, expect, it } from 'vitest'
import {
  assessFactSelector,
  collectCandidateObservations,
  collectFactsForPackage,
  serializeHorizontalRawFactInventory,
  traverseCandidateGraph,
  validateHorizontalRawFactInventory,
  type JsonRecord,
  type HorizontalRawFactInventory,
  type LoadedStructuralGraph,
} from '../scripts/game-data-horizontal-fact-inventory.ts'

describe('horizontal Raw fact inventory', () => {
  it('extracts explicit zero and false scalars as known source facts', () => {
    const facts = collectFactsForPackage(packageRecord('root', [property('Damage', 0), property('bTriggerEnchantmentsOnRelease', false)]) as Parameters<typeof collectFactsForPackage>[0], 'root')
    expect(facts.map((fact) => [fact.propertyName, fact.availabilityState, fact.decodedValue])).toEqual([
      ['Damage', 'known', 0],
      ['bTriggerEnchantmentsOnRelease', 'known', false],
    ])
  })

  it('preserves array element and nested occurrence order', () => {
    const array = {
      ...property('ConfiguredAttackVariants', undefined),
      type: { value: 'ArrayProperty' },
      metadata: { innerTypeReference: { value: 'StructProperty' } },
      decoding: {
        state: 'decoded',
        elements: [0, 1].map((index) => ({
          index,
          decoding: { state: 'decoded' },
          properties: [property('AttackSequence', `Attack_${index}`, `ConfiguredAttackVariants[${index}].AttackSequence`)],
        })),
      },
    }
    const facts = collectFactsForPackage(packageRecord('root', [array]) as Parameters<typeof collectFactsForPackage>[0], 'root')
    expect(facts.filter((fact) => fact.factKind === 'array-element-occurrence').map((fact) => fact.occurrence.elementIndex)).toEqual([0, 1])
    expect(facts.filter((fact) => fact.propertyName === 'AttackSequence').map((fact) => fact.decodedValue)).toEqual(['Attack_0', 'Attack_1'])
  })

  it('traverses linked relation targets from the candidate package', () => {
    const graph = fakeGraph({
      packages: [packageRecord('root', []), packageRecord('linked', [])],
      edges: [edge('edge-root-linked', 'root', 'linked')],
    })
    const traversal = traverseCandidateGraph('root', graph)
    expect([...traversal.visited].sort()).toEqual(['linked', 'root'])
    expect(traversal.parentEdgeByTarget.get('linked')?.id).toBe('edge-root-linked')
  })

  it('keeps ambiguous candidate facts in separate candidate observations', () => {
    const first = packageRecord('candidate-a', [property('Damage', 12)])
    const second = packageRecord('candidate-b', [property('Damage', 30)])
    const graph = fakeGraph({ packages: [first, second], edges: [] })
    const observations = collectCandidateObservations({
      category: 'melee',
      status: 'ambiguous',
      candidates: [
        { packagePath: 'candidate-a', objectName: 'CandidateA_C', role: 'instance', evidence: [] },
        { packagePath: 'candidate-b', objectName: 'CandidateB_C', role: 'instance', evidence: [] },
      ],
    }, graph, 'dataset-test')
    expect(observations.map((candidate) => candidate.candidateMappingStatus)).toEqual(['ambiguous', 'ambiguous'])
    expect(observations.map((candidate) => candidate.facts.filter((fact: JsonRecord) => fact.propertyName === 'Damage').map((fact: JsonRecord) => fact.decodedValue))).toEqual([[12], [30]])
  })

  it('preserves not-observed, parser-boundary, and not-found states', () => {
    const selector = { id: 'missingDamage', names: ['Damage'] }
    expect(assessFactSelector(selector, [])).toBe('not-observed')
    expect(assessFactSelector(selector, [{ propertyName: 'Damage', propertyPath: 'Damage', availabilityState: 'parser-boundary' }])).toBe('parser-boundary')
    expect(assessFactSelector(selector, [], true)).toBe('not-found')
  })

  it('does not promote a Raw exact candidate to Formal or canonical identity', () => {
    const graph = fakeGraph({ packages: [packageRecord('candidate-a', [property('Damage', 5)])], edges: [] })
    const [candidate] = collectCandidateObservations({
      category: 'melee',
      status: 'exact',
      candidates: [{ packagePath: 'candidate-a', objectName: 'CandidateA_C', role: 'instance', evidence: ['serialized-identity-match:catalog'] }],
    }, graph, 'dataset-test')
    expect(candidate?.candidateMappingStatus).toBe('exact')
    expect(candidate).not.toHaveProperty('formalIdentity')
    expect(candidate).not.toHaveProperty('canonicalIdentity')
  })

  it('rejects candidate package drift during audit', () => {
    const fixture = auditFixture('missing-package')
    const errors = validateHorizontalRawFactInventory(fixture.inventory, fixture.graph, process.cwd())
    expect(errors.some((error) => error.includes('Candidate package is absent from the Structural Inventory'))).toBe(true)
  })

  it('rejects relation target drift during audit', () => {
    const fixture = auditFixture('root', 'ghost-package')
    const errors = validateHorizontalRawFactInventory(fixture.inventory, fixture.graph, process.cwd())
    expect(errors.some((error) => error.includes('Relation target package is missing without a parser boundary'))).toBe(true)
  })

  it('serializes an unchanged generated inventory deterministically', () => {
    const inventory = {
      schemaVersion: 1,
      artifactKind: 'horizontal-raw-fact-inventory',
      identityBoundary: { rawCandidateStatusIsNotFormalIdentity: true },
      items: collectCandidateObservations({ category: 'melee', status: 'exact', candidates: [{ packagePath: 'root', objectName: 'Root_C', role: 'instance', evidence: [] }] }, fakeGraph({ packages: [packageRecord('root', [property('Damage', 5)])], edges: [] }), 'dataset-test'),
    } as unknown as HorizontalRawFactInventory
    expect(serializeHorizontalRawFactInventory(inventory)).toBe(serializeHorizontalRawFactInventory(inventory))
  })
})

function property(name: string, value: unknown, propertyPath = name): JsonRecord {
  return {
    order: 0,
    name: { value: name },
    type: { value: typeof value === 'boolean' ? 'BoolProperty' : 'FloatProperty' },
    arrayIndex: 0,
    path: propertyPath,
    serializedSize: 4,
    sourceRange: { file: 'root.uexp', start: 0, end: 4 },
    valueRange: { file: 'root.uexp', start: 0, end: 4 },
    decoding: { state: 'decoded', ...(value === undefined ? {} : { value }) },
  }
}

function packageRecord(packagePath: string, properties: JsonRecord[]): JsonRecord {
  const base = {
    path: packagePath,
    gamePackageName: `/Game/${packagePath}`,
    packageHash: { algorithm: 'sha256-path-content-v1', value: `hash-${packagePath}` },
    sourceFiles: [],
    parse: { state: 'parsed' },
    cdoPropertyInventory: [{ exportIndex: 0, objectName: `Default__${packagePath}`, properties }],
    unavailableRanges: [],
    payloadCoverage: { classDefaultObjectsDecoded: 1, nonCdoExportsNotDecoded: 0 },
    inheritanceChains: [],
    shardPath: 'shards/part-000.json.gz',
    shardUncompressedSha256: 'shard-hash',
  }
  return { ...base, relevantFacts: collectFactsForPackage(base as Parameters<typeof collectFactsForPackage>[0], packagePath) }
}

function edge(id: string, sourcePackage: string, targetPackage: string): JsonRecord {
  return {
    id,
    kind: 'object-property',
    sourcePackage,
    propertyPath: 'Effect',
    sourceOccurrence: { kind: 'cdo-property', sourceObject: 'Default__Root', propertyPath: 'Effect', rawPackageIndex: -1 },
    targetPackage,
    targetRawPackageIndex: -1,
    targetKind: 'import',
    traversal: { stopReason: 'followed', targetDepth: 1 },
  }
}

function fakeGraph(input: { packages: JsonRecord[]; edges: JsonRecord[] }): LoadedStructuralGraph {
  const edgesBySource = new Map<string, JsonRecord[]>()
  const edgeById = new Map<string, JsonRecord>()
  for (const relation of input.edges) {
    edgeById.set(relation.id, relation)
    edgesBySource.set(relation.sourcePackage, [...(edgesBySource.get(relation.sourcePackage) ?? []), relation])
  }
  return {
    manifest: { catalogSeeds: [], summary: {}, scope: { dataset: { id: 'dataset-test' } } },
    packagesByPath: new Map(input.packages.map((record) => [record.path, record])),
    edgesBySource,
    relationEdgesBySource: edgesBySource,
    edgeById,
    edgeCount: input.edges.length,
    shardIdentityByPath: new Map(),
  } as unknown as LoadedStructuralGraph
}

function auditFixture(candidatePackage: string, relationTarget?: string): { inventory: HorizontalRawFactInventory; graph: LoadedStructuralGraph } {
  const seed = { category: 'melee', catalogId: 'fighters-bindings', catalogName: "Fighter's Bindings", status: 'exact', matchBasis: ['catalog-match'], candidates: [{ packagePath: candidatePackage, objectName: 'Fighter_C', role: 'instance', evidence: [] }] }
  const candidate: JsonRecord = {
    candidateIndex: 0,
    packagePath: candidatePackage,
    objectName: 'Fighter_C',
    role: 'instance',
    candidateMappingStatus: 'exact',
    facts: [],
    relations: [],
    unavailableStates: [{ factSelector: 'Damage', state: 'not-observed', reason: 'not present' }],
    traversal: { relationPaths: [{ id: 'rp-root', sourcePackage: candidatePackage, edgeIds: [] }] },
  }
  const packages = candidatePackage === 'missing-package' ? [] : [packageRecord(candidatePackage, [])]
  const edges = relationTarget ? [edge('drift-edge', candidatePackage, relationTarget)] : []
  if (relationTarget) {
    candidate.relations.push({ edgeId: 'drift-edge', sourcePackage: candidatePackage, sourceRelationPathId: 'rp-root' })
  }
  const graph = fakeGraph({ packages, edges })
  graph.manifest.catalogSeeds = [seed]
  const item: JsonRecord = {
    category: 'melee',
    catalogId: 'fighters-bindings',
    displayName: "Fighter's Bindings",
    presentationHint: null,
    rawCandidate: { status: 'exact', matchBasis: seed.matchBasis, candidateCount: 1, candidates: [candidate] },
    unavailableStates: [],
  }
  const inventory = {
    schemaVersion: 1,
    artifactKind: 'horizontal-raw-fact-inventory',
    identityBoundary: { rawCandidateStatusIsNotFormalIdentity: true, formalIdentityProjection: 'not-consulted' },
    summary: { catalogItemCount: 1, candidateAssignmentCount: 1, categoryCounts: { melee: 1 }, ambiguousCandidatesKeptSeparate: true, formalMatchedPopulationReadOnly: 52, artifactBaseCooldownPartition: { staticKnown: 0, staticRelationTraversal: 0, parserBoundary: 5, notObserved: 40 } },
    categoryCounts: { melee: 1 },
    sourceFacts: [],
    sourceRelations: relationTarget ? [{ edgeId: 'drift-edge', sourcePackage: candidatePackage, targetPackage: relationTarget, targetState: 'resolved-local-package', traversalStopReason: 'followed' }] : [],
    items: [item],
  } as unknown as HorizontalRawFactInventory
  return { inventory, graph }
}
