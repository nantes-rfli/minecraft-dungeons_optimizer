import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DAMAGE_REGRESSION_SAMPLES } from '../src/data/regressionSamples.ts'
import {
  collectDpsRegressionAuditErrors,
  collectRegressionFixtureAuditErrors,
  summarizeDpsRegressionAudit,
  type DpsRegressionAudit,
} from '../src/research/dpsRegressionAudit.ts'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const auditPath = path.join(projectRoot, 'research', 'dps-regression-audit.json')
const rawAudit: unknown = JSON.parse(fs.readFileSync(auditPath, 'utf8'))
const errors = collectDpsRegressionAuditErrors(rawAudit)

if (errors.length === 0) {
  errors.push(...collectRegressionFixtureAuditErrors(
    rawAudit as DpsRegressionAudit,
    DAMAGE_REGRESSION_SAMPLES,
  ))
}

if (errors.length > 0) {
  console.error(`DPS regression audit failed with ${errors.length} error(s):`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  const audit = rawAudit as DpsRegressionAudit
  const summary = summarizeDpsRegressionAudit(audit)
  console.log(`Validated ${summary.candidateCount} public DPS candidates.`)
  console.log(`Eligible ${summary.eligibleCount}; rejected ${summary.rejectedCount}.`)
  console.log(`Runtime regression samples ${DAMAGE_REGRESSION_SAMPLES.length}/5.`)
  console.log(summary.eligibleCount >= 5
    ? 'Full DPS regression is available.'
    : `Full DPS regression is pending; ${5 - summary.eligibleCount} additional eligible public observations are required.`)
}
