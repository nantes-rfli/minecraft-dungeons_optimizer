import type {
  MeleeConfiguredValueMappings,
  RangedConfiguredValueMappings,
} from './configuredValueReaders.ts'

export function horizontalMeleeValueMappings(domainId: string): MeleeConfiguredValueMappings {
  return {
    entries: { id: `${domainId}:configured-attacks@1`, rawField: 'ConfiguredAttackVariants' },
    damage: { id: `${domainId}:configured-damage@1`, rawField: 'Damage' },
    duration: { id: `${domainId}:animation-duration@1`, rawField: 'AttackAnimationTimeDurationSeconds' },
    attackRange: { id: `${domainId}:configured-attack-range@1`, rawField: 'AttackRange' },
    coneAngle: { id: `${domainId}:configured-cone-angle-degrees@1`, rawField: 'ConeAngleDegrees' },
    coneOffset: { id: `${domainId}:configured-cone-offset-units@1`, rawField: 'ConeOffsetUnits' },
    splashMultiplier: { id: `${domainId}:configured-damage-splash-multiplier@1`, rawField: 'DamageSplashMultiplier' },
    damageDelay: { id: `${domainId}:configured-damage-delay-seconds@1`, rawField: 'DamageDelaySeconds' },
    variantType: { id: `${domainId}:configured-attack-variant-type@1`, rawField: 'AttackVariantType' },
    variantLoopAmount: { id: `${domainId}:configured-variant-loop-amount@1`, rawField: 'VariantLoopAmount' },
  }
}

export function horizontalRangedValueMappings(domainId: string): RangedConfiguredValueMappings {
  return {
    definitions: { id: `${domainId}:configured-projectile-definitions@1`, rawField: 'ProjectileDefinition' },
    projectileCount: { id: `${domainId}:configured-projectile-count@1`, rawField: 'NumberOfProjectiles' },
    angleSpan: { id: `${domainId}:configured-angle-span@1`, rawField: 'AngleSpan' },
    delayPerProjectile: { id: `${domainId}:configured-delay-per-projectile@1`, rawField: 'DelaySecondsPerProjectile' },
    delaySeconds: { id: `${domainId}:configured-delay-seconds@1`, rawField: 'DelaySeconds' },
  }
}
