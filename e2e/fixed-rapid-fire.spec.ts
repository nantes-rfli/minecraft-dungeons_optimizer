import { expect, test } from '@playwright/test'
import { readinessMelee, readinessRanged } from '../tests/inventoryReadinessFixtures'

test('Azure Seeker requires current-Power cadence and recommends its fixed Rapid Fire I', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const weapon = { ...readinessRanged('azure-seeker', 'azure'), powerLevel: 252 }
  const json = JSON.stringify({ version: 6, inventory: { ...readinessMelee, rangedWeapons: [weapon] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/optimize')
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.4')
  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const editor = page.locator('details[data-instance-id="azure"]')
  await editor.locator(':scope > summary').click()
  await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
  await expect(editor.getByText(/固定「速射 I」が働く状態/)).toBeVisible()
  const cycle = editor.getByRole('spinbutton', { name: 'azure cycle', exact: true })
  await expect(cycle).toHaveValue('')
  const apply = editor.getByRole('button', { name: '観測値を適用', exact: true })
  await apply.click()
  await expect(editor.getByRole('alert')).toContainText('すべて入力')
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.rangedWeapons[0], key)
  expect((await saved()).observation.fixedCadenceObservation.powerLevel).toBe(251)
  await cycle.fill('2.1')
  await editor.getByRole('spinbutton', { name: 'azure damage', exact: true }).fill('100')
  await editor.getByRole('spinbutton', { name: 'azure arrowsConsumedPerShot', exact: true }).fill('1')
  await editor.getByRole('textbox', { name: 'azure 観測メモ', exact: true }).fill('SYNTHETIC fixed Rapid Fire observation')
  await apply.click()
  await expect.poll(saved).toMatchObject({ observation: { mode: 'single', shotCycleSeconds: 2.1, fixedCadenceObservation: { powerLevel: 252 } } })

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.ranged .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Rapid Fire')
})
