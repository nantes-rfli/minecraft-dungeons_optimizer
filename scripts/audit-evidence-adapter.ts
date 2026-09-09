import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import registry from '../research/external-community/registry.json' with { type: 'json' }
import { validateLedger, toLegacyEvidence, assertIndependent } from '../src/research/evidenceAdapter/model.ts'
import type { EvidenceLedger } from '../src/research/evidenceAdapter/model.ts'

// Hashes identify our retained registry records, not uncaptured remote pages.
const ledger: EvidenceLedger = {
  schemaVersion: 1,
  sources: registry.sources.map((s) => ({
    id: `${s.id}@1`, sourceId: s.id, revision: 1,
    reference: { id: s.id, label: s.id, url: s.url, kind: 'published-reference' },
    retrievedAt: s.reviewedAt,
    snapshot: { sha256: createHash('sha256').update(JSON.stringify(s)).digest('hex'), reason: 'SHA256 of retained registry source record; remote page snapshot unavailable.' },
    originGroup: s.independenceGroup === 'unresolved' ? null : s.independenceGroup,
    reviewed: ['content-reviewed', 'data-extracted'].includes(s.retrievalStatus),
  })),
  claims: registry.claims.map((c) => ({
    id: `${c.id}@1`, claimId: c.id, revision: 1, sourceRevisionIds: c.sourceIds.map((id) => `${id}@1`),
    entity: null, property: c.property, kind: c.kind, statement: c.statement, locator: c.locator,
    value: c.value, unknownReason: c.value === null ? 'No typed numeric/value payload captured; statement is retained without interpreting it as a runtime value.' : null,
    unit: null, conditions: Object.fromEntries(Object.entries(c.conditions)), gameVersion: c.gameVersion,
  })),
  relations: ['dr-armor-iron', 'dr-armor-iron-guard', 'dr-barrier-iron', 'dr-barrier-guard'].map((id) => ({
    id: `${id}-derivation@1`, from: `${id}@1`, to: 'dr-family@1', kind: 'derived-from', overlap: 'partial',
    reason: 'Same author/post examples of the family formula, not independent observations.',
  })),
  decisions: registry.claims.map((c) => ({
    id: `${c.id}-adoption@1`, decisionId: `${c.id}-adoption`, revision: 1, claimId: `${c.id}@1`,
    status: 'research-only', purpose: 'research-comparison', conditions: Object.fromEntries(Object.entries(c.conditions)),
    gameVersion: null, blockers: [...c.blockers, 'entity-mapping-unverified', 'unit-unverified', 'game-version-unverified'],
    regression: 'not-run', confidence: 'low', reason: 'Preserve original research-only decision; adapter migration provides no new game validation.',
  })),
}
ledger.relations.push({ id: 'dynamo-conflict@1', from: 'damage-candidate@1', to: 'modifier-taxonomy@1', kind: 'contradicts', overlap: 'unknown', reason: 'Dynamo classification conflict; cross-property application scope is unresolved.' })
// Both numbers are quoted by the retained correction report; the original slide was not captured.
const erratum = ledger.claims.find((c) => c.claimId === 'growing-staff-erratum')!
for (const [suffix, value] of [['reported-old', 6.3], ['reported-corrected', 4.3]] as const) {
  const id = `growing-staff-${suffix}`
  ledger.claims.push({ ...erratum, id: `${id}@1`, claimId: id, entity: 'Growing Staff (guide label; runtime mapping unverified)', value, unit: 'hits/s', statement: `${erratum.statement} (${suffix}; correction report, not independently recovered slide)` })
  const decision = ledger.decisions.find((d) => d.claimId === erratum.id)!
  ledger.decisions.push({ ...decision, id: `${id}-adoption@1`, decisionId: `${id}-adoption`, claimId: `${id}@1` })
}
ledger.relations.push({ id: 'growing-staff-correction@1', from: 'growing-staff-reported-corrected@1', to: 'growing-staff-reported-old@1', kind: 'corrects', overlap: 'exact', reason: 'Same guide correction report only; does not replace the separately conditioned sheet value 4.43.' })
validateLedger(ledger)
const path = new URL('../research/external-community/evidence-ledger.json', import.meta.url)
const serialized = JSON.stringify(ledger, null, 2) + '\n'
if (process.argv.includes('--write')) fs.writeFileSync(path, serialized)
assert.equal(fs.readFileSync(path, 'utf8'), serialized, 'Evidence ledger drift; run generate:evidence-adapter')
for (const decision of ledger.decisions) {
  assert.throws(() => toLegacyEvidence(ledger, { decisionId: decision.id, entity: 'unmapped', property: '', purpose: 'runtime', gameVersion: '1.17.0.0', conditions: {}, accepts: (v): v is number => typeof v === 'number' }), /adoption blocked/)
}
assert.throws(() => assertIndependent(ledger, ['dr-family@1'], ['dr-armor-iron@1']), /duplicate origin/)
console.log(`Evidence adapter audit passed: ${ledger.sources.length} source revisions, ${ledger.claims.length} claim revisions, ${ledger.relations.length} relations, ${ledger.decisions.length} research-only decisions; promotions 0, Gap closures 0.`)
