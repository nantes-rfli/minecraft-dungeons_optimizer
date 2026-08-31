import type { DotDamageCurve, DotDamageId, EnchantmentTier, Evidence, PersistentAreaTargetingAssumptions, SourceReference } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const DOT_DAMAGE_IDS = ['fire-aspect', 'poison-cloud'] as const
export const DOT_EXPLOSION_IDS = [...DOT_DAMAGE_IDS, 'exploding'] as const
export const DOT_TIER_MULTIPLIERS: Readonly<Record<DotDamageId, Record<EnchantmentTier, number>>> = {
  'fire-aspect': { 1: 1, 2: 1.25, 3: 1.5 },
  'poison-cloud': { 1: 1, 2: 2, 3: 3 },
}
export const DOT_PUBLISHED_ROWS = {
  'fire-aspect': [
    [70, 149, 186, 223],
    [168, 7988, 9984, 11981],
    [210, 42257, 52821, 63385],
    [213, 47870, 59838, 71806],
    [228, 87700, 109625, 131550],
    [232, 105295, 131619, 157943],
    [242, 156520, 195650, 234780],
    [243, 165103, 206279, 247654],
    [249, 206102, 257627, 309152],
    [250, 126649, 270811, 324974],
    [251, 226443, 283054, 339665],
  ],
  'poison-cloud': [
    [184, 7559, 15119, 22678],
    [213, 23908, 47816, 71725],
    [215, 26334, 52669, 79003],
    [231, 50376, 100753, 151129],
    [240, 73925, 147849, 221774],
    [246, 92861, 185723, 278584],
    [251, 113598, 227196, 340793],
  ],
} as const
export const DOT_EXCLUDED_RUNTIME_POWERS: Readonly<Record<DotDamageId, readonly number[]>> = {
  'fire-aspect': [250], 'poison-cloud': [],
}
export const DOT_SOURCES: Readonly<Record<typeof DOT_EXPLOSION_IDS[number], SourceReference>> = Object.fromEntries(
  DOT_EXPLOSION_IDS.map((id) => [id, { id: `tools-${id}`, label: `dungeons.tools 1.17.0.0: ${id}`, url: `https://www.dungeons.tools/enchantments/${id}`, kind: 'game-files' }]),
) as Record<typeof DOT_EXPLOSION_IDS[number], SourceReference>

function dotCurve(id: DotDamageId): Evidence<DotDamageCurve> {
  return {
    value: { method: 'log-linear', points: DOT_PUBLISHED_ROWS[id]
      .filter(([power]) => !DOT_EXCLUDED_RUNTIME_POWERS[id].includes(power))
      .map(([powerLevel, tierOneDps]) => ({ powerLevel, tierOneDps })) },
    source: { id: `wiki-${id}`, label: `Minecraft Wiki ${id}: Power table`, url: `https://minecraft.wiki/w/Dungeons:${id.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('_')}`, kind: 'published-reference' },
    confidence: 'low', note: 'Individual log interpolation; table version/roll unspecified. No extrapolation. Fire Power250 excluded; raw values retained.',
  }
}
export const DOT_DAMAGE_CURVES: Readonly<Record<DotDamageId, Evidence<DotDamageCurve>>> = {
  'fire-aspect': dotCurve('fire-aspect'), 'poison-cloud': dotCurve('poison-cloud'),
}

export const DEFAULT_PERSISTENT_AREA_TARGETING: PersistentAreaTargetingAssumptions = {
  poisonCloudSingleTargetResidenceSeconds: 1.5,
  poisonCloudTargetSecondsPerEvent: 1.5,
}
export const FIRE_REFRESH_MODEL: Evidence<string> = {
  value: 'finite coverage; first hit t=0; same-copy refresh, no independent burn stacking', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Continuous damage approximation; exact tick phase and target turnover unmeasured.',
}
export const FIRE_TARGET_MODEL: Evidence<string> = {
  value: 'same targets contacted continuously; burnDps × expectedTargetsHit', source: MVP_MODEL_SOURCE, confidence: 'low',
}
export const POISON_SATURATION_MODEL: Evidence<string> = {
  value: 'one roll per profile hit, Poisson spawns; N × (1-exp(-rate × targetSeconds/N))', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Non-additive saturation assumption, not proven overlap behavior. Residence defaults to 1.5s; same homogeneous target pool.',
}
export const EXPLOSION_TARGET_MODEL: Evidence<string> = {
  value: 'averageEnemyHealth × tierFraction × min(1,max(0,averageTargetsInReach-1))', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Source max HP proxied by average HP; source excluded. Explosion delay and encounter-end effects unmodeled.',
}
export const EXPLOSION_KILL_SOURCE: Evidence<string> = {
  value: 'direct weapon kills only; no artifact/indirect kill chains',
  source: { id: 'weapon-kill', label: 'Community: on-kill trigger boundary', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1c28h74/', kind: 'community-test' }, confidence: 'medium',
}
