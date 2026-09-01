import auditJson from '../../research/artifact-audit.json'
import { ARTIFACTS } from '../data/artifacts'
import { ARTIFACT_MECHANIC_FAMILIES } from '../core/artifactMechanics'
import { RUNTIME_SUPPORT_LEVELS } from '../core/runtimeSupport'

export const ARTIFACT_READINESS = ['ready', 'ready-with-limits', 'needs-power-curve', 'needs-state-model', 'needs-target-model', 'needs-soul-model', 'needs-objective', 'research-only'] as const
export const ARTIFACT_AUDIT = auditJson
export type ArtifactAudit = typeof auditJson
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const confidence = (value: unknown) => ['high', 'medium', 'low'].includes(String(value))
const factStatuses = ['known', 'reported', 'unknown', 'not-applicable', 'conflicting', 'assumption']

export function collectArtifactAuditErrors(value: unknown): string[] {
  if (!record(value)) return ['artifact audit must be an object']
  const errors: string[] = []
  const check = (valid: boolean, message: string) => { if (!valid) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === '1.17.0.0', 'invalid audit schema/version')
  check(value.population === 44 && Array.isArray(value.entries) && value.entries.length === 44, 'primary source population must be 44')
  check(typeof value.populationScope === 'string' && value.populationScope.includes('NOT a verified exhaustive'), 'source population scope must preserve completeness caveat')
  check(value.phaseStatus === 'complete' && Array.isArray(value.completionBlockers) && value.completionBlockers.length === 0, 'reconciled Phase 2-2A must be complete')
  if (!Array.isArray(value.sources) || !Array.isArray(value.entries)) return [...errors, 'sources and entries must be arrays']
  const sourceIds = new Set<string>()
  for (const source of value.sources) {
    if (!record(source) || typeof source.id !== 'string') { errors.push('source must have id'); continue }
    check(!sourceIds.has(source.id), `duplicate source ${source.id}`)
    sourceIds.add(source.id)
    check(typeof source.url === 'string' && /^https:\/\//.test(source.url), `${source.id}: source URL missing`)
    check(typeof source.title === 'string' && typeof source.note === 'string' && typeof source.retrieval === 'string', `${source.id}: source provenance missing`)
    check(source.accessedAt === value.auditedAt && typeof source.gameVersion === 'string', `${source.id}: source date/version missing`)
  }
  function refs(input: unknown, label: string): void {
    check(strings(input) && input.length > 0 && input.every((id) => sourceIds.has(id)), `${label}: missing/unknown source`)
  }
  function walkSources(input: unknown, label: string): void {
    if (Array.isArray(input)) { input.forEach((item, i) => walkSources(item, `${label}/${i}`)); return }
    if (!record(input)) return
    for (const [key, item] of Object.entries(input)) {
      if (key === 'sourceIds') refs(item, label)
      else walkSources(item, `${label}/${key}`)
    }
  }
  const ids = new Set<string>()
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id.trim()) { errors.push('artifact entry must have id'); continue }
    const id = entry.id
    check(!ids.has(id), `${id}: duplicate artifact id`); ids.add(id)
    check(entry.gameVersion === '1.17.0.0' && typeof entry.name === 'string', `${id}: invalid name/version`)
    check((ARTIFACT_MECHANIC_FAMILIES as readonly unknown[]).includes(entry.mechanicFamily), `${id}: invalid mechanic family`)
    check((ARTIFACT_READINESS as readonly unknown[]).includes(entry.runtimeReadiness), `${id}: invalid runtimeReadiness`)
    check(confidence(entry.confidence), `${id}: invalid confidence`)
    check(typeof entry.obtainable === 'boolean' && typeof entry.eventExclusive === 'boolean' && typeof entry.unique === 'boolean' && typeof entry.obsolete === 'boolean' && typeof entry.contentPack === 'string' && typeof entry.reportedContentPack === 'string', `${id}: invalid availability/pack metadata`)
    check(entry.reskinOf === null || (typeof entry.reskinOf === 'string' && entry.reskinOf !== id && value.entries.some((other) => record(other) && other.id === entry.reskinOf)), `${id}: invalid reskin parent`)
    check(strings(entry.blockers), `${id}: blockers must be strings`)
    refs(entry.sourceIds, id)
    for (const key of ['duration', 'targeting', 'interactions', 'obtainability']) {
      const fact = entry[key]
      check(record(fact) && factStatuses.includes(String(fact.status)) && typeof fact.note === 'string' && fact.note.length > 0 && confidence(fact.confidence), `${id}: invalid ${key} evidence`)
      if (record(fact)) refs(fact.sourceIds, `${id}/${key}`)
    }
    const cd = entry.cooldown
    if (record(cd)) refs(cd.sourceIds, `${id}/cooldown`)
    check(record(cd) && positive(cd.seconds) && ['reported', 'known', 'conflicting'].includes(String(cd.status)) && ['use', 'deactivation', 'use-or-effect-specific'].includes(String(cd.starts)) && typeof cd.reduction === 'string' && confidence(cd.confidence), `${id}: invalid cooldown semantics`)
    if (record(cd) && cd.status === 'conflicting') check(Array.isArray(cd.alternativeSeconds) && cd.alternativeSeconds.length > 0 && cd.alternativeSeconds.every(positive), `${id}: conflicting cooldown requires alternatives`)
    const scaling = entry.powerScaling
    if (record(scaling)) refs(scaling.sourceIds, `${id}/powerScaling`)
    check(record(scaling) && ['none', 'duration-only', 'damage', 'healing', 'range', 'soul-efficiency', 'multi-stat'].includes(String(scaling.kind)) && record(scaling.quality), `${id}: invalid power scaling`)
    if (record(scaling) && record(scaling.quality)) {
      const q = scaling.quality
      check(Number.isInteger(q.publishedSampleCount) && Number(q.publishedSampleCount) >= 0 && Number.isInteger(q.runtimeEligibleSampleCount) && Number(q.runtimeEligibleSampleCount) >= 0 && Number(q.runtimeEligibleSampleCount) <= Number(q.publishedSampleCount), `${id}: invalid sample count`)
      check(q.publishedSampleCount === 0 ? q.minPower === null && q.maxPower === null : positive(q.minPower) && positive(q.maxPower) && q.minPower <= q.maxPower, `${id}: invalid sample Power bounds`)
      check(q.extrapolationAllowed === false && typeof q.interpolationCandidate === 'boolean' && typeof q.version === 'string' && typeof q.randomRollRange === 'string', `${id}: invalid curve provenance/extrapolation`)
    }
    const soul = entry.soul
    if (record(soul)) refs(soul.sourceIds, `${id}/soul`)
    check(record(soul) && typeof soul.required === 'boolean' && typeof soul.note === 'string', `${id}: invalid soul requirements`)
    if (record(soul)) {
      for (const key of ['gathering', 'costPerUse', 'costPerSecond']) check(soul[key] === null || positive(soul[key]), `${id}: unknown soul ${key} must be null, not fake zero`)
      if (soul.required === false) check(soul.costPerUse === null && soul.costPerSecond === null, `${id}: non-soul artifact cannot have soul cost`)
    }
    const stacking = entry.stacking
    check(record(stacking) && ['duplicateEquip', 'magnitude', 'lifetime', 'sharedState', 'note'].every((key) => typeof stacking[key] === 'string') && confidence(stacking.confidence), `${id}: invalid stacking semantics`)
    if (record(stacking)) refs(stacking.sourceIds, `${id}/stacking`)
    check(record(entry.deepAudit), `${id}: deepAudit must be object`)
    if (record(entry.deepAudit)) for (const [key, fact] of Object.entries(entry.deepAudit)) {
      check(record(fact) && factStatuses.includes(String(fact.status)) && typeof fact.note === 'string' && confidence(fact.confidence), `${id}: invalid deep audit ${key}`)
      if (record(fact)) refs(fact.sourceIds, `${id}/deepAudit/${key}`)
    }
    const runtime = Object.values(ARTIFACTS).find((artifact) => artifact.id === id)
    if (runtime) {
      check(entry.runtimeReadiness === 'ready' && strings(entry.blockers) && entry.blockers.length === 0, `${id}: current runtime readiness mismatch`)
      check(entry.mechanicFamily === runtime.mechanic && entry.name === runtime.name.en && record(cd) && cd.seconds === runtime.cooldownSeconds.value, `${id}: runtime catalog metadata mismatch`)
      if (runtime.mechanic === 'timed-self-buff') {
        check(record(entry.stacking) && entry.stacking.lifetime === 'refresh-stagger' && runtime.stacking.value.maxCopies === 3 && runtime.stacking.value.behavior === 'refresh', `${id}: runtime stacking mismatch`)
      } else {
        check(id === 'shock-powder' && record(entry.stacking) && entry.stacking.lifetime === 'runtime-one-copy-only' && runtime.stacking.value.maxCopies === 1 && runtime.stacking.value.behavior === 'non-stackable', `${id}: limited control stacking mismatch`)
      }
    } else check(strings(entry.blockers) && entry.blockers.length > 0 && entry.runtimeReadiness !== 'ready', `${id}: unimplemented artifact requires blockers`)
    walkSources(entry, id)
  }
  for (const id of Object.keys(ARTIFACTS)) check(ids.has(id), `${id}: runtime artifact missing from audit`)
  // Pin the observed index membership independently of display order and runtime IDs.
  check([...ids].sort().join('|') === auditJson.entries.map((entry) => entry.id).sort().join('|'), 'source index membership mismatch')
  for (const id of ['gong-of-weakening', 'soul-healer', 'powershaker', 'harvester', 'corrupted-beacon', 'totem-of-regeneration', 'fishing-rod', 'wind-horn']) {
    const entry = value.entries.find((item) => record(item) && item.id === id)
    check(record(entry) && record(entry.deepAudit) && Object.keys(entry.deepAudit).length >= 4, `${id}: missing deep audit`)
  }
  check(record(value.slotLimit) && value.slotLimit.value === 3, 'game slot limit must be 3')
  if (record(value.slotLimit)) refs(value.slotLimit.sourceIds, 'slotLimit')
  check(Array.isArray(value.populationDifferences) && value.populationDifferences.length > 0, 'population discrepancy must be tracked')
  if (Array.isArray(value.populationDifferences)) {
    check(value.populationDifferences.some((entry) => record(entry) && entry.id === 'corrupted-seeds' && entry.obtainable === true), 'missing Corrupted Seeds reconciliation')
    for (const entry of value.populationDifferences) check(record(entry) && typeof entry.id === 'string' && !ids.has(entry.id) && entry.gameVersion === '1.17.0.0' && strings(entry.blockers) && entry.blockers.length > 0, 'invalid supplemental population record')
    walkSources(value.populationDifferences, 'populationDifferences')
  }
  const reconciliation = value.populationReconciliation
  check(record(reconciliation), 'population reconciliation missing')
  if (record(reconciliation)) {
    const commonIds = reconciliation.commonIds
    check(reconciliation.primarySourceCount === 44 && reconciliation.secondarySourceCount === 45 && reconciliation.reconciledPopulationCount === 45, 'population reconciliation counts drift')
    check(strings(commonIds) && commonIds.length === 44 && commonIds.every((id) => ids.has(id)), 'population common ID set drift')
    check(Array.isArray(reconciliation.primaryOnly) && reconciliation.primaryOnly.length === 0, 'unexpected primary-only Artifact')
    check(Array.isArray(reconciliation.secondaryOnly) && reconciliation.secondaryOnly.length === 1 && record(reconciliation.secondaryOnly[0]) && reconciliation.secondaryOnly[0].normalizedProjectId === 'corrupted-seeds', 'secondary-only Artifact drift')
    check(reconciliation.exhaustiveClaimSupported === false && reconciliation.conclusion === 'source-scope-difference', 'population conclusion must preserve scope caveat')
    check(typeof reconciliation.populationDefinition === 'string' && typeof reconciliation.normalizationNote === 'string', 'population definition/normalization missing')
    walkSources(reconciliation, 'populationReconciliation')
  }
  return errors
}

export function collectArtifactSupportErrors(value: unknown, audit: ArtifactAudit = ARTIFACT_AUDIT): string[] {
  if (!record(value)) return ['artifact support manifest must be an object']
  const errors: string[] = []
  const check = (valid: boolean, message: string) => { if (!valid) errors.push(message) }
  check(value.schemaVersion === 1 && value.gameVersion === audit.gameVersion && value.population === audit.populationReconciliation.reconciledPopulationCount && value.populationScope === audit.populationScope, 'support schema/population mismatch')
  if (!Array.isArray(value.entries)) return [...errors, 'support entries must be an array']
  check(value.entries.length === audit.populationReconciliation.reconciledPopulationCount, 'support population mismatch')
  const ids = new Set<string>()
  const sources = new Set(audit.sources.map((source) => source.id))
  for (const entry of value.entries) {
    if (!record(entry) || typeof entry.id !== 'string') { errors.push('support entry must have id'); continue }
    const id = entry.id
    check(!ids.has(id), `${id}: duplicate support id`); ids.add(id)
    const mechanics = audit.entries.find((item) => item.id === id) ?? audit.populationDifferences.find((item) => item.id === id)
    check(Boolean(mechanics), `${id}: unknown audit id`)
    check((RUNTIME_SUPPORT_LEVELS as readonly unknown[]).includes(entry.supportLevel), `${id}: invalid support level`)
    check(entry.name === mechanics?.name && entry.mechanicFamily === mechanics?.mechanicFamily, `${id}: audit metadata mismatch`)
    check(strings(entry.reasons) && entry.reasons.length > 0 && strings(entry.boundaries) && strings(entry.assumptionRefs) && entry.assumptionRefs.length > 0, `${id}: reasons/boundaries/assumptions required`)
    check(strings(entry.sourceIds) && entry.sourceIds.length > 0 && entry.sourceIds.every((source) => sources.has(source)), `${id}: source missing`)
    const runtime = Object.keys(ARTIFACTS).includes(id)
    check(runtime === (entry.supportLevel === 'full' || entry.supportLevel === 'limited'), `${id}: full+limited must equal catalog; no research-only runtime`)
    if (runtime && id === 'shock-powder') check(entry.supportLevel === 'limited' && strings(entry.boundaries) && entry.boundaries.length >= 4, `${id}: limited boundaries missing`)
    else if (runtime) check(entry.supportLevel === 'full' && strings(entry.boundaries) && entry.boundaries.length === 0, `${id}: legacy runtime has no new boundaries`)
    else check(JSON.stringify(entry.reasons) === JSON.stringify(mechanics?.blockers) && strings(entry.boundaries) && entry.boundaries.length === 0, `${id}: research reasons must match mechanics blockers`)
  }
  for (const entry of audit.entries) check(ids.has(entry.id), `${entry.id}: missing support entry`)
  for (const entry of audit.populationDifferences) check(ids.has(entry.id), `${entry.id}: missing supplemental support entry`)
  return errors
}

export function summarizeArtifactAudit(audit: ArtifactAudit = ARTIFACT_AUDIT) {
  const allEntries = [...audit.entries, ...audit.populationDifferences]
  const countBy = (key: 'mechanicFamily' | 'runtimeReadiness') => Object.fromEntries([...new Set(allEntries.map((entry) => entry[key]))].sort().map((value) => [value, allEntries.filter((entry) => entry[key] === value).length]))
  return { population: audit.populationReconciliation.reconciledPopulationCount, obtainable: allEntries.filter((entry) => entry.obtainable).length, families: countBy('mechanicFamily'), readiness: countBy('runtimeReadiness'), supplemental: audit.populationDifferences.length }
}
