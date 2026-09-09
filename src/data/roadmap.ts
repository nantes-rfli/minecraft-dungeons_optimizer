export type RoadmapStatus = 'done' | 'in-progress' | 'planned'

export interface RoadmapItem {
  readonly label: string
  readonly status: RoadmapStatus
}

export interface RoadmapPhase {
  readonly id: string
  readonly title: string
  readonly goal: string
  readonly items: readonly RoadmapItem[]
}

export const ROADMAP_PHASES: readonly RoadmapPhase[] = [
  {
    id: 'phase-0',
    title: 'Phase 0 — Optimizer Core',
    goal: '手持ちの近接武器を、目的別に比較できる検証版を完成させる。',
    items: [
      { label: '個体別の手持ち・候補エンチャント・Power入力', status: 'done' },
      { label: '確定済みスロット・金色エンチャント Tier I / II / III の入力', status: 'done' },
      { label: '全探索・目的別シナリオ・Pareto前線', status: 'done' },
      { label: '効果別の寄与度・根拠・信頼度表示', status: 'done' },
      { label: 'localStorage・version付きJSON入出力', status: 'done' },
    ],
  },
  {
    id: 'phase-0-5',
    title: 'Phase 0.5 — Core Model Integrity',
    goal: '実測・装備拡張の前に、Build依存関係とstackingの整合性を固める。',
    items: [
      { label: 'tier・sourceを保持するEnchant選択モデル', status: 'done' },
      { label: 'Enchantment stackingと重複Build制御', status: 'done' },
      { label: 'Artifact stacking behavior', status: 'done' },
      { label: 'Build依存kill rateとCombat State境界', status: 'done' },
      { label: '主要Evidenceを反映するモデル信頼度', status: 'done' },
      { label: 'Weapon Power未反映の明示警告', status: 'done' },
      { label: 'Golden Testと設計ドキュメント更新', status: 'done' },
    ],
  },
  {
    id: 'phase-0-5-1',
    title: 'Phase 0.5.1 — Core Model Cleanup',
    goal: 'Phase 1へ進む前に、残ったCore Model Integrityの不整合を解消する。',
    items: [
      { label: 'Radianceのコピー別stacking係数', status: 'done' },
      { label: 'Gilded Tier I / II / III 編集UIと永続化', status: 'done' },
      { label: 'directWeaponKillsPerSecondの共通境界', status: 'done' },
    ],
  },
  {
    id: 'phase-1-a',
    title: 'Phase 1A — Melee Attack Profile Audit',
    goal: '全近接武器の公開Attack Profileを構造化し、確実な値と未解決値を分離する。',
    items: [
      { label: '82武器の登録・分類・coverage再生成', status: 'done' },
    ],
  },
  {
    id: 'phase-1',
    title: 'Phase 1 — Accuracy',
    goal: '暫定値を、ゲーム内の比較に使える検証可能なモデルへ置き換える。',
    items: [
      { label: '3武器の公開per-hit timingをruntime登録', status: 'done' },
      { label: '内部Power ratingの意味確定とW/Gモデルcross-validation', status: 'done' },
      { label: '虚無の一撃の公開測定curveとper-hit resetモデル', status: 'done' },
      { label: '独立DPS回帰（公開監査10件、eligible 0 / 5）と誤差範囲', status: 'in-progress' },
    ],
  },
  {
    id: 'phase-2',
    title: 'Phase 2 — Equipment Coverage',
    goal: '実用的なビルド全体を比較できるデータ範囲へ広げる。',
    items: [
      { label: 'Phase 2-1A: 近接エンチャント33種の監査・分類・runtime境界', status: 'done' },
      { label: 'Phase 2-1B: Sharpness / Unchanting + Enemy Composition（7 / 33）', status: 'done' },
      { label: 'Phase 2-1C: Refreshment / Weakening状態モデル（9 / 33）', status: 'done' },
      { label: 'Phase 2-1D partial: DamageEvent + Shockwave / Swirling / Thundering（12 / 33、3種はPower範囲限定）', status: 'in-progress' },
      { label: 'Phase 2-1E: Ambush / Smiting / Committed（catalog 15 / 33、広域12・範囲限定3）', status: 'done' },
      { label: 'Phase 2-1F partial: Artifact Synergy / Rampaging（catalog 17 / 33、Echo research-only）', status: 'in-progress' },
      { label: 'Phase 2-1G partial: Soul Scythe / Soul subsystem / Anima / Siphon（19 / 33、Enigma research-only）', status: 'in-progress' },
      { label: 'Phase 2-1H partial: Fire / Poison / Exploding（22 / 33、stack・Void・overlap制限）', status: 'in-progress' },
      { label: 'Phase 2-1I partial: Control第4軸 + Chains / Stunning / Freezing / Gravity（26 / 33、stack・duration・免疫制限）', status: 'in-progress' },
      { label: 'Phase 2-1J partial: Pain Cycle / Dynamo（28 / 33、自己damage・有限consume・合成制限）', status: 'in-progress' },
      { label: 'Phase 2-1K: Melee Runtime Consolidation（分類・manifest・監査・表示・実用性回帰）', status: 'done' },
      { label: '近接エンチャントを25〜30種類へ拡張（meaningful runtimeで達成、全33種完全対応ではない）', status: 'done' },
      { label: 'Phase 2-2A: Artifact Audit & Runtime Foundation（primary44 / secondary45 / union45を照合）', status: 'done' },
      { label: 'Phase 2-2B: Artifact Control & Debuff Batch（Shock Powder Limited、Fishing Rod / Gong research-only）', status: 'done' },
      { label: 'Phase 2-2C: 有限Soul Scheduler + Soul Artifact監査（3候補はResearch-only）', status: 'done' },
      { label: 'Phase 2-2D: Event / Healing / Control Batch（3 family分離、3候補はResearch-only）', status: 'done' },
      { label: 'Phase 2-2E: Artifact Evidence Acquisition / Curve Extraction（公開Evidenceを再現可能化、6候補はResearch-only）', status: 'done' },
      { label: 'アーティファクトを10〜15種類へ拡張（Evidence gate待ち・他Phaseと並行）', status: 'planned' },
      { label: 'Phase 2-3A: Armor Audit & Runtime Foundation（primary71 / secondary73 / runtime0を照合）', status: 'done' },
      { label: 'Phase 2-3B: Armor Core Runtime Batch（Armor 3 / 73、Enchant 3 / 41）', status: 'done' },
      { label: 'Phase 2-3C: Armor Expansion & State Enchant（Armor 7 / 73、Enchant 7 / 41）', status: 'done' },
      { label: '防具・防具エンチャントのMVP coverageを再評価してclose', status: 'done' },
      { label: 'Phase 2-4A: Common Coverage / Evidence Read Model', status: 'done' },
      { label: 'Phase 2-4B: Combined Coverage Snapshot / Report', status: 'done' },
      { label: 'Phase 2-4C: Blocker / Priority Aggregation', status: 'done' },
      { label: 'Phase 2-4D: Measurement Protocol Foundation', status: 'done' },
      { label: 'Phase 2-4E: Read-only Coverage Dashboard', status: 'done' },
      { label: 'Phase 2-4F: Coverage Audit / CI', status: 'done' },
      { label: 'Phase 2-5A partial: Ranged Population / Taxonomy（71種照合、詳細・日本語名のEvidence待ち）', status: 'in-progress' },
      { label: 'Phase 2-5B partial: Attack / Projectile Model（観測入力対応、独立cadence実測待ち）', status: 'in-progress' },
      { label: 'Phase 2-5C partial: Ranged Enchantment Audit（38/41照合、channel・stack/Tier未解決）', status: 'in-progress' },
      { label: 'Phase 2-5D: Observed Ranged Runtime MVP（Bow / Crossbow Limited、3 Enchant）', status: 'done' },
      { label: 'Phase 2-5E: Inventory / Optimizer / Explanation / JSON v2', status: 'done' },
      { label: 'Phase 2-5F: Common Coverage / Measurement / CI Consolidation', status: 'done' },
    ],
  },
  {
    id: 'phase-3',
    title: 'Phase 3 — Public Use Readiness',
    goal: '一般利用に耐えるための安定性・性能・操作性を整備し、仕様変更へ安全に追従する。',
    items: [
      { label: 'Phase 3A: Worker / Cancel / Responsiveness（候補数・時間上限、stale結果破棄）', status: 'done' },
      { label: 'Phase 3B: Performance Baseline（synthetic small / medium / large）', status: 'done' },
      { label: 'Phase 3C: Major Flow E2E（保存・復元・入力エラー・遠距離なしも検証）', status: 'done' },
      { label: 'Phase 3D: Accessibility（主要フロー自動監査・keyboard・残制限記録）', status: 'done' },
      { label: 'Phase 3E: Bundle / Loading（Methodology遅延読込・Worker分離）', status: 'done' },
      { label: 'Phase 3F: Data / Evidence Update Workflow（更新・検証・変更追跡）', status: 'done' },
    ],
  },
  {
    id: 'phase-3-5',
    title: 'Phase 3.5 — Personal UX Refinement',
    goal: '本人の日常利用で、装備登録から結果確認までを迷わず少ない認知負荷で行える情報構造へ整理する。',
    items: [
      { label: 'Phase 3.5A: Information Architecture / Navigation', status: 'done' },
      { label: 'Phase 3.5B: Inventory / Box UX', status: 'done' },
      { label: 'Phase 3.5C: Optimization UX', status: 'done' },
      { label: 'Phase 3.5D: Game Data Browser', status: 'done' },
      { label: 'Phase 3.5E: Model Explorer', status: 'done' },
      { label: 'Phase 3.5F: Storage / Utility consolidation', status: 'done' },
    ],
  },
  {
    id: 'phase-3-6',
    title: 'Phase 3.6 — UX Fix-up',
    goal: '実利用で判明した分かりづらさを直し、推奨装備と現在地を短時間で理解できるようにする。',
    items: [
      { label: 'Recommended BuildをMelee / Armor / Ranged / Artifactの完成セットとして表示', status: 'done' },
      { label: 'Enchant sourceと次点候補の差分を明示', status: 'done' },
      { label: 'Data summaryをtop-levelカテゴリと一致させ、Enchant 115の定義を明示', status: 'done' },
      { label: 'Model Evidence / Accuracy overviewと詳細Methodology導線', status: 'done' },
      { label: '結果・Data summary・Evidence overviewのtargeted component分離', status: 'done' },
      { label: '主要UX・route・keyboard・axe回帰', status: 'done' },
    ],
  },
  {
    id: 'phase-4',
    title: 'Phase 4 — Coverage Source Harvest（4A / 4B）',
    goal: 'ゲームを起動せず取得できる公開情報を横断し、既知・未知・競合・版・出典をruntimeとは独立したEvidence層へ構造化する。',
    items: [
      { label: '4A: 7カテゴリ386件の監査済み母集団を重複なく正規化', status: 'done' },
      { label: '4B: dungeons.tools詳細386件からproperty claimを抽出', status: 'done' },
      { label: 'sourceType・Fact version・property-level attemptを分離', status: 'done' },
      { label: 'Coverage・GapのBefore / Afterと未取得理由を生成', status: 'done' },
      { label: 'snapshot schema・参照・競合・driftのauditとCI接続', status: 'done' },
      { label: 'Data BrowserでKnown propertyごとのsource / versionを表示', status: 'done' },
    ],
  },
  {
    id: 'phase-5',
    title: 'Phase 5 — Evidence Gap Map & Measurement Protocol',
    goal: 'Source Harvestの全Gapを解決方法別に束ね、Phase 6が優先度計算に使える取得cost・runtime relevance・unlock effectを提供する。',
    items: [
      { label: 'Source Harvestの2,105 GapをGap Causeを維持したままResolution Classへ分類', status: 'done' },
      { label: '全Gapを再利用可能なTask Familyへ束ね、implementation / objective familyを分離', status: 'done' },
      { label: 'Observe / Measure / Experimentのcanonical protocolと旧ID mappingを定義', status: 'done' },
      { label: 'acquisition cost・runtime relevance・unlock effectのPhase 6 read modelを生成', status: 'done' },
      { label: 'Gap・family・protocol・生成driftとPhase境界をaudit', status: 'done' },
      { label: '人間向けGap MapとMeasurement Protocol reportを生成', status: 'done' },
    ],
  },
  {
    id: 'phase-6',
    title: 'Phase 6 — Coverage Priority',
    goal: '2,105 GapをOptimizer実用性への効果で順位付けし、本人が次の調査を迷わず選べるread modelを提供する。',
    items: [
      { label: '2,105 GapへGlobal / Personal priority、P0〜P3、理由を付与', status: 'done' },
      { label: 'bounded-proxy rank sensitivityを6 objectiveで評価しmethodを明示', status: 'done' },
      { label: 'Unlock Bundle・near-unlock・coverage・critical pathを評価', status: 'done' },
      { label: 'Protocol costをsetup・反復・variant・availabilityで補正', status: 'done' },
      { label: 'actual family relationとsynthetic InventoryによるOwned / grouped Research Queueを生成', status: 'done' },
      { label: 'Global / Personal weight sensitivityとstability confidenceを含めてaudit', status: 'done' },
    ],
  },
  {
    id: 'phase-6-5',
    title: 'Phase 6.5 — Direct Game Data Research',
    goal: 'Minecraft Dungeons 1.17.0.0のローカル展開済みgame assetsを直接調査し、公開情報では不足していたPropertyを再現可能な一次データとして抽出・記録する。既存Gapと照合するが、このPhase単独ではruntimeを自動昇格しない。',
    items: [
      { label: '6.5A — Game Data Inventory & Asset Map', status: 'done' },
      { label: '6.5B — Source Boundary / Provenance', status: 'done' },
      { label: '6.5C — UE4 Asset Extractor Foundation', status: 'done' },
      { label: '6.5D — Representative Semantic Mapping', status: 'done' },
      { label: '6.5E — Bulk Harvest & Gap Reconciliation', status: 'done' },
      { label: '6.5F — Audit / Report / Coverage', status: 'done' },
    ],
  },
  {
    id: 'phase-6-6',
    title: 'Phase 6.6 — Game Data Model Alignment & Reconciliation',
    goal: 'Raw Game Property・Canonical Research Property・Runtime Optimizer Propertyを分離し、research modelの対応と残余Gapを監査する。runtime promotionは行わない。',
    items: [
      { label: 'Entity Identity Alignment（variant・カテゴリ・alias根拠を保持）', status: 'done' },
      { label: 'Canonical Research Property Registry（33 property）', status: 'done' },
      { label: 'Property Alias / Rename Alignment', status: 'done' },
      { label: 'Structural Reference Normalization', status: 'done' },
      { label: 'Game-only / Missing Expected Property Review', status: 'done' },
      { label: 'Semantic Rule Alignment（承認済みA→Bのみ）', status: 'done' },
      { label: 'Gap Reconciliation Regeneration（17 closed / 2,088 remaining）', status: 'done' },
      { label: 'Phase 7 Handoff / Phase 6.7 Decision（当時の判断、後続6.7〜6.9で更新）', status: 'done' },
    ],
  },
  {
    id: 'phase-6-7',
    title: 'Phase 6.7 — ゲームデータ起点の取得可能性調査',
    goal: '取得可能性の調査を完了。全効果の解読やruntime昇格を意味しない。',
    items: [
      { label: '6.7A — 全uassetの構造棚卸し', status: 'done' },
      { label: '6.7B — 数値・表・関数・native境界の代表試験', status: 'done' },
      { label: '6.7C — Optimizerへの対応と次段階の判断', status: 'done' },
    ],
  },
  {
    id: 'phase-6-8',
    title: 'Phase 6.8 — 取得と意味の検証（D/E保留）',
    goal: '取得器と設定を検証。戦闘式・実効hit列は未確定で、外部観測でも解けない重要な問いが残る場合だけnative解析を再開する。',
    items: [
      { label: '6.8A — 追加PAKの全件比較', status: 'done' },
      { label: '6.8B — 独立readerの代表検証', status: 'done' },
      { label: '6.8C — 代表参照・処理経路の検証', status: 'done' },
      { label: '6.8D — native計算の同定（起動処理の条件付き追跡まで、保留）', status: 'in-progress' },
      { label: '6.8E — 実効timing / notify（攻撃設定・代表通知の読解まで、保留）', status: 'in-progress' },
    ],
  },
  {
    id: 'phase-6-9',
    title: 'Phase 6.9 — 外部Evidenceとモデル再設計の研究比較',
    goal: '研究比較は完了。独立観測・版・条件の検証が残り、runtime昇格・新規Gap closeは0。',
    items: [
      { label: '6.9A — 外部研究・訂正・条件と現行モデルの差分', status: 'done' },
      { label: '6.9B — データ契約と段階的移行方針', status: 'done' },
      { label: '6.9C — 版付きEvidence adapter', status: 'done' },
      { label: '6.9D — Attack / Event比較', status: 'done' },
      { label: '6.9E — DR / Modifier比較', status: 'done' },
      { label: '6.9F — Scenario / Optimizer比較', status: 'done' },
    ],
  },
] as const

/** Broad milestones are not checklist-sized work units and do not enter the progress denominator. */
export const FUTURE_MILESTONES = [
  { id: 'phase-8', title: 'Phase 8 — Evidence Capture & Validation（次の重点）', goal: '8A: 既存台帳・adapterを使う受入/保存/検証基盤 → 8B: 限定DR/modifierを第一候補に外部Evidenceを取得し残余queueを再評価 → 8C: 独立holdout・許容範囲・旧新比較から採用/保留/不採用を記録。次に既存4武器のevent、有限Scenarioを検証。same-originや合成値だけでVerifiedにしない。' },
  { id: 'phase-7', title: 'Phase 7 — Personal Research Quest（8Bの残余に限定）', goal: '7A: 外部取得後の不足だけを所有装備とprotocolへ結びつける。7B: 任意のObserve / Measure / Experimentを8Aへ渡して8Cで検証。1,307件は6.6当時の母集団で、最新の実測待ち件数ではない。強制しない。' },
  { id: 'phase-9', title: 'Phase 9 — Runtime Promotion Pipeline（8C合格単位ごと）', goal: '9A: 最初の検証済み1単位を許容範囲付きで移行し、manifest・説明・Coverage・回帰・性能を同期。9B: 合格した単位へ反復しLimited / Fullを個別判断。現在は昇格可能と検証された単位なし。未知効果を0点で登録しない。' },
  { id: 'public-availability', title: 'Public Availability — 保留', goal: '本人が実利用して「普通に便利」と感じられるCoverageとUXになった時点で再判断する。今回、共有・一般公開は行わない。' },
  { id: 'new-drop-comparison', title: 'Future candidate — New Drop Comparison / Keep-Salvage', goal: '新しく拾った装備を仮追加し、現在Bestとの差と残す価値を判断する。Phase 10以降の確定項目にはしない。' },
] as const
export const FUTURE_EXPANSION_MILESTONES = [
  { id: 'generalization', title: 'Future Expansion A — Optimizer Engine Generalization', goal: 'Dungeons 1で実証後、Game/Evidence adapter、Equipment/Effect、Build、Scenario、Objective、Optimizer、Coverage、Measurementを段階的に分離。今回全面汎用化しない。' },
  { id: 'dungeons-ii', title: 'Future Expansion B — Minecraft Dungeons II', goal: '汎用化の最初の実戦対象。新slot/effect、matchmaking・利用者層、新データ取得パイプラインへの適用を検討。' },
  { id: 'cross-game', title: 'Future Expansion C — 異なるゲームでの汎用性検証', goal: 'Monster Hunter系など異なる装備設計を候補として記録。現時点では実装対象外。' },
] as const

export const ROADMAP_PROGRESS = (() => {
  const items = ROADMAP_PHASES.flatMap((phase) => phase.items)
  const completed = items.filter((item) => item.status === 'done').length
  return {
    completed,
    total: items.length,
    percentage: Math.round((completed / items.length) * 100),
  }
})()
