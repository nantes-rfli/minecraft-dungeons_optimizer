import { calculateConditionalRanged, RANGED_NATIVE_CONTRACT } from '../domain/rangedFinalNative.ts'
import type { ConditionalRangedInput } from '../domain/rangedFinalNative.ts'
import type { OwnedRangedWeapon } from './rangedTypes.ts'

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
