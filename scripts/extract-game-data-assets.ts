import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import { buildGameDataExtractorArtifact, hasSelectedLocalSource, renderGameDataExtractorReport, serializeExtractorArtifact } from './game-data-extractor.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance

if (!hasSelectedLocalSource(repositoryRoot)) {
  console.log('Selected local game data is absent; committed extractor samples were left unchanged.')
} else {
  const artifact = buildGameDataExtractorArtifact(repositoryRoot, provenance.dataset.id)
  fs.writeFileSync(path.join(repositoryRoot, 'research/game-data-extractor-samples.json'), serializeExtractorArtifact(artifact))
  fs.writeFileSync(path.join(repositoryRoot, 'docs/game-data-extractor.md'), renderGameDataExtractorReport(artifact))
  console.log(`Extracted ${artifact.records.length} formal structural records from ${artifact.assets.length} logical assets.`)
}
