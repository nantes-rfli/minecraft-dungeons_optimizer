# Scatter Crossbow temporary Game Domain

> **Historical status — retired.** This Scatter Crossbow temporary slice is retained only as a historical record.
> The committed temporary JSON and the legacy generate/audit commands have been retired. The current Application authoritative source is the committed Formal artifacts under `research/domain/formal/`. The `src/domain/temporary/**` source modules and their Domain tests remain for now.

Historically, this slice projected the two committed Scatter Crossbow Raw package snapshots into a committed temporary Domain artifact. The temporary source projector remains, but the committed artifact is retired and no longer feeds the Data Browser, Inventory, Build, Optimizer, runtime ranged schema, or any generic entity/relation system.

## Identity

The existing reviewed alias `ranged-weapon:ScatterCrossbow → ranged-weapon:scatter-crossbow` is `accepted` with `high` confidence. The projector exposes `domainId: scatter-crossbow` only when both Raw CDO fields `ItemIdName` and `ItemId.SerializedId` decode unambiguously to `ScatterCrossbow`. Missing, duplicate, unavailable, wrongly typed, or conflicting values leave identity `unresolved` without a fallback Domain ID.

## Projection boundary

`AttackDefintion.ProjectileDefinition` becomes `configuredProjectileDefinitions` in source order. Each entry contains only the serialized configured projectile count, angle span, per-projectile delay, and its projectile link. `AttackDefintion.ProjectileVelocityFactor` remains a weapon-level sibling as `configuredProjectileVelocityFactor`, matching its Raw location instead of duplicating it into every definition.

The projector explicitly validates the known reference chain:

`Projectile ObjectProperty → BP_ScatterCrossBow_Arrow_C class import → /Game/.../BP_ScatterCrossBow_Arrow outer Package import → supplied Dungeons/Content/.../BP_ScatterCrossBow_Arrow Raw snapshot`

It also requires the two snapshots to share dataset identity and source fingerprint. This is a local assertion for the known structure, not a general `/Game/` resolver. The extractor's `crossPackageReferenceResolution` remains `not-performed`. A successful trace records separate pointers for the ObjectProperty, class import, outer package import, and target Raw snapshot. If any link fails, no projectile configuration is attached to the weapon.

The projected reference value preserves the Raw structural names: `objectName` is `BP_ScatterCrossBow_Arrow_C`, `className` is `BlueprintGeneratedClass`, and `targetRawPackagePath` names the supplied `Dungeons/Content/...` snapshot. These names are not a projectile Domain identity.

Only after that reference succeeds, the projectile's `pushback.enablePushback`, `pushback.pushbackStrength`, and `IgnoreFriendlyFire` become configured fields. Each projected value points to its exact Raw property node. `known` means only that the serialized parameter decoded with the expected type; it does not assert effective gameplay behavior. Decoded zero and false are retained. `unknown`, `unsupported`, `parse-failed`, and `not-extracted` are not converted into values.

`AttackRateSeconds`, `ProjectileStackCount`, `damage`, `HomingThreshold`, chargeability, ammo, effective cadence, final damage, and Power scaling are deliberately absent. Existing tentative/unresolved semantic judgments remain unchanged.

## Historical reproduction

- **Retired:** `npm run generate:scatter-crossbow-domain` previously regenerated the committed temporary JSON from the two unchanged Raw artifacts.
- **Retired:** `npm run audit:scatter-crossbow-domain` previously verified identity evidence, exact regeneration, reference linkage, and the committed temporary artifact.
- `npx vitest run tests/scatterCrossbowDomain.test.ts tests/gameDataRawPackage.test.ts` covers identity mismatch, order, exact values, trace stages, reference failure, missing/duplicate/wrong types, zero/false, unavailable states, Raw immutability, and prohibited fields.

The original temporary-slice change had no site-visible behavior or delivered web asset.
