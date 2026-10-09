import { describe, expect, it } from 'vitest'
import baseline from './fixtures/armor-foundation-baseline.json'
import { digest } from './fixtures/runtimeBaselineDigest'
import { artifactRegressionCases } from '../src/research/artifactRegressionCases'
import { evaluate, evaluateCandidate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { BASE_HERO_HEALTH, resolveHealthState } from '../src/core/armor'
import {
  ARMOR_AUDIT,
  ARMOR_HEALTH_AUDIT,
  ARMOR_RUNTIME_SUPPORT,
  collectArmorAuditErrors,
  collectArmorHealthAuditErrors,
  collectArmorSupportErrors,
  summarizeArmorAudit,
} from '../src/research/armorAudit'
import {
  ARMOR_ENCHANTMENT_AUDIT,
  collectArmorEnchantmentAuditErrors,
  summarizeArmorEnchantmentAudit,
} from '../src/research/armorEnchantmentAudit'

const clone = <T>(value: T): T => structuredClone(value)

describe('Phase 2-3A Armor audit foundation', () => {
  it('reconciles 71 primary and 73 known Armor records without claiming raw-ID exhaustiveness', () => {
    expect(collectArmorAuditErrors()).toEqual([])
    expect(ARMOR_AUDIT.populationReconciliation).toMatchObject({
      primarySourceCount: 71,
      secondaryKnownCount: 73,
      secondaryObtainableCount: 71,
      projectPopulationCount: 73,
      exhaustiveRawGameIdClaim: false,
    })
    expect(ARMOR_AUDIT.populationReconciliation.primaryOnly).toEqual([])
    expect(ARMOR_AUDIT.populationReconciliation.secondaryOnly.map((entry) => entry.id).sort()).toEqual(['ender-armor', 'vanguard-armor'])
    expect(ARMOR_AUDIT.populationReconciliation.scopeExclusions).toContainEqual(expect.objectContaining({ id: 'soul-mage-robe' }))
    expect(summarizeArmorAudit()).toMatchObject({ population: 73, obtainable: 71, eventExclusive: 7 })
  })

  it('separates family inheritance, unique-only properties, built-ins, and Mystery Armor rolls', () => {
    const renegade = ARMOR_AUDIT.entries.find((entry) => entry.id === 'renegade-armor')!
    expect(renegade.inheritance.baseArmorId).toBe('mercenary-armor')
    expect(renegade.inheritance.inheritedProperties).toEqual(expect.arrayContaining(['+20% weapon damage boost aura', '35% Damage reduction']))
    expect(renegade.inheritance.uniqueOnlyProperties).toEqual(['+25% melee attack speed'])
    const stalwart = ARMOR_AUDIT.entries.find((entry) => entry.id === 'stalwart-armor')!
    expect(stalwart.builtInEnchantments).toContainEqual(expect.objectContaining({ enchantmentId: 'potion-barrier', tier: 1, classification: 'armor-enchantment' }))
    const shulker = ARMOR_AUDIT.entries.find((entry) => entry.id === 'shulker-armor')!
    expect(shulker.builtInEnchantments).toContainEqual(expect.objectContaining({ enchantmentId: 'thrive-under-pressure-mob', classification: 'intrinsic-only' }))
    const mystery = ARMOR_AUDIT.entries.find((entry) => entry.id === 'mystery-armor')!
    expect(mystery.mysteryArmor).toMatchObject({ fixedPropertySet: false, actualIntrinsicRollsRequired: true })
    expect(mystery.runtimeReadiness).toBe('needs-roll-model')
  })

  it('pins the six deep audits and the bounded core runtime manifest', () => {
    for (const id of ['renegade-armor', 'wither-armor', 'battle-robe', 'splendid-robe', 'evocation-robe', 'hero-s-armor']) {
      expect(ARMOR_AUDIT.entries.find((entry) => entry.id === id)?.deepAudit).not.toBeNull()
    }
    expect(collectArmorSupportErrors()).toEqual([])
    expect(ARMOR_RUNTIME_SUPPORT.entries).toHaveLength(73)
    expect(ARMOR_RUNTIME_SUPPORT.entries.filter((entry) => entry.supportLevel === 'limited').map((entry) => entry.id)).toEqual(['battle-robe', 'grim-armor', 'mercenary-armor', 'renegade-armor', 'scale-mail', 'spider-armor', 'thief-armor', 'wither-armor'])
    expect(ARMOR_RUNTIME_SUPPORT.nextBatch).toMatchObject({
      armorIds: ['battle-robe', 'renegade-armor', 'wither-armor', 'mercenary-armor', 'grim-armor', 'scale-mail', 'spider-armor'],
      armorEnchantmentIds: ['cool-down', 'potion-barrier', 'chilling', 'health-synergy', 'snowball', 'cowardice', 'protection'],
    })
  })

  it('rejects malformed population, property, Mystery, and fake runtime records', () => {
    const population = clone(ARMOR_AUDIT) as unknown as { populationReconciliation: { projectPopulationCount: number } }
    population.populationReconciliation.projectPopulationCount = 71
    expect(collectArmorAuditErrors(population)).toContain('Armor population counts drift')
    const property = clone(ARMOR_AUDIT) as unknown as { entries: { intrinsicProperties: { kind: string }[] }[] }
    property.entries.find((entry) => entry.intrinsicProperties.length)!.intrinsicProperties[0]!.kind = 'fake-zero'
    expect(collectArmorAuditErrors(property).some((error) => error.includes('invalid intrinsic property'))).toBe(true)
    const mystery = clone(ARMOR_AUDIT) as unknown as { entries: { id: string; mysteryArmor: { actualIntrinsicRollsRequired: boolean } | null }[] }
    mystery.entries.find((entry) => entry.id === 'mystery-armor')!.mysteryArmor!.actualIntrinsicRollsRequired = false
    expect(collectArmorAuditErrors(mystery)).toContain('Mystery Armor random-roll contract missing')
    const support = clone(ARMOR_RUNTIME_SUPPORT) as unknown as { entries: { id: string; supportLevel: string }[] }
    support.entries.find((entry) => entry.id === 'battle-robe')!.supportLevel = 'full'
    expect(collectArmorSupportErrors(support).some((error) => error.includes('runtime support level mismatch'))).toBe(true)
  })
})

describe('Armor health source contract', () => {
  it('keeps observed values first-class and forbids endgame extrapolation', () => {
    expect(collectArmorHealthAuditErrors()).toEqual([])
    expect(BASE_HERO_HEALTH).toBe(100)
    expect(ARMOR_HEALTH_AUDIT.coverage).toMatchObject({ sampleCount: 27, minPower: 1, maxPower: 251, endgameSampleCount: 3 })
    expect(ARMOR_HEALTH_AUDIT.samePowerVariance).toMatchObject({ power: 251, spread: 27418 })
    expect(ARMOR_HEALTH_AUDIT.runtimePolicy).toMatchObject({ modelFallbackAvailable: false, noMidpointImputation: true })
  })

  it('resolves legacy and observed routes independently', () => {
    expect(resolveHealthState({ kind: 'legacy-scenario', maxHealth: 500 })).toMatchObject({ armorHealthBonus: 0, preModifierMaxHealth: 500, finalMaxHealth: 500 })
    expect(resolveHealthState({ kind: 'armor-observed', armorHealthBonus: 400 })).toMatchObject({ baseHeroHealth: 100, armorHealthBonus: 400, preModifierMaxHealth: 500, finalMaxHealth: 500 })
    expect(resolveHealthState({ kind: 'armor-model', armorHealthBonus: 400, powerLevel: 100, modelId: 'validated-low-power' }).finalMaxHealth).toBe(500)
  })

  it.each([NaN, Infinity, -1])('rejects invalid observed health %s without midpoint replacement', (armorHealthBonus) => {
    expect(() => resolveHealthState({ kind: 'armor-observed', armorHealthBonus })).toThrow(/finite and non-negative/)
  })
})

describe('Armor enchantment audit', () => {
  it('validates all 41 hero-accessible Armor enchantments and built-in refs', () => {
    expect(collectArmorEnchantmentAuditErrors(ARMOR_ENCHANTMENT_AUDIT, ARMOR_AUDIT)).toEqual([])
    expect(summarizeArmorEnchantmentAudit()).toMatchObject({ population: 41, common: 30, powerful: 11, soulOnly: 1, utilityOnly: 5 })
    expect(ARMOR_ENCHANTMENT_AUDIT.deepAuditIds).toHaveLength(14)
    expect(ARMOR_ENCHANTMENT_AUDIT.entries.find((entry) => entry.id === 'soul-speed')?.soulRestriction).toBe('soul-armor-only')
  })

  it('keeps normal slots, built-ins, and gilded maximum-copy semantics distinct', () => {
    expect(ARMOR_ENCHANTMENT_AUDIT.entries.find((entry) => entry.id === 'cool-down')).toMatchObject({ stackable: true, maxCopies: 4, runtimeReadiness: 'ready-with-limits' })
    expect(ARMOR_ENCHANTMENT_AUDIT.entries.find((entry) => entry.id === 'potion-barrier')).toMatchObject({ stackable: false, maxCopies: 1, runtimeReadiness: 'ready-with-limits' })
    expect(ARMOR_ENCHANTMENT_AUDIT.entries.find((entry) => entry.id === 'protection')?.blockers.join(' ')).toMatch(/41\.65%/)
  })
})

const regressionCases = artifactRegressionCases()
describe('Armor foundation exact regression against b022c09', () => {
  it('pins all 180 evaluate/evaluateCandidate/optimize cases to the requested starting commit', () => {
    expect(baseline.baselineCommit).toBe('b022c092bd7eb71b65c881f27110b72884f3f801')
    expect(regressionCases).toHaveLength(180)
    expect(regressionCases.map((entry) => entry.name)).toEqual(baseline.cases.map((entry) => entry.name))
  })

  it.each(regressionCases.map((input, index) => ({ ...input, expected: baseline.cases[index]! })))('$name: runtime output remains exact', ({ build, scenario, expected }) => {
    expect(digest(evaluate(build, scenario))).toBe(expected.evaluation)
    expect(digest(evaluateCandidate(build, scenario))).toBe(expected.candidate)
    expect(digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario))).toBe(expected.optimization)
  })

  it('preserves combined objective ordering and Pareto output', () => {
    const inventory = { weapons: regressionCases.filter((_, index) => index % 30 === 0).map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: regressionCases[21]!.build.artifacts }
    expect(digest(optimize(inventory, regressionCases[0]!.scenario))).toBe(baseline.combined)
  })
})
