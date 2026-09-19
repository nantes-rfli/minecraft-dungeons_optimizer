import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { buildFinalCoverage, loadInputs, renderReports, serialize } from './game-data-final-coverage.ts'
const root = fileURLToPath(new URL('..', import.meta.url))
const result = buildFinalCoverage(loadInputs(root))
const reports = renderReports(result)
const outputs = {
  'research/analysis/game-data-final-coverage.json': serialize(result.finalCoverage),
  'research/analysis/game-data-model-differences.json': serialize(result.modelDifferences),
  'docs/game-data-final-coverage.md': reports.coverage,
  'docs/game-data-model-differences.md': reports.differences,
}
for (const [file, content] of Object.entries(outputs)) {
  if (/(?:\/Users\/|\/home\/|[A-Z]:\\\\)/.test(content)) throw new Error(`${file}: absolute path`)
  if (process.argv.includes('--write')) fs.writeFileSync(new URL(`../${file}`, import.meta.url), content)
  if (fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8') !== content) throw new Error(`${file}: deterministic artifact/docs drift`)
}
if (/\.(uasset|uexp|umap|ubulk)$/im.test(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }))) throw new Error('Raw assets tracked')
console.log(`Final coverage audit passed: ${result.modelDifferences.gapClassifications.length} Gap classifications; all evidence traces valid; no runtime promotion.`)
