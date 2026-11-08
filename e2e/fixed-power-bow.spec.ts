import { expect, test } from '@playwright/test'
import { readinessMelee, readinessRanged } from '../tests/inventoryReadinessFixtures'

test('a migrated Phantom Bow records its current Power and recommends fixed Power I once', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const legacy = { instanceId: 'phantom', category: 'ranged', catalogId: 'phantom-bow', powerLevel: 251 }
  const json = JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [legacy] } })
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
  await page.goto('/#/optimize')
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.4')
  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.getByRole('button', { name: 'リスト', exact: true }).click()
  const editor = page.locator('details[data-instance-id="phantom"]')
  await editor.locator(':scope > summary').click()
  await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
  await expect(editor.getByText(/固定パワー I が含まれた1矢ダメージ/)).toBeVisible()
  const damage = editor.getByRole('spinbutton', { name: 'phantom damage' })
  await editor.getByRole('combobox', { name: 'phantom 発射モード' }).selectOption('uncharged')
  await damage.fill('110')
  await editor.getByRole('spinbutton', { name: 'phantom cycle' }).fill('1.25')
  await editor.getByRole('spinbutton', { name: 'phantom ammo', exact: true }).fill('3')
  await editor.getByRole('textbox', { name: 'phantom 観測メモ' }).fill('SYNTHETIC observed fixed power')
  const apply = editor.getByRole('button', { name: '観測値を適用', exact: true })
  await apply.click()
  await expect(editor.getByRole('alert')).toContainText('消費矢数')
  await editor.getByRole('spinbutton', { name: 'phantom arrowsConsumedPerShot' }).fill('1')
  await apply.click()
  const persisted = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.rangedWeapons[0], key)
  await expect.poll(persisted).toMatchObject({ powerLevel: 251, observation: { mode: 'uncharged', fixedPowerObservation: { powerLevel: 251 }, arrowsConsumedPerShot: 1 } })
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const fixed = page.locator('.recommended-build .build-equipment.ranged .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(fixed).toHaveCount(1)
  await expect(fixed).toContainText('Power')

  await page.evaluate(() => { window.location.hash = '/inventory' })
  await page.getByRole('button', { name: 'グリッド', exact: true }).click()
  await page.getByRole('option', { name: /Phantom Bow/ }).click()
  const pane = page.getByRole('complementary', { name: '選択した装備の詳細' })
  await pane.getByRole('button', { name: '編集', exact: true }).click()
  await pane.getByRole('spinbutton', { name: '選択装備のPower' }).fill('253')
  await expect.poll(persisted).toMatchObject({ powerLevel: 253 })
  expect(await persisted()).not.toHaveProperty('observation')
})

for (const recordedPower of [251, undefined]) {
  test(`an imported ${recordedPower === undefined ? 'unbound' : 'stale'} Power observation cannot be retagged by Apply`, async ({ page }) => {
    const key = 'minecraft-dungeons-optimizer.inventory.v1'
    const original = readinessRanged('elite-power-bow', 'elite')
    const item = { ...original, powerLevel: 252, observation: { ...original.observation!, fixedPowerObservation: recordedPower === undefined ? undefined : { powerLevel: recordedPower } } }
    await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json: JSON.stringify({ version: 6, inventory: { ...readinessMelee, rangedWeapons: [item] } }) })
    await page.goto('/#/inventory')
    await page.getByRole('button', { name: 'リスト', exact: true }).click()
    const editor = page.locator('details[data-instance-id="elite"]')
    await editor.locator(':scope > summary').click()
    await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
    for (const field of ['damage', 'cycle', 'arrowsConsumedPerShot']) {
      await expect(editor.getByRole('spinbutton', { name: `elite ${field}`, exact: true })).toHaveValue('')
    }
    await expect(editor.getByRole('textbox', { name: 'elite 観測メモ', exact: true })).toHaveValue('')
    await expect(editor.getByRole('spinbutton', { name: 'elite ammo', exact: true })).toHaveValue('20')
    await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('すべて入力')
    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.rangedWeapons[0], key)
    expect(persisted).toEqual(JSON.parse(JSON.stringify(item)))
  })
}
