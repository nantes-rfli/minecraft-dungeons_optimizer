import type { SemanticMappingCategory } from './gameDataSemanticMapping.ts'

export type EntityResolution =
  | { readonly status: 'resolved'; readonly entity: string; readonly basis: 'explicit-alias' | 'serialized-item-id' | 'asset-index-entity' }
  | { readonly status: 'ambiguous'; readonly candidates: readonly string[]; readonly reason: string }
  | { readonly status: 'unresolved'; readonly reason: string }

const CATEGORY_PREFIX: Readonly<Partial<Record<SemanticMappingCategory, string>>> = {
  'ranged-weapon': 'ranged-weapon', 'melee-weapon': 'melee-weapon', artifact: 'artifact',
}

export const GAME_DATA_ENTITY_ALIASES: Readonly<Record<string, string>> = {
  'armor-property:ItemCooldownDecrease': 'armor-enchantment:cool-down',
  'artifact:DeathCapMushroom': 'artifact:death-cap-mushroom',
  'enchantment:RapidFire': 'ranged-enchantment:rapid-fire',
  'melee-weapon:DoubleAxe': 'melee-weapon:double-axe',
  'ranged-weapon:ScatterCrossbow': 'ranged-weapon:scatter-crossbow',
}

export function resolveGameDataEntity(input: {
  readonly category: SemanticMappingCategory
  readonly assetIndexEntity?: string
  readonly serializedItemId?: string
  readonly knownEntities: ReadonlySet<string>
}): EntityResolution {
  const identities = [...new Set([input.serializedItemId, input.assetIndexEntity].filter((value): value is string => Boolean(value)))]
  for (const identity of identities) {
    const alias = GAME_DATA_ENTITY_ALIASES[`${input.category}:${identity}`]
    if (alias) return input.knownEntities.has(alias)
      ? { status: 'resolved', entity: alias, basis: 'explicit-alias' }
      : { status: 'unresolved', reason: `Explicit alias target is absent from the canonical Gap registry: ${alias}` }
  }
  const prefix = CATEGORY_PREFIX[input.category]
  if (!prefix) return { status: 'unresolved', reason: `No canonical category resolver for ${input.category}` }
  for (const [index, identity] of identities.entries()) {
    if (/_Unique\d+$|_Spooky\d+$|_Year\d+$/i.test(identity)) continue
    const canonical = `${prefix}:${canonicalSlug(identity)}`
    if (input.knownEntities.has(canonical)) {
      return { status: 'resolved', entity: canonical, basis: index === 0 && input.serializedItemId ? 'serialized-item-id' : 'asset-index-entity' }
    }
  }
  const candidates = identities.flatMap((identity) => {
    const token = canonicalSlug(identity.replace(/_(?:Unique|Spooky|Year)\d+$/i, ''))
    return [...input.knownEntities].filter((entity) => entity.startsWith(`${prefix}:`) && entity.slice(prefix.length + 1).replaceAll('-', '') === token.replaceAll('-', ''))
  })
  const unique = [...new Set(candidates)].sort()
  if (unique.length > 1) return { status: 'ambiguous', candidates: unique, reason: 'Multiple canonical entities match the non-authoritative normalized token' }
  return { status: 'unresolved', reason: 'No exact canonical identity or explicit alias matched' }
}

function canonicalSlug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** Phase 6.5 resolver above is frozen for reproducible historical artifacts. */
export interface ResearchEntityIdentity {
  readonly entity: string
  readonly sourceIds: readonly string[]
}
export interface AlignedEntityResolution {
  readonly status: 'accepted' | 'tentative' | 'rejected' | 'unresolved'
  readonly canonicalEntity?: string
  readonly candidates: readonly string[]
  readonly basis: string
  readonly confidence: 'high' | 'medium' | 'unknown'
  readonly variant: 'unique-variant' | 'visual-or-seasonal-unverified' | 'separate-gameplay-entity' | 'unknown'
  readonly evidenceIds: readonly string[]
}

export function resolveAlignedGameDataEntity(input: {
  readonly category: SemanticMappingCategory
  readonly serializedItemId?: string
  readonly assetIndexEntity?: string
  readonly catalog: readonly ResearchEntityIdentity[]
}): AlignedEntityResolution {
  const identity = input.serializedItemId ?? input.assetIndexEntity
  const variant = /_Unique\d+/i.test(identity ?? '') ? 'unique-variant'
    : /_(?:Spooky|Year|Winter|Summer|Season)\d*/i.test(identity ?? '') ? 'visual-or-seasonal-unverified' : 'unknown'
  const unresolved: AlignedEntityResolution = { status: 'unresolved', candidates: [], basis: 'No exact identity with category evidence; no suffix removal or fuzzy matching.', confidence: 'unknown', variant, evidenceIds: [] }
  if (!identity) return unresolved
  if (variant !== 'unknown') return { ...unresolved, basis: 'Variant identity retained separately; no reviewed base-equivalence evidence.' }
  if (input.category === 'armor-property') return { ...unresolved, basis: 'Armor intrinsic component is not an armor enchantment. Requires an independent research entity.' }
  const prefixes = input.category === 'enchantment' ? ['melee-enchantment', 'ranged-enchantment', 'armor-enchantment'] : [input.category]
  const explicit = identity === 'Powerbow' && input.category === 'ranged-weapon'
    ? 'ranged-weapon:power-bow' // Serialized spelling and indexed PowerBow identify the same base instance.
    : GAME_DATA_ENTITY_ALIASES[`${input.category}:${identity}`]
  const candidates = input.catalog.filter(entry => entry.sourceIds.length > 0 && prefixes.includes(entry.entity.split(':')[0]!)
    && (entry.entity === identity || entry.entity === explicit || entry.entity.split(':')[1] === canonicalSlug(identity)))
  const unique = [...new Set(candidates.map(c => c.entity))].sort()
  if (unique.length !== 1) return { ...unresolved, status: unique.length > 1 ? 'tentative' : 'unresolved', candidates: unique, basis: unique.length > 1 ? 'Catalog applicability has multiple categories; raw name cannot choose one.' : unresolved.basis }
  return { status: 'accepted', canonicalEntity: unique[0]!, candidates: unique,
    basis: `${input.serializedItemId ? 'serialized-item-id' : 'asset-index-entity'} + ${explicit ? 'reviewed-alias' : 'exact-catalog-slug'} + catalog-category-evidence`,
    confidence: 'high', variant: 'separate-gameplay-entity', evidenceIds: [...new Set(candidates.flatMap(c => c.sourceIds))].sort() }
}
