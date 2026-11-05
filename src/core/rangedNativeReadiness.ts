import { calculateConditionalRanged, RANGED_NATIVE_CONTRACT } from '../domain/rangedFinalNative.ts'
import type { ConditionalRangedInput } from '../domain/rangedFinalNative.ts'
import type { OwnedRangedWeapon } from './rangedTypes.ts'
import { resolveRangedSavePower } from '../inventory/rangedSavePower.ts'
import { resolveBareBowEffectiveAttributes } from '../domain/rangedEffectiveAttributes.ts'

/** Preflight for a future auto-damage source. Deliberately supplies no DPS value.
 * This API cannot manufacture an observation, accepted decision or P3B bundle.
 */
export interface OwnedRangedNativeRequest extends ConditionalRangedInput { readonly instanceId: string }

export function rangedNativeReadiness(weapon: OwnedRangedWeapon, request?: OwnedRangedNativeRequest) {
  const matches = request?.instanceId === weapon.instanceId && request?.weaponId === weapon.weaponId && (!weapon.observation || request.mode === weapon.observation.mode)
  const calculation = !request ? { state: 'unknown' as const, reason: 'equipment-has-no-internal-power-provider-or-effective-attributes' }
    : !matches ? { state: 'unknown' as const, reason: 'equipment-or-mode-mismatch' } : calculateConditionalRanged(request)
  return { runtimeEligible: false as const, calculation,
    blockers: RANGED_NATIVE_CONTRACT.runtimeAdoption.blockers,
    damageSource: weapon.observation ? 'user-observed-unmodified-projectile' as const : undefined,
    remainingRuntimeInputs: weapon.observation ? [] : ['observed-neutral-projectile-damage', 'complete-shot-cycle', 'available-ammo', 'version-mode-source-note'],
  }
}

/** Research preflight only. A manually created Inventory ID cannot be attached to
 * an arbitrary save record. Caller imports use the adapter's snapshot-bound ID.
 * No observations, Inventory fields, damage scores or promotion decisions change.
 */
export async function rangedNativeReadinessFromSave(
  weapon: OwnedRangedWeapon, jsonText: unknown, context: unknown, locator: unknown,
  conditions?: Omit<ConditionalRangedInput, 'power' | 'weaponId'>,
) {
  const boundWeapon = { ...weapon, ...(weapon.observation ? { observation: { ...weapon.observation } } : {}) }
  const explicit = conditions ? { ...conditions, attributes: { ...conditions.attributes } } : undefined
  const held = rangedNativeReadiness(boundWeapon)
  const savePower = await resolveRangedSavePower(jsonText, context, locator)
  const attributeResolution = resolveBareBowEffectiveAttributes(explicit?.attributes)
  if (savePower.state !== 'known') return { ...held, calculation: savePower, savePower, attributeResolution }
  if (boundWeapon.instanceId !== savePower.instanceId || boundWeapon.weaponId !== savePower.weaponId) {
    return { ...held, calculation: { state: 'unknown' as const, reason: 'inventory-save-instance-mismatch' }, savePower, attributeResolution }
  }
  if (!explicit || attributeResolution.state !== 'known') {
    return { ...held, calculation: { state: 'unknown' as const, reason: !explicit ? 'missing-explicit-native-conditions' : attributeResolution.reason }, savePower, attributeResolution }
  }
  return { ...rangedNativeReadiness(boundWeapon, { ...explicit, attributes: attributeResolution.attributes,
    instanceId: savePower.instanceId, weaponId: savePower.weaponId, power: savePower.power }), savePower, attributeResolution }
}
