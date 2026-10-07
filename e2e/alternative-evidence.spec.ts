import { test, expect } from '@playwright/test'

test('candidate Evidence opens by keyboard and stays local to each worker result', async ({ page }) => {
  const key = 'minecraft-dungeons-optimizer.inventory.v1'
  const inventory = { weapons: [{ instanceId: 'evidence-fixture', weaponId: 'double-axe', powerLevel: 251,
    enchantmentSlots: [{ candidates: ['critical-hit', 'guarding-strike'] }] }], artifacts: [] }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/storage')
  await page.getByRole('textbox', { name: 'Inventory JSON' }).fill(JSON.stringify({ version: 5, inventory }))
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'JSONを読み込みました。' })).toBeVisible()
  const persisted = await page.evaluate((key) => localStorage.getItem(key), key)
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const alternative = page.locator('.alternatives').first().locator('.build-alternative').first()
  const details = alternative.locator('.alternative-evidence')
  const summary = details.locator('summary')
  await expect(summary).toContainText('Evidenceと計算上の注意を見る')
  await expect(details).not.toHaveAttribute('open', '')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
  await expect(details.getByText('独立検証済みであることを意味しません。', { exact: false })).toBeVisible()
  await expect(details).toContainText('この候補の計算上の注意')
  // Default Balanced ranks Guarding Strike first; the Critical Hit alternative
  // must not inherit its estimate. Both are actual evaluated worker candidates.
  await expect(page.locator('.optimize-results > .evidence-result')).toContainText('melee-enchantment:guarding-strike')
  await expect(summary).toContainText('Estimated 0件')
  await expect(details).not.toContainText('activation-coverage-model')
  await page.getByText('パレート候補を見る', { exact: true }).click()
  const pareto = page.locator('.secondary-results .alternative-evidence')
  await expect(pareto).toHaveCount(2)
  await pareto.filter({ hasText: 'activation-coverage-model' }).locator('summary').click()
  await expect(pareto.filter({ hasText: 'activation-coverage-model' }).locator('code')).toContainText('melee-enchantment:guarding-strike')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(persisted)
  expect(errors).toEqual([])
})
