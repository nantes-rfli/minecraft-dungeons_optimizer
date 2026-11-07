import { execFileSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import approvals from '../research/runtime/builtin-proc-melee-reuse.json'
import snapshot from '../research/sources/builtin-proc-melee-source-snapshot.json'
import identities from '../research/domain/formal/identity-evidence-v1.json'
import profiles from '../research/melee-attack-profile-audit.json'
import harvest from '../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json'
import procAudit from '../research/damage-event-audit.json'
import promotion from '../research/runtime/runtime-promotion-manifest.json'
import { BUILTIN_PROC_MELEE_FACTS, BUILTIN_PROC_MELEE_IDS, builtinProcMeleeEnchantments } from '../src/data/builtinProcMelee'
import { builtinProcMeleeReuseIsEligible, collectBuiltinProcMeleeReuseErrors, type BuiltinProcMeleeInputs } from '../src/core/builtinProcMeleeReuse'
import { evaluate, evaluateCandidate } from '../src/core/evaluate'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { WEAPONS } from '../src/data/weapons'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { PROC_DAMAGE_DEFINITIONS } from '../src/data/damageEvents'
import { interpolateProcDamage } from '../src/core/damageEvents'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { summarizeDamageRegressionByScope } from '../src/core/modelError'
import { collectDamageEventAuditErrors } from '../src/research/damageEventAudit'
import type { Build, CatalogResearchAttributes, EnchantmentId, SelectedEnchantment, WeaponId } from '../src/core/types'

const scenario = SCENARIO_PROFILES.boss
const build = (id: WeaponId): Build => ({ weapon: { instanceId: id, weaponId: id, powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['radiance'], selected: { enchantmentId: 'radiance', tier: 1 } }] }, enchantments: [{ enchantmentId: 'radiance', tier: 1, source: 'slot' }, ...builtinProcMeleeEnchantments(id)], artifacts: [] })
const oldIds = ['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe', 'cutlass', 'pickaxe', 'soul-knife', 'whip', 'great-hammer'] as const
const withSlot = (value: Build, id: EnchantmentId, tier: 1 | 2 | 3 = 3): Build => ({ ...value, weapon: { ...value.weapon, enchantmentSlots: [...value.weapon.enchantmentSlots, { candidates: [id], selected: { enchantmentId: id, tier } }] }, enchantments: [...value.enchantments.filter((e) => e.source === 'slot'), { enchantmentId: id, tier, source: 'slot' }, ...value.enchantments.filter((e) => e.source !== 'slot')] })
const withResearch = (id: WeaponId, research: CatalogResearchAttributes): Build => { const b = build(id); return { ...b, weapon: { ...b.weapon, research } } }

describe('finite fixed built-in melee reuse', () => {
  it('admits exactly both source-bound targets and preserves R3/P3B', () => {
    expect(collectBuiltinProcMeleeReuseErrors()).toEqual([])
    expect(approvals.approvals.map((r) => r.targetId)).toEqual(BUILTIN_PROC_MELEE_IDS)
    expect(promotion.summary).toMatchObject({ candidates: 1, eligible: 0, promoted: 0 })
    expect(collectDamageEventAuditErrors(procAudit)).toEqual([])
    for (const id of BUILTIN_PROC_MELEE_IDS) {
      expect(builtinProcMeleeReuseIsEligible(id)).toBe(true)
      expect(getEquipmentCatalogEntry('melee', id)).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: BUILTIN_PROC_MELEE_FACTS[id].enchantmentId, tier: 1 }] })
      expect(parameterEvidenceForBuild(build(id)).filter((e) => e.mechanicId === `melee:${id}`).every((e) => e.status === 'derived')).toBe(true)
      expect(summarizeDamageRegressionByScope([]).byWeapon[id]).toMatchObject({ status: 'pending', sampleCount: 0 })
    }
    for (const id of ['cursed-axe', 'frost-scythe', 'bonehead-hammer']) expect(builtinProcMeleeReuseIsEligible(id)).toBe(false)
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s computes its mandatory Tier I proc and nonzero virtual removal contribution', (id) => {
    const b = build(id), result = evaluate(b, scenario), f = BUILTIN_PROC_MELEE_FACTS[id], event = result.damage.damageEvents[0]!
    const hits = f.durations.length / f.durations.reduce((sum: number, d: number) => sum + d, 0)
    expect(result.damage.hitsPerSecond).toBeCloseTo(hits)
    expect(event).toMatchObject({ sourceId: f.enchantmentId, tier: 1, qualifiesAsDirectWeaponKill: false, expectedTargetsHit: 1 })
    expect(event.eventsPerSecond).toBeCloseTo(id === 'whirlwind' ? 1 / 1.2 : 0.3 / 0.7)
    expect(event.damagePerEvent).toBe(interpolateProcDamage(PROC_DAMAGE_DEFINITIONS[f.enchantmentId].damageCurve.value, 251))
    expect(result.damage.singleTargetDps).toBeCloseTo(100 * hits + event.singleTargetDps)
    const contribution = result.contributions.find((c) => c.enchantmentSource === 'built-in')!
    expect(contribution.sourceId).toBe(f.enchantmentId)
    expect(contribution.singleTargetDpsDelta).toBeCloseTo(event.singleTargetDps)
    expect(contribution.singleTargetDpsDelta).toBeGreaterThan(0)
    expect(result.build.enchantments.filter((e) => e.source === 'built-in')).toEqual(builtinProcMeleeEnchantments(id))
    expect(evaluateCandidate(b, scenario).damage).toEqual(result.damage)
    const inv = { weapons: [b.weapon], artifacts: [] }
    expect(optimize(inv, scenario).best.damage).toEqual(result.damage)
    expect(inspectInventoryReadiness(inv, scenario).equipment[0]?.status).toBe('evaluated')
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s rejects missing, wrong source/tier/effect, extra or duplicate fixed effects', (id) => {
    const b = build(id), effect = builtinProcMeleeEnchantments(id)[0]!
    const bad: readonly (readonly SelectedEnchantment[])[] = [[], [{ ...effect, source: 'slot' }], [{ ...effect, source: 'gilded' }], [{ ...effect, tier: 2 }], [{ ...effect, enchantmentId: 'radiance' }], [effect, effect], [effect, { enchantmentId: 'radiance', tier: 1, source: 'built-in' }]]
    for (const enchantments of bad) expect(() => evaluate({ ...b, enchantments: [b.enchantments[0]!, ...enchantments] }, scenario)).toThrow()
    const normal = withSlot(b, effect.enchantmentId, 1)
    expect(() => evaluate(normal, scenario)).toThrow()
    const gilded = { ...b, weapon: { ...b.weapon, gilded: { enchantmentId: effect.enchantmentId, tier: 1 as const } }, enchantments: [b.enchantments[0]!, { ...effect, source: 'gilded' as const }, effect] }
    expect(() => evaluate(gilded, scenario)).toThrow()
    const differentGilded = { ...b, weapon: { ...b.weapon, gilded: { enchantmentId: 'radiance', tier: 2 as const } }, enchantments: [b.enchantments[0]!, { enchantmentId: 'radiance' as const, tier: 2 as const, source: 'gilded' as const }, effect] }
    expect(evaluate(differentGilded, scenario).build.enchantments).toEqual(differentGilded.enchantments)
  })
  it.each(oldIds)('%s rejects forged built-ins and keeps its prior plain arithmetic', (id) => {
    const b = build(id)
    expect(builtinProcMeleeEnchantments(id)).toEqual([])
    const profile = ATTACK_PROFILES[id].value
    if (profile.method !== 'published-hit-timings') throw new Error('Legacy published profile changed')
    expect(evaluate(b, scenario).damage.singleTargetDps).toBeCloseTo(100 * profile.hitDurationsSeconds.length / profile.hitDurationsSeconds.reduce((a, n) => a + n, 0))
    expect(() => evaluate({ ...b, enchantments: [{ enchantmentId: 'shockwave', tier: 1, source: 'built-in' }] }, scenario)).toThrow()
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s preserves proc range independently of observed direct damage', (id) => {
    const b = build(id), f = BUILTIN_PROC_MELEE_FACTS[id]
    for (const powerLevel of [f.min, f.max]) expect(evaluate({ ...b, weapon: { ...b.weapon, powerLevel } }, scenario).damage.damageEvents[0]?.damagePerEvent).toBeGreaterThan(0)
    for (const powerLevel of [f.min - 1, f.max + 1]) for (const observedDamagePerHit of [undefined, 100]) expect(() => evaluate({ ...b, weapon: { ...b.weapon, powerLevel, observedDamagePerHit } }, scenario)).toThrow('Power')
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s rejects unknown new interactions without changing legacy selectable proc + Void', (id) => {
    const b = build(id)
    for (const enchantment of ['void-strike', 'rampaging', 'pain-cycle', 'dynamo'] as const) expect(() => evaluate(withSlot(b, enchantment), scenario)).toThrow()
    expect(() => evaluate(b, { ...scenario, averageTargetsInReach: 2 })).toThrow('単体')
    expect(() => evaluate({ ...b, artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow('速度')
    expect(() => evaluate({ ...b, armor: { instanceId: 'renegade', armorId: 'renegade-armor', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [] }, armorEnchantments: [] }, scenario)).toThrow()
    const legacy = withSlot(build('double-axe'), 'void-strike')
    const effect = BUILTIN_PROC_MELEE_FACTS[id].enchantmentId
    const old: Build = { ...legacy, weapon: { ...legacy.weapon, enchantmentSlots: [...legacy.weapon.enchantmentSlots, { candidates: [effect], selected: { enchantmentId: effect, tier: 1 } }] }, enchantments: [...legacy.enchantments, { enchantmentId: effect, tier: 1, source: 'slot' }] }
    expect(evaluate(old, scenario).damage.damageEvents[0]?.sourceId).toBe(effect)
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s distinguishes scenario constraints from unsupported data and retains reordered Research tuple values', (id) => {
    const b = build(id), inventory = { weapons: [b.weapon], artifacts: [] }
    const constrained = inspectInventoryReadiness(inventory, { ...scenario, averageTargetsInReach: 2 })
    expect(constrained.equipment[0]).toMatchObject({ status: 'constrained', issues: [{ kind: 'constrained', target: 'scenario' }] })
    expect(inspectInventoryReadiness(inventory, scenario).equipment[0]?.status).toBe('evaluated')
    const voidBuild = withSlot(b, 'void-strike')
    expect(inspectInventoryReadiness({ weapons: [voidBuild.weapon], artifacts: [] }, scenario).equipment[0]?.status).toBe('constrained')
    const wrongPower = { ...b.weapon, powerLevel: BUILTIN_PROC_MELEE_FACTS[id].min - 1 }
    expect(inspectInventoryReadiness({ weapons: [wrongPower], artifacts: [] }, scenario).equipment[0]?.status).toBe('unsupported')
    const fixed = builtinProcMeleeEnchantments(id)[0]!
    const reordered: CatalogResearchAttributes = { enchantments: [{ source: 'built-in', tier: 1, enchantmentId: fixed.enchantmentId }] }
    expect(evaluate(withResearch(id, reordered), scenario).damage).toEqual(evaluate(b, scenario).damage)
    for (const wrong of [{ source: 'built-in' as const, tier: 2 as const, enchantmentId: fixed.enchantmentId }, { source: 'built-in' as const, tier: 1 as const, enchantmentId: 'unknown' }, { source: 'gilded' as const, tier: 1 as const, enchantmentId: fixed.enchantmentId }]) expect(() => evaluate(withResearch(id, { enchantments: [wrong] }), scenario)).toThrow('Research')
  })
  it('rejects all source/value/identity/ownership/profile/grant drift', () => {
    const base: BuiltinProcMeleeInputs = { approvals, source: snapshot, identities, profiles, harvest, procAudit, weapons: WEAPONS, runtimeProfiles: ATTACK_PROFILES }
    for (const id of BUILTIN_PROC_MELEE_IDS) {
      const sourceChanges: ((d: BuiltinProcMeleeInputs) => void)[] = [
        (d) => { d.approvals.approvals = [] }, (d) => { d.approvals.approvals.push(d.approvals.approvals.find((r) => r.targetId === id)!) },
        (d) => { Object.assign(d.weapons[id].internalPowerRating, { value: d.weapons[id].internalPowerRating.value + 1 }) },
        (d) => { Object.assign(d.weapons[id].internalPowerRating.source, { id: 'unbound' }) },
        (d) => { Object.assign(d.runtimeProfiles[id].source, { id: 'unbound' }) },
        (d) => { d.source.ownershipReconciliation = 'unreviewed counter interpretation' },
        (d) => { d.source.gameVersion = 'unknown' }, (d) => { d.source.calculatorSource.htmlSha256 = 'changed' },
        (d) => { d.source.rows.find((r) => r.id === id)!.calculatorRow.power += 1 },
        (d) => { d.source.rows.find((r) => r.id === id)!.calculatorRow.builtIn = [] },
        (d) => { d.source.rows.find((r) => r.id === id)!.intrinsicFacts = [] },
        (d) => { d.source.rows.find((r) => r.id === id)!.intrinsicFacts.push('unknown effect') },
        (d) => { d.source.rows.find((r) => r.id === id)!.builtIn.tier = 2 },
        (d) => { d.source.rows.find((r) => r.id === id)!.rawIdentity += '_2' },
        (d) => { d.identities.identityAssertions.find((r) => r.domainId === id)!.reviewState = 'held' },
        (d) => { const claim = d.harvest.claims.find((r) => r.entityId === `melee-weapon:${id}` && r.property === 'intrinsicMechanicOwnership')!; claim.sourceId = 'unbound' },
        (d) => { d.profiles.weapons.find((r) => r.weaponId === id)!.attackProfile.hitDurationsSeconds = [99] },
        (d) => { d.procAudit.entries.find((r) => r.id === BUILTIN_PROC_MELEE_FACTS[id].enchantmentId)!.builtIn.runtimeEnabled = false },
        (d) => { d.procAudit.entries.find((r) => r.id === BUILTIN_PROC_MELEE_FACTS[id].enchantmentId)!.trigger.probability = 0 },
        (d) => { d.procAudit.entries.find((r) => r.id === BUILTIN_PROC_MELEE_FACTS[id].enchantmentId)!.tiers['1'].multiplier = 2 },
      ]
      for (const change of sourceChanges) { const d = structuredClone(base); change(d); expect(builtinProcMeleeReuseIsEligible(id, d)).toBe(false) }
    }
    const extra = structuredClone(approvals); extra.approvals.push({ ...extra.approvals[0]!, targetId: 'cursed-axe' })
    expect(collectBuiltinProcMeleeReuseErrors({ approvals: extra }).length).toBeGreaterThan(0)
  })
  it('source withdrawal rejects the whole equipment even with observed input, without removing its mandatory fixed tuple', async () => {
    const removed = structuredClone(approvals); removed.approvals = []
    vi.resetModules(); vi.doMock('../research/runtime/builtin-proc-melee-reuse.json', () => ({ default: removed }))
    try {
      const { evaluate: isolated } = await import('../src/core/evaluate')
      const { parameterEvidenceForBuild: evidence } = await import('../src/core/evidenceStatus')
      expect(() => isolated(build('whirlwind'), scenario)).toThrow('source')
      expect(evidence(build('whirlwind')).filter((e) => e.mechanicId === 'melee:whirlwind').every((e) => e.status === 'unclassified')).toBe(true)
      expect(builtinProcMeleeEnchantments('whirlwind')).toEqual([{ enchantmentId: 'shockwave', tier: 1, source: 'built-in' }])
    } finally { vi.doUnmock('../research/runtime/builtin-proc-melee-reuse.json'); vi.resetModules() }
  })
})

describe('fixed built-in catalog migration and Research no-ignore', () => {
  it.each([1, 2, 3, 4, 5, 6])('preserves Catalog v%s records losslessly without inferred damage or rolls', (version) => {
    const catalogItems = BUILTIN_PROC_MELEE_IDS.map((id) => ({ instanceId: id, category: 'melee', catalogId: id, powerLevel: 251, rarity: 'unique', notes: 'keep', isFavorite: true, enchantmentSlots: [{ candidates: ['critical-hit', 'echo'], selected: { enchantmentId: 'critical-hit', tier: 2 } }], gilded: { enchantmentId: 'radiance', tier: 1 }, research: { enchantments: builtinProcMeleeEnchantments(id), observations: [{ parameterId: 'damage', value: '99999', unit: 'unverified' }], intrinsicProperties: BUILTIN_PROC_MELEE_FACTS[id].intrinsic.map((raw) => ({ kind: 'intrinsicMechanicOwnership', raw })) } }))
    const result = deserializeInventory(JSON.stringify({ version, inventory: { weapons: [], artifacts: [], catalogItems } }))
    expect(result.catalogItems ?? []).toEqual([])
    for (const [index, owned] of result.weapons.entries()) {
      const { category, catalogId, ...old } = catalogItems[index]!
      expect(category).toBe('melee')
      expect(owned).toEqual({ ...old, weaponId: catalogId })
      expect(owned.observedDamagePerHit).toBeUndefined()
      const optimized = optimize({ weapons: [owned], artifacts: [] }, scenario)
      expect(optimized.best.build.enchantments.filter((e) => e.source === 'built-in')).toEqual(builtinProcMeleeEnchantments(owned.weaponId))
    }
    expect(deserializeInventory(serializeInventory(result))).toEqual(result)
  })
  it.each(BUILTIN_PROC_MELEE_IDS)('%s validates retained fixed and intrinsic metadata without applying them twice', (id) => {
    const fixed = builtinProcMeleeEnchantments(id)
    expect(evaluate(withResearch(id, { enchantments: fixed }), scenario).damage).toEqual(evaluate(build(id), scenario).damage)
    for (const research of [{ enchantments: [{ ...fixed[0]!, tier: 2 as const }] }, { enchantments: [fixed[0]!, fixed[0]!] }, { intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'unknown effect' }] }, { enchantments: [{ enchantmentId: 'shockwave', tier: 1 as const, source: 'slot' as const }] }]) expect(() => evaluate(withResearch(id, research), scenario)).toThrow('Research')
  })
  it('preserves the prior 153 complete Identity records and appends only these two targets', () => {
    const before = JSON.parse(execFileSync('git', ['show', 'ab4450f110346ff8125bc2312c48742bca036be0:research/domain/formal/identity-evidence-v1.json'], { maxBuffer: 16 * 1024 * 1024 }).toString()) as typeof identities
    expect(before.identityAssertions).toHaveLength(153)
    expect(identities.identityAssertions.slice(0, 153)).toEqual(before.identityAssertions)
    const oldIds = new Set(before.identityAssertions.map((r) => r.id)), refs = new Set(before.provenance.evidence.map((r) => r.id))
    expect(identities.semantic.identities.filter((r) => oldIds.has(r.assertionId))).toEqual(before.semantic.identities)
    expect(identities.provenance.evidence.filter((r) => refs.has(r.id))).toEqual(before.provenance.evidence)
    expect(identities.identityAssertions.slice(153).map((r) => r.domainId)).toEqual(BUILTIN_PROC_MELEE_IDS)
    for (const p of ['src/data/plainMelee.ts', 'research/runtime/plain-melee-reuse.json', 'research/sources/plain-melee-source-snapshot.json', 'research/sources/great-hammer-localization-identity.json']) expect(execFileSync('git', ['diff', 'ab4450f110346ff8125bc2312c48742bca036be0', '--', p]).toString()).toBe('')
  })
})
