import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core'
import type { Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { DataSummary } from '../src/views/DataSummary'
import { RecommendedBuild } from '../src/views/RecommendedBuild'
import { ModelEvidencePage } from '../src/screens/ModelEvidencePage'

const inventory: Inventory = {
  weapons: [{ instanceId: 'melee', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100_000, enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } }], gilded: { enchantmentId: 'sharpness', tier: 2 } }],
  armors: [{ instanceId: 'armor', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 1_880_000, enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 3 } }] }],
  rangedWeapons: [{ instanceId: 'ranged', weaponId: 'bow', powerLevel: 251, observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 80_000, shotCycleSeconds: 1, availableAmmo: 50, sourceNote: 'SYNTHETIC TEST ONLY' }, enchantmentSlots: [{ candidates: ['power'], selected: { enchantmentId: 'power', tier: 3 } }] }],
  artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }, { instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
}

describe('Phase 3.6 UX fix-up', () => {
  it('renders the recommended build as one semantically separated equipment set', () => {
    const evaluation = optimize(inventory, { ...DEFAULT_SCENARIO, rangedTimeShare: 0.2 }).best
    const html = renderToStaticMarkup(<RecommendedBuild evaluation={evaluation} />)
    expect(html).toContain('この装備セットを使う')
    for (const label of ['近接', '防具', '遠距離', 'Artifact']) expect(html).toContain(label)
    for (const item of ['ダブルアックス', 'クリティカルヒット', 'Gilded', 'バトルローブ', '冷気', '弓', 'パワー', 'シロタマゴテングタケ']) expect(html).toContain(item)
    expect(html).toContain('Artifact 3枠')
    expect(html).toContain('Control / 100')
  })

  it('keeps Data top-level populations aligned and explains the enchant aggregate', () => {
    const html = renderToStaticMarkup(<DataSummary />)
    for (const entry of ['近接武器', '>82<', '防具', '>73<', '遠距離武器', '>71<', 'アーティファクト', '>45<', 'エンチャント', '>115<']) expect(html).toContain(entry)
    expect(html).toContain('装備の種類ごとに探せます')
    expect(html).toContain('日本語名')
  })

  it('provides a concise evidence overview without embedding the legacy methodology', () => {
    const html = renderToStaticMarkup(<ModelEvidencePage />)
    expect(html).toContain('Evidence / 精度')
    expect(html).toContain('Evidence statusとは別軸')
    expect(html).toContain('独立sample 0 / 5')
    expect(html).toContain('Ranged neutral damage / cadence')
    expect(html).toContain('#/model/evidence/details')
    expect(html).not.toContain('current implementation checklist')
  })
})
