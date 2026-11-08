import identities from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import values from '../../research/domain/formal/value-availability-v2.json' with { type: 'json' }
import profiles from '../../research/melee-attack-profile-audit.json' with { type: 'json' }
import harvest from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' with { type: 'json' }
import approvals from '../../research/runtime/observed-melee-combo-reuse.json' with { type: 'json' }
import sharpnessApproval from '../../research/runtime/observed-sharpness-combo-reuse.json' with { type: 'json' }
import radianceApproval from '../../research/runtime/observed-radiance-combo-reuse.json' with { type: 'json' }
import freezingApproval from '../../research/runtime/observed-freezing-scythe-reuse.json' with { type: 'json' }
import poisonCloudApproval from '../../research/runtime/observed-poison-cloud-melee-reuse.json' with { type: 'json' }
import fixedApprovals from '../../research/runtime/fixed-observed-melee-combo-reuse.json' with { type: 'json' }
import {
  CONDITIONAL_OBSERVED_MELEE_COMBO_IDS, CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS,
  FIXED_OBSERVED_MELEE_COMBO_IDS, FIXED_OBSERVED_MELEE_COMBO_SOURCE, SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE, SHARPNESS_OBSERVED_MELEE_COMBO_ID,
  RADIANCE_OBSERVED_MELEE_COMBO_ID, RADIANCE_OBSERVED_MELEE_COMBO_SOURCE,
  FREEZING_OBSERVED_MELEE_COMBO_IDS, FREEZING_OBSERVED_MELEE_COMBO_SOURCE, isFreezingObservedMeleeComboId,
  POISON_CLOUD_OBSERVED_MELEE_COMBO_IDS, POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE, isPoisonCloudObservedMeleeComboId,
  fixedObservedMeleeComboEnchantments, isFixedObservedMeleeComboId,
} from '../data/fixedObservedMeleeCombo'
import { ENCHANTMENTS } from '../data/enchantments'
import {
  isObservedMeleeComboId, isPlainObservedMeleeComboId, OBSERVED_MELEE_COMBO_IDS, OBSERVED_MELEE_COMBO_PROFILES,
  OBSERVED_MELEE_COMBO_SOURCE, OBSERVED_MELEE_COMBO_WEAPONS,
} from '../data/observedMeleeCombo'
import { hasObservedMeleeDamage, observedFixedRadianceHeal } from './observedMeleeCombo'
import { dotPowerRange } from './dotDamageEvents'
import { ARMORS } from '../data/armors'
import type { Build, OwnedWeapon, Scenario } from './types'
import type { ArmorId } from './armor'
import type { ReadinessIssue } from './readiness'

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const allowedEnchantments = ['critical-hit', 'sharpness', 'unchanting', 'smiting', 'radiance'] as const
const allowsObservedComboEnchant = (weaponId: string, id: string) => (allowedEnchantments as readonly string[]).includes(id)
  || (isFreezingObservedMeleeComboId(weaponId) && id === 'anima-conduit')
const defaults = { identities, values, profiles, harvest, approvals, source: OBSERVED_MELEE_COMBO_SOURCE, weapons: OBSERVED_MELEE_COMBO_WEAPONS, runtimeProfiles: OBSERVED_MELEE_COMBO_PROFILES }

export function observedMeleeComboIsEligible(id: string, overrides: Partial<typeof defaults> = {}): boolean {
  if (!isPlainObservedMeleeComboId(id)) return false
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

const fixedDefaults = {
  ...defaults, approvals: fixedApprovals, source: FIXED_OBSERVED_MELEE_COMBO_SOURCE,
  sharpnessApproval, sharpnessSource: SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE,
  radianceApproval, radianceSource: RADIANCE_OBSERVED_MELEE_COMBO_SOURCE,
  freezingApproval, freezingSource: FREEZING_OBSERVED_MELEE_COMBO_SOURCE,
  poisonCloudApproval, poisonCloudSource: POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE,
}

export function fixedObservedMeleeComboIsEligible(id: string, overrides: Partial<typeof fixedDefaults> = {}): boolean {
  if (!isFixedObservedMeleeComboId(id)) return false
  const data = { ...fixedDefaults, ...overrides }
  const sharpness = id === SHARPNESS_OBSERVED_MELEE_COMBO_ID
  const radiance = id === RADIANCE_OBSERVED_MELEE_COMBO_ID
  const freezing = isFreezingObservedMeleeComboId(id)
  const poisonCloud = isPoisonCloudObservedMeleeComboId(id)
  const grant = poisonCloud ? data.poisonCloudApproval : freezing ? data.freezingApproval : radiance ? data.radianceApproval : sharpness ? data.sharpnessApproval : data.approvals
  const source = poisonCloud ? data.poisonCloudSource : freezing ? data.freezingSource : radiance ? data.radianceSource : sharpness ? data.sharpnessSource : data.source
  const rows = source.rows.filter((row) => row.id === id)
  const row = rows[0]
  const weapon = data.weapons[id]
  const profile = data.runtimeProfiles[id]
  if (rows.length !== 1 || !row || !weapon || profile?.value.method !== 'published-hit-timings') return false
  const assertion = data.identities.identityAssertions.find((item) => item.domainId === id)
  const semantic = data.identities.semantic.identities.find((item) => item.assertionId === assertion?.id)
  const audit = data.profiles.weapons.find((item) => item.weaponId === id)
  const claims = data.harvest.claims.filter((claim) => claim.entityId === `melee-weapon:${id}` && claim.property === 'intrinsicMechanicOwnership')
  const effect = fixedObservedMeleeComboEnchantments(id)[0]!.enchantmentId
  const critical = effect === 'critical-hit'
  const count = row.hitDurationsSeconds.length
  const tier = ENCHANTMENTS[effect].tiers.value[1]
  const freezingRow = freezing ? data.freezingSource.rows.find((item) => item.id === id) : undefined
  const poisonRow = poisonCloud ? data.poisonCloudSource.rows.find((item) => item.id === id) : undefined
  const tierMatches = poisonCloud ? equal(tier.effect, { kind: 'persistent-area-dot', dotId: 'poison-cloud', durationSeconds: 3, triggerChance: 0.3, tierMultiplier: 1 })
    && poisonRow?.fixed.triggerChance === 0.3 && poisonRow.fixed.durationSeconds === 3 && poisonRow.fixed.tierMultiplier === 1
    : freezing ? tier.effect?.kind === 'enemy-attack-speed-slow' && tier.effect.attackSpeedReduction === 0.3 && tier.effect.durationSeconds === 3
    && freezingRow?.fixed.attackSpeedReduction === 0.3 && freezingRow.fixed.durationSeconds === 3
    : radiance ? tier.triggerChance === 0.2 && 'triggerChance' in row.fixed && row.fixed.triggerChance === tier.triggerChance
    : critical ? tier.triggerChance === 0.1 && tier.damageMultiplier === 3
    : sharpness ? equal(tier.effect, { kind: 'passive-weapon-damage', bonus: 0.1 })
      : equal(tier.effect, { kind: 'conditional-weapon-damage', condition: 'undead-enemy', bonus: 0.25 })
  const approvalMatches = poisonCloud
    ? grant.mechanic === 'owned-tier-one-poison-cloud-on-observed-combo'
      && grant.sourceRef === 'research/sources/observed-poison-cloud-melee.json' && grant.testRef === 'tests/observedPoisonCloudMelee.test.ts'
      && grant.observation === 'own ordinary direct complete combo damage excluding poison ticks at the current equipped Power'
      && 'procPowerRange' in grant && equal(grant.procPowerRange, { min: 184, max: 251 }) && equal(grant.procPowerRange, dotPowerRange('poison-cloud'))
      && equal(grant.targets, { 'nightmares-bite': 'poison-cloud', 'venom-glaive': 'poison-cloud' })
      && equal(source.rows.map((item) => item.id), POISON_CLOUD_OBSERVED_MELEE_COMBO_IDS)
    : freezing
    ? grant.mechanic === 'owned-tier-one-freezing-and-own-flat-soul-gathering'
      && grant.sourceRef === 'research/sources/observed-freezing-scythes.json' && grant.testRef === 'tests/observedFreezingScythes.test.ts'
      && grant.observation === 'own ordinary complete combo damage at the current equipped Power; existing attack slow and flat Soul Gathering models'
      && 'allowedAdditionalEnchantments' in grant && equal(grant.allowedAdditionalEnchantments, ['anima-conduit'])
      && equal(grant.targets, { 'frost-scythe': 'freezing', 'skull-scythe': 'freezing' })
      && equal(source.rows.map((item) => item.id), FREEZING_OBSERVED_MELEE_COMBO_IDS)
    : radiance
    ? grant.mechanic === 'owned-tier-one-radiance-with-observed-self-heal-per-proc'
      && grant.sourceRef === 'research/sources/observed-radiance-combo-source.json' && grant.testRef === 'tests/observedRadianceCombo.test.ts'
      && grant.observation === 'own ordinary complete combo damage and uncapped self healing per fixed Radiance I proc at the current equipped Power, with no healing modifiers'
      && equal(grant.targets, { [RADIANCE_OBSERVED_MELEE_COMBO_ID]: 'radiance' })
      && equal(source.rows.map((item) => item.id), [RADIANCE_OBSERVED_MELEE_COMBO_ID])
    : sharpness
    ? grant.mechanic === 'owned-tier-one-sharpness-already-in-observed-combo'
      && grant.sourceRef === 'research/sources/observed-sharpness-combo-source.json' && grant.testRef === 'tests/observedSharpnessCombo.test.ts'
      && grant.observation === 'complete ordinary combo with the equipped fixed Sharpness I already included, against one unenchanted, non-undead target with no damage reduction or external bonuses'
      && equal(grant.targets, { [SHARPNESS_OBSERVED_MELEE_COMBO_ID]: 'sharpness' })
      && equal(source.rows.map((item) => item.id), [SHARPNESS_OBSERVED_MELEE_COMBO_ID])
    : grant.mechanic === 'owned-tier-one-conditional-direct-modifier-on-observed-combo'
      && grant.sourceRef === 'research/sources/fixed-observed-melee-combo-source.json' && grant.testRef === 'tests/fixedObservedMeleeCombo.test.ts'
      && grant.observation === 'complete combo of ordinary non-critical hits against one unenchanted, non-undead target with no damage reduction or external bonuses'
      && equal(grant.targets, CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS)
      && equal(source.rows.map((item) => item.id), CONDITIONAL_OBSERVED_MELEE_COMBO_IDS)

  const slug = id === 'nightmares-bite' ? 'nightmare-s-bite' : radiance ? 'sun-s-grace' : id
  const localizationName = id === 'venom-glaive' && row.calculatorRow.name === 'Venom Glaive' ? 'Venom glaive' : row.calculatorRow.name
  return grant.schemaVersion === 1 && grant.gameVersion === '1.17.0.0' && grant.route === 'existing-limited-mechanic-reuse'
    && grant.classification === 'derived' && grant.runtimeSupport === 'limited'
    && grant.scope === 'single-target-uninterrupted-complete-combos-at-base-speed' && approvalMatches
    && source.schemaVersion === 1 && source.gameVersion === grant.gameVersion
    && source.calculatorSource.url === 'https://www.dungeons.tools/damage-calculator'
    && source.calculatorSource.htmlSha256 === '47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1'
    && data.profiles.gameVersion === grant.gameVersion && data.harvest.targetGameVersion === grant.gameVersion
    && row.calculatorRow.type === 'melee' && row.calculatorRow.slug === slug && row.calculatorRow.route === `/weapons/${slug}`
    && row.sourceUrl === `https://www.dungeons.tools/weapons/${slug}`
    && equal(row.calculatorRow.builtIn, [poisonCloud ? 'Poison Cloud' : freezing ? 'Freezing' : radiance ? 'Radiance' : critical ? 'Critical Hit' : sharpness ? 'Sharpness' : 'Smiting'])
    && row.fixed.enchantmentId === effect && row.fixed.tier === 1 && tierMatches
    && row.fixed.tierSourceUrl === (poisonCloud ? 'https://minecraft.wiki/w/Dungeons%3APoison_Cloud' : freezing ? 'https://minecraft.wiki/w/Dungeons%3AFreezing' : radiance ? 'https://minecraft.wiki/w/Dungeons%3ARadiance' : critical || sharpness ? row.wikiTimingSource : 'https://minecraft.wiki/w/Dungeons%3ASmiting')
    && claims.length === 1 && claims[0]?.sourceId === `external-dungeons-tools:melee-weapon:${id}`
    && claims[0].sourceGameVersion === '1.17.0.0 publisher-claimed' && claims[0].interpretation === 'direct'
    && claims[0].sourceLocator === `${row.sourceUrl} — Properties and details` && equal(claims[0].value, row.intrinsicFacts)
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high'
    && assertion.rawIdentity === row.rawIdentity && assertion.applicationScope.packagePath === row.packagePath
    && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === id
    && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === row.rawIdentity
    && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === row.rawIdentity
    && (id === 'sinister-sword' ? row.localization === null
      : row.localization?.namespace === 'ItemType' && row.localization.key === row.rawIdentity && row.localization.value === localizationName)
    && audit?.status === 'exact' && !audit.specialHandlingRequired && audit.name.en === row.calculatorRow.name
    && audit.sources.length === 1 && audit.sources[0]?.type === 'minecraft-wiki' && audit.sources[0].url === row.wikiTimingSource
    && count === (freezing ? 2 : id === 'nightmares-bite' ? 6 : 3) && audit.attackProfile.comboHits === count && audit.attackProfile.comboFinisherHit === count
    && equal(audit.attackProfile.hitDurationsSeconds, row.hitDurationsSeconds)
    && row.publishedBaseDamage.length === count && (freezing ? new Set(row.publishedBaseDamage).size === 1 : new Set(row.publishedBaseDamage).size > 1)
    && equal(audit.damageProfile.rawBaseDamageRows.map((hit) => hit.baseDamage), row.publishedBaseDamage)
    && /^shards\/part-\d{3}\.json\.gz$/.test(row.rawSource.shard) && /^[a-f0-9]{64}$/.test(row.rawSource.sha256)
    && Number.isInteger(row.rawSource.packageIndex) && row.rawSource.packageIndex >= 0
    && weapon.id === id && weapon.name.en === row.calculatorRow.name
    && weapon.internalPowerRating.value === row.calculatorRow.power && weapon.speed.value === row.calculatorRow.speed
    && weapon.area.value === row.calculatorRow.area && weapon.soul.acceptsSoulEnchantments === freezing && weapon.soul.baseSoulGathering.value === (freezing ? 1 : 0)
    && (!freezing || (freezingRow?.soul.acceptsSoulEnchantments === true && freezingRow.soul.baseSoulGathering === 1))
    && profile.source.url === row.wikiTimingSource && profile.source.kind === 'published-reference'
    && profile.value.comboFinisherHit === count && equal(profile.value.hitDurationsSeconds, row.hitDurationsSeconds)
}

const eligibleTargets = new Set<string>([
  ...OBSERVED_MELEE_COMBO_IDS.filter((id) => observedMeleeComboIsEligible(id)),
  ...FIXED_OBSERVED_MELEE_COMBO_IDS.filter((id) => fixedObservedMeleeComboIsEligible(id)),
])
export const hasObservedMeleeComboGrant = (id: string): boolean => eligibleTargets.has(id)

export function collectObservedMeleeComboReuseErrors(): readonly string[] {
  return [...OBSERVED_MELEE_COMBO_IDS.filter((id) => !observedMeleeComboIsEligible(id)),
    ...FIXED_OBSERVED_MELEE_COMBO_IDS.filter((id) => !fixedObservedMeleeComboIsEligible(id))]
    .map((id) => `${id}: observed melee combo source/identity/scope drift`)
}

export function observedMeleeComboInputIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return undefined
  if (hasObservedMeleeDamage(weapon)) return undefined
  return {
    kind: 'input-required', target: 'equipment', message: '現在のPowerでのコンボ全段の観測ダメージ合計が必要です。',
    fields: [weapon.weaponId === SHARPNESS_OBSERVED_MELEE_COMBO_ID
      ? '同じ個体・Powerで、固定の切れ味 I を含む通常コンボ1周のダメージ合計'
      : isPoisonCloudObservedMeleeComboId(weapon.weaponId)
        ? '同じ個体・Powerで、毒の追加ダメージを除いた単体への通常コンボ1周の直接ダメージ合計'
      : '同じ個体・Powerで、未強化の単体への通常コンボ1周のダメージ合計'],
  }
}

export function fixedRadianceInputIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (weapon.weaponId !== RADIANCE_OBSERVED_MELEE_COMBO_ID || observedFixedRadianceHeal(weapon) !== undefined) return undefined
  return { kind: 'input-required', target: 'equipment', message: '現在のPowerでの固定「輝き I」1回あたりの自己回復量が必要です。',
    fields: ['同じ個体・現在のPowerで、回復補正なし・十分にHPが減った状態で発動した「輝き I」1回の自己回復量'] }
}

export function observedMeleeComboRollIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return undefined
  const fixed = fixedObservedMeleeComboEnchantments(weapon.weaponId)[0]
  const isAllowed = (id: string) => id !== fixed?.enchantmentId && allowsObservedComboEnchant(weapon.weaponId, id)
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
  return fixedPoisonCloudPowerIssue(weapon) ?? observedMeleeComboInputIssue(weapon) ?? fixedRadianceInputIssue(weapon) ?? observedMeleeComboRollIssue(weapon)
}

export function fixedPoisonCloudPowerIssue(weapon: OwnedWeapon): ReadinessIssue | undefined {
  if (!isPoisonCloudObservedMeleeComboId(weapon.weaponId)) return undefined
  const { min, max } = dotPowerRange('poison-cloud')
  if (Number.isFinite(weapon.powerLevel) && weapon.powerLevel >= min && weapon.powerLevel <= max) return undefined
  return { kind: 'unsupported', target: 'equipment', message: `固定「毒の雲 I」はPower ${min}–${max}のみ対応（現在${weapon.powerLevel}）。範囲外は外挿しません。` }
}

export function observedMeleeComboUnsupportedReason(build: Build, scenario?: Scenario): string | undefined {
  if (!isObservedMeleeComboId(build.weapon.weaponId)) return undefined
  if (!hasObservedMeleeComboGrant(build.weapon.weaponId)) return 'UNSUPPORTED_COMBO_SOURCE: 対象のIdentity・ヒット列・固有効果のEvidenceが一致しません。'
  const powerIssue = fixedPoisonCloudPowerIssue(build.weapon)
  if (powerIssue) return `UNSUPPORTED_COMBO_POWER: ${powerIssue.message}`
  if (scenario && scenario.averageTargetsInReach !== 1) return 'UNSUPPORTED_COMBO_TARGETS: 射程内の敵を1に設定してください。'
  const armorSpeed = build.armor && ARMORS[build.armor.armorId as ArmorId]?.meleeAttackSpeedBonus
  if ((armorSpeed !== undefined && armorSpeed !== 0) || build.artifacts.some((item) => item.artifactId === 'death-cap-mushroom')) {
    return 'UNSUPPORTED_COMBO_INTERACTION: 速度効果なしの完全コンボのみ評価できます。'
  }
  const fixed = fixedObservedMeleeComboEnchantments(build.weapon.weaponId)[0]
  if (fixed && build.enchantments.some((item) => item.enchantmentId === fixed.enchantmentId && item.source !== 'built-in')) {
    return 'UNSUPPORTED_COMBO_INTERACTION: 固定Enchantと同じ効果をスロットまたは金色に重複できません。'
  }
  const effect = build.enchantments.find((entry) => !allowsObservedComboEnchant(build.weapon.weaponId, entry.enchantmentId)
    && !(entry.source === 'built-in' && entry.enchantmentId === fixed?.enchantmentId))
  if (effect) return `UNSUPPORTED_COMBO_INTERACTION: ${effect.enchantmentId}と不均一ヒット列の組み合わせは未対応です。`
  if (build.armorEnchantments?.some((entry) => entry.enchantmentId === 'cowardice')) {
    return 'UNSUPPORTED_COMBO_INTERACTION: Cowardiceの発動時間とヒット列の対応は未検証です。'
  }
  return undefined
}
