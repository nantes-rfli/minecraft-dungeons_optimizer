import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROADMAP_WORK_UNITS,
  collectRoadmapWorkUnitErrors,
  type RoadmapWorkUnit,
} from '../src/data/roadmap.ts'
import { RANGED_ENCHANTMENTS, RANGED_LIMITATIONS, RANGED_WEAPONS } from '../src/data/ranged.ts'

interface RawStructuralManifest {
  readonly summary: {
    readonly seedCount: number
    readonly candidateSeedCount: number
    readonly visitedPackageCount: number
    readonly parsedPackageCount: number
    readonly edgeCount: number
    readonly unresolvedTargetCount: number
    readonly nativeBoundaryCount: number
    readonly parserBoundaryCount: number
    readonly seedStatusCounts: Readonly<Record<'exact' | 'provisional' | 'ambiguous' | 'not-found', number>>
  }
}

interface IdentityArtifact {
  readonly identityAssertions: readonly { readonly domainId: string }[]
  readonly semantic: {
    readonly identities: readonly {
      readonly resolution: { readonly state: string; readonly domainId?: string }
    }[]
  }
}

interface ValueArtifact {
  readonly semantic: {
    readonly melee: Readonly<Record<string, unknown>>
    readonly ranged: Readonly<Record<string, unknown>>
    readonly artifact: Readonly<Record<string, unknown>>
  }
}

interface RelationArtifact {
  readonly semantic: { readonly relations: readonly { readonly sourceDomainId: string }[] }
  readonly relationProjections: readonly unknown[]
  readonly relationCollections: readonly unknown[]
}

interface PromotionManifest {
  readonly summary: { readonly candidates: number; readonly eligible: number; readonly promoted: number }
}

interface RuntimeSupportManifest {
  readonly population: number
  readonly entries: readonly { readonly supportLevel: 'full' | 'limited' | 'research-only' }[]
}

const root = fileURLToPath(new URL('..', import.meta.url))
const statusPath = path.join(root, 'PROJECT_STATUS.md')
const readJson = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')) as T

function supportSummary(relativePath: string) {
  const manifest = readJson<RuntimeSupportManifest>(relativePath)
  const counts = { full: 0, limited: 0, 'research-only': 0 }
  for (const entry of manifest.entries) counts[entry.supportLevel] += 1
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), manifest.population, `${relativePath}: support population drift`)
  return { population: manifest.population, ...counts }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function roadmapBullet(unit: RoadmapWorkUnit): string {
  const next = unit.nextAction ? ` 次: ${unit.nextAction}` : ''
  return `- **${unit.id} — ${unit.title}**: ${unit.goal}${next}`
}

function blockerBullet(unit: RoadmapWorkUnit): string {
  const parts = [
    unit.goal,
    unit.dependencyCondition ? `再開条件: ${unit.dependencyCondition}。` : null,
    unit.nextAction ? `次: ${unit.nextAction}` : null,
  ].filter((part): part is string => Boolean(part))
  return `- **${unit.id} — ${unit.title}**: ${parts.join(' ')}`
}

function renderProjectStatus(): string {
  assert.deepEqual(collectRoadmapWorkUnitErrors(ROADMAP_WORK_UNITS), [])
  const autonomous = fs.readFileSync(path.join(root, 'AUTONOMOUS.md'), 'utf8')
  assert.ok(autonomous.includes('Applicationが信頼して利用できるGame Domainをsource-backed / fail-closedで拡張する。Raw / Formal完全網羅を目標にしない。'), 'AUTONOMOUS North Star drift')
  assert.ok(autonomous.includes('`Raw Game Sources → Game Domain / Canonical → Application / Optimizer`'), 'AUTONOMOUS 3-layer architecture drift')
  assert.ok(autonomous.includes('Unknown / Unclassifiedを数値評価へ渡さない。'), 'AUTONOMOUS fail-closed runtime boundary drift')

  const raw = readJson<RawStructuralManifest>('research/raw/game-data-raw-structural-inventory/manifest.json')
  const identity = readJson<IdentityArtifact>('research/domain/formal/identity-evidence-v1.json')
  const value = readJson<ValueArtifact>('research/domain/formal/value-availability-v2.json')
  const relation = readJson<RelationArtifact>('research/domain/formal/serialized-relation-v2.json')
  const promotion = readJson<PromotionManifest>('research/runtime/runtime-promotion-manifest.json')
  const meleeRuntime = supportSummary('research/runtime/melee-runtime-support.json')
  const armorRuntime = supportSummary('research/runtime/armor-runtime-support.json')
  const artifactRuntime = supportSummary('research/runtime/artifact-runtime-support.json')
  const rangedWeapons = Object.values(RANGED_WEAPONS)
  const rangedEnchantments = Object.values(RANGED_ENCHANTMENTS)
  assert.ok(rangedWeapons.length > 0 && rangedWeapons.every(({ supportLevel }) => supportLevel === 'limited'),
    'Ranged runtime weapon support must remain explicitly Limited')
  assert.ok(rangedEnchantments.length > 0 && rangedEnchantments.every(({ supportLevel }) => supportLevel === 'limited'),
    'Ranged runtime Enchantment support must remain explicitly Limited')
  const rangedWeaponNames = rangedWeapons.map(({ name }) => name.en).join(' / ')
  assert.ok(RANGED_LIMITATIONS.length > 0, 'Ranged runtime limitations must remain explicit')
  const rangedEnchantmentNames = rangedEnchantments.map(({ name }) => name.en).join(' / ')
  const rangedInputBoundary = RANGED_LIMITATIONS[0]!
  const rangedResearchBoundary = RANGED_LIMITATIONS[RANGED_LIMITATIONS.length - 1]!

  const matchedIdentityDomains = new Set(identity.semantic.identities.flatMap(({ resolution }) =>
    resolution.state === 'matched' && resolution.domainId ? [resolution.domainId] : []))
  const valueMelee = Object.keys(value.semantic.melee)
  const valueRanged = Object.keys(value.semantic.ranged)
  const valueArtifact = Object.keys(value.semantic.artifact)
  const valueDomains = new Set([...valueMelee, ...valueRanged, ...valueArtifact])
  const relationDomains = new Set(relation.semantic.relations.map(({ sourceDomainId }) => sourceDomainId))

  assert.equal(identity.identityAssertions.length, matchedIdentityDomains.size, 'Formal Identity assertions and matched domain count diverged')
  assert.equal(raw.summary.seedStatusCounts.exact + raw.summary.seedStatusCounts.provisional + raw.summary.seedStatusCounts.ambiguous + raw.summary.seedStatusCounts['not-found'], raw.summary.seedCount, 'Raw seed status counts drift')
  assert.equal(relation.relationProjections.length, relation.semantic.relations.length, 'Formal Relation semantic/projection count drift')

  const currentUnits = ROADMAP_WORK_UNITS.filter(({ status }) => status === 'current')
  const nextUnits = ROADMAP_WORK_UNITS.filter(({ status }) => status === 'next')
  const blockedUnits = ROADMAP_WORK_UNITS.filter(({ status }) => status === 'blocked')

  const sourcePaths = [
    '`AUTONOMOUS.md`',
    '`src/data/roadmap.ts`',
    '`src/data/ranged.ts`',
    '`research/raw/game-data-raw-structural-inventory/manifest.json`',
    '`research/domain/formal/identity-evidence-v1.json`',
    '`research/domain/formal/value-availability-v2.json`',
    '`research/domain/formal/serialized-relation-v2.json`',
    '`research/runtime/runtime-promotion-manifest.json`',
    '`research/runtime/*-runtime-support.json`',
  ].join(', ')

  return `# MCD Optimizer — Project Status\n\n> Generated by \`npm run generate:project-status\`. This file is a human-readable view of merged repository state, not a source of truth.\n> Canonical inputs: ${sourcePaths}.\n\n## Current Goal\n\nApplicationが信頼して利用できるGame Domainを、source-backed / fail-closedな境界のまま広げることが現在の中心です。RawやFormalの件数最大化そのものを目的にせず、Applicationで比較・説明・推薦に使える意味を優先します。\n\n## Where We Are\n\n### Layer 1 — Raw Game Sources\n\nゲームから観測・抽出した事実を保持する層です。現在のRaw Structural Inventoryは ${formatNumber(raw.summary.seedCount)} catalog seedsから ${formatNumber(raw.summary.candidateSeedCount)} candidate assignmentsを追跡し、${formatNumber(raw.summary.parsedPackageCount)} packagesと ${formatNumber(raw.summary.edgeCount)} serialized reference edgesを再現可能に保持しています。現在のinventory内ではunresolved targetは ${formatNumber(raw.summary.unresolvedTargetCount)} ですが、native boundary ${formatNumber(raw.summary.nativeBoundaryCount)}、parser boundary ${formatNumber(raw.summary.parserBoundaryCount)} は明示的に残っています。\n\nこのため、現在のhorizontal workを支えるRaw foundationは成熟していますが、「ゲーム全体を完全解析済み」という意味ではありません。Rawは観測事実を保持し、意味付けは次のLayerへ渡します。\n\n### Layer 2 — Game Domain / Canonical\n\nRaw factsをApplicationが安全に扱える装備・値・関係の意味へ変換する層で、現在の主戦場です。Formal Identity / Value / Relationはこの層の内部contractであり、互いに別の意味を持つため件数を単純合算しません。\n\n- Formal Identity: ${formatNumber(matchedIdentityDomains.size)} matched domains\n- Formal Value: ${formatNumber(valueDomains.size)} domains（Melee ${formatNumber(valueMelee.length)} / Ranged ${formatNumber(valueRanged.length)} / Artifact ${formatNumber(valueArtifact.length)}）\n- Formal Relation: ${formatNumber(relationDomains.size)} source domains、${formatNumber(relation.semantic.relations.length)} relation records、${formatNumber(relation.relationCollections.length)} collections\n\nこれらは「全装備をFormal化すれば完了」という進捗率ではありません。Applicationに必要なGame Domainを優先し、source evidenceが足りない対象や用途の薄いbreadthは止められる設計です。\n\n### Layer 3 — Application / Optimizer\n\n採用可能なGame Domain / Evidenceだけを使って比較・説明・推薦を行う層です。Layer 2全体の完成を待たず、安全に使える範囲から段階的に接続します。Unknown / Unsupportedを0やneutralへ置き換えません。\n\nRangedはMelee / Armor / Artifactと同型のruntime-support manifestではなく、current structured runtime definitionsで管理しています。${rangedWeaponNames}はLimitedです。入力境界: ${rangedInputBoundary} Ranged Enchantmentは ${rangedEnchantmentNames} のLimited定義だけを評価対象にします。未対応境界: ${rangedResearchBoundary}\n\nMelee / Armor / Artifactのruntime support manifestでは、Melee enchantmentは Full ${meleeRuntime.full} / Limited ${meleeRuntime.limited} / Research-only ${meleeRuntime['research-only']}（population ${meleeRuntime.population}）、Armorは Limited ${armorRuntime.limited} / Research-only ${armorRuntime['research-only']}（population ${armorRuntime.population}）、Artifactは Full ${artifactRuntime.full} / Limited ${artifactRuntime.limited} / Research-only ${artifactRuntime['research-only']}（population ${artifactRuntime.population}）です。Rangedとは母集団と管理形式が異なるため、これらのpopulationへ単純合算しません。runtime promotion pipelineは candidate ${promotion.summary.candidates}、eligible ${promotion.summary.eligible}、promoted ${promotion.summary.promoted} で、採用gateを満たさない値を自動昇格させません。\n\n## Current Focus\n\nArchitecture上はLayer 2のGame Domainを、具体的なApplication payoffへつながる単位で前進させることが中心です。同時にroadmap上のCurrent workは次です。\n\n${currentUnits.length ? currentUnits.map(roadmapBullet).join('\n') : '- Current指定のWork Unitはありません。'}\n\nFormal breadthだけを独立目的にせず、既存DomainのApplication利用、必要なEvidence acquisition、blocker解消を同じcurrent stateから比較して選びます。\n\n## Current Evidence / Domain Snapshot\n\n| Area | Current merged-main snapshot | What it means |\n| --- | --- | --- |\n| Raw structural inventory | ${formatNumber(raw.summary.seedCount)} seeds / ${formatNumber(raw.summary.parsedPackageCount)} parsed packages / ${formatNumber(raw.summary.edgeCount)} edges | horizontal source tracingの基盤。boundaryは保持したまま使う |\n| Formal Identity | ${formatNumber(matchedIdentityDomains.size)} matched domains | Raw identityをcanonical equipment identityへsource-backedに接続できる範囲 |\n| Formal Value | ${formatNumber(valueDomains.size)} domains | configured valueをsource-backedに保持できる範囲。effective behaviorとは別 |\n| Formal Relation | ${formatNumber(relationDomains.size)} source domains / ${formatNumber(relation.semantic.relations.length)} records | serialized relationを追跡できる範囲。relation存在だけではruntime effectを証明しない |\n| Ranged runtime | ${rangedWeaponNames}: Limited observed-input / Enchant ${rangedEnchantmentNames}: Limited | 利用者観測に依存し、Power fallbackなし。特殊projectile・固有効果・未検証interactionはResearch-only |\n| Runtime promotion | ${promotion.summary.candidates} candidate / ${promotion.summary.eligible} eligible / ${promotion.summary.promoted} promoted | Domain/Evidenceからruntimeへ進める対象はgateを通過したものだけ |\n\n## Current Blockers\n\n${blockedUnits.length ? blockedUnits.map(blockerBullet).join('\n') : '- Roadmap上のblocked Work Unitはありません。'}\n\n加えて、runtime promotionでeligibleなtargetは現在 ${promotion.summary.eligible} 件です。これはDomainが存在しないという意味ではなく、採用に必要な独立Evidenceやregression条件を満たしたpromotion対象がまだないことを示します。\n\n## What We Are Intentionally Not Doing\n\n- ${formatNumber(raw.summary.seedCount)} catalog entriesをすべてFormal化することをLayer 2の完了条件にはしません。\n- configured serialized valueだけからeffective gameplay behaviorを推測しません。\n- Unknown / Unsupportedを0、1、neutralとしてOptimizerへ混ぜません。\n- RelationやFormal recordの件数最大化を、Application価値より優先しません。\n- この文書はmerged repository stateだけを表し、作業途中の状態は扱いません。\n\n## Next Horizon\n\nRoadmap上のNextは次です。着手時にはその時点のcanonical stateと依存条件を再評価します。\n\n${nextUnits.length ? nextUnits.map(roadmapBullet).join('\n') : '- Next指定のWork Unitはありません。'}\n\nLayer 2では、既存Formal breadthをApplicationへ安全に接続する価値と、Applicationに必要なDomain gapを埋める価値を比較します。Evidence待ちやsemantic ambiguityがある対象はfail-closedのまま保留します。\n`
}

const first = renderProjectStatus()
const second = renderProjectStatus()
assert.equal(first, second, 'PROJECT_STATUS generation must be byte-deterministic')
assert.doesNotMatch(first, /\b\d+(?:\.\d+)?%\b/, 'PROJECT_STATUS must not contain completion percentages')
assert.doesNotMatch(first, /github\.com\/[^\s)]+\/pull\/|\bDraft\b|CI pending/i, 'PROJECT_STATUS must not contain live PR state')

if (process.argv.includes('--write')) fs.writeFileSync(statusPath, first)
else assert.equal(fs.readFileSync(statusPath, 'utf8'), first, 'PROJECT_STATUS.md drift; run npm run generate:project-status')

console.log('Project status audit passed: deterministic merged-main overview matches current canonical state.')
