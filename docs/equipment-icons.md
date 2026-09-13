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

At game version 1.17.0.0, the local dataset maps and exports 269 of 271 catalog entries. A second full-index search found no `CuriousArmor`, Ender Armor, preview, inventory-icon, or shared-atlas candidate. For Vanguard Armor (`DesertArmor`), the only related image is the Skeleton Vanguard enemy body texture; it is not an equipment inventory icon. Both entries retain the category fallback, with the findings recorded in the manifest.

The same command also exports the game UI's Soul marker and the selected category glyphs to `public/assets/ui/`. Their exact source assets, hashes, and extraction state are recorded in `generated/ui-icons/manifest.json`; `icons:audit` validates both manifests without requiring local game data.

## UI integration

`EquipmentCatalogEntry.icon` is populated from the generated manifest. `EquipmentArtwork` is the single renderer shared by compact/list/grid Inventory views, the Visual Equipment Picker, selection confirmation and detail, Statistics, and the Data Browser. It fixes intrinsic dimensions, decodes asynchronously, lazily loads list images, and raises only immediately visible or selected artwork to eager/high priority. Load failures and missing entries keep the existing category glyph fallback. `SoulMarker` and `EquipmentCategoryIcon` use the extracted game UI textures with equivalent in-component fallbacks.

The category UI sources are appearance-verified rather than selected from filenames alone. Melee and ranged retain the Inventory filter textures. Artifact uses the Inventory `filter_consume` potion glyph instead of the key-shaped `filter_item`. The extracted 1.17.0.0 Inventory armor filters and slot textures depict helmets or armor silhouettes rather than a shield, so the armor category uses the game's shield-shaped UI marker (`MissionSelectMap/marker/shield_dungeon`) without drawing a replacement asset. UI-only regeneration is available through `npm run icons:ui`; it intentionally avoids rerunning equipment matching or the documented Ender Armor and Vanguard Armor fallback research.
