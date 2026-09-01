import audit from '../research/artifact-control-debuff-audit.json' with { type: 'json' }
import { createServer } from 'vite'

const errors: string[] = []
const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })
try {
  const { ARTIFACTS } = await server.ssrLoadModule('/src/data/artifacts.ts')
  const ids = audit.entries.map((entry) => entry.id)
  check(audit.schemaVersion === 1 && audit.gameVersion === '1.17.0.0', 'invalid control/debuff audit schema')
  check(JSON.stringify(ids) === JSON.stringify(['shock-powder', 'fishing-rod', 'gong-of-weakening']), 'audit candidate set drift')
  check(audit.phase22eEvidence.auditRef === 'research/artifact-curve-audit.json' && audit.phase22eEvidence.conclusion === 'no new current paired duration table' && audit.phase22eEvidence.runtimeDecision === 'unchanged', 'Phase 2-2E control evidence sync drift')
  check(new Set(ids).size === ids.length, 'duplicate audit candidate')
  const sourceIds = new Set(audit.sources.map((source) => source.id))
  for (const source of audit.sources) {
    check(/^https:\/\//.test(source.url) || source.url === 'docs/artifact-control-debuff.md', `${source.id}: invalid source URL`)
  }
  for (const entry of audit.entries) {
    check(entry.sourceIds.length > 0 && entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.id}: missing source`)
    check(entry.blockers.length > 0, `${entry.id}: missing explicit boundary/blocker`)
  }
  const shock = audit.entries[0]
  const runtime = ARTIFACTS['shock-powder']
  check(shock.runtimeDecision === 'implemented-limited' && runtime.mechanic === 'hard-control', 'Shock runtime decision/catalog mismatch')
  check(runtime.cooldownSeconds.value === shock.cooldownSeconds, 'Shock cooldown drift')
  if (runtime.duration.kind !== 'published-table' || typeof shock.powerScaling === 'string') {
    errors.push('Shock bounded table missing')
  } else {
    check(runtime.duration.supportedPowerRange.min === shock.powerScaling.supportedPowerRange.min && runtime.duration.supportedPowerRange.max === shock.powerScaling.supportedPowerRange.max, 'Shock Power bounds drift')
    check(JSON.stringify(runtime.duration.points.map((point) => [point.power, point.seconds.value])) === JSON.stringify(shock.powerScaling.samples.map((point) => [point.power, point.durationSeconds])), 'Shock duration knots drift')
    check(shock.powerScaling.extrapolationAllowed === false, 'Shock extrapolation must remain disabled')
  }
  check(audit.entries[1]!.runtimeDecision === 'research-only' && audit.entries[2]!.runtimeDecision === 'research-only', 'Fishing Rod and Gong must remain research-only')
  check(!('fishing-rod' in ARTIFACTS) && !('gong-of-weakening' in ARTIFACTS), 'research-only Artifact entered runtime catalog')

  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Artifact control/debuff audit passed: Shock Powder limited; Fishing Rod and Gong research-only.')
} finally {
  await server.close()
}
