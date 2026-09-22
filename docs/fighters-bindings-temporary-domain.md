# Fighter’s Bindings temporary Game Domain — Step 3B

> **Historical status — retired.** This Step 3B temporary slice is retained only as a historical record.
> The committed temporary JSON, legacy generate/audit commands, Fighter's Bindings temporary projector, and its projector-specific Domain test are retired. The current Application authoritative source is the committed Formal artifacts under `research/domain/formal/`. `fightersBindingsIdentity.ts` remains as a research/audit/test fixture, and `projectionPrimitives.ts` remains shared by current Formal readers.

`Raw package snapshot → identity assertion → temporary Game Domain projection`

This one-package experiment lives in `src/domain/temporary`. It consumes the unchanged Step 3A snapshot via a type-only dependency on its existing contract. It does not use historical research entity, attack profile, effect, or mechanic models. Nothing imports this projection into the application, Inventory, Data Browser, Optimizer, or runtime catalog.

## Identity decision and existing evidence

The single maintained decision is [fightersBindingsIdentity.ts](../src/domain/temporary/fightersBindingsIdentity.ts), `identity:fighters-bindings@1`.

| Repository evidence | Finding | Consequence |
|---|---|---|
| `scripts/audit-attack-event-comparison.ts`, historical mappings row | Hard-coded `Gauntlets_Unique3 → fighters-bindings`, previously labeled `exact-via-serialized-id` | Supports a candidate, but supplied no reviewed bridge to a game display name. Now consumes the central assertion instead of deciding independently. |
| `research/domain/game-data-entity-aliases.json`, `melee-weapon:Gauntlets_Unique3` | `unresolved`, no candidates, unique variant retained | Does not confirm the candidate. Historical artifact stays separate. |
| `generated/equipment-icons/manifest.json`, `entries[catalogId=soul-fists]` | Same family assigned to soul-fists through `family-unique-ordinal` | Conflicting heuristic evidence; recorded explicitly, not accepted as identity proof. Icon generation/runtime assets are outside this step. |
| Existing catalog/display names, runtime attack durations, external HPS observations | Describe Fighter’s Bindings, but do not establish the internal-ID bridge | Similar numerical values and order are not identity confirmation. |
| Raw CDO `ItemIdName` and `ItemId.SerializedId` | Both decode to `Gauntlets_Unique3` | Establish internal identity only; do not establish the localized display name. |

The Domain resolves to `fighters-bindings` / `Fighter’s Bindings` with **provisional** status when both Raw internal identifiers match. Missing, unavailable, ambiguous, or conflicting identifiers yield **unresolved**, with no resolved Domain ID/display name. Source evidence remains visible even when unresolved. The display name is assertion metadata, not a Raw value or recovered localization.

The reviewed game-source naming bridge and the icon heuristic conflict remain unresolved. No general alias system is introduced, and the old bulk alias pipeline is not promoted into the new model. The historical attack comparison is retained but its exact claim is corrected to provisional and its assertion ID is recorded.

## Minimal meanings

The retired temporary projector originally read these values directly from the supplied snapshot. Formal Value / Availability now owns the source-backed configured-value read through [fightersBindingsValueReaders.ts](../src/domain/formal/fightersBindingsValueReaders.ts) and [fightersBindingsValueMappings.ts](../src/domain/formal/fightersBindingsValueMappings.ts), while Formal Identity remains independent.

| Historical/Current field | Mapping | Safe meaning |
|---|---|---|
| Identity Raw observations | `fighters-bindings:identity@1` | Internal ID observations supporting the provisional Formal Identity assertion |
| Formal `configuredAttacks` | `fighters-bindings:configured-attacks@1` | Serialized configured attack entries in source order |
| Formal `configuredDamage` | `fighters-bindings:configured-damage@1` | Configured damage parameter; units/scaling beyond this are not asserted |
| Formal `configuredAnimationDurationSeconds` | `fighters-bindings:animation-duration@1` | Configured animation duration in seconds |

The actual source has four entries, Damage 25 each, and durations `0.15000000596046448`, `0.15000000596046448`, `0.15000000596046448`, `0.125`. Projection does not hard-code the count, round the floats, derive DPS/rate, apply Power, or declare complete combo mechanics. Final damage, Power scaling, effective attack cadence, and complete combo mechanics are explicitly unresolved. No speculative entities or placeholder numeric values are created.

Each field has a state. `known` means the configured parameter was decoded with the expected type, not that its gameplay outcome is established. `unsupported`, `parse-failed`, and `not-extracted` remain unavailable with no value. Missing/ambiguous/unexpected types yield `unknown`; decoded zero remains zero. An unavailable parent blocks reading stale child values.

## Historical traceability and validation

Each field carries its mapping ID, identity assertion ID, Raw artifact path, dataset ID, extraction run ID, logical package path/hash, and JSON Pointer. Identity traces point to both Raw identifier nodes; configured field traces point to their property nodes. Following a pointer exposes original property order/index, FName/type, metadata, value, and source byte ranges. Missing nodes point to their containing collection; unavailable parents point to the unavailable parent. These traces identify absence without inventing a property node.

For example, the first configured damage points to the actual Damage property under `/package/objects/1/properties/0/decoding/elements/0/properties`. Its precise pointer is generated from the discovered node index, not a copied field value. The Step 3A Raw audit verifies the source/code/run identity; the retired temporary audit verified regeneration and links to Raw values.

- **Retired:** `npm run generate:fighters-bindings-domain` previously regenerated the committed temporary artifact.
- **Retired:** `npm run audit:fighters-bindings-domain` previously compared the regenerated assertion/mappings/projection with the committed temporary artifact and ran in CI.
- **Retired:** the projector-specific Fighter's Bindings Domain test covered the temporary projector behavior. Current Formal Value tests and audits cover the retained configured-value semantics, Raw provenance, source-index identity/order, decoded zero, unavailable/unknown handling, and matched Formal Identity gate.

During Step 3B, only research artifacts, tooling, tests, and documentation changed; no website behavior or delivered assets changed. Step 3C and all other equipment categories were outside that phase's scope.
