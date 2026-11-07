import { isObservedMeleeComboId } from '../data/observedMeleeCombo'
import { hasObservedMeleeDamage } from './observedMeleeCombo'
import { observedMeleeComboInputIssue, observedMeleeComboUnsupportedReason } from './observedMeleeComboReuse'
import { fixedMeleeEnchantments } from '../data/fixedMeleeEnchantments'
import { builtinProcMeleeUnsupportedReason } from './builtinProcMeleeReuse'
import { validatePowerCurveLevel } from './powerScaling'
import { GEAR_POWER_CURVE } from '../data/powerScaling'
import { validateControlAssumptions } from './control'
import { validateChargeInputs } from './chargeConsume'
import { getArmorDefinition, getEnchantmentDefinition, isRuntimeArmorEnchantmentId, isRuntimeArmorId } from './catalog'
import { hasValidEnchantmentStacking } from './enchantment'
import { enchantmentUnsupportedReason, enchantmentCombinationUnsupportedReason } from './damageEvents'
import { validatePersistentAreaTargeting } from './dotDamageEvents'
import { PROC_DAMAGE_IDS } from '../data/damageEvents'
import { OptimizerInputError } from './errors'
import { validateWeaponSoulLegality } from './soulLegality'
import type { ReadinessIssue } from './readiness'
import type { OwnedArmor } from './armor'
import type { Build, EnchantmentId, Inventory, OwnedWeapon, OwnedArtifact, Scenario } from './types'
import { armorCombinationUnsupportedReason } from './armor'
import { armorNumericEvidenceRows } from './armorEvidence'
import { evidencePolicy, isEvidenceStatusAllowed } from './evidenceStatus'
import { parseRangedWeapon, validateRangedBuild } from './ranged'
import { getEquipmentCatalogEntry } from '../data/equipmentCatalog'
import { plainMeleeUnsupportedReason } from './plainMeleeReuse'

function assertFinite(name: string, value: number, code = 'INVALID_SCENARIO'): void {
  if (!Number.isFinite(value)) {
    throw new OptimizerInputError(code, `${name}には有限の数値を指定してください。`)
  }
}

function assertRange(
  name: string,
  value: number,
  minimum: number,
  maximum = Infinity,
  code = 'INVALID_SCENARIO',
): void {
  assertFinite(name, value, code)
  if (value < minimum || value > maximum) {
    throw new OptimizerInputError(
      code,
      `${name}は${minimum}以上${maximum}以下で指定してください。`,
    )
  }
}

function assertPowerLevel(name: string, value: number, code: string): void {
  assertRange(name, value, 1, Infinity, code)
  if (!Number.isInteger(value)) {
    throw new OptimizerInputError(code, `${name}は1以上の整数で指定してください。`)
  }
}

/** Shared numeric/slot guards used by validation, optimizer preparation and readiness. */
export function validateWeaponNumbers(weapon: OwnedWeapon): void {
  assertPowerLevel(`weapon ${weapon.instanceId} powerLevel`, weapon.powerLevel, 'INVALID_WEAPON')
  if ((weapon.observedComboDamage !== undefined && !isObservedMeleeComboId(weapon.weaponId))
    || (weapon.observedDamagePerHit !== undefined && isObservedMeleeComboId(weapon.weaponId))) {
    throw new OptimizerInputError('INVALID_WEAPON', '武器IDと観測ダメージの入力形式が一致しません。')
  }
  if (weapon.observedComboDamage !== undefined) {
    assertPowerLevel(`weapon ${weapon.instanceId} observation powerLevel`, weapon.observedComboDamage.powerLevel, 'INVALID_WEAPON')
    assertRange(`weapon ${weapon.instanceId} observedComboDamage total`, weapon.observedComboDamage.total, Number.EPSILON, Infinity, 'INVALID_WEAPON')
  }
  if (weapon.observedDamagePerHit !== undefined) assertRange(`weapon ${weapon.instanceId} observedDamagePerHit`, weapon.observedDamagePerHit, Number.EPSILON, Infinity, 'INVALID_WEAPON')
}
export function validateArmorNumbers(armor: OwnedArmor): void {
  assertPowerLevel(`armor ${armor.instanceId} powerLevel`, armor.powerLevel, 'INVALID_ARMOR')
  if (armor.observedHealthBonus !== undefined) assertRange(`armor ${armor.instanceId} observedHealthBonus`, armor.observedHealthBonus, 0, Infinity, 'INVALID_ARMOR')
}
export function validateArtifactNumbers(artifact: OwnedArtifact): void {
  assertPowerLevel(`artifact ${artifact.instanceId} powerLevel`, artifact.powerLevel, 'INVALID_ARTIFACT')
}
export function enchantmentInputIssue(instanceId: string, slots: readonly { readonly candidates: readonly unknown[] }[]): ReadinessIssue | undefined {
  if (slots.length < 1 || slots.length > 3) return { kind: 'input-required', target: 'equipment', message: `${instanceId}: エンチャントスロットは1〜3個にしてください。`, fields: ['エンチャントスロットを1〜3個登録（各スロットに候補を1個以上）'] }
  const empty = slots.findIndex((slot) => slot.candidates.length === 0)
  if (empty >= 0) return { kind: 'input-required', target: 'equipment', message: `${instanceId}: スロット${empty + 1}に候補がありません。`, fields: [`スロット${empty + 1}のエンチャント候補`] }
  return undefined
}
export function inventoryItemInputIssues(inventory: Inventory): ReadonlyMap<string, readonly ReadinessIssue[]> {
  const issues = new Map<string, ReadinessIssue[]>()
  const capture = (instanceId: string, check: () => void) => {
    try { check() }
    catch (error) { issues.set(instanceId, [{ kind: 'input-required', target: 'equipment', message: error instanceof Error ? error.message : '入力値が不正です。', fields: ['上記の入力値を指定の有限数値・範囲へ修正'] }]) }
  }
  for (const weapon of inventory.weapons) {
    capture(weapon.instanceId, () => validateWeaponNumbers(weapon))
    const comboIssue = observedMeleeComboInputIssue(weapon)
    if (!issues.has(weapon.instanceId) && comboIssue) issues.set(weapon.instanceId, [comboIssue])
    if (!issues.has(weapon.instanceId) && !hasObservedMeleeDamage(weapon)) {
      try { validatePowerCurveLevel(weapon.powerLevel, GEAR_POWER_CURVE.value) }
      catch (error) {
        if (!(error instanceof OptimizerInputError) || error.code !== 'UNSUPPORTED_POWER_LEVEL') throw error
        issues.set(weapon.instanceId, [{ kind: 'input-required', target: 'equipment', message: error.message, fields: ['この個体の表示ダメージ（正の有限値）。Powerは実装備の値を保持'] }])
      }
    }
  }
  for (const armor of inventory.armors ?? []) capture(armor.instanceId, () => validateArmorNumbers(armor))
  for (const artifact of inventory.artifacts) capture(artifact.instanceId, () => validateArtifactNumbers(artifact))
  for (const weapon of inventory.rangedWeapons ?? []) capture(weapon.instanceId, () => { parseRangedWeapon(weapon) })
  for (const item of [...inventory.weapons, ...(inventory.armors ?? [])]) {
    const issue = enchantmentInputIssue(item.instanceId, item.enchantmentSlots)
    if (issue) issues.set(item.instanceId, [...(issues.get(item.instanceId) ?? []), issue])
  }
  return issues
}

export function validateScenario(scenario: Scenario): void {
  if (scenario.includeUnequippedArtifacts !== undefined && typeof scenario.includeUnequippedArtifacts !== 'boolean') {
    throw new OptimizerInputError('INVALID_SCENARIO', 'includeUnequippedArtifactsはbooleanにしてください。')
  }
  if (scenario.evidencePolicy !== undefined && !['high-confidence-only', 'include-estimated'].includes(scenario.evidencePolicy)) {
    throw new OptimizerInputError('INVALID_SCENARIO', 'evidencePolicyが不正です。')
  }
  if (scenario.rangedTimeShare !== undefined) assertRange('rangedTimeShare', scenario.rangedTimeShare, 0, 1)
  validateChargeInputs(scenario)
  validatePersistentAreaTargeting(scenario)
  validateControlAssumptions(scenario)
  assertRange('encounterDurationSeconds', scenario.encounterDurationSeconds, Number.EPSILON)
  assertRange('initialSoulUnits', scenario.initialSoulUnits ?? 0, 0, 300)
  if (scenario.cowardiceFullHealthShare !== undefined) assertRange('cowardiceFullHealthShare', scenario.cowardiceFullHealthShare, 0, 1)
  assertRange('averageEnemyHealth', scenario.averageEnemyHealth, Number.EPSILON)
  assertRange('enemySupplyPerSecond', scenario.enemySupplyPerSecond, 0)
  assertRange('directKillShare', scenario.directKillShare, 0, 1)
  assertRange('enemyComposition.enchantedShare', scenario.enemyComposition?.enchantedShare, 0, 1)
  assertRange('enemyComposition.undeadShare', scenario.enemyComposition?.undeadShare, 0, 1)
  assertRange('enemyState.ambushEligibleDirectDamageShare', scenario.enemyState?.ambushEligibleDirectDamageShare, 0, 1)
  assertRange('enemyDebuffs.weakeningAffectedIncomingDamageShare', scenario.enemyDebuffs?.weakeningAffectedIncomingDamageShare, 0, 1)
  assertRange('incomingDamagePerSecond', scenario.incomingDamagePerSecond, 0)
  assertRange('maxHealth', scenario.maxHealth, Number.EPSILON)
  assertRange('averageTargetsInReach', scenario.averageTargetsInReach, 1)
  for (const id of PROC_DAMAGE_IDS) {
    assertRange(`damageEventTargeting.${id}`, scenario.damageEventTargeting?.[id], 1, scenario.averageTargetsInReach)
  }
  assertRange('cooldownReduction', scenario.cooldownReduction, 0, 0.95)
  assertRange('radianceHealPerProc', scenario.radianceHealPerProc, 0)
  assertRange('weights.damage', scenario.weights.damage, 0)
  assertRange('weights.healing', scenario.weights.healing, 0)
  assertRange('weights.defense', scenario.weights.defense, 0)
  assertRange('weights.control', scenario.weights.control, 0)

  const weightTotal = scenario.weights.damage + scenario.weights.healing + scenario.weights.defense + scenario.weights.control
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    throw new OptimizerInputError('INVALID_SCENARIO', 'シナリオの重みを1つ以上指定してください。')
  }
}

export function validateBuild(build: Build, scenario?: Scenario): void {
  validateRangedBuild(build, scenario)
  const comboSourceIssue = observedMeleeComboUnsupportedReason(build, scenario)
  if (comboSourceIssue) throw new OptimizerInputError('UNSUPPORTED_OBSERVED_MELEE_COMBO', comboSourceIssue)
  const comboInputIssue = observedMeleeComboInputIssue(build.weapon)
  if (comboInputIssue) throw new OptimizerInputError('MISSING_OBSERVED_COMBO_DAMAGE', comboInputIssue.message)
  const plainMeleeIssue = plainMeleeUnsupportedReason(build, scenario) ?? builtinProcMeleeUnsupportedReason(build, scenario)
  if (plainMeleeIssue) throw new OptimizerInputError('UNSUPPORTED_PLAIN_MELEE', plainMeleeIssue)
  const unsupported = enchantmentCombinationUnsupportedReason(build.enchantments)
  if (unsupported) throw new OptimizerInputError('UNSUPPORTED_ENCHANTMENT_COMBINATION', unsupported)
  validateWeaponSoulLegality(build.weapon)
  for (const selected of build.enchantments) {
    const reason = enchantmentUnsupportedReason(build.weapon, selected.enchantmentId)
    if (reason) throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', reason)
  }
  const { enchantmentSlots } = build.weapon
  const slotIssue = enchantmentInputIssue(build.weapon.instanceId, enchantmentSlots)
  if (slotIssue) throw new OptimizerInputError('INVALID_WEAPON', slotIssue.message)
  const fixed = fixedMeleeEnchantments(build.weapon.weaponId)
  const expectedEnchantmentCount = enchantmentSlots.length + (build.weapon.gilded ? 1 : 0) + fixed.length
  if (build.enchantments.length !== expectedEnchantmentCount) {
    throw new OptimizerInputError(
      'INVALID_BUILD',
      `武器${build.weapon.instanceId}では各スロットから1つずつ選択してください。`,
    )
  }
  enchantmentSlots.forEach((options, index) => {
    if (options.candidates.length === 0) {
      throw new OptimizerInputError(
        'INVALID_WEAPON',
        `武器${build.weapon.instanceId}のスロット${index + 1}に候補がありません。`,
      )
    }
    const selected = build.enchantments[index]
    const legacyLocked = (options as { locked?: EnchantmentId }).locked
    const recorded = options.selected ?? (legacyLocked ? { enchantmentId: legacyLocked, tier: 3 as const } : undefined)
    const legalOptions = recorded ? [recorded.enchantmentId] : options.candidates
    if (
      !selected ||
      selected.source !== 'slot' ||
      selected.tier !== (recorded?.tier ?? 3) ||
      !legalOptions.includes(selected.enchantmentId)
    ) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `武器${build.weapon.instanceId}のスロット${index + 1}にないエンチャントが選択されています。`,
      )
    }
  })
  if (build.weapon.gilded) {
    const gildedSelection = build.enchantments[enchantmentSlots.length]
    if (
      gildedSelection?.source !== 'gilded' ||
      gildedSelection.enchantmentId !== build.weapon.gilded.enchantmentId ||
      gildedSelection.tier !== build.weapon.gilded.tier
    ) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `武器${build.weapon.instanceId}の金色エンチャントが一致しません。`,
      )
    }
  }
  for (const [index, required] of fixed.entries()) {
    const actual = build.enchantments[enchantmentSlots.length + (build.weapon.gilded ? 1 : 0) + index]
    if (!actual || actual.enchantmentId !== required.enchantmentId || actual.tier !== required.tier || actual.source !== 'built-in') throw new OptimizerInputError('INVALID_BUILD', '装備の固定Built-inが欠落しているか一致しません。')
  }
  if (!hasValidEnchantmentStacking(build.enchantments)) {
    const counts = new Map<string, number>()
    for (const selected of build.enchantments) {
      const count = (counts.get(selected.enchantmentId) ?? 0) + 1
      const maximum = getEnchantmentDefinition(selected.enchantmentId).stacking.value.maxCopies
      if (count > maximum) {
        throw new OptimizerInputError(
          'INVALID_BUILD',
          `${getEnchantmentDefinition(selected.enchantmentId).name.ja}は最大${maximum}個までです。`,
        )
      }
      counts.set(selected.enchantmentId, count)
    }
  }
  validateWeaponNumbers(build.weapon)
  if (build.artifacts.length > 3) {
    throw new OptimizerInputError('INVALID_BUILD', 'アーティファクトは最大3個まで装備できます。')
  }
  if (build.armor) {
    if (!isRuntimeArmorId(build.armor.armorId)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_ID', `未対応のArmorです: ${build.armor.armorId}`)
    if (build.armor.observedHealthBonus === undefined) throw new OptimizerInputError('MISSING_OBSERVED_ARMOR_HEALTH', 'runtime Armorにはカード表示の+Healthが必要です。')
    validateArmorNumbers(build.armor)
    const slotIssue = enchantmentInputIssue(build.armor.instanceId, build.armor.enchantmentSlots)
    if (slotIssue) throw new OptimizerInputError('INVALID_ARMOR', slotIssue.message)
    const definition = getArmorDefinition(build.armor.armorId)
    // Fail closed even for direct evaluate(): runtime registration is not Evidence adoption.
    const armorEvidencePolicy = scenario === undefined ? 'include-estimated' : evidencePolicy(scenario)
    const unclassifiedArmor = armorNumericEvidenceRows(definition).filter(
      ({ binding }) => !binding || !isEvidenceStatusAllowed(binding.status, armorEvidencePolicy),
    )
    if (unclassifiedArmor.length) throw new OptimizerInputError(
      'UNSUPPORTED_ARMOR_EVIDENCE',
      `Armor parameter Evidence未採用: ${unclassifiedArmor.map((item) => item.parameterId).join(', ')}`,
    )
    const selected = build.armorEnchantments ?? []
    const expected = build.armor.enchantmentSlots.length + (build.armor.gilded ? 1 : 0) + definition.builtInEnchantments.length
    if (selected.length !== expected) throw new OptimizerInputError('INVALID_BUILD', 'Armorの各スロット・金色・固有Enchantをすべて選択してください。')
    build.armor.enchantmentSlots.forEach((slot, index) => {
      if (slot.candidates.length === 0) throw new OptimizerInputError('INVALID_ARMOR', `Armorスロット${index + 1}に候補がありません。`)
      const choice = selected[index]
      const legacyCandidates = slot.candidates.map((candidate) => typeof candidate === 'string' ? { enchantmentId: candidate, tier: 3 as const } : candidate as { enchantmentId: string; tier: 1 | 2 | 3 })
      const legacyLocked = (slot as { locked?: string }).locked
      const recorded = slot.selected ?? (legacyLocked ? legacyCandidates.find((candidate) => candidate.enchantmentId === legacyLocked) : undefined)
      const legalId = recorded?.enchantmentId ?? choice?.enchantmentId
      const legalTier = recorded?.tier ?? legacyCandidates.find((candidate) => candidate.enchantmentId === choice?.enchantmentId)?.tier ?? 3
      if (!choice || choice.source !== 'slot' || !legacyCandidates.some((candidate) => candidate.enchantmentId === choice.enchantmentId) || choice.enchantmentId !== legalId || choice.tier !== legalTier || !isRuntimeArmorEnchantmentId(choice.enchantmentId)) throw new OptimizerInputError('INVALID_BUILD', `Armorスロット${index + 1}にないEnchant/Tierが選択されています。`)
    })
    if (build.armor.gilded) {
      const choice = selected[build.armor.enchantmentSlots.length]
      if (!choice || choice.source !== 'gilded' || choice.enchantmentId !== build.armor.gilded.enchantmentId || choice.tier !== build.armor.gilded.tier || !isRuntimeArmorEnchantmentId(choice.enchantmentId)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_GILDED_ENCHANTMENT', 'Armorの金色Enchantが一致しないかruntime未対応です。')
    }
    const builtInOffset = build.armor.enchantmentSlots.length + (build.armor.gilded ? 1 : 0)
    definition.builtInEnchantments.forEach((builtIn, index) => {
      const choice = selected[builtInOffset + index]
      if (builtIn.tier === undefined || !isRuntimeArmorEnchantmentId(builtIn.enchantmentId)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_BUILT_IN_ENCHANTMENT', `runtime未対応のArmor固有Enchantです: ${builtIn.enchantmentId}`)
      if (!choice || choice.source !== 'built-in' || choice.enchantmentId !== builtIn.enchantmentId || choice.tier !== builtIn.tier) throw new OptimizerInputError('INVALID_BUILD', `Armor固有Enchant ${builtIn.enchantmentId} が固定値と一致しません。`)
    })
    if (scenario) {
      const reason = armorCombinationUnsupportedReason(build, scenario)
      if (reason) throw new OptimizerInputError(reason.split(':')[0]!, reason)
    }
  } else if ((build.armorEnchantments?.length ?? 0) > 0) {
    throw new OptimizerInputError('INVALID_BUILD', 'ArmorなしBuildにArmor Enchantmentは指定できません。')
  }
  for (const artifact of build.artifacts) validateArtifactNumbers(artifact)
}

/** IDs that need observed damage to keep the inventory on one comparable scale. */
export function missingObservedDamageInstanceIds(weapons: readonly OwnedWeapon[]): readonly string[] {
  if (!weapons.some(hasObservedMeleeDamage)) return []
  return [...new Set(weapons.filter((weapon) => !hasObservedMeleeDamage(weapon)).map((weapon) => weapon.instanceId))]
}

export function missingLegacyObservedDamageInstanceIds(inventory: Inventory): readonly string[] {
  return missingObservedDamageInstanceIds(inventory.weapons.filter((weapon) => !isObservedMeleeComboId(weapon.weaponId)))
}

export function validateInventory(inventory: Inventory): void {
  for (const weapon of inventory.rangedWeapons ?? []) parseRangedWeapon(weapon)
  if (inventory.weapons.length === 0) {
    throw new OptimizerInputError('EMPTY_INVENTORY', '比較する武器を1つ以上選択してください。')
  }
  const instanceIds = inventory.weapons.map((weapon) => weapon.instanceId)
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', '武器の管理IDが重複しています。')
  }
  for (const weapon of inventory.weapons) {
    validateWeaponSoulLegality(weapon)
    validateWeaponNumbers(weapon)
  }
  if (missingLegacyObservedDamageInstanceIds(inventory).length > 0) {
    throw new OptimizerInputError(
      'MIXED_DAMAGE_SCALE',
      '表示ダメージを使う場合は、比較するすべての武器に入力してください。',
    )
  }
  const artifactInstanceIds = inventory.artifacts.map((artifact) => artifact.instanceId)
  if (new Set(artifactInstanceIds).size !== artifactInstanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'アーティファクトの管理IDが重複しています。')
  }
  for (const artifact of inventory.artifacts) validateArtifactNumbers(artifact)
  const armorInstanceIds = (inventory.armors ?? []).map((armor) => armor.instanceId)
  if (new Set(armorInstanceIds).size !== armorInstanceIds.length) throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'Armorの管理IDが重複しています。')
  for (const armor of inventory.armors ?? []) {
    validateArmorNumbers(armor)
    if (armor.enchantmentSlots.length < 1 || armor.enchantmentSlots.length > 3) throw new OptimizerInputError('INVALID_ARMOR', `Armor ${armor.instanceId}のEnchantスロットは1〜3個にしてください。`)
  }
  for (const item of inventory.catalogItems ?? []) {
    assertPowerLevel(`catalog item ${item.instanceId} powerLevel`, item.powerLevel, 'INVALID_CATALOG_ITEM')
    const catalog = getEquipmentCatalogEntry(item.category, item.catalogId)
    if (!catalog) throw new OptimizerInputError('INVALID_CATALOG_ITEM', `監査済みCatalogにない装備です: ${item.category}/${item.catalogId}`)
    if (catalog.runtimeSupport !== 'unsupported') throw new OptimizerInputError('INVALID_CATALOG_ITEM', `${item.catalogId}は通常の${item.category} Inventoryへ登録してください。`)
  }
  const allInstanceIds = [...inventory.weapons, ...(inventory.armors ?? []), ...(inventory.rangedWeapons ?? []), ...inventory.artifacts, ...(inventory.catalogItems ?? [])].map((item) => item.instanceId)
  if (new Set(allInstanceIds).size !== allInstanceIds.length) throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', '装備種別をまたいで管理IDが重複しています。')
}
