# ゲームデータからの再構成可能性 — Phase 6.7

調査日: 2026-09-07。対象ソース: `1ba581e7e7f34fda5948e49b513bba7e9476095b`。

## 結論

**ゲームデータを起点に、データ構造とモデルを見直すことは現実的。ただし、抽出済みデータだけでOptimizerの全計算を再構成できる証拠はない。**

今回、既存の意味付けルールを外した走査で、防具特性の倍率・確率、エンチャントの時間・段階別上限など、従来の保存対象を超える情報を確認した。Blueprint関数本体も存在し、一部の処理を読める。ただし調べた関数には演出・初期化・空に近い処理があり、重要効果の親クラスには `/Script/Dungeons` への参照がある。そのネイティブ実装は現在の抽出ツリーに含まれる実行ファイルからは調べられない。

したがって、Phase 6.6の「次は実測Quest、深い走査はoptional」という推薦を、そのまま今後の唯一の方針にはしない。**先にPhase 6.8で取得器・継承・処理経路を検証し、Phase 6.9で再設計範囲を決める。** 実測は必要だが、既存Gapをすべて実測へ送る前に、ゲームデータから解決できる項目を再分類する。

アプリ、既存parser、runtimeデータ、score、support、既存Gap成果物は変更していない。今回の結果は取得能力の観測であり、正式な数値採用やGapのcloseではない。

## Phaseと完了条件

| Phase | 目的・完了条件 | 今回の状態 |
|---|---|---|
| 6.7A ソース全体の棚卸し | 全ファイル種別、全uassetのpackage table、関数・表・カーブの分布、実行ファイルの有無を記録 | 完了。umap内部と元pakの完全性は対象外 |
| 6.7B 代表的な取得能力の試験 | 既存ルールに依存しない数値、非CDO表、関数本体、native境界を実物で確認し失敗も保存 | 完了。20アセットの深掘りと24アセット25数値の観測。全効果の解読を意味しない |
| 6.7C Optimizerへの対応と判断 | 必要情報をカテゴリ単位で対応付け、取得済み・要解析・外部入力を分離し次のgateを定義 | 完了。本資料と観測JSON |
| 6.8 取得と意味の検証 | 下記優先課題を独立したreader/検証手順で確認し、実効値・呼出経路まで根拠を連結 | 進行中。2026-09-08に代表検証を実施。[6.8の結果](./game-data-validation.md)を参照。探索用probeは本番parserではない |
| 6.9 再設計判断 | 代表ケースで旧モデルと新しい事実表現を比較し、維持・修正・置換を決定 | 未着手。全面書き直しは未決定 |
| 7〜9 既存の実測・検証・runtime昇格 | 6.8/6.9の結果に応じて必要な観測だけを引き継ぐ | 既存計画を保持。今回の調査で実装・完了扱いにしない |

Phase 6.5/6.6の成果物は当時のルールでの結果として保持する。歴史的な数値を書き換えず、今回の結論で今後の順序を更新する。サイト内のロードマップ表示はアプリコード未変更のため従来のまま。

## 実際に確認した範囲

| 観測 | 結果 | 意味する範囲 |
|---|---:|---|
| ファイル | 134,806 | 既存inventoryと同じ件数 |
| uassetのpackage table走査 | 45,311 / 45,311 | 既存readerのsummary/import/export取得が例外なく返った。全propertyの成功率ではない |
| umap | 4,083 | ファイル数のみ。レベル内オブジェクトは未走査 |
| Function export | 22,603、3,367アセット | 関数があることをclass indexで確認。すべて戦闘計算ではない |
| BlueprintGeneratedClass export | 7,542 | その他の生成クラス種別を含む総Blueprint数ではない |
| DataTable export | 24 | 名前のDataTable検索でなくexport classから集計 |
| CurveFloat / CurveVector export | 742 / 32 | 演出用・内部オブジェクトも含む。Power曲線の発見数ではない |
| AnimSequence export | 1,186 | notify・実効攻撃間隔の復元は未完了 |
| 関数の候補レイアウト整合 | 22,540 / 22,603 | 長さ・終端などの探索的検査。完全逆コンパイルではない |
| 関数レイアウト例外 | 63 | 未対応として全件保存。破損と断定しない |
| exe / dll / pdb / so / dylib / pak | 該当拡張子0 | このツリー内のみ。元のインストール先は調べていない |

package走査では、CDO（クラス初期値）を持つ場合は既存のtolerant readerを使う。property診断は残るため、上表の45,311を「ゲームデータを100%解読した」と読んではいけない。既存bulkの1,018/1,026とは対象・成功条件が異なる。

`Dungeons/Config/DefaultGame.ini:8` に **`ProjectVersion=1.17.0.0`** を確認した。従来のフォルダ名だけの根拠に、プロジェクト設定の裏付けが加わった。ただし元配布物との一致、混在の有無、実行バイナリの版は未検証。**1.17.0.0をQuickBMS自体のツールバージョンとは確定しない。** QuickBMSの実バージョン、BMSスクリプト、展開コマンドは依然不明。

## 既存の方法で見落とし得る理由

既存 `src/research/ue4/packageReader.ts` の `parseUePackage()` は、export table全体を取得する一方、property本文は名前が `Default__` のexportに絞る。通常オブジェクト、DataTable行、UFunctionのscript本体は、その処理では読まない。

さらにPhase 6.5Fの報告は、19,905 parsed propertiesに対して891 retained facts（うち61は構造的観測）、意味付けルール10本という境界を明記している。**17 Gapしか閉じなかったという結果は、この保存・解釈・close条件の実績であって、ゲームファイルの情報量の上限ではない。**

今回見つかった情報を、そのまま25個の「新しい正解」や25 Gap解消と数えない。既存Web情報と同じ値でも、根拠が増えたことと、新仕様を確定できたことは分ける。

## 静的データの具体例

以下は書き込まれているoverrideの観測。丸めた表示を併記するが、JSONには元のfloatとproperty byte range、export位置、uasset/uexp SHA-256を保存した。

| アセット末尾 | property | 観測値（読みやすく丸めた表示） | まだ必要な確認 |
|---|---|---:|---|
| ArmorProperties/MeleeDamageBoost/BP_MeleeDamageBoost | Multiplier | 1.3 | 装備への付与元、加算/乗算グループ、適用ダメージ種別 |
| ArmorProperties/ItemDamageBoost/BP_ItemDamageBoost | Multiplier | 1.5 | どのartifact damageへ適用するか |
| ArmorProperties/MissChance/BP_MissChance | Chance | 0.3 | 判定単位、除外攻撃、確率の組合せ |
| Enchantments/Weakening/BP_Weakening | Duration | 5 | 時間単位の呼出側確認、更新規則、実際の被覆率 |
| Enchantments/JunglePoisonMelee/BP_JunglePoisonMelee | DamagePercentage / Duration | 0.2 / 5 | 基準ダメージ、tick分配、重複、所有者 |
| DLC4/Enchantments/FireFocus/BP_FireFocus | DamageIncreasePerLevel | 0.25 | levelの意味、他補正との合成 |
| DLC4/Enchantments/ArtifactCharge/BP_ArtifactChargeGameplayEffect* | StackLimitCount | 1 / 2 / 3 | 各段階への参照、消費条件、overflow |

省略した完全パスと全25数値は [static-observations.json](../research/game-data-capabilities/static-observations.json)。これはcanonical registryへの登録ではない。

### 初期値以外の表とカーブ

既存reader部品を使い、DataTableの通常exportのproperty終端、GUID有無、行数、行名、各行のtagged propertiesを追う試験を行った。

- Cosmetics: 198行、Skins: 83行、PreloadedStorableItems: 2行、EndlessStruggle: 18行。いずれも宣言行数まで到達しexport残り0 byte。
- Cosmetics/SkinsのTextPropertyは未対応診断あり。行末まで到達したことは全フィールドの意味解読を保証しない。
- EndlessStruggleにはMobMaxHealthMultiplier、MobDamageMultiplier、MobSpeedMultiplier、PlayerReceiveHealingMultiplier等の行と、MinValue、MaxValue、IntroducedAt、Curve参照が存在する。
- 参照する4つのCurveFloatでRichCurve.Keysを確認したが、既存readerはその配列を解読できない。**難易度候補の発見であり、実際に使われる難易度式や装備Power式の確定ではない。** 呼出元と有効化条件を追う必要がある。
- JSON 462件はパス分類上、level/objectgroup/resourcepack等が中心。Python 19件はいずれもresourcepackのmake_list.pyで、1件の本文は画像一覧生成だった。Pythonがあるだけでゲーム戦闘処理を含むとは判断しない。他18件の全文同一性は未確認。

## ロジックはどこまで読めたか

QuickBMSは抽出の入口。抽出後のBlueprint script解読とネイティブコード解析は別工程である。[QuickBMS公式](https://aluigi.altervista.org/quickbms.htm)

Epicの説明ではBlueprint処理はVM bytecodeへ変換され、関数のscript配列へ格納される。今回のFunction exportを調べる理由はここにある。ただし現行UE資料の一般説明を、このゲームの独自エンジン版のバイナリ仕様と同一視しない。[Epic Compiler Overview](https://dev.epicgames.com/documentation/unreal-engine/compiler-overview-for-blueprints-visual-scripting-in-unreal-engine)

### 本文を見た結果

| サンプル | 観測 | 判断 |
|---|---|---|
| BP_Exploding / ExecuteUbergraph | 9-byteのscript領域。EntryPointを使うcomputed jump、return、終端の短い処理 | この関数から爆発ダメージ式は得られない。親クラスは別途追跡 |
| BP_Accelerating / ExecuteUbergraph | 同じ短い本文パターン | 加速率や発動条件を得たことにはならない |
| BP_ClaymoreInstance / ExecuteUbergraph | 177-byteのscript領域、import -26へ解決するCreateSound2Dの呼出3箇所 | 読めるロジックの実例。ただし武器の音の初期化でありDPS計算ではない |
| BP_DeflectingWithShield / GetShield | 105-byteのscript領域、GetOwner呼出と条件分岐を部分確認 | オブジェクト取得のロジックは追跡候補。反射確率式は未復元 |
| BP_PoisonCloud | OnCloudStarted、GetImpactEffect、SpawnImpactEffect等の本文領域を確認 | 関数名や領域の存在だけで毒tick処理と判断しない |

読み取り根拠はUAssetAPIの公開実装の `NormalExport → FieldExport → StructExport → FunctionExport` と命令定義を参照した。今回は独自の探索用probeと手作業の限定検査であり、UAssetAPIを実行して独立検証したわけではない。式・分岐・引数の全自動復元は未実施。

候補レイアウトはproperty終端/GUID/親/children/script長を想定し、script終端と後続12 byteを検査したもの。63件の不一致にはPlayerControllerのOnEnchantmentTriggeredClient等がある。未対応の関数を空と扱わず、例外一覧から次のreader検証対象を選ぶ。長さの合致だけでそのレイアウトを正式採用しない。

### 実物で確認できたnative境界

| 子アセット | 親クラス（/Script/Dungeons） | 当該CDOの観測 |
|---|---|---|
| BP_CriticalHit | CriticalHit | CriticalDamageTypeタグ。確率・倍率はこのCDOにない |
| BP_DeathCapMushroomGameplayEffect | DeathCapMushroomGameplayEffect | UIData参照のみ |
| BP_IronHideAmuletGameplayEffect | DefenceGameplayEffect | UIData参照のみ |
| BP_FireAspectGameplayEffect | FireAspectGameplayEffect | UIData参照のみ |
| BP_PainCycleActiveGameplayEffect | PainCycleBuffGameplayEffect | UIData参照のみ |

これらのアセットにはFunction exportがなかった。**native親が存在するという根拠は得たが、欲しい数値が必ずそのnative親だけにあるとまでは証明していない。** 他アセット・呼出引数・親初期値から供給される可能性も残る。

現在のツリーには該当拡張子の実行ファイルがないため、native側の実装確認は別の入力が必要。その際は同じゲーム版の実行ファイル、関連DLL、あればシンボル、元pakの識別を揃える。入手経路・版が不明のファイルで混ぜ合わせない。

## Optimizerに必要な情報との対応

「部分」は一部の構造/値を確認、「候補」は格納先または処理参照だけ確認、「外部入力」はゲーム定数として確定できないもの。取得率の分母を旧2,105 Gapに固定しない。

| 必要情報 | 今回の到達点 | 再構成に残るもの | 現在の主な利用箇所 |
|---|---|---|---|
| 装備ID・種類・variant・参照 | 部分: ItemId/ItemIdName、class/親/参照 | uniqueや固有効果の正確な対応、未保存のnative定義 | src/data/weapons.ts、armors.ts、ranged.ts |
| 固有効果・防具補正 | 部分: Multiplier/Chance/Resistance | 装備との接続、適用種別・合成順序 | src/core/armor.ts、defense.ts |
| 基礎ダメージ・Power補正・HP | 候補/未確定: raw damageはある | raw値から表示/実ダメージへの式。今回Power式は未発見 | src/core/powerScaling.ts、src/data/powerScaling.ts |
| 近接コンボ・ヒット間隔・範囲 | 部分: ConfiguredAttackVariants等 | notify、cancel、speed補正、実ヒット時刻と判定範囲 | src/core/attackProfile.ts、damage.ts |
| 遠隔弾数・発射間隔・散布 | 部分: AttackDefintion、Projectile参照 | charge、burst、回復時間、命中・貫通の実効処理 | src/data/ranged.ts、src/core/ranged.ts |
| エンチャント段階・条件・確率 | 部分: 一部段階上限・増分・タグ | level解決、on-hit/on-kill、抽選単位、native処理 | src/data/enchantments.ts、src/core/enchantment.ts |
| DoT・爆発・連鎖 | 部分: DamagePercentage/Duration等 | tick頻度、基準値、再発動・所有者・kill帰属 | src/core/dotDamageEvents.ts、damageEvents.ts |
| スタック・効果更新・排他 | 部分: StackLimitCount等 | refresh/overflow/消費、親defaults、適用関数 | src/core/temporalEnchantments.ts、chargeConsume.ts |
| アーティファクト効果・CD・持続 | 部分: Effectとnative親の参照 | Power曲線、持続/CD算出、チャージ消費、重複 | src/core/artifact.ts |
| ソウル・回復・被ダメージ | 候補: SoulComponent、HealArea、native効果 | resourceの増減、上限、回復・軽減順序 | src/core/types.ts、src/data/souls.ts |
| 敵HP・難易度・耐性 | 部分: EndlessStruggle表、敵アセット | 実使用箇所、難易度選択、敵固有のnative処理 | src/data/scenarios.ts、src/core/types.ts |
| 召喚物・ペット | 候補: 友好キャラ・召喚イベント | attack/AI・ターゲット・召喚CD、装備補正継承 | scenario/将来の効果表現 |
| プレイヤーの頻度・戦闘状況 | 外部入力 | 行動方針、敵密度、roll頻度、攻撃時間配分 | src/core/types.ts のScenario |
| 評価重み・順位の目的 | 外部入力/設計 | 火力・防御・回復・Controlの価値判断 | Scenario.weights/controlPolicy |
| 所持装備・観測値 | ユーザー固有入力 | セーブ/入力との連携は別調査。配信アセットでは本人の装備は分からない | src/inventory、OwnedWeapon |

ファイルの定数を集めても、最適化の目的関数や利用者の戦闘方針が自動的に決まるわけではない。現在のScenarioにはenemySupplyPerSecond、directKillShare、averageTargetsInReach等の仮定があり、これらを一次仕様と混在させない。

## Phase 6.8の優先課題と終了条件

1. **P0: readerの独立検証。** 既知のScatterCrossbow、今回の防具倍率、4つのDataTable、短い/分岐のある/例外のFunctionを別readerで比較。property型・境界・参照が一致し、不一致には理由が付くこと。UAssetAPIは候補だが、このデータセットへの適合は未検証。プロダクトの依存へ先に追加しない。
2. **P0: 参照と継承の解決。** raw FPackageIndex、outer chain、package path、親CDO、子overrideを保持し、少なくとも防具倍率・キノコ・CriticalHitを親/nonnative参照の終点まで追う。nativeに到達した地点を記録し、欠落を0やengineの推定defaultにしない。
3. **P0: Power/HP/発動/合成の所在判定。** 関連import/callsiteや設定を追跡。native実装が必要なら同版入力の存在を確認し、取得できなければ「現在の資料では未確定」と終了する。無期限のファイル名探索を続けない。
4. **P1: カーブ/非CDO/notifyの対応。** RichCurve.Keysと非CDO component、アニメーションnotifyを読み、単なるanimation durationからeffective attack rateを導出しない。敵難易度曲線には呼出元の証拠を付ける。
5. **P1: 関数の意味的な分類。** 全関数数を成果指標にせず、ゲーム計算・状態更新・native委譲・演出・空処理に分類。計算を復元したとするには、命令の全消費、参照解決、制御フロー、入力/出力と対象versionの確認が必要。

独立readerで照合できない場合、今回の探索結果のままruntimeへ採用しない。実効挙動を保証できない項目は最小の実測プロトコルへ送る。完全なゲームエンジンの再実装を6.8の完了条件にしない。

## 再設計の判断方針

データの保管単位を最初から現在のweapon/enchantmentの項目へ固定せず、次の関係を保持する。

- Source: 版・元ファイル・hash・抽出手順。
- Definition: asset/class/object/property/function。親参照とoverride、省略値、未知値を区別。
- Mechanic: trigger、条件、対象、計算、状態、時間、stack、native依存。根拠へ逆引きできる形。
- Scenario: 利用者の行動・敵の状況・確率分布と仮定。
- Evaluation: 目的と重み、近似方法、感度と未対応条件。

既存のRaw → Canonical → Runtimeの区別は有用なので維持候補。拡張すべきなのは、値だけでなく**処理・状態・参照の由来**を表現する部分である。旧モデルのWeb/実測データも比較対照として残す。

6.9ではScatterCrossbow（発射）、防具倍率（合成）、CriticalHit（抽選）、毒（時間/所有者）、キノコ（持続/CD）を代表ケースにし、旧計算と根拠付きの新表現を比較する。公式な実効式を取得できれば局所置換、表現できない状態依存が順位に大きく影響すればその部分のモデル再設計、根拠がない場合は未知として保留する。全面書き直しの判断はこの比較後。

## 保存先・再確認

- [観測データの案内と再現手順](../research/game-data-capabilities/README.md)
- [全体集計・版の根拠・24 DataTableの索引](../research/game-data-capabilities/inventory.json)
- [24アセット25数値の観測](../research/game-data-capabilities/static-observations.json)
- [関数の試験・63例外・native境界](../research/game-data-capabilities/logic-observations.json)
- [非CDO表とカーブの試験](../research/game-data-capabilities/table-observations.json)

全体走査の詳細と探索用スクリプトはignoredの `local-game-data/capability-research-2026-09-07/` に保存。Gitへはゲームファイル・bytecode断片・全表本文を含めず、集計、選択した構造的観測、hashと独自の解釈のみ保存する。

## 外部の解析仕様資料

以下は2026-09-07に参照。一般的なツール能力/構造を確認するための資料で、Dungeons固有の計算式の根拠ではない。

- [UAssetAPI](https://github.com/atenfyr/UAssetAPI): cooked assetとKismet bytecodeを扱う独立reader候補。
- [NormalExport](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/ExportTypes/NormalExport.cs)、[FieldExport](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/ExportTypes/FieldExport.cs)、[StructExport](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/ExportTypes/StructExport.cs)、[FunctionExport](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/ExportTypes/FunctionExport.cs): tagged propertiesから関数scriptへ進む構造。custom version分岐がある。
- [EExprToken](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/Kismet/Bytecode/EExprToken.cs)、[EX_FinalFunction](https://github.com/atenfyr/UAssetAPI/blob/master/UAssetAPI/Kismet/Bytecode/Expressions/EX_FinalFunction.cs): 限定的な命令・呼出operandの照合。
- [Epic Gameplay Effects](https://dev.epicgames.com/documentation/unreal-engine/gameplay-effects-for-the-gameplay-ability-system-in-unreal-engine): duration、modifier、stackを調べる一般的な理由。現行UEの計算規則をこのゲームへ無検証で移植しない。
