import { OptimizerInputError } from './errors'
import type { Build, Inventory, Scenario } from './types'

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new OptimizerInputError('INVALID_SCENARIO', `${name}には有限の数値を指定してください。`)
  }
}

function assertRange(name: string, value: number, minimum: number, maximum = Infinity): void {
  assertFinite(name, value)
  if (value < minimum || value > maximum) {
    throw new OptimizerInputError(
      'INVALID_SCENARIO',
      `${name}は${minimum}以上${maximum}以下で指定してください。`,
    )
  }
}

export function validateScenario(scenario: Scenario): void {
  assertRange('encounterDurationSeconds', scenario.encounterDurationSeconds, Number.EPSILON)
  assertRange('averageEnemyHealth', scenario.averageEnemyHealth, Number.EPSILON)
  assertRange('killsPerSecond', scenario.killsPerSecond, 0)
  assertRange('directKillShare', scenario.directKillShare, 0, 1)
  assertRange('incomingDamagePerSecond', scenario.incomingDamagePerSecond, 0)
  assertRange('maxHealth', scenario.maxHealth, Number.EPSILON)
  assertRange('averageTargetsInReach', scenario.averageTargetsInReach, 1)
  assertRange('cooldownReduction', scenario.cooldownReduction, 0, 0.95)
  assertRange('radianceHealPerProc', scenario.radianceHealPerProc, 0)
  assertRange('voidRampSeconds', scenario.voidRampSeconds, Number.EPSILON)
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
    if (!selected || !legalOptions.includes(selected)) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `武器${build.weapon.instanceId}のスロット${index + 1}にないエンチャントが選択されています。`,
      )
    }
  })
  if (build.weapon.gilded) {
    const gildedSelection = build.enchantments.at(-1)
    if (gildedSelection !== build.weapon.gilded.enchantmentId) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `武器${build.weapon.instanceId}の金色エンチャントが一致しません。`,
      )
    }
  }
  if (build.artifacts.length > 3) {
    throw new OptimizerInputError('INVALID_BUILD', 'アーティファクトは最大3個まで装備できます。')
  }
  for (const artifact of build.artifacts) {
    assertRange(`artifact ${artifact.instanceId} powerLevel`, artifact.powerLevel, 1)
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
    assertRange(`weapon ${weapon.instanceId} powerLevel`, weapon.powerLevel, 1)
  }
  const artifactInstanceIds = inventory.artifacts.map((artifact) => artifact.instanceId)
  if (new Set(artifactInstanceIds).size !== artifactInstanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'アーティファクトの管理IDが重複しています。')
  }
}
