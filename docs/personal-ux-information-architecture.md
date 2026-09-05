# Personal UX information architecture

## Decision

Phase 3.5では、従来の単一画面に混在していた編集・計算・参照・保存を次の責務へ分離する。見た目より先に、本人が日常的に使う順序と情報の段階を優先する。

| Top level | Question | Responsibility |
| --- | --- | --- |
| 装備 | 自分は何を持っているか | 所持品の追加、compact一覧、個体編集、所持品summary |
| 最適化 | その中から何を使えばよいか | preset、詳細Scenario、Worker探索、Best Build、次点、詳細 |
| データ | ゲームには何があり、何を評価できるか | 母集団、runtime support、検索、status filter、Evidence |
| モデル | どう計算・評価するか | 全体フロー、Damage、Healing、Defense、Control、Evidence / 精度 |
| 保存・復元 | 手持ちをどう移行・復旧するか | localStorage状態、JSON v1/v2 import、v2 export、recovery |
| 変更履歴 | 何が変わったか | Phase単位の変更、About、GitHub |

## Routes

Hash routeを採用する。既存の単一Next routeと依存関係を保ったまま、reload、deep link、back / forwardへ対応するためである。

- `#/inventory`
- `#/optimize`
- `#/data`, `#/data/melee`, `#/data/armor`, `#/data/ranged`, `#/data/artifacts`, `#/data/enchantments`
- `#/model`, `#/model/damage`, `#/model/healing`, `#/model/defense`, `#/model/control`, `#/model/evidence`
- `#/storage`
- `#/changes`

旧`#optimizer`と`#methodology`は新routeへ読み替える。

## State ownership

`WorkspaceApp`がInventory、Scenario、optimizer Worker、保存・復旧draftを一度だけ所有する。route変更は同じowner内の表示を切り替えるため、Inventory stateと進行中の探索を複製・喪失しない。DataとModelはread-onlyで、計算状態を所有しない。Redux等の追加依存は導入しない。

## Progressive disclosure

- Inventoryは個体のsummaryを最初に表示し、Power、observed value、候補、lock、Gilded、削除を編集時だけ開く。
- Optimizationは目的presetと実行をprimaryにし、Scenarioの詳細入力を折りたたむ。
- ResultはBest Build、次点、Pareto / caveat、効果別詳細の順に表示する。
- Modelは全体フロー、各評価軸の基本式、詳細条件、limitations、Evidence / 実装詳細の順に表示する。

## Accessibility and responsive behavior

PCとmobileで同じnavigation groupを使う。`nav` landmark、`aria-current`、skip link、route変更後のmain focus、見出し階層、mobile menuの開閉状態を提供する。200% text拡大とreduced motionを考慮し、主操作の文字サイズは14px以上を基本とする。

## Preserved boundaries

Inventory schema、計算式、Worker、runtime support、unsupported候補の除外方針は変更しない。Research-onlyを0点候補として登録せず、Phase 2-5A/B/Cおよび既存Evidence blockerはpartialのまま保持する。Public Availabilityは本人の実利用後に判断するfuture milestoneとする。
