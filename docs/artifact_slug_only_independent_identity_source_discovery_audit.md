# Artifact Slug-Only Independent Identity Source Discovery Audit

## Scope and baseline

This audit covers only the 22 requested Artifact domain IDs. It records identity-source discovery and adjudication; it adds no alias, Formal Identity assertion, override, Raw extraction, schema change, or generated artifact.

The audit baseline is current `main` at `18c60faaf2b097b33997dfa05b6160ef6aa078f5` (143/271 Formal identities and 22/45 Artifacts). The identity review was performed on checkout `c8543209f31e72804764eef7802b0dd24879c6e3`. After fetching the named baseline, the target-bearing source records used below were verified byte-identical between that checkout and current `main`: Artifact audit, source-harvest snapshot, asset index, bulk harvest, Structural Inventory manifest and target shards, and equipment icon manifest. The changes between the audited checkout and baseline concern other Artifacts and do not add any of the 22 target IDs to Formal Identity or reviewed aliases. This source-level provenance check carries the audit findings to the current baseline without changing the reviewed conclusions.

## Decision rule

An independent bridge must connect a canonical Artifact domain identity to an exact Raw identity through evidence other than the normalized catalog-slug comparison. A candidate is rejected as independent evidence if it is only:

- `catalogId → normalizeIdentifier() → ItemIdName` or `ItemId.SerializedId`;
- the generated `serialized-catalog-identifier-match` / `serialized-identity-match` result or its `exact` candidate status;
- a unique package candidate, package/folder spelling, display-name similarity, icon match, or normalized spelling;
- a second rendering of the same extracted Raw package fields.

`Corrupted Seeds`' `internalGameIds` record is considered separately because the committed Artifact audit explicitly records those IDs under a Wiki-sourced canonical item record. The exact Raw observation is then checked independently in the committed Structural shard.

## Source discovery and authority checks

### Raw candidates and generated match basis

All 22 Structural Inventory seeds are marked `exact`, each has one candidate with role `instance`, and each candidate's decoded `ItemIdName` equals its decoded `ItemId.SerializedId`. The package, values, and shard locator for each are listed below. The manifest's match basis is `serialized-catalog-identifier-match`; it also records the icon manifest as `presentation-search-hint-only`.

That `exact` status is not an independent bridge. In `scripts/game-data-raw-structural-inventory.ts`, `resolveRawSeedCandidates` normalizes `catalogId` and compares it to normalized serialized identifiers; the later `serialized-identity-match:*->catalog:*` evidence is emitted from that same comparison. The source code thus confirms that these labels are derived from the slug comparison. Raw shard CDO fields prove what the Raw identifier is, but do not by themselves name the canonical domain item.

The Raw Asset Index supplies package paths and file metadata. The bulk harvest also records serialized IDs for parsed Artifact assets, but those values come from the same game packages and do not include a canonical domain ID. Neither provides a second canonical-to-Raw mapping. The Structural CDO/reference records contain package/object references to gameplay actors, effects, animations, and audio; no target CDO/reference row carries the canonical domain ID or an explicit display-ID mapping. No target DataTable row or source record pairing a domain ID with its Raw ID was found in committed `research/raw/**`.

### Canonical, historical, and presentation sources

- `research/artifact-audit.json` and its declared `sourceIds` were checked for each item. Of the 22 records, only `corrupted-seeds` has an `internalGameIds` field. The other 21 records do not assert a Raw ID.
- `research/source-harvest/snapshots/dungeons-tools-2026-09-06.json` was checked for each target's `externalIdentity` claim. Where present, the claim is the detail-page heading/display name. Its source/entity key is slug-shaped and the claim does not state `ItemIdName` or `ItemId.SerializedId`; it cannot bridge to Raw. The snapshot has no Corrupted Seeds record.
- `generated/equipment-icons/manifest.json` has matched presentation hints for these target IDs. `scripts/equipment-icons.ts` has no `ENTITY_OVERRIDES` entry for any target. Icon paths and override semantics are not identity evidence.
- `research/domain/game-data-entity-aliases.json`, `research/domain/formal/identity-evidence-v1.json`, and `REVIEWED_ARTIFACT_ALIAS_BRIDGES` in `scripts/game-data-model-alignment.ts` have no bridge for the target IDs. Gameplay-property mappings are not treated as identity mappings.
- The source history for the exceptional Corrupted Seeds ID list begins in the Artifact audit foundation commit `98c13e943853bc9226c6e3a442ec1c26a246b730` (2026-09-01), before the Formal Identity evidence artifact was introduced. It is not generated from Formal Identity or from an accepted alias. Historical searches found no equivalent explicit bridge for the other 21 targets.
- History of the alias and icon mapping files contains the Corrupted Pumpkin mapping (`CorruptedBeacon_Spooky1 → corrupted-pumpkin`) and the documented bridge move in commits `8ee2a71` and `4cd5732`; neither maps the base Corrupted Beacon. The icon pipeline history (`b971027`) is presentation work. No target slug-only ID was found as a prior reviewed bridge or override.

### Corrupted Beacon family boundary

The repository has a separate reviewed mapping `artifact:corrupted-pumpkin → CorruptedBeacon_Spooky1`. The Artifact audit also records Corrupted Pumpkin as a reskin of Corrupted Beacon. Its Raw identity includes the `_Spooky1` suffix, and the Structural seed remains provisional for that separate catalog item. This is a distinct variant identity; stripping the suffix or using that bridge for `corrupted-beacon → CorruptedBeacon` would be an unsupported inference. It does not create a competing Raw identity for the base Corrupted Beacon candidate.

## Per-item Raw identity evidence

In every row, `seed=exact / candidate=instance` and `ItemIdName` / `ItemId.SerializedId` are direct observations from the listed Structural shard. Every seed's generated basis is the same normalized catalog-ID match described above; it is deliberately not counted as independent evidence. The Structural Inventory manifest and the listed shard are both committed Raw-derived records, while the manifest's catalog association is slug-seeded.

| domainId — displayName | Candidate package (full Raw package path) | `ItemIdName` / `ItemId.SerializedId` | Shard locator |
| --- | --- | --- | --- |
| `corrupted-beacon` — Corrupted Beacon | `Dungeons/Content/Actors/Items/CorruptedBeacon/BP_CorruptedBeaconInstance` | `CorruptedBeacon` / `CorruptedBeacon` | `research/raw/game-data-raw-structural-inventory/shards/part-029.json.gz#/packages/52/cdoPropertyInventory/0` |
| `corrupted-seeds` — Corrupted Seeds | `Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance` | `CorruptedSeeds` / `CorruptedSeeds` | `research/raw/game-data-raw-structural-inventory/shards/part-029.json.gz#/packages/54/cdoPropertyInventory/0` |
| `enchanters-tome` — Enchanter's Tome | `Dungeons/Content/Content_DLC3/Actors/Items/EnchantersTome/BP_EnchantersTomeInstance` | `EnchantersTome` / `EnchantersTome` | `research/raw/game-data-raw-structural-inventory/shards/part-058.json.gz#/packages/47/cdoPropertyInventory/0` |
| `flaming-quiver` — Flaming Quiver | `Dungeons/Content/Actors/Items/FlamingQuiver/BP_FlamingQuiverInstance` | `FlamingQuiver` / `FlamingQuiver` | `research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/49/cdoPropertyInventory/0` |
| `golem-kit` — Golem Kit | `Dungeons/Content/Actors/Items/GolemKit/BP_GolemKitInstance` | `GolemKit` / `GolemKit` | `research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/55/cdoPropertyInventory/0` |
| `gong-of-weakening` — Gong of Weakening | `Dungeons/Content/Actors/Items/GongOfWeakening/BP_GongOfWeakeningInstance` | `GongOfWeakening` / `GongOfWeakening` | `research/raw/game-data-raw-structural-inventory/shards/part-030.json.gz#/packages/57/cdoPropertyInventory/0` |
| `harvester` — Harvester | `Dungeons/Content/Actors/Items/Harvester/BP_HarvesterInstance` | `Harvester` / `Harvester` | `research/raw/game-data-raw-structural-inventory/shards/part-031.json.gz#/packages/0/cdoPropertyInventory/0` |
| `ice-wand` — Ice Wand | `Dungeons/Content/Actors/Items/IceWand/BP_IceWandInstance` | `IceWand` / `IceWand` | `research/raw/game-data-raw-structural-inventory/shards/part-031.json.gz#/packages/6/cdoPropertyInventory/0` |
| `lightning-rod` — Lightning Rod | `Dungeons/Content/Actors/Items/LightningRod/BP_LightningRodInstance` | `LightningRod` / `LightningRod` | `research/raw/game-data-raw-structural-inventory/shards/part-031.json.gz#/packages/18/cdoPropertyInventory/0` |
| `love-medallion` — Love Medallion | `Dungeons/Content/Actors/Items/LoveMedallion/BP_LoveMedallionInstance` | `LoveMedallion` / `LoveMedallion` | `research/raw/game-data-raw-structural-inventory/shards/part-031.json.gz#/packages/26/cdoPropertyInventory/0` |
| `soul-healer` — Soul Healer | `Dungeons/Content/Actors/Items/SoulHealer/Bp_SoulHealerInstance` | `SoulHealer` / `SoulHealer` | `research/raw/game-data-raw-structural-inventory/shards/part-031.json.gz#/packages/40/cdoPropertyInventory/0` |
| `soul-lantern` — Soul Lantern | `Dungeons/Content/Patch2/Actors/Items/SoulLantern/BP_SoulLanternInstance` | `SoulLantern` / `SoulLantern` | `research/raw/game-data-raw-structural-inventory/shards/part-079.json.gz#/packages/3/cdoPropertyInventory/0` |
| `tasty-bone` — Tasty Bone | `Dungeons/Content/Actors/Items/TastyBone/BP_TastyBoneInstance` | `TastyBone` / `TastyBone` | `research/raw/game-data-raw-structural-inventory/shards/part-032.json.gz#/packages/19/cdoPropertyInventory/0` |
| `thundering-quiver` — Thundering Quiver | `Dungeons/Content/Content_DLC4/Actors/Items/ThunderingQuiver/BP_ThunderingQuiverInstance` | `ThunderingQuiver` / `ThunderingQuiver` | `research/raw/game-data-raw-structural-inventory/shards/part-061.json.gz#/packages/31/cdoPropertyInventory/0` |
| `tome-of-duplication` — Tome of Duplication | `Dungeons/Content/Actors/Items/TomeOfDuplication/BP_TomeOfDuplicationInstance` | `TomeOfDuplication` / `TomeOfDuplication` | `research/raw/game-data-raw-structural-inventory/shards/part-032.json.gz#/packages/23/cdoPropertyInventory/0` |
| `torment-quiver` — Torment Quiver | `Dungeons/Content/Actors/Items/TormentQuiver/BP_TormentQuiverInstance` | `TormentQuiver` / `TormentQuiver` | `research/raw/game-data-raw-structural-inventory/shards/part-032.json.gz#/packages/34/cdoPropertyInventory/0` |
| `totem-of-regeneration` — Totem of Regeneration | `Dungeons/Content/Actors/Items/TotemOfRegeneration/BP_TotemOfRegenerationInstance` | `TotemOfRegeneration` / `TotemOfRegeneration` | `research/raw/game-data-raw-structural-inventory/shards/part-032.json.gz#/packages/41/cdoPropertyInventory/0` |
| `totem-of-shielding` — Totem of Shielding | `Dungeons/Content/Actors/Items/TotemOfShielding/BP_TotemOfShieldingInstance` | `TotemOfShielding` / `TotemOfShielding` | `research/raw/game-data-raw-structural-inventory/shards/part-032.json.gz#/packages/55/cdoPropertyInventory/0` |
| `updraft-tome` — Updraft Tome | `Dungeons/Content/Content_DLC3/Actors/Items/UpdraftTome/BP_UpdraftTomeInstance` | `UpdraftTome` / `UpdraftTome` | `research/raw/game-data-raw-structural-inventory/shards/part-059.json.gz#/packages/0/cdoPropertyInventory/0` |
| `void-quiver` — Void Quiver | `Dungeons/Content/Content_DLC6/Actors/Items/VoidQuiver/BP_VoidQuiverInstance` | `VoidQuiver` / `VoidQuiver` | `research/raw/game-data-raw-structural-inventory/shards/part-067.json.gz#/packages/23/cdoPropertyInventory/0` |
| `wind-horn` — Wind Horn | `Dungeons/Content/Actors/Items/WindHorn/BP_WindHornInstance` | `WindHorn` / `WindHorn` | `research/raw/game-data-raw-structural-inventory/shards/part-033.json.gz#/packages/8/cdoPropertyInventory/0` |
| `wonderful-wheat` — Wonderful Wheat | `Dungeons/Content/Actors/Items/WonderfulWheat/BP_WonderfulWheatInstance` | `WonderfulWheat` / `WonderfulWheat` | `research/raw/game-data-raw-structural-inventory/shards/part-033.json.gz#/packages/13/cdoPropertyInventory/0` |

## Per-item independent-source adjudication

For each row, `research/artifact-audit.json`'s `sourceIds` were followed into its source registry. For 21 items, the source-harvest `externalIdentity` heading (where a source-harvest record exists) states only the display name; the Artifact audit has no `internalGameIds` value. It therefore asserts no Raw identity. `research/domain/game-data-entity-aliases.json` and Formal Identity have no target bridge. No conflict between distinct exact Raw IDs was found for those rows.

| domainId | Independent source candidates investigated / source locator | Bridge source; asserted Raw identity | Conflict or competing identity | Decision |
| --- | --- | --- | --- | --- |
| `corrupted-beacon` | Artifact audit: `dt-artifacts-117`, `dt-corrupted-beacon`, `wiki-corrupted-beacon`; source-harvest external identity is the detail heading. | No independent base-item bridge found. | `corrupted-pumpkin` is explicitly `reskinOf: corrupted-beacon` and has a separate reviewed bridge to `CorruptedBeacon_Spooky1`. The suffix is retained; that identity does not establish the base mapping. | `needs-additional-identity-evidence` |
| `corrupted-seeds` | `research/artifact-audit.json#/populationDifferences[id=corrupted-seeds]`; `sourceIds=[wiki-corrupted-seeds]`; source registry `sources[id=wiki-corrupted-seeds]` identifies *Minecraft Wiki Corrupted Seeds* (`https://minecraft.wiki/w/Dungeons:Corrupted_Seeds`, search-index retrieval). The source note states that the Wiki records both IDs. | **Yes.** The committed Wiki-sourced canonical record explicitly asserts `CorruptedSeeds` and `Corrupted-Seeds`; the Raw shard independently contains `CorruptedSeeds` in both identity fields. The exact shared value is `CorruptedSeeds`. | Wiki lists a second reported spelling, `Corrupted-Seeds`; it is not present in the current Raw CDO. It does not conflict with the exact current Raw observation. | `ready-with-existing-independent-source` |
| `enchanters-tome` | Artifact audit: `dt-artifacts-117`; source-harvest `externalIdentity` heading only. | None; no source asserts `EnchantersTome` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `flaming-quiver` | Artifact audit: `dt-artifacts-117`, `dt-flaming-quiver`; source-harvest heading only. | None; no source asserts `FlamingQuiver` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `golem-kit` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `GolemKit` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `gong-of-weakening` | Artifact audit: `dt-artifacts-117`, `wiki-gong-of-weakening`; source-harvest heading only. | None; no source asserts `GongOfWeakening` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `harvester` | Artifact audit: `dt-artifacts-117`, `dt-harvester`, `wiki-harvester`; source-harvest heading only. | None; no source asserts `Harvester` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `ice-wand` | Artifact audit: `dt-artifacts-117`, `wiki-ice-wand`; source-harvest heading only. | None; no source asserts `IceWand` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `lightning-rod` | Artifact audit: `dt-artifacts-117`, `wiki-lightning-rod`; source-harvest heading only. | None; no source asserts `LightningRod` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `love-medallion` | Artifact audit: `dt-artifacts-117`, `dt-love-medallion`; source-harvest heading only. | None; no source asserts `LoveMedallion` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `soul-healer` | Artifact audit: `dt-artifacts-117`, `dt-soul-healer`, `wiki-soul-healer`; source-harvest heading only. | None; no source asserts `SoulHealer` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `soul-lantern` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `SoulLantern` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `tasty-bone` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `TastyBone` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `thundering-quiver` | Artifact audit: `dt-artifacts-117`, `dt-thundering-quiver`; source-harvest heading only. | None; no source asserts `ThunderingQuiver` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `tome-of-duplication` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `TomeOfDuplication` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `torment-quiver` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `TormentQuiver` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `totem-of-regeneration` | Artifact audit: `dt-artifacts-117`, `dt-totem-of-regeneration`, `wiki-totem-of-regeneration`; source-harvest heading only. | None; no source asserts `TotemOfRegeneration` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `totem-of-shielding` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `TotemOfShielding` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `updraft-tome` | Artifact audit: `dt-artifacts-117`, `wiki-updraft-tome`; source-harvest heading only. | None; no source asserts `UpdraftTome` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `void-quiver` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `VoidQuiver` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `wind-horn` | Artifact audit: `dt-artifacts-117`, `dt-wind-horn`, `wiki-wind-horn`; source-harvest heading only. | None; no source asserts `WindHorn` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |
| `wonderful-wheat` | Artifact audit: `dt-artifacts-117`; source-harvest heading only. | None; no source asserts `WonderfulWheat` for the canonical domain item. | None found. | `needs-additional-identity-evidence` |

For the 21 rows without a bridge, the `ItemIdName` / `ItemId.SerializedId` value shown in the Raw table is the observed Raw string, not a canonical identity assertion. Display-name claims, a unique candidate, the package name, and the icon asset were not used to join it to the domain ID.

## Classification and next-wave decision

```text
ready-with-existing-independent-source: 1
ready-with-small-reviewed-bridge: 0
needs-additional-identity-evidence: 21
ambiguous: 0

total: 22
```

```text
SAFE TO START NEXT ARTIFACT IDENTITY WAVE:
  partial
```

Population-ready from an existing independent source:

```text
artifact:corrupted-seeds → CorruptedSeeds
```

The other 21 remain at `needs-additional-identity-evidence`. This audit did not materialize the Corrupted Seeds bridge or change any Formal Identity population.

## Validation and changes

- Target completeness: all 22 requested IDs have one Raw candidate row and one independent-source adjudication row.
- Classification total: 22.
- Source independence: only the explicit Wiki-sourced `internalGameIds` record is counted; generated slug matches, exact-candidate status, display names, package names, icon matches, and duplicate Raw extraction records are excluded.
- Source-authority cycle: absent. The one qualifying source predates Formal Identity and is not generated from aliases or Formal Identity.
- Implementation/data changes: none. This audit document is the only intended file change.
