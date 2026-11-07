# Inventoryの評価可能性と入力導線

PR #222後のmain `7a9e5742bedddae1d261c66012ac5b9669dd69b0` を基準とする。#222で選定した次WUを実装。既存の観測入力欄・用途別スコア評価は再利用し、Inventory全体の件数、個体別の原因と編集への導線を追加する。Native解析・Formal population・新しいゲーム計算式・Evidence昇格は行わない。

## 使い方

1. Inventoryを開くと、現在の最適化条件と所持装備全体をWorkerで確認する。
2. 「評価可能 / 入力不足 / 未対応 / 条件・組み合わせ制約 / 評価処理失敗」の件数を見る。「個体ごとの理由と必要な入力」を開くと、装備名・Power・個体IDと原因を確認できる。
3. 入力不足の編集ボタンで正しい個体を開く。同名装備・表示形式・絞り込みに関係なくinstanceIdで指定し、対象を隠すお気に入り・Power等の絞り込みを解除する。Rangedの観測欄も開く。
4. 数値を補完・適用すると古い結果を直ちに隠し、350ms後に再確認する。条件の変更でも再確認する。確認は中止・再試行でき、既存Workerの時間上限と探索上限25,000通りを共有する。
5. 「最適化・装備比較へ進む」から最適化、用途別評価、個体必須構成とスコア差を確認する。

確認のためにInventory・保存条件を書き換えたり、装備を黙って取り除いた別Inventoryを作らない。評価可能は、**現在の所持品全体の探索が完了し、その個体を含む構成の数値評価が成功したこと**。ある必須カテゴリが全滅・入力不正・計算失敗等で全探索が完了しなければ、他の装備も「全体の探索未完了による制約」として未確認を保持する。単体性能や任意の相手との組み合わせの成功を保証しない。

## 判定と分類

画面はcoreが返す構造化結果を表示するだけで、装備ID・エラー文言から独自に可否を推定しない。

- `inspectInventoryReadiness` は既存の`buildsForWeapon`、`optionsForArmor`、`rangedWeaponIssues`と共有validationで個体入力を検査し、その後に通常と同じOptimizerを実行する。成功個体IDは推薦件数の表示制限前の全候補から取得し、スコアの高低で可否を決めない。
- 通常候補のwarningと個体のfatal blockerは分離する。別候補が通る場合、一部Enchant/構成の除外だけでその個体を「未対応」にしない。
- 入力不足: 近接・ArmorのEnchant未登録、Armorのカード表示+HP、混在時に欠けている近接表示ダメージ、曲線外Powerの近接表示ダメージ、Ranged観測一式やモード不一致、Cowardiceの満タンHP時間割合。非有限・負値等も共有parser/validatorで拒否し、正しい個体の入力修正へ案内する。
- 未対応: Catalogのruntime非対応装備、Rangedの固有効果・Enchant/Gilded、source-bound reuse条件の不一致、Artifactの式の対応Power範囲外等。入力を埋めるだけで解決できるとは表示しない。未対応効果と不足入力が同居する場合、主分類は未対応とし両方の理由を残す。
- 制約: Evidence policy、近接/Armor/Rangedの未検証interaction、stacking、Artifactの同時装備制約、シナリオ入力、探索上限・全体探索未完了。Evidence不足を観測メモや内部値の手入力で昇格しない。
- 処理失敗: 計算中の数値範囲超過等。失敗した構成に含まれる個体へ記録する。式の既知の対応Power範囲外や装備数制約は処理失敗と分け、無関係な装備の失敗とはしない。

Rangedの0本の矢、Armorの+HP=0等、既存契約が認める既知の0は保持する。Unknown/Unsupportedを0点・0ダメージ・neutralへ変換しない。`OptimizationResult`の形、既存のArmor欠損HP/Evidence除外文字列、Inventory schema v6、lock・Gilded・お気に入り・メモ・保存条件を維持する。

## 入力改善で使える範囲

現在のLimited 7種（Bow / Crossbow / Shortbow / Longbow / Power Bow / Heavy Crossbow / Rapid Crossbow）について、次の対象個体の観測が必要。Bowと追加3弓は未チャージ/フルチャージをモード別に扱い、Heavy Crossbowは単射という境界を維持する。旧UIで保存された不一致モードも表示し、正しいモードへ明示的に変更できる。モード変更時はdamage/周期/観測メモを再入力し、適用までは元の保存値を保持する。

- neutralな通常矢1本のダメージ: 正の有限値
- 完全発射周期: 正の有限秒、charge/recovery込み。切替時間は従来どおり攻撃時間配分に含める
- 戦闘中の通常矢数: 0以上の整数、補給なし
- 発射モード、ゲーム版1.17.0.0の観測メモ・出典
- Rapid Crossbowは、対象自身の通常1射で矢1本が減る明示観測も必須。欠損は入力不足、明示0や2等は未対応。ammo stock 0でも省略できず、他6種でも明示non1を無視しない
- Scenarioの遠距離時間割合: 0より大きく1未満

対応Melee 9種、Armor 13種、Artifact 3種も従来のFull/Limited・Power・Evidence・interaction制約の範囲で利用できる。未対応の固有効果を持つ装備が新たに計算できるようになる変更ではない。

既存の合成ソフトウェアfixtureでは旧6種それぞれについて、未観測→必要項目表示→個体観測を適用→evaluate/optimize成功を検証する。ブラウザでは同名Bowを区別して編集し、評価可能2件→3件・入力不足1件→0件になり、保存後に最適化と用途別装備比較へ進めることを検証する。これは実ゲーム観測や本人の全Inventoryの評価件数ではない。本人のデータが提供されていないため、その改善件数は実行時のInventory上で確認する。

**新しい式の対応装備 +0 / 効果 +0。入力導線の改善は既存6種すべてを対象とする。** #221/#222の条件付きNative数値はDPS/装備スコアへ接続せず、HP loss/DPS unknown・runtimeEligible=false、Runtime Promotionのeligible/promotedを維持する。

## 残る障害と次の優先候補

未対応の固有効果・多重矢・特殊矢・Soul・未検証Armor/Ranged interactionと、各parameterのEvidence不足は残る。新しいゲーム資料がないまま内部実効属性・Power・初期値を推定して埋めない。

次の計算能力拡張候補は、現在の所持品で多く除外される**ArmorとRangedの組み合わせ**を、1つのinteraction単位で証拠と独立回帰を揃えて拡張すること。特にweapon damage aura等の適用先・加算/乗算・観測条件を確定する。現時点で対応を約束・承認せず、実Inventoryの除外件数と根拠の取得可能性から対象を選ぶ。Native Bowの自動damage研究は#222の外部Evidence blockerが解けるまで同じ探索を反復しない。

## 検証と運用

局所回帰は分類・個体対応・入力前後・invalid/unknown/unsupported拒否、計算失敗と未対応Powerの区別、既存保存/最適化/用途別比較/Runtime Promotionを対象とする。Chromiumでdesktop/mobile、同名個体・絞り込み解除・旧モード修正・Catalog編集・自動再確認・保存条件保持・最適化と比較への到達・アクセシビリティを確認する。

最終headのFull Validate（全audit・全Vitest・生成drift・型/lint・build・E2E）はGitHub CIで実行する。独立reviewの指摘は回帰とともに修正して最終headを再確認する。結果・head SHA・CI URL・reviewはPR本文に記録する。mergeはせず、本人限定Siteの更新はmerge後に既存`.openai/hosting.json` projectと運用契約に従う。ロールバックはPRのrevertで、Inventory移行は不要。

[Rapid追加の検証](rapid-crossbow-runtime-reuse.md)では、旧Catalog移行後の明示消費数入力、既知0と欠損の区別、再読込、最適化と用途別比較を追加する。入力値はソフトウェアfixtureで、実ゲーム観測の証明ではない。
