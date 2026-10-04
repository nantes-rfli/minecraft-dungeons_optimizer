/** Reviewed root CDO configuration only; no gameplay scaling or cooldown semantics. */
export const artifactValueMappings = [
  { domainId: 'corrupted-seeds', field: 'configuredTargetCount', rawField: 'TargetCount', rawType: 'IntProperty', id: 'corrupted-seeds:configured-target-count@1', unit: 'count' },
  { domainId: 'enchanted-grass', field: 'configuredIncreasedMaxHealthMultiplier', rawField: 'IncreasedMaxHealthMultiplier', rawType: 'FloatProperty', id: 'enchanted-grass:configured-max-health-multiplier@1', unit: 'dimensionless multiplier' },
  { domainId: 'powershaker', field: 'configuredAttackStacks', rawField: 'AttackStacks', rawType: 'IntProperty', id: 'powershaker:configured-attack-stacks@1', unit: 'count' },
  { domainId: 'vexing-chant', field: 'configuredPetAmountCap', rawField: 'PetAmountCap', rawType: 'IntProperty', id: 'vexing-chant:configured-pet-cap@1', unit: 'count' },
  { domainId: 'vexing-chant', field: 'configuredCoolDownForEachPetDeath', rawField: 'CoolDownForEachPetDeath', rawType: 'BoolProperty', id: 'vexing-chant:configured-cooldown-for-each-pet-death@1', unit: 'boolean flag' },
] as const
export type ArtifactValueMapping = typeof artifactValueMappings[number]
