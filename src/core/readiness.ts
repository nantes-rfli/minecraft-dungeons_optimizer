/** Structured exclusions emitted by the calculation pipeline, never inferred by the UI. */
export type ReadinessStatus = 'evaluated' | 'input-required' | 'unsupported' | 'constrained' | 'failed'
export interface ReadinessIssue {
  readonly kind: Exclude<ReadinessStatus, 'evaluated'>
  readonly message: string
  readonly fields?: readonly string[]
  readonly target?: 'equipment' | 'scenario'
}
export interface InventoryReadiness {
  readonly equipment: readonly { readonly instanceId: string; readonly status: ReadinessStatus; readonly issues: readonly ReadinessIssue[] }[]
  readonly error?: string
}
export class ExclusionLog extends Set<string> {
  readonly issues = new Map<string, ReadinessIssue[]>()
  private readonly candidateIssues = new Map<string, ReadinessIssue[]>()
  candidate(instanceId: string, issue: ReadinessIssue): void {
    this.add(`${instanceId}: ${issue.message}`)
    const entries = this.candidateIssues.get(instanceId) ?? []
    if (!entries.some((entry) => JSON.stringify(entry) === JSON.stringify(issue))) entries.push(issue)
    this.candidateIssues.set(instanceId, entries)
  }
  finishStage(eligibleIds: ReadonlySet<string>): void {
    for (const [id, issues] of this.candidateIssues) {
      if (!eligibleIds.has(id)) for (const issue of issues) this.record(id, issue)
    }
    this.candidateIssues.clear()
  }
  record(instanceId: string, issue: ReadinessIssue, legacyMessage = issue.message): void {
    this.add(`${instanceId}: ${legacyMessage}`)
    const existing = this.issues.get(instanceId) ?? []
    if (!existing.some((entry) => JSON.stringify(entry) === JSON.stringify(issue))) existing.push(issue)
    this.issues.set(instanceId, existing)
  }
}
