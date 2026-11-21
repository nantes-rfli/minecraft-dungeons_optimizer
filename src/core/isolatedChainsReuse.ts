import identities from '../../research/domain/formal/identity-evidence-v1.json' with { type: 'json' }
import profiles from '../../research/melee-attack-profile-audit.json' with { type: 'json' }
import harvest from '../../research/source-harvest/snapshots/dungeons-tools-2026-09-06.json' with { type: 'json' }
import approval from '../../research/runtime/observed-isolated-chains-reuse.json' with { type: 'json' }
import nativeProof from '../../research/native/coverage-integration-20261121/chains-dispatch-proof.json' with { type: 'json' }
import { ISOLATED_CHAINS_MELEE_COMBO_SOURCE as source, isIsolatedChainsMeleeId } from '../data/fixedObservedMeleeCombo'
import { OBSERVED_MELEE_COMBO_WEAPONS as weapons, OBSERVED_MELEE_COMBO_PROFILES as runtimeProfiles } from '../data/observedMeleeCombo'
import type { OwnedWeapon, Scenario } from './types'
import type { ReadinessIssue } from './readiness'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const defaults = { identities, profiles, harvest, approval, nativeProof, source, weapons, runtimeProfiles }

/** Finite reuse of observed direct combos. No Chains probability/duration/radius
 * is evaluated. The source audit replays the own Raw rows and the static bridge.
 */
export function isolatedChainsMeleeIsEligible(id: string, overrides: Partial<typeof defaults> = {}): boolean {
  if (!isIsolatedChainsMeleeId(id)) return false
  const d = { ...defaults, ...overrides }
  const jailor = id === 'jailors-scythe'
  const expected = jailor
    ? { raw: 'SoulScythe_Unique1', name: "Jailor's Scythe", slug: 'jailor-s-scythe', hits: [80, 80], times: [0.48, 0.56], ratings: [6.915, 2.646, 9.425], facts: ['Binds and chains enemies', '+1 Soul gathering'] }
    : { raw: 'Mace_Unique2', name: 'Flail', slug: 'flail', hits: [81, 81, 175], times: [0.44, 0.44, 0.77], ratings: [8.405, 1.905, 3.209], facts: ['Binds and chains enemies'] }
  const rows = d.source.rows.filter((row) => row.id === id)
  const row = rows[0]
  if (rows.length !== 1 || !row) return false
  const assertion = d.identities.identityAssertions.find((a) => a.domainId === id)
  const semantic = d.identities.semantic.identities.find((s) => s.assertionId === assertion?.id)
  const audit = d.profiles.weapons.find((p) => p.weaponId === id)
  const claims = d.harvest.claims.filter((c) => c.entityId === `melee-weapon:${id}` && c.property === 'intrinsicMechanicOwnership')
  const weapon = d.weapons[id as keyof typeof d.weapons]
  const profile = d.runtimeProfiles[id as keyof typeof d.runtimeProfiles]
  const g = d.approval
  const proof = d.nativeProof
  return g.schemaVersion === 1 && g.gameVersion === '1.17.0.0' && g.route === 'existing-limited-mechanic-reuse'
    && g.classification === 'derived' && g.runtimeSupport === 'limited'
    && g.mechanic === 'owned-tier-one-chains-no-application-on-isolated-observed-combo'
    && g.scope === 'single-target-uninterrupted-complete-combos-at-base-speed'
    && g.sourceRef === 'research/sources/observed-isolated-chains.json' && g.testRef === 'tests/observedIsolatedChains.test.ts'
    && g.observation === 'own ordinary complete combo at current Power; initially unchained target and no other eligible Chains query candidates throughout the interval'
    && same(g.targets, { flail: 'chains', 'jailors-scythe': 'chains' })
    && same(g.allowedAdditionalSoulEnchantments, ['anima-conduit']) && g.state === 'no-application-call' && g.newNumericMechanicAdopted === false
    && d.source.gameVersion === g.gameVersion && d.profiles.gameVersion === g.gameVersion && d.harvest.targetGameVersion === g.gameVersion
    && d.source.calculatorSource.url === 'https://www.dungeons.tools/damage-calculator'
    && d.source.calculatorSource.htmlSha256 === '8d9a17c330fb5b430c38522f23cc489e37108f62cb570bf100527bdfadebfdee'
    && d.source.nativeProofRef === 'research/native/coverage-integration-20261121/chains-dispatch-proof.json'
    && proof.schemaVersion === 1 && proof.scope === 'finite-static-no-application-bridge' && proof.gameVersion === g.gameVersion
    && proof.imageSha256 === '04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
    && proof.gameplayObserved === false && proof.r3Accepted === false && proof.newNumericMechanicAdopted === false
    && same(proof.fixedRecords, [{ id: 'flail', rawIdentity: 'Mace_Unique2', enum: 24, tier: 1 }, { id: 'jailors-scythe', rawIdentity: 'SoulScythe_Unique1', enum: 24, tier: 1 }])
    && proof.registry.record.assetName === 'BP_Chains'
    && proof.registry.record.tags.GeneratedClass === "BlueprintGeneratedClass'/Game/Components/Enchantments/Chains/BP_Chains.BP_Chains_C'"
    && proof.registry.record.tags.NativeParentClass === "Class'/Script/Dungeons.Chains'"
    && same(d.source.rows.map((r) => r.id), ['flail', 'jailors-scythe'])
    && row.rawIdentity === expected.raw && row.packagePath === `Dungeons/Content/Actors/Equipment/MeleeWeapons/${expected.raw}/BP_${expected.raw}Instance`
    && row.calculatorRow.name === expected.name && row.calculatorRow.slug === expected.slug && row.calculatorRow.route === `/weapons/${expected.slug}`
    && row.calculatorRow.type === 'melee' && same(row.calculatorRow.builtIn, ['Chains'])
    && same([row.calculatorRow.power, row.calculatorRow.speed, row.calculatorRow.area], expected.ratings)
    && row.sourceUrl === `https://www.dungeons.tools/weapons/${expected.slug}` && same(row.intrinsicFacts, expected.facts)
    && row.fixed.enchantmentId === 'chains' && row.fixed.tier === 1
    && row.fixed.tierSourceRef === `research/native/coverage-20261114/chains-evidence.json#/items/${jailor ? 1 : 0}/fixedRecord`
    && row.fixed.tierSourceUrl === row.wikiTimingSource
    && row.localization.namespace === 'ItemType' && row.localization.key === expected.raw && row.localization.value === expected.name
    && same(row.publishedBaseDamage, expected.hits) && same(row.hitDurationsSeconds, expected.times)
    && claims.length === 1 && claims[0]?.sourceId === `external-dungeons-tools:melee-weapon:${id}`
    && claims[0].sourceGameVersion === '1.17.0.0 publisher-claimed' && claims[0].interpretation === 'direct'
    && claims[0].sourceLocator === `${row.sourceUrl} — Properties and details` && same(claims[0].value, expected.facts)
    && assertion?.reviewState === 'accepted' && assertion.confidence === 'high' && assertion.rawIdentity === expected.raw
    && assertion.applicationScope.packagePath === row.packagePath && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === id
    && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === expected.raw
    && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === expected.raw
    && audit?.status === 'exact' && !audit.specialHandlingRequired && audit.name.en === expected.name
    && audit.sources.length === 1 && audit.sources[0]?.url === row.wikiTimingSource && audit.sources[0]?.type === 'minecraft-wiki'
    && audit.attackProfile.comboHits === expected.hits.length && audit.attackProfile.comboFinisherHit === expected.hits.length
    && same(audit.attackProfile.hitDurationsSeconds, expected.times) && same(audit.damageProfile.rawBaseDamageRows.map((r) => r.baseDamage), expected.hits)
    && (jailor ? row.soul?.acceptsSoulEnchantments === true && row.soul.baseSoulGathering === 1 : row.soul === undefined)
    && weapon?.id === id && weapon.name.en === expected.name && same([weapon.internalPowerRating.value, weapon.speed.value, weapon.area.value], expected.ratings)
    && weapon.soul.acceptsSoulEnchantments === jailor && weapon.soul.baseSoulGathering.value === (jailor ? 1 : 0)
    && profile?.source.kind === 'published-reference' && profile.source.url === row.wikiTimingSource
    && profile.value.method === 'published-hit-timings' && same(profile.value.hitDurationsSeconds, expected.times) && profile.value.comboFinisherHit === expected.hits.length
}

export const CHAINS_ISOLATION_REQUIREMENT = '開始時に主対象のChains状態がなく、評価全期間で主対象以外の適格Chains候補がいないことを確認してください。射程内の敵数1だけでは保証できません。'

export function isolatedChainsScenarioIssue(weapon: Pick<OwnedWeapon, 'weaponId'>, scenario: Scenario): ReadinessIssue | undefined {
  if (!isIsolatedChainsMeleeId(weapon.weaponId)) return undefined
  const c = scenario.crowdControl.chainsIsolation
  if (!c || c.encounterDurationSeconds !== scenario.encounterDurationSeconds || c.noOtherEligibleCandidates === undefined || c.initiallyUnchained === undefined) {
    return { kind: 'input-required', target: 'scenario', message: `MISSING_CHAINS_ISOLATION: ${CHAINS_ISOLATION_REQUIREMENT}`, fields: ['Chains 孤立条件（全評価期間）', '開始時のChains状態なし'] }
  }
  if (c.noOtherEligibleCandidates !== true || c.initiallyUnchained !== true) {
    return { kind: 'constrained', target: 'scenario', message: `UNSUPPORTED_CHAINS_ISOLATION: ${CHAINS_ISOLATION_REQUIREMENT}` }
  }
  return undefined
}
