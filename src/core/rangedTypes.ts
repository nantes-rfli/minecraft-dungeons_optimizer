import type { EnchantmentTier } from './types'

export type RangedShotMode = 'uncharged' | 'charged' | 'single'
export interface RangedRoll { readonly enchantmentId: string; readonly tier: EnchantmentTier }
export interface SelectedRangedEnchantment extends RangedRoll { readonly source: 'slot' | 'gilded' }
export interface OwnedRangedWeapon {
  readonly instanceId: string
  readonly weaponId: string
  readonly powerLevel: number
  readonly enchantmentSlots: readonly { readonly candidates: readonly RangedRoll[]; readonly locked?: string }[]
  readonly gilded?: RangedRoll
  /** Neutral, single-projectile damage, before selectable enchants/Armor/Strength/target DR. */
  readonly observation?: {
    readonly gameVersion: '1.17.0.0'
    readonly mode: RangedShotMode
    readonly projectileDamage: number
    /** Complete cycle: charge (if any), release, reload/recovery, ready again. */
    readonly shotCycleSeconds: number
    readonly availableAmmo: number
    readonly sourceNote: string
  }
}
export interface RangedDamageState {
  readonly supportLevel: 'limited'
  readonly weaponId: string
  readonly mode: RangedShotMode
  readonly damageSource: 'user-observed-unmodified-projectile'
  readonly projectileDamage: number
  readonly shotCycleSeconds: number
  readonly timeShare: number
  readonly shots: number
  readonly shotsPerSecond: number
  readonly ammoConsumed: number
  readonly ammoLimited: boolean
  readonly directSingleTargetDps: number
  readonly directAoeDps: number
  readonly indirectSingleTargetDps: 0
  readonly indirectAoeDps: 0
  readonly expectedMultiplier: number
  readonly limitations: readonly string[]
}
