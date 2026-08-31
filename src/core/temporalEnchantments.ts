import { enchantmentsById, getTierValues } from './enchantment'
import type { ArtifactActivationState, ArtifactSynergyState, OnKillAttackSpeedEffect, SelectedEnchantment } from './types'

function nonnegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and nonnegative`)
}

export function deriveArtifactSynergyState(
  enchantments: readonly SelectedEnchantment[], activation: ArtifactActivationState, eligibleDirectAttacksPerSecond: number,
): ArtifactSynergyState {
  nonnegativeFinite(activation.totalActivationsPerSecond, 'Artifact activation rate')
  nonnegativeFinite(eligibleDirectAttacksPerSecond, 'Eligible direct attack rate')
  const selected = enchantmentsById(enchantments, 'artifact-synergy')[0]
  const effect = selected ? getTierValues(selected).effect : undefined
  if (selected && effect?.kind !== 'artifact-next-attack-damage') throw new Error('Missing Artifact Synergy effect')
  const bonus = effect?.kind === 'artifact-next-attack-damage' ? effect.bonus : 0
  const chargedAttacksPerSecond = selected ? Math.min(activation.totalActivationsPerSecond, eligibleDirectAttacksPerSecond) : 0
  const chargedAttackShare = eligibleDirectAttacksPerSecond > 0 ? chargedAttacksPerSecond / eligibleDirectAttacksPerSecond : 0
  return { pendingChargeCapacity: 1, eligibleDirectAttacksPerSecond, chargedAttacksPerSecond, chargedAttackShare, bonus, expectedDirectMultiplier: 1 + chargedAttackShare * bonus }
}

/** Copy policy is duration-only; it must not pass through scalar bonus stacking. */
export function combineRampagingEffects(enchantments: readonly SelectedEnchantment[]): OnKillAttackSpeedEffect | undefined {
  const copies = enchantmentsById(enchantments, 'rampaging')
  if (copies.length === 0) return undefined
  let combined: OnKillAttackSpeedEffect | undefined
  for (const copy of copies) {
    const effect = getTierValues(copy).effect
    if (effect?.kind !== 'on-direct-kill-attack-speed') throw new Error('Missing Rampaging effect')
    if (combined && (combined.triggerChance !== effect.triggerChance || combined.attackSpeedBonus !== effect.attackSpeedBonus)) {
      throw new Error('Rampaging copies must share trigger chance and active magnitude')
    }
    combined = { ...effect, durationSeconds: (combined?.durationSeconds ?? 0) + effect.durationSeconds }
  }
  return combined
}

export function temporaryBuffUptime(triggerEventsPerSecond: number, durationSeconds: number): number {
  nonnegativeFinite(triggerEventsPerSecond, 'Temporary buff trigger rate')
  nonnegativeFinite(durationSeconds, 'Temporary buff duration')
  const exposure = triggerEventsPerSecond * durationSeconds
  if (!Number.isFinite(exposure)) throw new Error('Temporary buff exposure exceeds finite numeric range')
  return -Math.expm1(-exposure)
}
