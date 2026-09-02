import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { digest } from '../tests/fixtures/runtimeBaselineDigest.ts'
import type { Build, Scenario } from '../src/core/types'

// Capture only the immutable Phase 2-3A starting point; never bless working-tree output.
const baselineCommit = 'b022c092bd7eb71b65c881f27110b72884f3f801'
const root = fileURLToPath(new URL('..', import.meta.url))
const baselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'armor-foundation-baseline-'))
execFileSync('tar', ['-xf', '-', '-C', baselineRoot], { input: execFileSync('git', ['archive', baselineCommit], { cwd: root, maxBuffer: 32 * 1024 * 1024 }) })
const options = { configFile: false as const, server: { middlewareMode: true, hmr: false as const, watch: null, ws: false as const } }
const current = await createServer({ root, ...options })
const baseline = await createServer({ root: baselineRoot, ...options })
try {
  const { artifactRegressionCases } = await current.ssrLoadModule('/src/research/artifactRegressionCases.ts')
  const { evaluate, evaluateCandidate } = await baseline.ssrLoadModule('/src/core/evaluate.ts')
  const { optimize } = await baseline.ssrLoadModule('/src/core/optimizer.ts')
  const inputs: { name: string; build: Build; scenario: Scenario }[] = artifactRegressionCases()
  const cases = inputs.map(({ name, build, scenario }) => ({
    name,
    evaluation: digest(evaluate(build, scenario)),
    candidate: digest(evaluateCandidate(build, scenario)),
    optimization: digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario)),
  }))
  const inventory = { weapons: inputs.filter((_, index) => index % 30 === 0).map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: inputs[21]!.build.artifacts }
  const combined = digest(optimize(inventory, inputs[0]!.scenario))
  fs.writeFileSync(path.join(root, 'tests/fixtures/armor-foundation-baseline.json'), `${JSON.stringify({ baselineCommit, note: 'Complete evaluate/evaluateCandidate/optimize SHA-256 values captured from the immutable pre-Armor commit; not game measurements.', cases, combined }, null, 2)}\n`)
  console.log(`Captured ${cases.length} Armor-foundation regression cases from ${baselineCommit}`)
} finally {
  await current.close()
  await baseline.close()
  fs.rmSync(baselineRoot, { recursive: true, force: true })
}
