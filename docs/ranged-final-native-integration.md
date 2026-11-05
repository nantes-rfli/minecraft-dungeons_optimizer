# Ranged conditional final damage — Native integration

基準はmain `bd9249efcebc78934e69fd1ebfe43e5adc7390c3`（PR #220 merge後）。**5武器9モードの条件付き単発custom magnitudeを計算するDomain API・CLIを追加した。Optimizerで新しく自動評価できる装備0・効果0、削減したruntime入力0。** 新しい式をDPSへ採用するR3/P3B gateは満たしていない。既存の観測型Limited 6装備と全カテゴリのruntimeは維持する。

## 独立検証とsource接続

[Astra成果](../research/native/ranged-final-20261101/REPORT.md)と検証コード・結果を元の[10ファイルmanifest](../research/native/ranged-final-20261101/manifest.json)ごと改変せず保存した。[別担当の独立検証](../research/native/ranged-final-20261101/independent-research-review.json)は、private exe/image/SDK CRT 2 DLL、43 Native区間・7 pointerを照合し、Native **2,467**・実CPU **538**ケースを再実行。不一致0、[結果](../research/native/ranged-final-20261101/integration-replay.json)は元成果と全フィールド・SHA-256一致。Watchdogは正常終了・強制killなし・cleanup完了。

#220も独立再検証し、23 packages・46 source files・255 decoded leavesのsource hash/Raw valueRange bytes、13 Blueprint bodies、4,158限定再生が一致した。既存の[基準値モデル](../research/domain/ranged-native-model.json)は不変。このモデルのFormal Identity / configured Value・Serialized Relationへの接続と、元Raw位置・source hashを再利用する。[最終値モデル](../research/domain/ranged-final-native-model.json)はそれを参照するNative-derived表現であり、Raw観測値・Formal Valueを捏造しない。公開auditが両モデルと根拠を照合する。

追加静的照合では一般倍率 `0x7af061` → Deal `0x7af0cf` → difficulty `0x7af81a` → Q/ranged/takeRange `0x7b044b/4f/54` の順を確認。一般・難易度の積は静的命令と有理数モデルであり、元suiteの追加custom再生は加算/takeと末尾3積の2区間。全capture/engine chainの実行とは呼ばない。saveはtag=3合成doubleの104件×6区間で、復号・decimal parser・実個体選択の検証ではない。

同じNative/DLLを別backend・別担当で再生した結果は、実ゲームの独立holdoutではない。公式配布物の真正性、Raw/exe同一build、実ゲームが解決するDLL・MXCSR・全capture writerは未確認。Shield/Barrier・拒否・player分岐は静的確認、HealthThresholdは268局所再生であり、実対象のHPイベント全体を閉じていない。

## 計算と入力契約

`F`は各命令でのbinary32 nearest/ties-even。次を並べ替えない。

```text
x = internal float32 ItemPower
q = F(F(x - 1) / bits(4127b7b8))
e = F(clamp(q, 0, 3) * 19)
y = pinned_ucrt_powf(1.25f, e)
t = max(F(F(.75 * y) - .75), 0)
M = F(F(t + t) + 1)
m = F(0 + F(1 * F(0 + M)))
ms = F(F(1 * F(m - 1)) + 1)
mc = F(F(1 + ms) - 1)
Q = F(F(F(0 + 1) * mc) / 1)
v0 = F(F(-I + -H) * TakeDamageMultiplier)
v1 = F(F(v0 * DamageMultiplier) * DealDamageMul)
v2 = F(v1 * DifficultyDealDamageMultiplier)
V = F(F(F(Q * v2) * RangedAttackDamageMultipler) * TakeRangeDamageMultiplier)
```

`H`はPower前基準値に一致することを明示した通常単発矢・陸上・G=1・イベント変更なしの場合のみ既存Raw/Native基準値から作る。IはRangedAttackDamageIncrease。Power=5でM=`40e20739`、Q=`40e20738`になるためMをそのまま掛けない。Shortbow charged=`61.874996185302734`、Longbow uncharged=`60.000003814697266`を丸め直さない。Bow/Shortbow/Longbow/Power Bow各2モード、Heavy Crossbow singleの9モードが研究計算対象。Power Bow unchargedの研究計算はruntime対応モード追加ではない。

参照環境はSDK CPP 10.0.22621.1のucrtbase SHA-256 `fbed69a52fdcf571dd37fe4cc63cb86ed3732b5b998807f14968788027c00754`、SSE2 dispatch=0、MXCSR=`0x1f80`。Power effectはqualified modifier1・stack1・channel1・base1・custom既定設定を明示する。これ以外を黙って同じQにしない。公開APIは元再生の269行にある**完全一致bits**だけ参照し、近傍補間やhost powを使わない。有限normal/0の非負入力、Power 0〜40、normal/0の中間結果に限定。範囲外はunknownまたはCLI検証エラー。

| 入力 | 通常装備情報から得られるか | この実装の扱い |
| --- | --- | --- |
| Canonical ID・Raw基準値・chargeモード | ID/基準値は5武器でsource-backed、モードは明示 | DomainからHを生成 |
| 内部Power bits | 既存Inventoryの表示powerLevelには含まれない | bitsまたは解析済みsave doubleと個体取得元メモを必須。表示Powerから逆算しない |
| CRT/dispatch/MXCSR | 装備から取得不可 | 参照環境IDを明示。実環境同一性は主張しない |
| Iと6倍率 | 装備/buff/難易度/対象属性の全writer未網羅 | 7属性をすべて明示、float32値で入力。欠損を0/1で補わない |
| Qのmodifier/stack/channel状態 | 装備だけでは不足 | 限定契約を明示、それ以外unsupported |
| water/特殊矢/Growing/イベント | 装備だけでは不足 | 条件契約外はunknown |
| 対象受理・tag map・Shield/Barrier・HP/閾値・active effects等 | 対象/戦闘状態が必要 | HP減少量はunknown。中立と仮定しない |
| 完全発射周期・矢数・時間割合 | 発射周期の自動化は今回対象外 | 既存runtimeの観測・明示入力を維持 |

Capture名・source/target・snapshot・初期化RVAはmodelの8件に保存。`DealDamageMul`と`RangedAttackDamageMultipler`はNativeの綴り。snapshot=trueを発射瞬間のcaptureと断定しない。

Vは負のHealth custom magnitudeであり、正の値 `-V`も実敵のHP差ではない。受理拒否、tag積、ShieldからBarrierへの振替、Health aggregator/threshold、イベント等が後続する。`hpLoss`と`combatDps`は常にreason付きunknown。これらを装備だけから計算できたと数えない。

## 利用方法

公開ファイルだけで、記録済みPowerに対する明示条件を再現できる。

```sh
npm run calculate:ranged-native -- research/native/ranged-final-20261101/conditional-input.example.json
```

例は**合成入力**で、実saveの観測ではない。parsed-save-double=10.9→`412e6666`、Bow charged H=125→positive custom magnitude=`10217.6025390625`。隣の内部bits `412e6667`なら`10217.6064453125`。必須条件や属性を除くとunknown、CLI exit 2。`calculateConditionalRanged`で同じDomain APIを利用できる。

表にない正確な内部Powerには、既存private image・参照DLLをhash照合して実行する限定CLIも実装した。新たなWindows起動・Switch実測・save抽出は不要。

```sh
python3 -B research/native/scripts/calculate_ranged_final.py \
  --input /path/to/explicit-input.json \
  --local-root /path/to/private/local-game-data \
  --crt-root /path/to/private/crt-sdk \
  --output /tmp/new-conditional-result.json
```

Powerとstack/channelは本物の命令で実行。custom magnitudeは有理数binary32計算モデル。各Native呼出し10,000命令/100ms、外側Watchdog10秒。新規出力だけを許可し、request/script/image/CRT hashとFP設定を記録する。private payloadと実saveはGitに含めない。元269行を全float入力の精度証明に拡張しない。

## Optimizer接続・昇格保留

`rangedNativeReadiness`はOwnedRangedWeaponと別途明示した条件を照合して計算可能性・不足入力・adoption blockerを返す。表示Powerを計算入力に渡さず、instanceId・Canonical武器ID・shot modeの不一致も拒否する（callerの個体指定は実save照合の証明ではない）。参照値が計算できてもruntimeEligible=falseで、DPS用ダメージを返すadapterを公開しない。evaluate/optimizeは従来のobservationのみを使う。

この新式は既存Limited mechanic reuseではない。必要なのはexact-domainのR3 accepted AdoptionDecision、実証された適用条件と値、独立Product regression、P3Bのruntime/support/explanation/coverage/regressionの5 hash成果物。現時点でこれらは存在しない。単に「参照環境・中立条件」と宣言してacceptedを作らず、Promotion件数1/0/0を維持する。独立コードレビューはゲームEvidenceの代わりにはならない。

最小の次Work Unitは、既存Raw/Nativeからbare Bowに限定した7属性writerのsource-backed入力解決と、既に解析済みsave recordから個体とpowerを結ぶadapterの検証。前者・合成parser fixtureはMacの既存資料だけで進められる。実個体の正確性だけは既存save一件が得られた時に照合し、未取得なら保留する。新規Switch抽出を必須にしない。実ゲーム一致の採用にはactual provider/FP状態・適用範囲のEvidenceも別途必要。

## 検証と運用

117元例、128非中立属性fixture、104 save数値変換、Power集約ULP、隣接Power、未知条件拒否・既知0・既存観測runtime維持をテストする。Native auditから公開のsource hash/再生結果/Domain接続チェックを呼び出す。関連Ranged/Native/Formal/Evidence/Promotion auditと限定テストをローカルで実施し、Full ValidateはPR headのGitHub CIで一度実行する。

PRは未mergeのまま提出。Siteは更新しない。merge後に変更が配信へ影響する場合のみ、既存project・本人限定アクセスを維持する運用に従う。rollbackは当PRのrevertで、Inventory schema変更や観測データ移行は不要。

## 後続の入力接続調査

7属性の初期値とsave snapshot単位のPower adapterは[後続Work Unit](ranged-save-attribute-readiness.md)を参照。実効値は0/7のままunknown、実save未検証、runtime入力削減・計算可能装備増加は0。次は同じ研究の反復を保留し、既存Inventoryの評価不能理由・不足入力の解消導線を優先する。
