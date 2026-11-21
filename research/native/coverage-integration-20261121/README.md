# Astra handoff independent verification and Runtime disposition

Baseline: GitHub main after PR #241, `6bf212dc5ea8f686f981c9882657874264e41791`; rechecked at integration resumption. This is a bounded record for the named coverage work, not a new progress source of truth.

## Independent verification

The original [manifest](../coverage-20261114/manifest.json) contains 31 public artifacts, 26 baseline inputs and 14 private original inputs. All were size/hash checked at the original unchanged baseline. Native checks covered 126 span records, 13 pointer assertions and 35 direct calls. Original-package strict reparse also reproduced Boots and Armor bindings and Chains identities/numeric fields.

All saved conditional replay results were re-executed and compared exactly: Artifact 2,219, Armor 1,288, Chains branches 11, total **3,518 comparisons / 0 mismatches**. Armor’s three boundary units passed. These include multiple stages for one input; they are not 3,518 game observations. No game observation was obtained. READY denotes conditional research foundation; it is neither whole-equipment readiness nor R3 acceptance. The historical Artifact A1/A2 review and final resolution retain separate hashes.

## Chains closure added during integration

The handoff alone did not close equipment-to-class dispatch. Further pinned static analysis and the [separate source review](source-independent-review.json) verified:

1. Exact own Locres keys agree with Raw/native identity and published names. Own attack vectors/timings agree with the existing published audit. Jailor owns separate +1 Soul Gathering.
2. Fixed enum24/Tier1 goes from catalog builder `+0x70`, through 20-byte ItemType `+0x1b8` records, into 16-byte equipped records without changing enum/Tier. `b45dc0` marks fixed provenance separately from rolled records; `b598f0 → 985630` passes them to EnchantmentComponent.
3. `a7b300` constructs `BP_Chains` from the metadata name. EnchantmentAssetFinder registers the expected class, asset key and enum-derived category, then reads the configured roots and AssetRegistry. The v6 registry was fully parsed: 49,397 assets / 146,784 names, one `BP_Chains` (also case-insensitively), exact GeneratedClass and Native parent. No full registry payload is included.
4. Dungeons module registration/factory and virtual `+0x50` resolve MasterAssetFinder’s EnchantmentAssetFinder. `710ef0 → 711b60` retrieves the pinned category/key; `a63de0` loads/caches the class. This is a static file relation, not a fabricated successful engine load. The null-class fallback is explicitly excluded from the finite binding.
5. `9b4100` creates the class instance, appends it to active receiver array `+0x110`, sets equipment owner context and preserves record Tier in `+0x1d8`. Named MeleeAttackComponent dispatches arming and selection through that active list to Chains’ `+0x3e0/+0x3d8` methods.
6. The completed query excludes the primary, and zero eligible neighbors skips primary append/application. An earlier Chains state is not removed by this no-call fact. The separate gameplay cue hook remains outside the no-application assertion.

The [reproducer](verify_chains_dispatch.py) pins 29 spans, 26 direct calls and eight pointers; [Blueprint reparse](verify_chains_blueprints.mjs) verifies both exact cooked packages. Only compact metadata, hashes, RVAs and relationships are retained. The [finite Runtime contract](../../../docs/observed-isolated-chains-reuse.md) requires explicit unknown/false rejection, initial state and interval-wide isolation. Two Limited items are eligible under that contract; no general-combat Chains formula is adopted.

## Other foundations: held, eligible population empty

| Foundation / named population | Minimum remaining evidence and acceptance boundary |
| --- | --- |
| DurationIncrease: Boots, Gong, Shadow Shifter, Enchanter’s Tome, Totem of Shielding | Internal Power callback/set-by-caller arithmetic is known. Provider final cooldown, engine final duration, target/consumer/activation/stacking remain unresolved. Existing Artifact fixed/linear/table contracts use different inputs; this new formula requires its own adoption path. |
| Arrow bundles: Hunter’s, Archer’s, Guard’s Armor | Default5/CDO10, recursion flag and history conversion are known. Bind each item to BP, identify slot1/2/5, separate startup/physical pickup/bonus emit and alternate ammo routing. The existing ranged resource model assumes no replenishment; a pickup/history event is a new mechanic. |
| MissChance: Arctic Fox, Fox, Cauldron, Full Metal, Plate, Reinforced Mail, Stalwart, Ghostly, Cloaked Skull, Ghost Kindler, Souldancer Robe | CDO0.3f and local strict RNG threshold are known. Resolve the null fifth argument versus dereference by identifying valid receiver/RNG dispatch, tags and each item binding. Existing scalar incoming DPS cannot represent discrete cancellation by multiplying by0.7. |

All other intrinsic effects still matter. Hunter has +30% ranged damage; Archer also has movement aura; Guard has Artifact cooldown. MissChance items additionally carry damage auras, potion sharing, DR/roll cooldown, Potion Barrier, Ghost Form/Fire Trail or percentage Soul/Artifact damage. A local common foundation does not make these complete items calculable.

A source inconsistency also remains in the existing Totem of Shielding audit: `targeting.note` describes radial blast/push/slow while `interactions.note` describes a placed projectile shield. Neither is a sufficient target consumer proof. It was not silently corrected or adopted here.

## Concrete Astra Ultra follow-up

1. **Arrow event closure first:** bind `ArchersStrappings`, `ArchersStrappings_Unique1`, `CowardsArmor` to BP_IncreasedArrowBundleSize; name slot1/2/5 from `935ee0 → 99f0f0`. Trace all actual emitters through `940560 → af13e0 → b50870`. Deliver separate event tables for initial stock, physical pickup, bonus grant and identity/capacity conversion. Do not generalize “BeginPlay only registers” into all-startup exclusion.
2. **Valid MissChance RNG dispatch:** close `7b0fcc → c149d3 → virtual+3c0` receiver and fifth argument to `940860`, explaining the null path. Trace tags into `93ecc0`, and prove ineligible RNG non-advancement plus eligible cancellation writes. Do not synthesize successful engine returns. Then bind all11 items separately.
3. **Boots provider/final timer:** resolve `item+4b8` provider `+40` in `ae8ce3..ae8d24`, cooldown candidate `aecae0..aecc7d`, and slot `+254` reduction position. Connect self-application `ae6064` and `7b0ab0` duration output through engine modifiers/refresh to actual expiry. Keep internalPowerBits, effective positive-duration/cooldown attributes and provider state explicit. Movement objective needs a separate product contract.
4. **Other Artifact consumers:** Gong’s `b4e417..b4e429` dedicated duration key → effect consumer, vulnerability/Weakening ownership, eligibility/refresh; Shadow’s `b439c4..b43a00` → Soul payment and first-hit consumption/state end; Tome ctor `ad8980` → ally/pet selection/buff consumer; Shielding ctor `b1a6c0` → spawned actor lifetime/projectile block/zone residence and correction of the conflicting audit note.
5. **Ordinary-combat Chains, only for a later new scope:** close target classification/radius units, all effect consumers, final duration/refresh/resistance and independent adoption evidence. The current finite no-call grant does not need or imply these quantities.

None of these tasks requires a new Windows environment, Switch video or save extraction from the user. Official executable/pak same-build authentication and independent gameplay holdouts remain separate blockers; this integration does not manufacture them. R3/P3B and Unknown/Unsupported remain unchanged. Once the two-item work is integrated, no further currently eligible Native population remains, so repeated no-evidence investigation is deferred.
