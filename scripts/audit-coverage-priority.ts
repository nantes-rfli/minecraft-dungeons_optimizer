import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })

try {
  const priorityModule = await server.ssrLoadModule('/src/research/coveragePriority.ts')
  const model = priorityModule.buildCoveragePriority()
  const errors = priorityModule.collectCoveragePriorityErrors(model)
  const json = `${JSON.stringify(model, null, 2)}\n`
  const generated = {
    'research/coverage-priority.json': json,
    'docs/coverage-priority.md': priorityModule.renderCoveragePriority(model),
  }
  const rerun = `${JSON.stringify(priorityModule.buildCoveragePriority(), null, 2)}\n`
  if (json !== rerun) errors.push('Coverage Priority generation is not deterministic')
  for (const [file, content] of Object.entries(generated)) {
    const target = path.join(root, file)
    if (write) fs.writeFileSync(target, content as string)
    else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) errors.push(`${file}: stale generated output; run npm run generate:coverage-priority`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  const summary = priorityModule.summarizeCoveragePriority(model)
  console.log(`Coverage Priority audit passed: ${summary.totalGaps} prioritized; P0 ${summary.tierCounts.P0}, P1 ${summary.tierCounts.P1}, P2 ${summary.tierCounts.P2}, P3 ${summary.tierCounts.P3}.`)
  console.log('Rank sensitivity:', summary.sensitivity)
  console.log(`Owned actionable ${summary.ownedActionableGaps}; owned P0 ${summary.ownedP0}; bundles ${summary.unlockBundles}; top protocol ${summary.topProtocol}.`)
} finally {
  await server.close()
}
