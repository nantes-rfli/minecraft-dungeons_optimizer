import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const GAME_DATA_ROOT_LABEL = 'QuickBMS 1.17.0.0'
export const GAME_DATA_ROOT = path.resolve('local-game-data', GAME_DATA_ROOT_LABEL)
export const LOCAL_MANIFEST_PATH = path.resolve('local-game-data', '.inventory', 'all-files.ndjson')

const IMPORTANT_ROOTS = [
  'Dungeons/Content/Actors/Equipment/Armor',
  'Dungeons/Content/Actors/Equipment/MeleeWeapons',
  'Dungeons/Content/Actors/Equipment/RangedWeapons',
  'Dungeons/Content/Actors/Items',
  'Dungeons/Content/Components/Enchantments',
  'Dungeons/Content/Components/ArmorProperties',
  'Dungeons/Content/DataTables',
] as const

const RESEARCH_TERMS = [
  'Equipment', 'Weapon', 'Armor', 'Item', 'Artifact', 'Enchant', 'Effect',
  'GameplayEffect', 'Projectile', 'Arrow', 'Damage', 'Attack', 'Cooldown',
  'Soul', 'Summon', 'Pet', 'Target', 'DataTable', 'Curve', 'Stat', 'Modifier', 'Property',
] as const

const PREFIXES = [
  ['AnimBP_', 'Animation Blueprint candidate'],
  ['AnimNS_', 'Animation Notify State candidate'],
  ['BPI_', 'Blueprint Interface candidate'],
  ['BP_', 'Blueprint candidate'],
  ['MI_', 'Material Instance candidate'],
  ['SM_', 'Static Mesh candidate'],
  ['SK_', 'Skeletal Mesh candidate'],
  ['PS_', 'Particle/VFX candidate'],
  ['UMG_', 'UI candidate'],
  ['M_', 'Material candidate'],
  ['T_', 'Texture candidate'],
  ['P_', 'Particle/VFX candidate'],
] as const

type CountMap = Record<string, number>

export interface FileRecord {
  relativePath: string
  extension: string
  stem: string
  sizeBytes: number
  prefix?: string
  companionPaths?: string[]
}

interface MutableDirectory {
  path: string
  directFileCount: number
  recursiveFileCount: number
  childDirectoryCount: number
  extensions: CountMap
  prefixes: CountMap
}

export type DirectorySummary = MutableDirectory

export interface GameDataInventory {
  schemaVersion: 2
  source: {
    game: 'Minecraft Dungeons'
    version: '1.17.0.0'
    versionBasis: 'QuickBMS directory label'
    sourceType: 'local-extracted-game-data'
    rootLabel: typeof GAME_DATA_ROOT_LABEL
  }
  methodology: {
    scanBasis: 'filesystem-path-name-size-only'
    binaryContentParsed: false
    directoryCountIncludesSourceRoot: true
    companionRule: 'same-directory-and-stem'
    fingerprintAlgorithm: 'sha256(sorted(normalized-relative-path + NUL + decimal-size + LF))'
    pathSeparator: '/'
  }
  totals: { directories: number; files: number; bytes: number }
  extensions: CountMap
  roots: Array<{ path: string; directories: number; files: number; bytes: number; extensions: CountMap }>
  prefixes: Array<{ prefix: string; meaning: string; count: number }>
  companions: {
    logicalPackagesWithHeader: number
    uassetPackages: number
    uassetWithUexp: number
    uassetWithUexpAndUbulk: number
    uassetWithoutUexp: number
    umapPackages: number
    umapWithUexp: number
    umapWithUexpAndUbulk: number
    umapWithoutUexp: number
    packagesWithMultipleHeaders: number
    uexpWithoutPackageHeader: number
    ubulkWithoutPackageHeader: number
  }
  expectedRoots: Array<{ path: string; present: boolean }>
  directories: DirectorySummary[]
  sourceFingerprint: { algorithm: 'sha256-path-size-v1'; value: string }
}

export interface AssetIndexEntry {
  id: string
  path: string
  category: string
  entity?: string
  assetKind: string
  files: string[]
  researchRelevance: 'high' | 'medium'
  classificationBasis: string[]
}

export interface GameDataAssetIndex {
  schemaVersion: 1
  sourceFingerprint: string
  selectionPolicy: {
    scope: 'mechanics-research-candidates-not-complete-asset-list'
    logicalAssetRule: 'same-directory-and-stem'
    criteria: string[]
  }
  importantRoots: Array<{ path: string; present: boolean; recursiveFileCount: number; indexedAssetCount: number }>
  discoveredBranches: Array<{
    path: string
    matchedTerms: string[]
    recursiveFileCount: number
    uassetCount: number
    indexedAssetCount: number
  }>
  assets: AssetIndexEntry[]
}

const count = (map: CountMap, key: string, amount = 1) => { map[key] = (map[key] ?? 0) + amount }
const sortedMap = (map: CountMap): CountMap => Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
const extensionOf = (file: string) => path.posix.extname(file).toLowerCase() || '[none]'
const stemOf = (file: string) => extensionOf(file) === '[none]' ? file : file.slice(0, -path.posix.extname(file).length)
const prefixOf = (stem: string) => PREFIXES.find(([prefix]) => stem.startsWith(prefix))?.[0]
const isUnder = (candidate: string, root: string) => candidate === root || candidate.startsWith(`${root}/`)
const assertRelativePath = (value: string) => value === '.' || (!path.posix.isAbsolute(value) && value !== '..' && !value.startsWith('../') && !value.includes('/../') && !value.includes('\\'))

function ancestors(directory: string): string[] {
  if (directory === '.') return ['.']
  const segments = directory.split('/')
  return ['.', ...segments.map((_, index) => segments.slice(0, index + 1).join('/'))]
}

function logicalKey(record: Pick<FileRecord, 'relativePath' | 'stem'>): string {
  const directory = path.posix.dirname(record.relativePath)
  return `${directory}/${record.stem}`
}

function inferAsset(pathWithoutExtension: string, prefix?: string): Pick<AssetIndexEntry, 'category' | 'entity' | 'assetKind'> {
  const rules: Array<[string, string]> = [
    ['Dungeons/Content/Actors/Equipment/Armor', 'armor'],
    ['Dungeons/Content/Actors/Equipment/MeleeWeapons', 'melee-weapon'],
    ['Dungeons/Content/Actors/Equipment/RangedWeapons', 'ranged-weapon'],
    ['Dungeons/Content/Actors/Items', 'item-or-artifact'],
    ['Dungeons/Content/Components/Enchantments', 'enchantment'],
    ['Dungeons/Content/Components/ArmorProperties', 'armor-property'],
    ['Dungeons/Content/DataTables', 'data-table'],
  ]
  const matched = rules.find(([root]) => isUnder(pathWithoutExtension, root))
  let entity: string | undefined
  if (matched) {
    const remainder = pathWithoutExtension.slice(matched[0].length).replace(/^\//, '')
    const segments = remainder.split('/').filter(Boolean)
    entity = segments.length > 1 ? segments[0] : undefined
  }
  const prefixMeaning = PREFIXES.find(([candidate]) => candidate === prefix)?.[1]
  const assetKind = prefixMeaning?.toLowerCase().replaceAll(' ', '-') ?? (pathWithoutExtension.includes('GameplayEffect') ? 'gameplay-effect-name-candidate' : 'uasset-candidate')
  return { category: matched?.[1] ?? 'gameplay-candidate', ...(entity ? { entity } : {}), assetKind }
}

function rootBucket(relativePath: string): string {
  if (isUnder(relativePath, 'Dungeons/Content')) return 'Dungeons/Content'
  if (isUnder(relativePath, 'Engine/Content')) return 'Engine/Content'
  return '[other]'
}

export function scanGameData(sourceRoot = GAME_DATA_ROOT): { inventory: GameDataInventory; index: GameDataAssetIndex; files: FileRecord[] } {
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error(`Game data source unavailable: ${sourceRoot}`)

  const files: FileRecord[] = []
  const directories = new Map<string, MutableDirectory>()
  const ensureDirectory = (relativePath: string) => {
    let current = directories.get(relativePath)
    if (!current) {
      current = { path: relativePath, directFileCount: 0, recursiveFileCount: 0, childDirectoryCount: 0, extensions: {}, prefixes: {} }
      directories.set(relativePath, current)
    }
    return current
  }
  ensureDirectory('.')

  const walk = (absoluteDirectory: string, relativeDirectory: string) => {
    const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const relativePath = relativeDirectory === '.' ? entry.name : `${relativeDirectory}/${entry.name}`
      const absolutePath = path.join(absoluteDirectory, entry.name)
      if (entry.isDirectory()) {
        ensureDirectory(relativePath)
        ensureDirectory(relativeDirectory).childDirectoryCount += 1
        walk(absolutePath, relativePath)
      } else if (entry.isFile()) {
        const extension = extensionOf(entry.name)
        const stem = stemOf(entry.name)
        const prefix = prefixOf(stem)
        const record: FileRecord = { relativePath, extension, stem, sizeBytes: fs.statSync(absolutePath).size, ...(prefix ? { prefix } : {}) }
        files.push(record)
        const direct = ensureDirectory(relativeDirectory)
        direct.directFileCount += 1
        for (const directory of ancestors(relativeDirectory)) {
          const summary = ensureDirectory(directory)
          summary.recursiveFileCount += 1
          count(summary.extensions, extension)
          if (prefix) count(summary.prefixes, prefix)
        }
      }
    }
  }
  walk(sourceRoot, '.')
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const logicalAssets = new Map<string, FileRecord[]>()
  for (const file of files) {
    const key = logicalKey(file)
    const group = logicalAssets.get(key) ?? []
    group.push(file)
    logicalAssets.set(key, group)
  }
  for (const group of logicalAssets.values()) {
    const packageFiles = group.filter((file) => ['.uasset', '.umap', '.uexp', '.ubulk'].includes(file.extension))
    const companionPaths = packageFiles.map((file) => file.relativePath).sort()
    for (const file of packageFiles) if (companionPaths.length > 1) file.companionPaths = companionPaths.filter((candidate) => candidate !== file.relativePath)
  }

  const extensions: CountMap = {}
  const prefixCounts: CountMap = {}
  const roots = new Map<string, { path: string; directoryPaths: Set<string>; files: number; bytes: number; extensions: CountMap }>()
  for (const root of ['Dungeons/Content', 'Engine/Content', '[other]']) roots.set(root, { path: root, directoryPaths: new Set(), files: 0, bytes: 0, extensions: {} })
  for (const file of files) {
    count(extensions, file.extension)
    if (file.prefix) count(prefixCounts, file.prefix)
    const bucket = roots.get(rootBucket(file.relativePath))!
    bucket.files += 1
    bucket.bytes += file.sizeBytes
    count(bucket.extensions, file.extension)
    for (const directory of ancestors(path.posix.dirname(file.relativePath))) if (bucket.path === '[other]' ? rootBucket(directory) === '[other]' : isUnder(directory, bucket.path)) bucket.directoryPaths.add(directory)
  }

  const companions = {
    logicalPackagesWithHeader: 0,
    uassetPackages: 0,
    uassetWithUexp: 0,
    uassetWithUexpAndUbulk: 0,
    uassetWithoutUexp: 0,
    umapPackages: 0,
    umapWithUexp: 0,
    umapWithUexpAndUbulk: 0,
    umapWithoutUexp: 0,
    packagesWithMultipleHeaders: 0,
    uexpWithoutPackageHeader: 0,
    ubulkWithoutPackageHeader: 0,
  }
  for (const group of logicalAssets.values()) {
    const extensionSet = new Set(group.map((file) => file.extension))
    const uasset = extensionSet.has('.uasset')
    const umap = extensionSet.has('.umap')
    const uexp = extensionSet.has('.uexp')
    const ubulk = extensionSet.has('.ubulk')
    const hasHeader = uasset || umap
    if (hasHeader) companions.logicalPackagesWithHeader += 1
    if (uasset && umap) companions.packagesWithMultipleHeaders += 1
    if (uasset) {
      companions.uassetPackages += 1
      if (uexp) companions.uassetWithUexp += 1
      if (uexp && ubulk) companions.uassetWithUexpAndUbulk += 1
      if (!uexp) companions.uassetWithoutUexp += 1
    }
    if (umap) {
      companions.umapPackages += 1
      if (uexp) companions.umapWithUexp += 1
      if (uexp && ubulk) companions.umapWithUexpAndUbulk += 1
      if (!uexp) companions.umapWithoutUexp += 1
    }
    if (!hasHeader && uexp) companions.uexpWithoutPackageHeader += 1
    if (!hasHeader && ubulk) companions.ubulkWithoutPackageHeader += 1
  }

  const directorySummaries = [...directories.values()].map((directory) => ({
    ...directory,
    extensions: sortedMap(directory.extensions),
    prefixes: sortedMap(directory.prefixes),
  })).sort((a, b) => a.path.localeCompare(b.path))

  const fingerprint = createHash('sha256')
  for (const file of files) fingerprint.update(`${file.relativePath}\0${file.sizeBytes}\n`)
  const sourceFingerprint = fingerprint.digest('hex')

  const inventory: GameDataInventory = {
    schemaVersion: 2,
    source: { game: 'Minecraft Dungeons', version: '1.17.0.0', versionBasis: 'QuickBMS directory label', sourceType: 'local-extracted-game-data', rootLabel: GAME_DATA_ROOT_LABEL },
    methodology: {
      scanBasis: 'filesystem-path-name-size-only', binaryContentParsed: false, directoryCountIncludesSourceRoot: true,
      companionRule: 'same-directory-and-stem', fingerprintAlgorithm: 'sha256(sorted(normalized-relative-path + NUL + decimal-size + LF))', pathSeparator: '/',
    },
    totals: { directories: directories.size, files: files.length, bytes: files.reduce((sum, file) => sum + file.sizeBytes, 0) },
    extensions: sortedMap(extensions),
    roots: [...roots.values()].map((root) => ({ path: root.path, directories: root.directoryPaths.size, files: root.files, bytes: root.bytes, extensions: sortedMap(root.extensions) })),
    prefixes: PREFIXES.map(([prefix, meaning]) => ({ prefix, meaning, count: prefixCounts[prefix] ?? 0 })),
    companions,
    expectedRoots: IMPORTANT_ROOTS.map((importantPath) => ({ path: importantPath, present: directories.has(importantPath) })),
    directories: directorySummaries,
    sourceFingerprint: { algorithm: 'sha256-path-size-v1', value: sourceFingerprint },
  }

  const assets: AssetIndexEntry[] = []
  for (const [logicalPath, group] of [...logicalAssets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const uasset = group.find((file) => file.extension === '.uasset')
    if (!uasset) continue
    const important = IMPORTANT_ROOTS.some((root) => isUnder(uasset.relativePath, root))
    const prefixCandidate = ['BP_', 'BPI_', 'AnimBP_', 'AnimNS_'].includes(uasset.prefix ?? '')
    const dataTable = isUnder(uasset.relativePath, 'Dungeons/Content/DataTables')
    const gameplayEffect = uasset.stem.toLowerCase().includes('gameplayeffect')
    if (!important && !prefixCandidate && !dataTable && !gameplayEffect) continue
    const inferred = inferAsset(logicalPath, uasset.prefix)
    const basis = [important ? 'important-path' : '', prefixCandidate ? 'filename-prefix' : '', dataTable ? 'data-table-path' : '', gameplayEffect ? 'filename-term' : ''].filter(Boolean)
    assets.push({ id: logicalPath, path: logicalPath, ...inferred, files: group.map((file) => file.relativePath).sort(), researchRelevance: important ? 'high' : 'medium', classificationBasis: basis })
  }
  const indexedByRoot = (root: string) => assets.filter((asset) => isUnder(asset.path, root)).length
  const directoryByPath = new Map(directorySummaries.map((directory) => [directory.path, directory]))
  const discoveredBranches = directorySummaries
    .filter((directory) => directory.path !== '.' && directory.recursiveFileCount > 0)
    .map((directory) => ({ directory, matchedTerms: RESEARCH_TERMS.filter((term) => directory.path.toLowerCase().includes(term.toLowerCase())) }))
    .filter(({ matchedTerms }) => matchedTerms.length > 0)
    .map(({ directory, matchedTerms }) => ({
      path: directory.path, matchedTerms: [...matchedTerms], recursiveFileCount: directory.recursiveFileCount,
      uassetCount: directory.extensions['.uasset'] ?? 0, indexedAssetCount: indexedByRoot(directory.path),
    }))
    .sort((a, b) => b.indexedAssetCount - a.indexedAssetCount || b.uassetCount - a.uassetCount || a.path.localeCompare(b.path))

  const index: GameDataAssetIndex = {
    schemaVersion: 1,
    sourceFingerprint,
    selectionPolicy: {
      scope: 'mechanics-research-candidates-not-complete-asset-list', logicalAssetRule: 'same-directory-and-stem',
      criteria: ['BP_/BPI_/AnimBP_/AnimNS_ .uasset', 'filename contains GameplayEffect', 'DataTables .uasset', 'important gameplay branch .uasset'],
    },
    importantRoots: IMPORTANT_ROOTS.map((importantPath) => ({
      path: importantPath, present: directories.has(importantPath), recursiveFileCount: directoryByPath.get(importantPath)?.recursiveFileCount ?? 0, indexedAssetCount: indexedByRoot(importantPath),
    })),
    discoveredBranches,
    assets,
  }
  return { inventory, index, files }
}

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function renderLocalManifest(files: FileRecord[]): string {
  return `${files.map((file) => JSON.stringify(file)).join('\n')}\n`
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}

export function renderReport(inventory: GameDataInventory, index: GameDataAssetIndex): string {
  const root = (name: string) => inventory.roots.find((candidate) => candidate.path === name)!
  const dungeons = root('Dungeons/Content')
  const engine = root('Engine/Content')
  const extensionRows = Object.entries(inventory.extensions).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20)
  const unexpected = index.discoveredBranches.filter((branch) => !IMPORTANT_ROOTS.some((known) => isUnder(branch.path, known) || isUnder(known, branch.path))).slice(0, 20)
  const importantRows = index.importantRoots.filter((item) => item.present).map((item) => `| \`${item.path}\` | ${item.recursiveFileCount.toLocaleString('en-US')} | ${item.indexedAssetCount.toLocaleString('en-US')} |`).join('\n')
  return `# Game Data Inventory — Phase 6.5A

## Overview

QuickBMSで展開済みのMinecraft Dungeons 1.17.0.0を、\`${GAME_DATA_ROOT_LABEL}\`をsource labelとして棚卸しした。versionはdirectory labelに基づき、asset内部では検証していない。source root全体（\`Dungeons/Content\`、\`Engine/Content\`、その他）を走査し、${inventory.totals.files.toLocaleString('en-US')} files、${inventory.totals.directories.toLocaleString('en-US')} directories（source root自身を含む）、${formatBytes(inventory.totals.bytes)}を確認した。

Phase 6.5Aはpath、filename、extension、sizeだけを読む軽量scanである。\`.uasset\` / \`.uexp\` / \`.ubulk\`の内部Property、Export、CDO、gameplay値、texture・audio・modelは解析していない。runtime catalog、Gap、Evidence confidence、Optimizer scoreも変更しない。

| Root | Directories with files | Files | Size | Blueprint-prefix files |
|---|---:|---:|---:|---:|
| \`Dungeons/Content\` | ${dungeons.directories.toLocaleString('en-US')} | ${dungeons.files.toLocaleString('en-US')} | ${formatBytes(dungeons.bytes)} | ${index.assets.filter((asset) => asset.path.startsWith('Dungeons/Content/') && asset.classificationBasis.includes('filename-prefix')).length.toLocaleString('en-US')} logical candidates |
| \`Engine/Content\` | ${engine.directories.toLocaleString('en-US')} | ${engine.files.toLocaleString('en-US')} | ${formatBytes(engine.bytes)} | ${index.assets.filter((asset) => asset.path.startsWith('Engine/Content/') && asset.classificationBasis.includes('filename-prefix')).length.toLocaleString('en-US')} logical candidates |

Engine側はgeneric Unreal Engine asset中心でDungeons固有mechanicsのprimary targetではない可能性が高い、という仮説に留める。候補の有無と規模は索引に残し、deep parse要否は後続Phaseで判断する。

Source fingerprint: \`${inventory.sourceFingerprint.value}\`

Fingerprintは全fileの \`normalized relative path + NUL + decimal size + LF\` をpath順に連結し、SHA-256で計算する。raw bytes hashではない。

## Asset type overview

### Extensions

| Extension | Files |
|---|---:|
${extensionRows.map(([extension, amount]) => `| \`${extension}\` | ${amount.toLocaleString('en-US')} |`).join('\n')}

### Filename prefixes

prefix分類はfilenameからのheuristicであり、asset classの確定ではない。

| Prefix | Heuristic meaning | Files |
|---|---|---:|
${inventory.prefixes.map((item) => `| \`${item.prefix}\` | ${item.meaning} | ${item.count.toLocaleString('en-US')} |`).join('\n')}

### Companion structure

同じdirectory・同じstemを1 logical packageとしてpairingし、\`.uasset\`と\`.umap\`をpackage header、\`.uexp\`と\`.ubulk\`をpayload companionとして扱う。

- Package headers: ${inventory.companions.logicalPackagesWithHeader.toLocaleString('en-US')} logical packages
- \`.uasset\` packages: ${inventory.companions.uassetPackages.toLocaleString('en-US')}
- \`.uasset + .uexp\`: ${inventory.companions.uassetWithUexp.toLocaleString('en-US')}
- \`.uasset + .uexp + .ubulk\`: ${inventory.companions.uassetWithUexpAndUbulk.toLocaleString('en-US')}
- \`.uasset\` without \`.uexp\`: ${inventory.companions.uassetWithoutUexp.toLocaleString('en-US')}
- \`.umap\` packages: ${inventory.companions.umapPackages.toLocaleString('en-US')}
- \`.umap + .uexp\`: ${inventory.companions.umapWithUexp.toLocaleString('en-US')}
- \`.umap + .uexp + .ubulk\`: ${inventory.companions.umapWithUexpAndUbulk.toLocaleString('en-US')}
- \`.umap\` without \`.uexp\`: ${inventory.companions.umapWithoutUexp.toLocaleString('en-US')}
- Packages with both \`.uasset\` and \`.umap\` headers: ${inventory.companions.packagesWithMultipleHeaders.toLocaleString('en-US')}
- \`.uexp\` without a matching \`.uasset\` / \`.umap\` header: ${inventory.companions.uexpWithoutPackageHeader.toLocaleString('en-US')}
- \`.ubulk\` without a matching \`.uasset\` / \`.umap\` header: ${inventory.companions.ubulkWithoutPackageHeader.toLocaleString('en-US')}

## Gameplay research map

| Primary asset area | Recursive files | Indexed logical assets |
|---|---:|---:|
${importantRows}

\`game-data-asset-index.json\`は全texture等の一覧ではなく、上記branch、DataTables、Blueprint系prefix、GameplayEffect名を優先したmechanics research索引である。category / entity / asset kindはpathとfilenameだけから安全な範囲で推定する。

## Interesting discoveries

既知の優先root外でresearch keywordに一致し、indexed candidateが多いbranch上位を示す。keyword一致はgameplay propertyの存在を意味しない。

| Candidate branch | Matched terms | Files | Uasset | Indexed assets |
|---|---|---:|---:|---:|
${unexpected.map((branch) => `| \`${branch.path}\` | ${branch.matchedTerms.join(', ')} | ${branch.recursiveFileCount.toLocaleString('en-US')} | ${branch.uassetCount.toLocaleString('en-US')} | ${branch.indexedAssetCount.toLocaleString('en-US')} |`).join('\n') || '| — | — | 0 | 0 | 0 |'}

## Unknown / limitations

- path/nameだけではBlueprint class、inheritance、Property、numeric value、実際のgameplay semanticsは確定しない。
- game versionはfolder/source label由来で、binary内部のversion確認は未実施。
- native executable側にのみ存在するmechanicsはこのmapから発見できない可能性がある。
- \`.uasset\`と\`.umap\`をUnreal package headerとしてcompanion集計する。missing/unpaired companionやmultiple headerは欠損・破損と断定せず、unexpected package structureの観測値として扱う。
- Engine側は全体棚卸し済みだが、deep parse対象にするかは未決定。
- full file manifestとraw assetsは\`local-game-data/\`内だけに保存し、Gitへ含めない。

## Next step

Phase 6.5Bへsource boundary、version basis、fingerprint、raw data非再配布境界を引き渡す。Phase 6.5C以降はこの索引から代表assetとcompanionを選び、別の明示的な解析手順でbinary構造を調べる。Phase 6.5A単独ではruntime supportを昇格しない。
`
}

function isSorted(values: string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]!.localeCompare(value) <= 0)
}

function containsNonFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.some(containsNonFiniteNumber)
  if (value && typeof value === 'object') return Object.values(value).some(containsNonFiniteNumber)
  return false
}

export function collectArtifactErrors(inventory: GameDataInventory, index: GameDataAssetIndex): string[] {
  const errors: string[] = []
  const serialized = `${JSON.stringify(inventory)}${JSON.stringify(index)}`
  if (inventory.schemaVersion !== 2 || index.schemaVersion !== 1) errors.push('Unsupported schema version')
  if (inventory.methodology.binaryContentParsed !== false) errors.push('Inventory must not claim binary parsing')
  if (serialized.includes('/Users/') || serialized.includes('\\Users\\') || serialized.includes('file://')) errors.push('Committed artifacts contain an absolute user path')
  if (containsNonFiniteNumber(inventory) || containsNonFiniteNumber(index)) errors.push('Committed artifacts contain non-finite numbers')
  if (Object.values(inventory.totals).some((value) => !Number.isFinite(value) || value < 0)) errors.push('Totals must be finite and non-negative')
  if (Object.values(inventory.companions).some((value) => !Number.isInteger(value) || value < 0)) errors.push('Companion counts must be non-negative integers')
  if (inventory.companions.uassetPackages !== (inventory.extensions['.uasset'] ?? 0)) errors.push('Uasset package count does not match extension count')
  if (inventory.companions.umapPackages !== (inventory.extensions['.umap'] ?? 0)) errors.push('Umap package count does not match extension count')
  if (inventory.companions.uassetPackages !== inventory.companions.uassetWithUexp + inventory.companions.uassetWithoutUexp) errors.push('Uasset package classification does not partition package count')
  if (inventory.companions.umapPackages !== inventory.companions.umapWithUexp + inventory.companions.umapWithoutUexp) errors.push('Umap package classification does not partition package count')
  if (inventory.companions.uassetWithUexpAndUbulk > inventory.companions.uassetWithUexp) errors.push('Uasset bulk companion count exceeds uexp companion count')
  if (inventory.companions.umapWithUexpAndUbulk > inventory.companions.umapWithUexp) errors.push('Umap bulk companion count exceeds uexp companion count')
  if (inventory.companions.logicalPackagesWithHeader !== inventory.companions.uassetPackages + inventory.companions.umapPackages - inventory.companions.packagesWithMultipleHeaders) errors.push('Logical package header count is inconsistent')
  if (inventory.companions.packagesWithMultipleHeaders > 0) errors.push(`Unexpected package structure: ${inventory.companions.packagesWithMultipleHeaders} logical packages have both .uasset and .umap headers`)
  if (Object.values(inventory.extensions).reduce((sum, value) => sum + value, 0) !== inventory.totals.files) errors.push('Extension counts do not sum to total files')
  if (inventory.roots.reduce((sum, root) => sum + root.files, 0) !== inventory.totals.files) errors.push('Root counts do not sum to total files')
  if (inventory.directories.length !== inventory.totals.directories) errors.push('Directory summary count does not match total directories')
  if (!isSorted(inventory.directories.map((directory) => directory.path))) errors.push('Directory summaries are not deterministically sorted')
  if (!isSorted(index.assets.map((asset) => asset.id))) errors.push('Asset index is not deterministically sorted')
  if (new Set(index.assets.map((asset) => asset.id)).size !== index.assets.length) errors.push('Duplicate logical asset ID')
  for (const directory of inventory.directories) {
    if (!assertRelativePath(directory.path)) errors.push(`Invalid directory path: ${directory.path}`)
    if (Object.values(directory.extensions).reduce((sum, value) => sum + value, 0) !== directory.recursiveFileCount) errors.push(`Extension total mismatch: ${directory.path}`)
  }
  for (const asset of index.assets) {
    if (!assertRelativePath(asset.path) || asset.files.some((file) => !assertRelativePath(file))) errors.push(`Invalid asset path: ${asset.id}`)
    const expectedStem = asset.path
    if (asset.files.some((file) => `${path.posix.dirname(file)}/${stemOf(path.posix.basename(file))}` !== expectedStem)) errors.push(`Companion mismatch: ${asset.id}`)
    if (!asset.files.some((file) => extensionOf(file) === '.uasset')) errors.push(`Indexed logical asset lacks .uasset: ${asset.id}`)
  }
  if (!/^[a-f0-9]{64}$/.test(inventory.sourceFingerprint.value) || index.sourceFingerprint !== inventory.sourceFingerprint.value) errors.push('Source fingerprint mismatch')
  return [...new Set(errors)].sort()
}

export function reconcileSource(generated: { inventory: GameDataInventory; index: GameDataAssetIndex; files: FileRecord[] }, committed: { inventory: GameDataInventory; index: GameDataAssetIndex }): string[] {
  const errors: string[] = []
  if (serializeJson(generated.inventory) !== serializeJson(committed.inventory)) errors.push('research/game-data-inventory.json is stale for local source')
  if (serializeJson(generated.index) !== serializeJson(committed.index)) errors.push('research/game-data-asset-index.json is stale for local source')
  const sourceFiles = new Set(generated.files.map((file) => file.relativePath))
  for (const asset of committed.index.assets) for (const file of asset.files) if (!sourceFiles.has(file)) errors.push(`Indexed path is missing from source: ${file}`)
  return errors
}
