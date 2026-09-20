# Death Cap Mushroom temporary Game Domain

This slice projects the two committed Death Cap Mushroom Raw snapshots into a temporary Domain artifact. It proves only the serialized relation from the Instance package to the GameplayEffect package. The Data Browser reads the committed Domain artifact and displays that boundary; the projection still does not feed Inventory, Build, Optimizer, or the runtime artifact model.

## Projected shape and identity

The projection contains only `kind`, `identity`, `effectReference`, and `unresolved`. Identity is `accepted` with `confidence: high`, `domainId: death-cap-mushroom`, and `displayName: Death Cap Mushroom` only when the Raw CDO fields `ItemIdName` and `ItemId.SerializedId` both decode unambiguously to `DeathCapMushroom`. Otherwise identity is `unresolved` and exposes no confidence, domain ID, or display name.

Each identity evidence field traces its exact Raw node. The display name is fixed assertion metadata supported by the reviewed entity alias; it is not recovered from the Raw snapshot.

## Effect reference boundary

The projector validates this exact serialized chain:

`Effect ObjectProperty → BP_DeathCapMushroomGameplayEffect_C class import → /Game/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect outer Package import → committed GameplayEffect Raw snapshot`

The successful result records separate provenance for `objectProperty`, `classImport`, `outerPackageImport`, and `targetRawSnapshot`. The target connection additionally requires the Instance and GameplayEffect snapshots to have the same `dataset.id` and complete `sourceFingerprint` (algorithm and value). The target logical package path must equal the reviewed package identity. A missing, unavailable, ambiguous, or mismatched link leaves `effectReference` unavailable or `unknown`; it does not affect a separately resolved identity.

The target snapshot's `UIData` is not read or projected. No generic GameplayEffect model, generic cross-package resolver, or generic `/Game` path conversion rule is introduced.

## Unresolved semantics boundary

`unresolved: ['gameplay-effect-semantics']` is a temporary slice boundary marker, not a semantic value field. No duration, attack-speed, movement-speed, magnitude, Power scaling, stacking, effective uptime, buff, modifier, or other gameplay-effect semantic field is emitted, including as an unknown placeholder. Existing runtime and external-research values are not inputs.

## Reproduction

- `npm run generate:death-cap-mushroom-domain` regenerates `research/domain/temporary/death-cap-mushroom.json` from the unchanged canonical Raw artifacts.
- `npm run audit:death-cap-mushroom-domain` compares a fresh pure projection with the committed artifact and checks identity evidence and target provenance.
- `npx vitest run tests/deathCapMushroomDataBrowser.test.tsx tests/deathCapMushroomDomain.test.ts` checks the Application boundary, displayed provenance, unresolved semantics, and forbidden-value absence.
- `npx vitest run tests/deathCapMushroomDomain.test.ts tests/scatterCrossbowDomain.test.ts tests/battleRobeDomain.test.ts tests/fightersBindingsDomain.test.ts` covers the fourth slice and regression safety for the earlier temporary projections.

The Data Browser integration is site-visible, so changes to this slice require the existing owner-only Site deployment workflow.
