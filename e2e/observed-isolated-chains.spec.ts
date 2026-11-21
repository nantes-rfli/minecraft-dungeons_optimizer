import { expect, test } from '@playwright/test'

for (const [id, fixedName] of [['flail', 'Chains'], ['jailors-scythe', 'Chains']] as const) {
  test(`${id} requires explicit whole-interval isolation before recommendation`, async ({ page }) => {
    const key = 'minecraft-dungeons-optimizer.inventory.v1'
    const item = { instanceId: id, category: 'melee', catalogId: id, powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }], notes: 'preserve' }
    const json = JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } })
    await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key, json })
    await page.goto('/#/inventory')
    await page.getByRole('button', { name: 'リスト', exact: true }).click()
    const editor = page.locator(`details[data-instance-id="${id}"]`)
    await editor.locator(':scope > summary').click()
    await expect(editor).toContainText('開始時Chainsなし')
    await editor.getByRole('spinbutton', { name: /コンボ全段の観測ダメージ合計/ }).fill('520')
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.weapons[0], key)).toMatchObject({ instanceId: id, weaponId: id, notes: 'preserve', observedComboDamage: { powerLevel: 251, total: 520 } })
    await page.evaluate(() => { window.location.hash = '/optimize' })
    await page.getByText('詳細条件', { exact: true }).click()
    await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
    await page.getByRole('button', { name: '最適化する', exact: true }).click()
    await expect(page.getByText('MISSING_CHAINS_ISOLATION', { exact: false }).first()).toBeVisible()
    await page.getByText('詳細設定 / Controlの仮定と評価方針', { exact: true }).click()
    const candidates = page.getByRole('combobox', { name: 'Chains 孤立条件（全評価期間）', exact: true })
    const initial = page.getByRole('combobox', { name: '開始時のChains状態なし', exact: true })
    await expect(candidates).toHaveValue('unknown')
    await expect(initial).toHaveValue('unknown')
    await candidates.selectOption('true')
    await initial.selectOption('true')
    await page.getByRole('button', { name: '最適化する', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
    const fixed = page.locator('.recommended-build .build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
    await expect(fixed).toHaveCount(1)
    await expect(fixed).toContainText(fixedName)
    await expect(page.getByText(/固定 Chains I:.*適用callなし/).first()).toBeVisible()
    await candidates.selectOption('false')
    await page.getByRole('button', { name: '最適化する', exact: true }).click()
    await expect(page.getByText('UNSUPPORTED_CHAINS_ISOLATION', { exact: false }).first()).toBeVisible()
  })
}
