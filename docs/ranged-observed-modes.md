# Observed Ranged — uncharged mode reuse

Baseline: main `89d3e5b04dbf5c16cc334b05b5a8fe12c2465217` after PR #225. One mode-specific grant foundation adds uncharged normal-arrow evaluation for Shortbow, Longbow and Power Bow. At this historical baseline Ranged gear remained 6/71 Limited and supported weapon/mode pairs increased from 7 to 10. That mode Work Unit added no equipment identities or effect formulas. The later [Rapid Crossbow follow-up](rapid-crossbow-runtime-reuse.md) makes the current range 7/71 and 11 pairs.

| Equipment | Supported observed modes |
| --- | --- |
| Bow / Shortbow / Longbow / Power Bow | charged, uncharged |
| Crossbow / Heavy Crossbow | single |
| Rapid Crossbow | single, with explicit target-owned consumption1 observation |

## Source and boundary

The existing [Blueprint review](../research/native/ranged-20261031/blueprint-review.json) and [Native model](../research/domain/ranged-native-model.json) already retain each target's identity, single normal projectile/zero configured launch delays and ToggleCharged(bool) forwarding. The inspected charge switch is a completion-callback boolean, including its false path. This supports the bounded observed single-arrow model; it does not make a Native baseline or theoretical timer an effective hit/cycle measurement.

The [reuse ledger](../research/runtime/ranged-observed-reuse.json) uses an exact `(targetId, mode)` key. Different approved modes coexist; a duplicate same tuple is rejected. An uncharged grant's withdrawal/drift rejects that mode without invalidating the existing charged grant. Undeclared modes remain unsupported. Every mode must independently match the target source/version, whole published intrinsic set, reviewed path and non-inheritance conditions.

Each owned target/mode requires its own neutral normal-arrow damage, complete cycle (charge/release/recovery included as applicable), finite ammo, version and observation note. Longbow/Power Bow's Strong Charged Attacks are not multiplied into uncharged damage, nor divided out of a charged observation. Donor damage/cadence, charge ratios, Native CDO values, Power scalars and theoretical cycles do not supply runtime numbers. All existing Enchant, Armor, Soul, special-arrow, projectile and unsupported-interaction restrictions remain.

## Input and preservation

Changing an editor's mode clears only the draft damage/cycle/note, so numbers from the old mode cannot be relabeled and applied automatically. Ammo is a separately recorded stock and is retained, including known 0. Blank mode-specific fields cannot be applied. Existing saved observations/JSON remain unchanged until valid Apply; reverting/reloading can restore the saved observation. Selecting the same mode is a no-op.

Existing valid charged results and Bow/Crossbow/Heavy Crossbow calculations are preserved. Old invalid single-shot records on the three bows remain readable and can be explicitly repaired with the new mode's own values. No equipment-ID or storage-schema migration is needed.

## Coverage and verification

The mode follow-up itself left other categories unchanged. After subsequent source-bound reuse, current Melee gear9/82, Armor13/73, Artifact3/45, Ranged Enchant3/41 and R3/P3B candidate1/eligible0/promoted0 remain separate coverage meanings. Native finalProjectileDamage/effectiveShotCycleSeconds remain unknown and Native runtimeEligible remains false. This work reuses completed research instead of repeating Native Power/timing acquisition.

Positive/negative/preservation tests cover all three additions, tuple duplicates and mode-local withdrawal, exact complete-cycle/ammo arithmetic, missing mode-owned observations, unsupported interactions, old mode results, and draft/saved-state boundaries. Browser tests verify explicit new values, blank Apply rejection, ammo0, reload restoration and evaluation. Final-head Full Validate and independent review are recorded in the PR; software fixtures are not gameplay measurements.
