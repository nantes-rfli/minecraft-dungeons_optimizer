# Roadmap

## Current project target

手持ちの近接・防具・遠距離・アーティファクトを登録し、Evidenceとlimitationsを明示しながら、火力・回復・防御・Controlなどの目的別推奨buildを再現可能に比較できる状態を目指します。

製品バージョンは運用せず、Phase / Milestone / Current state / Git historyで継続的に更新します。**current implementation checklist** は **73 / 84（87%）**。Phase 5の6項目を追加。future milestonesとFuture Expansionは次の独立した実装・調査単位であり、分母に含めません。これはチェック項目の完了率であり、精度や作業量の達成率ではありません。公開前にaudit・`npm test`・tsc・lint・buildと主要E2Eを検証します。

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

## 現在の作業位置

### Current summary

Phase 5でSource Harvestの2,105 Gapを33 Task Familyと14本の再利用可能protocolへ整理しました。Phase 2-5のpartial、既存runtime supportとunsupported境界は維持しています。[Gap Map](./docs/evidence-gap-map.md) / [Source Harvest](./docs/source-harvest.md) / [横断Coverage](./docs/combined-evidence-coverage.md) / [実測手順](./docs/measurement-protocols.md)。Research Questは未実装です。進捗は `src/data/roadmap.ts` と同期。

### Current blockers

Phase 1-4は独立実測0/5でevidence-blocked。2-1D / F / G / H / I / Jは元のcompletion gateを維持してpartial。
P0〜P3とEvidence blockerは[生成Coverage report](./docs/combined-evidence-coverage.md)で横断確認できます。[制限・優先度・close条件](./docs/runtime-limitations.md)の表はstructured backlogから生成します。
`[ ]` は未達で、未実装とは限りません。evidence-blockedとnot-implementedの区別は同backlogを参照。

UX backlog（今回未実装）: 次点候補では1位と異なるEnchantを優先して表示できる選択肢を検討する。順位・scoreの意味を変えるため、Phase 4のEvidence作業には含めません。

### Next area

Phase 2-5A/B/Cは新しいEvidenceが得られるまでpartialを維持します。次はPhase 6でGap Mapのruntime relevance・unlock effect・acquisition costを入力にCoverage Priorityを設計します。rank sensitivity、本人の所持・利用signal、Priority scoreはPhase 6で初めて扱います。観測入力MVPと独立実測で検証済みのモデルは区別し、残るArmor/Ranged効果はEvidenceとstate/objectiveが揃うまでResearch-onlyを維持して0点登録しません。
P0/P1 targeted cleanupは必要な新Evidenceが得られた範囲で実施。[比較](./docs/runtime-limitations.md#次phaseの比較)。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- 現行supportはmanifestを変更し、`npm run audit:runtime-support` で検証・summary/matrix再生成する。
- Historical phaseのfull completion gateをsupport整理の都合で書き換えない。
- 新しい未対応事項はlimitations backlogへ記録し、未対応を0点として登録しない。

## Future milestones（チェックリスト進捗と分離）

### Phase 6 — Coverage Priority

runtime unlock value、rank sensitivity、本人の所持・利用signal、取得costから、Optimizer実用性への効果が高いGapを優先します。

### Phase 7 — Personal Research Quest

本人の装備登録と任意のObserve / Measure / Experimentを結びつけ、ゲームプレイ中にEvidenceを集めやすくします。強制しません。

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
