import fs from 'node:fs'
import { createServer } from 'vite'
import audit from '../research/artifact-soul-batch-audit.json' with { type: 'json' }

const errors: string[] = []
const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })

try {
  const { ARTIFACTS } = await server.ssrLoadModule('/src/data/artifacts.ts')
  const { simulateSoulResourceSchedule } = await server.ssrLoadModule('/src/core/souls.ts')
  check(audit.schemaVersion === 1 && audit.phase === '2-2C' && audit.gameVersion === '1.17.0.0', 'invalid Soul Artifact audit schema/version')
  check(audit.phaseStatus === 'complete', 'Phase 2-2C must record its architecture/evidence decision as complete')
  check(JSON.stringify(audit.candidates.map((entry) => entry.id)) === JSON.stringify(['soul-healer', 'harvester', 'lightning-rod']), 'Soul Artifact candidate set drift')
  check(audit.candidates.every((entry) => entry.runtimeDecision === 'research-only' && entry.blockers.length >= 2), 'every blocked candidate needs a concrete Research-only decision')
  check(audit.candidates.every((entry) => !(entry.id in ARTIFACTS)), 'Research-only Soul Artifact entered runtime catalog')
  check(JSON.stringify(audit.runtimeCounts) === JSON.stringify({ auditedPopulation: 45, catalogRuntime: 3, full: 2, limited: 1, researchOnly: 42 }), 'runtime counts drift')
  check(audit.scheduler.runtimeMaxSoulSpendingArtifacts === 1 && audit.scheduler.artifactSynergyInput === 'realized uses only', 'scheduler shared-pool/Synergy policy drift')
  const sourceIds = new Set(audit.sources.map((source) => source.id))
  check(sourceIds.size === audit.sources.length, 'duplicate Soul Artifact audit source')
  for (const source of audit.sources) check(/^https:\/\//.test(source.url), `${source.id}: invalid source URL`)
  for (const entry of audit.candidates) check(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.id}: unknown source ID`)

  const consumer = { instanceId: 'oracle', artifactId: 'death-cap-mushroom', costPerUse: 50, effectiveCooldownSeconds: 5 }
  const run = (initialSouls: number, incomeUnitsPerSecond: number) => simulateSoulResourceSchedule({ durationSeconds: 30, initialSouls, capacity: 300, incomeUnitsPerSecond, consumers: [consumer] })
  check(JSON.stringify(run(0, 0).consumers[0].useTimesSeconds) === '[]', 'zero-resource golden failed')
  check(JSON.stringify(run(100, 0).consumers[0].useTimesSeconds) === '[0,5]', 'initial-resource t0/t5 golden failed')
  check(run(0, 10).consumers[0].useTimesSeconds[0] === 5, 'affordability threshold golden failed')
  check(run(0, 100).consumers[0].realizedUses === 6, 'cooldown bottleneck golden failed')
  check(run(0, 5).consumers[0].realizedUses === 3, 'resource bottleneck golden failed')
  const overflow = simulateSoulResourceSchedule({ durationSeconds: 10, initialSouls: 250, capacity: 300, incomeUnitsPerSecond: 20, consumers: [] })
  check(overflow.endSouls === 300 && overflow.overflowUnits === 150 && overflow.averageSouls === 293.75, 'capacity plateau/average/overflow golden failed')
  for (const schedule of [run(0, 0), run(100, 0), run(0, 10), run(0, 100), run(0, 5), overflow]) {
    check(schedule.endSouls >= 0 && schedule.endSouls <= 300, 'Soul bounds invariant failed')
    check(schedule.totalSpentUnits <= schedule.initialSouls + schedule.totalIncomeUnits, 'spending conservation invariant failed')
    check(schedule.overflowUnits >= 0, 'overflow invariant failed')
    for (const entry of schedule.consumers) {
      check(Number.isSafeInteger(entry.realizedUses), 'realized uses must be an integer')
      check(entry.useTimesSeconds.every((time, index) => index === 0 || time >= entry.useTimesSeconds[index - 1]), 'event ordering invariant failed')
      check(entry.useTimesSeconds.every((time, index) => index === 0 || time - entry.useTimesSeconds[index - 1] >= entry.effectiveCooldownSeconds - 1e-9), 'cooldown invariant failed')
    }
  }
  for (const path of ['docs/artifact-soul-batch.md', 'docs/soul-resource-scheduler.md']) check(fs.existsSync(path), `missing ${path}`)

  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Artifact Soul audit passed: finite scheduler complete; Soul Healer, Harvester and Lightning Rod remain evidence-blocked Research-only; runtime 3/45.')
} finally {
  await server.close()
}
