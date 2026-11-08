import { expect, test } from '@playwright/test'

test('Sun’s Grace requires its own heal observation and shows fixed Radiance I in the recommendation', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const weapon = { instanceId: 'sun', weaponId: 'suns-grace', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }], observedComboDamage: { powerLevel: 251, total: 825 }, observedFixedRadiance: { powerLevel: 250, healPerProc: 44 } }
  const json = JSON.stringify({ version: 6, inventory: { weapons: [weapon], artifacts: [] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/inventory')
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const item = page.locator('details[data-instance-id="sun"]')
  await item.locator(':scope > summary').click()
  const heal = item.getByRole('spinbutton', { name: /固定「輝き I」1回の自己回復量/ })
  await expect(heal).toHaveValue('')
  const read = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.weapons[0], key)
  expect((await read()).observedFixedRadiance).toEqual({ powerLevel: 250, healPerProc: 44 })
  await heal.fill('46')
  await expect.poll(read).toMatchObject({ observedFixedRadiance: { powerLevel: 251, healPerProc: 46 } })

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Radiance')

  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.getByRole('button', { name: 'グリッド', exact: true }).click()
  await page.getByRole('option', { name: /Sun.s Grace/ }).click()
  const pane = page.getByRole('complementary', { name: '選択した装備の詳細' })
  await pane.getByRole('button', { name: '編集', exact: true }).click()
  await pane.getByRole('spinbutton', { name: '選択装備のPower' }).fill('252')
  await expect.poll(read).toMatchObject({ powerLevel: 252 })
  expect(await read()).not.toHaveProperty('observedFixedRadiance')
  expect(await read()).not.toHaveProperty('observedComboDamage')
})
