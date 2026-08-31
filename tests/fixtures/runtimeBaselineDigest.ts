import { createHash } from 'node:crypto'

// Preserve undefined/non-finite values; normal JSON would silently erase them.
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => {
    if (item === undefined) return { $undefined: true }
    if (typeof item === 'number' && !Number.isFinite(item)) return { $number: String(item) }
    return item
  })).digest('hex')
}

export function fieldDigests(result: object): Record<string, string> {
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, digest(value)]))
}
