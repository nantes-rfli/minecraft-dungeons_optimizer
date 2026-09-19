import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  RAW_PACKAGE_ARTIFACT_PATH, RAW_PACKAGE_REPORT_PATH, buildRawPackageSnapshot,
  collectRawPackageSnapshotErrors, hasRawPackageSource, renderRawPackageSnapshotReport,
  serializeRawPackageSnapshot, type RawPackageSnapshot,
} from './game-data-raw-package.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const artifactPath = path.join(repositoryRoot, RAW_PACKAGE_ARTIFACT_PATH)
const reportPath = path.join(repositoryRoot, RAW_PACKAGE_REPORT_PATH)
const committedText = fs.readFileSync(artifactPath, 'utf8')
const committed = JSON.parse(committedText) as RawPackageSnapshot
const errors = collectRawPackageSnapshotErrors(committed, provenance)

if (serializeRawPackageSnapshot(committed) !== committedText) errors.push(`${RAW_PACKAGE_ARTIFACT_PATH} is not canonical JSON`)
if (renderRawPackageSnapshotReport(committed) !== fs.readFileSync(reportPath, 'utf8')) errors.push(`${RAW_PACKAGE_REPORT_PATH} is stale`)
if (serializeRawPackageSnapshot(committed) !== serializeRawPackageSnapshot(JSON.parse(serializeRawPackageSnapshot(committed)))) errors.push('Raw package serialization is not deterministic')

const trackedRawAssets = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' })
  .split('\n').filter((file) => /\.(?:uasset|uexp|umap|ubulk)$/i.test(file))
if (trackedRawAssets.length) errors.push(`Raw game assets are tracked: ${trackedRawAssets.join(', ')}`)

if (hasRawPackageSource(repositoryRoot)) {
  const generated = buildRawPackageSnapshot(repositoryRoot, provenance)
  if (serializeRawPackageSnapshot(generated) !== committedText) errors.push('Committed Raw package snapshot differs from the selected local source')
}

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Raw package snapshot audit passed: ${committed.logicalPackage.path}.`)
console.log(`${committed.package.exports.length} exports; ${committed.package.objects.filter((object) => object.extraction.state === 'decoded').length} decoded CDO; ${committed.package.diagnostics.length} diagnostics.`)
console.log(hasRawPackageSource(repositoryRoot) ? 'Local input sizes, SHA-256 hashes, and deterministic regeneration matched.' : 'Local source absent; committed snapshot contract validated.')
