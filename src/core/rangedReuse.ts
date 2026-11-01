import approvals from '../../research/runtime/ranged-observed-reuse.json' with { type: 'json' }
import source from '../../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import identity from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import { nativeRangedReference } from '../domain/rangedNative.ts'
import type { RangedShotMode } from './rangedTypes'

export type RangedReuseApproval = (typeof approvals.approvals)[number]
/** Fail closed on undeclared targets, source/intrinsic/version/mode drift.
 * This only reuses existing observed arithmetic. No Native formula/parameter
 * is promoted, no Measured/Verified classification is granted.
 */
export function rangedReuseIsEligible(id: string, mode: RangedShotMode,
  grants: readonly RangedReuseApproval[] = approvals.approvals,
  snapshot: typeof source = source): boolean {
  if (!['shortbow', 'longbow', 'power-bow', 'heavy-crossbow'].includes(id) || mode !== (id === 'heavy-crossbow' ? 'single' : 'charged')) return false
  const matches = grants.filter((grant) => grant.targetId === id)
  if (matches.length !== 1) return false
  const grant = matches[0]!
  const row = snapshot.weapons.rows.find((entry) => entry.id === id)
  const reference = nativeRangedReference(id)
  const assertion = identity.identityAssertions.find((entry) => entry.domainId === id)
  return snapshot.schemaVersion === 1 && snapshot.weapons.claimedGameVersion === grant.gameVersion
    && grant.mode === mode && grant.gameVersion === '1.17.0.0'
    && grant.classification === 'derived' && grant.runtimeSupport === 'limited'
    && grant.mechanic === 'observed-normal-single-projectile'
    && grant.channel === 'direct-ranged' && grant.scope === 'one-arrow-one-target'
    && grant.inputPolicy === 'target-observation-required'
    && grant.sourceRef === 'research/sources/ranged-source-snapshot.json'
    && grant.donorId === (mode === 'single' ? 'crossbow' : 'bow')
    && grant.testRef === 'tests/rangedNativeReuse.test.ts'
    && JSON.stringify(grant.nonInheritedEffects) === JSON.stringify(['donor damage', 'donor cadence', 'Power curve', 'native CDO baseline as final damage', 'native theoretical cycle as measured cycle'])
    && JSON.stringify(grant.rejectedInteractions) === JSON.stringify(['special arrows', 'multiple projectiles', 'pierce', 'ricochet', 'explosion', 'DoT', 'Soul', 'unverified enchants or armor combinations'])
    && row?.sourceUrl === grant.sourceUrl
    && JSON.stringify(row.facts.slice(3)) === JSON.stringify(grant.intrinsicFacts)
    && reference.state === 'known' && reference.gameVersion === grant.gameVersion
    && reference.blueprintReview?.status === 'source-derived-limited-observed-only'
    && reference.configuredProjectile.NumberOfProjectiles === 1
    && reference.configuredProjectile.DelaySeconds === 0 && reference.configuredProjectile.DelaySecondsPerProjectile === 0
    && assertion?.id === reference.identityAssertionId && assertion.reviewState === 'accepted'
    && assertion.rawIdentity === grant.rawIdentity
    && identity.semantic.identities.some((entry) => entry.assertionId === assertion.id && entry.resolution.state === 'matched')
}
export function hasRangedReuseGrant(id: string): boolean {
  return (['charged', 'single'] as const).some((mode) => rangedReuseIsEligible(id, mode))
}
