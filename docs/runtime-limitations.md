# Runtime limitations / Phase 2-1K

現行supportの正本は[manifest](../research/melee-runtime-support.json)、一覧と実数は[生成matrix](melee-runtime-support.md)。mechanicsの根拠は[research audit](../research/melee-enchantment-audit.json)。Phaseのpartial履歴と現在の機能範囲は別軸です。近接拡張はここで一旦freezeし、新Evidenceまたは明示的なobjective設計が得られるまで未登録5種を追加しません。

## 判定ルールと再確認

- Fullは現アーキテクチャ・合法装備・明示されたScenario仮定内で主要経路が完結すること。低信頼度だけではLimitedにしません。
- Limitedは固有のPower・コピー・併用境界があるもの。制限の所有者をmanifestに記録し、matrix/APIは逆方向の併用制限も表示します。Sharpness / Critical Hit / Committed等をPain・Dynamo側の未検証pairだけでLimitedにしません。
- Artifact Synergy / RampagingはFull。平均使用頻度・固定点・コピーdurationのモデルが完結しています。frame capやaction解釈のEvidence課題は[Temporal](temporal-enchantments.md)へ。
- Anima Conduit / Soul SiphonはFull。Soul gear条件はゲームの合法性で追加制限ではありません。名目回復・pickup粒度・満タン仮定は[Soul](soul-subsystem.md)へ。Enigma未実装がこの2種をLimitedにするわけではありません。
- Stunning / Freezing / GravityはFull。適用割合と持続補正を明示した独立Control経路が完結。Stunningの2秒の根拠品質は機能可用性と別です。Chainsはgame4/runtime1なのでLimited。[Control](cc-utility.md)。
- ExplodingはPower非依存でもVoid併用を明示拒否するためLimited。Fire / PoisonもVoid制限を共有し、PowerやFireコピー制限を個別保持。[DoT](dot-and-explosion-damage.md)。
- Pain / Dynamoはmodifier組合せの拒否でLimited。DynamoにはPower範囲もあります。共通4武器scopeだけを理由に全種をLimitedにはしません。[Charge](charge-consume-enchantments.md)。

## Backlogとclose gates

Priorityはproduct decisionでありEvidence confidenceではありません。P0=通常利用を大きく阻害、P1=一般的な組合せ、P2=コピー・特殊条件・別目的、P3=新しい外部Evidence待ち。`evidence-blocked`は未作業TODOではなく、現時点でコードだけではcloseできない項目です。P1/P2でもEvidence待ちは明示します。

| Enchant / subsystem | Support | What works | What is blocked | Closeに必要なEvidence / 実装条件 | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
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

Backlog行単位: **P0 0 / P1 6 / P2 6 / P3 10**。P3はすべてevidence-blocked。Looting / Prospectorは1つのobjective設計項目として数え、Enchant人口とは混同しません。

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
| Phase 2-3C — Armor Expansion & State Enchant | Armor 7 / 73、Enchant 7 / 41。既存property再利用と明示stateを限定実装 | complete。Armor MVPをcloseし、次はRanged runtime |
| Equipment Box → Simulation UX | 既存modelだけで導線・制限説明を改善でき、Evidence依存が小さい | 第二候補。coverage blocker自体は解決しない |
| Artifact Promotion Batch | 既監査6候補のruntime価値は高い | 第三候補・Evidence待ち。2候補以上でcurrent 1.17、endgame Power、unit、主要interactionが揃うまで再開しない |

Phase 2-3CではArmor primary71 / Wiki known73 / obtainable71の母集団を維持し、Mercenary / Grim / Scale Mail / Spider ArmorとHealth Synergy / Snowball / Cowardice / ProtectionをLimited runtimeへ追加しました。Armorは7 / 73、Armor Enchantmentは7 / 41です。[Armor監査](armor-audit.md) / [設計](armor-model.md) / [batch](armor-runtime-batch.md) / [2-3C](armor-expansion-state-enchants.md)。

この順序は現在のcurated software testとEvidence blockerに基づく提案で、人気統計や実ゲームの使用頻度を測ったものではありません。
