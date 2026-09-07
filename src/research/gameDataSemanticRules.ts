import type { ExpectedOutcome } from './evidenceGapMap.ts'
import type { GameDataConfidence, MappingBasis } from './gameDataProvenance.ts'
import type { SemanticMappingCategory, SemanticMappingStatus } from './gameDataSemanticMapping.ts'

export type GameDataRuleClosePolicy = 'may-close-static-gap' | 'evidence-only'

export interface GameDataSemanticRule {
  readonly id: string
  readonly category: SemanticMappingCategory
  readonly assetNamePattern: RegExp
  readonly propertyPathPattern: RegExp
  readonly normalizedProperty?: string
  readonly semanticStatus: SemanticMappingStatus
  readonly semanticConfidence: GameDataConfidence
  readonly mappingBasis: readonly MappingBasis[]
  readonly gapProperties: readonly string[]
  readonly expectedOutcomes: readonly ExpectedOutcome[]
  readonly closePolicy: GameDataRuleClosePolicy
  readonly canReplaceEmpiricalProtocol: boolean
  readonly empiricalReplacementReason?: string
  readonly description: string
}

export const GAME_DATA_SEMANTIC_RULES: readonly GameDataSemanticRule[] = [
  {
    id: 'ranged-instance-projectile-count-v1', category: 'ranged-weapon',
    assetNamePattern: /^BP_.+Instance$/,
    propertyPathPattern: /^AttackDefintion\.ProjectileDefinition\[\d+\]\.NumberOfProjectiles$/,
    normalizedProperty: 'ranged.projectileCount', semanticStatus: 'accepted', semanticConfidence: 'high',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: ['projectileCount'],
    expectedOutcomes: ['numeric-value'], closePolicy: 'may-close-static-gap',
    canReplaceEmpiricalProtocol: true,
    empiricalReplacementReason: 'The Gap asks for the serialized configured projectile count itself; no runtime cadence or proc behavior is inferred.',
    description: 'Exact projectile-definition count on a ranged weapon instance.',
  },
  {
    id: 'ranged-instance-angle-span-v1', category: 'ranged-weapon',
    assetNamePattern: /^BP_.+Instance$/,
    propertyPathPattern: /^AttackDefintion\.ProjectileDefinition\[\d+\]\.AngleSpan$/,
    normalizedProperty: 'ranged.angleSpanDegrees', semanticStatus: 'accepted', semanticConfidence: 'medium',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: ['spread'],
    expectedOutcomes: ['categorical-value'], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Configured projectile angle span; it narrows spread research but does not establish effective spread behavior.',
  },
  {
    id: 'ranged-instance-attack-rate-v1', category: 'ranged-weapon',
    assetNamePattern: /^BP_.+Instance$/,
    propertyPathPattern: /^AttackDefintion\.AttackRateSeconds$/,
    normalizedProperty: 'ranged.attackRateSeconds', semanticStatus: 'tentative', semanticConfidence: 'medium',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: ['shotsPerSecond', 'recoverySeconds'],
    expectedOutcomes: ['timing', 'categorical-value'], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Serialized attack-rate interval whose exact effective cadence ownership remains unresolved.',
  },
  {
    id: 'melee-instance-animation-duration-v1', category: 'melee-weapon',
    assetNamePattern: /^BP_.+Instance$/,
    propertyPathPattern: /^ConfiguredAttackVariants\[\d+\]\.AttackAnimationTimeDurationSeconds$/,
    normalizedProperty: 'melee.attackAnimationDurationSeconds', semanticStatus: 'accepted', semanticConfidence: 'high',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: [], expectedOutcomes: [],
    closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Configured variant animation duration, not effective attack-speed scaling.',
  },
  {
    id: 'artifact-instance-effect-class-v1', category: 'artifact',
    assetNamePattern: /^BP_.+Instance$/,
    propertyPathPattern: /^Effect$/,
    normalizedProperty: 'artifact.gameplayEffectClass', semanticStatus: 'accepted', semanticConfidence: 'high',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: [], expectedOutcomes: [],
    closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Artifact-to-GameplayEffect structural reference only.',
  },
  {
    id: 'armor-property-effect-class-v1', category: 'armor-property',
    assetNamePattern: /^BP_.+$/,
    propertyPathPattern: /^Effect$/,
    normalizedProperty: 'armor.gameplayEffectClass', semanticStatus: 'accepted', semanticConfidence: 'high',
    mappingBasis: ['property-name-direct', 'class-context'], gapProperties: [], expectedOutcomes: [],
    closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Armor-property-to-GameplayEffect structural reference only.',
  },
  {
    id: 'raw-damage-negative-control-v1', category: 'melee-weapon',
    assetNamePattern: /^BP_.+$/,
    propertyPathPattern: /(?:^|\.)Damage$/,
    semanticStatus: 'unresolved', semanticConfidence: 'unknown', mappingBasis: ['property-name-direct', 'class-context'],
    gapProperties: [], expectedOutcomes: [], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Raw Damage scalars are not final or Power-scaled gameplay damage.',
  },
  {
    id: 'raw-ranged-damage-negative-control-v1', category: 'ranged-weapon',
    assetNamePattern: /^BP_.+$/,
    propertyPathPattern: /(?:^|\.)[Dd]amage$/,
    semanticStatus: 'unresolved', semanticConfidence: 'unknown', mappingBasis: ['property-name-direct', 'class-context'],
    gapProperties: [], expectedOutcomes: [], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Raw projectile Damage scalars are not final, displayed, or Power-scaled damage.',
  },
  {
    id: 'enchantment-empty-cdo-v1', category: 'enchantment',
    assetNamePattern: /^BP_.+$/,
    propertyPathPattern: /^\$cdo\.declaredPropertyCount$/,
    semanticStatus: 'unresolved', semanticConfidence: 'unknown', mappingBasis: ['class-context', 'inheritance-context'],
    gapProperties: [], expectedOutcomes: [], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'An empty declared CDO narrows value storage to inherited, native, or referenced data without supplying a value.',
  },
  {
    id: 'presentation-priority-negative-control-v1', category: 'armor-property',
    assetNamePattern: /^BP_.+$/,
    propertyPathPattern: /^PropertyColorPrio\.Prio$/,
    semanticStatus: 'rejected', semanticConfidence: 'high', mappingBasis: ['property-name-direct', 'class-context'],
    gapProperties: [], expectedOutcomes: [], closePolicy: 'evidence-only', canReplaceEmpiricalProtocol: false,
    description: 'Presentation priority metadata is not a gameplay magnitude.',
  },
] as const

export function matchingSemanticRule(category: SemanticMappingCategory, assetName: string, propertyPath: string): GameDataSemanticRule | undefined {
  return GAME_DATA_SEMANTIC_RULES.find((rule) => rule.category === category
    && rule.assetNamePattern.test(assetName)
    && rule.propertyPathPattern.test(propertyPath))
}

export function validateSemanticRuleRegistry(): string[] {
  const errors: string[] = []
  const ids = GAME_DATA_SEMANTIC_RULES.map((rule) => rule.id)
  if (new Set(ids).size !== ids.length) errors.push('Semantic rule registry contains duplicate IDs')
  for (const rule of GAME_DATA_SEMANTIC_RULES) {
    if (rule.canReplaceEmpiricalProtocol && (!rule.empiricalReplacementReason || rule.closePolicy !== 'may-close-static-gap')) errors.push(`${rule.id}: empirical replacement requires a reason and static close policy`)
    if (rule.closePolicy === 'may-close-static-gap' && rule.semanticStatus !== 'accepted') errors.push(`${rule.id}: only accepted rules may close a static Gap`)
    if (/damage/i.test(rule.normalizedProperty ?? '') && rule.id.includes('raw-damage')) errors.push(`${rule.id}: raw Damage must not produce a normalized damage fact`)
  }
  return errors.sort()
}
