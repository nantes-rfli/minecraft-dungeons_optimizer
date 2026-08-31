import { evaluate } from './evaluate'
import { hasValidEnchantmentStacking } from './enchantment'
import { enchantmentUnsupportedReason, enchantmentCombinationUnsupportedReason } from './damageEvents'
import { OptimizerInputError } from './errors'
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

function buildsForWeapon(weapon: OwnedWeapon, artifacts: readonly OwnedArtifact[], unsupportedChoices: Set<string>): Build[] {
  const choices = weapon.enchantmentSlots.map((slot) => {
    const ids = slot.locked ? [slot.locked] : slot.candidates
    return ids.filter((id) => {
      const reason = enchantmentUnsupportedReason(weapon, id)
      if (!reason) return true
      if (slot.locked) throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', reason)
      unsupportedChoices.add(`${weapon.instanceId}: ${reason}`)
      return false
    })
  })
  if (weapon.gilded) {
    const reason = enchantmentUnsupportedReason(weapon, weapon.gilded.enchantmentId)
    if (reason) throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', reason)
  }
  if (choices.some((group) => group.length === 0)) {
    throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', `武器${weapon.instanceId}に評価可能な候補のないスロットがあります。${[...unsupportedChoices].join(' ')}`)
  }
  const enchantmentChoices = cartesianProduct<EnchantmentId>(choices)
  const artifactChoices = artifactLoadouts(artifacts)
  return enchantmentChoices.flatMap((selected) => {
    const enchantments = [
      ...selected.map((enchantmentId) => ({
        enchantmentId,
        tier: 3 as const,
        source: 'slot' as const,
      })),
      ...(weapon.gilded ? [{
        enchantmentId: weapon.gilded.enchantmentId,
        tier: weapon.gilded.tier,
        source: 'gilded' as const,
      }] : []),
    ]
    const unsupported = enchantmentCombinationUnsupportedReason(enchantments)
    if (unsupported) {
      unsupportedChoices.add(`${weapon.instanceId}: ${unsupported}`)
      return []
    }
    if (!hasValidEnchantmentStacking(enchantments)) return []
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

  const unsupportedChoices = new Set<string>()
  const builds = inventory.weapons.flatMap((weapon) => {
    const weaponBuilds = buildsForWeapon(weapon, inventory.artifacts, unsupportedChoices)
    if (weaponBuilds.length === 0) {
      throw new OptimizerInputError(
        'INVALID_WEAPON',
        `武器${weapon.instanceId}はEnchantのstacking制約を満たす組み合わせがありません（未対応combinationも除外）。${[...unsupportedChoices].join(' ')}`,
      )
    }
    return weaponBuilds
  })
  const evaluations = builds
    .map((build) => evaluate(build, scenario))
    .sort((left, right) => right.objectiveScore - left.objectiveScore)

  const best = evaluations[0]
  if (!best) {
    throw new Error('Optimizer invariant failed: inventory generated no candidate builds.')
  }

  return {
    unsupportedChoices: [...unsupportedChoices],
    best,
    alternatives: evaluations.slice(1, 5),
    paretoFrontier: calculateParetoFrontier(evaluations),
    evaluatedBuildCount: evaluations.length,
    searchMode: 'exhaustive',
  }
}
