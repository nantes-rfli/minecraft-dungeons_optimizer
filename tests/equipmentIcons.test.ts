import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapCatalog, type EquipmentIconManifest } from '../scripts/equipment-icons.ts'

const manifest = JSON.parse(fs.readFileSync(new URL('../generated/equipment-icons/manifest.json', import.meta.url), 'utf8')) as EquipmentIconManifest

const targets = [
  { id: 'buzzy-nest', name: 'Buzzy Nest', sourceAsset: 'Dungeons/Content/Patch2/Actors/Items/Beenest/T_Beenest_Icon_inventory' },
  { id: 'satchel-of-elixirs', name: 'Satchel of Elixirs', sourceAsset: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/T_Satchelofneed_Icon_Inventory' },
  { id: 'satchel-of-snacks', name: 'Satchel of Snacks', sourceAsset: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/T_Satchelofnourishment_Icon_Inventory' },
] as const

describe('Artifact icon override corrections', () => {
  it('keeps each corrected override on the same package and source asset', () => {
    const catalog = targets.map(({ id, name }) => ({
      category: 'artifact' as const,
      id,
      name,
      variant: false,
      eventExclusive: false,
    }))
    const candidates = targets.map(({ sourceAsset }) => {
      const sourcePackage = sourceAsset.slice(0, sourceAsset.lastIndexOf('/'))
      return {
        category: 'artifact' as const,
        sourceAsset,
        sourcePackage,
        absoluteAsset: `/game-data/${sourceAsset}.uasset`,
        entity: sourcePackage.slice(sourcePackage.lastIndexOf('/') + 1),
        entityBase: sourcePackage.slice(sourcePackage.lastIndexOf('/') + 1),
        semanticNames: [],
        eventVariant: false,
      }
    })

    const mapped = mapCatalog(catalog, candidates)
    for (const target of targets) {
      const actual = mapped.find((entry) => entry.catalogId === target.id)
      const baseline = manifest.entries.find((entry) => entry.category === 'artifact' && entry.catalogId === target.id)
      expect(baseline).toMatchObject({ status: 'matched', sourceAsset: target.sourceAsset })
      expect(actual).toMatchObject({
        category: 'artifact',
        catalogId: target.id,
        status: 'matched',
        sourceAsset: baseline!.sourceAsset,
        sourcePackage: baseline!.sourcePackage,
        matchMethod: 'documented-entity-alias',
      })
    }
  })
})
