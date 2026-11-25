import { expect, test } from '@playwright/test'
import type { Inventory } from '../src/core/types'

test('compares full melee time with ranged use and restores the saved setting', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const inventory: Inventory = {
    weapons: [
      { instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] },
      { instanceId: 'katana', weaponId: 'katana', powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 500 }, enchantmentSlots: [{ candidates: ['unchanting'] }] },
    ],
    artifacts: [],
    rangedWeapons: [{
      instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [],
      observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 100, shotCycleSeconds: 1, availableAmmo: 0, sourceNote: 'Synthetic browser fixture' },
    }],
  }
  await page.addInitScript(({ key, saved }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, saved) },
    { key, saved: JSON.stringify({ version: 6, inventory }) })
  await page.goto('/#/optimize')

  const includeMeleeOnly = page.getByRole('checkbox', { name: '遠距離を使わない構成も比較する', exact: true })
  const optimize = page.getByRole('button', { name: '最適化する', exact: true })
  const results = page.getByRole('region', { name: '最適化結果', exact: true })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await expect(includeMeleeOnly).not.toBeChecked()
  await optimize.click()
  await expect(results.getByRole('alert')).toContainText('No supported Ranged candidates')

  await includeMeleeOnly.check()
  await optimize.click()
  await expect(results.getByText('2通りを全探索', { exact: true })).toBeVisible()
  await expect(results.locator('.recommended-build .build-equipment.ranged')).toContainText('未選択')

  await page.getByRole('spinbutton', { name: '遠距離時間割合' }).fill('0.5')
  await expect(page.getByText('候補数の上限推定: 4通り', { exact: true })).toBeVisible()
  await optimize.click()
  await expect(results.getByText('3通りを全探索', { exact: true })).toBeVisible()

  const assessment = page.getByRole('region', { name: '装備の用途別評価' })
  await assessment.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(assessment.getByRole('button', { name: 'katanaの現在の条件の構成を見る' })).toBeVisible()
  await expect(assessment.getByRole('button', { name: 'bowの現在の条件の構成を見る' })).toBeVisible()

  const presets = page.getByRole('region', { name: '条件を保存して再利用' })
  await presets.getByLabel('保存名').fill('遠距離なしも比較')
  await presets.getByRole('button', { name: '現在の条件を保存', exact: true }).click()
  await expect(presets.getByRole('status')).toContainText('を保存しました')
  await page.reload()
  await expect(includeMeleeOnly).not.toBeChecked()
  await presets.getByLabel('保存済み条件').selectOption({ label: '遠距離なしも比較' })
  await presets.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(includeMeleeOnly).toBeChecked()
  await optimize.click()
  await expect(results.getByText('3通りを全探索', { exact: true })).toBeVisible()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, key)).toEqual(inventory)
})
