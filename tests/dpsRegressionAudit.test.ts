import { describe, expect, it } from 'vitest'
import auditJson from '../research/dps-regression-audit.json'
import { DAMAGE_REGRESSION_SAMPLES } from '../src/data/regressionSamples'
import {
  collectDpsRegressionAuditErrors,
  collectRegressionFixtureAuditErrors,
  summarizeDpsRegressionAudit,
  type DpsRegressionAudit,
} from '../src/research/dpsRegressionAudit'

const audit = auditJson as unknown as DpsRegressionAudit
const cloneAudit = (): Record<string, unknown> => structuredClone(auditJson) as Record<string, unknown>
const entriesOf = (value: Record<string, unknown>): Record<string, unknown>[] =>
  value.entries as Record<string, unknown>[]

describe('public DPS regression audit', () => {
  it('validates every candidate and keeps rejected observations out of runtime', () => {
    expect(collectDpsRegressionAuditErrors(auditJson)).toEqual([])
    expect(collectRegressionFixtureAuditErrors(audit, DAMAGE_REGRESSION_SAMPLES)).toEqual([])
    expect(DAMAGE_REGRESSION_SAMPLES).toHaveLength(0)
  })

  it('reports the searched coverage without promoting component or calculated values', () => {
    expect(summarizeDpsRegressionAudit(audit)).toEqual({
      candidateCount: 10,
      eligibleCount: 0,
      rejectedCount: 10,
      eligibleByWeapon: { 'fighters-bindings': 0, 'double-axe': 0, anchor: 0, 'soul-scythe': 0 },
      versionConfidenceCounts: { verified: 0, probable: 6, unknown: 4 },
    })
  })

  it('rejects duplicate IDs and rejected candidates without reasons', () => {
    const invalid = cloneAudit()
    const entries = entriesOf(invalid)
    entries[1]!.id = entries[0]!.id
    delete entries[0]!.rejectionReason
    const errors = collectDpsRegressionAuditErrors(invalid)
    expect(errors).toContain(`duplicate entry id: ${entries[0]!.id as string}`)
    expect(errors).toContain('entries[0] rejected entry requires a rejectionReason')
  })

  it('requires every model input and an independent DPS observation before eligibility', () => {
    const invalid = cloneAudit()
    const entry = entriesOf(invalid)[0]!
    entry.eligibleForRegression = true
    delete entry.rejectionReason
    const conditions = entry.conditions as Record<string, unknown>
    delete conditions.observedDamagePerHit
    delete conditions.targetArmorOrReduction

    const errors = collectDpsRegressionAuditErrors(invalid)
    expect(errors).toContain('entries[0] eligible entry requires observedDamagePerHit')
    expect(errors).toContain('entries[0] eligible entry requires target armor/reduction information')
    expect(errors).toContain(
      'entries[0] eligible entry requires independently observed DPS or derivable raw totals',
    )
  })
})
