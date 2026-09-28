/* eslint-disable @typescript-eslint/no-explicit-any -- This auditor reads several versioned JSON artifacts with different shapes, then validates their runtime contracts against committed hashes and counts. */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inventoryDirectory = 'research/raw/game-data-raw-structural-inventory'
const reportPath = 'docs/remaining_ambiguous_formal_identity_resolution_audit.md'
const baseline = '791cf9305fbc2fcf15737ef793f3cafeaf8c0133'
const rawUnavailableIds = ['sword', 'ender-armor', 'vanguard-armor'] as const

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as T
}

function sha256(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function valueOfName(value: { value?: string } | undefined): string | undefined {
  return value?.value
}

function findUniqueProperty(properties: readonly any[], name: string): any | undefined {
  const matches = properties.filter((property) => valueOfName(property.name) === name && property.arrayIndex === 0)
  assert.equal(matches.length, 1, `Expected one ${name} property; got ${matches.length}`)
  return matches[0]
}

function inline(value: string): string {
  return `\`${value.replaceAll('`', '\\`')}\``
}

const manifest = readJson<any>(`${inventoryDirectory}/manifest.json`)
const formalArtifact = readJson<any>('research/domain/formal/identity-evidence-v1.json')
const sourceHarvest = readJson<any>('research/source-harvest.json')
const aliases = readJson<any>('research/domain/game-data-entity-aliases.json')
const assetIndex = readJson<any>('research/raw/game-data-asset-index.json')
const armorAudit = readJson<any>('research/armor-audit.json')
const meleeAudit = readJson<any>('research/melee-attack-profile-audit.json')
const rangedAudit = readJson<any>('research/ranged-weapon-audit.json')
const equipmentIconSource = fs.readFileSync(path.join(repositoryRoot, 'scripts/equipment-icons.ts'), 'utf8')

assert.equal(manifest.schemaVersion, 1)
assert.equal(manifest.catalogSeeds.length, 271)
assert.equal(formalArtifact.identityAssertions.length, 146)

const formalDomainIds = new Set(formalArtifact.identityAssertions.map((assertion: any) => assertion.domainId))
const ambiguousSeeds = manifest.catalogSeeds
  .filter((seed: any) => ['melee', 'ranged'].includes(seed.category) && seed.status === 'ambiguous' && !formalDomainIds.has(seed.catalogId))
  .sort((left: any, right: any) => left.category.localeCompare(right.category) || left.catalogId.localeCompare(right.catalogId))
const meleeSeeds = ambiguousSeeds.filter((seed: any) => seed.category === 'melee')
const rangedSeeds = ambiguousSeeds.filter((seed: any) => seed.category === 'ranged')
assert.equal(meleeSeeds.length, 38, 'Current Melee ambiguous target set drift')
assert.equal(rangedSeeds.length, 34, 'Current Ranged ambiguous target set drift')
assert.equal(ambiguousSeeds.length, 72, 'Current Melee/Ranged ambiguous target set drift')
assert.ok(!ambiguousSeeds.some((seed: any) => seed.catalogId === 'fireworks-arrow'))

const seedsById = new Map(manifest.catalogSeeds.map((seed: any) => [seed.catalogId, seed]))
const swordSeed = seedsById.get('sword')
const enderArmorSeed = seedsById.get('ender-armor')
const vanguardArmorSeed = seedsById.get('vanguard-armor')
assert.ok(swordSeed && enderArmorSeed && vanguardArmorSeed)
assert.equal(enderArmorSeed.status, 'not-found')
assert.equal(vanguardArmorSeed.status, 'not-found')
assert.deepEqual(enderArmorSeed.candidates, [])
assert.deepEqual(vanguardArmorSeed.candidates, [])
assert.equal(swordSeed.status, 'provisional')
assert.equal(swordSeed.candidates.length, 1)
assert.deepEqual(rawUnavailableIds.map((id) => id), ['sword', 'ender-armor', 'vanguard-armor'])

const wantedPackages = new Set<string>([
  ...ambiguousSeeds.flatMap((seed: any) => seed.candidates.map((candidate: any) => candidate.packagePath)),
  ...swordSeed.candidates.map((candidate: any) => candidate.packagePath),
])
const packages = new Map<string, { pkg: any; shardPath: string; packageIndex: number; cdoInventoryIndex: number; edges: any[] }>()
const edgesBySource = new Map<string, any[]>()
let tableLikePackageCount = 0

for (const shardMeta of manifest.shards) {
  const shardPath = path.join(repositoryRoot, inventoryDirectory, shardMeta.path)
  const compressed = fs.readFileSync(shardPath)
  assert.equal(sha256(compressed), shardMeta.compressedSha256, `${shardMeta.path}: compressed hash drift`)
  const uncompressed = gunzipSync(compressed)
  assert.equal(sha256(uncompressed), shardMeta.uncompressedSha256, `${shardMeta.path}: uncompressed hash drift`)
  const shard = JSON.parse(uncompressed.toString('utf8')) as any
  assert.equal(shard.schemaVersion, 1)
  assert.equal(shard.packages.length, shardMeta.packageCount)
  for (const [packageIndex, pkg] of shard.packages.entries()) {
    if (pkg.payloadCoverage.tableLikePackage) tableLikePackageCount += 1
    if (wantedPackages.has(pkg.path)) {
      const cdoExports = pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
      const inventories = pkg.cdoPropertyInventory
        .map((entry: any, index: number) => ({ entry, index }))
        .filter(({ entry }: any) => entry.exportIndex === cdoExports[0]?.exportIndex)
      packages.set(pkg.path, {
        pkg,
        shardPath: shardMeta.path,
        packageIndex,
        cdoInventoryIndex: inventories[0]?.index ?? -1,
        edges: [],
      })
    }
  }
  for (const edge of shard.edges) {
    if (!wantedPackages.has(edge.sourcePackage)) continue
    const sourceEdges = edgesBySource.get(edge.sourcePackage) ?? []
    sourceEdges.push(edge)
    edgesBySource.set(edge.sourcePackage, sourceEdges)
  }
}

assert.equal(packages.size, wantedPackages.size, 'A candidate package is missing or duplicated in Raw Structural Inventory')
for (const [packagePath, loaded] of packages) loaded.edges = edgesBySource.get(packagePath) ?? []

function observedName(properties: readonly any[], name: string): string {
  const property = findUniqueProperty(properties, name)
  assert.equal(property.type.value, 'NameProperty', `${name}: expected NameProperty`)
  assert.equal(property.decoding.state, 'decoded', `${name}: expected decoded observation`)
  assert.equal(typeof property.decoding.value, 'string', `${name}: expected string observation`)
  return property.decoding.value
}

function inspectCandidate(seed: any, candidate: any) {
  const loaded = packages.get(candidate.packagePath)
  assert.ok(loaded, `${seed.catalogId}: candidate package missing: ${candidate.packagePath}`)
  const { pkg, shardPath, packageIndex, cdoInventoryIndex, edges } = loaded
  assert.equal(candidate.role, 'instance', `${seed.catalogId}: candidate role drift`)
  const cdoExports = pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
  assert.equal(cdoExports.length, 1, `${seed.catalogId}: expected exactly one CDO in ${candidate.packagePath}`)
  assert.notEqual(cdoInventoryIndex, -1, `${seed.catalogId}: CDO property inventory missing`)
  const cdo = cdoExports[0]
  const cdoInventory = pkg.cdoPropertyInventory[cdoInventoryIndex]
  const itemIdName = observedName(cdoInventory.properties, 'ItemIdName')
  const itemId = findUniqueProperty(cdoInventory.properties, 'ItemId')
  assert.equal(itemId.type.value, 'StructProperty')
  assert.equal(itemId.decoding.state, 'decoded')
  const serializedId = observedName(itemId.decoding.properties, 'SerializedId')
  assert.equal(itemIdName, serializedId, `${seed.catalogId}: serialized identity fields conflict`)
  const evidenceIds = candidate.evidence
    .filter((entry: string) => entry.startsWith('serialized-identifier:'))
    .map((entry: string) => entry.slice('serialized-identifier:'.length))
    .sort()
  assert.deepEqual(evidenceIds, [`ItemId.SerializedId=${serializedId}`, `ItemIdName=${itemIdName}`].sort())

  const generatedClass = pkg.exports.find((entry: any) => !entry.isClassDefaultObject && entry.objectName.value === candidate.objectName)
  assert.ok(generatedClass, `${seed.catalogId}: generated class export missing`)
  const superObject = generatedClass.references.super.objectName
  const templateObject = cdo.references.template.objectName
  const inheritance = pkg.inheritanceChains.find((chain: any) => chain.sourceObject === candidate.objectName)
  const inheritanceTargets = inheritance?.hops.map((hop: any) => hop.targetObject ?? hop.targetPackageName ?? hop.targetPackage ?? 'unresolved') ?? []
  const classImports = pkg.imports
    .filter((entry: any) => entry.className.value === 'BlueprintGeneratedClass')
    .map((entry: any) => entry.objectName.value)
  const edgeFields = [...new Set(edges
    .filter((edge: any) => edge.kind.endsWith('-property'))
    .map((edge: any) => edge.sourceOccurrence.propertyPath?.replace(/\[\d+\]/g, '[]'))
    .filter(Boolean))] as string[]
  const typedReferences = edges.filter((edge: any) => edge.kind.endsWith('-property'))
  const referenceTargets = [...new Set(edges.flatMap((edge: any) => [edge.targetPackage, edge.targetPackageName, edge.targetObject])
    .filter((target: unknown): target is string => typeof target === 'string' && /^(?:Dungeons\/|\/Game\/|\/Script\/)/.test(target)))]
  const rawLocator = `${inventoryDirectory}/${shardPath}#/packages/${packageIndex}/cdoPropertyInventory/${cdoInventoryIndex}`
  const categoryAlias = seed.category === 'melee' ? 'melee-weapon' : 'ranged-weapon'
  const aliasId = `${categoryAlias}:${serializedId}`
  const alias = aliases.aliases.find((entry: any) => entry.id === aliasId)
  const aliasState = alias
    ? `${alias.status}/${alias.confidence}; canonicalEntity=${alias.canonicalEntity ?? '—'}; candidates=${alias.candidates.join(',') || '—'}`
    : 'no exact rawIdentity alias row'

  return {
    packagePath: candidate.packagePath,
    role: candidate.role,
    itemIdName,
    serializedId,
    generatedClass: candidate.objectName,
    superObject,
    templateObject,
    inheritanceTargets,
    classImports,
    edgeFields,
    typedReferenceCount: typedReferences.length,
    referenceTargetCount: referenceTargets.length,
    referenceTargets,
    rawLocator,
    aliasId,
    aliasState,
    package: pkg,
  }
}

const overrideBlock = equipmentIconSource.match(/const ENTITY_OVERRIDES:[\s\S]*?=\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
const entityOverrides = new Map([...overrideBlock.matchAll(/^\s*'([^']+)'\s*:\s*'([^']+)'\s*,?\s*$/gm)]
  .map((match) => [match[1]!, match[2]!]))
const sourceByEntity = new Map(sourceHarvest.records.map((record: any) => [`${record.category}:${record.id}`, record]))
const meleeById = new Map(meleeAudit.weapons.map((entry: any) => [entry.weaponId, entry]))
const rangedById = new Map(rangedAudit.entries.map((entry: any) => [entry.id, entry]))
const targetRows = ambiguousSeeds.map((seed: any) => {
  const domainId = `${seed.category === 'melee' ? 'melee-weapon' : 'ranged-weapon'}:${seed.catalogId}`
  const sourceRecord = sourceByEntity.get(domainId)
  assert.ok(sourceRecord, `${domainId}: source-harvest record missing`)
  const identityFact = sourceRecord.known.find((entry: any) => entry.property === 'identity')
  assert.ok(identityFact, `${domainId}: canonical identity source missing`)
  const categoryRecord = seed.category === 'melee' ? meleeById.get(seed.catalogId) : rangedById.get(seed.catalogId)
  assert.ok(categoryRecord, `${domainId}: category audit record missing`)
  const candidates = seed.candidates.map((candidate: any) => inspectCandidate(seed, candidate))
  assert.ok(candidates.length === 2 || candidates.length === 3, `${domainId}: unexpected candidate count`)
  assert.equal(new Set(candidates.map((candidate: any) => candidate.serializedId)).size, candidates.length, `${domainId}: candidate identities collapsed`)
  const overrideKey = `${seed.category}:${seed.catalogId}`
  assert.equal(entityOverrides.has(overrideKey), false, `${domainId}: an ENTITY_OVERRIDES mapping requires separate adjudication`)
  const sourceText = JSON.stringify({ sourceRecord, categoryRecord })
  for (const candidate of candidates) {
    assert.equal(sourceText.includes(candidate.packagePath), false, `${domainId}: canonical source contains an exact Raw package path; review the bridge`)
    assert.equal(sourceText.includes(candidate.serializedId), false, `${domainId}: canonical source contains an exact Raw identity; review the bridge`)
    for (const referenceTarget of candidate.referenceTargets) {
      assert.equal(sourceText.includes(referenceTarget), false, `${domainId}: canonical source contains an exact typed Raw relation target; review the bridge`)
    }
  }
  const sourceLocator = seed.category === 'melee'
    ? `research/melee-attack-profile-audit.json#/weapons[weaponId=${seed.catalogId}]`
    : `research/ranged-weapon-audit.json#/entries[id=${seed.catalogId}]`
  const canonicalLocator = `research/source-harvest.json#/records[category=${sourceRecord.category},id=${seed.catalogId}]/known[property=identity]`
  const sourceIds = identityFact.sourceIds.join(', ') || '—'
  const bridgeFacts = candidates.map((candidate: any) => `${inline(candidate.aliasId)}: ${candidate.aliasState}`).join('<br>')
  const candidateFacts = candidates.map((candidate: any) => {
    const inheritance = candidate.inheritanceTargets.length ? candidate.inheritanceTargets.join(' → ') : 'no serialized super hop'
    const imports = candidate.classImports.join(', ') || 'none'
    return [
      `${inline(candidate.packagePath)} — role=${inline(candidate.role)}; ItemIdName=${inline(candidate.itemIdName)}; SerializedId=${inline(candidate.serializedId)}; CDO=1`,
      `class=${inline(candidate.generatedClass)}; super=${inline(candidate.superObject)}; template=${inline(candidate.templateObject)}; inheritance=${inline(inheritance)}`,
      `BlueprintGeneratedClass imports=${inline(imports)}; typed CDO reference edges=${candidate.typedReferenceCount}; property families=${candidate.edgeFields.map(inline).join(', ') || 'none'}; exact Raw target objects=${candidate.referenceTargetCount}`,
      `Raw locator: ${inline(candidate.rawLocator)}`,
    ].join('<br>')
  }).join('<br><br>')
  const survivorList = candidates.map((candidate: any) => `${candidate.serializedId} @ ${candidate.packagePath}`).map(inline).join('<br>')
  return {
    domainId,
    category: seed.category,
    canonicalName: seed.catalogName,
    candidateCount: candidates.length,
    candidateFacts,
    survivorList,
    bridgeFacts,
    canonicalSource: `${inline(canonicalLocator)}<br>sourceIds=${sourceIds}<br>${inline(sourceLocator)}; canonical record does not assert a Raw ID/package path`,
    conflict: `${candidates.length} equal-rank instance candidates; candidate Raw identities differ. No canonical source conflict or selector was found.`,
    decision: 'true-ambiguity',
    candidates,
    sourceRecord,
  }
})

const candidateOccurrences = targetRows.flatMap((row: any) => row.candidates)
const uniqueCandidatePackages = new Set(candidateOccurrences.map((candidate: any) => candidate.packagePath))
const candidateRoles = candidateOccurrences.reduce((counts: Record<string, number>, candidate: any) => {
  counts[candidate.role] = (counts[candidate.role] ?? 0) + 1
  return counts
}, {})
const aliasStates = new Map<string, number>()
for (const candidate of candidateOccurrences) {
  const key = candidate.aliasState.startsWith('no exact') ? 'missing exact alias' : candidate.aliasState.split(';')[0]!
  aliasStates.set(key, (aliasStates.get(key) ?? 0) + 1)
}
const edgeCounts = [...uniqueCandidatePackages].reduce((counts: Record<string, number>, packagePath) => {
  for (const edge of edgesBySource.get(packagePath) ?? []) {
    counts[edge.kind] = (counts[edge.kind] ?? 0) + 1
  }
  return counts
}, {})
const existingMeleeOverrides = [...entityOverrides.keys()].filter((key) => key.startsWith('melee:'))
const existingRangedOverrides = [...entityOverrides.keys()].filter((key) => key.startsWith('ranged:'))
assert.deepEqual(existingMeleeOverrides.sort(), ['melee:bonehead-hammer', 'melee:sinister-sword'].sort())
assert.deepEqual(existingRangedOverrides, ['ranged:shrieking-crossbow'])
assert.equal(targetRows.filter((row: any) => row.decision === 'true-ambiguity').length, 72)
assert.equal(targetRows.filter((row: any) => row.decision.startsWith('ready-')).length, 0)

const swordSeedCandidate = swordSeed.candidates[0]
const loadedSword = packages.get(swordSeedCandidate.packagePath)
assert.ok(loadedSword)
const swordCdo = loadedSword.pkg.exports.filter((entry: any) => entry.isClassDefaultObject)
assert.equal(swordCdo.length, 1)
const swordCdoProperties = loadedSword.pkg.cdoPropertyInventory
  .find((entry: any) => entry.exportIndex === swordCdo[0].exportIndex).properties
assert.equal(swordCdoProperties.filter((property: any) => valueOfName(property.name) === 'ItemIdName').length, 0)
assert.equal(swordCdoProperties.filter((property: any) => valueOfName(property.name) === 'ItemId').length, 0)
const swordCandidate = {
  packagePath: swordSeedCandidate.packagePath,
  role: swordSeedCandidate.role,
  rawLocator: `${inventoryDirectory}/${loadedSword.shardPath}#/packages/${loadedSword.packageIndex}/cdoPropertyInventory/${loadedSword.cdoInventoryIndex}`,
}
const swordAliasId = 'melee-weapon:Sword_Steel'
const swordAlias = aliases.aliases.find((entry: any) => entry.id === swordAliasId)
assert.ok(swordAlias)
assert.equal(swordAlias.status, 'unresolved')
assert.equal(swordAlias.confidence, 'unknown')

const armorById = new Map(armorAudit.entries.map((entry: any) => [entry.id, entry]))
const enderRecord = armorById.get('ender-armor')
const vanguardRecord = armorById.get('vanguard-armor')
assert.ok(enderRecord && vanguardRecord)
assert.equal(enderRecord.levelId, 'CuriousArmor')
assert.equal(vanguardRecord.levelId, 'DesertArmor')
const enderAssets = assetIndex.assets.filter((asset: any) => /CuriousArmor|EnderArmor/i.test(asset.path))
const vanguardAssets = assetIndex.assets.filter((asset: any) => /DesertArmor/i.test(asset.path))
assert.equal(enderAssets.length, 0, 'A committed Ender Armor package/asset candidate exists')
assert.equal(vanguardAssets.length, 0, 'A committed Vanguard Armor package/asset candidate exists in the asset index')
const vanguardPresentationPath = 'Dungeons/Content/Actors/Characters/Enemies/SkeletonVanguard/T_DesertArmor'
assert.deepEqual(vanguardArmorSeed.presentationHint.candidates, [vanguardPresentationPath])

const unavailableRows = [
  {
    domainId: 'melee-weapon:sword', category: 'melee', canonicalName: 'Sword', rawState: 'candidate package exists; both identity fields are absent from its decoded CDO',
    candidate: `${inline(swordCandidate.packagePath)} — role=${inline(swordCandidate.role)}; CDO=1; ItemIdName=unavailable; ItemId.SerializedId=unavailable; Raw locator=${inline(swordCandidate.rawLocator)}`,
    source: `${inline('research/source-harvest.json#/records[category=melee-weapon,id=sword]/known[property=identity]')}<br>alias ${inline(swordAliasId)} is unresolved/unknown; ${inline("scripts/equipment-icons.ts#INTERNAL_FAMILY_ALIASES['sword']")} is icon-candidate search input only`,
    classification: 'raw-observation-required',
    reason: 'The only committed instance package has no serialized identity fields. Asset index, extractor samples, semantic samples, and history contain no exact serialized identity to restore.',
  },
  {
    domainId: 'armor:ender-armor', category: 'armor', canonicalName: 'Ender Armor', rawState: 'no Raw package candidate; asset index has no CuriousArmor/EnderArmor path',
    candidate: 'none; seed status=not-found; candidates=[]',
    source: `${inline('research/armor-audit.json#/entries[id=ender-armor]')}<br>levelId=${inline('CuriousArmor')}; sourceIds=${(enderRecord.sourceIds ?? []).join(', ')}<br>${inline('research/raw/game-data-raw-structural-inventory/manifest.json#/catalogSeeds[catalogId=ender-armor]')}; ${inline('research/raw/game-data-asset-index.json#/assets')} contains no matching asset`,
    classification: 'raw-observation-required',
    reason: 'The current committed source describes an Arcade-only/unused item but has no exact game Raw package or CDO. The committed full asset index has no candidate.',
  },
  {
    domainId: 'armor:vanguard-armor', category: 'armor', canonicalName: 'Vanguard Armor', rawState: 'asset index has no equipment package; icon search has only an enemy body texture hint',
    candidate: `none; seed status=not-found; candidates=[]; icon-search presentation hint points to ${inline(vanguardPresentationPath)}`,
    source: `${inline('research/armor-audit.json#/entries[id=vanguard-armor]')}<br>levelId=${inline('DesertArmor')}; sourceIds=${(vanguardRecord.sourceIds ?? []).join(', ')}<br>${inline('research/raw/game-data-raw-structural-inventory/manifest.json#/catalogSeeds[catalogId=vanguard-armor]')}; icon-search hint is ${inline(vanguardPresentationPath)}, outside the equipment package/Raw candidate set`,
    classification: 'raw-observation-required',
    reason: 'The only retained presentation hint points to an enemy body texture, not an inventory instance/CDO. Category audit says mob-only; no existing committed package or serialized identity supports Formal population.',
  },
]
assert.equal(unavailableRows.length, 3)

const classificationCounts = {
  'ready-with-existing-independent-source': 0,
  'ready-with-existing-reviewed-bridge-pattern': 0,
  'ready-with-new-explicit-reviewed-bridge': 0,
  'needs-additional-identity-evidence': 0,
  'true-ambiguity': targetRows.length,
  'raw-observation-required': unavailableRows.length,
}
assert.equal(Object.values(classificationCounts).reduce((sum, count) => sum + count, 0), 75)
assert.equal(classificationCounts['true-ambiguity'], 72)
assert.equal(classificationCounts['raw-observation-required'], 3)

const remainingPartition = {
  'Artifact slug-only': 21,
  ambiguous: 73,
  'Melee/Ranged needs-additional-identity-evidence': 28,
  'raw-unavailable': 3,
}
const remainingCount = Object.values(remainingPartition).reduce((sum, count) => sum + count, 0)
assert.equal(remainingCount, 125)
assert.equal(146 + remainingCount, 271)

const rowMarkdown = targetRows.map((row: any) =>
  `| ${inline(row.domainId)}<br>${inline(row.category)} — ${inline(row.canonicalName)} | ${row.candidateFacts} | none; all ${row.candidateCount} remain:<br>${row.survivorList} | ${row.canonicalSource}<br>Candidate alias rows:<br>${row.bridgeFacts}<br>No accepted/high canonical bridge; ENTITY_OVERRIDES has no row for this key. | ${row.conflict}<br>${inline(row.decision)} |`,
).join('\n')
const unavailableMarkdown = unavailableRows.map((row) =>
  `| ${inline(row.domainId)}<br>${inline(row.category)} — ${inline(row.canonicalName)} | ${row.rawState}<br>${row.candidate} | ${row.source} | ${inline(row.classification)}<br>${row.reason} |`,
).join('\n')
const aliasStateSummary = [...aliasStates.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  .map(([state, count]) => `${inline(state)}: ${count} candidate observations`).join('; ')
const report = `# MCD Optimizer — Remaining Ambiguous Formal Identity Resolution Audit

## Scope and baseline

- Verified current main baseline: ${baseline}.
- Formal Identity at baseline: **146 / 271** — Melee 29, Ranged 23, Armor 71, Artifact 23.
- Remaining partition: **125** = Artifact slug-only 21 + ambiguous 73 + Melee/Ranged needs-additional-identity-evidence 28 + raw-unavailable 3.
- Reacquired this audit from current Raw Structural Inventory and Formal Identity: **38 Melee + 34 Ranged = 72 ambiguous identities**. Fireworks Arrow is outside this sweep.
- Raw-unavailable checks: sword, ender-armor, vanguard-armor. No Raw extraction or re-extraction was performed.

## Classification

| Classification | Count | Result |
| --- | ---: | --- |
| ready-with-existing-independent-source | 0 | No independent canonical-to-Raw edge selects an exact candidate. |
| ready-with-existing-reviewed-bridge-pattern | 0 | None of the targets has an accepted/high reviewed canonical alias or an applicable bridge pattern. |
| ready-with-new-explicit-reviewed-bridge | 0 | No new source-backed mapping shape was found. |
| needs-additional-identity-evidence | 0 | All 72 ambiguous targets retain competing current instance candidates, so they classify as true ambiguity in this sweep. |
| true-ambiguity | 72 | Multiple equal-rank Raw instance candidates remain for each canonical identity. |
| raw-observation-required | 3 | Existing committed sources cannot supply the exact missing package plus serialized identity observations. |
| **Total** | **75** | **38 Melee + 34 Ranged + 3 raw-unavailable.** |

Audit reconciliation: 75 / 75 targets; Melee 38 / 38; Ranged 34 / 34; raw-unavailable 3 / 3; classification sum 75; unsupported inference promoted: **0**.

## Source scan and evidence boundary

| Source | Check | Finding |
| --- | --- | --- |
| research/raw/game-data-raw-structural-inventory/manifest.json and candidate shards | Re-read all 72 current seeds and every retained candidate package; verified shard hashes and CDO property records. | 158 target-candidate observations across ${uniqueCandidatePackages.size} exact packages; all roles are instance; each package has exactly one CDO; both decoded NameProperty values match exactly within that candidate, while IDs differ between candidates of the same target. Roles: ${Object.entries(candidateRoles).map(([role, count]) => `${role} ${count}`).join(', ')}. |
| Raw class, super, template, imports, inheritance and typed CDO references | Inspected each unique candidate package's generated class export, serialized super chain, CDO template, BlueprintGeneratedClass imports, and property edges; compared every exact typed Raw target with the independent canonical/category source record. | Typed references include sound/effect/projectile and normal implementation links. They distinguish Raw implementations but no independent canonical source names the exact target package/object or serialized Raw ID; exact Raw target string matches in canonical sources: 0. They do not eliminate any candidate. Unique-package outgoing edge kinds: ${Object.entries(edgeCounts).map(([kind, count]) => `${kind} ${count}`).join(', ')}. |
| Canonical source and category audit | research/source-harvest.json identity record plus the Melee/Ranged category row for every target. | These sources support canonical domain ID/name and category. No row asserts a candidate's exact ItemIdName, ItemId.SerializedId, or Raw package path. Family, variantOf, mechanics, and display name do not bridge identities. |
| Game-data aliases and model alignment | Checked exact category + Raw identity alias rows and the current model-alignment resolver. | ${aliasStateSummary}. Rows with candidate identities are unresolved/unknown and have no canonical entity; missing rows remain missing. Model alignment therefore exposes unresolved/ambiguous candidates rather than a canonical Raw mapping. |
| scripts/equipment-icons.ts | Checked exact ENTITY_OVERRIDES keys for every target and the family/icon candidate logic. | No target has an override. Existing Melee/Ranged overrides are only Bonehead Hammer, Sinister Sword and Shrieking Crossbow, outside this 72-item set. Icon path, family-ordinal selection and internal family aliases are presentation/search hints. |
| Asset index and DataTable metadata | Checked research/raw/game-data-asset-index.json, Structural package references and table-like package metadata. | Asset paths describe source packages and presentation hints. The Structural inventory reaches ${tableLikePackageCount} table-like packages in its full graph; current parser does not decode DataTable row payloads, and no committed row/serialized mapping supplies a canonical-to-Raw edge. |
| Existing committed source and Git history | Reviewed source-harvest, category audits, aliases, icon overrides, model-alignment sources, prior committed identity mappings and relevant history through the baseline. | No independent canonical↔Raw mapping for these 72 targets. The prior sawblade typed-relation mappings remain two explicit mappings only; they do not generalize to sibling variants or family ordinals. |

### Candidate adjudication rule

All ${ambiguousSeeds.length} target seed rows retain ${candidateOccurrences.length} candidate observations, each with role instance. Every candidate has one CDO, a decoded ItemIdName, and a decoded ItemId.SerializedId; those two exact fields agree within the package. Every target still has 2 or 3 distinct serialized Raw identities. No candidate is a helper, effect, projectile, actor, storable, template, or base class in the seed set, so no role-based elimination is justified. Typed effects, projectiles, sound references, class/super/template data and imports were inspected, but no independent canonical source binds one such Raw relation to any of these canonical identities.

No bridge relies on normalization, case folding, suffix removal, basename/name similarity, icon path, uniqueness, variantOf, family, or a serialized-catalog-identifier-match derived from the same normalization.

## 72 ambiguous identities

For each row, Raw locators point to the exact Structural shard, package index, and CDO property inventory. Candidate aliases are listed by exact raw identity. “none; all candidates survive” means source-backed elimination found no candidate that can be excluded. The canonical identity source is independent of the Raw Structural observation, but currently states only the canonical item and does not select an exact Raw identity.

| Domain / category / canonical name | Current candidates, roles, Raw identities, class relations and Raw locators | Candidate elimination and surviving candidates | Canonical bridge evidence, source locator and independence | Conflicting evidence and decision |
| --- | --- | --- | --- | --- |
${rowMarkdown}

## Raw-unavailable identities

| Domain / category / canonical name | Current Raw observation | Canonical/source locator and bridge check | Decision |
| --- | --- | --- | --- |
${unavailableMarkdown}

## Wave selection and conditional implementation

No implementation wave is safe from the committed evidence examined here. The 72 multi-candidate target sets lack a source-backed selector, and the 3 raw-unavailable records lack the exact required observation. Therefore no reviewed bridge, alias, Formal Identity assertion, or generated identity artifact was added. Existing Formal Identity remains 146 / 271 (Melee 29, Ranged 23, Armor 71, Artifact 23).

Wave count: **0**. Population: **none**. Existing Value v2, Relation v2, Raw Structural Inventory and the existing 146 Formal assertions, semantic identities and provenance remain unchanged.

## Final reconciliation

| Partition | Count |
| --- | ---: |
| Formal Identity | 146 |
| Artifact slug-only | 21 |
| Ambiguous (72 Melee/Ranged + Fireworks Arrow) | 73 |
| Melee/Ranged needs-additional-identity-evidence | 28 |
| Raw-unavailable | 3 |
| **Catalog total** | **271** |

The unpopulated remainder is 125 (21 + 73 + 28 + 3). The selected 75-target audit partition is independently complete: 72 true ambiguities + 3 raw-observation-required = 75.

## Reproduction

npm run generate:remaining-formal-identity-resolution
npm run audit:remaining-formal-identity-resolution
npm run audit:game-data-raw-structural-inventory
npm run audit:formal-identity-evidence
`

const serializedReport = `${report.replaceAll('\r\n', '\n').trimEnd()}\n`
const absoluteReportPath = path.join(repositoryRoot, reportPath)
if (process.argv.includes('--write')) {
  fs.writeFileSync(absoluteReportPath, serializedReport)
}
assert.equal(fs.readFileSync(absoluteReportPath, 'utf8'), serializedReport, `Audit report drift; run generate:remaining-formal-identity-resolution`)

console.log(`Remaining Formal Identity audit passed: 75/75 targets (Melee 38/38; Ranged 34/34; raw-unavailable 3/3); classification sum 75; unsupported inference 0; Formal Identity 146/271; remainder 125; catalog reconciliation 271.`)
