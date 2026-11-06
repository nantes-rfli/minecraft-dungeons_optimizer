import { expect, test } from '@playwright/test'
import type { Inventory } from '../src/core/types'
import { readinessMelee, readinessRanged } from '../tests/inventoryReadinessFixtures'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'

for (const id of ['bow', 'shortbow', 'longbow', 'power-bow']) {
  test(`${id} requires its own mode observations without modifying saved data before Apply`, async ({ page }) => {
    const item = readinessRanged(id)
    const ranged = { ...item, enchantmentSlots: [{ candidates: ['power'], selected: { enchantmentId: 'power', tier: 2 as const } }], gilded: { enchantmentId: 'critical-hit', tier: 1 as const }, rarity: 'rare' as const, isFavorite: true, notes: 'keep equipment notes', observation: { ...item.observation!, mode: 'charged' as const, availableAmmo: 0 } }
    const inventory: Inventory = { ...readinessMelee, rangedWeapons: [ranged] }
    await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key: storageKey, json: JSON.stringify({ version: 6, inventory }) })
    await page.goto('/#/optimize')
    await page.getByText('詳細条件', { exact: true }).click()
    await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.4')
    await page.evaluate(() => { window.location.hash = '/inventory' })
    await page.getByRole('button', { name: 'リスト', exact: true }).click()
    const editor = page.locator(`.inventory-collection details[data-instance-id="${id}"]`)
    await editor.locator(':scope > summary').click()
    await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
    const mode = editor.getByRole('combobox', { name: `${id} 発射モード`, exact: true })
    await expect(mode).toHaveValue('charged')
    await mode.selectOption('charged')
    await expect(editor.getByRole('spinbutton', { name: `${id} damage`, exact: true })).toHaveValue('100')
    await expect(editor.getByRole('spinbutton', { name: `${id} cycle`, exact: true })).toHaveValue('2')
    await expect(editor.getByRole('textbox', { name: `${id} 観測メモ`, exact: true })).toHaveValue(ranged.observation.sourceNote)
    await mode.selectOption('uncharged')
    await expect(editor.getByRole('spinbutton', { name: `${id} damage`, exact: true })).toHaveValue('')
    await expect(editor.getByRole('spinbutton', { name: `${id} cycle`, exact: true })).toHaveValue('')
    await expect(editor.getByRole('textbox', { name: `${id} 観測メモ`, exact: true })).toHaveValue('')
    await expect(editor.getByRole('spinbutton', { name: `${id} ammo`, exact: true })).toHaveValue('0')
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(inventory)
    await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('すべて入力')
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(inventory)
    // Reload discards a mode draft and restores the valid saved charged observation.
    await page.reload()
    await page.evaluate(() => { window.location.hash = '/optimize' })
    await page.getByText('詳細条件', { exact: true }).click()
    await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.4')
    await page.evaluate(() => { window.location.hash = '/inventory' })
    await page.getByRole('button', { name: 'リスト', exact: true }).click()
    await editor.locator(':scope > summary').click()
    await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
    await expect(mode).toHaveValue('charged')
    await expect(editor.getByRole('spinbutton', { name: `${id} damage`, exact: true })).toHaveValue('100')
    await mode.selectOption('uncharged')
    await editor.getByRole('spinbutton', { name: `${id} damage`, exact: true }).fill('17')
    await editor.getByRole('spinbutton', { name: `${id} cycle`, exact: true }).fill('1.25')
    await editor.getByRole('textbox', { name: `${id} 観測メモ`, exact: true }).fill(`SYNTHETIC ${id} uncharged observation`)
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(inventory)
    await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
    const updated: Inventory = { ...inventory, rangedWeapons: [{ ...ranged, observation: { ...ranged.observation, mode: 'uncharged', projectileDamage: 17, shotCycleSeconds: 1.25, sourceNote: `SYNTHETIC ${id} uncharged observation` } }] }
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(updated)
    await expect(page.getByRole('region', { name: '所持装備の評価可能性' }).locator('.readiness-counts')).toContainText('評価可能2件')
  })
}
