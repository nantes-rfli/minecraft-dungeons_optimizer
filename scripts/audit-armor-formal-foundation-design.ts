import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadStructuralGraph,
  type JsonRecord,
} from './game-data-horizontal-fact-inventory.ts'
import { readHorizontalRawFactInventory } from './formal-value-horizontal-source.ts'

const BASELINE_MAIN_SHA = 'e0cf0ad8ef042a9e8ea3665fff3880cd5daaadbf'
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort(compare).map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}
const asRecord = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is not an object`)
  return value as JsonRecord
}
const asArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`)
  return value
}
const readJson = (relativePath: string): JsonRecord =>
  JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as JsonRecord

const identity = readJson('research/domain/formal/identity-evidence-v1.json')
const horizontal = readHorizontalRawFactInventory(repositoryRoot) as JsonRecord
const graph = loadStructuralGraph(repositoryRoot)

const assertions = asArray(identity.identityAssertions, 'identityAssertions').map((row, index) =>
  asRecord(row, `identityAssertions[${index}]`))
const semanticIdentities = asArray(asRecord(identity.semantic, 'identity.semantic').identities, 'identity.semantic.identities')
  .map((row, index) => asRecord(row, `identity.semantic.identities[${index}]`))
const armorAssertions = assertions
  .filter((row) => typeof row.applicationScope?.packagePath === 'string' && /\/Equipment\/Armor\//.test(row.applicationScope.packagePath))
  .sort((a, b) => compare(String(a.domainId), String(b.domainId)))

const items = asArray(horizontal.items, 'horizontal.items').map((row, index) => asRecord(row, `horizontal.items[${index}]`))
const sourceFacts = asArray(horizontal.sourceFacts, 'horizontal.sourceFacts').map((row, index) =>
  asRecord(row, `horizontal.sourceFacts[${index}]`))
const sourceRelations = asArray(horizontal.sourceRelations, 'horizontal.sourceRelations').map((row, index) =>
  asRecord(row, `horizontal.sourceRelations[${index}]`))
const sourceFactById = new Map(sourceFacts.map((fact) => [String(fact.factId), fact]))
const sourceRelationById = new Map(sourceRelations.map((edge) => [String(edge.edgeId), edge]))

if (armorAssertions.length !== 71) throw new Error(`Expected 71 Armor identity assertions, got ${armorAssertions.length}`)
if (new Set(armorAssertions.map((row) => row.domainId)).size !== 71) throw new Error('Armor identity assertion domainId duplicate')
for (const assertion of armorAssertions) {
  const semantic = semanticIdentities.filter((row) => row.assertionId === assertion.id)
  if (semantic.length !== 1) throw new Error(`${assertion.domainId}: expected one semantic identity`)
  if (semantic[0]!.resolution?.state !== 'matched') throw new Error(`${assertion.domainId}: identity is not matched`)
}

type Scope = 'root' | 'traversed'
type FactObservation = {
  domainId: string
  rootPackage: string
  sourcePackage: string
  relationPathId: string
  scope: Scope
  propertyName: string
  propertyPath: string
  propertyType: string
  availabilityState: string
  decodingState: string
  decodedValueType: string
  hasDecodedValue: boolean
  decodedValue?: unknown
  sourceFactId: string
}

type RelationObservation = {
  domainId: string
  rootPackage: string
  sourcePackage: string
  sourceObject: string | null
  propertyPath: string | null
  arrayIndex: number | null
  targetPackage: string | null
  targetObject: string | null
  targetKind: string
  structuralKind: string
  structuralResolutionState: string
  traversalStopReason: string
  relationPathId: string
  scope: Scope
  family: string
  existingRelationKind: string | null
  edgeId: string
}

const relationFamily = (edge: JsonRecord): string => {
  const field = `${edge.propertyPath ?? ''} ${edge.serializedField ?? ''}`
  const structuralKind = String(edge.relationKind ?? '')
  if (structuralKind === 'super' || structuralKind === 'template' || /(?:^|\.)super(?:$|\.)|template/i.test(field)) return 'inheritance-template'
  if (/gearactor/i.test(field)) return 'gear-actor'
  if (/enchant/i.test(field)) return 'built-in-enchantment'
  if (/gameplayeffect/i.test(field)) return 'gameplay-effect'
  if (/(?:^|\.)effect(?:$|\.)|\.Effect(?:\[|$)/i.test(field)) return 'effect'
  if (/component/i.test(field)) return 'actor-component'
  if (/actorclass|spawnedactor|(?:^|\.)actor(?:$|\.)/i.test(field)) return 'actor'
  if (/owner|ownership|target|scope/i.test(field)) return 'ownership-target-scope'
  return 'other-explicit-local-relation'
}

const existingRelationKind = (family: string, edge: JsonRecord): string | null => {
  if (family === 'gear-actor' && /(?:^|\.)GearActor(?:$|\[)/i.test(String(edge.propertyPath ?? ''))) return 'gear-actor'
  if ((family === 'effect' || family === 'gameplay-effect')
    && /(?:^|\.)(?:Effect|GameplayEffect)(?:$|\[)/i.test(String(edge.propertyPath ?? ''))) return 'effect'
  return null
}

const candidateValuePattern =
  /attack.?speed|attackspeed|cooldown|damage|reduction|resist|modifier|multiplier|percent|rate|soul|life.?steal|health|aura|artifact/i

const domainRows: JsonRecord[] = []
const factObservations: FactObservation[] = []
const relationObservations: RelationObservation[] = []

for (const assertion of armorAssertions) {
  const domainId = String(assertion.domainId)
  const rootPackage = String(assertion.applicationScope.packagePath)
  const itemMatches = items.filter((item) => item.category === 'armor' && item.catalogId === domainId)
  if (itemMatches.length !== 1) throw new Error(`${domainId}: horizontal Armor item count = ${itemMatches.length}`)
  const item = itemMatches[0]!
  const rawCandidate = asRecord(item.rawCandidate, `${domainId}.rawCandidate`)
  const candidates = asArray(rawCandidate.candidates, `${domainId}.candidates`).map((row, index) =>
    asRecord(row, `${domainId}.candidates[${index}]`))
  const selected = candidates.filter((candidate) => candidate.packagePath === rootPackage)
  if (selected.length !== 1) throw new Error(`${domainId}: exact Identity package candidate count = ${selected.length}`)
  if (!graph.packagesByPath.has(rootPackage)) throw new Error(`${domainId}: Structural Inventory misses root package ${rootPackage}`)
  const candidate = selected[0]!

  const facts = asArray(candidate.facts, `${domainId}.facts`).map((ref, index) => {
    const record = asRecord(ref, `${domainId}.facts[${index}]`)
    const fact = sourceFactById.get(String(record.sourceFactId))
    if (!fact) throw new Error(`${domainId}: missing sourceFactId ${record.sourceFactId}`)
    const source = asRecord(fact.source, `${domainId} source fact ${record.sourceFactId}`)
    const refSource = asRecord(record.source, `${domainId} fact ref source ${record.sourceFactId}`)
    const decodingState = String(fact.decodingState ?? 'missing')
    const propertyName = String(fact.propertyName ?? '')
    const propertyPath = String(fact.propertyPath ?? '')
    const sourcePackage = String(source.sourcePackage ?? refSource.sourcePackage ?? '')
    const observation: FactObservation = {
      domainId,
      rootPackage,
      sourcePackage,
      relationPathId: String(refSource.relationPathId ?? ''),
      scope: sourcePackage === rootPackage ? 'root' : 'traversed',
      propertyName,
      propertyPath,
      propertyType: String(fact.propertyType ?? 'unknown'),
      availabilityState: String(fact.availabilityState ?? record.availabilityState ?? 'unknown'),
      decodingState,
      decodedValueType: String(fact.decodedValueType ?? (Object.prototype.hasOwnProperty.call(fact, 'decodedValue') ? typeof fact.decodedValue : 'value-not-decoded')),
      hasDecodedValue: Object.prototype.hasOwnProperty.call(fact, 'decodedValue'),
      ...(Object.prototype.hasOwnProperty.call(fact, 'decodedValue') ? { decodedValue: fact.decodedValue } : {}),
      sourceFactId: String(record.sourceFactId),
    }
    factObservations.push(observation)
    return observation
  })

  const relations = asArray(candidate.relations, `${domainId}.relations`).map((ref, index) => {
    const record = asRecord(ref, `${domainId}.relations[${index}]`)
    const edge = sourceRelationById.get(String(record.edgeId))
    if (!edge) throw new Error(`${domainId}: missing relation edgeId ${record.edgeId}`)
    const sourcePackage = String(edge.sourcePackage ?? record.sourcePackage ?? '')
    const family = relationFamily(edge)
    const observation: RelationObservation = {
      domainId,
      rootPackage,
      sourcePackage,
      sourceObject: typeof edge.sourceObject === 'string' ? edge.sourceObject : null,
      propertyPath: typeof edge.propertyPath === 'string' ? edge.propertyPath : null,
      arrayIndex: typeof edge.arrayIndex === 'number' ? edge.arrayIndex : null,
      targetPackage: typeof edge.targetPackage === 'string' ? edge.targetPackage : null,
      targetObject: typeof edge.targetObject === 'string' ? edge.targetObject : null,
      targetKind: String(edge.targetKind ?? 'unknown'),
      structuralKind: String(edge.relationKind ?? 'unknown'),
      structuralResolutionState: String(edge.targetState ?? 'unknown'),
      traversalStopReason: String(edge.traversalStopReason ?? 'unknown'),
      relationPathId: String(record.sourceRelationPathId ?? ''),
      scope: sourcePackage === rootPackage ? 'root' : 'traversed',
      family,
      existingRelationKind: existingRelationKind(family, edge),
      edgeId: String(record.edgeId),
    }
    relationObservations.push(observation)
    return observation
  })

  const directGearActor = relations.filter((edge) => edge.scope === 'root' && edge.family === 'gear-actor')
  const unavailable = asArray(candidate.unavailableStates, `${domainId}.unavailableStates`).map((row, index) =>
    asRecord(row, `${domainId}.unavailableStates[${index}]`))

  domainRows.push({
    domainId,
    identityAssertionId: assertion.id,
    rawIdentity: assertion.rawIdentity,
    sourcePackage: rootPackage,
    horizontalCandidateStatus: rawCandidate.status,
    exactPackageReconciliation: true,
    traversalVisitedPackageCount: candidate.traversal?.visitedPackageCount ?? null,
    value: {
      knownFactCount: facts.filter((fact) => fact.availabilityState === 'known').length,
      parserBoundaryFactCount: facts.filter((fact) => fact.availabilityState === 'parser-boundary').length,
      candidateConfiguredFacts: facts
        .filter((fact) => fact.availabilityState === 'known' && candidateValuePattern.test(`${fact.propertyName} ${fact.propertyPath}`))
        .map((fact) => ({
          propertyName: fact.propertyName,
          propertyPath: fact.propertyPath,
          propertyType: fact.propertyType,
          sourcePackage: fact.sourcePackage,
          sourceBoundary: fact.scope,
          relationPathId: fact.relationPathId,
          decodedValueType: fact.decodedValueType,
          ...(fact.hasDecodedValue ? { decodedValue: fact.decodedValue } : {}),
        })),
      unavailableSelectors: unavailable.map((row) => ({
        factSelector: row.factSelector,
        state: row.state,
        reason: row.reason,
      })),
    },
    relation: {
      directRootEdgeCount: relations.filter((edge) => edge.scope === 'root').length,
      closureEdgeCount: relations.length,
      directGearActorCount: directGearActor.length,
      observedDirectFamilies: [...new Set(relations.filter((edge) => edge.scope === 'root').map((edge) => edge.family))].sort(compare),
      observedClosureFamilies: [...new Set(relations.map((edge) => edge.family))].sort(compare),
      directEdges: relations.filter((edge) => edge.scope === 'root'),
    },
  })
}

const groupFacts = (): JsonRecord[] => {
  const groups = new Map<string, FactObservation[]>()
  for (const fact of factObservations) {
    const key = `${fact.propertyName}\0${fact.propertyPath}\0${fact.propertyType}`
    const list = groups.get(key) ?? []
    list.push(fact)
    groups.set(key, list)
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0]!
    const domains = [...new Set(rows.map((row) => row.domainId))].sort(compare)
    const sampleValues = [...new Map(rows
      .filter((row) => row.hasDecodedValue)
      .map((row) => [canonicalJson(row.decodedValue), row.decodedValue])).values()].slice(0, 12)
    return {
      propertyName: first.propertyName,
      propertyPath: first.propertyPath,
      propertyType: first.propertyType,
      domainCount: domains.length,
      occurrenceCount: rows.length,
      domains,
      availabilityStates: [...new Set(rows.map((row) => row.availabilityState))].sort(compare),
      decodingStates: [...new Set(rows.map((row) => row.decodingState))].sort(compare),
      decodedValueTypes: [...new Set(rows.map((row) => row.decodedValueType))].sort(compare),
      sourceBoundaryCounts: {
        root: rows.filter((row) => row.scope === 'root').length,
        traversed: rows.filter((row) => row.scope === 'traversed').length,
      },
      sourcePackageCount: new Set(rows.map((row) => row.sourcePackage)).size,
      sampleValues,
      candidateValueName: candidateValuePattern.test(`${first.propertyName} ${first.propertyPath}`),
    }
  }).sort((a, b) =>
    Number(b.domainCount) - Number(a.domainCount)
    || compare(String(a.propertyName), String(b.propertyName))
    || compare(String(a.propertyPath), String(b.propertyPath)))
}

const groupRelations = (scope: Scope | 'all'): JsonRecord[] => {
  const selected = scope === 'all' ? relationObservations : relationObservations.filter((edge) => edge.scope === scope)
  const groups = new Map<string, RelationObservation[]>()
  for (const edge of selected) {
    const key = `${edge.family}\0${edge.propertyPath ?? ''}\0${edge.structuralKind}`
    const list = groups.get(key) ?? []
    list.push(edge)
    groups.set(key, list)
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0]!
    const domains = [...new Set(rows.map((row) => row.domainId))].sort(compare)
    return {
      family: first.family,
      propertyPath: first.propertyPath,
      structuralKind: first.structuralKind,
      existingRelationKind: first.existingRelationKind,
      domainCount: domains.length,
      occurrenceCount: rows.length,
      domains,
      resolutionStates: [...new Set(rows.map((row) => row.structuralResolutionState))].sort(compare),
      stopReasons: [...new Set(rows.map((row) => row.traversalStopReason))].sort(compare),
      targetKinds: [...new Set(rows.map((row) => row.targetKind))].sort(compare),
      targetPackageCount: new Set(rows.map((row) => row.targetPackage).filter(Boolean)).size,
      sampleTargets: rows.slice(0, 8).map((row) => ({
        domainId: row.domainId,
        sourcePackage: row.sourcePackage,
        targetPackage: row.targetPackage,
        targetObject: row.targetObject,
        resolutionState: row.structuralResolutionState,
      })),
    }
  }).sort((a, b) =>
    Number(b.domainCount) - Number(a.domainCount)
    || compare(String(a.family), String(b.family))
    || compare(String(a.propertyPath ?? ''), String(b.propertyPath ?? '')))
}

const directGearActorRows = relationObservations.filter((edge) =>
  edge.scope === 'root' && edge.family === 'gear-actor' && edge.existingRelationKind === 'gear-actor')
const directGearActorDomains = new Set(directGearActorRows.map((edge) => edge.domainId))

const report = {
  baselineMainSha: BASELINE_MAIN_SHA,
  generatedAt: 'deterministic-no-wall-clock',
  authority: {
    identity: 'research/domain/formal/identity-evidence-v1.json',
    horizontalRaw: 'research/raw/game-data-horizontal-fact-inventory-v1.json.gz',
    structuralManifest: 'research/raw/game-data-raw-structural-inventory/manifest.json',
    structuralShardCount: graph.manifest.shards.length,
  },
  identity: {
    armorCount: armorAssertions.length,
    uniqueDomainCount: new Set(armorAssertions.map((row) => row.domainId)).size,
    sourceRootReconciliationCount: domainRows.filter((row) => row.exactPackageReconciliation === true).length,
    domainIds: domainRows.map((row) => row.domainId),
  },
  valueCensus: {
    totalFactObservations: factObservations.length,
    knownFactObservations: factObservations.filter((row) => row.availabilityState === 'known').length,
    parserBoundaryFactObservations: factObservations.filter((row) => row.availabilityState === 'parser-boundary').length,
    propertyGroups: groupFacts(),
  },
  relationCensus: {
    totalClosureEdges: relationObservations.length,
    directRootEdges: relationObservations.filter((edge) => edge.scope === 'root').length,
    directGearActorOccurrences: directGearActorRows.length,
    directGearActorDomainCount: directGearActorDomains.size,
    directGearActorResolvedLocalDomainCount: new Set(directGearActorRows
      .filter((edge) => edge.structuralResolutionState === 'resolved-local-package')
      .map((edge) => edge.domainId)).size,
    directRootGroups: groupRelations('root'),
    closureGroups: groupRelations('all'),
  },
  domains: domainRows,
}

console.log(`Armor Formal foundation census: identity ${report.identity.armorCount}/71; root reconciliation ${report.identity.sourceRootReconciliationCount}/71.`)
console.log(`Value observations: known ${report.valueCensus.knownFactObservations}, parser-boundary ${report.valueCensus.parserBoundaryFactObservations}; property groups ${report.valueCensus.propertyGroups.length}.`)
console.log(`Relation: direct GearActor ${report.relationCensus.directGearActorDomainCount}/71 domains, ${report.relationCensus.directGearActorOccurrences} occurrences; resolved-local domains ${report.relationCensus.directGearActorResolvedLocalDomainCount}/71.`)
console.log('===BEGIN_ARMOR_AUDIT_JSON===')
console.log(JSON.stringify(report))
console.log('===END_ARMOR_AUDIT_JSON===')
