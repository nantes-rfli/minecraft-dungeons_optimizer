import { DEFAULT_CONTROL_POLICY, DEFAULT_CROWD_CONTROL } from './control'
import type { Evidence, Scenario, ScenarioProfileId } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'
import { DEFAULT_DAMAGE_EVENT_TARGETING } from './damageEvents'

export const DEFAULT_SCENARIO_EVIDENCE = {
  encounterDurationSeconds: { value: 30, source: MVP_MODEL_SOURCE, confidence: 'low' },
  averageEnemyHealth: { value: 100, source: MVP_MODEL_SOURCE, confidence: 'low' },
  enemySupplyPerSecond: { value: 0.5, source: MVP_MODEL_SOURCE, confidence: 'low' },
  directKillShare: { value: 0.9, source: MVP_MODEL_SOURCE, confidence: 'low' },
  weakeningAffectedIncomingDamageShare: {
    value: 0.5,
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Editable generic midpoint, not a measured rate. All profiles use 50%; time-weighted incoming damage share includes range, five-second duration, attack uptime and target switching.',
  },
  enchantedShare: {
    value: 0.25,
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Generic composition assumption, not a measured spawn rate. All profiles, including boss, use the same editable default.',
  },
  undeadShare: {
    value: 0.5, source: MVP_MODEL_SOURCE, confidence: 'low',
    note: 'Editable generic midpoint shared by every profile, not a measured mission-independent undead rate. Baseline-direct-damage-weighted exposure.',
  },
  ambushEligibleDirectDamageShare: {
    value: 0.25, source: MVP_MODEL_SOURCE, confidence: 'low',
    note: 'Editable illustrative partial exposure shared by every profile, not a measured solo/co-op rate. Time/baseline-damage-weighted direct opportunities include pre-aggro, pets, other players, CC and invisibility without simulating them.',
  },
  incomingDamagePerSecond: { value: 20, source: MVP_MODEL_SOURCE, confidence: 'low' },
  maxHealth: { value: 100, source: MVP_MODEL_SOURCE, confidence: 'low' },
  averageTargetsInReach: { value: 2.5, source: MVP_MODEL_SOURCE, confidence: 'low' },
  cooldownReduction: { value: 0, source: MVP_MODEL_SOURCE, confidence: 'low' },
  radianceHealPerProc: { value: 10, source: MVP_MODEL_SOURCE, confidence: 'low' },
} as const satisfies Record<string, Evidence<number>>

export const DEFAULT_SCENARIO: Scenario = {
  profileId: 'balanced',
  name: 'バランス（MVP仮定）',
  encounterDurationSeconds: DEFAULT_SCENARIO_EVIDENCE.encounterDurationSeconds.value,
  averageEnemyHealth: DEFAULT_SCENARIO_EVIDENCE.averageEnemyHealth.value,
  enemySupplyPerSecond: DEFAULT_SCENARIO_EVIDENCE.enemySupplyPerSecond.value,
  directKillShare: DEFAULT_SCENARIO_EVIDENCE.directKillShare.value,
  enemyComposition: {
    enchantedShare: DEFAULT_SCENARIO_EVIDENCE.enchantedShare.value,
    undeadShare: DEFAULT_SCENARIO_EVIDENCE.undeadShare.value,
  },
  enemyState: { ambushEligibleDirectDamageShare: DEFAULT_SCENARIO_EVIDENCE.ambushEligibleDirectDamageShare.value },
  enemyDebuffs: { weakeningAffectedIncomingDamageShare: DEFAULT_SCENARIO_EVIDENCE.weakeningAffectedIncomingDamageShare.value },
  damageEventTargeting: DEFAULT_DAMAGE_EVENT_TARGETING,
  incomingDamagePerSecond: DEFAULT_SCENARIO_EVIDENCE.incomingDamagePerSecond.value,
  maxHealth: DEFAULT_SCENARIO_EVIDENCE.maxHealth.value,
  averageTargetsInReach: DEFAULT_SCENARIO_EVIDENCE.averageTargetsInReach.value,
  cooldownReduction: DEFAULT_SCENARIO_EVIDENCE.cooldownReduction.value,
  radianceHealPerProc: DEFAULT_SCENARIO_EVIDENCE.radianceHealPerProc.value,
  crowdControl: DEFAULT_CROWD_CONTROL,
  controlPolicy: DEFAULT_CONTROL_POLICY,
  weights: { damage: 0.5, healing: 0.25, defense: 0.25, control: 0.2 },
}

export const SCENARIO_PROFILES: Readonly<Record<ScenarioProfileId, Scenario>> = {
  balanced: DEFAULT_SCENARIO,
  damage: {
    ...DEFAULT_SCENARIO,
    profileId: 'damage',
    name: '火力',
    weights: { damage: 0.8, healing: 0.1, defense: 0.1, control: 0.05 },
  },
  survival: {
    ...DEFAULT_SCENARIO,
    profileId: 'survival',
    name: '安定攻略',
    incomingDamagePerSecond: 28,
    weights: { damage: 0.1, healing: 0.45, defense: 0.45, control: 0.3 },
  },
  boss: {
    ...DEFAULT_SCENARIO,
    profileId: 'boss',
    name: 'ボス',
    encounterDurationSeconds: 60,
    enemySupplyPerSecond: 0.03,
    averageEnemyHealth: 500,
    averageTargetsInReach: 1,
    weights: { damage: 0.75, healing: 0.1, defense: 0.15, control: 0.05 },
    crowdControl: { ...DEFAULT_CROWD_CONTROL, stunningEligibleTargetShare: 0 },
  },
  mobbing: {
    ...DEFAULT_SCENARIO,
    profileId: 'mobbing',
    name: '雑魚処理',
    enemySupplyPerSecond: 1.2,
    averageTargetsInReach: 5,
    weights: { damage: 0.5, healing: 0.2, defense: 0.3, control: 0.3 },
  },
  'apocalypse-plus': {
    ...DEFAULT_SCENARIO,
    profileId: 'apocalypse-plus',
    name: 'アポカリプス+',
    enemySupplyPerSecond: 0.35,
    incomingDamagePerSecond: 40,
    averageTargetsInReach: 3,
    weights: { damage: 0.3, healing: 0.3, defense: 0.4, control: 0.2 },
  },
}
