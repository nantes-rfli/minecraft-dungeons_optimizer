import backlogJson from '../../../research/runtime/runtime-backlog.json'
import type { BacklogEntry, CoverageBlocker } from './model'

export const RUNTIME_BACKLOG = backlogJson.entries as readonly BacklogEntry[]
export const BACKLOG_HEADERS = ['Enchant / subsystem', 'Support', 'What works', 'What is blocked', 'Closeに必要なEvidence / 実装条件', 'Priority', 'Status'] as const
export const backlogCells = (entry: BacklogEntry): readonly string[] => [entry.label, entry.support, entry.whatWorks, entry.blocked, entry.closeCondition, entry.priority, entry.kind]
const escapeCell = (cell: string) => cell.replaceAll('|', '\\|').replaceAll('\n', '<br>')

export function renderBacklogTable(entries: readonly BacklogEntry[] = RUNTIME_BACKLOG): string {
  return [BACKLOG_HEADERS, BACKLOG_HEADERS.map(() => '---'), ...entries.map(backlogCells)].map((cells) => `| ${cells.map(escapeCell).join(' | ')} |`).join('\n')
}

/** Strict table reader for migration validation, never a classifier of free-form descriptions. */
export function readTableRows(table: string): string[][] {
  return table.trim().split('\n').map((line) => {
    if (!line.startsWith('|') || !line.endsWith('|')) throw new Error('Expected a delimited Markdown table row')
    const cells: string[] = []
    let cell = ''
    let escaped = false
    for (const char of line.slice(1, -1)) {
      if (escaped) { cell += char; escaped = false }
      else if (char === '\\') escaped = true
      else if (char === '|') { cells.push(cell.trim()); cell = '' }
      else cell += char
    }
    if (escaped) throw new Error('Unterminated table escape')
    cells.push(cell.trim())
    if (cells.length !== BACKLOG_HEADERS.length) throw new Error('Backlog table column count changed')
    return cells
  })
}

export function collectBacklogMigrationErrors(originalTable: string, entries: readonly BacklogEntry[]): string[] {
  try {
    const original = readTableRows(originalTable)
    const regenerated = readTableRows(renderBacklogTable(entries))
    return JSON.stringify(original) === JSON.stringify(regenerated) ? [] : ['Backlog migration lost or changed a row/cell']
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}
export function buildBacklogBlockers(entries: readonly BacklogEntry[] = RUNTIME_BACKLOG): CoverageBlocker[] {
  return entries.map((entry, index) => ({ id: `backlog:${entry.id}`, label: entry.label, categories: entry.categories, recordKeys: entry.recordKeys, kind: entry.kind, priority: entry.priority, origin: 'backlog', description: entry.blocked, closeCondition: entry.closeCondition, sourceRefs: [`research/runtime/runtime-backlog.json#/entries/${index}`, ...entry.sourceRefs], supportContext: entry.support }))
}
