import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })

try {
  const gapModule = await server.ssrLoadModule('/src/research/evidenceGapMap.ts')
  const protocolModule = await server.ssrLoadModule('/src/research/evidenceCoverage/protocols.ts')
  const reportModule = await server.ssrLoadModule('/src/research/evidenceCoverage/report.ts')
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
  const coverage = reportModule.buildEvidenceCoverage()
  const legacyProtocols = protocolModule.buildMeasurementProtocols(read('docs/model-regression.md'), coverage.records.find((record: { evidence: { targetGameVersion?: string } }) => record.evidence.targetGameVersion)?.evidence.targetGameVersion ?? '1.17.0.0')
  const phase5Protocols = gapModule.buildPhase5MeasurementProtocols()
  const protocols = [...legacyProtocols, ...phase5Protocols]
  const map = gapModule.buildEvidenceGapMap()
  const errors = gapModule.collectEvidenceGapMapErrors(map, protocols)
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  const generated = {
    'research/evidence-gap-map.json': json(map),
    'docs/evidence-gap-map.md': gapModule.renderEvidenceGapMap(map),
    'research/workflow/measurement-protocols.json': json({ schemaVersion: 2, protocols }),
    'docs/measurement-protocols.md': `${gapModule.renderPhase5ProtocolReport(protocols)}\n---\n\n${reportModule.renderProtocolReport(legacyProtocols, coverage.blockers)}`,
  }
  if (json(map) !== json(gapModule.buildEvidenceGapMap())) errors.push('Evidence Gap Map generation is not deterministic')
  if (write) for (const [file, content] of Object.entries(generated)) fs.writeFileSync(path.join(root, file), content as string)
  else for (const [file, content] of Object.entries(generated)) {
    if (!fs.existsSync(path.join(root, file)) || read(file) !== content) errors.push(`${file}: stale generated output; run npm run generate:evidence-gap-map`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  const summary = gapModule.summarizeEvidenceGapMap(map)
  console.log(`Evidence Gap Map audit passed: ${summary.totalGaps} / ${summary.totalGaps} classified, ${summary.taskFamilyCount} families, ${summary.protocolCount} protocols, ${summary.unclassified} unclassified.`)
  console.log('Resolution classes:', summary.resolutionClasses)
  console.log('Acquisition costs:', summary.acquisitionCosts)
  console.log('Runtime relevance:', summary.runtimeRelevance)
  console.log('Unlock effects:', summary.unlockEffects)
} finally {
  await server.close()
}
