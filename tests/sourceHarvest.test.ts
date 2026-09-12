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
    expect(harvest.sources.some((source) => source.sourceType === 'project-internal')).toBe(true)
    expect(harvest.sources.some((source) => source.sourceType === 'unknown')).toBe(true)
    expect(harvest.extraction).toMatchObject({ sourceCount: 386, attemptCount: 386, unavailableCount: 3 })
  })

  it('keeps Unknown, conflicts and runtime support separate from accepted facts', () => {
    expect(harvest.methodology.runtimePromotionAllowed).toBe(false)
    expect(harvest.methodology.unknownValuePolicy).toBe('preserve-unknown-never-zero-fill')
    expect(harvest.records.some((record) => record.unknown.length > 0)).toBe(true)
    expect(harvest.records.some((record) => record.conflicts.length > 0)).toBe(true)
    expect(harvest.gaps.every((gap) => gap.currentKnownState !== 'unknown' || gap.notes.length > 0)).toBe(true)
    expect(harvest.gaps.every((gap) => gap.sourceAttempts.length > 0 && gap.sourceAttempts.every((attempt) => attempt.result.length > 0))).toBe(true)
    expect(harvest.records.flatMap((record) => record.known).every((fact) => fact.targetGameVersion === '1.17.0.0' && fact.versionStatus.length > 0)).toBe(true)
    expect(harvest.records.flatMap((record) => record.known).filter((fact) => fact.versionStatus === 'unknown').every((fact) => fact.applicableGameVersion === undefined)).toBe(true)
    for (const record of harvest.records.filter((item) => item.category === 'ranged-enchantment')) {
      for (const conflict of record.conflicts) expect(conflict.values.map((value) => value.sourceId)).toEqual([
        'ranged-enchantment:primary-enchantments',
        'ranged-enchantment:secondary-enchantments',
      ])
    }
  })

  it('reports property coverage independently from runtime coverage', () => {
    const ranged = harvest.coverage.find((item) => item.category === 'ranged-weapon')!
    expect(ranged.properties.find((item) => item.property === 'identity')).toMatchObject({ known: 71, population: 71 })
    expect(ranged.properties.find((item) => item.property === 'projectileCount')).toMatchObject({ known: 12, population: 71 })
    expect(harvest.coverage.find((item) => item.category === 'armor-enchantment')!.properties.find((item) => item.property === 'trigger')).toMatchObject({ known: 41, population: 41 })
    expect(harvest.coverage.find((item) => item.category === 'ranged-enchantment')!.properties.find((item) => item.property === 'tiers')).toMatchObject({ known: 41, population: 41 })
    expect(harvest.comparison).toMatchObject({ before: { totalGaps: 2449 }, after: { totalGaps: 2105 } })
    expect(harvest.records.find((item) => item.category === 'ranged-weapon' && item.id === 'bow')!.runtimeSupport).toBe('limited')
  })

  it('exposes harvest provenance and conflicts in the Data Browser', () => {
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/enchantments' }))
    for (const label of ['確認できているデータ', '確認中の項目', '確認先', 'ゲームバージョン', '情報の競合', '古い可能性', 'claimed-current']) expect(html).toContain(label)
    expect(html).toContain('preferred-source-retained')
    expect(html).toContain('Minecraft Dungeons 1.17.0.0 Patch Notes')
  })
})
