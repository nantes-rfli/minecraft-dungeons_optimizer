import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { digest, fieldDigests } from '../tests/fixtures/runtimeBaselineDigest.ts'
import type { Build, Scenario } from '../src/core/types'

// Deliberate provenance: never regenerate from the working tree's evaluate/optimize.
const baselineCommit = 'fc83d2bd94770736c76564bf3c2369e769909a13'
const root = fileURLToPath(new URL('..', import.meta.url))
const baselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'melee-runtime-baseline-'))
execFileSync('tar', ['-xf', '-', '-C', baselineRoot], { input: execFileSync('git', ['archive', baselineCommit], { cwd: root, maxBuffer: 32 * 1024 * 1024 }) })
const options = { configFile: false as const, server: { middlewareMode: true, hmr: false as const, watch: null, ws: false as const } }
const current = await createServer({ root, ...options })
const baseline = await createServer({ root: baselineRoot, ...options })
try {
  const { representativeCases } = await current.ssrLoadModule('/src/research/runtimeCombinations.ts')
  const { evaluate } = await baseline.ssrLoadModule('/src/core/evaluate.ts')
  const { optimize } = await baseline.ssrLoadModule('/src/core/optimizer.ts')
  const inputs: { name: string; build: Build; scenario: Scenario }[] = representativeCases()
  const cases = inputs.map(({ name, build, scenario }) => ({ name, evaluation: fieldDigests(evaluate(build, scenario)), optimization: digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario)) }))
  const inventory = { weapons: inputs.map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: inputs[0]!.build.artifacts }
  const combined = digest(optimize(inventory, inputs[0]!.scenario))
  fs.writeFileSync(path.join(root, 'tests/fixtures/runtime-support-baseline.json'), JSON.stringify({ baselineCommit, note: 'Exact per-field SHA-256 of software outputs, not game measurements. Captured only from git archive of baselineCommit.', cases, combined }, null, 2) + '\n')
  console.log(`Captured ${cases.length} complete evaluate/optimize cases and combined objective/Pareto from ${baselineCommit}`)
} finally {
  await current.close()
  await baseline.close()
}
