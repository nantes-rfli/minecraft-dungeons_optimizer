import { validateControlAssumptions } from './control'
import { validateChargeInputs } from './chargeConsume'
import { getArmorDefinition, getEnchantmentDefinition, isRuntimeArmorEnchantmentId, isRuntimeArmorId } from './catalog'
import { hasValidEnchantmentStacking } from './enchantment'
import { enchantmentUnsupportedReason, enchantmentCombinationUnsupportedReason } from './damageEvents'
import { validatePersistentAreaTargeting } from './dotDamageEvents'
import { PROC_DAMAGE_IDS } from '../data/damageEvents'
import { OptimizerInputError } from './errors'
import { validateWeaponSoulLegality } from './soulLegality'
import type { Build, Inventory, Scenario } from './types'
import { armorCombinationUnsupportedReason } from './armor'
import { parseRangedWeapon, validateRangedBuild } from './ranged'
import { getEquipmentCatalogEntry } from '../data/equipmentCatalog'

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

export function validateScenario(scenario: Scenario): void {
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
  const unsupported = enchantmentCombinationUnsupportedReason(build.enchantments)
  if (unsupported) throw new OptimizerInputError('UNSUPPORTED_ENCHANTMENT_COMBINATION', unsupported)
  validateWeaponSoulLegality(build.weapon)
  for (const selected of build.enchantments) {
    const reason = enchantmentUnsupportedReason(build.weapon, selected.enchantmentId)
    if (reason) throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', reason)
  }
  const { enchantmentSlots } = build.weapon
  if (enchantmentSlots.length === 0 || enchantmentSlots.length > 3) {
    throw new OptimizerInputError(
      'INVALID_WEAPON',
      `武器${build.weapon.instanceId}のエンチャントスロットは1〜3個にしてください。`,
    )
  }
  const expectedEnchantmentCount = enchantmentSlots.length + (build.weapon.gilded ? 1 : 0)
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
    const legalOptions = options.locked ? [options.locked] : options.candidates
    if (
      !selected ||
      selected.source !== 'slot' ||
      selected.tier !== 3 ||
      !legalOptions.includes(selected.enchantmentId)
    ) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `武器${build.weapon.instanceId}のスロット${index + 1}にないエンチャントが選択されています。`,
      )
    }
  })
  if (build.weapon.gilded) {
    const gildedSelection = build.enchantments.at(-1)
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
  assertPowerLevel(
    `weapon ${build.weapon.instanceId} powerLevel`,
    build.weapon.powerLevel,
    'INVALID_WEAPON',
  )
  if (build.weapon.observedDamagePerHit !== undefined) {
    assertRange(
      `weapon ${build.weapon.instanceId} observedDamagePerHit`,
      build.weapon.observedDamagePerHit,
      Number.EPSILON,
      Infinity,
      'INVALID_WEAPON',
    )
  }
  if (build.artifacts.length > 3) {
    throw new OptimizerInputError('INVALID_BUILD', 'アーティファクトは最大3個まで装備できます。')
  }
  if (build.armor) {
    if (!isRuntimeArmorId(build.armor.armorId)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_ID', `未対応のArmorです: ${build.armor.armorId}`)
    if (build.armor.observedHealthBonus === undefined) throw new OptimizerInputError('MISSING_OBSERVED_ARMOR_HEALTH', 'runtime Armorにはカード表示の+Healthが必要です。')
    assertRange(`armor ${build.armor.instanceId} observedHealthBonus`, build.armor.observedHealthBonus, 0, Infinity, 'INVALID_ARMOR')
    assertPowerLevel(`armor ${build.armor.instanceId} powerLevel`, build.armor.powerLevel, 'INVALID_ARMOR')
    if (build.armor.enchantmentSlots.length < 1 || build.armor.enchantmentSlots.length > 3) throw new OptimizerInputError('INVALID_ARMOR', 'Armor Enchantmentスロットは1〜3個にしてください。')
    const definition = getArmorDefinition(build.armor.armorId)
    const selected = build.armorEnchantments ?? []
    const expected = build.armor.enchantmentSlots.length + (build.armor.gilded ? 1 : 0) + definition.builtInEnchantments.length
    if (selected.length !== expected) throw new OptimizerInputError('INVALID_BUILD', 'Armorの各スロット・金色・固有Enchantをすべて選択してください。')
    build.armor.enchantmentSlots.forEach((slot, index) => {
      if (slot.candidates.length === 0) throw new OptimizerInputError('INVALID_ARMOR', `Armorスロット${index + 1}に候補がありません。`)
      const choice = selected[index]
      const roll = choice && slot.candidates.find((candidate) => candidate.enchantmentId === choice.enchantmentId && candidate.tier === choice.tier)
      const legalId = slot.locked ?? choice?.enchantmentId
      if (!choice || choice.source !== 'slot' || !roll || choice.enchantmentId !== legalId || !isRuntimeArmorEnchantmentId(choice.enchantmentId)) throw new OptimizerInputError('INVALID_BUILD', `Armorスロット${index + 1}にないEnchant/Tierが選択されています。`)
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
  for (const artifact of build.artifacts) {
    assertPowerLevel(
      `artifact ${artifact.instanceId} powerLevel`,
      artifact.powerLevel,
      'INVALID_ARTIFACT',
    )
  }
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
    assertPowerLevel(
      `weapon ${weapon.instanceId} powerLevel`,
      weapon.powerLevel,
      'INVALID_WEAPON',
    )
    if (weapon.observedDamagePerHit !== undefined) {
      assertRange(
        `weapon ${weapon.instanceId} observedDamagePerHit`,
        weapon.observedDamagePerHit,
        Number.EPSILON,
        Infinity,
        'INVALID_WEAPON',
      )
    }
  }
  const observedDamageCount = inventory.weapons.filter(
    (weapon) => weapon.observedDamagePerHit !== undefined,
  ).length
  if (observedDamageCount > 0 && observedDamageCount < inventory.weapons.length) {
    throw new OptimizerInputError(
      'MIXED_DAMAGE_SCALE',
      '表示ダメージを使う場合は、比較するすべての武器に入力してください。',
    )
  }
  const artifactInstanceIds = inventory.artifacts.map((artifact) => artifact.instanceId)
  if (new Set(artifactInstanceIds).size !== artifactInstanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'アーティファクトの管理IDが重複しています。')
  }
  for (const artifact of inventory.artifacts) {
    assertPowerLevel(
      `artifact ${artifact.instanceId} powerLevel`,
      artifact.powerLevel,
      'INVALID_ARTIFACT',
    )
  }
  const armorInstanceIds = (inventory.armors ?? []).map((armor) => armor.instanceId)
  if (new Set(armorInstanceIds).size !== armorInstanceIds.length) throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'Armorの管理IDが重複しています。')
  for (const armor of inventory.armors ?? []) {
    assertPowerLevel(`armor ${armor.instanceId} powerLevel`, armor.powerLevel, 'INVALID_ARMOR')
    if (armor.observedHealthBonus !== undefined) assertRange(`armor ${armor.instanceId} observedHealthBonus`, armor.observedHealthBonus, 0, Infinity, 'INVALID_ARMOR')
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
