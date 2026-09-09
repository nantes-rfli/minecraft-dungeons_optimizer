# Phase 6.9E — DR / Modifier comparison

2026-09-09。Damage Reduction動画の観測条件と、damage modifier分類の適用範囲を研究modelで比較した。runtimeへの組み込み・昇格、Gap closeは0。

## DRの観測境界

[2021年の検証動画](https://www.youtube.com/watch?v=CiD2YIL1nMY)の説明欄と文字起こし、および作者の[表投稿](https://www.reddit.com/r/MinecraftDungeons/comments/ptddv6/)を取得した。主datasetはMooshroomから受けたdamageを比較した作者単独の検証で、ゲーム版・難易度・Power・全装備・反復数・丸め段階は未回収。2024年の[式説明](https://www.reddit.com/r/MinecraftDungeons/comments/1bsib6o/)も同じ作者なので独立sourceではない。

研究modelは、35% Armor・Iron Hide・Ghost Cloak・Potion Barrierを`hero-armor-score`、Weakening・Gongを`enemy-debuff-score`、Guarding Strikeを別乗算として扱う。各score family内は `Σ r/(1-r)`、family間はdamage takenを乗算する。この限定規則で、2024年コメントの4例をfit側、2021年投稿の未使用6行をsame-origin holdout側に分けた。6行はraw damage比の残差0.0001未満、表示DRの残差0.05 percentage point以下で再現した。これは実装のdrift検査であり、独立したゲーム妥当性の検証ではない。

動画はGhost Cloak＋Guarding StrikeでGhost側が33.3%相当へ低下すると説明する一方、後年コメントはGuarding Strikeをarmor family外の完全な別乗算と説明する。この競合はversion差・条件差を解けないため、研究modelでも該当stateを明示的にrejectする。Protectionは元datasetで未実測、Shulkerは敵数制御が必要として未測定、Armored VindicatorでWeakeningが約1%しか効かなかった単発outlierは再現条件不明のためfit・holdoutから除外した。

Weakeningは直接mob attackには適用するが、作者投稿が明示したElectrified・Burning・Fire Trailには適用しない。その他のdamage channelへ一般化しない。

## State、丸め、順位影響

uptimeは効果量へ先掛けせず、同時にactiveなjoint stateごとにdamage takenを計算してから期待値を取る。35% Armorが常時、Potion Barrierが50%で完全に重なる合成例では、state平均damage takenは約0.3724。`90% × 50%`を45% reductionとして先にfamilyへ入れると約0.4243になる。damage taken 0.4の比較候補を置くと順位が逆転する。marginal uptimeだけでは重複率が不明なので、実runtimeへこのstate modelを昇格しない。

raw観測は基準damage 396,591に対する整数damage比で比較し、表示値は投稿の小数桁に合わせて0.05 percentage pointを許容した。damage適用ごとの内部rounding、表示rounding、複数hitの分布は未確認。

## Modifierの適用範囲

[2021年の分類動画](https://www.youtube.com/watch?v=3adc9uaDUUo)は少なくとも次を分離している。

| bucket | 研究側の扱い |
| --- | --- |
| flat physical | 同bucket内で加算。ただしSharpnessの複数copyは自己乗算として別group |
| physical multiplier | direct physicalへ適用 |
| neutral indirect | physical buffを継承しない |
| elemental indirect |対応Focusだけを適用 |
| full target damage | 対象が受ける各eligible channelの後段 |
| explicit exception | Jungle Poison、Fireworks Arrowだけを名前付きで保持し一般化しない |

現runtimeのdirect scalarは独立乗算proxyであり、flat bucket規則と一致しない。Base 100、flat 33%+20%、physical multiplier 40%の合成probeではtaxonomy 214.2、factorized proxy 223.44。比較候補220との順位が逆転するため、分類差は説明だけでなくOptimizer順位へ影響し得る。

Dynamoは2021説明欄ではphysical buffを受けないindirect側だが、2026投稿の式ではadditive bucket内の`Base × Multiplicative + Dynamo`に置かれる。同じBase 100、additive 33%、Dynamo 100なら前者233、後者266となる。version、近接/遠距離、glitch、語義の差が未解決なので統合しない。

## 再現と残課題

`npm run generate:dr-modifier-comparison`で[machine-readable比較](../research/external-community/dr-modifier-comparison.json)を再生成し、`npm run audit:dr-modifier-comparison`でholdout、競合reject、channel範囲、state平均、Dynamo分岐、順位逆転、artifact driftを監査する。`tests/drModifierComparison.test.ts`は異常系を含む同じ境界を検証する。

6.9Eの対象限定family規則、state計算、same-origin holdout、競合解決、丸め・単位・activation範囲、順位影響の説明は完了。独立holdout、game version、rounding stage、joint uptime分布、Dynamo配置はblockerとして残す。次は6.9F Scenario / Optimizer比較であり、未知値を0や倍率1として登録しない。
