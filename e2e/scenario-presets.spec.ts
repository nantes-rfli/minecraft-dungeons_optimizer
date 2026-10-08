import { expect, test } from '@playwright/test'

const storageKey = 'minecraft-dungeons-optimizer.scenario-presets.v1'

test('saves complete custom conditions and restores them after a profile change and reload', async ({ page }) => {
  await page.goto('/#/optimize')
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByText('HP・ダメージの実数値', { exact: true }).click()
  await page.getByLabel('平均敵HP').fill('777')
  await page.getByLabel('確度の高い情報のみ').check()
  await page.getByLabel('保存名').fill('深層ボス')
  await page.getByRole('button', { name: '現在の条件を保存' }).click()
  await expect(page.getByRole('status').filter({ hasText: '「深層ボス」を保存しました。' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.presets?.[0]?.scenario, storageKey)).toMatchObject({
    profileId: 'balanced', averageEnemyHealth: 777, evidencePolicy: 'high-confidence-only',
  })

  await page.getByLabel('最適化の目的').selectOption('boss')
  await expect(page.getByLabel('平均敵HP')).toHaveValue('500')
  await page.getByLabel('保存済み条件').selectOption({ label: '深層ボス' })
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.getByLabel('平均敵HP')).toHaveValue('777')
  await expect(page.getByLabel('確度の高い情報のみ')).toBeChecked()
  await expect(page.getByRole('status').filter({ hasText: 'Optimizerの探索はまだ開始していません。' })).toBeVisible()

  await page.reload()
  await page.getByText('詳細条件', { exact: true }).click()
  await page.getByText('HP・ダメージの実数値', { exact: true }).click()
  await page.getByLabel('保存済み条件').selectOption({ label: '深層ボス' })
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.getByLabel('平均敵HP')).toHaveValue('777')
  await expect(page.getByLabel('確度の高い情報のみ')).toBeChecked()
  await expect(page.getByText('探索完了', { exact: false })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('preserves an invalid saved preset document until explicit reset', async ({ page }) => {
  await page.goto('/#/optimize')
  const invalid = '{"version":99,"presets":[]}'
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: invalid })
  await page.reload()

  await expect(page.getByRole('alert').filter({ hasText: '元のデータは上書きしていません' })).toBeVisible()
  await expect(page.getByRole('button', { name: '現在の条件を保存' })).toBeDisabled()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(invalid)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '読み込めない保存済み条件を削除して初期化' }).click()
  await expect(page.getByRole('status').filter({ hasText: '保存済み条件を初期化しました。' })).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()
})
