import { describe, expect, it } from 'vitest'
import { nextInventoryGridIndex } from '../src/inventory/gridKeyboardNavigation'

describe('inventory grid keyboard navigation', () => {
  it('moves horizontally without wrapping between rows', () => {
    expect(nextInventoryGridIndex(0, 7, 3, 'ArrowRight')).toBe(1)
    expect(nextInventoryGridIndex(2, 7, 3, 'ArrowRight')).toBe(2)
    expect(nextInventoryGridIndex(3, 7, 3, 'ArrowLeft')).toBe(3)
    expect(nextInventoryGridIndex(4, 7, 3, 'ArrowLeft')).toBe(3)
  })

  it('moves vertically by the rendered column count and stays at row boundaries', () => {
    expect(nextInventoryGridIndex(1, 7, 3, 'ArrowDown')).toBe(4)
    expect(nextInventoryGridIndex(4, 7, 3, 'ArrowUp')).toBe(1)
    expect(nextInventoryGridIndex(5, 7, 3, 'ArrowDown')).toBe(5)
    expect(nextInventoryGridIndex(1, 7, 3, 'ArrowUp')).toBe(1)
  })

  it('moves to the first or last option and safely handles invalid dimensions', () => {
    expect(nextInventoryGridIndex(4, 7, 3, 'Home')).toBe(0)
    expect(nextInventoryGridIndex(0, 7, 3, 'End')).toBe(6)
    expect(nextInventoryGridIndex(0, 3, 0, 'ArrowDown')).toBe(1)
    expect(nextInventoryGridIndex(Number.NaN, 3, 2, 'ArrowDown')).toBe(2)
    expect(nextInventoryGridIndex(0, 0, 3, 'End')).toBe(-1)
  })
})
