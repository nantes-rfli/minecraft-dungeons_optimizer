import type {
  MeleeConfiguredValueMappings,
  RangedConfiguredValueMappings,
} from './configuredValueReaders.ts'

export function horizontalMeleeValueMappings(domainId: string): MeleeConfiguredValueMappings {
  return {
    entries: { id: `${domainId}:configured-attacks@1`, rawField: 'ConfiguredAttackVariants' },
    damage: { id: `${domainId}:configured-damage@1`, rawField: 'Damage' },
    duration: { id: `${domainId}:animation-duration@1`, rawField: 'AttackAnimationTimeDurationSeconds' },
  }
}

export function horizontalRangedValueMappings(domainId: string): RangedConfiguredValueMappings {
  return {
    definitions: { id: `${domainId}:configured-projectile-definitions@1`, rawField: 'ProjectileDefinition' },
    projectileCount: { id: `${domainId}:configured-projectile-count@1`, rawField: 'NumberOfProjectiles' },
    angleSpan: { id: `${domainId}:configured-angle-span@1`, rawField: 'AngleSpan' },
    delayPerProjectile: { id: `${domainId}:configured-delay-per-projectile@1`, rawField: 'DelaySecondsPerProjectile' },
  }
}
