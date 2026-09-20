/** Reviewed repository identity used only by the temporary Death Cap Mushroom projection. */
export const deathCapMushroomIdentity = {
  id: 'identity:death-cap-mushroom@1',
  status: 'accepted',
  confidence: 'high',
  rawIdentity: 'DeathCapMushroom',
  domainId: 'death-cap-mushroom',
  displayName: 'Death Cap Mushroom',
  instancePackagePath: 'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance',
  effectPackagePath: 'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect',
  effectGamePackagePath: '/Game/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect',
  effectObjectName: 'BP_DeathCapMushroomGameplayEffect_C',
  effectClassName: 'BlueprintGeneratedClass',
  evidence: {
    path: 'research/domain/game-data-entity-aliases.json',
    locator: 'aliases[id=artifact:DeathCapMushroom]',
    expectedStatus: 'accepted',
    expectedConfidence: 'high',
    expectedCanonicalEntity: 'artifact:death-cap-mushroom',
  },
} as const
