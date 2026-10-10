import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const write = process.argv.includes('--write')
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false, watch: null, ws: false } })

try {
  const module = await server.ssrLoadModule('/src/research/sourceHarvest.ts')
  const harvest = module.buildSourceHarvest()
  const errors = module.collectSourceHarvestErrors(harvest)
  const json = `${JSON.stringify(harvest)}\n` // Compact, lossless large research snapshot
  const markdown = module.renderSourceHarvest(harvest)
  const browserValue = (value: unknown): string => {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value)
    return rendered.length > 160 ? `${rendered.slice(0, 157)}…` : rendered
  }
  const browserSourceIds = new Set(harvest.records.flatMap((record: { sourceIds: string[] }) => record.sourceIds))
  const browser = {
    schemaVersion: harvest.schemaVersion,
    targetGameVersion: harvest.targetGameVersion,
    sources: harvest.sources.filter((source: { id: string }) => browserSourceIds.has(source.id)).map((source: { id: string; title: string; url?: string; sourceType: string; gameVersion: string; versionStatus: string }) => ({ id: source.id, title: source.title, ...(source.url ? { url: source.url } : {}), sourceType: source.sourceType, gameVersion: source.gameVersion, versionStatus: source.versionStatus })),
    records: harvest.records.map((record: { category: string; id: string; known: { property: string; value: unknown; confidence: string; status: string; notes?: string; sourceIds: string[]; targetGameVersion: string; applicableGameVersion?: string; versionStatus: string }[]; unknown: { property: string; kind: string; sourceAttempts: { sourceId: string; result: string; note?: string }[] }[]; conflicts: { property: string; probableReason: string; resolutionStatus: string }[]; sourceIds: string[]; version: unknown }) => ({
      category: record.category,
      id: record.id,
      known: record.known.map((fact) => ({ property: fact.property, value: browserValue(fact.value), confidence: fact.confidence, status: fact.status, sourceIds: fact.sourceIds, targetGameVersion: fact.targetGameVersion, ...(fact.applicableGameVersion ? { applicableGameVersion: fact.applicableGameVersion } : {}), versionStatus: fact.versionStatus, ...(fact.notes ? { notes: fact.notes } : {}) })),
      unknown: record.unknown.map((entry) => ({ property: entry.property, kind: entry.kind, sourceAttempts: entry.sourceAttempts })),
      conflicts: record.conflicts.map((conflict) => ({ property: conflict.property, probableReason: conflict.probableReason, resolutionStatus: conflict.resolutionStatus })),
      sourceIds: record.sourceIds,
      version: record.version,
    })),
  }
  const browserJson = `${JSON.stringify(browser, null, 2)}\n`
  const generated = { 'research/source-harvest.json': json, 'research/source-harvest-browser.json': browserJson, 'docs/source-harvest.md': markdown }
  if (json !== `${JSON.stringify(module.buildSourceHarvest())}\n`) errors.push('Source Harvest generation is not deterministic')
  if (write) for (const [file, content] of Object.entries(generated)) fs.writeFileSync(path.join(root, file), content as string)
  else for (const [file, content] of Object.entries(generated)) {
    if (!fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), 'utf8') !== content) errors.push(`${file}: stale generated output; run npm run harvest:sources`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`Source Harvest audit passed: ${harvest.records.length} entities, ${harvest.sources.length} sources, ${harvest.gaps.length} gap candidates.`)
  for (const category of harvest.coverage) console.log(`${category.category}: ${category.population}; ${category.properties.map((property: { property: string; known: number; population: number }) => `${property.property} ${property.known}/${property.population}`).join(', ')}`)
} finally {
  await server.close()
}
