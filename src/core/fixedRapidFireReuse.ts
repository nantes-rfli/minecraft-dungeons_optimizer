import identity from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import grant from '../../research/runtime/observed-rapid-fire-reuse.json' with { type: 'json' }
import source from '../../research/sources/observed-rapid-fire-variants.json' with { type: 'json' }
import snapshot from '../../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import type { RangedShotMode, SelectedRangedEnchantment } from './rangedTypes'

const targets = {
  'azure-seeker': { raw: 'Crossbow_Unique2', name: 'Azure Seeker', donor: 'crossbow', instanceParent: 'BP_CrossbowInstance_C', arrowParent: 'BP_PlayerCrossbowArrow_C' },
  'purple-storm': { raw: 'Shortbow_Unique1', name: 'Purple Storm', donor: 'shortbow', instanceParent: 'BP_ShortbowInstance_C', arrowParent: 'BP_ShortBow_Arrow_C' },
} as const
export const isFixedRapidFireWeapon = (id: string): id is keyof typeof targets => Object.hasOwn(targets, id)
export const FIXED_RAPID_FIRE = { enchantmentId: 'rapid-fire', tier: 1, source: 'built-in' } as const satisfies SelectedRangedEnchantment

export function fixedRapidFireReuseIsEligible(id: string, mode: RangedShotMode, evidence: typeof source = source, published: typeof snapshot = snapshot): boolean {
  if (!isFixedRapidFireWeapon(id) || !grant.targets[id].includes(mode)) return false
  const rows = evidence.rows.filter((entry) => entry.id === id)
  const catalog = published.weapons.rows.filter((entry) => entry.id === id)
  if (rows.length !== 1 || catalog.length !== 1) return false
  const row = rows[0]!, item = catalog[0]!, expected = targets[id]
  const donor = published.weapons.rows.find((entry) => entry.id === expected.donor)
  const tier = published.enchantments.rows.find((entry) => entry.id === FIXED_RAPID_FIRE.enchantmentId)
  const assertion = identity.identityAssertions.find((entry) => entry.domainId === id)
  const resolved = identity.semantic.identities.find((entry) => entry.assertionId === assertion?.id)
  return grant.schemaVersion === 1 && evidence.schemaVersion === 1 && published.schemaVersion === 1
    && grant.gameVersion === '1.17.0.0' && evidence.gameVersion === grant.gameVersion && published.weapons.claimedGameVersion === grant.gameVersion
    && grant.route === 'existing-limited-mechanic-reuse' && grant.runtimeSupport === 'limited' && grant.classification === 'derived'
    && grant.mechanic === 'observed-complete-shot-cycle-including-fixed-rapid-fire-i' && grant.scope === 'one-arrow-one-target'
    && grant.sourceRef === 'research/sources/observed-rapid-fire-variants.json' && grant.testRef === 'tests/fixedRapidFireReuse.test.ts'
    && row.donorId === expected.donor && row.rawIdentity === expected.raw && row.displayName === expected.name
    && row.localization.namespace === 'ItemType' && row.localization.key === expected.raw && row.localization.value === expected.name
    && row.fixed.enchantmentId === FIXED_RAPID_FIRE.enchantmentId && row.fixed.tier === FIXED_RAPID_FIRE.tier && row.fixed.publishedAttackSpeedBonus === 0.1
    && tier?.facts.join('|') === 'Applies to ranged|+10% / +15% / +20% attack speed'
    && item.name === expected.name && item.sourceUrl === row.sourceUrl && row.sourceUrl === `https://www.dungeons.tools/weapons/${id}`
    && item.facts.slice(3).join('|') === 'Built in: Rapid Fire'
    && donor?.facts.slice(3).join('|') === (id === 'azure-seeker' ? 'Faster Projectiles' : '')
    && row.ownPackages.length === 3 && row.ownPackages[1]?.parentClass === expected.arrowParent
    && row.ownPackages[2]?.parentClass === expected.instanceParent && row.ownPackages[2]?.path === row.packagePath
    && row.reviewedComponents[0]?.class === 'DungeonsProjectileMovementComp' && row.reviewedComponents[0].propertyNames.length === 0
    && row.reviewedComponents[1]?.class === 'ImpactActionHandler' && row.reviewedComponents[1].propertyNames.length === 0
    && row.reviewedComponents[2]?.class === 'InheritableComponentHandler'
    && (id === 'azure-seeker' ? row.reviewedComponents[2].propertyNames.length === 0 : row.reviewedComponents[2].overrideClasses?.join('|') === 'ParticleSystemComponent'
      && evidence.purpleChargeCue.tag === 'GameplayCue.Trigger.PurpleRain.ChargeShot' && evidence.purpleChargeCue.particle === 'PS_PurpleRain_ChargedArrowLaunch'
      && evidence.purpleChargeCue.base.scriptSha256 === '657ec0923ae6dda480edc38044031fcd0715485f82dd86cef50f506662da029f')
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high' && assertion.rawIdentity === expected.raw
    && assertion.applicationScope.packagePath === row.packagePath && resolved?.resolution.state === 'matched' && resolved.resolution.domainId === id
    && resolved.rawEvidence.itemIdName.state === 'known' && resolved.rawEvidence.itemIdName.value === expected.raw
    && resolved.rawEvidence.serializedId.state === 'known' && resolved.rawEvidence.serializedId.value === expected.raw
}
