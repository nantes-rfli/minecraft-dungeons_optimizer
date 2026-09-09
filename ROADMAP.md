# Roadmap

## Current project target

手持ちの近接・防具・遠距離・アーティファクトを登録し、Evidenceとlimitationsを明示しながら、火力・回復・防御・Controlなどの目的別推奨buildを再現可能に比較できる状態を目指します。

製品バージョンは運用せず、Phase / Milestone / Current state / Git historyで継続的に更新します。**current implementation checklist** は **105 / 118（89%）**。Phase 6.7の3項目、6.8の5項目、6.9の6項目を追加し、そのうち12項目を完了。Phase 6.8D/Eの2項目は未完了・保留。future milestonesとFuture Expansionは次の独立した実装・調査単位であり、分母に含めません。これはチェック項目の完了率であり、精度や作業量の達成率ではありません。公開前にaudit・`npm test`・tsc・lint・buildと主要E2Eを検証します。

## Phase 0 — Optimizer Core（5 / 5 完了）

- [x] 個体別の手持ち・候補エンチャント・Power入力
- [x] 確定済みスロット・金色エンチャント Tier I / II / III の入力
- [x] 全探索・目的別シナリオ・Pareto前線
- [x] 効果別の寄与度・根拠・信頼度表示
- [x] localStorage・version付きJSON入出力

## Phase 0.5 — Core Model Integrity（7 / 7 完了）

- [x] tier・sourceを保持するEnchant選択モデル
- [x] Enchantment stackingと重複Build制御
- [x] Artifact stacking behavior
- [x] Build依存kill rateとCombat State境界
- [x] 主要Evidenceを反映するモデル信頼度
- [x] Weapon Power未反映の明示警告
- [x] Golden Testと設計ドキュメント更新

完了条件: Build依存kill rate、Enchant / Artifact stacking、tier保持、主要Evidenceの信頼度、外部実測値テストが一貫した計算経路で動作すること。

## Phase 0.5.1 — Core Model Cleanup（3 / 3 完了）

- [x] Radianceをコピー別係数`100% / 75% / 50% / 25%`でstack
- [x] Gilded Tier I / II / III の編集・保存・JSON入出力
- [x] `directWeaponKillsPerSecond`をCombat Stateで一元算出

完了条件: Radiance stacking、Gilded Tier、Leeching / Guarding Strikeの直接撃破依存が、同じ型・保存・評価・Evidence経路で動作すること。

## Phase 1A — Melee Attack Profile Audit（1 / 1 完了）

- [x] 1.17.0.0の入手可能な近接武器82件を登録・分類し、静的auditデータ、Validator、再生成可能なcoverageレポートを作成

完了条件: 全82武器が `exact / verified-shared / partial / inferred / missing` のいずれかに分類され、公開情報のcoverageと未解決一覧を `npm run audit:melee` で再現できること。現在は `exact 76 / partial 6`、strict runtime-readyは92.7%。research結果だけを根拠にruntime catalogや既存3武器のprofileは変更しない。

## Phase 1 — Accuracy（3 / 4）

- [x] 3武器の公開per-hit timingをruntime登録し、HPSをduration合計から導出（独立実機測定は将来のcross-checkとして継続可能）
- [x] Power 50〜263のAnchor curveと1.17.0.0内部Power rating比を分離し、W/Gモデルを29 sampleでcross-validation（version不明fixtureとの最大45.06%差をmedium-confidence caveatとして保持）
- [x] 虚無の一撃を公開測定に基づく不連続curve（付与hit 1倍、armed minimum 1.25倍、3.6秒でTier III 7倍、5秒で消滅）へ置換し、3武器のper-hit interval・再適用・戦闘時間・attack speedをruntimeへ反映
- [ ] 実測値による回帰テストと誤差範囲の表示（公開候補10件を監査、eligible 0 / 5。provenance・validator・中央値を含む統計・pending/available UIまで実装済み）

完了条件: 対応する3武器について、独立した公開ゲーム内実測を最低5件採用し、モデル出力の誤差統計とP90参考範囲を表示できること。現在は公開条件を再現できるsampleが0件のため、Phase 1 Accuracyは3 / 4を維持する。

## Phase 2 — Equipment Coverage（24 / 34）

### Melee runtime summary

<!-- runtime-support:start -->
Population 33 · Catalog runtime 28 / 33 · Full 19 · Limited 9 · Research-only 5 · Broad Power 22 · Power-limited 6
<!-- runtime-support:end -->

<!-- artifact-support:start -->
Artifacts · Audited source population 45 · Catalog runtime 3 / 45 · Full 2 · Limited 1 · Research-only 42
<!-- artifact-support:end -->

<!-- armor-support:start -->
Armor · Audited population 73 · Catalog runtime 7 / 73 · Full 0 · Limited 7 · Research-only 66
<!-- armor-support:end -->

Artifactはprimary 44 / secondary表示45 / common 44 / secondary-only Corrupted Seedsを再現可能に照合し、project監査母集団を正規化和集合45件と定義しました。raw game ID全体の網羅性は主張しません。[監査](./docs/artifact-audit.md) / [対応表](./docs/artifact-runtime-support.md) / [Control batch](./docs/artifact-control-debuff.md) / [2-2D batch](./docs/artifact-event-healing-control.md) / [2-2E Evidence](./docs/artifact-evidence-acquisition.md) / [Evidence matrix](./docs/artifact-evidence-matrix.md) / [curve分析](./docs/artifact-curve-analysis.md) / [型・回帰](./docs/artifact-model.md) / [次Phase判断](./docs/artifact-expansion-plan.md)。

Armorはprimary71 / Wiki known73 / obtainable71を照合し、7件をLimited runtime化しました。Armor Enchantmentは41件すべてをactual roll入力でき、7件をLimited runtime対応。Healthはobserved card値を主経路、Power-only fallbackはありません。[監査](./docs/armor-audit.md) / [対応表](./docs/armor-runtime-support.md) / [Enchant監査](./docs/armor-enchantment-audit.md) / [2-3C](./docs/armor-expansion-state-enchants.md)。

近接25〜30種の親目標はmeaningful runtimeで達成。全33種完全対応ではありません。[support matrix](./docs/melee-runtime-support.md) / [limitations](./docs/runtime-limitations.md)。
以下のpartialは歴史的Phaseのfull completion gate未達であり、現行support levelとは別軸です。

### Historical phases / parent goals

- [x] Phase 2-1A: 1.17.0.0の近接エンチャント33種を監査・分類し、runtime実装順序とunsupported境界を確定
- [x] Phase 2-1B: Sharpness / Unchanting + Enemy Composition（直接近接modifier・敵割合UI・Evidence・7 / 33 runtime対応）
- [x] Phase 2-1C: Refreshment / Weakening状態モデル（PotionState・追加回復容量・被ダメージcoverage・9 / 33 runtime対応）
- [ ] Phase 2-1D partial: DamageEvent foundation + Shockwave / Swirling / Thundering（12 / 33、3種はPower範囲限定。全50–263の根拠不足）
- [x] Phase 2-1E: Ambush / Smiting / Committed（catalog 15 / 33、広域12・範囲限定3）
- [ ] Phase 2-1F partial: Artifact Synergy / Rampagingの限定Temporal State（catalog 17 / 33、広域14・範囲限定3、Echo research-only）
- [ ] Phase 2-1H partial: Fire Aspect / Poison Cloud / Exploding（catalog22 / 33、広域17・範囲限定5、stack/Void/overlap未検証）
- [ ] Phase 2-1G partial: Soul Scythe / Soul subsystem / Anima / Siphon（catalog 19 / 33、広域16・範囲限定3、Enigma mapping未検証）
- [ ] Phase 2-1I partial: Control第4軸 + Chains / Stunning / Freezing / Gravity（catalog26 / 33、広域21・限定5、stack/duration/免疫制限）
- [ ] Phase 2-1J partial: Pain Cycle / Dynamo（catalog28 / 33、広域22・限定6、HP cost/roll flow/合成制限）
- [x] Phase 2-1K: Melee Runtime Consolidation（分類・manifest・監査・表示・実用性回帰）
- [x] 近接エンチャントを25〜30種類へ拡張（meaningful runtimeで達成、全33種完全対応ではない）
- [x] Phase 2-2A: Artifact Audit & Runtime Foundation（primary44 / secondary45 / union45を照合）
- [x] Phase 2-2B: Artifact Control & Debuff Batch（Shock Powder Limited、Fishing Rod / Gong research-only）
- [x] Phase 2-2C: 有限Soul Scheduler + Soul Artifact監査（3候補はEvidence blocker付きResearch-only）
- [x] Phase 2-2D: Event / Healing / Control Batch（3 family分離、3候補はblocker付きResearch-only）
- [x] Phase 2-2E: Artifact Evidence Acquisition / Curve Extraction（公開Evidence snapshot・hold-out検証・promotion判断を再現可能化、6候補はResearch-only）
- [ ] アーティファクトを10〜15種類へ拡張（Evidence gate待ち・他Phaseと並行。current 1.17 numeric basis・endgame Power・主要unit/interactionがpromotion条件）
- [x] Phase 2-3A: Armor Audit & Runtime Foundation（primary71 / Wiki known73 / obtainable71 / runtime0を照合）
- [x] Phase 2-3B: Armor Core Runtime Batch（Armor 3 / 73、Armor Enchant 3 / 41）
- [x] Phase 2-3C: Armor Expansion & State Enchant（Armor 7 / 73、Armor Enchant 7 / 41）
- [x] 防具・防具エンチャントをMVP coverageとしてモデル化
- [x] Phase 2-4A: Common Coverage / Evidence Read Model
- [x] Phase 2-4B: Combined Coverage Snapshot / Report
- [x] Phase 2-4C: Blocker / Priority Aggregation
- [x] Phase 2-4D: Measurement Protocol Foundation
- [x] Phase 2-4E: Read-only Coverage Dashboard
- [x] Phase 2-4F: Coverage Audit / CI
- [ ] Phase 2-5A partial: Ranged Population / Taxonomy（71種照合、詳細・日本語名のEvidence待ち）
- [ ] Phase 2-5B partial: Attack / Projectile Model（観測入力対応、独立cadence実測待ち）
- [ ] Phase 2-5C partial: Ranged Enchantment Audit（38/41照合、channel・stack/Tier未解決）
- [x] Phase 2-5D: Observed Ranged Runtime MVP（Bow / Crossbow Limited、3 Enchant）
- [x] Phase 2-5E: Inventory / Optimizer / Explanation / JSON v2
- [x] Phase 2-5F: Common Coverage / Measurement / CI Consolidation

Phase 2-5全体はpartialです。MVPは利用者のneutral damage・完全発射周期・矢数と明示時間配分で2 archetypeを同じAPIから比較します。独立実測や不明なmechanics・日本語名を捏造せず、[残るclose条件](./docs/ranged-runtime.md)と[監査](./docs/ranged-weapon-audit.md)へ記録しました。Armor synergyは自動昇格しません。

完了条件: 主要な近接・防具・遠距離の組み合わせを、同じ `evaluate` / `optimize` APIで評価できること。

## Phase 3 — Public Use Readiness（6 / 6）

一般利用に耐えるための安定性・性能・操作性の整備。仕様を自由に変えても安全に追従できる開発基盤を作ります。UI・schema migration・機能削除・実験機能・モデルの変更を今後も可能にします。

- [x] Phase 3A: Worker / Cancel / Responsiveness（候補数・時間上限とstale結果破棄）
- [x] Phase 3B: Performance Baseline（synthetic small / medium / large、候補数・時間・ブラウザ応答性）
- [x] Phase 3C: Major Flow E2E（全装備・Scenario・JSON・復元・エラー・遠距離なし）
- [x] Phase 3D: Accessibility（主要状態、labels、keyboard、table、a11y自動監査と残制限）
- [x] Phase 3E: Bundle / Loading（測定、Methodology遅延読込、Worker分離）
- [x] Phase 3F: Data / Evidence Update Workflow（更新手順とGitによる変更追跡）

検証方法・性能測定・残る制限は[Public Use Readiness](docs/public-use-readiness.md)を参照。一般公開の実行は別milestoneです。

## Phase 3.5 — Personal UX Refinement（6 / 6）

本人の日常利用を主目的に、情報量の多い単一画面を役割別の作業・参照画面へ分離しました。計算モデル、schema、runtime supportは変更していません。

- [x] Phase 3.5A: Information Architecture / Navigation
- [x] Phase 3.5B: Inventory / Box UX
- [x] Phase 3.5C: Optimization UX
- [x] Phase 3.5D: Game Data Browser
- [x] Phase 3.5E: Model Explorer
- [x] Phase 3.5F: Storage / Utility consolidation

設計判断とroute責務は[Personal UX information architecture](docs/personal-ux-information-architecture.md)を参照。一般公開は行わず、本人限定で実利用後にPublic Availabilityを判断します。

## Phase 3.6 — UX Fix-up（6 / 6）

本人の実利用で判明した分かりづらさを対象に、既存の計算を変えず結果理解と参照導線を改善しました。

- [x] Recommended BuildをMelee / Armor / Ranged / Artifactの完成セットとして表示
- [x] Enchantの通常枠・Gilded・Built-inと次点候補の差分を明示
- [x] Data summaryをtop-levelカテゴリと一致させ、Enchant 115の定義を明示
- [x] Model Evidence / Accuracy overviewと詳細Methodology導線
- [x] 結果・Data summary・Evidence overviewのtargeted component分離
- [x] 主要UX・route・keyboard・axe回帰

Inventory JSON、Worker最適化、検索guard、中止、scenario、runtime manifest、数値モデル、Evidence confidenceは変更していません。

## Phase 4 — Coverage Source Harvest（4A Infrastructure / 4B External Extraction、6 / 6）

既存カテゴリ監査を正本として、1.17.0.0 game-file由来公開DB、公式patch / 最終更新境界、Minecraft Wiki、再現条件を評価できる定量的な公開調査をread-only Evidence indexへ正規化しました。

- [x] 4A: 7カテゴリ386件の監査済み母集団を重複なく正規化
- [x] 4B: dungeons.tools詳細386件からdirect / normalized claimをproperty単位で抽出
- [x] sourceType、Fact version semantics、property-level source attemptを分離
- [x] property coverage・GapのBefore / Afterと未取得理由を生成
- [x] snapshot schema・参照・重複・競合・driftのauditとCI接続
- [x] Data BrowserでKnown propertyごとのsource / versionを表示

生成物は[Source Harvest report](./docs/source-harvest.md)と[machine-readable dataset](./research/source-harvest.json)。`npm run harvest:sources`で再生成し、`npm run audit:source-harvest`で既存監査との母集団・source参照・生成driftを検証します。runtime support、Optimizer候補・score、Inventory JSON、Worker、Evidence confidenceは変更していません。

## Phase 5 — Evidence Gap Map & Measurement Protocol（6 / 6）

Source Harvestを変更せず、2,105 Gapを「なぜ不足しているか」と「どう解決するか」の別軸で整理しました。

- [x] Source Harvestの2,105 GapをGap Causeを維持したままResolution Classへ分類
- [x] 全Gapを再利用可能なTask Familyへ束ね、implementation / objective familyを分離
- [x] Observe / Measure / Experimentのcanonical protocolと旧ID mappingを定義
- [x] acquisition cost・runtime relevance・unlock effectのPhase 6 read modelを生成
- [x] Gap・family・protocol・生成driftとPhase境界をaudit
- [x] 人間向けGap MapとMeasurement Protocol reportを生成

生成物は[Evidence Gap Map](./docs/evidence-gap-map.md)、[Measurement Protocol](./docs/measurement-protocols.md)、[machine-readable map](./research/evidence-gap-map.json)。2,105 / 2,105 classified、unclassified 0で、個別Gapごとのprotocol乱造を避けて14本へ束ねています。Priority、ownership signal、Research Quest、Evidence投稿、runtime昇格は未実装です。

## Phase 6 — Coverage Priority（6 / 6）

Phase 5の2,105 Gapを、runtime unlock・rank sensitivity・ownership・coverage・near-unlock・acquisition easeの明示weightで順位付けしました。

- [x] 全2,105 GapへGlobal / Personal score、P0〜P3、human-readable reasonを付与
- [x] 6 objectiveのanalysis-only bounded fixtureでwinner / Top3 sensitivityを分類
- [x] 386 EntityのUnlock Bundle、near-unlock、coverage gain、implementation critical pathを生成
- [x] Protocol estimatedMinutesへsetup・反復・controls・variantsを補正
- [x] synthetic InventoryからOwned Research QueueとProtocol別groupを生成
- [x] 全件・重複・NaN・orphan・tier・determinism・runtime不変境界をaudit

生成物は[Coverage Priority](./docs/coverage-priority.md)と[machine-readable model](./research/coverage-priority.json)。GlobalとPersonalは混ぜず、本人Inventoryはrepoへ保存しません。same-family ownershipはSource Harvestで確認できる実際のfamily relationだけを使います。Rank sensitivityはbounded proxyとして明示し、weight stabilityとともにPriority confidenceへ反映します。これはEvidence confidenceでもruntime値でもなく、Research Quest UI・Evidence入力・Runtime Promotionは未実装です。

## Phase 6.5 — Direct Game Data Research（6 / 6）

Minecraft Dungeons 1.17.0.0のローカル展開済みgame assetsを直接調査し、公開情報では不足していたPropertyを再現可能な一次データとして抽出・記録します。既存Gapとの照合まで行いますが、このPhase単独ではruntimeを自動昇格しません。

- [x] 6.5A — Game Data Inventory & Asset Map
- [x] 6.5B — Source Boundary / Provenance
- [x] 6.5C — UE4 Asset Extractor Foundation
- [x] 6.5D — Representative Semantic Mapping
- [x] 6.5E — Bulk Harvest & Gap Reconciliation
- [x] 6.5F — Audit / Report / Coverage

6.5AではQuickBMS source tree全体をpath・filename・extension・sizeだけで棚卸しし、[Game Data Inventory](./docs/game-data-inventory.md)とmachine-readableな[summary](./research/game-data-inventory.json)・[Asset Index](./research/game-data-asset-index.json)を生成します。6.5Bでは[Source Provenance](./docs/game-data-source-provenance.md)と[machine-readable artifact](./research/game-data-source-provenance.json)にdataset identity、verification status、Evidence layer、confidence軸、raw data非commit境界、parser契約を固定しました。6.5Cでは[UE4 Asset Extractor](./docs/game-data-extractor.md)と[machine-readable samples](./research/game-data-extractor-samples.json)を追加し、対象legacy packageのHeader、Name Map、Import/Export、CDO、nested Propertyをsemantic interpretationなしで抽出します。6.5Dでは[Representative Semantic Mapping](./docs/game-data-semantic-mapping.md)と[machine-readable mappings](./research/game-data-semantic-mappings.json)を追加し、5カテゴリ9件のraw factを独立したresearch-only semantic layerでaccepted / tentative / unresolved / rejectedへ分類しました。6.5Eでは[Bulk Harvest](./docs/game-data-bulk-harvest.md)と[Gap Reconciliation](./docs/game-data-gap-reconciliation.md)を追加し、1,026候補を走査して1,018件をparse、891件のcompact factを抽出し、Phase 5 baseline 2,105 Gapを17 closed / 2,088 remainingへ監査可能に分類しました。runtime promotionは行わず、raw assetsとfull parse treeはGit管理外に保ちます。

## Phase 6.6 — Game Data Model Alignment & Reconciliation（8 / 8）

- [x] Entity Identity Alignment
- [x] Canonical Research Property Registry
- [x] Property Alias / Rename Alignment
- [x] Structural Reference Normalization
- [x] Game-only / Missing Expected Property Review
- [x] Semantic Rule Alignment
- [x] Gap Reconciliation Regeneration
- [x] Phase 7 Handoff / Phase 6.7 Decision

[Model Alignment](./docs/game-data-model-alignment.md)と[Canonical Registry](./docs/game-data-canonical-properties.md)で3層を固定しました。633件の未同定factのうち49件を解決し、584件を未解決として根拠とともに保持。33 research propertyを登録し、17 closed / 22 partial / 38 evidence-added / 2,088 remainingを再生成しました。新規closeは0。Phase 7へObserve 303 / Measure 498 / Experiment 506の計1,307件を証拠付きでhandoffします。当時はPhase 6.7をhigh potential 0のoptional backlogと判断しましたが、その後の追加調査を以下のPhase 6.7〜6.9へ反映しています。runtime値・scoreは変更していません。

## Phase 6.7 — ゲームデータ起点の取得可能性調査（3 / 3）

- [x] 6.7A — 全uassetの構造棚卸し
- [x] 6.7B — 数値・表・関数・native境界の代表試験
- [x] 6.7C — Optimizerへの対応と次段階の判断

[取得可能性調査](./docs/game-data-capabilities.md)で45,311 uasset、22,603 Function exportと非CDOの数値・DataTableを確認しました。全効果の解読ではなく、取得可能性の調査が完了した状態です。

## Phase 6.8 — 取得と意味の検証（3 / 5、D/E保留）

- [x] 6.8A — 追加PAKの全件比較
- [x] 6.8B — 独立readerの代表検証
- [x] 6.8C — 代表参照・処理経路の検証
- [ ] 6.8D — native計算の同定（起動処理の条件付き追跡まで、保留）
- [ ] 6.8E — 実効timing / notifyの検証（攻撃設定・代表通知の読解まで、保留）

[取得検証](./docs/game-data-validation.md)では47 PAK・134,799エントリ、既存抽出物との差1,520件を記録。[攻撃設定](./docs/game-data-timing.md)では82 Instance・293 variantと通知を整理しました。[処理境界](./docs/game-data-mechanic-boundaries.md)と[native起動処理](./docs/game-data-native-stage2.md)では最初の圧縮層を独立decoderで検証し、条件付きで起動処理を追跡しましたが、ゲーム本体の戦闘式には未到達です。D-1は完了、D-2は未完了、D-3は未着手。設定値を実効hit列とみなさず、全native復元を後続Phaseの必須条件にしません。

## Phase 6.9 — 外部Evidenceとモデル再設計の研究比較（6 / 6）

- [x] 6.9A — 外部研究・訂正・条件と現行モデルとの差分整理
- [x] 6.9B — Evidence / event / modifier / Scenario契約と段階的移行方針
- [x] 6.9C — 版付きEvidence adapter・関係・採用判断の検証
- [x] 6.9D — Attack / Event比較（集計rate・実効event・攻撃設定の分離）
- [x] 6.9E — DR / Modifier比較（family・joint state・競合・順位感度）
- [x] 6.9F — Scenario / Optimizer比較（有限damage・ownership・実回復・目的別順位）

[外部研究](./docs/external-community-research.md)、[再設計ADR](./docs/adr/0001-external-evidence-model-redesign.md)、[Evidence adapter](./docs/evidence-adapter.md)、[Attack / Event](./docs/attack-event-comparison.md)、[DR / Modifier](./docs/dr-modifier-comparison.md)、[Scenario / Optimizer](./docs/scenario-optimizer-comparison.md)を実装・検証済みです。完了は研究比較と境界の明文化を指し、全再設計・runtime移行・ゲーム内精度検証の完了ではありません。same-origin holdoutや合成Scenarioは独立実測の代わりにしません。

## 現在の作業位置（2026-09-10再検討）

**次はPhase 8AのEvidence受入・検証基盤と、8Bの限定した外部Evidence取得です。** Phase番号は履歴として維持し、実行順を **8A → 8B → 必要な残余だけ7 → 8C → 合格した単位だけ9** とします。外部Evidenceだけで検証できる単位はPhase 7を待たず8Cへ進めます。

Phase 6.9で比較経路は揃いました。現在の律速は新しい比較器の数ではなく、game version・観測条件・独立性・適用範囲の不足です。したがってResearch Questの大規模UI、全効果の一括移行、native全面復元を先行させず、既存の版付き台帳・adapter・測定protocolを再利用します。

### 維持する基準値

- Phase 6.6時点のbaselineは17 closed / 2,088 remaining。Observe 303 / Measure 498 / Experiment 506の計1,307件は**当時のhandoff母集団**であり、最新の実測待ち件数ではありません。
- Phase 6.7〜6.9によるruntime昇格・新規Gap closeは0。昇格可能と検証された機能単位はまだありません。
- Phase 1 Accuracyは3 / 4、独立DPS回帰はeligible 0 / 5。Phase 2のpartialとruntime supportは従来のgateを維持します。
- 次の取得前に、外部Evidenceで解消可能な項目・実装不足・実測必須を再照合します。旧GapやPriorityを上書きせず、revisionと差分を残してqueueを更新します。

### 次に検証する対象と順序

これは実施順の提案であり、既存のP0〜P3 scoreを再計算した結果ではありません。所有装備との関係、順位への影響、条件の回収可能性を8Bで確認し、最初の1単位を選定します。

| 順序 | 対象 | この順序にする理由 | 取得・検証の通過条件 |
|---|---|---|---|
| 1 | 限定DR / modifier組合せ | 6.9Eで順位反転を確認し、対象を狭めて比較できる | 版・装備・damage channel・activation・丸めの条件を回収し、独立holdoutを確保。Ghost / Guarding競合とDynamo配置は解決するか明示的に対象外へ限定 |
| 2 | 既存4武器のAttack / Event | Voidやprocの前提を直接改善できる | buff・測定法・版・対象を揃えた独立event列。action / hit / proc / finisherを区別し、aggregate HPSから時刻列を捏造しない |
| 3 | 有限Scenario / Healing | ownershipとoverkillにより推奨が変わり得るが、観測依存が多い | target switching・同frame順・final blow・欠損HP/overheal・被damageを観測。Objective targetはゲーム規則と分けて妥当性を検証 |
| 条件付き | Claymore / Sawblade、残るArmor / Ranged / Artifact | 新規coverageより、採用条件の成立を優先 | mechanic・Power・state/objectiveの必要条件が揃った単位から扱う。Artifact 10〜15種はEvidence gate待ちを維持 |

1単位の出口は、採用範囲付きの「検証合格」、不足Evidenceと次の取得手順付きの「保留」、理由付きの「不採用」のいずれかです。取得件数やテスト通過数だけでは昇格しません。

### Current blockers

Phase 1-4は独立実測0/5でevidence-blocked。2-1D / F / G / H / I / Jは元のcompletion gateを維持してpartial。
P0〜P3とEvidence blockerは[生成Coverage report](./docs/combined-evidence-coverage.md)で横断確認できます。[制限・優先度・close条件](./docs/runtime-limitations.md)の表はstructured backlogから生成します。
`[ ]` は未達で、未実装とは限りません。evidence-blockedとnot-implementedの区別は同backlogを参照。

UX backlog（今回未実装）: 次点候補では1位と異なるEnchantを優先して表示できる選択肢を検討する。順位・scoreの意味を変えるため、Phase 4のEvidence作業には含めません。

### 保留と再開条件

- Phase 6.8D/E: 外部観測・限定実測で解消できず、順位や昇格を妨げる具体的な問いが残る場合だけ再開。対象関数・入力条件・終了条件を先に定義します。
- Phase 2-5A/B/Cと近接partial: 新Evidenceが元のcompletion gateを満たした範囲だけ更新します。未対応効果を0点や倍率1で登録しません。
- Public Availability、New Drop Comparison、エンジン汎用化・別ゲーム展開: 本人の実利用と検証済みcoverage改善を優先し、確定した次Phaseにはしません。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- 現行supportはmanifestを変更し、`npm run audit:runtime-support` で検証・summary/matrix再生成する。
- Historical phaseのfull completion gateをsupport整理の都合で書き換えない。
- 新しい未対応事項はlimitations backlogへ記録し、未対応を0点として登録しない。

## Future milestones（チェックリスト進捗と分離）

### Phase 8 — Evidence Capture & Validation（次の重点）

**8A — 受入・検証の最小基盤。** 6.9Cの台帳とadapterを再利用し、SourceRevision・claim・version・装備/Power・条件・単位・反復・画像/動画locator・originを受け入れる契約を定義します。外部と自前で同じ検証規則を使い、欠落・訂正・競合・転載・calibration/holdoutの混用を理由付きで判定。保存・再読込・異常入力・revision追跡の検証が完了条件です。大規模な投稿UIは必須にしません。

**8B — 外部Evidence取得と残余queue再評価。** 上表から最初の1単位を選び、公開観測の条件と独立性を回収します。6.6の1,307件と現在のblockerを照合し、外部解消・限定実測・実装不足・保留へ振り分け、元ID・判断理由・差分を記録できることが完了条件です。新しい取得結果なしにGapをcloseしません。

**8C — 機能単位の妥当性検証。** calibrationと独立holdoutを分離し、許容領域・誤差基準を検証前に設定。旧新モデルの同条件比較、順位感度、再現性を確認し、採用/保留/不採用のAdoptionDecisionを保存します。same-origin holdout、合成probe、1件の自己観測だけでVerifiedにしません。Phase 1の独立DPS回帰5件gateは別に維持します。

### Phase 7 — Personal Research Quest（8Bの残余に限定）

**7A — 所有装備に結びつく最小queue。** 再評価済みの残余をactual inventoryと既存protocolへ結びつけ、必要装備・条件・所要時間・何が解決するかを提示。所持していない装備や外部取得済みの課題を本人の必須作業にしません。

**7B — 任意の限定実測。** Observe / Measure / Experimentを選び、スキップ・中断・再開できる導線と、8Aへ渡せる観測記録を用意します。実データを1件受け渡して8Cで検証できることが最小完了条件です。queue消化率をモデル精度と扱いません。

### Phase 9 — Runtime Promotion Pipeline（8C合格単位ごと）

**9A — 最初の限定移行。** AdoptionDecisionが合格した1単位について許容範囲をvalidatorへ反映し、既存`evaluate / optimize`・Inventory v2・actual rolls・Worker中止・探索上限を維持して導入。runtime manifest、Evidence、説明、Coverage、回帰を同期し、旧新差分・必要なE2E・性能とrollback可能なcommitを確認します。研究用比較器をそのまま本番へ一括接続しません。

**9B — 反復可能な昇格手順。** 9Aで確認した手順を次の単位へ適用し、Research-only → Limited → Fullをそれぞれのgateで判断。合格したモデル変更でもGap closeや装備数の増加を自動的には主張しません。関連audit・`npm test`・tsc・lint・buildを通し、サイトに影響するcommitだけ既存の本人限定Sitesへ反映します。

### Public Availability — 保留

本人が実利用して「普通に便利」と感じられるCoverageとUXになった時点で再判断します。今回の本人限定サイトを共有・一般公開へ変更しません。

### Future candidate — New Drop Comparison / Keep-Salvage

新しく拾った装備を仮追加し、現在Bestとの差、最大改善率、火力・防御・回復・Controlの変化から残す価値を判断する候補です。Phase 10以降として確定しません。

## Future Expansion（現在の進捗に含めない）

### Future Expansion A — Optimizer Engine Generalization

Dungeons 1で実証したGame/Evidence adapter、Equipment/Effect、Build、Scenario、Objective、Optimizer、Coverage/Evidence、Measurementを段階的にゲーム固有実装から分離。Phase 2-5で全面汎用化を先行しません。

### Future Expansion B — Minecraft Dungeons II

汎用化の最初の実戦対象。新装備slot/effect、matchmaking・broader user base、新データ取得パイプラインへの適用を検討します。

### Future Expansion C — 異なるゲームでの汎用性検証

Monster Hunter系を候補として記録。似たDungeons間だけでなく異なる装備設計で汎用性を検証します。現時点では実装対象外です。
