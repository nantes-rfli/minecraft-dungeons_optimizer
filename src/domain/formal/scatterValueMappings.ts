export const scatterValueMappings = {
  definitions: { id: 'scatter-crossbow:configured-projectile-definitions@1', rawField: 'ProjectileDefinition', rawPath: 'AttackDefintion.ProjectileDefinition', meaning: 'Serialized projectile definitions in source order.' },
  projectileCount: { id: 'scatter-crossbow:configured-projectile-count@1', rawField: 'NumberOfProjectiles', meaning: 'Serialized configured projectile count; not an effective hit count.' },
  angleSpan: { id: 'scatter-crossbow:configured-angle-span@1', rawField: 'AngleSpan', meaning: 'Serialized configured angle span; no trajectory outcome is inferred.' },
  delayPerProjectile: { id: 'scatter-crossbow:configured-delay-per-projectile@1', rawField: 'DelaySecondsPerProjectile', meaning: 'Serialized configured delay parameter in seconds; not effective cadence.' },
  velocityFactor: { id: 'scatter-crossbow:configured-projectile-velocity-factor@1', rawField: 'ProjectileVelocityFactor', meaning: 'Serialized configured velocity factor; no effective velocity is inferred.' },
  pushbackEnabled: { id: 'scatter-crossbow:configured-pushback-enabled@1', rawField: 'pushback.enablePushback', meaning: 'Serialized configured pushback enable flag.' },
  pushbackStrength: { id: 'scatter-crossbow:configured-pushback-strength@1', rawField: 'pushback.pushbackStrength', meaning: 'Serialized configured pushback strength parameter; no effective displacement is inferred.' },
  ignoreFriendlyFire: { id: 'scatter-crossbow:configured-ignore-friendly-fire@1', rawField: 'IgnoreFriendlyFire', meaning: 'Serialized configured friendly-fire ignore flag.' },
  delaySeconds: { id: 'scatter-crossbow:configured-delay-seconds@1', rawField: 'DelaySeconds', meaning: 'Serialized configured delay parameter in seconds.' },
} as const
