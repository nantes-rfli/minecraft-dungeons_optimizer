import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import {
  buildGameDataExtractorArtifact, collectExtractorArtifactErrors, hasSelectedLocalSource,
  PARSER_ID, PARSER_SCHEMA_VERSION, renderGameDataExtractorReport, serializeExtractorArtifact,
  type GameDataExtractorArtifact,
} from './game-data-extractor.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const artifactPath = path.join(repositoryRoot, 'research/game-data-extractor-samples.json')
const reportPath = path.join(repositoryRoot, 'docs/game-data-extractor.md')
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const committedText = fs.readFileSync(artifactPath, 'utf8')
const committed = JSON.parse(committedText) as GameDataExtractorArtifact
const errors = collectExtractorArtifactErrors(committed, provenance.dataset.id)

if (serializeExtractorArtifact(committed) !== committedText) errors.push('research/game-data-extractor-samples.json is not canonical JSON')
if (renderGameDataExtractorReport(committed) !== fs.readFileSync(reportPath, 'utf8')) errors.push('docs/game-data-extractor.md is stale')
if (serializeExtractorArtifact(committed) !== serializeExtractorArtifact(JSON.parse(serializeExtractorArtifact(committed)))) errors.push('Extractor serialization is not deterministic')

const trackedRawAssets = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' })
  .split('\n').filter((file) => /\.(?:uasset|uexp|umap|ubulk)$/i.test(file))
if (trackedRawAssets.length) errors.push(`Raw game assets are tracked: ${trackedRawAssets.join(', ')}`)

const rawValue = (propertyPath: string) => committed.records.find((record) => record.extraction?.propertyPath === propertyPath)?.rawObservation?.value
const expectRaw = (propertyPath: string, expected: unknown): void => {
  if (JSON.stringify(rawValue(propertyPath)) !== JSON.stringify(expected)) errors.push(`Acceptance value mismatch for ${propertyPath}`)
}

expectRaw('AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles', 3)
expectRaw('AttackDefintion.AttackRateSeconds', 0.6000000238418579)
expectRaw('AttackDefintion.ProjectileDefinition[0].DelaySecondsPerProjectile', 0.029999999329447746)
expectRaw('AttackDefintion.ProjectileDefinition[0].ProjectileOffset', { X: 45, Y: 0, Z: 25 })
expectRaw('damage', 50)
expectRaw('ProjectileOverrides', { count: 7 })
expectRaw('AnimNotifyStateData', { count: 7 })

const projectile = rawValue('AttackDefintion.ProjectileDefinition[0].Projectile') as { rawPackageIndex?: number; objectName?: string } | undefined
if (projectile?.rawPackageIndex !== -5 || projectile.objectName !== 'BP_ScatterCrossBow_Arrow_C') errors.push('Projectile object-reference acceptance mismatch')
const gearActor = rawValue('GearActor') as { objectName?: string } | undefined
if (gearActor?.objectName !== 'BP_ScatterCrossbow_C') errors.push('GearActor object-reference acceptance mismatch')
const instanceAsset = committed.assets.find((asset) => asset.path.endsWith('/BP_ScatterCrossbowInstance'))
if (instanceAsset?.superclass?.resolvedObjectName !== 'BP_ArrowBaseRangedWeapon_C') errors.push('Generated-class superclass acceptance mismatch')

if (hasSelectedLocalSource(repositoryRoot)) {
  const generated = buildGameDataExtractorArtifact(repositoryRoot, provenance.dataset.id)
  if (serializeExtractorArtifact(generated) !== committedText) errors.push('Committed extractor artifact differs from the selected local source')
  if (renderGameDataExtractorReport(generated) !== fs.readFileSync(reportPath, 'utf8')) errors.push('Generated extractor report differs from the selected local source')
}

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Game Data Extractor audit passed: ${PARSER_ID} schema ${PARSER_SCHEMA_VERSION}.`)
console.log(`${committed.assets.length} logical assets; ${committed.records.length} formal records; ${committed.diagnostics.length} diagnostics.`)
console.log(hasSelectedLocalSource(repositoryRoot) ? 'Selected local source acceptance and content hashes matched.' : 'Local source absent; committed samples validated without raw assets.')
