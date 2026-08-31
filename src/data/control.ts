import type { ControlEnchantmentId, ControlPolicyWeights, CrowdControlAssumptions, EnchantmentDefinition, Evidence, SourceReference } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const CONTROL_IDS = ['chains', 'stunning', 'freezing', 'gravity'] as const
export const isControlId = (id: string): id is ControlEnchantmentId => (CONTROL_IDS as readonly string[]).includes(id)
const source = (id: ControlEnchantmentId): SourceReference => ({
  id: `cc-tools-${id}`, label: `dungeons.tools ${id} (1.17.0.0)`,
  url: `https://www.dungeons.tools/enchantments/${id}`, kind: 'game-files',
})

export const STUNNING_DURATION: Evidence<number> = {
  value: 2, confidence: 'low',
  source: { id: 'cc-stunning-duration-community', label: 'ShinkuNY quantitative Stunning explanation (2023-01-16)', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/10chuqi/', kind: 'community-test' },
  note: '2022/2023 calculations agree, with shared authorship; not independent game validation. No duration found in public game-derived metadata. Apocalypse+25 mentioned, exact version unverified.',
}
export const CC_REFRESH_MODEL: Evidence<string> = {
  value: 'finite-periodic-bernoulli-window-exact', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'First hit at zero, same target/cluster refreshed; per profile hit per modeled target. No AoE opportunity multiplier or frame cap simulation.',
}
export const CC_ELIGIBILITY_MODEL: Evidence<string> = {
  value: 'editable-target-time-share', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Generic partial exposure, not a measured mission rate. Powerful mobs and resistance not inferred from profile labels. Boss Stunning defaults to zero following immunity reports.',
}
export const CC_CLUSTER_MODEL: Evidence<number> = {
  value: 1, source: MVP_MODEL_SOURCE, confidence: 'low', note: 'Conservative one target; exact radius and target density unavailable.',
}
export const DEFAULT_CROWD_CONTROL: CrowdControlAssumptions = {
  stunningEligibleTargetShare: 0.5, chainsEligibleTargetShare: 0.5,
  freezingEligibleTargetShare: 0.5, gravityEligibleTargetShare: 0.5,
  stunningEffectiveDurationMultiplier: 1, chainsExpectedTargetsPerProc: 1, gravityExpectedTargetsPerHit: 1,
}
// Equal preferences are a product default, deliberately outside Evidence.
export const DEFAULT_CONTROL_POLICY: ControlPolicyWeights = { hardDisable: 1, attackSlow: 1, root: 1, grouping: 1 }

export const CONTROL_ENCHANTMENTS: Readonly<Record<ControlEnchantmentId, EnchantmentDefinition>> = {
  chains: {
    id: 'chains', name: { ja: '束縛', en: 'Chains' },
    tiers: { value: {
      1: { effect: { kind: 'root-cluster', triggerChance: 0.3, durationSeconds: 1 } },
      2: { effect: { kind: 'root-cluster', triggerChance: 0.3, durationSeconds: 2 } },
      3: { effect: { kind: 'root-cluster', triggerChance: 0.3, durationSeconds: 3 } },
    }, source: source('chains'), confidence: 'high' },
    stacking: { value: { maxCopies: 1, behavior: 'special' }, source: source('chains'), confidence: 'low', note: 'Game max 4; runtime 1. Simultaneous/mixed-tier/3/4-copy duration and retrigger semantics unresolved.' },
  },
  stunning: {
    id: 'stunning', name: { ja: '気絶', en: 'Stunning' },
    tiers: { value: {
      1: { effect: { kind: 'hard-stun', triggerChance: 0.05, durationSeconds: STUNNING_DURATION.value } },
      2: { effect: { kind: 'hard-stun', triggerChance: 0.1, durationSeconds: STUNNING_DURATION.value } },
      3: { effect: { kind: 'hard-stun', triggerChance: 0.15, durationSeconds: STUNNING_DURATION.value } },
    }, source: source('stunning'), confidence: 'high', note: 'High confidence applies to chances only. Duration has separate low-confidence Evidence in STUNNING_DURATION.' },
    stacking: { value: { maxCopies: 1, behavior: 'non-stackable' }, source: source('stunning'), confidence: 'high' },
  },
  freezing: {
    id: 'freezing', name: { ja: '凍結', en: 'Freezing' },
    tiers: { value: {
      1: { effect: { kind: 'enemy-attack-speed-slow', durationSeconds: 3, attackSpeedReduction: 0.3 } },
      2: { effect: { kind: 'enemy-attack-speed-slow', durationSeconds: 3, attackSpeedReduction: 0.4 } },
      3: { effect: { kind: 'enemy-attack-speed-slow', durationSeconds: 3, attackSpeedReduction: 0.5 } },
    }, source: source('freezing'), confidence: 'high' },
    stacking: { value: { maxCopies: 1, behavior: 'non-stackable' }, source: source('freezing'), confidence: 'high' },
  },
  gravity: {
    id: 'gravity', name: { ja: '重力', en: 'Gravity' },
    tiers: { value: {
      1: { effect: { kind: 'group-pull', durationSeconds: 1 } },
      2: { effect: { kind: 'group-pull', durationSeconds: 1.5 } },
      3: { effect: { kind: 'group-pull', durationSeconds: 2 } },
    }, source: source('gravity'), confidence: 'high' },
    stacking: { value: { maxCopies: 1, behavior: 'non-stackable' }, source: source('gravity'), confidence: 'high' },
  },
}
