import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import { buildGameDataBulkHarvestArtifact, collectBulkHarvestErrors, renderBulkHarvestReport, serializeBulkArtifact, type GameDataAssetIndex, type GameDataBulkHarvestArtifact } from './game-data-bulk-harvest.ts'
import { localDatasetRoot } from './game-data-extractor.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const index = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/raw/game-data-asset-index.json'), 'utf8')) as GameDataAssetIndex
const artifactPath = path.join(repositoryRoot, 'research/game-data-bulk-harvest.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-bulk-harvest.md')
const hasLocalSource = fs.existsSync(localDatasetRoot(repositoryRoot))
let generated: GameDataBulkHarvestArtifact | undefined
if (process.argv.includes('--write')) {
  if (!hasLocalSource) throw new Error('Local game data is required to generate the bulk harvest artifact')
  generated = buildGameDataBulkHarvestArtifact(repositoryRoot, provenance.dataset.id, index)
  fs.writeFileSync(artifactPath, serializeBulkArtifact(generated))
  fs.writeFileSync(reportPath, renderBulkHarvestReport(generated))
}
const committed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as GameDataBulkHarvestArtifact
const errors = collectBulkHarvestErrors(committed, provenance.dataset.id, index)
const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
if (trackedFiles.some((file) => /\.(?:uasset|uexp|umap|ubulk)$/.test(file))) errors.push('Raw game assets are tracked by Git')
if (trackedFiles.some((file) => file.startsWith('local-game-data/'))) errors.push('Local game-data cache is tracked by Git')
if (serializeBulkArtifact(committed) !== fs.readFileSync(artifactPath, 'utf8')) errors.push('Bulk harvest artifact is not canonical JSON')
if (renderBulkHarvestReport(committed) !== fs.readFileSync(reportPath, 'utf8')) errors.push('Bulk harvest report is stale')
if (generated && serializeBulkArtifact(generated) !== serializeBulkArtifact(committed)) errors.push('Local regeneration differs from committed bulk harvest')
if (errors.length) { console.error(errors.map((error) => `- ${error}`).join('\n')); process.exitCode = 1 } else {
  console.log(`Game Data Bulk Harvest audit passed: ${committed.selection.candidateCount} candidates, ${committed.selection.parsedCount} parsed, ${committed.records.length} facts.`)
  console.log(hasLocalSource ? 'Local source was available for optional reparse validation.' : 'Local source absent; compact committed artifact validated.')
}
