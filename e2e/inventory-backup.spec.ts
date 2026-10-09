import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'

test('backup files round-trip and stage without replacing stored inventory', async ({ page }) => {
  const fixture = { version: 5, inventory: {
    weapons: [{ instanceId: 'backup-melee', weaponId: 'double-axe', powerLevel: 251, rarity: 'rare', notes: 'SYNTHETIC backup fixture — not Evidence', enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'], selected: { enchantmentId: 'critical-hit', tier: 2 } }], gilded: { enchantmentId: 'void-strike', tier: 3 } }],
    armors: [{ instanceId: 'backup-armor', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 0, enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 1 } }] }],
    rangedWeapons: [{ instanceId: 'backup-ranged', weaponId: 'bow', powerLevel: 250, enchantmentSlots: [{ candidates: ['power'] }] }],
    artifacts: [{ instanceId: 'backup-artifact-1', artifactId: 'iron-hide-amulet', powerLevel: 248 }, { instanceId: 'backup-artifact-2', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    catalogItems: [{ instanceId: 'backup-catalog', category: 'armor', catalogId: 'champion-s-armor', powerLevel: 251, notes: 'Unknown effects stay research-only', research: { observations: [{ parameterId: 'incoming-damage', value: 'unknown', notes: 'SYNTHETIC — not Evidence' }] } }],
  } }
  const normalizedFixture = { version: 6, inventory: fixture.inventory }
  await page.goto('/#/storage')
  await page.getByRole('textbox', { name: 'Inventory JSON' }).fill(JSON.stringify(fixture))
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(normalizedFixture)
  const json = page.getByRole('textbox', { name: 'Inventory JSON' })
  await expect(json).toBeVisible()
  await page.getByRole('button', { name: '現在の装備を書き出す', exact: true }).click()
  const current = await json.inputValue()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(current)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSONファイルを保存', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mcd-inventory-\d{4}-\d{2}-\d{2}\.json$/)
  const saved = await readFile((await download.path())!, 'utf8')
  expect(saved).toBe(current)
  expect(JSON.parse(saved)).toEqual(normalizedFixture)
  const replacement = JSON.stringify({ version: 1, inventory: { weapons: [], artifacts: [] } })
  const fileInput = page.getByLabel('JSONファイルを選択', { exact: true })
  await fileInput.setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(replacement) })
  await expect(json).toHaveValue(replacement)
  await expect(page.getByRole('status').filter({ hasText: 'ファイルを検証' })).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(current)
  await fileInput.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') })
  await expect(page.getByRole('alert').filter({ hasText: 'JSONの構文' })).toBeVisible()
  await expect(json).toHaveValue(replacement)
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(current)
  await fileInput.setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99,"inventory":{}}') })
  await expect(page.getByRole('alert').filter({ hasText: '対応していないデータ形式' })).toBeVisible()
  await expect(json).toHaveValue(replacement)
  // Selecting the same valid file again must work after input reset.
  await fileInput.setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(replacement) })
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual({ version: 6, inventory: { weapons: [], artifacts: [] } })
  await fileInput.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(saved) })
  await expect(json).toHaveValue(saved)
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(current)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: '現在の装備を書き出す', exact: true }).click()
  await expect(json).toHaveValue(current)
})


test('invalid saved data is retained while a valid file is staged for recovery', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken-original'), storageKey)
  await page.goto('/#/storage')
  const json = page.getByRole('textbox', { name: 'Inventory JSON' })
  await expect(json).toHaveValue('{broken-original')
  await expect(page.getByRole('button', { name: 'JSONファイルを保存', exact: true })).toBeDisabled()
  await page.evaluate(() => {
    File.prototype.text = () => new Promise<string>((_resolve, reject) => {
      Object.assign(window, { rejectBackupRead: () => reject(new Error('Synthetic read failure')) })
    })
  })
  const input = page.getByLabel('JSONファイルを選択', { exact: true })
  const recovery = JSON.stringify({ version: 5, inventory: { weapons: [], artifacts: [] } })
  await input.setInputFiles({ name: 'unreadable.json', mimeType: 'application/json', buffer: Buffer.from(recovery) })
  await expect(json).toBeDisabled()
  await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'JSONを読み込む', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '現在の装備を書き出す', exact: true })).toBeDisabled()
  await page.evaluate(() => { (window as unknown as { rejectBackupRead: () => void }).rejectBackupRead() })
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic read failure' })).toBeVisible()
  await expect(json).toBeEnabled()
  await expect(input).toBeEnabled()
  await expect(json).toHaveValue('{broken-original')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('{broken-original')
  await page.reload()
  await input.setInputFiles({ name: 'recovery.json', mimeType: 'application/json', buffer: Buffer.from(recovery) })
  await expect(json).toHaveValue(recovery)
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('{broken-original')
  await page.getByRole('button', { name: 'JSONを読み込む', exact: true }).click()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(JSON.stringify({ ...JSON.parse(recovery), version: 6 }, null, 2))
  await expect(page.getByRole('button', { name: 'JSONファイルを保存', exact: true })).toBeEnabled()
})
