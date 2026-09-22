/** Repository-local Raw fixture metadata retained temporarily for Formal Battle Robe relation tests. */
export const battleRobeIdentity = {
  id: 'identity:battle-robe@1',
  status: 'provisional',
  rawIdentity: 'BattleRobe',
  domainId: 'battle-robe',
  displayName: 'Battle Robe',
  packagePath: 'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance',
  gearActorObjectName: 'BP_BattleRobe_C',
  gearActorClassName: 'BlueprintGeneratedClass',
  gearActorGamePackagePath: '/Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe',
  evidence: [
    {
      path: 'src/data/armors.ts',
      locator: "ARMORS['battle-robe']",
      role: 'support',
      detail: 'The repository catalog associates battle-robe with Battle Robe, but is not an authoritative game-source identity bridge.',
    },
  ],
  unresolved: ['Reviewed game-source bridge from internal ID to displayed item name'],
} as const
