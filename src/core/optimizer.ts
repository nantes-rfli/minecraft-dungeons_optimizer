import { evaluate } from './evaluate'
import type {
  ArtifactId,
  Build,
  EnchantmentId,
  Inventory,
  OptimizationResult,
  Scenario,
  WeaponInventoryItem,
} from './types'
import { validateInventory, validateScenario } from './validation'

function cartesianProduct<T>(groups: readonly (readonly T[])[]): T[][] {
  return groups.reduce<T[][]>(
    (products, group) => products.flatMap((product) => group.map((value) => [...product, value])),
    [[]],
  )
}

function combinations<T>(values: readonly T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (values.length < size) return []
  const [head, ...tail] = values
  if (head === undefined) return []
  return [
    ...combinations(tail, size - 1).map((combination) => [head, ...combination]),
    ...combinations(tail, size),
  ]
}

function artifactLoadouts(artifacts: readonly ArtifactId[]): ArtifactId[][] {
  return combinations(artifacts, Math.min(3, artifacts.length))
}

function buildsForWeapon(
  weapon: WeaponInventoryItem,
  artifacts: readonly ArtifactId[],
): Build[] {
  const enchantmentChoices = cartesianProduct<EnchantmentId>(weapon.enchantmentSlots)
  const artifactsChoices = artifactLoadouts(artifacts)
  return enchantmentChoices.flatMap((enchantments) =>
    artifactsChoices.map((artifactIds) => ({
      weapon,
      enchantments,
      artifacts: artifactIds,
    })),
  )
}

export function optimize(inventory: Inventory, scenario: Scenario): OptimizationResult {
  validateInventory(inventory)
  validateScenario(scenario)

  const evaluations = inventory.weapons
    .flatMap((weapon) => buildsForWeapon(weapon, inventory.artifacts))
    .map((build) => evaluate(build, scenario))
    .sort((left, right) => right.objectiveScore - left.objectiveScore)

  const best = evaluations[0]
  if (!best) {
    throw new Error('Optimizer invariant failed: inventory generated no candidate builds.')
  }

  return {
    best,
    alternatives: evaluations.slice(1, 5),
    evaluatedBuildCount: evaluations.length,
  }
}
