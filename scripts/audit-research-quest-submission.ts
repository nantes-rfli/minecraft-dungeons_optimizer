import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { auditResearchQuestSubmission } from './lib/research-quest-submission.ts'

const args = process.argv.slice(2)
if ((args.length !== 1 && !(args.length === 3 && args[1] === '--trace-files')) || args[0]!.startsWith('-')) {
  console.error('Usage: npm run audit:research-quest-submission -- /absolute/path/submission.json [--trace-files /absolute/path/traces.json]')
  process.exitCode = 1
} else {
  try {
    const serialized = fs.readFileSync(args[0]!, 'utf8')
    // Reject an invalid submission before reading any sidecar-specified files.
    let result = auditResearchQuestSubmission(serialized)
    if (args[2] !== undefined) {
      const manifestPath = path.resolve(args[2])
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      assert(manifest && manifest.schemaVersion === 1 && Array.isArray(manifest.traces), 'invalid local trace manifest')
      const traces = manifest.traces.map((trace: unknown) => {
        assert(trace && typeof trace === 'object' && 'locator' in trace && typeof trace.locator === 'string' && 'path' in trace && typeof trace.path === 'string' && trace.path.trim(), 'invalid local trace file entry')
        const file = path.resolve(path.dirname(manifestPath), trace.path)
        assert(fs.statSync(file).isFile(), 'local trace path must be a file')
        return { locator: trace.locator, bytes: fs.readFileSync(file) }
      })
      result = auditResearchQuestSubmission(serialized, traces)
    }
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Research Quest submission audit failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
