import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { calculateArtifactEffects, calculateArtifactUptime } from '../src/core/artifact'
import { calculateBaseHitsPerSecond } from '../src/core/attackProfile'
import { deriveCombatState } from '../src/core/combatState'
import { calculateDamage } from '../src/core/damage'
import { calculateDefense } from '../src/core/defense'
import { calculateHealing } from '../src/core/healing'
import { calculateVoidStrikeMultiplier } from '../src/core/voidStrike'
import { evaluate, OptimizerInputError } from '../src/core'
import type { Build, EnchantmentId, EnchantmentTier, SelectedEnchantment } from '../src/core'

const selected = (
  enchantmentId: EnchantmentId,
  tier: EnchantmentTier = 3,
  source: SelectedEnchantment['source'] = 'slot',
): SelectedEnchantment => ({ enchantmentId, tier, source })

const noArtifactEffects = {
  attackSpeedMultiplier: 1,
  damageTakenMultiplier: 1,
  uptimes: [],
  stackingGroups: [],
} as const

const bindingsBuild: Build = {
  weapon: {
    instanceId: 'bindings-test',
    weaponId: 'fighters-bindings',
    powerLevel: 251,
    enchantmentSlots: [
      { candidates: ['critical-hit'] },
      { candidates: ['radiance'] },
      { candidates: ['leeching'] },
    ],
  },
  enchantments: [selected('critical-hit'), selected('radiance'), selected('leeching')],
  artifacts: [],
}

describe('artifact model', () => {
  it('clamps uptime at 100 percent', () => {
    const uptime = calculateArtifactUptime({ instanceId: 'mushroom-test', artifactId: 'death-cap-mushroom', powerLevel: 251 }, {
      ...DEFAULT_SCENARIO,
      cooldownReduction: 0.75,
    })
    expect(uptime.uptime).toBe(1)
  })

  it('combines averaged offensive and defensive effects', () => {
    const effects = calculateArtifactEffects(
      [
        { instanceId: 'mushroom-test', artifactId: 'death-cap-mushroom', powerLevel: 251 },
        { instanceId: 'amulet-test', artifactId: 'iron-hide-amulet', powerLevel: 251 },
      ],
      DEFAULT_SCENARIO,
    )
    expect(effects.attackSpeedMultiplier).toBeCloseTo(1.7017, 3)
    expect(effects.damageTakenMultiplier).toBeCloseTo(0.579, 3)
  })

  it('matches published Death Cap duration samples within rounding tolerance', () => {
    const samples = [
      { powerLevel: 37, durationSeconds: 9.9 },
      { powerLevel: 66, durationSeconds: 11.5 },
      { powerLevel: 124, durationSeconds: 14.5 },
      { powerLevel: 145, durationSeconds: 15.6 },
    ]
    for (const sample of samples) {
      const uptime = calculateArtifactUptime({
        instanceId: `mushroom-${sample.powerLevel}`,
        artifactId: 'death-cap-mushroom',
        powerLevel: sample.powerLevel,
      }, DEFAULT_SCENARIO)
      expect(Math.abs(uptime.durationSeconds - sample.durationSeconds)).toBeLessThanOrEqual(0.1)
    }
  })

  it('matches published Iron Hide duration samples', () => {
    const samples = [
      { powerLevel: 12, durationSeconds: 8.6 },
      { powerLevel: 15, durationSeconds: 8.8 },
      { powerLevel: 104, durationSeconds: 13.4 },
    ]
    for (const sample of samples) {
      const uptime = calculateArtifactUptime({
        instanceId: `amulet-${sample.powerLevel}`,
        artifactId: 'iron-hide-amulet',
        powerLevel: sample.powerLevel,
      }, DEFAULT_SCENARIO)
      expect(uptime.durationSeconds).toBeCloseTo(sample.durationSeconds, 1)
    }
  })

  it('refreshes duplicate Death Cap duration without stacking attack speed', () => {
    const effects = calculateArtifactEffects([
      { instanceId: 'mushroom-1', artifactId: 'death-cap-mushroom', powerLevel: 251 },
      { instanceId: 'mushroom-2', artifactId: 'death-cap-mushroom', powerLevel: 251 },
    ], DEFAULT_SCENARIO)

    expect(effects.attackSpeedMultiplier).toBe(2)
    expect(effects.stackingGroups[0]).toMatchObject({
      artifactId: 'death-cap-mushroom', behavior: 'refresh', combinedUptime: 1,
    })
  })

  it('refreshes duplicate Iron Hide duration without doubling damage reduction', () => {
    const effects = calculateArtifactEffects([
      { instanceId: 'amulet-1', artifactId: 'iron-hide-amulet', powerLevel: 251 },
      { instanceId: 'amulet-2', artifactId: 'iron-hide-amulet', powerLevel: 251 },
    ], DEFAULT_SCENARIO)

    expect(effects.damageTakenMultiplier).toBe(0.5)
    expect(effects.stackingGroups[0]).toMatchObject({
      artifactId: 'iron-hide-amulet', behavior: 'refresh', combinedUptime: 1,
    })
  })
})

describe('damage model', () => {
  it('preserves the legacy baseline while each weapon still uses a proxy profile', () => {
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES['fighters-bindings'].value)).toBe(7)
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES['double-axe'].value)).toBe(1.05)
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES.anchor.value)).toBe(0.5)
  })

  it('converts frame measurements to attacks per second using the median sample', () => {
    expect(calculateBaseHitsPerSecond({
      method: 'frame-measured',
      hitsPerCombo: 4,
      framesPerSecond: 60,
      comboFrameSamples: [43, 42, 80, 41, 42],
    })).toBeCloseTo(4 * 60 / 42)
  })

  it('rejects too few frame measurements instead of using an unstable rate', () => {
    expect(() => calculateBaseHitsPerSecond({
      method: 'frame-measured',
      hitsPerCombo: 4,
      framesPerSecond: 60,
      comboFrameSamples: [],
    })).toThrow('計測値を5件以上')
  })

  it('calculates Critical Hit III as a 1.4 expected multiplier', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings' },
      [selected('critical-hit')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(damage.hitsPerSecond).toBe(7)
    expect(damage.baseDps).toBe(14)
    expect(damage.criticalMultiplier).toBeCloseTo(1.4)
    expect(damage.singleTargetDps).toBeCloseTo(19.6)
  })

  it('rewards slower weapons under the provisional Void Strike model', () => {
    const anchor = calculateDamage(
      { weaponId: 'anchor' },
      [selected('void-strike')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const bindings = calculateDamage(
      { weaponId: 'fighters-bindings' },
      [selected('void-strike')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(anchor.voidStrikeMultiplier).toBeGreaterThan(bindings.voidStrikeMultiplier)
  })

  it('uses an observed item-card damage value when one is supplied', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', observedDamagePerHit: 100 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(damage.damageSource).toBe('observed-input')
    expect(damage.damagePerHit).toBe(100)
    expect(damage.baseDps).toBe(700)
  })
})

describe('Void Strike curve', () => {
  it('interpolates median multipliers from frame-measured points', () => {
    const multiplier = calculateVoidStrikeMultiplier({
      method: 'frame-measured',
      points: [
        { elapsedSeconds: 0, multiplierSamples: [1, 1, 1, 1, 1] },
        { elapsedSeconds: 1, multiplierSamples: [2, 2, 2.1, 2, 1.9] },
        { elapsedSeconds: 2, multiplierSamples: [5, 5.1, 5, 4.9, 7] },
      ],
    }, 1.5, 7)
    expect(multiplier).toBeCloseTo(3.5)
  })

  it('returns the base multiplier after a measured curve expires', () => {
    expect(calculateVoidStrikeMultiplier({
      method: 'linear-proxy',
      points: [
        { elapsedSeconds: 0, multiplier: 1 },
        { elapsedSeconds: 3.6, multiplier: 7 },
      ],
      expiresAfterSeconds: 5,
    }, 5, 7)).toBe(1)
  })

  it('rejects unordered curve points', () => {
    expect(() => calculateVoidStrikeMultiplier({
      method: 'linear-proxy',
      points: [
        { elapsedSeconds: 0, multiplier: 1 },
        { elapsedSeconds: 0, multiplier: 2 },
      ],
    }, 0.5, 7)).toThrow('昇順で重複なく')
  })

  it('rejects a decreasing curve', () => {
    expect(() => calculateVoidStrikeMultiplier({
      method: 'linear-proxy',
      points: [
        { elapsedSeconds: 0, multiplier: 2 },
        { elapsedSeconds: 1, multiplier: 1.5 },
      ],
    }, 0.5, 7)).toThrow('減少しない値')
  })

  it('rejects every out-of-range measurement before taking the median', () => {
    expect(() => calculateVoidStrikeMultiplier({
      method: 'frame-measured',
      points: [
        { elapsedSeconds: 0, multiplierSamples: [1, 1, 1, 1, 1] },
        { elapsedSeconds: 1, multiplierSamples: [2, 2, 2, 2, 8] },
      ],
    }, 0.5, 7)).toThrow('1以上7以下')
  })
})

describe('healing and defense models', () => {
  it('adds Radiance proc healing and direct-kill Leeching healing', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings' },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const healing = calculateHealing(
      [selected('radiance'), selected('leeching')],
      damage,
      deriveCombatState(damage, DEFAULT_SCENARIO),
      DEFAULT_SCENARIO,
    )
    expect(healing.radiancePerSecond).toBeCloseTo(14)
    expect(healing.leechingPerSecond).toBeCloseTo(1.3041)
    expect(healing.totalPerSecond).toBeCloseTo(15.3041)
  })

  it('applies tier values and diminishing effects to stackable healing enchants', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings' },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const healing = calculateHealing(
      [
        selected('radiance', 3),
        selected('radiance', 3, 'gilded'),
        selected('leeching', 3),
        selected('leeching', 1, 'gilded'),
      ],
      damage,
      deriveCombatState(damage, DEFAULT_SCENARIO),
      DEFAULT_SCENARIO,
    )

    expect(healing.radiancePerSecond).toBeCloseTo(24.5)
    expect(healing.leechingPerSecond).toBeCloseTo(1.847475)
  })

  it('uses a Poisson uptime model for Guarding Strike', () => {
    const defense = calculateDefense(
      [selected('guarding-strike')],
      noArtifactEffects,
      {
        effectiveDamagePerSecond: 50,
        damageLimitedKillsPerSecond: 0.5,
        estimatedKillsPerSecond: 0.5,
      },
      DEFAULT_SCENARIO,
    )
    expect(defense.guardingStrikeUptime).toBeCloseTo(1 - Math.exp(-2))
    expect(defense.damageTakenMultiplier).toBeLessThan(1)
    expect(defense.effectiveHealth).toBeGreaterThan(DEFAULT_SCENARIO.maxHealth)
  })

  it('increases kill-triggered effects when Build damage increases', () => {
    const lowDamage = calculateDamage(
      { weaponId: 'fighters-bindings', observedDamagePerHit: 1 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const highDamage = calculateDamage(
      { weaponId: 'fighters-bindings', observedDamagePerHit: 100 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const lowCombatState = deriveCombatState(lowDamage, DEFAULT_SCENARIO)
    const highCombatState = deriveCombatState(highDamage, DEFAULT_SCENARIO)
    const lowHealing = calculateHealing(
      [selected('leeching')], lowDamage, lowCombatState, DEFAULT_SCENARIO,
    )
    const highHealing = calculateHealing(
      [selected('leeching')], highDamage, highCombatState, DEFAULT_SCENARIO,
    )
    const lowDefense = calculateDefense(
      [selected('guarding-strike')], noArtifactEffects, lowCombatState, DEFAULT_SCENARIO,
    )
    const highDefense = calculateDefense(
      [selected('guarding-strike')], noArtifactEffects, highCombatState, DEFAULT_SCENARIO,
    )

    expect(lowCombatState.estimatedKillsPerSecond).toBeLessThan(
      highCombatState.estimatedKillsPerSecond,
    )
    expect(highCombatState.estimatedKillsPerSecond).toBe(DEFAULT_SCENARIO.enemySupplyPerSecond)
    expect(lowHealing.leechingPerSecond).toBeLessThan(highHealing.leechingPerSecond)
    expect(lowDefense.guardingStrikeUptime).toBeLessThan(highDefense.guardingStrikeUptime)
  })

  it('increases Radiance healing when attack rate increases', () => {
    const fastDamage = calculateDamage(
      { weaponId: 'fighters-bindings' }, [], noArtifactEffects, DEFAULT_SCENARIO,
    )
    const slowDamage = calculateDamage(
      { weaponId: 'anchor' }, [], noArtifactEffects, DEFAULT_SCENARIO,
    )
    const fastHealing = calculateHealing(
      [selected('radiance')],
      fastDamage,
      deriveCombatState(fastDamage, DEFAULT_SCENARIO),
      DEFAULT_SCENARIO,
    )
    const slowHealing = calculateHealing(
      [selected('radiance')],
      slowDamage,
      deriveCombatState(slowDamage, DEFAULT_SCENARIO),
      DEFAULT_SCENARIO,
    )

    expect(fastHealing.radiancePerSecond).toBeGreaterThan(slowHealing.radiancePerSecond)
  })
})

describe('evaluate', () => {
  it('returns independent damage, healing, defense and confidence metrics', () => {
    const result = evaluate(bindingsBuild, DEFAULT_SCENARIO)
    expect(result.damage.singleTargetDps).toBeGreaterThan(0)
    expect(result.healing.totalPerSecond).toBeGreaterThan(0)
    expect(result.defense.effectiveHealth).toBe(DEFAULT_SCENARIO.maxHealth)
    expect(result.confidence.caveats.length).toBeGreaterThan(0)
    expect(result.confidence.factors.some((factor) => factor.id === 'kill-rate-model')).toBe(true)
    expect(result.confidence.factors.some((factor) => factor.id === 'average-enemy-health')).toBe(true)
    expect(result.confidence.coverageScore).toBeLessThan(0.55)
    expect(result.confidence.label).toBe('low')
    expect(result.utilities.damage).toBeGreaterThan(0)
    expect(result.contributions).toHaveLength(3)
  })

  it('rejects a selection that is not offered in its slot', () => {
    expect(() =>
      evaluate(
        {
          ...bindingsBuild,
          enchantments: [selected('void-strike'), selected('radiance'), selected('leeching')],
        },
        DEFAULT_SCENARIO,
      ),
    ).toThrowError(OptimizerInputError)
  })

  it('rejects duplicate non-stackable enchantments in a direct evaluation', () => {
    expect(() => evaluate({
      weapon: {
        ...bindingsBuild.weapon,
        enchantmentSlots: [
          { candidates: ['critical-hit'] },
          { candidates: ['critical-hit'] },
        ],
      },
      enchantments: [selected('critical-hit'), selected('critical-hit')],
      artifacts: [],
    }, DEFAULT_SCENARIO)).toThrow('最大1個')
  })
})
