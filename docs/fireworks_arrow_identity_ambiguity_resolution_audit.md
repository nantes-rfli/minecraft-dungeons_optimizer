# Fireworks Arrow Identity Ambiguity Resolution Audit

## Scope and baseline

This is a source-discovery audit for artifact:fireworks-arrow only. It adds no alias, Formal Identity assertion, override, Raw extraction, or generated artifact.

The requested baseline 5f75dd32b88f8ee3cd8887a3d06c968ff4a1356b was fetched and verified as the current origin/main. Its tree includes the audited Corrupted Seeds identity state from 8b7b0c0 and contains 144 Formal identities: 27 Melee, 23 Ranged, 71 Armor, and 23 Artifacts. All source findings below were checked against this baseline tree.

## Decision

Decision: true-ambiguity.

No exact Raw identity and instance package is selected. The structural source retains two different package paths with candidate role instance and the same exact serialized identity, FireworksArrow. A third package is a subclass/helper-like implementation with identity FireworksArrowItem and activation behavior. Current canonical sources identify the artifact and describe its effect, but do not name any of these Raw IDs or package paths.

Phase 3 is skipped. The Formal Identity population remains 144, including 23 Artifacts.

## Candidate inventory

Each candidate below is recorded in the Structural Inventory manifest as a candidate with role instance. Its shard row has one CDO. The listed ItemIdName and ItemId.SerializedId are decoded observations from the specified committed shard; they are not themselves a canonical artifact mapping.

| Candidate | Raw identity fields | Structural class evidence | Exact shard locator |
| --- | --- | --- | --- |
| Dungeons/Content/Actors/Items/FireworksArrow/BP_FireworksArrowInstance | ItemIdName=FireworksArrow; ItemId.SerializedId=FireworksArrow | Blueprint class BP_FireworksArrowInstance_C inherits native /Script/Dungeons.ItemInstance. CDO also references the generic fireworks placement cue. | research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/33/cdoPropertyInventory/0 |
| Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowInstance | ItemIdName=FireworksArrow; ItemId.SerializedId=FireworksArrow | A distinct Blueprint package/class with the same class short name, but it inherits native /Script/Dungeons.FireworksArrowInstance. CDO also references the generic fireworks placement cue. | research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/34/cdoPropertyInventory/0 |
| Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowItemInstance | ItemIdName=FireworksArrowItem; ItemId.SerializedId=FireworksArrowItem | Its inheritance chain goes through the preceding FireworksArrowItem/BP_FireworksArrowInstance package and native /Script/Dungeons.FireworksArrowInstance. The CDO has ItemFireworks pointing to the fireworks placement cue; the package exports OnActivated and references a fireworks-arrow activation cue. | research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/35/cdoPropertyInventory/0 |

## Evidence checks

### Raw package graph, imports, classes, and CDOs

- Candidates one and two are separate package paths and separate Blueprint classes. Both have one CDO, both are labeled instance by the Structural seed, and both store FireworksArrow in both identity fields.
- Candidate one has the native ItemInstance parent. Candidate two has the more specialized native FireworksArrowInstance parent. This establishes a class distinction, but the repository does not document which class owns the catalog artifact identity.
- Candidate three is structurally downstream of candidate two and has a different stored identity, FireworksArrowItem. Its ItemFireworks property and OnActivated exports support interpreting it as an activated item/helper implementation. Those fields do not establish that it is the catalog artifact's inventory identity.
- Candidates one and two both reference Dungeons/Content/AudioForce/04_playback_soundCue/04_sfx_item_place/sfx_item_fireworksPlace from InventoryDropSound. That shared generic sound relationship does not distinguish their canonical role.
- The asset index labels the first candidate under entity FireworksArrow and the second and third under FireworksArrowItem, using important-path and filename-prefix classification. Those labels are derived from the asset paths and filenames, so they do not independently resolve the canonical identity. The index also labels BP_PlayerFireworksArrow under entity Arrow. It is a projectile/effect-side candidate and has no structural edge that links it to one of the artifact identity candidates.
- The asset index contains FireworksArrow and FireworksArrowItem Storable assets plus DataTables/Assets/PreloadedStorableItems. The committed Structural Inventory has no parsed /DataTables/ package row for this source, so no parsed table entry bridges artifact:fireworks-arrow to a candidate package.
- The generated icon manifest selects T_FireworksArrowItem_Icon_inventory as a presentation hint. Its path is not an identity mapping.

### Canonical and repository-owned sources

- research/artifact-audit.json#/entries[id=fireworks-arrow] records the canonical name Fireworks Arrow and source IDs dt-artifacts-117 and dt-fireworks-arrow. It has no internalGameIds field.
- research/source-harvest/snapshots/dungeons-tools-2026-09-06.json records externalIdentity=Fireworks Arrow and the property text “Gives 1 fireworks arrow Explodes on impact.” These claims describe the artifact effect; neither asserts FireworksArrow or FireworksArrowItem as its inventory ID.
- research/source-harvest.json#/records[category=artifact,id=fireworks-arrow]/known[property=identity] records only canonicalId fireworks-arrow and name Fireworks Arrow.
- research/domain/game-data-entity-aliases.json and Formal Identity contain no accepted reviewed bridge for this domain. scripts/equipment-icons.ts has no matching ENTITY_OVERRIDES mapping. The reviewed model-alignment inputs do not select one candidate.
- scripts/game-data-raw-structural-inventory.ts documents that candidate discovery uses repository identifiers and presentation paths as search hints. The Structural seed status ambiguous retains equal-rank candidates; its normalized catalog match basis is not an independent mapping.
- Historical searches of committed mapping and research history found no earlier reviewed bridge that chooses one package or identity.

## Candidate role boundary

The source distinguishes at least three things: two inventory-seed instance candidates with the same FireworksArrow ID, and a downstream FireworksArrowItem class whose CDO contains activation/effect data. The third candidate is plausibly an implementation/helper path, but that interpretation is not enough to choose between the two instance packages. The artifact description “gives 1 fireworks arrow” also does not prove that the artifact's own inventory ID is either FireworksArrow or FireworksArrowItem.

The conflict is between two exact Raw instance observations for the same serialized ID, not a decoding failure. Package path, class hierarchy, effect behavior, storable asset names, and icon placement do not supply an independent canonical-to-instance mapping.

## Conclusion and scope

There is no supported value for an exact Raw identity or an exact instance package for this canonical artifact. The correct state remains true-ambiguity. Do not add a Fireworks Arrow bridge or Formal Identity assertion until a committed source directly resolves the candidate choice.

## Audit validation

- All three retained Structural candidates were inspected, including the exact CDO identity fields and package hierarchy.
- Imports, inheritance, templates, CDO references, and related package graph entries were inspected for candidate-role evidence.
- Artifact audit, source harvest, DataTable/index records, game-data alignment inputs, alias data, icon mappings, and committed history were checked.
- No normalized slug, single-candidate, package-name, or icon evidence was counted as an independent bridge.
- Fireworks Arrow identity implementation: skipped because the candidates remain unresolved.
