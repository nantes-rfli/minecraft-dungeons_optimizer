import { assertSearchBudget } from './searchBudget'
import { evaluate, evaluateCandidate } from './evaluate'
import { hasValidEnchantmentStacking } from './enchantment'
import { enchantmentUnsupportedReason, enchantmentCombinationUnsupportedReason } from './damageEvents'
import { OptimizerInputError } from './errors'
import { armorCombinationUnsupportedReason } from './armor'
import { getArmorDefinition, isRuntimeArmorEnchantmentId, isRuntimeArmorId } from './catalog'
import type { SelectedArmorEnchantment } from './armor'
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
import { rangedCombinationUnsupportedReason, rangedOptions, rangedWeaponUnsupportedReason } from './ranged'
import { artifactEvidenceAllowed, blockedParameterEvidenceForBuild, evidencePolicy } from './evidenceStatus'

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

interface ArmorOption {
  readonly armor: NonNullable<Inventory['armors']>[number]
  readonly armorEnchantments: readonly SelectedArmorEnchantment[]
}

function optionsForArmor(armor: ArmorOption['armor'], unsupportedChoices: Set<string>): ArmorOption[] {
  if (!isRuntimeArmorId(armor.armorId)) {
    unsupportedChoices.add(`${armor.instanceId}: UNSUPPORTED_ARMOR_ID: ${armor.armorId}`)
    return []
  }
  if (armor.observedHealthBonus === undefined) {
    unsupportedChoices.add(`${armor.instanceId}: MISSING_OBSERVED_ARMOR_HEALTH`)
    return []
  }
  const groups = armor.enchantmentSlots.map((slot, index) => {
    if (slot.locked && !isRuntimeArmorEnchantmentId(slot.locked)) {
      unsupportedChoices.add(`${armor.instanceId}: UNSUPPORTED_ARMOR_ENCHANTMENT: locked slot ${index + 1} contains ${slot.locked}`)
      return []
    }
    if (!slot.locked) {
      const unsupported = slot.candidates.find((roll) => !isRuntimeArmorEnchantmentId(roll.enchantmentId))
      if (unsupported) {
        unsupportedChoices.add(`${armor.instanceId}: UNSUPPORTED_ARMOR_ENCHANT_ALTERNATIVE: slot ${index + 1} contains ${unsupported.enchantmentId}`)
        return []
      }
    }
    return slot.candidates.filter((roll) => (!slot.locked || roll.enchantmentId === slot.locked) && isRuntimeArmorEnchantmentId(roll.enchantmentId))
  })
  if (groups.some((group) => group.length === 0)) return []
  if (armor.gilded && !isRuntimeArmorEnchantmentId(armor.gilded.enchantmentId)) {
    unsupportedChoices.add(`${armor.instanceId}: UNSUPPORTED_ARMOR_GILDED_ENCHANTMENT: ${armor.gilded.enchantmentId}`)
    return []
  }
  const definition = getArmorDefinition(armor.armorId)
  const unsupportedBuiltIn = definition.builtInEnchantments.find((item) => !isRuntimeArmorEnchantmentId(item.enchantmentId) || item.tier === undefined)
  if (unsupportedBuiltIn) {
    unsupportedChoices.add(`${armor.instanceId}: UNSUPPORTED_ARMOR_BUILT_IN_ENCHANTMENT: ${unsupportedBuiltIn.enchantmentId}`)
    return []
  }
  const builtIns = definition.builtInEnchantments.map((item) => ({ enchantmentId: item.enchantmentId, tier: item.tier!, source: 'built-in' as const }))
  return cartesianProduct(groups).map((rolls) => ({
    armor,
    armorEnchantments: [
      ...rolls.map((roll) => ({ enchantmentId: roll.enchantmentId, tier: roll.tier, source: 'slot' as const })),
      ...(armor.gilded ? [{ enchantmentId: armor.gilded.enchantmentId, tier: armor.gilded.tier, source: 'gilded' as const }] : []),
      ...builtIns,
    ] as readonly SelectedArmorEnchantment[],
  }))
}

type ParetoCandidate = Pick<Evaluation, 'damage' | 'healing' | 'defense' | 'control' | 'objectiveScore'>

export function dominates(left: ParetoCandidate, right: ParetoCandidate): boolean {
  const atLeastAsGood =
    left.damage.aoeDps >= right.damage.aoeDps &&
    left.healing.totalPerSecond >= right.healing.totalPerSecond &&
    left.defense.effectiveHealth >= right.defense.effectiveHealth &&
    left.control.utility >= right.control.utility
  const strictlyBetter =
    left.damage.aoeDps > right.damage.aoeDps ||
    left.healing.totalPerSecond > right.healing.totalPerSecond ||
    left.defense.effectiveHealth > right.defense.effectiveHealth ||
    left.control.utility > right.control.utility
  return atLeastAsGood && strictlyBetter
}

export function calculateParetoFrontier<T extends ParetoCandidate>(evaluations: readonly T[]): T[] {
  // Enchantment permutations frequently have identical metrics. Compare one
  // representative per vector, retaining all ties for the final stable ranking.
  const keyFor = (candidate: T) => JSON.stringify([
    candidate.damage.aoeDps, candidate.healing.totalPerSecond,
    candidate.defense.effectiveHealth, candidate.control.utility,
  ])
  const unique = new Map<string, T>()
  for (const candidate of evaluations) unique.set(keyFor(candidate), candidate)
  let frontier: T[] = []
  for (const candidate of unique.values()) {
    if (frontier.some((other) => dominates(other, candidate))) continue
    frontier = frontier.filter((other) => !dominates(candidate, other))
    frontier.push(candidate)
  }
  const frontierKeys = new Set(frontier.map(keyFor))
  return evaluations
    .filter((candidate) => frontierKeys.has(keyFor(candidate)))
    .sort((left, right) => right.objectiveScore - left.objectiveScore)
    .slice(0, 10)
}

export function optimize(inventory: Inventory, scenario: Scenario): OptimizationResult {
  validateInventory(inventory)
  validateScenario(scenario)
  assertSearchBudget(inventory)

  const unsupportedChoices = new Set<string>()
  const policy = evidencePolicy(scenario)
  const runtimeArtifacts = policy === 'include-estimated'
    ? inventory.artifacts
    : inventory.artifacts.filter((artifact) => {
      if (artifactEvidenceAllowed(artifact.artifactId, policy)) return true
      unsupportedChoices.add(`${artifact.instanceId}: Estimated parameter / Unknown / Unclassifiedを使用するため「高確度のみ」では除外`)
      return false
    })
  const weaponBuilds = inventory.weapons.flatMap((weapon) => {
    const weaponBuilds = buildsForWeapon(weapon, runtimeArtifacts, unsupportedChoices)
    if (weaponBuilds.length === 0) {
      throw new OptimizerInputError(
        'INVALID_WEAPON',
        `武器${weapon.instanceId}はEnchantのstacking制約を満たす組み合わせがありません（未対応combinationも除外）。${[...unsupportedChoices].join(' ')}`,
      )
    }
    return weaponBuilds
  })
  const registeredArmors = inventory.armors ?? []
  const armorOptions = registeredArmors.flatMap((armor) => optionsForArmor(armor, unsupportedChoices))
  if (registeredArmors.length > 0 && armorOptions.length === 0) {
    throw new OptimizerInputError('NO_SUPPORTED_ARMOR_CANDIDATES', `No supported Armor candidates. ${[...unsupportedChoices].join(' ')}`)
  }
  const builds = registeredArmors.length === 0
    ? weaponBuilds
    : weaponBuilds.flatMap((weaponBuild) => armorOptions.flatMap((option) => {
      const build: Build = { ...weaponBuild, armor: option.armor, armorEnchantments: option.armorEnchantments }
      const reason = armorCombinationUnsupportedReason(build, scenario)
      if (reason) {
        unsupportedChoices.add(`${option.armor.instanceId}: ${reason}`)
        return []
      }
      return [build]
    }))
  if (registeredArmors.length > 0 && builds.length === 0) {
    throw new OptimizerInputError('NO_SUPPORTED_ARMOR_CANDIDATES', `No supported Armor candidates. ${[...unsupportedChoices].join(' ')}`)
  }
  const rangedWeapons = inventory.rangedWeapons ?? []
  const rangedBuilds = rangedWeapons.length === 0 ? builds : rangedWeapons.flatMap((rangedWeapon) => {
    const unsupported = rangedWeaponUnsupportedReason(rangedWeapon)
    if (unsupported) { unsupportedChoices.add(`${rangedWeapon.instanceId}: ${unsupported}`); return [] }
    const options = rangedOptions(rangedWeapon)
    if (options.length === 0) unsupportedChoices.add(`${rangedWeapon.instanceId}: Ranged stackingを満たす候補がありません。`)
    return builds.flatMap((base) => options.flatMap((rangedEnchantments) => {
      const build = { ...base, rangedWeapon, rangedEnchantments }
      const reason = rangedCombinationUnsupportedReason(build, scenario)
      if (reason) { unsupportedChoices.add(`${rangedWeapon.instanceId}: ${reason}`); return [] }
      return [build]
    }))
  })
  if (rangedWeapons.length > 0 && rangedBuilds.length === 0) throw new OptimizerInputError('NO_SUPPORTED_RANGED_CANDIDATES', `No supported Ranged candidates. ${[...unsupportedChoices].join(' ')}`)
  const evidenceAllowedBuilds = rangedBuilds.filter((build) => {
    const blocked = blockedParameterEvidenceForBuild(build, policy)
    if (blocked.length === 0) return true
    unsupportedChoices.add(`${build.weapon.instanceId}: Evidence policyで除外（${blocked.map((item) => `${item.mechanicId}/${item.parameterId}:${item.status}`).join('、')}）`)
    return false
  })
  const evaluations = evidenceAllowedBuilds
    .map((build) => evaluateCandidate(build, scenario))
    .sort((left, right) => right.objectiveScore - left.objectiveScore)

  const best = evaluations[0]
  if (!best) {
    throw new Error('Optimizer invariant failed: inventory generated no candidate builds.')
  }

  // Cache only for this optimization call: no stale scenarios or global growth.
  const detailed = new Map<Build, Evaluation>()
  const withDetails = (candidate: typeof best): Evaluation => {
    const existing = detailed.get(candidate.build)
    if (existing) return existing
    const result = evaluate(candidate.build, scenario)
    detailed.set(candidate.build, result)
    return result
  }
  return {
    unsupportedChoices: [...unsupportedChoices],
    best: withDetails(best),
    alternatives: evaluations.slice(1, 5).map(withDetails),
    paretoFrontier: calculateParetoFrontier(evaluations).map(withDetails),
    evaluatedBuildCount: evaluations.length,
    searchMode: 'exhaustive',
  }
}
