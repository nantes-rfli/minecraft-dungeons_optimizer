import manifest from '../../research/runtime/artifact-runtime-support.json'
import type { ArtifactMechanicFamily } from './artifactMechanics'
import type { RuntimeSupportLevel } from './runtimeSupport'

export interface ArtifactRuntimeSupportEntry {
  readonly id: string
  readonly name: string
  readonly mechanicFamily: ArtifactMechanicFamily
  readonly supportLevel: RuntimeSupportLevel
  readonly reasons: readonly string[]
  readonly boundaries: readonly string[]
  readonly assumptionRefs: readonly string[]
  readonly sourceIds: readonly string[]
}
export interface ArtifactRuntimeSupportManifest {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly population: number
  readonly populationScope: string
  readonly entries: readonly ArtifactRuntimeSupportEntry[]
}

// Independent research population; never use these entries as inventory options.
export const ARTIFACT_RUNTIME_SUPPORT = manifest as ArtifactRuntimeSupportManifest
export function summarizeArtifactRuntimeSupport(data = ARTIFACT_RUNTIME_SUPPORT) {
  const full = data.entries.filter((entry) => entry.supportLevel === 'full').length
  const limited = data.entries.filter((entry) => entry.supportLevel === 'limited').length
  return { population: data.entries.length, runtime: full + limited, full, limited, researchOnly: data.entries.filter((entry) => entry.supportLevel === 'research-only').length }
}
export function artifactRuntimeSupportSummaryText(data = ARTIFACT_RUNTIME_SUPPORT): string {
  const s = summarizeArtifactRuntimeSupport(data)
  return `Artifacts · Audited source population ${s.population} · Catalog runtime ${s.runtime} / ${s.population} · Full ${s.full} · Limited ${s.limited} · Research-only ${s.researchOnly}`
}
