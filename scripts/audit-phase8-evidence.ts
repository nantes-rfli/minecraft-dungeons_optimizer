import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceRepository, independentEvidenceIds, parseEvidenceRepository, serializeEvidenceRepository, type EvidenceIntakeRecord } from '../src/research/evidenceIntake.ts'
import { reassessPhase8Gap } from '../src/research/phase8GapReassessment.ts'

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname)
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'))
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const capturedAt = '2026-09-10T00:00:00+09:00'

const redditClaimRevision1 = {
  statement: 'A current community explanation places Iron Hide and Potion Barrier in an additive effective-health group, while Guarding Strike multiplies the resulting effective health separately.',
  locator: 'anotherraalt comment, lines 45-55 in the retained 2026-09-10 retrieval',
}
const caramelGuideClaim = {
  statement: 'A Reddit attribution post identifies the linked Imgur album as Caramel/Errie’s DR guide; the underlying Discord research and measurement provenance were not recovered.',
  locator: 'Reddit 1ty0t0p lines 43-58 and linked Imgur album title, reviewed 2026-09-10',
}
const redditClaimRevision2 = {
  statement: 'The commenter explicitly introduces the explanation as adapted from Caramel’s DR guide; it is a derivative restatement, not an independent origin.',
  locator: 'anotherraalt comment in Reddit 1w4c05n; dependency attribution cross-checked through Reddit 1ty0t0p and the linked Imgur album',
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
      snapshotSha256: sha256(redditClaimRevision1), originKind: 'external', originGroup: 'anotherraalt', repostOfSourceRevisionId: null, reviewed: true,
    },
    claim: { claimId: 'dr-current-ehp-family', entity: 'defense:limited-dr-composition', property: 'defense.composition', statement: redditClaimRevision1.statement, value: { additiveEffectiveHealth: ['iron-hide', 'potion-barrier'], separateMultipliers: ['guarding-strike'] } },
    context: { gameVersion: null, equipment: [{ id: 'artifact:iron-hide-amulet', power: null }, { id: 'melee-enchantment:guarding-strike', power: null }], conditions: { activation: 'all named effects active', damageChannel: null } },
    measurement: { unit: 'effective-health multiplier', repetitions: null, observations: [], missingReasons: ['public explanation has no raw hit sequence', 'game version and equipment Power are not stated'] },
    locators: [{ kind: 'text', locator: redditClaimRevision1.locator, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/' }],
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
  {
    id: 'phase8-caramel-dr-guide@1', recordId: 'phase8-caramel-dr-guide', revision: 1,
    source: {
      sourceId: 'caramel-dr-guide', revision: 1, url: 'https://imgur.com/a/caramel-errie-s-dr-guide-xPPTKHu',
      label: 'Caramel/Errie’s DR Guide attribution and album', retrievedAt: capturedAt,
      snapshotSha256: sha256(caramelGuideClaim), originKind: 'external', originGroup: null, repostOfSourceRevisionId: null, reviewed: false,
    },
    claim: { claimId: 'caramel-dr-guide-provenance', entity: 'defense:limited-dr-composition', property: 'defense.composition-provenance', statement: caramelGuideClaim.statement, value: { attributedAuthor: 'Caramel/Errie', contentRecovered: false, upstreamResearchRecovered: false } },
    context: { gameVersion: null, equipment: [], conditions: { publicationContext: 'Imgur copy of a guide described as originating in Discord', measurementOrigin: null } },
    measurement: { unit: null, repetitions: null, observations: [], missingReasons: ['guide images were not retrievable in the text-only review', 'underlying Discord post, tester identity, raw measurements, and dependency chain are unavailable'] },
    locators: [
      { kind: 'text', locator: caramelGuideClaim.locator, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1ty0t0p/does_damage_reduction_stack/' },
      { kind: 'image', locator: 'Imgur album title: Caramel/Errie’s Dr Guide', url: 'https://imgur.com/a/caramel-errie-s-dr-guide-xPPTKHu' },
    ],
    partition: 'unassigned', corrects: null, correctionReason: null, capturedAt,
  },
  {
    id: 'phase8-dr-ehp-current@2', recordId: 'phase8-dr-ehp-current', revision: 2,
    source: {
      sourceId: 'reddit-1w4c05n', revision: 2, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/',
      label: 'Damage reduction discussion with Caramel guide dependency (reviewed 2026-09-10)', retrievedAt: capturedAt,
      snapshotSha256: sha256(redditClaimRevision2), originKind: 'external', originGroup: null, repostOfSourceRevisionId: 'caramel-dr-guide@1', reviewed: true,
    },
    claim: { claimId: 'dr-current-ehp-family', entity: 'defense:limited-dr-composition', property: 'defense.composition', statement: redditClaimRevision2.statement, value: { additiveEffectiveHealth: ['iron-hide', 'potion-barrier'], separateMultipliers: ['guarding-strike'] } },
    context: { gameVersion: null, equipment: [{ id: 'artifact:iron-hide-amulet', power: null }, { id: 'melee-enchantment:guarding-strike', power: null }], conditions: { activation: 'all named effects active', damageChannel: null } },
    measurement: { unit: 'effective-health multiplier', repetitions: null, observations: [], missingReasons: ['derivative explanation has no raw hit sequence', 'Caramel guide measurement origin is unresolved', 'game version and equipment Power are not stated'] },
    locators: [
      { kind: 'text', locator: redditClaimRevision2.locator, url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/' },
      { kind: 'text', locator: 'Caramel attribution post, lines 43-58', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1ty0t0p/does_damage_reduction_stack/' },
      { kind: 'image', locator: 'Attributed Caramel/Errie DR guide album', url: 'https://imgur.com/a/caramel-errie-s-dr-guide-xPPTKHu' },
    ],
    partition: 'unassigned', corrects: 'phase8-dr-ehp-current@1', correctionReason: 'The original intake incorrectly treated a separately posted derivative explanation as an independent origin.', capturedAt: '2026-09-10T05:20:00+09:00',
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
  const activeEvidenceRecordIds = ['phase8-dr-ehp-current@2', 'phase8-caramel-dr-guide@1', 'phase8-iron-hide-wiki-tests@1']
  const reassessment = {
    schemaVersion: 1,
    phase: '8B',
    baseline: { phase66HandoffCount: handoff.records.length, phase66Handoff: handoff.summary, remainingGapCount: remaining.length, historicalClosedGapCount: aligned.records.length - remaining.length },
    selectedUnit: {
      id: 'limited-direct-dr-armor-iron-guarding',
      scope: { effects: ['armor-35', 'iron-hide', 'guarding-strike'], damageChannel: 'direct-mob-attack', activation: 'simultaneously active', gameVersion: null, equipmentPower: null },
      outcome: 'hold',
      evidenceRecordIds: activeEvidenceRecordIds,
      supersededEvidenceRecordIds: ['phase8-dr-ehp-current@1'],
      independentEvidenceRecordIds: independentEvidenceIds(repository, activeEvidenceRecordIds),
      originDependencies: [{ recordId: 'phase8-dr-ehp-current@2', derivedFromSourceRevisionId: 'caramel-dr-guide@1', upstreamOrigin: 'unresolved' }],
      independenceUnresolved: activeEvidenceRecordIds,
      narrowed: ['The current Reddit explanation exposes its dependency on Caramel/Errie’s DR guide; it does not add an independent origin.', 'Two published single-Iron-Hide raw damage pairs corroborate a 0.5 damage-taken fraction, but their tester/editor origin remains unresolved.'],
      blockers: ['exact game version absent', 'no independent raw Armor + Iron Hide + Guarding trace', 'equipment Power and activation frames absent', 'rounding stage absent', 'Ghost Cloak + Guarding remains outside scope and unresolved', 'Dynamo placement remains outside scope and unresolved'],
      nextAcquisition: ['Use damage-reduction-composition protocol on game version 1.17.0.0.', 'Record no-DR, Armor 35%, Iron Hide, Guarding Strike, and the three-effect combination against the same direct attack.', 'Capture equipment IDs/Power, activation frames, HP before/after, at least 3 independent runs and 10 valid hits per active window.'],
      affectedGapIds: selectedIds,
      promotionCount: 0,
      newGapClosures: 0,
    },
    summary: { total: records.length, ...counts, selectedUnitGapCount: selectedIds.length, repositoryRevisions: PHASE8_EVIDENCE_RECORDS.length, activeEvidenceRecords: activeEvidenceRecordIds.length, independentEvidenceRecords: 0, promotions: 0, newGapClosures: 0 },
    records,
  }
  return { repository, reassessment }
}

function report(reassessment: ReturnType<typeof buildPhase8Artifacts>['reassessment']): string {
  const summary = reassessment.summary
  return `# Phase 8A / 8B — Evidence Intake and Limited DR Reassessment\n\n調査日: 2026-09-10。Phase 8Aの受入・保存・検証基盤を実装し、Phase 8Bの最初の単位として35% Armor + Iron Hide + Guarding Strike（direct mob attack）を再評価した。runtime昇格・Gap closeは0。8Cは未実施。\n\n## 8A\n\n受入契約はSourceRevision、claim、game version、装備ID/Power、条件、単位、反復、raw observation、画像/動画/本文locator、external/self origin、calibration/holdout区分を保持する。claim domainはentity・property・game version・装備ID/Power・conditions・unitの完全一致で比較する。構造不正は拒否し、不足・競合・転載・訂正・同一originのcalibration/holdout混用を理由コード付きで判定する。revisionは追記のみで、旧revisionとchanged fieldsを残す。JSON保存後の再読込では全判定を再計算してdriftを検出する。\n\n## 8B origin correction\n\n- [2026年のDR説明](https://www.reddit.com/r/MinecraftDungeons/comments/1w4c05n/damage_reduction/)はCaramelのguideを使う旨を明記しており、独立originではない。旧record @1を残し、@2で[Caramel attribution post](https://www.reddit.com/r/MinecraftDungeons/comments/1ty0t0p/does_damage_reduction_stack/)と[Imgur album](https://imgur.com/a/caramel-errie-s-dr-guide-xPPTKHu)へのdependencyを記録した。guideのDiscord原典・tester・raw測定は回収できず、origin independenceはunknown。\n- [Iron Hide Amulet](https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet)は8→4と36,000→18,000の単独testを掲載する。編集・test origin、version、Power、frame列が不明で独立holdoutには使わない。\n\nactive 3 recordsの独立Evidence countは0。選択した三効果組合せの独立raw traceは得られておらず、出口は引き続き**保留**。Ghost + Guarding競合とDynamo配置は対象外のまま解決していない。\n\n## Queue reassessment\n\nPhase 6.6のhandoff ${reassessment.baseline.phase66HandoffCount}件（Observe ${reassessment.baseline.phase66Handoff.observe} / Measure ${reassessment.baseline.phase66Handoff.measure} / Experiment ${reassessment.baseline.phase66Handoff.experiment}）を元IDのまま照合し、現在のremaining ${summary.total}件を完全にpartitionした。\n\n| Disposition | Count | Meaning |\n|---|---:|---|\n| external-resolved | ${summary['external-resolved']} | 外部Evidenceだけで元のclose条件を満たす |\n| limited-measurement | ${summary['limited-measurement']} | 外部資料で範囲は狭まったが限定実測が必要 |\n| implementation-missing | ${summary['implementation-missing']} | Evidenceでは代替できない実装不足 |\n| hold | ${summary.hold} | 今回の単位外、または元protocol/公開調査/目的判断を維持 |\n\n外部解消0件を維持し、Gap close・promotion・runtime変更は行わない。8Cへはまだ進まず、次の独立測定条件だけを保持する。\n`
}

const { repository, reassessment } = buildPhase8Artifacts()
const repositoryText = serializeEvidenceRepository(repository)
const phase8Report = `> 現在地: その後Phase 8Cを実施し、保留判定を保存しました。[独立検証レポート](./phase8c-limited-dr-validation.md)を参照してください。\n\n${report(reassessment)}`
assert.deepEqual(parseEvidenceRepository(repositoryText), repository)
assert.equal(reassessment.baseline.phase66HandoffCount, 1307)
assert.equal(reassessment.summary.total, 2088)
assert.equal(Object.values(reassessment.summary).filter((value) => typeof value === 'number').length > 0, true)
assert.equal(reassessment.selectedUnit.promotionCount, 0)
assert.equal(reassessment.selectedUnit.newGapClosures, 0)
assert.equal(reassessment.selectedUnit.outcome, 'hold')
assert.deepEqual(reassessment.selectedUnit.independentEvidenceRecordIds, [])

const outputs = new Map([
  ['research/evidence-intake.json', repositoryText],
  ['research/phase8-gap-reassessment.json', `${JSON.stringify(reassessment, null, 2)}\n`],
  ['docs/phase8-evidence-intake.md', phase8Report],
])
if (process.argv.includes('--write')) for (const [file, contents] of outputs) fs.writeFileSync(path.join(repositoryRoot, file), contents)
for (const [file, contents] of outputs) assert.equal(fs.readFileSync(path.join(repositoryRoot, file), 'utf8'), contents, `${file} drift; run generate:phase8-evidence`)
console.log(`Phase 8 evidence audit passed: ${repository.entries.length} preserved revisions, ${reassessment.summary.total} remaining Gaps partitioned, independent selected evidence 0; promotions 0, Gap closures 0.`)
