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
      { label: '確定済みスロット・金色エンチャント III の入力', status: 'done' },
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
    id: 'phase-1',
    title: 'Phase 1 — Accuracy',
    goal: '正規化値を、ゲーム内の比較に使える実測モデルへ置き換える。',
    items: [
      { label: '3武器のコンボ時間をフレーム計測', status: 'in-progress' },
      { label: 'Power Levelから実ダメージへの換算', status: 'in-progress' },
      { label: '虚無の一撃の時間曲線を実測', status: 'in-progress' },
      { label: '実測値による回帰テストと誤差範囲の表示', status: 'in-progress' },
    ],
  },
  {
    id: 'phase-2',
    title: 'Phase 2 — Equipment Coverage',
    goal: '実用的なビルド全体を比較できるデータ範囲へ広げる。',
    items: [
      { label: '近接エンチャントを25〜30種類へ拡張', status: 'planned' },
      { label: 'アーティファクトを10〜15種類へ拡張', status: 'planned' },
      { label: '防具・防具エンチャントをモデル化', status: 'planned' },
      { label: '遠距離武器・固有効果をモデル化', status: 'planned' },
    ],
  },
  {
    id: 'phase-3',
    title: 'Phase 3 — Release Readiness',
    goal: '候補数が増えても、安全・高速・再現可能に使えるv1.0へ仕上げる。',
    items: [
      { label: 'Web Worker化と探索時間の上限管理', status: 'planned' },
      { label: '主要操作のE2Eテストとアクセシビリティ監査', status: 'in-progress' },
      { label: '大規模手持ちデータの性能基準を達成', status: 'planned' },
      { label: 'データ更新手順・リリース判定を文書化', status: 'planned' },
    ],
  },
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
