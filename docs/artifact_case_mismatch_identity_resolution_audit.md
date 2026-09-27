# Artifact Case-Mismatch Identity Resolution Audit

## Scope and baseline

This audit adjudicates only `buzzy-nest`, `satchel-of-elixirs`, and `satchel-of-snacks`. It changes no override, alias, Formal Identity entry, Raw extraction, or generated artifact.

The audit baseline is current `main`, `cd94031e4b30056328ec9c944ca152a25d142088` (2026-09-27). This is the merge commit for PR #131 and has the requested 140/271 Formal Identity and 19/45 Artifact counts. The audit was first performed at `d7e63b7a62702725419a67335e46aeaa9fb28a7a` (2026-09-26 23:52:44 +09:00), before PR #131 was merged; the task checkout at that time was `4cd5732fc32a25eccf149042080d449f4eb73e1c` (2026-09-27 00:38:06 +09:00).

After fetching current `main`, Git blob IDs were compared between the original audit checkpoint `d7e63b7a62702725419a67335e46aeaa9fb28a7a` and `cd94031e4b30056328ec9c944ca152a25d142088`. They match for every target-bearing source used by the adjudication: `src/data/artifacts.ts`, `src/data/equipmentCatalog.ts`, `research/artifact-audit.json`, `research/source-harvest/snapshots/dungeons-tools-2026-09-06.json`, `scripts/equipment-icons.ts`, `generated/equipment-icons/manifest.json`, `research/raw/game-data-asset-index.json`, `research/raw/game-data-bulk-harvest.json`, `research/raw/game-data-raw-structural-inventory/manifest.json`, Structural shards `part-063.json.gz` and `part-078.json.gz`, `docs/artifact_reviewed_bridge_identity_adjudication_audit.md`, `docs/equipment-icons.md`, and `docs/game-data-model-alignment.md`. Matching Git blob IDs establish that these inputs are byte-identical across the two commits.

PR #131 changed `research/domain/game-data-entity-aliases.json` and the Formal Identity artifacts to add reviewed bridges for other Artifacts. The three target domain IDs and all six target spelling variants remain absent from those alias and Formal Identity records at the current baseline. The adjudication below therefore uses the unchanged target sources listed above; its conclusion and scope are unchanged by PR #131.

## Decision rule and source hierarchy

`scripts/equipment-icons.ts` derives each icon candidate's `entity` from the first directory beneath `Actors/Items/`. `ENTITY_OVERRIDES` is looked up by the catalog key and compared to that folder-derived string after `normalize()` removes punctuation and lowercases it. Thus this table resolves catalog entries to icon asset folders; it does not read or assert the Raw `ItemIdName` or `ItemId.SerializedId` fields. `docs/equipment-icons.md` likewise describes the table as exceptional public/internal-name aliases in the icon pipeline.

The three override strings exactly reproduce their candidate package-folder spellings. Their complete history starts when the icon script was introduced in commit `b97102733ba59db23ce36fedad6a377dedfa4e44` (`feat: integrate extracted equipment icons`, 2026-09-13). The commit added the script and icon documentation; it gives no per-entry identity rationale. No later spelling change was found. The Raw Structural Inventory graph was introduced later, in `aa308609286eb6a5fc9800c42ff8fc9e928bdf8f` (2026-09-23), so these overrides cannot have originated from its decoded identity fields. This history supports the presentation-oriented interpretation, but is not by itself proof of a Raw identity.

For Raw spelling, the source hierarchy is direct: the Formal Identity v1 contract requires exact `NameProperty` values at both `ItemIdName` and `ItemId.SerializedId` in the scoped CDO, and `docs/game-data-model-alignment.md` states that serialized identity takes precedence over indexed identity. All three target CDOs have both fields decoded and exactly equal. The Raw bulk harvest independently repeats the same serialized ID for the corresponding instance and storable packages. Folder and Blueprint spelling are recorded separately and do not replace those fields.

The Structural manifest marks each catalog seed `provisional` and records the generated icon manifest only as a candidate search hint. Neither its candidate count nor the generated icon match is used as proof here. The reviewed bridge is supported by the explicit catalog-key-to-folder override, the exact package path in the game-data index and Structural shard, and the direct CDO identity observations. The icon manifest is included below only to identify the presentation asset selected by the existing icon pipeline.

## Cross-source spelling table

| canonical domain / display name | `ENTITY_OVERRIDES` | package folder | Raw package file → object/class | icon source asset (presentation hint) | `ItemIdName` | `ItemId.SerializedId` | other committed identity-bearing sources | recommended reviewed Raw identity | decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `artifact:buzzy-nest`<br>Buzzy Nest | `Beenest` | `Beenest` | `BP_BeenestInstance.uasset` + `.uexp`<br>object/class `BP_BeenestInstance_C` | `Dungeons/Content/Patch2/Actors/Items/Beenest/T_Beenest_Icon_inventory` | `BeeNest` | `BeeNest` | Structural package `Dungeons/Content/Patch2/Actors/Items/Beenest/BP_BeenestInstance`, shard `part-078.json.gz`, CDO `Default__BP_BeenestInstance_C`; Raw Bulk instance and storable both serialize `BeeNest`. Source-harvest identity is the display name only. | `BeeNest` | `safe-to-correct-override-to-serialized` |
| `artifact:satchel-of-elixirs`<br>Satchel of Elixirs | `SatchelofNeed` | `SatchelofNeed` | `BP_SatchelOfNeedInstance.uasset` + `.uexp`<br>object/class `BP_SatchelOfNeedInstance_C` | `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/T_Satchelofneed_Icon_Inventory` | `SatchelOfNeed` | `SatchelOfNeed` | Structural package `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/BP_SatchelOfNeedInstance`, shard `part-063.json.gz`, CDO `Default__BP_SatchelOfNeedInstance_C`; Raw Bulk instance and storable both serialize `SatchelOfNeed`. The CDO's drop-sound asset path also spells `SatchelOfNeed`. | `SatchelOfNeed` | `safe-to-correct-override-to-serialized` |
| `artifact:satchel-of-snacks`<br>Satchel of Snacks | `SatchelofNourishment` | `SatchelofNourishment` | `BP_SatchelofNourishmentInstance.uasset` + `.uexp`<br>object/class `BP_SatchelofNourishmentInstance_C` | `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/T_Satchelofnourishment_Icon_Inventory` | `SatchelOfNourishment` | `SatchelOfNourishment` | Structural package `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/BP_SatchelofNourishmentInstance`, shard `part-063.json.gz`, CDO `Default__BP_SatchelofNourishmentInstance_C`; Raw Bulk instance and storable both serialize `SatchelOfNourishment`. The CDO's drop-sound asset path also spells `SatchelOfNourishment`. | `SatchelOfNourishment` | `safe-to-correct-override-to-serialized` |

Exact Structural packages and fields:

| domainId | exact Structural package path | `ItemIdName` | `ItemId.SerializedId` |
| --- | --- | --- | --- |
| `buzzy-nest` | `Dungeons/Content/Patch2/Actors/Items/Beenest/BP_BeenestInstance` | `BeeNest` | `BeeNest` |
| `satchel-of-elixirs` | `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNeed/BP_SatchelOfNeedInstance` | `SatchelOfNeed` | `SatchelOfNeed` |
| `satchel-of-snacks` | `Dungeons/Content/Content_DLC5/Actors/Items/SatchelofNourishment/BP_SatchelofNourishmentInstance` | `SatchelOfNourishment` | `SatchelOfNourishment` |

The corresponding exact Structural sources are `research/raw/game-data-raw-structural-inventory/shards/part-078.json.gz` for Buzzy Nest and `.../shards/part-063.json.gz` for both satchels. The local game-data asset index lists each instance `.uasset` and `.uexp` at the same package path. Raw Bulk Harvest independently reports `serializedItemId` on both instance and storable records for all three. The satchel CDOs' `InventoryDropSound` references use `SatchelOfNeed` and `SatchelOfNourishment`; these corroborate the spelling but are not the deciding identity fields.

## Per-item adjudication

### Buzzy Nest

The canonical Artifact catalog and source-harvest records identify the domain as **Buzzy Nest**. The icon override `artifact:buzzy-nest → Beenest` was created to match the `Beenest` icon folder. In that exact package, the Structural CDO reports both `ItemIdName=BeeNest` and `ItemId.SerializedId=BeeNest`; Raw Bulk Harvest repeats `BeeNest` for the instance and storable. `BP_BeenestInstance_C`, its directory, and the icon asset use `Beenest`, which explains the old override spelling as an asset/package alias. No accepted alias or Formal Identity assertion for this domain or either spelling exists.

**Decision:** `safe-to-correct-override-to-serialized`.

**Recommended Raw identity:** `BeeNest`.

### Satchel of Elixirs

The canonical Artifact catalog and source-harvest records identify the domain as **Satchel of Elixirs**. The override `artifact:satchel-of-elixirs → SatchelofNeed` matches the package folder and icon asset folder. In that package, the Blueprint object is `BP_SatchelOfNeedInstance_C`, and both Structural CDO identity fields are `SatchelOfNeed`; Raw Bulk Harvest repeats that value for instance and storable. The drop-sound asset reference also uses `SatchelOfNeed`. The folder's lowercase `f` is therefore package-folder spelling, not the identity string.

**Decision:** `safe-to-correct-override-to-serialized`.

**Recommended Raw identity:** `SatchelOfNeed`.

### Satchel of Snacks

The canonical Artifact catalog and source-harvest records identify the domain as **Satchel of Snacks**. The override `artifact:satchel-of-snacks → SatchelofNourishment` matches the package folder and icon asset folder. The class and object names also use the folder form (`BP_SatchelofNourishmentInstance_C`), while both Structural CDO identity fields are exactly `SatchelOfNourishment`; Raw Bulk Harvest repeats that value for instance and storable, and the drop-sound asset uses the same capital `O`. This is direct evidence that Blueprint/package spelling and serialized gameplay identity spelling differ in this package.

**Decision:** `safe-to-correct-override-to-serialized`.

**Recommended Raw identity:** `SatchelOfNourishment`.

## Alias, source-harvest, and model-alignment review

- `research/domain/game-data-entity-aliases.json` contains no target-domain alias and no alias for any of the six spellings. The task branch's added accepted aliases cover other Artifact domains only. These three therefore still need alias materialization in the later implementation wave.
- `research/domain/formal/identity-evidence-v1.json` and `src/domain/formal/identityDefinitions.ts` contain no Formal Identity assertion for the three domains. The prior `docs/artifact_reviewed_bridge_identity_adjudication_audit.md` classified them as the three case-only ambiguous rows because it required exact equality and had not resolved which source controlled the spelling.
- `research/artifact-audit.json` and the committed dungeons.tools source-harvest snapshot provide canonical IDs, display names, and Artifact/category facts, but no Raw identity strings. The model-alignment outputs add no target-specific accepted Raw mapping. `docs/game-data-model-alignment.md` supplies the general, applicable rule that serialized identity takes precedence over indexed identity.
- No source says that the old folder spellings and the serialized spellings are two distinct gameplay identities. The same CDO reports one exact, self-consistent identity in both required fields for every target. Accordingly, this is not a true conflict and does not justify retaining the override spelling as a second Raw identity.

The correction recommendation does not depend on Unreal name comparison behavior or filesystem case rules. It follows the repository's own Formal Identity field contract. In the icon script, `normalize()` makes a capitalization-only correction preserve the same folder match; that implementation detail is useful for the next wave but is not identity evidence.

## Adjudication totals

```text
safe-to-correct-override-to-serialized: 3
safe-to-retain-override-and-justify-equivalence: 0
needs-additional-identity-evidence: 0
true-conflict: 0

total: 3
```

**SAFE TO START CASE-MISMATCH FIX + FORMAL POPULATION: yes.**

Population-ready domains and exact Raw identities:

```text
buzzy-nest          → BeeNest
satchel-of-elixirs  → SatchelOfNeed
satchel-of-snacks   → SatchelOfNourishment
```

This decision authorizes a follow-up implementation to correct those three override spellings and then materialize reviewed aliases and Formal Identity entries from the exact package/field evidence above. No such implementation was performed in this audit.

## Validation

- Targets reviewed: 3/3; decision total: 3.
- Raw Structural CDOs verified from committed shards: all three packages have one decoded CDO with exact `ItemIdName` and nested `ItemId.SerializedId` values shown above.
- Source consistency: Git blob IDs for all target-bearing sources listed in “Scope and baseline” match between the original audit checkpoint and current `main` `cd94031e4b30056328ec9c944ca152a25d142088`. The alias and Formal Identity artifacts changed in PR #131, but none of the three target domains or six target spellings is present there.
- History review: all three override entries first appear in the 2026-09-13 icon integration commit; no later spelling edits or per-entry Raw-identity rationale were found. Raw Structural graph introduction is dated 2026-09-23.
- Implementation changes: none; this audit document only.
- `git diff --check`: tracked worktree check passed. Because this new audit file is untracked, `git diff --no-index --check /dev/null docs/artifact_case_mismatch_identity_resolution_audit.md` was also run; it emitted no whitespace diagnostics (exit 1 is the expected “files differ” status).
