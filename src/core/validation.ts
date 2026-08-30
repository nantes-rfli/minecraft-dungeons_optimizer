import { getEnchantmentDefinition } from './catalog'
import { hasValidEnchantmentStacking } from './enchantment'
import { OptimizerInputError } from './errors'
import type { Build, Inventory, Scenario } from './types'

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
  assertRange('encounterDurationSeconds', scenario.encounterDurationSeconds, Number.EPSILON)
  assertRange('averageEnemyHealth', scenario.averageEnemyHealth, Number.EPSILON)
  assertRange('enemySupplyPerSecond', scenario.enemySupplyPerSecond, 0)
  assertRange('directKillShare', scenario.directKillShare, 0, 1)
  assertRange('enemyComposition.enchantedShare', scenario.enemyComposition?.enchantedShare, 0, 1)
  assertRange('incomingDamagePerSecond', scenario.incomingDamagePerSecond, 0)
  assertRange('maxHealth', scenario.maxHealth, Number.EPSILON)
  assertRange('averageTargetsInReach', scenario.averageTargetsInReach, 1)
  assertRange('cooldownReduction', scenario.cooldownReduction, 0, 0.95)
  assertRange('radianceHealPerProc', scenario.radianceHealPerProc, 0)
  assertRange('weights.damage', scenario.weights.damage, 0)
  assertRange('weights.healing', scenario.weights.healing, 0)
  assertRange('weights.defense', scenario.weights.defense, 0)

  const weightTotal = scenario.weights.damage + scenario.weights.healing + scenario.weights.defense
  if (weightTotal <= 0) {
    throw new OptimizerInputError('INVALID_SCENARIO', 'シナリオの重みを1つ以上指定してください。')
  }
}

export function validateBuild(build: Build): void {
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
  for (const artifact of build.artifacts) {
    assertPowerLevel(
      `artifact ${artifact.instanceId} powerLevel`,
      artifact.powerLevel,
      'INVALID_ARTIFACT',
    )
  }
}

export function validateInventory(inventory: Inventory): void {
  if (inventory.weapons.length === 0) {
    throw new OptimizerInputError('EMPTY_INVENTORY', '比較する武器を1つ以上選択してください。')
  }
  const instanceIds = inventory.weapons.map((weapon) => weapon.instanceId)
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', '武器の管理IDが重複しています。')
  }
  for (const weapon of inventory.weapons) {
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
}
