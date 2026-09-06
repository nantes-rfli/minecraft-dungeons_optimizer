# Game Data Extractor — Phase 6.5C

## Supported package scope

This foundation supports the Minecraft Dungeons targeted UE4 legacy package subset with magic `0x9E2A83C1`, legacy file version `-7`, and paired `.uasset + .uexp` files. It does not claim support for every UE4 package version.

## Parser architecture

`Package Header → Name Map → Import/Export Tables → FPackageIndex → Export CDO → Property Tags → provenance record`

The reader parses the package summary in serialization order, checks every binary range, converts an export's combined-package `SerialOffset` to `.uexp` offset by subtracting `TotalHeaderSize`, and rejects ranges outside the companion file.

## Supported property types

- `ArrayProperty`
- `BoolProperty`
- `ByteProperty`
- `EnumProperty`
- `FloatProperty`
- `Int64Property`
- `IntProperty`
- `NameProperty`
- `ObjectProperty`
- `SoftObjectProperty`
- `StrProperty`
- `StructProperty`
- `UInt32Property`

Generic tagged structs, nested structs, `Vector`, and arrays including `Array<Struct>` are supported. Boolean values are read from tag metadata when their payload size is zero. Object references retain the raw `FPackageIndex` and structural resolution.

## Unsupported and tolerant behavior

An unknown property type is skipped only when its declared payload boundary is safe; a structured diagnostic is retained. If metadata does not establish a safe continuation point, parsing stops for that object. Invalid magic, versions, name indexes, table ranges, and export serial ranges are explicit parse errors rather than silent truncation. Strict mode can require the CDO property terminator; the sample extraction uses tolerant diagnostics.

## Provenance and semantic boundary

Every selected formal fact is created through `createPhase65CExtractionRecord()` with parser ID `ue4-package-property-parser`, parser schema 1, all four confidence axes, `status: extracted`, `promotionStatus: research-only`, `crossCheckStatus: not-compared`, and semantic confidence `unknown`. Extracted records cannot contain interpretation or normalized fields.

These records establish only that a serialized property/value exists at an asset/object/property path. They do not establish gameplay meaning. In particular, raw `damage = 50` does **not** establish weapon damage, displayed damage, or normalized projectile damage.

## Selected asset validation

| Logical asset | Exports | CDO | Parsed properties | Unsupported | Parse errors | Formal records | Logical SHA-256 |
|---|---:|---|---:|---:|---:|---:|---|
| `Dungeons/Content/Actors/Equipment/RangedWeapons/BP_ArrowBaseRangedWeapon` | 5 | `Default__BP_ArrowBaseRangedWeapon_C` | 17 | 0 | 0 | 2 | `121e31b06467c8f4b9b9ff9dbb45ef647a598db5f6c48866846488e973c174fe` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow` | 15 | `Default__BP_ScatterCrossBow_Arrow_C` | 12 | 0 | 0 | 5 | `0e820a32f6c409ecfbd280d94264a0138b16e4503703a0529c0bf9201198da5f` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbow` | 21 | `Default__BP_ScatterCrossbow_C` | 5 | 0 | 0 | 1 | `84e76da76d02b28f7ad99fab93bf255abd9886a63bc53055c3d572870a030912` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance` | 5 | `Default__BP_ScatterCrossbowInstance_C` | 37 | 0 | 0 | 16 | `15dd1fd125a0894f715761615f5c053c0b17c2919b6512e0136a11b9dccb9154` |
| `Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowStorable` | 11 | `Default__BP_ScatterCrossbowStorable_C` | 10 | 0 | 0 | 0 | `385732f8fc14140721f9b9f6c886a8883b4cac987d154fb7a5a38508f05a4753` |

The logical SHA-256 algorithm processes each companion in sorted relative-path order as `relative UTF-8 path + NUL + raw file bytes`. Absolute paths are neither hash input nor formal output.

### Scatter Crossbow structural observations

| Observation | Raw value |
|---|---|
| `AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles` | `3` |
| `AttackDefintion.AttackRateSeconds` | `0.6000000238418579` |
| `AttackDefintion.ProjectileDefinition[0].DelaySecondsPerProjectile` | `0.029999999329447746` |
| `AttackDefintion.ProjectileDefinition[0].ProjectileOffset` | `{"X":45,"Y":0,"Z":25}` |
| `damage` | `50` |
| `Projectile` reference | `BP_ScatterCrossBow_Arrow_C` |
| `GearActor` reference | `BP_ScatterCrossbow_C` |
| generated-class superclass | `BP_ArrowBaseRangedWeapon_C` |

Raw property spelling, including `AttackDefintion` and `ActiveCancelPorintFactor`, is preserved exactly.

## CI behavior

`npm run audit:game-data-extractor` always validates the committed sample, deterministic report, provenance rules, ordering, hashes, paths, and acceptance values. When the ignored local dataset is present, it also reparses the five logical assets (ten files), recomputes their hashes, and requires byte-derived output to match the committed artifact. CI succeeds without the raw dataset.

## Known limitations

- No bulk harvest or all-entity scan.
- No semantic mapping or runtime catalog promotion.
- No effective inherited gameplay-value resolution.
- No executable or native-code parsing.
- The dataset version remains claimed, not independently verified.
- Only the targeted legacy version -7 package subset is supported.
