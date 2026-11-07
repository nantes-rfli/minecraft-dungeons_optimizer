import { expect, test } from '@playwright/test'
import type { Inventory } from '../src/core/types'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
const weaponIds = ['cutlass', 'pickaxe', 'soul-knife', 'whip', 'great-hammer', 'whirlwind', 'stormlander'] as const

test('compares base-cadence weapons with owned Mushroom unequipped and restores the saved search condition', async ({ page }) => {
  const inventory: Inventory = {
    weapons: weaponIds.map((weaponId) => ({ instanceId: `owned-${weaponId}`, weaponId, powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit'] }] })),
    artifacts: [
      { instanceId: 'owned-mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 },
      { instanceId: 'owned-amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 },
    ],
  }
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) },
    { key: storageKey, json: JSON.stringify({ version: 6, inventory }) })
  await page.goto('/#/optimize')
  const results = page.getByRole('region', { name: '最適化結果', exact: true })
  const optionalArtifacts = page.getByRole('checkbox', { name: 'Artifactを外した構成も比較する', exact: true })
  const optimize = page.getByRole('button', { name: '最適化する', exact: true })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await expect(optionalArtifacts).not.toBeChecked()
  await expect(page.getByText('候補数の上限推定: 7通り', { exact: true })).toBeVisible()
  await optimize.click()
  await expect(results.getByRole('alert')).toContainText('No supported Melee candidates')

  await optionalArtifacts.check()
  await expect(page.getByText('候補数の上限推定: 28通り', { exact: true })).toBeVisible()
  await optimize.click()
  await expect(results.getByText('14通りを全探索', { exact: true })).toBeVisible()
  await expect(results.locator('.recommended-build .artifact-slots')).not.toContainText('Death Cap Mushroom')

  const assessment = page.getByRole('region', { name: '装備の用途別評価' })
  await assessment.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(assessment.getByRole('status')).toContainText('用途別評価が完了しました')
  for (const id of weaponIds) {
    await expect(assessment.getByRole('button', { name: `owned-${id}の現在の条件の構成を見る`, exact: true })).toBeVisible()
  }
  const mushroom = assessment.getByRole('row').filter({ has: page.getByRole('rowheader').filter({ hasText: 'owned-mushroom' }) })
  await expect(mushroom).toContainText('未評価')

  const presets = page.getByRole('region', { name: '条件を保存して再利用' })
  await presets.getByLabel('保存名').fill('基本速度と空きArtifact枠')
  await presets.getByRole('button', { name: '現在の条件を保存', exact: true }).click()
  await expect(presets.getByRole('status')).toContainText('を保存しました')
  await page.reload()
  await expect(optionalArtifacts).not.toBeChecked()
  await presets.getByLabel('保存済み条件').selectOption({ label: '基本速度と空きArtifact枠' })
  await presets.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(optionalArtifacts).toBeChecked()
  await optimize.click()
  await expect(results.getByText('14通りを全探索', { exact: true })).toBeVisible()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(inventory)
})
