import { describe, expect, it } from 'vitest'
import auditJson from '../research/melee-enchantment-audit.json'
import { ENCHANTMENTS } from '../src/data/enchantments'
import {
  collectMeleeEnchantmentAuditErrors,
  EXPECTED_MELEE_ENCHANTMENT_IDS,
  summarizeMeleeEnchantmentAudit,
  type MeleeEnchantmentAudit,
} from '../src/research/meleeEnchantmentAudit'

const audit = auditJson as unknown as MeleeEnchantmentAudit
const runtimeIds = Object.keys(ENCHANTMENTS)

const cloneAudit = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(auditJson)) as Record<string, unknown>

describe('melee enchantment audit', () => {
  it('validates the 1.17.0.0 schema and source-backed population', () => {
    expect(collectMeleeEnchantmentAuditErrors(auditJson, runtimeIds)).toEqual([])
    expect(audit.gameVersion).toBe('1.17.0.0')
    expect(audit.population.targetCount).toBe(33)
    expect(audit.entries).toHaveLength(33)
    expect(new Set(audit.entries.map((entry) => entry.id)).size).toBe(33)
    expect(audit.entries.map((entry) => entry.id).sort()).toEqual(
      [...EXPECTED_MELEE_ENCHANTMENT_IDS].sort(),
    )
    expect(audit.entries.every((entry) => entry.applicability.melee)).toBe(true)
  })

  it('requires all tiers and a numeric source for each entry', () => {
    for (const entry of audit.entries) {
      expect(Object.keys(entry.tierValues).sort()).toEqual(['1', '2', '3'])
      expect(Object.values(entry.tierValues).every((tier) => tier.raw.length > 0)).toBe(true)
      expect(entry.sources.some((source) => source.supports.includes('tier-values'))).toBe(true)
    }
  })

  it('maps exactly the supported nine runtime enchantments to implemented', () => {
    const implementedIds = audit.entries
      .filter((entry) => entry.runtimeStatus === 'implemented')
      .map((entry) => entry.id)
      .sort()
    expect(implementedIds).toEqual([...runtimeIds].sort())
    expect(implementedIds).toEqual([
      'critical-hit',
      'guarding-strike',
      'leeching',
      'radiance',
      'refreshment',
      'sharpness',
      'unchanting',
      'void-strike',
      'weakening',
    ])
  })

  it('keeps every unsupported audit entry out of the selectable runtime catalog', () => {
    const unsupportedIds = audit.entries
      .filter((entry) => entry.runtimeStatus !== 'implemented')
      .map((entry) => entry.id)
    expect(unsupportedIds).toHaveLength(24)
    expect(unsupportedIds.filter((id) => runtimeIds.includes(id))).toEqual([])
  })

  it('reports the agreed mutually exclusive coverage summary', () => {
    expect(summarizeMeleeEnchantmentAudit(audit)).toMatchObject({
      total: 33,
      counts: {
        implemented: 9,
        straightforward: 0,
        'needs-state-model': 13,
        'needs-damage-event-model': 6,
        'needs-enemy-state': 3,
        'utility-only': 2,
        'insufficient-evidence': 0,
      },
    })
  })

  it('rejects duplicate ids, incomplete tiers, and unsupported runtime enablement', () => {
    const invalid = cloneAudit()
    const entries = invalid.entries as Array<Record<string, unknown>>
    entries[1]!.id = entries[0]!.id
    const tiers = entries[2]!.tierValues as Record<string, unknown>
    delete tiers['3']

    const errors = collectMeleeEnchantmentAuditErrors(invalid, [...runtimeIds, 'busy-bee'])
    expect(errors).toContain(`duplicate entry id: ${entries[0]!.id as string}`)
    expect(errors).toContain('entries[2].tierValues.3.raw is required')
    expect(errors.some((error) => error.startsWith('implemented audit ids'))).toBe(true)
    expect(errors).toContain('unsupported enchantments are runtime-enabled: busy-bee')
  })

  it('preserves raw power-scaled X notation instead of inventing percentages', () => {
    const ids = ['dynamo', 'fire-aspect', 'poison-cloud', 'radiance', 'shockwave', 'swirling', 'thundering']
    for (const id of ids) {
      const entry = audit.entries.find((candidate) => candidate.id === id)
      expect(entry).toBeDefined()
      expect(entry!.tierValues['1'].raw).toMatch(/X/i)
    }
  })
})
