import { expect, test } from '@playwright/test'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'

test('reports a staged Armor missing observed health as excluded, not as a losing build', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'armor-test-weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['sharpness'] }] }],
    armors: [{ instanceId: 'armor-baseline', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 400, enchantmentSlots: [{ candidates: ['chilling'] }] }],
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
  const panel = page.getByRole('region', { name: '新しい装備を試す' })
  await panel.getByRole('button', { name: '比較候補を選ぶ' }).click()
  const drawer = page.getByRole('dialog', { name: '比較候補を選ぶ' })
  await drawer.getByRole('button', { name: '防具' }).click()
  await drawer.getByRole('searchbox', { name: '装備を検索' }).fill('Battle Robe')
  await drawer.getByRole('option', { name: /Battle Robe/ }).click()
  await drawer.getByRole('button', { name: '＋ スロットを追加' }).click()
  const enchantmentPicker = page.getByRole('dialog', { name: 'スロット1を追加' })
  await enchantmentPicker.getByRole('searchbox', { name: '日本語名・英語名で検索' }).fill('chilling')
  await enchantmentPicker.getByRole('button', { name: /Chilling/ }).click()
  await drawer.getByRole('button', { name: '比較候補に追加' }).click()
  await expect(panel.locator('.drop-candidate-summary')).toContainText('バトルローブ')

  await panel.getByRole('button', { name: '現在の最良ビルドと比較' }).click()
  await expect(panel.locator('.drop-comparison-status')).toHaveText('仮候補は今回の探索で評価されませんでした。', { timeout: 60_000 })
  await expect(panel.getByRole('alert')).toContainText('MISSING_OBSERVED_ARMOR_HEALTH')
  await expect(panel.locator('.drop-comparison-results')).toHaveCount(0)
  await expect(panel.locator('.drop-comparison-outcome')).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)
})

test('reports a staged Artifact excluded by Evidence policy as unevaluated', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'artifact-test-weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['sharpness'] }] }],
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
  await page.getByRole('radio', { name: /確度の高い情報のみ/ }).check()
  const panel = page.getByRole('region', { name: '新しい装備を試す' })
  await panel.getByRole('button', { name: '比較候補を選ぶ' }).click()
  const drawer = page.getByRole('dialog', { name: '比較候補を選ぶ' })
  await drawer.getByRole('button', { name: 'アーティファクト' }).click()
  await drawer.getByRole('searchbox', { name: '装備を検索' }).fill('Death Cap Mushroom')
  await drawer.getByRole('option', { name: /Death Cap Mushroom/ }).click()
  await drawer.getByRole('button', { name: '比較候補に追加' }).click()

  await panel.getByRole('button', { name: '現在の最良ビルドと比較' }).click()
  await expect(panel.locator('.drop-comparison-status')).toHaveText('仮候補は今回の探索で評価されませんでした。', { timeout: 60_000 })
  await expect(panel.getByRole('alert')).toContainText('Estimated parameter')
  await expect(panel.locator('.drop-comparison-results')).toHaveCount(0)
  await expect(panel.locator('.drop-comparison-outcome')).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(savedInventory)
})
