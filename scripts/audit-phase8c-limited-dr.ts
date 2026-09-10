import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { evaluateLimitedDrValidation, type LimitedDrAcceptancePlan } from '../src/research/limitedDrValidation.ts'

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname)

const plan: LimitedDrAcceptancePlan = {
  frozenAt: '2026-09-10T06:00:00+09:00',
  gameVersion: '1.17.0.0',
  damageChannel: 'direct-mob-attack',
  requiredConditions: ['baseline', 'armor-35', 'iron-hide', 'guarding-strike', 'armor-iron', 'armor-guarding', 'iron-guarding', 'armor-iron-guarding'],
  minimumIndependentRunsPerCondition: 3,
  minimumHitsPerRun: 10,
  maximumMeanAbsoluteFractionError: 0.005,
  maximumPerHitRawDamageError: 1,
  rankingComparatorDamageTaken: 0.18,
}

export function buildPhase8cValidation() {
  return evaluateLimitedDrValidation({
    plan,
    calibrationOriginGroups: ['shin-dr', 'caramel-dr-guide', 'anotherraalt'],
    runs: [],
    excludedReferenceRows: [{
      id: 'shin-2021-armor-iron-guarding',
      condition: 'armor-iron-guarding',
      baselineDamage: 396591,
      observedDamage: 78116,
      exclusionReasons: ['same-origin calibration/holdout', 'game-version-unverified', 'single published observation rather than 3 runs x 10 hits'],
    }],
  })
}

function report(result: ReturnType<typeof buildPhase8cValidation>): string {
  const reference = result.excludedReferenceComparisons[0]!
  return `# Phase 8C — Limited DR Independent Validation\n\n検証日: 2026-09-10。対象は35% Armor + Iron Hide + Guarding Strikeのdirect mob attack。検証前に許容範囲を固定し、旧モデル（単純乗算）と研究モデル（Armor/Iron Hideのinverse-score + Guarding Strike別乗算）を同条件で比較した。\n\n## 事前固定したgate\n\n- ゲーム版1.17.0.0、同一incoming hit、baseline・単独3種・pair 3種・三効果の全8条件\n- 各条件3独立run以上、各run 10 hit以上\n- calibration originとholdout originを分離\n- mean absolute damage-taken fraction error <= 0.005、各hitのraw damage error <= 1\n- same-origin row、合成probe、単発自己観測はVerifiedに数えない\n\n## 旧新比較と順位感度\n\n既存の2021年row（baseline 396,591、三効果78,116）は研究モデルのdamage-taken fraction ${reference.proposedDamageTaken.toFixed(6)} とほぼ一致し、旧単純乗算 ${reference.legacyDamageTaken.toFixed(4)} より残差が小さい。ただし、このrowは式を導いたsourceと同じorigin、版不明、1観測のみなので独立holdoutから除外した。damage-taken 0.18の比較候補に対して、研究モデルと旧モデルで順位が反転するため、未検証の切替はOptimizer順位を変え得る。\n\n## AdoptionDecision\n\n判定は **保留（hold）**。eligible independent holdoutは0 run / 0 hitで、全8条件が不足している。再現性は測定不能。runtime昇格0、新規Gap close 0を維持する。これは8Cの検証手続きを完了して保留を保存した結果であり、Limited DRモデルをVerifiedまたは不採用としたものではない。次回は上記gateを変えずにraw traceを追加し、同じauditを再実行する。\n`
}

const result = buildPhase8cValidation()
assert.equal(result.adoptionDecision.decision, 'hold')
assert.equal(result.comparison.eligibleHitCount, 0)
assert.equal(result.evidenceBoundary.eligibleIndependentHoldoutRuns, 0)
assert.equal(result.rankingSensitivity.rankChanges, true)
assert.equal(result.adoptionDecision.promotionCount, 0)
assert.equal(result.adoptionDecision.newGapClosures, 0)

const outputs = new Map([
  ['research/phase8c-limited-dr-validation.json', `${JSON.stringify(result, null, 2)}\n`],
  ['docs/phase8c-limited-dr-validation.md', report(result)],
])
if (process.argv.includes('--write')) for (const [file, contents] of outputs) fs.writeFileSync(path.join(repositoryRoot, file), contents)
for (const [file, contents] of outputs) assert.equal(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'), contents, `${file} drift; run generate:phase8c-limited-dr`)
console.log(`Phase 8C Limited DR audit passed: decision ${result.adoptionDecision.decision}, independent holdout ${result.evidenceBoundary.eligibleIndependentHoldoutRuns} runs / ${result.comparison.eligibleHitCount} hits; promotions 0, Gap closures 0.`)
