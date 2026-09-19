import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EvidenceGap } from '../src/research/evidenceGapMap.ts'
import { validateSemanticRuleRegistry } from '../src/research/gameDataSemanticRules.ts'
import { buildBulkSemanticArtifact, buildGapReconciliationArtifact, collectBulkSemanticErrors, collectGapReconciliationErrors, renderGapReconciliationReport, serializeReconciliation, type GameDataBulkSemanticArtifact, type GameDataGapReconciliationArtifact } from './game-data-gap-reconciliation.ts'
import type { GameDataBulkHarvestArtifact } from './game-data-bulk-harvest.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const bulk = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/raw/game-data-bulk-harvest.json'), 'utf8')) as GameDataBulkHarvestArtifact
const gapMap = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/evidence-gap-map.json'), 'utf8')) as { gaps: readonly EvidenceGap[] }
const semanticPath = path.join(repositoryRoot, 'research/domain/game-data-bulk-semantic-mappings.json')
const reconciliationPath = path.join(repositoryRoot, 'research/analysis/game-data-gap-reconciliation.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-gap-reconciliation.md')
const generatedSemantic = buildBulkSemanticArtifact(bulk, gapMap.gaps)
const generatedReconciliation = buildGapReconciliationArtifact(bulk.datasetId, gapMap.gaps, generatedSemantic)
if (process.argv.includes('--write')) {
  fs.writeFileSync(semanticPath, serializeReconciliation(generatedSemantic))
  fs.writeFileSync(reconciliationPath, serializeReconciliation(generatedReconciliation))
  fs.writeFileSync(reportPath, renderGapReconciliationReport(generatedReconciliation, generatedSemantic))
}
const committedSemantic = JSON.parse(fs.readFileSync(semanticPath, 'utf8')) as GameDataBulkSemanticArtifact
const committedReconciliation = JSON.parse(fs.readFileSync(reconciliationPath, 'utf8')) as GameDataGapReconciliationArtifact
const errors = [
  ...validateSemanticRuleRegistry(), ...collectBulkSemanticErrors(committedSemantic, bulk),
  ...collectGapReconciliationErrors(committedReconciliation, gapMap.gaps, committedSemantic),
]
if (serializeReconciliation(generatedSemantic) !== fs.readFileSync(semanticPath, 'utf8')) errors.push('Bulk semantic artifact differs from deterministic generation')
if (serializeReconciliation(generatedReconciliation) !== fs.readFileSync(reconciliationPath, 'utf8')) errors.push('Gap reconciliation artifact differs from deterministic generation')
if (renderGapReconciliationReport(committedReconciliation, committedSemantic) !== fs.readFileSync(reportPath, 'utf8')) errors.push('Gap reconciliation report is stale')
if (errors.length) { console.error([...new Set(errors)].sort().map((error) => `- ${error}`).join('\n')); process.exitCode = 1 } else {
  const summary = committedReconciliation.summary
  console.log(`Game Data Gap Reconciliation audit passed: ${summary.closedCount} closed, ${summary.remainingGapCount} remaining from ${summary.baselineGapCount}.`)
  console.log(`${committedSemantic.summary.total} semantic mappings; runtime promotion not performed.`)
}
