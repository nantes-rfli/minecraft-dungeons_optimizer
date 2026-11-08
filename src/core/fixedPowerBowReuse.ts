import identity from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import grant from '../../research/runtime/observed-fixed-power-bow-reuse.json' with { type: 'json' }
import source from '../../research/sources/observed-fixed-power-bows.json' with { type: 'json' }
import snapshot from '../../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import type { RangedShotMode, SelectedRangedEnchantment } from './rangedTypes'

const targets = {
  'elite-power-bow': { raw: 'Powerbow_Unique1', key: 'PowerBow_Unique1', name: 'Elite Power Bow', instanceParent: 'BP_PowerBowInstance_C', arrowParent: 'BP_PlayerPowerBowArrow_C' },
  'phantom-bow': { raw: 'PowerBow_Spooky2', key: 'PowerBow_Spooky2', name: 'Phantom Bow', instanceParent: 'BP_PowerBow_Unique1Instance_C', arrowParent: 'BP_PowerBow_Unique1_Arrow_C' },
} as const
export const isFixedPowerBow = (id: string): id is keyof typeof targets => Object.hasOwn(targets, id)
export const FIXED_RANGED_POWER = { enchantmentId: 'power', tier: 1, source: 'built-in' } as const satisfies SelectedRangedEnchantment

export function fixedPowerBowReuseIsEligible(id: string, mode: RangedShotMode, evidence: typeof source = source, published: typeof snapshot = snapshot): boolean {
  if (!isFixedPowerBow(id) || (mode !== 'charged' && mode !== 'uncharged')) return false
  const rows = evidence.rows.filter((entry) => entry.id === id)
  const catalog = published.weapons.rows.filter((entry) => entry.id === id)
  const donor = published.weapons.rows.find((entry) => entry.id === grant.donorId)
  if (rows.length !== 1 || catalog.length !== 1) return false
  const row = rows[0]!, item = catalog[0]!, expected = targets[id]
  const assertion = identity.identityAssertions.find((entry) => entry.domainId === id)
  const resolved = identity.semantic.identities.find((entry) => entry.assertionId === assertion?.id)
  return grant.schemaVersion === 1 && evidence.schemaVersion === 1 && published.schemaVersion === 1
    && grant.gameVersion === '1.17.0.0' && evidence.gameVersion === grant.gameVersion && published.weapons.claimedGameVersion === grant.gameVersion
    && grant.route === 'existing-limited-mechanic-reuse' && grant.runtimeSupport === 'limited' && grant.classification === 'derived'
    && grant.mechanic === 'observed-normal-single-projectile-including-fixed-power-i' && grant.scope === 'one-arrow-one-target'
    && grant.donorId === 'power-bow' && grant.targets[id].includes(mode)
    && grant.sourceRef === 'research/sources/observed-fixed-power-bows.json' && grant.testRef === 'tests/fixedPowerBowReuse.test.ts'
    && row.rawIdentity === expected.raw && row.displayName === expected.name && row.localization.namespace === 'ItemType'
    && row.localization.key === expected.key && row.localization.value === expected.name
    && row.fixed.enchantmentId === 'power' && row.fixed.tier === 1 && row.fixed.bonus === 0.1
    && item.name === expected.name && item.sourceUrl === row.sourceUrl && row.sourceUrl === `https://www.dungeons.tools/weapons/${id}`
    && item.facts.slice(3).join('|') === 'Built in: Power'
    && donor?.facts.slice(3).join('|') === 'Strong Charged Attacks'
    && row.ownPackages.length === 3 && row.ownPackages[1]?.parentClass === expected.arrowParent
    && row.ownPackages[2]?.parentClass === expected.instanceParent && row.ownPackages[2]?.path === row.packagePath
    && row.reviewedComponents.length === 3 && row.reviewedComponents[0]?.class === 'DungeonsProjectileMovementComp'
    && row.reviewedComponents[1]?.class === 'ImpactActionHandler' && row.reviewedComponents[2]?.class === 'InheritableComponentHandler'
    && row.reviewedComponents[0].ownPropertyNames.length === 0 && row.reviewedComponents[1].ownPropertyNames.length === 0
    && row.reviewedComponents[2].overrides?.join('|') === (id === 'elite-power-bow' ? 'ParticleSystemComponent|AudioComponent' : 'ParticleSystemComponent|ParticleSystemComponent')
    && row.ownPackages[0]?.functions.length === 0 && row.ownPackages[2]?.functions.length === 0
    && row.ownPackages[1].functions.map(({ name }) => name).join('|') === (id === 'elite-power-bow' ? 'ExecuteUbergraph_BP_PowerBow_Unique1_Arrow|ToggleCharged' : '')
    && (id !== 'phantom-bow' || fixedPowerBowReuseIsEligible('elite-power-bow', mode, evidence, published))
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high' && assertion.rawIdentity === expected.raw
    && assertion.applicationScope.packagePath === row.packagePath && resolved?.resolution.state === 'matched' && resolved.resolution.domainId === id
    && resolved.rawEvidence.itemIdName.state === 'known' && resolved.rawEvidence.itemIdName.value === expected.raw
    && resolved.rawEvidence.serializedId.state === 'known' && resolved.rawEvidence.serializedId.value === expected.raw
}
