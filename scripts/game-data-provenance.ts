import {
  CONFIDENCE_AXES, EVIDENCE_LAYERS, GAME_DATA_CONFIDENCE_LEVELS, VERIFICATION_STATUSES,
  isCanonicalGameDataPath, isFiniteJsonTree, type GameDataSourceProvenance,
} from '../src/research/gameDataProvenance.ts'
import type { GameDataInventory } from './game-data-inventory.ts'

export const PROVENANCE_SCHEMA_VERSION = 2 as const

export function buildGameDataSourceProvenance(inventory: GameDataInventory): GameDataSourceProvenance {
  const fingerprint = inventory.sourceFingerprint.value
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    dataset: {
      id: `mcd-quickbms-local-${inventory.source.version}-${fingerprint.slice(0, 8)}`,
      game: 'Minecraft Dungeons',
      claimedVersion: inventory.source.version,
      sourceType: 'local-extracted-game-data',
      sourceClass: 'direct-local-game-asset',
      rootLabel: inventory.source.rootLabel,
      sourceFingerprint: inventory.sourceFingerprint,
      totals: { files: inventory.totals.files, bytes: inventory.totals.bytes },
    },
    verification: {
      gameIdentity: {
        status: 'supported',
        basis: 'Observed Dungeons asset namespace and repository research context.',
        note: 'The local tree is consistent with Minecraft Dungeons assets; this does not authenticate its distribution origin.',
      },
      claimedVersion: {
        status: 'claimed',
        basis: `Dataset root label: ${inventory.source.rootLabel}.`,
        note: 'The version has not been independently verified from asset contents or an original package.',
      },
      sourceTreeIdentity: {
        status: 'verified',
        basis: `${inventory.sourceFingerprint.algorithm}:${fingerprint}.`,
        note: 'The path-and-size fingerprint fixes the observed local tree identity, not the raw contents of every file.',
      },
      originalPackageIdentity: {
        status: 'unknown',
        basis: 'No original package hash or identity is recorded.',
        note: 'No byte-level equivalence to an original pak has been established.',
      },
      extractionTool: {
        name: 'QuickBMS',
        status: 'claimed',
        basis: `Dataset root label: ${inventory.source.rootLabel}.`,
        note: 'QuickBMS version, BMS script, flags, and command line are not recorded.',
      },
      extractionProcedure: {
        status: 'unknown',
        basis: 'No extraction command, flags, script, or date is recorded.',
        note: 'The procedure cannot currently be reproduced from committed metadata.',
      },
      archiveOrigin: {
        status: 'unknown',
        basis: 'No archive source, author, or distribution channel is recorded.',
        note: 'The dataset is not asserted to be an official distribution.',
      },
      completeness: {
        status: 'unknown',
        basis: 'The observed local tree is inventoried, but no original package is available for comparison.',
        note: 'Inventory completeness does not establish extraction completeness.',
      },
    },
    boundaries: {
      rawAssetsCommitted: false,
      absolutePathsCommitted: false,
      ciRequiresLocalSource: false,
      runtimePromotionAutomatic: false,
    },
    evidenceLayers: EVIDENCE_LAYERS,
    confidenceAxes: CONFIDENCE_AXES,
    allowedCommittedMetadata: [
      'relative asset paths', 'property names and types', 'numeric and boolean values',
      'class and object names', 'hashes', 'normalized structural facts',
      'independently authored interpretations', 'provenance records', 'audit reports',
    ],
    prohibitedCommittedRawData: [
      '.uasset', '.uexp', '.umap', '.ubulk', 'raw textures', 'raw audio',
      'raw meshes', 'raw full game data', 'raw asset copies', 'binary excerpts',
    ],
    parserContract: {
      parserIdRequired: true,
      parserSchemaVersionRequired: true,
      provenanceRequiredForFormalArtifact: true,
      defaultPromotionStatus: 'research-only',
    },
  }
}

const containsPrivatePath = (value: string): boolean => [
  '/Users/', '\\Users\\', 'file://', '~/Downloads', '/home/', '/root/',
].some((fragment) => value.includes(fragment))

export function collectGameDataProvenanceErrors(provenance: GameDataSourceProvenance, inventory: GameDataInventory): string[] {
  const errors: string[] = []
  const serialized = JSON.stringify(provenance)
  if (provenance.schemaVersion !== PROVENANCE_SCHEMA_VERSION) errors.push('Unsupported provenance schema version')
  if (!provenance.dataset.id.trim()) errors.push('Dataset ID is required')
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(provenance.dataset.id)) errors.push('Dataset ID must be stable and machine-independent')
  if (!/^[a-f0-9]{64}$/.test(provenance.dataset.sourceFingerprint.value)) errors.push('Fingerprint must be lowercase SHA-256')
  if (provenance.dataset.sourceFingerprint.algorithm !== inventory.sourceFingerprint.algorithm || provenance.dataset.sourceFingerprint.value !== inventory.sourceFingerprint.value) errors.push('Provenance fingerprint does not match inventory')
  if (provenance.dataset.totals.files !== inventory.totals.files) errors.push('Provenance file count does not match inventory')
  if (provenance.dataset.totals.bytes !== inventory.totals.bytes) errors.push('Provenance byte count does not match inventory')
  if (provenance.dataset.rootLabel !== inventory.source.rootLabel) errors.push('Provenance root label does not match inventory')
  if (provenance.dataset.claimedVersion !== inventory.source.version) errors.push('Provenance claimed version does not match inventory')
  if (containsPrivatePath(serialized)) errors.push('Provenance contains a local absolute or private path')
  if (!isFiniteJsonTree(provenance)) errors.push('Provenance contains NaN or Infinity')

  for (const [key, item] of Object.entries(provenance.verification)) {
    if (!VERIFICATION_STATUSES.includes(item.status)) errors.push(`Invalid verification status: ${key}`)
    if (!item.basis.trim() || !item.note.trim()) errors.push(`Verification basis and note are required: ${key}`)
    if (item.status === 'unknown' && 'uri' in item) errors.push(`Unknown verification item must not claim a source URI: ${key}`)
  }
  if (provenance.verification.claimedVersion.status === 'verified') errors.push('Claimed version must not be marked verified')
  if (provenance.verification.archiveOrigin.status !== 'unknown') errors.push('Archive origin must remain unknown')
  if (provenance.verification.originalPackageIdentity.status !== 'unknown') errors.push('Original package identity must remain unknown')
  if (provenance.verification.extractionProcedure.status !== 'unknown') errors.push('Extraction procedure must remain unknown')
  if (provenance.verification.extractionTool.status !== 'claimed') errors.push('Extraction tool must remain claimed')
  if (provenance.verification.sourceTreeIdentity.status !== 'verified') errors.push('Source tree identity must be fingerprint-verified')

  const expectedLayerIds = EVIDENCE_LAYERS.map((layer) => layer.id)
  if (provenance.evidenceLayers.some((layer, index) => layer.order !== index) || JSON.stringify(provenance.evidenceLayers.map((layer) => layer.id)) !== JSON.stringify(expectedLayerIds)) errors.push('Evidence layers are missing or out of order')
  const confidenceIds = provenance.confidenceAxes.map((axis) => axis.id)
  if (JSON.stringify(confidenceIds) !== JSON.stringify(CONFIDENCE_AXES.map((axis) => axis.id))) errors.push('Confidence axes are missing or out of order')
  if (new Set(GAME_DATA_CONFIDENCE_LEVELS).size !== GAME_DATA_CONFIDENCE_LEVELS.length) errors.push('Confidence level enum contains duplicates')
  if (provenance.boundaries.rawAssetsCommitted !== false) errors.push('Raw assets must not be committed')
  if (provenance.boundaries.absolutePathsCommitted !== false) errors.push('Absolute paths must not be committed')
  if (provenance.boundaries.ciRequiresLocalSource !== false) errors.push('CI must not require local source')
  if (provenance.boundaries.runtimePromotionAutomatic !== false) errors.push('Runtime promotion must not be automatic')
  if (provenance.parserContract.provenanceRequiredForFormalArtifact !== true) errors.push('Formal parser artifacts must require provenance')
  if (!isCanonicalGameDataPath('Dungeons/Content/example') || isCanonicalGameDataPath('/Users/example/asset')) errors.push('Canonical path validator is inconsistent')
  return [...new Set(errors)].sort()
}

export function serializeProvenance(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function renderGameDataProvenanceReport(provenance: GameDataSourceProvenance): string {
  const { dataset, verification, boundaries } = provenance
  const verificationRows = Object.entries(verification).map(([field, item]) => `| ${field} | ${item.status} | ${item.basis} | ${item.note} |`).join('\n')
  return `# Game Data Source Provenance — Phase 6.5B

## Dataset Identity

| Field | Value |
|---|---|
| Dataset ID | \`${dataset.id}\` |
| Game | ${dataset.game} |
| Claimed version | \`${dataset.claimedVersion}\` |
| Source class | \`${dataset.sourceClass}\` |
| Logical root label | \`${dataset.rootLabel}\` |
| Source fingerprint | \`${dataset.sourceFingerprint.algorithm}:${dataset.sourceFingerprint.value}\` |
| Inventory linkage | ${dataset.totals.files.toLocaleString('en-US')} files / ${dataset.totals.bytes.toLocaleString('en-US')} bytes |

This dataset is direct because research reads a locally present tree of game-asset-formatted files. “Direct” does not mean official, authenticated, or version-verified.

## What is verified, claimed, and unknown

| Identity question | Status | Basis | Boundary |
|---|---|---|---|
${verificationRows}

The source tree itself is fixed by its path-and-size fingerprint. The asset-internal version, original pak identity and hash, byte-level equivalence, archive origin and author, distribution channel, extraction command and date, QuickBMS version and script, and extraction completeness remain unverified or unknown as shown above.

## Evidence Layers

${provenance.evidenceLayers.map((layer) => `${layer.order}. **${layer.label}** (\`${layer.id}\`)`).join('\n')}

These layers form a trace, not a shortcut. Raw observation, parser output, semantic interpretation, normalized Optimizer data, and runtime adoption must remain separately reviewable.

## Confidence Axes

${provenance.confidenceAxes.map((axis) => `- **${axis.label}:** ${axis.description}`).join('\n')}

Source confidence does not imply parser correctness; extraction confidence does not imply mechanic semantics; semantic confidence does not prove version applicability.

## Asset Provenance Key

Every record joins to the source through \`datasetId + asset.path\`; \`datasetId\` resolves to the source fingerprint above. Asset paths and source files are slash-separated paths relative to the dataset root. Logical asset paths omit the extension, while \`asset.files\` retains each companion filename. Absolute filesystem paths are invalid. A selected asset may additionally carry a SHA-256 content hash; Phase 6.5B does not hash all files.

## Raw vs Normalized Data

Parser output retains \`extraction.propertyName\`, \`extraction.propertyType\`, and \`rawObservation.value\`. Interpretation stores its statement and mapping basis separately. Any rounded or renamed value uses \`interpretation.normalizedProperty\` and \`normalizedValue\` without overwriting the raw property or value.

Allowed mapping bases are property name, class context, inheritance context, public-source cross-check, manual review, and game observation. Cross-check status records whether public evidence matches, partly matches, conflicts, is missing, or is not semantically comparable.

## Source Hierarchy Boundary

Direct local game asset evidence can be primary structural evidence, but it does not automatically override conflicting official, current, or runtime observations. The existing project source hierarchy is unchanged. All Phase 6.5 provenance records default to \`research-only\`; runtime promotion is never automatic.

## Git / Distribution Boundary

- The repository does not redistribute Minecraft Dungeons raw game assets.
- Local extracted game data is research input only.
- Generated provenance, relative paths, hashes, structural metadata, and independently authored interpretation may be committed.
- \`.uasset\`, \`.uexp\`, \`.umap\`, \`.ubulk\`, raw textures, audio, meshes, full game data, raw asset copies, and binary excerpts must not be committed.
- This boundary documents repository practice and does not make a legal determination.

## CI Boundary

Raw local game data is not required in CI (\`ciRequiresLocalSource = ${boundaries.ciRequiresLocalSource}\`). CI validates the committed inventory, provenance structure, deterministic generated report, and their fingerprint/count linkage. Contributors without the local source can validate committed metadata. Source-present reconciliation remains a separate Phase 6.5A check.

## Phase 6.5C Contract

Every formal parser output must include dataset ID, canonical asset path, relative source files, parser ID, parser schema version, object/class/property identifiers when available, raw value, all four confidence axes, and \`status: "extracted"\`. The helper sets \`promotionStatus: "research-only"\` and validates the record. Extracted values without provenance are not formal research artifacts.

Phase 6.5C may parse UE4 package structure, but it must not collapse raw values into semantic or normalized facts. Runtime adoption requires a later, explicit promotion decision.
`
}
