# Great Hammer — exact Identity to existing plain melee runtime

Baseline: main `e637d939edc760b6d1e3a12226ad165e77f8a25d` after PR #226. This follow-up connects one newly eligible normal weapon to the [plain melee foundation](plain-melee-runtime-reuse.md). Melee gear runtime increases from 8/82 to 9/82 (Full4 / Limited5). New damage, speed, area or Power formulas: 0.

## Source and Identity boundary

The existing English game localization resource contains the unique structured record `ItemType / Hammer → Great Hammer`. The [derived source record](../research/sources/great-hammer-localization-identity.json) retains only the necessary fact, file identity and ranges. The strict v2 reader checks the namespace and string tables, references, counts, terminators and end of file. It does not infer a mapping from a string search, icon name or spelling similarity.

The reviewed source has SHA-256 `ad2c5866665bc87a6267b234a9cc5c373c5f4376f230abfe3638826134d7b5f6`, with the entry at `[125961,125984)` and localized string at `[318993,319014)`. Both Raw instance fields, `ItemIdName` and `ItemId.SerializedId`, equal `Hammer`. The finite Identity bridge binds the exact canonical target, source/version/hash, localization namespace/key/value and scoped Raw package. Withdrawal or drift must reject the bridge and its dependent runtime grant.

Localization provides Identity evidence only. It does not prove a mechanic, effective animation timing, Power conversion or current-version gameplay accuracy. Private binaries, payload hex and the localization corpus are not committed. Ordinary validation uses the committed bounded derived facts and Raw provenance; independent review can replay the existing local source without publishing it.

## Own calculation inputs

The existing public calculator HTML, SHA-256 `47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1`, independently supplies the exact Great Hammer row: Power8.686 / Speed1 / Area7.762, Common, no built-in Enchantments. The published attack profile is one hit, 0.7 seconds, damage ratio `[1]`, finisher1. The complete published intrinsic is `Great splash`.

Only one explicit target is allowed. The model adds no splash geometry, extra target, reach or knockback utility. Published cadence is `1 / 0.7`; Speed rating1 is metadata. Existing Model G uses the weapon's own exact Power rating and existing Anchor curve, or the owned neutral observed hit override. The unrelated research-only Wiki base damage is not a runtime input.

Attack-speed effects, Pain Cycle/Dynamo, copy limits, Evidence policy, Power range and unsupported Armor/Ranged interactions retain the plain foundation's guards. Great Hammer does not inherit Gravity or Thundering from its unique variants. Those variants require their own built-in ownership/Tier and interaction review and are excluded. All other currently eligible plain targets are already registered.

## Preservation and verification

The old eight runtime weapons and four plain targets retain ordering and results. Historical Great Hammer Catalog records migrate through the finite compatibility path without inventing damage, rolls or mechanic parameters. Metadata, Tier, Gilded, Research and instance identity remain; recorded unknown effects cannot silently disappear during evaluation.

Positive, source-withdrawal, malformed-source and runtime-boundary tests accompany the change. The browser fixture covers all five plain weapons from old Catalog records through explicit one-target optimization and equipment assessment to unchanged export/reload. New independent DPS samples remain pending. R3/P3B stays candidate1 / eligible0 / promoted0. Final-head Full Validate and independent merge review are recorded in the PR.

The optional source replay is `node scripts/locres-identity-source.ts --local-file <existing Game/en/Game.locres>`. It reads the existing resource and emits only the verification outcome. The ordinary Formal Identity audit does not require private files.
