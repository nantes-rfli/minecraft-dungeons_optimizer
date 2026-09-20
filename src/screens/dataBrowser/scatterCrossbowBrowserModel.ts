import domainArtifactJson from '../../../research/domain/temporary/scatter-crossbow.json'
import type { projectScatterCrossbow, scatterCrossbowMappings } from '../../domain/temporary/scatterCrossbow'
import type { Field, RawTrace as MechanicalRawTrace, Trace } from '../../domain/temporary/projectionPrimitives'

export type DomainTrace = Trace
export type DomainField<T, TTrace = DomainTrace> = Field<T, TTrace>
export type RawTrace = Omit<MechanicalRawTrace, 'nodePointer'> & { nodePointer?: string }

type ScatterCrossbowDomainArtifact = {
  scope: 'temporary-domain-only'
  mappings: typeof scatterCrossbowMappings
  projection: ReturnType<typeof projectScatterCrossbow>
}

export const scatterCrossbowDomainArtifact = domainArtifactJson as unknown as ScatterCrossbowDomainArtifact
export const scatterCrossbowBrowserProjection = scatterCrossbowDomainArtifact.projection
