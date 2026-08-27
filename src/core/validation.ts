import { OptimizerInputError } from './errors'
import type { Build, Inventory, Scenario } from './types'

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new OptimizerInputError('INVALID_SCENARIO', `${name} must be a finite number.`)
  }
}

function assertRange(name: string, value: number, minimum: number, maximum = Infinity): void {
  assertFinite(name, value)
  if (value < minimum || value > maximum) {
    throw new OptimizerInputError(
      'INVALID_SCENARIO',
      `${name} must be between ${minimum} and ${maximum}.`,
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
  assertRange('artifactPower', scenario.artifactPower, 1)
  assertRange('cooldownReduction', scenario.cooldownReduction, 0, 0.95)
  assertRange('radianceHealPerProc', scenario.radianceHealPerProc, 0)
  assertRange('voidRampSeconds', scenario.voidRampSeconds, Number.EPSILON)
  assertRange('weights.damage', scenario.weights.damage, 0)
  assertRange('weights.healing', scenario.weights.healing, 0)
  assertRange('weights.defense', scenario.weights.defense, 0)

  const weightTotal = scenario.weights.damage + scenario.weights.healing + scenario.weights.defense
  if (weightTotal <= 0) {
    throw new OptimizerInputError('INVALID_SCENARIO', 'At least one scenario weight must be positive.')
  }
}

export function validateBuild(build: Build): void {
  const { enchantmentSlots } = build.weapon
  if (enchantmentSlots.length === 0 || enchantmentSlots.length > 3) {
    throw new OptimizerInputError(
      'INVALID_WEAPON',
      `Weapon ${build.weapon.instanceId} must have between one and three enchantment slots.`,
    )
  }
  if (build.enchantments.length !== enchantmentSlots.length) {
    throw new OptimizerInputError(
      'INVALID_BUILD',
      `Weapon ${build.weapon.instanceId} needs exactly one enchantment per slot.`,
    )
  }
  enchantmentSlots.forEach((options, index) => {
    if (options.length === 0) {
      throw new OptimizerInputError(
        'INVALID_WEAPON',
        `Enchantment slot ${index + 1} on ${build.weapon.instanceId} has no options.`,
      )
    }
    const selected = build.enchantments[index]
    if (!selected || !options.includes(selected)) {
      throw new OptimizerInputError(
        'INVALID_BUILD',
        `Selected enchantment for slot ${index + 1} is not offered by ${build.weapon.instanceId}.`,
      )
    }
  })
  if (build.artifacts.length > 3) {
    throw new OptimizerInputError('INVALID_BUILD', 'A build can equip at most three artifacts.')
  }
  if (new Set(build.artifacts).size !== build.artifacts.length) {
    throw new OptimizerInputError(
      'INVALID_BUILD',
      'Duplicate artifacts are outside the v0.1 calculation model.',
    )
  }
}

export function validateInventory(inventory: Inventory): void {
  if (inventory.weapons.length === 0) {
    throw new OptimizerInputError('EMPTY_INVENTORY', 'Inventory must contain at least one weapon.')
  }
  const instanceIds = inventory.weapons.map((weapon) => weapon.instanceId)
  if (new Set(instanceIds).size !== instanceIds.length) {
    throw new OptimizerInputError('DUPLICATE_INSTANCE_ID', 'Weapon instance IDs must be unique.')
  }
  if (new Set(inventory.artifacts).size !== inventory.artifacts.length) {
    throw new OptimizerInputError(
      'DUPLICATE_ARTIFACT',
      'Duplicate artifacts are outside the v0.1 calculation model.',
    )
  }
}
