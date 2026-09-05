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
import { buildCoverageAdapters } from './evidenceCoverage/adapters'
import type { JsonValue } from './evidenceCoverage/model'

export const HARVEST_CATEGORIES = ['melee-weapon', 'melee-enchantment', 'armor', 'armor-enchantment', 'ranged-weapon', 'ranged-enchantment', 'artifact'] as const
export type HarvestCategory = typeof HARVEST_CATEGORIES[number]
export type HarvestConfidence = 'verified' | 'high' | 'medium' | 'low' | 'unknown'
export type HarvestStatus = 'accepted' | 'conflicting' | 'stale' | 'unknown'
export type SourceVersionStatus = 'exact-current' | 'claimed-current' | 'historical' | 'unknown'
export type UnknownKind = 'source-missing' | 'version-unknown' | 'conflicting-public-sources' | 'requires-game-observation' | 'likely-requires-experiment' | 'implementation-related' | 'objective-related'

export interface SourceRecord {
  readonly id: string
  readonly sourceType: 'game-file' | 'official' | 'wiki' | 'quantitative-test' | 'community'
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
  readonly gameVersion?: string
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
  readonly unknown: readonly { readonly property: string; readonly kind: UnknownKind; readonly notes: string }[]
  readonly conflicts: readonly HarvestConflict[]
  readonly sourceIds: readonly string[]
  readonly version: { readonly target: '1.17.0.0'; readonly currentVersionVerified: boolean; readonly staleRisk: boolean; readonly notes: string }
}

export interface GapCandidate {
  readonly entity: string
  readonly property: string
  readonly currentKnownState: 'unknown' | 'conflicting' | 'stale'
  readonly sourceAttempts: readonly string[]
  readonly sourceConflict: boolean
  readonly versionIssue: boolean
  readonly likelyAcquisitionType: UnknownKind
  readonly runtimeRelevance: 'high' | 'medium' | 'low'
  readonly notes: string
}

const SOURCE_DATE = '2026-09-05'
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
  return 'game-file'
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

function embeddedSources(namespace: string, sources: readonly { type?: string; url: string; retrievedAt?: string; checkedContext?: string; confidence?: string; note?: string }[]): string[] {
  return unique(sources.map((source) => addSource(namespace, { ...source, title: source.checkedContext ?? source.url })))
}

const fact = (property: string, value: unknown, sourceIds: readonly string[], confidence: HarvestConfidence, status: HarvestStatus = 'accepted', notes?: string): HarvestedFact => ({
  property, value: json(value), sourceIds: unique(sourceIds), gameVersion: TARGET_VERSION, confidence, status, ...(notes ? { notes } : {}),
})
const unknown = (property: string, kind: UnknownKind, notes: string) => ({ property, kind, notes })
const version = (currentVersionVerified: boolean, staleRisk: boolean, notes: string) => ({ target: TARGET_VERSION, currentVersionVerified, staleRisk, notes })

const runtimeByCategory = new Map(buildCoverageAdapters().flatMap((adapter) => adapter.records.map((record) => [`${adapter.category}:${record.id}`, record.runtimeSupport])))
const runtime = (category: HarvestCategory, id: string): string => {
  const coverageCategory = category === 'melee-weapon' ? 'melee-attack-profile' : category
  return runtimeByCategory.get(`${coverageCategory}:${id}`) ?? 'unknown'
}

function meleeWeaponRecords(): HarvestRecord[] {
  return meleeWeapons.weapons.map((entry) => {
    const factSourceIds = [...embeddedSources('melee-weapon', entry.sources), ...officialVersionSources]
    const sourceIds = unique([...factSourceIds, ...(quantitativeDpsByWeapon.get(entry.weaponId) ?? [])])
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
    const sourceIds = unique([...embeddedSources('melee-enchantment', entry.sources), ...officialVersionSources, ...(entry.id === 'void-strike' ? voidStrikeSourceIds : [])])
    const tierText = JSON.stringify(entry.tierValues).toLowerCase()
    const known = [
      fact('identity', { canonicalId: entry.id, names: entry.name }, sourceIds, entry.confidence as HarvestConfidence),
      fact('availability', { applicability: entry.applicability, rarity: entry.rarity, obtainable: entry.obtainable }, sourceIds, entry.confidence as HarvestConfidence),
      fact('tiers', entry.tierValues, sourceIds, entry.confidence as HarvestConfidence),
      fact('trigger', entry.trigger, sourceIds, entry.confidence as HarvestConfidence),
      fact('stacking', entry.stacking, sourceIds, entry.confidence as HarvestConfidence),
      fact('maxCopies', entry.stacking.maxCopies, sourceIds, entry.confidence as HarvestConfidence),
      fact('damageChannel', entry.modelCategory, sourceIds, entry.confidence as HarvestConfidence),
    ]
    if (tierText.includes('chance')) known.push(fact('procChance', entry.tierValues, sourceIds, entry.confidence as HarvestConfidence))
    if (tierText.includes('duration')) known.push(fact('duration', entry.tierValues, sourceIds, entry.confidence as HarvestConfidence))
    if (tierText.includes('cooldown')) known.push(fact('cooldown', entry.tierValues, sourceIds, entry.confidence as HarvestConfidence))
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
    const sourceIds = unique([...entry.sourceIds.map((id) => armorSourceIds.get(id)).filter(nonNull), ...officialVersionSources])
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name, levelId: entry.levelId }, sourceIds, 'high'), fact('family', entry.family, sourceIds, 'high'),
      fact('availability', { rarity: entry.rarity, obtainable: entry.obtainable, eventExclusive: entry.eventExclusive, contentPack: entry.contentPack }, sourceIds, 'high'),
      fact('baseUniqueRelation', entry.inheritance, sourceIds, 'high'), fact('intrinsicProperties', entry.intrinsicProperties, sourceIds, 'high'),
      fact('builtInEnchantments', entry.builtInEnchantments, sourceIds, 'high'), fact('soulProperty', entry.soulGear, sourceIds, 'high')]
    const gaps = [unknown('healthPowerCurve', 'likely-requires-experiment', 'Observed card health remains required; published current endgame curve is unavailable.'),
      ...entry.blockers.map((note, index) => unknown(`runtimeBoundary.${index + 1}`, note.includes('objective') ? 'objective-related' : 'implementation-related', note))]
    return { category: 'armor', id: entry.id, label: entry.name, runtimeSupport: runtime('armor', entry.id), known, unknown: gaps, conflicts: [], sourceIds, version: version(true, false, 'Identity, family and intrinsic properties use the 1.17.0.0-derived index; health scaling is intentionally unverified.') }
  })
}

function armorEnchantmentRecords(): HarvestRecord[] {
  return armorEnchantments.entries.map((entry) => {
    const sourceIds = unique([...entry.sourceIds.map((id) => armorEnchantSourceIds.get(id) ?? armorCoreSourceIds.get(id)).filter(nonNull), ...officialVersionSources])
    const conflicts: HarvestConflict[] = entry.id === 'cool-down' ? [{ property: 'tiers.tier3', values: [
      { sourceId: armorCoreSourceIds.get('dungeons-tools-armor')!, value: 0.37, gameVersion: TARGET_VERSION },
      { sourceId: armorCoreSourceIds.get('wiki-cool-down')!, value: 0.38 },
    ], probableReason: 'The current Wiki display and version-targeted game-file-derived value differ.', resolutionStatus: 'preferred-source-retained' }] : []
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name }, sourceIds, 'high'), fact('tiers', entry.tiers, sourceIds, 'high'),
      fact('stacking', { stackable: entry.stackable, maxCopies: entry.maxCopies }, sourceIds, 'high'), fact('availability', { builtIntoArmorIds: entry.builtIntoArmorIds, soulRestriction: entry.soulRestriction }, sourceIds, 'high'), fact('effectChannel', entry.mechanicFamily, sourceIds, 'medium')]
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
    const sourceIds = unique([...entry.sourceIds.map((id) => rangedWeaponSourceIds.get(id)).filter(nonNull), ...officialVersionSources])
    const known = [fact('identity', { canonicalId: entry.id, names: entry.name }, sourceIds, entry.confidence as HarvestConfidence), fact('family', { family: entry.family, baseWeaponId: entry.baseWeaponId, variantOf: entry.variantOf }, sourceIds, entry.confidence as HarvestConfidence),
      fact('availability', { obtainable: entry.obtainable, rarity: entry.rarity, eventExclusive: entry.eventExclusive }, sourceIds, entry.confidence as HarvestConfidence),
      fact('baseUniqueRelation', { baseWeaponId: entry.baseWeaponId, variantOf: entry.variantOf }, sourceIds, entry.confidence as HarvestConfidence),
      fact('projectileFamily', { projectileFamily: entry.projectileFamily, multiProjectile: entry.multiProjectile }, sourceIds, entry.confidence as HarvestConfidence),
      fact('intrinsic', entry.intrinsic, sourceIds, entry.confidence as HarvestConfidence), fact('ammo', entry.ammo, sourceIds, entry.confidence as HarvestConfidence), fact('soul', entry.soul, sourceIds, entry.confidence as HarvestConfidence), fact('cardRatings', entry.rawRatings, sourceIds, entry.confidence as HarvestConfidence)]
    for (const property of properties) if (entry[property] !== null) known.push(fact(property, entry[property], sourceIds, entry.confidence as HarvestConfidence))
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
    const sourceIds = unique([...entry.sourceIds.map((id) => rangedEnchantSourceIds.get(id)).filter(nonNull), ...conflictSourceIds, ...officialVersionSources])
    const conflicts: HarvestConflict[] = entry.conflict && primarySourceId && secondarySourceId ? [{ property: 'publishedMechanic', values: [
      { sourceId: primarySourceId, value: entry.sourceIds.includes('primary-enchantments') ? entry.tierValues : 'not listed for ranged applicability' },
      { sourceId: secondarySourceId, value: entry.conflict },
    ], probableReason: 'Primary and secondary published descriptions disagree or use different channel semantics.', resolutionStatus: 'pending' }] : []
    const known = [fact('identity', { canonicalId: entry.id, names: entry.name }, sourceIds, entry.confidence as HarvestConfidence), fact('rarity', entry.rarity, sourceIds, entry.confidence as HarvestConfidence),
      fact('tiers', entry.tierValues, sourceIds, entry.confidence as HarvestConfidence, entry.tierStatus.includes('not-independently') ? 'stale' : 'accepted', entry.tierStatus), fact('trigger', entry.triggerFamily, sourceIds, entry.confidence as HarvestConfidence), fact('damageChannel', entry.damageChannel, sourceIds, entry.confidence as HarvestConfidence)]
    if (entry.stackable !== null) known.push(fact('stacking', entry.stackable, sourceIds, entry.confidence as HarvestConfidence))
    if (entry.maxCopies !== null) known.push(fact('maxCopies', entry.maxCopies, sourceIds, entry.confidence as HarvestConfidence))
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
    const sourceIds = unique([...ids.map((id) => artifactSourceIds.get(id)).filter(nonNull), ...officialVersionSources])
    const value = entry as typeof artifacts.entries[number] & { cooldownSeconds?: number }
    const known = [fact('identity', { canonicalId: entry.id, name: entry.name }, sourceIds, 'medium'), fact('family', entry.mechanicFamily, sourceIds, 'medium'),
      fact('availability', { obtainable: entry.obtainable, contentPack: entry.contentPack, eventExclusive: 'eventExclusive' in entry ? entry.eventExclusive : entry.eventOnly }, sourceIds, 'medium'),
      fact('cooldown', 'cooldown' in entry ? entry.cooldown : { seconds: value.cooldownSeconds }, sourceIds, 'medium')]
    if ('duration' in entry) known.push(fact('duration', entry.duration, sourceIds, entry.duration.status === 'unknown' ? 'unknown' : 'medium', entry.duration.status === 'known' || entry.duration.status === 'reported' || entry.duration.status === 'not-applicable' ? 'accepted' : entry.duration.status === 'unknown' ? 'unknown' : 'stale'))
    if ('powerScaling' in entry) {
      known.push(fact('powerScalingClass', entry.powerScaling.kind, sourceIds, 'medium'))
      known.push(fact('powerScalingEvidence', entry.powerScaling, sourceIds, 'medium', entry.powerScaling.quality.runtimeEligibleSampleCount > 0 ? 'accepted' : 'stale', 'Classification and samples are evidence; no extrapolation is allowed.'))
    }
    if ('soul' in entry) known.push(fact('soul', entry.soul, sourceIds, 'medium'))
    if ('targeting' in entry && entry.targeting.status !== 'unknown') known.push(fact('targeting', entry.targeting, sourceIds, entry.targeting.confidence as HarvestConfidence, entry.targeting.status === 'known' || entry.targeting.status === 'reported' ? 'accepted' : 'stale'))
    if ('stacking' in entry) known.push(fact('stacking', entry.stacking, sourceIds, entry.stacking.confidence as HarvestConfidence, entry.stacking.magnitude === 'unresolved' ? 'unknown' : 'accepted'))
    const blockers = 'blockers' in entry ? entry.blockers : []
    const gaps = blockers.map((note, index) => unknown(`mechanicGap.${index + 1}`, note.toLowerCase().includes('sample') || note.toLowerCase().includes('curve') ? 'likely-requires-experiment' : 'requires-game-observation', note))
    if ('interactions' in entry && entry.interactions.status !== 'known') gaps.push(unknown('interactions', 'likely-requires-experiment', entry.interactions.note))
    const conflictFacts = known.filter((item) => item.status === 'conflicting')
    const conflicts = conflictFacts.map((item) => ({ property: item.property, values: item.sourceIds.map((sourceId) => ({ sourceId, value: item.value })), probableReason: item.notes ?? 'Published values disagree.', resolutionStatus: 'pending' as const }))
    return { category: 'artifact', id: entry.id, label: entry.name, runtimeSupport: runtime('artifact', entry.id), known, unknown: gaps, conflicts, sourceIds,
      version: version(false, known.some((item) => item.status === 'stale') || conflicts.length > 0, 'Identity/cooldown sources are retained separately from unresolved Power curves, units, targeting and interactions.') }
  })
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
  const records = [...rangedWeaponRecords(), ...armorRecords(), ...artifactRecords(), ...rangedEnchantmentRecords(), ...armorEnchantmentRecords(), ...meleeWeaponRecords(), ...meleeEnchantmentRecords()]
  const coverage = HARVEST_CATEGORIES.map((category) => {
    const categoryRecords = records.filter((record) => record.category === category)
    return { category, population: categoryRecords.length, properties: HARVEST_PROPERTY_DEFINITIONS[category].map((property) => ({ property,
      known: categoryRecords.filter((record) => record.known.some((item) => item.property === property && item.status === 'accepted')).length,
      conflicting: categoryRecords.filter((record) => record.conflicts.some((item) => item.property === property)).length,
      population: categoryRecords.length,
    })) }
  })
  const gaps: GapCandidate[] = records.flatMap((record) => [
    ...record.unknown.map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: 'unknown' as const, sourceAttempts: record.sourceIds, sourceConflict: false, versionIssue: !record.version.currentVersionVerified || record.version.staleRisk, likelyAcquisitionType: item.kind, runtimeRelevance: item.kind === 'objective-related' ? 'low' as const : item.property.toLowerCase().includes('damage') || item.property.toLowerCase().includes('timing') || item.property.toLowerCase().includes('trigger') ? 'high' as const : 'medium' as const, notes: item.notes })),
    ...record.known.filter((item) => (item.status === 'stale' || item.status === 'unknown') && !record.unknown.some((gap) => gap.property === item.property)).map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: item.status === 'stale' ? 'stale' as const : 'unknown' as const, sourceAttempts: item.sourceIds, sourceConflict: false, versionIssue: item.status === 'stale' || !record.version.currentVersionVerified, likelyAcquisitionType: item.status === 'stale' ? 'version-unknown' as const : 'source-missing' as const, runtimeRelevance: item.property.toLowerCase().includes('damage') || item.property.toLowerCase().includes('timing') || item.property.toLowerCase().includes('trigger') ? 'high' as const : 'medium' as const, notes: item.notes ?? `${item.property} is retained as ${item.status}, not as a current accepted value.` })),
    ...record.conflicts.map((item) => ({ entity: `${record.category}:${record.id}`, property: item.property, currentKnownState: 'conflicting' as const, sourceAttempts: item.values.map((value) => value.sourceId), sourceConflict: true, versionIssue: item.values.some((value) => !value.gameVersion), likelyAcquisitionType: 'conflicting-public-sources' as const, runtimeRelevance: 'high' as const, notes: item.probableReason })),
  ])
  return { schemaVersion: 1, targetGameVersion: TARGET_VERSION, generatedAt: SOURCE_DATE, methodology: { sourceHierarchy: ['game-file', 'official', 'wiki', 'quantitative-test', 'community'], runtimePromotionAllowed: false, unknownValuePolicy: 'preserve-unknown-never-zero-fill' }, sources: [...sourceRecords.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')), records, coverage, gaps }
}

export function collectSourceHarvestErrors(harvest: ReturnType<typeof buildSourceHarvest>): string[] {
  const errors: string[] = []
  const sourceTypes = new Set(['game-file', 'official', 'wiki', 'quantitative-test', 'community'])
  const versionStatuses = new Set<SourceVersionStatus>(['exact-current', 'claimed-current', 'historical', 'unknown'])
  const factStatuses = new Set<HarvestStatus>(['accepted', 'conflicting', 'stale', 'unknown'])
  const confidences = new Set<HarvestConfidence>(['verified', 'high', 'medium', 'low', 'unknown'])
  if (harvest.schemaVersion !== 1) errors.push(`Unsupported schemaVersion: ${harvest.schemaVersion}`)
  if (harvest.targetGameVersion !== TARGET_VERSION) errors.push(`Target gameVersion drift: ${harvest.targetGameVersion}`)
  if (harvest.methodology.runtimePromotionAllowed) errors.push('Source Harvest must remain read-only for runtime promotion')
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
      if (item.gameVersion !== TARGET_VERSION) errors.push(`${key}: fact gameVersion drift for ${item.property}`)
      if (item.status === 'accepted' && record.conflicts.some((conflict) => conflict.property === item.property && conflict.resolutionStatus === 'pending')) errors.push(`${key}: conflicting accepted value ${item.property}`)
      if (item.value === 0 && item.confidence === 'unknown') errors.push(`${key}: unknown fact must not be zero-filled`)
    }
    for (const conflict of record.conflicts) {
      if (!conflict.property || !conflict.probableReason || conflict.values.length < 2) errors.push(`${key}: invalid conflict ${conflict.property}`)
      if (new Set(conflict.values.map((value) => JSON.stringify(value.value))).size < 2) errors.push(`${key}: conflict has no distinct values for ${conflict.property}`)
    }
  }
  if (new Set(harvest.coverage.map((item) => item.category)).size !== HARVEST_CATEGORIES.length) errors.push('Coverage category duplication or omission')
  for (const category of harvest.coverage) {
    const expected = category.category === 'melee-weapon' ? meleeWeapons.population.obtainableMeleeWeapons : category.category === 'melee-enchantment' ? meleeEnchantments.population.targetCount : category.category === 'armor' ? 73 : category.category === 'armor-enchantment' ? 41 : category.category === 'ranged-weapon' ? 71 : category.category === 'ranged-enchantment' ? 41 : 45
    if (category.population !== expected) errors.push(`${category.category}: population ${category.population} != ${expected}`)
  }
  for (const gap of harvest.gaps) {
    if (!keys.has(gap.entity) || !gap.property || gap.sourceAttempts.length === 0 || !gap.notes) errors.push(`Invalid gap candidate: ${gap.entity}:${gap.property}`)
    for (const id of gap.sourceAttempts) if (!sourceIds.has(id)) errors.push(`${gap.entity}:${gap.property}: unknown gap source ${id}`)
  }
  return unique(errors)
}

export function renderSourceHarvest(harvest: ReturnType<typeof buildSourceHarvest>): string {
  const sourceCounts = Object.fromEntries(['game-file', 'official', 'wiki', 'quantitative-test', 'community'].map((type) => [type, harvest.sources.filter((source) => source.sourceType === type).length]))
  const sourceVersionCounts = Object.fromEntries(['exact-current', 'claimed-current', 'historical', 'unknown'].map((status) => [status, harvest.sources.filter((source) => source.versionStatus === status).length]))
  const conflictCount = harvest.records.reduce((sum, record) => sum + record.conflicts.length, 0)
  const table = harvest.coverage.flatMap((category) => category.properties.map((property) => `| ${category.category} | ${property.property} | ${property.known} / ${property.population} | ${property.conflicting} |`)).join('\n')
  const gaps = Object.entries(Object.fromEntries(['source-missing', 'version-unknown', 'conflicting-public-sources', 'requires-game-observation', 'likely-requires-experiment', 'implementation-related', 'objective-related'].map((kind) => [kind, harvest.gaps.filter((gap) => gap.likelyAcquisitionType === kind).length]))).map(([kind, count]) => `- ${kind}: ${count}`).join('\n')
  return `# Phase 4 Coverage Source Harvest\n\nGenerated from the existing category audits. This is a read-only evidence index: it does not feed candidate generation, numeric evaluation, runtime support or confidence promotion.\n\n## Methodology\n\n- Target game version: **${harvest.targetGameVersion}**. Mojang identifies 1.17 as the final content update; this establishes the version boundary only.\n- Source hierarchy: 1.17.0.0 game-file-derived database → official release boundary / patch notes → concrete Wiki mechanics and history → reproducible quantitative testing → community claims.\n- Current-version applicability and source confidence are separate. Missing values remain unknown; zero is never used as a placeholder.\n- Existing audits remain the source of truth. This generated index stores normalized facts and provenance references for cross-category browsing and drift checks.\n\n## Sources\n\n- game-file-derived: ${sourceCounts['game-file']}\n- official: ${sourceCounts.official}\n- Wiki: ${sourceCounts.wiki}\n- quantitative public tests / observations: ${sourceCounts['quantitative-test']}\n- other community: ${sourceCounts.community}\n\nSource version applicability: exact current ${sourceVersionCounts['exact-current']}; claimed current ${sourceVersionCounts['claimed-current']}; historical ${sourceVersionCounts.historical}; unknown/unresolved ${sourceVersionCounts.unknown}.\n\n## Property-level Harvest coverage\n\nRuntime coverage is intentionally not included in these ratios. A property is counted only when an accepted value exists; stale and conflicting values remain separate.\n\n| Category | Property | Known | Conflicts |\n| --- | --- | ---: | ---: |\n${table}\n\n## Unknown and conflict policy\n\nGenerated gap candidates: **${harvest.gaps.length}**. Explicit source conflicts: **${conflictCount}**.\n\n${gaps}\n\nEach gap carries the entity/property, attempted sources, version/conflict flags, likely acquisition type and runtime relevance. Phase 5 can refine measurement conditions without re-harvesting or inventing results.\n\n## Safety boundary\n\nNo runtime support level, optimizer candidate, score formula, Inventory JSON format, Worker behavior or Evidence confidence is changed by this harvest. Research Quest, Evidence submission, Runtime Promotion, Public Availability and New Drop Comparison remain out of scope.\n`
}
