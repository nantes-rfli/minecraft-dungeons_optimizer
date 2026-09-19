import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import type { GameDataInventory } from './game-data-inventory.ts'
import {
  buildGameDataSourceProvenance, collectGameDataProvenanceErrors,
  renderGameDataProvenanceReport, serializeProvenance,
} from './game-data-provenance.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const inventoryPath = path.join(repositoryRoot, 'research/game-data-inventory.json')
const provenancePath = path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-source-provenance.md')

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as GameDataInventory
const generated = buildGameDataSourceProvenance(inventory)
if (write) {
  fs.writeFileSync(provenancePath, serializeProvenance(generated))
  fs.writeFileSync(reportPath, renderGameDataProvenanceReport(generated))
}

const committed = JSON.parse(fs.readFileSync(provenancePath, 'utf8')) as GameDataSourceProvenance
const errors = collectGameDataProvenanceErrors(committed, inventory)
if (serializeProvenance(generated) !== fs.readFileSync(provenancePath, 'utf8')) errors.push('research/sources/game-data-source-provenance.json is stale')
if (renderGameDataProvenanceReport(committed) !== fs.readFileSync(reportPath, 'utf8')) errors.push('docs/game-data-source-provenance.md is stale')
if (serializeProvenance(buildGameDataSourceProvenance(inventory)) !== serializeProvenance(generated)) errors.push('Provenance generation is not deterministic')

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Game Data Provenance audit passed: ${committed.dataset.id}.`)
console.log(`Fingerprint ${committed.dataset.sourceFingerprint.value}; ${committed.dataset.totals.files} files; ${committed.dataset.totals.bytes} bytes.`)
console.log('Local source is not required; runtime promotion remains research-only and non-automatic.')
