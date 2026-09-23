import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  RAW_STRUCTURAL_INVENTORY_PATH, RAW_STRUCTURAL_REPORT_PATH, buildRawStructuralInventory,
  buildRawStructuralInventoryShards, renderRawStructuralInventoryReport, serializeRawStructuralInventoryManifest,
} from './game-data-raw-structural-inventory.ts'
import { localDatasetRoot } from './game-data-package-source.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
if (!fs.existsSync(localDatasetRoot(repositoryRoot))) throw new Error('Local 1.17.0.0 game data is required to generate the Raw structural inventory')

const artifact = buildRawStructuralInventory(repositoryRoot, provenance)
const { manifest, files } = buildRawStructuralInventoryShards(artifact)
const artifactDirectory = path.dirname(path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_PATH))
fs.rmSync(artifactDirectory, { recursive: true, force: true })
fs.mkdirSync(path.join(artifactDirectory, 'shards'), { recursive: true })
for (const file of files) fs.writeFileSync(path.join(artifactDirectory, file.path), file.bytes)
fs.rmSync(path.join(repositoryRoot, 'research/raw/game-data-raw-structural-inventory.json'), { force: true })
fs.writeFileSync(path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_PATH), serializeRawStructuralInventoryManifest(manifest))
fs.writeFileSync(path.join(repositoryRoot, RAW_STRUCTURAL_REPORT_PATH), renderRawStructuralInventoryReport(artifact))
const compressedBytes = manifest.shards.reduce((sum, shard) => sum + shard.compressedBytes, 0)
console.log(`Generated Raw Structural Inventory: ${artifact.summary.seedCount} catalog seeds, ${artifact.summary.visitedPackageCount} visited packages, ${artifact.summary.edgeCount} edges, ${files.length} shards, ${Math.ceil(compressedBytes / 1024 / 1024)} MiB compressed.`)
