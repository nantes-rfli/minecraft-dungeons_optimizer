import type { Inventory } from '../src/core/types'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import { isFixedPowerBow } from '../src/core/fixedPowerBowReuse'

// Synthetic software fixtures. No game observations, new formulas or promotion Evidence.
export const readinessMelee: Inventory = {
  weapons: [{ instanceId: 'melee', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit', 'sharpness'], selected: { enchantmentId: 'critical-hit', tier: 2 } }], gilded: { enchantmentId: 'radiance', tier: 1 } }],
  artifacts: [],
}
export function readinessRanged(weaponId = 'bow', instanceId = weaponId): OwnedRangedWeapon {
  const powerLevel = 251
  const fixed = isFixedPowerBow(weaponId)
  return { instanceId, weaponId, powerLevel, enchantmentSlots: [], observation: { gameVersion: '1.17.0.0', mode: weaponId.includes('crossbow') ? 'single' : weaponId === 'bow' ? 'uncharged' : 'charged', projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 20, ...(weaponId === 'rapid-crossbow' || fixed ? { arrowsConsumedPerShot: 1 } : {}), ...(fixed ? { fixedPowerObservation: { powerLevel } } : {}), sourceNote: 'SYNTHETIC TEST ONLY — not gameplay Evidence' } }
}
