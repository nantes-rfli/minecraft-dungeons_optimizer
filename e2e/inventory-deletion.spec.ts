import { test, expect } from '@playwright/test'
import type { Inventory } from '../src/core'
import { performanceInventory } from '../tests/performanceFixtures'

const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
const supported = performanceInventory('small')
const cases: { name: string; collection: keyof Inventory; item: { instanceId: string } }[] = [
  { name: 'runtime melee', collection: 'weapons', item: supported.weapons[0]! },
  { name: 'runtime armor', collection: 'armors', item: supported.armors![0]! },
  { name: 'runtime ranged', collection: 'rangedWeapons', item: supported.rangedWeapons![0]! },
  { name: 'runtime artifact', collection: 'artifacts', item: supported.artifacts[0]! },
  ...([
    ['melee', 'diamond-sword'], ['armor', 'hungry-horror'],
    ['ranged', 'bow-of-lost-souls'], ['artifact', 'blast-fungus'],
  ] as const).map(([category, catalogId]) => ({
    name: `catalog ${category}`, collection: 'catalogItems' as const,
    item: { instanceId: `catalog-${category}`, category, catalogId, powerLevel: 251, notes: '保持するメモ', research: { observations: [{ parameterId: 'unknown-test', value: '未確認', notes: 'SYNTHETIC UI FIXTURE — not Evidence' }] } },
  })),
]

test('inventory grid options support spatial keyboard selection', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const inventory: Inventory = {
    weapons: Array.from({ length: 6 }, (_, index) => ({ instanceId: `keyboard-${index}`, weaponId: 'double-axe', powerLevel: 250 + index, rarity: 'unique', enchantmentSlots: [] })),
    armors: [], rangedWeapons: [], artifacts: [], catalogItems: [],
  }
  const json = JSON.stringify({ version: 5, inventory })
  await page.addInitScript(({ key, json }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, json) }, { key: storageKey, json })
  await page.goto('/#/inventory')

  const listbox = page.getByRole('listbox', { name: '所持装備', exact: true })
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(6)
  await expect(options.nth(0)).toHaveAttribute('tabindex', '0')
  await expect(options.nth(1)).toHaveAttribute('tabindex', '-1')
  await options.nth(0).focus()
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(3)).toBeFocused()
  await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(options.nth(0)).toBeFocused()
  await page.keyboard.press('End')
  await expect(options.nth(5)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(options.nth(0)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(options.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(options.nth(1)).toHaveAttribute('tabindex', '0')
  await expect(options.nth(0)).toHaveAttribute('tabindex', '-1')
  await expect(page.getByRole('complementary', { name: '選択した装備の詳細' })).toContainText('Double Axe')

  await page.getByRole('spinbutton', { name: 'Power 最小値' }).fill('253')
  const filteredOptions = listbox.getByRole('option')
  await expect(filteredOptions).toHaveCount(3)
  await expect(filteredOptions.first()).toHaveAttribute('tabindex', '0')
  await filteredOptions.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(filteredOptions.nth(1)).toBeFocused()
})

for (const view of ['list', 'compact', 'grid'] as const) {
  for (const target of cases) {
    test(`${view} ${target.name}: cancel preserves data; confirm deletes only selected instance`, async ({ page }) => {
      const other = { ...target.item, instanceId: 'same-name-other-instance' }
      const initial = { weapons: [], artifacts: [], [target.collection]: [target.item, other] }
      const expected = { ...initial, [target.collection]: [other] }
      const json = JSON.stringify({ version: 5, inventory: initial })
      await page.addInitScript(({ key, json }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, json) }, { key: storageKey, json })
      await page.goto('/#/inventory')
      let button
      if (view !== 'grid') {
        await page.getByRole('button', { name: view === 'list' ? 'リスト' : 'コンパクト', exact: true }).click()
        const editor = page.locator('.equipment-card').first()
        await editor.locator(':scope > summary').click()
        button = editor.locator('.danger-button')
      } else {
        await page.getByRole('listbox', { name: '所持装備', exact: true }).getByRole('option').first().click()
        button = page.getByRole('complementary', { name: '選択した装備の詳細' }).getByRole('button', { name: /を削除$/ })
      }
      const label = (await button.getAttribute('aria-label'))!.replace(/を削除$/, '')
      const cancelled = page.waitForEvent('dialog', { timeout: 3000 })
      await button.focus()
      const cancelClick = button.press('Enter')
      const cancelDialog = await cancelled
      expect(cancelDialog.type()).toBe('confirm')
      expect(cancelDialog.message()).toContain(label)
      await cancelDialog.dismiss()
      await cancelClick
      await expect(button).toBeVisible()
      await expect(button).toBeFocused()
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(initial)
      const accepted = page.waitForEvent('dialog', { timeout: 3000 })
      const acceptClick = button.click()
      await (await accepted).accept()
      await acceptClick
      // Grid removal currently materializes empty optional collections.
      const persisted = view === 'grid' ? { armors: [], rangedWeapons: [], catalogItems: [], ...expected } : expected
      await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(persisted)
      await page.reload()
      await expect(page.getByRole('status').filter({ hasText: '1件を表示' })).toBeVisible()
      await page.evaluate(() => { window.location.hash = '/storage' })
      await page.getByRole('button', { name: '現在の装備を書き出す' }).click()
      const exported = JSON.parse(await page.getByRole('textbox', { name: 'Inventory JSON' }).inputValue())
      expect(exported.inventory).toEqual(persisted)
    })
  }
}
