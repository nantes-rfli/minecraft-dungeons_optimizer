import type { FormalIdentityDefinition, IdentityAssertion, IdentityPresentation, ReviewedEvidenceInput } from './identityEvidence.ts'

const scope = (packagePath: string): IdentityAssertion['applicationScope'] => ({
  rawSchemaVersion: 2,
  packagePath,
  requireUnambiguousCdo: true,
  identityFields: { itemIdName: 'ItemIdName', serializedId: 'ItemId.SerializedId' },
})

function definition(
  assertion: IdentityAssertion,
  displayName: string,
  presentationEvidenceRef: string,
  reviewedEvidence: ReviewedEvidenceInput[],
): FormalIdentityDefinition {
  const presentation: IdentityPresentation = { domainId: assertion.domainId, displayName, evidenceRefs: [presentationEvidenceRef] }
  return { assertion, presentation, reviewedEvidence }
}

const fightersPackage = 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance'
export const fightersBindingsFormalIdentity = definition(
  {
    id: 'identity:fighters-bindings@1', rawIdentity: 'Gauntlets_Unique3', domainId: 'fighters-bindings', reviewState: 'provisional',
    applicationScope: scope(fightersPackage),
    evidenceRefs: [
      'evidence:reviewed:fighters-bindings:historical-mapping',
      'evidence:reviewed:fighters-bindings:alias-limitation',
      'evidence:reviewed:fighters-bindings:icon-conflict',
    ],
  },
  "Fighter's Bindings",
  'evidence:presentation:fighters-bindings:catalog',
  [
    {
      id: 'evidence:reviewed:fighters-bindings:historical-mapping', kind: 'reviewed', role: 'support',
      detail: 'Historical hard-coded association claimed exact-via-serialized-id without a reviewed name bridge.',
      source: { artifactPath: 'scripts/audit-attack-event-comparison.ts', locator: 'mappings', revision: 'cb22dede14bfba88d15e1539c2b68d1bf4f8f649' },
    },
    {
      id: 'evidence:reviewed:fighters-bindings:alias-limitation', kind: 'reviewed', role: 'limitation',
      detail: 'The repository alias remains unresolved; the unique variant does not establish a reviewed name equivalence.',
      source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=melee-weapon:Gauntlets_Unique3]' },
    },
    {
      id: 'evidence:reviewed:fighters-bindings:icon-conflict', kind: 'reviewed', role: 'conflict',
      detail: 'An ordinal icon heuristic historically associated the same package family with another catalog identity and is not authoritative identity evidence.',
      source: { artifactPath: 'generated/equipment-icons/manifest.json', locator: 'entries[sourcePackage=.../Gauntlets_Unique3]' },
    },
    {
      id: 'evidence:presentation:fighters-bindings:catalog', kind: 'reviewed', role: 'support',
      detail: 'Repository presentation catalog supplies the English display name independently of identity matching.',
      source: { artifactPath: 'src/data/weapons.ts', locator: "WEAPONS['fighters-bindings'].name.en" },
    },
  ],
)


type AcceptedMeleeIdentityInput = {
  domainId: string
  rawIdentity: string
  packagePath: string
  displayName: string
}

export const readyMeleeFormalIdentityInputs = [
  { domainId: 'anchor', rawIdentity: 'Anchor', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/BP_AnchorInstance', displayName: 'Anchor' },
  { domainId: 'axe', rawIdentity: 'Axe', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance', displayName: 'Axe' },
  { domainId: 'backstabber', rawIdentity: 'Backstabber', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance', displayName: 'Backstabber' },
  { domainId: 'battlestaff', rawIdentity: 'Battlestaff', packagePath: 'Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance', displayName: 'Battlestaff' },
  { domainId: 'boneclub', rawIdentity: 'Boneclub', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/BP_BoneclubInstance', displayName: 'Boneclub' },
  { domainId: 'claymore', rawIdentity: 'Claymore', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance', displayName: 'Claymore' },
  { domainId: 'coral-blade', rawIdentity: 'CoralBlade', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance', displayName: 'Coral Blade' },
  { domainId: 'cutlass', rawIdentity: 'Cutlass', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/BP_CutlassInstance', displayName: 'Cutlass' },
  { domainId: 'daggers', rawIdentity: 'Daggers', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance', displayName: 'Daggers' },
  { domainId: 'double-axe', rawIdentity: 'DoubleAxe', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance', displayName: 'Double Axe' },
  { domainId: 'gauntlets', rawIdentity: 'Gauntlets', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance', displayName: 'Gauntlets' },
  { domainId: 'glaive', rawIdentity: 'Glaive', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance', displayName: 'Glaive' },
  { domainId: 'katana', rawIdentity: 'Katana', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance', displayName: 'Katana' },
  { domainId: 'mace', rawIdentity: 'Mace', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance', displayName: 'Mace' },
  { domainId: 'obsidian-claymore', rawIdentity: 'ObsidianClaymore', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/BP_ObsidianClaymoreInstance', displayName: 'Obsidian Claymore' },
  { domainId: 'pickaxe', rawIdentity: 'Pickaxe', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/BP_Pickaxe_SteelInstance', displayName: 'Pickaxe' },
  { domainId: 'rapier', rawIdentity: 'Rapier', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance', displayName: 'Rapier' },
  { domainId: 'sickles', rawIdentity: 'Sickles', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance', displayName: 'Sickles' },
  { domainId: 'soul-knife', rawIdentity: 'SoulKnife', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulKnife/BP_SoulKnifeInstance', displayName: 'Soul Knife' },
  { domainId: 'soul-scythe', rawIdentity: 'SoulScythe', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/BP_SoulScytheInstance', displayName: 'Soul Scythe' },
  { domainId: 'spear', rawIdentity: 'Spear', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance', displayName: 'Spear' },
  { domainId: 'tempest-knife', rawIdentity: 'TempestKnife', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance', displayName: 'Tempest Knife' },
  { domainId: 'void-touched-blades', rawIdentity: 'VoidTouchedBlades', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance', displayName: 'Void Touched Blades' },
  { domainId: 'whip', rawIdentity: 'Whip', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Whip/BP_WhipInstance', displayName: 'Whip' },
] as const satisfies readonly AcceptedMeleeIdentityInput[]

function acceptedMeleeDefinition(input: AcceptedMeleeIdentityInput): FormalIdentityDefinition {
  const reviewedEvidenceRef = `evidence:reviewed:${input.domainId}:accepted-alias`
  const presentationEvidenceRef = `evidence:presentation:${input.domainId}:melee-audit`
  return definition(
    {
      id: `identity:${input.domainId}@1`,
      rawIdentity: input.rawIdentity,
      domainId: input.domainId,
      reviewState: 'accepted',
      confidence: 'high',
      applicationScope: scope(input.packagePath),
      evidenceRefs: [reviewedEvidenceRef],
    },
    input.displayName,
    presentationEvidenceRef,
    [
      {
        id: reviewedEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'Reviewed high-confidence alias maps the Raw identity to the canonical melee-weapon entity.',
        source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: `aliases[id=melee-weapon:${input.rawIdentity}]` },
      },
      {
        id: presentationEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The Melee audit supplies the English display name independently of identity matching.',
        source: { artifactPath: 'research/melee-attack-profile-audit.json', locator: `weapons[weaponId=${input.domainId}].name.en` },
      },
    ],
  )
}

export const readyMeleeFormalIdentities = readyMeleeFormalIdentityInputs.map(acceptedMeleeDefinition)


type AcceptedRangedIdentityInput = {
  domainId: string
  rawIdentity: string
  packagePath: string
  displayName: string
}

export const readyRangedFormalIdentityInputs = [
  { domainId: 'bow', rawIdentity: 'Bow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow/BP_BowInstance', displayName: 'Bow' },
  { domainId: 'bubble-bow', rawIdentity: 'BubbleBow', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_BubbleBowInstance', displayName: 'Bubble Bow' },
  { domainId: 'burst-crossbow', rawIdentity: 'BurstCrossbow', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossbowInstance', displayName: 'Burst Crossbow' },
  { domainId: 'cog-crossbow', rawIdentity: 'CogCrossbow', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowInstance', displayName: 'Cog Crossbow' },
  { domainId: 'crossbow', rawIdentity: 'Crossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_CrossbowInstance', displayName: 'Crossbow' },
  { domainId: 'dual-crossbows', rawIdentity: 'DualCrossbows', packagePath: 'Dungeons/Content/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossbowsInstance', displayName: 'Dual Crossbows' },
  { domainId: 'exploding-crossbow', rawIdentity: 'ExplodingCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowInstance', displayName: 'Exploding Crossbow' },
  { domainId: 'harpoon-crossbow', rawIdentity: 'HarpoonCrossbow', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowInstance', displayName: 'Harpoon Crossbow' },
  { domainId: 'heavy-crossbow', rawIdentity: 'HeavyCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbowInstance', displayName: 'Heavy Crossbow' },
  { domainId: 'hunting-bow', rawIdentity: 'HuntingBow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowInstance', displayName: 'Hunting Bow' },
  { domainId: 'longbow', rawIdentity: 'Longbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/LongBow/BP_LongbowInstance', displayName: 'Longbow' },
  { domainId: 'power-bow', rawIdentity: 'Powerbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/PowerBow/BP_PowerBowInstance', displayName: 'Power Bow' },
  { domainId: 'rapid-crossbow', rawIdentity: 'RapidCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossbowInstance', displayName: 'Rapid Crossbow' },
  { domainId: 'shadow-crossbow', rawIdentity: 'ShadowCrossbow', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowInstance', displayName: 'Shadow Crossbow' },
  { domainId: 'shortbow', rawIdentity: 'Shortbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortbowInstance', displayName: 'Shortbow' },
  { domainId: 'soul-bow', rawIdentity: 'SoulBow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowInstance', displayName: 'Soul Bow' },
  { domainId: 'soul-crossbow', rawIdentity: 'SoulCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossbowInstance', displayName: 'Soul Crossbow' },
  { domainId: 'trickbow', rawIdentity: 'Trickbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowInstance', displayName: 'Trickbow' },
  { domainId: 'twisting-vine-bow', rawIdentity: 'TwistingVineBow', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowInstance', displayName: 'Twisting Vine Bow' },
  { domainId: 'void-bow', rawIdentity: 'VoidBow', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowInstance', displayName: 'Void Bow' },
  { domainId: 'wind-bow', rawIdentity: 'WindBow', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowInstance', displayName: 'Wind Bow' },
] as const satisfies readonly AcceptedRangedIdentityInput[]

function acceptedRangedDefinition(input: AcceptedRangedIdentityInput): FormalIdentityDefinition {
  const reviewedEvidenceRef = `evidence:reviewed:${input.domainId}:accepted-alias`
  const presentationEvidenceRef = `evidence:presentation:${input.domainId}:ranged-audit`
  return definition(
    {
      id: `identity:${input.domainId}@1`,
      rawIdentity: input.rawIdentity,
      domainId: input.domainId,
      reviewState: 'accepted',
      confidence: 'high',
      applicationScope: scope(input.packagePath),
      evidenceRefs: [reviewedEvidenceRef],
    },
    input.displayName,
    presentationEvidenceRef,
    [
      {
        id: reviewedEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'Reviewed high-confidence alias maps the Raw identity to the canonical ranged-weapon entity.',
        source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: `aliases[id=ranged-weapon:${input.rawIdentity}]` },
      },
      {
        id: presentationEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The ranged audit supplies the English display name independently of identity matching.',
        source: { artifactPath: 'research/ranged-weapon-audit.json', locator: `entries[id=${input.domainId}].name.en` },
      },
    ],
  )
}

export const readyRangedFormalIdentities = readyRangedFormalIdentityInputs.map(acceptedRangedDefinition)

export const reviewedBridgeMeleeFormalIdentityInputs = [
  { domainId: 'bonehead-hammer', rawIdentity: 'SkeletonHammer', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance', displayName: 'Bonehead Hammer' },
  { domainId: 'sinister-sword', rawIdentity: 'Sword_Spooky1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance', displayName: 'Sinister Sword' },
] as const satisfies readonly AcceptedMeleeIdentityInput[]

export const reviewedBridgeRangedFormalIdentityInputs = [
  { domainId: 'shrieking-crossbow', rawIdentity: 'BatCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance', displayName: 'Shrieking Crossbow' },
] as const satisfies readonly AcceptedRangedIdentityInput[]

function documentedAliasBridgeDefinition(input: AcceptedMeleeIdentityInput, category: 'melee' | 'ranged' | 'artifact'): FormalIdentityDefinition {
  const base = category === 'melee'
    ? acceptedMeleeDefinition(input)
    : category === 'ranged'
      ? acceptedRangedDefinition(input)
      : acceptedArtifactDefinition(input)
  const overrideEvidenceRef = `evidence:reviewed:${input.domainId}:documented-entity-alias`
  return {
    ...base,
    assertion: {
      ...base.assertion,
      evidenceRefs: [...base.assertion.evidenceRefs, overrideEvidenceRef],
    },
    reviewedEvidence: [
      ...base.reviewedEvidence,
      {
        id: overrideEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The documented ENTITY_OVERRIDES table maps the canonical catalog key to the exact Raw identity.',
        source: { artifactPath: 'scripts/equipment-icons.ts', locator: `ENTITY_OVERRIDES['${category}:${input.domainId}']` },
      },
    ],
  }
}

export const reviewedBridgeMeleeFormalIdentities = reviewedBridgeMeleeFormalIdentityInputs.map((input) => documentedAliasBridgeDefinition(input, 'melee'))
export const reviewedBridgeRangedFormalIdentities = reviewedBridgeRangedFormalIdentityInputs.map((input) => documentedAliasBridgeDefinition(input, 'ranged'))

export const reviewedTypedRelationMeleeFormalIdentityInputs = [
  { domainId: 'broken-sawblade', rawIdentity: 'Chainsword', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword/BP_ChainswordInstance', displayName: 'Broken Sawblade' },
  { domainId: 'mechanized-sawblade', rawIdentity: 'Chainsword_Unique1', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword_Unique1/BP_Chainsword_Unique1Instance', displayName: 'Mechanized Sawblade' },
] as const satisfies readonly AcceptedMeleeIdentityInput[]

function typedRelationAliasBridgeDefinition(input: AcceptedMeleeIdentityInput): FormalIdentityDefinition {
  const base = acceptedMeleeDefinition(input)
  const bridgeEvidenceRef = `evidence:reviewed:${input.domainId}:typed-raw-relation-bridge`
  return {
    ...base,
    assertion: {
      ...base.assertion,
      evidenceRefs: [...base.assertion.evidenceRefs, bridgeEvidenceRef],
    },
    reviewedEvidence: [
      ...base.reviewedEvidence,
      {
        id: bridgeEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'A research-owned reviewed bridge pins the canonical source record to this exact Raw identity/package through the audited typed InventoryDropSound relation.',
        source: { artifactPath: 'scripts/game-data-model-alignment.ts', locator: `REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES[domainId=${input.domainId}]` },
      },
    ],
  }
}

export const reviewedTypedRelationMeleeFormalIdentities = reviewedTypedRelationMeleeFormalIdentityInputs.map(typedRelationAliasBridgeDefinition)

type ReviewedTypedRelationIdentityInput = AcceptedMeleeIdentityInput & { category: 'melee' | 'ranged' }

export const reviewedTypedRelationFormalIdentityInputs = [
  { category: 'melee', domainId: 'chill-gale-knife', rawIdentity: 'TempestKnife_Unique2', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique2/BP_TempestKnife_Unique2Instance', displayName: 'Chill Gale Knife' },
  { category: 'melee', domainId: 'resolute-tempest-knife', rawIdentity: 'TempestKnife_Unique1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife_Unique1/BP_TempestKnife_Unique1Instance', displayName: 'Resolute Tempest Knife' },
  { category: 'ranged', domainId: 'bonebow', rawIdentity: 'Bow_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique1/BP_Bow_Unique1Instance', displayName: 'Bonebow' },
  { category: 'ranged', domainId: 'twin-bow', rawIdentity: 'Bow_Unique2', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/Bow_Unique2/BP_Bow_Unique2Instance', displayName: 'Twin Bow' },
  { category: 'ranged', domainId: 'burst-gale-bow', rawIdentity: 'WindBow_Unique2', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow_Unique2/BP_WindBow_Unique2Instance', displayName: 'Burst Gale Bow' },
  { category: 'ranged', domainId: 'echo-of-the-valley', rawIdentity: 'WindBow_Unique1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow_Unique1/BP_WindBow_Unique1Instance', displayName: 'Echo of the Valley' },
] as const satisfies readonly ReviewedTypedRelationIdentityInput[]

function reviewedTypedRelationBridgeDefinition(input: ReviewedTypedRelationIdentityInput): FormalIdentityDefinition {
  const base = input.category === 'melee' ? acceptedMeleeDefinition(input) : acceptedRangedDefinition(input)
  const bridgeEvidenceRef = `evidence:reviewed:${input.domainId}:typed-raw-relation-bridge`
  return {
    ...base,
    assertion: {
      ...base.assertion,
      evidenceRefs: [...base.assertion.evidenceRefs, bridgeEvidenceRef],
    },
    reviewedEvidence: [
      ...base.reviewedEvidence,
      {
        id: bridgeEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'A per-domain reviewed bridge selects the exact Raw candidate through audited candidate-specific typed relations; no ordinal, family, slug, or fuzzy inference is used.',
        source: { artifactPath: 'scripts/game-data-model-alignment.ts', locator: `REVIEWED_TYPED_RELATION_ALIAS_BRIDGES[domainId=${input.domainId}]` },
      },
    ],
  }
}

export const reviewedTypedRelationFormalIdentities = reviewedTypedRelationFormalIdentityInputs.map(reviewedTypedRelationBridgeDefinition)

const scatterPackage = 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance'
export const scatterCrossbowFormalIdentity = definition(
  {
    id: 'identity:scatter-crossbow@1', rawIdentity: 'ScatterCrossbow', domainId: 'scatter-crossbow', reviewState: 'accepted', confidence: 'high',
    applicationScope: scope(scatterPackage), evidenceRefs: ['evidence:reviewed:scatter-crossbow:accepted-alias'],
  },
  'Scatter Crossbow',
  'evidence:presentation:scatter-crossbow:ranged-audit',
  [
    {
      id: 'evidence:reviewed:scatter-crossbow:accepted-alias', kind: 'reviewed', role: 'support',
      detail: 'Reviewed high-confidence alias maps the Raw identity to the canonical ranged-weapon entity.',
      source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=ranged-weapon:ScatterCrossbow]' },
    },
    {
      id: 'evidence:presentation:scatter-crossbow:ranged-audit', kind: 'reviewed', role: 'support',
      detail: 'The ranged audit supplies the English display name independently of identity matching.',
      source: { artifactPath: 'research/ranged-weapon-audit.json', locator: 'entries[id=scatter-crossbow].name.en' },
    },
  ],
)

const battleRobePackage = 'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance'
export const battleRobeFormalIdentity = definition(
  {
    id: 'identity:battle-robe@1', rawIdentity: 'BattleRobe', domainId: 'battle-robe', reviewState: 'provisional',
    applicationScope: scope(battleRobePackage), evidenceRefs: ['evidence:reviewed:battle-robe:catalog-limitation'],
  },
  'Battle Robe',
  'evidence:presentation:battle-robe:catalog',
  [
    {
      id: 'evidence:reviewed:battle-robe:catalog-limitation', kind: 'reviewed', role: 'limitation',
      detail: 'The repository catalog association is useful but is not an authoritative game-source identity bridge.',
      source: { artifactPath: 'src/data/armors.ts', locator: "ARMORS['battle-robe']" },
    },
    {
      id: 'evidence:presentation:battle-robe:catalog', kind: 'reviewed', role: 'support',
      detail: 'Repository presentation catalog supplies the English display name independently of identity matching.',
      source: { artifactPath: 'src/data/armors.ts', locator: "ARMORS['battle-robe'].name.en" },
    },
  ],
)

const mushroomPackage = 'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance'
export const deathCapMushroomFormalIdentity = definition(
  {
    id: 'identity:death-cap-mushroom@1', rawIdentity: 'DeathCapMushroom', domainId: 'death-cap-mushroom', reviewState: 'accepted', confidence: 'high',
    applicationScope: scope(mushroomPackage), evidenceRefs: ['evidence:reviewed:death-cap-mushroom:accepted-alias'],
  },
  'Death Cap Mushroom',
  'evidence:presentation:death-cap-mushroom:catalog',
  [
    {
      id: 'evidence:reviewed:death-cap-mushroom:accepted-alias', kind: 'reviewed', role: 'support',
      detail: 'Reviewed high-confidence alias maps the Raw identity to the canonical artifact entity.',
      source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=artifact:DeathCapMushroom]' },
    },
    {
      id: 'evidence:presentation:death-cap-mushroom:catalog', kind: 'reviewed', role: 'support',
      detail: 'Repository presentation catalog supplies the English display name independently of identity matching.',
      source: { artifactPath: 'src/data/artifacts.ts', locator: "ARTIFACTS['death-cap-mushroom'].name.en" },
    },
  ],
)

type AcceptedArtifactIdentityInput = {
  domainId: string
  rawIdentity: string
  packagePath: string
  displayName: string
}

export const readyArtifactFormalIdentityInputs = [
  { domainId: 'boots-of-swiftness', rawIdentity: 'BootsOfSwiftness', packagePath: 'Dungeons/Content/Actors/Items/BootsOfSwiftness/BP_BootsOfSwiftnessInstance', displayName: 'Boots of Swiftness' },
  { domainId: 'fishing-rod', rawIdentity: 'FishingRod', packagePath: 'Dungeons/Content/Actors/Items/FishingRod/BP_FishingRodInstance', displayName: 'Fishing Rod' },
  { domainId: 'ghost-cloak', rawIdentity: 'GhostCloak', packagePath: 'Dungeons/Content/Actors/Items/GhostCloak/BP_GhostCloakInstance', displayName: 'Ghost Cloak' },
  { domainId: 'iron-hide-amulet', rawIdentity: 'IronHideAmulet', packagePath: 'Dungeons/Content/Actors/Items/Amulets/IronHideAmulet/BP_IronHideAmuletInstance', displayName: 'Iron Hide Amulet' },
  { domainId: 'light-feather', rawIdentity: 'LightFeather', packagePath: 'Dungeons/Content/Actors/Items/LightFeather/BP_LightFeatherInstance', displayName: 'Light Feather' },
  { domainId: 'shock-powder', rawIdentity: 'ShockPowder', packagePath: 'Dungeons/Content/Actors/Items/ShockPowder/BP_ShockPowderInstance', displayName: 'Shock Powder' },
] as const satisfies readonly AcceptedArtifactIdentityInput[]

function acceptedArtifactDefinition(input: AcceptedArtifactIdentityInput): FormalIdentityDefinition {
  const reviewedEvidenceRef = `evidence:reviewed:${input.domainId}:accepted-alias`
  const presentationEvidenceRef = `evidence:presentation:${input.domainId}:artifact-catalog`
  return definition(
    {
      id: `identity:${input.domainId}@1`,
      rawIdentity: input.rawIdentity,
      domainId: input.domainId,
      reviewState: 'accepted',
      confidence: 'high',
      applicationScope: scope(input.packagePath),
      evidenceRefs: [reviewedEvidenceRef],
    },
    input.displayName,
    presentationEvidenceRef,
    [
      {
        id: reviewedEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'Reviewed high-confidence alias maps the Raw identity to the canonical artifact entity.',
        source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: `aliases[id=artifact:${input.rawIdentity}]` },
      },
      {
        id: presentationEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The artifact audit supplies the English display name independently of identity matching.',
        source: { artifactPath: 'research/artifact-audit.json', locator: `entries[id=${input.domainId}].name` },
      },
    ],
  )
}

export const readyArtifactFormalIdentities = readyArtifactFormalIdentityInputs.map(acceptedArtifactDefinition)

export const reviewedBridgeArtifactFormalIdentityInputs = [
  { domainId: 'blast-fungus', rawIdentity: 'NetherWartSporeGrenade', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/NetherWartSporeGrenade/BP_NetherWartSporeGrenadeInstance', displayName: 'Blast Fungus' },
  { domainId: 'corrupted-pumpkin', rawIdentity: 'CorruptedBeacon_Spooky1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/CorruptedBeacon_Spooky1/BP_CorruptedBeacon_Spooky1Instance', displayName: 'Corrupted Pumpkin' },
  { domainId: 'enchanted-grass', rawIdentity: 'RainbowGrass', packagePath: 'Dungeons/Content/Patch2/Actors/Items/RainbowGrass/BP_RainbowGrassInstance', displayName: 'Enchanted Grass' },
  { domainId: 'eye-of-the-guardian', rawIdentity: 'GuardianEye', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/GuardianEye/BP_GuardianEyeInstance', displayName: 'Eye of the Guardian' },
  { domainId: 'harpoon-quiver', rawIdentity: 'HeavyHarpoonQuiver', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/HeavyHarpoonQuiver/BP_HeavyHarpoonQuiverInstance', displayName: 'Harpoon Quiver' },
  { domainId: 'powershaker', rawIdentity: 'MobMasher', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/MobMasher/BP_MobMasherInstance', displayName: 'Powershaker' },
  { domainId: 'satchel-of-elements', rawIdentity: 'SatchelOfTheElements', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/SatchelOfTheElements/BP_SatchelOfTheElementsInstance', displayName: 'Satchel of Elements' },
  { domainId: 'scatter-mines', rawIdentity: 'ChargedRedstoneMines', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMinesInstance', displayName: 'Scatter Mines' },
  { domainId: 'shadow-shifter', rawIdentity: 'ShadowSplinter', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Items/ShadowSplinter/BP_ShadowSplinterInstance', displayName: 'Shadow Shifter' },
  { domainId: 'spinblade', rawIdentity: 'SpinWheel', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance', displayName: 'Spinblade' },
  { domainId: 'totem-of-casting', rawIdentity: 'SoulTotemOfCasting', packagePath: 'Dungeons/Content/Actors/Items/SoulTotemOfCasting/BP_SoulTotemOfCastingInstance', displayName: 'Totem of Casting' },
  { domainId: 'vexing-chant', rawIdentity: 'LostEvocation', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Items/LostEvocation/BP_LostEvocationInstance', displayName: 'Vexing Chant' },
  { domainId: 'buzzy-nest', rawIdentity: 'BeeNest', packagePath: 'Dungeons/Content/Patch2/Actors/Items/Beenest/BP_BeenestInstance', displayName: 'Buzzy Nest' },
  { domainId: 'satchel-of-elixirs', rawIdentity: 'SatchelOfNeed', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/BP_SatchelOfNeedInstance', displayName: 'Satchel of Elixirs' },
  { domainId: 'satchel-of-snacks', rawIdentity: 'SatchelOfNourishment', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/BP_SatchelofNourishmentInstance', displayName: 'Satchel of Snacks' },
] as const satisfies readonly AcceptedArtifactIdentityInput[]

export const reviewedBridgeArtifactFormalIdentities = reviewedBridgeArtifactFormalIdentityInputs.map((input) => documentedAliasBridgeDefinition(input, 'artifact'))

const corruptedSeedsPackage = 'Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance'
const corruptedSeedsAliasEvidenceRef = 'evidence:reviewed:corrupted-seeds:accepted-alias'
const corruptedSeedsSourceEvidenceRef = 'evidence:reviewed:corrupted-seeds:independent-source-id'
const corruptedSeedsPresentationEvidenceRef = 'evidence:presentation:corrupted-seeds:artifact-audit'
export const corruptedSeedsFormalIdentity = definition(
  {
    id: 'identity:corrupted-seeds@1',
    rawIdentity: 'CorruptedSeeds',
    domainId: 'corrupted-seeds',
    reviewState: 'accepted',
    confidence: 'high',
    applicationScope: scope(corruptedSeedsPackage),
    evidenceRefs: [corruptedSeedsAliasEvidenceRef, corruptedSeedsSourceEvidenceRef],
  },
  'Corrupted Seeds',
  corruptedSeedsPresentationEvidenceRef,
  [
    {
      id: corruptedSeedsAliasEvidenceRef,
      kind: 'reviewed',
      role: 'support',
      detail: 'Research-owned reviewed Artifact mapping materializes the exact Raw identity as an accepted high-confidence alias.',
      source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=artifact:CorruptedSeeds]' },
    },
    {
      id: corruptedSeedsSourceEvidenceRef,
      kind: 'reviewed',
      role: 'support',
      detail: 'The independently sourced Artifact audit records CorruptedSeeds in the Corrupted Seeds internal game IDs.',
      source: { artifactPath: 'research/artifact-audit.json', locator: 'populationDifferences[id=corrupted-seeds].internalGameIds' },
    },
    {
      id: corruptedSeedsPresentationEvidenceRef,
      kind: 'reviewed',
      role: 'support',
      detail: 'The Artifact audit supplies the canonical Corrupted Seeds display name.',
      source: { artifactPath: 'research/artifact-audit.json', locator: 'populationDifferences[id=corrupted-seeds].name' },
    },
  ],
)

type ArmorIdentityInput = {
  domainId: string
  rawIdentity: string
  packagePath: string
  displayName: string
}

export const readyArmorFormalIdentityInputs = [
  { domainId: 'archer-s-armor', rawIdentity: 'ArchersStrappings_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings_Unique1/BP_ArchersStrappings_Unique1Instance', displayName: "Archer's Armor" },
  { domainId: 'arctic-fox-armor', rawIdentity: 'WolfArmor_Winter1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/WolfArmor_Winter1/BP_WolfArmor_Winter1Instance', displayName: 'Arctic Fox Armor' },
  { domainId: 'beehive-armor', rawIdentity: 'BeenestArmor_Unique1', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor_Unique1/BP_BeenestArmor_Unique1Instance', displayName: 'Beehive Armor' },
  { domainId: 'beenest-armor', rawIdentity: 'BeenestArmor', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor/BP_BeenestArmorInstance', displayName: 'Beenest Armor' },
  { domainId: 'black-spot-armor', rawIdentity: 'NatureArmor_Unique1', packagePath: 'Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor_Unique1/BP_NatureArmor_Unique1Instance', displayName: 'Black Spot Armor' },
  { domainId: 'black-wolf-armor', rawIdentity: 'WolfArmor_Unique2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique2/BP_WolfArmor_Unique2Instance', displayName: 'Black Wolf Armor' },
  { domainId: 'cauldron-armor', rawIdentity: 'FullPlateArmor_Spooky2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Spooky2/BP_FullPlateArmor_Spooky2Instance', displayName: 'Cauldron Armor' },
  { domainId: 'cave-crawler', rawIdentity: 'SpelunkersArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Unique1/BP_SpelunkersArmor_Unique1Instance', displayName: 'Cave Crawler' },
  { domainId: 'champion-s-armor', rawIdentity: 'ChampionsArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor/BP_ChampionsArmorInstance', displayName: "Champion's Armor" },
  { domainId: 'climbing-gear', rawIdentity: 'ClimbingGear', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear/BP_ClimbingGearInstance', displayName: 'Climbing Gear' },
  { domainId: 'cloaked-skull', rawIdentity: 'GhostArmor_Spooky2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/GhostArmor_Spooky2/BP_GhostArmor_Spooky2Instance', displayName: 'Cloaked Skull' },
  { domainId: 'dark-armor', rawIdentity: 'DarkArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/DarkArmor/BP_DarkArmorInstance', displayName: 'Dark Armor' },
  { domainId: 'ember-robe', rawIdentity: 'EvocationRobe_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique1/BP_EvocationRobe_Unique1Instance', displayName: 'Ember Robe' },
  { domainId: 'emerald-gear', rawIdentity: 'EmeraldArmor', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor/BP_EmeraldArmorInstance', displayName: 'Emerald Gear' },
  { domainId: 'entertainer-s-garb', rawIdentity: 'BardsGarb', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb/BP_BardsGarbInstance', displayName: "Entertainer's Garb" },
  { domainId: 'evocation-robe', rawIdentity: 'EvocationRobe', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/EvocationRobe/BP_EvocationRobeInstance', displayName: 'Evocation Robe' },
  { domainId: 'fox-armor', rawIdentity: 'WolfArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique1/BP_WolfArmor_Unique1Instance', displayName: 'Fox Armor' },
  { domainId: 'frost-armor', rawIdentity: 'SnowArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SnowArmor_Unique1/BP_SnowArmor_Unique1Instance', displayName: 'Frost Armor' },
  { domainId: 'frost-bite', rawIdentity: 'PhantomArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/PhantomArmor_Unique1/BP_PhantomArmor_Unique1Instance', displayName: 'Frost Bite' },
  { domainId: 'full-metal-armor', rawIdentity: 'FullPlateArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Unique1/BP_FullPlateArmor_Unique1Instance', displayName: 'Full Metal Armor' },
  { domainId: 'ghost-kindler', rawIdentity: 'GhostArmor_Unique1', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor_Unique1/BP_GhostArmor_Unique1Instance', displayName: 'Ghost Kindler' },
  { domainId: 'ghostly-armor', rawIdentity: 'GhostArmor', packagePath: 'Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor/BP_GhostArmorInstance', displayName: 'Ghostly Armor' },
  { domainId: 'gilded-glory', rawIdentity: 'EmeraldArmor_Unique2', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique2/BP_EmeraldArmor_Unique2Instance', displayName: 'Gilded Glory' },
  { domainId: 'glow-squid-armor', rawIdentity: 'SquidArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor_Unique1/BP_SquidArmor_Unique1Instance', displayName: 'Glow Squid Armor' },
  { domainId: 'goat-gear', rawIdentity: 'ClimbingGear_Unique2', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique2/BP_ClimbingGear_Unique2Instance', displayName: 'Goat Gear' },
  { domainId: 'golden-piglin-armor', rawIdentity: 'PiglinArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor_Unique1/BP_PiglinArmor_Unique1Instance', displayName: 'Golden Piglin Armor' },
  { domainId: 'grim-armor', rawIdentity: 'GrimArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/GrimArmor/BP_GrimArmorInstance', displayName: 'Grim Armor' },
  { domainId: 'guard-s-armor', rawIdentity: 'CowardsArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/CowardsArmor/BP_CowardsArmorInstance', displayName: "Guard's Armor" },
  { domainId: 'hero-s-armor', rawIdentity: 'ChampionsArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor_Unique1/BP_ChampionsArmor_Unique1Instance', displayName: "Hero's Armor" },
  { domainId: 'highland-armor', rawIdentity: 'ScaleMail_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ScaleMail_Unique1/BP_ScaleMail_Unique1Instance', displayName: 'Highland Armor' },
  { domainId: 'hungriest-horror', rawIdentity: 'MercenaryArmor_Spooky2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Spooky2/BP_MercenaryArmor_Spooky2Instance', displayName: 'Hungriest Horror' },
  { domainId: 'hungry-horror', rawIdentity: 'MercenaryArmor_Spooky1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/MercenaryArmor_Spooky1/BP_MercenaryArmor_Spooky1Instance', displayName: 'Hungry Horror' },
  { domainId: 'hunter-s-armor', rawIdentity: 'ArchersStrappings', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings/BP_ArchersStrappingsInstance', displayName: "Hunter's Armor" },
  { domainId: 'living-vines-armor', rawIdentity: 'SproutArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor_Unique1/BP_SproutArmor_Unique1Instance', displayName: 'Living Vines Armor' },
  { domainId: 'mercenary-armor', rawIdentity: 'MercenaryArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor/BP_MercenaryArmorInstance', displayName: 'Mercenary Armor' },
  { domainId: 'mystery-armor', rawIdentity: 'MysteryArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/MysteryArmor/BP_MysteryArmorInstance', displayName: 'Mystery Armor' },
  { domainId: 'nimble-turtle-armor', rawIdentity: 'TurtleArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor_Unique1/BP_TurtleArmor_Unique1Instance', displayName: 'Nimble Turtle Armor' },
  { domainId: 'ocelot-armor', rawIdentity: 'OcelotArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/OcelotArmor/BP_OcelotArmorInstance', displayName: 'Ocelot Armor' },
  { domainId: 'opulent-armor', rawIdentity: 'EmeraldArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique1/BP_EmeraldArmor_Unique1Instance', displayName: 'Opulent Armor' },
  { domainId: 'phantom-armor', rawIdentity: 'PhantomArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/PhantomArmor/BP_PhantomArmorInstance', displayName: 'Phantom Armor' },
  { domainId: 'piglin-armor', rawIdentity: 'PiglinArmor', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor/BP_PiglinArmorInstance', displayName: 'Piglin Armor' },
  { domainId: 'plate-armor', rawIdentity: 'FullPlateArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor/BP_FullPlateArmorInstance', displayName: 'Plate Armor' },
  { domainId: 'reinforced-mail', rawIdentity: 'ReinforcedMail', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail/BP_ReinforcedMailInstance', displayName: 'Reinforced Mail' },
  { domainId: 'renegade-armor', rawIdentity: 'MercenaryArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Unique1/BP_MercenaryArmor_Unique1Instance', displayName: 'Renegade Armor' },
  { domainId: 'root-rot-armor', rawIdentity: 'NatureArmor', packagePath: 'Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor/BP_NatureArmorInstance', displayName: 'Root Rot Armor' },
  { domainId: 'rugged-climbing-gear', rawIdentity: 'ClimbingGear_Unique1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique1/BP_ClimbingGear_Unique1Instance', displayName: 'Rugged Climbing Gear' },
  { domainId: 'scale-mail', rawIdentity: 'ScaleMail', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ScaleMail/BP_ScaleMailInstance', displayName: 'Scale Mail' },
  { domainId: 'shadow-walker', rawIdentity: 'OcelotArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/OcelotArmor_Unique1/BP_OcelotArmor_Unique1Instance', displayName: 'Shadow Walker' },
  { domainId: 'shulker-armor', rawIdentity: 'ShulkerArmor', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor/BP_ShulkerArmorInstance', displayName: 'Shulker Armor' },
  { domainId: 'snow-armor', rawIdentity: 'SnowArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SnowArmor/BP_SnowArmorInstance', displayName: 'Snow Armor' },
  { domainId: 'soul-robe', rawIdentity: 'SoulRobe', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SoulRobe/BP_SoulRobeInstance', displayName: 'Soul Robe' },
  { domainId: 'souldancer-robe', rawIdentity: 'SoulRobe_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SoulRobe_Unique1/BP_SoulRobe_Unique1Instance', displayName: 'Souldancer Robe' },
  { domainId: 'spelunker-armor', rawIdentity: 'SpelunkersArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor/BP_SpelunkersArmorInstance', displayName: 'Spelunker Armor' },
  { domainId: 'spider-armor', rawIdentity: 'AssassinArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/AssassinArmor_Unique1/BP_AssassinArmor_Unique1Instance', displayName: 'Spider Armor' },
  { domainId: 'splendid-robe', rawIdentity: 'BattleRobe_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/BattleRobe_Unique1/BP_BattleRobe_Unique1Instance', displayName: 'Splendid Robe' },
  { domainId: 'sprout-armor', rawIdentity: 'SproutArmor', packagePath: 'Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor/BP_SproutArmorInstance', displayName: 'Sprout Armor' },
  { domainId: 'squid-armor', rawIdentity: 'SquidArmor', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor/BP_SquidArmorInstance', displayName: 'Squid Armor' },
  { domainId: 'stalwart-armor', rawIdentity: 'ReinforcedMail_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail_Unique1/BP_ReinforcedMail_Unique1Instance', displayName: 'Stalwart Armor' },
  { domainId: 'sturdy-shulker-armor', rawIdentity: 'ShulkerArmor_Unique1', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor_Unique1/BP_ShulkerArmor_Unique1Instance', displayName: 'Sturdy Shulker Armor' },
  { domainId: 'sweet-tooth', rawIdentity: 'SpelunkersArmor_Year1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Year1/BP_SpelunkersArmor_Year1Instance', displayName: 'Sweet Tooth' },
  { domainId: 'teleportation-robes', rawIdentity: 'EndRobes', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes/BP_EndRobesInstance', displayName: 'Teleportation Robes' },
  { domainId: 'the-spooky-gourdian', rawIdentity: 'GrimArmor_Spooky2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Spooky2/BP_GrimArmor_Spooky2Instance', displayName: 'The Spooky Gourdian' },
  { domainId: 'the-troubadour', rawIdentity: 'BardsGarb_Unique1', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb_Unique1/BP_BardsGarb_Unique1Instance', displayName: 'The Troubadour' },
  { domainId: 'thief-armor', rawIdentity: 'AssassinArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/AssassinArmor/BP_AssassinArmorInstance', displayName: 'Thief Armor' },
  { domainId: 'titan-s-shroud', rawIdentity: 'DarkArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/DarkArmor_Unique1/BP_DarkArmor_Unique1Instance', displayName: "Titan's Shroud" },
  { domainId: 'turtle-armor', rawIdentity: 'TurtleArmor', packagePath: 'Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor/BP_TurtleArmorInstance', displayName: 'Turtle Armor' },
  { domainId: 'unstable-robes', rawIdentity: 'EndRobes_Unique1', packagePath: 'Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes_Unique1/BP_EndRobes_Unique1Instance', displayName: 'Unstable Robes' },
  { domainId: 'verdant-robe', rawIdentity: 'EvocationRobe_Unique2', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique2/BP_EvocationRobe_Unique2Instance', displayName: 'Verdant Robe' },
  { domainId: 'wither-armor', rawIdentity: 'GrimArmor_Unique1', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Unique1/BP_GrimArmor_Unique1Instance', displayName: 'Wither Armor' },
  { domainId: 'wolf-armor', rawIdentity: 'WolfArmor', packagePath: 'Dungeons/Content/Actors/Equipment/Armor/WolfArmor/BP_WolfArmorInstance', displayName: 'Wolf Armor' },
] as const satisfies readonly ArmorIdentityInput[]

function armorDefinition(input: ArmorIdentityInput): FormalIdentityDefinition {
  const bridgeEvidenceRef = `evidence:reviewed:${input.domainId}:armor-level-id`
  const presentationEvidenceRef = `evidence:presentation:${input.domainId}:armor-audit`
  return definition(
    {
      id: `identity:${input.domainId}@1`,
      rawIdentity: input.rawIdentity,
      domainId: input.domainId,
      reviewState: 'accepted',
      confidence: 'high',
      applicationScope: scope(input.packagePath),
      evidenceRefs: [bridgeEvidenceRef],
    },
    input.displayName,
    presentationEvidenceRef,
    [
      {
        id: bridgeEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The Armor audit maps the canonical Armor domain ID to this explicit levelId; the exact Raw Structural candidate corroborates both serialized identity fields.',
        source: { artifactPath: 'research/armor-audit.json', locator: `entries[id=${input.domainId}].levelId` },
      },
      {
        id: presentationEvidenceRef,
        kind: 'reviewed',
        role: 'support',
        detail: 'The Armor audit supplies the display name independently of the serialized identity match.',
        source: { artifactPath: 'research/armor-audit.json', locator: `entries[id=${input.domainId}].name` },
      },
    ],
  )
}

export const readyArmorFormalIdentities = readyArmorFormalIdentityInputs.map(armorDefinition)

export const formalIdentityDefinitions: readonly FormalIdentityDefinition[] = [
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  ...readyMeleeFormalIdentities,
  ...readyRangedFormalIdentities,
  ...reviewedBridgeMeleeFormalIdentities,
  ...reviewedBridgeRangedFormalIdentities,
  ...readyArtifactFormalIdentities,
  ...readyArmorFormalIdentities,
  ...reviewedBridgeArtifactFormalIdentities,
  corruptedSeedsFormalIdentity,
  ...reviewedTypedRelationMeleeFormalIdentities,
  ...reviewedTypedRelationFormalIdentities,
]

export const READY_ARTIFACT_EFFECT_DOMAINS = [
  'boots-of-swiftness', 'corrupted-pumpkin', 'death-cap-mushroom', 'fishing-rod',
  'ghost-cloak', 'iron-hide-amulet', 'light-feather', 'powershaker',
  'shadow-shifter', 'shock-powder',
] as const
