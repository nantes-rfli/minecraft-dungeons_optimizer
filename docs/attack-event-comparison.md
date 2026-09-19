# Phase 6.9D — Attack/Event comparison

2026-09-09。4 runtime武器とClaymore・Sawbladeの研究profileを比較した。runtimeへの組み込み・昇格、Gap closeは0。

## 比較境界

`aggregate-rate`、`event-sequence`、`attack-definition`を別型にした。HPS表は1秒当たりの集計値で、hit時刻・action・finisher・releaseを含まないためevent列へ展開しない。game assetのvariant duration、damage delay、continuous interval、loop、enchantment triggerは攻撃設定であり、nativeのplayback、speed scaling、cooldown、cancel、notify cardinalityが未確認なので実効event列へ変換しない。runtime 4 profileだけは既存duration列から、従来計算と一致する研究用event sequenceを作る。

| profile | 外部表 | game asset | mapping | 比較 |
|---|---|---|---|---|
| Anchor | Anchor | Anchor | exact | runtime 0.4 / 外部0.42 HPS |
| Double Axe | Double Axe/Cursed Axe | DoubleAxe | family row | 1.666667 / 1.6 |
| Fighters Bindings | Fighters Bindings | Gauntlets_Unique3 | provisional（Step 3B assertion） | 6.956522 / 6.8 |
| Soul Scythe | Soul Scythe/Frost Scythe/Jailor's Scythe | SoulScythe | family row | 1.923077 / 1.8 |
| Claymore | Claymore/Great Axeblade/Heartstealer | Claymore | family row | playback rule未確認のためrate比較不可 |
| Sawblade | Broken/Mechanized Sawblade | Chainsword | family row + metric split | proc 4/sとdamage hit 6/sを別観測として保持 |

外部base HPSはruntime profileのfitに使われていない観測として比較し、差はAnchor +5%、Double Axe −4%、Fighters Bindings −2.25%、Soul Scythe −6.4%。一致判定や採用判定には使わない。表の25% Armor、Death-cap、両方の列は名称だけを保持し、装備、入力、対象、rounding、測定手順、game versionが未回収なので条件を推定しない。

## 再現と残課題

`npm run generate:attack-event-comparison`で[machine-readable比較](../research/external-community/attack-event-comparison.json)を再生成し、`npm run audit:attack-event-comparison`で6 mapping、既存4 rate、Sawbladeのmetric分離、artifact driftを監査する。`tests/attackEventComparison.test.ts`はaggregate/sequence/definition境界と異常系を検証する。

6.9Dの通過条件であるentity/条件照合、集計rateとevent列の区別、未使用観測との比較は満たした。外部game version・測定法、buff条件、設定→実効eventのplayback rule、独立event-sequence holdoutはblockerとして残す。次は6.9EのDR/modifier比較であり、これらの未知値を0や倍率1としてOptimizerへ登録しない。

Step 3BでFighter’s Bindingsのidentity判断を[temporary Domain assertion](../src/domain/temporary/fightersBindingsIdentity.ts)へ集約した。旧exact判定には名前への正式なbridgeがなく、aliasはunresolved、icon ordinal heuristicには矛盾があるため暫定比較として保持する。
