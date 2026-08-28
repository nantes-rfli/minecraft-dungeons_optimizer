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
  it('derives each supported weapon rate from published per-hit timings', () => {
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES['fighters-bindings'].value))
      .toBeCloseTo(4 / 0.575)
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES['double-axe'].value))
      .toBeCloseTo(2 / 1.2)
    expect(calculateBaseHitsPerSecond(ATTACK_PROFILES.anchor.value)).toBeCloseTo(1 / 2.5)
  })

  it('rejects incomplete or invalid published hit timing profiles', () => {
    expect(() => calculateBaseHitsPerSecond({
      method: 'published-hit-timings',
      hitDurationsSeconds: [],
      comboFinisherHit: 1,
    })).toThrow('1件以上')
    expect(() => calculateBaseHitsPerSecond({
      method: 'published-hit-timings',
      hitDurationsSeconds: [0.5, 0],
      comboFinisherHit: 2,
    })).toThrow('0より大きい有限値')
    expect(() => calculateBaseHitsPerSecond({
      method: 'published-hit-timings',
      hitDurationsSeconds: [0.5, 0.5],
      comboFinisherHit: 3,
    })).toThrow('有効なhit番号')
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
      { weaponId: 'fighters-bindings', powerLevel: 251 },
      [selected('critical-hit')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(damage.damageSource).toBe('power-curve-estimate')
    expect(damage.damagePerHit).toBe(188_334)
    expect(damage.hitsPerSecond).toBeCloseTo(4 / 0.575)
    expect(damage.baseDps).toBeCloseTo(188_334 * 4 / 0.575)
    expect(damage.criticalMultiplier).toBeCloseTo(1.4)
    expect(damage.singleTargetDps).toBeCloseTo((188_334 * 4 / 0.575) * 1.4)
  })

  it('rewards slower weapons under the provisional Void Strike model', () => {
    const anchor = calculateDamage(
      { weaponId: 'anchor', powerLevel: 251 },
      [selected('void-strike')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const bindings = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 },
      [selected('void-strike')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(anchor.voidStrikeMultiplier).toBeGreaterThan(bindings.voidStrikeMultiplier)
  })

  it('scales the Tier III reference curve to each Void Strike tier', () => {
    const multipliers = ([1, 2, 3] as const).map((tier) => calculateDamage(
      { weaponId: 'anchor', powerLevel: 251 },
      [selected('void-strike', tier, 'gilded')],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    ).voidStrikeMultiplier)

    expect(multipliers[0]).toBeLessThan(multipliers[1]!)
    expect(multipliers[1]).toBeLessThan(multipliers[2]!)
  })

  it('uses an observed item-card damage value when one is supplied', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 1, observedDamagePerHit: 100 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(damage.damageSource).toBe('observed-input')
    expect(damage.damagePerHit).toBe(100)
    expect(damage.baseDps).toBeCloseTo(400 / 0.575)
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

describe('CombatState', () => {
  it('derives direct weapon kills from the shared direct-kill boundary', () => {
    const scenario = {
      ...DEFAULT_SCENARIO,
      enemySupplyPerSecond: 1,
      directKillShare: 0.6,
    }
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 100 },
      [],
      noArtifactEffects,
      scenario,
    )
    const combatState = deriveCombatState(damage, scenario)

    expect(combatState.estimatedKillsPerSecond).toBe(1)
    expect(combatState.directWeaponKillsPerSecond).toBeCloseTo(0.6)
  })
})

describe('healing and defense models', () => {
  it('adds Radiance proc healing and direct-kill Leeching healing', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 },
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
    expect(healing.radiancePerSecond).toBeCloseTo(13.9130434783)
    expect(healing.leechingPerSecond).toBeCloseTo(4.05)
    expect(healing.totalPerSecond).toBeCloseTo(17.9630434783)
  })

  it('matches the reported Radiance healing stack for one, two and three copies', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const combatState = deriveCombatState(damage, DEFAULT_SCENARIO)
    const radiancePerSecond = (copies: number) => calculateHealing(
      Array.from({ length: copies }, (_, index) => selected(
        'radiance',
        3,
        index === copies - 1 && copies > 1 ? 'gilded' : 'slot',
      )),
      damage,
      combatState,
      DEFAULT_SCENARIO,
    ).radiancePerSecond

    expect(radiancePerSecond(1)).toBeCloseTo(13.9130434783)
    expect(radiancePerSecond(2)).toBeCloseTo(24.347826087)
    expect(radiancePerSecond(3)).toBeCloseTo(31.3043478261)
  })

  it('applies Radiance copy coefficients to mixed tiers in descending value order', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const healing = calculateHealing(
      [selected('radiance', 3), selected('radiance', 1, 'gilded')],
      damage,
      deriveCombatState(damage, DEFAULT_SCENARIO),
      DEFAULT_SCENARIO,
    )

    expect(healing.radiancePerSecond).toBeCloseTo(19.1304347826)
  })

  it('uses a Poisson uptime model for Guarding Strike', () => {
    const defense = calculateDefense(
      [selected('guarding-strike')],
      noArtifactEffects,
      {
        effectiveDamagePerSecond: 50,
        damageLimitedKillsPerSecond: 0.5,
        estimatedKillsPerSecond: 0.5,
        directWeaponKillsPerSecond: 0.45,
      },
      DEFAULT_SCENARIO,
    )
    expect(defense.guardingStrikeUptime).toBeCloseTo(1 - Math.exp(-1.8))
    expect(defense.damageTakenMultiplier).toBeLessThan(1)
    expect(defense.effectiveHealth).toBeGreaterThan(DEFAULT_SCENARIO.maxHealth)
  })

  it('increases kill-triggered effects when Build damage increases', () => {
    const lowDamage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 1 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const highDamage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 100 },
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

  it('uses the same direct weapon kill count for Leeching and Guarding Strike', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 }, [], noArtifactEffects, DEFAULT_SCENARIO,
    )
    const combatState = {
      effectiveDamagePerSecond: 100,
      damageLimitedKillsPerSecond: 1,
      estimatedKillsPerSecond: 1,
      directWeaponKillsPerSecond: 0.2,
    }
    const scenario = { ...DEFAULT_SCENARIO, directKillShare: 0.95 }
    const healing = calculateHealing(
      [selected('leeching')], damage, combatState, scenario,
    )
    const defense = calculateDefense(
      [selected('guarding-strike')], noArtifactEffects, combatState, scenario,
    )

    expect(healing.leechingPerSecond).toBeCloseTo(
      combatState.directWeaponKillsPerSecond * scenario.averageEnemyHealth * 0.09,
    )
    expect(defense.guardingStrikeUptime).toBeCloseTo(
      1 - Math.exp(-combatState.directWeaponKillsPerSecond * 4),
    )
  })

  it('reduces both kill-triggered effects when direct kill share decreases', () => {
    const damage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 100 },
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const highShareScenario = { ...DEFAULT_SCENARIO, directKillShare: 1 }
    const lowShareScenario = { ...DEFAULT_SCENARIO, directKillShare: 0.25 }
    const highState = deriveCombatState(damage, highShareScenario)
    const lowState = deriveCombatState(damage, lowShareScenario)

    expect(calculateHealing(
      [selected('leeching')], damage, lowState, lowShareScenario,
    ).leechingPerSecond).toBeLessThan(calculateHealing(
      [selected('leeching')], damage, highState, highShareScenario,
    ).leechingPerSecond)
    expect(calculateDefense(
      [selected('guarding-strike')], noArtifactEffects, lowState, lowShareScenario,
    ).guardingStrikeUptime).toBeLessThan(calculateDefense(
      [selected('guarding-strike')], noArtifactEffects, highState, highShareScenario,
    ).guardingStrikeUptime)
  })

  it('increases Radiance healing when attack rate increases', () => {
    const fastDamage = calculateDamage(
      { weaponId: 'fighters-bindings', powerLevel: 251 }, [], noArtifactEffects, DEFAULT_SCENARIO,
    )
    const slowDamage = calculateDamage(
      { weaponId: 'anchor', powerLevel: 251 }, [], noArtifactEffects, DEFAULT_SCENARIO,
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

  it('includes direct-kill evidence for a Guarding Strike build', () => {
    const build: Build = {
      weapon: {
        instanceId: 'guarding-test',
        weaponId: 'anchor',
        powerLevel: 251,
        enchantmentSlots: [{ candidates: ['guarding-strike'] }],
      },
      enchantments: [selected('guarding-strike')],
      artifacts: [],
    }
    const result = evaluate(build, DEFAULT_SCENARIO)

    expect(result.confidence.factors.some(
      (factor) => factor.id === 'direct-kill-share',
    )).toBe(true)
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
