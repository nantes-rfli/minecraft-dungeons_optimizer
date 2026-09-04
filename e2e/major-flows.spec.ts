import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { performanceInventory, PERFORMANCE_SCENARIO, PERFORMANCE_SIZES } from '../tests/performanceFixtures'

async function openJson(page: Page) {
  await page.getByText('保存データ / JSON', { exact: true }).click()
  return page.getByRole('textbox', { name: 'Inventory JSON' })
}
async function optimize(page: Page) {
  await page.getByRole('button', { name: '最適化を開始', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索完了' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.result-meta')).toContainText('全探索')
}
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  console.log(JSON.stringify(results.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }))))
  expect(results.violations).toEqual([])
}

test('major equipment flow, observed ranged, locks, gilded, JSON and persistence', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '＋ ダブルアックス', exact: true }).click()
  await page.getByRole('button', { name: '＋ バトルローブ', exact: true }).click()
  const firstWeapon = page.locator('details.inventory-item').first()
  await firstWeapon.getByRole('combobox', { name: 'スロット1の確定済みエンチャント' }).selectOption('critical-hit')
  await firstWeapon.getByRole('checkbox', { name: '金色エンチャントを含める', exact: true }).check()
  await firstWeapon.getByRole('combobox', { name: /の金色エンチャント$/, exact: false }).selectOption('sharpness')
  await page.getByRole('button', { name: '遠距離武器を追加', exact: true }).click()
  await page.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '観測値とメモ' })).toBeVisible()
  await page.getByRole('spinbutton', { name: /ranged-.* damage$/ }).fill('100000')
  await page.getByRole('spinbutton', { name: /ranged-.* cycle$/ }).fill('1')
  await page.getByRole('spinbutton', { name: /ranged-.* ammo$/ }).fill('50')
  await page.getByRole('textbox', { name: /ranged-.* 観測メモ$/ }).fill('SYNTHETIC E2E — not Evidence')
  await page.getByRole('button', { name: '観測値を適用', exact: true }).click()
  await expect(page.getByRole('button', { name: '観測値を適用', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Rangedスロットを追加', exact: true }).click()
  await page.getByRole('combobox', { name: /ranged-.* slot 1 lock$/ }).selectOption('power')
  await page.getByRole('checkbox', { name: 'Ranged 金色エンチャント', exact: true }).check()
  await page.getByRole('button', { name: '＋ シロタマゴテングタケ', exact: true }).click()
  await page.locator('.profile-buttons button').nth(1).click()
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.2')
  await optimize(page)
  await expect(page.getByRole('region', { name: '遠距離の評価内訳' }).first()).toContainText('直接遠距離DPS')
  await audit(page)
  const json = await openJson(page)
  await page.getByRole('button', { name: '書き出す', exact: true }).click()
  const exported = await json.inputValue()
  const data = JSON.parse(exported)
  expect(data.version).toBe(2)
  expect(data.inventory.rangedWeapons[0].gilded.enchantmentId).toBe('critical-hit')
  await json.fill('{invalid')
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(json).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert').filter({ hasText: 'JSONの構文' })).toBeVisible()
  await json.fill(exported)
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.locator('.result-meta')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('minecraft-dungeons-optimizer.inventory.v1')!).inventory.rangedWeapons?.[0].observation.sourceNote)).toBe('SYNTHETIC E2E — not Evidence')
  await page.reload()
  const restored = await openJson(page)
  await page.getByRole('button', { name: '書き出す', exact: true }).click()
  expect(JSON.parse(await restored.inputValue())).toEqual(data)
  const changed = structuredClone(data)
  changed.inventory.rangedWeapons[0].observation.projectileDamage = 123456
  await restored.fill(JSON.stringify(changed))
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: /ranged-.* damage$/ })).toHaveValue('123456')
  // Scenario is deliberately session-only; restore its explicit ranged allocation.
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.2')
  await optimize(page)
  await page.getByRole('combobox', { name: /ranged-.* slot 1 候補 1$/, exact: false }).selectOption('multishot')
  await page.getByRole('button', { name: '最適化を開始', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No supported Ranged candidates' })).toBeVisible()
  await expect(page.locator('.result-meta')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('no-ranged flow, keyboard controls, error recovery and methodology a11y', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused()
  const start = page.getByRole('button', { name: '最適化を開始', exact: true })
  await start.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.result-meta')).toContainText('全探索', { timeout: 60_000 })
  await page.getByRole('spinbutton', { name: '平均敵HP', exact: true }).fill('0')
  await expect(page.locator('.result-meta')).toHaveCount(0)
  await start.click()
  await expect(page.getByRole('alert').filter({ hasText: 'averageEnemyHealth' })).toBeVisible()
  await page.getByRole('spinbutton', { name: '平均敵HP', exact: true }).fill('1000000')
  await optimize(page)
  await audit(page)
  await page.getByRole('link', { name: '仕組み・実装状況', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'current implementation checklist', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '本文へ移動' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page.getByRole('heading', { name: 'current implementation checklist', exact: true })).toBeVisible()
  await audit(page)
})

test('real browser Worker performance, responsive cancellation and guard', async ({ page }, testInfo) => {
  await page.goto('/')
  const metrics = await page.evaluate(async ({ fixtures, scenario }) => {
    // Use the same module worker entry as the application, through Vite in E2E.
    const records = []
    for (const { size, inventory } of fixtures) {
      const worker = new Worker('/src/optimizer/worker.ts', { type: 'module' })
      let ticks = 0
      let maxGapMs = 0
      let last = performance.now()
      const interval = setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - last); last = now; ticks++ }, 10)
      const started = performance.now()
      try {
        const result = await new Promise<{ type: string; error?: string; result?: { evaluatedBuildCount: number }; durationMs?: number }>((resolve, reject) => {
          worker.onmessage = ({ data }) => resolve(data)
          worker.onerror = () => reject(new Error('Worker failed'))
          worker.postMessage({ id: 1, inventory, scenario })
        })
        if (result.type !== 'complete') throw new Error(result.error)
        records.push({ size, evaluatedCandidates: result.result!.evaluatedBuildCount, workerMs: result.durationMs, wallClockMs: performance.now() - started, ticks, maxGapMs })
      } finally { clearInterval(interval); worker.terminate() }
    }
    return records
  }, { fixtures: PERFORMANCE_SIZES.map((size) => ({ size, inventory: performanceInventory(size) })), scenario: PERFORMANCE_SCENARIO })
  await testInfo.attach('performance.json', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify(metrics))
  expect(metrics.map((item) => item.evaluatedCandidates)).toEqual([32, 864, 6912])
  expect(metrics[2]!.ticks).toBeGreaterThan(1)
  // Generous browser responsiveness smoke check, not a precise timing gate.
  expect(metrics[2]!.maxGapMs).toBeLessThan(2000)
  const json = await openJson(page)
  await json.fill(JSON.stringify({ version: 2, inventory: performanceInventory('large') }))
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await page.getByRole('spinbutton', { name: '遠距離時間割合', exact: true }).fill('0.2')
  await page.getByRole('button', { name: '最適化を開始', exact: true }).click()
  await page.getByRole('button', { name: '探索を中止', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '探索を中止しました' })).toBeVisible()
  await expect(page.locator('.result-meta')).toHaveCount(0)
  await optimize(page)
  // Editing during a new search invalidates it and permits another run.
  await page.getByRole('button', { name: '最適化を開始', exact: true }).click()
  await page.getByRole('spinbutton', { name: '平均敵HP', exact: true }).fill('2000000')
  await expect(page.locator('.result-meta')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '探索を中止', exact: true })).toBeDisabled()
  const huge = performanceInventory('large')
  await json.fill(JSON.stringify({ version: 2, inventory: { ...huge, weapons: Array.from({ length: 4 }, (_, i) => huge.weapons.map((w) => ({ ...w, instanceId: `${w.instanceId}-extra-${i}` }))).flat() } }))
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '安全上限' })).toBeVisible()
  await expect(page.getByRole('button', { name: '最適化を開始', exact: true })).toBeDisabled()
})
