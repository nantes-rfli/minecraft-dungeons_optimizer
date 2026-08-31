import type { Evidence, SourceReference } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const ARTIFACT_SYNERGY_SOURCE: SourceReference = {
  id: 'dungeons-tools-artifact-synergy', label: 'dungeons.tools: Artifact Synergy (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/artifact-synergy', kind: 'game-files',
}
export const RAMPAGING_SOURCE: SourceReference = {
  id: 'dungeons-tools-rampaging', label: 'dungeons.tools: Rampaging (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/rampaging', kind: 'game-files',
}
export const RAMPAGING_STACKING_SOURCE: SourceReference = {
  id: 'wiki-rampaging-stacking', label: 'Minecraft Wiki: two Rampaging III give 10% / 30 seconds (indexed excerpt)',
  url: 'https://minecraft.wiki/w/Dungeons:Enchantment', kind: 'published-reference',
}
const assumption = (value: string, note: string): Evidence<string> => ({ value, note, source: MVP_MODEL_SOURCE, confidence: 'low' })
export const ARTIFACT_USE_RATE_MODEL = assumption('use-on-cooldown', 'Sum 1/effectiveCooldown by instance; excludes opening burst, use-animation cost and player delays.')
export const ARTIFACT_SYNERGY_PENDING_CHARGE = assumption('capacity-one', 'No queued charges or magnitude stacking; exact repeated-use behavior unresolved.')
export const ARTIFACT_SYNERGY_STAGGERING = assumption('optimal-staggering', 'C=min(A,H); assumes activations can be separated by eligible attacks, not a demonstrated schedule.')
export const ARTIFACT_SYNERGY_ATTACK_OPPORTUNITY = assumption('one-profile-hit-one-action', 'Current three profiles have per-hit timings, no sub-hit action metadata. Equal damage and homogeneous AoE; no multiplication by target count.')
export const ARTIFACT_SYNERGY_DIRECT_COMPOSITION = assumption('factorized-before-committed', 'Multiply existing direct expectations before Committed. No proc amplification; exact modifier interactions unmeasured.')
export const ARTIFACT_SYNERGY_TRIGGER: Evidence<string> = { value: 'artifact-use-next-melee-attack', source: ARTIFACT_SYNERGY_SOURCE, confidence: 'high' }
export const RAMPAGING_DIRECT_KILL: Evidence<string> = {
  value: 'direct-weapon-kills-only', confidence: 'low',
  source: { id: 'community-rampaging-kills', label: 'Community report: indirect kills do not trigger Rampaging', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1ekyxv0/', kind: 'community-test' },
}
export const RAMPAGING_SHARED_TRIGGER: Evidence<string> = {
  value: 'shared-10-percent-summed-duration', source: RAMPAGING_STACKING_SOURCE, confidence: 'medium',
  note: 'Wiki example supports 10% for two copies; no independent game-file roll verification. Copy count does not increase magnitude.',
}
export const RAMPAGING_UPTIME_MODEL = assumption('poisson-refresh', 'Retrigger resets to summed duration T; uptime=-expm1(-p*k*T). Actual discrete kills and refresh semantics unverified; no encounter warm-up.')
export const RAMPAGING_SPEED_COMPOSITION: Evidence<string> = {
  value: 'additive-speed-bonus', confidence: 'low',
  source: { id: 'community-rampaging-speed', label: 'Community explanation: Mushroom 200% + Rampaging = 250%', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/14ejzt7/', kind: 'community-test' },
}
export const RAMPAGING_MEAN_CADENCE = assumption('linear-mean-attack-speed', 'No frame caps or nonlinear fast-weapon animation; can overestimate Fighter’s Bindings. Void at average speed is not the average of discrete buff states.')
export const RAMPAGING_FIXED_POINT: Evidence<string> = {
  value: 'bounded-fixed-point', source: MVP_MODEL_SOURCE, confidence: 'high',
  note: 'Numerical self-consistency only, not empirical accuracy; tolerance 1e-8, max 100, explicit finite/nonconvergence errors.',
}
