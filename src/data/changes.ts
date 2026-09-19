import changesMarkdown from '../../docs/changes.md?raw'

export interface ChangeEntry {
  readonly date: string
  readonly title: string
  readonly bullets: readonly string[]
}

export function parseChangesMarkdown(markdown: string): ChangeEntry[] {
  const entries: ChangeEntry[] = []
  let current: { date: string; title: string; bullets: string[] } | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s+—\s+(.+)$/.exec(line)
    if (heading) {
      if (current) entries.push(current)
      current = { date: heading[1]!.trim(), title: heading[2]!.trim(), bullets: [] }
      continue
    }
    const bullet = /^-\s+(.+)$/.exec(line)
    if (bullet && current) current.bullets.push(bullet[1]!.trim())
  }
  if (current) entries.push(current)
  return entries
}

export const CHANGE_ENTRIES: readonly ChangeEntry[] = parseChangesMarkdown(changesMarkdown)
