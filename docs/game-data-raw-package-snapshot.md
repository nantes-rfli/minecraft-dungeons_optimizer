# Raw Game Source package snapshots — Step 3A

This generated artifact covers the deliberately small six-package Raw flow:

`Game files → extraction → Raw package snapshot`

The current scope is Fighter’s Bindings Instance, Scatter Crossbow Instance, Scatter Crossbow projectile, Battle Robe Instance, Death Cap Mushroom Instance, and Death Cap Mushroom GameplayEffect. Each is an independent snapshot generated before semantic property selection. No snapshot creates a Domain identity, feeds Data Browser or Optimizer, or includes manual annotations.

## Reproducibility identity

- Dataset: `mcd-quickbms-local-1.17.0.0-823acded`
- Claimed game version: `1.17.0.0` (status: `claimed`)
- Parser: `ue4-package-property-parser` schema 1
- Extractor/parser code: `sha256-path-content-v1:883d79e4fb1ed938b0cc7f1e666182c53a0957902e978d5b9890e91cd344a322`

The run ID of each package is a deterministic SHA-256 content address of the snapshot schema, dataset ID, logical package path, individual input file size/hash metadata, parser identity, extraction configuration, and extractor/parser code identity. No clock time or machine-specific absolute path participates.

| Snapshot-affecting code path | SHA-256 |
|---|---|
| `scripts/game-data-package-source.ts` | `14c2cf119186ae9187211cfdd1e637979d589a0c4c23c58de0bc62224a6d99db` |
| `scripts/game-data-raw-package.ts#snapshot-core` | `7348ca88aa389131ac483e33be6377f3f761b9afa9bbe08fc30a180095af04fd` |
| `src/research/ue4/binaryReader.ts` | `d277ae5ff62523dc628fab56f15d475d89df7d01a71cb5d70259f6046456f565` |
| `src/research/ue4/objectResolver.ts` | `8d1aa51a0e53afe7cd1dfd16d66a18672a3e23c7e44521750deda01570ef2742` |
| `src/research/ue4/packageReader.ts` | `818d3f2d1584d489727d3dbf4db3946faf5dd9e92090a01dc0849557471f0c36` |
| `src/research/ue4/packageTypes.ts` | `640f89ba4a7fa9db8e3825304adb3aaab21f3490dac2532e3a1a45e6ff0859eb` |
| `src/research/ue4/propertyReader.ts` | `c8ef041ee90673d27443d98a844d2090041a0ec674e38601fa37c1c1dc22094e` |

The aggregate code fingerprint processes sorted code units as `identity path + NUL + bytes`. The Raw package entry is limited to the marked imports and snapshot-core sections; package specs, audit assertions, orchestration, and report rendering are excluded. The focused source helper and UE4 parser/decoder dependencies are fingerprinted as complete files. CI recomputes this identity from checked-out code even when local game files are absent, so snapshot-affecting drift requires regenerated committed snapshots without invalidating snapshots for report or unrelated package-spec changes.

The source binaries remain local and are not committed. Every package has its own source-file identity, logical hash, and deterministic run ID.

## Package: `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance`

- Extraction run: `sha256:893590bd7d43e4c333c30a1c4fe2f505bdccd320524818c4e531dbed222a2911`
- Logical package hash: `sha256-path-content-v1:4f7327fdb483e045578de7802886f360f276c63f399294ff4768159695a388f3`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.uasset` | 5607 | `5d69dd6957b23704f35c5b5fca315c7b6bf53b9f8994445acf2547bd5065226c` |
| `Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.uexp` | 5558 | `a4793e11abfa8e5ecea3fab7f86f46cc9aa8a91486c6f6b5d78f85016952e86c` |

- 117 Name Map entries, 33 imports, and 5 exports in serialized order
- 5 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 163 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 4 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

## Package: `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance`

- Extraction run: `sha256:adba4b1ede060b364c869e9990224d1fc0a55b76aeff58409809c7c88da77ed4`
- Logical package hash: `sha256-path-content-v1:15dd1fd125a0894f715761615f5c053c0b17c2919b6512e0136a11b9dccb9154`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uasset` | 6219 | `3a9087d35a32a81ecc702d0d9da41eecca9a738d1bdd89a93af7dd946b6cc236` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uexp` | 1869 | `d7fb47495d059a8bdd782306cae52a5342e24a33121935eaebddb15a750d7a58` |

- 113 Name Map entries, 51 imports, and 5 exports in serialized order
- 5 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 37 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 4 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

## Package: `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow`

- Extraction run: `sha256:6523b097365ca38f8556446293195d67f052250a7770b953f9d47d6553fc5deb`
- Logical package hash: `sha256-path-content-v1:0e820a32f6c409ecfbd280d94264a0138b16e4503703a0529c0bf9201198da5f`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow.uasset` | 6788 | `c6b852f0a4f2390c3bcca3d8e9e441df227df138a0365705f30880c5d396a73c` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow.uexp` | 3383 | `3bb75a740544bd29736712c9f778df4d1ec8eace2f032fc79ebb65f136c51587` |

- 118 Name Map entries, 46 imports, and 15 exports in serialized order
- 15 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 12 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 14 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

## Package: `Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance`

- Extraction run: `sha256:0e7ec65da6f7ff54d0deeaef2a6b6dd9ab14bb97d7201ebc02b9a451b5f5ad46`
- Logical package hash: `sha256-path-content-v1:9d5c498f0f966929253712dfeae283aa1207f7a9ff1c27983eb4991f2abe7684`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance.uasset` | 3106 | `6af8045b8ca4d52bb534b22d30af72713b435fa4b25ce0b0d56c2f551e2bd4de` |
| `Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance.uexp` | 556 | `4bd24eb00177471089622e6247b0292d7b89686e67c273ef477bf0138cc6d54f` |

- 53 Name Map entries, 23 imports, and 5 exports in serialized order
- 5 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 6 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 4 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

## Package: `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance`

- Extraction run: `sha256:ba80b2a95c9a6883e2c86fe860c3811b6bffb46d968dd1bf6a83512f3dee5682`
- Logical package hash: `sha256-path-content-v1:973ee093eb5081eba985e8a34e868ad9434637da41a35e2ad1c55c13d7372113`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance.uasset` | 3718 | `2c90db9eda3e89ad3fda8a1c28e8d90b255184c89c9bb5775d9b22c4eeae3f6a` |
| `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance.uexp` | 614 | `b9fe7543bbc846be7159dafa9ac9a7718d2f4ecb6363f1bf054765f45b491829` |

- 61 Name Map entries, 29 imports, and 5 exports in serialized order
- 5 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 8 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 4 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

## Package: `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect`

- Extraction run: `sha256:b5897b8ebc25497b6242bffc3487778cf5a3331c5564e8098bef5b2082b741ca`
- Logical package hash: `sha256-path-content-v1:70d8ee04479f796280089d43088019420547c1c31bd050591674dfa0d33794fc`

| Dataset-relative input | Bytes | SHA-256 |
|---|---:|---|
| `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect.uasset` | 1551 | `f473d0a6e015d656df24eb797f143d368d268f77ded11fca0ebe6fd6ec9e23ad` |
| `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect.uexp` | 129 | `5b589c7bf256ee468679eb002701ad074793a7f5fee9fdd1f74d76db39e980c6` |

- 20 Name Map entries, 11 imports, and 3 exports in serialized order
- 3 export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- 1 decoded CDO property stream containing 1 property nodes; names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- 2 non-CDO export payloads explicitly marked `not-extracted` with complete unavailable ranges
- 0 package diagnostics and 2 package-level unparsed/unassigned ranges

Decoded zero and false values are retained only with `state: decoded`; unavailable states omit `value`. Raw object/package indexes are not rewritten as application identities.

## Boundaries

- Semantic filtering: `not-applied`
- Domain identity mapping: `not-applied`
- Manual annotations: `separate-not-included`
- Raw binary bytes: `not-committed`

Canonical generated snapshots are stored beneath `research/raw/packages/` at their logical package paths. Scatter Crossbow’s projectile and Battle Robe’s GearActor remain package-local ObjectProperty indexes plus the unmodified Import Tables and outer chains. Death Cap Mushroom’s serialized Effect import outer chain names `/Game/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect`; that exact package is present in the selected local dataset and has its own independent Raw snapshot in this slice. This confirms package identity and traceability without interpreting duration, attack speed, movement speed, Power scaling, stacking, or effective uptime. No generic cross-package resolver or Domain identity is added. Battle Robe contains no asserted Armor Property ownership. Full-game expansion, non-CDO decoding, Domain Model, Data Browser, and Optimizer integration remain outside Step 3A.
