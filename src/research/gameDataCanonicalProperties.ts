import type { HarvestCategory } from './sourceHarvest.ts'

export interface CanonicalResearchProperty {
  readonly id: string
  readonly category: HarvestCategory | 'armor-property'
  readonly valueKind: 'number' | 'boolean' | 'string' | 'enum' | 'reference' | 'array' | 'struct' | 'distribution' | 'runtime-derived'
  readonly unit?: string
  readonly semanticMeaning: string
  readonly sourceLayer: 'direct-static' | 'structural-reference' | 'derived-research' | 'runtime-required' | 'empirical-required'
  readonly aliases: readonly string[]
  readonly runtimePromotion: 'not-eligible' | 'requires-validation' | 'future-candidate'
  readonly status: 'active' | 'experimental' | 'deprecated'
  readonly change: 'added' | 'aliased' | 'renamed' | 'split' | 'merged' | 'deprecated' | 'runtime-only' | 'empirical-only'
  readonly lineage: readonly string[]
  readonly decisionReason: string
}
const staticProperty = (id: string, category: CanonicalResearchProperty['category'], semanticMeaning: string, aliases: string[], unit?: string): CanonicalResearchProperty => ({
  id, category, valueKind: 'number', ...(unit ? { unit } : {}), semanticMeaning, aliases,
  sourceLayer: 'direct-static', runtimePromotion: 'requires-validation', status: 'active', change: 'aliased', lineage: aliases,
  decisionReason: 'Explicit class/path/type rule; configured static fact only. Effective behavior requires independent validation.',
})
export const CANONICAL_GAME_DATA_PROPERTIES: readonly CanonicalResearchProperty[] = [
  staticProperty('ranged.projectileCount', 'ranged-weapon', 'Configured count per projectile-definition index; not total projectiles across every attack variant.', ['NumberOfProjectiles'], 'count'),
  staticProperty('ranged.angleSpanDegrees', 'ranged-weapon', 'Configured projectile angle span, not an effective spread distribution. Preserve the established 6.5 ID.', ['AngleSpan', 'ranged.projectileAngleSpanDegrees'], 'degrees'),
  { ...staticProperty('ranged.configuredAttackIntervalSeconds', 'ranged-weapon', 'Serialized AttackRateSeconds configuration. Runtime ownership and effective shot cadence remain unproven; no reciprocal conversion.', ['AttackRateSeconds', 'ranged.attackRateSeconds'], 'seconds'), change: 'renamed' },
  { ...staticProperty('melee.attackAnimationDurationSeconds', 'melee-weapon', 'Configured animation duration for the indexed attack variant. Preserve every index and asset; never collapse to final attack speed.', ['AttackAnimationTimeDurationSeconds'], 'seconds'), change: 'added' },
  ...(['artifact', 'armor-property'] as const).map(category => ({
    id: category === 'artifact' ? 'artifact.gameplayEffectClass' : 'armor.gameplayEffectClass', category, valueKind: 'reference' as const,
    semanticMeaning: 'GameplayEffect class reference only; does not establish magnitude, duration, stacking or attribute modification.',
    sourceLayer: 'structural-reference' as const, aliases: ['Effect'], runtimePromotion: 'not-eligible' as const,
    status: 'active' as const, change: 'added' as const, lineage: ['Effect'], decisionReason: 'ObjectProperty class reference in the exact artifact/component class context.',
  })),
]

/** Separate versioned approval registry; historical semantic rules stay reproducible. */
export const ALIGNED_RULE_DECISIONS = [
  { ruleId: 'ranged-instance-projectile-count-v1', propertyId: 'ranged.projectileCount', status: 'approved', types: ['IntProperty'] },
  { ruleId: 'ranged-instance-angle-span-v1', propertyId: 'ranged.angleSpanDegrees', status: 'approved', types: ['FloatProperty'] },
  { ruleId: 'ranged-instance-attack-rate-v1', propertyId: 'ranged.configuredAttackIntervalSeconds', status: 'approved', types: ['FloatProperty'] },
  { ruleId: 'melee-instance-animation-duration-v1', propertyId: 'melee.attackAnimationDurationSeconds', status: 'approved', types: ['FloatProperty'] },
  { ruleId: 'artifact-instance-effect-class-v1', propertyId: 'artifact.gameplayEffectClass', status: 'approved', types: ['ObjectProperty'] },
  { ruleId: 'armor-property-effect-class-v1', propertyId: 'armor.gameplayEffectClass', status: 'approved', types: ['ObjectProperty'] },
  { ruleId: 'raw-damage-negative-control-v1', status: 'rejected', types: [] },
  { ruleId: 'raw-ranged-damage-negative-control-v1', status: 'rejected', types: [] },
  { ruleId: 'enchantment-empty-cdo-v1', status: 'experimental', types: [] },
  { ruleId: 'presentation-priority-negative-control-v1', status: 'rejected', types: [] },
] as const

export function auditCanonicalProperties(properties: readonly CanonicalResearchProperty[]): string[] {
  const errors: string[] = [], ids = new Set<string>(), aliases = new Set<string>()
  for (const p of properties) {
    if (ids.has(p.id)) errors.push(`${p.id}: duplicate property`)
    ids.add(p.id)
    if (!/^[a-z][a-zA-Z-]*\.[a-z][a-zA-Z0-9]*$/.test(p.id)) errors.push(`${p.id}: invalid namespace`)
    if (!p.semanticMeaning.trim() || !p.decisionReason.trim()) errors.push(`${p.id}: missing semantics/reason`)
    if (!['number','boolean','string','enum','reference','array','struct','distribution','runtime-derived'].includes(p.valueKind)) errors.push(`${p.id}: invalid value kind`)
    if (!['direct-static','structural-reference','derived-research','runtime-required','empirical-required'].includes(p.sourceLayer)) errors.push(`${p.id}: invalid source layer`)
    if (!['not-eligible','requires-validation','future-candidate'].includes(p.runtimePromotion)) errors.push(`${p.id}: invalid promotion policy`)
    if (!['active','experimental','deprecated'].includes(p.status)) errors.push(`${p.id}: invalid status`)
    if (['deprecated','split','merged'].includes(p.change) && !p.lineage.length) errors.push(`${p.id}: missing positive-evidence lineage`)
    for (const alias of p.aliases) {
      const key = `${p.category}:${alias}`
      if (aliases.has(key)) errors.push(`${key}: alias collision`)
      aliases.add(key)
    }
  }
  return errors
}
