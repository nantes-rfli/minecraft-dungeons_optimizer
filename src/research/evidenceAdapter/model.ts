import type { Confidence, Evidence, SourceReference } from '../../core/types'

export type Conditions = Record<string, string | number | boolean | null>
export interface SourceRevision {
  id: string
  sourceId: string
  revision: number
  reference: SourceReference
  retrievedAt: string | null
  snapshot: { sha256: string | null; reason: string }
  originGroup: string | null
  reviewed: boolean
}
export interface Claim {
  id: string
  claimId: string
  revision: number
  sourceRevisionIds: string[]
  entity: string | null
  property: string
  kind: string
  statement: string
  locator: string
  value: unknown
  unknownReason: string | null
  unit: string | null
  conditions: Conditions
  gameVersion: string | null
}
export interface ClaimRelation {
  id: string
  from: string
  to: string
  kind: 'supports' | 'contradicts' | 'corrects' | 'derived-from'
  overlap: 'exact' | 'partial' | 'unknown' | 'disjoint'
  reason: string
}
export interface AdoptionDecision {
  id: string
  decisionId: string
  revision: number
  claimId: string
  status: 'research-only' | 'limited' | 'full'
  purpose: string
  conditions: Conditions
  gameVersion: string | null
  blockers: string[]
  regression: 'not-run' | 'passed' | 'failed'
  confidence: Confidence
  reason: string
}
export interface EvidenceLedger {
  schemaVersion: 1
  sources: SourceRevision[]
  claims: Claim[]
  relations: ClaimRelation[]
  decisions: AdoptionDecision[]
}

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Evidence adapter: ${message}`)
}
function index<T extends { id: string }>(rows: T[]): Map<string, T> {
  const result = new Map(rows.map((row) => [row.id, row]))
  requireThat(result.size === rows.length && rows.every((row) => row.id.trim()), 'duplicate/empty IDs')
  return result
}
function versions(rows: { revision: number }[], keys: string[]) {
  requireThat(rows.every((row) => Number.isInteger(row.revision) && row.revision > 0), 'invalid revision')
  requireThat(new Set(keys).size === rows.length, 'duplicate logical revision')
}
export function sameConditions(a: Conditions, b: Conditions): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => Object.hasOwn(b, key) && b[key] === value)
}
function known(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0 && value.every(known)
  return typeof value === 'object' && Object.keys(value).length > 0 && Object.values(value).every(known)
}
export function validateLedger(ledger: EvidenceLedger): void {
  requireThat(ledger.schemaVersion === 1, 'unsupported schema')
  const sources = index(ledger.sources), claims = index(ledger.claims)
  index(ledger.relations); index(ledger.decisions)
  versions(ledger.sources, ledger.sources.map((s) => JSON.stringify([s.sourceId, s.revision])))
  versions(ledger.claims, ledger.claims.map((c) => JSON.stringify([c.claimId, c.revision])))
  versions(ledger.decisions, ledger.decisions.map((d) => JSON.stringify([d.decisionId, d.revision])))
  for (const source of ledger.sources) {
    requireThat(source.reference.id === source.sourceId && source.reference.label.trim(), 'invalid source reference')
    if (source.reference.url) requireThat(new URL(source.reference.url).protocol === 'https:', 'invalid source URL')
    requireThat(source.snapshot.sha256 === null ? source.snapshot.reason.trim() : /^[a-f0-9]{64}$/.test(source.snapshot.sha256), 'invalid snapshot')
  }
  for (const claim of ledger.claims) {
    requireThat(claim.sourceRevisionIds.length && new Set(claim.sourceRevisionIds).size === claim.sourceRevisionIds.length && claim.sourceRevisionIds.every((id) => sources.has(id)), `invalid source refs: ${claim.id}`)
    requireThat(claim.property.trim() && claim.statement.trim() && claim.locator.trim(), `missing claim metadata: ${claim.id}`)
    requireThat(known(claim.value) || claim.unknownReason?.trim(), `unknown value needs reason: ${claim.id}`)
  }
  for (const relation of ledger.relations) {
    requireThat(claims.has(relation.from) && claims.has(relation.to) && relation.from !== relation.to, 'invalid relation refs')
    requireThat(['supports', 'contradicts', 'corrects', 'derived-from'].includes(relation.kind) && ['exact', 'partial', 'unknown', 'disjoint'].includes(relation.overlap) && relation.reason.trim(), 'invalid relation')
    if (relation.kind === 'corrects' && relation.overlap === 'exact') {
      const a = claims.get(relation.from)!, b = claims.get(relation.to)!
      requireThat(a.entity === b.entity && a.property === b.property && a.gameVersion === b.gameVersion && sameConditions(a.conditions, b.conditions), 'correction scope mismatch')
    }
  }
  const visit = (id: string, path: Set<string>, done: Set<string>) => {
    requireThat(!path.has(id), 'cyclic derivation/correction')
    if (done.has(id)) return
    const next = new Set(path).add(id)
    for (const r of ledger.relations.filter((r) => r.from === id && ['derived-from', 'corrects'].includes(r.kind))) visit(r.to, next, done)
    done.add(id)
  }
  const done = new Set<string>()
  for (const id of claims.keys()) visit(id, new Set(), done)
  for (const decision of ledger.decisions) {
    requireThat(claims.has(decision.claimId), 'invalid decision claim ref')
    requireThat(['research-only', 'limited', 'full'].includes(decision.status) && ['not-run', 'passed', 'failed'].includes(decision.regression) && ['low', 'medium', 'high'].includes(decision.confidence), 'invalid adoption enum')
    requireThat(decision.purpose.trim() && decision.reason.trim(), 'missing adoption reason/purpose')
  }
}

/** Includes derivation ancestry so a formula and its table cannot become independent holdouts. */
export function assertIndependent(ledger: EvidenceLedger, calibration: string[], holdout: string[]): void {
  validateLedger(ledger)
  requireThat(calibration.length && holdout.length, 'empty validation partition')
  const origins = (ids: string[]) => {
    const result = new Set<string>(), seen = new Set<string>()
    const visit = (id: string) => {
      const claim = ledger.claims.find((c) => c.id === id)
      requireThat(claim, `invalid validation claim ref: ${id}`)
      if (seen.has(id)) return
      seen.add(id)
      for (const sourceId of claim.sourceRevisionIds) {
        const group = ledger.sources.find((s) => s.id === sourceId)!.originGroup
        requireThat(typeof group === 'string' && group.trim() && group !== 'unresolved', 'unknown origin independence')
        result.add(group)
      }
      for (const r of ledger.relations.filter((r) => r.from === id && ['derived-from', 'corrects'].includes(r.kind))) visit(r.to)
    }
    ids.forEach(visit)
    return result
  }
  const a = origins(calibration), b = origins(holdout)
  requireThat(![...a].some((group) => b.has(group)), 'duplicate origin in holdout')
}

/** Exact-domain adapter; broader scenario applicability requires a later, explicit policy. */
export function toLegacyEvidence<T>(ledger: EvidenceLedger, request: {
  decisionId: string; entity: string; property: string; purpose: string; gameVersion: string
  conditions: Conditions; accepts: (value: unknown) => value is T
}): Evidence<T> {
  validateLedger(ledger)
  const decision = ledger.decisions.find((d) => d.id === request.decisionId)
  requireThat(decision, 'unknown decision')
  requireThat(!ledger.decisions.some((d) => d.decisionId === decision.decisionId && d.revision > decision.revision), 'superseded decision')
  requireThat(decision.status !== 'research-only' && !decision.blockers.length && decision.regression === 'passed', 'adoption blocked')
  requireThat(request.gameVersion.trim() && request.entity.trim() && request.property.trim() && Object.values(request.conditions).every(known), 'unknown request domain')
  requireThat(decision.purpose === request.purpose && decision.gameVersion === request.gameVersion && sameConditions(decision.conditions, request.conditions), 'outside adoption domain')
  const claim = ledger.claims.find((c) => c.id === decision.claimId)!
  requireThat(claim.entity === request.entity && claim.property === request.property && claim.gameVersion === request.gameVersion && sameConditions(claim.conditions, request.conditions), 'outside claim domain')
  requireThat(claim.unit?.trim(), 'unknown claim unit')
  const check = (id: string, seen: Set<string>) => {
    if (seen.has(id)) return
    seen.add(id)
    const c = ledger.claims.find((row) => row.id === id)!
    requireThat(known(c.value) && c.unknownReason === null, `unknown claim: ${id}`)
    requireThat(c.sourceRevisionIds.every((sid) => ledger.sources.find((s) => s.id === sid)!.reviewed), 'unreviewed source')
    requireThat(!ledger.relations.some((r) => r.to === id && r.kind === 'corrects' && r.overlap === 'exact'), 'corrected claim')
    requireThat(!ledger.relations.some((r) => (r.to === id || r.from === id) && ((r.kind === 'contradicts' && r.overlap !== 'disjoint') || (r.kind === 'corrects' && ['partial', 'unknown'].includes(r.overlap)))), 'unresolved conflict/correction')
    for (const r of ledger.relations.filter((r) => r.from === id && r.kind === 'derived-from')) check(r.to, seen)
  }
  check(claim.id, new Set())
  requireThat(request.accepts(claim.value), 'incompatible legacy value')
  return { value: claim.value, source: { ...ledger.sources.find((s) => s.id === claim.sourceRevisionIds[0])!.reference }, confidence: decision.confidence, note: `${claim.statement} [claim=${claim.id}; decision=${decision.id}; sources=${claim.sourceRevisionIds.join(',')}]` }
}
