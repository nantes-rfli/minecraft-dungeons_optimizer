import { evaluate } from './evaluate'
import type {
  Build,
  EnchantmentId,
  Evaluation,
  Inventory,
  OptimizationResult,
  OwnedArtifact,
  OwnedWeapon,
  Scenario,
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

function artifactLoadouts(artifacts: readonly OwnedArtifact[]): OwnedArtifact[][] {
  return combinations(artifacts, Math.min(3, artifacts.length))
}

function buildsForWeapon(weapon: OwnedWeapon, artifacts: readonly OwnedArtifact[]): Build[] {
  const choices = weapon.enchantmentSlots.map((slot) =>
    slot.locked ? [slot.locked] : slot.candidates,
  )
  const enchantmentChoices = cartesianProduct<EnchantmentId>(choices)
  const artifactChoices = artifactLoadouts(artifacts)
  return enchantmentChoices.flatMap((selected) => {
    const enchantments = weapon.gilded
      ? [...selected, weapon.gilded.enchantmentId]
      : selected
    return artifactChoices.map((artifactItems) => ({
      weapon,
      enchantments,
      artifacts: artifactItems,
    }))
  })
}

export function dominates(left: Evaluation, right: Evaluation): boolean {
  const atLeastAsGood =
    left.damage.aoeDps >= right.damage.aoeDps &&
    left.healing.totalPerSecond >= right.healing.totalPerSecond &&
    left.defense.effectiveHealth >= right.defense.effectiveHealth
  const strictlyBetter =
    left.damage.aoeDps > right.damage.aoeDps ||
    left.healing.totalPerSecond > right.healing.totalPerSecond ||
    left.defense.effectiveHealth > right.defense.effectiveHealth
  return atLeastAsGood && strictlyBetter
}

export function calculateParetoFrontier(evaluations: readonly Evaluation[]): Evaluation[] {
  return evaluations
    .filter((candidate, candidateIndex) =>
      !evaluations.some(
        (other, otherIndex) => otherIndex !== candidateIndex && dominates(other, candidate),
      ),
    )
    .sort((left, right) => right.objectiveScore - left.objectiveScore)
    .slice(0, 10)
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
    paretoFrontier: calculateParetoFrontier(evaluations),
    evaluatedBuildCount: evaluations.length,
    searchMode: 'exhaustive',
  }
}
