# Changes

Git commit historyを変更追跡の正本とします。ここには意味のあるPhase単位の変更だけを簡潔に記録します。製品バージョンや正式版判定はありません。

## 2026-09-09 — 外部研究優先とPhase 6.9再設計初版

- Phase 6.8D/Eのnative解析を未完了のまま保留し、外部研究・条件照合・残余検証を優先する方針へ変更。
- 添付の索引と追加取得を31 source・13 claimへ整理し、公開HPS表55行×4条件、作者訂正、modifier衝突、DR合成例を保存。
- Evidence・attack/event・damage/DR・Scenario・Optimizerの段階的再設計をADRへ記録。
- research-onlyのDR/Committed比較、offline auditとCI、既存runtimeとの比較テストを追加。runtime昇格・Gap close・Sites更新はなし。

## 2026-09 — Phase 6 Coverage Priority Fix-up

- same-family ownershipをcategory proxyからSource Harvestで確認できるactual family relationへ修正。
- Global / Personal weight sensitivityを分離し、Personal ownership-heavyだけにownership signalを含めるよう変更。
- Rank Sensitivityをbounded proxyとして明示し、ranking stabilityをPriority confidenceとreasonへ反映。
- Runtime support、Optimizer formula、Inventory schema、Source Harvest、Evidence Gap Map、Evidence confidenceは変更なし。

## 2026-09 — Phase 6 Coverage Priority

- 2,105 Gapへruntime unlock・rank sensitivity・ownership・coverage・near-unlock・acquisition easeのGlobal / Personal priorityを追加。
- Gap / Entity / Task Family / Protocol ranking、386 Unlock Bundle、synthetic Owned Research Queueを生成。
- 6 objectiveのanalysis-only sensitivity、Protocol cost補正、weight sensitivity、全件・重複・NaN・orphan・determinism監査を追加。
- Runtime support、Optimizer formula、Inventory schema、Evidence、Research Quest UI、Public Availabilityは変更なし。

## 2026-09 — Phase 5 Evidence Gap Map & Measurement Protocol

- Source Harvestの2,105 GapをGap Causeを維持したままResolution Classと33 Task Familyへ分類。
- Observe / Measure / Experimentを14本の再利用可能なcanonical protocolへ束ね、既存Ranged protocol 3本の旧ID mappingを保持。
- Gapごとのacquisition cost、runtime relevance、unlock effectと、implementation / objective-design専用metadataをPhase 6向けread modelへ追加。
- 全件分類、重複・orphan・protocol要件・生成drift・Phase境界を監査。runtime support、Optimizer score/formula、Inventory JSON、Workerは変更なし。

## 2026-09 — Phase 4.1 External Source Extraction

- dungeons.toolsの全7カテゴリ386件を確認し、HTML全文ではなくproperty claim、source locator、direct / normalized、取得失敗理由をsnapshot化。
- sourceTypeのdefault game-file誤分類を廃止し、project-internal / unknown / secondary-databaseを追加。Factのtargetとapplicable versionを分離。
- Fact / Unknown / Gapへproperty-level source attemptを追加し、CoverageとGapのBefore / Afterを生成。
- Data BrowserでKnown valueごとのsource / versionとUnknownの確認結果を表示。runtime support、score、formula、Inventory JSONは変更なし。

## 2026-09 — Phase 4 Coverage Source Harvest

- 7カテゴリ386件を既存監査からread-only Source Harvestへ正規化し、Known / Unknown / Conflict / Version / stale / provenanceを機械可読化。
- game-file由来公開DB、公式patch / 最終更新境界、Minecraft Wiki、定量的な公開調査をsource registryへ統合し、旧版・版不明を明示状態として保持。
- property-level Harvest coverage、Phase 5向けgap candidates、schema / source参照 / 重複 / 競合 / drift監査とCIを追加。
- Data Browserで項目ごとのKnown、Unknown、Sources、Version、Conflictを表示。
- runtime support、Optimizer候補・score、Inventory JSON、Worker、Evidence confidence、本人限定公開方針は変更なし。

## 2026-09 — Phase 3.6 UX Fix-up

- Recommended BuildをMelee / Armor / Ranged / Artifactの装備セットとして再構成し、Enchantの通常枠・Gilded・Built-inを区別。
- 次点候補に装備構成と1位からのScore・Damage・Defense差を表示し、計算詳細を段階的に開く構造へ整理。
- Data summaryをtop-levelカテゴリへ統一し、Enchant 115は近接33・防具41・遠距離41の用途別catalog合計であることを明示。
- Model Evidence / Accuracy overviewと旧Methodologyへの導線を追加し、RoadmapをSource HarvestからRuntime PromotionまでのPhase 4〜9へ再編。
- Inventory JSON、Worker探索、数値モデル、runtime support、Evidence confidence、Public Availability保留を維持。

## 2026-09 — Phase 3.5 Personal UX Refinement

- 装備・最適化・データ・モデル・保存・変更履歴を別routeへ分離し、PC sidebar / mobile menuで同じ情報構造を提供。
- 装備はcompact一覧から編集、最適化はpresetを主導線として詳細条件を折りたたみ、Best Buildを先に表示。
- Game Data browserと段階的なModel explorerを追加し、Evidenceとlimitationsを参照文脈へ整理。
- localStorage、JSON v1/v2、Worker探索、中止、候補除外、既存の計算結果とruntime supportは維持。

## 2026-09 — Phase 3 Public Use Readiness

- Workerでの明示的な最適化開始・中止、古い結果の破棄、候補数と時間の安全上限。
- synthetic性能fixture、主要操作E2E、a11y自動監査とCIのブラウザ検証。
- Methodologyの遅延読込、フォームと状態通知・寄与度表の改善。
- version-free RoadmapとData / Evidence Update Workflow。Phase 2-5A/B/CはEvidence待ちのpartialを維持。

## 2026-09 — Ranged observed-value MVP

- Bow / CrossbowのLimited runtime、Ranged Coverageと測定protocol。
- Inventory JSON schema 2に遠距離データを追加（製品バージョンではありません）。
