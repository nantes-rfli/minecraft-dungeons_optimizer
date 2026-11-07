import { expect, test } from '@playwright/test'
import type { CatalogInventoryItem } from '../src/core/types'

test('both fixed-proc weapons migrate, evaluate with one owned builtin and preserve research through comparison and reload', async ({ page }) => {
  // Synthetic software data only, not gameplay observations or independent DPS Evidence.
  const targets = [{ id: 'whirlwind', effect: 'shockwave', name: 'Shockwave', intrinsic: ['Spin attack', 'Casts shockwaves'] }, { id: 'stormlander', effect: 'thundering', name: 'Thundering', intrinsic: ['Great splash', 'Fires lighting bolts'] }]
  const catalogItems: CatalogInventoryItem[] = targets.map(({ id, effect, intrinsic }) => ({
    instanceId: `legacy-${id}`, category: 'melee', catalogId: id, powerLevel: 251,
    rarity: 'unique', isFavorite: true, notes: 'SYNTHETIC fixed effect migration',
    enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 2 } }],
    research: { enchantments: [{ enchantmentId: effect, tier: 1, source: 'built-in' }, { enchantmentId: 'critical-hit', tier: 2, source: 'slot' }], intrinsicProperties: intrinsic.map((raw) => ({ kind: 'intrinsicMechanicOwnership', raw })), observations: [{ parameterId: 'unaccepted-source-note', value: 'unknown', notes: 'retained, never a runtime number' }] },
  }))
  const storageKey = 'minecraft-dungeons-optimizer.inventory.v1'
  await page.addInitScript(({ key, json }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, json) }, { key: storageKey, json: JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems } }) })
  await page.goto('/#/inventory')
  const panel = page.getByRole('region', { name: '所持装備の評価可能性' })
  await expect(panel.getByRole('status')).toContainText('確認しました')
  await expect(panel.locator('.readiness-counts')).toContainText('条件・組み合わせ制約2件')
  await page.evaluate(() => { window.location.hash = '/optimize' })
  await page.getByText('詳細条件', { exact: true }).click()
  await page.locator('label').filter({ hasText: '射程内の敵' }).getByRole('slider').press('Home')
  await page.getByRole('button', { name: '最適化する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible()
  const results = page.getByRole('region', { name: '最適化結果', exact: true })
  const recommended = results.locator('.recommended-build')
  await expect(recommended.locator('.build-equipment.melee .enchant-source.built-in')).toHaveCount(1)
  const builtin = recommended.locator('.build-equipment.melee .build-enchantments li').filter({ has: page.locator('.enchant-source.built-in') })
  await expect(builtin).toContainText(/Shockwave|Thundering/)
  await results.getByText('計算と Evidence の詳細を見る', { exact: true }).click()
  await results.getByText('効果ごとの数値寄与を見る', { exact: true }).click()
  const contribution = results.locator('.contribution-table tbody tr').filter({ hasText: 'Built-in' })
  await expect(contribution).toHaveCount(1)
  expect(Number((await contribution.locator('td').nth(1).innerText()).replaceAll(',', ''))).toBeGreaterThan(0)
  await page.getByRole('button', { name: '用途別に評価する', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '用途別評価が完了' })).toBeVisible()
  for (const { id, name } of targets) {
    const row = page.locator('.assessment-table tbody tr').filter({ hasText: `legacy-${id}` })
    await row.getByRole('button', { name: `legacy-${id}の現在の条件の構成を見る`, exact: true }).click()
    const inspected = page.getByRole('region', { name: '用途別の個体必須構成', exact: true })
    await expect(inspected).toContainText(`legacy-${id}`)
    const composition = inspected.locator('.alternative-composition')
    if (await composition.getAttribute('open') === null) await composition.locator(':scope > summary').click()
    await expect(inspected.locator('.enchant-source.built-in')).toHaveCount(1)
    await expect(inspected.locator('.enchant-source.built-in')).toBeVisible()
    await expect(inspected).toContainText(name)
    await expect(inspected).toContainText('Built-in')
  }
  await page.evaluate(() => { window.location.hash = '/inventory' })
  await expect(panel.getByRole('status')).toContainText('確認しました')
  await expect(panel.locator('.readiness-counts')).toContainText('評価可能2件')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)
  expect(stored.catalogItems).toEqual([])
  expect(stored.weapons.map((item: { weaponId: string }) => item.weaponId)).toEqual(targets.map(({ id }) => id))
  for (const [index, item] of stored.weapons.entries()) {
    expect(item).toMatchObject({ instanceId: catalogItems[index]!.instanceId, powerLevel: 251, rarity: 'unique', isFavorite: true, notes: catalogItems[index]!.notes, enchantmentSlots: catalogItems[index]!.enchantmentSlots, research: catalogItems[index]!.research })
    expect(item.observedDamagePerHit).toBeUndefined()
  }
  await page.reload()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).inventory, storageKey)).toEqual(stored)
})
