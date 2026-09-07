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
