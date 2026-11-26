import { expect, test } from '@playwright/test'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'

test('keeps independent modes for one bow and compares them at the same arrow stock', async ({ page }) => {
  const inventory = {
    weapons: [{ instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }],
    artifacts: [],
    rangedWeapons: [{
      instanceId: 'modes-bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [],
      observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 1_000, shotCycleSeconds: 1, availableAmmo: 1, sourceNote: 'Synthetic uncharged browser record' },
    }],
  }
  const scenario = { ...DEFAULT_SCENARIO, averageTargetsInReach: 1, encounterDurationSeconds: 20, rangedTimeShare: 0.8, weights: { damage: 1, defense: 0, healing: 0, control: 0 } }
  const inventoryKey = 'minecraft-dungeons-optimizer.inventory.v1'
  await page.addInitScript(({ inventory, scenario, inventoryKey }) => {
    const scenarioKey = 'minecraft-dungeons-optimizer.scenario-presets.v1'
    if (!localStorage.getItem(inventoryKey)) localStorage.setItem(inventoryKey, JSON.stringify({ version: 6, inventory }))
    if (!localStorage.getItem(scenarioKey)) localStorage.setItem(scenarioKey, JSON.stringify({ version: 1, presets: [{ id: 'both-modes', name: '矢1本で発射モード比較', scenario }] }))
  }, { inventory, scenario, inventoryKey })
  await page.goto('/#/inventory')
  const editor = page.locator('details[data-instance-id="modes-bow"]')
  const openEditor = async () => {
    await page.getByRole('button', { name: 'リスト', exact: true }).click()
    await editor.locator(':scope > summary').click()
    await editor.getByText('最適化に使う詳しい数値を入力する', { exact: true }).click()
  }
  await openEditor()
  await editor.getByRole('combobox', { name: 'modes-bow 発射モード' }).selectOption('charged')
  const damage = editor.getByRole('spinbutton', { name: 'modes-bow damage' })
  const cycle = editor.getByRole('spinbutton', { name: 'modes-bow cycle' })
  const ammo = editor.getByRole('spinbutton', { name: 'modes-bow ammo' })
  await expect(damage).toHaveValue('')
  await expect(cycle).toHaveValue('')
  await expect(ammo).toHaveValue('1')
  await damage.fill('2200')
  await cycle.fill('4')
  await editor.getByRole('textbox', { name: 'modes-bow 観測メモ' }).fill('Synthetic charged browser record')
  await editor.getByRole('button', { name: 'もう一方の発射モードとして保存' }).click()
  await expect(editor.getByText(/記録した発射モードは 弓・未チャージ と 弓・フルチャージ/)).toBeVisible()
  const persisted = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory.rangedWeapons, inventoryKey)
  await expect.poll(persisted).toEqual([{
    ...inventory.rangedWeapons[0],
    modeComparison: { powerLevel: 251, observation: { gameVersion: '1.17.0.0', mode: 'charged', projectileDamage: 2_200, shotCycleSeconds: 4, sourceNote: 'Synthetic charged browser record' } },
  }])
  const savedAtPreviousPower = await persisted()

  await page.reload()
  await page.evaluate(() => { window.location.hash = '/optimize' })
  const presets = page.getByRole('region', { name: '条件を保存して再利用' })
  await presets.getByLabel('保存済み条件').selectOption({ label: '矢1本で発射モード比較' })
  await presets.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.getByText('候補数の上限推定: 2通り', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  const results = page.getByRole('region', { name: '最適化結果', exact: true })
  await expect(results.locator('.recommended-build .build-equipment.ranged')).toContainText('矢1本 · 弓・フルチャージ')
  await expect(results.locator('.alternatives').first()).toContainText('矢1本 · 弓・未チャージ')

  await page.evaluate(() => { window.location.hash = '/inventory' })
  await openEditor()
  await editor.getByRole('spinbutton', { name: /のPower$/ }).fill('253')
  await expect.poll(persisted).toEqual([{
    instanceId: 'modes-bow', weaponId: 'bow', powerLevel: 253, enchantmentSlots: [],
  }])

  await page.evaluate(({ key, savedAtPreviousPower }) => {
    const stored = JSON.parse(localStorage.getItem(key)!)
    stored.inventory.rangedWeapons = [{ ...savedAtPreviousPower[0], powerLevel: 253 }]
    localStorage.setItem(key, JSON.stringify(stored))
  }, { key: inventoryKey, savedAtPreviousPower })
  await page.reload()
  await openEditor()
  await expect(damage).toHaveValue('')
  await expect(cycle).toHaveValue('')
  await expect(editor.getByRole('button', { name: '比較用の発射モードを解除' })).toHaveCount(0)
  await editor.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('すべて入力')
})
