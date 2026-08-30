import type { DamageEventTargetingAssumptions, Evidence, ProcDamageDefinition, ProcDamageId, EnchantmentTier } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const PROC_DAMAGE_IDS = ['shockwave', 'swirling', 'thundering'] as const

// Published [Power, Tier I, Tier II, Tier III] values; retain source anomalies.
const PUBLISHED_ROWS = {
  shockwave: [
    [210, 42257, 63385, 84514],
    [211, 44273, 66409, 88545],
    [213, 49058, 73587, 98116],
    [221, 67424, 101136, 134847],
    [227, 84570, 126855, 169141],
    [229, 91790, 137685, 183579],
    [231, 100753, 151129, 201506],
    [234, 112619, 168929, 225239],
    [235, 118279, 177418, 236558],
    [238, 136183, 204274, 272366],
    [246, 182689, 274033, 365378],
    [250, 216649, 324974, 433298],
    [251, 227196, 340793, 454391],
    [252, 231647, 347471, 463294],
  ],
  swirling: [
    [210, 58446, 87670, 116893],
    [213, 65411, 98116, 130821],
    [216, 73542, 110313, 147084],
    [221, 89898, 134847, 179797],
    [226, 108729, 163093, 217458],
    [228, 116933, 175400, 233866],
    [234, 150159, 225239, 300318],
    [243, 221783, 332674, 442566],
    [244, 225632, 338448, 451264],
    [247, 257058, 385587, 514116],
    [248, 266130, 399195, 532260],
    [249, 278320, 417481, 556641],
    [250, 294937, 442405, 589874],
    [251, 299738, 449607, 599476],
    [253, 324872, 487308, 649744],
    [254, 346950, 520425, 693900],
    [260, 434690, 652035, 869381],
    [263, 480144, 720216, 960288],
  ],
  thundering: [
    [248, 82914, 165827, 248741],
    [251, 94172, 188344, 282516],
    [253, 101523, 203045, 304568],
    [254, 108422, 216844, 325266],
    [260, 135841, 271681, 407522],
    [263, 150402, 300804, 451206],
  ],
} as const

export const DAMAGE_CHANNEL_KILL_ATTRIBUTION = {
  value: 'estimatedKills × scenario.directKillShare × directWeaponAoeDps / totalAoeDps',
  source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Damage contribution share approximates final-blow share; timing, overkill, remaining HP and target distribution are not simulated.',
} as const satisfies Evidence<string>

export const PROC_TARGET_CONTACT = {
  value: 1, source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Continuous valid target contact; Swirling finisher must hit. Whiffs, knockback and target switching are not modeled.',
} as const satisfies Evidence<number>

export const DEFAULT_DAMAGE_EVENT_TARGETING: DamageEventTargetingAssumptions = {
  shockwave: 1, swirling: 1, thundering: 1,
}

function definition(id: ProcDamageId, geometry: ProcDamageDefinition['targeting']['value']['geometry']): ProcDamageDefinition {
  const name = id[0]!.toUpperCase() + id.slice(1)
  const source = { id: `wiki-${id}-power`, label: `Minecraft Wiki: ${name} Power tables`, url: `https://minecraft.wiki/w/Dungeons:${name}`, kind: 'published-reference' as const }
  return {
    id,
    damageCurve: {
      value: { method: 'log-linear', points: PUBLISHED_ROWS[id].map(([powerLevel, tierOneDamage]) => ({ powerLevel, tierOneDamage })) },
      source, confidence: 'low',
      note: 'Tier I log-linear interpolation inside published knots only. Table version unspecified; same displayed Power can vary. No extrapolation or direct-weapon coefficient.',
    },
    samples: { value: PUBLISHED_ROWS[id].flatMap((row) => ([1, 2, 3] as const).map((tier) => ({ powerLevel: row[0], tier, damage: row[tier] }))), source, confidence: 'medium', note: 'Source-backed numeric knots, not independent end-to-end measurements.' },
    targeting: {
      value: { geometry, defaultExpectedTargets: DEFAULT_DAMAGE_EVENT_TARGETING[id] },
      source: MVP_MODEL_SOURCE, confidence: 'low',
      note: 'Generic one-target baseline, editable up to scenario.averageTargetsInReach; no measured radius or weapon.area reuse.',
    },
    attribution: {
      value: { qualifiesAsDirectWeaponKill: false },
      source: { id: 'community-indirect-kills', label: 'Community: Enchantments interfering', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/', kind: 'community-test' },
      confidence: 'low',
    },
    voidInteraction: {
      value: { amplification: 'uncertain', consumesVoid: 'uncertain' },
      source: MVP_MODEL_SOURCE, confidence: 'low',
      note: 'Limited runtime: no proc amplification or Void state changes. This is not evidence of no interaction.',
    },
    requiresTargetHit: id !== 'shockwave',
  }
}

export const PROC_DAMAGE_DEFINITIONS: Readonly<Record<ProcDamageId, ProcDamageDefinition>> = {
  shockwave: definition('shockwave', 'directional-wave'),
  swirling: definition('swirling', 'local-radius'),
  thundering: definition('thundering', 'nearby-lightning'),
}

export const PROC_TIER_MULTIPLIERS: Readonly<Record<ProcDamageId, Readonly<Record<EnchantmentTier, number>>>> = {
  shockwave: { 1: 1, 2: 1.5, 3: 2 },
  swirling: { 1: 1, 2: 1.5, 3: 2 },
  thundering: { 1: 1, 2: 2, 3: 3 },
}
