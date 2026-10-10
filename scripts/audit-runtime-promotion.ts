import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import phase8c from '../research/runtime/phase8c-limited-dr-validation.json' with { type: 'json' }
import regressionArtifact from '../research/runtime/runtime-promotion-regression.json' with { type: 'json' }
import { buildRuntimePromotionManifest, collectRuntimePromotionErrors, collectRuntimePromotionRegressionSourceErrors, PROMOTION_ARTIFACT_KINDS, type PromotionRegressionResult, type RuntimePromotionRegressionArtifact } from '../src/research/runtimePromotion.ts'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const manifestArtifactPath = 'research/runtime/runtime-promotion-manifest.json'
const regressionArtifactPath = 'research/runtime/runtime-promotion-regression.json'

export function buildCurrentRuntimePromotionManifest() {
  const decision = phase8c.adoptionDecision
  const regressionIndex = regressionArtifact.targets.findIndex((result) => result.targetId === 'defense.damage-taken-composition')
  const regression = regressionArtifact.targets[regressionIndex] as PromotionRegressionResult | undefined
  assert(regression, 'defense.damage-taken-composition: regression result missing')
  return buildRuntimePromotionManifest({
    gameVersion: phase8c.plan.gameVersion,
    candidates: [{
      targetId: 'defense.damage-taken-composition',
      targetKind: 'mechanic',
      decisionRef: 'research/runtime/phase8c-limited-dr-validation.json#/adoptionDecision',
      outcome: decision.decision === 'adopt' ? 'accepted' : decision.decision === 'reject' ? 'rejected' : 'held',
      gameVersion: phase8c.plan.gameVersion,
      valueStatus: 'known',
      regression: regression.status,
      regressionRef: `${regressionArtifactPath}#/targets/${regressionIndex}`,
      regressionGameVersion: regression.gameVersion,
      regressionSourceRef: regression.sourceRef,
      blockers: decision.blockers,
    }],
    promotions: [],
  })
}

function report(manifest: ReturnType<typeof buildCurrentRuntimePromotionManifest>): string {
  const rows = manifest.candidates.map((candidate) => `| ${candidate.targetId} | ${candidate.targetKind} | ${candidate.outcome} | ${candidate.regression} | ${candidate.eligibility.status} | ${candidate.eligibility.reasons.join('<br>')} | [decision](../${candidate.decisionRef}) · [regression](../${candidate.regressionRef}) |`).join('\n')
  return `# Runtime Promotion Pipeline\n\nP3で固定した、parameter / mechanic単位のruntime昇格契約。正本は[machine-readable manifest](../research/runtime/runtime-promotion-manifest.json)。\n\n## Current state\n\nCandidate ${manifest.summary.candidates} · Eligible ${manifest.summary.eligible} · Promoted ${manifest.summary.promoted}。現在は昇格可能な対象がないため、runtime値・support level・Optimizer候補・Gap closureは変更しない。\n\n| Target | Kind | Adoption | Regression | Eligibility | Reasons | Sources |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n\n## Independent gates\n\nResearch AdoptionDecisionとProduct Regressionは独立したgateであり、acceptedになっただけではeligibleにならない。AdoptionDecisionがaccepted、対象版が一致、値が既知、Research blockerが空、独立したProduct regression sourceがpassedの場合だけeligibleになる。\n\n## Atomic promotion contract\n\neligibleになった対象は同じpromotion bundleで次の5成果物をすべて宣言し、それぞれのSHA-256を固定する。\n\n${PROMOTION_ARTIFACT_KINDS.map((kind) => `- \`${kind}\``).join('\n')}\n\n欠落、内容drift、decision参照の不一致、regression sourceとの不一致、非eligible対象のbundle、eligible対象のbundle未登録はauditで拒否する。rollbackは対象commitのrevertを基本契約とする。未検証値を0や1として登録せず、support分類やGap closeを自動推定しない。\n\n## First promotion procedure\n\n1. R3でparameter / mechanic単位のaccepted decisionを保存する。\n2. Product側のruntime変更とregressionを準備する。\n3. regressionを実行し、結果とprovenanceをmachine-readable regression sourceへ保存する。\n4. eligibilityを再評価し、全gateを通った対象だけをeligibleにする。\n5. eligible対象についてruntime、support manifest、利用者向け説明、coverage、regressionの5ファイルとSHA-256、support level、rollback noteを同じpromotion bundleへ登録する。\n6. \`npm run audit:runtime-promotion\`と関連audit、test、lint、buildを通す。\n7. P3Bの最初のeligible単位をreference implementationとして記録する。
## Independent Existing Limited Mechanic Reuse

This is a **separate conditional P4 path**, not a Promotion candidate or an exemption for new formulas. See [ADR 0002](./adr/0002-limited-runtime-reuse.md).

An already-Limited calculation may be reused for another source-backed equipment identity only after exact parameter/value/version, mechanic/channel/scope/inheritance, noninheritance of donor-only effects, and rejection of unverified interaction are reviewed. Explicit per-target Evidence classification, support manifest and positive/negative/preservation tests are required. An unclassified target cannot be evaluated. This path does **not** change R3 acceptance, P3B, Product regression, the five-hash promotion bundle, or Candidate/Eligible/Promoted totals. Outside the existing Limited model's boundary, use New Mechanic Promotion (A).
\n`
}

const manifest = buildCurrentRuntimePromotionManifest()
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
const reportText = report(manifest)
const outputs = new Map([
  [manifestArtifactPath, manifestText],
  ['docs/runtime-promotion-pipeline.md', reportText],
])
if (process.argv.includes('--write')) for (const [file, contents] of outputs) fs.writeFileSync(path.join(root, file), contents)
for (const [file, contents] of outputs) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), contents, `${file} drift; run generate:runtime-promotion`)
assert.deepEqual(collectRuntimePromotionErrors(manifest), [])
assert.deepEqual(collectRuntimePromotionRegressionSourceErrors(manifest, regressionArtifact as RuntimePromotionRegressionArtifact, regressionArtifactPath), [])
for (const promotion of manifest.promotions) for (const kind of PROMOTION_ARTIFACT_KINDS) {
  const artifact = promotion.artifacts[kind]
  const contents = fs.readFileSync(path.join(root, artifact.path))
  assert.equal(createHash('sha256').update(contents).digest('hex'), artifact.sha256, `${promotion.targetId}: ${kind} artifact drift`)
}
console.log(`Runtime promotion audit passed: candidates ${manifest.summary.candidates}, eligible ${manifest.summary.eligible}, promoted ${manifest.summary.promoted}; atomic artifacts ${PROMOTION_ARTIFACT_KINDS.length}.`)
