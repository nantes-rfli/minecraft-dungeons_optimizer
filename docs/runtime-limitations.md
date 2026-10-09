# Runtime limitations / Phase 2-1K

現行supportの正本は[manifest](../research/runtime/melee-runtime-support.json)、一覧と実数は[生成matrix](melee-runtime-support.md)。mechanicsの根拠は[research audit](../research/melee-enchantment-audit.json)。Phaseのpartial履歴と現在の機能範囲は別軸です。近接拡張はここで一旦freezeし、新Evidenceまたは明示的なobjective設計が得られるまで未登録5種を追加しません。

## 推薦スコアの確認

「装備の用途別評価」は、現在の条件と選択した保存済み条件（最大8件）をそれぞれ独立に全探索します。各条件で、各所持個体を必ず含む評価可能な構成の最高スコアと、全候補の最良スコアとの差を示します。次点・Paretoの表示上限で個体を評価から落としません。武器・防具・遠距離・Artifactの全所持個体が対象ですが、Catalog-onlyやEvidence方針・組合せ制約で使用できない個体は理由付きの未評価です。条件全体の評価失敗もスコアへ変換せず、他の条件とは独立に保持します。

各個体の「構成を見る」で、その条件の最良構成との装備・主要評価・スコアの差と、その候補自身のEvidenceを確認できます。条件や所持品の変更、保存条件の更新・削除、比較条件の選択変更で古い結果を破棄します。探索は条件ごとに既存の候補数上限を適用し、全体を既存Workerの時間上限と中止操作で制限します。

一覧は装備カテゴリで絞り込み、1つ選んだ条件のスコア差を小さい順・大きい順に並べ替えられます。条件ごとに独立して並べ替え、用途間のスコアは比べません。未評価の装備は数値を与えず、どの並び順でも末尾に残します。同じ差の装備は所持品順です。

「新しい装備を試す」では、現在条件と選択した保存条件ごとに候補追加前後の最良構成を比較できます。候補を必須にした最良構成と、追加後の全体最良との差も各条件で表示します。条件のスコアは条件内だけで読み、未評価の候補には数値を表示しません。Inventoryへ登録する操作は利用者が明示的に選びます。

これは現在の所持品・条件・評価式・Evidence方針の範囲で残す価値を検討するための比較です。用途間のスコアの合算、全用途に対する価値の保証、売却の自動判定は行いません。同点は同じ性能や効果の保証ではなく、正の微小な差を同点へ丸めません。Nominal healing、Scenario仮定、Estimatedの制限は既存モデルのままです。未評価の装備は売却判断を保留してください。runtime coverageとPromotion gateは変更しません。

最適化結果の「総合スコアの内訳」で、評価済みのDamage / Healing / Defense / Control、目的の重み、各軸の加点を確認できます。次点・パレート候補の「1位とのスコア差の内訳」は同じ重みで各軸の差を表示します。DamageはAoEのutility、Healingは自己damageを差し引いた回復のutility、Defenseは被damage軽減、Controlは制御utilityに基づきます。負のHealingは減点として保持し、表示の丸め前の加点合計は既存の総合スコアと一致します。

これは現在のモデルとEvidence適用方針の範囲内での説明であり、未対応効果を採用したりEvidenceの確度を引き上げたりしません。数式・順位・runtime coverageは変更しません。

## 判定ルールと再確認

次点・パレート候補では、同じ所持個体・同じEnchant（Tier・source・コピー数を含む）の枠順違いをまとめ、スコア順で最初の実現可能な構成を表示します。スコア・単体DPS・AoE DPS・回復/秒・実効HP・Control utilityのいずれかが異なる場合はまとめません。個体・Enchant・Tier・通常枠／Gilded／Built-in・Artifactの個体集合が異なる候補は、同点でも別構成として保持します。全探索件数と最良候補、評価式は変わりません。これは所持品を削除する判断や、枠順の異なるすべての装備を実ゲームで同等と認証するものではありません。

- Fullは現アーキテクチャ・合法装備・明示されたScenario仮定内で主要経路が完結すること。低信頼度だけではLimitedにしません。
- Limitedは固有のPower・コピー・併用境界があるもの。制限の所有者をmanifestに記録し、matrix/APIは逆方向の併用制限も表示します。Sharpness / Critical Hit / Committed等をPain・Dynamo側の未検証pairだけでLimitedにしません。
- Artifact Synergy / RampagingはFull。平均使用頻度・固定点・コピーdurationのモデルが完結しています。frame capやaction解釈のEvidence課題は[Temporal](temporal-enchantments.md)へ。
- Anima Conduit / Soul SiphonはFull。Soul gear条件はゲームの合法性で追加制限ではありません。名目回復・pickup粒度・満タン仮定は[Soul](soul-subsystem.md)へ。Enigma未実装がこの2種をLimitedにするわけではありません。
- Stunning / Freezing / GravityはFull。適用割合と持続補正を明示した独立Control経路が完結。Stunningの2秒の根拠品質は機能可用性と別です。Chainsはgame4/runtime1なのでLimited。[Control](cc-utility.md)。
- ExplodingはPower非依存でもVoid併用を明示拒否するためLimited。Fire / PoisonもVoid制限を共有し、PowerやFireコピー制限を個別保持。[DoT](dot-and-explosion-damage.md)。
- Pain / Dynamoはmodifier組合せの拒否でLimited。DynamoにはPower範囲もあります。共通4武器scopeだけを理由に全種をLimitedにはしません。[Charge](charge-consume-enchantments.md)。

## Backlogとclose gates

優先度付きbacklogの正本は[structured backlog](../research/runtime/runtime-backlog.json)へ移しました。下表は `npm run generate:evidence-coverage` で生成し、`npm run audit:evidence-coverage` で照合します。個別監査・support manifestの正本性は維持します。[横断Coverage](combined-evidence-coverage.md) / [実測protocol](measurement-protocols.md)。

Priorityはproduct decisionでありEvidence confidenceではありません。P0=通常利用を大きく阻害、P1=一般的な組合せ、P2=コピー・特殊条件・別目的、P3=新しい外部Evidence待ち。`evidence-blocked`は未作業TODOではなく、現時点でコードだけではcloseできない項目です。P1/P2でもEvidence待ちは明示します。

<!-- coverage-backlog:start -->
| Enchant / subsystem | Support | What works | What is blocked | Closeに必要なEvidence / 実装条件 | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Ranged neutral damage / cadence | 2 Limited, observed-only | Bow / Crossbow、単一通常矢、利用者観測の完全周期とneutral damage | 公開の現行版cadence・charge/recovery分離・独立DPS regressionなし。Power fallbackなし。 | 1.17.0.0で装備/neutral card/shot mode/全frame/矢数が揃う複数archetype各3独立run。chargeとrecoveryを別に確認。 | P0 | evidence-blocked |
| Ranged projectile distribution / intrinsic | Research-only | family分類、raw固有効果と継承元保持 | 複数矢・貫通・跳弾・爆発のdamage配分、proc対象、弾消費が未検証 | Scatter/Burst/Exploding等で1入力→射数→projectile→target damage→ammoを分離した現行版raw traceと実装。 | P1 | evidence-blocked |
| Ranged trigger / Armor synergy | Limited combinations only | 近接と遠距離damage/kill帰属を分離、Power/Critical/Unchanting各1copy | Void/DoT/Soul、Armor ranged bonus/aura/Life Steal/Cowardice、特殊矢とroll | baseline・単独・pairを比較した1.17.0.0のchannel別damage/proc/kill帰属、stacking、Tier/sourceの独立trace。 | P1 | evidence-blocked |
| Ranged-only build / switching timeline | not implemented | 近接slotを維持した明示的な攻撃時間配分 | 近接なしBuild API・詳細切替timeline・矢取得event | 近接なしのBuild型とevaluation/objective/UIを一貫して実装し、旧APIの回帰を維持。 | P2 | not-implemented |
| Phase 1-4 regression | runtime非該当 | audit・validator・pending UI | eligible 0/5、誤差範囲非表示 | 独立public run-levelのdamage・duration・完全build・target・versionが再現可能な5件。[gate](model-regression.md) | P3 | evidence-blocked |
| Shockwave low Power | limited | Power210–252 | 範囲外外挿 | 対象version・Tier別の低Power測定または独立curve検証 | P3 | evidence-blocked |
| Swirling low Power | limited | Power210–263 | 低Power | 同条件の低Power表とcurve検証 | P3 | evidence-blocked |
| Thundering low Power | limited | Power248–263 | 低Power | Tier別damage測定とscale検証 | P3 | evidence-blocked |
| Echo | research-only / mechanics | CD・tier・non-stackable調査 | repeat hit runtimeなし | repeat対象・animation/cadence cost・combo進行・Void reset・on-hit・direct kill attributionのtraceが揃えば再検討 | P3 | evidence-blocked |
| Enigma Resonator | research-only / mechanics | 最大chance・3x調査 | 中間Soul→chanceなし | 現行版で複数中間ゲージのchance、絶対量/割合、100cap履歴・Bag of Souls差を解決 | P3 | evidence-blocked |
| Fire full Power | limited | Power70–251 | 全Power、250異常値 | version/rollを揃えた欠損域・250のTier別測定 | P3 | evidence-blocked |
| Poison full Power | limited | Power184–251 | 全Power | version/rollを揃えた欠損域のTier別DPS | P3 | evidence-blocked |
| Fire multi-copy | limited | 1copy refresh | game4copy | mixed tier・2/3/4copyのdamage/refresh/同時tick式検証 | P2 | evidence-blocked |
| Fire/Poison/Exploding + Void | limited | 各効果単独 | Void併用 | 各eventの増幅・消費・reset/reapply・kill traceを独立確認 | P1 | evidence-blocked |
| Chains multi-copy | limited | 1copy root | game4copy | 同時proc・mixed tier・再発動・3/4copy duration検証 | P2 | evidence-blocked |
| Stunning duration | full | duration補正付きControl | durationの独立検証 | 現行version・対象耐性別の2秒持続/refresh frame trace | P2 | evidence-blocked |
| Pain Cycle modifier pairs | limited | 有限cycle・自己cost・net sustain | 8 modifierとDynamo併用 | 各pairの加算/乗算・critical対象・Void timing・同時consumeを測定。Tier混合も検証 | P1 | evidence-blocked |
| Dynamo modifier pairs | limited | charge/consume・overflow・初期burst | 8 modifierとPain併用 | 各pairのflat bonus増幅順・direct/AoE/kill資格・consume traceを測定 | P1 | evidence-blocked |
| Dynamo low Power | limited | Power210–263 | 低Power外挿 | Tier独立の低Power表、表示倍率との矛盾解消 | P3 | evidence-blocked |
| Busy Bee | research-only / mechanics | population・説明監査 | summonなし | spawn抽選単位・同時cap・lifetime・damage/timing・kill attributionのEvidenceとlifecycle設計 | P3 | evidence-blocked |
| Looting / Prospector | research-only / objective | combat以外の効果調査 | 収集・稼ぎobjectiveなし | drop/emerald目的と入力・比較単位を定義し、tier/stack根拠で別objectiveを実装。combat不明とは扱わない | P2 | not-implemented |
| Armor Health | limited runtime | observedHealthBonus必須、legacy排他、全maxHealth依存へ接続 | Power fallbackなし | 210–263のversion/roll付きcurve検証時だけfallback追加 | P1 | evidence-blocked |
| Armor DR composition | limited runtime | 35%単独、Potion Barrier単独、Protection単独、unsupported matrix | Iron Hide / Guarding / Weakeningとの一般式、Protection併用 | current traceで各family/orderを検証 | P1 | evidence-blocked |
| Armor cooldown ownership | limited runtime | external / intrinsic / enchantのsource別state、単独source | Battle Robe + Cool Down、external合成、multi-copy | current internal式または再現可能なcooldown trace | P1 | evidence-blocked |
| Armor roll / pet / party / ranged / objective | research-only / taxonomy | property facts・family分類 | 対応state/objectiveなし | 個別subsystemとmeaningful objectiveができるまでResearch-only | P2 | not-implemented |
| Armor enchant event/state families | 7 limited / 41 | Cool Down・Potion Barrier・Chilling・Health Synergy・Snowball・Cowardice・Protection、slot/Gilded/built-in source | low-HP、projectile、pet、economy、roll event | familyごとのstate/eventとunsupported境界を実装 | P2 | not-implemented |
<!-- coverage-backlog:end -->

件数は[生成Coverage report](combined-evidence-coverage.md)を参照。Looting / Prospectorは1つのobjective設計項目として数え、Enchant人口とは混同しません。

## Historical partial（変更しない）

| Phase | Status / remaining completion gate |
| --- | --- |
| 1-4 | partial — 独立実測eligible 0/5。[DPS regression](model-regression.md) |
| 2-1D | partial — 全Power proc根拠未達。[Damage events](damage-events.md) |
| 2-1F | partial — Echo repeat/cadence/interaction不足。[Temporal](temporal-enchantments.md) |
| 2-1G | partial — Enigmaゲージmapping未検証。[Soul](soul-subsystem.md) |
| 2-1H | partial — full Power・Fire stack・Void・overlap未検証。[DoT](dot-and-explosion-damage.md) |
| 2-1I | partial — Chains stack・Stunning duration/免疫等の検証未達。[Control](cc-utility.md) |
| 2-1J | partial — Pain/Dynamo pair・消費/cost解釈・roll機会損失等。[Charge](charge-consume-enchantments.md) |

## 次Phaseの比較

| 候補 | 現manifest・smokeから見た価値 | 判断 |
| --- | --- | --- |
| Phase 2-3C — Armor Expansion & State Enchant | Armor 7 / 73、Enchant 7 / 41。既存property再利用と明示stateを限定実装 | complete。Armor MVPとPhase 2-4 Coverage基盤をcloseし、次はPhase 2-5 Ranged Audit & Runtime |
| Equipment Box → Simulation UX | 既存modelだけで導線・制限説明を改善でき、Evidence依存が小さい | 第二候補。coverage blocker自体は解決しない |
| Artifact Promotion Batch | 既監査6候補のruntime価値は高い | 第三候補・Evidence待ち。2候補以上でcurrent 1.17、endgame Power、unit、主要interactionが揃うまで再開しない |

Phase 2-3CではArmor primary71 / Wiki known73 / obtainable71の母集団を維持し、Mercenary / Grim / Scale Mail / Spider ArmorとHealth Synergy / Snowball / Cowardice / ProtectionをLimited runtimeへ追加しました。Armorは7 / 73、Armor Enchantmentは7 / 41です。[Armor監査](armor-audit.md) / [設計](armor-model.md) / [batch](armor-runtime-batch.md) / [2-3C](armor-expansion-state-enchants.md)。

この順序は現在のcurated software testとEvidence blockerに基づく提案で、人気統計や実ゲームの使用頻度を測ったものではありません。

Health Synergyはcooldown-only Artifactの`sum(1 / effectiveCooldownSeconds) × resolvedMaxHealth × Tier率`によるsteady-state nominal healing capacityです。overhealと有限encounterの実発動回数は未計算で、Artifact Synergyの数値は変更しません。Grim / WitherのSoul倍率は共通ArmorState propertyから取得し、既存のflat Gatheringのみ1.5倍にします。Armor単独ではSoul収集を発生させず、pickup回数は変えません。詳細は[Phase 2-3C fix-up](armor-expansion-state-enchants.md)を参照してください。

## 候補ごとのEvidence説明

次点・パレート候補の「Evidenceと計算上の注意」には、その候補自身の登録済みEstimated parameter（根拠・条件・version・confidence）、Evidence coverage、計算上の注意を表示する。最良候補の説明を別候補へ流用しない。Estimatedが0件でも独立検証済みとは限らない。表示は既存のparameter Evidenceと評価結果を使用し、runtime support、採用方針、順位、coverageを変更しない。
