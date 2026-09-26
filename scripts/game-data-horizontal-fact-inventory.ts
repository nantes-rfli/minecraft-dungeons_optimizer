import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { loadRawCatalog } from './game-data-raw-structural-inventory.ts'

export const HORIZONTAL_FACT_INVENTORY_PATH = 'research/raw/game-data-horizontal-fact-inventory-v1.json.gz' as const
export const HORIZONTAL_FACT_INVENTORY_SCHEMA_VERSION = 1 as const
export const STRUCTURAL_INVENTORY_PATH = 'research/raw/game-data-raw-structural-inventory/manifest.json' as const
export const PRE_BREADTH_CLOSURE_PATH = 'research/mechanics/pre-breadth-source-closure.json' as const

// Structural Inventory property trees are versioned JSON and decoded values are intentionally heterogeneous.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonRecord = Record<string, any>
type AvailabilityState = 'known' | 'not-observed' | 'parser-boundary' | 'empirical-required' | 'not-found'

interface FactSelector {
  readonly id: string
  readonly names?: readonly string[]
  readonly pattern?: string
  readonly absentState?: AvailabilityState
  readonly boundaryReason?: string
}

const FACT_NAME_PATTERN = /damage|attack|cooldown|charge|delay|interval|recovery|loop|release|overheat|heat|effect|sequence|variant|actor|projectile|animation|notify|duration|heal|range|tick|sound|target|owner|scope|speed|modifier|multiplier|rate|count|number|angle|spread|radius|stack|activation|tome|spawn|fire|throw|hit|reset|trigger|health|power|cancel|stagger|knockback|stun|slow|burn|poison|soul|pet|arrow|bolt|beam|aura|pulse|distance|movement/i
const RELATION_PROPERTY_PATTERN = /gearactor|attacksequence|variantactiveeffect|variantchangeeffect|effect|itemactorclass|tomeactorclass|projectiledefinition|projectile|actorclass|spawnedactor|animation|notify|attackdefinition|attackdefintion|activationanimation|trigger.?sound|gameplayeffect|enchantment|owner|ownership|target|scope|super|template/i

const SELECTORS_BY_CATEGORY: Record<string, readonly FactSelector[]> = {
  melee: [
    ...['ConfiguredAttackVariants', 'Damage', 'DamageType', 'AttackAnimationTimeDurationSeconds', 'DamageDelaySeconds', 'CooldownSeconds', 'AttackVariantResetMultiplier', 'AttackVariantResetSeconds', 'VariantLoopAmount', 'ContinuousDamageInterval', 'AttackSequence', 'VariantActiveEffect', 'VariantChangeEffect'].map((name) => ({ id: name, names: [name] })),
    { id: 'animation-timeline', pattern: 'notify.*(time|duration|position)|montage.*(section|time)', absentState: 'parser-boundary', boundaryReason: 'The structural inventory does not decode non-CDO animation timeline payloads.' },
    { id: 'effective-continuous-or-release-cadence', pattern: 'effective.*(hps|dps|cadence)|release.*(timing|cadence)', absentState: 'empirical-required', boundaryReason: 'Configured static facts do not establish effective continuous/release cadence.' },
  ],
  ranged: [
    { id: 'AttackDefinition', names: ['AttackDefinition', 'AttackDefintion'] },
    ...['AttackRateSeconds', 'ChargeTimeSecond', 'ChargeDamageMultiplier', 'ProjectileDefinition', 'Damage', 'DamageType', 'DelaySeconds', 'DelaySecondsPerProjectile', 'Animation', 'AnimNotifyStateData', 'NotifyStateName', 'TriggerSound'].map((name) => ({ id: name, names: [name] })),
    { id: 'projectile-count', pattern: 'projectile.*(count|number)|number.*projectile|projectilesper', absentState: 'not-observed' },
    { id: 'angle-related-fields', pattern: 'angle|spread|cone|yaw|pitch', absentState: 'not-observed' },
    { id: 'notify-timeline', pattern: 'notify.*(time|duration|position|enter|exit)|montage.*(section|time)', absentState: 'parser-boundary', boundaryReason: 'Notify names can be decoded, but actual timeline and enter/exit times are not in the Structural Inventory.' },
    { id: 'effective-projectile-cadence', pattern: 'effective.*(hps|dps|cadence)', absentState: 'empirical-required', boundaryReason: 'Static attack/projectile configuration does not establish effective gameplay cadence.' },
  ],
  armor: [
    { id: 'GearActor', names: ['GearActor'] },
    { id: 'intrinsic-attack-speed-fields', pattern: 'attack.?speed|attackspeed', absentState: 'not-observed' },
    { id: 'intrinsic-cooldown-fields', pattern: 'cooldown', absentState: 'not-observed' },
    { id: 'intrinsic-damage-modifier-fields', pattern: 'damage.*(modifier|percent|multiplier|value)|modifier.*damage', absentState: 'not-observed' },
    { id: 'ownership-target-scope-fields', pattern: 'owner|ownership|target|scope', absentState: 'not-observed' },
    { id: 'built-in-enchantment-or-effect-relations', pattern: 'enchant|gameplayeffect|effect', absentState: 'not-observed' },
  ],
  artifact: [
    ...['Effect', 'ItemActorClass', 'TomeActorClass', 'ActivationAnimation', 'Duration', 'Range', 'TickInterval', 'LoopInterval', 'Damage', 'Heal'].map((name) => ({ id: name, names: [name] })),
    { id: 'spawned-actor-or-projectile-relations', pattern: 'spawn.*actor|actorclass|projectile|tomeactorclass|itemactorclass', absentState: 'not-observed' },
    { id: 'cooldown-start-semantics', pattern: 'cooldown.*(start|trigger|begin)|timer.*start', absentState: 'parser-boundary', boundaryReason: 'Blueprint non-CDO execution behavior is not decoded by the Structural Inventory.' },
    { id: 'effective-cooldown-behavior', pattern: 'effective.*cooldown', absentState: 'empirical-required', boundaryReason: 'Static configured values do not establish effective gameplay cooldown behavior.' },
  ],
}

interface PackageRecord {
  readonly path: string
  readonly gamePackageName: string
  readonly packageHash?: { readonly algorithm: string; readonly value: string }
  readonly sourceFiles: readonly JsonRecord[]
  readonly parse: JsonRecord
  readonly relevantFacts: readonly JsonRecord[]
  readonly unavailableRanges: readonly JsonRecord[]
  readonly payloadCoverage: JsonRecord
  readonly inheritanceChains: readonly JsonRecord[]
  readonly shardPath: string
  readonly shardUncompressedSha256: string
}

interface StructuralEdge {
  readonly id: string
  readonly kind: string
  readonly sourcePackage: string
  readonly sourceOccurrence: JsonRecord
  readonly targetObject?: string
  readonly targetPackageName?: string
  readonly targetPackage?: string
  readonly targetRawPackageIndex: number
  readonly targetKind: string
  readonly traversal: JsonRecord
}

interface TraversalEdge {
  readonly id: string
  readonly kind: string
  readonly sourcePackage: string
  readonly targetPackage: string
  readonly propertyPath?: string
  readonly serializedField?: string
}

export interface LoadedStructuralGraph {
  readonly manifest: JsonRecord
  readonly packagesByPath: Map<string, PackageRecord>
  readonly edgesBySource: Map<string, TraversalEdge[]>
  readonly relationEdgesBySource: Map<string, StructuralEdge[]>
  readonly edgeById: Map<string, StructuralEdge>
  readonly edgeCount: number
  readonly shardIdentityByPath: Map<string, { readonly compressedSha256: string; readonly uncompressedSha256: string }>
}

type PackageFactsInput = Pick<PackageRecord, 'path' | 'packageHash' | 'shardPath' | 'shardUncompressedSha256'> & {
  readonly cdoPropertyInventory: readonly JsonRecord[]
}

export interface HorizontalRawFactInventory extends JsonRecord {
  readonly schemaVersion: 1
  readonly artifactKind: 'horizontal-raw-fact-inventory'
  readonly items: readonly JsonRecord[]
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sha256(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord
}

export function loadStructuralGraph(repositoryRoot: string): LoadedStructuralGraph {
  const structuralRoot = path.join(repositoryRoot, path.dirname(STRUCTURAL_INVENTORY_PATH))
  const manifest = readJson(path.join(repositoryRoot, STRUCTURAL_INVENTORY_PATH))
  const packagesByPath = new Map<string, PackageRecord>()
  const edgeTargetsBySource = new Map<string, Map<string, TraversalEdge>>()
  const edgesBySource = new Map<string, TraversalEdge[]>()
  const relationEdgesBySource = new Map<string, StructuralEdge[]>()
  const edgeById = new Map<string, StructuralEdge>()
  const shardIdentityByPath = new Map<string, { compressedSha256: string; uncompressedSha256: string }>()
  let edgeCount = 0

  for (const shard of manifest.shards as JsonRecord[]) {
    const compressed = fs.readFileSync(path.join(structuralRoot, shard.path))
    if (sha256(compressed) !== shard.compressedSha256) throw new Error(`Structural inventory shard compressed hash drift: ${shard.path}`)
    const uncompressed = gunzipSync(compressed)
    if (uncompressed.byteLength !== shard.uncompressedBytes || sha256(uncompressed) !== shard.uncompressedSha256) {
      throw new Error(`Structural inventory shard content hash drift: ${shard.path}`)
    }
    const data = JSON.parse(uncompressed.toString('utf8')) as JsonRecord
    shardIdentityByPath.set(shard.path, { compressedSha256: shard.compressedSha256, uncompressedSha256: shard.uncompressedSha256 })
    for (const rawPackage of data.packages as JsonRecord[]) {
      if (packagesByPath.has(rawPackage.path)) throw new Error(`Duplicate Structural Inventory package path: ${rawPackage.path}`)
      const packageRecord = {
        path: rawPackage.path,
        gamePackageName: rawPackage.gamePackageName,
        ...(rawPackage.packageHash ? { packageHash: rawPackage.packageHash } : {}),
        sourceFiles: rawPackage.sourceFiles,
        parse: rawPackage.parse,
        unavailableRanges: rawPackage.unavailableRanges,
        payloadCoverage: rawPackage.payloadCoverage,
        inheritanceChains: rawPackage.inheritanceChains,
        shardPath: shard.path,
        shardUncompressedSha256: shard.uncompressedSha256,
      }
      packagesByPath.set(rawPackage.path, {
        ...packageRecord,
        relevantFacts: collectFactsForPackage({ ...packageRecord, cdoPropertyInventory: rawPackage.cdoPropertyInventory }, rawPackage.path),
      })
    }
    for (const rawEdge of data.edges as StructuralEdge[]) {
      if (rawEdge.targetPackage && isPotentialTraversalEdge(rawEdge)) {
        const edge: TraversalEdge = {
          id: rawEdge.id,
          kind: rawEdge.kind,
          sourcePackage: rawEdge.sourcePackage,
          targetPackage: rawEdge.targetPackage,
          ...(rawEdge.sourceOccurrence.propertyPath === undefined ? {} : { propertyPath: rawEdge.sourceOccurrence.propertyPath }),
          ...(rawEdge.sourceOccurrence.serializedField === undefined ? {} : { serializedField: rawEdge.sourceOccurrence.serializedField }),
        }
        const targets = edgeTargetsBySource.get(edge.sourcePackage) ?? new Map<string, TraversalEdge>()
        const previous = targets.get(edge.targetPackage)
        if (!previous || compare(edge.id, previous.id) < 0) targets.set(edge.targetPackage, edge)
        edgeTargetsBySource.set(edge.sourcePackage, targets)
      }
      if (isRelationProperty(rawEdge)) {
        if (edgeById.has(rawEdge.id)) throw new Error(`Duplicate Structural Inventory relation edge id: ${rawEdge.id}`)
        const relationEdge: StructuralEdge = {
          id: rawEdge.id,
          kind: rawEdge.kind,
          sourcePackage: rawEdge.sourcePackage,
          sourceOccurrence: rawEdge.sourceOccurrence,
          ...(rawEdge.targetObject === undefined ? {} : { targetObject: rawEdge.targetObject }),
          ...(rawEdge.targetPackageName === undefined ? {} : { targetPackageName: rawEdge.targetPackageName }),
          ...(rawEdge.targetPackage === undefined ? {} : { targetPackage: rawEdge.targetPackage }),
          targetRawPackageIndex: rawEdge.targetRawPackageIndex,
          targetKind: rawEdge.targetKind,
          traversal: rawEdge.traversal,
        }
        edgeById.set(relationEdge.id, relationEdge)
        const relationOutgoing = relationEdgesBySource.get(relationEdge.sourcePackage) ?? []
        relationOutgoing.push(relationEdge)
        relationEdgesBySource.set(relationEdge.sourcePackage, relationOutgoing)
      }
      edgeCount += 1
    }
  }

  if (packagesByPath.size !== manifest.summary.visitedPackageCount) throw new Error('Structural Inventory package count differs from its manifest summary')
  if (edgeCount !== manifest.summary.edgeCount) throw new Error('Structural Inventory edge count differs from its manifest summary')
  for (const [sourcePackage, targets] of edgeTargetsBySource) {
    edgesBySource.set(sourcePackage, [...targets.values()].sort((a, b) => compare(a.targetPackage ?? '', b.targetPackage ?? '') || compare(a.id, b.id)))
  }
  for (const edges of relationEdgesBySource.values()) edges.sort((a, b) => compare(a.id, b.id))
  return { manifest, packagesByPath, edgesBySource, relationEdgesBySource, edgeById, edgeCount, shardIdentityByPath }
}

export function isRelevantProperty(property: JsonRecord): boolean {
  const name = property.name?.value ?? ''
  const propertyPath = property.path ?? ''
  const type = property.type?.value ?? ''
  return FACT_NAME_PATTERN.test(`${name} ${propertyPath}`) || /ObjectProperty|ClassProperty|SoftObjectProperty/.test(type) && RELATION_PROPERTY_PATTERN.test(name)
}

function isRelationProperty(edge: StructuralEdge): boolean {
  const propertyPath = edge.sourceOccurrence.propertyPath ?? ''
  const serializedField = edge.sourceOccurrence.serializedField ?? ''
  return RELATION_PROPERTY_PATTERN.test(`${propertyPath} ${serializedField}`)
}

function isPotentialTraversalEdge(edge: StructuralEdge): boolean {
  if (['super', 'template'].includes(edge.kind) || ['superIndex', 'templateIndex'].includes(edge.sourceOccurrence.serializedField ?? '')) return true
  const propertyPath = edge.sourceOccurrence.propertyPath ?? ''
  const serializedField = edge.sourceOccurrence.serializedField ?? ''
  return /gearactor|attacksequence|variantactiveeffect|variantchangeeffect|gameplayeffect|effect|damage|attack|projectile|actor|animation|notify|activation|tome|itemactor|enchant|owner|ownership|target|scope/i.test(`${propertyPath} ${serializedField}`)
}

function isCategoryTraversalEdge(edge: TraversalEdge, category: string): boolean {
  if (['super', 'template'].includes(edge.kind) || ['superIndex', 'templateIndex'].includes(edge.serializedField ?? '')) return true
  const relationName = `${edge.propertyPath ?? ''} ${edge.serializedField ?? ''}`
  const patterns: Record<string, RegExp> = {
    melee: /gearactor|attacksequence|variantactiveeffect|variantchangeeffect|gameplayeffect|effect|damage|attack|animation|notify|actor|enchant/i,
    ranged: /gearactor|attackdefinition|attackdefintion|projectile|gameplayeffect|effect|damage|attack|animation|notify|actor|enchant/i,
    armor: /gearactor|armor|gameplayeffect|effect|damage|attack|modifier|enchant|actor|owner|target|scope/i,
    artifact: /effect|gameplayeffect|itemactor|tomeactor|projectile|actor|activationanimation|animation|notify|damage|heal|cooldown/i,
  }
  return (patterns[category] ?? /gearactor|effect|damage|attack|projectile|actor|animation|notify|enchant/i).test(relationName)
}

function availabilityForDecode(state: string | undefined): AvailabilityState {
  return state === 'decoded' ? 'known' : 'parser-boundary'
}

function propertyFact(
  property: JsonRecord,
  cdo: JsonRecord,
  packageRecord: PackageFactsInput,
  catalogCandidatePackage: string,
  pointer: string,
  elementIndex: number | undefined,
): JsonRecord {
  const decoding = property.decoding ?? {}
  const fact: JsonRecord = {
    factKind: elementIndex === undefined ? 'property-occurrence' : 'array-element-occurrence',
    propertyName: property.name?.value ?? '',
    propertyType: (elementIndex === undefined ? property.type?.value : property.metadata?.innerTypeReference?.value) ?? property.type?.value ?? 'unknown',
    propertyPath: property.path ?? property.name?.value ?? '',
    occurrence: {
      sourceOrder: property.order,
      arrayIndex: property.arrayIndex,
      ...(elementIndex === undefined ? {} : { elementIndex }),
    },
    availabilityState: availabilityForDecode(decoding.state),
    decodingState: decoding.state ?? 'missing-decode-state',
    source: {
      datasetId: '',
      inventoryManifestPath: STRUCTURAL_INVENTORY_PATH,
      sourceShardPath: `research/raw/game-data-raw-structural-inventory/${packageRecord.shardPath}`,
      sourceShardUncompressedSha256: packageRecord.shardUncompressedSha256,
      candidatePackage: catalogCandidatePackage,
      sourcePackage: packageRecord.path,
      sourcePackageHash: packageRecord.packageHash?.value ?? null,
      sourceObject: cdo.objectName,
      propertyPointer: pointer,
      sourceRange: property.sourceRange ?? null,
      valueRange: property.valueRange ?? null,
    },
  }
  if (elementIndex === undefined && Object.prototype.hasOwnProperty.call(decoding, 'value')) fact.decodedValue = decoding.value
  if (elementIndex !== undefined && Object.prototype.hasOwnProperty.call(decoding, 'value')) fact.decodedValue = decoding.value
  if (decoding.properties) fact.decodedValueType = 'structured-properties'
  else if (decoding.elements) fact.decodedValueType = 'ordered-array'
  else if (!Object.prototype.hasOwnProperty.call(decoding, 'value')) fact.decodedValueType = 'value-not-decoded'
  return fact
}

export function collectFactsForPackage(packageRecord: PackageFactsInput, candidatePackage: string): JsonRecord[] {
  const facts: JsonRecord[] = []
  for (let cdoIndex = 0; cdoIndex < packageRecord.cdoPropertyInventory.length; cdoIndex += 1) {
    const cdo = packageRecord.cdoPropertyInventory[cdoIndex]!
    const walk = (properties: readonly JsonRecord[], prefix: string): void => {
      for (let propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
        const property = properties[propertyIndex]!
        const pointer = `${prefix}/${propertyIndex}`
        if (isRelevantProperty(property)) facts.push(propertyFact(property, cdo, packageRecord, candidatePackage, pointer, undefined))
        const decoding = property.decoding ?? {}
        if (decoding.properties) walk(decoding.properties, `${pointer}/decoding/properties`)
        if (decoding.elements) {
          for (let elementOffset = 0; elementOffset < decoding.elements.length; elementOffset += 1) {
            const element = decoding.elements[elementOffset]!
            const elementPointer = `${pointer}/decoding/elements/${elementOffset}`
            if (isRelevantProperty(property)) {
              facts.push(propertyFact({ ...property, path: `${property.path ?? property.name?.value}[${element.index}]`, decoding: element.decoding }, cdo, packageRecord, candidatePackage, elementPointer, element.index))
            }
            if (element.properties) walk(element.properties, `${elementPointer}/properties`)
          }
        }
      }
    }
    walk(cdo.properties ?? [], `/cdoPropertyInventory/${cdoIndex}/properties`)
  }
  return facts
}

export function traverseCandidateGraph(rootPackage: string, graph: LoadedStructuralGraph, category = 'all'): { visited: Set<string>; parentEdgeByTarget: Map<string, TraversalEdge> } {
  if (!graph.packagesByPath.has(rootPackage)) throw new Error(`Candidate package is absent from the current Structural Inventory: ${rootPackage}`)
  const visited = new Set<string>([rootPackage])
  const parentEdgeByTarget = new Map<string, TraversalEdge>()
  const queue = [rootPackage]
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const sourcePackage = queue[queueIndex]!
    for (const edge of graph.edgesBySource.get(sourcePackage) ?? []) {
      if (!isCategoryTraversalEdge(edge, category)) continue
      const target = edge.targetPackage
      if (!target || !graph.packagesByPath.has(target) || visited.has(target)) continue
      visited.add(target)
      parentEdgeByTarget.set(target, edge)
      queue.push(target)
    }
  }
  return { visited, parentEdgeByTarget }
}

function edgePathToPackage(rootPackage: string, targetPackage: string, parentEdgeByTarget: Map<string, TraversalEdge>): string[] {
  if (targetPackage === rootPackage) return []
  const edgeIds: string[] = []
  let current = targetPackage
  const visited = new Set<string>()
  while (current !== rootPackage) {
    if (visited.has(current)) throw new Error(`Cycle in recorded BFS parent chain: ${current}`)
    visited.add(current)
    const edge = parentEdgeByTarget.get(current)
    if (!edge) throw new Error(`No relation path from candidate ${rootPackage} to source package ${targetPackage}`)
    edgeIds.push(edge.id)
    current = edge.sourcePackage
  }
  return edgeIds.reverse()
}

function edgeSequenceToPackage(rootPackage: string, targetPackage: string, parentEdgeByTarget: Map<string, TraversalEdge>): TraversalEdge[] {
  if (targetPackage === rootPackage) return []
  const edges: TraversalEdge[] = []
  let current = targetPackage
  const visited = new Set<string>()
  while (current !== rootPackage) {
    if (visited.has(current)) throw new Error(`Cycle in recorded BFS parent chain: ${current}`)
    visited.add(current)
    const edge = parentEdgeByTarget.get(current)
    if (!edge) throw new Error(`No relation path from candidate ${rootPackage} to source package ${targetPackage}`)
    edges.push(edge)
    current = edge.sourcePackage
  }
  return edges.reverse()
}

function relationPathId(rootPackage: string, edgeIds: readonly string[]): string {
  return edgeIds.length === 0 ? 'rp-root' : `rp-${sha256(`${rootPackage}\0${edgeIds.join('\0')}`).slice(0, 16)}`
}

function selectorMatchesFact(selector: FactSelector, fact: JsonRecord): boolean {
  const names = selector.names?.map((name) => name.toLowerCase())
  if (names?.includes(String(fact.propertyName).toLowerCase())) return true
  return selector.pattern ? new RegExp(selector.pattern, 'i').test(`${fact.propertyName} ${fact.propertyPath}`) : false
}

export function assessFactSelector(selector: FactSelector, facts: readonly JsonRecord[], noCandidate = false): AvailabilityState {
  if (noCandidate) return 'not-found'
  const matchingFacts = facts.filter((fact) => selectorMatchesFact(selector, fact))
  if (matchingFacts.some((fact) => fact.availabilityState === 'known')) return 'known'
  if (matchingFacts.some((fact) => fact.availabilityState === 'parser-boundary')) return 'parser-boundary'
  return selector.absentState ?? 'not-observed'
}

function edgeSummary(edge: StructuralEdge, relationPathIdValue: string): JsonRecord {
  const stopReason = edge.traversal.stopReason
  const isNull = stopReason === 'null-reference' || edge.targetKind === 'null'
  const targetState = edge.targetPackage ? 'resolved-local-package'
    : isNull ? 'known-null'
      : stopReason === 'native-boundary' ? 'native-boundary'
        : stopReason === 'outside-game-boundary' ? 'outside-game-boundary'
          : stopReason === 'missing-target' ? 'missing-target'
            : stopReason === 'parser-boundary' ? 'parser-boundary'
              : stopReason === 'unresolved-package-index' || stopReason === 'invalid-package-index' ? 'parser-boundary'
                : stopReason
  return {
    edgeId: edge.id,
    relationKind: edge.kind,
    sourcePackage: edge.sourcePackage,
    sourceObject: edge.sourceOccurrence.sourceObject ?? null,
    propertyPath: edge.sourceOccurrence.propertyPath ?? edge.sourceOccurrence.serializedField ?? null,
    arrayIndex: edge.sourceOccurrence.arrayIndex ?? null,
    sourceOccurrenceKind: edge.sourceOccurrence.kind,
    sourceRange: edge.sourceOccurrence.sourceRange ?? null,
    targetObject: edge.targetObject ?? null,
    targetPackageName: edge.targetPackageName ?? null,
    targetPackage: edge.targetPackage ?? null,
    targetRawPackageIndex: edge.targetRawPackageIndex,
    targetKind: edge.targetKind,
    traversalStopReason: stopReason,
    targetState,
    sourceRelationPathId: relationPathIdValue,
  }
}

function makeCandidate(
  seed: JsonRecord,
  candidate: JsonRecord,
  graph: LoadedStructuralGraph,
  datasetId: string,
): JsonRecord {
  const candidatePackage = candidate.packagePath as string
  const traversal = traverseCandidateGraph(candidatePackage, graph, seed.category)
  const visitedPackages = [...traversal.visited].sort(compare)
  const facts: JsonRecord[] = []
  const relations: JsonRecord[] = []
  const interestingPackages = new Set<string>([candidatePackage])

  for (const sourcePackage of visitedPackages) {
    const packageRecord = graph.packagesByPath.get(sourcePackage)!
    for (const sourceFact of packageRecord.relevantFacts) {
      const fact = {
        ...sourceFact,
        source: {
          ...sourceFact.source,
          datasetId,
          candidatePackage,
        },
      }
      facts.push(fact)
      interestingPackages.add(sourcePackage)
    }
    for (const edge of graph.relationEdgesBySource.get(sourcePackage) ?? []) {
      relations.push({ _edge: edge, _sourcePackage: sourcePackage })
      interestingPackages.add(sourcePackage)
    }
  }

  const boundaryPackages = visitedPackages.filter((sourcePackage) => {
    const packageRecord = graph.packagesByPath.get(sourcePackage)!
    return packageRecord.parse.state !== 'parsed' || packageRecord.unavailableRanges.some((range) => range.state === 'unsupported' || range.state === 'parse-failed' || range.state === 'not-extracted')
  })
  for (const boundaryPackage of boundaryPackages) interestingPackages.add(boundaryPackage)
  const pathRecords = [...interestingPackages].sort(compare).map((sourcePackage) => {
    const edgeSequence = edgeSequenceToPackage(candidatePackage, sourcePackage, traversal.parentEdgeByTarget)
    const edgeIds = edgeSequence.map((edge) => edge.id)
    return {
      id: relationPathId(candidatePackage, edgeIds),
      sourcePackage,
      edgeIds,
      edgeSequence: edgeSequence.map((edge) => ({ edgeId: edge.id, relationKind: edge.kind, sourcePackage: edge.sourcePackage, targetPackage: edge.targetPackage ?? null })),
    }
  })
  const relationPathIdByPackage = new Map(pathRecords.map((record) => [record.sourcePackage, record.id]))
  const availability = (SELECTORS_BY_CATEGORY[seed.category] ?? []).flatMap((selector) => {
    const state = assessFactSelector(selector, facts)
    if (state === 'known') return []
    return [{
      factSelector: selector.id,
      state,
      reason: selector.boundaryReason ?? (state === 'not-observed' ? 'No matching decoded source property occurrence was found in the traversed Structural Inventory closure.' : 'The candidate source does not establish this fact at the current parser/measurement boundary.'),
    }]
  })
  const formattedFacts = facts.map((fact) => ({
    ...fact,
    source: {
      ...fact.source,
      relationPathId: relationPathIdByPackage.get(fact.source.sourcePackage)!,
    },
  }))
  const formattedRelations = relations.map(({ _edge, _sourcePackage }) => edgeSummary(_edge, relationPathIdByPackage.get(_sourcePackage)!))
    .sort((a, b) => compare(a.sourcePackage, b.sourcePackage)
      || compare(a.sourceRange?.file ?? '', b.sourceRange?.file ?? '')
      || (a.sourceRange?.start ?? 0) - (b.sourceRange?.start ?? 0)
      || (a.arrayIndex ?? -1) - (b.arrayIndex ?? -1)
      || compare(a.edgeId, b.edgeId))
  const relevantBoundaryPackages = visitedPackages.flatMap((sourcePackage) => {
    const packageRecord = graph.packagesByPath.get(sourcePackage)!
    const unavailable = packageRecord.unavailableRanges.filter((range) => range.state === 'unsupported' || range.state === 'parse-failed' || range.state === 'not-extracted')
    if (packageRecord.parse.state === 'parsed' && unavailable.length === 0) return []
    return [{
      packagePath: sourcePackage,
      packageParseState: packageRecord.parse.state,
      unavailableRanges: unavailable.map((range) => ({ file: range.file, state: range.state, reason: range.reason })),
      relationPathId: relationPathIdByPackage.get(sourcePackage) ?? relationPathId(candidatePackage, edgePathToPackage(candidatePackage, sourcePackage, traversal.parentEdgeByTarget)),
    }]
  })

  return {
    candidateIndex: seed.index,
    packagePath: candidatePackage,
    objectName: candidate.objectName,
    role: candidate.role,
    evidence: candidate.evidence,
    candidateMappingStatus: seed.status,
    serializedIdentityEvidence: candidate.evidence.filter((entry: string) => entry.startsWith('serialized-identity')),
    candidatePackageProvenance: {
      inventoryManifestPath: STRUCTURAL_INVENTORY_PATH,
      packageHash: graph.packagesByPath.get(candidatePackage)?.packageHash?.value ?? null,
      sourceShardPath: `research/raw/game-data-raw-structural-inventory/${graph.packagesByPath.get(candidatePackage)!.shardPath}`,
      sourceShardUncompressedSha256: graph.packagesByPath.get(candidatePackage)!.shardUncompressedSha256,
    },
    traversal: {
      policy: 'breadth-first-over-existing-serialized-Structural-Inventory-edges-to-local-packages',
      visitedPackageCount: visitedPackages.length,
      rootPackage: candidatePackage,
      relationPaths: pathRecords,
      boundaries: relevantBoundaryPackages,
    },
    facts: formattedFacts,
    relations: formattedRelations,
    unavailableStates: availability,
  }
}

export function collectCandidateObservations(seed: JsonRecord, graph: LoadedStructuralGraph, datasetId: string): JsonRecord[] {
  return (seed.candidates as JsonRecord[]).map((candidate, index) => makeCandidate({ ...seed, index }, candidate, graph, datasetId))
}

function artifactCooldownState(catalogId: string, closure: JsonRecord): JsonRecord {
  const row = (closure.itemResults as JsonRecord[]).find((item) => item.catalogId === catalogId)
  if (!row) throw new Error(`Artifact cooldown closure is missing catalog seed ${catalogId}`)
  const classification = row.baseCooldownClassification as string
  const state: AvailabilityState = classification === 'static-known' ? 'known'
    : classification === 'static-relation-traversal' ? 'known'
      : classification === 'parser-boundary' ? 'parser-boundary'
        : classification === 'not-observed' ? 'not-observed'
          : 'not-found'
  return {
    state,
    classification,
    authorityPath: `${PRE_BREADTH_CLOSURE_PATH}#/artifactCooldownClosure/itemResults/${catalogId}`,
    observation: row.baseCooldownObservation,
    cooldownStartSemantics: {
      state: row.cooldownStartSemanticsClassification === 'parser-boundary' ? 'parser-boundary' : row.cooldownStartSemanticsClassification,
      observation: row.cooldownStartSemanticsObservation,
    },
  }
}

export function generateHorizontalRawFactInventory(repositoryRoot: string, loadedGraph = loadStructuralGraph(repositoryRoot)): HorizontalRawFactInventory {
  const graph = loadedGraph
  const closure = readJson(path.join(repositoryRoot, PRE_BREADTH_CLOSURE_PATH))
  const catalog = loadRawCatalog(repositoryRoot)
  const catalogById = new Map(catalog.map((item) => [`${item.category}:${item.catalogId}`, item]))
  const seeds = graph.manifest.catalogSeeds as JsonRecord[]
  const categories: Record<string, number> = {}
  const candidatesByStatus: Record<string, number> = {}
  const factStateCounts: Record<AvailabilityState, number> = { known: 0, 'not-observed': 0, 'parser-boundary': 0, 'empirical-required': 0, 'not-found': 0 }
  const sourceFactsById = new Map<string, JsonRecord>()
  const sourceRelationsById = new Map<string, JsonRecord>()
  let candidateAssignmentCount = 0
  const items = seeds.map((seed) => {
    const itemKey = `${seed.category}:${seed.catalogId}`
    const catalogItem = catalogById.get(itemKey)
    if (!catalogItem) throw new Error(`Structural Inventory seed no longer exists in the repository catalog: ${itemKey}`)
    if (catalogItem.displayName !== seed.catalogName || catalogItem.internalId !== seed.catalogInternalId) throw new Error(`Catalog metadata drift for ${itemKey}`)
    categories[seed.category] = (categories[seed.category] ?? 0) + 1
    candidatesByStatus[seed.status] = (candidatesByStatus[seed.status] ?? 0) + 1
    candidateAssignmentCount += seed.candidates.length
    const candidates = collectCandidateObservations(seed, graph, graph.manifest.scope.dataset.id)
    for (const candidate of candidates) {
      for (const fact of candidate.facts) factStateCounts[fact.availabilityState as AvailabilityState] += 1
      for (const unavailable of candidate.unavailableStates) factStateCounts[unavailable.state as AvailabilityState] += 1
      candidate.facts = candidate.facts.map((fact: JsonRecord) => {
        const { candidatePackage, relationPathId, ...source } = fact.source
        const factId = `sf-${sha256(`${source.sourcePackage}\0${source.sourcePackageHash}\0${source.propertyPointer}`).slice(0, 20)}`
        if (!sourceFactsById.has(factId)) sourceFactsById.set(factId, { factId, ...fact, source })
        return { sourceFactId: factId, availabilityState: fact.availabilityState, source: { candidatePackage, sourcePackage: source.sourcePackage, relationPathId } }
      })
      candidate.relations = candidate.relations.map((relation: JsonRecord) => {
        const { sourceRelationPathId, ...definition } = relation
        if (!sourceRelationsById.has(relation.edgeId)) sourceRelationsById.set(relation.edgeId, definition)
        return { edgeId: relation.edgeId, sourcePackage: relation.sourcePackage, sourceRelationPathId }
      })
    }
    const unavailableStates = candidates.length === 0
      ? (SELECTORS_BY_CATEGORY[seed.category] ?? []).map((selector) => ({ factSelector: selector.id, state: 'not-found' as const, reason: 'No Raw candidate package was assigned to this catalog item.' }))
      : []
    for (const unavailable of unavailableStates) factStateCounts[unavailable.state] += 1
    return {
      category: seed.category,
      catalogId: seed.catalogId,
      displayName: seed.catalogName,
      ...(seed.catalogInternalId === undefined ? {} : { catalogInternalId: seed.catalogInternalId }),
      presentationHint: seed.presentationHint ?? null,
      rawCandidate: {
        status: seed.status,
        matchBasis: seed.matchBasis,
        candidateCount: candidates.length,
        candidates,
      },
      unavailableStates,
      ...(seed.category === 'artifact' ? { artifactCooldown: artifactCooldownState(seed.catalogId, closure.artifactCooldownClosure) } : {}),
    }
  })
  const cooldown = closure.artifactCooldownClosure
  const cooldownPartition = {
    staticKnown: cooldown.staticKnown.length,
    staticRelationTraversal: cooldown.staticRelationTraversal.length,
    parserBoundary: cooldown.parserBoundary.length,
    notObserved: cooldown.notObserved.length,
  }
  return {
    schemaVersion: HORIZONTAL_FACT_INVENTORY_SCHEMA_VERSION,
    artifactKind: 'horizontal-raw-fact-inventory',
    generation: {
      deterministic: true,
      generator: 'scripts/game-data-horizontal-fact-inventory.ts',
      baselineCommit: 'ad71fc354dba54fe12733bc3b5825b1742ff5917',
      generatedFrom: [
        STRUCTURAL_INVENTORY_PATH,
        `${path.dirname(STRUCTURAL_INVENTORY_PATH)}/shards/*.json.gz`,
        PRE_BREADTH_CLOSURE_PATH,
        'research/melee-attack-profile-audit.json',
        'research/armor-audit.json',
        'research/ranged-weapon-audit.json',
        'research/artifact-audit.json',
      ],
    },
    inventoryIdentity: {
      datasetId: graph.manifest.scope.dataset.id,
      sourceFingerprint: graph.manifest.scope.dataset.sourceFingerprint,
      structuralInventoryManifestPath: STRUCTURAL_INVENTORY_PATH,
      structuralInventoryManifestSha256: sha256(fs.readFileSync(path.join(repositoryRoot, STRUCTURAL_INVENTORY_PATH))),
      structuralInventoryShardIdentity: 'Each referenced shard path and uncompressedSha256 is recorded in candidate/fact provenance; compressed and uncompressed hashes are verified during generation.',
      structuralInventorySummary: {
        seedCount: graph.manifest.summary.seedCount,
        candidateSeedCount: graph.manifest.summary.candidateSeedCount,
        parsedPackageCount: graph.manifest.summary.parsedPackageCount,
        edgeCount: graph.edgeCount,
        shardCount: graph.manifest.shards.length,
      },
    },
    identityBoundary: {
      rawCandidateStatusIsNotFormalIdentity: true,
      oneCandidateDoesNotProveCanonicalIdentity: true,
      formalIdentityProjection: 'not-consulted',
      rawExactMeaning: 'Raw candidate mapping evidence only; no Formal Identity promotion is implied.',
    },
    factSemantics: {
      availabilityStates: ['known', 'not-observed', 'parser-boundary', 'empirical-required', 'not-found'],
      zeroFalseAndEmptyValuesAreRetainedOnlyWhenExplicitlyDecoded: true,
      configuredOrSerializedValueDoesNotAssertEffectiveGameplayBehavior: true,
      propertySelection: 'Broad source-property discovery terms retain category-relevant serialized occurrences; names are not canonical semantic aliases.',
    },
    categoryCounts: categories,
    candidateStatusCounts: candidatesByStatus,
    summary: {
      catalogItemCount: items.length,
      candidateAssignmentCount,
      categoryCounts: categories,
      candidateStatusCounts: candidatesByStatus,
      factStateCounts,
      artifactBaseCooldownPartition: cooldownPartition,
      ambiguousCandidatesKeptSeparate: true,
      formalMatchedPopulationReadOnly: 52,
    },
    sourceFacts: [...sourceFactsById.values()].sort((a, b) => compare(a.factId, b.factId)),
    sourceRelations: [...sourceRelationsById.values()].sort((a, b) => compare(a.edgeId, b.edgeId)),
    items,
  }
}

export function serializeHorizontalRawFactInventory(inventory: HorizontalRawFactInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`
}

export function compressHorizontalRawFactInventory(inventory: HorizontalRawFactInventory): Buffer {
  const compressed = gzipSync(Buffer.from(serializeHorizontalRawFactInventory(inventory)), { level: 9 })
  compressed.fill(0, 4, 8)
  compressed[9] = 255
  return compressed
}

export function validateHorizontalRawFactInventory(
  inventory: HorizontalRawFactInventory,
  graph: LoadedStructuralGraph,
  repositoryRoot: string,
): string[] {
  const errors: string[] = []
  const seeds = graph.manifest.catalogSeeds as JsonRecord[]
  const seedById = new Map(seeds.map((seed) => [`${seed.category}:${seed.catalogId}`, seed]))
  const itemById = new Map<string, JsonRecord>()
  const sourceFactsById = new Map<string, JsonRecord>()
  const sourceRelationsById = new Map<string, JsonRecord>()
  for (const fact of inventory.sourceFacts ?? []) {
    if (sourceFactsById.has(fact.factId)) errors.push(`Duplicate source fact identity: ${fact.factId}`)
    sourceFactsById.set(fact.factId, fact)
  }
  for (const relation of inventory.sourceRelations ?? []) {
    if (sourceRelationsById.has(relation.edgeId)) errors.push(`Duplicate source relation identity: ${relation.edgeId}`)
    sourceRelationsById.set(relation.edgeId, relation)
  }
  const computedCategoryCounts: Record<string, number> = {}
  if (inventory.schemaVersion !== 1 || inventory.artifactKind !== 'horizontal-raw-fact-inventory') errors.push('Unsupported horizontal Raw fact inventory artifact identity')
  if (inventory.items.length !== 271) errors.push(`Expected 271 horizontal inventory items; found ${inventory.items.length}`)
  for (const item of inventory.items) {
    const key = `${item.category}:${item.catalogId}`
    if (itemById.has(key)) errors.push(`Duplicate horizontal inventory catalog item: ${key}`)
    itemById.set(key, item)
    computedCategoryCounts[item.category] = (computedCategoryCounts[item.category] ?? 0) + 1
    const seed = seedById.get(key)
    if (!seed) {
      errors.push(`Horizontal inventory item is absent from the Structural Inventory catalog seeds: ${key}`)
      continue
    }
    if (item.displayName !== seed.catalogName || item.catalogInternalId !== seed.catalogInternalId) errors.push(`Catalog identity metadata drift: ${key}`)
    if (item.rawCandidate.status !== seed.status) errors.push(`Raw candidate status drift: ${key}`)
    if (item.rawCandidate.candidateCount !== seed.candidates.length || item.rawCandidate.candidates.length !== seed.candidates.length) errors.push(`Raw candidate population drift: ${key}`)
    if (JSON.stringify(item.rawCandidate.matchBasis) !== JSON.stringify(seed.matchBasis)) errors.push(`Raw candidate match basis drift: ${key}`)
    for (let candidateIndex = 0; candidateIndex < seed.candidates.length; candidateIndex += 1) {
      const expectedCandidate = seed.candidates[candidateIndex]!
      const candidate = item.rawCandidate.candidates[candidateIndex]
      if (!candidate) continue
      if (candidate.packagePath !== expectedCandidate.packagePath || candidate.objectName !== expectedCandidate.objectName || candidate.role !== expectedCandidate.role) errors.push(`Candidate package/role drift: ${key} candidate ${candidateIndex}`)
      if (!graph.packagesByPath.has(candidate.packagePath)) errors.push(`Candidate package is absent from the Structural Inventory: ${candidate.packagePath}`)
      if (candidate.candidateMappingStatus !== seed.status) errors.push(`Candidate Raw mapping status drift: ${key} candidate ${candidateIndex}`)
      if (!Array.isArray(candidate.facts) || !Array.isArray(candidate.relations) || !Array.isArray(candidate.unavailableStates)) errors.push(`Candidate fact/state arrays are missing: ${key} candidate ${candidateIndex}`)
      const pathById = new Map((candidate.traversal?.relationPaths ?? []).map((relationPath: JsonRecord) => [relationPath.id, relationPath]))
      for (const relationPath of candidate.traversal?.relationPaths ?? []) {
        let expectedSource = candidate.packagePath
        for (const hop of relationPath.edgeSequence ?? []) {
          const outgoing = graph.edgesBySource.get(hop.sourcePackage) ?? []
          const matchingEdge = outgoing.find((edge) => edge.id === hop.edgeId && edge.targetPackage === hop.targetPackage && edge.kind === hop.relationKind)
          if (hop.sourcePackage !== expectedSource || !matchingEdge || !hop.targetPackage || !graph.packagesByPath.has(hop.targetPackage)) errors.push(`Relation path edge target/source drift: ${hop.edgeId}`)
          expectedSource = hop.targetPackage ?? ''
        }
        if (expectedSource !== relationPath.sourcePackage || JSON.stringify(relationPath.edgeIds) !== JSON.stringify((relationPath.edgeSequence ?? []).map((hop: JsonRecord) => hop.edgeId))) errors.push(`Relation path does not resolve to its declared package: ${relationPath.id}`)
      }
      for (const fact of candidate.facts ?? []) {
        const sourceFact = sourceFactsById.get(fact.sourceFactId)
        const propertyPath = sourceFact?.propertyPath ?? fact.sourceFactId
        if (!sourceFact) {
          errors.push(`Candidate references an absent source fact: ${key}:${fact.sourceFactId}`)
          continue
        }
        if (!['known', 'parser-boundary'].includes(fact.availabilityState) || fact.availabilityState !== sourceFact.availabilityState) errors.push(`Invalid source occurrence availability state: ${key}:${propertyPath}`)
        const source = sourceFact.source
        if (!source?.datasetId || source.datasetId !== graph.manifest.scope.dataset.id) errors.push(`Fact is missing matching dataset provenance: ${key}:${propertyPath}`)
        if (!source?.inventoryManifestPath || !source?.sourceShardPath || !source?.sourceShardUncompressedSha256 || !source?.sourcePackage || !source?.propertyPointer) errors.push(`Fact provenance is incomplete: ${key}:${propertyPath}`)
        const sourcePackage = graph.packagesByPath.get(source.sourcePackage)
        if (!sourcePackage) errors.push(`Fact source package is absent from Structural Inventory: ${key}:${source.sourcePackage}`)
        else if (source.sourcePackageHash !== (sourcePackage.packageHash?.value ?? null)) errors.push(`Fact source package hash drift: ${key}:${source.sourcePackage}`)
        if (fact.availabilityState === 'known' && source.sourcePackageHash === null) errors.push(`Known fact source package hash is unavailable: ${key}:${propertyPath}`)
        if (fact.source?.candidatePackage !== candidate.packagePath || !fact.source?.relationPathId) errors.push(`Fact was merged across Raw candidates or lost traversal provenance: ${key}:${propertyPath}`)
        const relationPath = pathById.get(fact.source.relationPathId) as JsonRecord | undefined
        if (!relationPath || relationPath.sourcePackage !== fact.source.sourcePackage) errors.push(`Fact relation provenance does not terminate at its source package: ${key}:${propertyPath}`)
      }
      for (const relation of candidate.relations ?? []) {
        const edge = graph.edgeById.get(relation.edgeId)
        const definition = sourceRelationsById.get(relation.edgeId)
        if (!edge || !definition) errors.push(`Relation occurrence references a missing Structural Inventory edge: ${relation.edgeId}`)
        else {
          if (edge.sourcePackage !== relation.sourcePackage || definition.sourcePackage !== relation.sourcePackage) errors.push(`Relation occurrence drift: ${relation.edgeId}`)
          if (!relation.sourceRelationPathId || !pathById.has(relation.sourceRelationPathId)) errors.push(`Relation occurrence has no traversal provenance: ${relation.edgeId}`)
          if (definition.targetPackage && !graph.packagesByPath.has(definition.targetPackage)) errors.push(`Relation target package is missing without a parser boundary: ${relation.edgeId}`)
          if (!definition.targetPackage && !['known-null', 'native-boundary', 'outside-game-boundary', 'missing-target', 'parser-boundary', 'unresolved-package-index', 'invalid-package-index'].includes(definition.targetState)) errors.push(`Relation target has no explicit unavailable boundary: ${relation.edgeId}`)
        }
      }
      for (const unavailable of candidate.unavailableStates ?? []) {
        if (!['not-observed', 'parser-boundary', 'empirical-required', 'not-found'].includes(unavailable.state)) errors.push(`Invalid unavailable state: ${key}:${unavailable.factSelector}`)
        if (!unavailable.reason) errors.push(`Unavailable state lacks reason: ${key}:${unavailable.factSelector}`)
      }
    }
    for (const unavailable of item.unavailableStates ?? []) {
      if (unavailable.state !== 'not-found' || !unavailable.reason) errors.push(`Candidate-free item has invalid unavailable state: ${key}`)
    }
  }
  for (const key of seedById.keys()) if (!itemById.has(key)) errors.push(`Structural Inventory catalog seed is missing from horizontal inventory: ${key}`)
  if (JSON.stringify(computedCategoryCounts) !== JSON.stringify(inventory.summary?.categoryCounts)) errors.push('Category populations differ from the horizontal inventory summary')
  if (JSON.stringify(computedCategoryCounts) !== JSON.stringify(inventory.categoryCounts)) errors.push('Category populations differ from the horizontal inventory header')

  const catalog = loadRawCatalog(repositoryRoot)
  if (catalog.length !== 271) errors.push(`Current repository catalog population differs from 271: ${catalog.length}`)
  for (const entry of catalog) {
    const item = itemById.get(`${entry.category}:${entry.catalogId}`)
    if (!item || item.displayName !== entry.displayName || item.catalogInternalId !== entry.internalId) errors.push(`Current catalog does not match horizontal inventory metadata: ${entry.category}:${entry.catalogId}`)
  }
  if (inventory.identityBoundary?.rawCandidateStatusIsNotFormalIdentity !== true || inventory.identityBoundary?.formalIdentityProjection !== 'not-consulted') errors.push('Raw candidate / Formal Identity boundary is missing or weakened')
  if (inventory.summary?.formalMatchedPopulationReadOnly !== 52) errors.push('Formal matched population boundary must remain read-only at 52')
  if (inventory.summary?.ambiguousCandidatesKeptSeparate !== true) errors.push('Ambiguous candidate facts are not declared as separated')
  const shivering = itemById.get('ranged:shivering-bow')
  if (!shivering || shivering.rawCandidate.status !== 'provisional' || shivering.rawCandidate.candidates.some((candidate: JsonRecord) => candidate.role === 'instance') || !shivering.rawCandidate.candidates.some((candidate: JsonRecord) => candidate.role === 'storable')) errors.push('Shivering Bow storable/instance candidate distinction drift')
  const cooldown = inventory.summary?.artifactBaseCooldownPartition
  if (JSON.stringify(cooldown) !== JSON.stringify({ staticKnown: 0, staticRelationTraversal: 0, parserBoundary: 5, notObserved: 40 })) errors.push('Artifact base cooldown partition drift')
  const closure = readJson(path.join(repositoryRoot, PRE_BREADTH_CLOSURE_PATH)).artifactCooldownClosure
  const expectedCooldownById = new Map((closure.itemResults as JsonRecord[]).map((row) => [row.catalogId, row]))
  for (const item of inventory.items.filter((entry: JsonRecord) => entry.category === 'artifact')) {
    const expected = expectedCooldownById.get(item.catalogId) as JsonRecord | undefined
    if (!expected || item.artifactCooldown?.classification !== expected.baseCooldownClassification || item.artifactCooldown?.state !== (expected.baseCooldownClassification === 'parser-boundary' ? 'parser-boundary' : 'not-observed')) {
      errors.push(`Artifact cooldown authority partition changed: ${item.catalogId}`)
    }
    if (item.artifactCooldown?.cooldownStartSemantics?.state !== 'parser-boundary') errors.push(`Artifact cooldown start semantics boundary changed: ${item.catalogId}`)
  }
  // formalMatchedPopulationReadOnly records the population at this Raw inventory snapshot's capture.
  // This audit intentionally does not consult or constrain later Formal Identity waves.
  return [...new Set(errors)].sort(compare)
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = generateHorizontalRawFactInventory(repositoryRoot)
  const outputPath = path.join(repositoryRoot, HORIZONTAL_FACT_INVENTORY_PATH)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, compressHorizontalRawFactInventory(artifact))
  console.log(`Generated horizontal Raw fact inventory: ${artifact.items.length} catalog items; ${artifact.summary.candidateAssignmentCount} candidate assignments; ${outputPath}`)
}
