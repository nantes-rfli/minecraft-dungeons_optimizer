import domainArtifactJson from '../../../research/domain/temporary/fighters-bindings.json'

export type Trace = {
  mappingId: string
  raw: {
    artifactPath: string
    datasetId: string
    extractionRunId: string
    packagePath: string
    nodePointer: string
  }
}

export type DomainField<T> =
  | { state: 'known'; value: T; trace: Trace }
  | { state: 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted'; reason: string; trace: Trace }

type ConfiguredAttack = {
  sourceIndex: number
  configuredDamage: DomainField<number>
  configuredAnimationDurationSeconds: DomainField<number>
}

type FightersBindingsDomainArtifact = {
  scope: 'temporary-domain-only'
  mappings: {
    identity: { rawFields: string[]; meaning: string }
    entries: { rawField: string; meaning: string }
    damage: { rawField: string; meaning: string }
    duration: { rawField: string; meaning: string }
  }
  projection: {
    identity: {
      status: 'provisional' | 'unresolved'
      domainId?: string
      displayName?: string
      evidence: { itemName: DomainField<string>; serializedId: DomainField<string> }
    }
    configuredAttacks: DomainField<ConfiguredAttack[]>
    unresolved: string[]
  }
}

export const fightersBindingsDomainArtifact = domainArtifactJson as FightersBindingsDomainArtifact
export const fightersBindingsBrowserProjection = fightersBindingsDomainArtifact.projection
