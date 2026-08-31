import { PROC_DAMAGE_DEFINITIONS, PROC_DAMAGE_IDS } from '../data/damageEvents'
import { CHARGE_WEAPONS, DYNAMO_POWER_RANGE } from '../data/chargeConsume'
import { chargeCombinationUnsupportedReason } from './chargeConsume'
import { calculateBaseHitsPerSecond, calculateComboFinisherRate } from './attackProfile'
import { getAttackProfile } from './catalog'
import { getTierValues } from './enchantment'
import { OptimizerInputError } from './errors'
import { soulEnchantmentUnsupportedReason } from './soulLegality'
import { dotPowerRange, isDotDamageId } from './dotDamageEvents'
import { DOT_EXPLOSION_IDS } from '../data/dotDamageEvents'
import type { AttackProfile, DamageEventContribution, EnchantmentId, OwnedWeapon, ProcDamageCurve, ProcDamageId, Scenario, SelectedEnchantment } from './types'

export function isProcDamageId(id: EnchantmentId): id is ProcDamageId {
  return (PROC_DAMAGE_IDS as readonly string[]).includes(id)
}

export function procPowerRange(id: ProcDamageId): { min: number; max: number } {
  const points = PROC_DAMAGE_DEFINITIONS[id].damageCurve.value.points
  return { min: points[0]!.powerLevel, max: points.at(-1)!.powerLevel }
}

/** One support boundary shared by evaluation, candidate search and UI. */
export function enchantmentUnsupportedReason(weapon: Pick<OwnedWeapon, 'powerLevel' | 'weaponId'>, id: EnchantmentId): string | undefined {
  if ((id === 'pain-cycle' || id === 'dynamo') && !CHARGE_WEAPONS.includes(weapon.weaponId)) return `${id}は監査済みの4武器のattack proxyのみ対応です。`
  const soulReason = soulEnchantmentUnsupportedReason(weapon.weaponId, id)
  if (soulReason) return soulReason
  if (!isProcDamageId(id) && !isDotDamageId(id) && id !== 'dynamo') return undefined
  const range = id === 'dynamo' ? DYNAMO_POWER_RANGE : isProcDamageId(id) ? procPowerRange(id) : dotPowerRange(id)
  if (!Number.isFinite(weapon.powerLevel) || weapon.powerLevel < range.min || weapon.powerLevel > range.max) {
    return `${id}はPower ${range.min}–${range.max}のみ対応（現在${weapon.powerLevel}）。公開表の範囲外は外挿しません。`
  }
  if (isProcDamageId(id) && id !== 'thundering' && getAttackProfile(weapon.weaponId).value.method === 'speed-rating-proxy') {
    return `${id}はcombo metadataのないAttack Profileに未対応です。`
  }
  return undefined
}

export function enchantmentCombinationUnsupportedReason(enchantments: readonly SelectedEnchantment[]): string | undefined {
  const chargeReason = chargeCombinationUnsupportedReason(enchantments)
  if (chargeReason) return chargeReason
  if (enchantments.filter((item) => item.enchantmentId === 'chains').length > 1) {
    return 'Chainsの複数copyは同時proc・mixed tier・再発動時の持続時間が未検証のため未対応です（game最大4個、runtime1個限定）。'
  }
  if (enchantments.filter((item) => item.enchantmentId === 'fire-aspect').length > 1) {
    return 'Fire Aspectの複数copyはstacking式が未検証のため未対応です（現在1個限定）。'
  }
  if (enchantments.some((item) => item.enchantmentId === 'void-strike')) {
    const indirect = enchantments.find((item) => (DOT_EXPLOSION_IDS as readonly string[]).includes(item.enchantmentId))
    if (indirect) return `${indirect.enchantmentId} + Void Strikeは増幅・消費・再適用のinteraction未検証のため未対応です。`
  }
  return undefined
}

export function interpolateProcDamage(curve: ProcDamageCurve, powerLevel: number): number {
  const points = curve.points
  if (curve.method !== 'log-linear' || points.length < 2 || points.some((point, index) =>
    !Number.isFinite(point.powerLevel) || !Number.isFinite(point.tierOneDamage) || point.tierOneDamage <= 0 ||
    (index > 0 && point.powerLevel <= points[index - 1]!.powerLevel))) {
    throw new Error('Proc Damage Curveには昇順のPowerと正の有限damageを2点以上指定してください。')
  }
  if (!Number.isFinite(powerLevel) || powerLevel < points[0]!.powerLevel || powerLevel > points.at(-1)!.powerLevel) {
    throw new OptimizerInputError('UNSUPPORTED_PROC_POWER', `Proc damageはPower ${points[0]!.powerLevel}–${points.at(-1)!.powerLevel}のみ対応です。範囲外は外挿しません。`)
  }
  const exact = points.find((point) => point.powerLevel === powerLevel)
  if (exact) return exact.tierOneDamage
  const upperIndex = points.findIndex((point) => point.powerLevel > powerLevel)
  const lower = points[upperIndex - 1]!
  const upper = points[upperIndex]!
  const fraction = (powerLevel - lower.powerLevel) / (upper.powerLevel - lower.powerLevel)
  return Math.exp(Math.log(lower.tierOneDamage) * (1 - fraction) + Math.log(upper.tierOneDamage) * fraction)
}

export function calculateDamageEvents(
  powerLevel: number,
  enchantments: readonly SelectedEnchantment[],
  profile: AttackProfile,
  attackSpeedMultiplier: number,
  scenario: Scenario,
): DamageEventContribution[] {
  return enchantments.flatMap((selected): DamageEventContribution[] => {
    const effect = getTierValues(selected).effect
    if (effect?.kind !== 'combo-finisher-damage' && effect?.kind !== 'on-hit-proc-damage') return []
    if (!Number.isFinite(attackSpeedMultiplier) || attackSpeedMultiplier <= 0) {
      throw new Error('Proc発動速度は正の有限値にしてください。')
    }
    const definition = PROC_DAMAGE_DEFINITIONS[effect.procDamageId]
    const opportunitiesPerSecond = effect.kind === 'combo-finisher-damage'
      ? calculateComboFinisherRate(profile, attackSpeedMultiplier)
      : calculateBaseHitsPerSecond(profile) * attackSpeedMultiplier
    const triggerProbability = effect.kind === 'on-hit-proc-damage' ? effect.triggerChance : 1
    const eventsPerSecond = opportunitiesPerSecond * triggerProbability
    const damagePerEvent = interpolateProcDamage(definition.damageCurve.value, powerLevel) * effect.tierMultiplier
    const expectedTargetsHit = scenario.damageEventTargeting?.[effect.procDamageId]
    if (!Number.isFinite(expectedTargetsHit) || expectedTargetsHit < 1 || expectedTargetsHit > scenario.averageTargetsInReach) {
      throw new OptimizerInputError('INVALID_SCENARIO', `${effect.procDamageId}平均命中数は1以上、射程内の敵数以下の有限値にしてください。`)
    }
    const singleTargetDps = eventsPerSecond * damagePerEvent
    return [{
      kind: 'instant',
      sourceId: selected.enchantmentId, channel: 'enchantment-proc', tier: selected.tier,
      triggerKind: effect.kind === 'combo-finisher-damage' ? 'combo-finisher' : 'on-hit-probability',
      requiresTargetHit: definition.requiresTargetHit,
      opportunitiesPerSecond, triggerProbability, eventsPerSecond, damagePerEvent,
      expectedTargetsHit, singleTargetDps, aoeDps: singleTargetDps * expectedTargetsHit,
      qualifiesAsDirectWeaponKill: false, confidence: 'low',
    }]
  })
}
