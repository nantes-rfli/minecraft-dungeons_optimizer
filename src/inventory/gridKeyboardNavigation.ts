export type InventoryGridNavigationKey = 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'End' | 'Home'

export function nextInventoryGridIndex(currentIndex: number, itemCount: number, columnCount: number, key: InventoryGridNavigationKey): number {
  if (itemCount <= 0) return -1

  const current = Number.isFinite(currentIndex)
    ? Math.min(Math.max(Math.trunc(currentIndex), 0), itemCount - 1)
    : 0
  const columns = Number.isFinite(columnCount) && columnCount >= 1 ? Math.floor(columnCount) : 1

  switch (key) {
    case 'Home': return 0
    case 'End': return itemCount - 1
    case 'ArrowLeft': return current % columns === 0 ? current : current - 1
    case 'ArrowRight': return current % columns === columns - 1 || current === itemCount - 1 ? current : current + 1
    case 'ArrowUp': return current - columns < 0 ? current : current - columns
    case 'ArrowDown': return current + columns >= itemCount ? current : current + columns
  }
}
