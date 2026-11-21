# Flail / Jailor’s Scythe — isolated Chains reuse

Flail and Jailor’s Scythe join the existing observed complete-combo model as **Limited** equipment. Melee coverage becomes 37/82 and total equipment coverage 64/271. This finite grant covers both eligible targets together; it does not model Chains in ordinary group combat.

| Target | Own Raw identity | Own published / configured hits | Published complete base cycle | Owned effect |
| --- | --- | --- | ---: | --- |
| Flail | `Mace_Unique2` | 81 / 81 / 175; 0.44 / 0.44 / 0.77 s | 1.65 s | Chains I |
| Jailor’s Scythe | `SoulScythe_Unique1` | 80 / 80; 0.48 / 0.56 s | 1.04 s | Chains I and weapon-owned +1 Soul Gathering |

Configured damage is a cross-check, never a Power curve or runtime damage input. Enter the same individual’s current-Power complete ordinary combo against one neutral target, with external buffs, Armor damage bonuses and slot/Gilded effects removed. Existing direct modifiers, Radiance and Jailor’s Anima Conduit channel retain their previous boundaries. Optional Soul Siphon, speed sources, ranged coexistence, duplicate Chains and unsupported intrinsic Research remain excluded.

## Required scenario contract

Both confirmations are explicit and initially unknown:

- The primary target has no Chains state at the beginning.
- Throughout the evaluation interval, the actual Chains query has no other eligible candidate around that target.

`averageTargetsInReach=1`, zero eligible-target share, a boss label or an assumed distance do not establish the second condition. Unknown or false excludes the two weapons. The UI names enemies, allies, summons and arrivals as possible candidates and offers “未確認”. The app validates the supplied contract; it does not inspect the live game world. If its truth cannot be established, leave it unknown. The native radius remains in unknown spatial units and is not converted to blocks or metres.

Confirmations record the evaluation duration. Changing that interval invalidates both until re-entered. Historical scenarios omit the field and remain unknown. Inventory migration retains individual ID, Power, rolls, notes, favorite and Research, and creates neither observations nor confirmations. Power edits invalidate the existing complete-combo observation through the shared observed-combo path.

## Source and architecture boundary

The [own source rows](../research/sources/observed-isolated-chains.json) bind exact Locres `ItemType` keys and both own serialized IDs. They correct the old icon ordinal ambiguity rather than adopting it. The complete prior 172 Identity assertions and 737 provenance records are preserved; two finite identities append. The existing alias generator adopts the same exact reviewed keys. Formal Value/Relation and the Raw inventory are unchanged. The two reversed historical icon pairs (Flail/Sun’s Grace and Jailor/Frost Scythe) select existing licensed images by their reviewed own source package, with a fallback for missing or ambiguous image provenance; old ordinal labels do not supply Identity.

The [original Astra bundle](../research/native/coverage-20261114/README.md) proves the primary exclusion and selected-neighbor-zero branch. Additional [static bridge metadata](../research/native/coverage-integration-20261121/chains-dispatch-proof.json) closes fixed enum24/Tier1 record transport, the hash-bound Blueprint registry/finder, class construction, active receiver registration and named melee attack dispatch. Both Blueprint packages have no Function exports, inherit their matching Native classes and contain only Effect/UIData CDO references. A null class lookup has a base-class fallback; that fallback is not evidence of eligible Chains support. The finite source gate pins the successful binding and rejects source drift.

Under the confirmed contract, selection skips primary append and the application call. The result retains `chainsNoApplication.state = no-application-call` and its interval. It bypasses general Chains chance/duration/refresh arithmetic and explains why there is no newly applied root. It does not state that visual gameplay cues are absent. General selectable Chains and its historical Limited assumptions remain unchanged. Contribution calculations remove only the validated owned tuple and report the conditional zero contribution without claiming an unknown effect is neutral.

This reuses direct complete-combo and flat Soul arithmetic within a smaller supported scope. No new probability, duration, radius, target classification, timer, damage or RNG formula enters Runtime. Evidence remains source-bound Derived; no gameplay observation, R3 accepted decision, P3B promotion or official-build authentication is claimed. Promotion remains candidate1 / eligible0 / promoted0.

## Verification

Focused positive/negative tests cover both items, fixed ownership, current-Power observations, unknown/false/partial/stale confirmations, changed target count, source/identity/Tier/class/Soul drift, ordinary Chains preservation, Inventory and saved-scenario compatibility, optimization and condition comparison. Two Chromium flows cover migration, observation, missing confirmation, fixed tuple, structural explanation and false-condition rejection. Final-head CI and the independent final review are recorded on the PR.

Reproduce private source checks without publishing the inputs:

```sh
python3 -B research/native/coverage-integration-20261121/verify_chains_dispatch.py --local-root "$LOCAL"
node research/native/coverage-integration-20261121/verify_chains_blueprints.mjs "$LOCAL"
```

The original `verify_handoff.py` intentionally checks its historical unchanged baseline. Run it in the original Astra baseline checkout, not against the integration head whose Runtime and Formal Identity have changed. The integration audit verifies the immutable bundle file hashes and the new source bindings without changing those historical expectations.
