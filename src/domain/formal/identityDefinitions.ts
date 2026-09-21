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

export const formalIdentityDefinitions = [
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
] as const
