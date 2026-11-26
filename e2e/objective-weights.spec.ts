import { expect, test } from '@playwright/test'

test('edits relative objective weights and restores the selected profile', async ({ page }) => {
  await page.goto('/#/optimize')

  const profile = page.getByRole('combobox', { name: '最適化の目的' })
  await profile.selectOption('survival')

  const weights = page.locator('details.objective-weight-settings')
  await weights.locator('summary').click()
  const damage = page.getByRole('spinbutton', { name: 'Damageの重み' })
  const healing = page.getByRole('spinbutton', { name: 'Healingの重み' })
  const defense = page.getByRole('spinbutton', { name: 'Defenseの重み' })
  const control = page.getByRole('spinbutton', { name: 'Controlの重み' })

  await expect(damage).toHaveValue('0.1')
  await damage.fill('0.7')
  await expect(damage).toHaveValue('0.7')
  await expect(weights).toContainText('Damage 36.8%')
  await expect(profile).toHaveValue('survival')

  await page.getByRole('button', { name: '選択中の目的の重みに戻す' }).click()
  await expect(damage).toHaveValue('0.1')
  await expect(healing).toHaveValue('0.45')
  await expect(defense).toHaveValue('0.45')
  await expect(control).toHaveValue('0.3')

  await damage.fill('0')
  await healing.fill('0')
  await defense.fill('0')
  await control.fill('0')
  await expect(page.getByRole('alert').filter({ hasText: '少なくとも1つの重み' })).toBeVisible()
})

test('compares a recommendation against requested minimums without replacing the overall winner', async ({ page }) => {
  await page.goto('/#/optimize')
  await page.getByText('推薦に必要な下限を指定').click()
  const dps = page.getByRole('spinbutton', { name: '単体DPSの下限' })
  const health = page.getByRole('spinbutton', { name: '実効HPの下限' })
  const start = page.getByRole('button', { name: '最適化する', exact: true })
  const recommendation = page.getByRole('region', { name: '下限を満たす最良構成' })
  await dps.fill('1')
  await health.fill('1')
  await start.click()
  await expect(recommendation).toContainText('通常の1位が、指定した下限をすべて満たしています。')

  await health.fill('1000000000000')
  await expect(recommendation).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '選ばれた理由' })).toBeVisible()
  await start.click()
  await expect(recommendation).toContainText('指定した下限をすべて満たすものはありません。')
  await expect(page.getByRole('heading', { name: '選ばれた理由' })).toBeVisible()

  await dps.fill('-1')
  await expect(start).toBeDisabled()
  await expect(page.getByRole('alert').filter({ hasText: '推薦の下限には0以上' })).toBeVisible()
  await expect(recommendation).toHaveCount(0)
})
