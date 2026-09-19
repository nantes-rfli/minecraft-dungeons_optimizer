/** The sole Step 3B identity decision. Evidence is repository-local, not proof of a localized game name. */
export const fightersBindingsIdentity = {
  id: 'identity:fighters-bindings@1',
  status: 'provisional',
  rawIdentity: 'Gauntlets_Unique3',
  domainId: 'fighters-bindings',
  displayName: "Fighter’s Bindings",
  packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance',
  evidence: [
    { path: 'scripts/audit-attack-event-comparison.ts', locator: 'mappings', revision: 'cb22dede14bfba88d15e1539c2b68d1bf4f8f649', role: 'support', detail: 'Historical hard-coded association claimed exact-via-serialized-id without a reviewed name bridge; now consumes this assertion.' },
    { path: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=melee-weapon:Gauntlets_Unique3]', role: 'limitation', detail: 'Unresolved; unique variant retained, no reviewed equivalence evidence.' },
    { path: 'generated/equipment-icons/manifest.json', locator: 'entries[catalogId=soul-fists]', role: 'conflict', detail: 'Gauntlets_Unique3 icon mapped to soul-fists by family-unique-ordinal heuristic; not authoritative identity evidence.' },
  ],
  unresolved: ['Reviewed game-source bridge from internal ID to displayed item name', 'Conflict with icon ordinal heuristic'],
} as const
