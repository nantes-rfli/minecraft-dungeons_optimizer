import type { CatalogResearchAttributes, EnchantmentTier, EquipmentRarity, OwnedEnchantmentSlot } from './types'

export type RangedShotMode = 'uncharged' | 'charged' | 'single'
export interface RangedRoll { readonly enchantmentId: string; readonly tier: EnchantmentTier }
export interface SelectedRangedEnchantment extends RangedRoll { readonly source: 'slot' | 'gilded' | 'built-in' }
export interface OwnedRangedWeapon {
  /** Retained Catalog facts, not observations or gameplay inputs. */
  readonly research?: CatalogResearchAttributes
  readonly instanceId: string
  readonly weaponId: string
  readonly powerLevel: number
  readonly enchantmentSlots: readonly OwnedEnchantmentSlot<string>[]
  readonly gilded?: RangedRoll
  readonly rarity?: EquipmentRarity
  /** User-owned organization metadata; does not affect optimizer eligibility or score. */
  readonly isFavorite?: boolean
  readonly notes?: string
  /** Neutral, single-projectile damage, before selectable enchants/Armor/Strength/target DR. */
  readonly observation?: {
    readonly gameVersion: '1.17.0.0'
    readonly mode: RangedShotMode
    readonly projectileDamage: number
    /** Present only when the recorded damage includes this variant's owned Power I. */
    readonly fixedPowerObservation?: { readonly powerLevel: number }
    /** Present only when the complete cycle includes this variant's owned Rapid Fire I. */
    readonly fixedCadenceObservation?: { readonly powerLevel: number }
    /** Complete cycle: charge (if any), release, reload/recovery, ready again. */
    readonly shotCycleSeconds: number
    /** Own observed normal-arrow consumption per complete shot. No default is persisted. */
    readonly arrowsConsumedPerShot?: number
    readonly availableAmmo: number
    readonly sourceNote: string
  }
}
export interface RangedDamageState {
  readonly supportLevel: 'limited'
  readonly weaponId: string
  readonly mode: RangedShotMode
  readonly damageSource: 'user-observed-unmodified-projectile' | 'user-observed-projectile-including-fixed-power'
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
