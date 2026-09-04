/** Read-only research model. It never supplies candidates or numeric inputs to the optimizer. */
export const COVERAGE_CATEGORIES = ['melee-attack-profile', 'melee-enchantment', 'artifact', 'armor', 'armor-enchantment', 'dps-regression'] as const
export const SUPPORT_STATES = ['full', 'limited', 'research-only', 'unknown', 'not-applicable'] as const
export const BLOCKER_KINDS = ['evidence-blocked', 'not-implemented', 'unclassified'] as const
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
export type CoverageCategory = typeof COVERAGE_CATEGORIES[number]
export type SupportState = typeof SUPPORT_STATES[number]
export type Priority = typeof PRIORITIES[number]
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue | undefined }

export interface EvidenceFacet {
  readonly sourceRef: string
  /** Source vocabulary and nested provenance are retained, without a synthetic verification score. */
  readonly value: JsonValue
}
export interface CoverageRecord {
  readonly category: CoverageCategory
  readonly id: string
  readonly label: string
  readonly runtimeSupport: SupportState
  readonly runtimeSourceRef: string | null
  readonly evidence: {
    readonly confidence: string | null
    readonly verificationStatus: string | null
    readonly gameVersion: string | null
    readonly sampleCount: number | null
    readonly powerCoverage: JsonValue
    readonly facets: readonly EvidenceFacet[]
  }
  readonly blockerIds: readonly string[]
}
export interface CoverageBlocker {
  readonly id: string
  readonly label: string
  readonly categories: readonly CoverageCategory[]
  /** Empty means subsystem scope, not that every entity inherits the blocker. */
  readonly recordKeys: readonly string[]
  readonly kind: typeof BLOCKER_KINDS[number]
  readonly priority: Priority | null
  readonly origin: 'backlog' | 'runtime' | 'acquisition' | 'audit'
  readonly description: string
  readonly closeCondition: string | null
  readonly sourceRefs: readonly string[]
  readonly supportContext: string | null
}
export interface BacklogEntry {
  readonly id: string
  readonly label: string
  readonly support: string
  readonly whatWorks: string
  readonly blocked: string
  readonly closeCondition: string
  readonly priority: Priority
  readonly kind: 'evidence-blocked' | 'not-implemented'
  readonly categories: readonly CoverageCategory[]
  readonly recordKeys: readonly string[]
  readonly sourceRefs: readonly string[]
}
export interface CoverageAdapter {
  readonly category: CoverageCategory
  readonly label: string
  readonly populationDefinition: string
  readonly sourceRefs: readonly string[]
  readonly records: readonly CoverageRecord[]
  readonly blockers: readonly CoverageBlocker[]
  readonly details: Readonly<Record<string, JsonValue>>
}
export const recordKey = (record: Pick<CoverageRecord, 'category' | 'id'>): string => `${record.category}:${record.id}`
export const facet = (sourceRef: string, value: JsonValue): EvidenceFacet => ({ sourceRef, value })
export const pointer = (file: string, collection: string, index: number): string => `${file}#/${collection}/${index}`

export function summarizeBlockers(blockers: readonly CoverageBlocker[]) {
  const countKind = (kind: CoverageBlocker['kind']) => blockers.filter((item) => item.kind === kind).length
  return {
    total: blockers.length,
    evidenceBlocked: countKind('evidence-blocked'),
    notImplemented: countKind('not-implemented'),
    unclassified: countKind('unclassified'),
    priorities: Object.fromEntries(PRIORITIES.map((priority) => [priority, blockers.filter((item) => item.priority === priority).length])) as Record<Priority, number>,
    unprioritized: blockers.filter((item) => item.priority === null).length,
    p1EvidenceBlocked: blockers.filter((item) => item.priority === 'P1' && item.kind === 'evidence-blocked').length,
  }
}
