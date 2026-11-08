import rapidReview from '../../research/sources/rapid-crossbow-source-review.json' with { type: 'json' }
import values from '../../research/domain/formal/value-availability-v2.json' with { type: 'json' }
import relations from '../../research/domain/formal/serialized-relation-v2.json' with { type: 'json' }
import approvals from '../../research/runtime/ranged-observed-reuse.json' with { type: 'json' }
import source from '../../research/sources/ranged-source-snapshot.json' with { type: 'json' }
import identity from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import { nativeRangedReference } from '../domain/rangedNative.ts'
import type { RangedShotMode } from './rangedTypes'
import { fixedPowerBowReuseIsEligible, isFixedPowerBow } from './fixedPowerBowReuse.ts'
import { fixedRapidFireReuseIsEligible, isFixedRapidFireWeapon } from './fixedRapidFireReuse.ts'

export type RangedReuseApproval = (typeof approvals.approvals)[number]
/** Fail closed on undeclared targets, source/intrinsic/version/mode drift.
 * This only reuses existing observed arithmetic. No Native formula/parameter
 * is promoted, no Measured/Verified classification is granted.
 */
export function rangedReuseIsEligible(id: string, mode: RangedShotMode,
  grants: readonly RangedReuseApproval[] = approvals.approvals,
  snapshot: typeof source = source): boolean {
  if (id === 'rapid-crossbow') return mode === 'single' && rapidCrossbowReuseIsEligible(grants, snapshot)
  if (isFixedPowerBow(id)) return fixedPowerBowReuseIsEligible(id, mode, undefined, snapshot) && rangedReuseIsEligible('power-bow', mode, grants, snapshot)
  if (isFixedRapidFireWeapon(id)) return fixedRapidFireReuseIsEligible(id, mode, undefined, snapshot) && (id === 'azure-seeker' || rangedReuseIsEligible('shortbow', mode, grants, snapshot))
  if (!['shortbow', 'longbow', 'power-bow', 'heavy-crossbow'].includes(id)
    || (id === 'heavy-crossbow' ? mode !== 'single' : mode !== 'charged' && mode !== 'uncharged')) return false
  // Each mode has its own grant: withdrawing an uncharged grant must not
  // withdraw the existing charged mode, and duplicates of a tuple fail closed.
  const matches = grants.filter((grant) => grant.targetId === id && grant.mode === mode)
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
    && grant.testRef === (mode === 'uncharged' ? 'tests/rangedUnchargedReuse.test.ts' : 'tests/rangedNativeReuse.test.ts')
    && JSON.stringify(grant.nonInheritedEffects) === JSON.stringify(['donor damage', 'donor cadence', 'Power curve', 'native CDO baseline as final damage', 'native theoretical cycle as measured cycle', ...(mode === 'uncharged' ? ['charged damage, charged cadence and charge multiplier'] : [])])
    && JSON.stringify(grant.rejectedInteractions) === JSON.stringify(['special arrows', 'multiple projectiles', 'pierce', 'ricochet', 'explosion', 'DoT', 'Soul', 'unverified enchants or armor combinations'])
    && row?.sourceUrl === grant.sourceUrl
    && JSON.stringify(row.facts.slice(3)) === JSON.stringify(grant.intrinsicFacts)
    && reference.state === 'known' && reference.gameVersion === grant.gameVersion
    && reference.blueprintReview?.status === 'source-derived-limited-observed-only'
    && (mode !== 'uncharged' || (reference.chargeSwitch === 'completion-callback-boolean'
      && grant.modeEvidence?.ref === reference.blueprintReview.ref
      && grant.modeEvidence?.chargeSwitch === reference.chargeSwitch
      && grant.modeEvidence?.chargeState === 'completion-callback-not-run'
      && grant.intrinsicDisposition === 'uncharged normal arrow uses target mode-specific observation; no charged damage, cadence or charge multiplier is inherited'))
    && reference.configuredProjectile.NumberOfProjectiles === 1
    && reference.configuredProjectile.DelaySeconds === 0 && reference.configuredProjectile.DelaySecondsPerProjectile === 0
    && assertion?.id === reference.identityAssertionId && assertion.reviewState === 'accepted'
    && assertion.rawIdentity === grant.rawIdentity
    && identity.semantic.identities.some((entry) => entry.assertionId === assertion.id && entry.resolution.state === 'matched')
}
export function hasRangedReuseGrant(id: string): boolean {
  return (['uncharged', 'charged', 'single'] as const).some((mode) => rangedReuseIsEligible(id, mode))
}

/** Own serialized census/components only. Native cost and all effective numbers
 * remain unknown. An explicit per-instance one-arrow observation is separate. */
export function rapidCrossbowReuseIsEligible(
  grants: readonly RangedReuseApproval[] = approvals.approvals,
  snapshot: typeof source = source,
  review: typeof rapidReview = rapidReview,
  formalIdentity: typeof identity = identity,
  formalValues: typeof values = values,
  formalRelations: typeof relations = relations,
): boolean {
  const matches = grants.filter((grant) => grant.targetId === 'rapid-crossbow' && grant.mode === 'single')
  const rows = snapshot.weapons.rows.filter((row) => row.id === 'rapid-crossbow')
  if (matches.length !== 1 || rows.length !== 1) return false
  const grant = matches[0]!, row = rows[0]!
  const assertion = formalIdentity.identityAssertions.find((entry) => entry.domainId === 'rapid-crossbow')
  const semantic = formalIdentity.semantic.identities.find((entry) => entry.assertionId === assertion?.id)
  const projectile = formalValues.semantic.ranged['rapid-crossbow']
  const relation = formalRelations.relationProjections.filter((entry) => entry.occurrence.domainId === 'rapid-crossbow' && entry.occurrence.sourceIndex === 0)
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return snapshot.schemaVersion === 1 && snapshot.weapons.claimedGameVersion === '1.17.0.0'
    && grant.gameVersion === '1.17.0.0' && grant.rawIdentity === 'RapidCrossbow' && grant.donorId === 'crossbow'
    && grant.classification === 'derived' && grant.runtimeSupport === 'limited'
    && grant.mechanic === 'observed-normal-single-projectile' && grant.channel === 'direct-ranged' && grant.scope === 'one-arrow-one-target'
    && grant.inputPolicy === 'target-observation-required' && grant.observationCondition === 'explicit-arrowsConsumedPerShot-equals-1'
    && grant.sourceRef === 'research/sources/ranged-source-snapshot.json' && grant.sourceUrl === row.sourceUrl && row.sourceUrl === 'https://www.dungeons.tools/weapons/rapid-crossbow'
    && same(row.facts.slice(3), ['High Firerate']) && same(grant.intrinsicFacts, ['High Firerate'])
    && grant.intrinsicDisposition === review.intrinsicDisposition
    && grant.sourceReviewRef === 'research/sources/rapid-crossbow-source-review.json' && grant.testRef === 'tests/rapidCrossbowReuse.test.ts'
    && same(grant.nonInheritedEffects, ['donor damage', 'donor cadence', 'Power curve', 'native CDO baseline as final damage', 'native theoretical cycle as measured cycle', 'ProjectileStackCount as ammo consumption', 'Auto Crossbow Accelerate', 'Butterfly Crossbow Bonus Shot'])
    && same(grant.rejectedInteractions, ['special arrows', 'multiple projectiles', 'pierce', 'ricochet', 'explosion', 'DoT', 'Soul', 'unverified enchants or armor combinations'])
    && review.schemaVersion === 1 && review.kind === 'rapid-crossbow-bounded-observed-reuse-source-review' && review.gameVersion === '1.17.0.0'
    && review.versionStatus === 'local-input-and-publisher-claim'
    && review.reviewScope === 'Own Function export census and known serialized component differences only. Not a proof of all BlueprintGeneratedClass payloads, Native semantics, final damage, effective timing or ResourceCost.'
    && review.rawRef === 'research/raw/game-data-raw-structural-inventory/shards/part-026.json.gz'
    && review.identityAssertionId === 'identity:rapid-crossbow@1' && review.rawIdentity === 'RapidCrossbow'
    && review.itemPackage === 'Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossbowInstance'
    && review.projectilePackage === 'Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossBow_Arrow'
    && review.packages.length === 3 && review.packages.every((entry) => entry.ownFunctionExports === 0 && entry.sources.length === 2)
    && same(review.packages.map((entry) => entry.packageIndex), [12, 13, 14])
    && same(review.packages.map((entry) => entry.exportCount), [21, 11, 5])
    && same(review.packages.flatMap((entry) => entry.sources.map((file) => file.sha256)), RAPID_SOURCE_HASHES)
    && review.packages.every((entry, index) => entry.package === `${review.itemPackage.slice(0, review.itemPackage.lastIndexOf('/'))}/${['BP_RapidCrossbow', 'BP_RapidCrossBow_Arrow', 'BP_RapidCrossbowInstance'][index]}`
      && entry.sources.every((file, fileIndex) => file.path === `${entry.package}.${fileIndex === 0 ? 'uasset' : 'uexp'}`))
    && review.knownComponents.projectileMovement.class === 'DungeonsProjectileMovementComp' && review.knownComponents.projectileMovement.ownPropertyCount === 0
    && review.knownComponents.impactActionHandler.class === 'ImpactActionHandler' && review.knownComponents.impactActionHandler.ownPropertyCount === 0
    && review.knownComponents.projectileMovement.parent === 'BP_Arrow' && review.knownComponents.impactActionHandler.parent === 'BP_Arrow'
    && same(review.knownComponents.overrideClasses, ['ParticleSystemComponent', 'StaticMeshComponent', 'AudioComponent'])
    && same(review.knownComponents.opaqueNonNumericScope, ['Guid: component identity', 'Color: particle appearance', 'Rotator: held-gear mesh orientation', 'empty struct-array wrappers: cooked component metadata'])
    && review.knownComponents.donorProjectilePackage === 'Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_PlayerCrossbowArrow'
    && review.knownComponents.projectileMovement.exportIndex === 3 && review.knownComponents.impactActionHandler.exportIndex === 4
    && same(review.knownComponents.projectileMovement.sourceRange, { file: `${review.projectilePackage}.uexp`, start: 620, end: 632 })
    && same(review.knownComponents.impactActionHandler.sourceRange, { file: `${review.projectilePackage}.uexp`, start: 632, end: 644 })
    && review.knownComponents.inheritableHandler.exportIndex === 5 && review.knownComponents.inheritableHandler.recordCount === 3
    && same(review.knownComponents.inheritableHandler.sourceRange, { file: `${review.projectilePackage}.uexp`, start: 644, end: 1999 })
    && [review.nativeResourceCost, review.nativeFinalProjectileDamage, review.nativeEffectiveShotCycleSeconds].every((field) => field.state === 'unknown' && field.runtimeNumericInput === false)
    && review.observationCondition === 'arrowsConsumedPerShot must be explicitly observed as exactly 1; missing and non-1 remain unevaluable, even with no available ammunition.'
    && same(review.rejectedVariants, ['auto-crossbow', 'butterfly-crossbow'])
    && assertion?.id === review.identityAssertionId && assertion.reviewState === 'accepted' && assertion.confidence === 'high' && assertion.rawIdentity === review.rawIdentity
    && assertion.applicationScope.packagePath === review.itemPackage
    && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === 'rapid-crossbow'
    && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === 'RapidCrossbow'
    && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === 'RapidCrossbow'
    && same(projectile.configuredProjectileDefinitions.value, [0]) && projectile.projectileDefinitions.length === 1
    && projectile.projectileDefinitions[0]?.configuredProjectileCount.value === 1
    && projectile.projectileDefinitions[0]?.configuredDelaySeconds.value === 0 && projectile.projectileDefinitions[0]?.configuredDelaySecondsPerProjectile.value === 0
    && projectile.projectileDefinitions[0]?.configuredAngleSpan.value === 0
    && same(review.configuredProjectile, { sourceIndex: 0, NumberOfProjectiles: 1, DelaySeconds: 0, DelaySecondsPerProjectile: 0, AngleSpan: 0, MaxRandomizedAngleFactor: 0, NonRandomFirstArrow: true })
    && relation.length === 1 && relation[0]!.result === 'projected' && relation[0]!.serializedTargetResolution.state === 'resolved-local-package'
    && relation[0]!.serializedTargetResolution.structuralPackagePath === review.projectilePackage
}

const RAPID_SOURCE_HASHES = [
  '4b5d1cc9be4bb1b1bbb0decb23a92afa2f67be22af75da303e5f65af3e7eeca8',
  'a2a824bd635f3c0c8a1a3b18d0480e356d0f592473ce13c015512a0560c73232',
  'd1ea306de777b6bc79d62dab1687cfc098cc4fae63af542c1954c81808194332',
  'b5e924500761b69c24f57ec98e4dd07276e13e869638a69d45ceebff1c1c6cb6',
  'b5e9a815f5e512b986469c7a13d8ef0548bf4d69f907e3ca973b778bcb4029c7',
  '52e6d6270f87c6ae674ec92524efda521224185c226a3de5a9e743150e686823',
]
