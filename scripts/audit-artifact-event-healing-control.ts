import fs from 'node:fs'
import { createServer } from 'vite'
import audit from '../research/artifact-event-healing-control-audit.json' with { type: 'json' }

const errors: string[] = []
const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })

try {
  const { ARTIFACTS } = await server.ssrLoadModule('/src/data/artifacts.ts')
  const { ARTIFACT_RUNTIME_SUPPORT } = await server.ssrLoadModule('/src/core/artifactRuntimeSupport.ts')
  const ids = audit.candidates.map((entry) => entry.id)
  check(audit.schemaVersion === 1 && audit.phase === '2-2D' && audit.gameVersion === '1.17.0.0', 'invalid event/healing/control audit schema')
  check(audit.phaseStatus === 'complete', 'Phase 2-2D must record its architecture/evidence decision as complete')
  check(JSON.stringify(ids) === JSON.stringify(['powershaker', 'totem-of-regeneration', 'wind-horn']), 'Phase 2-2D candidate set drift')
  check(new Set(ids).size === ids.length, 'duplicate Phase 2-2D candidate')
  check(JSON.stringify(audit.runtimeCounts) === JSON.stringify({ auditedPopulation: 45, catalogRuntime: 3, full: 2, limited: 1, researchOnly: 42 }), 'runtime counts drift')
  check(audit.phase22eEvidence.auditRef === 'research/artifact-curve-audit.json' && audit.phase22eEvidence.conclusion === 'public-evidence-exhausted' && audit.phase22eEvidence.runtimeDecision === 'research-only', 'Phase 2-2E event/healing/control evidence sync drift')
  check(audit.candidates.every((entry) => entry.runtimeDecision === 'research-only' && entry.blockers.length >= 5), 'every blocked candidate needs a concrete Research-only decision')
  check(audit.candidates.every((entry) => !(entry.id in ARTIFACTS)), 'Research-only Phase 2-2D Artifact entered runtime catalog')
  const support = new Map(ARTIFACT_RUNTIME_SUPPORT.entries.map((entry: { id: string; supportLevel: string }) => [entry.id, entry.supportLevel]))
  check(ids.every((id) => support.get(id) === 'research-only'), 'Phase 2-2D support manifest drift')

  const sourceIds = new Set(audit.sources.map((source) => source.id))
  check(sourceIds.size === audit.sources.length, 'duplicate Phase 2-2D source')
  for (const source of audit.sources) check(/^https:\/\//.test(source.url), `${source.id}: invalid source URL`)
  for (const entry of audit.candidates) check(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.id}: unknown source ID`)

  const powershaker = audit.candidates[0]
  check(powershaker.mechanicFamily === 'attack-limited-buff' && powershaker.cooldown.seconds === 10, 'Powershaker family/cooldown drift')
  check(powershaker.duration.maximumSeconds === 15 && powershaker.triggerBudget.maximumExplosions === 5, 'Powershaker finite trigger budget drift')
  check(powershaker.powerScaling.historicalCoefficient === 259 && powershaker.powerScaling.absoluteDamageSamples.length === 0 && powershaker.powerScaling.extrapolationAllowed === false, 'Powershaker coefficient/curve gate drift')
  check(powershaker.damage.proposedChannel === 'artifact-damage' && powershaker.damage.directWeaponKillCredit === false, 'Powershaker damage attribution drift')
  check(powershaker.artifactSynergyActivation.includes('one use action'), 'Powershaker Artifact Synergy policy drift')

  const totem = audit.candidates[1]
  check(totem.mechanicFamily === 'placed-healing-zone' && totem.cooldown.seconds === 25, 'Totem family/cooldown drift')
  check(totem.targeting.radiusBlocks === 4 && JSON.stringify(totem.duration.reportedRangeSeconds) === '[5,10]' && totem.duration.exactSeconds === null, 'Totem zone boundary drift')
  check(JSON.stringify(totem.powerScaling.displaySamples.map((sample) => [sample.power, sample.healthHealed])) === '[[31,229],[111,2659],[114,2917]]', 'Totem published samples drift')
  check(totem.healing.historyPerSecond.before172 === 20 && totem.healing.historyPerSecond.after172 === 40, 'Totem 1.7.2 history drift')
  check(totem.healing.delivery.includes('not an instant heal') && totem.powerScaling.extrapolationAllowed === false, 'Totem instant-heal/no-extrapolation gate drift')

  const windHorn = audit.candidates[2]
  check(windHorn.mechanicFamily === 'positional-control' && windHorn.cooldown.seconds === 10, 'Wind Horn family/cooldown drift')
  check(JSON.stringify(windHorn.powerScaling.pushBands.map((band) => [band.reportedPower, band.blocksPushed])) === '[["1-13",4],["13-39",5],["39-65",6],["65-90",7],["90-108",8]]', 'Wind Horn published push bands drift')
  check(windHorn.powerScaling.supportedPowerRange === null && windHorn.powerScaling.extrapolationAllowed === false, 'Wind Horn high-Power gate drift')
  check(windHorn.targeting.closeRangePolicy.includes('not pushed') && windHorn.control.pushDimension.includes('never grouping'), 'Wind Horn close-range/separation semantics drift')
  check(windHorn.control.slowMagnitude === null && windHorn.control.objectivePolicy.includes('no DPS/DR conversion'), 'Wind Horn slow/non-effect invariant drift')

  check(audit.sharedPolicies.artifactSynergyActivation.includes('one successful Artifact use action'), 'shared Artifact Synergy policy missing')
  check(audit.sharedPolicies.encounterBoundary.continuousEffect.includes('zero effect credit'), 'continuous encounter-boundary policy missing')
  check(audit.sharedPolicies.encounterBoundary.instantEffect.includes('inside the encounter'), 'instant encounter-boundary policy missing')
  check(audit.architecture.positionalControl.rawMetric === 'separationCoverage' && audit.architecture.positionalControl.objectiveConnection.startsWith('none'), 'positional Control architecture drift')
  check(audit.nextPhaseDecision.selected === 'artifact-evidence-acquisition-and-curve-extraction', 'next-phase decision drift')
  for (const path of ['docs/artifact-event-healing-control.md', 'docs/artifact-model.md', 'docs/artifact-expansion-plan.md', audit.phase22eEvidence.auditRef]) check(fs.existsSync(path), `missing ${path}`)

  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Artifact event/healing/control audit passed: three mechanics separated; all three candidates remain evidence-blocked Research-only; runtime 3/45.')
} finally {
  await server.close()
}
