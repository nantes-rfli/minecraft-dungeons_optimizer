import attackAudit from '../../../research/melee-attack-profile-audit.json'
import meleeAudit from '../../../research/melee-enchantment-audit.json'
import meleeSupport from '../../../research/runtime/melee-runtime-support.json'
import artifactAudit from '../../../research/artifact-audit.json'
import artifactSupport from '../../../research/runtime/artifact-runtime-support.json'
import artifactDecisions from '../../../research/artifact-evidence/evidence-decisions.json'
import artifactSamples from '../../../research/artifact-evidence/published-samples.json'
import artifactSources from '../../../research/artifact-evidence/sources.json'
import artifactCurves from '../../../research/artifact-curve-audit.json'
import armorAudit from '../../../research/armor-audit.json'
import armorSupport from '../../../research/runtime/armor-runtime-support.json'
import armorHealth from '../../../research/armor-health-audit.json'
import armorEnchantAudit from '../../../research/armor-enchantment-audit.json'
import armorCore from '../../../research/runtime/armor-core-runtime-audit.json'
import armorExpansion from '../../../research/armor-expansion-state-enchant-audit.json'
import dpsAudit from '../../../research/dps-regression-audit.json'
import { ARMOR_ENCHANTMENTS } from '../../data/armors'
import { MINIMUM_MODEL_ERROR_SAMPLES } from '../../core/modelError'
import { RANGED_WEAPON_AUDIT, RANGED_ENCHANTMENT_AUDIT } from '../rangedAudit'
import { RANGED_ENCHANTMENTS, RANGED_WEAPONS } from '../../data/ranged'
import { facet, pointer, recordKey, type CoverageAdapter, type CoverageBlocker, type CoverageCategory, type CoverageRecord, type JsonValue, type SupportState } from './model'

const paths = {
  attack: 'research/melee-attack-profile-audit.json', melee: 'research/melee-enchantment-audit.json', meleeSupport: 'research/runtime/melee-runtime-support.json',
  artifact: 'research/artifact-audit.json', artifactSupport: 'research/runtime/artifact-runtime-support.json', decisions: 'research/artifact-evidence/evidence-decisions.json',
  samples: 'research/artifact-evidence/published-samples.json', artifactSources: 'research/artifact-evidence/sources.json', curves: 'research/artifact-curve-audit.json',
  armor: 'research/armor-audit.json', armorSupport: 'research/runtime/armor-runtime-support.json', armorHealth: 'research/armor-health-audit.json',
  armorEnchant: 'research/armor-enchantment-audit.json', armorCore: 'research/runtime/armor-core-runtime-audit.json', armorExpansion: 'research/armor-expansion-state-enchant-audit.json',
  dps: 'research/dps-regression-audit.json',
  ranged: 'research/ranged-weapon-audit.json', rangedEnchant: 'research/ranged-enchantment-audit.json',
} as const

const supportState = (value: string): SupportState => {
  if (value === 'full' || value === 'limited' || value === 'research-only') return value
  throw new Error(`Unknown source support level: ${value}`)
}
const requireEntry = <T extends { id: string }>(entries: readonly T[], id: string): T => {
  const entry = entries.find((item) => item.id === id)
  if (!entry) throw new Error(`Missing source entry: ${id}`)
  return entry
}
function record(category: CoverageCategory, id: string, label: string, runtimeSupport: SupportState, runtimeSourceRef: string | null, facets: CoverageRecord['evidence']['facets'], evidence: Partial<Omit<CoverageRecord['evidence'], 'facets'>> = {}): CoverageRecord {
  return { category, id, label, runtimeSupport, runtimeSourceRef, evidence: { confidence: null, verificationStatus: null, gameVersion: null, sampleCount: null, powerCoverage: null, ...evidence, facets }, blockerIds: [] }
}
function limitations(record: CoverageRecord, descriptions: readonly string[], ref: string, origin: CoverageBlocker['origin'] = 'runtime'): CoverageBlocker[] {
  return descriptions.map((description, index) => ({
    id: `${recordKey(record)}:${origin}:${index}`, label: record.label, categories: [record.category], recordKeys: [recordKey(record)],
    kind: 'unclassified', priority: null, origin, description, closeCondition: null, sourceRefs: [ref], supportContext: record.runtimeSupport,
  }))
}
const counts = (values: readonly string[]): Record<string, number> => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))

function attackProfiles(): CoverageAdapter {
  const records = attackAudit.weapons.map((entry, index) => record('melee-attack-profile', entry.weaponId, entry.name.en,
    // Profile completeness is evidence, not a weapon runtime support manifest.
    'unknown', null, [facet(pointer(paths.attack, 'weapons', index), entry)],
    { confidence: entry.confidence, verificationStatus: entry.status, gameVersion: attackAudit.gameVersion }))
  return { category: 'melee-attack-profile', label: 'Melee attack profile', populationDefinition: 'Obtainable melee weapons; attack-profile audit, not an equipment runtime manifest.', sourceRefs: [paths.attack], records,
    blockers: records.flatMap((item, index) => attackAudit.weapons[index]!.status === 'exact' || attackAudit.weapons[index]!.status === 'verified-shared' ? [] : limitations(item, [`Attack profile status: ${attackAudit.weapons[index]!.status}`], pointer(paths.attack, 'weapons', index), 'audit')),
    details: { profileStatuses: counts(attackAudit.weapons.map((entry) => entry.status)), runtimeClassification: 'unknown: no weapon Full/Limited manifest', powerCoverage: 'not-applicable: attack timing audit' } }
}
function meleeEnchantments(): CoverageAdapter {
  const records = meleeAudit.entries.map((entry, index) => {
    const support = requireEntry(meleeSupport.entries, entry.id)
    return record('melee-enchantment', entry.id, entry.name.en, supportState(support.supportLevel), pointer(paths.meleeSupport, 'entries', meleeSupport.entries.indexOf(support)),
      [facet(pointer(paths.melee, 'entries', index), entry), facet(pointer(paths.meleeSupport, 'entries', meleeSupport.entries.indexOf(support)), support)],
      { confidence: entry.confidence, gameVersion: meleeAudit.gameVersion, powerCoverage: { runtimePowerRange: support.runtimePowerRange, scope: support.supportLevel === 'research-only' ? 'not-applicable' : support.runtimePowerRange === null ? 'broad-within-runtime-scope' : 'bounded' } })
  })
  return { category: 'melee-enchantment', label: 'Melee enchantment', populationDefinition: meleeAudit.population.definition, sourceRefs: [paths.melee, paths.meleeSupport], records,
    blockers: records.flatMap((item) => item.runtimeSupport === 'full' ? [] : limitations(item, requireEntry(meleeSupport.entries, item.id).reasons, item.runtimeSourceRef!)),
    details: { powerLimited: meleeSupport.entries.filter((entry) => entry.runtimePowerRange !== null).length, broadPowerRuntime: meleeSupport.entries.filter((entry) => entry.supportLevel !== 'research-only' && entry.runtimePowerRange === null).length } }
}
function artifacts(): CoverageAdapter {
  const entries = [...artifactAudit.entries, ...artifactAudit.populationDifferences]
  const records = entries.map((entry) => {
    const primaryIndex = artifactAudit.entries.findIndex((item) => item.id === entry.id)
    const ref = primaryIndex >= 0 ? pointer(paths.artifact, 'entries', primaryIndex) : pointer(paths.artifact, 'populationDifferences', artifactAudit.populationDifferences.findIndex((item) => item.id === entry.id))
    const support = requireEntry(artifactSupport.entries, entry.id)
    const facets = [facet(ref, entry), facet(pointer(paths.artifactSupport, 'entries', artifactSupport.entries.indexOf(support)), support)]
    const decision = artifactDecisions.candidates.find((item) => item.id === entry.id)
    if (decision) facets.push(facet(pointer(paths.decisions, 'candidates', artifactDecisions.candidates.indexOf(decision)), decision))
    const samples = artifactSamples.samples.filter((sample) => sample.artifactId === entry.id)
    for (const sample of samples) facets.push(facet(pointer(paths.samples, 'samples', artifactSamples.samples.indexOf(sample)), sample))
    const raw = entry as { confidence?: string; powerScaling?: JsonValue }
    return record('artifact', entry.id, entry.name, supportState(support.supportLevel), pointer(paths.artifactSupport, 'entries', artifactSupport.entries.indexOf(support)), facets,
      { confidence: raw.confidence ?? null, gameVersion: entry.gameVersion, sampleCount: samples.length,
        powerCoverage: { publishedSnapshotPowers: [...new Set(samples.flatMap((sample) => typeof sample.power === 'number' ? [sample.power] : []))].sort((a, b) => a - b), highPowerReady: decision?.highPowerReady ?? null, auditPowerScaling: raw.powerScaling ?? null, sampleScope: '2-2E snapshot rows; not independent verified gameplay runs' } })
  })
  const blockers: CoverageBlocker[] = records.flatMap((item) => item.runtimeSupport === 'full' ? [] : limitations(item, requireEntry(artifactSupport.entries, item.id).reasons, item.runtimeSourceRef!))
  artifactDecisions.candidates.forEach((candidate, index) => {
    if (candidate.evidenceStop === 'public-evidence-exhausted') blockers.push({ id: `artifact:${candidate.id}:acquisition`, label: candidate.name, categories: ['artifact'], recordKeys: [`artifact:${candidate.id}`], kind: 'evidence-blocked', priority: null, origin: 'acquisition', description: [candidate.previousBlocker, candidate.newEvidence, ...candidate.otherBlockers].join('; '), closeCondition: null, sourceRefs: [pointer(paths.decisions, 'candidates', index), 'docs/artifact-expansion-plan.md'], supportContext: requireEntry(artifactSupport.entries, candidate.id).supportLevel })
  })
  return { category: 'artifact', label: 'Artifact', populationDefinition: artifactAudit.populationReconciliation.populationDefinition, sourceRefs: [paths.artifact, paths.artifactSupport, paths.decisions, paths.samples, paths.artifactSources, paths.curves], records, blockers,
    details: { publicEvidenceConclusion: artifactCurves.publicEvidenceConclusion, acquisition: artifactDecisions.candidates, conflicts: artifactDecisions.conflicts, hypotheses: artifactCurves.hypotheses, sampleScope: 'public snapshot includes historic / version-unresolved values; sample count is not verification' } }
}
function armors(): CoverageAdapter {
  const records = armorAudit.entries.map((entry, index) => {
    const support = requireEntry(armorSupport.entries, entry.id)
    return record('armor', entry.id, entry.name, supportState(support.supportLevel), pointer(paths.armorSupport, 'entries', armorSupport.entries.indexOf(support)),
      [facet(pointer(paths.armor, 'entries', index), entry), facet(pointer(paths.armorSupport, 'entries', armorSupport.entries.indexOf(support)), support)],
      { gameVersion: entry.gameVersion, powerCoverage: entry.healthEvidence })
  })
  return { category: 'armor', label: 'Armor', populationDefinition: 'Known Armor 73 / obtainable 71; excludes Soul Mage Robe file remnant.', sourceRefs: [paths.armor, paths.armorSupport, paths.armorHealth], records,
    blockers: records.flatMap((item) => limitations(item, [...requireEntry(armorSupport.entries, item.id).reasons, ...requireEntry(armorSupport.entries, item.id).boundaries], item.runtimeSourceRef!)),
    details: { healthCoverage: armorHealth.coverage, healthCurve: armorHealth.commonCurveHypothesis, runtimeHealthPolicy: armorHealth.runtimePolicy } }
}
function armorEnchantments(): CoverageAdapter {
  const runtime = Object.values(ARMOR_ENCHANTMENTS)
  const records = armorEnchantAudit.entries.map((entry, index) => {
    const live = runtime.find((item) => item.id === entry.id)
    return record('armor-enchantment', entry.id, entry.name, live ? live.supportLevel : 'research-only', 'src/data/armors.ts',
      [facet(pointer(paths.armorEnchant, 'entries', index), entry), ...(live ? [facet('src/data/armors.ts', live as unknown as JsonValue)] : [])], { gameVersion: armorEnchantAudit.gameVersion, powerCoverage: 'not-applicable: tier/state mechanics' })
  })
  return { category: 'armor-enchantment', label: 'Armor enchantment', populationDefinition: 'Hero-accessible Armor enchantments; actual roll catalog includes research-only entries.', sourceRefs: [paths.armorEnchant, paths.armorCore, paths.armorExpansion, 'src/data/armors.ts'], records,
    // The initial audit contains pre-implementation blockers. Keep them as evidence, not active blockers for promoted entries.
    blockers: records.flatMap((item) => item.runtimeSupport === 'research-only' ? limitations(item, requireEntry(armorEnchantAudit.entries, item.id).blockers, pointer(paths.armorEnchant, 'entries', armorEnchantAudit.entries.findIndex((entry) => entry.id === item.id))) : []),
    details: { runtimeDecisions: armorCore.decisions, cooldownStacking: armorExpansion.cooldownStacking, stateEnchantments: armorExpansion.armorEnchantments } }
}
function regression(): CoverageAdapter {
  const records = dpsAudit.entries.map((entry, index) => record('dps-regression', entry.id, entry.source.label, 'not-applicable', null,
    [facet(pointer(paths.dps, 'entries', index), entry)], { confidence: entry.confidence, verificationStatus: entry.eligibleForRegression ? 'eligible' : 'rejected', gameVersion: entry.gameVersion ?? null, powerCoverage: 'not-applicable: observed card damage required' }))
  return { category: 'dps-regression', label: 'Phase 1 DPS regression', populationDefinition: 'Public audit candidates. The minimum independent eligible run count is a separate denominator.', sourceRefs: [paths.dps, 'docs/model-regression.md', 'src/core/modelError.ts'], records, blockers: [],
    details: { eligibleCount: dpsAudit.entries.filter((entry) => entry.eligibleForRegression).length, minimumSamples: MINIMUM_MODEL_ERROR_SAMPLES, rejectedCount: dpsAudit.entries.filter((entry) => !entry.eligibleForRegression).length, versionConfidence: counts(dpsAudit.entries.map((entry) => entry.gameVersionConfidence)), eligibilityPolicy: dpsAudit.eligibilityPolicy } }
}

/** Add a category adapter here without touching combat evaluation or the inventory schema. */
function ranged(category: 'ranged-weapon' | 'ranged-enchantment'): CoverageAdapter {
  const weapon = category === 'ranged-weapon'
  const audit = weapon ? RANGED_WEAPON_AUDIT : RANGED_ENCHANTMENT_AUDIT
  const path = weapon ? paths.ranged : paths.rangedEnchant
  const runtimePath = 'src/data/ranged.ts'
  const records = audit.entries.map((entry, index) => record(category, entry.id, entry.name.en, supportState(entry.supportLevel), runtimePath,
    [facet(pointer(path, 'entries', index), entry)], { confidence: entry.confidence, gameVersion: entry.gameVersion,
      verificationStatus: entry.currentVersionApplicability, sampleCount: weapon ? RANGED_WEAPON_AUDIT.selection.independentMeasuredRuns : null,
      powerCoverage: weapon ? { policy: 'user-observed neutral projectile damage + complete cycle; no Power fallback', curveAvailable: false } : { policy: 'tier mechanics, ranged-specific, no melee reuse' } }))
  return { category, label: weapon ? 'Ranged weapon / attack profile' : 'Ranged enchantment', populationDefinition: audit.population.definition,
    sourceRefs: [path, 'research/ranged-source-snapshot.json', runtimePath], records,
    blockers: records.flatMap((item, index) => limitations(item, audit.entries[index]!.blockers, pointer(path, 'entries', index))),
    details: { populationReconciliation: audit.population, taxonomyScope: 'Weapon audit owns projectile/attack/intrinsic facts; no duplicate profile denominator.', phaseStatus: 'partial', independentGameVerification: false } }
}
export function buildCoverageAdapters(): readonly CoverageAdapter[] {
  return [attackProfiles(), meleeEnchantments(), artifacts(), armors(), armorEnchantments(), regression(), ranged('ranged-weapon'), ranged('ranged-enchantment')]
}
export const COVERAGE_SOURCE_DOCUMENTS: Readonly<Record<string, JsonValue>> = {
  [paths.attack]: attackAudit, [paths.melee]: meleeAudit, [paths.meleeSupport]: meleeSupport,
  [paths.artifact]: artifactAudit, [paths.artifactSupport]: artifactSupport, [paths.decisions]: artifactDecisions, [paths.samples]: artifactSamples, [paths.artifactSources]: artifactSources, [paths.curves]: artifactCurves,
  [paths.armor]: armorAudit, [paths.armorSupport]: armorSupport, [paths.armorHealth]: armorHealth, [paths.armorEnchant]: armorEnchantAudit, [paths.armorCore]: armorCore, [paths.armorExpansion]: armorExpansion, [paths.dps]: dpsAudit,
  [paths.ranged]: RANGED_WEAPON_AUDIT, [paths.rangedEnchant]: RANGED_ENCHANTMENT_AUDIT,
}

/** Independent source-to-adapter membership checks catch dropped/extra entries before aggregation. */
export function collectAdapterSourceErrors(adapters: readonly CoverageAdapter[]): string[] {
  const populations = {
    'melee-attack-profile': attackAudit.weapons.map((entry) => ({ id: entry.weaponId, support: 'unknown' })),
    'melee-enchantment': meleeSupport.entries.map((entry) => ({ id: entry.id, support: entry.supportLevel })),
    artifact: artifactSupport.entries.map((entry) => ({ id: entry.id, support: entry.supportLevel })),
    armor: armorSupport.entries.map((entry) => ({ id: entry.id, support: entry.supportLevel })),
    'armor-enchantment': armorEnchantAudit.entries.map((entry) => ({ id: entry.id, support: Object.values(ARMOR_ENCHANTMENTS).find((item) => item.id === entry.id)?.supportLevel ?? 'research-only' })),
    'dps-regression': dpsAudit.entries.map((entry) => ({ id: entry.id, support: 'not-applicable' })),
    'ranged-weapon': RANGED_WEAPON_AUDIT.entries.map((entry) => ({ id: entry.id, support: Object.hasOwn(RANGED_WEAPONS, entry.id) ? 'limited' : 'research-only' })),
    'ranged-enchantment': RANGED_ENCHANTMENT_AUDIT.entries.map((entry) => ({ id: entry.id, support: Object.hasOwn(RANGED_ENCHANTMENTS, entry.id) ? 'limited' : 'research-only' })),
  }
  const errors: string[] = []
  for (const [category, entries] of Object.entries(populations)) {
    const adapter = adapters.find((item) => item.category === category)
    if (!adapter) { errors.push(`Missing adapter ${category}`); continue }
    const normalize = (rows: { id: string; support: string }[]) => JSON.stringify(rows.sort((a, b) => a.id.localeCompare(b.id, 'en')))
    if (normalize(entries) !== normalize(adapter.records.map((entry) => ({ id: entry.id, support: entry.runtimeSupport })))) errors.push(`${category}: adapter population/support does not match its source`)
  }
  return errors
}
