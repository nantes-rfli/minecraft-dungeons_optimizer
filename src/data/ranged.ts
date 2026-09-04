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
  crossbow: { name: { ja: 'クロスボウ', en: 'Crossbow' }, modes: ['single'], supportLevel: 'limited', intrinsic: 'Faster Projectilesは飛翔速度。発射周期の倍率には使わず、単体命中・飛翔時間なしの境界。' },
}
// Independent ranged definitions. No import of melee enchantment effects or attack profiles.
export const RANGED_ENCHANTMENTS: Readonly<Record<string, { readonly name: LocalizedName; readonly tiers: Readonly<Record<EnchantmentTier, number>>; readonly kind: 'damage-bonus' | 'triple-hit-chance' | 'enchanted-bonus'; readonly sourceUrl: string; readonly supportLevel: 'limited'; readonly maxCopies: 1 }>> = {
  power: { name: { ja: 'パワー', en: 'Power' }, tiers: { 1: 0.1, 2: 0.21, 3: 0.33 }, kind: 'damage-bonus', sourceUrl: 'https://www.dungeons.tools/enchantments/power', supportLevel: 'limited', maxCopies: 1 },
  'critical-hit': { name: { ja: 'クリティカルヒット', en: 'Critical Hit' }, tiers: { 1: 0.1, 2: 0.15, 3: 0.2 }, kind: 'triple-hit-chance', sourceUrl: 'https://minecraft.wiki/w/Dungeons:Critical_Hit', supportLevel: 'limited', maxCopies: 1 },
  unchanting: { name: { ja: 'エンチャント解除', en: 'Unchanting' }, tiers: { 1: 0.5, 2: 0.75, 3: 1 }, kind: 'enchanted-bonus', sourceUrl: 'https://minecraft.wiki/w/Dungeons:Unchanting', supportLevel: 'limited', maxCopies: 1 },
}
export const isRuntimeRangedWeapon = (id: string) => Object.hasOwn(RANGED_WEAPONS, id)
export const isRuntimeRangedEnchantment = (id: string) => Object.hasOwn(RANGED_ENCHANTMENTS, id)
