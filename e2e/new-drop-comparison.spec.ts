import { expect, test } from '@playwright/test'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'

test('compares a staged drop before and after under a selected saved condition', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'saved-condition-baseline', weaponId: 'double-axe', powerLevel: 100, enchantmentSlots: [{ candidates: ['sharpness'] }] }],
    artifacts: [],
  }
  const healing = { ...DEFAULT_SCENARIO, weights: { damage: 0, healing: 1, defense: 0, control: 0 } }
  await page.addInitScript(({ inventory, healing }) => {
    localStorage.setItem('minecraft-dungeons-optimizer.inventory.v1', JSON.stringify({ version: 5, inventory }))
    localStorage.setItem('minecraft-dungeons-optimizer.scenario-presets.v1', JSON.stringify({ version: 1, presets: [{ id: 'healing', name: '回復用', scenario: healing }] }))
  }, { inventory, healing })
  await page.goto('/#/optimize')
  const savedInventory = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)
  const panel = page.getByRole('region', { name: '新しい装備を試す' })
  await panel.getByRole('button', { name: '比較候補を選ぶ' }).click()
  const drawer = page.getByRole('dialog', { name: '比較候補を選ぶ' })
  await drawer.getByRole('searchbox', { name: '装備を検索' }).fill('Double Axe')
  await drawer.getByRole('option', { name: /Double Axe/ }).click()
  await drawer.getByLabel('Power').fill('263')
  await drawer.getByRole('button', { name: '＋ スロットを追加' }).click()
  const enchantmentPicker = page.getByRole('dialog', { name: 'スロット1を追加' })
  await enchantmentPicker.getByRole('searchbox', { name: '日本語名・英語名で検索' }).fill('radiance')
  await enchantmentPicker.getByRole('button', { name: /Radiance/ }).click()
  await drawer.getByRole('button', { name: '比較候補に追加' }).click()

  const savedCondition = panel.getByLabel('回復用', { exact: true })
  await savedCondition.check()
  await panel.getByRole('button', { name: '選んだ保存条件で比較' }).click()
  await expect(panel.getByRole('status').filter({ hasText: '保存済み条件の比較が完了しました。' })).toBeVisible({ timeout: 60_000 })
  const results = panel.getByRole('region', { name: '保存済み条件のドロップ比較' })
  await expect(results).toContainText('候補追加前の最良ビルド')
  await expect(results).toContainText('候補追加後の最良ビルド')
  const savedMetricDeltas = results.locator('.drop-metric-deltas')
  await expect(savedMetricDeltas).toHaveCount(1)
  await expect(savedMetricDeltas).toContainText('単体DPS')
  await expect(savedMetricDeltas).toContainText('AoE DPS')
  await expect(savedMetricDeltas).toContainText('回復 / 秒')
  await expect(savedMetricDeltas).toContainText('実効HP')
  await expect(savedMetricDeltas).toContainText('Control / 100')
  await expect(savedMetricDeltas.locator('dl > div')).toHaveCount(5)
  await expect(results).toContainText('候補が最良ビルドに含まれています。')
  await expect(results).toContainText('候補を必須にした最良スコア')
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(savedInventory)
})

test('compares a staged drop and saves it only after an explicit keep action', async ({ page }) => {
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
  const metricDeltas = panel.locator('.drop-metric-deltas')
  await expect(metricDeltas).toHaveCount(1)
  await expect(metricDeltas.locator('dl > div')).toHaveCount(5)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)

  await panel.getByRole('button', { name: 'この候補をInventoryに追加' }).click()
  await expect(page.getByRole('status').filter({ hasText: '比較候補をInventoryへ登録しました' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '比較候補を選ぶ' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored).inventory.weapons.length : undefined
  }, storageKey)).toBe(2)
  const retainedInventoryJson = await page.evaluate((key) => localStorage.getItem(key), storageKey)
  const retainedInventory = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)
  expect(retainedInventory.weapons).toHaveLength(2)
  expect(retainedInventory.weapons.find((item: { instanceId: string }) => item.instanceId === 'drop-baseline')).toEqual(inventory.weapons[0])
  expect(retainedInventory.weapons.find((item: { instanceId: string }) => item.instanceId !== 'drop-baseline')).toMatchObject({
    weaponId: 'double-axe', powerLevel: 263,
    enchantmentSlots: [expect.objectContaining({ candidates: ['sharpness'] })],
  })
  expect(retainedInventory.artifacts).toEqual([])

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
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(retainedInventoryJson)
  await panel.getByRole('button', { name: '候補を外す' }).click()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(retainedInventoryJson)

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
