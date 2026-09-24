import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import {
  HORIZONTAL_FACT_INVENTORY_PATH,
  compressHorizontalRawFactInventory,
  generateHorizontalRawFactInventory,
  isRelevantProperty,
  loadStructuralGraph,
  serializeHorizontalRawFactInventory,
  validateHorizontalRawFactInventory,
  type JsonRecord,
  type HorizontalRawFactInventory,
} from './game-data-horizontal-fact-inventory.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const artifactPath = path.join(repositoryRoot, HORIZONTAL_FACT_INVENTORY_PATH)
const committedBytes = fs.readFileSync(artifactPath)
const graph = loadStructuralGraph(repositoryRoot)
const artifact = generateHorizontalRawFactInventory(repositoryRoot, graph)
const artifactText = serializeHorizontalRawFactInventory(artifact)
const errors = validateHorizontalRawFactInventory(artifact, graph, repositoryRoot)
const committedText = gunzipSync(committedBytes).toString('utf8')
if (committedText !== artifactText) errors.push('Deterministic generation differs from the committed Horizontal Raw Fact Inventory artifact')
if (!committedBytes.equals(compressHorizontalRawFactInventory(artifact))) errors.push(`${HORIZONTAL_FACT_INVENTORY_PATH} compressed bytes are not deterministic`)
if (committedText !== serializeHorizontalRawFactInventory(JSON.parse(committedText) as HorizontalRawFactInventory)) errors.push(`${HORIZONTAL_FACT_INVENTORY_PATH} does not contain canonical JSON`)
errors.push(...auditRepresentativeRawObservations(artifact, graph, repositoryRoot))

const representativeNames = ["Fighter's Bindings", 'Scatter Crossbow', 'Battle Robe', 'Death Cap Mushroom']

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Horizontal Raw Fact Inventory audit passed: ${artifact.summary.catalogItemCount} catalog items; ${artifact.summary.candidateAssignmentCount} candidate assignments.`)
console.log(`Coverage: ${Object.entries(artifact.categoryCounts).map(([category, count]) => `${category} ${count}`).join(', ')}.`)
console.log(`Artifact base cooldown partition preserved: ${artifact.summary.artifactBaseCooldownPartition.staticKnown}/${artifact.summary.artifactBaseCooldownPartition.staticRelationTraversal}/${artifact.summary.artifactBaseCooldownPartition.parserBoundary}/${artifact.summary.artifactBaseCooldownPartition.notObserved}.`)
console.log(`Representative Raw evidence passed: ${representativeNames.join(', ')}.`)

function stableJson(value: unknown): string {
  if (value === undefined) return '"<undefined>"'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function rawPackageOccurrences(snapshot: JsonRecord): JsonRecord[] {
  const occurrences: JsonRecord[] = []
  const cdos = snapshot.package.objects.filter((object: JsonRecord) => object.isClassDefaultObject)
  for (const [cdoIndex, cdo] of cdos.entries()) {
    const walk = (properties: JsonRecord[]): void => {
      for (const property of properties ?? []) {
        if (isRelevantProperty(property)) {
          occurrences.push({
            factKind: 'property-occurrence',
            cdoIndex,
            sourceObject: cdo.objectName?.value,
            propertyName: property.name?.value ?? '',
            propertyType: property.type?.value ?? property.metadata?.innerTypeReference?.value ?? 'unknown',
            propertyPath: property.path ?? property.name?.value ?? '',
            sourceOrder: property.order,
            arrayIndex: property.arrayIndex,
            decodingState: property.decoding?.state,
            hasValue: Object.prototype.hasOwnProperty.call(property.decoding ?? {}, 'value'),
            ...(Object.prototype.hasOwnProperty.call(property.decoding ?? {}, 'value') ? { value: property.decoding.value } : {}),
            decodedValueType: property.decoding?.properties ? 'structured-properties' : property.decoding?.elements ? 'ordered-array' : Object.prototype.hasOwnProperty.call(property.decoding ?? {}, 'value') ? undefined : 'value-not-decoded',
          })
        }
        const decoding = property.decoding ?? {}
        walk(decoding.properties ?? [])
        for (const element of decoding.elements ?? []) {
          if (isRelevantProperty(property)) {
            occurrences.push({
              factKind: 'array-element-occurrence',
              cdoIndex,
              sourceObject: cdo.objectName?.value,
              propertyName: property.name?.value ?? '',
              propertyType: property.metadata?.innerTypeReference?.value ?? property.type?.value ?? 'unknown',
              propertyPath: `${property.path ?? property.name?.value}[${element.index}]`,
              sourceOrder: property.order,
              arrayIndex: property.arrayIndex,
              elementIndex: element.index,
              decodingState: element.decoding?.state,
              hasValue: Object.prototype.hasOwnProperty.call(element.decoding ?? {}, 'value'),
              ...(Object.prototype.hasOwnProperty.call(element.decoding ?? {}, 'value') ? { value: element.decoding.value } : {}),
              decodedValueType: element.decoding?.properties ? 'structured-properties' : element.decoding?.elements ? 'ordered-array' : Object.prototype.hasOwnProperty.call(element.decoding ?? {}, 'value') ? undefined : 'value-not-decoded',
            })
          }
          walk(element.properties ?? [])
        }
      }
    }
    walk(cdo.properties ?? [])
  }
  return occurrences
}

function horizontalPackageOccurrences(horizontal: HorizontalRawFactInventory, candidate: JsonRecord): JsonRecord[] {
  return horizontal.sourceFacts.filter((fact: JsonRecord) => fact.source.sourcePackage === candidate.packagePath).map((fact: JsonRecord) => ({
    factKind: fact.factKind,
    cdoIndex: Number(fact.source.propertyPointer.match(/\/cdoPropertyInventory\/(\d+)/)?.[1] ?? 0),
    sourceObject: fact.source.sourceObject,
    propertyName: fact.propertyName,
    propertyType: fact.propertyType,
    propertyPath: fact.propertyPath,
    sourceOrder: fact.occurrence.sourceOrder,
    arrayIndex: fact.occurrence.arrayIndex,
    ...(fact.occurrence.elementIndex === undefined ? {} : { elementIndex: fact.occurrence.elementIndex }),
    decodingState: fact.decodingState,
    hasValue: Object.prototype.hasOwnProperty.call(fact, 'decodedValue'),
    ...(Object.prototype.hasOwnProperty.call(fact, 'decodedValue') ? { value: fact.decodedValue } : {}),
    decodedValueType: fact.decodedValueType,
  }))
}

function auditRepresentativeRawObservations(
  horizontal: HorizontalRawFactInventory,
  structuralGraph: ReturnType<typeof loadStructuralGraph>,
  root: string,
): string[] {
  const errors: string[] = []
  const expected = [
    { displayName: "Fighter's Bindings", packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance', fields: /^ConfiguredAttackVariants(?:\[|$)/i },
    { displayName: 'Scatter Crossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance', fields: /^AttackDef(?:inition|intion)(?:\.|$)/i },
    { displayName: 'Battle Robe', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance', fields: /GearActor|Damage|AttackSpeed|Cooldown|Effect|Enchantment/i },
    { displayName: 'Death Cap Mushroom', packagePath: 'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance', fields: /Effect|ActivationAnimation|Damage|Heal|Duration|Range|Interval|Tick/i },
  ]
  for (const representative of expected) {
    const item = horizontal.items.find((candidate) => candidate.displayName === representative.displayName)
    const candidate = item?.rawCandidate.candidates.find((entry: JsonRecord) => entry.packagePath === representative.packagePath)
    if (!candidate) {
      errors.push(`Representative Raw candidate is missing: ${representative.displayName}`)
      continue
    }
    const structuralPackage = structuralGraph.packagesByPath.get(representative.packagePath)
    if (!structuralPackage) {
      errors.push(`Representative Structural Inventory package is missing: ${representative.displayName}`)
      continue
    }
    const rawPath = path.join(root, 'research/raw/packages', `${representative.packagePath}.raw.json`)
    if (!fs.existsSync(rawPath)) {
      errors.push(`Representative Raw package observation is missing: ${representative.displayName}`)
      continue
    }
    const snapshot = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
    if (snapshot.dataset?.id !== structuralGraph.manifest.scope.dataset.id) errors.push(`Representative Raw dataset identity differs: ${representative.displayName}`)
    if (snapshot.logicalPackage?.contentHash?.value !== structuralPackage.packageHash?.value) errors.push(`Representative Raw package hash differs: ${representative.displayName}`)
    const rawOccurrences = rawPackageOccurrences(snapshot)
    const horizontalOccurrences = horizontalPackageOccurrences(horizontal, candidate)
    const orderedRawOccurrences = rawOccurrences.filter((entry) => representative.fields.test(entry.propertyPath))
    const orderedHorizontalOccurrences = horizontalOccurrences.filter((entry) => representative.fields.test(entry.propertyPath))
    const canonicalRawOccurrences = orderedRawOccurrences.map(stableJson).sort()
    const canonicalHorizontalOccurrences = orderedHorizontalOccurrences.map(stableJson).sort()
    if (stableJson(canonicalRawOccurrences) !== stableJson(canonicalHorizontalOccurrences)) {
      const occurrenceKey = (entry: JsonRecord) => `${entry.cdoIndex}:${entry.sourceObject}:${entry.factKind}:${entry.propertyPath}:${entry.sourceOrder}:${entry.arrayIndex}:${entry.elementIndex ?? ''}`
      const rawKeys = new Set(orderedRawOccurrences.map(occurrenceKey))
      const horizontalKeys = new Set(orderedHorizontalOccurrences.map(occurrenceKey))
      const missing = [...rawKeys].filter((key) => !horizontalKeys.has(key)).slice(0, 4)
      const extra = [...horizontalKeys].filter((key) => !rawKeys.has(key)).slice(0, 4)
      errors.push(`Representative Raw observations conflict for ${representative.displayName}: rawCount=${orderedRawOccurrences.length} horizontalCount=${orderedHorizontalOccurrences.length} missing=${missing.join('|')} extra=${extra.join('|')}`)
    }
  }
  return errors
}
