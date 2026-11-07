import { expect, test } from '@playwright/test'

test('a migrated uneven melee combo needs an observed total, then can be scored and compared', async ({ page }) => {
  const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
  const catalogItem = {
    instanceId: 'legacy-coral', category: 'melee', catalogId: 'coral-blade', powerLevel: 251,
    rarity: 'rare', notes: 'Synthetic combo fixture',
    enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 2 } }],
  }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [catalogItem] } })
  await page.addInitScript(({ key, json }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, json)
  }, { key: storageKey, json })
  await page.goto('/#/inventory')
  const panel = page.getByRole('region', { name: '所持装備の評価可能性' })
  await expect(panel.getByRole('status')).toContainText('確認しました')
  await expect(panel.locator('.readiness-counts')).toContainText('入力不足1件')
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const item = page.locator('details[data-instance-id="legacy-coral"]')
  await item.locator(':scope > summary').click()
  const total = item.getByRole('spinbutton', { name: /コンボ全段の観測ダメージ合計/ })
  await expect(total).toHaveValue('')
  await total.fill('900')
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  await expect(page.locator('.recommended-build')).toContainText('Coral Blade')
  await page.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '用途別評価が完了' })).toBeVisible()
  const row = page.locator('.assessment-table tbody tr').filter({ hasText: 'legacy-coral' })
  await expect(row.getByRole('button', { name: 'legacy-coralの現在の条件の構成を見る', exact: true })).toBeVisible()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)
  expect(stored.weapons[0]).toMatchObject({ instanceId: 'legacy-coral', weaponId: 'coral-blade', observedComboDamage: 900, enchantmentSlots: catalogItem.enchantmentSlots })
  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.reload()
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  await item.locator(':scope > summary').click()
  await expect(total).toHaveValue('900')
  await item.getByRole('spinbutton', { name: /のPower/ }).fill('252')
  await expect(total).toHaveValue('')
})
