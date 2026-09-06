import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectArtifactErrors, scanGameData, serializeJson } from '../scripts/game-data-inventory'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-data-inventory-'))
  temporaryRoots.push(root)
  const files: Record<string, string> = {
    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uasset': 'header',
    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.uexp': 'export',
    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance.ubulk': 'bulk',
    'Dungeons/Content/DataTables/DT_Weapons.uasset': 'table',
    'Dungeons/Content/Maps/TestMap.umap': 'map header',
    'Dungeons/Content/Maps/TestMap.uexp': 'map export',
    'Dungeons/Content/Maps/BulkMap.umap': 'bulk map header',
    'Dungeons/Content/Maps/BulkMap.uexp': 'bulk map export',
    'Dungeons/Content/Maps/BulkMap.ubulk': 'bulk map payload',
    'Engine/Content/Editor/BP_EditorOnly.uasset': 'engine',
    'Engine/Content/Editor/Orphan.uexp': 'orphan',
    'Engine/Content/Editor/OrphanBulk.ubulk': 'orphan bulk',
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  return root
}

describe('Phase 6.5A game data inventory', () => {
  it('groups companions and indexes mechanics candidates without reading binary content', () => {
    const result = scanGameData(fixture())
    const scatter = result.index.assets.find((asset) => asset.entity === 'ScatterCrossbow')
    const testMap = result.files.find((file) => file.relativePath.endsWith('/TestMap.umap'))

    expect(result.inventory.totals.files).toBe(12)
    expect(result.inventory.methodology.binaryContentParsed).toBe(false)
    expect(result.inventory.companions.uassetWithUexpAndUbulk).toBe(1)
    expect(result.inventory.companions.umapPackages).toBe(2)
    expect(result.inventory.companions.umapWithUexp).toBe(2)
    expect(result.inventory.companions.umapWithUexpAndUbulk).toBe(1)
    expect(result.inventory.companions.umapWithoutUexp).toBe(0)
    expect(result.inventory.companions.uexpWithoutPackageHeader).toBe(1)
    expect(result.inventory.companions.ubulkWithoutPackageHeader).toBe(1)
    expect(testMap?.companionPaths).toEqual(['Dungeons/Content/Maps/TestMap.uexp'])
    expect(scatter?.files).toHaveLength(3)
    expect(scatter?.category).toBe('ranged-weapon')
    expect(collectArtifactErrors(result.inventory, result.index)).toEqual([])
  })

  it('is deterministic and contains no source absolute path', () => {
    const root = fixture()
    const first = scanGameData(root)
    const second = scanGameData(root)

    expect(serializeJson(first.inventory)).toBe(serializeJson(second.inventory))
    expect(serializeJson(first.index)).toBe(serializeJson(second.index))
    expect(serializeJson(first.inventory)).not.toContain(root)
  })

  it('reports multiple package headers for the same directory and stem', () => {
    const root = fixture()
    fs.writeFileSync(path.join(root, 'Dungeons/Content/Maps/TestMap.uasset'), 'unexpected second header')
    const result = scanGameData(root)

    expect(result.inventory.companions.packagesWithMultipleHeaders).toBe(1)
    expect(collectArtifactErrors(result.inventory, result.index)).toContain('Unexpected package structure: 1 logical packages have both .uasset and .umap headers')
  })
})
