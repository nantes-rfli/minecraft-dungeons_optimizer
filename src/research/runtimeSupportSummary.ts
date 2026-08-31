import type { MeleeRuntimeSupportManifest, RuntimeSupportLevel } from '../core/runtimeSupport'

export function summarizeRuntimeSupportData(data: MeleeRuntimeSupportManifest) {
  const count = (level: RuntimeSupportLevel) => data.entries.filter((entry) => entry.supportLevel === level).length
  const full = count('full')
  const limited = count('limited')
  const powerLimited = data.entries.filter((entry) => entry.runtimePowerRange !== null).length
  return { population: data.entries.length, runtime: full + limited, full, limited, researchOnly: count('research-only'), broadPower: full + limited - powerLimited, powerLimited }
}

export function runtimeSupportSummaryDataText(data: MeleeRuntimeSupportManifest): string {
  const s = summarizeRuntimeSupportData(data)
  return `Population ${s.population} · Catalog runtime ${s.runtime} / ${s.population} · Full ${s.full} · Limited ${s.limited} · Research-only ${s.researchOnly} · Broad Power ${s.broadPower} · Power-limited ${s.powerLimited}`
}
