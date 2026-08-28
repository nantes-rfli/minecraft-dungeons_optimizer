import { describe, expect, it } from 'vitest'
import auditJson from '../research/melee-attack-profile-audit.json'
import {
  collectMeleeAuditErrors,
  summarizeMeleeAudit,
  type MeleeAttackProfileAudit,
} from '../src/research/meleeAttackProfileAudit'

const audit = auditJson as unknown as MeleeAttackProfileAudit
const cloneAudit = (): Record<string, unknown> => structuredClone(auditJson) as Record<string, unknown>
const weaponsOf = (value: Record<string, unknown>): Record<string, unknown>[] =>
  value.weapons as Record<string, unknown>[]

describe('melee attack profile audit', () => {
  it('validates the complete 1.17.0.0 population', () => {
    expect(collectMeleeAuditErrors(auditJson)).toEqual([])
    expect(audit.population.obtainableMeleeWeapons).toBe(82)
    expect(new Set(audit.weapons.map((weapon) => weapon.weaponId)).size).toBe(82)
  })

  it('keeps strict and relaxed coverage separate without inferred promotion', () => {
    const summary = summarizeMeleeAudit(audit)
    expect(summary.counts).toEqual({
      exact: 76,
      'verified-shared': 0,
      partial: 6,
      inferred: 0,
      missing: 0,
    })
    expect(summary.strictRuntimeReady).toBe(76)
    expect(summary.relaxedRuntimeReady).toBe(76)
    expect(summary.directDurationData).toBe(82)
  })

  it('preserves existing runtime ids and explicit variant relationships', () => {
    expect(audit.weapons.find((weapon) => weapon.weaponId === 'fighters-bindings')?.name.ja)
      .toBe('闘士の締め具')
    expect(audit.weapons.find((weapon) => weapon.weaponId === 'encrusted-anchor')?.variantOf)
      .toBe('anchor')
    expect(audit.weapons.some((weapon) => weapon.status === 'verified-shared')).toBe(false)
  })

  it('rejects duplicate ids and invalid source URLs', () => {
    const invalid = cloneAudit()
    const weapons = weaponsOf(invalid)
    weapons[1]!.weaponId = weapons[0]!.weaponId
    const sources = weapons[0]!.sources as Record<string, unknown>[]
    sources[0]!.url = 'not-a-url'

    const errors = collectMeleeAuditErrors(invalid)
    expect(errors).toContain(`duplicate weaponId: ${weapons[0]!.weaponId as string}`)
    expect(errors).toContain('weapons[0].sources[0].url must be an HTTP(S) URL')
  })

  it('rejects exact entries without a complete derived profile', () => {
    const invalid = cloneAudit()
    const first = weaponsOf(invalid)[0]!
    first.attackProfile = null
    expect(collectMeleeAuditErrors(invalid)).toContain('weapons[0] is exact but has no attackProfile')

    const invalidDerived = cloneAudit()
    const profile = weaponsOf(invalidDerived)[0]!.attackProfile as Record<string, unknown>
    profile.hitsPerSecond = 0
    expect(collectMeleeAuditErrors(invalidDerived)).toContain(
      'weapons[0].attackProfile.hitsPerSecond must be positive or null',
    )
  })

  it('rejects duration count mismatches and unresolvable shared profiles', () => {
    const invalidDurations = cloneAudit()
    const profile = weaponsOf(invalidDurations)[2]!.attackProfile as Record<string, unknown>
    profile.hitDurationsSeconds = [0.5]
    expect(collectMeleeAuditErrors(invalidDurations)).toContain(
      'weapons[2] has 1 durations for 3 combo hits',
    )

    const invalidShared = cloneAudit()
    const first = weaponsOf(invalidShared)[0]!
    first.status = 'verified-shared'
    first.sharedAttackProfileFrom = 'not-a-weapon'
    expect(collectMeleeAuditErrors(invalidShared)).toContain(
      'weapons[0] sharedAttackProfileFrom does not exist: not-a-weapon',
    )
  })
})
