import { test, expect } from '@playwright/test'

test('all four plain melee Catalog instances migrate and reach evaluation and comparison under the explicit target boundary', async ({ page }) => {
  // Synthetic software fixture, not a gameplay measurement or independent Evidence.
  const ids = ['cutlass', 'pickaxe', 'soul-knife', 'whip']
  const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
  const catalogItems = ids.map((catalogId) => ({
    instanceId: `legacy-${catalogId}`, category: 'melee', catalogId, powerLevel: 251,
    rarity: 'rare', isFavorite: true, notes: 'SYNTHETIC migration fixture',
    enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 2 } }],
    research: { observations: [{ parameterId: 'unaccepted-note', value: 'unknown', notes: 'not a runtime parameter' }] },
  }))
  const json = JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems } })
  await page.addInitScript(({ key, json }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, json) }, { key: storageKey, json })
  await page.goto('/#/inventory')
  const panel = page.getByRole('region', { name: '所持装備の評価可能性' })
  await expect(panel.getByRole('status')).toContainText('確認しました')
  await expect(panel.locator('.readiness-counts')).toContainText('評価可能0件')
  await expect(panel.locator('.readiness-counts')).toContainText('条件・組み合わせ制約4件')

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  await page.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '用途別評価が完了' })).toBeVisible()
  for (const id of ids) await expect(page.locator('.assessment-table tbody tr').filter({ hasText: `legacy-${id}` })).toContainText('構成を見る')

  await page.evaluate(() => { window.location.hash = '/inventory' })
  await expect(panel.getByRole('status')).toContainText('確認しました')
  await expect(panel.locator('.readiness-counts')).toContainText('評価可能4件')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)
  expect(stored.catalogItems).toEqual([])
  expect(stored.weapons.map((item: { weaponId: string }) => item.weaponId)).toEqual(ids)
  for (const [index, item] of stored.weapons.entries()) {
    expect(item).toMatchObject({ instanceId: catalogItems[index]!.instanceId, isFavorite: true, enchantmentSlots: catalogItems[index]!.enchantmentSlots, research: catalogItems[index]!.research })
    expect(item.observedDamagePerHit).toBeUndefined()
  }
  await page.reload()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(stored)
})
