import sourcesJson from '../../research/artifact-evidence/sources.json' with { type: 'json' }
import samplesJson from '../../research/artifact-evidence/published-samples.json' with { type: 'json' }
import coefficientsJson from '../../research/artifact-evidence/patch-coefficients.json' with { type: 'json' }
import hypothesesJson from '../../research/artifact-evidence/curve-hypotheses.json' with { type: 'json' }
import decisionsJson from '../../research/artifact-evidence/evidence-decisions.json' with { type: 'json' }

type UnknownRecord = Record<string, unknown>

export interface ArtifactEvidenceSample {
  readonly id: string
  readonly artifactId: string
  readonly gameVersion: string
  readonly power?: number
  readonly powerRange?: { readonly min: number; readonly max: number }
  readonly metric: string
  readonly value: number
  readonly rangeEnd?: number
  readonly unit: string
  readonly valueKind: string
  readonly sourceId: string
  readonly sourceField: string
  readonly confidence: string
  readonly exclusionReason?: string
}

interface CurveHypothesis {
  readonly id: string
  readonly family: string
  readonly claim: string
  readonly formula: string
  readonly model: {
    readonly kind: string
    readonly targetArtifactId?: string
    readonly referenceArtifactId?: string
    readonly interpolation?: string
    readonly slope?: number
    readonly intercept?: number
  }
  readonly fitSampleIds: readonly string[]
  readonly validationSampleIds: readonly string[]
  readonly status: 'accepted' | 'rejected' | 'inconclusive'
  readonly supportedPowerRange?: { readonly min: number; readonly max: number }
  readonly blockers: readonly string[]
}

export interface CurveErrorMetrics {
  readonly sampleCount: number
  readonly artifactCount: number
  readonly powerRange: { readonly min: number; readonly max: number }
  readonly meanAPE: number
  readonly medianAPE: number
  readonly p90APE: number
  readonly maxAPE: number
  readonly signedBias: number
}

interface CurveObservation {
  readonly sampleId: string
  readonly split: 'fit' | 'validation'
  readonly power: number
  readonly actual: number
  readonly predictedRaw: number
  readonly predictedRounded: number
  readonly absolutePercentageError: number
  readonly signedRelativeError: number
}

export const ARTIFACT_EVIDENCE_SOURCES = sourcesJson
export const ARTIFACT_PUBLISHED_SAMPLES = samplesJson
export const ARTIFACT_PATCH_COEFFICIENTS = coefficientsJson
export const ARTIFACT_CURVE_HYPOTHESES = hypothesesJson
export const ARTIFACT_EVIDENCE_DECISIONS = decisionsJson

const samples = samplesJson.samples as readonly ArtifactEvidenceSample[]
const hypotheses = hypothesesJson.hypotheses as readonly CurveHypothesis[]

function sampleValue(sample: ArtifactEvidenceSample): number {
  return sample.rangeEnd === undefined ? sample.value : (sample.value + sample.rangeEnd) / 2
}

function quantileNearestRank(values: readonly number[], probability: number): number {
  if (values.length === 0) throw new Error('quantile requires observations')
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(probability * sorted.length) - 1)]!
}

function referenceValueAtPower(artifactId: string, power: number): number {
  const points = samples
    .filter((sample) => sample.artifactId === artifactId && sample.power !== undefined)
    .sort((a, b) => a.power! - b.power!)
  const exact = points.find((sample) => sample.power === power)
  if (exact) return sampleValue(exact)
  const upperIndex = points.findIndex((sample) => sample.power! > power)
  const upper = points[upperIndex]
  const lower = points[upperIndex - 1]
  if (!lower || !upper) throw new Error(`${artifactId}: Power ${power} is outside published reference knots`)
  const position = (power - lower.power!) / (upper.power! - lower.power!)
  return Math.exp(Math.log(sampleValue(lower)) + position * (Math.log(sampleValue(upper)) - Math.log(sampleValue(lower))))
}

function observation(sample: ArtifactEvidenceSample, predictedRaw: number, split: 'fit' | 'validation'): CurveObservation {
  if (sample.power === undefined) throw new Error(`${sample.id}: curve observations require a single Power`)
  const actual = sampleValue(sample)
  return {
    sampleId: sample.id,
    split,
    power: sample.power,
    actual,
    predictedRaw,
    predictedRounded: Math.round(predictedRaw),
    absolutePercentageError: Math.abs(predictedRaw - actual) / actual,
    signedRelativeError: (predictedRaw - actual) / actual,
  }
}

function buildObservations(hypothesis: CurveHypothesis): readonly CurveObservation[] {
  const byId = new Map(samples.map((sample) => [sample.id, sample]))
  const fitSamples = hypothesis.fitSampleIds.map((id) => byId.get(id)!)
  const validationSamples = hypothesis.validationSampleIds.map((id) => byId.get(id)!)
  if (hypothesis.model.kind === 'not-evaluable') return []

  if (hypothesis.model.kind === 'fixed-linear') {
    const { slope, intercept } = hypothesis.model
    if (!Number.isFinite(slope) || !Number.isFinite(intercept)) throw new Error(`${hypothesis.id}: invalid linear model`)
    const predict = (sample: ArtifactEvidenceSample) => slope! * sample.power! + intercept!
    return [
      ...fitSamples.map((sample) => observation(sample, predict(sample), 'fit')),
      ...validationSamples.map((sample) => observation(sample, predict(sample), 'validation')),
    ]
  }

  if (hypothesis.model.kind === 'constant-ratio-to-reference') {
    const referenceArtifactId = hypothesis.model.referenceArtifactId
    if (!referenceArtifactId || fitSamples.length === 0) throw new Error(`${hypothesis.id}: missing ratio reference or fit samples`)
    const ratios = fitSamples.map((sample) => sampleValue(sample) / referenceValueAtPower(referenceArtifactId, sample.power!))
    const coefficient = Math.exp(ratios.reduce((sum, value) => sum + Math.log(value), 0) / ratios.length)
    const predict = (sample: ArtifactEvidenceSample) => coefficient * referenceValueAtPower(referenceArtifactId, sample.power!)
    return [
      ...fitSamples.map((sample) => observation(sample, predict(sample), 'fit')),
      ...validationSamples.map((sample) => observation(sample, predict(sample), 'validation')),
    ]
  }

  throw new Error(`${hypothesis.id}: unknown model kind ${hypothesis.model.kind}`)
}

function summarizeMetrics(observations: readonly CurveObservation[]): CurveErrorMetrics | undefined {
  if (observations.length === 0) return undefined
  const byId = new Map(samples.map((sample) => [sample.id, sample]))
  const apes = observations.map((entry) => entry.absolutePercentageError)
  const powers = observations.map((entry) => entry.power)
  return {
    sampleCount: observations.length,
    artifactCount: new Set(observations.map((entry) => byId.get(entry.sampleId)!.artifactId)).size,
    powerRange: { min: Math.min(...powers), max: Math.max(...powers) },
    meanAPE: apes.reduce((sum, value) => sum + value, 0) / apes.length,
    medianAPE: quantileNearestRank(apes, 0.5),
    p90APE: quantileNearestRank(apes, 0.9),
    maxAPE: Math.max(...apes),
    signedBias: observations.reduce((sum, entry) => sum + entry.signedRelativeError, 0) / observations.length,
  }
}

function rounded(value: number): number {
  return Number(value.toFixed(6))
}

function roundMetrics(metrics: CurveErrorMetrics | undefined): CurveErrorMetrics | undefined {
  if (!metrics) return undefined
  return {
    ...metrics,
    meanAPE: rounded(metrics.meanAPE),
    medianAPE: rounded(metrics.medianAPE),
    p90APE: rounded(metrics.p90APE),
    maxAPE: rounded(metrics.maxAPE),
    signedBias: rounded(metrics.signedBias),
  }
}

export function buildArtifactCurveValidation() {
  return {
    schemaVersion: 1,
    generatedFrom: [
      'research/artifact-evidence/published-samples.json',
      'research/artifact-evidence/curve-hypotheses.json',
    ],
    hypotheses: hypotheses.map((hypothesis) => {
      const observations = buildObservations(hypothesis)
      const fit = observations.filter((entry) => entry.split === 'fit')
      const validation = observations.filter((entry) => entry.split === 'validation')
      return {
        id: hypothesis.id,
        observations: observations.map((entry) => ({
          ...entry,
          predictedRaw: rounded(entry.predictedRaw),
          absolutePercentageError: rounded(entry.absolutePercentageError),
          signedRelativeError: rounded(entry.signedRelativeError),
        })),
        fitMetrics: roundMetrics(summarizeMetrics(fit)),
        validationMetrics: roundMetrics(summarizeMetrics(validation)),
      }
    }),
  }
}

function highPowerReady(sampleIds: readonly string[]): boolean {
  const byId = new Map(samples.map((sample) => [sample.id, sample]))
  return sampleIds.some((id) => {
    const sample = byId.get(id)!
    return sample.power !== undefined && sample.power >= hypothesesJson.acceptanceGate.highPowerMinimum
      && sample.gameVersion === '1.17.0.0 current'
  })
}

export function buildArtifactCurveAudit() {
  const validation = buildArtifactCurveValidation()
  const validationById = new Map(validation.hypotheses.map((entry) => [entry.id, entry]))
  return {
    schemaVersion: 1,
    phase: '2-2E',
    gameVersion: decisionsJson.gameVersion,
    phaseStatus: decisionsJson.phaseStatus,
    publicEvidenceConclusion: 'public-evidence-exhausted',
    runtimeCounts: decisionsJson.runtimeCounts,
    hypotheses: hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      family: hypothesis.family,
      formula: hypothesis.formula,
      status: hypothesis.status,
      fitSampleIds: hypothesis.fitSampleIds,
      validationSampleIds: hypothesis.validationSampleIds,
      supportedPowerRange: hypothesis.supportedPowerRange,
      metrics: validationById.get(hypothesis.id)!.validationMetrics,
      highPowerReady: highPowerReady([...hypothesis.fitSampleIds, ...hypothesis.validationSampleIds]),
      blockers: hypothesis.blockers,
    })),
    conflicts: decisionsJson.conflicts,
    coefficientInventory: coefficientsJson.coefficients,
    candidates: decisionsJson.candidates,
    nextPhaseDecision: decisionsJson.nextPhaseDecision,
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function collectArtifactEvidenceErrors(input: {
  readonly sources?: unknown
  readonly samples?: unknown
  readonly coefficients?: unknown
  readonly hypotheses?: unknown
  readonly decisions?: unknown
} = {
  sources: sourcesJson,
  samples: samplesJson,
  coefficients: coefficientsJson,
  hypotheses: hypothesesJson,
  decisions: decisionsJson,
}): string[] {
  const errors: string[] = []
  const sourceRoot = isRecord(input.sources) ? input.sources : undefined
  const sampleRoot = isRecord(input.samples) ? input.samples : undefined
  const coefficientRoot = isRecord(input.coefficients) ? input.coefficients : undefined
  const hypothesisRoot = isRecord(input.hypotheses) ? input.hypotheses : undefined
  const decisionRoot = isRecord(input.decisions) ? input.decisions : undefined
  if (!sourceRoot || !Array.isArray(sourceRoot.sources)) errors.push('sources root is malformed')
  if (!sampleRoot || !Array.isArray(sampleRoot.samples)) errors.push('samples root is malformed')
  if (!coefficientRoot || !Array.isArray(coefficientRoot.coefficients)) errors.push('coefficients root is malformed')
  if (!hypothesisRoot || !Array.isArray(hypothesisRoot.hypotheses)) errors.push('hypotheses root is malformed')
  if (!decisionRoot || !Array.isArray(decisionRoot.candidates) || !Array.isArray(decisionRoot.conflicts)) errors.push('decisions root is malformed')
  if (errors.length) return errors

  const sourceEntries = sourceRoot!.sources as UnknownRecord[]
  const sampleEntries = sampleRoot!.samples as UnknownRecord[]
  const hypothesisEntries = hypothesisRoot!.hypotheses as UnknownRecord[]
  const candidateEntries = decisionRoot!.candidates as UnknownRecord[]
  const conflictEntries = decisionRoot!.conflicts as UnknownRecord[]
  const uniqueIds = (entries: readonly UnknownRecord[], label: string) => {
    const ids = entries.map((entry) => entry.id)
    if (ids.some((id) => typeof id !== 'string' || id.length === 0)) errors.push(`${label} has an invalid ID`)
    if (new Set(ids).size !== ids.length) errors.push(`${label} has duplicate IDs`)
  }
  uniqueIds(sourceEntries, 'sources')
  uniqueIds(sampleEntries, 'samples')
  uniqueIds(hypothesisEntries, 'hypotheses')
  uniqueIds(candidateEntries, 'candidates')
  uniqueIds(conflictEntries, 'conflicts')
  const sourceIds = new Set(sourceEntries.map((entry) => entry.id))
  for (const source of sourceEntries) {
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) errors.push(`${String(source.id)} has an invalid URL`)
    if (typeof source.versionTag !== 'string' || typeof source.retrievedAt !== 'string') errors.push(`${String(source.id)} lacks provenance`)
    if (!['dungeons-tools', 'minecraft-wiki-current-history', 'public-github-save-tooling'].includes(String(source.route))) errors.push(`${String(source.id)} has an invalid source route`)
  }
  for (const sample of sampleEntries) {
    if (!sourceIds.has(sample.sourceId)) errors.push(`${String(sample.id)} references an unknown source`)
    if (typeof sample.gameVersion !== 'string' || typeof sample.unit !== 'string' || typeof sample.sourceField !== 'string') errors.push(`${String(sample.id)} lacks version/unit/field tags`)
    if (typeof sample.value !== 'number' || !Number.isFinite(sample.value) || sample.value <= 0) errors.push(`${String(sample.id)} has an invalid value`)
    if (sample.rangeEnd !== undefined && (typeof sample.rangeEnd !== 'number' || !Number.isFinite(sample.rangeEnd) || sample.rangeEnd < (sample.value as number))) errors.push(`${String(sample.id)} has an invalid range end`)
    const hasPower = Number.isInteger(sample.power) && (sample.power as number) > 0
    const range = sample.powerRange as UnknownRecord | undefined
    const hasPowerRange = isRecord(range) && Number.isInteger(range.min) && Number.isInteger(range.max) && (range.min as number) > 0 && (range.max as number) >= (range.min as number)
    if (hasPower === hasPowerRange) errors.push(`${String(sample.id)} must have exactly one Power tag`)
  }
  const sampleIds = new Set(sampleEntries.map((entry) => entry.id))
  for (const hypothesis of hypothesisEntries) {
    const fit = Array.isArray(hypothesis.fitSampleIds) ? hypothesis.fitSampleIds : []
    const validation = Array.isArray(hypothesis.validationSampleIds) ? hypothesis.validationSampleIds : []
    if (fit.some((id) => !sampleIds.has(id)) || validation.some((id) => !sampleIds.has(id))) errors.push(`${String(hypothesis.id)} references an unknown sample`)
    if (fit.some((id) => validation.includes(id))) errors.push(`${String(hypothesis.id)} reuses fit data as validation`)
    if (!['accepted', 'rejected', 'inconclusive'].includes(String(hypothesis.status))) errors.push(`${String(hypothesis.id)} has an invalid status`)
    if (!Array.isArray(hypothesis.blockers)) errors.push(`${String(hypothesis.id)} lacks blockers`)
    const supportedRange = hypothesis.supportedPowerRange
    if (supportedRange !== undefined && (!isRecord(supportedRange) || !Number.isInteger(supportedRange.min) || !Number.isInteger(supportedRange.max) || (supportedRange.min as number) <= 0 || (supportedRange.max as number) < (supportedRange.min as number))) errors.push(`${String(hypothesis.id)} has an invalid supported Power range`)
    if (isRecord(supportedRange)) {
      for (const id of [...fit, ...validation]) {
        const sample = sampleEntries.find((entry) => entry.id === id)
        if (sample && typeof sample.power === 'number' && (sample.power < (supportedRange.min as number) || sample.power > (supportedRange.max as number))) errors.push(`${String(hypothesis.id)} extrapolates beyond its declared range`)
      }
    }
    if (hypothesis.status === 'accepted') {
      if (fit.length === 0 || validation.length === 0 || (hypothesis.model as UnknownRecord | undefined)?.kind === 'not-evaluable') errors.push(`${String(hypothesis.id)} is accepted without evaluable fit/hold-out data`)
      const referenced = [...fit, ...validation].map((id) => sampleEntries.find((entry) => entry.id === id)!).filter(Boolean)
      const artifactCount = new Set(referenced.map((entry) => entry.artifactId)).size
      const sourceCount = new Set(referenced.map((entry) => entry.sourceId)).size
      const powers = referenced.map((entry) => entry.power).filter((power): power is number => typeof power === 'number')
      const gate = hypothesisRoot!.acceptanceGate as UnknownRecord
      if (artifactCount < Number(gate.minimumArtifacts) || sourceCount < Number(gate.minimumIndependentlySourcedArtifacts) || referenced.length < Number(gate.minimumSamples) || powers.length === 0 || Math.max(...powers) - Math.min(...powers) < Number(gate.minimumPowerSpan)) errors.push(`${String(hypothesis.id)} is accepted below the evidence-count gate`)
    }
  }
  const expectedCandidates = ['powershaker', 'harvester', 'lightning-rod', 'soul-healer', 'totem-of-regeneration', 'wind-horn']
  if (JSON.stringify(candidateEntries.map((entry) => entry.id)) !== JSON.stringify(expectedCandidates)) errors.push('candidate set or order drifted')
  for (const candidate of candidateEntries) {
    if (!['R0', 'R1', 'R2', 'R3', 'R4'].includes(String(candidate.readiness))) errors.push(`${String(candidate.id)} has invalid readiness`)
    if (candidate.nextStatus !== 'Research-only' || candidate.highPowerReady !== false) errors.push(`${String(candidate.id)} violates the runtime/high-Power gate`)
    if (candidate.evidenceStop !== 'public-evidence-exhausted') errors.push(`${String(candidate.id)} lacks stop condition`)
    if (!Array.isArray(candidate.sourceRoutesChecked) || candidate.sourceRoutesChecked.length < 3) errors.push(`${String(candidate.id)} did not check three source routes`)
  }
  if ((decisionRoot!.nextPhaseDecision as UnknownRecord | undefined)?.selected !== 'Armor subsystem') errors.push('next Phase decision drifted')
  if (JSON.stringify(decisionRoot!.runtimeCounts) !== JSON.stringify({ auditedPopulation: 45, catalogRuntime: 3, full: 2, limited: 1, researchOnly: 42 })) errors.push('runtime counts drifted')
  return errors
}

function percent(value: number | undefined): string {
  return value === undefined ? '—' : `${(value * 100).toFixed(2)}%`
}

export function renderArtifactEvidenceMatrix(): string {
  const audit = buildArtifactCurveAudit()
  const counts = (artifactId: string) => samples.filter((sample) => sample.artifactId === artifactId)
  const range = (artifactId: string) => {
    const entries = counts(artifactId)
    const values = entries.flatMap((sample) => sample.power === undefined ? [sample.powerRange!.min, sample.powerRange!.max] : [sample.power])
    return values.length ? `${Math.min(...values)}–${Math.max(...values)}` : '—'
  }
  const metrics = [
    ['Powershaker', 'coefficient/damage', 'powershaker', '1.16.2.0 historical', 'internal operand unresolved'],
    ['Harvester', 'damage/cooldown', 'harvester', 'table unresolved; DB current', 'range/cooldown semantics unresolved'],
    ['Lightning Rod', 'damage/cooldown', 'lightning-rod', 'table unresolved; DB current', 'strike display/cooldown semantics unresolved'],
    ['Soul Healer', 'healing', 'soul-healer', 'table unresolved', 'nested range semantics unresolved'],
    ['Totem of Regeneration', 'healing/duration', 'totem-of-regeneration', 'table unresolved', 'total/rate/tick unresolved'],
    ['Wind Horn', 'push/slow', 'wind-horn', 'table unresolved', 'blocks known only in ambiguous bands'],
  ] as const
  const rows = metrics.map(([name, metric, id, version, unit]) => {
    const decision = audit.candidates.find((candidate) => candidate.id === id)!
    const sampleCount = counts(id).length + (id === 'powershaker' ? 1 : 0)
    return `| ${name} | ${metric} | ${sampleCount} | ${range(id)} | ${version} | ${unit} | ${decision.readiness} | No | ${decision.nextStatus} |`
  }).join('\n')
  return `# Artifact evidence matrix — Phase 2-2E\n\nTarget is Minecraft Dungeons 1.17.0.0. A current page is not treated as a current-version numeric table unless the table itself is pinned. Machine-readable provenance lives in [sources](../research/artifact-evidence/sources.json), [samples](../research/artifact-evidence/published-samples.json) and the [curve audit](../research/artifact-curve-audit.json).\n\nRuntime remains **3 / 45 (Full 2, Limited 1, Research-only 42)**. No unsupported effect was registered as a zero-value candidate.\n\n| Artifact | Metric | Samples | Power range | Version | Unit | Curve readiness | High-Power ready | Runtime readiness |\n| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |\n${rows}\n\n## Conflict decisions\n\n| Conflict | Candidates | Conclusion | Why no selected value |\n| --- | --- | --- | --- |\n${audit.conflicts.map((conflict) => `| ${conflict.artifactId} ${conflict.metric} | ${conflict.candidates.map((candidate) => `${candidate.value} ${candidate.unit}`).join(' / ')} | ${conflict.conclusion} | ${conflict.sourceSemantics.join(' ')} |`).join('\n')}\n\n## Public-source stop condition\n\nEvery primary candidate checked dungeons.tools, Minecraft Wiki current/history and public GitHub save tooling. No source exposed the executable Artifact absolute curve, raw cooldown property names, Totem tick semantics or Wind Horn 109+ table, so each decision records \`public-evidence-exhausted\`.\n`
}

export function renderArtifactCurveAnalysis(): string {
  const audit = buildArtifactCurveAudit()
  const validations = buildArtifactCurveValidation()
  const validationById = new Map(validations.hypotheses.map((entry) => [entry.id, entry]))
  const sections = hypotheses.map((hypothesis) => {
    const result = validationById.get(hypothesis.id)!
    const metrics = result.validationMetrics
    return `## ${hypothesis.id} — ${hypothesis.status}\n\n${hypothesis.claim}\n\n- Formula: \`${hypothesis.formula}\`\n- Fit: ${hypothesis.fitSampleIds.length ? hypothesis.fitSampleIds.join(', ') : 'not evaluable from public numeric evidence'}\n- Hold-out: ${hypothesis.validationSampleIds.length ? hypothesis.validationSampleIds.join(', ') : 'none; hypothesis remains inconclusive'}\n- Supported research range: ${hypothesis.supportedPowerRange ? `${hypothesis.supportedPowerRange.min}–${hypothesis.supportedPowerRange.max}` : 'none'}\n- Validation: n=${metrics?.sampleCount ?? 0}; MAPE ${percent(metrics?.meanAPE)}; median APE ${percent(metrics?.medianAPE)}; P90 APE ${percent(metrics?.p90APE)}; max APE ${percent(metrics?.maxAPE)}; signed bias ${percent(metrics?.signedBias)}\n- Blockers/rejection: ${hypothesis.blockers.join('; ')}\n`
  }).join('\n')
  const coverage = decisionsJson.researchCoverage
  return `# Artifact curve analysis — Phase 2-2E\n\n## Outcome\n\nNo public model passes the runtime curve gate. The damage common-curve comparison has only two unresolved-version Artifacts and two overlapping points. The weapon-curve alternative fails the configured P90 gate on its Lightning Rod hold-out and, more importantly, has no public Artifact field lineage. Healing cannot be fitted without inventing Soul Healer range or Totem rate semantics. A single duration formula is rejected by hold-out families.\n\nAcceptance requires at least 3 Artifacts, 2 independently sourced Artifacts, 8 samples, Power span 50, disjoint hold-out, P90 APE <= 10%, max APE <= 20%, no version conflict and an endgame gate. None qualifies.\n\n## Acquisition coverage\n\n- Damage candidates: ${coverage.damageArtifacts.join(', ')}. The normalized snapshot contains ${coverage.numericSnapshot.artifactDamageSamples} Artifact damage rows across Power ${coverage.numericSnapshot.artifactDamagePowerRange.min}–${coverage.numericSnapshot.artifactDamagePowerRange.max}.\n- Healing candidates/references: ${coverage.healingArtifacts.join(', ')}. ${coverage.numericSnapshot.healingSamplesIncludingExcludedReferences} rows are preserved across Power ${coverage.numericSnapshot.healingPowerRange.min}–${coverage.numericSnapshot.healingPowerRange.max}; semantic exclusions are not fitted.\n- Duration/control candidates: ${coverage.durationArtifacts.join(', ')}. ${coverage.numericSnapshot.durationSamples} duration rows cover Power ${coverage.numericSnapshot.durationPowerRange.min}–${coverage.numericSnapshot.durationPowerRange.max}; Wind Horn contributes ${coverage.numericSnapshot.windHornBands} ambiguous bands over ${coverage.numericSnapshot.windHornPublishedPowerRange.min}–${coverage.numericSnapshot.windHornPublishedPowerRange.max}.\n\n${sections}\n## Patch coefficient semantic audit\n\n| Artifact | Patch value | Meaning | Runtime use |\n| --- | --- | --- | --- |\n${audit.coefficientInventory.map((entry) => `| ${entry.artifactId} | ${entry.before ?? '—'} → ${entry.after ?? entry.reportedChange} | ${entry.semanticConclusion} | Not an absolute damage value; not used |`).join('\n')}\n\nThe 235/259, 470/600 and 600/660 values reproduce balance deltas but no public source names a shared property. Eye of the Guardian supplies only +100%. Treating these operands as absolute damage or as one coefficient family is therefore unsupported.\n\n## Healing and duration semantics\n\nSoul Healer's 23 rows are retained as nested ranges and excluded from current fitting because fixed Soul costs replaced variable Soul costs in 1.3.2.0. Totem's three card values cannot be reconciled with the historical 40-per-second wording without an exact lifetime and tick interval. Radiance is deliberately excluded because enchantment-healing lineage is unproven. Fishing Rod and Gong add qualitative/history evidence but no current paired table; Shock Powder, Death Cap and Iron Hide stay frozen as runtime fixtures.\n\n## Minimal future measurements (not requested in this phase)\n\n- Powershaker: record Power, one/many targets, exact melee action count, explosion count and damage to distinguish target-granularity and coefficient mapping.\n- Totem: record Power, max HP, zone start/end, tick timestamps, per-tick and total heal to resolve unit and duration together.\n- Wind Horn: test the four published boundaries plus one 109+ item; record push distance and whether slow changes movement, attacks or both.\n\nThese plans are optional last-resort work. Phase 2-2E does not ask the user to measure anything.\n`
}

export function renderArtifactEvidenceReport(): string {
  const audit = buildArtifactCurveAudit()
  return `# Artifact evidence acquisition — Phase 2-2E\n\nPhase 2-2E is complete as a reproducible negative/triage result. Public sources did not establish a current endgame Artifact damage/healing curve or resolve the four recorded semantic conflicts. Runtime support remains **3 / 45**.\n\n| Artifact | Previous blocker | New evidence | Curve readiness | Other blockers | Next status |\n| --- | --- | --- | --- | --- | --- |\n${audit.candidates.map((candidate) => `| ${candidate.name} | ${candidate.previousBlocker} | ${candidate.newEvidence} | ${candidate.readiness} | ${candidate.otherBlockers.join('; ')} | ${candidate.nextStatus} |`).join('\n')}\n\n## Next Phase\n\n**Armor subsystem**. Zero Artifacts meet the Phase 2-2F gate of current 1.17 numeric basis, endgame Power support and resolved major unit/interaction semantics. The Artifact 10–15 parent goal stays open.\n\n[Evidence matrix](artifact-evidence-matrix.md) · [Curve analysis](artifact-curve-analysis.md) · [Machine-readable audit](../research/artifact-curve-audit.json)\n`
}
