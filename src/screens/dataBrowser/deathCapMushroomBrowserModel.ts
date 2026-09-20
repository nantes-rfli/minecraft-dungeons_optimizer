import domainArtifactJson from '../../../research/domain/temporary/death-cap-mushroom.json'
import type { deathCapMushroomMappings, projectDeathCapMushroom } from '../../domain/temporary/deathCapMushroom'
import type { RawTrace as MechanicalRawTrace, Trace } from '../../domain/temporary/projectionPrimitives'

export type DomainTrace = Trace
export type RawTrace = Omit<MechanicalRawTrace, 'nodePointer'> & { nodePointer?: string }

type DeathCapMushroomDomainArtifact = {
  scope: 'temporary-domain-only'
  mappings: typeof deathCapMushroomMappings
  projection: ReturnType<typeof projectDeathCapMushroom>
}

export const deathCapMushroomDomainArtifact = domainArtifactJson as unknown as DeathCapMushroomDomainArtifact
export const deathCapMushroomBrowserProjection = deathCapMushroomDomainArtifact.projection
