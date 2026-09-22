# Battle Robe temporary Game Domain

> **Historical status — projector retired.** This Battle Robe temporary slice is retained only as a historical record.
> The committed temporary JSON, the legacy generate/audit commands, the temporary source projector `src/domain/temporary/battleRobe.ts`, and its projector-specific test `tests/battleRobeDomain.test.ts` have been retired. `src/domain/temporary/battleRobeIdentity.ts` remains temporarily as Raw fixture metadata for Formal Serialized Relation tests. The current authoritative implementation is the Formal Domain under `src/domain/formal/` and the committed Formal artifacts under `research/domain/formal/`.

Historically, this slice projected the committed Battle Robe Instance Raw package into a committed temporary Domain artifact. The temporary source projector and its behavior test are now retired and no longer feed the application, Data Browser, Inventory, Build, Optimizer, runtime armor catalog, or a generic equipment/relation model.

## Identity

The Raw CDO fields `ItemIdName` and `ItemId.SerializedId` both contain the internal identifier `BattleRobe`. The repository catalog associates `battle-robe` with the display name `Battle Robe`, but it is not an authoritative game-source name bridge. The retired temporary projection therefore treated identity as `provisional`, without a confidence claim. Both Raw identifiers had to decode unambiguously and match exactly before that projection exposed `domainId` and `displayName`; otherwise identity was `unresolved` with no fallback.

Each identity evidence field traced its exact Raw node. The display name was fixed assertion metadata, not a value recovered from the Raw snapshot.

The current Formal Identity contract owns identity matching and the provisional review state.

## GearActor reference boundary

The retired projector validated the serialized chain:

`GearActor ObjectProperty → BP_BattleRobe_C class import → /Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe outer Package import`

The successful reference recorded distinct Raw pointers for the property, class import, and outer package import. A missing, unavailable, ambiguous, or mismatched link left the reference unavailable or `unknown` without a value. The result identified the serialized reference target only: it did not read that target package, resolve `BP_BattleRobe` contents, construct a cross-package Domain entity, or introduce a generic resolver.

The current Formal Serialized Relation contract owns the GearActor serialized relation, broken-chain handling, and same-source identity gate. `src/domain/formal/serializedRelation.ts` is Formal-owned and does not depend on the retired temporary projector.

## Armor Property ownership

The retired temporary representation `unresolved: ['armor-property-ownership']` meant that projection could not establish Battle Robe's Armor Property ownership. It did not mean the item had zero properties or that properties do not exist in the game. The unresolved declaration had no invented Raw trace because no authoritative serialized ownership relation was found in that input.

No `armorProperties`, `configuredArmorProperties`, or `armorPropertyOwnership` value field was emitted. `MeleeDamageBoost`, `ItemCooldownDecrease`, percentage effects, component-package observations, external research, and runtime catalog effects were not inputs and were not connected to Battle Robe by that projection.

That legacy `unresolved` array is not part of the Formal schema. The Application now presents Armor Property ownership as not established by Formal v1 rather than importing this temporary representation.

## Historical reproduction

- **Retired:** `npm run generate:battle-robe-domain` previously regenerated the committed temporary JSON from the unchanged canonical Raw artifact.
- **Retired:** `npm run audit:battle-robe-domain` previously compared a fresh projection with the committed temporary artifact and checked the fixed assertions.
- **Retired:** `tests/battleRobeDomain.test.ts` previously covered identity traceability, reference-chain failure, unavailable state preservation, and the Armor Property ownership boundary.
- Current Formal coverage for the transferred responsibilities lives in `tests/formalIdentityEvidence.test.ts`, `tests/formalSerializedRelation.test.ts`, and the Battle Robe Formal Data Browser adapter. `src/domain/temporary/battleRobeIdentity.ts` remains only as a temporary fixture dependency for the Formal relation test path and is not authoritative implementation.

The original temporary-slice change had no site-visible behavior or delivered web asset.
