export const fightersBindingsValueMappings = {
  entries: { id: 'fighters-bindings:configured-attacks@1', rawField: 'ConfiguredAttackVariants', meaning: 'Serialized configured attack entries in source order; not a complete combo mechanic.' },
  damage: { id: 'fighters-bindings:configured-damage@1', rawField: 'Damage', meaning: 'Configured damage parameter; not final damage or power-scaled damage.' },
  duration: { id: 'fighters-bindings:animation-duration@1', rawField: 'AttackAnimationTimeDurationSeconds', meaning: 'Configured animation duration in seconds; not effective attack speed or cadence.' },
  attackRange: { id: 'fighters-bindings:configured-attack-range@1', rawField: 'AttackRange', meaning: 'Configured attack range parameter.' },
  coneAngle: { id: 'fighters-bindings:configured-cone-angle-degrees@1', rawField: 'ConeAngleDegrees', meaning: 'Configured cone angle in degrees.' },
  coneOffset: { id: 'fighters-bindings:configured-cone-offset-units@1', rawField: 'ConeOffsetUnits', meaning: 'Configured cone offset in game units.' },
  splashMultiplier: { id: 'fighters-bindings:configured-damage-splash-multiplier@1', rawField: 'DamageSplashMultiplier', meaning: 'Configured splash damage multiplier.' },
  damageDelay: { id: 'fighters-bindings:configured-damage-delay-seconds@1', rawField: 'DamageDelaySeconds', meaning: 'Configured damage delay in seconds.' },
  variantType: { id: 'fighters-bindings:configured-attack-variant-type@1', rawField: 'AttackVariantType', meaning: 'Serialized configured attack variant enum value.' },
  variantLoopAmount: { id: 'fighters-bindings:configured-variant-loop-amount@1', rawField: 'VariantLoopAmount', meaning: 'Configured attack variant loop amount.' },
} as const
