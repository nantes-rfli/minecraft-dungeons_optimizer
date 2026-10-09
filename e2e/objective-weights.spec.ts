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
