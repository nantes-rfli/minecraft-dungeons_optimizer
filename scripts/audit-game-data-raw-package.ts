import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  RAW_PACKAGE_REPORT_PATH, RAW_PACKAGE_SPECS, buildRawPackageSnapshot,
  collectRawPackageSnapshotErrors, hasRawPackageSource, renderRawPackageSnapshotReport,
  serializeRawPackageSnapshot, type RawPackageSnapshot,
} from './game-data-raw-package.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const reportPath = path.join(repositoryRoot, RAW_PACKAGE_REPORT_PATH)
const errors: string[] = []
const committed = RAW_PACKAGE_SPECS.map((spec) => {
  const committedText = fs.readFileSync(path.join(repositoryRoot, spec.artifactPath), 'utf8')
  const snapshot = JSON.parse(committedText) as RawPackageSnapshot
  errors.push(...collectRawPackageSnapshotErrors(snapshot, provenance, repositoryRoot, spec))
  if (serializeRawPackageSnapshot(snapshot) !== committedText) errors.push(`${spec.artifactPath} is not canonical JSON`)
  if (serializeRawPackageSnapshot(snapshot) !== serializeRawPackageSnapshot(JSON.parse(serializeRawPackageSnapshot(snapshot)))) errors.push(`${spec.id} serialization is not deterministic`)
  return snapshot
})

if (renderRawPackageSnapshotReport(committed) !== fs.readFileSync(reportPath, 'utf8')) errors.push(`${RAW_PACKAGE_REPORT_PATH} is stale`)

const trackedRawAssets = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' })
  .split('\n').filter((file) => /\.(?:uasset|uexp|umap|ubulk)$/i.test(file))
if (trackedRawAssets.length) errors.push(`Raw game assets are tracked: ${trackedRawAssets.join(', ')}`)

RAW_PACKAGE_SPECS.forEach((spec, index) => {
  if (!hasRawPackageSource(repositoryRoot, spec)) return
  const generated = buildRawPackageSnapshot(repositoryRoot, provenance, spec)
  if (serializeRawPackageSnapshot(generated) !== serializeRawPackageSnapshot(committed[index])) errors.push(`${spec.id} snapshot differs from the selected local source`)
})

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Raw package snapshot audit passed for ${committed.length} independent packages.`)
committed.forEach((snapshot) => console.log(`${snapshot.logicalPackage.path}: ${snapshot.package.exports.length} exports; ${snapshot.package.diagnostics.length} diagnostics.`))
console.log(`Extractor/parser code identity matched: ${committed[0]!.extraction.codeIdentity.algorithm}:${committed[0]!.extraction.codeIdentity.value}.`)
console.log(RAW_PACKAGE_SPECS.every((spec) => hasRawPackageSource(repositoryRoot, spec)) ? 'Local input sizes, SHA-256 hashes, and deterministic regeneration matched.' : 'Some local sources absent; all committed snapshot contracts still validated.')
