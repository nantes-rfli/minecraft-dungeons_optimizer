import { describe, expect, it } from 'vitest'
import { ARMORS, type RuntimeArmorDefinition } from '../src/data/armors'
import type { ArmorId } from '../src/core/armor'
import {
  ARMOR_EVIDENCE_BINDINGS, ARMOR_INDEPENDENT_CLASSIFICATION_DECISIONS, armorNumericEvidenceRows,
  type ArmorEvidenceBinding, type ArmorIndependentClassificationDecision,
} from '../src/core/armorEvidence'
import { validateBuild } from '../src/core/validation'
import type { Build } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { buildRuntimePromotionManifest, PROMOTION_ARTIFACT_KINDS, type PromotionBundle, type PromotionCandidateInput } from '../src/research/runtimePromotion'
import { PARAMETER_EVIDENCE } from '../src/core/evidenceStatus'
import {
  collectLimitedArmorCatalogErrors, collectLimitedArmorReuseErrors, collectPromotedArmorLinkErrors,
  HISTORICAL_LIMITED_ARMOR_IDS, LIMITED_ARMOR_REUSE_APPROVALS, PROMOTED_ARMOR_RUNTIME_LINKS,
  type LimitedArmorReuseApproval, type PromotedArmorRuntimeLink,
} from '../src/research/limitedMechanicReuse'

// Keep a synthetic Thief fixture for negative contract tests and compare it to live runtime.
const proposedThief: RuntimeArmorDefinition = {
  ...ARMORS['spider-armor'],
  id: 'thief-armor' as ArmorId,
  name: { en: 'Thief Armor', ja: '盗人のアーマー' },
  family: 'Thief Armor',
  intrinsicProperties: [{ kind: 'melee-attack-speed', raw: '+25% melee attack speed' }],
  meleeDamageBonus: 0,
  weaponDamageAuraBonus: 0,
  armorDamageReduction: 0,
  soulGatheringMultiplier: 1,
  lifeStealFraction: 0,
  artifactCooldownReduction: 0,
}

const thiefCase: LimitedArmorReuseApproval = {
  targetId: 'thief-armor',
  rawIdentity: 'AssassinArmor',
  donorId: 'spider-armor',
  sourceRef: 'research/armor-audit.json',
  sourceId: 'dungeons-tools-armor-index',
  propertyRaw: '+25% melee attack speed',
  propertyKind: 'melee-attack-speed',
  parameterId: 'meleeAttackSpeedBonus',
  parameterValue: 0.25,
  gameVersion: '1.17.0.0',
  channel: 'direct-melee-cadence',
  scope: 'single-armor-speed-source',
  composition: 'reject-unverified',
  excludedPropertyKinds: ['life-steal-aura'],
  rejectedInteractions: ['death-cap-mushroom', 'rampaging'],
  testRefs: {
    positive: 'tests/limitedMechanicReuse.test.ts#positive',
    negative: 'tests/limitedMechanicReuse.test.ts#negative',
    preservation: 'tests/limitedMechanicReuse.test.ts#preservation',
  },
}


const sampleArmorBuild: Build = {
  weapon: {
    instanceId: 'weapon', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100,
    enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } }],
  },
  enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }],
  armor: {
    instanceId: 'armor', armorId: 'spider-armor', powerLevel: 251, observedHealthBonus: 400,
    enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 3 } }],
  },
  armorEnchantments: [{ enchantmentId: 'chilling', tier: 3, source: 'slot' }],
  artifacts: [],
}

// Synthetic A/P3B fixture only. Live Thief has B reuse approval; the checked-in
// Promotion manifest remains unchanged (no adopted target).
const eligibleTarget = 'armor.thief-armor.melee-attack-speed-bonus'
const promotionCandidate: PromotionCandidateInput = {
  targetId: eligibleTarget, targetKind: 'parameter',
  decisionRef: 'research/fixture.json#/decisions/thief-cadence', outcome: 'accepted',
  gameVersion: '1.17.0.0', valueStatus: 'known', regression: 'passed',
  regressionRef: 'research/fixture-regression.json#/targets/0',
  regressionGameVersion: '1.17.0.0', regressionSourceRef: 'tests/limitedMechanicReuse.test.ts#independent-fixture',
  blockers: [],
}
function eligiblePromotions(targetIds: readonly string[]) {
  const candidates = targetIds.map((targetId) => ({ ...promotionCandidate, targetId }))
  const artifacts = Object.fromEntries(PROMOTION_ARTIFACT_KINDS.map((kind) =>
    [kind, { path: `fixture/${kind}.json`, sha256: 'a'.repeat(64) }],
  )) as PromotionBundle['artifacts']
  return buildRuntimePromotionManifest({
    gameVersion: '1.17.0.0', candidates,
    promotions: candidates.map(({ targetId, decisionRef }) => ({
      targetId, decisionRef, supportLevel: 'limited' as const, artifacts,
      rollback: { strategy: 'revert-commit' as const, note: 'Revert the fixture.' },
    })),
  })
}
function eligiblePromotion(targetId: string = eligibleTarget) {
  return eligiblePromotions([targetId])
}
const exactPromotionLink: PromotedArmorRuntimeLink = {
  armorId: 'thief-armor', mechanicTargetId: eligibleTarget,
  parameter: 'meleeAttackSpeedBonus', expectedValue: 0.25, channel: 'direct-melee-cadence',
  scope: 'self-armor', sourceRef: 'research/armor-audit.json',
  sourceId: 'dungeons-tools-armor-index', propertyRaw: '+25% melee attack speed',
  gameVersion: '1.17.0.0',
}

// Synthetic multi-effect Armor: all three parameters have independent
// source-grounded Derived declarations in the Armor audit, but NONE is R3
// adopted without its own accepted/bundled P3B target.
const multiArmor: RuntimeArmorDefinition = {
  ...ARMORS['renegade-armor'],
  id: 'hungry-horror' as ArmorId,
  name: { en: 'Hungry Horror', ja: 'ハングリーホラー' },
  intrinsicProperties: [
    { kind: 'melee-attack-speed', raw: '+25% melee attack speed' },
    { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura' },
    { kind: 'damage-reduction', raw: '35% damage reduction' },
  ],
}
const multiEvidence = {
  ...ARMOR_EVIDENCE_BINDINGS,
  'hungry-horror': {
    meleeAttackSpeedBonus: ARMOR_EVIDENCE_BINDINGS['renegade-armor']!.meleeAttackSpeedBonus!,
    weaponDamageAuraBonus: ARMOR_EVIDENCE_BINDINGS['renegade-armor']!.weaponDamageAuraBonus!,
    armorDamageReduction: {
      ...ARMOR_EVIDENCE_BINDINGS['renegade-armor']!.armorDamageReduction!,
      propertyRaw: '35% damage reduction',
    },
  },
}
const multiTargets = {
  speed: 'armor.hungry-horror.melee-attack-speed-bonus',
  aura: 'armor.hungry-horror.weapon-damage-aura-bonus',
  reduction: 'armor.hungry-horror.damage-reduction',
}
const multiLinks: readonly PromotedArmorRuntimeLink[] = [
  {
    ...exactPromotionLink, armorId: 'hungry-horror', mechanicTargetId: multiTargets.speed,
  },
  {
    ...exactPromotionLink, armorId: 'hungry-horror', mechanicTargetId: multiTargets.aura,
    parameter: 'weaponDamageAuraBonus', expectedValue: 0.2, channel: 'direct-melee-damage',
    propertyRaw: '+20% weapon damage boost aura',
  },
  {
    ...exactPromotionLink, armorId: 'hungry-horror', mechanicTargetId: multiTargets.reduction,
    parameter: 'armorDamageReduction', expectedValue: 0.35, channel: 'incoming-damage',
    propertyRaw: '35% damage reduction',
  },
]

const derivedThief = ARMOR_EVIDENCE_BINDINGS['thief-armor']!.meleeAttackSpeedBonus!
const measuredThief: ArmorEvidenceBinding = {
  ...derivedThief, propertyRaw: '+25% melee attack speed', status: 'measured',
}
const measuredDeclarations = {
  ...ARMOR_EVIDENCE_BINDINGS, 'thief-armor': { meleeAttackSpeedBonus: measuredThief },
}
const independentMeasurement: ArmorIndependentClassificationDecision = {
  armorId: 'thief-armor', parameter: 'meleeAttackSpeedBonus',
  expectedValue: 0.25, gameVersion: '1.17.0.0', status: 'measured',
  decision: 'accepted', reviewerDecision: 'approved',
  decisionRef: 'research/evidence/armor-measurement.json#/decisions/thief',
  independentEvidence: [{
    ref: 'research/evidence/armor-measurement.json#/runs/1',
    originId: 'independent-run-1', gameVersion: '1.17.0.0', method: 'measurement',
  }],
}

describe('Existing Limited Armor mechanic reuse architecture', () => {
  it('preservation: historical seven Armor and 16 Derived parameters stay intact', () => {
    expect(Object.keys(ARMORS)).toEqual([...HISTORICAL_LIMITED_ARMOR_IDS, 'thief-armor'])
    expect(LIMITED_ARMOR_REUSE_APPROVALS).toEqual([thiefCase])
    expect(PROMOTED_ARMOR_RUNTIME_LINKS).toEqual([])
    expect(collectLimitedArmorCatalogErrors()).toEqual([])
    const oldArmors = HISTORICAL_LIMITED_ARMOR_IDS.map((id) => ARMORS[id as keyof typeof ARMORS])
    expect(oldArmors.flatMap((armor) => armorNumericEvidenceRows(armor))).toHaveLength(16)
    expect(oldArmors.flatMap((armor) => armorNumericEvidenceRows(armor)).every((row) => row.binding?.status === 'derived')).toBe(true)
    const rows = Object.values(ARMORS).flatMap((armor) => armorNumericEvidenceRows(armor))
    expect(rows).toHaveLength(17)
    expect(rows.every((row) => row.binding?.status === 'derived')).toBe(true)
    const registered = PARAMETER_EVIDENCE.filter((entry) => entry.mechanicId.startsWith('armor:'))
    expect(registered).toHaveLength(17)
    expect(registered.filter((entry) => entry.mechanicId !== 'armor:thief-armor')).toHaveLength(16)
    expect(registered.find((entry) => entry.mechanicId === 'armor:thief-armor')).toMatchObject({
      parameterId: 'melee-attack-speed-bonus', status: 'derived', gameVersion: '1.17.0.0',
    })
  })

  it('positive: Thief source, exact base→unique inheritance, Limited speed and single-channel model match', () => {
    expect(collectLimitedArmorReuseErrors(thiefCase, proposedThief)).toEqual([])
    expect(ARMORS['thief-armor']).toEqual(proposedThief)
    expect(collectLimitedArmorCatalogErrors()).toEqual([])
    expect(proposedThief.builtInEnchantments).toEqual([])
    expect(proposedThief.soul).toEqual({ acceptsSoulEnchantments: false })
    expect(proposedThief.lifeStealFraction).toBe(0)
    expect(ARMORS['spider-armor'].lifeStealFraction).toBe(0.06)
  })

  it('negative: Thief reuse rejects unreviewed built-in Enchantments and Soul fields', () => {
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, builtInEnchantments: [{ enchantmentId: 'cool-down', tier: 1 }],
    })).toContain('reuse target has unreviewed built-in Enchantments')
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, soul: { acceptsSoulEnchantments: true },
    })).toContain('reuse target Soul enchantment eligibility mismatch')
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, soul: { acceptsSoulEnchantments: false, intrinsicSoulModifier: { bonus: 0.25 } },
    })).toContain('reuse target has unreviewed intrinsic Soul modifier')
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, soul: { acceptsSoulEnchantments: false, intrinsicSoulModifier: 0 },
    })).toContain('reuse target has unreviewed intrinsic Soul modifier')
  })

  it('negative: donor-only built-in and Soul effects cannot leak into a reused Thief target', () => {
    const donorWithBuiltIn: RuntimeArmorDefinition = {
      ...ARMORS['spider-armor'], builtInEnchantments: [{ enchantmentId: 'cool-down', tier: 1 }],
    }
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, builtInEnchantments: donorWithBuiltIn.builtInEnchantments,
    }, donorWithBuiltIn)).toContain('reuse target has unreviewed built-in Enchantments')

    const donorWithSoul: RuntimeArmorDefinition = {
      ...ARMORS['spider-armor'],
      soul: { acceptsSoulEnchantments: false, intrinsicSoulModifier: { bonus: 0.25 } },
    }
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, soul: donorWithSoul.soul,
    }, donorWithSoul)).toContain('reuse target has unreviewed intrinsic Soul modifier')
    const donorWithSoulEligibility: RuntimeArmorDefinition = {
      ...ARMORS['spider-armor'], soul: { acceptsSoulEnchantments: true },
    }
    expect(collectLimitedArmorReuseErrors(thiefCase, {
      ...proposedThief, soul: donorWithSoulEligibility.soul,
    }, donorWithSoulEligibility)).toContain('reuse target Soul enchantment eligibility mismatch')
  })

  it('negative: source Identity, value, version, semantics, extra effect and interaction drift fail closed', () => {
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, rawIdentity: 'unverified' }, proposedThief)).toContain('reuse target Identity is not source-backed')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, sourceId: 'invented' }, proposedThief)).toContain('reuse source/property provenance is missing')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, gameVersion: 'older' as LimitedArmorReuseApproval['gameVersion'] }, proposedThief)).toContain('reuse game version mismatch')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, parameterValue: 0.30 }, proposedThief)).toContain('reuse donor has no matching Limited model/parameter')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, channel: 'ranged' as LimitedArmorReuseApproval['channel'] }, proposedThief)).toContain('reuse channel/scope/composition does not match the existing model')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, excludedPropertyKinds: [] }, proposedThief)).toContain('donor-only properties are not explicitly excluded')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, rejectedInteractions: [] }, proposedThief)).toContain('unverified speed compositions are not rejected')
    expect(collectLimitedArmorReuseErrors(thiefCase, { ...proposedThief, lifeStealFraction: 0.06 })).toContain('reuse target inherits unrelated runtime effect: lifeStealFraction')
    expect(collectLimitedArmorReuseErrors(thiefCase, { ...proposedThief, armorDamageReduction: 0.35 })).toContain('reuse target inherits unrelated runtime effect: armorDamageReduction')
  })

  it('negative: runtime registration or B approval alone cannot grant missing parameter Evidence', () => {
    const catalog = { ...ARMORS, 'thief-armor': proposedThief }
    const missing = { ...ARMOR_EVIDENCE_BINDINGS, 'thief-armor': {} }
    expect(collectLimitedArmorCatalogErrors(catalog, [], []))
      .toContain('thief-armor: runtime Armor lacks explicit Limited reuse approval or P3B promotion')
    expect(collectLimitedArmorCatalogErrors(catalog, [thiefCase], [], undefined, missing))
      .toContain('thief-armor/meleeAttackSpeedBonus: missing or drifted parameter Evidence declaration')
    expect(armorNumericEvidenceRows(proposedThief, missing)[0]?.binding).toBeUndefined()
    expect(armorNumericEvidenceRows(proposedThief)[0]?.binding?.status).toBe('derived')
    expect(ARMOR_EVIDENCE_BINDINGS['thief-armor']?.meleeAttackSpeedBonus?.expectedValue).toBe(0.25)
    const historicalOnly = Object.fromEntries(HISTORICAL_LIMITED_ARMOR_IDS.map((id) => [id, ARMORS[id as keyof typeof ARMORS]]))
    expect(collectLimitedArmorCatalogErrors(historicalOnly, [thiefCase]))
      .toContain('thief-armor: reuse approval has no runtime target')
  })

  it('negative: live Thief source, support, classification and route drift fail closed', () => {
    expect(collectLimitedArmorCatalogErrors({ ...ARMORS, 'thief-armor': {
      ...ARMORS['thief-armor'], meleeAttackSpeedBonus: 0.3,
    } })).toContain('thief-armor: reuse runtime parameter/support mismatch')
    expect(collectLimitedArmorCatalogErrors(ARMORS, [{ ...thiefCase, sourceId: 'invented' }]))
      .toContain('thief-armor: reuse source/property provenance is missing')
    expect(collectLimitedArmorCatalogErrors(ARMORS, [thiefCase], [], undefined, {
      ...ARMOR_EVIDENCE_BINDINGS,
      'thief-armor': { meleeAttackSpeedBonus: { ...derivedThief, expectedValue: 0.3 } },
    })).toContain('thief-armor/meleeAttackSpeedBonus: missing or drifted parameter Evidence declaration')
    expect(collectLimitedArmorCatalogErrors(ARMORS, [thiefCase, thiefCase]))
      .toContain('thief-armor: duplicate reuse approval')
    expect(collectLimitedArmorCatalogErrors(ARMORS, [thiefCase], [exactPromotionLink]))
      .toContain('thief-armor: choose exactly one P4 route')
  })

  it('negative: P3B linkage cannot endorse a held/noneligible manifest candidate or self-approve', () => {
    const syntheticCatalog = { ...ARMORS, 'thief-armor': proposedThief }
    const link = { ...exactPromotionLink, mechanicTargetId: 'defense.damage-taken-composition' }
    expect(collectLimitedArmorCatalogErrors(syntheticCatalog, [], [link])).toContain(
      'thief-armor: P3B link lacks eligible accepted promotion and atomic bundle',
    )
    expect(collectLimitedArmorCatalogErrors(syntheticCatalog, [thiefCase], [link])).toContain(
      'thief-armor: choose exactly one P4 route',
    )
    expect(collectLimitedArmorCatalogErrors(syntheticCatalog, [], [link, link])).toContain(
      'thief-armor: duplicate P3B promotion link',
    )
    expect(collectLimitedArmorCatalogErrors(ARMORS, [], [{ ...link, armorId: 'spider-armor' }])).toContain(
      'spider-armor: pre-policy Armor cannot claim P3B promotion',
    )
  })
  it('A/P3B negative: one accepted link cannot promote other source-backed Derived effects', () => {
    const catalog = { ...ARMORS, 'hungry-horror': multiArmor }
    const oneLink = [multiLinks[0]!]
    const errors = collectLimitedArmorCatalogErrors(
      catalog, [thiefCase], oneLink, eligiblePromotions([multiTargets.speed]), multiEvidence,
    )
    expect(errors).toContain('hungry-horror/weaponDamageAuraBonus: active runtime parameter lacks target-specific P3B promotion')
    expect(errors).toContain('hungry-horror/armorDamageReduction: active runtime parameter lacks target-specific P3B promotion')
    // A missing grant cannot be disguised as a missing Evidence declaration:
    // these three values are grounded in research/armor-audit.json and Derived.
    expect(errors.some((reason) => reason.includes('missing or drifted parameter Evidence declaration'))).toBe(false)
    expect(errors.some((reason) => reason.includes('Evidence declaration lacks source grounding'))).toBe(false)
    expect(errors).not.toContain('hungry-horror/meleeAttackSpeedBonus: active runtime parameter lacks target-specific P3B promotion')
  })

  it('A/P3B positive: distinct eligible parameter links for one Armor are allowed, but identical targets are not', () => {
    const catalog = { ...ARMORS, 'hungry-horror': multiArmor }
    const manifest = eligiblePromotions(Object.values(multiTargets))
    expect(manifest.summary).toEqual({ candidates: 3, eligible: 3, promoted: 3 })
    expect(collectLimitedArmorCatalogErrors(catalog, [thiefCase], multiLinks, manifest, multiEvidence)).toEqual([])
    const duplicate = collectLimitedArmorCatalogErrors(
      catalog, [thiefCase], [...multiLinks, multiLinks[0]!], manifest, multiEvidence,
    )
    expect(duplicate).toContain('hungry-horror: duplicate P3B promotion link')
  })

  it('A/P3B negative: built-in, Soul and non-numeric intrinsic effects require separate promotion support', () => {
    const manifest = eligiblePromotions(Object.values(multiTargets))
    const baseCatalog = { ...ARMORS, 'hungry-horror': multiArmor }
    expect(collectLimitedArmorCatalogErrors(baseCatalog, [thiefCase], multiLinks, manifest, multiEvidence)).toEqual([])
    const errors = (armor: RuntimeArmorDefinition) => collectLimitedArmorCatalogErrors(
      { ...ARMORS, 'hungry-horror': armor }, [thiefCase], multiLinks, manifest, multiEvidence,
    )
    expect(errors({ ...multiArmor, builtInEnchantments: [{ enchantmentId: 'cool-down', tier: 1 }] }))
      .toContain('hungry-horror: A/P3B route has unpromoted built-in Enchantments')
    expect(errors({ ...multiArmor, soul: { acceptsSoulEnchantments: true } }))
      .toContain('hungry-horror: A/P3B route has unpromoted Soul effects')
    expect(errors({ ...multiArmor, soul: { acceptsSoulEnchantments: false, intrinsicSoulModifier: 0 } }))
      .toContain('hungry-horror: A/P3B route has unpromoted Soul effects')
    expect(errors({
      ...multiArmor,
      intrinsicProperties: [...multiArmor.intrinsicProperties, { kind: 'other', raw: 'unreviewed event effect' }],
    })).toContain('hungry-horror: A/P3B route has unpromoted intrinsic property other')
    expect(errors({
      ...multiArmor,
      intrinsicProperties: [...multiArmor.intrinsicProperties, multiArmor.intrinsicProperties[0]!],
    })).toContain('hungry-horror: A/P3B route has duplicate intrinsic property melee-attack-speed')
  })

  it('Fix 1: validates Armor Evidence with and without Scenario, preserving both policy modes', () => {
    expect(() => validateBuild(sampleArmorBuild)).not.toThrow()
    expect(() => validateBuild(sampleArmorBuild, DEFAULT_SCENARIO)).not.toThrow()
    expect(() => validateBuild(sampleArmorBuild, {
      ...DEFAULT_SCENARIO, evidencePolicy: 'high-confidence-only',
    })).not.toThrow()
    expect(() => validateBuild(sampleArmorBuild, {
      ...DEFAULT_SCENARIO, evidencePolicy: 'include-estimated',
    })).not.toThrow()
    expect(ARMOR_INDEPENDENT_CLASSIFICATION_DECISIONS).toEqual([])
    expect(armorNumericEvidenceRows(proposedThief).find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding?.status).toBe('derived')
  })

  it('Fix 2: accepted labels and distinct origin strings cannot grant Measured/Verified without verifiable raw evidence', () => {
    // Synthetic refs intentionally do not identify independently verified files/runs.
    // A decision record alone must remain insufficient, even with approved labels.
    expect(armorNumericEvidenceRows(proposedThief, measuredDeclarations, [independentMeasurement])
      .find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding).toBeUndefined()
    const verifiedDeclarations = {
      ...measuredDeclarations,
      'thief-armor': { meleeAttackSpeedBonus: { ...measuredThief, status: 'verified' as const } },
    }
    const verifiedDecision: ArmorIndependentClassificationDecision = {
      ...independentMeasurement, status: 'verified',
      independentEvidence: [...independentMeasurement.independentEvidence, {
        ref: 'research/evidence/armor-holdout.json#/runs/2', originId: 'independent-holdout-2',
        gameVersion: '1.17.0.0', method: 'holdout',
      }],
    }
    expect(armorNumericEvidenceRows(proposedThief, verifiedDeclarations, [verifiedDecision])
      .find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding).toBeUndefined()
    const forgedDecision: ArmorIndependentClassificationDecision = {
      ...independentMeasurement,
      decisionRef: 'research/nonexistent-decision.json#/accepted',
      independentEvidence: [{
        ref: 'research/nonexistent-trace.json#/runs/1',
        originId: 'claimed-independent-run',
        gameVersion: '1.17.0.0',
        method: 'measurement',
      }],
    }
    expect(armorNumericEvidenceRows(proposedThief, measuredDeclarations, [forgedDecision])
      .find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding).toBeUndefined()
  })

  it('Fix 2 negative: reuse and runtime registration cannot grant unsupported Measured/Verified', () => {
    const resolved = (decisions: readonly ArmorIndependentClassificationDecision[], status: 'measured' | 'verified' = 'measured') =>
      armorNumericEvidenceRows(proposedThief, {
        ...measuredDeclarations, 'thief-armor': { meleeAttackSpeedBonus: { ...measuredThief, status } },
      }, decisions).find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding
    expect(collectLimitedArmorReuseErrors(thiefCase, proposedThief)).toEqual([])
    expect(resolved([])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, decision: 'held' }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, reviewerDecision: 'pending' }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, armorId: 'spider-armor' }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, expectedValue: 0.30 }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, gameVersion: 'other-version' }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, independentEvidence: [] }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, independentEvidence: [{
      ...independentMeasurement.independentEvidence[0]!, method: 'holdout',
    }] }])).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, status: 'verified', independentEvidence: [
      independentMeasurement.independentEvidence[0]!,
      { ...independentMeasurement.independentEvidence[0]!, originId: 'origin-2', method: 'holdout' },
    ] }], 'verified')).toBeUndefined()
    expect(resolved([independentMeasurement], 'verified')).toBeUndefined()
    expect(resolved([{ ...independentMeasurement, status: 'verified' }], 'verified')).toBeUndefined()
    expect(resolved([independentMeasurement, independentMeasurement])).toBeUndefined()
  })

  it('Fix 3 positive: exact accepted promotion claim, target property and channel match', () => {
    const catalog = { ...ARMORS, 'thief-armor': proposedThief }
    const manifest = eligiblePromotion()
    expect(manifest.summary).toEqual({ candidates: 1, eligible: 1, promoted: 1 })
    expect(collectPromotedArmorLinkErrors(exactPromotionLink, catalog, manifest)).toEqual([])
    // Synthetic A-route linkage does not change the checked-in live B-route grant.
    const errors = collectLimitedArmorCatalogErrors(catalog, [], [exactPromotionLink], manifest)
    expect(errors).toEqual([])
    const missing = collectLimitedArmorCatalogErrors(catalog, [], [exactPromotionLink], manifest, {
      ...ARMOR_EVIDENCE_BINDINGS, 'thief-armor': {},
    })
    expect(missing).toContain('thief-armor/meleeAttackSpeedBonus: missing or drifted parameter Evidence declaration')
  })

  it('Fix 3 negative: an unrelated eligible promotion does not authorize this Armor', () => {
    const catalog = { ...ARMORS, 'thief-armor': proposedThief }
    const unrelated = eligiblePromotion('armor.unrelated-armor.melee-attack-speed-bonus')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, mechanicTargetId: 'armor.unrelated-armor.melee-attack-speed-bonus',
    }, catalog, unrelated)).toContain('P3B Promotion target does not cover Armor parameter')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, channel: 'incoming-damage',
    }, catalog, eligiblePromotion())).toContain('P3B link mechanic/channel/scope is not applied by target Armor')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, parameter: 'armorDamageReduction',
    }, catalog, eligiblePromotion())).toContain('P3B Promotion target does not cover Armor parameter')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, expectedValue: 0.30,
    }, catalog, eligiblePromotion())).toContain('P3B link mechanic/channel/scope is not applied by target Armor')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, scope: 'global' as PromotedArmorRuntimeLink['scope'],
    }, catalog, eligiblePromotion())).toContain('P3B link mechanic/channel/scope is not applied by target Armor')
    const valid = eligiblePromotion()
    const invalidBundle = {
      ...valid, promotions: [{
        ...valid.promotions[0]!, artifacts: {
          ...valid.promotions[0]!.artifacts,
          coverage: { ...valid.promotions[0]!.artifacts.coverage, sha256: 'invalid-hash' },
        },
      }],
    }
    expect(collectPromotedArmorLinkErrors(exactPromotionLink, catalog, invalidBundle))
      .toContain('P3B link lacks eligible accepted promotion and atomic bundle')
    const invalidRegression = {
      ...valid, candidates: [{ ...valid.candidates[0]!, regression: 'failed' as const }],
    }
    expect(collectPromotedArmorLinkErrors(exactPromotionLink, catalog, invalidRegression))
      .toContain('P3B link lacks eligible accepted promotion and atomic bundle')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, sourceId: 'fabricated-source',
    }, catalog, eligiblePromotion())).toContain('P3B link lacks matching source-backed Armor property/version')
    expect(collectPromotedArmorLinkErrors({
      ...exactPromotionLink, gameVersion: 'other-version',
    }, catalog, eligiblePromotion())).toContain('P3B link lacks matching source-backed Armor property/version')
  })

})
