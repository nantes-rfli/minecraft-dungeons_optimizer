# Roadmap

## 完成条件

このプロジェクトの v1.0 は、手持ちの近接・防具・遠距離・アーティファクトを登録し、実測に基づく火力・回復・防御・独立Controlモデルで目的別の推奨ビルドを再現可能に比較できる状態とします。

v1.0判定には実装チェック項目・精度gate・後述Phase 5のrelease判定が必要です。現在scopeされた **v1.0 implementation checklist** の進捗は **43 / 58（74%）** です。Phase 2-5を1項目から6項目へ分割したため分母は53→58。future milestonesは大枠で粒度が異なるため別表示とし、Post-v1も進捗へ含めません。これは精度・作業量・v1.0到達確率ではなくチェック項目の完了率です。公開前にaudit・`npm test`・tsc・lint・buildを検証します。

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

## Phase 3 — Release Readiness（0 / 4）

目的: v0.9 Public Betaとして一般利用へ出しても壊れにくい状態にする。

- [ ] Web Worker化と探索時間の上限管理
- [ ] 主要操作のE2Eテストとアクセシビリティ監査
- [ ] 大規模手持ちデータの性能基準を達成
- [ ] データ更新手順・リリース判定を文書化

完了条件: 代表的な大規模データでUIが固まらず、主要操作の自動テスト・アクセシビリティ監査・ビルド検証を通過すること。

## 現在の作業位置

### Current summary

Phase 2-4までの完了を維持し、Phase 2-5はpartial。Ranged武器71・Enchant41を監査し、Bow/Crossbowと3 EnchantをLimited runtimeへ接続しました。read modelは8カテゴリ、protocolは6件になりました。[横断Coverage](./docs/combined-evidence-coverage.md) / [実測手順](./docs/measurement-protocols.md)。Research Questは未実装です。既存Armor 7 / 73、Armor Enchantment 7 / 41とunsupported境界は維持。進捗は `src/data/roadmap.ts` と同期。

### Current blockers

Phase 1-4は独立実測0/5でevidence-blocked。2-1D / F / G / H / I / Jは元のcompletion gateを維持してpartial。
P0〜P3とEvidence blockerは[生成Coverage report](./docs/combined-evidence-coverage.md)で横断確認できます。[制限・優先度・close条件](./docs/runtime-limitations.md)の表はstructured backlogから生成します。
`[ ]` は未達で、未実装とは限りません。evidence-blockedとnot-implementedの区別は同backlogを参照。

### Next area

Phase 2-5A/B/CのEvidence closureを優先し、Release Readinessの実装準備へ進みます。観測入力MVPと独立実測で検証済みのモデルは区別します。残るArmor/Ranged効果はEvidenceとstate/objectiveが揃うまでResearch-onlyを維持し、0点登録しません。
P0/P1 targeted cleanupは必要な新Evidenceが得られた範囲で実施。[比較](./docs/runtime-limitations.md#次phaseの比較)。

## 更新ルール

- 機能実装と同じ変更で、このファイルと `src/data/roadmap.ts` の状態を更新する。
- 現行supportはmanifestを変更し、`npm run audit:runtime-support` で検証・summary/matrix再生成する。
- Historical phaseのfull completion gateをsupport整理の都合で書き換えない。
- 新しい未対応事項はlimitations backlogへ記録し、未対応を0点として登録しない。

## Future milestones（チェックリスト進捗と分離）

### v0.9 Public Beta

Phase 3後。公開導線、limitations/Evidenceの明示、feedback導線、privacy/analytics/operational readinessを必要範囲で確認してBeta公開へ。大規模Research Questはまだ必須にしません。今回の本人限定サイトを一般公開する指示ではありません。

### Phase 4 — Research Quest / Evidence Contribution

Public Beta後。未検証項目一覧・priority・measurement protocol表示・submission・Evidence provenance・independent replication・contributor credit・moderation/quality gate。Phase 2-4/2-5の測定protocolを基盤とし、実装詳細は後続で決定します。

### Phase 5 — Evidence Closure & v1.0

独立DPS 0/5、P0/P1 blocker、Artifact promotion、Ranged/Armor/Meleeの主要Limited理由、model error/confidenceを再評価してrelease判定。v1.0は主要実用buildをlimitationsとEvidence付きで再現可能に比較できる状態。完全ゲーム再現や全P2/P3のゼロ化は条件にしません。

## Post-v1（現在の進捗に含めない）

### Post-v1 A — Optimizer Engine Generalization

Dungeons 1で実証したGame/Evidence adapter、Equipment/Effect、Build、Scenario、Objective、Optimizer、Coverage/Evidence、Measurementを段階的にゲーム固有実装から分離。Phase 2-5で全面汎用化を先行しません。

### Post-v1 B — Minecraft Dungeons II

汎用化の最初の実戦対象。新装備slot/effect、matchmaking・broader user base、新データ取得パイプラインへの適用を検討します。

### Post-v1 C — 異なるゲームでの汎用性検証

Monster Hunter系を候補として記録。似たDungeons間だけでなく異なる装備設計で汎用性を検証します。現時点では実装対象外です。
