import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceRepository, parseEvidenceRepository, serializeEvidenceRepository, type EvidenceIntakeRecord } from '../src/research/evidenceIntake.ts'
import { reassessPhase8Gap } from '../src/research/phase8GapReassessment.ts'

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname)
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'))
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const capturedAt = '2026-09-10T00:00:00+09:00'

const redditClaim = {
  statement: 'A current community explanation places Iron Hide and Potion Barrier in an additive effective-health group, while Guarding Strike multiplies the resulting effective health separately.',
  locator: 'anotherraalt comment, lines 45-55 in the retained 2026-09-10 retrieval',
}
const wikiClaim = {
  statement: 'The Iron Hide Amulet page reports two single-effect tests at 50% damage taken and one armor-plus-amulet example, but does not preserve a complete versioned raw trace.',
  locator: 'Usage > Properties; testing and stacking paragraphs in the retained 2026-09-10 retrieval',
}

export const PHASE8_EVIDENCE_RECORDS: readonly EvidenceIntakeRecord[] = [
  {
    id: 'phase8-dr-ehp-current@1', recordId: 'phase8-dr-ehp-current', revision: 1,
    source: {
      sourceId: 'reddit-1w4c05n', revision: 1, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/',
      label: 'Damage reduction discussion (retrieved 2026-09-10)', retrievedAt: capturedAt,
      snapshotSha256: sha256(redditClaim), originKind: 'external', originGroup: 'anotherraalt', repostOfSourceRevisionId: null, reviewed: true,
    },
    claim: { claimId: 'dr-current-ehp-family', entity: 'defense:limited-dr-composition', property: 'defense.composition', statement: redditClaim.statement, value: { additiveEffectiveHealth: ['iron-hide', 'potion-barrier'], separateMultipliers: ['guarding-strike'] } },
    context: { gameVersion: null, equipment: [{ id: 'artifact:iron-hide-amulet', power: null }, { id: 'melee-enchantment:guarding-strike', power: null }], conditions: { activation: 'all named effects active', damageChannel: null } },
    measurement: { unit: 'effective-health multiplier', repetitions: null, observations: [], missingReasons: ['public explanation has no raw hit sequence', 'game version and equipment Power are not stated'] },
    locators: [{ kind: 'text', locator: redditClaim.locator, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/' }],
    partition: 'unassigned', corrects: null, correctionReason: null, capturedAt,
  },
  {
    id: 'phase8-iron-hide-wiki-tests@1', recordId: 'phase8-iron-hide-wiki-tests', revision: 1,
    source: {
      sourceId: 'minecraft-wiki-iron-hide-amulet', revision: 1, url: 'https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet',
      label: 'Minecraft Wiki: Iron Hide Amulet (retrieved 2026-09-10)', retrievedAt: capturedAt,
      snapshotSha256: sha256(wikiClaim), originKind: 'external', originGroup: null, repostOfSourceRevisionId: null, reviewed: true,
    },
    claim: { claimId: 'iron-hide-reported-tests', entity: 'artifact:iron-hide-amulet', property: 'defense.single-effect-reduction', statement: wikiClaim.statement, value: 0.5 },
    context: { gameVersion: null, equipment: [{ id: 'artifact:iron-hide-amulet', power: null }], conditions: { targets: 'Zombie and Apocalypse+15 Zombie in separate reported examples', damageChannel: 'direct-mob-attack' } },
    measurement: { unit: 'damage-taken fraction', repetitions: 2, observations: [{ value: { baselineDamage: 8, activeDamage: 4 }, locator: 'Usage > Properties, first reported test' }, { value: { baselineDamage: 36000, activeDamage: 18000 }, locator: 'Usage > Properties, second reported test' }], missingReasons: ['editor/tester origin is unresolved', 'game version, frame sequence, equipment Power, and rounding stage are absent'] },
    locators: [{ kind: 'text', locator: wikiClaim.locator, url: 'https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet' }],
    partition: 'unassigned', corrects: null, correctionReason: null, capturedAt,
  },
]

export function buildPhase8Artifacts() {
  const repository = buildEvidenceRepository(PHASE8_EVIDENCE_RECORDS)
  const aligned = read('research/game-data-aligned-gap-disposition.json') as { records: { gapId: string; disposition: string; reconciliationStatus: string }[] }
  const handoff = read('research/phase7-research-handoff.json') as { summary: Record<string, number>; records: { gapId: string }[] }
  const remaining = aligned.records.filter((record) => record.reconciliationStatus !== 'closed')
  const records = remaining.map(reassessPhase8Gap)
  const dispositions = ['external-resolved', 'limited-measurement', 'implementation-missing', 'hold'] as const
  const counts = Object.fromEntries(dispositions.map((disposition) => [disposition, records.filter((record) => record.disposition === disposition).length]))
  const selectedIds = records.filter((record) => record.disposition === 'limited-measurement').map((record) => record.gapId)
  const reassessment = {
    schemaVersion: 1,
    phase: '8B',
    baseline: { phase66HandoffCount: handoff.records.length, phase66Handoff: handoff.summary, remainingGapCount: remaining.length, historicalClosedGapCount: aligned.records.length - remaining.length },
    selectedUnit: {
      id: 'limited-direct-dr-armor-iron-guarding',
      scope: { effects: ['armor-35', 'iron-hide', 'guarding-strike'], damageChannel: 'direct-mob-attack', activation: 'simultaneously active', gameVersion: null, equipmentPower: null },
      outcome: 'hold',
      evidenceRecordIds: PHASE8_EVIDENCE_RECORDS.map((record) => record.id),
      independentFromPhase69DefenseOrigin: ['phase8-dr-ehp-current@1'],
      independenceUnresolved: ['phase8-iron-hide-wiki-tests@1'],
      narrowed: ['A second author/origin corroborates the additive-EHP versus separate-Guarding family split.', 'Two published single-Iron-Hide raw damage pairs corroborate a 0.5 damage-taken fraction.'],
      blockers: ['exact game version absent', 'no independent raw Armor + Iron Hide + Guarding trace', 'equipment Power and activation frames absent', 'rounding stage absent', 'Ghost Cloak + Guarding remains outside scope and unresolved', 'Dynamo placement remains outside scope and unresolved'],
      nextAcquisition: ['Use damage-reduction-composition protocol on game version 1.17.0.0.', 'Record no-DR, Armor 35%, Iron Hide, Guarding Strike, and the three-effect combination against the same direct attack.', 'Capture equipment IDs/Power, activation frames, HP before/after, at least 3 independent runs and 10 valid hits per active window.'],
      affectedGapIds: selectedIds,
      promotionCount: 0,
      newGapClosures: 0,
    },
    summary: { total: records.length, ...counts, selectedUnitGapCount: selectedIds.length, evidenceAdded: PHASE8_EVIDENCE_RECORDS.length, promotions: 0, newGapClosures: 0 },
    records,
  }
  return { repository, reassessment }
}

function report(reassessment: ReturnType<typeof buildPhase8Artifacts>['reassessment']): string {
  const summary = reassessment.summary
  return `# Phase 8A / 8B — Evidence Intake and Limited DR Reassessment\n\n調査日: 2026-09-10。Phase 8Aの受入・保存・検証基盤を実装し、Phase 8Bの最初の単位として35% Armor + Iron Hide + Guarding Strike（direct mob attack）を再評価した。runtime昇格・Gap closeは0。\n\n## 8A\n\n受入契約はSourceRevision、claim、game version、装備ID/Power、条件、単位、反復、raw observation、画像/動画/本文locator、external/self origin、calibration/holdout区分を保持する。構造不正は拒否し、不足・競合・転載・訂正・同一originのcalibration/holdout混用を理由コード付きで判定する。revisionは追記のみで、旧revisionとchanged fieldsを残す。JSON保存後の再読込では全判定を再計算してdriftを検出する。\n\n今回の2件は完全な検証票ではないためquarantineとして保存した。これはEvidenceを捨てず、不足を既知値に変換しないためである。\n\n## 8B acquisition\n\n- [2026年のDR説明](https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/)は、Iron Hide/Potion Barrierを加算EHP群、Guarding Strikeを別乗算とする。Phase 6.9のShin由来とは別originだが、game versionとraw hit列がない。\n- [Iron Hide Amulet](https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet)は8→4と36,000→18,000の単独testを掲載する。編集・test origin、version、Power、frame列が不明で独立holdoutには使わない。\n\n第二originの式説明と単独値は追加できたが、選択した三効果組合せの独立raw traceは得られなかった。出口は**保留**。Ghost + Guarding競合とDynamo配置は対象外のまま解決していない。\n\n## Queue reassessment\n\nPhase 6.6のhandoff ${reassessment.baseline.phase66HandoffCount}件（Observe ${reassessment.baseline.phase66Handoff.observe} / Measure ${reassessment.baseline.phase66Handoff.measure} / Experiment ${reassessment.baseline.phase66Handoff.experiment}）を元IDのまま照合し、現在のremaining ${summary.total}件を完全にpartitionした。\n\n| Disposition | Count | Meaning |\n|---|---:|---|\n| external-resolved | ${summary['external-resolved']} | 外部Evidenceだけで元のclose条件を満たす |\n| limited-measurement | ${summary['limited-measurement']} | 外部資料で範囲は狭まったが限定実測が必要 |\n| implementation-missing | ${summary['implementation-missing']} | Evidenceでは代替できない実装不足 |\n| hold | ${summary.hold} | 今回の単位外、または元protocol/公開調査/目的判断を維持 |\n\n外部解消0件を明示し、新EvidenceだけでGapをcloseしない。次はdamage-reduction-composition protocolで版1.17.0.0、同一攻撃、単独・pair・三効果、3独立run×各10 hit以上を取得して8Cへ渡す。\n`
}

const { repository, reassessment } = buildPhase8Artifacts()
const repositoryText = serializeEvidenceRepository(repository)
assert.deepEqual(parseEvidenceRepository(repositoryText), repository)
assert.equal(reassessment.baseline.phase66HandoffCount, 1307)
assert.equal(reassessment.summary.total, 2088)
assert.equal(Object.values(reassessment.summary).filter((value) => typeof value === 'number').length > 0, true)
assert.equal(reassessment.selectedUnit.promotionCount, 0)
assert.equal(reassessment.selectedUnit.newGapClosures, 0)
assert.equal(reassessment.selectedUnit.outcome, 'hold')

const outputs = new Map([
  ['research/evidence-intake.json', repositoryText],
  ['research/phase8-gap-reassessment.json', `${JSON.stringify(reassessment, null, 2)}\n`],
  ['docs/phase8-evidence-intake.md', report(reassessment)],
])
if (process.argv.includes('--write')) for (const [file, contents] of outputs) fs.writeFileSync(path.join(repositoryRoot, file), contents)
for (const [file, contents] of outputs) assert.equal(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'), contents, `${file} drift; run generate:phase8-evidence`)
console.log(`Phase 8 evidence audit passed: ${repository.entries.length} new records, ${reassessment.summary.total} remaining Gaps partitioned; promotions 0, Gap closures 0.`)
