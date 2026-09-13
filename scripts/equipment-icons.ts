import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export type EquipmentIconCategory = 'melee' | 'ranged' | 'armor' | 'artifact'
export type EquipmentIconStatus = 'matched' | 'multiple-candidates' | 'not-found' | 'export-failed' | 'convert-failed' | 'invalid-output'

export interface EquipmentIconManifestEntry {
  readonly category: EquipmentIconCategory
  readonly catalogId: string
  readonly sourceAsset?: string
  readonly sourcePackage?: string
  readonly outputPng?: string
  readonly outputWebp?: string
  readonly status: EquipmentIconStatus
  readonly matchMethod?: string
  readonly candidates?: readonly string[]
  readonly notes?: string
  readonly sha256?: string
}

export interface EquipmentIconManifest {
  readonly schemaVersion: 1
  readonly gameVersion: string
  readonly entries: readonly EquipmentIconManifestEntry[]
}

export interface UiIconManifestEntry {
  readonly id: 'soul' | 'category-melee' | 'category-ranged' | 'category-armor' | 'category-artifact'
  readonly sourceAsset: string
  readonly sourcePackage: string
  readonly outputWebp: string
  readonly status: 'matched' | 'not-found' | 'export-failed' | 'convert-failed' | 'invalid-output'
  readonly notes?: string
  readonly sha256?: string
}

export interface UiIconManifest {
  readonly schemaVersion: 1
  readonly gameVersion: string
  readonly entries: readonly UiIconManifestEntry[]
}

interface CatalogItem {
  category: EquipmentIconCategory
  id: string
  name: string
  family?: string
  internalId?: string
  variant: boolean
  eventExclusive: boolean
}

interface Candidate {
  category: EquipmentIconCategory
  sourceAsset: string
  sourcePackage: string
  absoluteAsset: string
  entity: string
  entityBase: string
  semanticNames: readonly string[]
  eventVariant: boolean
  uniqueOrdinal?: number
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_DATA_ROOT = path.join(repositoryRoot, 'local-game-data', 'QuickBMS 1.17.0.0')
const MANIFEST_PATH = path.join(repositoryRoot, 'generated', 'equipment-icons', 'manifest.json')
const UI_MANIFEST_PATH = path.join(repositoryRoot, 'generated', 'ui-icons', 'manifest.json')
const GAME_VERSION = '1.17.0.0'

const UI_ICON_SOURCES: readonly Pick<UiIconManifestEntry, 'id' | 'sourceAsset' | 'outputWebp'>[] = [
  { id: 'soul', sourceAsset: 'Dungeons/Content/UI/Materials/Inventory2/Item2/soul_icon', outputWebp: 'public/assets/ui/soul.webp' },
  { id: 'category-melee', sourceAsset: 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_melee', outputWebp: 'public/assets/ui/category-melee.webp' },
  { id: 'category-ranged', sourceAsset: 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_ranged', outputWebp: 'public/assets/ui/category-ranged.webp' },
  { id: 'category-armor', sourceAsset: 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_armour', outputWebp: 'public/assets/ui/category-armor.webp' },
  { id: 'category-artifact', sourceAsset: 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_item', outputWebp: 'public/assets/ui/category-artifact.webp' },
]

const MISSING_ICON_RESEARCH: Readonly<Record<string, { candidates?: readonly string[]; notes: string }>> = {
  'armor:ender-armor': { notes: 'Additional full-index search found no CuriousArmor, Ender Armor, preview, inventory-icon, or shared-atlas candidate in the extracted 1.17.0.0 data.' },
  'armor:vanguard-armor': {
    candidates: ['Dungeons/Content/Actors/Characters/Enemies/SkeletonVanguard/T_DesertArmor'],
    notes: 'Additional full-index and reference-name search found only the Skeleton Vanguard enemy body texture; it is not an equipment inventory icon and was intentionally rejected.',
  },
}

const INTERNAL_FAMILY_ALIASES: Readonly<Record<string, string>> = {
  'broken-sawblade': 'Chainsword',
  'great-hammer': 'Hammer',
  pickaxe: 'Pickaxe_Steel',
  'snow-bow': 'SlowBow',
  sword: 'Sword_Steel',
}

const ENTITY_OVERRIDES: Readonly<Record<string, string>> = {
  'melee:bonehead-hammer': 'SkeletonHammer',
  'melee:sinister-sword': 'Sword_Spooky1',
  'ranged:shrieking-crossbow': 'BatCrossbow',
  'artifact:blast-fungus': 'NetherWartSporeGrenade',
  'artifact:buzzy-nest': 'Beenest',
  'artifact:corrupted-pumpkin': 'CorruptedBeacon_Spooky1',
  'artifact:enchanted-grass': 'RainbowGrass',
  'artifact:eye-of-the-guardian': 'GuardianEye',
  'artifact:harpoon-quiver': 'HeavyHarpoonQuiver',
  'artifact:powershaker': 'MobMasher',
  'artifact:satchel-of-elements': 'SatchelOfTheElements',
  'artifact:satchel-of-elixirs': 'SatchelofNeed',
  'artifact:satchel-of-snacks': 'SatchelofNourishment',
  'artifact:scatter-mines': 'ChargedRedstoneMines',
  'artifact:shadow-shifter': 'ShadowSplinter',
  'artifact:spinblade': 'SpinWheel',
  'artifact:totem-of-casting': 'SoulTotemOfCasting',
  'artifact:vexing-chant': 'LostEvocation',
}

const normalize = (value: string): string => value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
const stripEntitySuffix = (value: string): string => value.replace(/_(?:Unique\d+|Spooky\d+|Winter\d+|Year\d+)$/i, '')
const outputPath = (category: EquipmentIconCategory, id: string, extension: 'png' | 'webp'): string => `${extension === 'png' ? '.local/generated-icons/png' : 'public/assets/equipment'}/${category}/${id}.${extension}`
export const equipmentIconWebPath = (category: EquipmentIconCategory, id: string): string | undefined => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? `/assets/equipment/${category}/${id}.webp` : undefined

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as T
}

function loadCatalog(): CatalogItem[] {
  const melee = readJson<{ weapons: { weaponId: string; name: { en: string }; family: string; variantOf?: string }[] }>('research/melee-attack-profile-audit.json')
  const armor = readJson<{ entries: { id: string; name: string; levelId: string; rarity: string }[] }>('research/armor-audit.json')
  const ranged = readJson<{ entries: { id: string; name: { en: string }; family: string; rarity: string; eventExclusive: boolean; variantOf?: string }[] }>('research/ranged-weapon-audit.json')
  const artifacts = readJson<{ entries: { id: string; name: string; eventExclusive: boolean }[]; populationDifferences: { id: string; name: string }[] }>('research/artifact-audit.json')
  const sourceSnapshot = readJson<{ claims: { entityId: string; property: string; value: unknown }[] }>('research/source-harvest/snapshots/dungeons-tools-2026-09-06.json')
  const meleeEvents = new Set(sourceSnapshot.claims.filter((claim) => claim.entityId.startsWith('melee-weapon:') && JSON.stringify(claim.value).toLowerCase().includes('special event item')).map((claim) => claim.entityId.slice('melee-weapon:'.length)))

  return [
    ...melee.weapons.map((item): CatalogItem => ({ category: 'melee', id: item.weaponId, name: item.name.en, family: item.family, variant: Boolean(item.variantOf), eventExclusive: meleeEvents.has(item.weaponId) })),
    ...armor.entries.map((item): CatalogItem => ({ category: 'armor', id: item.id, name: item.name, internalId: item.levelId, variant: item.rarity === 'unique', eventExclusive: false })),
    ...ranged.entries.map((item): CatalogItem => ({ category: 'ranged', id: item.id, name: item.name.en, family: item.family, variant: item.rarity === 'unique', eventExclusive: item.eventExclusive })),
    ...artifacts.entries.map((item): CatalogItem => ({ category: 'artifact', id: item.id, name: item.name, variant: false, eventExclusive: item.eventExclusive })),
    ...artifacts.populationDifferences.map((item): CatalogItem => ({ category: 'artifact', id: item.id, name: item.name, variant: false, eventExclusive: false })),
  ]
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

function candidateCategory(relative: string): EquipmentIconCategory | undefined {
  if (relative.includes('/MeleeWeapons/')) return 'melee'
  if (relative.includes('/RangedWeapons/')) return 'ranged'
  if (relative.includes('/Equipment/Armor/')) return 'armor'
  if (relative.includes('/Actors/Items/')) return 'artifact'
  return undefined
}

function candidateEntity(relative: string, category: EquipmentIconCategory): string {
  const marker = category === 'melee' ? '/MeleeWeapons/' : category === 'ranged' ? '/RangedWeapons/' : category === 'armor' ? '/Equipment/Armor/' : '/Actors/Items/'
  return relative.split(marker)[1]?.split('/')[0] ?? ''
}

export function discoverCandidates(dataRoot: string): Candidate[] {
  const contentRoot = path.join(dataRoot, 'Dungeons', 'Content')
  if (!fs.existsSync(contentRoot)) throw new Error(`Minecraft Dungeons Content directory was not found: ${contentRoot}`)
  return walk(contentRoot).filter((absolute) => /_icon_inventory\.uasset$/i.test(absolute)).flatMap((absolute): Candidate[] => {
    const sourceAsset = path.relative(dataRoot, absolute).split(path.sep).join('/').replace(/\.uasset$/i, '')
    const category = candidateCategory(`/${sourceAsset}`)
    if (!category) return []
    const entity = candidateEntity(`/${sourceAsset}`, category)
    if (!entity) return []
    const siblingNames = fs.readdirSync(path.dirname(absolute)).filter((name) => name.endsWith('.uasset')).map((name) => normalize(name.replace(/\.uasset$/i, '').replace(/^(?:BP|MI|SM|T)_/i, '').replace(/(?:_Icon(?:_inventory)?|_S|Storable|Instance)$/i, '')))
    const unique = entity.match(/_Unique(\d+)$/i)
    return [{
      category,
      sourceAsset,
      sourcePackage: path.posix.dirname(sourceAsset),
      absoluteAsset: absolute,
      entity,
      entityBase: stripEntitySuffix(entity),
      semanticNames: [...new Set([normalize(entity), normalize(path.basename(sourceAsset).replace(/^T_/i, '').replace(/_Icon_inventory$/i, '')), ...siblingNames])],
      eventVariant: /_(?:Spooky|Winter|Year)\d+$/i.test(entity),
      ...(unique ? { uniqueOrdinal: Number(unique[1]) } : {}),
    }]
  }).sort((left, right) => left.sourceAsset.localeCompare(right.sourceAsset))
}

function entryFromCandidate(item: CatalogItem, candidate: Candidate, method: string): EquipmentIconManifestEntry {
  return { category: item.category, catalogId: item.id, sourceAsset: candidate.sourceAsset, sourcePackage: candidate.sourcePackage, outputPng: outputPath(item.category, item.id, 'png'), outputWebp: outputPath(item.category, item.id, 'webp'), status: 'matched', matchMethod: method }
}

export function mapCatalog(catalog: readonly CatalogItem[], candidates: readonly Candidate[]): EquipmentIconManifestEntry[] {
  const mapped = new Map<string, EquipmentIconManifestEntry>()
  const used = new Set<string>()
  const key = (item: CatalogItem) => `${item.category}:${item.id}`
  const assign = (item: CatalogItem, candidate: Candidate, method: string) => {
    mapped.set(key(item), entryFromCandidate(item, candidate, method))
    used.add(candidate.sourceAsset)
  }

  for (const item of catalog) {
    const exactInternal = item.internalId && candidates.find((candidate) => candidate.category === item.category && normalize(candidate.entity) === normalize(item.internalId!))
    if (exactInternal) { assign(item, exactInternal, 'catalog-internal-id'); continue }
    const overrideEntity = ENTITY_OVERRIDES[key(item)]
    const exactOverride = overrideEntity && candidates.find((candidate) => candidate.category === item.category && normalize(candidate.entity) === normalize(overrideEntity))
    if (exactOverride) { assign(item, exactOverride, 'documented-entity-alias'); continue }
    const target = normalize(item.name)
    const semantic = candidates.filter((candidate) => candidate.category === item.category && candidate.semanticNames.includes(target))
    const semanticMatch = semantic.length === 1 ? semantic[0] : undefined
    if (semanticMatch) assign(item, semanticMatch, 'asset-semantic-name')
  }

  for (const category of ['melee', 'ranged'] as const) {
    const familyNames = [...new Set(catalog.filter((item) => item.category === category).map((item) => item.family).filter((value): value is string => Boolean(value)))]
    for (const family of familyNames) {
      const items = catalog.filter((item) => item.category === category && item.family === family && !mapped.has(key(item)))
      if (!items.length) continue
      const internalFamily = INTERNAL_FAMILY_ALIASES[family] ?? family
      const familyCandidates = candidates.filter((candidate) => candidate.category === category && normalize(candidate.entityBase) === normalize(internalFamily) && !used.has(candidate.sourceAsset))
      const baseItem = items.find((item) => !item.variant)
      const baseCandidate = familyCandidates.find((candidate) => !candidate.uniqueOrdinal && !candidate.eventVariant)
      if (baseItem && baseCandidate) assign(baseItem, baseCandidate, 'family-base-asset')

      const remaining = items.filter((item) => !mapped.has(key(item)))
      const eventItems = remaining.filter((item) => item.eventExclusive)
      const eventCandidates = familyCandidates.filter((candidate) => candidate.eventVariant && !used.has(candidate.sourceAsset))
      if (eventItems.length === eventCandidates.length) eventItems.forEach((item, index) => {
        const candidate = eventCandidates[index]
        if (candidate) assign(item, candidate, 'family-event-variant')
      })

      const uniqueItems = remaining.filter((item) => !mapped.has(key(item)))
      const uniqueCandidates = familyCandidates.filter((candidate) => candidate.uniqueOrdinal && !used.has(candidate.sourceAsset)).sort((left, right) => left.uniqueOrdinal! - right.uniqueOrdinal!)
      if (uniqueItems.length === uniqueCandidates.length) uniqueItems.forEach((item, index) => {
        const candidate = uniqueCandidates[index]
        if (candidate) assign(item, candidate, 'family-unique-ordinal')
      })
    }
  }

  return catalog.map((item) => {
    const match = mapped.get(key(item))
    if (match) return match
    const targetFamily = INTERNAL_FAMILY_ALIASES[item.family ?? ''] ?? item.family
    const possible = candidates.filter((candidate) => candidate.category === item.category && (
      candidate.semanticNames.includes(normalize(item.name)) ||
      (targetFamily && normalize(candidate.entityBase) === normalize(targetFamily))
    )).map((candidate) => candidate.sourceAsset)
    const research = MISSING_ICON_RESEARCH[key(item)]
    return possible.length > 1
      ? { category: item.category, catalogId: item.id, status: 'multiple-candidates', candidates: possible, notes: 'Automatic evidence did not identify one unambiguous asset.' }
      : { category: item.category, catalogId: item.id, status: 'not-found', ...((research?.candidates ?? possible).length ? { candidates: research?.candidates ?? possible } : {}), notes: research?.notes ?? 'No unambiguous inventory icon asset was found.' }
  })
}

function rgb565(value: number): [number, number, number] {
  return [Math.round(((value >> 11) & 31) * 255 / 31), Math.round(((value >> 5) & 63) * 255 / 63), Math.round((value & 31) * 255 / 31)]
}

export function decodeDxt5(data: Buffer, width: number, height: number): Buffer {
  const output = Buffer.alloc(width * height * 4)
  let offset = 0
  for (let blockY = 0; blockY < height; blockY += 4) for (let blockX = 0; blockX < width; blockX += 4) {
    if (offset + 16 > data.length) throw new Error('DXT5 payload ended before all blocks were decoded.')
    const alpha0 = data[offset]!
    const alpha1 = data[offset + 1]!
    const alpha = [alpha0, alpha1]
    if (alpha0 > alpha1) for (let index = 1; index <= 6; index++) alpha.push(Math.round(((7 - index) * alpha0 + index * alpha1) / 7))
    else {
      for (let index = 1; index <= 4; index++) alpha.push(Math.round(((5 - index) * alpha0 + index * alpha1) / 5))
      alpha.push(0, 255)
    }
    let alphaBits = 0n
    for (let index = 0; index < 6; index++) alphaBits |= BigInt(data[offset + 2 + index]!) << BigInt(index * 8)
    const color0 = data.readUInt16LE(offset + 8)
    const color1 = data.readUInt16LE(offset + 10)
    const first = rgb565(color0)
    const second = rgb565(color1)
    const colors: [number, number, number][] = [
      first,
      second,
      [0, 1, 2].map((channel) => Math.round((2 * first[channel]! + second[channel]!) / 3)) as [number, number, number],
      [0, 1, 2].map((channel) => Math.round((first[channel]! + 2 * second[channel]!) / 3)) as [number, number, number],
    ]
    const colorBits = data.readUInt32LE(offset + 12)
    for (let pixel = 0; pixel < 16; pixel++) {
      const x = blockX + pixel % 4
      const y = blockY + Math.floor(pixel / 4)
      if (x >= width || y >= height) continue
      const color = colors[(colorBits >>> (pixel * 2)) & 3]!
      const target = (y * width + x) * 4
      output[target] = color[0]
      output[target + 1] = color[1]
      output[target + 2] = color[2]
      output[target + 3] = alpha[Number((alphaBits >> BigInt(pixel * 3)) & 7n)]!
    }
    offset += 16
  }
  return output
}

function decodeTexture(candidate: Pick<Candidate, 'absoluteAsset'>): { pixels: Buffer; width: number; height: number; hasAlpha: boolean } {
  const uasset = fs.readFileSync(candidate.absoluteAsset)
  const uexpPath = candidate.absoluteAsset.replace(/\.uasset$/i, '.uexp')
  if (!fs.existsSync(uexpPath)) throw new Error('The Texture2D has no matching .uexp payload.')
  const uexp = fs.readFileSync(uexpPath)
  const format = uasset.includes(Buffer.from('PF_DXT5\0')) ? 'PF_DXT5' : uasset.includes(Buffer.from('PF_B8G8R8A8\0')) ? 'PF_B8G8R8A8' : undefined
  if (!format) throw new Error('Unsupported Texture2D pixel format.')
  const formatOffset = uexp.indexOf(Buffer.from(`${format}\0`))
  if (formatOffset < 0) throw new Error('Cooked Texture2D platform data was not found.')
  const afterFormat = formatOffset + format.length + 1
  const mipCount = uexp.readUInt32LE(afterFormat + 4)
  if (mipCount < 1) throw new Error('Texture2D contains no cooked mips.')
  // For this UE4.22 dataset the first FTexture2DMipMap begins after three
  // platform-data fields and uses a 20-byte FByteBulkData header.
  const bulkHeader = afterFormat + 12
  const byteLength = uexp.readUInt32LE(bulkHeader + 4)
  const storedLength = uexp.readUInt32LE(bulkHeader + 8)
  if (!byteLength || byteLength !== storedLength) throw new Error('Texture2D first-mip bulk data is missing or external.')
  const side = Math.sqrt(format === 'PF_DXT5' ? byteLength : byteLength / 4)
  const width = side
  const height = side
  if (width <= 0 || height <= 0 || width > 4096 || height > 4096) throw new Error(`Invalid cooked mip dimensions: ${width}x${height}`)
  if (!Number.isInteger(side) || format === 'PF_DXT5' && Math.ceil(width / 4) * Math.ceil(height / 4) * 16 !== byteLength) throw new Error('Texture2D first mip is not a supported square inventory icon.')
  const start = bulkHeader + 20
  if (start + byteLength > uexp.length) throw new Error('Texture2D payload length is invalid.')
  const payload = uexp.subarray(start, start + byteLength)
  if (format === 'PF_DXT5') {
    const pixels = decodeDxt5(payload, width, height)
    return { pixels, width, height, hasAlpha: pixels.some((value, index) => index % 4 === 3 && value < 255) }
  }
  const pixels = Buffer.alloc(byteLength)
  for (let index = 0; index < payload.length; index += 4) {
    pixels[index] = payload[index + 2]!
    pixels[index + 1] = payload[index + 1]!
    pixels[index + 2] = payload[index]!
    pixels[index + 3] = payload[index + 3]!
  }
  return { pixels, width, height, hasAlpha: pixels.some((value, index) => index % 4 === 3 && value < 255) }
}

async function processUiIcons(dataRoot: string, convert: boolean): Promise<UiIconManifestEntry[]> {
  return Promise.all(UI_ICON_SOURCES.map(async (spec): Promise<UiIconManifestEntry> => {
    const absoluteAsset = path.join(dataRoot, `${spec.sourceAsset}.uasset`)
    const base = { ...spec, sourcePackage: path.posix.dirname(spec.sourceAsset) }
    if (!fs.existsSync(absoluteAsset)) return { ...base, status: 'not-found', notes: 'The documented game UI texture was not present in the extracted data.' }
    if (!convert) return { ...base, status: 'matched' }
    let decoded: ReturnType<typeof decodeTexture>
    try {
      decoded = decodeTexture({ absoluteAsset })
    } catch (error) {
      return { ...base, status: 'export-failed', notes: error instanceof Error ? error.message : String(error) }
    }
    try {
      const webpPath = path.join(repositoryRoot, spec.outputWebp)
      fs.mkdirSync(path.dirname(webpPath), { recursive: true })
      await sharp(decoded.pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }).resize({ width: 64, height: 64, fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toFile(webpPath)
      const metadata = await sharp(webpPath).metadata()
      const stats = await sharp(webpPath).stats()
      if (!metadata.width || !metadata.height || metadata.width > 64 || metadata.height > 64 || stats.channels[3]?.min === 0 && stats.channels[3]?.max === 0) return { ...base, status: 'invalid-output', notes: `Validation failed for ${metadata.width ?? 0}x${metadata.height ?? 0} WebP output.` }
      return { ...base, status: 'matched', sha256: crypto.createHash('sha256').update(fs.readFileSync(webpPath)).digest('hex') }
    } catch (error) {
      return { ...base, status: 'convert-failed', notes: error instanceof Error ? error.message : String(error) }
    }
  }))
}

export function auditUiManifest(manifest: UiIconManifest): string[] {
  const errors: string[] = []
  const expected = new Set(UI_ICON_SOURCES.map((entry) => entry.id))
  const seen = new Set<string>()
  for (const entry of manifest.entries) {
    if (!expected.has(entry.id)) errors.push(`Unknown UI icon: ${entry.id}`)
    if (seen.has(entry.id)) errors.push(`Duplicate UI icon: ${entry.id}`)
    seen.add(entry.id)
    if (entry.status === 'matched' && (!entry.sourceAsset || !entry.outputWebp)) errors.push(`Matched UI icon lacks source/output: ${entry.id}`)
    if (!entry.outputWebp.startsWith('public/assets/ui/')) errors.push(`UI icon path mismatch: ${entry.id}`)
  }
  for (const missing of expected) if (!seen.has(missing)) errors.push(`Missing UI icon mapping: ${missing}`)
  return errors
}

async function processMatch(entry: EquipmentIconManifestEntry, candidate: Candidate): Promise<EquipmentIconManifestEntry> {
  let decoded: ReturnType<typeof decodeTexture>
  try {
    decoded = decodeTexture(candidate)
    const alphaValues = decoded.pixels.filter((_, index) => index % 4 === 3)
    if (!alphaValues.some((alpha) => alpha > 0)) throw new Error('Decoded image is fully transparent.')
    const pngPath = path.join(repositoryRoot, entry.outputPng!)
    fs.mkdirSync(path.dirname(pngPath), { recursive: true })
    await sharp(decoded.pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }).png().toFile(pngPath)
  } catch (error) {
    return { ...entry, status: 'export-failed', notes: error instanceof Error ? error.message : String(error) }
  }
  try {
    const webpPath = path.join(repositoryRoot, entry.outputWebp!)
    fs.mkdirSync(path.dirname(webpPath), { recursive: true })
    await sharp(decoded.pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }).resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toFile(webpPath)
    const metadata = await sharp(webpPath).metadata()
    const stats = await sharp(webpPath).stats()
    if (!metadata.width || !metadata.height || metadata.width > 128 || metadata.height > 128 || stats.isOpaque && decoded.hasAlpha || stats.channels[3]?.min === 0 && stats.channels[3]?.max === 0) {
      return { ...entry, status: 'invalid-output', notes: `Validation failed for ${metadata.width ?? 0}x${metadata.height ?? 0} WebP output.` }
    }
    return { ...entry, sha256: crypto.createHash('sha256').update(fs.readFileSync(webpPath)).digest('hex') }
  } catch (error) {
    return { ...entry, status: 'convert-failed', notes: error instanceof Error ? error.message : String(error) }
  }
}

function renderSummary(entries: readonly EquipmentIconManifestEntry[]): string {
  const statusCount = (status: EquipmentIconStatus) => entries.filter((entry) => entry.status === status).length
  const lines = ['Equipment Icon Audit', '', `Catalog total: ${entries.length}`]
  for (const status of ['matched', 'multiple-candidates', 'not-found', 'export-failed', 'convert-failed', 'invalid-output'] as const) lines.push(`${status}: ${statusCount(status)}`)
  lines.push('', `Coverage: ${(statusCount('matched') / entries.length * 100).toFixed(1)}%`, '')
  for (const category of ['melee', 'ranged', 'armor', 'artifact'] as const) {
    const items = entries.filter((entry) => entry.category === category)
    lines.push(`${category}: ${items.filter((entry) => entry.status === 'matched').length} / ${items.length}`)
  }
  const failures = entries.filter((entry) => entry.status !== 'matched')
  if (failures.length) lines.push('', 'Exceptions:', ...failures.map((entry) => `- ${entry.category}:${entry.catalogId} — ${entry.status}`))
  const entriesByHash = new Map<string, EquipmentIconManifestEntry[]>()
  for (const entry of entries) {
    if (!entry.sha256) continue
    const values = entriesByHash.get(entry.sha256) ?? []
    values.push(entry)
    entriesByHash.set(entry.sha256, values)
  }
  const duplicateHashes = [...entriesByHash].filter(([, values]) => values.length > 1)
  if (duplicateHashes.length) lines.push('', 'Duplicate image warnings:', ...duplicateHashes.map(([hash, values]) => `- ${hash.slice(0, 12)}: ${values.map((entry) => `${entry.category}:${entry.catalogId}`).join(', ')}`))
  return lines.join('\n')
}

export function auditManifest(manifest: EquipmentIconManifest, catalog: readonly CatalogItem[] = loadCatalog()): string[] {
  const errors: string[] = []
  const expected = new Set(catalog.map((item) => `${item.category}:${item.id}`))
  const seen = new Set<string>()
  for (const entry of manifest.entries) {
    const key = `${entry.category}:${entry.catalogId}`
    if (!expected.has(key)) errors.push(`Unknown catalog mapping: ${key}`)
    if (seen.has(key)) errors.push(`Duplicate catalog mapping: ${key}`)
    seen.add(key)
    if (!['matched', 'multiple-candidates', 'not-found', 'export-failed', 'convert-failed', 'invalid-output'].includes(entry.status)) errors.push(`Invalid status: ${key}`)
    if (entry.status === 'matched' && (!entry.sourceAsset || !entry.outputWebp)) errors.push(`Matched entry lacks source/output: ${key}`)
    if (entry.outputWebp && !entry.outputWebp.startsWith(`public/assets/equipment/${entry.category}/`)) errors.push(`Category path mismatch: ${key}`)
  }
  for (const missing of expected) if (!seen.has(missing)) errors.push(`Missing catalog mapping: ${missing}`)
  return errors
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'all'
  const dataRoot = path.resolve(process.env.MCD_GAME_DATA_ROOT ?? DEFAULT_DATA_ROOT)
  if (command === 'audit') {
    if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`Manifest was not found: ${MANIFEST_PATH}`)
    const manifest = readJson<EquipmentIconManifest>(path.relative(repositoryRoot, MANIFEST_PATH))
    const errors = auditManifest(manifest)
    console.log(renderSummary(manifest.entries))
    const uiManifest = readJson<UiIconManifest>(path.relative(repositoryRoot, UI_MANIFEST_PATH))
    const uiErrors = auditUiManifest(uiManifest)
    console.log(`\nUI icons: ${uiManifest.entries.filter((entry) => entry.status === 'matched').length} / ${uiManifest.entries.length}`)
    errors.push(...uiErrors)
    if (errors.length) throw new Error(errors.join('\n'))
    return
  }
  const catalog = loadCatalog()
  const candidates = discoverCandidates(dataRoot)
  let entries = mapCatalog(catalog, candidates)
  if (command !== 'discover') {
    const byAsset = new Map(candidates.map((candidate) => [candidate.sourceAsset, candidate]))
    entries = await Promise.all(entries.map((entry) => entry.status === 'matched' ? processMatch(entry, byAsset.get(entry.sourceAsset!)!) : Promise.resolve(entry)))
  }
  const manifest: EquipmentIconManifest = { schemaVersion: 1, gameVersion: GAME_VERSION, entries }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  const uiManifest: UiIconManifest = { schemaVersion: 1, gameVersion: GAME_VERSION, entries: await processUiIcons(dataRoot, command !== 'discover') }
  fs.mkdirSync(path.dirname(UI_MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(UI_MANIFEST_PATH, `${JSON.stringify(uiManifest, null, 2)}\n`)
  console.log(renderSummary(entries))
  const errors = auditManifest(manifest, catalog)
  errors.push(...auditUiManifest(uiManifest))
  if (errors.length) throw new Error(errors.join('\n'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 2 })
