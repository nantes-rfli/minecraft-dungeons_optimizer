import { expect, test } from '@playwright/test'

test('Venom Glaive migrates and recommends a separate fixed Poison Cloud contribution', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const item = { instanceId: 'venom', category: 'melee', catalogId: 'venom-glaive', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/inventory')
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const editor = page.locator('details[data-instance-id="venom"]')
  await editor.locator(':scope > summary').click()
  await expect(editor.getByText(/毒の雲の継続ダメージを合計に入れない/)).toBeVisible()
  await editor.getByRole('spinbutton', { name: /コンボ全段の観測ダメージ合計/ }).fill('510')
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.weapons[0], key)
  await expect.poll(saved).toMatchObject({ instanceId: 'venom', weaponId: 'venom-glaive', observedComboDamage: { powerLevel: 251, total: 510 } })

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Poison Cloud')
})
