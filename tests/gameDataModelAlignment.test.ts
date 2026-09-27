import { describe, expect, it } from 'vitest'
import { resolveAlignedGameDataEntity, type ResearchEntityIdentity } from '../src/research/gameDataEntityResolver'
import { auditCanonicalProperties, CANONICAL_GAME_DATA_PROPERTIES } from '../src/research/gameDataCanonicalProperties'
import { REVIEWED_ARTIFACT_ALIAS_BRIDGES, loadAlignmentInputs, buildModelAlignment, auditModelAlignment, alignmentOutputs, recommendDeepResearch } from '../scripts/game-data-model-alignment'

const input = loadAlignmentInputs(process.cwd())
const result = buildModelAlignment(input)
const catalog: ResearchEntityIdentity[] = ['ranged-weapon:scatter-crossbow','melee-weapon:double-axe','artifact:death-cap-mushroom','ranged-enchantment:rapid-fire','armor-enchantment:cool-down'].map(entity=>({entity,sourceIds:['catalog-identity-fixture']}))

describe('Phase 6.6 identity boundaries', () => {
  it('generates exactly the reviewed Artifact alias bridges from research-owned mappings', () => {
    expect(REVIEWED_ARTIFACT_ALIAS_BRIDGES.map(({ domainId, rawIdentity }) => [domainId, rawIdentity])).toEqual([
      ['blast-fungus', 'NetherWartSporeGrenade'],
      ['corrupted-pumpkin', 'CorruptedBeacon_Spooky1'],
      ['enchanted-grass', 'RainbowGrass'],
      ['eye-of-the-guardian', 'GuardianEye'],
      ['harpoon-quiver', 'HeavyHarpoonQuiver'],
      ['powershaker', 'MobMasher'],
      ['satchel-of-elements', 'SatchelOfTheElements'],
      ['scatter-mines', 'ChargedRedstoneMines'],
      ['shadow-shifter', 'ShadowSplinter'],
      ['spinblade', 'SpinWheel'],
      ['totem-of-casting', 'SoulTotemOfCasting'],
      ['vexing-chant', 'LostEvocation'],
      ['buzzy-nest', 'BeeNest'],
      ['satchel-of-elixirs', 'SatchelOfNeed'],
      ['satchel-of-snacks', 'SatchelOfNourishment'],
    ])
    const aliases = JSON.parse(alignmentOutputs(result)['research/domain/game-data-entity-aliases.json']!).aliases as Array<{
      id: string
      rawIdentity: string
      category: string
      canonicalEntity: string | null
      status: string
      confidence: string
      basis: string
      candidates: string[]
      assetPaths: string[]
      evidenceIds: string[]
    }>
    const generatedBridges = aliases.filter(({ id }) => REVIEWED_ARTIFACT_ALIAS_BRIDGES.some(({ rawIdentity }) => id === `artifact:${rawIdentity}`))
    expect(generatedBridges).toHaveLength(15)
    expect(generatedBridges.every(({ status, confidence }) => status === 'accepted' && confidence === 'high')).toBe(true)
    expect(generatedBridges.map(({ canonicalEntity }) => canonicalEntity).sort()).toEqual(
      REVIEWED_ARTIFACT_ALIAS_BRIDGES.map(({ domainId }) => `artifact:${domainId}`).sort(),
    )
    for (const mapping of REVIEWED_ARTIFACT_ALIAS_BRIDGES.filter(({ domainId }) => ['buzzy-nest', 'satchel-of-elixirs', 'satchel-of-snacks'].includes(domainId))) {
      const canonicalEntity = `artifact:${mapping.domainId}`
      const matches = aliases.filter(({ id }) => id === `artifact:${mapping.rawIdentity}`)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        rawIdentity: mapping.rawIdentity,
        category: 'artifact',
        status: 'accepted',
        confidence: 'high',
        canonicalEntity,
        candidates: [canonicalEntity],
        basis: 'serialized-item-id + documented-entity-alias + catalog-category-evidence',
        assetPaths: expect.arrayContaining([mapping.packagePath]),
        evidenceIds: expect.arrayContaining(['artifact:dt-artifacts-117']),
      })
    }
  })

  it.each([
    ['ranged-weapon','ScatterCrossbow','ranged-weapon:scatter-crossbow'],
    ['melee-weapon','DoubleAxe','melee-weapon:double-axe'],
    ['artifact','DeathCapMushroom','artifact:death-cap-mushroom'],
    ['enchantment','RapidFire','ranged-enchantment:rapid-fire'],
  ] as const)('resolves %s %s with catalog evidence', (category,serializedItemId,entity)=>{
    expect(resolveAlignedGameDataEntity({category,serializedItemId,catalog})).toMatchObject({status:'accepted',canonicalEntity:entity})
  })
  it('rejects intrinsic component/enchantment identity conflation',()=>{
    expect(resolveAlignedGameDataEntity({category:'armor-property',assetIndexEntity:'ItemCooldownDecrease',catalog}).status).toBe('unresolved')
    expect(result.aliases.find(a=>a.id==='armor-property:ItemCooldownDecrease')?.canonicalEntity).toBe('armor-property:item-cooldown-decrease')
    expect(result.rejectedAliases[0]?.proposedEntity).toBe('armor-enchantment:cool-down')
  })
  it.each(['ScatterCrossbow_Unique1','ScatterCrossbow_Spooky1','ScatterCrossbow_Year1','ScatterCrossbow_Winter1'])('preserves %s over base fallback',serializedItemId=>{
    expect(resolveAlignedGameDataEntity({category:'ranged-weapon',serializedItemId,assetIndexEntity:'ScatterCrossbow',catalog}).status).toBe('unresolved')
  })
  it('keeps multi-category enchantments ambiguous and does not guess applicability',()=>{
    const catalog = ['melee-enchantment:gravity','ranged-enchantment:gravity'].map(entity=>({entity,sourceIds:['applicability-evidence']}))
    expect(resolveAlignedGameDataEntity({category:'enchantment',assetIndexEntity:'Gravity',catalog}).status).toBe('tentative')
  })
  it('reviews every historically unresolved retained fact',()=>{
    expect(result.summary.entity.beforeUnresolved).toBe(633)
    expect(result.summary.entity.resolvedIn66+result.summary.entity.stillUnresolved).toBe(633)
  })
})

describe('Canonical properties and approval gates',()=>{
  it('maps only exact configured fields, preserving all raw values and indices',()=>{
    for (const [raw,id] of [['NumberOfProjectiles','ranged.projectileCount'],['AngleSpan','ranged.angleSpanDegrees'],['AttackRateSeconds','ranged.configuredAttackIntervalSeconds'],['Effect','artifact.gameplayEffectClass']]) {
      const mappings=result.canonicalMappings.filter(m=>m.status==='accepted' && m.raw.propertyPath.endsWith(raw!) && m.canonical?.propertyId===id)
      expect(mappings.length).toBeGreaterThan(0)
      for (const m of mappings) expect(m.canonical?.value).toEqual(m.raw.value)
    }
  })
  it('preserves the signed configured angle without taking an absolute value',()=>{
    const angle=result.canonicalMappings.find(m=>m.canonicalEntity==='ranged-weapon:dual-crossbows' && m.raw.propertyPath.endsWith('.AngleSpan'))!
    expect(angle.status).toBe('accepted')
    expect(angle.canonical?.value).toBe(-4)
    expect(result.reconciliation.resolutions.find(r=>r.gapId==='ranged-weapon:dual-crossbows:spread')?.status).toBe('partial')
  })
  it('retains multiple animation variants separately',()=>{
    const animation=result.canonicalMappings.filter(m=>m.canonical?.propertyId==='melee.attackAnimationDurationSeconds')
    const multi=animation.find(m=>animation.some(n=>n.raw.assetPath===m.raw.assetPath && n.variantIndex!==m.variantIndex))!
    expect(multi).toBeDefined()
    const variants=animation.filter(m=>m.raw.assetPath===multi.raw.assetPath)
    expect(new Set(variants.map(m=>m.variantIndex)).size).toBe(variants.length)
  })
  it('retains reference objects without invented magnitude or target path',()=>{
    const refs=result.canonicalMappings.filter(m=>m.structuralReference)
    expect(refs.length).toBeGreaterThan(0)
    for(const m of refs){expect(m.canonical?.value).toEqual(m.raw.value);expect(m.structuralReference?.targetAssetPath).toBeNull()}
  })
  it.each(['Damage','damage','PropertyColorPrio.Prio'])('does not normalize %s into runtime magnitude',property=>{
    const mappings=result.canonicalMappings.filter(m=>m.raw.propertyPath.split('.').at(-1)===property || m.raw.propertyPath===property)
    expect(mappings.length).toBeGreaterThan(0)
    expect(mappings.every(m=>m.canonical===null)).toBe(true)
  })
  it('rejects alias collision, missing semantics, invalid kinds and unsupported lineage',()=>{
    const base=CANONICAL_GAME_DATA_PROPERTIES[0]!
    expect(auditCanonicalProperties([base,{...base,id:'ranged.other'}])).toContain('ranged-weapon:NumberOfProjectiles: alias collision')
    expect(auditCanonicalProperties([{...base,semanticMeaning:'',change:'deprecated',lineage:[]}])).toHaveLength(2)
  })
  it('a mismatched raw type cannot close a count Gap',()=>{
    const changed=structuredClone(input)
    const source=result.canonicalMappings.find(m=>m.canonical?.propertyId==='ranged.projectileCount')!.sourceRecordId
    const record=changed.bulk.records.find(r=>r.id===source)!
    const index=changed.bulk.records.indexOf(record)
    // Replace input, not the output, to exercise type validation independently of artifact drift.
    changed.bulk={...changed.bulk,records:changed.bulk.records.map((r,i)=>i===index?{...r,extraction:{...r.extraction!,propertyType:'FloatProperty'}}:r)}
    expect(buildModelAlignment(changed).canonicalMappings.find(m=>m.sourceRecordId===source)?.canonical).toBeNull()
  })
})

describe('Aligned reconciliation, handoff and audit',()=>{
  it('retains baseline closures and partitions every Gap',()=>{
    expect(result.reconciliation.closedGapIds).toEqual(input.reconciliation.closedGapIds)
    expect(result.dispositionRecords).toHaveLength(2105)
    expect(result.families.flatMap(f=>f.gapIds)).toHaveLength(2105)
    expect(result.missingReview.flatMap(f=>f.gapIds)).toHaveLength(349)
    expect(auditModelAlignment(input,result)).toEqual([])
  })
  it('keeps timing Measure protocols with raw evidence attached',()=>{
    const timing=result.handoff.filter(h=>h.property==='shotsPerSecond' && h.directGameDataEvidenceIds.length)
    expect(timing.length).toBeGreaterThan(0)
    for(const h of timing){expect(h.resolutionClass).toBe('measure');expect(result.reconciliation.closedGapIds).not.toContain(h.gapId)}
  })
  it('contains no closed, version/conflict, implementation or objective handoff',()=>{
    for(const h of result.handoff){
      const gap=input.gaps.find(g=>g.gapId===h.gapId)!
      expect(['version-unknown','conflicting-public-sources']).not.toContain(gap.gapCause)
      expect(['observe','measure','experiment']).toContain(gap.resolutionClass)
      expect(result.reconciliation.closedGapIds).not.toContain(h.gapId)
    }
  })
  it('requires property-specific evidence for a high-potential recommendation',()=>{
    expect(recommendDeepResearch([{level:'high',evidenceIds:['retained-property'],propertySpecificBlocker:'Exact referenced property has a documented parser failure'}]).status).toBe('recommended')
    expect(recommendDeepResearch([{level:'high',evidenceIds:[]}]).status).toBe('not-recommended')
    expect(result.summary.recommendation.nextPhase).toBe('Phase 7')
  })
  it('rejects forged canonical values and missing handoff records',()=>{
    const mutated=structuredClone(result)
    const mapping=mutated.canonicalMappings.find(m=>m.canonical)!
    mapping.canonical!.value=999
    mutated.handoff.pop()
    expect(auditModelAlignment(input,mutated).some(e=>e.includes('configured value transformed'))).toBe(true)
    expect(auditModelAlignment(input,mutated)).toContain('Model alignment differs from deterministic approved decisions')
  }, 15000)
  it('generates identical artifacts twice without timestamps',()=>{
    expect(alignmentOutputs(buildModelAlignment(input))).toEqual(alignmentOutputs(result))
  })
})
