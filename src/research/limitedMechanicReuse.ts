import { ARMORS, type RuntimeArmorDefinition } from '../data/armors'
import { ARMOR_AUDIT } from './armorAudit'
import { ARMOR_EVIDENCE_BINDINGS, ARMOR_NUMERIC_PARAMETERS } from '../core/armorEvidence'
import formalIdentity from '../../research/domain/formal/identity-evidence-v1.json'
import promotionManifest from '../../research/runtime/runtime-promotion-manifest.json'

const checkedPromotionManifest = promotionManifest as unknown as {
  readonly gameVersion: string
  readonly candidates: readonly {
    readonly targetId: string
    readonly outcome: string
    readonly eligibility: { readonly status: string }
    readonly regression: string
    readonly valueStatus: string
    readonly gameVersion: string
    readonly blockers: readonly string[]
  }[]
  readonly promotions: readonly { readonly targetId: string }[]
}

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

/** Existing seven pre-policy Armors are preserved as Limited, not R3-accepted. */
export const HISTORICAL_LIMITED_ARMOR_IDS: readonly string[] = [
  'battle-robe', 'renegade-armor', 'wither-armor',
  'mercenary-armor', 'grim-armor', 'scale-mail', 'spider-armor',
]

/** Separate reviewed grants belong here, never inferred by iterating ARMORS.
 * Intentionally empty until an architecture-approved per-target follow-up PR.
 */
export const LIMITED_ARMOR_REUSE_APPROVALS: readonly LimitedArmorReuseApproval[] = []

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
export interface PromotedArmorRuntimeLink {
  readonly armorId: string
  readonly mechanicTargetId: string
}
export const PROMOTED_ARMOR_RUNTIME_LINKS: readonly PromotedArmorRuntimeLink[] = []

/** Enforce grants on every post-policy runtime Armor via either an existing
 * Limited reuse approval OR a manifest-backed new-mechanic Promotion.
 * Both routes separately need source-bound parameter Evidence declarations.
 */
export function collectLimitedArmorCatalogErrors(
  armors: Readonly<Partial<Record<string, RuntimeArmorDefinition>>> = ARMORS,
  approvals: readonly LimitedArmorReuseApproval[] = LIMITED_ARMOR_REUSE_APPROVALS,
  promotionLinks: readonly PromotedArmorRuntimeLink[] = PROMOTED_ARMOR_RUNTIME_LINKS,
): string[] {
  const errors: string[] = []
  const legacy = new Set(HISTORICAL_LIMITED_ARMOR_IDS)
  const ids = Object.keys(armors)
  const seen = new Set<string>()
  const promoted = new Set<string>()
  for (const link of promotionLinks) {
    if (promoted.has(link.armorId)) errors.push(`${link.armorId}: duplicate P3B promotion link`)
    promoted.add(link.armorId)
    if (legacy.has(link.armorId)) errors.push(`${link.armorId}: pre-policy Armor cannot claim P3B promotion`)
    if (!armors[link.armorId]) errors.push(`${link.armorId}: P3B link has no runtime target`)
    const candidate = checkedPromotionManifest.candidates.find((entry) => entry.targetId === link.mechanicTargetId)
    const bundled = checkedPromotionManifest.promotions.some((entry) => entry.targetId === link.mechanicTargetId)
    if (!candidate || candidate.outcome !== 'accepted' || candidate.eligibility.status !== 'eligible'
      || candidate.regression !== 'passed' || candidate.valueStatus !== 'known'
      || candidate.gameVersion !== checkedPromotionManifest.gameVersion || candidate.blockers.length !== 0 || !bundled) {
      errors.push(`${link.armorId}: P3B link lacks eligible accepted promotion and atomic bundle`)
    }
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
  for (const id of ids) {
    if (!legacy.has(id) && !seen.has(id) && !promoted.has(id)) errors.push(`${id}: runtime Armor lacks explicit Limited reuse approval or P3B promotion`)
    const armor = armors[id]!
    for (const key of ARMOR_NUMERIC_PARAMETERS) {
      const neutral = key === 'soulGatheringMultiplier' ? 1 : 0
      if (armor[key] === neutral) continue
      const evidence = ARMOR_EVIDENCE_BINDINGS[id]?.[key]
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
  }
  return errors
}
