import type { Confidence } from '../core/types'

export const MELEE_ENCHANTMENT_RUNTIME_STATUSES = [
  'implemented',
  'straightforward',
  'needs-state-model',
  'needs-damage-event-model',
  'needs-enemy-state',
  'utility-only',
  'insufficient-evidence',
] as const

export const MELEE_ENCHANTMENT_TRIGGERS = [
  'passive',
  'on-hit',
  'on-combo-finisher',
  'on-kill',
  'on-artifact-use',
  'on-roll',
  'on-soul',
  'conditional-hit',
  'other',
] as const

export const MELEE_ENCHANTMENT_STACKING_BEHAVIORS = [
  'non-stackable',
  'additive',
  'multiplicative',
  'special',
  'unknown',
] as const

export const EXPECTED_MELEE_ENCHANTMENT_IDS = [
  'ambush',
  'anima-conduit',
  'artifact-synergy',
  'busy-bee',
  'chains',
  'committed',
  'critical-hit',
  'dynamo',
  'echo',
  'enigma-resonator',
  'exploding',
  'fire-aspect',
  'freezing',
  'gravity',
  'guarding-strike',
  'leeching',
  'looting',
  'pain-cycle',
  'poison-cloud',
  'prospector',
  'radiance',
  'rampaging',
  'refreshment',
  'sharpness',
  'shockwave',
  'smiting',
  'soul-siphon',
  'stunning',
  'swirling',
  'thundering',
  'unchanting',
  'void-strike',
  'weakening',
] as const

export type MeleeEnchantmentRuntimeStatus =
  (typeof MELEE_ENCHANTMENT_RUNTIME_STATUSES)[number]
export type MeleeEnchantmentTrigger = (typeof MELEE_ENCHANTMENT_TRIGGERS)[number]
export type MeleeEnchantmentStackingBehavior =
  (typeof MELEE_ENCHANTMENT_STACKING_BEHAVIORS)[number]

export interface MeleeEnchantmentAuditSource {
  readonly type: 'game-files' | 'minecraft-wiki' | 'community-test' | 'inference'
  readonly url: string
  readonly retrievedAt: string
  readonly supports: readonly (
    | 'population'
    | 'applicability'
    | 'rarity'
    | 'tier-values'
    | 'trigger-mechanics'
    | 'stacking'
    | 'damage-scaling'
    | 'kill-attribution'
    | 'interaction-behavior'
    | 'built-in'
  )[]
  readonly confidence: Confidence
  readonly note: string
}

export interface MeleeEnchantmentTierValue {
  readonly raw: string
  readonly interpreted?: Readonly<Record<string, string | number | boolean>>
}

export interface MeleeEnchantmentAuditEntry {
  readonly id: string
  readonly name: { readonly en: string; readonly ja?: string }
  readonly applicability: {
    readonly melee: boolean
    readonly ranged: boolean
    readonly armor: boolean
    readonly soulGearOnly?: boolean
  }
  readonly rarity: 'common' | 'powerful'
  readonly obtainable: {
    readonly normalSlot: boolean
    readonly gilded: boolean
    readonly builtInUnique: boolean
    readonly builtInTier?: 1
  }
  readonly tierValues: Readonly<Record<'1' | '2' | '3', MeleeEnchantmentTierValue>>
  readonly stacking: {
    readonly maxCopies?: number
    readonly behavior: MeleeEnchantmentStackingBehavior
  }
  readonly trigger: MeleeEnchantmentTrigger
  readonly modelCategory: string
  readonly runtimeStatus: MeleeEnchantmentRuntimeStatus
  readonly runtimePowerRange?: { readonly min: number; readonly max: number }
  readonly sources: readonly MeleeEnchantmentAuditSource[]
  readonly confidence: Confidence
  readonly notes?: string
}

export interface MeleeEnchantmentAudit {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly auditedAt: string
  readonly population: {
    readonly targetCount: 33
    readonly definition: string
    readonly excludedClasses: readonly string[]
    readonly source: MeleeEnchantmentAuditSource
  }
  readonly entries: readonly MeleeEnchantmentAuditEntry[]
}

export interface MeleeEnchantmentAuditSummary {
  readonly total: number
  readonly counts: Readonly<Record<MeleeEnchantmentRuntimeStatus, number>>
  readonly implementedNames: readonly string[]
  readonly unsupportedNames: readonly string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isHttpUrl = (value: unknown): boolean => {
  if (!isNonEmptyString(value)) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const validateSource = (value: unknown, path: string, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (!['game-files', 'minecraft-wiki', 'community-test', 'inference'].includes(String(value.type))) {
    errors.push(`${path}.type is not allowed`)
  }
  if (!isHttpUrl(value.url)) errors.push(`${path}.url must be an HTTP(S) URL`)
  if (!isNonEmptyString(value.retrievedAt)) errors.push(`${path}.retrievedAt is required`)
  if (!Array.isArray(value.supports) || value.supports.length === 0
    || !value.supports.every(isNonEmptyString)) {
    errors.push(`${path}.supports must be a non-empty string array`)
  }
  if (!['high', 'medium', 'low'].includes(String(value.confidence))) {
    errors.push(`${path}.confidence is not allowed`)
  }
  if (!isNonEmptyString(value.note)) errors.push(`${path}.note is required`)
}

export function collectMeleeEnchantmentAuditErrors(
  value: unknown,
  runtimeEnchantmentIds: readonly string[],
): string[] {
  if (!isRecord(value)) return ['audit root must be an object']
  const errors: string[] = []
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (value.gameVersion !== '1.17.0.0') errors.push('gameVersion must be 1.17.0.0')
  if (!isNonEmptyString(value.auditedAt)) errors.push('auditedAt is required')

  const population = isRecord(value.population) ? value.population : null
  if (population === null) {
    errors.push('population must be an object')
  } else {
    if (population.targetCount !== 33) errors.push('population.targetCount must be 33')
    validateSource(population.source, 'population.source', errors)
  }
  if (!Array.isArray(value.entries)) return [...errors, 'entries must be an array']
  if (value.entries.length !== 33) errors.push(`expected 33 entries, received ${value.entries.length}`)

  const ids = new Set<string>()
  value.entries.forEach((rawEntry, index) => {
    const path = `entries[${index}]`
    if (!isRecord(rawEntry)) {
      errors.push(`${path} must be an object`)
      return
    }
    if (!isNonEmptyString(rawEntry.id)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawEntry.id)) {
      errors.push(`${path}.id must be a kebab-case id`)
    } else if (ids.has(rawEntry.id)) {
      errors.push(`duplicate entry id: ${rawEntry.id}`)
    } else {
      ids.add(rawEntry.id)
    }

    const applicability = isRecord(rawEntry.applicability) ? rawEntry.applicability : null
    if (applicability === null || applicability.melee !== true
      || typeof applicability.ranged !== 'boolean'
      || typeof applicability.armor !== 'boolean') {
      errors.push(`${path}.applicability must explicitly include melee=true and boolean targets`)
    }
    if (!['common', 'powerful'].includes(String(rawEntry.rarity))) {
      errors.push(`${path}.rarity is not allowed`)
    }

    const obtainable = isRecord(rawEntry.obtainable) ? rawEntry.obtainable : null
    if (obtainable === null || obtainable.normalSlot !== true || obtainable.gilded !== true
      || typeof obtainable.builtInUnique !== 'boolean') {
      errors.push(`${path}.obtainable must describe normal, gilded, and unique availability`)
    } else if (obtainable.builtInUnique === true && obtainable.builtInTier !== 1) {
      errors.push(`${path}.obtainable.builtInTier must be 1 for a unique built-in`)
    } else if (obtainable.builtInUnique === false && obtainable.builtInTier !== undefined) {
      errors.push(`${path}.obtainable.builtInTier requires builtInUnique=true`)
    }

    const tiers = isRecord(rawEntry.tierValues) ? rawEntry.tierValues : null
    if (tiers === null) {
      errors.push(`${path}.tierValues must be an object`)
    } else {
      for (const tier of ['1', '2', '3'] as const) {
        const tierValue = isRecord(tiers[tier]) ? tiers[tier] : null
        if (tierValue === null || !isNonEmptyString(tierValue.raw)) {
          errors.push(`${path}.tierValues.${tier}.raw is required`)
        }
      }
    }

    const stacking = isRecord(rawEntry.stacking) ? rawEntry.stacking : null
    if (stacking === null
      || !MELEE_ENCHANTMENT_STACKING_BEHAVIORS.includes(
        stacking.behavior as MeleeEnchantmentStackingBehavior,
      )) {
      errors.push(`${path}.stacking.behavior is not allowed`)
    } else if (stacking.behavior !== 'unknown'
      && (!Number.isInteger(stacking.maxCopies) || (stacking.maxCopies as number) < 1)) {
      errors.push(`${path}.stacking.maxCopies must be a positive integer`)
    }
    if (!MELEE_ENCHANTMENT_TRIGGERS.includes(rawEntry.trigger as MeleeEnchantmentTrigger)) {
      errors.push(`${path}.trigger is not allowed`)
    }
    if (!isNonEmptyString(rawEntry.modelCategory)) {
      errors.push(`${path}.modelCategory is required`)
    }
    if (!MELEE_ENCHANTMENT_RUNTIME_STATUSES.includes(
      rawEntry.runtimeStatus as MeleeEnchantmentRuntimeStatus,
    )) {
      errors.push(`${path}.runtimeStatus is not allowed`)
    }
    if (!Array.isArray(rawEntry.sources) || rawEntry.sources.length === 0) {
      errors.push(`${path}.sources must contain at least one source`)
    } else {
      rawEntry.sources.forEach((source, sourceIndex) =>
        validateSource(source, `${path}.sources[${sourceIndex}]`, errors))
      const tierSource = rawEntry.sources.some((source) =>
        isRecord(source) && Array.isArray(source.supports)
        && source.supports.includes('tier-values'))
      if (!tierSource) errors.push(`${path} has tier values without a numeric source`)
    }
  })

  const expectedIds = [...EXPECTED_MELEE_ENCHANTMENT_IDS].sort()
  const auditedIds = [...ids].sort()
  if (JSON.stringify(auditedIds) !== JSON.stringify(expectedIds)) {
    errors.push(
      `audited population ids (${auditedIds.join(', ')}) do not match 1.17.0.0 source population (${expectedIds.join(', ')})`,
    )
  }

  const implementedIds = value.entries
    .filter((entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.runtimeStatus === 'implemented')
    .map((entry) => entry.id)
    .filter(isNonEmptyString)
    .sort()
  const runtimeIds = [...runtimeEnchantmentIds].sort()
  if (JSON.stringify(implementedIds) !== JSON.stringify(runtimeIds)) {
    errors.push(
      `implemented audit ids (${implementedIds.join(', ')}) do not match runtime catalog (${runtimeIds.join(', ')})`,
    )
  }
  const unsupportedRuntimeIds = value.entries
    .filter((entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.runtimeStatus !== 'implemented'
        && isNonEmptyString(entry.id) && runtimeEnchantmentIds.includes(entry.id))
    .map((entry) => String(entry.id))
  if (unsupportedRuntimeIds.length > 0) {
    errors.push(`unsupported enchantments are runtime-enabled: ${unsupportedRuntimeIds.join(', ')}`)
  }
  return errors
}

export function summarizeMeleeEnchantmentAudit(
  audit: MeleeEnchantmentAudit,
): MeleeEnchantmentAuditSummary {
  const counts = Object.fromEntries(MELEE_ENCHANTMENT_RUNTIME_STATUSES.map((status) => [
    status,
    audit.entries.filter((entry) => entry.runtimeStatus === status).length,
  ])) as Record<MeleeEnchantmentRuntimeStatus, number>
  return {
    total: audit.entries.length,
    counts,
    implementedNames: audit.entries
      .filter((entry) => entry.runtimeStatus === 'implemented')
      .map((entry) => entry.name.en),
    unsupportedNames: audit.entries
      .filter((entry) => entry.runtimeStatus !== 'implemented')
      .map((entry) => entry.name.en),
  }
}
