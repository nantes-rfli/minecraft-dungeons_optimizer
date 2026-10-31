import model from '../../research/domain/ranged-native-model.json' with { type: 'json' }

export type NativeRangedId = keyof typeof model.profiles
/** Conditional CDO result, before Power, event changes and target handling.
 * Never accepted as an observation or an effective shot interval by core.
 * Native-derived values deliberately do not enter serialized Formal Value v2.
 */
export function nativeRangedReference(id: string) {
  if (!Object.hasOwn(model.profiles, id)) return { state: 'unknown' as const, reason: 'No reviewed Native CDO model' }
  const profile = model.profiles[id as NativeRangedId]
  return { state: 'known' as const, evidenceStatus: 'derived' as const,
    gameVersion: model.gameVersion, identityAssertionId: profile.identityAssertionId,
    conditions: model.conditions, parameters: profile.parameters,
    configuredProjectile: profile.configuredProjectile,
    blueprintReview: 'blueprintReview' in profile ? profile.blueprintReview : undefined,
    baselineBeforePower: profile.derivedCdoBaseline,
    finalProjectileDamage: profile.finalProjectileDamage,
    effectiveShotCycleSeconds: profile.effectiveShotCycleSeconds,
  }
}
