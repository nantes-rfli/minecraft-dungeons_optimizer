import { expect, test } from '@playwright/test'

test('Diamond Sword accepts an inclusive observation and shows its fixed Sharpness once', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const weapon = { instanceId: 'diamond', weaponId: 'diamond-sword', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [weapon], artifacts: [] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/inventory')
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const item = page.locator('details[data-instance-id="diamond"]')
  await item.locator(':scope > summary').click()
  await expect(item.getByText(/固定の切れ味 I が含まれた観測値/)).toBeVisible()
  await item.getByRole('spinbutton', { name: /コンボ全段の観測ダメージ合計/ }).fill('1100')
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Sharpness')
})
