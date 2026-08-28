export const ATTACK_PROFILE_AUDIT_STATUSES = [
  'exact',
  'verified-shared',
  'partial',
  'inferred',
  'missing',
] as const

export type AttackProfileAuditStatus = (typeof ATTACK_PROFILE_AUDIT_STATUSES)[number]
export type ResearchStatus = 'available' | 'partial' | 'missing' | 'not-needed'
export type ResearchConfidence = 'high' | 'medium' | 'low'

export interface AuditSourceReference {
  readonly type: 'game-files' | 'minecraft-wiki' | 'community-test' | 'inference'
  readonly url: string
  readonly retrievedAt: string
  readonly checkedContext: string
  readonly confidence: ResearchConfidence
  readonly note: string
}

export interface RawTimingRow {
  readonly hitRange: string
  readonly durationSeconds: number
}

export interface RawDamageRow {
  readonly hitRange: string
  readonly baseDamage: number
}

export interface AuditedAttackProfile {
  readonly comboHits: number | null
  readonly hitDurationsSeconds: readonly number[] | null
  readonly rawTimingRows: readonly RawTimingRow[]
  readonly comboDurationSeconds: number | null
  readonly hitsPerSecond: number | null
  readonly comboFinisherHit: number | null
  readonly calculationMethod: 'sum-hit-durations' | 'not-derived'
}

export interface AuditedDamageProfile {
  readonly hitDamageRatios: readonly number[] | null
  readonly rawBaseDamageRows: readonly RawDamageRow[]
}

export type AttackSpeedScaling =
  | { readonly status: 'unknown' }
  | {
      readonly status: 'verified'
      readonly method: 'multiplicative' | 'special'
      readonly sourceUrl: string
      readonly note: string
    }

export interface MeleeWeaponAuditEntry {
  readonly weaponId: string
  readonly name: {
    readonly en: string
    readonly ja?: string
  }
  readonly family: string
  readonly variantOf?: string
  readonly status: AttackProfileAuditStatus
  readonly confidence: ResearchConfidence
  readonly attackProfile: AuditedAttackProfile | null
  readonly damageProfile: AuditedDamageProfile
  readonly attackSpeedScaling: AttackSpeedScaling
  readonly voidStrikeDataStatus: ResearchStatus
  readonly sharedAttackProfileFrom?: string
  readonly specialHandlingRequired: boolean
  readonly specialHandlingNotes: string
  readonly sources: readonly AuditSourceReference[]
  readonly notes: string
}

export interface MeleeAttackProfileAudit {
  readonly schemaVersion: 1
  readonly gameVersion: string
  readonly auditedAt: string
  readonly population: {
    readonly obtainableMeleeWeapons: number
    readonly knownMeleeWeapons: number
    readonly excludedKnownWeapons: readonly string[]
    readonly sources: readonly AuditSourceReference[]
  }
  readonly statusDefinitions: Readonly<Record<AttackProfileAuditStatus, string>>
  readonly weapons: readonly MeleeWeaponAuditEntry[]
}

export interface MeleeAuditSummary {
  readonly total: number
  readonly counts: Readonly<Record<AttackProfileAuditStatus, number>>
  readonly strictRuntimeReady: number
  readonly relaxedRuntimeReady: number
  readonly directDurationData: number
  readonly comboOnly: number
  readonly sharedProfiles: number
  readonly noPublicProfileData: number
  readonly partial: readonly MeleeWeaponAuditEntry[]
  readonly missing: readonly MeleeWeaponAuditEntry[]
  readonly specialHandling: readonly MeleeWeaponAuditEntry[]
  readonly lowConfidence: readonly MeleeWeaponAuditEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const hasCompleteProfile = (entry: MeleeWeaponAuditEntry): boolean => {
  const profile = entry.attackProfile
  return profile !== null
    && Number.isInteger(profile.comboHits)
    && (profile.comboHits ?? 0) > 0
    && profile.hitDurationsSeconds !== null
    && profile.hitDurationsSeconds.length === profile.comboHits
    && profile.hitDurationsSeconds.every(isPositiveNumber)
    && isPositiveNumber(profile.comboDurationSeconds)
    && isPositiveNumber(profile.hitsPerSecond)
}

const hasHttpUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const approximatelyEqual = (left: number, right: number): boolean =>
  Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-9)

const isCompleteRawProfile = (profile: Record<string, unknown>): boolean => {
  const comboHits = profile.comboHits
  const durations = profile.hitDurationsSeconds
  return Number.isInteger(comboHits)
    && (comboHits as number) > 0
    && Array.isArray(durations)
    && durations.length === comboHits
    && durations.every(isPositiveNumber)
    && isPositiveNumber(profile.comboDurationSeconds)
    && isPositiveNumber(profile.hitsPerSecond)
    && Number.isInteger(profile.comboFinisherHit)
    && (profile.comboFinisherHit as number) > 0
    && (profile.comboFinisherHit as number) <= (comboHits as number)
    && profile.calculationMethod === 'sum-hit-durations'
}

const validateSource = (
  rawSource: unknown,
  sourcePath: string,
  errors: string[],
): void => {
  if (!isRecord(rawSource)) {
    errors.push(`${sourcePath} must be an object`)
    return
  }
  if (!['game-files', 'minecraft-wiki', 'community-test', 'inference'].includes(String(rawSource.type))) {
    errors.push(`${sourcePath}.type is not allowed`)
  }
  if (!hasHttpUrl(rawSource.url)) errors.push(`${sourcePath}.url must be an HTTP(S) URL`)
  if (typeof rawSource.retrievedAt !== 'string' || rawSource.retrievedAt.length === 0) {
    errors.push(`${sourcePath}.retrievedAt is required`)
  }
  if (typeof rawSource.checkedContext !== 'string' || rawSource.checkedContext.length === 0) {
    errors.push(`${sourcePath}.checkedContext is required`)
  }
  if (!['high', 'medium', 'low'].includes(String(rawSource.confidence))) {
    errors.push(`${sourcePath}.confidence is not allowed`)
  }
  if (typeof rawSource.note !== 'string') errors.push(`${sourcePath}.note is required`)
}

export const collectMeleeAuditErrors = (input: unknown): readonly string[] => {
  const errors: string[] = []
  if (!isRecord(input)) return ['audit root must be an object']
  if (!Array.isArray(input.weapons)) return ['weapons must be an array']

  const population = isRecord(input.population) ? input.population : null
  if (population === null) {
    errors.push('population must be an object')
  } else if (!Number.isInteger(population.obtainableMeleeWeapons)
    || (population.obtainableMeleeWeapons as number) <= 0) {
    errors.push('population.obtainableMeleeWeapons must be a positive integer')
  } else if (population.obtainableMeleeWeapons !== input.weapons.length) {
    errors.push(`population count ${population.obtainableMeleeWeapons} does not match ${input.weapons.length} weapons`)
  }
  if (population !== null) {
    if (!Array.isArray(population.sources) || population.sources.length === 0) {
      errors.push('population.sources must contain at least one source')
    } else {
      population.sources.forEach((source, index) =>
        validateSource(source, `population.sources[${index}]`, errors))
    }
  }

  const entriesById = new Map<string, Record<string, unknown>>()
  input.weapons.forEach((rawEntry, index) => {
    const path = `weapons[${index}]`
    if (!isRecord(rawEntry)) {
      errors.push(`${path} must be an object`)
      return
    }

    const weaponId = rawEntry.weaponId
    if (typeof weaponId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(weaponId)) {
      errors.push(`${path}.weaponId must be a kebab-case id`)
    } else if (entriesById.has(weaponId)) {
      errors.push(`duplicate weaponId: ${weaponId}`)
    } else {
      entriesById.set(weaponId, rawEntry)
    }

    if (!ATTACK_PROFILE_AUDIT_STATUSES.includes(rawEntry.status as AttackProfileAuditStatus)) {
      errors.push(`${path}.status is not allowed`)
    }

    if (!Array.isArray(rawEntry.sources) || rawEntry.sources.length === 0) {
      errors.push(`${path}.sources must contain at least one source`)
    } else {
      rawEntry.sources.forEach((source, sourceIndex) =>
        validateSource(source, `${path}.sources[${sourceIndex}]`, errors))
    }

    const profile = rawEntry.attackProfile
    if (profile !== null && !isRecord(profile)) {
      errors.push(`${path}.attackProfile must be an object or null`)
      return
    }
    if (rawEntry.status === 'exact' && profile === null) {
      errors.push(`${path} is exact but has no attackProfile`)
      return
    }
    if ((rawEntry.status === 'exact' || rawEntry.status === 'verified-shared')
      && profile !== null && !isCompleteRawProfile(profile)) {
      errors.push(`${path} is ${rawEntry.status} but does not have a complete fixed attackProfile`)
    }
    if (rawEntry.status === 'missing' && profile !== null) {
      errors.push(`${path} is missing but attackProfile is not null`)
    }

    if (profile !== null) {
      const comboHits = profile.comboHits
      const durations = profile.hitDurationsSeconds
      if (comboHits !== null && (!Number.isInteger(comboHits) || (comboHits as number) <= 0)) {
        errors.push(`${path}.attackProfile.comboHits must be positive or null`)
      }
      if (durations !== null && !Array.isArray(durations)) {
        errors.push(`${path}.attackProfile.hitDurationsSeconds must be an array or null`)
      } else if (Array.isArray(durations)) {
        if (durations.some((duration) => !isPositiveNumber(duration))) {
          errors.push(`${path}.attackProfile.hitDurationsSeconds must contain only positive values`)
        }
        if (typeof comboHits === 'number' && durations.length !== comboHits) {
          errors.push(`${path} has ${durations.length} durations for ${comboHits} combo hits`)
        }
      }

      for (const field of ['comboDurationSeconds', 'hitsPerSecond'] as const) {
        const value = profile[field]
        if (value !== null && !isPositiveNumber(value)) {
          errors.push(`${path}.attackProfile.${field} must be positive or null`)
        }
      }

      if (Array.isArray(durations) && durations.every(isPositiveNumber)
        && typeof comboHits === 'number' && comboHits > 0) {
        const duration = durations.reduce((sum, value) => sum + value, 0)
        const hitsPerSecond = comboHits / duration
        if (!isPositiveNumber(profile.comboDurationSeconds)
          || !approximatelyEqual(profile.comboDurationSeconds, duration)) {
          errors.push(`${path}.attackProfile.comboDurationSeconds is not derived from hit durations`)
        }
        if (!isPositiveNumber(profile.hitsPerSecond)
          || !approximatelyEqual(profile.hitsPerSecond, hitsPerSecond)) {
          errors.push(`${path}.attackProfile.hitsPerSecond is not derived from hit durations`)
        }
      }

      if (!Array.isArray(profile.rawTimingRows)) {
        errors.push(`${path}.attackProfile.rawTimingRows must be an array`)
      } else {
        profile.rawTimingRows.forEach((row, rowIndex) => {
          if (!isRecord(row) || typeof row.hitRange !== 'string' || !isPositiveNumber(row.durationSeconds)) {
            errors.push(`${path}.attackProfile.rawTimingRows[${rowIndex}] is invalid`)
          }
        })
      }
    }
  })

  input.weapons.forEach((rawEntry, index) => {
    if (!isRecord(rawEntry) || rawEntry.status !== 'verified-shared') return
    const sharedFrom = rawEntry.sharedAttackProfileFrom
    if (typeof sharedFrom !== 'string' || sharedFrom.length === 0) {
      errors.push(`weapons[${index}] is verified-shared but sharedAttackProfileFrom is missing`)
    } else if (!entriesById.has(sharedFrom)) {
      errors.push(`weapons[${index}] sharedAttackProfileFrom does not exist: ${sharedFrom}`)
    }
    if (!Array.isArray(rawEntry.sources) || rawEntry.sources.length === 0) {
      errors.push(`weapons[${index}] is verified-shared but has no source`)
    }
  })

  input.weapons.forEach((rawEntry, index) => {
    if (!isRecord(rawEntry) || typeof rawEntry.variantOf !== 'string') return
    if (rawEntry.variantOf === rawEntry.weaponId) {
      errors.push(`weapons[${index}].variantOf cannot reference itself`)
    } else if (!entriesById.has(rawEntry.variantOf)) {
      errors.push(`weapons[${index}].variantOf does not exist: ${rawEntry.variantOf}`)
    }
  })

  return errors
}

export const summarizeMeleeAudit = (audit: MeleeAttackProfileAudit): MeleeAuditSummary => {
  const counts = Object.fromEntries(
    ATTACK_PROFILE_AUDIT_STATUSES.map((status) => [
      status,
      audit.weapons.filter((entry) => entry.status === status).length,
    ]),
  ) as Record<AttackProfileAuditStatus, number>

  const strictRuntimeReady = audit.weapons.filter((entry) =>
    (entry.status === 'exact' || entry.status === 'verified-shared')
    && entry.sources.length > 0
    && hasCompleteProfile(entry)).length
  const relaxedRuntimeReady = audit.weapons.filter((entry) =>
    (entry.status === 'exact' || entry.status === 'verified-shared' || entry.status === 'inferred')
    && entry.sources.length > 0
    && hasCompleteProfile(entry)).length

  return {
    total: audit.weapons.length,
    counts,
    strictRuntimeReady,
    relaxedRuntimeReady,
    directDurationData: audit.weapons.filter((entry) =>
      (entry.attackProfile?.rawTimingRows.length ?? 0) > 0).length,
    comboOnly: audit.weapons.filter((entry) =>
      (entry.attackProfile?.comboHits ?? null) !== null
      && entry.attackProfile?.rawTimingRows.length === 0).length,
    sharedProfiles: counts['verified-shared'],
    noPublicProfileData: audit.weapons.filter((entry) => entry.attackProfile === null).length,
    partial: audit.weapons.filter((entry) => entry.status === 'partial'),
    missing: audit.weapons.filter((entry) => entry.status === 'missing'),
    specialHandling: audit.weapons.filter((entry) => entry.specialHandlingRequired),
    lowConfidence: audit.weapons.filter((entry) => entry.confidence === 'low'),
  }
}
