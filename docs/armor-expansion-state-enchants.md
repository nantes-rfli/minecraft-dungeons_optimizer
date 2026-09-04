# Phase 2-3C — Armor Expansion & State Enchant Batch

Phase 2-3C is complete. It expands Armor runtime by recombining existing property mechanics and adds bounded state semantics for four Armor Enchantments. Current coverage is Armor **7 / 73** and Armor Enchantment **7 / 41**, all Limited.

## Added Armor

| Armor | Runtime properties | Reused model | Limited boundary |
| --- | --- | --- | --- |
| Mercenary Armor | 35% DR, +20% weapon damage aura | Renegade DR and self direct-melee aura | other DR sources rejected; aura does not affect party or indirect damage |
| Grim Armor | +50% Souls, 6% Life Steal | Wither Soul and Life Steal | Soul Siphon composition rejected; Life Steal credits direct melee AoE only |
| Scale Mail | 35% DR, +30% melee damage | Armor DR and Battle Robe direct melee | other DR sources rejected; indirect damage excluded |
| Spider Armor | +25% melee attack speed, 6% Life Steal | Renegade cadence and Wither Life Steal | Death Cap/Rampaging rejected; indirect Life Steal excluded |

All four require an observed card Health bonus. Intrinsic behavior is driven by property values rather than new Armor-ID branches in evaluation.

The fix-up removes the Wither-only Soul multiplier branch: the offensive resolver passes its existing `ArmorState` into `deriveSoulState`. Grim and Wither multiply positive flat Gathering by their shared `soulGatheringMultiplier = 1.5`. Armor alone does not create Soul collection; kill rates, normal pickup events, and Soul Siphon proc counts are not multiplied. Soul Siphon composition remains unsupported.

## Added Armor Enchantments

| Enchantment | Runtime semantics | Boundary |
| --- | --- | --- |
| Health Synergy | `steady-state Artifact activation capacity/s × resolved max Health × 3/4/5%` | nominal capacity; no overheal timeline; one copy |
| Snowball | 2-second stun every 5/3/1 seconds, scaled to one target and scenario eligibility | Control only; boss default 0; union composition; one copy |
| Cowardice | direct-melee multiplier `1 + 20/30/40% × full-health share` | explicit `cowardiceFullHealthShare` required; indirect channels excluded; one copy |
| Protection | damage-taken multiplier 94/89/85% | sole DR source only; one copy |

### Health Synergy fix-up: Option B

For current cooldown-only runtime Artifacts, the formula is `sum(1 / effectiveCooldownSeconds) × resolvedMaxHealth × tierFraction`. This is **steady-state nominal healing capacity**, with **overheal not modeled**. Tier values and the activation trigger are game facts; activation frequency is a Limited model approximation. Reasons and build-confidence caveats make that distinction explicit.

Option B preserves the shared activation engine and all Health Synergy / Artifact Synergy numeric outputs. Option A would require a finite use-at-ready policy and regression changes across activation-triggered effects, exceeding this bounded fix-up. No finite encounter uses are counted: changing encounter duration, including exactly a cooldown boundary, does not change activation capacity. The model makes no claim about an activation at `t == encounterDuration` or exact finite healing. Future resource-scheduled Artifacts must supply realized scheduled uses when integrated; they are not promoted here.

Protection is rejected with Armor DR, Potion Barrier, Iron Hide Amulet, Guarding Strike, or Weakening. Unsupported combinations are never registered as zero-value optimizer choices.

## Inventory, UI, and contribution policy

The reference list contains all 41 audited hero-accessible Armor Enchantments. Normal-slot and Gilded inputs preserve exact ID and Tier; unknown IDs fail import. Runtime status is visible per option. A free slot containing any unsupported alternative is rejected, while an explicitly locked supported roll remains evaluable.

Whole-Armor leave-one-out contribution has been removed. It mixed identity, required Health, intrinsic mechanics, and legal Armor Enchantment ownership into one misleading number. Reasons still explain Armor identity, Health, and each intrinsic property. Armor Enchantments retain individual leave-one-out contributions.

## CDR stacking re-audit

Status remains **inconclusive**. The required published anchors are approximately 77% for Evocation Robe plus three maximum Cool Down copies after the diminishing-stacking change, and 84.1% for the current four-copy theoretical maximum. Neither the nominal multiplicative model nor the audited community reciprocal proposal reproduces both with the 1.17 tier values.

Therefore Battle Robe + Cool Down, multiple Cool Down copies, and external Scenario CDR + gear CDR remain unsupported. The single-source behavior from Phase 2-3B is unchanged.

## Regression and next phase

The baseline is `973fbd641f1cfbdfd1a9ca0a3a76d20450935e0e`. The only intended numeric correction is Grim with an existing Soul Gathering source (and its derived Soul resource trajectory). Health Synergy and Artifact Synergy retain their numeric behavior. Armor-less builds keep their exact legacy outputs across the existing 180 evaluate/evaluateCandidate/optimize/Pareto cases. CI now runs both `audit:armor-runtime` and `audit:armor-expansion` after the Armor catalog audits. The Phase 2-3B Armor set remains covered by exact regression and the new tests cover property reuse, Tier values, zero/partial/full state shares, boss eligibility, Control union, DR rejection, all 41 inventory IDs, locked/free optimizer behavior, and contribution ownership.

Armor MVP coverage is now closed. The next equipment-coverage area is Ranged runtime; remaining Armor effects stay Research-only until their Evidence and state/objective model are sufficient.

Machine-readable decisions are in [`research/armor-expansion-state-enchant-audit.json`](../research/armor-expansion-state-enchant-audit.json).
