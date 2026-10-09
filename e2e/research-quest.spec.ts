import { expect, test } from '@playwright/test'

test('keeps shared measurement context and selects the first incomplete condition after each run', async ({ page }) => {
  const inventory = {
    weapons: [{
      instanceId: 'research-guarding-weapon',
      weaponId: 'double-axe',
      powerLevel: 251,
      enchantmentSlots: [{ candidates: ['guarding-strike'], locked: 'guarding-strike' }],
    }],
    armors: [{ instanceId: 'research-armor', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }],
    artifacts: [{ instanceId: 'research-iron-hide', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
  }
  await page.addInitScript((value) => {
    localStorage.setItem('minecraft-dungeons-optimizer.inventory.v1', JSON.stringify({ version: 5, inventory: value }))
  }, inventory)
  await page.goto('/#/research')
  await page.getByRole('button', { name: 'この調査を開始', exact: true }).click()

  const form = page.locator('.run-form')
  const condition = form.getByLabel('条件')
  for (let index = 1; index <= 3; index += 1) {
    await expect(condition).toHaveValue('baseline')
    await form.getByLabel('run ID').fill(`baseline-${index}`)
    await form.getByLabel('origin group').fill('same-measurer')
    await form.getByLabel('incoming hit ID').fill('zombie-melee-fixed')
    await form.getByLabel('Platform').fill('Windows')
    await form.getByLabel('Difficulty').fill('Apocalypse +25')
    await form.getByLabel('Baseline damage').fill('100000')
    await form.getByLabel('被ダメージ列').fill(Array(10).fill('100000').join('\n'))
    await form.getByLabel('Activation frame locator').fill(`video 00:1${index}.000-00:1${index}.500`)
    await form.getByLabel('版・装備・発動window・hit列を確認しました').check()
    await form.getByRole('button', { name: 'runを保存', exact: true }).click()

    const progressMessage = page.getByRole('status').filter({ hasText: `8C対象 ${index} / 24 run。` })
    await expect(progressMessage).toContainText('共通情報は次のrunへ引き継ぎました。')
    await expect(condition).toHaveValue(index === 3 ? 'armor-35' : 'baseline')
    await expect(form.getByLabel('origin group')).toHaveValue('same-measurer')
    await expect(form.getByLabel('incoming hit ID')).toHaveValue('zombie-melee-fixed')
    await expect(form.getByLabel('Platform')).toHaveValue('Windows')
    await expect(form.getByLabel('Difficulty')).toHaveValue('Apocalypse +25')
    await expect(form.getByLabel('Baseline damage')).toHaveValue('100000')
    await expect(form.getByLabel('run ID')).toHaveValue('')
    await expect(form.getByLabel('被ダメージ列')).toHaveValue('')
    await expect(form.getByLabel('Activation frame locator')).toHaveValue('')
    await expect(form.getByLabel('版・装備・発動window・hit列を確認しました')).not.toBeChecked()
  }
  await expect(page.locator('.research-progress')).toContainText('3')
  await expect(page.locator('.condition-grid article').first()).toContainText('3 / 3')
  await page.reload()
  await expect(page.locator('.run-form').getByLabel('条件')).toHaveValue('armor-35')
  await expect(page.locator('.run-form').getByLabel('incoming hit ID')).toHaveValue('zombie-melee-fixed')
})
