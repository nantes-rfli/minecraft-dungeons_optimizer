import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })
try {
  const adaptersModule = await server.ssrLoadModule('/src/research/evidenceCoverage/adapters.ts')
  const report = await server.ssrLoadModule('/src/research/evidenceCoverage/report.ts')
  const backlog = await server.ssrLoadModule('/src/research/evidenceCoverage/backlog.ts')
  const protocolModule = await server.ssrLoadModule('/src/research/evidenceCoverage/protocols.ts')
  const gapModule = await server.ssrLoadModule('/src/research/evidenceGapMap.ts')
  const validator = await server.ssrLoadModule('/src/research/evidenceCoverage/validation.ts')
  const roadmap = await server.ssrLoadModule('/src/data/roadmap.ts')
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
  const documents = { ...adaptersModule.COVERAGE_SOURCE_DOCUMENTS, 'research/runtime-backlog.json': JSON.parse(read('research/runtime-backlog.json')) }
  const resolve = (ref: string) => {
    const [file, fragment] = ref.split('#')
    if (!file || path.isAbsolute(file) || file.split('/').includes('..') || !fs.existsSync(path.join(root, file))) return { valid: false }
    if (fragment?.startsWith('/')) {
      let value: unknown = documents[file]
      for (const part of fragment.slice(1).split('/')) {
        const key = part.replaceAll('~1', '/').replaceAll('~0', '~')
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { valid: false }
        value = (value as Record<string, unknown>)[key]
      }
      return { valid: true, value }
    }
    if (fragment) {
      const anchors = read(file).split('\n').filter((line) => line.startsWith('#')).map((line) => line.replace(/^#+\s+/, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replaceAll(' ', '-'))
      return { valid: anchors.includes(fragment) }
    }
    return { valid: true }
  }
  const adapters = adaptersModule.buildCoverageAdapters()
  const snapshot = report.buildEvidenceCoverage(adapters)
  const legacyProtocols = protocolModule.buildMeasurementProtocols(read('docs/model-regression.md'), documents['research/dps-regression-audit.json'].targetGameVersion)
  const protocols = [...legacyProtocols, ...gapModule.buildPhase5MeasurementProtocols()]
  const gapMap = gapModule.buildEvidenceGapMap()
  const errors = [...adaptersModule.collectAdapterSourceErrors(adapters), ...validator.collectCoverageErrors(snapshot, adapters, resolve), ...validator.collectProtocolErrors(protocols, snapshot.blockers, resolve), ...gapModule.collectEvidenceGapMapErrors(gapMap, protocols)]
  const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
  const generated = {
    'research/evidence-coverage.json': json(snapshot),
    'research/evidence-coverage-dashboard.json': json(report.buildCoverageDashboard(snapshot, protocols)),
    'research/measurement-protocols.json': json({ schemaVersion: 2, protocols }),
    'research/evidence-gap-map.json': json(gapMap),
    'docs/combined-evidence-coverage.md': report.renderCoverageReport(snapshot),
    'docs/evidence-gap-map.md': gapModule.renderEvidenceGapMap(gapMap),
    'docs/measurement-protocols.md': `${gapModule.renderPhase5ProtocolReport(protocols)}\n---\n\n${report.renderProtocolReport(legacyProtocols, snapshot.blockers)}`,
  }
  if (json(snapshot) !== json(report.buildEvidenceCoverage(adapters)) || report.renderCoverageReport(snapshot) !== report.renderCoverageReport(report.buildEvidenceCoverage(adapters))) errors.push('Coverage generation is not deterministic')

  let limitations = read('docs/runtime-limitations.md')
  const start = '<!-- coverage-backlog:start -->'
  const end = '<!-- coverage-backlog:end -->'
  const generatedTable = `${start}\n${backlog.renderBacklogTable()}\n${end}`
  if (!limitations.includes(start)) {
    const first = limitations.indexOf('| Enchant / subsystem |')
    const last = limitations.indexOf('\n\n', first)
    if (first < 0 || last < 0) throw new Error('Original backlog table missing')
    errors.push(...backlog.collectBacklogMigrationErrors(limitations.slice(first, last), backlog.RUNTIME_BACKLOG))
    if (write) limitations = limitations.slice(0, first) + generatedTable + limitations.slice(last)
    else errors.push('Backlog migration has not been generated')
  } else {
    const first = limitations.indexOf(start)
    const last = limitations.indexOf(end, first)
    if (last < 0) throw new Error('Backlog end marker missing')
    const expected = limitations.slice(0, first) + generatedTable + limitations.slice(last + end.length)
    if (write) limitations = expected
    else if (limitations !== expected) errors.push('runtime-limitations generated table is stale')
  }
  const { completed, total, percentage } = roadmap.ROADMAP_PROGRESS
  const roadmapText = read('ROADMAP.md')
  if (!roadmapText.includes(`**${completed} / ${total}（${percentage}%）**`)) errors.push('Roadmap total progress drift')
  const checkboxes = roadmapText.split('\n').filter((line: string) => /^- \[[ x]\] /.test(line))
  if (checkboxes.length !== total || checkboxes.filter((line: string) => line.startsWith('- [x]')).length !== completed) errors.push('Roadmap checkbox progress drift')
  for (const phase of ['A', 'B', 'C', 'D', 'E', 'F']) if (!roadmapText.includes(`- [x] Phase 2-4${phase}:`)) errors.push(`Phase 2-4${phase} missing`)
  for (const phase of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const item = roadmap.ROADMAP_PHASES.flatMap((entry: { items: { label: string; status: string }[] }) => entry.items).find((entry: { label: string }) => entry.label.startsWith(`Phase 2-5${phase}`))
    if (!item || !roadmapText.includes(`- [${item.status === 'done' ? 'x' : ' '}] ${item.label}`)) errors.push(`Ranged subphase ${phase} status drift`)
  }
  for (const milestone of [...roadmap.FUTURE_MILESTONES, ...roadmap.FUTURE_EXPANSION_MILESTONES]) if (!roadmapText.includes(milestone.title)) errors.push(`Future milestone drift: ${milestone.title}`)
  if (!write) for (const [file, content] of Object.entries(generated)) {
    if (!fs.existsSync(path.join(root, file)) || read(file) !== content) errors.push(`${file}: stale generated output; run npm run generate:evidence-coverage`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  if (write) {
    for (const [file, content] of Object.entries(generated)) fs.writeFileSync(path.join(root, file), content as string)
    fs.writeFileSync(path.join(root, 'docs/runtime-limitations.md'), limitations)
  }
  console.log('Evidence coverage audit passed: source population/support/provenance, blockers, protocols, deterministic artifacts and roadmap.')
  console.log(snapshot.categories.map((c: { label: string; population: number; runtime: unknown }) => `${c.label}: ${c.population} ${JSON.stringify(c.runtime)}`).join('\n'))
  console.log('Priority backlog:', snapshot.backlogSummary)
} finally {
  await server.close()
}
