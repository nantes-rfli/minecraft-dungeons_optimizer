import { OptimizerInputError } from './errors'
import type { GearPowerCurve, GearPowerCurvePoint } from './types'

function assertCurve(curve: GearPowerCurve): void {
  if (!Number.isFinite(curve.referenceBaseHitDamage) || curve.referenceBaseHitDamage <= 0) {
    throw new Error('Gear Power CurveのreferenceBaseHitDamageは0より大きい有限値にしてください。')
  }
  if (curve.points.length < 2) {
    throw new Error('Gear Power Curveには2件以上のサンプルが必要です。')
  }
  curve.points.forEach((point, index) => {
    if (!Number.isInteger(point.powerLevel) || point.powerLevel <= 0) {
      throw new Error(`Gear Power Curveのpoints[${index}].powerLevelが不正です。`)
    }
    if (!Number.isFinite(point.referenceDamage) || point.referenceDamage <= 0) {
      throw new Error(`Gear Power Curveのpoints[${index}].referenceDamageが不正です。`)
    }
    const previous = curve.points[index - 1]
    if (previous && (point.powerLevel <= previous.powerLevel
      || point.referenceDamage <= previous.referenceDamage)) {
      throw new Error('Gear Power CurveのサンプルはPowerとDamageの昇順で重複なく指定してください。')
    }
  })
}

function interpolateReferenceDamage(
  powerLevel: number,
  lower: GearPowerCurvePoint,
  upper: GearPowerCurvePoint,
): number {
  if (powerLevel === lower.powerLevel) return lower.referenceDamage
  if (powerLevel === upper.powerLevel) return upper.referenceDamage
  const position = (powerLevel - lower.powerLevel) / (upper.powerLevel - lower.powerLevel)
  return Math.exp(
    Math.log(lower.referenceDamage)
    + position * (Math.log(upper.referenceDamage) - Math.log(lower.referenceDamage)),
  )
}

export function calculatePowerScaledHitDamage(
  baseHitDamage: number,
  powerLevel: number,
  curve: GearPowerCurve,
): number {
  if (!Number.isFinite(baseHitDamage) || baseHitDamage <= 0) {
    throw new Error('baseHitDamageは0より大きい有限値にしてください。')
  }
  assertCurve(curve)
  const first = curve.points[0]!
  const last = curve.points.at(-1)!
  if (!Number.isInteger(powerLevel) || powerLevel < first.powerLevel || powerLevel > last.powerLevel) {
    throw new OptimizerInputError(
      'UNSUPPORTED_POWER_LEVEL',
      `表示ダメージ未入力時の武器Powerは${first.powerLevel}以上${last.powerLevel}以下で指定してください。範囲外では表示ダメージを入力してください。`,
    )
  }

  const upperIndex = curve.points.findIndex((point) => point.powerLevel >= powerLevel)
  const upper = curve.points[upperIndex]
  const lower = curve.points[Math.max(0, upperIndex - 1)]
  if (!lower || !upper) throw new Error('Gear Power Curveの補間区間を取得できません。')
  const referenceDamage = interpolateReferenceDamage(powerLevel, lower, upper)
  return Math.round(referenceDamage * baseHitDamage / curve.referenceBaseHitDamage)
}
