import { BLOCKER_KINDS, COVERAGE_CATEGORIES, PRIORITIES, SUPPORT_STATES, type CoverageAdapter, type CoverageBlocker, type JsonValue } from './model'
import type { EvidenceCoverage } from './report'

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty)
const oneOf = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value)
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
export type ReferenceResolver = (ref: string) => { valid: boolean; value?: JsonValue }

export function collectCoverageErrors(value: unknown, adapters: readonly CoverageAdapter[], resolve: ReferenceResolver): string[] {
  if (!object(value)) return ['Coverage must be an object']
  const errors: string[] = []
  const check = (ok: boolean, message: string) => { if (!ok) errors.push(message) }
  const jsonValues = (input: unknown, label: string) => {
    const visit = (item: unknown): boolean => item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)) || (typeof item === 'object' && item !== null && Object.values(item).every(visit))
    check(visit(input), `${label}: non-JSON value would be lost during generation`)
  }
  jsonValues(value, 'Coverage')
  const refs = (input: unknown, label: string) => {
    if (!strings(input) || input.length === 0) { errors.push(`${label}: missing source refs`); return }
    for (const ref of input) check(resolve(ref).valid, `${label}: untraceable source ${ref}`)
  }
  check(value.schemaVersion === 1, 'Coverage schemaVersion must be 1')
  if (!Array.isArray(value.records) || !Array.isArray(value.blockers) || !Array.isArray(value.categories)) return [...errors, 'Coverage arrays missing']
  const keys = new Set<string>()
  const expected = new Map(adapters.flatMap((adapter) => adapter.records).map((record) => [`${record.category}:${record.id}`, record]))
  const blockerIds = new Set<string>()
  for (const blocker of value.blockers) {
    if (!object(blocker) || !nonempty(blocker.id)) { errors.push('Blocker ID missing'); continue }
    check(!blockerIds.has(blocker.id), `Duplicate blocker ID: ${blocker.id}`); blockerIds.add(blocker.id)
    check(nonempty(blocker.label) && nonempty(blocker.description), `${blocker.id}: label/description required`)
    check(oneOf(BLOCKER_KINDS, blocker.kind), `${blocker.id}: invalid blocker kind`)
    check(blocker.priority === null || oneOf(PRIORITIES, blocker.priority), `${blocker.id}: invalid priority`)
    check(oneOf(['backlog', 'runtime', 'acquisition', 'audit'], blocker.origin), `${blocker.id}: invalid origin`)
    check(strings(blocker.categories) && blocker.categories.length > 0 && blocker.categories.every((category) => oneOf(COVERAGE_CATEGORIES, category)), `${blocker.id}: invalid categories`)
    check(blocker.closeCondition === null || nonempty(blocker.closeCondition), `${blocker.id}: invalid close condition`)
    if (blocker.origin === 'backlog') check(nonempty(blocker.closeCondition) && oneOf(PRIORITIES, blocker.priority), `${blocker.id}: backlog needs priority and close condition`)
    check(strings(blocker.recordKeys) && blocker.recordKeys.every((key) => expected.has(key)), `${blocker.id}: unknown entity reference`)
    if (strings(blocker.recordKeys) && strings(blocker.categories)) {
      const categories = blocker.categories
      check(blocker.recordKeys.every((key) => categories.includes(key.split(':')[0]!)), `${blocker.id}: entity category mismatch`)
    }
    refs(blocker.sourceRefs, blocker.id)
  }
  for (const record of value.records) {
    if (!object(record) || !nonempty(record.id)) { errors.push('Record ID missing'); continue }
    const key = `${record.category}:${record.id}`
    check(!keys.has(key), `Duplicate record ID: ${key}`); keys.add(key)
    check(oneOf(COVERAGE_CATEGORIES, record.category), `${key}: invalid category`)
    check(oneOf(SUPPORT_STATES, record.runtimeSupport), `${key}: invalid support`)
    const source = expected.get(key)
    check(source !== undefined, `${key}: not in source population`)
    if (source) {
      check(record.runtimeSupport === source.runtimeSupport && record.runtimeSourceRef === source.runtimeSourceRef, `${key}: source support drift (unknown must not become Full)`)
      check(same(record.evidence, source.evidence), `${key}: source evidence drift (unknown must not become zero)`)
    }
    if (record.runtimeSourceRef !== null) refs([record.runtimeSourceRef], key)
    if (!object(record.evidence)) { errors.push(`${key}: evidence missing`); continue }
    const evidence = record.evidence
    check(evidence.sampleCount === null || (Number.isInteger(evidence.sampleCount) && Number(evidence.sampleCount) >= 0), `${key}: invalid sample count`)
    if (!Array.isArray(evidence.facets) || evidence.facets.length === 0) errors.push(`${key}: provenance facets missing`)
    else for (const facet of evidence.facets) {
      if (!object(facet) || !nonempty(facet.sourceRef)) { errors.push(`${key}: facet ref missing`); continue }
      const resolved = resolve(facet.sourceRef)
      check(resolved.valid, `${key}: untraceable facet ${facet.sourceRef}`)
      if (resolved.value !== undefined) check(same(resolved.value, facet.value), `${key}: facet lost source information`)
    }
    check(strings(record.blockerIds) && record.blockerIds.every((id) => blockerIds.has(id)), `${key}: invalid blocker refs`)
    const expectedIds = value.blockers.filter(object).filter((b) => strings(b.recordKeys) && b.recordKeys.includes(key)).map((b) => b.id)
    check(same(record.blockerIds, expectedIds), `${key}: blocker membership drift`)
  }
  for (const key of expected.keys()) check(keys.has(key), `${key}: missing source population entry`)
  check(value.categories.length === adapters.length, 'Category population mismatch')
  const categoryIds = new Set<string>()
  for (const category of value.categories) {
    if (!object(category) || !nonempty(category.id)) { errors.push('Category ID missing'); continue }
    check(!categoryIds.has(category.id), `Duplicate category: ${category.id}`); categoryIds.add(category.id)
    const adapter = adapters.find((item) => item.category === category.id)
    check(adapter !== undefined, `Unknown category: ${category.id}`)
    if (!adapter) continue
    check(category.population === adapter.records.length, `${category.id}: population drift`)
    const fields = { full: 'full', limited: 'limited', researchOnly: 'research-only', unknown: 'unknown', notApplicable: 'not-applicable' }
    if (!object(category.runtime)) errors.push(`${category.id}: runtime counts missing`)
    else for (const [field, state] of Object.entries(fields)) check(category.runtime[field] === adapter.records.filter((r) => r.runtimeSupport === state).length, `${category.id}: ${field} count drift`)
    refs(category.sourceRefs, category.id)
  }
  return errors
}

export function collectProtocolErrors(value: unknown, blockers: readonly CoverageBlocker[], resolve: ReferenceResolver): string[] {
  if (!Array.isArray(value)) return ['Protocols must be an array']
  const errors: string[] = []
  const ids = new Set<string>()
  for (const protocol of value) {
    if (!object(protocol)) { errors.push('Protocol must be an object'); continue }
    for (const field of ['id', 'subsystem', 'targetMechanic', 'purpose', 'requiredGameVersion']) if (!nonempty(protocol[field])) errors.push(`Protocol ${String(protocol.id)}: ${field} required`)
    const id = String(protocol.id)
    if (ids.has(id)) errors.push(`Duplicate protocol ID: ${id}`)
    ids.add(id)
    for (const field of ['equipment', 'scenario', 'observations', 'acceptance', 'submissionMetadata', 'invalidatingConditions', 'blockerIds', 'sourceRefs']) {
      if (!strings(protocol[field]) || (protocol[field] as string[]).length === 0) errors.push(`${id}: ${field} required`)
    }
    if (!object(protocol.repetition) || !nonempty(protocol.repetition.rule)
      || !(protocol.repetition.minimumIndependentRuns === null || (Number.isInteger(protocol.repetition.minimumIndependentRuns) && Number(protocol.repetition.minimumIndependentRuns) > 0))) errors.push(`${id}: repetition requirements invalid`)
    if (strings(protocol.blockerIds)) for (const ref of protocol.blockerIds) if (!blockers.some((b) => b.id === ref)) errors.push(`${id}: missing blocker ${ref}`)
    if (strings(protocol.sourceRefs)) for (const ref of protocol.sourceRefs) if (!resolve(ref).valid) errors.push(`${id}: untraceable source ${ref}`)
    if ('results' in protocol || 'measurements' in protocol) errors.push(`${id}: protocols must not contain invented results`)
  }
  return errors
}

export function collectSummaryErrors(snapshot: EvidenceCoverage, expected: EvidenceCoverage): string[] {
  return ['categories', 'blockerSummary', 'backlogSummary', 'blockers'].filter((field) => !same(snapshot[field as keyof EvidenceCoverage], expected[field as keyof EvidenceCoverage])).map((field) => `Derived ${field} drift`)
}
