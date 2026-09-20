import domainArtifactJson from '../../../research/domain/temporary/battle-robe.json'
import type { battleRobeMappings, projectBattleRobe } from '../../domain/temporary/battleRobe'

type BattleRobeDomainArtifact = {
  scope: 'temporary-domain-only'
  mappings: typeof battleRobeMappings
  projection: ReturnType<typeof projectBattleRobe>
}

export const battleRobeDomainArtifact = domainArtifactJson as unknown as BattleRobeDomainArtifact
export const battleRobeBrowserProjection = battleRobeDomainArtifact.projection
