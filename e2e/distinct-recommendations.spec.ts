import { test, expect } from '@playwright/test'

test('worker results show distinct compositions and preserve the inventory', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const inventory = { weapons: [{ instanceId: 'permutation-fixture', weaponId: 'fighters-bindings', powerLevel: 251,
    enchantmentSlots: Array.from({ length: 2 }, () => ({ candidates: ['critical-hit', 'radiance'] })) }], artifacts: [] }
  const json = JSON.stringify({ version: 5, inventory })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/storage')
  await page.getByRole('textbox', { name: 'Inventory JSON' }).fill(json)
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'JSONを読み込みました。' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.inventory, key)).toEqual(inventory)
  const persisted = await page.evaluate((key) => localStorage.getItem(key), key)
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  await expect(page.locator('.result-meta')).toContainText('3通りを全探索')
  await expect(page.getByText('Enchantの枠順だけが異なる同じ構成はまとめて表示します。', { exact: false })).toBeVisible()
  const alternatives = page.locator('.alternatives').first().locator('.build-alternative')
  await expect(alternatives).toHaveCount(1)
  await alternatives.getByText('装備とEnchantの構成を見る').click()
  const composition = await alternatives.locator('.alternative-composition .build-enchantments').innerText()
  const best = await page.locator('.recommended-build .melee .build-enchantments').innerText()
  expect(composition).not.toBe(best)
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(persisted)
  expect(errors).toEqual([])
})
