import type { ArmorId } from './armor'
import approvals from '../../research/runtime/builtin-proc-melee-reuse.json' with { type: 'json' }
import snapshot from '../../research/sources/builtin-proc-melee-source-snapshot.json' with { type: 'json' }
import identities from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import profiles from '../../research/melee-attack-profile-audit.json' with { type: 'json' }
import harvest from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' with { type: 'json' }
import procAudit from '../../research/damage-event-audit.json' with { type: 'json' }
import { BUILTIN_PROC_MELEE_FACTS, BUILTIN_PROC_MELEE_IDS, builtinProcMeleeEnchantments, builtinProcProfileSource, builtinProcStatSource, isBuiltinProcMeleeId } from '../data/builtinProcMelee'
import { WEAPONS } from '../data/weapons'
import { ATTACK_PROFILES } from '../data/attackProfiles'
import { ARMORS } from '../data/armors'
import type { Build, Scenario } from './types'
import { procPowerRange } from './damageEvents'
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sourceRef = 'research/sources/builtin-proc-melee-source-snapshot.json'
const rejected = ['multiple melee targets', 'Pain Cycle', 'Dynamo', 'Death Cap Mushroom', 'Rampaging', 'Armor attack-speed effects', 'Void Strike', 'unreviewed built-in or Research effects', 'existing unsupported enchant/armor combinations']
export const BUILTIN_PROC_MELEE_LIMITATION = 'Limited: 固定Built-in Tier Iを含む単体・基本速度のみ。Void Strike・速度効果・Pain Cycle/Dynamoは未対応。procは既存公開Power表の範囲内のみで、直撃観測値から外挿しません。'
export interface BuiltinProcMeleeInputs { approvals: typeof approvals; source: typeof snapshot; identities: typeof identities; profiles: typeof profiles; harvest: typeof harvest; procAudit: typeof procAudit; weapons: typeof WEAPONS; runtimeProfiles: typeof ATTACK_PROFILES }
const defaults: BuiltinProcMeleeInputs = { approvals, source: snapshot, identities, profiles, harvest, procAudit, weapons: WEAPONS, runtimeProfiles: ATTACK_PROFILES }
export function builtinProcMeleeReuseIsEligible(id: string, overrides: Partial<BuiltinProcMeleeInputs> = {}): boolean {
  if (!isBuiltinProcMeleeId(id)) return false
  const d = { ...defaults, ...overrides }, f = BUILTIN_PROC_MELEE_FACTS[id]
  const grants = d.approvals.approvals.filter((r) => r.targetId === id), rows = d.source.rows.filter((r) => r.id === id)
  if (grants.length !== 1 || rows.length !== 1 || !same(d.approvals.approvals.map((r) => r.targetId), BUILTIN_PROC_MELEE_IDS) || !same(d.source.rows.map((r) => r.id), BUILTIN_PROC_MELEE_IDS)) return false
  const grant = grants[0]!, row = rows[0]!, fixed = builtinProcMeleeEnchantments(id)[0]!
  const assertion = d.identities.identityAssertions.filter((r) => r.domainId === id)
  const semantic = d.identities.semantic.identities.filter((r) => r.assertionId === assertion[0]?.id)
  const intrinsic = d.harvest.claims.filter((r) => r.entityId === `melee-weapon:${id}` && r.property === 'intrinsicMechanicOwnership')
  const sourceId = `external-dungeons-tools:melee-weapon:${id}`, url = `https://www.dungeons.tools/weapons/${id}`
  const intrinsicSources = d.harvest.sources.filter((r) => r.id === sourceId)
  const audit = d.profiles.weapons.filter((r) => r.weaponId === id)
  const proc = d.procAudit.entries.filter((r) => r.id === f.enchantmentId)
  const weapon = d.weapons[id], profile = d.runtimeProfiles[id]
  const range = procPowerRange(f.enchantmentId)
  return d.approvals.schemaVersion === 1 && d.approvals.route === 'existing-limited-mechanic-reuse' && d.approvals.mechanic === 'published-uniform-hit-fixed-builtin-proc'
    && d.approvals.gameVersion === '1.17.0.0' && d.approvals.sourceRef === sourceRef && d.approvals.testRef === 'tests/builtinProcMeleeReuse.test.ts'
    && same(d.approvals.rejectedInteractions, rejected)
    && same(grant, { targetId: id, rawIdentity: f.rawIdentity, classification: 'derived', runtimeSupport: 'limited', scope: 'single-target-base-cadence', builtIn: fixed, procPowerRange: { min: f.min, max: f.max } })
    && d.source.schemaVersion === 1 && d.source.gameVersion === '1.17.0.0'
    && same(d.source.calculatorSource, { url: 'https://www.dungeons.tools/damage-calculator', htmlSha256: '47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1', versionBasis: 'Publisher-claimed 1.17.0.0, independently decoded target-owned rows; not independent gameplay validation.' })
    && d.source.tierSourceRef === 'research/damage-event-audit.json' && d.source.intrinsicSourceRef === 'research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' && d.source.profileSourceRef === 'research/melee-attack-profile-audit.json'
    && d.source.ownershipReconciliation === 'Historical enchantment-page BUILT INTO 0 was an aggregate display observation, not a target-specific negative gameplay claim. The hash-bound target-owned calculator rows explicitly name each built-in; their positive ownership is adopted with the pre-existing per-target Wiki Tier I record. No interpretation of the old counter implementation is asserted.'
    && same(row, { id, rawIdentity: f.rawIdentity, calculatorRow: { slug: id, name: f.name, type: 'melee', route: `/weapons/${id}`, power: f.power, speed: f.speed, area: f.area, isUnique: true, rarity: 'Unique', pack: 'Base Game', icon: `/images/items/T_${f.rawIdentity}_Icon.png`, builtIn: [f.enchantmentId === 'shockwave' ? 'Shockwave' : 'Thundering'] }, intrinsicFacts: f.intrinsic, baseSoulGathering: 0, hitDurationsSeconds: f.durations, comboFinisherHit: f.durations.length, normalizedDamageRatios: f.durations.map(() => 1), timingSource: builtinProcProfileSource(id).url, builtIn: fixed })
    && assertion.length === 1 && assertion[0]?.reviewState === 'accepted' && assertion[0]?.confidence === 'high' && assertion[0]?.rawIdentity === f.rawIdentity
    && assertion[0]?.applicationScope.packagePath === `Dungeons/Content/Actors/Equipment/MeleeWeapons/${f.rawIdentity}/BP_${f.rawIdentity}Instance`
    && semantic.length === 1 && semantic[0]?.resolution.state === 'matched' && semantic[0]?.resolution.domainId === id
    && semantic[0]?.rawEvidence.itemIdName.state === 'known' && semantic[0]?.rawEvidence.itemIdName.value === f.rawIdentity && semantic[0]?.rawEvidence.serializedId.state === 'known' && semantic[0]?.rawEvidence.serializedId.value === f.rawIdentity
    && d.harvest.targetGameVersion === '1.17.0.0' && intrinsic.length === 1 && intrinsic[0]?.sourceId === sourceId && intrinsic[0]?.sourceLocator === `${url} — Properties and details` && intrinsic[0]?.interpretation === 'direct' && intrinsic[0]?.sourceGameVersion === '1.17.0.0 publisher-claimed' && same(intrinsic[0]?.value, f.intrinsic)
    && intrinsicSources.length === 1 && intrinsicSources[0]?.url === url && intrinsicSources[0]?.gameVersion === '1.17.0.0 publisher-claimed' && intrinsicSources[0]?.versionStatus === 'claimed-current' && intrinsicSources[0]?.sourceType === 'game-file'
    && d.profiles.gameVersion === '1.17.0.0' && audit.length === 1 && audit[0]?.status === 'exact' && !audit[0]?.specialHandlingRequired && audit[0]?.confidence === 'medium'
    && same(audit[0]?.attackProfile.hitDurationsSeconds, f.durations) && audit[0]?.attackProfile.comboHits === f.durations.length && audit[0]?.attackProfile.comboFinisherHit === f.durations.length && same(audit[0]?.damageProfile.hitDamageRatios, f.durations.map(() => 1))
    && audit[0]?.sources.length === 1 && audit[0]?.sources[0]?.url === row.timingSource && audit[0]?.sources[0]?.type === 'minecraft-wiki' && audit[0]?.sources[0]?.retrievedAt === '2026-08-28'
    && d.procAudit.gameVersion === '1.17.0.0' && proc.length === 1 && proc[0]?.builtIn.weapon === f.name && proc[0]?.builtIn.tier === 1 && proc[0]?.builtIn.runtimeEnabled === true
    && proc[0]?.trigger.type === (id === 'whirlwind' ? 'combo-finisher' : 'on-hit-probability') && proc[0]?.trigger.probability === (id === 'whirlwind' ? 1 : 0.3) && proc[0]?.trigger.requiresTargetHit === (id === 'stormlander')
    && proc[0]?.tiers['1'].multiplier === 1 && proc[0]?.powerScaling.supportedPowerRange.min === f.min && proc[0]?.powerScaling.supportedPowerRange.max === f.max && proc[0]?.stacking.maxCopies === 1 && proc[0]?.attribution.directWeaponKill === false
    && same(proc[0]?.builtIn.runtimeScope, { weaponId: id, enchantmentId: f.enchantmentId, tier: 1, source: 'built-in', grantRef: 'research/runtime/builtin-proc-melee-reuse.json', scope: 'single-target-base-cadence-no-void' })
    && proc[0]?.sources.some((s) => s.type === 'minecraft-wiki' && s.url === `https://minecraft.wiki/w/Dungeons:${f.enchantmentId === 'shockwave' ? 'Shockwave' : 'Thundering'}` && s.supports.includes('built-in')) === true
    && range.min === f.min && range.max === f.max
    && !!weapon && weapon.id === id && weapon.name.en === f.name && same(weapon.internalPowerRating.source, builtinProcStatSource(id)) && weapon.internalPowerRating.confidence === 'high' && weapon.speed.confidence === 'high' && weapon.area.confidence === 'high' && weapon.internalPowerRating.value === f.power && weapon.speed.value === f.speed && weapon.area.value === f.area
    && same(weapon.speed.source, builtinProcStatSource(id)) && same(weapon.area.source, builtinProcStatSource(id)) && weapon.soul.baseSoulGathering.confidence === 'high' && weapon.soul.baseSoulGathering.value === 0 && !weapon.soul.acceptsSoulEnchantments && same(weapon.soul.baseSoulGathering.source, { ...builtinProcStatSource(id), url })
    && !!profile && profile.confidence === 'medium' && same(profile.source, builtinProcProfileSource(id)) && profile.value.method === 'published-hit-timings' && same(profile.value.hitDurationsSeconds, f.durations) && profile.value.comboFinisherHit === f.durations.length
}
export function collectBuiltinProcMeleeReuseErrors(overrides: Partial<BuiltinProcMeleeInputs> = {}): readonly string[] {
  const d = { ...defaults, ...overrides }, errors: string[] = []
  if (!same(d.approvals.approvals.map((r) => r.targetId), BUILTIN_PROC_MELEE_IDS) || !same(d.source.rows.map((r) => r.id), BUILTIN_PROC_MELEE_IDS)) errors.push('Fixed built-in melee population drift')
  for (const id of BUILTIN_PROC_MELEE_IDS) if (!builtinProcMeleeReuseIsEligible(id, d)) errors.push(`${id}: fixed built-in source binding drift`)
  return errors
}
export function builtinProcMeleeUnsupportedReason(build: Build, scenario?: Scenario): string | undefined {
  const id = build.weapon.weaponId
  if (!isBuiltinProcMeleeId(id)) return undefined
  if (!builtinProcMeleeReuseIsEligible(id)) return 'UNSUPPORTED_BUILTIN_MELEE_SOURCE: 固定Built-inのsource/identity/全固有効果の確認が不成立です。'
  const f = BUILTIN_PROC_MELEE_FACTS[id]
  if (!Number.isFinite(build.weapon.powerLevel) || build.weapon.powerLevel < f.min || build.weapon.powerLevel > f.max) return `UNSUPPORTED_BUILTIN_MELEE_POWER: ${id}は固定procのPower ${f.min}–${f.max}のみです。直撃観測値でも外挿できません。`
  if (scenario && scenario.averageTargetsInReach !== 1) return 'UNSUPPORTED_BUILTIN_MELEE_TARGETS: 単体のみ対応です。'
  const speed = build.armor && ARMORS[build.armor.armorId as ArmorId]?.meleeAttackSpeedBonus
  if (build.enchantments.some((e) => ['void-strike', 'pain-cycle', 'dynamo', 'rampaging'].includes(e.enchantmentId)) || build.artifacts.some((a) => a.artifactId === 'death-cap-mushroom') || (speed !== undefined && speed !== 0)) return 'UNSUPPORTED_BUILTIN_MELEE_INTERACTION: Void Strike・速度効果・Pain Cycle/Dynamoは未対応です。'
  const research = build.weapon.research
  const expected = builtinProcMeleeEnchantments(id)[0]!
  if (research?.intrinsicProperties?.some((p) => p.kind !== 'intrinsicMechanicOwnership' || !(f.intrinsic as readonly string[]).includes(p.raw))) return 'UNSUPPORTED_MELEE_RESEARCH: 未対応固有効果を無視できません。'
  const recordedFixed = research?.enchantments?.filter((e) => e.source === 'built-in') ?? []
  if (recordedFixed.length > 1 || recordedFixed.some((e) => e.enchantmentId !== expected.enchantmentId || e.tier !== expected.tier || e.source !== expected.source)) return 'UNSUPPORTED_MELEE_RESEARCH: 固定Built-inの記録が一致しません。'
  return undefined
}
