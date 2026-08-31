import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { digest, fieldDigests } from '../tests/fixtures/runtimeBaselineDigest.ts'
import type { Build, Scenario } from '../src/core/types'

// Capture only the immutable pre-refactor source; never bless current outputs.
const baselineCommit = '34e9b729ccf8ec947932ec8936541c9ea38c67d7'
const root = fileURLToPath(new URL('..', import.meta.url))
const baselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-foundation-baseline-'))
execFileSync('tar', ['-xf', '-', '-C', baselineRoot], { input: execFileSync('git', ['archive', baselineCommit], { cwd: root, maxBuffer: 32 * 1024 * 1024 }) })
const options = { configFile: false as const, server: { middlewareMode: true, hmr: false as const, watch: null, ws: false as const } }
const current = await createServer({ root, ...options })
const baseline = await createServer({ root: baselineRoot, ...options })
try {
  const { artifactRegressionCases } = await current.ssrLoadModule('/src/research/artifactRegressionCases.ts')
  const { evaluate, evaluateCandidate } = await baseline.ssrLoadModule('/src/core/evaluate.ts')
  const { optimize } = await baseline.ssrLoadModule('/src/core/optimizer.ts')
  const inputs: { name: string; build: Build; scenario: Scenario }[] = artifactRegressionCases()
  const cases = inputs.map(({ name, build, scenario }) => ({ name, evaluation: fieldDigests(evaluate(build, scenario)), candidate: fieldDigests(evaluateCandidate(build, scenario)), optimization: digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario)) }))
  const inventory = { weapons: inputs.filter((_, index) => index % 30 === 0).map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: inputs[21]!.build.artifacts }
  const combined = digest(optimize(inventory, inputs[0]!.scenario))
  fs.writeFileSync(path.join(root, 'tests/fixtures/artifact-foundation-baseline.json'), JSON.stringify({ baselineCommit, note: 'Exact complete software output field hashes from git archive; not game measurements.', cases, combined }, null, 2) + '\n')
  console.log(`Captured ${cases.length} evaluate/evaluateCandidate/optimize cases and combined ordering/Pareto from ${baselineCommit}`)
} finally {
  await current.close()
  await baseline.close()
  fs.rmSync(baselineRoot, { recursive: true, force: true })
}
