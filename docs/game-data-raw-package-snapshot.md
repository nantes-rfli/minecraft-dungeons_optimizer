# Raw Game Source package snapshot — Step 3A

This generated artifact proves the first one-package Raw flow:

`Game files → extraction → Raw package snapshot`

The only logical package in scope is `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance`. The snapshot is generated before semantic property selection. It does not create a Domain identity, feed Data Browser or Optimizer, resolve cross-package references, or include manual annotations.

## Reproducibility identity

- Dataset: `mcd-quickbms-local-1.17.0.0-823acded`
- Claimed game version: `1.17.0.0` (status: `claimed`)
- Parser: `ue4-package-property-parser` schema 1
- Extractor/parser code: `sha256-path-content-v1:f4ff109de312ca191e3d81bdb8a9d478c2861111efccacefa87ce7e2ac449b08`
- Extraction run: `sha256:9c49ae9bfa0f5a9e02d01b0aa9c028ce6c05260f00c8f74ccf3070df91ca5d5e`
- Logical package hash: `sha256-path-content-v1:4f7327fdb483e045578de7802886f360f276c63f399294ff4768159695a388f3`

The run ID is a deterministic SHA-256 content address of the snapshot schema, dataset ID, logical package path, individual input file size/hash metadata, parser identity, extraction configuration, and the extractor/parser code identity below. No clock time or machine-specific absolute path participates. Parser schema version and code identity are separate checks.

| Snapshot-affecting code path | SHA-256 |
|---|---|
| `scripts/extract-game-data-raw-package.ts` | `785337d2139195fde9bfa7618bca7e93c4c34dd72f7784ed9aa847ca61c32adb` |
| `scripts/game-data-extractor.ts` | `a287234b2d083f26726e5b9068a0e48a884e5837c8fd01d4af2fa8612773982c` |
| `scripts/game-data-raw-package.ts` | `0e9959ff2dffeee67f683295b95b887bc42d1704659a90e40e32cbe2c8cfd837` |
| `src/research/gameDataProvenance.ts` | `310bfea71cc7d85389af69e14c636bea80c1bf581af6837e2cbd9377e4b1ea9d` |
| `src/research/ue4/binaryReader.ts` | `d277ae5ff62523dc628fab56f15d475d89df7d01a71cb5d70259f6046456f565` |
| `src/research/ue4/objectResolver.ts` | `8d1aa51a0e53afe7cd1dfd16d66a18672a3e23c7e44521750deda01570ef2742` |
| `src/research/ue4/packageReader.ts` | `818d3f2d1584d489727d3dbf4db3946faf5dd9e92090a01dc0849557471f0c36` |
| `src/research/ue4/packageTypes.ts` | `640f89ba4a7fa9db8e3825304adb3aaab21f3490dac2532e3a1a45e6ff0859eb` |
| `src/research/ue4/propertyReader.ts` | `c8ef041ee90673d27443d98a844d2090041a0ec674e38601fa37c1c1dc22094e` |

The aggregate code fingerprint processes these sorted repository-relative paths as `relative UTF-8 path + NUL + raw file bytes`. CI recomputes it from the checked-out code even when local game files are absent, so code drift requires a regenerated committed snapshot.

## Input files

| Dataset-relative path | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.uasset` | 5607 | `5d69dd6957b23704f35c5b5fca315c7b6bf53b9f8994445acf2547bd5065226c` |
| `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.uexp` | 5558 | `a4793e11abfa8e5ecea3fab7f86f46cc9aa8a91486c6f6b5d78f85016952e86c` |

The source binaries remain local and are not committed.

## Retained Raw structure

- 117 Name Map entries, 33 imports, and 5 exports in serialized order
- 5 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 163 property nodes; property names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 4 non-CDO export payloads explicitly marked `not-extracted` with their complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

Decoded zero and false values are retained only with `state: decoded`; unavailable states omit `value`. Raw object/package indexes are not rewritten as application identities.

## Boundaries

- Semantic filtering: `not-applied`
- Domain identity mapping: `not-applied`
- Manual annotations: `separate-not-included`
- Raw binary bytes: `not-committed`

The canonical generated snapshot is `research/raw/packages/Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.raw.json`. Full-game expansion, non-CDO decoding, cross-package reference completion, Domain Model, Data Browser, and Optimizer integration remain outside Step 3A.
