import domainArtifactJson from '../../../research/domain/temporary/scatter-crossbow.json'

export type RawTrace = {
  artifactPath: string
  datasetId: string
  extractionRunId: string
  packagePath: string
  nodePointer?: string
}

export type DomainTrace = { mappingId: string; raw: RawTrace }

export type DomainField<T, TTrace = DomainTrace> =
  | { state: 'known'; value: T; trace: TTrace }
  | { state: 'unknown' | 'unsupported' | 'parse-failed' | 'not-extracted'; reason: string; trace: TTrace }

type ProjectileReferenceTrace = {
  mappingId: string
  objectProperty: RawTrace
  classImport: RawTrace
  outerPackageImport: RawTrace
  targetRawSnapshot: RawTrace
}

type ConfiguredProjectileDefinition = {
  sourceIndex: number
  configuredProjectileCount: DomainField<number>
  configuredAngleSpan: DomainField<number>
  configuredDelaySecondsPerProjectile: DomainField<number>
  projectile: {
    reference: DomainField<{ rawPackageIndex: number; objectName: string; className: string; targetRawPackagePath: string }, ProjectileReferenceTrace>
    configuration: {
      configuredPushbackEnabled: DomainField<boolean>
      configuredPushbackStrength: DomainField<number>
      configuredIgnoreFriendlyFire: DomainField<boolean>
    }
  }
}

type ScatterCrossbowDomainArtifact = {
  scope: 'temporary-domain-only'
  mappings: {
    identity: { rawFields: string[]; meaning: string }
    definitions: { rawField: string; rawPath: string; meaning: string }
    projectileCount: { rawField: string; meaning: string }
    angleSpan: { rawField: string; meaning: string }
    delayPerProjectile: { rawField: string; meaning: string }
    velocityFactor: { rawField: string; meaning: string }
    projectileReference: { rawField: string; meaning: string }
    pushbackEnabled: { rawField: string; meaning: string }
    pushbackStrength: { rawField: string; meaning: string }
    ignoreFriendlyFire: { rawField: string; meaning: string }
  }
  projection: {
    identity: {
      status: 'accepted' | 'unresolved'
      confidence: string
      domainId: string
      displayName: string
      evidence: { itemName: DomainField<string>; serializedId: DomainField<string> }
    }
    configuredProjectileDefinitions: DomainField<ConfiguredProjectileDefinition[]>
    configuredProjectileVelocityFactor: DomainField<number>
  }
}

export const scatterCrossbowDomainArtifact = domainArtifactJson as ScatterCrossbowDomainArtifact
export const scatterCrossbowBrowserProjection = scatterCrossbowDomainArtifact.projection
