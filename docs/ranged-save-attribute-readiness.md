# Ranged実個体Power・7属性 — 調査の境界と接続

基準mainはPR #221後の `baec198`。**7属性の初期値・capture・順序をsourceへ接続したが、bare Bowでも実効値の自動解決は0/7。save adapterは合成データで検証した条件付きtransportであり、実個体の対応は未確認。Optimizerの計算可能装備・効果の増加は0件、利用者のruntime入力削減も0件。** この障害で調査を区切り、同じNative/save研究を次の既定作業にしない。

## 7属性の決定経路

機械可読な正本は [属性調査](../research/domain/ranged-effective-attributes.json)、追加の静的根拠は [24区間のhash](../research/native/ranged-input-20261105/static-evidence.json)。既存#217/#220/#221のNative・Raw・Formal Identityを再利用する。新たなRaw ValueやEvidence Adoptionを作っていない。

属性getter → owning classの登録 → constructor → 名前とoffsetを持つproperty descriptorを照合した。RVAは既存のhash固定imageに対するもの。公式配布物の真正性、Raw/exe同一buildは未確認。

| 順 | 属性 | 帰属 / snapshot | 初期値、constructor / store RVA | 実効値を決める未解決条件 |
| --- | --- | --- | --- | --- |
| 0 | RangedAttackDamageIncrease | source / false | 0、`f72a00 / f72a47`、`+4c`（`+48`のqword storeの上位dword） | sourceの加算属性に対する具体的writer、装備以外のactive state、読取時点 |
| 1 | TakeDamageMultiplier | target / false | 1、`f06a50 / f06a8f`、`+50` | 対象の属性set・具体的writer・active effect。武器がbareでも対象状態は確定しない |
| 2 | DamageMultiplier | source / true | 1、`ec8dd0 / ec8df0`、`+30` | sourceの一般倍率のwriter・capture時点。BowのChargeDamageMultiplierとは別属性 |
| 3 | DealDamageMul | source / true | 1、`e99220 / e99240`、`+30` | 別の属性setにあるDeal倍率のwriter・capture時点。DamageMultiplierとの同一視不可 |
| 4 | DifficultyDealDamageMultiplier | source / true | 1、`ecf2b0 / ecf2d0`、`+30` | 難易度をこの属性へ設定する具体的writerと選択値。名前からplayer=1と推定しない |
| 5 | RangedAttackDamageMultipler | source / true | 1、`f72a00 / f72a31`、`+38` | ranged倍率の具体的writer・active modifier・capture時点 |
| 6 | TakeRangeDamageMultiplier | target / false | 1、`f06a50 / f06a9d`、`+58` | 対象側の遠距離倍率writer・active effect |

確認済みwriterはconstructor。#219/#221にある一般のattribute base/current更新・stack/channel機構は参照できるが、**上記7属性それぞれの具体的modifier writerと発動条件の網羅は未解決**。変更条件を「なし」と確定した属性もない。constructor defaultの存在は、実効値の固定やactive effect不在の証明ではない。snapshot=trueから「発射瞬間」とも断定しない。追加の全Native再解析は行わない。

適用順は `(-I + -H) * TakeDamage * Damage * Deal * Difficulty` → 既存Q → `Ranged * TakeRange`。各演算でbinary32へ丸め、並べ替えない。captureのsource/target・初期化RVAは#221のmodelとauditで照合する。

既存structural shardの文字列候補22 packageを調べると、完全一致する7属性名は0 package。候補は`ChargeDamageMultiplier`、Gongの`EnemyTakeDamageMultiplier`等だった。serialized調査に見つからないことは、Native/inherited/dynamic writerが存在しない証拠ではない。これらを7属性の有効値に流用しない。

`resolveBareBowEffectiveAttributes`は欠けた属性をunknownとして列挙する。7値を明示した場合だけ`explicit-conditional-input`として渡す。既知の0は保持する。現時点では自動注入できる値はない。

## Save adapter

[adapter](../src/inventory/rangedSavePower.ts)は復号済みJSON textを入力とする研究用staging API。Macで動作し、復号・暗号鍵・Switch抽出・Windows起動を必要機能に含めない。探索した既存local-game-dataには、この用途の解析済み実saveは見つからなかった。取得できないことを理由に探索を反復しない。

[公開save toolingの固定commitとfile hash](../research/native/ranged-input-20261105/public-save-sources.json)を確認した。`items` / `storageChestItems`は別配列、recordの`type`は文字列、`power`はdouble、`inventoryIndex`はnullable integer。tool側でindexを付け直し、cloneでindexをコピーしない処理もある。永続的なitem UUIDとは扱わない。save-formatの数値`version`とゲームの`1.17.0.0`を対応付ける証拠も得ていない。外部toolはschemaの補助資料であり、1.17の実個体検証ではない。コードは転用していない。

今回の対応は`type: Bow`のみ。公開toolのBow type、既存Native modelの`rawIdentity: Bow`、Formal Identity接続を再利用する条件付きmapping。任意の武器IDを小文字化して受け入れない。Nativeで確認済みの`power`数値→float32→record `+14`→factory→ItemPower `+480`は[#221成果](../research/native/ranged-final-20261101/REPORT.md)を参照する。

接続手順:

1. `rangedSaveSnapshotId(decodedJsonText)`で**復号済みtext**のSHA-256を得る（暗号化元ファイルのhashでも真正性証明でもない）。
2. schemaVersion=1、gameVersion=1.17.0.0、別途指定したsaveVersion、取得元・版のsourceNote、originを明示する。ゲーム版はcaller宣言であり、認証済みにはしない。saveVersion=999はテスト専用の架空値。
3. `snapshotSha256 + collection + recordIndex`でrecordを指定する。位置はそのsnapshot限定。表示Power・型・slot・inventoryIndexによる探索や推定はしない。
4. `resolveRangedSavePower`がJSON、version、record/type、型・数値域を検査し、binary64→`Math.fround`→8桁bitsとsnapshot限定instanceIdを返す。
5. そのinstanceIdを持つInventory個体についてのみ`rangedNativeReadinessFromSave`で#221へ接続できる。既存の手動IDとの自動対応は拒否する。Inventory schemaや保存データは変更せず、save情報も保存しない。

検査: 欠損・string/boolean/object/null・非有限・負・Power>40・subnormal/underflow、別snapshot・配列・位置・武器・明示版・schemaを拒否。既知0は許容。古いsnapshotから新しいsaveへの個体追跡は行わない。JSON.parseはbinary64を返すが、実ゲームのdecimal parser/tag選択は未確認で、Nativeのint64/uint64 variant全般の証明にはしない。Nativeの欠損fallbackは使用しない。表示powerLevelは読まない。

結果の`known`は指定recordの条件付き数値transportの成功だけを意味する。`actualItemVerification`は常にreason付きunknownで、`origin: existing-save`と宣言しても変わらない。JSON decoder/Native parserの一致、実個体の照合、ゲーム版認証、saveの真正性を自動認定しない。実saveへの正確な対応を主張するには、既存実save一件と、復号・version・選択位置・武器・Powerの独立した照合が必要。既存資料が提供されればMacで検証可能だが、今回は存在しない。新規の取得や手動作業は要求しない。

## #221・Optimizerへの接続と入力削減

`rangedNativeReadinessFromSave`は選択したPowerを条件付きAPIへ渡す。mode、7実効属性、projectile、Power effect、provider/MXCSR契約は明示する。tableにないbitsは既存APIがunknownとし、近傍補間しない。正例の合成10.9→`412e6666`→Bow chargedのcustom magnitude `10217.6025390625`を#221の出力と照合する。これはHP減少量ではない。

研究APIでは、正しいsnapshotから作られた個体なら内部Power bitsの転記とweaponIdの重複指定を省略できる。ただし実save未検証のため本人の実利用で減らせた入力は0。7属性も自動解決0。Optimizerは従来の観測damage・完全周期・矢数・版/メモを引き続き要求する。既存観測があればsave検査に失敗しても保持する。

runtimeEligible=false、HP loss/DPSはunknown。evaluate/optimize/scoringへの数値供給は追加していない。観測型Limited 6装備は維持。Runtime Promotionは1候補/eligible 0/promoted 0のまま。R3 accepted exact-domain decision、独立Product regression、P3Bの5 hash成果物、実環境CRT/MXCSR・game version・実効writer・実個体証拠がblocker。独立コードレビューはゲームEvidenceを代替しない。

## 次Work Unitの比較と選定

| 候補 | 得られる実用機能 | 現在の最小blocker / 判断 |
| --- | --- | --- |
| 同じNative Bow自動damage研究を継続 | 手入力damage不要を目指せる | 実効writer・実save・実環境・R3/P3Bの外部証拠不足。今回と同じ探索は保留 |
| 観測型Limited reuseで別Rangedを追加 | 計算候補を増やすcross-layer経路 | 対象ごとのsource-bound意味・版・intrinsicの同一性と承認が必要。今回それを満たす新対象は特定していない |
| Inventoryの評価不能理由と不足入力をまとめて表示 | 既存Full/Limited装備を評価へ到達させるP5/P6改善 | 既存parser/support理由を使える。新しいゲーム式やEvidence昇格は不要。**次の最小WUに選定** |

選定する範囲は、現在のInventoryに対する評価可能件数・除外理由・必要入力の一覧と該当編集先への導線。未知効果を0点表示しない。まず既存の説明・単体理由表示との差分を確認し、未観測の対応Ranged 6種で「何を記録すれば比較できるか」を一画面で明確にする。これなら新しいゲーム資料を待たず、既存coverage内で利用者が比較できる装備を増やす最短経路になる。実効属性の証拠が新たに得られた時だけNative候補を再評価する。

## 検証・運用

関連テストは7属性の欠損/不正値/既知0、104件の既存合成double transport、隣接bits、重複Bow・chest・欠損・不正版・別個体拒否、#221出力一致、既存観測保持。既存Ranged runtime/reuse・Evidence/Promotion回帰を併用する。公開auditはmetadata/hash/capture境界を検査し、`--local-root`指定時だけ24静的区間とdescriptor・class・constructor接続を照合する。Native実行や新規DLL取得は不要。

ローカルは関連検証のみ。Full ValidateはPR headのGitHub CIで一度実行する。独立レビューと最終head/CI結果はPRに記録し、mergeしない。UI・配信runtimeは変更しないためSite反映なし。private save・image・DLL・メモリデータはcommitしない。rollbackはPR revertのみで、Inventory移行は不要。
