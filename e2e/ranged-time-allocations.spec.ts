import { expect, test } from '@playwright/test'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'

test('compares user-entered ranged reservations, saves them, and restores each candidate with its own time share', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }],
    artifacts: [],
    rangedWeapons: [{
      instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [],
      observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 1000, shotCycleSeconds: 1, availableAmmo: 1, sourceNote: 'Synthetic browser fixture' },
    }],
  }
  const scenario = { ...DEFAULT_SCENARIO, averageTargetsInReach: 1, encounterDurationSeconds: 20, rangedTimeShare: 0.8, weights: { damage: 1, defense: 0, healing: 0, control: 0 } }
  await page.addInitScript(({ inventory, scenario }) => {
    const inventoryKey = 'minecraft-dungeons-optimizer.inventory.v1'
    const scenarioKey = 'minecraft-dungeons-optimizer.scenario-presets.v1'
    if (!localStorage.getItem(inventoryKey)) localStorage.setItem(inventoryKey, JSON.stringify({ version: 6, inventory }))
    if (!localStorage.getItem(scenarioKey)) localStorage.setItem(scenarioKey, JSON.stringify({ version: 1, presets: [{ id: 'ranged-base', name: '火力と矢1本', scenario }] }))
  }, { inventory, scenario })
  await page.goto('/#/optimize')
  const presets = page.getByRole('region', { name: '条件を保存して再利用' })
  await presets.getByLabel('保存済み条件').selectOption({ label: '火力と矢1本' })
  await presets.getByRole('button', { name: '読み込む', exact: true }).click()
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByLabel('比較に追加する時間割合').fill('0.2')
  await page.getByRole('button', { name: '時間割合を候補に追加' }).click()
  await expect(page.getByText('候補数の上限推定: 2通り', { exact: true })).toBeVisible()
  const optimize = page.getByRole('button', { name: '最適化する', exact: true })
  await optimize.click()
  const results = page.getByRole('region', { name: '最適化結果', exact: true })
  await expect(results.locator('.recommended-build .build-equipment.ranged')).toContainText('遠距離時間 20% · 矢1本')
  await expect(results.locator('.alternatives').first()).toContainText('遠距離時間 80% · 矢1本')

  await presets.getByLabel('保存名').fill('矢切れ後の時間を比較')
  await presets.getByRole('button', { name: '現在の条件を保存', exact: true }).click()
  await expect(presets.getByRole('status')).toContainText('を保存しました')
  await page.reload()
  await presets.getByLabel('保存済み条件').selectOption({ label: '矢切れ後の時間を比較' })
  await presets.getByRole('button', { name: '読み込む', exact: true }).click()
  await page.getByText('詳細条件', { exact: true }).click()
  await expect(page.getByRole('button', { name: '時間割合 0.2 を候補から外す' })).toBeVisible()
  await optimize.click()
  await expect(results.locator('.recommended-build .build-equipment.ranged')).toContainText('遠距離時間 20% · 矢1本')
  await page.getByRole('button', { name: '時間割合 0.2 を候補から外す' }).click()
  await optimize.click()
  await expect(results.locator('.recommended-build .build-equipment.ranged')).toContainText('遠距離時間 80% · 矢1本')
})
