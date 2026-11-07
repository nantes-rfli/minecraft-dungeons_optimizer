import identities from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import values from '../../research/domain/formal/value-availability-v2.json' with { type: 'json' }
import profiles from '../../research/melee-attack-profile-audit.json' with { type: 'json' }
import harvest from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' with { type: 'json' }
import approvals from '../../research/runtime/observed-melee-combo-reuse.json' with { type: 'json' }
import {
  isObservedMeleeComboId, OBSERVED_MELEE_COMBO_IDS, OBSERVED_MELEE_COMBO_PROFILES,
  OBSERVED_MELEE_COMBO_SOURCE, OBSERVED_MELEE_COMBO_WEAPONS,
} from '../data/observedMeleeCombo'
import { hasObservedMeleeDamage } from './observedMeleeCombo'
import { ARMORS } from '../data/armors'
import type { Build, OwnedWeapon, Scenario } from './types'
import type { ArmorId } from './armor'
import type { ReadinessIssue } from './readiness'

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const allowedEnchantments = ['critical-hit', 'sharpness', 'unchanting', 'smiting', 'radiance'] as const
const defaults = { identities, values, profiles, harvest, approvals, source: OBSERVED_MELEE_COMBO_SOURCE, weapons: OBSERVED_MELEE_COMBO_WEAPONS, runtimeProfiles: OBSERVED_MELEE_COMBO_PROFILES }

export function observedMeleeComboIsEligible(id: string, overrides: Partial<typeof defaults> = {}): boolean {
  if (!isObservedMeleeComboId(id)) return false
  const data = { ...defaults, ...overrides }
  const grant = data.approvals
  const rows = data.source.rows.filter((row) => row.id === id)
  const row = rows[0]
  const weapon = data.weapons[id]
  const profile = data.runtimeProfiles[id]
  if (rows.length !== 1 || !row || !weapon || profile?.value.method !== 'published-hit-timings') return false
  const assertion = data.identities.identityAssertions.find((item) => item.domainId === id)
  const semantic = data.identities.semantic.identities.find((item) => item.assertionId === assertion?.id)
  const raw = data.values.semantic.melee[id]
  const audit = data.profiles.weapons.find((item) => item.weaponId === id)
  const claims = data.harvest.claims.filter((claim) => claim.entityId === `melee-weapon:${id}` && claim.property === 'intrinsicMechanicOwnership')
  const ownDetail = id === 'katana' || id === 'mace'
  const intrinsicMatches = ownDetail
    ? claims.length === 0 && row.intrinsicFacts.length === 0 && row.detailReview === 'Normal three-hit combo with stronger finisher and no additional intrinsic or built-in listed for this target.'
    : claims.length === 1 && row.detailReview === null && claims[0]?.sourceId === `external-dungeons-tools:melee-weapon:${id}`
      && claims[0].sourceGameVersion === '1.17.0.0 publisher-claimed' && claims[0].interpretation === 'direct'
      && claims[0].sourceLocator === `${row.sourceUrl} — Properties and details` && equal(claims[0].value, row.intrinsicFacts)
  const count = row.hitDurationsSeconds.length
  return grant.schemaVersion === 1 && grant.gameVersion === '1.17.0.0' && grant.route === 'existing-limited-mechanic-reuse'
    && grant.classification === 'derived' && grant.runtimeSupport === 'limited' && grant.donorId === 'soul-scythe'
    && grant.mechanic === 'observed-direct-melee-at-published-combo-cadence' && grant.scope === 'single-target-uninterrupted-complete-combos-at-base-speed'
    && grant.sourceRef === 'research/sources/observed-melee-combo-source.json' && grant.testRef === 'tests/observedMeleeCombo.test.ts'
    && equal(grant.allowedMeleeEnchantments, allowedEnchantments) && equal(grant.targets, OBSERVED_MELEE_COMBO_IDS)
    && data.source.schemaVersion === 1 && data.source.gameVersion === grant.gameVersion && data.profiles.gameVersion === grant.gameVersion
    && data.harvest.targetGameVersion === grant.gameVersion && equal(data.source.rows.map((item) => item.id), OBSERVED_MELEE_COMBO_IDS)
    && data.source.calculatorSource.url === 'https://www.dungeons.tools/damage-calculator'
    && data.source.calculatorSource.htmlSha256 === '47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1'
    && row.sourceUrl === `https://www.dungeons.tools/weapons/${id}` && row.calculatorRow.route === `/weapons/${id}`
    && row.calculatorRow.slug === id && row.calculatorRow.type === 'melee' && row.calculatorRow.isUnique === false && row.calculatorRow.rarity === 'Common'
    && row.calculatorRow.builtIn.length === 0 && intrinsicMatches
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high'
    && assertion.rawIdentity === row.rawIdentity && assertion.applicationScope.packagePath === row.packagePath
    && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === id
    && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === row.rawIdentity
    && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === row.rawIdentity
    && audit?.status === 'exact' && !audit.specialHandlingRequired && audit.name.en === row.calculatorRow.name
    && audit.sources.length === 1 && audit.sources[0]?.type === 'minecraft-wiki' && audit.sources[0].url === row.wikiTimingSource
    && audit.attackProfile.comboHits === count && audit.attackProfile.comboFinisherHit === count
    && equal(audit.attackProfile.hitDurationsSeconds, row.hitDurationsSeconds)
    && count > 1 && new Set(row.publishedBaseDamage).size > 1 && row.publishedBaseDamage.length === count
    && equal(audit.damageProfile.rawBaseDamageRows.map((hit) => hit.baseDamage), row.publishedBaseDamage)
    && raw?.attacks.length === count && equal(raw.configuredAttacks.value, row.hitDurationsSeconds.map((_, index) => index))
    && raw.attacks.every((hit, index) => hit.sourceIndex === index
      && hit.configuredDamage.value === row.publishedBaseDamage[index]
      && hit.configuredAnimationDurationSeconds.value === Math.fround(row.hitDurationsSeconds[index]!)
      && hit.configuredVariantLoopAmount.value === 1
      && hit.configuredAttackVariantType.value === 'EMeleeAttackVariantType::TargetAndSplash')
    && weapon.id === id && weapon.name.en === row.calculatorRow.name
    && weapon.internalPowerRating.value === row.calculatorRow.power && weapon.speed.value === row.calculatorRow.speed
    && weapon.area.value === row.calculatorRow.area && !weapon.soul.acceptsSoulEnchantments && weapon.soul.baseSoulGathering.value === 0
    && profile.source.url === row.wikiTimingSource && profile.source.kind === 'published-reference'
    && profile.value.comboFinisherHit === count && equal(profile.value.hitDurationsSeconds, row.hitDurationsSeconds)
}

const eligibleTargets = new Set<string>(OBSERVED_MELEE_COMBO_IDS.filter((id) => observedMeleeComboIsEligible(id)))
export const hasObservedMeleeComboGrant = (id: string): boolean => eligibleTargets.has(id)

export function collectObservedMeleeComboReuseErrors(): readonly string[] {
  return OBSERVED_MELEE_COMBO_IDS.filter((id) => !observedMeleeComboIsEligible(id))
    .map((id) => `${id}: observed melee combo source/identity/scope drift`)
}

export function observedMeleeComboInputIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return undefined
  if (hasObservedMeleeDamage(weapon)) return undefined
  return {
    kind: 'input-required', target: 'equipment', message: '現在のPowerでのコンボ全段の観測ダメージ合計が必要です。',
    fields: ['同じ個体・Powerで、未強化の単体への通常コンボ1周のダメージ合計'],
  }
}

export function observedMeleeComboRollIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return undefined
  const isAllowed = (id: string) => (allowedEnchantments as readonly string[]).includes(id)
  const blockedSlot = weapon.enchantmentSlots.findIndex((slot) => {
    const locked = slot.selected?.enchantmentId ?? (slot as { locked?: string }).locked
    return locked ? !isAllowed(locked) : slot.candidates.length > 0 && !slot.candidates.some(isAllowed)
  })
  if (weapon.gilded && !isAllowed(weapon.gilded.enchantmentId)) {
    return { kind: 'unsupported', message: `金色Enchant ${weapon.gilded.enchantmentId} と不均一ヒット列の組み合わせは未対応です。` }
  }
  if (blockedSlot >= 0) {
    return { kind: 'constrained', target: 'equipment', message: `スロット${blockedSlot + 1}に完全コンボと併用できる選択肢がありません。` }
  }
  return undefined
}

export function observedMeleeComboPreparationIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  return observedMeleeComboInputIssue(weapon) ?? observedMeleeComboRollIssue(weapon)
}

export function observedMeleeComboUnsupportedReason(build: Build, scenario?: Scenario): string | undefined {
  if (!isObservedMeleeComboId(build.weapon.weaponId)) return undefined
  if (!hasObservedMeleeComboGrant(build.weapon.weaponId)) return 'UNSUPPORTED_COMBO_SOURCE: 対象のIdentity・ヒット列・固有効果のEvidenceが一致しません。'
  if (scenario && scenario.averageTargetsInReach !== 1) return 'UNSUPPORTED_COMBO_TARGETS: 射程内の敵を1に設定してください。'
  const armorSpeed = build.armor && ARMORS[build.armor.armorId as ArmorId]?.meleeAttackSpeedBonus
  if ((armorSpeed !== undefined && armorSpeed !== 0) || build.artifacts.some((item) => item.artifactId === 'death-cap-mushroom')) {
    return 'UNSUPPORTED_COMBO_INTERACTION: 速度効果なしの完全コンボのみ評価できます。'
  }
  const effect = build.enchantments.find((entry) => !(allowedEnchantments as readonly string[]).includes(entry.enchantmentId))
  if (effect) return `UNSUPPORTED_COMBO_INTERACTION: ${effect.enchantmentId}と不均一ヒット列の組み合わせは未対応です。`
  if (build.armorEnchantments?.some((entry) => entry.enchantmentId === 'cowardice')) {
    return 'UNSUPPORTED_COMBO_INTERACTION: Cowardiceの発動時間とヒット列の対応は未検証です。'
  }
  return undefined
}
