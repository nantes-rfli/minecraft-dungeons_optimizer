import { describe, expect, it } from 'vitest'
import { ARMORS, type RuntimeArmorDefinition } from '../src/data/armors'
import type { ArmorId } from '../src/core/armor'
import { ARMOR_EVIDENCE_BINDINGS, armorNumericEvidenceRows } from '../src/core/armorEvidence'
import { PARAMETER_EVIDENCE } from '../src/core/evidenceStatus'
import {
  collectLimitedArmorCatalogErrors, collectLimitedArmorReuseErrors,
  HISTORICAL_LIMITED_ARMOR_IDS, LIMITED_ARMOR_REUSE_APPROVALS,
  type LimitedArmorReuseApproval,
} from '../src/research/limitedMechanicReuse'

// Contract case only: Thief is NOT added to ARMORS or runtime support by this PR.
const proposedThief: RuntimeArmorDefinition = {
  ...ARMORS['spider-armor'],
  id: 'thief-armor' as ArmorId,
  name: { en: 'Thief Armor', ja: 'シーフアーマー' },
  family: 'Thief Armor',
  intrinsicProperties: [{ kind: 'melee-attack-speed', raw: '+25% melee attack speed' }],
  meleeDamageBonus: 0,
  weaponDamageAuraBonus: 0,
  armorDamageReduction: 0,
  soulGatheringMultiplier: 1,
  lifeStealFraction: 0,
  artifactCooldownReduction: 0,
}

const thiefCase: LimitedArmorReuseApproval = {
  targetId: 'thief-armor',
  rawIdentity: 'AssassinArmor',
  donorId: 'spider-armor',
  sourceRef: 'research/armor-audit.json',
  sourceId: 'dungeons-tools-armor-index',
  propertyRaw: '+25% melee attack speed',
  propertyKind: 'melee-attack-speed',
  parameterId: 'meleeAttackSpeedBonus',
  parameterValue: 0.25,
  gameVersion: '1.17.0.0',
  channel: 'direct-melee-cadence',
  scope: 'single-armor-speed-source',
  composition: 'reject-unverified',
  excludedPropertyKinds: ['life-steal-aura'],
  rejectedInteractions: ['death-cap-mushroom', 'rampaging'],
  testRefs: {
    positive: 'tests/limitedMechanicReuse.test.ts#positive',
    negative: 'tests/limitedMechanicReuse.test.ts#negative',
    preservation: 'tests/limitedMechanicReuse.test.ts#preservation',
  },
}

describe('Existing Limited Armor mechanic reuse architecture', () => {
  it('preservation: preserves seven historical Limited Armors and their 16 explicit derived Evidence entries', () => {
    expect(Object.keys(ARMORS)).toEqual(HISTORICAL_LIMITED_ARMOR_IDS)
    expect(LIMITED_ARMOR_REUSE_APPROVALS).toEqual([])
    expect(collectLimitedArmorCatalogErrors()).toEqual([])
    const rows = Object.values(ARMORS).flatMap(armorNumericEvidenceRows)
    expect(rows).toHaveLength(16)
    expect(rows.every((row) => row.binding?.status === 'derived')).toBe(true)
    const registered = PARAMETER_EVIDENCE.filter((entry) => entry.mechanicId.startsWith('armor:'))
    expect(registered).toHaveLength(16)
    expect(registered.every((entry) => entry.status === 'derived')).toBe(true)
  })

  it('positive: Thief source, exact base→unique inheritance, Limited speed and single-channel model match', () => {
    expect(collectLimitedArmorReuseErrors(thiefCase, proposedThief)).toEqual([])
    expect(proposedThief.lifeStealFraction).toBe(0)
    expect(ARMORS['spider-armor'].lifeStealFraction).toBe(0.06)
  })

  it('negative: source Identity, value, version, semantics, extra effect and interaction drift fail closed', () => {
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, rawIdentity: 'unverified' }, proposedThief)).toContain('reuse target Identity is not source-backed')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, sourceId: 'invented' }, proposedThief)).toContain('reuse source/property provenance is missing')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, gameVersion: 'older' as LimitedArmorReuseApproval['gameVersion'] }, proposedThief)).toContain('reuse game version mismatch')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, parameterValue: 0.30 }, proposedThief)).toContain('reuse donor has no matching Limited model/parameter')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, channel: 'ranged' as LimitedArmorReuseApproval['channel'] }, proposedThief)).toContain('reuse channel/scope/composition does not match the existing model')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, excludedPropertyKinds: [] }, proposedThief)).toContain('donor-only properties are not explicitly excluded')
    expect(collectLimitedArmorReuseErrors({ ...thiefCase, rejectedInteractions: [] }, proposedThief)).toContain('unverified speed compositions are not rejected')
    expect(collectLimitedArmorReuseErrors(thiefCase, { ...proposedThief, lifeStealFraction: 0.06 })).toContain('reuse target inherits unrelated runtime effect: lifeStealFraction')
    expect(collectLimitedArmorReuseErrors(thiefCase, { ...proposedThief, armorDamageReduction: 0.35 })).toContain('reuse target inherits unrelated runtime effect: armorDamageReduction')
  })

  it('negative: runtime registration or reuse approval alone never adopts target parameter Evidence', () => {
    const syntheticCatalog = { ...ARMORS, 'thief-armor': proposedThief }
    expect(collectLimitedArmorCatalogErrors(syntheticCatalog)).toContain('thief-armor: runtime Armor lacks explicit Limited reuse approval or P3B promotion')
    expect(collectLimitedArmorCatalogErrors(syntheticCatalog, [thiefCase])).toContain('thief-armor/meleeAttackSpeedBonus: missing or drifted parameter Evidence declaration')
    expect(armorNumericEvidenceRows(proposedThief).find((row) => row.parameter === 'meleeAttackSpeedBonus')?.binding).toBeUndefined()
    expect(ARMOR_EVIDENCE_BINDINGS['thief-armor']).toBeUndefined()
    expect(PARAMETER_EVIDENCE.some((row) => row.mechanicId === 'armor:thief-armor')).toBe(false)
    expect(collectLimitedArmorCatalogErrors(ARMORS, [thiefCase])).toContain('thief-armor: reuse approval has no runtime target')
  })
})
