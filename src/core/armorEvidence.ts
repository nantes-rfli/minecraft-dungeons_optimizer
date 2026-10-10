import type { RuntimeArmorDefinition } from '../data/armors'

/** Evidence approval is explicit per parameter, NEVER derived from ARMORS membership.
 * These 16 pre-existing Limited Armor parameters are pinned to their historical
 * classification; additions need an independently reviewed evidence declaration.
 * `derived` is a display/evaluation classification, NOT R3 accepted adoption.
 */
export const ARMOR_NUMERIC_PARAMETERS = [
  'meleeDamageBonus', 'weaponDamageAuraBonus', 'meleeAttackSpeedBonus',
  'armorDamageReduction', 'soulGatheringMultiplier', 'lifeStealFraction',
  'artifactCooldownReduction',
] as const

export type ArmorNumericParameter = (typeof ARMOR_NUMERIC_PARAMETERS)[number]

export interface ArmorEvidenceBinding {
  readonly expectedValue: number
  readonly propertyKind: string
  readonly propertyRaw: string
  readonly sourceId: string
  readonly gameVersion: string
  readonly status: 'derived' | 'measured' | 'verified' | 'estimated'
  readonly conditions: string
}

/** Deliberately not populated by iterating over runtime definitions. */
export const ARMOR_EVIDENCE_BINDINGS: Readonly<Record<string, Partial<Record<ArmorNumericParameter, ArmorEvidenceBinding>>>> = {
  "battle-robe": {
    "meleeDamageBonus": {
      "expectedValue": 0.3,
      "propertyKind": "melee-damage",
      "propertyRaw": "+30% melee damage",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "artifactCooldownReduction": {
      "expectedValue": 0.4,
      "propertyKind": "artifact-cooldown",
      "propertyRaw": "-40% artifact cooldown",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "renegade-armor": {
    "meleeAttackSpeedBonus": {
      "expectedValue": 0.25,
      "propertyKind": "melee-attack-speed",
      "propertyRaw": "+25% melee attack speed",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "weaponDamageAuraBonus": {
      "expectedValue": 0.2,
      "propertyKind": "weapon-damage-aura",
      "propertyRaw": "+20% weapon damage boost aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% Damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "wither-armor": {
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "soulGatheringMultiplier": {
      "expectedValue": 1.5,
      "propertyKind": "soul-gathering",
      "propertyRaw": "+50% souls gathered",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "lifeStealFraction": {
      "expectedValue": 0.06,
      "propertyKind": "life-steal-aura",
      "propertyRaw": "6% life steal aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "mercenary-armor": {
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "weaponDamageAuraBonus": {
      "expectedValue": 0.2,
      "propertyKind": "weapon-damage-aura",
      "propertyRaw": "+20% weapon damage boost aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "grim-armor": {
    "soulGatheringMultiplier": {
      "expectedValue": 1.5,
      "propertyKind": "soul-gathering",
      "propertyRaw": "+50% souls gathered",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "lifeStealFraction": {
      "expectedValue": 0.06,
      "propertyKind": "life-steal-aura",
      "propertyRaw": "6% life steal aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "scale-mail": {
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "meleeDamageBonus": {
      "expectedValue": 0.3,
      "propertyKind": "melee-damage",
      "propertyRaw": "+30% melee damage",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  },
  "spider-armor": {
    "meleeAttackSpeedBonus": {
      "expectedValue": 0.25,
      "propertyKind": "melee-attack-speed",
      "propertyRaw": "25% melee attack speed",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    },
    "lifeStealFraction": {
      "expectedValue": 0.06,
      "propertyKind": "life-steal-aura",
      "propertyRaw": "6% life steal aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "監査済みintrinsic propertyの自己効果だけ。"
    }
  }
} as const

export const ARMOR_PARAMETER_IDS: Readonly<Record<ArmorNumericParameter, string>> = {
  meleeDamageBonus: 'melee-damage-bonus',
  weaponDamageAuraBonus: 'weapon-damage-aura-bonus',
  meleeAttackSpeedBonus: 'melee-attack-speed-bonus',
  armorDamageReduction: 'damage-reduction',
  soulGatheringMultiplier: 'soul-gathering-multiplier',
  lifeStealFraction: 'life-steal-fraction',
  artifactCooldownReduction: 'artifact-cooldown-reduction',
}

/** Non-neutral registered numbers without a matching source-bound declaration
 * stay unclassified, rather than acquiring Evidence from runtime membership. */
export function armorNumericEvidenceRows(armor: RuntimeArmorDefinition): readonly {
  readonly parameter: ArmorNumericParameter
  readonly parameterId: string
  readonly value: number
  readonly binding?: ArmorEvidenceBinding
}[] {
  return ARMOR_NUMERIC_PARAMETERS.flatMap((parameter) => {
    const value = armor[parameter]
    if (value === (parameter === 'soulGatheringMultiplier' ? 1 : 0)) return []
    const declaration = ARMOR_EVIDENCE_BINDINGS[armor.id]?.[parameter]
    const matched = declaration
      && declaration.expectedValue === value
      && armor.intrinsicProperties.some((property) => property.kind === declaration.propertyKind && property.raw === declaration.propertyRaw)
    return [{
      parameter,
      parameterId: ARMOR_PARAMETER_IDS[parameter],
      value,
      ...(matched ? { binding: declaration } : {}),
    }]
  })
}
