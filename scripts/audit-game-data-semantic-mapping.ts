import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataProvenanceRecord, GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  collectSemanticMappingErrors, serializeSemanticMapping,
  type GameDataSemanticMappingArtifact,
} from '../src/research/gameDataSemanticMapping.ts'
import type { GameDataExtractorArtifact } from './game-data-extractor.ts'
import {
  buildGameDataSemanticMappingArtifact, buildGameDataSemanticSourceArtifact,
  collectSemanticSourceErrors, hasSemanticLocalSource, renderGameDataSemanticMappingReport,
  type GameDataSemanticSourceArtifact,
} from './game-data-semantic-mapping.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const semanticSourcePath = path.join(repositoryRoot, 'research/raw/game-data-semantic-source-samples.json')
const mappingPath = path.join(repositoryRoot, 'research/game-data-semantic-mappings.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-semantic-mapping.md')
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const extractor = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/raw/game-data-extractor-samples.json'), 'utf8')) as GameDataExtractorArtifact
const sourceHarvest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/source-harvest.json'), 'utf8')) as { sources: readonly { id: string }[] }
const write = process.argv.includes('--write')

let semanticSource: GameDataSemanticSourceArtifact
if (hasSemanticLocalSource(repositoryRoot)) {
  semanticSource = buildGameDataSemanticSourceArtifact(repositoryRoot, provenance.dataset.id)
} else {
  semanticSource = JSON.parse(fs.readFileSync(semanticSourcePath, 'utf8')) as GameDataSemanticSourceArtifact
}
const sourceRecords: GameDataProvenanceRecord[] = [...extractor.records, ...semanticSource.records]
const artifact = buildGameDataSemanticMappingArtifact(provenance.dataset.id, sourceRecords)
const report = renderGameDataSemanticMappingReport(semanticSource, artifact)

if (write) {
  fs.writeFileSync(semanticSourcePath, serializeSemanticMapping(semanticSource))
  fs.writeFileSync(mappingPath, serializeSemanticMapping(artifact))
  fs.writeFileSync(reportPath, report)
}

const committedSourceText = fs.readFileSync(semanticSourcePath, 'utf8')
const committedMappingText = fs.readFileSync(mappingPath, 'utf8')
const committedSource = JSON.parse(committedSourceText) as GameDataSemanticSourceArtifact
const committedMapping = JSON.parse(committedMappingText) as GameDataSemanticMappingArtifact
const knownCrossCheckSourceIds = new Set(sourceHarvest.sources.map((source) => source.id))
const errors = [
  ...collectSemanticSourceErrors(committedSource, provenance.dataset.id),
  ...collectSemanticMappingErrors(committedMapping, [...extractor.records, ...committedSource.records], knownCrossCheckSourceIds),
]

if (serializeSemanticMapping(committedSource) !== committedSourceText) errors.push('research/raw/game-data-semantic-source-samples.json is not canonical JSON')
if (serializeSemanticMapping(committedMapping) !== committedMappingText) errors.push('research/game-data-semantic-mappings.json is not canonical JSON')
if (serializeSemanticMapping(artifact) !== committedMappingText) errors.push('Committed semantic mappings differ from deterministic generation')
if (report !== fs.readFileSync(reportPath, 'utf8')) errors.push('docs/game-data-semantic-mapping.md is stale')
if (serializeSemanticMapping(artifact) !== serializeSemanticMapping(buildGameDataSemanticMappingArtifact(provenance.dataset.id, structuredClone(sourceRecords)))) errors.push('Semantic mapping generation is not deterministic')
if (hasSemanticLocalSource(repositoryRoot) && serializeSemanticMapping(semanticSource) !== committedSourceText) errors.push('Committed semantic source samples differ from selected local source')

const trackedRawAssets = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' })
  .split('\n').filter((file) => /\.(?:uasset|uexp|umap|ubulk)$/i.test(file))
if (trackedRawAssets.length) errors.push(`Raw game assets are tracked: ${trackedRawAssets.join(', ')}`)

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Game Data Semantic Mapping audit passed: ${committedMapping.mappings.length} mappings across ${Object.keys(committedMapping.summary.byCategory).length} categories.`)
console.log(`${committedMapping.summary.accepted} accepted; ${committedMapping.summary.tentative} tentative; ${committedMapping.summary.unresolved} unresolved; ${committedMapping.summary.rejected} rejected.`)
console.log(`${committedSource.assets.length} additional logical assets; ${committedSource.records.length} extracted semantic source records.`)
console.log(hasSemanticLocalSource(repositoryRoot) ? 'Selected local semantic sources and content hashes matched.' : 'Local source absent; committed semantic samples validated without raw assets.')
