export const PROMOTION_ARTIFACT_KINDS = ['runtime', 'support-manifest', 'explanation', 'coverage', 'regression'] as const
export type PromotionArtifactKind = (typeof PROMOTION_ARTIFACT_KINDS)[number]
export type PromotionTargetKind = 'parameter' | 'mechanic'
export type AdoptionOutcome = 'accepted' | 'held' | 'rejected'

export interface PromotionCandidateInput {
  readonly targetId: string
  readonly targetKind: PromotionTargetKind
  readonly decisionRef: string
  readonly outcome: AdoptionOutcome
  readonly gameVersion: string | null
  readonly valueStatus: 'known' | 'unknown'
  readonly regression: 'passed' | 'not-run' | 'failed'
  readonly blockers: readonly string[]
}

export interface PromotionArtifact {
  readonly path: string
  readonly sha256: string
}

export interface PromotionBundle {
  readonly targetId: string
  readonly decisionRef: string
  readonly supportLevel: 'limited' | 'full'
  readonly artifacts: Readonly<Record<PromotionArtifactKind, PromotionArtifact>>
  readonly rollback: {
    readonly strategy: 'revert-commit'
    readonly note: string
  }
}

export interface RuntimePromotionManifest {
  readonly schemaVersion: 1
  readonly gameVersion: string
  readonly policy: {
    readonly atomicArtifacts: readonly PromotionArtifactKind[]
    readonly unknownValuesAreEligible: false
    readonly eligibleTargetsRequireBundle: true
  }
  readonly candidates: readonly (PromotionCandidateInput & {
    readonly eligibility: { readonly status: 'eligible' | 'ineligible'; readonly reasons: readonly string[] }
  })[]
  readonly promotions: readonly PromotionBundle[]
  readonly summary: {
    readonly candidates: number
    readonly eligible: number
    readonly promoted: number
  }
}

const SHA256 = /^[a-f0-9]{64}$/
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

function eligibilityReasons(candidate: PromotionCandidateInput, gameVersion: string): string[] {
  return [
    ...(candidate.outcome !== 'accepted' ? [`adoption-${candidate.outcome}`] : []),
    ...(candidate.gameVersion !== gameVersion ? ['game-version-mismatch'] : []),
    ...(candidate.valueStatus !== 'known' ? ['value-unknown'] : []),
    ...(candidate.regression !== 'passed' ? [`regression-${candidate.regression}`] : []),
    ...candidate.blockers.map((blocker) => `blocker:${blocker}`),
  ]
}

export function buildRuntimePromotionManifest(input: {
  readonly gameVersion: string
  readonly candidates: readonly PromotionCandidateInput[]
  readonly promotions: readonly PromotionBundle[]
}): RuntimePromotionManifest {
  const candidates = input.candidates.map((candidate) => {
    const reasons = eligibilityReasons(candidate, input.gameVersion)
    return { ...candidate, eligibility: { status: reasons.length ? 'ineligible' as const : 'eligible' as const, reasons } }
  })
  const manifest: RuntimePromotionManifest = {
    schemaVersion: 1,
    gameVersion: input.gameVersion,
    policy: {
      atomicArtifacts: PROMOTION_ARTIFACT_KINDS,
      unknownValuesAreEligible: false,
      eligibleTargetsRequireBundle: true,
    },
    candidates,
    promotions: input.promotions,
    summary: {
      candidates: candidates.length,
      eligible: candidates.filter((candidate) => candidate.eligibility.status === 'eligible').length,
      promoted: input.promotions.length,
    },
  }
  const errors = collectRuntimePromotionErrors(manifest)
  if (errors.length) throw new Error(`Runtime promotion: ${errors.join('\n')}`)
  return manifest
}

export function collectRuntimePromotionErrors(manifest: RuntimePromotionManifest): string[] {
  const errors: string[] = []
  const check = (condition: unknown, message: string) => { if (!condition) errors.push(message) }
  check(manifest.schemaVersion === 1, 'schemaVersion must be 1')
  check(Boolean(manifest.gameVersion.trim()), 'gameVersion is required')
  check(JSON.stringify(manifest.policy.atomicArtifacts) === JSON.stringify(PROMOTION_ARTIFACT_KINDS), 'all atomic artifact kinds are required')
  check(manifest.policy.unknownValuesAreEligible === false, 'unknown values must remain ineligible')
  check(manifest.policy.eligibleTargetsRequireBundle === true, 'eligible targets must require a bundle')

  const candidateIds = new Set<string>()
  for (const candidate of manifest.candidates) {
    check(ID.test(candidate.targetId), `${candidate.targetId}: invalid target ID`)
    check(!candidateIds.has(candidate.targetId), `${candidate.targetId}: duplicate candidate`)
    candidateIds.add(candidate.targetId)
    check(['parameter', 'mechanic'].includes(candidate.targetKind), `${candidate.targetId}: invalid target kind`)
    check(Boolean(candidate.decisionRef.trim()), `${candidate.targetId}: decision reference is required`)
    check(['accepted', 'held', 'rejected'].includes(candidate.outcome), `${candidate.targetId}: invalid adoption outcome`)
    check(['known', 'unknown'].includes(candidate.valueStatus), `${candidate.targetId}: invalid value status`)
    check(['passed', 'not-run', 'failed'].includes(candidate.regression), `${candidate.targetId}: invalid regression status`)
    check(new Set(candidate.blockers).size === candidate.blockers.length && candidate.blockers.every((item) => item.trim()), `${candidate.targetId}: invalid blockers`)
    const expectedReasons = eligibilityReasons(candidate, manifest.gameVersion)
    check(JSON.stringify(candidate.eligibility.reasons) === JSON.stringify(expectedReasons), `${candidate.targetId}: eligibility reasons drift`)
    check(candidate.eligibility.status === (expectedReasons.length ? 'ineligible' : 'eligible'), `${candidate.targetId}: eligibility status drift`)
  }

  const promotionIds = new Set<string>()
  for (const promotion of manifest.promotions) {
    check(!promotionIds.has(promotion.targetId), `${promotion.targetId}: duplicate promotion`)
    promotionIds.add(promotion.targetId)
    const candidate = manifest.candidates.find((item) => item.targetId === promotion.targetId)
    check(Boolean(candidate), `${promotion.targetId}: promotion lacks a candidate`)
    check(candidate?.eligibility.status === 'eligible', `${promotion.targetId}: ineligible target cannot be promoted`)
    check(candidate?.decisionRef === promotion.decisionRef, `${promotion.targetId}: decision reference mismatch`)
    check(['limited', 'full'].includes(promotion.supportLevel), `${promotion.targetId}: invalid support level`)
    check(promotion.rollback.strategy === 'revert-commit' && Boolean(promotion.rollback.note.trim()), `${promotion.targetId}: rollback contract is required`)
    for (const kind of PROMOTION_ARTIFACT_KINDS) {
      const artifact = promotion.artifacts[kind]
      check(Boolean(artifact?.path.trim()) && !artifact?.path.startsWith('/') && !artifact?.path.includes('..'), `${promotion.targetId}: invalid ${kind} path`)
      check(SHA256.test(artifact?.sha256 ?? ''), `${promotion.targetId}: invalid ${kind} hash`)
    }
  }
  for (const candidate of manifest.candidates) {
    check((candidate.eligibility.status === 'eligible') === promotionIds.has(candidate.targetId), `${candidate.targetId}: eligible target and promotion bundle must be atomic`)
  }
  check(manifest.summary.candidates === manifest.candidates.length, 'candidate summary drift')
  check(manifest.summary.eligible === manifest.candidates.filter((candidate) => candidate.eligibility.status === 'eligible').length, 'eligible summary drift')
  check(manifest.summary.promoted === manifest.promotions.length, 'promotion summary drift')
  check(manifest.summary.eligible === manifest.summary.promoted, 'eligible and promoted counts must match')
  return errors
}
