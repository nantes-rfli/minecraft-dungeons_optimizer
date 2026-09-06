import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildRangedEnchantmentAudit, buildRangedWeaponAudit, collectRangedAuditErrors } from '../src/research/rangedAudit'
import { deserializeInventory, loadInventory, loadInventoryState, saveInventory, serializeInventory } from '../src/inventory/storage'
import { RangedInventorySection, RangedResult } from '../src/views/RangedEquipment'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { optimize } from '../src/core'
import type { Inventory } from '../src/core/types'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import { FUTURE_MILESTONES, FUTURE_EXPANSION_MILESTONES, ROADMAP_PHASES, ROADMAP_PROGRESS } from '../src/data/roadmap'

const legacy: Inventory = { weapons: [{ instanceId: 'm', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }], artifacts: [] }
const weapon: OwnedRangedWeapon = { instanceId: 'r', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [{ candidates: [{ enchantmentId: 'power', tier: 2 }, { enchantmentId: 'multishot', tier: 3 }], locked: 'power' }], gilded: { enchantmentId: 'critical-hit', tier: 1 }, observation: { gameVersion: '1.17.0.0', mode: 'charged', projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 10, sourceNote: 'SYNTHETIC TEST ONLY' } }
afterEach(() => vi.unstubAllGlobals())

describe('ranged population and persistence', () => {
  it('reconciles source sets without promoting conflicts or intrinsic-only effects', () => {
    expect(collectRangedAuditErrors()).toEqual([])
    const weapons = buildRangedWeaponAudit()
    const enchants = buildRangedEnchantmentAudit()
    expect(weapons.entries).toHaveLength(71)
    expect(weapons.population.commonIds).toHaveLength(71)
    expect(weapons.population.rarityDifferences).toHaveLength(7)
    expect(weapons.entries.filter((entry) => entry.rarity === 'unique')).toHaveLength(48)
    expect(enchants.entries).toHaveLength(41)
    expect(enchants.population.secondaryOnly).toEqual(['exploding', 'looting', 'weakening'])
    for (const id of ['void-strike', 'anima-conduit']) expect(enchants.entries.find((entry) => entry.id === id)).toMatchObject({ supportLevel: 'research-only', reuseMeleeRuntime: false, confidence: 'low' })
    expect(enchants.entries.some((entry) => entry.id === 'shadow-shot')).toBe(false)
    expect(weapons.entries.find((entry) => entry.id === 'crossbow')).toMatchObject({ multiProjectile: false, intrinsic: { families: ['projectile-velocity'] } })
    expect(weapons.entries.find((entry) => entry.id === 'harpoon-crossbow')?.intrinsic.families).not.toContain('cadence')
    expect(enchants.entries.find((entry) => entry.id === 'exploding')?.rarity).toBeNull()
  })
  it('detects population, provenance, numeric and support mutations', () => {
    const audit = buildRangedWeaponAudit()
    expect(collectRangedAuditErrors({ ...audit, entries: audit.entries.slice(1) })).not.toEqual([])
    const changed = { ...audit, entries: audit.entries.map((entry) => entry.id === 'bow' ? { ...entry, supportLevel: 'full', shotsPerSecond: 99 as unknown as null, sourceIds: ['invented'] } : entry) }
    expect(collectRangedAuditErrors(changed).join(' ')).toMatch(/support drift/)
    expect(collectRangedAuditErrors(changed).join(' ')).toMatch(/invented projectile/)
    const enchants = buildRangedEnchantmentAudit()
    expect(collectRangedAuditErrors(audit, { ...enchants, entries: enchants.entries.map((entry) => entry.id === 'power' ? { ...entry, runtimeTiers: { 1: 99, 2: 99, 3: 99 } } : entry) })).not.toEqual([])
  })
  it('imports old JSON losslessly without adding optional ranged fields', () => {
    expect(deserializeInventory(JSON.stringify({ version: 1, inventory: legacy }))).toEqual(legacy)
    expect(deserializeInventory(serializeInventory(legacy))).not.toHaveProperty('rangedWeapons')
    expect(JSON.parse(serializeInventory(legacy)).version).toBe(2)
  })
  it.each([1, 2, 3] as const)('round-trips Gilded %s and locked research-only alternatives', (tier) => {
    const inventory: Inventory = { ...legacy, rangedWeapons: [{ ...weapon, gilded: { enchantmentId: 'critical-hit', tier } }] }
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
    const research = { ...inventory, rangedWeapons: [{ ...weapon, weaponId: 'harp-crossbow', gilded: { enchantmentId: 'void-strike', tier } }] }
    expect(deserializeInventory(serializeInventory(research))).toEqual(research)
  })
  it('loads a legacy localStorage key and migrates only on save', () => {
    const key = 'minecraft-dungeons-optimizer.inventory.v1'
    const data = new Map([[key, JSON.stringify({ version: 1, inventory: legacy })]])
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
    expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(legacy)
    expect(JSON.parse(data.get(key)!).version).toBe(1)
    saveInventory({ ...legacy, rangedWeapons: [weapon] })
    expect(JSON.parse(data.get(key)!).version).toBe(2)
    expect(loadInventory(legacy).rangedWeapons).toEqual([weapon])
  })
  it('rejects malformed ranged fields without silently dropping them', () => {
    for (const rangedWeapons of [null, 'bad', [{ ...weapon, observation: { ...weapon.observation, projectileDamage: 0 } }], [{ ...weapon, instanceId: 'm' }], [{ ...weapon, enchantmentSlots: [{ candidates: [{ enchantmentId: 'power', tier: 4 }] }] }]]) {
      expect(() => deserializeInventory(JSON.stringify({ version: 2, inventory: { ...legacy, rangedWeapons } }))).toThrow()
    }
  })
  it('retains unreadable stored data and exposes the recovery error', () => {
    for (const raw of ['', '{bad json', JSON.stringify({ version: 99, inventory: legacy })]) {
      const setItem = vi.fn()
      vi.stubGlobal('localStorage', { getItem: () => raw, setItem })
      expect(() => loadInventory(legacy)).toThrow()
      expect(loadInventoryState(legacy)).toMatchObject({ inventory: legacy, storedJson: raw, error: expect.stringContaining('自動保存を停止') })
      expect(setItem).not.toHaveBeenCalled()
    }
  })
  it('does not overwrite valid storage with a partially edited inventory', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => serializeInventory(legacy), setItem })
    expect(() => saveInventory({ ...legacy, rangedWeapons: [{ ...weapon, powerLevel: 0 }] })).toThrow()
    expect(setItem).not.toHaveBeenCalled()
    expect(loadInventory(legacy)).toEqual(legacy)
  })
  it('renders controls, supported selection, source and separate damage channels', () => {
    const input = { ...legacy, rangedWeapons: [weapon] }
    const scenario = { ...DEFAULT_SCENARIO, rangedTimeShare: 0.5 }
    const markup = renderToStaticMarkup(<RangedInventorySection inventory={input} onChange={() => {}} scenario={scenario} onScenarioChange={() => {}} />)
    expect(markup).toContain('遠距離時間割合')
    expect(markup).toContain('research-only')
    expect(markup).toContain('Ranged Gilded Tier')
    expect(markup).toContain('観測値を適用')
    const result = renderToStaticMarkup(<RangedResult evaluation={optimize(input, scenario).best} />)
    expect(result).toContain('直接遠距離DPS')
    expect(result).toContain('間接遠距離DPS')
    expect(result).toContain('SYNTHETIC TEST ONLY')
  })
  it('keeps future milestones out of implementation progress and synchronizes both roadmaps', () => {
    const items = ROADMAP_PHASES.flatMap((phase) => phase.items)
    expect(ROADMAP_PROGRESS.total).toBe(items.length)
    expect(FUTURE_MILESTONES).toHaveLength(5)
    expect(FUTURE_EXPANSION_MILESTONES).toHaveLength(3)
    const text = fs.readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf8')
    for (const item of [...FUTURE_MILESTONES, ...FUTURE_EXPANSION_MILESTONES]) expect(text).toContain(item.title)
    expect(text).toContain(`${ROADMAP_PROGRESS.completed} / ${ROADMAP_PROGRESS.total}（${ROADMAP_PROGRESS.percentage}%）`)
  })
})
