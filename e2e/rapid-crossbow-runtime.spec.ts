import { expect, test, type Page } from '@playwright/test'
import type { CatalogInventoryItem, Inventory } from '../src/core/types'
import { readinessMelee, readinessRanged } from '../tests/inventoryReadinessFixtures'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory as Inventory, storageKey)
async function openEditor(page: Page, id: string) {
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.4')
  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const editor = page.locator(`.inventory-collection details[data-instance-id="${id}"]`)
  await editor.locator(':scope > summary').click()
  await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
  return editor
}

test('migrated Rapid requires its own consumption observation even with stock zero and reaches comparison without losing metadata', async ({ page }) => {
  // Synthetic software fixture only; no gameplay measurement or new Evidence.
  const id = 'legacy-rapid'
  const catalog: CatalogInventoryItem = {
    instanceId: id, category: 'ranged', catalogId: 'rapid-crossbow', powerLevel: 251,
    rarity: 'rare', isFavorite: true, notes: 'retain Rapid equipment note',
    enchantmentSlots: [{ candidates: ['power'], selected: { enchantmentId: 'power', tier: 2 } }],
    gilded: { enchantmentId: 'critical-hit', tier: 1 },
    research: { enchantments: [{ enchantmentId: 'power', tier: 2, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 1, source: 'gilded' }], intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'High Firerate' }], observations: [{ parameterId: 'arrowsConsumedPerShot', value: '1', notes: 'inert Research must not fill an observation' }] },
  }
  const inventory: Inventory = { ...readinessMelee, catalogItems: [catalog] }
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key: storageKey, json: JSON.stringify({ version: 6, inventory }) })
  await page.goto('/#/inventory')
  const editor = await openEditor(page, id)
  const migrated = await stored(page)
  expect(migrated.catalogItems).toEqual([])
  expect(migrated.rangedWeapons).toHaveLength(1)
  expect(migrated.rangedWeapons![0]).toMatchObject({ instanceId: id, weaponId: 'rapid-crossbow', powerLevel: 251, rarity: 'rare', isFavorite: true, notes: catalog.notes, enchantmentSlots: catalog.enchantmentSlots, gilded: catalog.gilded, research: catalog.research })
  expect(migrated.rangedWeapons![0]!.observation).toBeUndefined()
  const consumption = editor.getByRole('spinbutton', { name: `${id} arrowsConsumedPerShot`, exact: true })
  await expect(consumption).toHaveValue('')
  await editor.getByRole('spinbutton', { name: `${id} damage`, exact: true }).fill('17')
  await editor.getByRole('spinbutton', { name: `${id} cycle`, exact: true }).fill('1.25')
  await editor.getByRole('spinbutton', { name: `${id} ammo`, exact: true }).fill('0')
  await editor.getByRole('textbox', { name: `${id} 観測メモ`, exact: true }).fill('SYNTHETIC neutral single shot and observed consumption')
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('消費矢数')
  expect(await stored(page)).toEqual(migrated)
  for (const cost of ['0', '2']) {
    await consumption.fill(cost)
    await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('未対応')
    await expect(consumption).toHaveValue(cost)
    expect(await stored(page)).toEqual(migrated)
  }
  await consumption.fill('1')
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  const panel = page.getByRole('region', { name: '所持装備の評価可能性' })
  await expect(panel.locator('.readiness-counts')).toContainText('評価可能2件')
  expect((await stored(page)).rangedWeapons![0]!.observation).toMatchObject({ arrowsConsumedPerShot: 1, availableAmmo: 0 })
  await editor.getByRole('spinbutton', { name: `${id} ammo`, exact: true }).fill('3')
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  const expectedRanged = { ...migrated.rangedWeapons![0]!, observation: { gameVersion: '1.17.0.0', mode: 'single', projectileDamage: 17, shotCycleSeconds: 1.25, availableAmmo: 3, sourceNote: 'SYNTHETIC neutral single shot and observed consumption', arrowsConsumedPerShot: 1 } }
  // Ordinary inventory saving is debounced; await the actual persisted outcome.
  await expect.poll(async () => (await stored(page)).rangedWeapons![0]).toEqual(expectedRanged)
  const saved = await stored(page)
  expect(saved.rangedWeapons![0]).toEqual(expectedRanged)
  expect(saved.weapons).toEqual(inventory.weapons)
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  await page.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '用途別評価が完了' })).toBeVisible()
  await expect(page.locator('.assessment-table tbody tr').filter({ hasText: id })).toContainText('構成を見る')
  await page.reload()
  expect(await stored(page)).toEqual(saved)
})

test('an explicit legacy zero consumption survives reload and cannot be relabeled as another mode', async ({ page }) => {
  const id = 'known-zero-bow'
  const item = readinessRanged('bow', id)
  const ranged = { ...item, observation: { ...item.observation!, availableAmmo: 0, arrowsConsumedPerShot: 0 } }
  const inventory: Inventory = { ...readinessMelee, rangedWeapons: [ranged] }
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key: storageKey, json: JSON.stringify({ version: 6, inventory }) })
  await page.goto('/#/inventory')
  const panel = page.getByRole('region', { name: '所持装備の評価可能性' })
  await expect(panel.locator('.readiness-counts')).toContainText('未対応1件')
  await page.reload()
  expect(await stored(page)).toEqual(inventory)
  const editor = await openEditor(page, id)
  const consumption = editor.getByRole('spinbutton', { name: `${id} arrowsConsumedPerShot`, exact: true })
  const mode = editor.getByRole('combobox', { name: `${id} 発射モード`, exact: true })
  await expect(consumption).toHaveValue('0')
  await mode.selectOption('uncharged')
  await expect(consumption).toHaveValue('0')
  await mode.selectOption('charged')
  await expect(consumption).toHaveValue('')
  await expect(editor.getByRole('spinbutton', { name: `${id} ammo`, exact: true })).toHaveValue('0')
  expect(await stored(page)).toEqual(inventory)
  await editor.getByRole('spinbutton', { name: `${id} damage`, exact: true }).fill('19')
  await editor.getByRole('spinbutton', { name: `${id} cycle`, exact: true }).fill('1.5')
  await editor.getByRole('textbox', { name: `${id} 観測メモ`, exact: true }).fill('SYNTHETIC own charged shot')
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('消費矢数')
  expect(await stored(page)).toEqual(inventory)
  await consumption.fill('1')
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(panel.locator('.readiness-counts')).toContainText('評価可能2件')
  const saved = await stored(page)
  expect(saved.rangedWeapons![0]!.observation).toMatchObject({ mode: 'charged', availableAmmo: 0, arrowsConsumedPerShot: 1, projectileDamage: 19, shotCycleSeconds: 1.5 })
  await page.reload()
  expect(await stored(page)).toEqual(saved)
})
