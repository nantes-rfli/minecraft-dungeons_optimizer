# Game Data Inventory — Phase 6.5A

## Overview

QuickBMSで展開済みのMinecraft Dungeons 1.17.0.0を、`QuickBMS 1.17.0.0`をsource labelとして棚卸しした。versionはdirectory labelに基づき、asset内部では検証していない。source root全体（`Dungeons/Content`、`Engine/Content`、その他）を走査し、134,806 files、5,645 directories（source root自身を含む）、4.42 GiBを確認した。

Phase 6.5Aはpath、filename、extension、sizeだけを読む軽量scanである。`.uasset` / `.uexp` / `.ubulk`の内部Property、Export、CDO、gameplay値、texture・audio・modelは解析していない。runtime catalog、Gap、Evidence confidence、Optimizer scoreも変更しない。

| Root | Directories with files | Files | Size | Blueprint-prefix files |
|---|---:|---:|---:|---:|
| `Dungeons/Content` | 5,423 | 131,145 | 4.30 GiB | 4,867 logical candidates |
| `Engine/Content` | 94 | 3,499 | 72.01 MiB | 0 logical candidates |

Engine側はgeneric Unreal Engine asset中心でDungeons固有mechanicsのprimary targetではない可能性が高い、という仮説に留める。候補の有無と規模は索引に残し、deep parse要否は後続Phaseで判断する。

Source fingerprint: `823acdedfa8a1533f5fe5e4106d7fd6a1613a977b4319e866b16d3236e00fda6`

Fingerprintは全fileの `normalized relative path + NUL + decimal size + LF` をpath順に連結し、SHA-256で計算する。raw bytes hashではない。

## Asset type overview

### Extensions

| Extension | Files |
|---|---:|
| `.uexp` | 49,394 |
| `.uasset` | 45,311 |
| `.png` | 30,320 |
| `.umap` | 4,083 |
| `.res` | 2,680 |
| `.tga` | 1,232 |
| `.ubulk` | 908 |
| `.json` | 462 |
| `.csv` | 90 |
| `.uplugin` | 58 |
| `.locres` | 57 |
| `.ini` | 51 |
| `.pdn` | 31 |
| `.py` | 19 |
| `.ufont` | 18 |
| `.txt` | 15 |
| `.ttf` | 12 |
| `.brk` | 9 |
| `[none]` | 7 |
| `.locmeta` | 5 |

### Filename prefixes

prefix分類はfilenameからのheuristicであり、asset classの確定ではない。

| Prefix | Heuristic meaning | Files |
|---|---|---:|
| `AnimBP_` | Animation Blueprint candidate | 340 |
| `AnimNS_` | Animation Notify State candidate | 102 |
| `BPI_` | Blueprint Interface candidate | 36 |
| `BP_` | Blueprint candidate | 9,266 |
| `MI_` | Material Instance candidate | 4,724 |
| `SM_` | Static Mesh candidate | 5,454 |
| `SK_` | Skeletal Mesh candidate | 1,164 |
| `PS_` | Particle/VFX candidate | 1,644 |
| `UMG_` | UI candidate | 2,538 |
| `M_` | Material candidate | 2,048 |
| `T_` | Texture candidate | 8,278 |
| `P_` | Particle/VFX candidate | 686 |

### Companion structure

同じdirectory・同じstemを1 logical assetとしてpairingする。

- `.uasset` logical assets: 45,311
- `.uasset + .uexp`: 45,311
- `.uasset + .uexp + .ubulk`: 908
- `.uasset only`: 0
- `.uasset + .ubulk` without `.uexp`: 0
- `.uexp` without matching `.uasset`: 4,083
- `.ubulk` without matching `.uasset`: 0

## Gameplay research map

| Primary asset area | Recursive files | Indexed logical assets |
|---|---:|---:|
| `Dungeons/Content/Actors/Equipment/Armor` | 1,124 | 562 |
| `Dungeons/Content/Actors/Equipment/MeleeWeapons` | 1,564 | 782 |
| `Dungeons/Content/Actors/Equipment/RangedWeapons` | 1,359 | 679 |
| `Dungeons/Content/Actors/Items` | 1,328 | 662 |
| `Dungeons/Content/Components/Enchantments` | 947 | 472 |
| `Dungeons/Content/Components/ArmorProperties` | 96 | 48 |
| `Dungeons/Content/DataTables` | 16 | 8 |

`game-data-asset-index.json`は全texture等の一覧ではなく、上記branch、DataTables、Blueprint系prefix、GameplayEffect名を優先したmechanics research索引である。category / entity / asset kindはpathとfilenameだけから安全な範囲で推定する。

## Interesting discoveries

既知の優先root外でresearch keywordに一致し、indexed candidateが多いbranch上位を示す。keyword一致はgameplay propertyの存在を意味しない。

| Candidate branch | Matched terms | Files | Uasset | Indexed assets |
|---|---|---:|---:|---:|
| `Dungeons/Content/Cues/Enchantments` | Enchant | 204 | 102 | 101 |
| `Dungeons/Content/Cues/Items` | Item | 170 | 85 | 85 |
| `Dungeons/Content/Actors/Characters/Friendlies/Pets` | Pet | 606 | 303 | 68 |
| `Dungeons/Content/Content_DLC3/Actors/Equipment` | Equipment | 514 | 257 | 59 |
| `Dungeons/Content/UI/StatusEffects` | Effect, Stat | 236 | 118 | 53 |
| `Dungeons/Content/UI/StatusEffects/GameplayEffect` | Effect, GameplayEffect, Stat | 206 | 103 | 53 |
| `Dungeons/Content/Content_DLC6/Actors/Equipment` | Equipment | 458 | 229 | 52 |
| `Dungeons/Content/Effects` | Effect | 2,059 | 1,010 | 51 |
| `Dungeons/Content/UI/StatusEffects/GameplayEffect/UIData` | Effect, GameplayEffect, Stat | 98 | 49 | 49 |
| `Dungeons/Content/Actors/Cosmetics/Pets` | Pet | 96 | 48 | 48 |
| `Dungeons/Content/Content_DLC5/Actors/Equipment` | Equipment | 332 | 166 | 46 |
| `Dungeons/Content/Content_DLC4/Actors/Equipment` | Equipment | 326 | 163 | 46 |
| `Dungeons/Content/Effects/Blueprints` | Effect | 162 | 81 | 39 |
| `Dungeons/Content/Content_DLC5/Actors/Items` | Item | 263 | 128 | 38 |
| `Dungeons/Content/Patch2/Actors/Equipment` | Equipment | 288 | 144 | 33 |
| `Dungeons/Content/Content_DLC4/Components/Enchantments` | Enchant | 144 | 72 | 30 |
| `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor` | Equipment, Armor | 226 | 113 | 24 |
| `Dungeons/Content/Content_DLC3/Actors/Items` | Item | 176 | 88 | 24 |
| `Dungeons/Content/Patch1/Actors/Equipment` | Equipment | 212 | 106 | 21 |
| `Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons` | Equipment, Weapon | 144 | 72 | 20 |

## Unknown / limitations

- path/nameだけではBlueprint class、inheritance、Property、numeric value、実際のgameplay semanticsは確定しない。
- game versionはfolder/source label由来で、binary内部のversion確認は未実施。
- native executable側にのみ存在するmechanicsはこのmapから発見できない可能性がある。
- missing/unpaired companionは欠損とは断定せず、packaging構造の観測値として扱う。
- Engine側は全体棚卸し済みだが、deep parse対象にするかは未決定。
- full file manifestとraw assetsは`local-game-data/`内だけに保存し、Gitへ含めない。

## Next step

Phase 6.5Bへsource boundary、version basis、fingerprint、raw data非再配布境界を引き渡す。Phase 6.5C以降はこの索引から代表assetとcompanionを選び、別の明示的な解析手順でbinary構造を調べる。Phase 6.5A単独ではruntime supportを昇格しない。
