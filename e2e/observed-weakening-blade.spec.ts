import { expect, test } from '@playwright/test'

test('Nameless Blade migrates and recommends fixed Weakening I after its combo observation', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const item = { instanceId: 'nameless', category: 'melee', catalogId: 'nameless-blade', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/inventory')
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const editor = page.locator('details[data-instance-id="nameless"]')
  await editor.locator(':scope > summary').click()
  await editor.getByRole('spinbutton', { name: /コンボ全段の観測ダメージ合計/ }).fill('400')
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.weapons[0], key)
  await expect.poll(saved).toMatchObject({ instanceId: 'nameless', weaponId: 'nameless-blade', observedComboDamage: { powerLevel: 251, total: 400 } })

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Weakening')
})
