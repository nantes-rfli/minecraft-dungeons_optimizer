# Game Data Source Provenance — Phase 6.5B

## Dataset Identity

| Field | Value |
|---|---|
| Dataset ID | `mcd-quickbms-local-1.17.0.0-823acded` |
| Game | Minecraft Dungeons |
| Claimed version | `1.17.0.0` |
| Source class | `direct-local-game-asset` |
| Logical root label | `QuickBMS 1.17.0.0` |
| Source fingerprint | `sha256-path-size-v1:823acdedfa8a1533f5fe5e4106d7fd6a1613a977b4319e866b16d3236e00fda6` |
| Inventory linkage | 134,806 files / 4,746,982,687 bytes |

This dataset is direct because research reads a locally present tree of game-asset-formatted files. “Direct” does not mean official, authenticated, or version-verified.

## What is verified, claimed, and unknown

| Identity question | Status | Basis | Boundary |
|---|---|---|---|
| gameIdentity | supported | Observed Dungeons asset namespace and repository research context. | The local tree is consistent with Minecraft Dungeons assets; this does not authenticate its distribution origin. |
| claimedVersion | claimed | Dataset root label: QuickBMS 1.17.0.0. | The version has not been independently verified from asset contents or an original package. |
| sourceTreeIdentity | verified | sha256-path-size-v1:823acdedfa8a1533f5fe5e4106d7fd6a1613a977b4319e866b16d3236e00fda6. | The path-and-size fingerprint fixes the observed local tree identity, not the raw contents of every file. |
| originalPackageIdentity | unknown | No original package hash or identity is recorded. | No byte-level equivalence to an original pak has been established. |
| extractionTool | claimed | Dataset root label: QuickBMS 1.17.0.0. | QuickBMS version, BMS script, flags, and command line are not recorded. |
| extractionProcedure | unknown | No extraction command, flags, script, or date is recorded. | The procedure cannot currently be reproduced from committed metadata. |
| archiveOrigin | unknown | No archive source, author, or distribution channel is recorded. | The dataset is not asserted to be an official distribution. |
| completeness | unknown | The observed local tree is inventoried, but no original package is available for comparison. | Inventory completeness does not establish extraction completeness. |

The source tree itself is fixed by its path-and-size fingerprint. The asset-internal version, original pak identity and hash, byte-level equivalence, archive origin and author, distribution channel, extraction command and date, QuickBMS version and script, and extraction completeness remain unverified or unknown as shown above.

## Evidence Layers

0. **Source Dataset** (`source-dataset`)
1. **Raw Asset Observation** (`raw-asset-observation`)
2. **Extracted Structural Fact** (`extracted-structural-fact`)
3. **Semantic Interpretation** (`semantic-interpretation`)
4. **Normalized Optimizer Fact** (`normalized-optimizer-fact`)
5. **Runtime Promotion** (`runtime-promotion`)

These layers form a trace, not a shortcut. Raw observation, parser output, semantic interpretation, normalized Optimizer data, and runtime adoption must remain separately reviewable.

## Confidence Axes

- **Source confidence:** Dataset and asset source identity confidence.
- **Extraction confidence:** Binary parser structural accuracy confidence.
- **Semantic confidence:** Game-mechanics interpretation confidence.
- **Version confidence:** Applicability to claimed Minecraft Dungeons version confidence.

Source confidence does not imply parser correctness; extraction confidence does not imply mechanic semantics; semantic confidence does not prove version applicability.

## Asset Provenance Key

Every record joins to the source through `datasetId + asset.path`; `datasetId` resolves to the source fingerprint above. Asset paths and source files are slash-separated paths relative to the dataset root. Logical asset paths omit the extension, while `asset.files` retains each companion filename. Absolute filesystem paths are invalid. A selected asset may additionally carry a SHA-256 content hash; Phase 6.5B does not hash all files.

## Raw vs Normalized Data

Parser output retains `extraction.propertyName`, `extraction.propertyType`, and `rawObservation.value`. Interpretation stores its statement and mapping basis separately. Any rounded or renamed value uses `interpretation.normalizedProperty` and `normalizedValue` without overwriting the raw property or value.

Allowed mapping bases are property name, class context, inheritance context, public-source cross-check, manual review, and game observation. Cross-check status records whether public evidence matches, partly matches, conflicts, is missing, or is not semantically comparable.

## Source Hierarchy Boundary

Direct local game asset evidence can be primary structural evidence, but it does not automatically override conflicting official, current, or runtime observations. The existing project source hierarchy is unchanged. All Phase 6.5 provenance records default to `research-only`; runtime promotion is never automatic.

## Git / Distribution Boundary

- The repository does not redistribute Minecraft Dungeons raw game assets.
- Local extracted game data is research input only.
- Generated provenance, relative paths, hashes, structural metadata, and independently authored interpretation may be committed.
- `.uasset`, `.uexp`, `.umap`, `.ubulk`, raw textures, audio, meshes, full game data, raw asset copies, and binary excerpts must not be committed.
- This boundary documents repository practice and does not make a legal determination.

## CI Boundary

Raw local game data is not required in CI (`ciRequiresLocalSource = false`). CI validates the committed inventory, provenance structure, deterministic generated report, and their fingerprint/count linkage. Contributors without the local source can validate committed metadata. Source-present reconciliation remains a separate Phase 6.5A check.

## Phase 6.5C Contract

Every formal parser output must include dataset ID, canonical asset path, relative source files, parser ID, parser schema version, object/class/property identifiers when available, raw value, all four confidence axes, and `status: "extracted"`. The helper sets `promotionStatus: "research-only"` and validates the record. Extracted values without provenance are not formal research artifacts.

Phase 6.5C may parse UE4 package structure, but it must not collapse raw values into semantic or normalized facts. Runtime adoption requires a later, explicit promotion decision.
