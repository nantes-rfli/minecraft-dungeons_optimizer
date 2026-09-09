# Roadmap

## Current project target

手持ちの近接・防具・遠距離・アーティファクトを登録し、Evidenceとlimitationsを明示しながら、火力・回復・防御・Controlなどの目的別推奨buildを再現可能に比較できる状態を目指します。

製品バージョンは運用せず、Phase / Milestone / Current state / Git historyで継続的に更新します。**current implementation checklist** は **93 / 104（89%）**。Phase 6.5の6項目とPhase 6.6の8項目を完了。future milestonesとFuture Expansionは次の独立した実装・調査単位であり、分母に含めません。これはチェック項目の完了率であり、精度や作業量の達成率ではありません。公開前にaudit・`npm test`・tsc・lint・buildと主要E2Eを検証します。

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

[Model Alignment](./docs/game-data-model-alignment.md)と[Canonical Registry](./docs/game-data-canonical-properties.md)で3層を固定しました。633件の未同定factのうち49件を解決し、584件を未解決として根拠とともに保持。33 research propertyを登録し、17 closed / 22 partial / 38 evidence-added / 2,088 remainingを再生成しました。新規closeは0。Phase 7へObserve 303 / Measure 498 / Experiment 506の計1,307件を証拠付きでhandoffします。Phase 6.7はhigh potential 0でoptionalのbacklogに留め、正式追加しません。runtime値・scoreは変更していません。

## 現在の作業位置

### 現在の優先方針 — 外部研究を先行（2026-09-09）

ユーザーの方針変更により、**外部研究の取得・条件照合 → 再設計 → 必要な残余だけ実測/native**へ順序を変更しました。以下の6.7〜6.8D/E節の「次はnative」は各調査時点の履歴です。6.8D/Eは未完了のまま保留し、native復元をPhase 6.9の必須条件にしません。

[外部研究の整理と追加調査](./docs/external-community-research.md)と[再設計ADR](./docs/adr/0001-external-evidence-model-redesign.md)を追加しました。31 source・13 claimを整理し、Pancakecatへの帰属が紹介されているHPS表55行×4条件を取得。作者訂正、DR合成の具体例、Dynamoの分類衝突を保持し、既存4武器のHPS差とCommitted連続極限の既存実装を照合しました。研究用DR/有限hit比較とoffline auditも追加しています。

Phase 6.9D Attack/Event comparisonまで完了。[比較結果](./docs/attack-event-comparison.md)に6 profileのentity mapping、HPS条件、aggregate rate・event sequence・attack definitionの分離、未使用観測との比較を記録しました。次は6.9EのDR動画の観測条件・modifier適用範囲の比較です。全再設計・runtime移行の完了ではなく、runtime昇格・Gap closeは0。内部研究・開発用検証だけの変更のため、アプリ内ロードマップ・score・Sitesは更新しません。

### Phase 6.7 — ゲームデータ起点の取得可能性調査（2026-09-07）

[取得可能性調査](./docs/game-data-capabilities.md)を追加しました。6.7A（全uassetの構造棚卸し）、6.7B（数値・表・関数・native境界の代表試験）、6.7C（Optimizerへの対応と判断）は完了。全効果の解読やruntime昇格の完了ではありません。45,311 uassetを走査し、22,603 Function export、既存保存ルール外の数値、非CDOのDataTable行を確認しました。重要な効果にはnative親への参照があり、現在のツリーに実行ファイルはありません。

今後の推薦は **Phase 6.8（取得器・継承・処理経路の検証）→ Phase 6.9（再設計範囲の判断）** です。Phase 6.6当時の「6.7はoptional、次は7」という推薦を今回の追加調査により更新します。歴史的成果物とGap数は保持し、Phase 7〜9は必要な実測・検証・昇格の計画として残します。今回の変更は内部調査資料のみで、アプリ内ロードマップ・計算・データは変更していません。

### Phase 6.8 — 取得と意味の検証（2026-09-08、進行中）

[検証結果](./docs/game-data-validation.md)と[観測JSON](./research/game-data-validation/README.md)を保存しました。6.8A（追加PAKの全件比較）、6.8B（独立readerの代表検証）、6.8C（代表参照・処理経路）は完了。47 PAK・134,799エントリを検証し、既存抽出物との内容差1,520件を保持しています。97代表アセットのバイナリ往復一致、809 Functionのデコード、25数値・4表・4カーブの読み取りを確認しました。既存readerが見落としていた3組のUI Text差分も記録しました。

**次は6.8D（native計算）と6.8E（timing/notify）です。** 追加ZIPに実行ファイルはありますが、native計算を読めるコード領域は未確立。主要効果の式を復元したとは扱いません。Phase 6.8全体と6.9の再設計判断は未完了です。アプリコード・runtimeデータは変更していません。

### Phase 6.8E — 攻撃設定・通知の追加調査（2026-09-08、進行中）

[攻撃タイミング調査](./docs/game-data-timing.md)を追加しました。383アセット・384回の独立reader往復一致を確認し、82 Instanceの293 variant、288 animation export、671通知を整理。連続ダメージ・解放時の発動契機・キャンセル上書きが明示的に存在するため、単一の攻撃速度へ潰さず保持する設計が必要です。nativeの時間適用・通知の受信・実効ヒット列は未確定。6.8Eは設定と代表通知の読解まで進行、6.8D/E全体と6.9は未完了です。runtime・アプリ内ロードマップは変更していません。

### Phase 6.8D/E — 設定使用箇所・native静的展開（2026-09-08、進行中）

[適用経路と到達点](./docs/game-data-mechanic-boundaries.md)を追加。時間設定を含む201アセット・711関数を調べ、今回の名前・明示参照探索では戦闘側の適用処理は未確定。ChainswordのActive/Break Effect参照も確認しました。exeを実行せず最初の圧縮層を15,360,000 byteへ復元し、別decoderと完全一致。ただしゲーム本体のコード・戦闘式は未復元です。6.8D/Eは未完了を維持し、通常コンボ・連続攻撃・キャンセルの具体的な実測計画を保存しました。未確定境界を保持したPhase 6.9の設計案には着手可能と判断し、実装置換はまだ行いません。

### Phase 6.8D — native起動処理の条件付き追跡（2026-09-09、進行中）

[native起動処理の調査](./docs/game-data-native-stage2.md)と[観測JSON](./research/game-data-native-stage2/README.md)を追加。前回復元した圧縮層をCPUエミュレーションで追跡し、限定した仮のWindows環境でSMBIOS問い合わせまで64 API呼び出し・37種類を観測しました。GetThreadContextの応答を変えると分岐と内部状態が変わるため、仮の応答と実Windowsの挙動を区別しています。基準実験と最終チェックポイントは再実行一致。全16セクションのうち変化は起動用 `.dungeon` だけで、ゲーム本体のコード領域への移行・戦闘式は未確認です。

6.8Dの到達条件をD-1（最初の圧縮層、完了）、D-2（起動処理から元コード領域への移行、進行中）、D-3（ゲーム関数・式の同定、未着手）に分けました。次はSMBIOS応答の利用箇所と、環境確認で変わる内部状態を追います。6.8D/E全体は未完了、runtime昇格と新規Gap closeは0。Phase 6.9のモデル比較は未確認境界を保持した案として着手可能ですが、アプリの実装置換は行っていません。

### Runtime / Phase 6.6までのsummary（今回変更なし）

Phase 6.6までのresearch model alignmentが完了しました。Phase 6で2,105 GapをP0〜P3へ順位付けし、Phase 6.5A〜6.5Eでinventory、provenance、targeted extractor、representative semantics、bulk harvestとGap reconciliationを作成しました。Direct game data bulk harvestは1,026候補を走査して1,018件をparseし、17 Gapを閉じて2,088 Gapを正確に残しました。Phase 2-5のpartial、既存runtime supportとunsupported境界は維持しています。[Gap Reconciliation](./docs/game-data-gap-reconciliation.md) / [Bulk Harvest](./docs/game-data-bulk-harvest.md) / [Semantic Mapping](./docs/game-data-semantic-mapping.md) / [UE4 Asset Extractor](./docs/game-data-extractor.md) / [Source Provenance](./docs/game-data-source-provenance.md) / [Game Data Inventory](./docs/game-data-inventory.md) / [Coverage Priority](./docs/coverage-priority.md) / [Gap Map](./docs/evidence-gap-map.md)。runtime promotionとResearch Questは未実装です。進捗は `src/data/roadmap.ts` と同期。

### Current blockers

Phase 1-4は独立実測0/5でevidence-blocked。2-1D / F / G / H / I / Jは元のcompletion gateを維持してpartial。
P0〜P3とEvidence blockerは[生成Coverage report](./docs/combined-evidence-coverage.md)で横断確認できます。[制限・優先度・close条件](./docs/runtime-limitations.md)の表はstructured backlogから生成します。
`[ ]` は未達で、未実装とは限りません。evidence-blockedとnot-implementedの区別は同backlogを参照。

UX backlog（今回未実装）: 次点候補では1位と異なるEnchantを優先して表示できる選択肢を検討する。順位・scoreの意味を変えるため、Phase 4のEvidence作業には含めません。

### Next area

Phase 2-5A/B/Cは新しいEvidenceが得られるまでpartialを維持します。6.5Fの[最終coverage](./docs/game-data-final-coverage.md)と[差異分類](./docs/game-data-model-differences.md)で全Gapのdispositionを確定しました。Phase 6.6の[model alignment](./docs/game-data-model-alignment.md)も完了しました。次は[外部研究の条件照合](./docs/external-community-research.md)と[Phase 6.9の段階的再設計](./docs/adr/0001-external-evidence-model-redesign.md)です。Phase 6.8D/Eのnative解析は保留し、外部Evidenceで解消できない重要な問いが残る場合だけ再開します。既存のGap dispositionは履歴として保持し、実測へ送る前に外部取得可能性を再評価します。残余Observe / Measure / ExperimentはPhase 7でPersonal Research Quest化し、外部・自前の両EvidenceをPhase 8で検証してからPhase 9でruntimeへ昇格します。残るArmor/Ranged効果はEvidenceとstate/objectiveが揃うまでResearch-onlyを維持して0点登録しません。
P0/P1 targeted cleanupは必要な新Evidenceが得られた範囲で実施。[比較](./docs/runtime-limitations.md#次phaseの比較)。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- 現行supportはmanifestを変更し、`npm run audit:runtime-support` で検証・summary/matrix再生成する。
- Historical phaseのfull completion gateをsupport整理の都合で書き換えない。
- 新しい未対応事項はlimitations backlogへ記録し、未対応を0点として登録しない。

## Future milestones（チェックリスト進捗と分離）

### Phase 7 — Personal Research Quest（6.8/6.9の判断後）

Phase 6.6のmodel alignment後に確定した残余について、本人の装備登録と任意のObserve / Measure / Experimentを結びつけ、ゲームプレイ中にEvidenceを集めやすくします。強制しません。

### Phase 8 — Evidence Capture & Validation

game version、装備、Power、条件、測定値、反復、画像・動画参照、provenanceを再利用可能なEvidenceとして保存します。1件の自己観測だけでVerifiedにしません。

### Phase 9 — Runtime Promotion Pipeline

Evidenceが揃った項目をResearch-only → Limited → Fullへ安全に昇格し、Evidence、runtime manifest、validation、tests、Coverage、UI、Optimizerを同期します。

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
