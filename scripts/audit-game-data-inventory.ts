import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectArtifactErrors, GAME_DATA_ROOT, LOCAL_MANIFEST_PATH, reconcileSource, renderLocalManifest,
  renderReport, scanGameData, serializeJson, type GameDataAssetIndex, type GameDataInventory,
} from './game-data-inventory.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const inventoryPath = path.join(repositoryRoot, 'research/game-data-inventory.json')
const indexPath = path.join(repositoryRoot, 'research/game-data-asset-index.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-inventory.md')
const sourceAvailable = fs.existsSync(GAME_DATA_ROOT)

if (write && !sourceAvailable) throw new Error(`Game data source unavailable: ${GAME_DATA_ROOT}`)

const readArtifacts = () => ({
  inventory: JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as GameDataInventory,
  index: JSON.parse(fs.readFileSync(indexPath, 'utf8')) as GameDataAssetIndex,
})

if (write) {
  const generated = scanGameData()
  fs.mkdirSync(path.dirname(LOCAL_MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(LOCAL_MANIFEST_PATH, renderLocalManifest(generated.files))
  fs.writeFileSync(inventoryPath, serializeJson(generated.inventory))
  fs.writeFileSync(indexPath, serializeJson(generated.index))
  fs.writeFileSync(reportPath, renderReport(generated.inventory, generated.index))
}

const committed = readArtifacts()
const errors = collectArtifactErrors(committed.inventory, committed.index)
if (!fs.existsSync(reportPath) || renderReport(committed.inventory, committed.index) !== fs.readFileSync(reportPath, 'utf8')) errors.push('docs/game-data-inventory.md is stale for committed artifacts')
if (sourceAvailable) {
  const generated = scanGameData()
  errors.push(...reconcileSource(generated, committed))
  if (!fs.existsSync(LOCAL_MANIFEST_PATH) || renderLocalManifest(generated.files) !== fs.readFileSync(LOCAL_MANIFEST_PATH, 'utf8')) errors.push('Local full manifest is stale')
} else {
  console.log('Source reconciliation skipped: local source unavailable.')
}

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
const { totals, companions, sourceFingerprint } = committed.inventory
console.log(`Game Data Inventory audit passed: ${totals.files} files, ${totals.directories} directories, ${totals.bytes} bytes.`)
console.log(`Uasset packages: ${companions.uassetPackages}; ${companions.uassetWithUexp} with uexp; ${companions.uassetWithUexpAndUbulk} with uexp+ubulk; ${companions.uassetWithoutUexp} without uexp.`)
console.log(`Umap packages: ${companions.umapPackages}; ${companions.umapWithUexp} with uexp; ${companions.umapWithUexpAndUbulk} with uexp+ubulk; ${companions.umapWithoutUexp} without uexp.`)
console.log(`Payloads without package header: ${companions.uexpWithoutPackageHeader} uexp; ${companions.ubulkWithoutPackageHeader} ubulk.`)
console.log(`Indexed logical assets: ${committed.index.assets.length}; fingerprint ${sourceFingerprint.value}.`)
