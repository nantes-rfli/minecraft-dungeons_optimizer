import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  RAW_PACKAGE_ARTIFACT_PATH, RAW_PACKAGE_REPORT_PATH, buildRawPackageSnapshot,
  hasRawPackageSource, renderRawPackageSnapshotReport, serializeRawPackageSnapshot,
} from './game-data-raw-package.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance

if (!hasRawPackageSource(repositoryRoot)) {
  console.log('Step 3A local package source is absent; committed Raw package snapshot was left unchanged.')
} else {
  const snapshot = buildRawPackageSnapshot(repositoryRoot, provenance)
  const artifactPath = path.join(repositoryRoot, RAW_PACKAGE_ARTIFACT_PATH)
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, serializeRawPackageSnapshot(snapshot))
  fs.writeFileSync(path.join(repositoryRoot, RAW_PACKAGE_REPORT_PATH), renderRawPackageSnapshotReport(snapshot))
  console.log(`Generated one Raw package snapshot for ${snapshot.logicalPackage.path}.`)
}
