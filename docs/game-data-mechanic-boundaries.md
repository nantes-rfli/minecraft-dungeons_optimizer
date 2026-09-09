# 攻撃設定の適用経路とnative解析の到達点 — Phase 6.8D/E

調査日: 2026-09-08。[前回の攻撃タイミング調査](./game-data-timing.md)を受け、通常攻撃・連続攻撃・キャンセルの適用処理を探索した。アプリコード・runtimeデータは変更していない。

## 今回の判断

**設定の取得は進んだが、設定から実効ヒット間隔を導く根拠はまだ不足している。** 一方、exeの最初の圧縮層を実行せず復元でき、native調査は「高entropyで読めない」から一段進んだ。ただしゲーム本体の計算コードを復元したわけではない。

| 対象 | 確認できたこと | 未確定 |
|---|---|---|
| Claymore | 攻撃variant→animation、native親 | duration/delay/CDの起算点・速度補正 |
| Chainsword | Stretch→Active/Break GameplayEffect、Cueタグ、Infinite設定 | tick数、入力解放との前後関係、エンチャント適用対象 |
| Anchor | キャンセル上書きとnative親 | CancelPointOverrideの単位、受付・中断・次攻撃の条件 |
| exe | 最初の圧縮層を2実装で同じ15,360,000 byteへ展開 | 次段階の処理、ゲームコード・名前・関数の対応 |

## 時間設定の「使用箇所」を探した結果

ローカル全uassetを6語（DamageDelaySeconds、AttackAnimationTimeDurationSeconds、CooldownSeconds、CancelPointOverride、ContinuousDamageInterval、bTriggerEnchantmentsOnRelease）でASCII検索し、201アセットを選んだ。UAssetAPI 1.1.0 / UE4_22で全201件のバイナリ往復一致、711 FunctionのAST取得を確認した。

ASTのproperty pointer / StackNode参照をpackage・object名へ解決し、対象語との一致を調べた。部分一致はUIの6関数だけで、GetCooldownSecondsDuration/Remainingの戻り値変数だった。対象6propertyそのものへの明示的参照と同名の文字列値は今回のASTでは見つからなかった。

これは**選択集合・名前・読めた命令形式に限った結果**。別名、引数として受け取る値、struct全体の受け渡し、nativeコード、別のファイル種別を網羅していない。Blueprintに処理が絶対に存在しないという結論ではない。敵やUIにも似た設定・関数があるので、候補件数をプレイヤー武器の対応数へ加算しない。

## ChainswordのEffect参照を解決

通常版とUnique1のStretchは、それぞれVariantActiveEffectがActive GameplayEffect、VariantChangeEffectがBreak GameplayEffectを参照する。Forehandの両参照はnull。

4つのEffectを追加読取し、いずれも親は`/Script/GameplayAbilities.GameplayEffect`、明示的なDurationPolicyはInfinite、bExecutePeriodicEffectOnApplicationはfalse。GameplayCuesには通常版のChainSword.Active/Break、Unique1のChainswordUnique1.Active/Breakのタグがある。PersistAfterDeathタグも保存されている。

**InfiniteはこのEffectのduration policyであり、チェーンソードを無限に回せる意味ではない。** Effectの除去、ループ終了、CooldownSecondsの適用は別経路の確認が必要。今回読んだCDOにperiodic damage式はなく、Cueタグの存在もtick発生の根拠にはしない。

4つのEffectを含む今回205アセットは全件往復一致。410入力ファイルも旧抽出物と追加PAKで一致。前回との重複があるため累積coverageへ単純加算しない。

## native: 最初の静的展開に成功

exeを起動せず、macOSのllvm-objdumpで入口を確認した。`.boot`入口にはbit列・gamma長・後方コピーを使う展開処理がある。静的に追った入力はRVA `0x5a5e22c`、出力は`.dungeon`のRVA `0x4bb8000`。命令にある分岐・距離補正は[aPLib decoderの実装](https://github.com/snemes/aplib/blob/master/src/aplib.py)とも対応する。

境界付きの調査用decoderで入力8,937,075 byteを消費して15,360,000 byteを生成した。出力長は`.dungeon`のVirtualSizeと一致。さらに別実装のaPLib decoderでも入力消費量と出力全体が一致した。独立decoderはローカル専用、GPL-3.0のライセンスを同じ場所に保存し、アプリ依存・Git配布物には含めていない。

- 元exe SHA-256: `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`
- 展開結果 SHA-256: `d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b`
- 次段階の入口: `.dungeon + 0x2c495f`

次段階では直接jump/callとstack操作を確認したが、そこからゲーム計算の入口を特定していない。展開結果内でもMeleeAttackComponent、DamageDelaySeconds、CriticalHit、ChainSword、ContinuousDamageIntervalのASCII/UTF-16検索は一致しなかった。これら5語の不一致だけで全ゲーム情報の不存在とは判定しない。

元exeのPrintScriptCallstack位置をそのまま逆アセンブルすると未知命令等が混ざり、現在の格納bytesを通常の関数として採用する根拠はない。ZIP内に.pdb/.map/.symファイルもなかった。前回のPDB名は参照情報だけである。

展開したsectionを置いたPEはobjdump用の検査容器としてローカルに作成した。実行可能なゲームの復元物ではなく、元exeを上書きしていない。**exe/DLLの起動、展開コードの実行、プロセスメモリの取得はしていない。** 純粋なデータ展開の一致は、配布元の真正性や戦闘式の正しさを保証しない。

## 次に必要な実測を具体化

以下は未実施の検証計画。実測値を捏造せず、設定値とも混ぜない。ゲーム版・武器・Power・装備・速度補正・入力条件・録画fpsを記録し、対象や距離を固定する。時間は可能なら60 fps以上の映像でイベントのフレームを記録し、誤差とばらつきを残す。

| ケース | 比較条件 | 記録するイベント | 識別したい仮説 |
|---|---|---|---|
| Claymore通常コンボ | 速度補正なし、連続入力。完走コンボを10回 | 入力開始、各hit、次コンボ最初のhit | animation長・攻撃duration・CDのどれが次hit間隔を規定するか |
| Claymore速度補正 | 同じ条件に既知の速度補正を1つだけ追加 | 同上。効果の開始/終了も記録 | delayとCDも同倍率か、固定成分が残るか |
| Chainsword | Stretch中の短い保持・長い保持・途中解放を各10回 | 全damage tick、解放、Break表示、次攻撃受付 | 即時tick、間隔、上限、解放後tick、回復時間 |
| Chainsword発動契機 | 観測可能なエンチャントを1種類ずつ。まず観測手段を選定 | tickと効果発生を別列で記録 | after-damageとreleaseの設定がどの効果に適用されるか |
| Anchorキャンセル | 入力開始から異なる時点でroll等を試行、成功境界付近を反復 | 要求フレーム、実際の動作開始、hit有無、次攻撃 | 設定0.9の単位と受付条件、hit前後の中断可否 |

10回は探索の初期サンプル数であり確率効果の検証には不十分。録画だけで入力時刻を取れない場合は入力記録を別に用意し、推測で埋めない。画面のdamage数字が複数hitをまとめる場合も、hit数確定には別の観測方法が必要。

## Phaseの判断と再設計への引き継ぎ

6.8Dは最初の圧縮層の静的復元まで進行、戦闘式は未復元。6.8Eは設定・参照・適用候補の調査まで進行、実効時間との接続は未完了。

次段階のnative処理には追加の制御フロー解析が必要。単に文字列検索を繰り返す段階は終え、続ける場合は「元ゲームのコード領域の復元と検証」を独立した到達条件にする。特定の保護製品名や完全な展開成功を宣言しない。

**Phase 6.9の設計案は、この未確定境界を明示すれば着手できる。** 最初の比較対象はClaymore・Chainsword・Anchor。設定を表すAttackDefinitionと実効hit列を分離し、効果の発動契機、入力状態、出典hash、未確認のnative規則を表現する。未検証規則からOptimizerのスコアを生成しない。今回は設計・実装の置換はしていない。

[観測と再現資料](../research/game-data-mechanics/README.md)に保存。アプリコードが同じため前回のaudit・1,435テスト・lint・build成功結果を再利用し、今回の入力hash・往復・展開結果は別に検証した。内部調査のみでSites更新は不要。

2026-09-09追記：この静的展開の続きは[CPUエミュレーションによる起動処理の追跡](./game-data-native-stage2.md)に保存した。後続調査はゲスト命令をエミュレートしており、本資料の「実行せず」という記述は最初の静的展開に限る。ゲーム本体のコード・戦闘式は引き続き未確認。
