import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { calculateArtifactEffects, calculateArtifactUptime } from '../src/core/artifact'
import { calculateDamage } from '../src/core/damage'
import { calculateDefense } from '../src/core/defense'
import { calculateHealing } from '../src/core/healing'
import { evaluate, OptimizerInputError } from '../src/core'
import type { Build } from '../src/core'

const noArtifactEffects = {
  attackSpeedMultiplier: 1,
  damageTakenMultiplier: 1,
  uptimes: [],
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
  enchantments: ['critical-hit', 'radiance', 'leeching'],
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
})

describe('damage model', () => {
  it('calculates Critical Hit III as a 1.4 expected multiplier', () => {
    const damage = calculateDamage(
      'fighters-bindings',
      ['critical-hit'],
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
      'anchor',
      ['void-strike'],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const bindings = calculateDamage(
      'fighters-bindings',
      ['void-strike'],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(anchor.voidStrikeMultiplier).toBeGreaterThan(bindings.voidStrikeMultiplier)
  })
})

describe('healing and defense models', () => {
  it('adds Radiance proc healing and direct-kill Leeching healing', () => {
    const damage = calculateDamage(
      'fighters-bindings',
      [],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    const healing = calculateHealing(['radiance', 'leeching'], damage, DEFAULT_SCENARIO)
    expect(healing.radiancePerSecond).toBeCloseTo(14)
    expect(healing.leechingPerSecond).toBeCloseTo(4.05)
    expect(healing.totalPerSecond).toBeCloseTo(18.05)
  })

  it('uses a Poisson uptime model for Guarding Strike', () => {
    const defense = calculateDefense(
      ['guarding-strike'],
      noArtifactEffects,
      DEFAULT_SCENARIO,
    )
    expect(defense.guardingStrikeUptime).toBeCloseTo(1 - Math.exp(-2))
    expect(defense.damageTakenMultiplier).toBeLessThan(1)
    expect(defense.effectiveHealth).toBeGreaterThan(DEFAULT_SCENARIO.maxHealth)
  })
})

describe('evaluate', () => {
  it('returns independent damage, healing, defense and confidence metrics', () => {
    const result = evaluate(bindingsBuild, DEFAULT_SCENARIO)
    expect(result.damage.singleTargetDps).toBeGreaterThan(0)
    expect(result.healing.totalPerSecond).toBeGreaterThan(0)
    expect(result.defense.effectiveHealth).toBe(DEFAULT_SCENARIO.maxHealth)
    expect(result.confidence.caveats.length).toBeGreaterThan(0)
    expect(result.utilities.damage).toBeGreaterThan(0)
    expect(result.contributions).toHaveLength(3)
  })

  it('rejects a selection that is not offered in its slot', () => {
    expect(() =>
      evaluate(
        { ...bindingsBuild, enchantments: ['void-strike', 'radiance', 'leeching'] },
        DEFAULT_SCENARIO,
      ),
    ).toThrowError(OptimizerInputError)
  })
})
