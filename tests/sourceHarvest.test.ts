import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { buildSourceHarvest, collectSourceHarvestErrors, HARVEST_CATEGORIES } from '../src/research/sourceHarvest'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'

describe('Phase 4 Source Harvest', () => {
  const harvest = buildSourceHarvest()

  it('covers every reconciled major-category population with traceable provenance', () => {
    expect(collectSourceHarvestErrors(harvest)).toEqual([])
    expect(harvest.coverage.map((item) => [item.category, item.population])).toEqual([
      ['melee-weapon', 82], ['melee-enchantment', 33], ['armor', 73], ['armor-enchantment', 41], ['ranged-weapon', 71], ['ranged-enchantment', 41], ['artifact', 45],
    ])
    expect(new Set(harvest.records.map((record) => record.category))).toEqual(new Set(HARVEST_CATEGORIES))
    expect(harvest.records.every((record) => record.sourceIds.length > 0)).toBe(true)
    expect(harvest.sources.every((source) => source.gameVersion.length > 0 && source.versionStatus.length > 0)).toBe(true)
    expect(harvest.sources.some((source) => source.versionStatus === 'historical')).toBe(true)
    expect(harvest.sources.some((source) => source.versionStatus === 'unknown')).toBe(true)
  })

  it('keeps Unknown, conflicts and runtime support separate from accepted facts', () => {
    expect(harvest.methodology.runtimePromotionAllowed).toBe(false)
    expect(harvest.methodology.unknownValuePolicy).toBe('preserve-unknown-never-zero-fill')
    expect(harvest.records.some((record) => record.unknown.length > 0)).toBe(true)
    expect(harvest.records.some((record) => record.conflicts.length > 0)).toBe(true)
    expect(harvest.gaps.every((gap) => gap.currentKnownState !== 'unknown' || gap.notes.length > 0)).toBe(true)
  })

  it('reports property coverage independently from runtime coverage', () => {
    const ranged = harvest.coverage.find((item) => item.category === 'ranged-weapon')!
    expect(ranged.properties.find((item) => item.property === 'identity')).toMatchObject({ known: 71, population: 71 })
    expect(ranged.properties.find((item) => item.property === 'projectileCount')!.known).toBeLessThan(71)
    expect(harvest.records.find((item) => item.category === 'ranged-weapon' && item.id === 'bow')!.runtimeSupport).toBe('limited')
  })

  it('exposes harvest provenance and conflicts in the Data Browser', () => {
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/enchantments' }))
    for (const label of ['Known', 'Unknown / Blockers', 'Sources', 'Version', 'Conflict', 'stale risk']) expect(html).toContain(label)
    expect(html).toContain('preferred-source-retained')
    expect(html).toContain('Minecraft Dungeons 1.17.0.0 Patch Notes')
  })
})
