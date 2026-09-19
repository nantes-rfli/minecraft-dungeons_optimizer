import { buildCoverageAdapters } from './adapters'
import { buildBacklogBlockers } from './backlog'
import { recordKey, summarizeBlockers, type CoverageAdapter, type CoverageBlocker, type JsonValue } from './model'
import { resolveProtocolCloseConditions, type MeasurementProtocol } from './protocols'

export function buildEvidenceCoverage(adapters: readonly CoverageAdapter[] = buildCoverageAdapters(), backlog: readonly CoverageBlocker[] = buildBacklogBlockers()) {
  const blockers = [...backlog, ...adapters.flatMap((adapter) => adapter.blockers)].sort((a, b) => a.id.localeCompare(b.id, 'en'))
  const records = adapters.flatMap((adapter) => adapter.records).map((record) => ({ ...record, blockerIds: blockers.filter((blocker) => blocker.recordKeys.includes(recordKey(record))).map((blocker) => blocker.id) }))
  const categories = adapters.map((adapter) => {
    const count = (state: string) => adapter.records.filter((record) => record.runtimeSupport === state).length
    return { id: adapter.category, label: adapter.label, populationDefinition: adapter.populationDefinition, population: adapter.records.length,
      runtime: { full: count('full'), limited: count('limited'), researchOnly: count('research-only'), unknown: count('unknown'), notApplicable: count('not-applicable') },
      blockers: summarizeBlockers(blockers.filter((blocker) => blocker.categories.includes(adapter.category))),
      sourceRefs: adapter.sourceRefs, details: adapter.details }
  })
  return { schemaVersion: 1, generatedBy: 'npm run generate:evidence-coverage', categories, records, blockers,
    blockerSummary: summarizeBlockers(blockers), backlogSummary: summarizeBlockers(backlog) }
}
export type EvidenceCoverage = ReturnType<typeof buildEvidenceCoverage>

/** Small UI projection: full source facets stay in the research snapshot, outside the browser bundle. */
export function buildCoverageDashboard(snapshot: EvidenceCoverage, protocols: readonly MeasurementProtocol[]) {
  const artifact = snapshot.categories.find((entry) => entry.id === 'artifact')!
  const regression = snapshot.categories.find((entry) => entry.id === 'dps-regression')!
  return {
    categories: snapshot.categories.map((category) => ({ id: category.id, label: category.label, populationDefinition: category.populationDefinition, population: category.population, runtime: category.runtime, blockers: category.blockers, sourceRefs: category.sourceRefs })),
    blockerSummary: snapshot.blockerSummary, backlogSummary: snapshot.backlogSummary,
    highPriority: snapshot.blockers.filter((blocker) => blocker.priority === 'P0' || blocker.priority === 'P1'),
    evidenceAcquisition: artifact.details.acquisition,
    regression: { eligible: regression.details.eligibleCount, minimum: regression.details.minimumSamples, candidates: regression.population },
    protocols: protocols.map((protocol) => ({ id: protocol.id, purpose: protocol.purpose, closeConditions: resolveProtocolCloseConditions(protocol, snapshot.blockers) })),
  }
}
const cell = (value: unknown) => String(value ?? 'unknown').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const refLink = (ref: string) => `[${ref}](../${ref.split('#')[0]})`
const table = (headers: string[], rows: readonly (readonly unknown[])[]) => [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n')


const detailRows = (value: JsonValue | undefined): Readonly<Record<string, JsonValue | undefined>>[] => {
  if (!Array.isArray(value)) throw new Error('Expected structured coverage detail rows')
  return value.map((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('Expected structured coverage detail object')
    return row as Readonly<Record<string, JsonValue | undefined>>
  })
}
const textValue = (value: JsonValue | undefined): string => value == null ? 'unknown' : typeof value === 'string' ? value : JSON.stringify(value)
function renderCategoryDetails(category: EvidenceCoverage['categories'][number], snapshot: EvidenceCoverage): string {
  const d = category.details
  switch (category.id) {
    case 'ranged-weapon':
    case 'ranged-enchantment': return table(['Evidence dimension', 'Source state'], Object.entries(d).map(([key, value]) => [key, textValue(value)]))
    case 'melee-attack-profile': return table(['Evidence dimension', 'Source state'], Object.entries(d).map(([key, value]) => [key, textValue(value)]))
    case 'melee-enchantment': return `Broad Power runtime: ${d.broadPowerRuntime}; Power-limited: ${d.powerLimited}. Runtime scopeの範囲であり、全Power実測済みを意味しません。\n\n` + table(['Enchant', 'Runtime', 'Power coverage'], snapshot.records.filter((r) => r.category === category.id && r.runtimeSupport !== 'research-only').filter((r) => {
      const power = r.evidence.powerCoverage
      return power !== null && typeof power === 'object' && 'runtimePowerRange' in power && power.runtimePowerRange !== null
    }).map((r) => [r.label, r.runtimeSupport, textValue(r.evidence.powerCoverage)]))
    case 'artifact': return `${d.publicEvidenceConclusion}. ${d.sampleScope}\n\n` + table(['Candidate', 'Acquisition state', 'Readiness / high-Power', 'Evidence不足', '新しい調査結果 / interaction'], detailRows(d.acquisition).map((r) => [r.name, r.evidenceStop, `${r.readiness} / ${r.highPowerReady}`, r.previousBlocker, `${r.newEvidence}; ${textValue(r.otherBlockers)}`]))
      + '\n\n' + table(['Conflict', 'Metric', '候補値・単位・version（元の表記）', '判定'], detailRows(d.conflicts).map((r) => [r.id, r.metric, textValue(r.candidates), `${r.conclusion}; selectedValue=${JSON.stringify(r.selectedValue)}`]))
      + '\n\n' + table(['Curve hypothesis', 'Status', 'Published Power', 'High-Power ready', 'Blockers'], detailRows(d.hypotheses).map((r) => [r.id, r.status, textValue(r.supportedPowerRange), r.highPowerReady, textValue(r.blockers)]))
    case 'armor': return table(['Health evidence dimension', 'Source state'], Object.entries(d).map(([key, value]) => [key, textValue(value)]))
    case 'armor-enchantment': return 'Tier/state mechanicsのため単一のPower coverageは非該当です。Cooldown合成の未確定判定、各Enchantのstate、DR/速度/Soulの境界は上記sourceおよびsnapshotのdetailsに保持します。'
    case 'dps-regression': return `Eligible ${d.eligibleCount} / ${d.minimumSamples}; rejected ${d.rejectedCount}. Version confidence: ${textValue(d.versionConfidence)}。採否理由はrecordごとの元audit facetを参照してください。`
  }
}

export function renderCoverageReport(snapshot: EvidenceCoverage): string {
  const dashboard = buildCoverageDashboard(snapshot, [])
  return `# Evidence & Coverage Foundation — Phase 2-4

Generated by \`npm run generate:evidence-coverage\`; checked by \`npm run audit:evidence-coverage\`.
[Machine-readable snapshot](../research/evidence-coverage.json) / [measurement protocols](measurement-protocols.md) / [backlog](runtime-limitations.md)

カテゴリ別の正本をadapterで読み取るread modelです。Fullは現在scopeの通常対応、Limitedは明示境界付き対応、Research-onlyは候補未登録です。unknownは分類の正本がなく、not-applicableはruntime分類が適用されません。Evidence confidence・exact/partial・version・sample・curve readinessは独立の軸で、snapshotのfacetsに元の語彙とprovenanceを保持します。Coverageは正解確率でもRoadmap進捗でもありません。

## Category summary

${table(['Category', 'Audited population', 'Full', 'Limited', 'Research-only', 'Unknown', 'N/A', 'Evidence-blocked', 'Not-implemented', 'Unclassified', 'P0 / P1 / P2 / P3'], snapshot.categories.map((c) => [c.label, c.population, c.runtime.full, c.runtime.limited, c.runtime.researchOnly, c.runtime.unknown, c.runtime.notApplicable, c.blockers.evidenceBlocked, c.blockers.notImplemented, c.blockers.unclassified, Object.values(c.blockers.priorities).join(' / ')]))}

分母はカテゴリごとに異なるため総合率は出しません。Blockerはsource内の項目単位。backlog、runtime診断、acquisitionは別originで保持し、意味が似た自由文を推測で統合しません。カテゴリを跨ぐbacklogは各カテゴリに表示し、全体ではIDで1回だけ数えます。未分類・優先度未設定は未解決の分類であり0件とは異なります。

- 優先度付きbacklog: P0 / P1 / P2 / P3 = ${Object.values(snapshot.backlogSummary.priorities).join(' / ')}。
- P1でEvidence待ち: ${snapshot.blockerSummary.p1EvidenceBlocked}件。
- 未分類diagnostic: ${snapshot.blockerSummary.unclassified}件、優先度未設定: ${snapshot.blockerSummary.unprioritized}件。
- Phase 1 regression: eligible ${dashboard.regression.eligible} / ${dashboard.regression.minimum}（公開監査候補 ${dashboard.regression.candidates}件）。runtime人口とは別の実測gateです。

## High-priority unresolved

${table(['Subsystem / entity', 'Support context', 'Kind', 'Priority', 'Blocked', 'Close condition', 'Source'], dashboard.highPriority.map((b) => [b.label, b.supportContext, b.kind, b.priority, b.description, b.closeCondition, b.sourceRefs.map(refLink).join(' / ')]))}

## 実装を待つ項目

${table(['Subsystem / entity', 'Priority', 'Close condition', 'Source'], snapshot.blockers.filter((b) => b.kind === 'not-implemented').map((b) => [b.label, b.priority, b.closeCondition, b.sourceRefs.map(refLink).join(' / ')]))}

## Evidence acquisition / Power coverage

Artifactの公開Evidence調査が尽きた結果も保持します。highPowerReady=false、unit・version・interaction未解決をruntime supportから推定しません。snapshotのArtifact detailsには全candidate、conflictのselectedValue=null、hypothesisとsource routeを保持しています。公開snapshotの行数は独立run数やverified sample数ではありません。

${snapshot.categories.map((c) => `### ${c.label}\n\n${c.populationDefinition}\n\nSources: ${c.sourceRefs.map(refLink).join(' / ')}\n\n${renderCategoryDetails(c, snapshot)}`).join('\n\n')}

## 正本と拡張境界

カテゴリの監査・support manifest・2-2E Evidenceは従来どおり正本です。優先度付きbacklogのみresearch/runtime-backlog.jsonへ移し、runtime-limitationsの表を生成します。移行時は元22行の全7列をvalidatorで往復比較しました。Markdownの自由文からpriorityやblocker kindを推測しません。

measurement protocolは実験定義で、観測結果ではありません。DPSのEligibilityはdocs/model-regression.mdから再利用します。Research Questの投稿・認証・DBは未実装です。次はPhase 2-5 Ranged Audit & Runtimeでadapterを追加します。Optimizer数値・inventory schemaは変更しません。
`
}
export function renderProtocolReport(protocols: readonly MeasurementProtocol[], blockers: readonly CoverageBlocker[]): string {
  return `# Measurement protocols\n\nGenerated by \`npm run generate:evidence-coverage\`. [構造化protocol](../research/workflow/measurement-protocols.json) / [Coverage](combined-evidence-coverage.md)\n\n実験定義のみ。測定済みの結果・投稿受付・自動的なruntime昇格は含みません。compositionの反復数は新しいprotocol設計上の最低条件です。\n\n${protocols.map((p) => `## ${p.id}\n\n${p.purpose}\n\n対象: ${p.subsystem} / ${p.targetMechanic}。要求version: ${p.requiredGameVersion}\n\n${[['Equipment', p.equipment], ['Scenario', p.scenario], ['Observations', p.observations], ['Acceptance', p.acceptance], ['Submission metadata', p.submissionMetadata], ['Invalidating conditions', p.invalidatingConditions]].map(([title, lines]) => `### ${title}\n\n${(lines as readonly string[]).map((line) => `- ${line}`).join('\n')}`).join('\n\n')}\n\n反復: ${p.repetition.rule}\n\n${resolveProtocolCloseConditions(p, blockers).map((b) => `${b.blockerId}: ${b.closeCondition}`).join('\n\n')}\n\nSources: ${p.sourceRefs.map(refLink).join(' / ')}`).join('\n\n') }\n`
}
