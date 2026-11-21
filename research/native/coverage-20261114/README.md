# 次期Runtime Coverage — Native解析引き継ぎ

開始2026-11-14、検証完了2026-11-16。Astra Ultraの3解析担当と統合担当による研究成果。基準はPR #241統合後の `6bf212dc5ea8f686f981c9882657874264e41791`（tree `553614636af385713bbe94e1992c2e593f9bb5c5`）。完了時のGitHub mainも同一だった。

**共通時間計算、矢資源・被弾無効化の局所処理、Chainsの孤立対象条件を新たに解明した。装備全体の新規READYは0件。最短の次候補はFlailとJailor’s Scytheの2件で、条件付きfoundationの採用審査と装備への接続が残る。** RuntimeはMelee35/82、Ranged11/71、Armor13/73、Artifact3/45、計62/271を維持する。

## 比較と選定

件数は現在未対応の影響候補であり、解決しただけで装備全体が計算可能になる件数ではない。特に複数固有効果の共存、対象・資源・時間条件を別に確認した。[全ID・Raw/Formal/Canonical照合](candidate-census.json)／[比較表](candidate-census.md)。

| 共通blocker | 比較時の未対応候補 | 見込み・コストと選定結果 |
|---|---:|---|
| Artifact Power・時間・発動 | damage Power17、duration-only7、Formal関係を持つ和集合13 | 既存scalarと復元Nativeを再利用できる。共通durationとcooldown候補値を主対象に選択。実際に確認したDurationIncrease constructor群は7種、そのうち未対応5種 |
| Armor軽減合成 | 15 | 影響は大きいが各writer・適用順と既存の独立holdoutが不足。既知の汎用aggregator再解析では解決しない |
| Armor被弾無効化 | 11 | 共通MissChanceの判定・乱数を局所解析。完全dispatchに引数不整合がありPARTIAL |
| Armor矢束 | 3 | 狭い共有イベント処理として進めやすい。CDO値、再帰抑止、弾数履歴換算まで解析 |
| Ranged発射周期／複数射撃／Wind | 周期60、同時射撃8、Wind3（重複あり） | 影響上限は大きいが、射出・消費・命中・位置変化が同時に残る。今回は新しいNative経路の深掘りを選ばず、必要条件を残した |
| Melee Chains | 2 | PR #241の具体的な停止条件であり、孤立対象の分岐を解明すれば既存コンボモデルへ近づく。追加解析対象に選択 |

「Artifact duration-only7」と「Native DurationIncrease未対応5」は異なる集合。Formal Effect10＋ItemActor11は重複を除いて16種、既対応3種を除いて13種。これらを加算しない。

## 解明できたこと

- **Artifact:** 内部float32 Power `item+0x480` → PowerEffects[0]のcallback → 基準duration → specのSetByCaller値を接続。Bootsは基準1.5秒・cooldown5秒、自己適用、Positive status属性の取得まで確認。共通cooldown候補は `F(base × ItemCooldownMultiplier)` を正の小さいOverrideで上限制限する。表示整数Powerを内部Powerとして代入せず、未取得属性を1にしない。providerに渡した値と実際の再使用可能時刻は別。[式・RVA・5種の一覧](artifact-REPORT.md)
- **Armor矢束:** Native default5に対しBlueprintのArrowIncreaseAmountが10へ上書き。拾得通知handlerから追加付与し、フラグで再帰通知を抑止する。履歴弾数には容量比とbinary32丸めを使う別換算がある。BeginPlay内で直接付与しないことは確認したが、全startup経路で付与されないとは証明していない。[根拠](armor-REPORT.md)
- **Armor被弾無効化:** ChanceはCDOで0.3f。適格イベントで32bit LCGを進め、下位23bitから得るdrawに厳密な `u < Chance` を適用してcancel byteを書く。単なるdamageへの0.7乗算ではない。RNG引数がnullに見える別dispatchとの接続は未解決として明示した。[最小の残問](armor-evidence.json)
- **Chains:** queryから主対象自身を除外し、filter後の隣接候補数0なら主対象追加・適用callも飛ばす。`averageTargetsInReach=1`だけではこの条件を満たさない。Flail=`Mace_Unique2`、Jailor=`SoulScythe_Unique1`の名前・内部ID・固定Chains IをNative catalogへ接続。旧icon seedの誤ったordinalを引き継がない。[条件・対象選択・ID](chains-REPORT.md)

Native duration群の未対応5種はBoots of Swiftness、Enchanter’s Tome、Gong of Weakening、Shadow Shifter、Totem of Shielding。Tome／Shieldingの確認はconstructorのclass設定までで、最終duration consumerを閉じたものではない。

今回具体的に進めた機構に関係する未対応候補は、Artifact5、矢束3、MissChance11、Chains2の**重複なし21種**。Armorの装備→component binding等が残るため、これは計算可能件数でも追加保証件数でもない。新規の全装備READY、Runtime昇格、実装による対応増加はすべて0。

## READY / PARTIAL / BLOCKED

| 分類 | 成果と対象 | 残る最小の問い・必要Evidence |
|---|---|---|
| READY | 条件付きArtifact duration／cooldown候補算術foundation。Native duration群5種に段階的再利用可能 | GPT-6 Highで式・field・呼出関係を独立採用審査。実装は内部bitsと有効属性を明示入力とし、最終timerを計算済みと表示しない |
| READY | 矢追加の再帰抑止・履歴換算、MissChanceの局所乱数・厳密閾値 | 完全イベント接続とは別の入力明示foundationとして審査する。生のゲーム観測・P3B holdoutの代用にしない |
| READY | Chainsの「他の適格候補なし→主対象への適用callなし」foundationと2個体のNative ID／固定record | 条件が既存Scenarioで表現できるか、装備から当該classまでのbridgeを独立検証する |
| PARTIAL | Flail／Jailor、全装備としての最短2候補 | Formal identityは未採用。正しいRawとNative recordを採用し、装備→固定enchantment class dispatchを照合。JailorのSoulと既存コンボ条件も別途保持 |
| PARTIAL | Bootsおよび他4 Artifact | Bootsはeffective class差分、provider `+0x40`、最終duration処理・再適用、移動評価契約。Gongはeffect側key消費と対象資格、Shadowはsoul支払い／消費、Tome／Shieldingは対象・生成actor側consumerが最小の次Evidence |
| PARTIAL | 矢束3 Armor | item→BP_IncreasedArrowBundleSize、slot enum 1/2/5、startupと実拾得の通知元、代替ammo routing。既存Native registry／callerを静的追跡できる。Archerの移動aura等を無視しない |
| PARTIAL | MissChance11 Armor | どの有効dispatchがRNG stateを供給するか。null第五引数とhandler dereferenceの不整合を解消し、対象別componentとtagを結ぶ。成功したengine returnを合成して埋めない |
| PARTIAL | DR15、Ranged Wind3／同時射撃8／残り周期 | DRのwriter所有元・channel・順序、Windの実適用対象と移動、複数射撃のdelay／ammo／hit対応が不足。今回新しく解明したと数えない |
| BLOCKED | 実ゲームとの完全一致、版の真正性、既存DRの独立holdout | 現資料には公式配布に対するexe/pak同一build保証、live FP／対象状態、必要な独立raw holdoutがない。認証されたhash対や独立観測のEvidenceが必要。新しいWindows環境・Switch抽出・動画の提供は要求しない |

READYは独立検証後に限定foundation実装を検討できるという意味であり、AdoptionDecisionのacceptedや装備全体の対応を表すものではない。

## 検証と再現

条件付き局所比較は合計**3,518件、不一致0**（Artifact2,219、Armor1,288、別実装のChains分岐11）。同じ入力を異なる処理段で比較する件数を含み、3,518回のゲーム観測ではない。Armorの境界unit3件も成功。原資料は既存private dataを読み、出力はmetadataのみ。

- ArtifactとArmorの保存replayを統合担当が再実行し、結果JSONの完全一致を確認。
- Chainsは解析担当とは別に書いた分岐harnessで空／非空・主対象同一／別pointerを照合。原資料4ファイルも別にhash確認・再parseし、ID4フィールドとdamage/timing10フィールドを照合。
- 別のAstra担当がArtifactのNative命令を独立レビュー。callback末尾ジャンプのhash範囲欠落とconstructor輸送の証拠不足を検出・補正した。[元レビュー](artifact-independent-review.json)は当時のhashを保持し、[最終解決記録](review-resolution.json)と区別する。最終bundle全体を第三者が採用済みという主張ではない。
- `audit-runtime-promotion` と `audit-formal-integration` は成功。候補1／eligible0／promoted0を維持し、src、Raw、Formal、Runtime、Roadmap／Project statusを基準mainから変更していない。

```sh
# repository rootで実行。LOCALには既存private資料を指定する。
LOCAL=/path/to/local-game-data
python3 -B research/native/coverage-20261114/verify_handoff.py --local-root "$LOCAL"
python3 -B research/native/coverage-20261114/artifact_replay.py --local-root "$LOCAL" --output /tmp/artifact-replay.json
python3 -B research/native/coverage-20261114/check_armor_coverage.py --local-root "$LOCAL" --replay --output /tmp/armor-replay.json
python3 -B research/native/coverage-20261114/check_chains.py --local-root "$LOCAL" --check
python3 -B research/native/coverage-20261114/independent_branch_review.py --local-root "$LOCAL" --output /tmp/chains-branch-review.json
node research/native/coverage-20261114/review_chains_raw.mjs "$LOCAL"
python3 -B -m unittest discover -s research/native/coverage-20261114 -p test_armor_coverage.py
```

Capstone5.0.6／Unicorn2.1.4は既存private toolsを再利用。Node26.13.0／Python3で実行した。private資料なしでも`verify_handoff.py`はpublicファイルのhash、基準入力、Catalogとgateの不変を検査できる。[manifest](manifest.json)に原資料・成果物SHA-256を集約した。hash一致は由来の真正性や別buildへの移植可能性を保証しない。

## GPT-6 Highへ渡す具体的Work Unit

1. **最初はChains2個体の採用審査と限定契約。** 正しいIDと固定Chains Iを原資料から再確認し、装備→class bridgeを閉じる。`no other eligible Chains candidate`を未知／真／偽として扱い、未知や`averageTargetsInReach=1`だけでは許可しない。既存の現在Powerでの完全combo観測・base cadence・固定効果所有元を再利用し、JailorのSoul条件を検証する。別敵あり、条件未入力、誤ID、固定効果重複、Power変更後の古い観測を拒否する。Adoption／Limited再利用の適切な経路を独立reviewで決めてから実装する。
2. **Artifact時間foundationとBoots1種の閉包。** 今回のbinary32式・明示属性入力・override分岐を共通にし、provider `+0x40`とeffectの後処理を確認する。Bootsの移動速度を評価する目的が定義できなければ、coverage目的の優先度を下げてGongのeffect consumerを先に閉じる。未接続5種を同時昇格させない。
3. **Armorの矢資源イベントfoundation。** 3種のregistry bindingとstartup／pickupのemitを閉じて、初期stock・物理pickup・bonus grant・容量換算を別eventとして設計する。次にMissChanceのvalid RNG dispatchへ進む。全DRのholdoutを新しい局所テストで置き換えない。

今回は解析限定の依頼に従い、commit／PR／merge／push／Site更新を行わず、分離worktreeに検証済み研究資料を保存した。ゲームバイナリ、セーブ、private payloadを成果物に含めていない。
