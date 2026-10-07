import fs from 'node:fs'
import { auditResearchQuestSubmission } from './lib/research-quest-submission.ts'

const args = process.argv.slice(2)
if (args.length !== 1 || args[0]!.startsWith('-')) {
  console.error('Usage: npm run audit:research-quest-submission -- /absolute/path/submission.json')
  process.exitCode = 1
} else {
  try {
    const result = auditResearchQuestSubmission(fs.readFileSync(args[0]!, 'utf8'))
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Research Quest submission audit failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
