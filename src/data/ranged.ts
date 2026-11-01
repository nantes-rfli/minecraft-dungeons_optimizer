import { hasRangedReuseGrant } from '../core/rangedReuse.ts'
import type { RangedShotMode } from '../core/rangedTypes'
import type { EnchantmentTier, LocalizedName } from '../core/types'

export const RANGED_LIMITATIONS = [
  'Limited: 1.17.0.0のneutralな単一矢damageと完全な発射周期を利用者が入力。実測の独立検証は未完了。Powerからdamageを生成しない。',
  '通常矢・単体確定命中。1周期完了後に1射、有限矢数で上限。未消費時間を近接へ戻さず、切替時間は時間配分に含める。',
  '近接と遠距離の時間配分はモデル仮定。飛翔時間・miss・距離・overkill・移動・離散target順序を再現しない。',
  '複数矢・貫通・跳弾・爆発・DoT・特殊矢・Soul・固有効果はResearch-only。未確認の組合せはreject。',
] as const
export const RANGED_WEAPONS: Readonly<Record<string, { readonly name: LocalizedName; readonly modes: readonly RangedShotMode[]; readonly supportLevel: 'limited'; readonly intrinsic: string }>> = {
  bow: { name: { ja: '弓', en: 'Bow' }, modes: ['uncharged', 'charged'], supportLevel: 'limited', intrinsic: '通常矢。チャージ段階ごとに観測値を分離。' },
  shortbow: { name: { ja: '短弓', en: 'Shortbow' }, modes: ['charged'], supportLevel: 'limited', intrinsic: '単一通常矢・フルチャージ限定。対象個体の観測damageと完全周期が必須。' },
  longbow: { name: { ja: '長弓', en: 'Longbow' }, modes: ['charged'], supportLevel: 'limited', intrinsic: 'Strong Charged Attacksは観測damageに含む。追加倍率を推定しない。' },
  'power-bow': { name: { ja: '力の弓', en: 'Power Bow' }, modes: ['charged'], supportLevel: 'limited', intrinsic: 'Strong Charged Attacksは観測damageに含む。追加倍率を推定しない。' },
  'heavy-crossbow': { name: { ja: 'ヘビークロスボウ', en: 'Heavy Crossbow' }, modes: ['single'], supportLevel: 'limited', intrinsic: 'Powerful Shotsは観測damageに含む。reload・飛翔速度から周期を推定しない。' },
  crossbow: { name: { ja: 'クロスボウ', en: 'Crossbow' }, modes: ['single'], supportLevel: 'limited', intrinsic: 'Faster Projectilesは飛翔速度。発射周期の倍率には使わず、単体命中・飛翔時間なしの境界。' },
}
// Independent ranged definitions. No import of melee enchantment effects or attack profiles.
export const RANGED_ENCHANTMENTS: Readonly<Record<string, { readonly name: LocalizedName; readonly tiers: Readonly<Record<EnchantmentTier, number>>; readonly kind: 'damage-bonus' | 'triple-hit-chance' | 'enchanted-bonus'; readonly sourceUrl: string; readonly supportLevel: 'limited'; readonly maxCopies: 1 }>> = {
  power: { name: { ja: 'パワー', en: 'Power' }, tiers: { 1: 0.1, 2: 0.21, 3: 0.33 }, kind: 'damage-bonus', sourceUrl: 'https://www.dungeons.tools/enchantments/power', supportLevel: 'limited', maxCopies: 1 },
  'critical-hit': { name: { ja: 'クリティカルヒット', en: 'Critical Hit' }, tiers: { 1: 0.1, 2: 0.15, 3: 0.2 }, kind: 'triple-hit-chance', sourceUrl: 'https://minecraft.wiki/w/Dungeons:Critical_Hit', supportLevel: 'limited', maxCopies: 1 },
  unchanting: { name: { ja: 'エンチャント解除', en: 'Unchanting' }, tiers: { 1: 0.5, 2: 0.75, 3: 1 }, kind: 'enchanted-bonus', sourceUrl: 'https://minecraft.wiki/w/Dungeons:Unchanting', supportLevel: 'limited', maxCopies: 1 },
}
export const isRuntimeRangedWeapon = (id: string) => Object.hasOwn(RANGED_WEAPONS, id) && (id === 'bow' || id === 'crossbow' || hasRangedReuseGrant(id))
export const isRuntimeRangedEnchantment = (id: string) => Object.hasOwn(RANGED_ENCHANTMENTS, id)
