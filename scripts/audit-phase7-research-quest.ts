import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { Inventory } from '../src/core/types.ts'
import { LIMITED_DR_ACCEPTANCE_PLAN } from '../src/research/limitedDrValidation.ts'
import { PHASE7_GAP_IDS, resolveResearchQuestReadiness } from '../src/research/researchQuest.ts'

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname)
const readyInventory: Inventory = {
  weapons: [{ instanceId: 'audit-weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['guarding-strike'], locked: 'guarding-strike' }] }],
  armors: [{ instanceId: 'audit-armor', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }],
  artifacts: [{ instanceId: 'audit-iron', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
}
const selectionRequiredInventory: Inventory = {
  ...readyInventory,
  weapons: [{ ...readyInventory.weapons[0]!, enchantmentSlots: [{ candidates: ['guarding-strike'] }] }],
}
const unavailableInventory: Inventory = { weapons: [], armors: [], artifacts: [] }

export function buildPhase7Audit() {
  return {
    schemaVersion: 1,
    phase: '7',
    completedAt: '2026-09-10',
    scope: 'personal-research-quest',
    queue: {
      reassessedUnitCount: 1,
      requiredOwnedItems: ['armor:35-percent-dr', 'artifact:iron-hide-amulet', 'melee-enchantment:guarding-strike'],
      missingOwnedItemsBecomeRequiredTasks: false,
      linkedProtocolId: 'damage-reduction-composition',
      resolutionClass: 'experiment',
      gapIds: PHASE7_GAP_IDS,
      readyFixture: resolveResearchQuestReadiness(readyInventory),
      selectionRequiredFixture: resolveResearchQuestReadiness(selectionRequiredInventory),
      unavailableFixture: resolveResearchQuestReadiness(unavailableInventory),
    },
    capture: {
      modes: ['observe', 'measure', 'experiment'],
      selectedModeWithTask: 'experiment',
      canSkipPauseResume: true,
      draftPersistsAcrossReload: true,
      storageSchemaVersion: 1,
      selfObservationRawRecordGenerated: true,
      selfObservationHashGenerated: true,
      externalEvidenceKeepsUrlAndHash: true,
      outputIncludes: ['evidenceRepository', 'limitedDrRuns', 'rawRecords', 'frozen8cValidation'],
      minimumConditions: LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.length,
      minimumRuns: LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.length * LIMITED_DR_ACCEPTANCE_PLAN.minimumIndependentRunsPerCondition,
      minimumHits: LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.length * LIMITED_DR_ACCEPTANCE_PLAN.minimumIndependentRunsPerCondition * LIMITED_DR_ACCEPTANCE_PLAN.minimumHitsPerRun,
    },
    boundaries: {
      runtimePromotionCount: 0,
      newGapClosures: 0,
      phase8cDecisionRemains: 'hold',
      personalDataCommitted: false,
      queueCompletionIsModelAccuracy: false,
    },
  } as const
}

function report(): string {
  return `# Phase 7 — Personal Research Quest\n\n実施日: 2026-09-10。Phase 8Bで再評価した残余から、最初の限定DR単位だけをactual Inventoryと既存の\`damage-reduction-composition\` protocolへ接続した。\n\n## 7A — 所有装備に結びつく最小queue\n\n35% Armor、Iron Hide Amulet、実際に選択済みのGuarding Strikeを登録している場合だけExperimentを実施可能にする。通常枠の候補にあるだけなら「選択が必要」とし、Gilded Guarding Strikeは使用可能として扱う。未所持装備は不足理由として表示するが、本人の必須taskや進捗分母へ加えない。対象は5 Gapで、外部取得済み課題やPhase 8B外の2,083 Gapは追加していない。\n\n## 7B — 任意の限定実測\n\nObserve / Measure / Experimentを選択でき、現在の残余taskはExperimentだけ。スキップ・中断・再開、条件別進捗、版・platform・difficulty・incoming hit・activation frame・10 hit以上のdamage列を保存する。自前測定は入力内容からraw recordとSHA-256を自動生成し、外部Evidenceでは従来どおりHTTPS URLとSHA-256を保持する。全8条件 × 3独立run × 10 hitの固定gateは変更しない。\n\n保存済みrunはPhase 8AのEvidence RepositoryとPhase 8Cの\`LimitedDrRun\`へ同時変換し、同じ画面で固定済みvalidatorを再実行できる。個人観測はブラウザlocalStorageにだけ保存し、Gitへ含めない。\n\n## Boundary\n\nruntime昇格0、新規Gap close 0、8CのAdoptionDecisionはholdのまま。queue消化率をモデル精度とは扱わない。\n`
}

const result = buildPhase7Audit()
assert.equal(result.queue.readyFixture.ready, true)
assert.equal(result.queue.selectionRequiredFixture.ready, false)
assert.equal(result.queue.selectionRequiredFixture.guardingStrikeStatus, 'selection-required')
assert.equal(result.queue.unavailableFixture.ready, false)
assert.equal(result.queue.unavailableFixture.missing.length, 3)
assert.equal(result.capture.minimumRuns, 24)
assert.equal(result.capture.minimumHits, 240)
assert.equal(result.boundaries.runtimePromotionCount, 0)

const outputs = new Map([
  ['research/phase7-research-quest.json', `${JSON.stringify(result, null, 2)}\n`],
  ['docs/phase7-personal-research-quest.md', report()],
])
if (process.argv.includes('--write')) for (const [file, contents] of outputs) fs.writeFileSync(path.join(repositoryRoot, file), contents)
for (const [file, contents] of outputs) assert.equal(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'), contents, `${file} drift; run generate:phase7-research-quest`)
console.log(`Phase 7 audit passed: 1 owned-filtered Experiment, ${result.capture.minimumRuns} runs / ${result.capture.minimumHits} hits gate; promotions 0, Gap closures 0.`)
