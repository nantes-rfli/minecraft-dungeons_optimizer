import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('shared configured values remain distinct from effective behavior and expose provenance', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/data/artifacts')
  const row = page.locator('[data-equipment-id="corrupted-seeds"]')
  await row.locator(':scope > summary').click()
  const panel = row.locator('[data-formal-values-domain="corrupted-seeds"]')
  await panel.locator(':scope > summary').click()
  await expect(panel.getByText('設定対象数', { exact: true })).toBeVisible()
  await expect(panel.locator('tbody td').first()).toHaveText('8')
  await expect(panel.getByText(/Optimizerでの採用を意味しません/)).toBeVisible()
  await panel.getByText('出典を確認', { exact: true }).click()
  await expect(panel.getByText('Extraction run', { exact: true })).toBeVisible()
  await expect(panel.getByText('Raw node', { exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('Powershaker exposes only its configured stack count with exact Raw provenance', async ({ page }) => {
  await page.goto('/#/data/artifacts')
  const row = page.locator('[data-equipment-id="powershaker"]')
  await row.locator(':scope > summary').click()
  const panel = row.locator('[data-formal-values-domain="powershaker"]')
  await panel.locator(':scope > summary').click()
  await expect(panel.getByText('設定攻撃スタック数', { exact: true })).toBeVisible()
  await expect(panel.locator('tbody tr')).toHaveCount(1)
  await expect(panel.locator('tbody td').first()).toHaveText('5')
  await expect(panel.getByText(/Optimizerでの採用を意味しません/)).toBeVisible()
  await panel.getByText('出典を確認', { exact: true }).click()
  await expect(panel.getByText('/packages/3/cdoPropertyInventory/0/properties/4', { exact: true })).toBeVisible()
  await expect(panel.getByText('Dungeons/Content/Content_DLC4/Actors/Items/MobMasher/BP_MobMasherInstance', { exact: true })).toBeVisible()
})
