import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  RAW_PACKAGE_REPORT_PATH, RAW_PACKAGE_SPECS, buildRawPackageSnapshot,
  hasRawPackageSource, renderRawPackageSnapshotReport, serializeRawPackageSnapshot,
} from './game-data-raw-package.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance

const available = RAW_PACKAGE_SPECS.filter((spec) => hasRawPackageSource(repositoryRoot, spec))
if (available.length !== RAW_PACKAGE_SPECS.length) {
  const missing = RAW_PACKAGE_SPECS.filter((spec) => !hasRawPackageSource(repositoryRoot, spec)).map((spec) => spec.packagePath)
  console.log(`Step 3A local package sources are incomplete; committed Raw package snapshots were left unchanged. Missing: ${missing.join(', ')}`)
} else {
  const snapshots = RAW_PACKAGE_SPECS.map((spec) => buildRawPackageSnapshot(repositoryRoot, provenance, spec))
  snapshots.forEach((snapshot, index) => {
    const artifactPath = path.join(repositoryRoot, RAW_PACKAGE_SPECS[index]!.artifactPath)
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, serializeRawPackageSnapshot(snapshot))
  })
  fs.writeFileSync(path.join(repositoryRoot, RAW_PACKAGE_REPORT_PATH), renderRawPackageSnapshotReport(snapshots))
  console.log(`Generated ${snapshots.length} independent Raw package snapshots.`)
}
