import { ARMORS, type RuntimeArmorDefinition } from '../data/armors'
import { ARMOR_AUDIT } from './armorAudit'
import { ARMOR_EVIDENCE_BINDINGS, ARMOR_NUMERIC_PARAMETERS, ARMOR_PARAMETER_IDS, armorNumericEvidenceRows, type ArmorEvidenceBinding, type ArmorNumericParameter } from '../core/armorEvidence'
import { collectRuntimePromotionErrors, type RuntimePromotionManifest } from './runtimePromotion'
import formalIdentity from '../../research/domain/formal/identity-evidence-v1.json'
import promotionManifest from '../../research/runtime/runtime-promotion-manifest.json'

const checkedPromotionManifest = promotionManifest as unknown as RuntimePromotionManifest

const reviewedIdentity = formalIdentity as unknown as {
  identityAssertions: readonly { id: string; domainId: string; reviewState: string; confidence?: string; rawIdentity: string }[]
  semantic: { identities: readonly {
    assertionId: string
    resolution: { state: string }
    rawEvidence: { itemIdName: { state: string; value?: string }; serializedId: { state: string; value?: string } }
  }[] }
}

/**
 * An explicit approval for reusing a bounded existing Limited Armor mechanic.
 * This is NOT an R3 AdoptionDecision or a P3B promotion bundle.
 * MVP validator is intentionally narrow: a sole intrinsic melee-cadence +25%
 * copied from a source-backed base Armor to its already-Limited unique variant.
 * Other mechanic families must extend this validator under architecture review
 * or use the new-mechanic Promotion path.
 */
export interface LimitedArmorReuseApproval {
  readonly targetId: string
  readonly rawIdentity: string
  readonly donorId: string
  readonly sourceRef: 'research/armor-audit.json'
  readonly sourceId: string
  readonly propertyRaw: string
  readonly propertyKind: 'melee-attack-speed'
  readonly parameterId: 'meleeAttackSpeedBonus'
  readonly parameterValue: number
  readonly gameVersion: '1.17.0.0'
  readonly channel: 'direct-melee-cadence'
  readonly scope: 'single-armor-speed-source'
  readonly composition: 'reject-unverified'
  readonly excludedPropertyKinds: readonly string[]
  readonly rejectedInteractions: readonly string[]
  readonly testRefs: {
    readonly positive: string
    readonly negative: string
    readonly preservation: string
  }
}

/**
 * A second, deliberately stricter B-route for event/reskin Armors whose
 * complete audited/runtime intrinsic model is an exact replica of an already
 * Limited donor. No target effect may be omitted, neutralized or inferred.
 */
export interface LimitedArmorReplicaReuseApproval {
  readonly targetId: string
  readonly rawIdentity: string
  readonly donorId: string
  readonly sourceRef: 'research/armor-audit.json'
  readonly sourceId: string
  readonly gameVersion: '1.17.0.0'
  readonly mode: 'exact-runtime-replica'
  readonly properties: readonly {
    readonly kind: string
    readonly raw: string
    readonly ownership: 'base' | 'inherited' | 'unique-only'
  }[]
  readonly rejectedInteractions: readonly string[]
  readonly testRefs: {
    readonly positive: string
    readonly negative: string
    readonly preservation: string
  }
}

/** Existing seven pre-policy Armors are preserved as Limited, not R3-accepted. */
export const HISTORICAL_LIMITED_ARMOR_IDS: readonly string[] = [
  'battle-robe', 'renegade-armor', 'wither-armor',
  'mercenary-armor', 'grim-armor', 'scale-mail', 'spider-armor',
]

/** Separate reviewed grants belong here, never inferred by iterating ARMORS.
 * Intentionally empty until an architecture-approved per-target follow-up PR.
 */
export const LIMITED_ARMOR_REUSE_APPROVALS: readonly LimitedArmorReuseApproval[] = []

/**
 * Exact-replica grants are also explicit and per-target. Foundation PR keeps
 * this empty; runtime additions belong in a separately reviewed follow-up.
 */
export const LIMITED_ARMOR_REPLICA_REUSE_APPROVALS: readonly LimitedArmorReplicaReuseApproval[] = [
  {
    targetId: 'hungry-horror',
    rawIdentity: 'MercenaryArmor_Spooky1',
    donorId: 'renegade-armor',
    sourceRef: 'research/armor-audit.json',
    sourceId: 'dungeons-tools-armor-index',
    gameVersion: '1.17.0.0',
    mode: 'exact-runtime-replica',
    properties: [
      { kind: 'melee-attack-speed', raw: '+25% melee attack speed', ownership: 'unique-only' },
      { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura', ownership: 'inherited' },
      { kind: 'damage-reduction', raw: '35% damage reduction', ownership: 'inherited' },
    ],
    rejectedInteractions: ['death-cap-mushroom', 'rampaging', 'iron-hide-amulet', 'guarding-strike', 'weakening', 'potion-barrier', 'protection'],
    testRefs: {
      positive: 'tests/armorRuntime.test.ts#event-replica-positive',
      negative: 'tests/armorRuntime.test.ts#event-replica-negative',
      preservation: 'tests/limitedMechanicReuse.test.ts#preservation',
    },
  },
  {
    targetId: 'hungriest-horror',
    rawIdentity: 'MercenaryArmor_Spooky2',
    donorId: 'renegade-armor',
    sourceRef: 'research/armor-audit.json',
    sourceId: 'dungeons-tools-armor-index',
    gameVersion: '1.17.0.0',
    mode: 'exact-runtime-replica',
    properties: [
      { kind: 'melee-attack-speed', raw: '+25% melee attack speed', ownership: 'unique-only' },
      { kind: 'damage-reduction', raw: '35% damage reduction', ownership: 'inherited' },
      { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura', ownership: 'inherited' },
    ],
    rejectedInteractions: ['death-cap-mushroom', 'rampaging', 'iron-hide-amulet', 'guarding-strike', 'weakening', 'potion-barrier', 'protection'],
    testRefs: {
      positive: 'tests/armorRuntime.test.ts#event-replica-positive',
      negative: 'tests/armorRuntime.test.ts#event-replica-negative',
      preservation: 'tests/limitedMechanicReuse.test.ts#preservation',
    },
  },
  {
    targetId: 'the-spooky-gourdian',
    rawIdentity: 'GrimArmor_Spooky2',
    donorId: 'wither-armor',
    sourceRef: 'research/armor-audit.json',
    sourceId: 'dungeons-tools-armor-index',
    gameVersion: '1.17.0.0',
    mode: 'exact-runtime-replica',
    properties: [
      { kind: 'damage-reduction', raw: '35% damage reduction', ownership: 'unique-only' },
      { kind: 'soul-gathering', raw: '+50% souls gathered', ownership: 'inherited' },
      { kind: 'life-steal-aura', raw: '6% life steal aura', ownership: 'inherited' },
    ],
    rejectedInteractions: ['iron-hide-amulet', 'guarding-strike', 'weakening', 'potion-barrier', 'protection', 'soul-siphon', 'non-direct-melee-life-steal'],
    testRefs: {
      positive: 'tests/armorRuntime.test.ts#event-replica-positive',
      negative: 'tests/armorRuntime.test.ts#event-replica-negative',
      preservation: 'tests/limitedMechanicReuse.test.ts#preservation',
    },
  },
]

const normalizedRaw = (raw: string) => raw.trim().replace(/\s+/g, ' ').toLowerCase()
const sortedJson = (value: readonly unknown[]) => JSON.stringify([...value].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
const auditedPropertyShape = (properties: readonly { kind: string; raw: string; ownership: string }[]) =>
  properties.map((property) => ({ kind: property.kind, raw: normalizedRaw(property.raw), ownership: property.ownership }))
const runtimePropertyShape = (properties: readonly { kind: string; raw: string }[]) =>
  properties.map((property) => ({ kind: property.kind, raw: normalizedRaw(property.raw) }))

function requiredReplicaInteractionKeys(donor: RuntimeArmorDefinition): readonly string[] {
  return [
    ...(donor.meleeAttackSpeedBonus > 0 ? ['death-cap-mushroom', 'rampaging'] : []),
    ...(donor.armorDamageReduction > 0
      ? ['iron-hide-amulet', 'guarding-strike', 'weakening', 'potion-barrier', 'protection']
      : []),
    ...(donor.soulGatheringMultiplier > 1 ? ['soul-siphon'] : []),
    ...(donor.lifeStealFraction > 0 ? ['non-direct-melee-life-steal'] : []),
    ...(donor.artifactCooldownReduction > 0 ? ['cool-down', 'external-scenario-cdr'] : []),
  ]
}

export function collectLimitedArmorReplicaReuseErrors(
  approval: LimitedArmorReplicaReuseApproval,
  target: RuntimeArmorDefinition,
  donor: RuntimeArmorDefinition | undefined = ARMORS[approval.donorId as keyof typeof ARMORS],
): string[] {
  const errors: string[] = []
  const check = (valid: boolean, message: string) => { if (!valid) errors.push(message) }
  const targetAudit = ARMOR_AUDIT.entries.find((entry) => entry.id === approval.targetId)
  const donorAudit = ARMOR_AUDIT.entries.find((entry) => entry.id === approval.donorId)
  const source = ARMOR_AUDIT.sources.find((entry) => entry.id === approval.sourceId)
  const targetAssertion = reviewedIdentity.identityAssertions.find((entry) => entry.domainId === approval.targetId)
  const donorAssertion = reviewedIdentity.identityAssertions.find((entry) => entry.domainId === approval.donorId)
  const targetResolved = reviewedIdentity.semantic.identities.find((entry) => entry.assertionId === targetAssertion?.id)
  const donorResolved = reviewedIdentity.semantic.identities.find((entry) => entry.assertionId === donorAssertion?.id)

  check(approval.mode === 'exact-runtime-replica', 'replica reuse mode mismatch')
  check(!!targetAudit && targetAudit.levelId === approval.rawIdentity && target.id === approval.targetId,
    'replica target Identity is not source-backed')
  check(targetAssertion?.reviewState === 'accepted' && targetAssertion.confidence === 'high'
    && targetAssertion.rawIdentity === approval.rawIdentity
    && targetResolved?.resolution.state === 'matched'
    && targetResolved.rawEvidence.itemIdName.state === 'known'
    && targetResolved.rawEvidence.itemIdName.value === approval.rawIdentity
    && targetResolved.rawEvidence.serializedId.state === 'known'
    && targetResolved.rawEvidence.serializedId.value === approval.rawIdentity,
  'replica target Formal Identity is not independently matched')
  check(donorAssertion?.reviewState === 'accepted' && donorAssertion.confidence === 'high'
    && donorAssertion.rawIdentity === donorAudit?.levelId
    && donorResolved?.resolution.state === 'matched',
  'replica donor Formal Identity drift')
  check(approval.sourceRef === 'research/armor-audit.json' && !!source
    && !!targetAudit?.sourceIds.includes(approval.sourceId)
    && !!donorAudit?.sourceIds.includes(approval.sourceId)
    && (targetAudit?.intrinsicProperties.every((property) => property.sourceIds.includes(approval.sourceId)) ?? false)
    && (donorAudit?.intrinsicProperties.every((property) => property.sourceIds.includes(approval.sourceId)) ?? false),
  'replica source/property provenance is missing')
  check(targetAudit?.gameVersion === approval.gameVersion
    && donorAudit?.gameVersion === approval.gameVersion
    && ARMOR_AUDIT.gameVersion === approval.gameVersion,
  'replica game version mismatch')
  check(!!donor && donor.supportLevel === 'limited' && donor.id === approval.donorId,
    'replica donor is not an existing Limited runtime Armor')
  check(targetAudit?.family === donorAudit?.family, 'replica Armor family mismatch')

  if (targetAudit && donorAudit) {
    check(sortedJson(auditedPropertyShape(targetAudit.intrinsicProperties))
      === sortedJson(auditedPropertyShape(donorAudit.intrinsicProperties)),
    'replica audited intrinsic set differs from donor')
    check(sortedJson(auditedPropertyShape(targetAudit.intrinsicProperties))
      === sortedJson(auditedPropertyShape(approval.properties)),
    'replica approval does not enumerate the exact target intrinsic set')
    check(JSON.stringify(targetAudit.builtInEnchantments) === JSON.stringify(donorAudit.builtInEnchantments),
      'replica audited built-in Enchantments differ from donor')
    check(targetAudit.soulGear === donorAudit.soulGear, 'replica audited Soul semantics differ from donor')
  }

  if (donor) {
    check(target.supportLevel === 'limited', 'replica target must remain Limited')
    check(sortedJson(runtimePropertyShape(target.intrinsicProperties))
      === sortedJson(runtimePropertyShape(donor.intrinsicProperties)),
    'replica runtime intrinsic set differs from donor')
    check(JSON.stringify(target.builtInEnchantments) === JSON.stringify(donor.builtInEnchantments),
      'replica runtime built-in Enchantments differ from donor')
    check(JSON.stringify(target.soul) === JSON.stringify(donor.soul),
      'replica runtime Soul semantics differ from donor')
    for (const key of ARMOR_NUMERIC_PARAMETERS) {
      check(target[key] === donor[key], `replica runtime parameter differs from donor: ${key}`)
    }
    for (const interaction of requiredReplicaInteractionKeys(donor)) {
      check(approval.rejectedInteractions.includes(interaction),
        `replica unverified interaction is not rejected: ${interaction}`)
    }
  }
  check(Object.values(approval.testRefs).every((ref) => ref.startsWith('tests/') && ref.includes('#')),
    'replica positive/negative/preservation test references required')
  return errors
}

export function collectLimitedArmorReuseErrors(
  approval: LimitedArmorReuseApproval,
  target: RuntimeArmorDefinition,
  donor: RuntimeArmorDefinition | undefined = ARMORS[approval.donorId as keyof typeof ARMORS],
): string[] {
  const errors: string[] = []
  const check = (valid: boolean, message: string) => { if (!valid) errors.push(message) }
  const targetAudit = ARMOR_AUDIT.entries.find((entry) => entry.id === approval.targetId)
  const donorAudit = ARMOR_AUDIT.entries.find((entry) => entry.id === approval.donorId)
  const source = ARMOR_AUDIT.sources.find((entry) => entry.id === approval.sourceId)
  const property = targetAudit?.intrinsicProperties.find((item) => item.kind === approval.propertyKind && item.raw === approval.propertyRaw)
  const targetAssertion = reviewedIdentity.identityAssertions.find((entry) => entry.domainId === approval.targetId)
  const donorAssertion = reviewedIdentity.identityAssertions.find((entry) => entry.domainId === approval.donorId)
  const resolved = reviewedIdentity.semantic.identities.find((entry) => entry.assertionId === targetAssertion?.id)


  check(!!targetAudit && targetAudit.levelId === approval.rawIdentity && target.id === approval.targetId,
    'reuse target Identity is not source-backed')
  check(targetAssertion?.reviewState === 'accepted' && targetAssertion.confidence === 'high'
    && targetAssertion.rawIdentity === approval.rawIdentity
    && resolved?.resolution.state === 'matched'
    && resolved.rawEvidence.itemIdName.state === 'known'
    && resolved.rawEvidence.itemIdName.value === approval.rawIdentity
    && resolved.rawEvidence.serializedId.state === 'known'
    && resolved.rawEvidence.serializedId.value === approval.rawIdentity,
    'reuse target Formal Identity is not independently matched')
  check(donorAssertion?.reviewState === 'accepted' && donorAssertion.rawIdentity === donorAudit?.levelId,
    'reuse donor Formal Identity drift')
  check(approval.sourceRef === 'research/armor-audit.json' && !!source && !!targetAudit?.sourceIds.includes(approval.sourceId)
    && !!property?.sourceIds.includes(approval.sourceId), 'reuse source/property provenance is missing')
  check(targetAudit?.gameVersion === approval.gameVersion && ARMOR_AUDIT.gameVersion === approval.gameVersion,
    'reuse game version mismatch')
  check(!!donor && donor.supportLevel === 'limited' && donor.id === approval.donorId
    && donor.meleeAttackSpeedBonus === approval.parameterValue && Number.isFinite(approval.parameterValue) && approval.parameterValue === 0.25,
    'reuse donor has no matching Limited model/parameter')
  check(!!donorAudit && donorAudit.inheritance.baseArmorId === approval.targetId
    && donorAudit.family === targetAudit?.family
    && donorAudit.intrinsicProperties.some((item) => item.kind === 'melee-attack-speed' && item.ownership === 'inherited' && item.sourceIds.includes(approval.sourceId)),
    'reuse inheritance/mechanic family mismatch')
  check(approval.propertyKind === 'melee-attack-speed' && approval.parameterId === 'meleeAttackSpeedBonus'
    && approval.channel === 'direct-melee-cadence' && approval.scope === 'single-armor-speed-source'
    && approval.composition === 'reject-unverified',
    'reuse channel/scope/composition does not match the existing model')
  check(targetAudit?.intrinsicProperties.length === 1 && property?.ownership === 'base'
    && target.intrinsicProperties.length === 1
    && target.intrinsicProperties[0]?.kind === 'melee-attack-speed'
    && target.intrinsicProperties[0]?.raw === approval.propertyRaw,
    'reuse target has unreviewed extra intrinsic properties')
  check(target.meleeAttackSpeedBonus === approval.parameterValue && target.supportLevel === 'limited',
    'reuse runtime parameter/support mismatch')
  // This narrow Thief reuse approves only its single intrinsic cadence property.
  // Neither target-only nor donor-only built-ins / Soul effects may be inherited.
  check(targetAudit?.builtInEnchantments.length === 0
    && Array.isArray(target.builtInEnchantments) && target.builtInEnchantments.length === 0,
    'reuse target has unreviewed built-in Enchantments')
  check(targetAudit?.soulGear === false && target.soul?.acceptsSoulEnchantments === false,
    'reuse target Soul enchantment eligibility mismatch')
  // Even an explicit neutral/zero field is not an approved Soul effect declaration.
  check(!!target.soul && !Object.prototype.hasOwnProperty.call(target.soul, 'intrinsicSoulModifier'),
    'reuse target has unreviewed intrinsic Soul modifier')
  for (const key of ARMOR_NUMERIC_PARAMETERS) {
    if (key === 'meleeAttackSpeedBonus') continue
    check(target[key] === (key === 'soulGatheringMultiplier' ? 1 : 0), `reuse target inherits unrelated runtime effect: ${key}`)
  }
  check(donorAudit?.intrinsicProperties.filter((item) => item.ownership === 'unique-only')
    .every((item) => approval.excludedPropertyKinds.includes(item.kind)) ?? false,
  'donor-only properties are not explicitly excluded')
  check(approval.rejectedInteractions.includes('death-cap-mushroom')
    && approval.rejectedInteractions.includes('rampaging'),
  'unverified speed compositions are not rejected')
  check(Object.values(approval.testRefs).every((ref) => ref.startsWith('tests/') && ref.includes('#')),
    'positive/negative/preservation test references required')
  return errors
}

/** The *other* P4 route must point to an independently eligible, bundled P3B
 * promotion. No free-form "already promoted" boolean can bypass the gate.
 * This link is empty while the promotion manifest has zero eligible targets.
 */
const ARMOR_PROMOTION_PARAMETER_SCOPES = {
  meleeDamageBonus: { propertyKind: 'melee-damage', channel: 'direct-melee-damage' },
  weaponDamageAuraBonus: { propertyKind: 'weapon-damage-aura', channel: 'direct-melee-damage' },
  meleeAttackSpeedBonus: { propertyKind: 'melee-attack-speed', channel: 'direct-melee-cadence' },
  armorDamageReduction: { propertyKind: 'damage-reduction', channel: 'incoming-damage' },
  soulGatheringMultiplier: { propertyKind: 'soul-gathering', channel: 'soul-collection' },
  lifeStealFraction: { propertyKind: 'life-steal-aura', channel: 'direct-melee-life-steal' },
  artifactCooldownReduction: { propertyKind: 'artifact-cooldown', channel: 'artifact-cooldown' },
} as const satisfies Record<ArmorNumericParameter, { propertyKind: string; channel: string }>

export interface PromotedArmorRuntimeLink {
  readonly armorId: string
  /** Target-specific ID in the accepted Promotion claim; unrelated global
   * Promotion achievements are NOT grants for arbitrary Armor.
   */
  readonly mechanicTargetId: string
  readonly parameter: ArmorNumericParameter
  readonly expectedValue: number
  readonly channel: (typeof ARMOR_PROMOTION_PARAMETER_SCOPES)[ArmorNumericParameter]['channel']
  readonly scope: 'self-armor'
  readonly sourceRef: 'research/armor-audit.json'
  readonly sourceId: string
  readonly propertyRaw: string
  readonly gameVersion: string
}
export const PROMOTED_ARMOR_RUNTIME_LINKS: readonly PromotedArmorRuntimeLink[] = []

/** The claim ID, the target's own audited property and its runtime channel
 * must ALL match. This is deliberately stricter than the presence of any
 * eligible global Promotion target. The adoption decision for a future Armor
 * target must use the exact `armor.<id>.<parameter-id>` target identity.
 */
export function collectPromotedArmorLinkErrors(
  link: PromotedArmorRuntimeLink,
  armors: Readonly<Partial<Record<string, RuntimeArmorDefinition>>> = ARMORS,
  manifest: RuntimePromotionManifest = checkedPromotionManifest,
): string[] {
  const errors: string[] = []
  const armor = armors[link.armorId]
  const audited = ARMOR_AUDIT.entries.find((entry) => entry.id === link.armorId)
  const definition = ARMOR_PROMOTION_PARAMETER_SCOPES[link.parameter]
  if (!armor) errors.push('P3B link has no runtime target')
  const expectedTarget = `armor.${link.armorId}.${ARMOR_PARAMETER_IDS[link.parameter]}`
  if (link.mechanicTargetId !== expectedTarget) errors.push('P3B Promotion target does not cover Armor parameter')
  if (!definition || link.channel !== definition.channel || link.scope !== 'self-armor'
    || !armor || !Number.isFinite(link.expectedValue) || armor[link.parameter] !== link.expectedValue
    || armor[link.parameter] === (link.parameter === 'soulGatheringMultiplier' ? 1 : 0)) {
    errors.push('P3B link mechanic/channel/scope is not applied by target Armor')
  }
  if (link.sourceRef !== 'research/armor-audit.json'
    || !audited || audited.gameVersion !== link.gameVersion || manifest.gameVersion !== link.gameVersion
    || !ARMOR_AUDIT.sources.some((source) => source.id === link.sourceId)
    || !audited.sourceIds.includes(link.sourceId)
    || !audited.intrinsicProperties.some((property) => property.kind === definition?.propertyKind
      && property.raw === link.propertyRaw && property.sourceIds.includes(link.sourceId))
    || !armor?.intrinsicProperties.some((property) => property.kind === definition?.propertyKind
      && property.raw === link.propertyRaw)) {
    errors.push('P3B link lacks matching source-backed Armor property/version')
  }
  const candidate = manifest.candidates.find((entry) => entry.targetId === link.mechanicTargetId)
  const bundled = manifest.promotions.some((entry) => entry.targetId === link.mechanicTargetId)
  if (!candidate || candidate.outcome !== 'accepted' || candidate.eligibility.status !== 'eligible'
    || candidate.regression !== 'passed' || !candidate.regressionSourceRef
    || candidate.regressionGameVersion !== manifest.gameVersion
    || candidate.valueStatus !== 'known' || candidate.gameVersion !== manifest.gameVersion
    || candidate.blockers.length !== 0 || !bundled || collectRuntimePromotionErrors(manifest).length) {
    errors.push('P3B link lacks eligible accepted promotion and atomic bundle')
  }
  return errors
}


/** Enforce grants on every post-policy runtime Armor via either an existing
 * Limited reuse approval OR a manifest-backed new-mechanic Promotion.
 * A route covers an Armor, but A authorization applies to EACH active mechanic,
 * not to the Armor as a whole. Evidence declarations alone never grant A.
 */
export function collectLimitedArmorCatalogErrors(
  armors: Readonly<Partial<Record<string, RuntimeArmorDefinition>>> = ARMORS,
  approvals: readonly LimitedArmorReuseApproval[] = LIMITED_ARMOR_REUSE_APPROVALS,
  promotionLinks: readonly PromotedArmorRuntimeLink[] = PROMOTED_ARMOR_RUNTIME_LINKS,
  manifest: RuntimePromotionManifest = checkedPromotionManifest,
  evidenceBindings: Readonly<Record<string, Partial<Record<ArmorNumericParameter, ArmorEvidenceBinding>>>> = ARMOR_EVIDENCE_BINDINGS,
  replicaApprovals: readonly LimitedArmorReplicaReuseApproval[] = LIMITED_ARMOR_REPLICA_REUSE_APPROVALS,
): string[] {
  const errors: string[] = []
  const legacy = new Set(HISTORICAL_LIMITED_ARMOR_IDS)
  const ids = Object.keys(armors)
  const seen = new Set<string>()
  const replicaSeen = new Set<string>()
  const promoted = new Map<string, PromotedArmorRuntimeLink[]>()
  const promotedTargets = new Set<string>()
  for (const link of promotionLinks) {
    const targetKey = `${link.armorId}:${link.mechanicTargetId}`
    if (promotedTargets.has(targetKey)) errors.push(`${link.armorId}: duplicate P3B promotion link`)
    promotedTargets.add(targetKey)
    const links = promoted.get(link.armorId) ?? []
    links.push(link)
    promoted.set(link.armorId, links)
    if (legacy.has(link.armorId)) errors.push(`${link.armorId}: pre-policy Armor cannot claim P3B promotion`)
    errors.push(...collectPromotedArmorLinkErrors(link, armors, manifest).map((reason) => `${link.armorId}: ${reason}`))
  }
  for (const approval of approvals) {
    if (seen.has(approval.targetId)) errors.push(`${approval.targetId}: duplicate reuse approval`)
    seen.add(approval.targetId)
    if (legacy.has(approval.targetId)) errors.push(`${approval.targetId}: pre-policy Armor cannot self-approve reuse`)
    if (promoted.has(approval.targetId)) errors.push(`${approval.targetId}: choose exactly one P4 route`)
    const target = armors[approval.targetId]
    if (!target) errors.push(`${approval.targetId}: reuse approval has no runtime target`)
    else errors.push(...collectLimitedArmorReuseErrors(approval, target, armors[approval.donorId]).map((reason) => `${approval.targetId}: ${reason}`))
  }
  for (const approval of replicaApprovals) {
    if (replicaSeen.has(approval.targetId)) errors.push(`${approval.targetId}: duplicate replica reuse approval`)
    replicaSeen.add(approval.targetId)
    if (legacy.has(approval.targetId)) errors.push(`${approval.targetId}: pre-policy Armor cannot self-approve replica reuse`)
    if (seen.has(approval.targetId) || promoted.has(approval.targetId)) errors.push(`${approval.targetId}: choose exactly one P4 route`)
    const target = armors[approval.targetId]
    if (!target) errors.push(`${approval.targetId}: replica reuse approval has no runtime target`)
    else errors.push(...collectLimitedArmorReplicaReuseErrors(approval, target, armors[approval.donorId]).map((reason) => `${approval.targetId}: ${reason}`))
  }
  for (const id of ids) {
    if (!legacy.has(id) && !seen.has(id) && !replicaSeen.has(id) && !promoted.has(id)) errors.push(`${id}: runtime Armor lacks explicit Limited reuse approval, exact-replica approval, or P3B promotion`)
    const armor = armors[id]!
    const links = promoted.get(id) ?? []
    const routeA = !legacy.has(id) && !seen.has(id) && !replicaSeen.has(id) && links.length > 0
    for (const key of ARMOR_NUMERIC_PARAMETERS) {
      const neutral = key === 'soulGatheringMultiplier' ? 1 : 0
      if (armor[key] === neutral) continue
      // One accepted/bundled parameter link cannot authorize a second active effect.
      if (routeA && !links.some((link) => link.parameter === key
        && link.mechanicTargetId === `armor.${id}.${ARMOR_PARAMETER_IDS[key]}`)) {
        errors.push(`${id}/${key}: active runtime parameter lacks target-specific P3B promotion`)
      }
      const evidence = evidenceBindings[id]?.[key]
      if (evidence && (evidence.status === 'measured' || evidence.status === 'verified')
        && !armorNumericEvidenceRows(armor, evidenceBindings).some((row) => row.parameter === key && row.binding)) {
        errors.push(`${id}/${key}: Measured/Verified requires an independently accepted classification decision`)
        continue
      }
      if (!evidence || evidence.expectedValue !== armor[key]
        || !armor.intrinsicProperties.some((property) => property.kind === evidence.propertyKind && property.raw === evidence.propertyRaw)) {
        errors.push(`${id}/${key}: missing or drifted parameter Evidence declaration`)
        continue
      }
      const audited = ARMOR_AUDIT.entries.find((entry) => entry.id === id)
      if (audited?.gameVersion !== evidence.gameVersion
        || !audited?.intrinsicProperties.some((property) => property.kind === evidence.propertyKind
          && property.raw === evidence.propertyRaw && property.sourceIds.includes(evidence.sourceId))
        || !ARMOR_AUDIT.sources.some((source) => source.id === evidence.sourceId)) {
        errors.push(`${id}/${key}: Evidence declaration lacks source grounding`)
      }
    }
    if (routeA) {
      // Current A link vocabulary authorizes numeric intrinsic effects only.
      // Built-ins, Soul semantics and any unlinked/non-numeric intrinsic need
      // their own reviewed Promotion support; never assume they are neutral.
      if (!Array.isArray(armor.builtInEnchantments) || armor.builtInEnchantments.length !== 0) {
        errors.push(`${id}: A/P3B route has unpromoted built-in Enchantments`)
      }
      if (!armor.soul || armor.soul.acceptsSoulEnchantments !== false
        || Object.prototype.hasOwnProperty.call(armor.soul, 'intrinsicSoulModifier')) {
        errors.push(`${id}: A/P3B route has unpromoted Soul effects`)
      }
      const coveredProperties = new Set<string>()
      for (const property of armor.intrinsicProperties) {
        const propertyKey = `${property.kind}:${property.raw}`
        if (coveredProperties.has(propertyKey)) {
          errors.push(`${id}: A/P3B route has duplicate intrinsic property ${property.kind}`)
        }
        coveredProperties.add(propertyKey)
        if (!links.some((link) => link.mechanicTargetId === `armor.${id}.${ARMOR_PARAMETER_IDS[link.parameter]}`
          && armor[link.parameter] !== (link.parameter === 'soulGatheringMultiplier' ? 1 : 0)
          && ARMOR_PROMOTION_PARAMETER_SCOPES[link.parameter]?.propertyKind === property.kind
          && link.propertyRaw === property.raw)) {
          errors.push(`${id}: A/P3B route has unpromoted intrinsic property ${property.kind}`)
        }
      }
    }
  }
  return errors
}
