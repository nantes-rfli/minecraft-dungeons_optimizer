import { expect, test } from '@playwright/test'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'

test('compares one staged drop without changing saved Inventory', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'drop-baseline', weaponId: 'double-axe', powerLevel: 100, enchantmentSlots: [{ candidates: ['sharpness'] }] }],
    artifacts: [],
  }
  await page.goto('/#/storage')
  await page.getByRole('textbox', { name: 'Inventory JSON' }).fill(JSON.stringify({ version: 5, inventory }))
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect.poll(() => page.evaluate((key) => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored).inventory : undefined
  }, storageKey)).toEqual(inventory)
  const savedInventory = await page.evaluate((key) => localStorage.getItem(key), storageKey)

  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByText('HP・ダメージの実数値', { exact: true }).click()
  await page.getByLabel('平均敵HP').fill('100000')
  const panel = page.getByRole('region', { name: '新しい装備を試す' })
  await panel.getByRole('button', { name: '比較候補を選ぶ' }).click()
  const drawer = page.getByRole('dialog', { name: '比較候補を選ぶ' })
  await drawer.getByRole('searchbox', { name: '装備を検索' }).fill('Double Axe')
  await drawer.getByRole('option', { name: /Double Axe/ }).click()
  await drawer.getByLabel('Power').fill('263')
  await drawer.getByRole('button', { name: '＋ スロットを追加' }).click()
  const enchantmentPicker = page.getByRole('dialog', { name: 'スロット1を追加' })
  await enchantmentPicker.getByRole('searchbox', { name: '日本語名・英語名で検索' }).fill('sharpness')
  await enchantmentPicker.getByRole('button', { name: /Sharpness/ }).click()
  await drawer.getByRole('button', { name: '比較候補に追加' }).click()
  await expect(panel.locator('.drop-candidate-summary')).toContainText('263')

  await panel.getByRole('button', { name: '現在の最良ビルドと比較' }).click()
  await expect(panel.locator('.drop-comparison-status')).toHaveText('比較が完了しました。', { timeout: 60_000 })
  await expect(panel.locator('.drop-comparison-outcome')).toContainText('新しい装備が最良ビルドに含まれています。')
  await expect(panel.locator('.drop-comparison-results')).toContainText('現在の最良ビルド')
  await expect(panel.locator('.drop-comparison-results')).toContainText('仮追加後の最良ビルド')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)

  await panel.getByRole('button', { name: '候補を外す' }).click()
  await expect(panel.getByRole('button', { name: '比較候補を選ぶ' })).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)

  await panel.getByRole('button', { name: '比較候補を選ぶ' }).click()
  const weakerDrawer = page.getByRole('dialog', { name: '比較候補を選ぶ' })
  await weakerDrawer.getByRole('searchbox', { name: '装備を検索' }).fill('Double Axe')
  await weakerDrawer.getByRole('option', { name: /Double Axe/ }).click()
  await weakerDrawer.getByLabel('Power').fill('50')
  await weakerDrawer.getByRole('button', { name: '＋ スロットを追加' }).click()
  const weakerEnchantmentPicker = page.getByRole('dialog', { name: 'スロット1を追加' })
  await weakerEnchantmentPicker.getByRole('searchbox', { name: '日本語名・英語名で検索' }).fill('sharpness')
  await weakerEnchantmentPicker.getByRole('button', { name: /Sharpness/ }).click()
  await weakerDrawer.getByRole('button', { name: '比較候補に追加' }).click()
  await panel.getByRole('button', { name: '現在の最良ビルドと比較' }).click()
  await expect(panel.locator('.drop-comparison-status')).toHaveText('比較が完了しました。', { timeout: 60_000 })
  await expect(panel.locator('.drop-comparison-outcome')).toContainText('新しい装備は最良ビルドに選ばれませんでした。')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)
  await panel.getByRole('button', { name: '候補を外す' }).click()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
