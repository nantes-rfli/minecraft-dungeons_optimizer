import meleeWeapons from '../../research/melee-attack-profile-audit.json'
import meleeEnchantments from '../../research/melee-enchantment-audit.json'
import armors from '../../research/armor-audit.json'
import armorEnchantments from '../../research/armor-enchantment-audit.json'
import armorCore from '../../research/armor-core-runtime-audit.json'
import rangedWeapons from '../../research/ranged-weapon-audit.json'
import rangedEnchantments from '../../research/ranged-enchantment-audit.json'
import artifacts from '../../research/artifact-audit.json'
import artifactEvidenceSources from '../../research/artifact-evidence/sources.json'
import dpsRegression from '../../research/dps-regression-audit.json'
import voidStrike from '../../research/void-strike-audit.json'
import externalSnapshot from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json'
import { buildCoverageAdapters } from './evidenceCoverage/adapters'
import type { JsonValue } from './evidenceCoverage/model'

export const HARVEST_CATEGORIES = ['melee-weapon', 'melee-enchantment', 'armor', 'armor-enchantment', 'ranged-weapon', 'ranged-enchantment', 'artifact'] as const
export type HarvestCategory = typeof HARVEST_CATEGORIES[number]
export type HarvestConfidence = 'verified' | 'high' | 'medium' | 'low' | 'unknown'
export type HarvestStatus = 'accepted' | 'conflicting' | 'stale' | 'unknown'
export type SourceVersionStatus = 'exact-current' | 'claimed-current' | 'historical' | 'unknown'
export type UnknownKind = 'source-missing' | 'version-unknown' | 'conflicting-public-sources' | 'requires-game-observation' | 'likely-requires-experiment' | 'implementation-related' | 'objective-related'
export type SourceType = 'game-file' | 'official' | 'wiki' | 'quantitative-test' | 'community' | 'project-internal' | 'secondary-database' | 'unknown'
export type SourceAttemptResult = 'value-found' | 'not-found' | 'ambiguous' | 'conflicting' | 'version-mismatch' | 'unavailable'

export interface PropertySourceAttempt {
  readonly sourceId: string
  readonly result: SourceAttemptResult
  readonly note?: string
}

export interface SourceRecord {
  readonly id: string
  readonly sourceType: SourceType
  readonly title: string
  readonly url?: string
  readonly gameVersion: string
  readonly versionStatus: SourceVersionStatus
  readonly retrievedAt: string
  readonly notes?: string
}

export interface HarvestedFact {
  readonly property: string
  readonly value: JsonValue
  readonly sourceIds: readonly string[]
  readonly targetGameVersion: '1.17.0.0'
  readonly applicableGameVersion?: string
  readonly versionStatus: SourceVersionStatus
  readonly sourceAttempts: readonly PropertySourceAttempt[]
  readonly confidence: HarvestConfidence
  readonly status: HarvestStatus
  readonly notes?: string
}

export interface HarvestConflict {
  readonly property: string
  readonly values: readonly { readonly sourceId: string; readonly value: JsonValue; readonly gameVersion?: string }[]
  readonly probableReason: string
  readonly resolutionStatus: 'pending' | 'preferred-source-retained' | 'version-boundary-resolved'
}

export interface HarvestRecord {
  readonly category: HarvestCategory
  readonly id: string
  readonly label: string
  readonly runtimeSupport: string
  readonly known: readonly HarvestedFact[]
  readonly unknown: readonly { readonly property: string; readonly kind: UnknownKind; readonly notes: string; readonly sourceAttempts: readonly PropertySourceAttempt[] }[]
  readonly conflicts: readonly HarvestConflict[]
  readonly sourceIds: readonly string[]
  readonly version: { readonly target: '1.17.0.0'; readonly currentVersionVerified: boolean; readonly staleRisk: boolean; readonly notes: string }
}

export interface GapCandidate {
  readonly entity: string
  readonly property: string
  readonly currentKnownState: 'unknown' | 'conflicting' | 'stale'
  readonly sourceAttempts: readonly PropertySourceAttempt[]
  readonly sourceConflict: boolean
  readonly versionIssue: boolean
  readonly likelyAcquisitionType: UnknownKind
  readonly runtimeRelevance: 'high' | 'medium' | 'low'
  readonly notes: string
}

const SOURCE_DATE = '2026-09-06'
const TARGET_VERSION = '1.17.0.0' as const
const json = (value: unknown): JsonValue => value as JsonValue
const nonNull = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]
const clean = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function sourceVersionStatus(value: string): SourceVersionStatus {
  const normalized = value.toLowerCase()
  if (value === TARGET_VERSION) return 'exact-current'
  if (normalized.includes('unknown') || normalized.includes('unverified') || normalized.includes('unspecified') || normalized.includes('unstated') || normalized.includes('unresolved') || normalized.includes('repository commit')) return 'unknown'
  if (normalized.includes('current') || normalized.includes('claimed')) return 'claimed-current'
  if (/\d+\.\d+(?:\.\d+){0,2}/.test(value) || normalized.includes('historical') || normalized.includes('pre-') || normalized.includes('launch-era')) return 'historical'
  return 'unknown'
}

const sourceRecords = new Map<string, SourceRecord>()
function sourceType(raw: string): SourceRecord['sourceType'] {
  const value = raw.toLowerCase()
  if (value.includes('official')) return 'official'
  if (value.includes('wiki')) return 'wiki'
  if (value.includes('test') || value.includes('observation') || value.includes('regression')) return 'quantitative-test'
  if (value.includes('community') || value.includes('reddit')) return 'community'
  if (value.includes('dungeons.tools') || value.includes('game-file') || value.includes('game file') || value.includes('datamine') || value.includes('extracted game') || value.includes('frozen game')) return 'game-file'
  if (value.includes('github.com/nantes-rfli/minecraft-dungeons_optimizer') || value.includes('project') || value.includes('runtime') || value.includes('generated report') || value.includes('repository')) return 'project-internal'
  if (value.includes('database')) return 'secondary-database'
  return 'unknown'
}
function addSource(namespace: string, input: { id?: string; type?: string; sourceType?: string; kind?: string; title?: string; label?: string; url?: string; accessedAt?: string; retrievedAt?: string; gameVersion?: string; version?: string; versionTag?: string; confidence?: string; note?: string; facts?: readonly string[] }): string {
  const local = input.id ?? clean(input.url ?? input.title ?? input.label ?? 'source')
  const id = `${namespace}:${local}`
  const gameVersion = input.gameVersion ?? input.version ?? input.versionTag ?? 'unspecified'
  if (!sourceRecords.has(id)) sourceRecords.set(id, {
    id,
    sourceType: sourceType([input.type, input.sourceType, input.kind, input.url].filter(Boolean).join(' ')),
    title: input.title ?? input.label ?? input.url ?? local,
    ...(input.url ? { url: input.url } : {}),
    gameVersion,
    versionStatus: sourceVersionStatus(gameVersion),
    retrievedAt: input.accessedAt ?? input.retrievedAt ?? SOURCE_DATE,
    notes: [input.note, input.confidence ? `Source confidence: ${input.confidence}.` : undefined, input.facts?.join(' ')].filter(Boolean).join(' '),
  })
  return id
}

const officialFinalUpdate = addSource('official', {
  id: 'minecraft-dungeons-final-update', type: 'official', title: 'Minecraft Dungeons: 25 million players and counting',
  url: 'https://www.minecraft.net/en-us/article/dungeons--25-million-players', accessedAt: SOURCE_DATE, gameVersion: TARGET_VERSION,
  note: 'Mojang states that 1.17 was the final Minecraft Dungeons update. This establishes the current version boundary, not item mechanics.',
})
const officialPatchNotes = addSource('official', {
  id: 'minecraft-dungeons-1-17-patch-notes', type: 'official', title: 'Minecraft Dungeons 1.17.0.0 Patch Notes',
  url: 'https://store.steampowered.com/news/app/1672970/view/3508896037512998276', accessedAt: SOURCE_DATE, gameVersion: TARGET_VERSION,
  note: 'Official Minecraft Dungeons announcement on its Steam distribution channel. It establishes the 1.17.0.0 item and enchantment fixes, but does not supply a complete mechanics database.',
})
const officialVersionSources = [officialPatchNotes, officialFinalUpdate]

function sourcesFor(namespace: string, sources: readonly Record<string, unknown>[]): Map<string, string> {
  return new Map(sources.map((source) => {
    const rawId = String(source.id ?? clean(String(source.url ?? source.title ?? 'source')))
    return [rawId, addSource(namespace, source as Parameters<typeof addSource>[1])]
  }))
}

const armorSourceIds = sourcesFor('armor', armors.sources)
const armorEnchantSourceIds = sourcesFor('armor-enchantment', armorEnchantments.sources)
const armorCoreSourceIds = sourcesFor('armor-core', armorCore.sources)
const rangedWeaponSourceIds = sourcesFor('ranged-weapon', rangedWeapons.sources)
const rangedEnchantSourceIds = sourcesFor('ranged-enchantment', rangedEnchantments.sources)
const artifactSourceIds = sourcesFor('artifact', artifacts.sources)
for (const source of artifactEvidenceSources.sources) addSource('artifact-public-research', source)
const quantitativeDpsByWeapon = new Map<string, string[]>()
for (const entry of dpsRegression.entries) {
  const value = entry as typeof entry & { source?: { label?: string; url?: string } }
  if (value.source?.url) {
    const sourceId = addSource('quantitative-dps', { id: value.id, type: 'quantitative-test', title: value.source.label ?? value.id, url: value.source.url, accessedAt: String(dpsRegression.auditedAt ?? SOURCE_DATE), gameVersion: value.gameVersion ?? undefined, note: `Regression eligibility: ${value.eligibleForRegression ? 'eligible' : 'rejected'}; retained as an attempted public source.` })
    quantitativeDpsByWeapon.set(value.weaponId, [...(quantitativeDpsByWeapon.get(value.weaponId) ?? []), sourceId])
  }
}
const voidStrikeSourceIds = voidStrike.sources.map((source) => addSource('quantitative-void-strike', source))
const externalSourceIds = new Map(externalSnapshot.sources.map((source) => [source.id, addSource('external', source)]))

function embeddedSources(namespace: string, sources: readonly { type?: string; url: string; retrievedAt?: string; checkedContext?: string; confidence?: string; note?: string }[]): string[] {
  return unique(sources.map((source) => addSource(namespace, { ...source, title: source.checkedContext ?? source.url })))
}

function factVersion(sourceIds: readonly string[]): Pick<HarvestedFact, 'targetGameVersion' | 'applicableGameVersion' | 'versionStatus'> {
  const statuses = unique(sourceIds.map((id) => sourceRecords.get(id)?.versionStatus ?? 'unknown'))
  const versions = unique(sourceIds.map((id) => sourceRecords.get(id)?.gameVersion).filter(nonNull))
  const [onlyStatus] = statuses
  const versionStatus: SourceVersionStatus = statuses.length === 1 && onlyStatus
    ? onlyStatus
    : statuses.every((status) => status === 'exact-current' || status === 'claimed-current') ? 'claimed-current' : 'unknown'
  const applicableGameVersion = versionStatus === 'exact-current' || versionStatus === 'claimed-current'
    ? versions.find((value) => value.includes(TARGET_VERSION))
    : undefined
  return { targetGameVersion: TARGET_VERSION, ...(applicableGameVersion ? { applicableGameVersion } : {}), versionStatus }
}
const fact = (property: string, value: unknown, sourceIds: readonly string[], confidence: HarvestConfidence, status: HarvestStatus = 'accepted', notes?: string): HarvestedFact => {
  const ids = unique(sourceIds)
  return { property, value: json(value), sourceIds: ids, ...factVersion(ids), sourceAttempts: ids.map((sourceId) => ({ sourceId, result: status === 'conflicting' ? 'conflicting' : 'value-found' })), confidence, status, ...(notes ? { notes } : {}) }
}
const unknown = (property: string, kind: UnknownKind, notes: string, sourceAttempts: readonly PropertySourceAttempt[] = []) => ({ property, kind, notes, sourceAttempts })
const version = (currentVersionVerified: boolean, staleRisk: boolean, notes: string) => ({ target: TARGET_VERSION, currentVersionVerified, staleRisk, notes })

const runtimeByCategory = new Map(buildCoverageAdapters().flatMap((adapter) => adapter.records.map((record) => [`${adapter.category}:${record.id}`, record.runtimeSupport])))
const runtime = (category: HarvestCategory, id: string): string => {
  const coverageCategory = category === 'melee-weapon' ? 'melee-attack-profile' : category
  return runtimeByCategory.get(`${coverageCategory}:${id}`) ?? 'unknown'
}

function meleeWeaponRecords(): HarvestRecord[] {
  return meleeWeapons.weapons.map((entry) => {
    const factSourceIds = embeddedSources('melee-weapon', entry.sources)
    const sourceIds = unique([...factSourceIds, ...officialVersionSources, ...(quantitativeDpsByWeapon.get(entry.weaponId) ?? [])])
    const known = [
      fact('identity', { canonicalId: entry.weaponId, names: entry.name }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('family', entry.family, factSourceIds, entry.confidence as HarvestConfidence),
      fact('combo', { hits: entry.attackProfile.comboHits, finisherHit: entry.attackProfile.comboFinisherHit }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('timing', { hitDurationsSeconds: entry.attackProfile.hitDurationsSeconds, comboDurationSeconds: entry.attackProfile.comboDurationSeconds, hitsPerSecond: entry.attackProfile.hitsPerSecond }, factSourceIds, entry.confidence as HarvestConfidence, entry.status === 'exact' || entry.status === 'verified-shared' ? 'accepted' : 'stale', entry.status),
      fact('hitDamageRatios', entry.damageProfile.hitDamageRatios, factSourceIds, entry.confidence as HarvestConfidence),
    ]
    const gaps = [entry.attackSpeedScaling.status === 'unknown' ? unknown('attackSpeedScaling', 'requires-game-observation', 'Attack-speed scaling is not exposed by the public timing table.') : null,
      unknown('baseUniqueRelation', 'source-missing', 'The melee timing audit groups families but does not encode a verified base/unique ownership edge.'),
      unknown('intrinsicMechanicOwnership', 'source-missing', 'Built-in and unique effect ownership remains in equipment-specific audits.'),
      unknown('powerScaling', 'likely-requires-experiment', 'Relative hit ratios do not establish the absolute 1.17.0.0 Power curve.'),
    ].filter(nonNull)
    return { category: 'melee-weapon', id: entry.weaponId, label: entry.name.ja ?? entry.name.en, runtimeSupport: runtime('melee-weapon', entry.weaponId), known, unknown: gaps, conflicts: [], sourceIds, version: version(false, entry.status !== 'exact' && entry.status !== 'verified-shared', 'Population is tied to 1.17.0.0; per-hit Wiki tables do not expose a versioned game-file citation.') }
  })
}

function meleeEnchantmentRecords(): HarvestRecord[] {
  return meleeEnchantments.entries.map((entry) => {
    const factSourceIds = unique([...embeddedSources('melee-enchantment', entry.sources), ...(entry.id === 'void-strike' ? voidStrikeSourceIds : [])])
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const tierText = JSON.stringify(entry.tierValues).toLowerCase()
    const known = [
      fact('identity', { canonicalId: entry.id, names: entry.name }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('availability', { applicability: entry.applicability, rarity: entry.rarity, obtainable: entry.obtainable }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('tiers', entry.tierValues, factSourceIds, entry.confidence as HarvestConfidence),
      fact('trigger', entry.trigger, factSourceIds, entry.confidence as HarvestConfidence),
      fact('stacking', entry.stacking, factSourceIds, entry.confidence as HarvestConfidence),
      fact('maxCopies', entry.stacking.maxCopies, factSourceIds, entry.confidence as HarvestConfidence),
      fact('damageChannel', entry.modelCategory, factSourceIds, entry.confidence as HarvestConfidence),
    ]
    if (tierText.includes('chance')) known.push(fact('procChance', entry.tierValues, factSourceIds, entry.confidence as HarvestConfidence))
    if (tierText.includes('duration')) known.push(fact('duration', entry.tierValues, factSourceIds, entry.confidence as HarvestConfidence))
    if (tierText.includes('cooldown')) known.push(fact('cooldown', entry.tierValues, factSourceIds, entry.confidence as HarvestConfidence))
    const gaps = [entry.runtimeStatus === 'implemented' ? null : unknown('runtimeInteraction', 'implementation-related', entry.notes ?? 'Mechanic is audited but not runtime-ready.'),
      tierText.includes('chance') ? null : unknown('procChance', 'source-missing', 'No independent numeric proc chance is encoded for this mechanic.'),
      tierText.includes('duration') ? null : unknown('duration', 'source-missing', 'No independent numeric duration is encoded for this mechanic.'),
      tierText.includes('cooldown') ? null : unknown('cooldown', 'source-missing', 'No independent numeric cooldown is encoded for this mechanic.'),
      unknown('powerDependence', 'source-missing', 'Tier metadata alone does not establish whether absolute output follows a Power curve.'),
      unknown('versionHistory', 'version-unknown', 'Source notes may mention history, but no normalized per-enchantment version timeline is accepted here.'),
      unknown('currentVersionGameplayVerification', 'requires-game-observation', 'Game-file metadata does not prove trigger ownership and cross-effect interactions in play.'),
    ].filter(nonNull)
    return { category: 'melee-enchantment', id: entry.id, label: entry.name.ja ?? entry.name.en, runtimeSupport: runtime('melee-enchantment', entry.id), known, unknown: gaps, conflicts: [], sourceIds, version: version(true, false, 'Tier/applicability metadata is version-targeted; interaction claims retain their per-source confidence.') }
  })
}

function armorRecords(): HarvestRecord[] {
  return armors.entries.map((entry) => {
    const factSourceIds = unique(entry.sourceIds.map((id) => armorSourceIds.get(id)).filter(nonNull))
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name, levelId: entry.levelId }, factSourceIds, 'high'), fact('family', entry.family, factSourceIds, 'high'),
      fact('availability', { rarity: entry.rarity, obtainable: entry.obtainable, eventExclusive: entry.eventExclusive, contentPack: entry.contentPack }, factSourceIds, 'high'),
      fact('baseUniqueRelation', entry.inheritance, factSourceIds, 'high'), fact('intrinsicProperties', entry.intrinsicProperties, factSourceIds, 'high'),
      fact('builtInEnchantments', entry.builtInEnchantments, factSourceIds, 'high'), fact('soulProperty', entry.soulGear, factSourceIds, 'high')]
    const gaps = [unknown('healthPowerCurve', 'likely-requires-experiment', 'Observed card health remains required; published current endgame curve is unavailable.'),
      ...entry.blockers.map((note, index) => unknown(`runtimeBoundary.${index + 1}`, note.includes('objective') ? 'objective-related' : 'implementation-related', note))]
    return { category: 'armor', id: entry.id, label: entry.name, runtimeSupport: runtime('armor', entry.id), known, unknown: gaps, conflicts: [], sourceIds, version: version(true, false, 'Identity, family and intrinsic properties use the 1.17.0.0-derived index; health scaling is intentionally unverified.') }
  })
}

function armorEnchantmentRecords(): HarvestRecord[] {
  return armorEnchantments.entries.map((entry) => {
    const factSourceIds = unique(entry.sourceIds.map((id) => armorEnchantSourceIds.get(id) ?? armorCoreSourceIds.get(id)).filter(nonNull))
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const conflicts: HarvestConflict[] = entry.id === 'cool-down' ? [{ property: 'tiers.tier3', values: [
      { sourceId: armorCoreSourceIds.get('dungeons-tools-armor')!, value: 0.37, gameVersion: TARGET_VERSION },
      { sourceId: armorCoreSourceIds.get('wiki-cool-down')!, value: 0.38 },
    ], probableReason: 'The current Wiki display and version-targeted game-file-derived value differ.', resolutionStatus: 'preferred-source-retained' }] : []
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name }, factSourceIds, 'high'), fact('tiers', entry.tiers, factSourceIds, 'high'),
      fact('stacking', { stackable: entry.stackable, maxCopies: entry.maxCopies }, factSourceIds, 'high'), fact('availability', { builtIntoArmorIds: entry.builtIntoArmorIds, soulRestriction: entry.soulRestriction }, factSourceIds, 'high'), fact('effectChannel', entry.mechanicFamily, factSourceIds, 'medium')]
    const gaps = [
      unknown('trigger', 'source-missing', 'The category audit classifies the mechanic family but does not normalize its event trigger.'),
      unknown('duration', 'source-missing', 'Duration is not independently normalized in the category audit.'),
      unknown('cooldown', 'source-missing', 'Cooldown or periodic interval is not independently normalized in the category audit.'),
      unknown('procChance', 'source-missing', 'Proc probability is not independently normalized in the category audit.'),
      unknown('stateRequirement', 'requires-game-observation', 'State eligibility and target ownership require mechanic-specific evidence.'),
      unknown('powerDependence', 'source-missing', 'Tier labels do not establish an absolute Power curve.'),
      unknown('versionHistory', 'version-unknown', 'No normalized per-enchantment version timeline is accepted here.'),
      ...entry.blockers.map((note, index) => unknown(`runtimeMechanic.${index + 1}`, 'implementation-related', note)),
    ]
    return { category: 'armor-enchantment', id: entry.id, label: entry.name, runtimeSupport: runtime('armor-enchantment', entry.id), known,
      unknown: gaps, conflicts, sourceIds,
      version: version(true, conflicts.length > 0, conflicts.length ? 'A live-source display conflict is retained explicitly.' : 'Tier and availability metadata is tied to 1.17.0.0.') }
  })
}

function rangedWeaponRecords(): HarvestRecord[] {
  const properties = ['firingMode', 'projectileCount', 'chargeBehavior', 'chargeTimeSeconds', 'recoverySeconds', 'shotsPerSecond', 'burstCount', 'spread', 'multiHitPossibility', 'duplication', 'pierce', 'ricochet'] as const
  return rangedWeapons.entries.map((entry) => {
    const factSourceIds = unique(entry.sourceIds.map((id) => rangedWeaponSourceIds.get(id)).filter(nonNull))
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const known = [fact('identity', { canonicalId: entry.id, names: entry.name }, factSourceIds, entry.confidence as HarvestConfidence), fact('family', { family: entry.family, baseWeaponId: entry.baseWeaponId, variantOf: entry.variantOf }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('availability', { obtainable: entry.obtainable, rarity: entry.rarity, eventExclusive: entry.eventExclusive }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('baseUniqueRelation', { baseWeaponId: entry.baseWeaponId, variantOf: entry.variantOf }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('projectileFamily', { projectileFamily: entry.projectileFamily, multiProjectile: entry.multiProjectile }, factSourceIds, entry.confidence as HarvestConfidence),
      fact('intrinsic', entry.intrinsic, factSourceIds, entry.confidence as HarvestConfidence), fact('ammo', entry.ammo, factSourceIds, entry.confidence as HarvestConfidence), fact('soul', entry.soul, factSourceIds, entry.confidence as HarvestConfidence), fact('cardRatings', entry.rawRatings, factSourceIds, entry.confidence as HarvestConfidence)]
    for (const property of properties) if (entry[property] !== null) known.push(fact(property, entry[property], factSourceIds, entry.confidence as HarvestConfidence))
    const gaps = properties.filter((property) => entry[property] === null).map((property) => unknown(property, property.includes('Seconds') || property === 'shotsPerSecond' ? 'requires-game-observation' : 'source-missing', 'No accepted current value in the reconciled public sources.'))
    gaps.push(unknown('neutralProjectileDamageDistribution', 'likely-requires-experiment', 'Card damage does not establish per-projectile distribution.'), unknown('procOwnership', 'likely-requires-experiment', 'Per-shot, per-projectile and per-hit ownership is not inferred from metadata.'))
    return { category: 'ranged-weapon', id: entry.id, label: entry.name.ja ?? entry.name.en, runtimeSupport: runtime('ranged-weapon', entry.id), known, unknown: gaps, conflicts: [], sourceIds,
      version: version(false, false, 'The publisher claims 1.17.0.0 game-file extraction; independent gameplay verification is intentionally separate.') }
  })
}

function rangedEnchantmentRecords(): HarvestRecord[] {
  return rangedEnchantments.entries.map((entry) => {
    const primarySourceId = rangedEnchantSourceIds.get('primary-enchantments')
    const secondarySourceId = rangedEnchantSourceIds.get('secondary-enchantments')
    const conflictSourceIds = entry.conflict ? [primarySourceId, secondarySourceId].filter(nonNull) : []
    const factSourceIds = unique([...entry.sourceIds.map((id) => rangedEnchantSourceIds.get(id)).filter(nonNull), ...conflictSourceIds])
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const conflicts: HarvestConflict[] = entry.conflict && primarySourceId && secondarySourceId ? [{ property: 'publishedMechanic', values: [
      { sourceId: primarySourceId, value: entry.sourceIds.includes('primary-enchantments') ? entry.tierValues : 'not listed for ranged applicability' },
      { sourceId: secondarySourceId, value: entry.conflict },
    ], probableReason: 'Primary and secondary published descriptions disagree or use different channel semantics.', resolutionStatus: 'pending' }] : []
    const known = [fact('identity', { canonicalId: entry.id, names: entry.name }, factSourceIds, entry.confidence as HarvestConfidence), fact('rarity', entry.rarity, factSourceIds, entry.confidence as HarvestConfidence),
      fact('tiers', entry.tierValues, factSourceIds, entry.confidence as HarvestConfidence, entry.tierStatus.includes('not-independently') ? 'stale' : 'accepted', entry.tierStatus), fact('trigger', entry.triggerFamily, factSourceIds, entry.confidence as HarvestConfidence), fact('damageChannel', entry.damageChannel, factSourceIds, entry.confidence as HarvestConfidence)]
    if (entry.stackable !== null) known.push(fact('stacking', entry.stackable, factSourceIds, entry.confidence as HarvestConfidence))
    if (entry.maxCopies !== null) known.push(fact('maxCopies', entry.maxCopies, factSourceIds, entry.confidence as HarvestConfidence))
    const gaps = [entry.stackable === null ? unknown('stacking', 'source-missing', 'Stackability is not reconciled.') : null, entry.maxCopies === null ? unknown('maxCopies', 'source-missing', 'Maximum copies are not reconciled.') : null,
      unknown('triggerOwnership', 'likely-requires-experiment', 'Per-shot, per-projectile and per-hit ownership remains unresolved unless separately audited.'), unknown('ammoChargeInteractions', 'likely-requires-experiment', 'Ammo and charge interactions are not inferred from same-name melee behavior.')].filter(nonNull)
    return { category: 'ranged-enchantment', id: entry.id, label: entry.name.ja ?? entry.name.en, runtimeSupport: runtime('ranged-enchantment', entry.id), known, unknown: gaps, conflicts, sourceIds,
      version: version(false, conflicts.length > 0, '1.17.0.0 publisher claim is retained separately from independent gameplay verification.') }
  })
}

function artifactRecords(): HarvestRecord[] {
  const entries = [...artifacts.entries, ...artifacts.populationDifferences]
  return entries.map((entry) => {
    const ids = 'sourceIds' in entry ? entry.sourceIds : []
    const factSourceIds = unique(ids.map((id) => artifactSourceIds.get(id)).filter(nonNull))
    const sourceIds = unique([...factSourceIds, ...officialVersionSources])
    const value = entry as typeof artifacts.entries[number] & { cooldownSeconds?: number }
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name }, factSourceIds, 'medium'), fact('family', entry.mechanicFamily, factSourceIds, 'medium'),
      fact('availability', { obtainable: entry.obtainable, contentPack: entry.contentPack, eventExclusive: 'eventExclusive' in entry ? entry.eventExclusive : entry.eventOnly }, factSourceIds, 'medium'),
      fact('cooldown', 'cooldown' in entry ? entry.cooldown : { seconds: value.cooldownSeconds }, factSourceIds, 'medium')]
    if ('duration' in entry) known.push(fact('duration', entry.duration, factSourceIds, entry.duration.status === 'unknown' ? 'unknown' : 'medium', entry.duration.status === 'known' || entry.duration.status === 'reported' || entry.duration.status === 'not-applicable' ? 'accepted' : entry.duration.status === 'unknown' ? 'unknown' : 'stale'))
    if ('powerScaling' in entry) {
      known.push(fact('powerScalingClass', entry.powerScaling.kind, factSourceIds, 'medium'))
      known.push(fact('powerScalingEvidence', entry.powerScaling, factSourceIds, 'medium', entry.powerScaling.quality.runtimeEligibleSampleCount > 0 ? 'accepted' : 'stale', 'Classification and samples are evidence; no extrapolation is allowed.'))
    }
    if ('soul' in entry) known.push(fact('soul', entry.soul, factSourceIds, 'medium'))
    if ('targeting' in entry && entry.targeting.status !== 'unknown') known.push(fact('targeting', entry.targeting, factSourceIds, entry.targeting.confidence as HarvestConfidence, entry.targeting.status === 'known' || entry.targeting.status === 'reported' ? 'accepted' : 'stale'))
    if ('stacking' in entry) known.push(fact('stacking', entry.stacking, factSourceIds, entry.stacking.confidence as HarvestConfidence, entry.stacking.magnitude === 'unresolved' ? 'unknown' : 'accepted'))
    const blockers = 'blockers' in entry ? entry.blockers : []
    const gaps = blockers.map((note, index) => unknown(`mechanicGap.${index + 1}`, note.toLowerCase().includes('sample') || note.toLowerCase().includes('curve') ? 'likely-requires-experiment' : 'requires-game-observation', note))
    if ('interactions' in entry && entry.interactions.status !== 'known') gaps.push(unknown('interactions', 'likely-requires-experiment', entry.interactions.note))
    const conflictFacts = known.filter((item) => item.status === 'conflicting')
    const conflicts = conflictFacts.map((item) => ({ property: item.property, values: item.sourceIds.map((sourceId) => ({ sourceId, value: item.value })), probableReason: item.notes ?? 'Published values disagree.', resolutionStatus: 'pending' as const }))
    return { category: 'artifact', id: entry.id, label: entry.name, runtimeSupport: runtime('artifact', entry.id), known, unknown: gaps, conflicts, sourceIds,
      version: version(false, known.some((item) => item.status === 'stale') || conflicts.length > 0, 'Identity/cooldown sources are retained separately from unresolved Power curves, units, targeting and interactions.') }
  })
}

type SnapshotClaim = {
  readonly entityId: string
  readonly property: string
  readonly value: JsonValue
  readonly sourceId: string
  readonly sourceLocator: string
  readonly interpretation: 'direct' | 'normalized' | 'derived'
  readonly notes?: string
}
type SnapshotAttempt = {
  readonly entityId: string
  readonly sourceId: string
  readonly result: 'value-found' | 'not-found' | 'unavailable'
  readonly propertiesFound: readonly string[]
  readonly note?: string
}

const snapshotClaimsByEntity = new Map<string, SnapshotClaim[]>()
for (const claim of externalSnapshot.claims as SnapshotClaim[]) snapshotClaimsByEntity.set(claim.entityId, [...(snapshotClaimsByEntity.get(claim.entityId) ?? []), claim])
const snapshotAttemptsByEntity = new Map((externalSnapshot.attempts as SnapshotAttempt[]).map((attempt) => [attempt.entityId, attempt]))

function mergeExternalClaims(record: HarvestRecord): HarvestRecord {
  const entityId = `${record.category}:${record.id}`
  const claims = snapshotClaimsByEntity.get(entityId) ?? []
  const known = [...record.known]
  for (const claim of claims) {
    if (claim.interpretation === 'derived' || !HARVEST_PROPERTY_DEFINITIONS[record.category].includes(claim.property)) continue
    const existingIndex = known.findIndex((item) => item.property === claim.property)
    const existingFact = existingIndex >= 0 ? known[existingIndex] : undefined
    if (existingFact?.status === 'accepted') continue
    const id = externalSourceIds.get(claim.sourceId)
    if (!id) continue
    const externalFact = fact(claim.property, claim.value, [id], 'medium', 'accepted', [claim.notes, `External locator: ${claim.sourceLocator}.`, `Interpretation: ${claim.interpretation}.`].filter(Boolean).join(' '))
    if (existingIndex >= 0) known.splice(existingIndex, 1, externalFact)
    else known.push(externalFact)
  }
  const acceptedProperties = new Set(known.filter((item) => item.status === 'accepted').map((item) => item.property))
  const attempt = snapshotAttemptsByEntity.get(entityId)
  const fallbackSourceId = attempt ? externalSourceIds.get(attempt.sourceId) : undefined
  const unknowns = record.unknown
    .filter((item) => !acceptedProperties.has(item.property))
    .map((item) => {
      if (!fallbackSourceId) return item
      const result: SourceAttemptResult = attempt!.result === 'unavailable' ? 'unavailable' : attempt!.propertiesFound.includes(item.property) ? 'ambiguous' : 'not-found'
      const note = attempt!.note ?? (result === 'not-found' ? `The available detail page did not expose an accepted ${item.property} value.` : `The page exposed related text but not an unambiguous accepted ${item.property} value.`)
      return { ...item, sourceAttempts: [{ sourceId: fallbackSourceId, result, note }] }
    })
  const claimSourceIds = claims.map((claim) => externalSourceIds.get(claim.sourceId)).filter(nonNull)
  return { ...record, known, unknown: unknowns, sourceIds: unique([...record.sourceIds, ...claimSourceIds, ...(fallbackSourceId ? [fallbackSourceId] : [])]) }
}

export const HARVEST_PROPERTY_DEFINITIONS: Readonly<Record<HarvestCategory, readonly string[]>> = {
  'melee-weapon': ['identity', 'family', 'baseUniqueRelation', 'combo', 'timing', 'hitDamageRatios', 'attackSpeedScaling', 'intrinsicMechanicOwnership', 'powerScaling'],
  'melee-enchantment': ['identity', 'availability', 'tiers', 'trigger', 'procChance', 'duration', 'cooldown', 'stacking', 'maxCopies', 'damageChannel', 'powerDependence', 'versionHistory', 'currentVersionGameplayVerification'],
  armor: ['identity', 'family', 'availability', 'baseUniqueRelation', 'intrinsicProperties', 'builtInEnchantments', 'soulProperty', 'healthPowerCurve'],
  'armor-enchantment': ['identity', 'tiers', 'trigger', 'duration', 'cooldown', 'procChance', 'stacking', 'availability', 'effectChannel', 'stateRequirement', 'powerDependence', 'versionHistory', 'runtimeMechanic'],
  'ranged-weapon': ['identity', 'family', 'baseUniqueRelation', 'availability', 'firingMode', 'projectileFamily', 'projectileCount', 'chargeBehavior', 'intrinsic', 'ammo', 'soul', 'neutralProjectileDamageDistribution', 'procOwnership'],
  'ranged-enchantment': ['identity', 'rarity', 'tiers', 'trigger', 'damageChannel', 'stacking', 'maxCopies', 'triggerOwnership', 'ammoChargeInteractions'],
  artifact: ['identity', 'family', 'availability', 'cooldown', 'duration', 'powerScalingClass', 'powerScalingEvidence', 'soul', 'targeting', 'stacking', 'interactions'],
}

export function buildSourceHarvest() {
  const records = [...rangedWeaponRecords(), ...armorRecords(), ...artifactRecords(), ...rangedEnchantmentRecords(), ...armorEnchantmentRecords(), ...meleeWeaponRecords(), ...meleeEnchantmentRecords()].map(mergeExternalClaims)
  const coverage = HARVEST_CATEGORIES.map((category) => {
    const categoryRecords = records.filter((record) => record.category === category)
    return { category, population: categoryRecords.length, properties: HARVEST_PROPERTY_DEFINITIONS[category].map((property) => ({ property,
      known: categoryRecords.filter((record) => record.known.some((item) => item.property === property && item.status === 'accepted')).length,
      conflicting: categoryRecords.filter((record) => record.conflicts.some((item) => item.property === property)).length,
      population: categoryRecords.length,
    })) }
  })
  const gaps: GapCandidate[] = records.flatMap((record) => [
    ...record.unknown.map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: 'unknown' as const, sourceAttempts: item.sourceAttempts, sourceConflict: false, versionIssue: !record.version.currentVersionVerified || record.version.staleRisk, likelyAcquisitionType: item.kind, runtimeRelevance: item.kind === 'objective-related' ? 'low' as const : item.property.toLowerCase().includes('damage') || item.property.toLowerCase().includes('timing') || item.property.toLowerCase().includes('trigger') ? 'high' as const : 'medium' as const, notes: item.notes })),
    ...record.known.filter((item) => (item.status === 'stale' || item.status === 'unknown') && !record.unknown.some((gap) => gap.property === item.property)).map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: item.status === 'stale' ? 'stale' as const : 'unknown' as const, sourceAttempts: item.sourceAttempts, sourceConflict: false, versionIssue: item.status === 'stale' || !record.version.currentVersionVerified, likelyAcquisitionType: item.status === 'stale' ? 'version-unknown' as const : 'source-missing' as const, runtimeRelevance: item.property.toLowerCase().includes('damage') || item.property.toLowerCase().includes('timing') || item.property.toLowerCase().includes('trigger') ? 'high' as const : 'medium' as const, notes: item.notes ?? `${item.property} is retained as ${item.status}, not as a current accepted value.` })),
    ...record.conflicts.map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: 'conflicting' as const, sourceAttempts: item.values.map((value) => ({ sourceId: value.sourceId, result: 'conflicting' as const, note: item.probableReason })), sourceConflict: true, versionIssue: item.values.some((value) => !value.gameVersion), likelyAcquisitionType: 'conflicting-public-sources' as const, runtimeRelevance: 'high' as const, notes: item.probableReason })),
  ])
  const baseline = {
    totalGaps: 2449,
    byCategory: { 'melee-weapon': 334, 'melee-enchantment': 182, armor: 327, 'armor-enchantment': 329, 'ranged-weapon': 848, 'ranged-enchantment': 201, artifact: 228 },
    selectedCoverage: {
      'ranged-weapon:projectileCount': 2,
      'ranged-enchantment:tiers': 3,
      'ranged-enchantment:stacking': 3,
      'armor-enchantment:trigger': 0,
      'armor-enchantment:duration': 0,
      'armor-enchantment:cooldown': 0,
      'armor-enchantment:procChance': 0,
      'artifact:targeting': 5,
      'artifact:stacking': 2,
    },
    byAcquisitionType: { 'source-missing': 1112, 'version-unknown': 164, 'conflicting-public-sources': 6, 'requires-game-observation': 428, 'likely-requires-experiment': 439, 'implementation-related': 271, 'objective-related': 29 },
  }
  return { schemaVersion: 2, targetGameVersion: TARGET_VERSION, generatedAt: SOURCE_DATE, extraction: { snapshot: 'research/source-harvest/snapshots/dungeons-tools-2026-09-06.json', sourceCount: externalSnapshot.sources.length, claimCount: externalSnapshot.claims.length, attemptCount: externalSnapshot.attempts.length, unavailableCount: externalSnapshot.attempts.filter((attempt) => attempt.result === 'unavailable').length, addedClaimsBySource: { 'dungeons-tools': externalSnapshot.claims.length, wiki: 0, official: 0, 'quantitative-public-research': 0 } }, comparison: { before: baseline, after: { totalGaps: gaps.length, byCategory: Object.fromEntries(HARVEST_CATEGORIES.map((category) => [category, gaps.filter((gap) => gap.entity.startsWith(`${category}:`)).length])), byAcquisitionType: Object.fromEntries(['source-missing', 'version-unknown', 'conflicting-public-sources', 'requires-game-observation', 'likely-requires-experiment', 'implementation-related', 'objective-related'].map((kind) => [kind, gaps.filter((gap) => gap.likelyAcquisitionType === kind).length])) } }, methodology: { sourceHierarchy: ['game-file', 'official', 'wiki', 'quantitative-test', 'secondary-database', 'community', 'project-internal', 'unknown'], runtimePromotionAllowed: false, unknownValuePolicy: 'preserve-unknown-never-zero-fill' }, sources: [...sourceRecords.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')), records, coverage, gaps }
}

export function collectSourceHarvestErrors(harvest: ReturnType<typeof buildSourceHarvest>): string[] {
  const errors: string[] = []
  const sourceTypes = new Set<SourceType>(['game-file', 'official', 'wiki', 'quantitative-test', 'community', 'project-internal', 'secondary-database', 'unknown'])
  const versionStatuses = new Set<SourceVersionStatus>(['exact-current', 'claimed-current', 'historical', 'unknown'])
  const attemptResults = new Set<SourceAttemptResult>(['value-found', 'not-found', 'ambiguous', 'conflicting', 'version-mismatch', 'unavailable'])
  const factStatuses = new Set<HarvestStatus>(['accepted', 'conflicting', 'stale', 'unknown'])
  const confidences = new Set<HarvestConfidence>(['verified', 'high', 'medium', 'low', 'unknown'])
  if (harvest.schemaVersion !== 2) errors.push(`Unsupported schemaVersion: ${harvest.schemaVersion}`)
  if (harvest.targetGameVersion !== TARGET_VERSION) errors.push(`Target gameVersion drift: ${harvest.targetGameVersion}`)
  if (harvest.methodology.runtimePromotionAllowed) errors.push('Source Harvest must remain read-only for runtime promotion')
  if (harvest.extraction.sourceCount !== externalSnapshot.sources.length || harvest.extraction.claimCount !== externalSnapshot.claims.length || harvest.extraction.attemptCount !== externalSnapshot.attempts.length) errors.push('External extraction summary drift')
  if (externalSnapshot.attempts.length !== 386 || new Set(externalSnapshot.attempts.map((attempt) => attempt.entityId)).size !== 386) errors.push('External extraction must contain one attempt for every harvested entity')
  if (externalSnapshot.claims.some((claim) => claim.interpretation === 'derived')) errors.push('Derived external claims must not be promoted by Phase 4.1')
  const snapshotSourceIds = new Set(externalSnapshot.sources.map((source) => source.id))
  for (const claim of externalSnapshot.claims) if (!snapshotSourceIds.has(claim.sourceId) || !claim.entityId || !claim.property || !claim.sourceLocator) errors.push(`Invalid extracted claim: ${claim.entityId}:${claim.property}`)
  for (const attempt of externalSnapshot.attempts) if (!snapshotSourceIds.has(attempt.sourceId) || !attempt.entityId || !attempt.result) errors.push(`Invalid external source attempt: ${attempt.entityId}`)
  const sourceIds = new Set<string>()
  for (const source of harvest.sources) {
    if (sourceIds.has(source.id)) errors.push(`Duplicate source ID: ${source.id}`)
    sourceIds.add(source.id)
    if (!source.title || !source.retrievedAt) errors.push(`${source.id}: required source metadata missing`)
    if (!sourceTypes.has(source.sourceType)) errors.push(`${source.id}: invalid sourceType ${source.sourceType}`)
    if (!source.gameVersion.trim()) errors.push(`${source.id}: required gameVersion state missing`)
    if (!versionStatuses.has(source.versionStatus)) errors.push(`${source.id}: invalid versionStatus ${source.versionStatus}`)
    if (source.versionStatus === 'exact-current' && source.gameVersion !== TARGET_VERSION) errors.push(`${source.id}: exact-current version must equal ${TARGET_VERSION}`)
  }
  const keys = new Set<string>()
  for (const record of harvest.records) {
    const key = `${record.category}:${record.id}`
    if (keys.has(key)) errors.push(`Duplicate entity ID: ${key}`)
    keys.add(key)
    if (!HARVEST_CATEGORIES.includes(record.category)) errors.push(`${key}: invalid category`)
    if (!record.id || !record.label) errors.push(`${key}: required entity metadata missing`)
    if (record.version.target !== TARGET_VERSION) errors.push(`${key}: record gameVersion drift`)
    if (record.sourceIds.length === 0) errors.push(`${key}: required provenance missing`)
    if (new Set(record.sourceIds).size !== record.sourceIds.length) errors.push(`${key}: duplicate source reference`)
    for (const id of [...record.sourceIds, ...record.known.flatMap((item) => item.sourceIds), ...record.conflicts.flatMap((item) => item.values.map((value) => value.sourceId))]) if (!sourceIds.has(id)) errors.push(`${key}: unknown source reference ${id}`)
    const facts = new Set<string>()
    for (const item of record.known) {
      if (facts.has(item.property)) errors.push(`${key}: duplicate fact ${item.property}`)
      facts.add(item.property)
      if (!item.property || item.sourceIds.length === 0) errors.push(`${key}: fact provenance missing for ${item.property}`)
      if (!factStatuses.has(item.status)) errors.push(`${key}: invalid fact status ${item.status}`)
      if (!confidences.has(item.confidence)) errors.push(`${key}: invalid confidence ${item.confidence}`)
      if (item.targetGameVersion !== TARGET_VERSION) errors.push(`${key}: fact targetGameVersion drift for ${item.property}`)
      if (!versionStatuses.has(item.versionStatus)) errors.push(`${key}: invalid fact versionStatus ${item.versionStatus}`)
      if (item.versionStatus === 'unknown' && item.applicableGameVersion === TARGET_VERSION) errors.push(`${key}: unknown-version fact cannot claim current applicability for ${item.property}`)
      if (item.sourceAttempts.length === 0 || item.sourceAttempts.some((attempt) => attempt.result !== 'value-found' && attempt.result !== 'conflicting')) errors.push(`${key}: invalid fact source attempt for ${item.property}`)
      if (item.status === 'accepted' && record.conflicts.some((conflict) => conflict.property === item.property && conflict.resolutionStatus === 'pending')) errors.push(`${key}: conflicting accepted value ${item.property}`)
      if (item.value === 0 && item.confidence === 'unknown') errors.push(`${key}: unknown fact must not be zero-filled`)
    }
    for (const conflict of record.conflicts) {
      if (!conflict.property || !conflict.probableReason || conflict.values.length < 2) errors.push(`${key}: invalid conflict ${conflict.property}`)
      if (new Set(conflict.values.map((value) => JSON.stringify(value.value))).size < 2) errors.push(`${key}: conflict has no distinct values for ${conflict.property}`)
    }
    for (const item of record.unknown) {
      if (item.sourceAttempts.length === 0) errors.push(`${key}: property source attempt missing for ${item.property}`)
      for (const attempt of item.sourceAttempts) {
        if (!sourceIds.has(attempt.sourceId)) errors.push(`${key}:${item.property}: unknown attempt source ${attempt.sourceId}`)
        if (!attemptResults.has(attempt.result)) errors.push(`${key}:${item.property}: invalid attempt result ${attempt.result}`)
      }
    }
  }
  if (new Set(harvest.coverage.map((item) => item.category)).size !== HARVEST_CATEGORIES.length) errors.push('Coverage category duplication or omission')
  for (const category of harvest.coverage) {
    const expected = category.category === 'melee-weapon' ? meleeWeapons.population.obtainableMeleeWeapons : category.category === 'melee-enchantment' ? meleeEnchantments.population.targetCount : category.category === 'armor' ? 73 : category.category === 'armor-enchantment' ? 41 : category.category === 'ranged-weapon' ? 71 : category.category === 'ranged-enchantment' ? 41 : 45
    if (category.population !== expected) errors.push(`${category.category}: population ${category.population} != ${expected}`)
  }
  for (const gap of harvest.gaps) {
    if (!keys.has(gap.entity) || !gap.property || gap.sourceAttempts.length === 0 || !gap.notes) errors.push(`Invalid gap candidate: ${gap.entity}:${gap.property}`)
    for (const attempt of gap.sourceAttempts) {
      if (!sourceIds.has(attempt.sourceId)) errors.push(`${gap.entity}:${gap.property}: unknown gap source ${attempt.sourceId}`)
      if (!attemptResults.has(attempt.result)) errors.push(`${gap.entity}:${gap.property}: invalid gap attempt result ${attempt.result}`)
    }
  }
  return unique(errors)
}

export function renderSourceHarvest(harvest: ReturnType<typeof buildSourceHarvest>): string {
  const sourceCounts = Object.fromEntries(['game-file', 'official', 'wiki', 'quantitative-test', 'secondary-database', 'community', 'project-internal', 'unknown'].map((type) => [type, harvest.sources.filter((source) => source.sourceType === type).length]))
  const sourceVersionCounts = Object.fromEntries(['exact-current', 'claimed-current', 'historical', 'unknown'].map((status) => [status, harvest.sources.filter((source) => source.versionStatus === status).length]))
  const conflictCount = harvest.records.reduce((sum, record) => sum + record.conflicts.length, 0)
  const table = harvest.coverage.flatMap((category) => category.properties.map((property) => `| ${category.category} | ${property.property} | ${property.known} / ${property.population} | ${property.conflicting} |`)).join('\n')
  const gaps = Object.entries(Object.fromEntries(['source-missing', 'version-unknown', 'conflicting-public-sources', 'requires-game-observation', 'likely-requires-experiment', 'implementation-related', 'objective-related'].map((kind) => [kind, harvest.gaps.filter((gap) => gap.likelyAcquisitionType === kind).length]))).map(([kind, count]) => `- ${kind}: ${count}`).join('\n')
  const selectedBeforeAfter = Object.entries(harvest.comparison.before.selectedCoverage).map(([key, before]) => {
    const [category, property] = key.split(':')
    const coverage = harvest.coverage.find((item) => item.category === category)?.properties.find((item) => item.property === property)
    return `| ${category} | ${property} | ${before} / ${coverage?.population ?? '?'} | ${coverage?.known ?? '?'} / ${coverage?.population ?? '?'} |`
  }).join('\n')
  const gapBeforeAfter = Object.entries(harvest.comparison.before.byAcquisitionType).map(([kind, before]) => `| ${kind} | ${before} | ${harvest.comparison.after.byAcquisitionType[kind as keyof typeof harvest.comparison.after.byAcquisitionType] ?? 0} |`).join('\n')
  const categoryGapBeforeAfter = Object.entries(harvest.comparison.before.byCategory).map(([category, before]) => `| ${category} | ${before} | ${harvest.comparison.after.byCategory[category as keyof typeof harvest.comparison.after.byCategory] ?? 0} |`).join('\n')
  return `# Phase 4.1 External Source Extraction\n\nGenerated from the existing category audits plus a committed property-level external extraction snapshot. This is a read-only evidence index: it does not feed candidate generation, numeric evaluation, runtime support or confidence promotion.\n\n## Methodology\n\n- Target game version: **${harvest.targetGameVersion}**. Mojang identifies 1.17 as the final content update; this establishes the version boundary only.\n- Source hierarchy: 1.17.0.0 game-file-derived database → official release boundary / patch notes → concrete Wiki mechanics and history → reproducible quantitative testing → secondary database / community claims.\n- Target version and source applicability are separate on every Fact. A publisher claim is retained as claimed-current, never upgraded to independent exact-current verification.\n- Direct and restrained normalized claims can become Known. Derived claims, missing values and ambiguous wording remain unresolved; zero is never used as a placeholder.\n- External extraction checked ${harvest.extraction.attemptCount} category/entity pages and retained ${harvest.extraction.claimCount} property claims without storing full HTML. ${harvest.extraction.unavailableCount} page attempts were unavailable.\n\n## Sources\n\n- game-file-derived: ${sourceCounts['game-file']}\n- official: ${sourceCounts.official}\n- Wiki: ${sourceCounts.wiki}\n- quantitative public tests / observations: ${sourceCounts['quantitative-test']}\n- secondary database: ${sourceCounts['secondary-database']}\n- other community: ${sourceCounts.community}\n- project internal: ${sourceCounts['project-internal']}\n- unknown classification: ${sourceCounts.unknown}\n\nSource version applicability: exact current ${sourceVersionCounts['exact-current']}; claimed current ${sourceVersionCounts['claimed-current']}; historical ${sourceVersionCounts.historical}; unknown/unresolved ${sourceVersionCounts.unknown}.\n\n## Selected Before / After\n\n| Category | Property | Before | After |\n| --- | --- | ---: | ---: |\n${selectedBeforeAfter}\n\n## Property-level Harvest coverage\n\nRuntime coverage is intentionally not included in these ratios. A property is counted only when an accepted value exists; stale and conflicting values remain separate.\n\n| Category | Property | Known | Conflicts |\n| --- | --- | ---: | ---: |\n${table}\n\n## Gap candidates Before / After\n\nTotal: **${harvest.comparison.before.totalGaps} → ${harvest.comparison.after.totalGaps}**. Explicit source conflicts after extraction: **${conflictCount}**.\n\n| Acquisition type | Before | After |\n| --- | ---: | ---: |\n${gapBeforeAfter}\n\n| Category | Before | After |\n| --- | ---: | ---: |\n${categoryGapBeforeAfter}\n\nCurrent gap distribution:\n\n${gaps}\n\nEach gap carries the entity/property, property-specific attempted sources and result, version/conflict flags, likely acquisition type and runtime relevance. Phase 5 can now focus on remaining observation, measurement, experiment, implementation and objective decisions.\n\n## Safety boundary\n\nNo runtime support level, optimizer candidate, score formula, Inventory JSON format, Worker behavior or Evidence confidence is changed by this harvest. Research Quest, Evidence submission, Runtime Promotion, Public Availability and New Drop Comparison remain out of scope.\n`
}
