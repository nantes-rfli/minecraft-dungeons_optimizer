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
] as const

/** Broad milestones are not checklist-sized work units and do not enter the progress denominator. */
export const FUTURE_MILESTONES = [
  { id: 'public-availability', title: 'Public Availability', goal: 'Phase 3.5後、本人がしばらく実利用してから判断。公開導線・limitations/Evidence・feedback・privacy/analytics/運用確認。Research Questは必須にしない。' },
  { id: 'phase-4', title: 'Phase 4 — Research Quest / Evidence Contribution', goal: '一般公開後。未検証項目・priority・measurement protocol・submission・provenance・independent replication・credit・moderation/quality gate。詳細は後続で決定。' },
  { id: 'phase-5', title: 'Phase 5 — Evidence Closure & Quality Improvement', goal: '独立DPS 0/5とP0/P1 Evidenceを重点解消し、Artifact promotion・主要Limited理由・誤差/confidenceを再評価。主要実用buildをlimitations付きで再現可能に比較する。全P2/P3解消や完全ゲーム再現は条件にしない。' },
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
