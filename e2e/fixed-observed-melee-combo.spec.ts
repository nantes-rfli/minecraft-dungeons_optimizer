import { expect, test } from '@playwright/test'

test('observed fixed combo shows the owned Tier I and can be compared', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const item = {
    instanceId: 'fixed-hawkbrand', weaponId: 'hawkbrand', powerLevel: 251,
    observedComboDamage: { powerLevel: 251, total: 900 },
    enchantmentSlots: [{ candidates: ['unchanting'] }],
  }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [item], artifacts: [] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/optimize')
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const result = page.getByRole('region', { name: '最適化結果', exact: true })
  const fixed = result.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Critical Hit')
  await page.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '用途別評価が完了' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'fixed-hawkbrandの現在の条件の構成を見る', exact: true })).toBeVisible()
})
