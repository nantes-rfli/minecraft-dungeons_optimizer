import armorAuditJson from '../../research/armor-audit.json'
import armorHealthAuditJson from '../../research/armor-health-audit.json'
import armorSupportJson from '../../research/armor-runtime-support.json'
import { ARMOR_INTRINSIC_PROPERTY_KINDS } from '../core/armor'
import { ARMORS } from '../data/armors'

export const ARMOR_RUNTIME_READINESS = [
  'ready', 'ready-with-observed-health', 'needs-health-model', 'needs-state-model',
  'needs-pet-model', 'needs-roll-model', 'needs-party-model', 'needs-ranged-model',
  'needs-objective', 'research-only',
] as const
export const ARMOR_SUPPORT_LEVELS = ['full', 'limited', 'research-only'] as const
export const ARMOR_AUDIT = armorAuditJson
export const ARMOR_HEALTH_AUDIT = armorHealthAuditJson
export const ARMOR_RUNTIME_SUPPORT = armorSupportJson

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function collectArmorAuditErrors(value: unknown = ARMOR_AUDIT): string[] {
  if (!record(value)) return ['Armor audit must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0' && value.phaseStatus === 'complete', 'invalid Armor audit schema/version/status')
  if (!Array.isArray(value.sources) || !Array.isArray(value.entries)) return [...errors, 'Armor sources and entries must be arrays']
  const sourceIds = new Set<string>()
  for (const source of value.sources) {
    if (!record(source) || typeof source.id !== 'string') { errors.push('Armor source must have an ID'); continue }
    check(!sourceIds.has(source.id), `duplicate Armor source ${source.id}`)
    sourceIds.add(source.id)
    check(typeof source.url === 'string' && source.url.startsWith('https://') && source.accessedAt === value.auditedAt && typeof source.note === 'string', `${source.id}: incomplete source provenance`)
  }
  const refs = (input: unknown, label: string) => check(strings(input) && input.every((id) => sourceIds.has(id)), `${label}: missing or unknown source ID`)
  const reconciliation = value.populationReconciliation
  check(record(reconciliation), 'Armor population reconciliation missing')
  if (record(reconciliation)) {
    check(reconciliation.primarySourceCount === 71 && reconciliation.secondaryKnownCount === 73 && reconciliation.secondaryObtainableCount === 71 && reconciliation.projectPopulationCount === 73, 'Armor population counts drift')
    check(reconciliation.exhaustiveRawGameIdClaim === false, 'raw game ID exhaustiveness must not be claimed')
    check(Array.isArray(reconciliation.commonIds) && reconciliation.commonIds.length === 71, 'Armor common set must contain 71 IDs')
    check(Array.isArray(reconciliation.primaryOnly) && reconciliation.primaryOnly.length === 0, 'unexpected primary-only Armor')
    check(Array.isArray(reconciliation.secondaryOnly) && reconciliation.secondaryOnly.length === 2, 'secondary-only Armor count drift')
    if (Array.isArray(reconciliation.secondaryOnly)) check(reconciliation.secondaryOnly.map((item) => record(item) ? item.id : '').sort().join('|') === 'ender-armor|vanguard-armor', 'secondary-only Armor IDs drift')
    check(Array.isArray(reconciliation.scopeExclusions) && reconciliation.scopeExclusions.some((item) => record(item) && item.id === 'soul-mage-robe'), 'Soul Mage Robe scope exclusion missing')
  }
  check(value.entries.length === 73, 'Armor project population must contain 73 entries')
  check(value.entries.filter((entry) => record(entry) && entry.obtainable === true).length === 71, 'Armor obtainable count drift')
  check(value.entries.filter((entry) => record(entry) && entry.rarity === 'unique').length === 41, 'Armor unique count drift')
  check(value.entries.filter((entry) => record(entry) && entry.eventExclusive === true).length === 7, 'Armor event-exclusive count drift')
  const ids = new Set<string>()
  const builtInRefs: { armorId: string; enchantmentId: string; classification: unknown }[] = []
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string') { errors.push('Armor entry must have an ID'); continue }
    const id = entry.id
    check(!ids.has(id), `${id}: duplicate Armor ID`); ids.add(id)
    check(entry.gameVersion === '1.17.0.0' && typeof entry.name === 'string' && typeof entry.family === 'string' && typeof entry.levelId === 'string', `${id}: invalid identity`)
    check(['common', 'rare', 'unique'].includes(String(entry.rarity)) && typeof entry.obtainable === 'boolean' && typeof entry.eventExclusive === 'boolean' && typeof entry.contentPack === 'string' && typeof entry.soulGear === 'boolean', `${id}: invalid classification`)
    check((ARMOR_RUNTIME_READINESS as readonly unknown[]).includes(entry.runtimeReadiness), `${id}: invalid runtime readiness`)
    check(strings(entry.blockers) && entry.blockers.length > 0, `${id}: blockers required before runtime catalog exists`)
    refs(entry.sourceIds, id)
    check(record(entry.inheritance) && Array.isArray(entry.inheritance.inheritedProperties) && Array.isArray(entry.inheritance.uniqueOnlyProperties), `${id}: inheritance split missing`)
    if (record(entry.inheritance)) {
      const inherited = new Set((entry.inheritance.inheritedProperties as unknown[]).map(String))
      check((entry.inheritance.uniqueOnlyProperties as unknown[]).every((property) => !inherited.has(String(property))), `${id}: inherited and unique-only properties overlap`)
      check(entry.inheritance.baseArmorId === null || typeof entry.inheritance.baseArmorId === 'string', `${id}: invalid base family reference`)
    }
    check(Array.isArray(entry.intrinsicProperties), `${id}: intrinsic properties missing`)
    if (Array.isArray(entry.intrinsicProperties)) for (const property of entry.intrinsicProperties) {
      check(record(property) && (ARMOR_INTRINSIC_PROPERTY_KINDS as readonly unknown[]).includes(property.kind) && typeof property.raw === 'string' && ['base', 'inherited', 'unique-only'].includes(String(property.ownership)), `${id}: invalid intrinsic property`)
      if (record(property)) refs(property.sourceIds, `${id}/${String(property.raw)}`)
    }
    check(Array.isArray(entry.builtInEnchantments), `${id}: built-in enchantments missing`)
    if (Array.isArray(entry.builtInEnchantments)) for (const builtIn of entry.builtInEnchantments) {
      check(record(builtIn) && typeof builtIn.enchantmentId === 'string' && [1, 2, 3].includes(Number(builtIn.tier)) && ['armor-enchantment', 'intrinsic-only'].includes(String(builtIn.classification)), `${id}: invalid built-in enchantment`)
      if (record(builtIn)) {
        refs(builtIn.sourceIds, `${id}/${String(builtIn.enchantmentId)}`)
        builtInRefs.push({ armorId: id, enchantmentId: String(builtIn.enchantmentId), classification: builtIn.classification })
      }
    }
    check(record(entry.healthEvidence) && typeof entry.healthEvidence.policy === 'string' && entry.healthEvidence.publishedCurveSupported === false, `${id}: invalid health evidence policy`)
    if (record(entry.healthEvidence)) refs(entry.healthEvidence.sourceIds, `${id}/health`)
    if (id === 'mystery-armor') check(record(entry.mysteryArmor) && entry.mysteryArmor.fixedPropertySet === false && entry.mysteryArmor.actualIntrinsicRollsRequired === true && entry.runtimeReadiness === 'needs-roll-model', 'Mystery Armor random-roll contract missing')
  }
  for (const entry of value.entries) if (record(entry) && record(entry.inheritance) && typeof entry.inheritance.baseArmorId === 'string') check(ids.has(entry.inheritance.baseArmorId), `${entry.id}: unknown base Armor ID`)
  for (const id of ['renegade-armor', 'wither-armor', 'battle-robe', 'splendid-robe', 'evocation-robe', 'hero-s-armor']) {
    const entry = value.entries.find((item) => record(item) && item.id === id)
    check(record(entry) && record(entry.deepAudit) && Array.isArray(entry.deepAudit.intrinsicPropertyKinds) && Array.isArray(entry.deepAudit.subsystemReuse), `${id}: deep audit missing`)
  }
  check(builtInRefs.some((item) => item.classification === 'intrinsic-only'), 'intrinsic-only built-in classification missing')
  return errors
}

export function collectArmorHealthAuditErrors(value: unknown = ARMOR_HEALTH_AUDIT): string[] {
  if (!record(value)) return ['Armor health audit must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0', 'invalid Armor health schema/version')
  if (!Array.isArray(value.sources)) return [...errors, 'Armor health sources must be an array']
  const sourceIds = new Set(value.sources.filter(record).map((source) => String(source.id)))
  const refs = (input: unknown, label: string) => check(strings(input) && input.every((id) => sourceIds.has(id)), `${label}: invalid health source refs`)
  check(record(value.baseHeroHealth) && value.baseHeroHealth.value === 100, 'base Hero health must be 100')
  if (record(value.baseHeroHealth)) refs(value.baseHeroHealth.sourceIds, 'baseHeroHealth')
  check(record(value.publishedTable) && Array.isArray(value.publishedTable.rows) && value.publishedTable.rows.length === 23, 'canonical Armor health table must contain 23 rows')
  if (record(value.publishedTable) && Array.isArray(value.publishedTable.rows)) {
    let previous = 0
    for (const row of value.publishedTable.rows) {
      check(record(row) && finite(row.power) && row.power > previous && finite(row.minHealthBonus) && finite(row.maxHealthBonus) && row.minHealthBonus <= row.maxHealthBonus, 'invalid Armor health table row')
      if (record(row) && finite(row.power)) previous = row.power
    }
    check(Array.isArray(value.publishedTable.conflicts) && value.publishedTable.conflicts.length > 0, 'Armor health source conflict must be preserved')
  }
  check(Array.isArray(value.endgameObservations) && value.endgameObservations.length === 3, 'three exact endgame observations required')
  if (Array.isArray(value.endgameObservations)) for (const observation of value.endgameObservations) {
    check(record(observation) && observation.power === 251 && finite(observation.observedHealthBonus) && observation.observedHealthBonus > 0, 'invalid endgame Armor health observation')
    if (record(observation)) refs(observation.sourceIds, `health/${String(observation.armorId)}`)
  }
  check(record(value.coverage) && value.coverage.sampleCount === 27 && value.coverage.minPower === 1 && value.coverage.maxPower === 251 && value.coverage.endgameSampleCount === 3, 'Armor health coverage drift')
  check(record(value.samePowerVariance) && value.samePowerVariance.power === 251 && value.samePowerVariance.spread === 27418, 'same-Power variance evidence drift')
  check(record(value.commonCurveHypothesis) && value.commonCurveHypothesis.status === 'low-power-agreement-only' && value.commonCurveHypothesis.extrapolationAllowed === false, 'health curve gate must forbid endgame extrapolation')
  check(record(value.runtimePolicy) && Array.isArray(value.runtimePolicy.priority) && value.runtimePolicy.priority.join('|') === 'armor-observed|armor-model-within-validated-range|unsupported' && value.runtimePolicy.modelFallbackAvailable === false && value.runtimePolicy.noMidpointImputation === true, 'observed health priority drift')
  check(record(value.scenarioMigration) && value.scenarioMigration.mutuallyExclusiveWithArmorRoute === true && Array.isArray(value.scenarioMigration.terms) && value.scenarioMigration.terms.length === 4, 'Scenario.maxHealth migration contract missing')
  return errors
}

export function collectArmorSupportErrors(value: unknown = ARMOR_RUNTIME_SUPPORT, audit: typeof ARMOR_AUDIT = ARMOR_AUDIT): string[] {
  if (!record(value)) return ['Armor runtime support must be an object']
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === audit.gameVersion && value.population === 73, 'Armor support schema/population mismatch')
  if (!Array.isArray(value.entries)) return [...errors, 'Armor support entries must be an array']
  check(value.entries.length === audit.entries.length, 'Armor support entry count drift')
  const ids = new Set<string>()
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string') { errors.push('Armor support entry must have ID'); continue }
    check(!ids.has(entry.id), `${entry.id}: duplicate Armor support ID`); ids.add(entry.id)
    const audited = audit.entries.find((item) => item.id === entry.id)
    check(Boolean(audited) && audited?.name === entry.name, `${entry.id}: Armor audit/support metadata mismatch`)
    check((ARMOR_SUPPORT_LEVELS as readonly unknown[]).includes(entry.supportLevel), `${entry.id}: invalid Armor support level`)
    const runtime = entry.id in ARMORS
    check(entry.supportLevel === (runtime ? 'limited' : 'research-only'), `${entry.id}: Armor runtime support level mismatch`)
    const boundaries = Array.isArray(entry.boundaries) ? entry.boundaries : []
    check(strings(entry.reasons) && Array.isArray(entry.boundaries), `${entry.id}: support reasons/boundaries missing`)
    if (runtime) check(boundaries.length > 0, `${entry.id}: Limited Armor requires explicit boundaries`)
    else check(JSON.stringify(entry.reasons) === JSON.stringify(audited?.blockers) && boundaries.length === 0, `${entry.id}: research support reasons/boundaries mismatch`)
  }
  for (const entry of audit.entries) check(ids.has(entry.id), `${entry.id}: missing Armor support entry`)
  check(record(value.nextBatch) && Array.isArray(value.nextBatch.armorIds) && value.nextBatch.armorIds.join('|') === 'battle-robe|renegade-armor|wither-armor' && Array.isArray(value.nextBatch.armorEnchantmentIds) && value.nextBatch.armorEnchantmentIds.join('|') === 'cool-down|potion-barrier|chilling', 'Phase 2-3B selection drift')
  check(value.entries.filter((entry) => record(entry) && entry.supportLevel === 'limited').length === Object.keys(ARMORS).length, 'runtime Armor count drift')
  return errors
}

export function summarizeArmorAudit() {
  const entries = ARMOR_AUDIT.entries
  const propertyKinds = Object.fromEntries([...new Set(entries.flatMap((entry) => entry.intrinsicProperties.map((property) => property.kind)))].sort().map((kind) => [kind, entries.filter((entry) => entry.intrinsicProperties.some((property) => property.kind === kind)).length]))
  const readiness = Object.fromEntries([...new Set(entries.map((entry) => entry.runtimeReadiness))].sort().map((status) => [status, entries.filter((entry) => entry.runtimeReadiness === status).length]))
  return { population: entries.length, obtainable: entries.filter((entry) => entry.obtainable).length, eventExclusive: entries.filter((entry) => entry.eventExclusive).length, propertyKinds, readiness }
}

export function armorRuntimeSupportSummaryText() {
  const entries = ARMOR_RUNTIME_SUPPORT.entries
  const full = entries.filter((entry) => entry.supportLevel === 'full').length
  const limited = entries.filter((entry) => entry.supportLevel === 'limited').length
  return `Armor · Audited population ${entries.length} · Catalog runtime ${full + limited} / ${entries.length} · Full ${full} · Limited ${limited} · Research-only ${entries.length - full - limited}`
}
