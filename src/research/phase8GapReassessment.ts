export type Phase8GapDisposition = 'external-resolved' | 'limited-measurement' | 'implementation-missing' | 'hold'

export interface Phase8GapInput {
  readonly gapId: string
  readonly disposition: string
  readonly before?: { readonly disposition?: string }
}

export interface Phase8GapReassessment {
  readonly gapId: string
  readonly previousDisposition: string
  readonly disposition: Phase8GapDisposition
  readonly evidenceRecordIds: readonly string[]
  readonly reason: string
  readonly changed: boolean
}

const selectedMeasurementGaps = new Set([
  'artifact:iron-hide-amulet:interactions',
  'melee-enchantment:guarding-strike:procChance',
  'melee-enchantment:guarding-strike:cooldown',
  'melee-enchantment:guarding-strike:powerDependence',
  'melee-enchantment:guarding-strike:currentVersionGameplayVerification',
])

/** Reclassifies the immutable Phase 6.6 population without rewriting or closing its IDs. */
export function reassessPhase8Gap(record: Phase8GapInput): Phase8GapReassessment {
  const previousDisposition = record.disposition
  if (record.disposition === 'implementation') return {
    gapId: record.gapId, previousDisposition, disposition: 'implementation-missing', evidenceRecordIds: [], changed: true,
    reason: 'Evidence cannot replace the missing runtime implementation; retain the original Gap.',
  }
  if (selectedMeasurementGaps.has(record.gapId)) return {
    gapId: record.gapId, previousDisposition, disposition: 'limited-measurement',
    evidenceRecordIds: ['phase8-dr-ehp-current@2', 'phase8-caramel-dr-guide@1', 'phase8-iron-hide-wiki-tests@1'], changed: true,
    reason: 'New external material narrows the formula and single-effect behavior, but lacks a versioned independent raw trace for the selected combination.',
  }
  return {
    gapId: record.gapId, previousDisposition, disposition: 'hold', evidenceRecordIds: [], changed: previousDisposition !== 'hold',
    reason: 'Outside the first Phase 8B unit or still requires its original public research, observation, measurement, experiment, or product decision.',
  }
}
