/** Reviewed repository identity used only by the temporary Scatter Crossbow projection. */
export const scatterCrossbowIdentity = {
  id: 'identity:scatter-crossbow@1',
  status: 'accepted',
  confidence: 'high',
  rawIdentity: 'ScatterCrossbow',
  domainId: 'scatter-crossbow',
  displayName: 'Scatter Crossbow',
  instancePackagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance',
  projectilePackagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow',
  projectileGamePackagePath: '/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow',
  projectileObjectName: 'BP_ScatterCrossBow_Arrow_C',
  projectileClassName: 'BlueprintGeneratedClass',
  evidence: {
    path: 'research/domain/game-data-entity-aliases.json',
    locator: 'aliases[id=ranged-weapon:ScatterCrossbow]',
    expectedStatus: 'accepted',
    expectedConfidence: 'high',
    expectedCanonicalEntity: 'ranged-weapon:scatter-crossbow',
  },
} as const
