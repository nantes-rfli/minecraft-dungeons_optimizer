import grants from '../../research/runtime/plain-melee-reuse.json' with { type: 'json' }
import snapshot from '../../research/sources/plain-melee-source-snapshot.json' with { type: 'json' }
import identity from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import attackAudit from '../../research/melee-attack-profile-audit.json' with { type: 'json' }
import harvest from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' with { type: 'json' }
import { WEAPONS } from '../data/weapons'
import { ATTACK_PROFILES } from '../data/attackProfiles'
import { ARMORS } from '../data/armors'
import { isPlainMeleeId, PLAIN_MELEE_IDS } from '../data/plainMelee'
import type { ArmorId } from './armor'
import type { AttackProfile, Build, Evidence, Scenario, WeaponDefinition, WeaponId } from './types'

const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)
const rejected = ['multiple melee targets', 'Pain Cycle', 'Dynamo', 'Death Cap Mushroom', 'Rampaging', 'Armor attack-speed effects', 'unreviewed built-in or Research effects', 'existing unsupported enchant/armor combinations']
export const PLAIN_MELEE_LIMITATION = 'Limited: 単体の通常近接hitのみ。速度効果・複数対象・Pain Cycle/Dynamo・未対応固有効果は評価できません。Powerは既存曲線50–263内かneutralな表示damage入力。'

/** Separate testable inputs keep source/identity/value drift observable, never
 * granting support merely because a new WEAPONS entry exists. */
export interface PlainMeleeReuseInputs {
  readonly approvals: typeof grants
  readonly source: typeof snapshot
  readonly identities: typeof identity
  readonly profiles: typeof attackAudit
  readonly intrinsicSource: typeof harvest
  readonly weapons: Readonly<Record<WeaponId, WeaponDefinition>>
  readonly runtimeProfiles: Readonly<Record<WeaponId, Evidence<AttackProfile>>>
}
const defaults: PlainMeleeReuseInputs = { approvals: grants, source: snapshot, identities: identity, profiles: attackAudit, intrinsicSource: harvest, weapons: WEAPONS, runtimeProfiles: ATTACK_PROFILES }

export function plainMeleeReuseIsEligible(id: string, overrides: Partial<PlainMeleeReuseInputs> = {}): boolean {
  if (!isPlainMeleeId(id)) return false
  const data = { ...defaults, ...overrides }
  const approvals = data.approvals.approvals.filter((row) => row.targetId === id)
  const rows = data.source.rows.filter((row) => row.id === id)
  if (approvals.length !== 1 || rows.length !== 1) return false
  const grant = approvals[0]!, row = rows[0]!, weapon = data.weapons[id], profile = data.runtimeProfiles[id]
  const assertion = data.identities.identityAssertions.find((entry) => entry.domainId === id)
  const semantic = data.identities.semantic.identities.find((entry) => entry.assertionId === assertion?.id)
  const audit = data.profiles.weapons.find((entry) => entry.weaponId === id)
  const intrinsicClaims = data.intrinsicSource.claims.filter((claim) => claim.entityId === `melee-weapon:${id}` && claim.property === 'intrinsicMechanicOwnership')
  const intrinsic = intrinsicClaims[0]
  const intrinsicSourceId = `external-dungeons-tools:melee-weapon:${id}`
  const intrinsicSources = data.intrinsicSource.sources.filter((entry) => entry.id === intrinsicSourceId)
  const intrinsicSource = intrinsicSources[0]
  const source = data.source
  const intrinsicKnown = id === 'pickaxe'
    ? source.pickaxeDetailReview.url === row.sourceUrl
      && source.pickaxeDetailReview.htmlSha256 === '140a937008d05671c9b84e7c2a22314cc2ccf7bfd1f33b5e2ed44ef4c28d7d3b'
      && source.pickaxeDetailReview.reviewedScope === 'Repeated overhead direct hit, single target, no combo or independently triggered effect. This reviewed source closes the historical source-missing intrinsic field for this bounded reuse only; it does not rewrite the historical harvest.'
      && same(row.intrinsicFacts, [])
    : data.intrinsicSource.schemaVersion === 1 && data.intrinsicSource.targetGameVersion === '1.17.0.0'
      && intrinsicClaims.length === 1 && intrinsic?.sourceId === intrinsicSourceId
      && intrinsic.sourceLocator === `${row.sourceUrl} — Properties and details`
      && intrinsic.sourceGameVersion === '1.17.0.0 publisher-claimed' && intrinsic.interpretation === 'direct'
      && intrinsicSources.length === 1 && intrinsicSource?.url === row.sourceUrl && intrinsicSource.sourceType === 'game-file'
      && intrinsicSource.gameVersion === '1.17.0.0 publisher-claimed' && intrinsicSource.versionStatus === 'claimed-current'
      && same(intrinsic.value, row.intrinsicFacts)
  const values = grant.parameterValues
  return data.approvals.schemaVersion === 1 && data.approvals.route === 'existing-limited-mechanic-reuse'
    && source.schemaVersion === 1 && source.gameVersion === '1.17.0.0' && grant.gameVersion === source.gameVersion
    && source.calculatorSource.url === 'https://www.dungeons.tools/damage-calculator'
    && source.calculatorSource.htmlSha256 === '47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1'
    && source.intrinsicSource.ref === 'research/source-harvest/snapshots/dungeons-tools-2026-09-06.json'
    && source.timingSource.ref === 'research/melee-attack-profile-audit.json'
    && grant.classification === 'derived' && grant.runtimeSupport === 'limited'
    && grant.mechanic === 'published-uniform-hit-direct-melee' && grant.channel === 'direct-melee' && grant.scope === 'single-target-only'
    && grant.donorId === (id === 'soul-knife' ? 'soul-scythe' : 'double-axe')
    && grant.inputPolicy === 'existing-power-curve-or-explicit-neutral-observed-hit'
    && grant.sourceRef === 'research/sources/plain-melee-source-snapshot.json' && grant.testRef === 'tests/plainMeleeReuse.test.ts'
    && same(grant.rejectedInteractions, rejected) && same(grant.builtInEnchantments, [])
    && grant.sourceId === `plain-melee-${id}-117` && grant.profileSourceId === `plain-melee-${id}-profile`
    && row.sourceUrl === `https://www.dungeons.tools/weapons/${id}`
    && row.calculatorRow.slug === id && row.calculatorRow.route === `/weapons/${id}`
    && row.calculatorRow.type === 'melee' && row.calculatorRow.isUnique === false && same(row.calculatorRow.builtIn, [])
    && same(row.intrinsicFacts, grant.intrinsicFacts) && intrinsicKnown
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high' && assertion.rawIdentity === row.rawIdentity && assertion.rawIdentity === grant.rawIdentity
    && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === id
    && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === grant.rawIdentity
    && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === grant.rawIdentity
    && audit?.status === 'exact' && data.profiles.gameVersion === grant.gameVersion && !audit.specialHandlingRequired
    && audit.attackProfile?.comboHits === row.hitDurationsSeconds.length
    && same(audit.attackProfile.hitDurationsSeconds, row.hitDurationsSeconds) && audit.attackProfile.comboFinisherHit === row.comboFinisherHit
    && audit.confidence === 'medium' && audit.sources.length === 1
    && audit.sources.every((entry) => entry.url === row.timingSource && entry.type === 'minecraft-wiki' && entry.confidence === 'medium' && entry.retrievedAt === '2026-08-28' && entry.checkedContext.includes('per-hit Stats table'))
    && same(audit.damageProfile.hitDamageRatios, row.normalizedDamageRatios) && row.normalizedDamageRatios.length === row.hitDurationsSeconds.length
    && row.normalizedDamageRatios.every((ratio) => ratio === 1)
    && !!weapon && weapon.id === id && weapon.name.en === row.calculatorRow.name
    && weapon.internalPowerRating.value === values.internalPowerRating && values.internalPowerRating === row.calculatorRow.power
    && weapon.speed.value === values.speed && values.speed === row.calculatorRow.speed
    && weapon.area.value === values.area && values.area === row.calculatorRow.area
    && weapon.soul.baseSoulGathering.value === values.baseSoulGathering && values.baseSoulGathering === row.baseSoulGathering
    && values.baseSoulGathering === (id === 'soul-knife' ? 1 : 0) && weapon.soul.acceptsSoulEnchantments === (id === 'soul-knife')
    && [weapon.internalPowerRating, weapon.speed, weapon.area].every((entry) => entry.source.id === grant.sourceId && entry.source.url === source.calculatorSource.url && entry.source.kind === 'game-files' && entry.source.label.includes('1.17.0.0'))
    && weapon.soul.baseSoulGathering.source.kind === 'game-files' && weapon.soul.baseSoulGathering.source.label.includes('1.17.0.0') && weapon.soul.baseSoulGathering.source.id === grant.sourceId && weapon.soul.baseSoulGathering.source.url === row.sourceUrl
    && !!profile && profile.source.id === grant.profileSourceId && profile.source.url === row.timingSource && profile.source.kind === 'published-reference'
    && profile.value.method === 'published-hit-timings' && same(profile.value.hitDurationsSeconds, row.hitDurationsSeconds) && profile.value.comboFinisherHit === row.comboFinisherHit
}

export function collectPlainMeleeReuseErrors(overrides: Partial<PlainMeleeReuseInputs> = {}): readonly string[] {
  const data = { ...defaults, ...overrides }
  const errors: string[] = []
  const allowedRuntimeIds = ['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe', ...PLAIN_MELEE_IDS]
  if (!same(Object.keys(data.weapons).sort(), allowedRuntimeIds.sort())) errors.push('Melee runtime registration lacks a finite reviewed source-bound grant')
  for (const id of PLAIN_MELEE_IDS) if (!plainMeleeReuseIsEligible(id, data)) errors.push(`${id}: source-bound plain melee Limited reuse drift`)
  if (!same(data.approvals.approvals.map((row) => row.targetId), PLAIN_MELEE_IDS) || !same(data.source.rows.map((row) => row.id), PLAIN_MELEE_IDS)) errors.push('plain melee eligible population drift')
  return errors
}

/** Retained Research is inert provenance, but known effects cannot become none. */
export function meleeResearchUnsupportedReason(build: Build): string | undefined {
  const research = build.weapon.research
  if (!research) return undefined
  const fixed = research.enchantments?.filter((entry) => entry.source !== 'slot') ?? []
  const keys = fixed.map((entry) => `${entry.source}:${entry.enchantmentId}:${entry.tier}`)
  const slots = new Map<string, number>()
  for (const entry of build.enchantments) if (entry.source === 'slot') {
    const key = `${entry.enchantmentId}:${entry.tier}`
    slots.set(key, (slots.get(key) ?? 0) + 1)
  }
  const missingSlot = research.enchantments?.filter((entry) => entry.source === 'slot').some((entry) => {
    const key = `${entry.enchantmentId}:${entry.tier}`, count = slots.get(key) ?? 0
    slots.set(key, count - 1)
    return count < 1
  })
  if (new Set(keys).size !== keys.length || fixed.filter((entry) => entry.source === 'gilded').length > 1 || missingSlot
    || fixed.some((entry) => entry.source === 'built-in' || entry.enchantmentId !== build.weapon.gilded?.enchantmentId || entry.tier !== build.weapon.gilded?.tier)) return 'UNSUPPORTED_MELEE_RESEARCH: 旧ResearchのEnchantと個体入力が未整合です。記録を明示的に確認・修正してください。'
  const row = snapshot.rows.find((entry) => entry.id === build.weapon.weaponId)
  // Match only the finite reviewed plain intrinsic facts. No broad taxonomy or
  // interpretation of arbitrary strings, and no empty default for unknowns.
  if (research.intrinsicProperties?.some((property) => property.kind !== 'intrinsicMechanicOwnership' || !row?.intrinsicFacts.includes(property.raw))) return 'UNSUPPORTED_MELEE_RESEARCH: 旧Researchの未対応固有効果を無視して評価できません。'
  return undefined
}

export function plainMeleeUnsupportedReason(build: Build, scenario?: Scenario): string | undefined {
  const research = meleeResearchUnsupportedReason(build)
  if (research) return research
  if (!isPlainMeleeId(build.weapon.weaponId)) return undefined
  if (!plainMeleeReuseIsEligible(build.weapon.weaponId)) return 'UNSUPPORTED_PLAIN_MELEE_SOURCE: source-bound Limited reuse条件が一致しません。観測値では解決しません。'
  if (scenario && scenario.averageTargetsInReach !== 1) return 'UNSUPPORTED_PLAIN_MELEE_TARGETS: 新規近接LimitedはaverageTargetsInReach=1のみです。未検証のsplashやreachを換算できません。'
  const armorSpeed = build.armor && ARMORS[build.armor.armorId as ArmorId]?.meleeAttackSpeedBonus
  if (build.enchantments.some((entry) => ['pain-cycle', 'dynamo', 'rampaging'].includes(entry.enchantmentId))
    || build.artifacts.some((entry) => entry.artifactId === 'death-cap-mushroom') || (armorSpeed !== undefined && armorSpeed !== 0)) return 'UNSUPPORTED_PLAIN_MELEE_SPEED_OR_CHARGE: 新規近接Limitedでは速度効果・Pain Cycle・Dynamoの適用が未検証です。'
  return undefined
}
