import type { EvidenceGap, ExpectedOutcome } from './evidenceGapMap.ts'
import type { GameDataConfidence, JsonValue } from './gameDataProvenance.ts'
import type { SemanticMappingStatus } from './gameDataSemanticMapping.ts'
import type { GameDataRuleClosePolicy } from './gameDataSemanticRules.ts'

export const GAP_RECONCILIATION_STATUSES = ['closed', 'partial', 'evidence-added', 'conflict', 'blocked', 'no-match'] as const
export type GameDataGapResolutionStatus = typeof GAP_RECONCILIATION_STATUSES[number]

export interface GapCloseCandidate {
  readonly entityExact: boolean
  readonly propertyExact: boolean
  readonly sourceRecordExists: boolean
  readonly extractionConfidence: GameDataConfidence
  readonly semanticStatus: SemanticMappingStatus
  readonly semanticConfidence: GameDataConfidence
  readonly normalizedProperty?: string
  readonly normalizedValue?: JsonValue
  readonly crossCheckStatus: string
  readonly expectedOutcomeCompatible: boolean
  readonly closePolicy: GameDataRuleClosePolicy
  readonly canReplaceEmpiricalProtocol: boolean
}

export function canCloseGap(gap: EvidenceGap, candidate: GapCloseCandidate): boolean {
  if (!candidate.entityExact || !candidate.propertyExact || !candidate.sourceRecordExists) return false
  if (candidate.extractionConfidence !== 'high' || candidate.semanticStatus !== 'accepted') return false
  if (!['medium', 'high', 'verified'].includes(candidate.semanticConfidence)) return false
  if (!candidate.normalizedProperty || candidate.normalizedValue === undefined) return false
  if (candidate.crossCheckStatus === 'conflicts' || !candidate.expectedOutcomeCompatible) return false
  if (candidate.closePolicy !== 'may-close-static-gap') return false
  if (gap.gapCause === 'version-unknown' || gap.gapCause === 'conflicting-public-sources') return false
  if (gap.resolutionClass === 'implementation' || gap.resolutionClass === 'objective-design') return false
  if (['observe', 'measure', 'experiment'].includes(gap.resolutionClass) && !candidate.canReplaceEmpiricalProtocol) return false
  return true
}

export function isExpectedOutcomeCompatible(expected: ExpectedOutcome, value: JsonValue | undefined): boolean {
  if (value === undefined) return false
  if (expected === 'numeric-value' || expected === 'timing') return typeof value === 'number'
  if (expected === 'boolean') return typeof value === 'boolean'
  if (expected === 'categorical-value') return typeof value === 'string'
  if (expected === 'distribution') return Array.isArray(value) || (value !== null && typeof value === 'object')
  return false
}
