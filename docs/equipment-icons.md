# Equipment icon extraction

The equipment artwork checked into `public/assets/equipment/` is derived from the local Minecraft Dungeons 1.17.0.0 game data. The pipeline publishes only the small inventory-identification images used by the application; `.pak`, `.uasset`, `.uexp`, raw exports, and intermediate PNG files remain local and ignored by Git.

## Commands

```bash
npm run icons:discover
npm run icons:extract
npm run icons:convert
npm run icons:audit
npm run icons:all
```

`icons:all` is the normal entry point. It discovers every `*_Icon_inventory` Texture2D, maps the complete equipment catalog, decodes the cooked inventory mip, writes intermediate PNG files below `.local/generated-icons/png/`, produces lossless WebP files no larger than 128×128, validates the result, and rewrites `generated/equipment-icons/manifest.json` deterministically.

The default source is `local-game-data/QuickBMS 1.17.0.0`. Set `MCD_GAME_DATA_ROOT` to an equivalent extracted game-data root when the data lives elsewhere:

```bash
MCD_GAME_DATA_ROOT=/absolute/path/to/extracted/game npm run icons:all
```

Normal application builds and tests do not run extraction and do not require local game data.

## Matching policy

The catalog is the source of truth. Matching evidence is applied in this order:

1. catalog-provided internal IDs (currently the armor audit),
2. a small documented alias table for exceptional public/internal names,
3. names found in the candidate asset and sibling Texture/Material/Mesh assets,
4. family base assets,
5. event variants and numbered unique variants within the same family.

The pipeline never selects one candidate when the evidence remains ambiguous. Such entries are emitted as `multiple-candidates`; missing assets are emitted as `not-found`. Successful entries remain usable even when another entry fails.

## Manifest and validation

Every catalog ID has exactly one manifest entry with one of `matched`, `multiple-candidates`, `not-found`, `export-failed`, `convert-failed`, or `invalid-output`.

Matched files are checked for successful decoding, non-zero dimensions and size, a maximum size of 128×128, preserved alpha, and non-fully-transparent content. SHA-256 hashes make accidental duplicate assignments visible in the audit output without rejecting intentional shared artwork.

At game version 1.17.0.0, the local dataset maps and exports 269 of 271 catalog entries. `Ender Armor` (`CuriousArmor`) and `Vanguard Armor` (`DesertArmor`) have no corresponding inventory-icon Texture2D in the extracted data and intentionally retain the category fallback.

## UI integration

`EquipmentCatalogEntry.icon` is populated from the generated manifest. `EquipmentArtwork` is the single renderer shared by the Inventory Grid, Visual Equipment Picker, and Selected Equipment Detail. Entries without a matched icon keep the existing category glyph fallback.
