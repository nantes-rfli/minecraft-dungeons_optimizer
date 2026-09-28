import {
  horizontalCollectionFieldFromResolved,
  horizontalScalarFieldFromResolved,
  readHorizontalRawFactInventory,
  resolveDirectHorizontalSourceFact,
  type ResolvedHorizontalSourceFact,
} from './formal-value-horizontal-source.ts'
import type { HorizontalRawFactInventory, JsonRecord } from './game-data-horizontal-fact-inventory.ts'
import {
  formalIdentityDefinitions,
} from '../src/domain/formal/identityDefinitions.ts'
import { matchedIdentityDomainIdFromSource } from '../src/domain/formal/boundarySource.ts'
import {
  type FormalHorizontalConfiguredValueSource,
} from '../src/domain/formal/valueAvailability.ts'
import {
  type FormalIdentityDefinition,
  type FormalIdentityEvidenceArtifact,
  type FormalSemanticIdentity,
  type RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import { horizontalMeleeValueMappings, horizontalRangedValueMappings } from '../src/domain/formal/horizontalValueMappings.ts'
import type { Field, Trace } from '../src/domain/formal/rawProjection.ts'
import type { MeleeConfiguredEntry, RangedConfiguredEntry } from '../src/domain/formal/configuredValueReaders.ts'

type SourceFact = JsonRecord & {
  factId: string
  factKind: string
  propertyName: string
  propertyType: string
  propertyPath: string
  occurrence: JsonRecord
  source: JsonRecord
}
type CandidateFactReference = {
  sourceFactId: string
  source: { candidatePackage: string; sourcePackage: string; relationPathId: string }
}
type HorizontalCandidate = { packagePath: string; facts: CandidateFactReference[] }
type HorizontalItem = {
  category: string
  catalogId: string
  rawCandidate: { candidates: HorizontalCandidate[] }
}
type InventoryView = HorizontalRawFactInventory & {
  sourceFacts: SourceFact[]
  items: HorizontalItem[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function committedIdentity(
  artifact: FormalIdentityEvidenceArtifact,
  definition: FormalIdentityDefinition,
  identity: FormalSemanticIdentity,
): RawObservationEvidenceRecord[] {
  const assertions = artifact.identityAssertions.filter(({ id }) => id === definition.assertion.id)
  if (assertions.length !== 1 || canonicalJson(assertions[0]) !== canonicalJson(definition.assertion)) {
    throw new Error(`${definition.assertion.id}: committed Identity assertion differs from its Formal definition`)
  }
  const matches = artifact.semantic.identities.filter(({ assertionId }) => assertionId === definition.assertion.id)
  if (matches.length !== 1 || matches[0] !== identity || identity.resolution.state !== 'matched'
    || identity.resolution.domainId !== definition.assertion.domainId) {
    throw new Error(`${definition.assertion.id}: committed matched Identity does not resolve exactly once`)
  }
  return artifact.provenance.evidence.filter((record): record is RawObservationEvidenceRecord =>
    record.kind === 'raw-observation' && identity.resolution.evidenceRefs.includes(record.id))
}

function sourcePackage(fact: SourceFact): string {
  return typeof fact.source.sourcePackage === 'string' ? fact.source.sourcePackage : ''
}

function sourcePointer(fact: SourceFact): string {
  return typeof fact.source.propertyPointer === 'string' ? fact.source.propertyPointer : ''
}

function factIndex(factsById: ReadonlyMap<string, SourceFact>, id: string): SourceFact {
  const fact = factsById.get(id)
  if (!fact) throw new Error(`Horizontal source fact is missing from the inventory: ${id}`)
  return fact
}

function exactFactId(
  references: readonly CandidateFactReference[],
  factsById: ReadonlyMap<string, SourceFact>,
  packagePath: string,
  propertyName: string,
  propertyPath: string,
  factKind = 'property-occurrence',
): string {
  const matches = references.filter((reference) => reference.source.candidatePackage === packagePath
    && reference.source.sourcePackage === packagePath && reference.source.relationPathId === 'rp-root')
    .map(({ sourceFactId }) => factIndex(factsById, sourceFactId))
    .filter((fact) => fact.factKind === factKind && fact.propertyName === propertyName
      && fact.propertyPath === propertyPath && sourcePackage(fact) === packagePath)
  if (matches.length !== 1) {
    throw new Error(`${packagePath}:${propertyPath}: expected one exact rp-root source occurrence, found ${matches.length}`)
  }
  return matches[0]!.factId
}

function exactArrayElementIds(
  references: readonly CandidateFactReference[],
  factsById: ReadonlyMap<string, SourceFact>,
  packagePath: string,
  parent: ResolvedHorizontalSourceFact,
): string[] {
  const elementPrefix = `${parent.propertyPointer}/decoding/elements/`
  const matches = references.filter((reference) => reference.source.candidatePackage === packagePath
    && reference.source.sourcePackage === packagePath && reference.source.relationPathId === 'rp-root')
    .map(({ sourceFactId }) => factIndex(factsById, sourceFactId))
    .flatMap((fact) => {
      const pointer = sourcePointer(fact)
      const suffix = pointer.startsWith(elementPrefix) ? pointer.slice(elementPrefix.length) : ''
      return fact.factKind === 'array-element-occurrence' && fact.propertyName === parent.propertyName
        && sourcePackage(fact) === packagePath && /^\d+$/.test(suffix) ? [{ fact, offset: Number(suffix) }] : []
    })
    .sort((left, right) => left.offset - right.offset)
  if (new Set(matches.map(({ offset }) => offset)).size !== matches.length) {
    throw new Error(`${packagePath}:${parent.propertyPath}: duplicate array element pointer in Horizontal facts`)
  }
  return matches.map(({ fact }) => fact.factId)
}

function exactChildFactId(
  references: readonly CandidateFactReference[],
  factsById: ReadonlyMap<string, SourceFact>,
  packagePath: string,
  element: ResolvedHorizontalSourceFact,
  propertyName: string,
): string | undefined {
  const childPrefix = `${element.propertyPointer}/properties/`
  const expectedPath = `${element.propertyPath}.${propertyName}`
  const matches = references.filter((reference) => reference.source.candidatePackage === packagePath
    && reference.source.sourcePackage === packagePath && reference.source.relationPathId === 'rp-root')
    .map(({ sourceFactId }) => factIndex(factsById, sourceFactId))
    .filter((fact) => {
      const suffix = sourcePointer(fact).startsWith(childPrefix) ? sourcePointer(fact).slice(childPrefix.length) : ''
      return /^\d+$/.test(suffix) && fact.factKind === 'property-occurrence'
        && fact.propertyName === propertyName && fact.propertyPath === expectedPath && sourcePackage(fact) === packagePath
    })
  return matches.length === 1 ? matches[0]!.factId : undefined
}

function unknownChild<T extends string | number>(trace: Trace, reason: string): Field<T> {
  return { state: 'unknown', reason, trace }
}

function readChild<T extends string | number>(args: {
  repositoryRoot: string
  inventory: HorizontalRawFactInventory
  category: 'melee' | 'ranged'
  catalogId: string
  packagePath: string
  references: readonly CandidateFactReference[]
  factsById: ReadonlyMap<string, SourceFact>
  element: ResolvedHorizontalSourceFact
  elementFactId: string
  identityAssertionId: string
  mappingId: string
  propertyName: string
  propertyType: string
  valueType: 'number' | 'string'
}): Field<T> {
  const sourceFactId = exactChildFactId(args.references, args.factsById, args.packagePath, args.element, args.propertyName)
  const fallbackTrace = {
    raw: args.element.raw,
    mappingId: args.mappingId,
    identityAssertionId: args.identityAssertionId,
  }
  if (!sourceFactId) return unknownChild(fallbackTrace, `Required exact ${args.propertyName} source occurrence is missing or ambiguous`)
  const resolved = resolveDirectHorizontalSourceFact(args.repositoryRoot, args.inventory, {
    category: args.category,
    catalogId: args.catalogId,
    candidatePackage: args.packagePath,
    sourceFactId,
  })
  const field = horizontalScalarFieldFromResolved<T>(
    resolved,
    args.mappingId,
    args.identityAssertionId,
    args.propertyName,
    args.propertyType,
    args.valueType,
  )
  if (args.element.sourceFactId !== args.elementFactId || args.element.factKind !== 'array-element-occurrence'
    || !Number.isInteger(args.element.sourceIndex) || (args.element.sourceIndex ?? -1) < 0
    || resolved.factKind !== 'property-occurrence'
    || !resolved.propertyPointer.startsWith(`${args.element.propertyPointer}/properties/`)
    || resolved.propertyPath !== `${args.element.propertyPath}.${args.propertyName}`) {
    return unknownChild(field.trace, `Horizontal ${args.propertyName} occurrence is not owned by its exact array element`)
  }
  return field
}

function collectionParent(args: {
  repositoryRoot: string
  inventory: HorizontalRawFactInventory
  category: 'melee' | 'ranged'
  catalogId: string
  packagePath: string
  references: readonly CandidateFactReference[]
  factsById: ReadonlyMap<string, SourceFact>
  parentName: string
  parentPath: string
  mappingId: string
  identityAssertionId: string
}): { sourceFactId: string; resolved: ResolvedHorizontalSourceFact; elementFactIds: string[]; elements: ResolvedHorizontalSourceFact[]; field: Field<number[]> } {
  const sourceFactId = exactFactId(args.references, args.factsById, args.packagePath, args.parentName, args.parentPath)
  const resolved = resolveDirectHorizontalSourceFact(args.repositoryRoot, args.inventory, {
    category: args.category,
    catalogId: args.catalogId,
    candidatePackage: args.packagePath,
    sourceFactId,
  })
  const elementFactIds = exactArrayElementIds(args.references, args.factsById, args.packagePath, resolved)
  const elements = elementFactIds.map((id) => resolveDirectHorizontalSourceFact(args.repositoryRoot, args.inventory, {
    category: args.category,
    catalogId: args.catalogId,
    candidatePackage: args.packagePath,
    sourceFactId: id,
  }))
  const field = horizontalCollectionFieldFromResolved(
    resolved,
    elements,
    args.mappingId,
    args.identityAssertionId,
    args.parentName,
  )
  return { sourceFactId, resolved, elementFactIds, elements, field }
}

function buildMeleeSource(args: {
  repositoryRoot: string
  inventory: HorizontalRawFactInventory
  catalogId: string
  packagePath: string
  references: readonly CandidateFactReference[]
  factsById: ReadonlyMap<string, SourceFact>
  definition: FormalIdentityDefinition
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
}): FormalHorizontalConfiguredValueSource {
  const mapping = horizontalMeleeValueMappings(args.definition.assertion.domainId)
  const parent = collectionParent({
    ...args,
    category: 'melee',
    parentName: mapping.entries.rawField,
    parentPath: mapping.entries.rawField,
    mappingId: mapping.entries.id,
    identityAssertionId: args.definition.assertion.id,
  })
  const entries: MeleeConfiguredEntry[] = []
  if (parent.field.state === 'known') {
    parent.field.value.forEach((sourceIndex, position) => {
      const element = parent.elements[position]!
      const elementFactId = parent.elementFactIds[position]!
      const common = {
        repositoryRoot: args.repositoryRoot,
        inventory: args.inventory,
        category: 'melee' as const,
        catalogId: args.catalogId,
        packagePath: args.packagePath,
        references: args.references,
        factsById: args.factsById,
        element,
        elementFactId,
        identityAssertionId: args.definition.assertion.id,
      }
      entries.push({
        sourceIndex,
        configuredDamage: readChild({ ...common, mappingId: mapping.damage.id, propertyName: mapping.damage.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredAnimationDurationSeconds: readChild({ ...common, mappingId: mapping.duration.id, propertyName: mapping.duration.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredAttackRange: readChild({ ...common, mappingId: mapping.attackRange.id, propertyName: mapping.attackRange.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredConeAngleDegrees: readChild({ ...common, mappingId: mapping.coneAngle.id, propertyName: mapping.coneAngle.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredConeOffsetUnits: readChild({ ...common, mappingId: mapping.coneOffset.id, propertyName: mapping.coneOffset.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredDamageSplashMultiplier: readChild({ ...common, mappingId: mapping.splashMultiplier.id, propertyName: mapping.splashMultiplier.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredDamageDelaySeconds: readChild({ ...common, mappingId: mapping.damageDelay.id, propertyName: mapping.damageDelay.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        configuredAttackVariantType: readChild({ ...common, mappingId: mapping.variantType.id, propertyName: mapping.variantType.rawField, propertyType: 'EnumProperty', valueType: 'string' }),
        configuredVariantLoopAmount: readChild({ ...common, mappingId: mapping.variantLoopAmount.id, propertyName: mapping.variantLoopAmount.rawField, propertyType: 'IntProperty', valueType: 'number' }),
      })
    })
  }
  const configuredAttacks: Field<MeleeConfiguredEntry[]> = parent.field.state === 'known'
    ? { state: 'known', value: entries, trace: parent.field.trace }
    : { state: parent.field.state, reason: parent.field.reason, trace: parent.field.trace }
  const domainId = matchedIdentityDomainIdFromSource(parent.field.trace.raw, args.definition, args.identity, args.identityEvidence)
  if (domainId !== args.definition.assertion.domainId) throw new Error(`${domainId ?? args.definition.assertion.id}: Horizontal Melee source failed the committed Identity gate`)
  return {
    sourceProvenance: parent.field.trace.raw,
    definition: args.definition,
    identity: args.identity,
    identityEvidence: args.identityEvidence,
    category: 'melee',
    mapping,
    values: { configuredAttacks },
  }
}

function buildRangedSource(args: {
  repositoryRoot: string
  inventory: HorizontalRawFactInventory
  catalogId: string
  packagePath: string
  references: readonly CandidateFactReference[]
  factsById: ReadonlyMap<string, SourceFact>
  definition: FormalIdentityDefinition
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
}): FormalHorizontalConfiguredValueSource {
  const mapping = horizontalRangedValueMappings(args.definition.assertion.domainId)
  const attackDefinitionId = exactFactId(args.references, args.factsById, args.packagePath, 'AttackDefintion', 'AttackDefintion')
  const attackDefinition = resolveDirectHorizontalSourceFact(args.repositoryRoot, args.inventory, {
    category: 'ranged', catalogId: args.catalogId, candidatePackage: args.packagePath, sourceFactId: attackDefinitionId,
  })
  if (attackDefinition.propertyType !== 'StructProperty' || attackDefinition.availabilityState !== 'known'
    || attackDefinition.decodingState !== 'decoded') {
    throw new Error(`${args.packagePath}: AttackDefintion is not an available decoded StructProperty`)
  }
  const collectionPath = `${attackDefinition.propertyPath}.${mapping.definitions.rawField}`
  const parent = collectionParent({
    ...args,
    category: 'ranged',
    parentName: mapping.definitions.rawField,
    parentPath: collectionPath,
    mappingId: mapping.definitions.id,
    identityAssertionId: args.definition.assertion.id,
  })
  const entries: RangedConfiguredEntry[] = []
  if (parent.field.state === 'known') {
    parent.field.value.forEach((sourceIndex, position) => {
      const element = parent.elements[position]!
      const elementFactId = parent.elementFactIds[position]!
      const common = {
        repositoryRoot: args.repositoryRoot,
        inventory: args.inventory,
        category: 'ranged' as const,
        catalogId: args.catalogId,
        packagePath: args.packagePath,
        references: args.references,
        factsById: args.factsById,
        element,
        elementFactId,
        identityAssertionId: args.definition.assertion.id,
      }
      entries.push({
        sourceIndex,
        count: readChild({ ...common, mappingId: mapping.projectileCount.id, propertyName: mapping.projectileCount.rawField, propertyType: 'IntProperty', valueType: 'number' }),
        angle: readChild({ ...common, mappingId: mapping.angleSpan.id, propertyName: mapping.angleSpan.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        delay: readChild({ ...common, mappingId: mapping.delayPerProjectile.id, propertyName: mapping.delayPerProjectile.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
        delaySeconds: readChild({ ...common, mappingId: mapping.delaySeconds.id, propertyName: mapping.delaySeconds.rawField, propertyType: 'FloatProperty', valueType: 'number' }),
      })
    })
  }
  const definitions: Field<RangedConfiguredEntry[]> = parent.field.state === 'known'
    ? { state: 'known', value: entries, trace: parent.field.trace }
    : { state: parent.field.state, reason: parent.field.reason, trace: parent.field.trace }
  const domainId = matchedIdentityDomainIdFromSource(parent.field.trace.raw, args.definition, args.identity, args.identityEvidence)
  if (domainId !== args.definition.assertion.domainId) throw new Error(`${domainId ?? args.definition.assertion.id}: Horizontal Ranged source failed the committed Identity gate`)
  return {
    sourceProvenance: parent.field.trace.raw,
    definition: args.definition,
    identity: args.identity,
    identityEvidence: args.identityEvidence,
    category: 'ranged',
    mapping,
    values: { definitions },
  }
}

/** Builds first-wave sources from exact same-package rp-root Horizontal facts and verified Structural occurrences. */
export function readHorizontalConfiguredValueSources(args: {
  repositoryRoot: string
  identity: FormalIdentityEvidenceArtifact
  definitions?: readonly FormalIdentityDefinition[]
  excludedDomainIds?: ReadonlySet<string>
}): FormalHorizontalConfiguredValueSource[] {
  const inventory = readHorizontalRawFactInventory(args.repositoryRoot) as InventoryView
  const factsById = new Map(inventory.sourceFacts.map((fact) => [fact.factId, fact]))
  const definitionsById = new Map((args.definitions ?? formalIdentityDefinitions).map((definition) => [definition.assertion.id, definition]))
  const sources: FormalHorizontalConfiguredValueSource[] = []

  for (const identity of args.identity.semantic.identities) {
    if (identity.resolution.state !== 'matched' || args.excludedDomainIds?.has(identity.resolution.domainId)) continue
    const definition = definitionsById.get(identity.assertionId)
    if (!definition || definition.assertion.domainId !== identity.resolution.domainId) continue
    const identityEvidence = committedIdentity(args.identity, definition, identity)
    const packagePath = definition.assertion.applicationScope.packagePath
    const candidateMatches = (inventory.items as HorizontalItem[])
      .filter((item) => item.catalogId === definition.assertion.domainId)
      .flatMap((item) => item.rawCandidate.candidates
        .filter((candidate) => candidate.packagePath === packagePath)
        .map((candidate) => ({ item, candidate })))
    if (!candidateMatches.length) continue
    if (candidateMatches.length !== 1) throw new Error(`${packagePath}: expected one exact Horizontal catalog candidate, found ${candidateMatches.length}`)
    const { item, candidate } = candidateMatches[0]!
    if (item.category !== 'melee' && item.category !== 'ranged') continue
    const references = candidate.facts
    const sourceArgs = {
      repositoryRoot: args.repositoryRoot,
      inventory,
      catalogId: item.catalogId,
      packagePath,
      references,
      factsById,
      definition,
      identity,
      identityEvidence,
    }
    sources.push(item.category === 'melee' ? buildMeleeSource(sourceArgs) : buildRangedSource(sourceArgs))
  }
  return sources
}
