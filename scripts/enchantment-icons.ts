import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { decodeTextureAsset } from './equipment-icons.ts'

export type EnchantmentCategory = 'melee' | 'ranged' | 'armor'
export type EnchantmentIconStatus = 'matched' | 'multiple-candidates' | 'not-found' | 'export-failed' | 'convert-failed' | 'invalid-output'

export interface EnchantmentIconManifestEntry {
  readonly enchantmentId: string
  readonly sourceAsset?: string
  readonly sourcePackage?: string
  readonly outputWebp?: string
  readonly status: EnchantmentIconStatus
  readonly matchMethod?: 'definition-reference' | 'documented-internal-id-alias'
  readonly candidates?: readonly string[]
  readonly notes?: string
  readonly sha256?: string
}

export interface EnchantmentIconManifest {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly entries: readonly EnchantmentIconManifestEntry[]
}

export interface EnchantmentCatalogSourceEntry {
  readonly id: string
  readonly name: { readonly en: string; readonly ja?: string }
  readonly applicableCategories: readonly EnchantmentCategory[]
}

interface IconCandidate {
  readonly entity: string
  readonly sourceAsset: string
  readonly sourcePackage: string
  readonly absoluteAsset: string
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_DATA_ROOT = path.join(repositoryRoot, 'local-game-data', 'QuickBMS 1.17.0.0')
const MANIFEST_PATH = path.join(repositoryRoot, 'generated', 'enchantment-icons', 'manifest.json')
const CATALOG_PATH = path.join(repositoryRoot, 'generated', 'enchantment-icons', 'catalog.json')
const GAME_VERSION = '1.17.0.0' as const

// These names are serialized component identities found in the same definition
// directories as their base icon textures. They are not fuzzy display-name guesses.
const INTERNAL_ID_ALIASES: Readonly<Record<string, readonly string[]>> = {
  accelerate: ['Accelerating'],
  ambush: ['Backstabber'],
  'anima-conduit': ['AnimaConduitMelee', 'AnimaConduitRanged'],
  'artifact-synergy': ['DamageSynergy'],
  'cool-down': ['Celerity'],
  deflect: ['Deflecting'],
  dynamo: ['DynamoMelee', 'DynamoRanged'],
  'enigma-resonator': ['EnigmaResonatorMelee', 'EnigmaResonatorRanged'],
  'life-boost': ['ResurrectionSurge'],
  'lucky-explorer': ['EmeraldDivination'],
  'multi-roll': ['MultiDodge'],
  overcharge: ['MultiCharge'],
  'poison-cloud': ['PoisonedMelee', 'PoisonedRanged'],
  'potion-barrier': ['PotionFortification'],
  radiance: ['RadianceMelee'],
  'radiance-shot': ['RadianceRanged'],
  refreshment: ['PotionThirstMelee', 'PotionThirstRanged'],
  rush: ['Rushdown'],
  'shadow-surge': ['ShadowFlash'],
  snowball: ['Snowing'],
  'soul-speed': ['SpiritSpeed'],
  'void-strike': ['VoidTouchedMelee', 'VoidTouchedRanged'],
}

const normalize = (value: string): string => value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as T
}

export function loadEnchantmentCatalog(): EnchantmentCatalogSourceEntry[] {
  type AuditEntry = { id: string; name: string | { en: string; ja?: string | null }; applicability?: Partial<Record<EnchantmentCategory, boolean>> }
  const sources: readonly [EnchantmentCategory, string][] = [
    ['melee', 'research/melee-enchantment-audit.json'],
    ['ranged', 'research/ranged-enchantment-audit.json'],
    ['armor', 'research/armor-enchantment-audit.json'],
  ]
  const merged = new Map<string, { id: string; name: { en: string; ja?: string }; categories: Set<EnchantmentCategory> }>()
  for (const [category, relativePath] of sources) {
    const audit = readJson<{ entries: AuditEntry[] }>(relativePath)
    for (const item of audit.entries) {
      const incoming = typeof item.name === 'string' ? { en: item.name } : { en: item.name.en, ...(item.name.ja ? { ja: item.name.ja } : {}) }
      const current = merged.get(item.id) ?? { id: item.id, name: incoming, categories: new Set<EnchantmentCategory>() }
      current.categories.add(category)
      if (!current.name.ja && incoming.ja) current.name = incoming
      merged.set(item.id, current)
    }
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id)).map((item) => ({ id: item.id, name: item.name, applicableCategories: [...item.categories] }))
}

function walk(directory: string): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(absolute))
    else result.push(absolute)
  }
  return result
}

export function discoverEnchantmentIconCandidates(dataRoot: string): IconCandidate[] {
  const contentRoot = path.join(dataRoot, 'Dungeons', 'Content')
  if (!fs.existsSync(contentRoot)) throw new Error(`Minecraft Dungeons Content directory was not found: ${contentRoot}`)
  return walk(contentRoot).flatMap((absolute): IconCandidate[] => {
    const relative = path.relative(dataRoot, absolute).split(path.sep).join('/')
    const match = relative.match(/\/Components\/Enchantments\/([^/]+)\/T_[^/]*_Icon\.uasset$/i)
    if (!match || /Shine_Icon\.uasset$/i.test(relative)) return []
    const sourceAsset = relative.replace(/\.uasset$/i, '')
    return [{ entity: match[1]!, sourceAsset, sourcePackage: path.posix.dirname(sourceAsset), absoluteAsset: absolute }]
  }).sort((left, right) => left.sourceAsset.localeCompare(right.sourceAsset))
}

export function mapEnchantmentCatalog(catalog: readonly EnchantmentCatalogSourceEntry[], candidates: readonly IconCandidate[]): EnchantmentIconManifestEntry[] {
  return catalog.map((item) => {
    const exact = candidates.filter((candidate) => normalize(candidate.entity) === normalize(item.name.en))
    const aliases = INTERNAL_ID_ALIASES[item.id] ?? []
    const referenced = exact.length ? exact : candidates.filter((candidate) => aliases.some((alias) => normalize(alias) === normalize(candidate.entity)))
    const method = exact.length ? 'definition-reference' as const : 'documented-internal-id-alias' as const
    if (referenced.length === 1) {
      const candidate = referenced[0]!
      return { enchantmentId: item.id, sourceAsset: candidate.sourceAsset, sourcePackage: candidate.sourcePackage, outputWebp: `public/assets/enchantments/${item.id}.webp`, status: 'matched', matchMethod: method }
    }
    if (referenced.length > 1) {
      const hashes = referenced.map((candidate) => crypto.createHash('sha256').update(decodeTextureAsset(candidate.absoluteAsset).pixels).digest('hex'))
      if (new Set(hashes).size === 1) {
        const candidate = referenced[0]!
        return { enchantmentId: item.id, sourceAsset: candidate.sourceAsset, sourcePackage: candidate.sourcePackage, outputWebp: `public/assets/enchantments/${item.id}.webp`, status: 'matched', matchMethod: method, notes: 'Category-specific definitions reference pixel-identical base artwork.' }
      }
      return { enchantmentId: item.id, status: 'multiple-candidates', candidates: referenced.map((candidate) => candidate.sourceAsset), notes: 'Category-specific definition references use distinct icon textures; no single canonical artwork was forced.' }
    }
    return { enchantmentId: item.id, status: 'not-found', notes: 'No unambiguous base icon was found in an Enchantment definition directory.' }
  })
}

async function extractEntry(entry: EnchantmentIconManifestEntry, candidate: IconCandidate): Promise<EnchantmentIconManifestEntry> {
  let decoded: ReturnType<typeof decodeTextureAsset>
  try {
    decoded = decodeTextureAsset(candidate.absoluteAsset)
    if (!decoded.pixels.some((value, index) => index % 4 === 3 && value > 0)) throw new Error('Decoded image is fully transparent.')
  } catch (error) {
    return { ...entry, status: 'export-failed', notes: error instanceof Error ? error.message : String(error) }
  }
  try {
    const output = path.join(repositoryRoot, entry.outputWebp!)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    await sharp(decoded.pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }).resize({ width: 64, height: 64, fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toFile(output)
    const metadata = await sharp(output).metadata()
    const stats = await sharp(output).stats()
    if (!metadata.width || !metadata.height || metadata.width > 64 || metadata.height > 64 || !metadata.hasAlpha || stats.channels[3]?.max === 0) return { ...entry, status: 'invalid-output', notes: `Validation failed for ${metadata.width ?? 0}x${metadata.height ?? 0} WebP output.` }
    return { ...entry, sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') }
  } catch (error) {
    return { ...entry, status: 'convert-failed', notes: error instanceof Error ? error.message : String(error) }
  }
}

export async function auditEnchantmentIconManifest(manifest: EnchantmentIconManifest, verifyOutputs = false, catalog = loadEnchantmentCatalog()): Promise<string[]> {
  const errors: string[] = []
  const expected = new Set(catalog.map((item) => item.id))
  const seen = new Set<string>()
  for (const entry of manifest.entries) {
    if (!expected.has(entry.enchantmentId)) errors.push(`Unknown enchantment mapping: ${entry.enchantmentId}`)
    if (seen.has(entry.enchantmentId)) errors.push(`Duplicate enchantment mapping: ${entry.enchantmentId}`)
    seen.add(entry.enchantmentId)
    if (entry.status === 'matched' && (!entry.sourceAsset || !entry.sourcePackage || !entry.outputWebp)) errors.push(`Matched entry lacks source/output: ${entry.enchantmentId}`)
    if (entry.status === 'multiple-candidates' && (entry.candidates?.length ?? 0) < 2) errors.push(`Ambiguous entry lacks candidates: ${entry.enchantmentId}`)
    if (entry.outputWebp && entry.outputWebp !== `public/assets/enchantments/${entry.enchantmentId}.webp`) errors.push(`Output path mismatch: ${entry.enchantmentId}`)
    if (verifyOutputs && entry.status === 'matched') {
      const output = path.join(repositoryRoot, entry.outputWebp!)
      if (!entry.sha256) errors.push(`Matched entry lacks sha256: ${entry.enchantmentId}`)
      else if (!fs.existsSync(output)) errors.push(`Matched output is missing: ${entry.enchantmentId}`)
      else {
        if (crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') !== entry.sha256) errors.push(`Output hash mismatch: ${entry.enchantmentId}`)
        const metadata = await sharp(output).metadata()
        const stats = await sharp(output).stats()
        if (!metadata.width || !metadata.height || metadata.width > 64 || metadata.height > 64 || !metadata.hasAlpha || !fs.statSync(output).size || stats.channels[3]?.max === 0) errors.push(`Invalid WebP output: ${entry.enchantmentId}`)
      }
    }
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`Missing enchantment mapping: ${id}`)
  return errors
}

function renderSummary(entries: readonly EnchantmentIconManifestEntry[]): string {
  const count = (status: EnchantmentIconStatus) => entries.filter((entry) => entry.status === status).length
  return ['Enchantment icons', `Matched: ${count('matched')}`, `Multiple candidates: ${count('multiple-candidates')}`, `Not found: ${count('not-found')}`, `Invalid: ${count('export-failed') + count('convert-failed') + count('invalid-output')}`, `Total: ${entries.length}`].join('\n')
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'all'
  const catalog = loadEnchantmentCatalog()
  if (command === 'audit') {
    const manifest = readJson<EnchantmentIconManifest>('generated/enchantment-icons/manifest.json')
    console.log(renderSummary(manifest.entries))
    const errors = await auditEnchantmentIconManifest(manifest, true, catalog)
    if (errors.length) throw new Error(errors.join('\n'))
    return
  }
  if (!['discover', 'all'].includes(command)) throw new Error(`Unknown command: ${command}`)
  const dataRoot = path.resolve(process.env.MCD_GAME_DATA_ROOT ?? DEFAULT_DATA_ROOT)
  const candidates = discoverEnchantmentIconCandidates(dataRoot)
  let entries = mapEnchantmentCatalog(catalog, candidates)
  if (command === 'all') {
    const byAsset = new Map(candidates.map((candidate) => [candidate.sourceAsset, candidate]))
    entries = await Promise.all(entries.map((entry) => entry.status === 'matched' ? extractEntry(entry, byAsset.get(entry.sourceAsset!)!) : Promise.resolve(entry)))
  }
  const manifest: EnchantmentIconManifest = { schemaVersion: 1, gameVersion: GAME_VERSION, entries }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify({ schemaVersion: 1, gameVersion: GAME_VERSION, entries: catalog }, null, 2)}\n`)
  console.log(renderSummary(entries))
  const errors = await auditEnchantmentIconManifest(manifest, command === 'all', catalog)
  if (errors.length) throw new Error(errors.join('\n'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 2 })
