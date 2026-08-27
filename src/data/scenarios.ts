import type { Evidence, Scenario } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const DEFAULT_SCENARIO_EVIDENCE = {
  encounterDurationSeconds: { value: 30, source: MVP_MODEL_SOURCE, confidence: 'low' },
  averageEnemyHealth: { value: 100, source: MVP_MODEL_SOURCE, confidence: 'low' },
  killsPerSecond: { value: 0.5, source: MVP_MODEL_SOURCE, confidence: 'low' },
  directKillShare: { value: 0.9, source: MVP_MODEL_SOURCE, confidence: 'low' },
  incomingDamagePerSecond: { value: 20, source: MVP_MODEL_SOURCE, confidence: 'low' },
  maxHealth: { value: 100, source: MVP_MODEL_SOURCE, confidence: 'low' },
  averageTargetsInReach: { value: 2.5, source: MVP_MODEL_SOURCE, confidence: 'low' },
  artifactPower: { value: 251, source: MVP_MODEL_SOURCE, confidence: 'low' },
  cooldownReduction: { value: 0, source: MVP_MODEL_SOURCE, confidence: 'low' },
  radianceHealPerProc: { value: 10, source: MVP_MODEL_SOURCE, confidence: 'low' },
  voidRampSeconds: {
    value: 3,
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Linear-ramp approximation; exact timing must be measured.',
  },
} as const satisfies Record<string, Evidence<number>>

export const DEFAULT_SCENARIO: Scenario = {
  name: 'バランス（MVP仮定）',
  encounterDurationSeconds: DEFAULT_SCENARIO_EVIDENCE.encounterDurationSeconds.value,
  averageEnemyHealth: DEFAULT_SCENARIO_EVIDENCE.averageEnemyHealth.value,
  killsPerSecond: DEFAULT_SCENARIO_EVIDENCE.killsPerSecond.value,
  directKillShare: DEFAULT_SCENARIO_EVIDENCE.directKillShare.value,
  incomingDamagePerSecond: DEFAULT_SCENARIO_EVIDENCE.incomingDamagePerSecond.value,
  maxHealth: DEFAULT_SCENARIO_EVIDENCE.maxHealth.value,
  averageTargetsInReach: DEFAULT_SCENARIO_EVIDENCE.averageTargetsInReach.value,
  artifactPower: DEFAULT_SCENARIO_EVIDENCE.artifactPower.value,
  cooldownReduction: DEFAULT_SCENARIO_EVIDENCE.cooldownReduction.value,
  radianceHealPerProc: DEFAULT_SCENARIO_EVIDENCE.radianceHealPerProc.value,
  voidRampSeconds: DEFAULT_SCENARIO_EVIDENCE.voidRampSeconds.value,
  weights: { damage: 0.5, healing: 0.25, defense: 0.25 },
}
