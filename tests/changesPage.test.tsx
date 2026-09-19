import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CHANGE_ENTRIES, parseChangesMarkdown } from '../src/data/changes'
import { ChangesPage } from '../src/screens/ChangesPage'

describe('changes markdown adapter', () => {
  it('parses dated sections and bullets from the canonical markdown', () => {
    expect(parseChangesMarkdown('# Changes\n\n## 2026-09 — Example\n\n- First\n- Second')).toEqual([
      { date: '2026-09', title: 'Example', bullets: ['First', 'Second'] },
    ])
  })

  it('renders the canonical changelog instead of a hard-coded subset', () => {
    expect(CHANGE_ENTRIES.length).toBeGreaterThan(4)
    const html = renderToStaticMarkup(<ChangesPage />)
    for (const text of ['Personal Research Quest', 'Coverage Priority', 'Ranged observed-value MVP']) expect(html).toContain(text)
    expect(html).toContain('Git履歴が詳細の正本')
  })
})
