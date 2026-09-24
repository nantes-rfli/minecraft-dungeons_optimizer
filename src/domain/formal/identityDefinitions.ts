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

function documentedAliasBridgeDefinition(input: AcceptedMeleeIdentityInput, category: 'melee' | 'ranged'): FormalIdentityDefinition {
  const base = category === 'melee' ? acceptedMeleeDefinition(input) : acceptedRangedDefinition(input)
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

export const formalIdentityDefinitions: readonly FormalIdentityDefinition[] = [
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  ...readyMeleeFormalIdentities,
  ...readyRangedFormalIdentities,
  ...reviewedBridgeMeleeFormalIdentities,
  ...reviewedBridgeRangedFormalIdentities,
]
