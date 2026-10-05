import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'
import { verifyValueRawTraceProvenance } from '../scripts/formal-value-source-provenance.ts'

const repositoryRoot = fs.realpathSync('.')
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8')) as {
  provenance: { evidence: { provenance: RawTrace }[] }
}
const traces = artifact.provenance.evidence.map(({ provenance }) => provenance)
  .filter(({ artifactPath }) => artifactPath.startsWith('research/raw/packages/'))
const sources = [...new Map(traces.map((trace) => [trace.artifactPath, trace])).values()]
const roots: string[] = []

afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

describe('Full Raw snapshot Value provenance compatibility', () => {
  it('resolves every committed full-Raw Value occurrence across all three source packages', () => {
    expect(sources).toHaveLength(3)
    for (const trace of traces) {
      expect(verifyValueRawTraceProvenance(repositoryRoot, trace).sourceKind).toBe('full-raw-snapshot')
    }
  })

  describe.each(sources)('$packagePath', (trace) => {
    it.each([
      ['old schema', { schemaVersion: 1 }],
      ['future schema', { schemaVersion: 99 }],
      ['missing schema', { schemaVersion: undefined }],
      ['wrong kind', { snapshotKind: 'other-snapshot' }],
      ['missing kind', { snapshotKind: undefined }],
      ['wrong parser', { parser: { id: 'other-parser', schemaVersion: 1 } }],
      ['future parser schema', { parser: { id: 'ue4-package-property-parser', schemaVersion: 99 } }],
      ['missing parser', { parser: undefined }],
    ])('rejects %s before resolving an otherwise unchanged occurrence', (_label, change) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'formal-value-raw-header-'))
      roots.push(root)
      const raw = JSON.parse(fs.readFileSync(path.join(repositoryRoot, trace.artifactPath), 'utf8'))
      if ('parser' in change) raw.extraction.parser = change.parser
      else Object.assign(raw, change)
      const file = path.join(root, trace.artifactPath)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(raw))
      expect(() => verifyValueRawTraceProvenance(root, trace)).toThrow(/Unsupported Raw snapshot (header|parser)/)
    })
  })
})
