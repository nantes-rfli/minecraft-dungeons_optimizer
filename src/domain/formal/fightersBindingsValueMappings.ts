export const fightersBindingsValueMappings = {
  entries: { id: 'fighters-bindings:configured-attacks@1', rawField: 'ConfiguredAttackVariants', meaning: 'Serialized configured attack entries in source order; not a complete combo mechanic.' },
  damage: { id: 'fighters-bindings:configured-damage@1', rawField: 'Damage', meaning: 'Configured damage parameter; not final damage or power-scaled damage.' },
  duration: { id: 'fighters-bindings:animation-duration@1', rawField: 'AttackAnimationTimeDurationSeconds', meaning: 'Configured animation duration in seconds; not effective attack speed or cadence.' },
} as const
