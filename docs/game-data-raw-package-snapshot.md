# Raw Game Source package snapshot — Step 3A

This generated artifact proves the first one-package Raw flow:

`Game files → extraction → Raw package snapshot`

The only logical package in scope is `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance`. The snapshot is generated before semantic property selection. It does not create a Domain identity, feed Data Browser or Optimizer, resolve cross-package references, or include manual annotations.

## Reproducibility identity

- Dataset: `mcd-quickbms-local-1.17.0.0-823acded`
- Claimed game version: `1.17.0.0` (status: `claimed`)
- Parser: `ue4-package-property-parser` schema 1
- Extraction run: `sha256:48cba2b27c483a824434bf419f083cec2a74d6f6e183f414985d4955d4ca868d`
- Logical package hash: `sha256-path-content-v1:4f7327fdb483e045578de7802886f360f276c63f399294ff4768159695a388f3`

The run ID is a deterministic SHA-256 content address of the snapshot schema, dataset ID, logical package path, individual input file size/hash metadata, parser identity, and extraction configuration. No clock time or machine-specific absolute path participates.

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
