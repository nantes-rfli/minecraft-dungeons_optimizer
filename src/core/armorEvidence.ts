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

/**
 * This independent, reviewed decision is required only when a parameter is
 * classified as Measured or Verified. A Limited reuse approval is not an
 * Evidence classification decision. References must identify retained
 * research records, not runtime definitions or tests. Their existence and
 * independence are not verified here, so these decisions cannot yet grant status.
 */
export interface ArmorIndependentClassificationDecision {
  readonly armorId: string
  readonly parameter: ArmorNumericParameter
  readonly expectedValue: number
  readonly gameVersion: string
  readonly status: 'measured' | 'verified'
  readonly decision: 'accepted' | 'held' | 'rejected'
  readonly decisionRef: string
  readonly independentEvidence: readonly {
    readonly ref: string
    readonly originId: string
    readonly gameVersion: string
    readonly method: 'measurement' | 'holdout'
  }[]
  readonly reviewerDecision: 'approved' | 'pending'
}

/** No currently registered Armor parameter has a high-confidence adoption
 * decision; adding an Armor to runtime NEVER populates this registry.
 */
export const ARMOR_INDEPENDENT_CLASSIFICATION_DECISIONS: readonly ArmorIndependentClassificationDecision[] = []

/** A declaration alone, or a Limited reuse approval, cannot grant
 * Measured/Verified. Evidence and review must be separately recorded.
 */
export function hasIndependentArmorClassification(
  _armorId: string,
  _parameter: ArmorNumericParameter,
  declaration: ArmorEvidenceBinding,
  _decisions: readonly ArmorIndependentClassificationDecision[] = ARMOR_INDEPENDENT_CLASSIFICATION_DECISIONS,
): boolean {
  // These records contain self-declared references and origin IDs. Neither
  // existence of the referenced files nor independence of the underlying raw
  // measurements is verified by this runtime path. An accepted/approved string
  // must never be sufficient to classify a parameter as Measured or Verified.
  // Fail closed until a source-backed verifier with an independent review gate
  // is implemented. Existing Derived/Estimated declarations are unaffected.
  // An invalid injected decision registry must not bypass this boundary.
  if (!Array.isArray(_decisions)) return false
  return declaration.status !== 'measured' && declaration.status !== 'verified'
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
  },
  "hungry-horror": {
    "meleeAttackSpeedBonus": {
      "expectedValue": 0.25,
      "propertyKind": "melee-attack-speed",
      "propertyRaw": "+25% melee attack speed",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungry Horror自身の監査済みpropertyをRenegade Armorの既存Limited境界で完全一致再利用。Death Cap/Rampaging合成はunsupported。"
    },
    "weaponDamageAuraBonus": {
      "expectedValue": 0.2,
      "propertyKind": "weapon-damage-aura",
      "propertyRaw": "+20% weapon damage boost aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungry Horror自身の監査済みpropertyを既存Limited direct-melee damage境界で完全一致再利用。"
    },
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungry Horror自身の監査済み35% Armor DR。Iron Hide/Potion Barrier/Guarding Strike/Weakening/Protectionとの合成はunsupported。"
    }
  },
  "hungriest-horror": {
    "meleeAttackSpeedBonus": {
      "expectedValue": 0.25,
      "propertyKind": "melee-attack-speed",
      "propertyRaw": "+25% melee attack speed",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungriest Horror自身の監査済みpropertyをRenegade Armorの既存Limited境界で完全一致再利用。Death Cap/Rampaging合成はunsupported。"
    },
    "weaponDamageAuraBonus": {
      "expectedValue": 0.2,
      "propertyKind": "weapon-damage-aura",
      "propertyRaw": "+20% weapon damage boost aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungriest Horror自身の監査済みpropertyを既存Limited direct-melee damage境界で完全一致再利用。"
    },
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "Hungriest Horror自身の監査済み35% Armor DR。Iron Hide/Potion Barrier/Guarding Strike/Weakening/Protectionとの合成はunsupported。"
    }
  },
  "the-spooky-gourdian": {
    "armorDamageReduction": {
      "expectedValue": 0.35,
      "propertyKind": "damage-reduction",
      "propertyRaw": "35% damage reduction",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "The Spooky Gourdian自身の監査済み35% Armor DRをWither Armorの既存Limited境界で完全一致再利用。防御source合成はunsupported。"
    },
    "soulGatheringMultiplier": {
      "expectedValue": 1.5,
      "propertyKind": "soul-gathering",
      "propertyRaw": "+50% souls gathered",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "The Spooky Gourdian自身の監査済み+50% souls。既存flat Gatheringだけを1.5倍し、Soul Siphon合成はunsupported。"
    },
    "lifeStealFraction": {
      "expectedValue": 0.06,
      "propertyKind": "life-steal-aura",
      "propertyRaw": "6% life steal aura",
      "sourceId": "dungeons-tools-armor-index",
      "gameVersion": "1.17.0.0",
      "status": "derived",
      "conditions": "The Spooky Gourdian自身の監査済み6% Life Steal。既存Wither境界どおりmodeled direct melee damageだけを対象とする。"
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
export function armorNumericEvidenceRows(
  armor: RuntimeArmorDefinition,
  declarations: Readonly<Record<string, Partial<Record<ArmorNumericParameter, ArmorEvidenceBinding>>>> = ARMOR_EVIDENCE_BINDINGS,
  decisions: readonly ArmorIndependentClassificationDecision[] = ARMOR_INDEPENDENT_CLASSIFICATION_DECISIONS,
): readonly {
  readonly parameter: ArmorNumericParameter
  readonly parameterId: string
  readonly value: number
  readonly binding?: ArmorEvidenceBinding
}[] {
  return ARMOR_NUMERIC_PARAMETERS.flatMap((parameter) => {
    const value = armor[parameter]
    if (value === (parameter === 'soulGatheringMultiplier' ? 1 : 0)) return []
    const declaration = declarations[armor.id]?.[parameter]
    const matched = declaration
      && declaration.expectedValue === value
      && armor.intrinsicProperties.some((property) => property.kind === declaration.propertyKind && property.raw === declaration.propertyRaw)
      && hasIndependentArmorClassification(armor.id, parameter, declaration, decisions)
    return [{
      parameter,
      parameterId: ARMOR_PARAMETER_IDS[parameter],
      value,
      ...(matched ? { binding: declaration } : {}),
    }]
  })
}
