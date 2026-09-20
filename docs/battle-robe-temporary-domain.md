# Battle Robe temporary Game Domain

This slice projects the committed Battle Robe Instance Raw package into a temporary Domain artifact. It does not feed the application, Data Browser, Inventory, Build, Optimizer, runtime armor catalog, or a generic equipment/relation model.

## Identity

The Raw CDO fields `ItemIdName` and `ItemId.SerializedId` both contain the internal identifier `BattleRobe`. The repository catalog associates `battle-robe` with the display name `Battle Robe`, but it is not an authoritative game-source name bridge. Identity therefore remains `provisional`, without a confidence claim. Both Raw identifiers must decode unambiguously and match exactly before the projection exposes `domainId` and `displayName`; otherwise identity is `unresolved` with no fallback.

Each identity evidence field traces its exact Raw node. The display name is fixed assertion metadata, not a value recovered from the Raw snapshot.

## GearActor reference boundary

The projector validates the known serialized chain:

`GearActor ObjectProperty → BP_BattleRobe_C class import → /Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe outer Package import`

The successful reference records distinct Raw pointers for the property, class import, and outer package import. A missing, unavailable, ambiguous, or mismatched link leaves the reference unavailable or `unknown` without a value. The result identifies the serialized reference target only: it does not read that target package, resolve `BP_BattleRobe` contents, construct a cross-package Domain entity, or introduce a generic resolver.

## Armor Property ownership

`unresolved: ['armor-property-ownership']` means this projection cannot establish Battle Robe's Armor Property ownership. It does not mean the item has zero properties or that properties do not exist in the game. The unresolved declaration has no invented Raw trace because no authoritative serialized ownership relation was found in this input.

No `armorProperties`, `configuredArmorProperties`, or `armorPropertyOwnership` value field is emitted. `MeleeDamageBoost`, `ItemCooldownDecrease`, percentage effects, component-package observations, external research, and runtime catalog effects are not inputs and are not connected to Battle Robe by this projection.

## Reproduction

- `npm run generate:battle-robe-domain` regenerates `research/domain/temporary/battle-robe.json` from the unchanged canonical Raw artifact.
- `npm run audit:battle-robe-domain` compares a fresh projection with the committed artifact and checks the fixed assertions.
- `npx vitest run tests/battleRobeDomain.test.ts tests/fightersBindingsDomain.test.ts tests/scatterCrossbowDomain.test.ts` covers identity traceability, reference-chain failure, unavailable state preservation, the ownership boundary, and regression safety for the earlier slices.

This change has no site-visible behavior or delivered web asset, so it does not trigger a Site deployment.
