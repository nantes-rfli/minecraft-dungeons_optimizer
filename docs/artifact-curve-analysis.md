# Artifact curve analysis — Phase 2-2E

## Outcome

No public model passes the runtime curve gate. The damage common-curve comparison has only two unresolved-version Artifacts and two overlapping points. The weapon-curve alternative fails the configured P90 gate on its Lightning Rod hold-out and, more importantly, has no public Artifact field lineage. Healing cannot be fitted without inventing Soul Healer range or Totem rate semantics. A single duration formula is rejected by hold-out families.

Acceptance requires at least 3 Artifacts, 2 independently sourced Artifacts, 8 samples, Power span 50, disjoint hold-out, P90 APE <= 10%, max APE <= 20%, no version conflict and an endgame gate. None qualifies.

## Acquisition coverage

- Damage candidates: powershaker, harvester, lightning-rod, ice-wand, scatter-mines, updraft-tome, blast-fungus, spinblade, eye-of-the-guardian, corrupted-beacon. The normalized snapshot contains 34 Artifact damage rows across Power 1–114.
- Healing candidates/references: soul-healer, totem-of-regeneration, radiance-enchantment-reference, totem-of-shielding. 29 rows are preserved across Power 1–251; semantic exclusions are not fitted.
- Duration/control candidates: gong-of-weakening, fishing-rod, shock-powder, death-cap-mushroom, iron-hide-amulet, totem-of-regeneration, wind-horn. 15 duration rows cover Power 2–262; Wind Horn contributes 5 ambiguous bands over 1–108.

## H-AD-01 — inconclusive

Damaging Artifacts share D_i(P) = c_i * F(P).

- Formula: `LightningRod(P) = k * CorruptedBeacon(P), with log-linear interpolation only inside Beacon published knots`
- Fit: lightning-rod-p1
- Hold-out: lightning-rod-p37
- Supported research range: 1–37
- Validation: n=1; MAPE 4.60%; median APE 4.60%; P90 APE 4.60%; max APE 4.60%; signed bias -4.60%
- Blockers/rejection: only two Artifacts and two overlapping Power observations; both tables are current pages with unresolved table versions; damage-per-strike and damage-per-second units require an Artifact-specific coefficient whose game-field lineage is unknown; no current 1.17 high-Power sample

## H-AD-02 — rejected

Artifact damage uses the existing weapon Gear Power curve after one constant normalization.

- Formula: `LightningRod(P) = k * AnchorWeaponCurve(P)`
- Fit: lightning-rod-p109
- Hold-out: lightning-rod-p111, lightning-rod-p112, lightning-rod-p113, lightning-rod-p114
- Supported research range: 109–114
- Validation: n=4; MAPE 10.12%; median APE 9.31%; P90 APE 11.44%; max APE 11.44%; signed bias -10.12%
- Blockers/rejection: P90 APE exceeds the runtime acceptance gate; the Lightning table version is unresolved; dungeons.tools only states the executable common curve for weapons, not Artifacts; no Artifact sample reaches endgame Power 210+

## H-AD-03 — inconclusive

Patch operands 259, 600 and 660 are members of one shared damage-coefficient family.

- Formula: `displayDamage(P) / patchOperand = common F(P)`
- Fit: not evaluable from public numeric evidence
- Hold-out: none; hypothesis remains inconclusive
- Supported research range: none
- Validation: n=0; MAPE —; median APE —; P90 APE —; max APE —; signed bias —
- Blockers/rejection: no same-Power published display samples for Powershaker, Ice Wand and Scatter Mines; no public raw property names; the patch note reports balance operands, not unit semantics

## H-AH-01 — inconclusive

Soul Healer and Totem of Regeneration share one healing curve with Artifact-specific coefficients.

- Formula: `H_i(P) = c_i * G(P)`
- Fit: not evaluable from public numeric evidence
- Hold-out: none; hypothesis remains inconclusive
- Supported research range: none
- Validation: n=0; MAPE —; median APE —; P90 APE —; max APE —; signed bias —
- Blockers/rejection: Soul Healer nested ranges may be historical variable-soul values rather than current random rolls; Totem display value may be total, per-second or per-tick; no independently versioned overlapping current samples; Radiance is excluded until unit lineage to Artifact healing is proven; no current high-Power Artifact healing sample

## H-DU-01 — rejected

Artifact durations use one common Power formula.

- Formula: `durationSeconds = 0.052 * Power + 8`
- Fit: death-cap-p37-duration, death-cap-p66-duration, death-cap-p124-duration, death-cap-p145-duration
- Hold-out: iron-hide-p12-duration, iron-hide-p15-duration, iron-hide-p104-duration, shock-powder-p12-duration, shock-powder-p58-duration, shock-powder-p108-duration, shock-powder-p262-duration, totem-shield-p2-duration, totem-shield-p32-duration, totem-shield-p60-duration, totem-shield-p108-duration
- Supported research range: 2–262
- Validation: n=11; MAPE 59.31%; median APE 61.07%; P90 APE 107.85%; max APE 146.40%; signed bias 59.27%
- Blockers/rejection: hold-out duration families exceed error gates; published tables show individual linear and discrete-band behavior; Totem of Regeneration exact duration/ticks remain absent

## H-WH-01 — inconclusive

Wind Horn uses a discrete push-distance band table capped at eight blocks.

- Formula: `published lookup bands only`
- Fit: not evaluable from public numeric evidence
- Hold-out: none; hypothesis remains inconclusive
- Supported research range: 1–108
- Validation: n=0; MAPE —; median APE —; P90 APE —; max APE —; signed bias —
- Blockers/rejection: published boundaries overlap at Power 13, 39, 65 and 90; no public evidence establishes an eight-block cap at Power 109+; slow classification, magnitude and duration are not numeric

## Patch coefficient semantic audit

| Artifact | Patch value | Meaning | Runtime use |
| --- | --- | --- | --- |
| powershaker | 235 → 259 | unresolved-internal-balance-operand | Not an absolute damage value; not used |
| ice-wand | 470 → 600 | unresolved-internal-balance-operand | Not an absolute damage value; not used |
| scatter-mines | 600 → 660 | unresolved-internal-balance-operand | Not an absolute damage value; not used |
| eye-of-the-guardian | — → +100% | percentage-only-no-raw-coefficient | Not an absolute damage value; not used |
| lightning-rod | 30 → 60 | historical-per-soul-operand-not-current-absolute-curve | Not an absolute damage value; not used |

The 235/259, 470/600 and 600/660 values reproduce balance deltas but no public source names a shared property. Eye of the Guardian supplies only +100%. Treating these operands as absolute damage or as one coefficient family is therefore unsupported.

## Healing and duration semantics

Soul Healer's 23 rows are retained as nested ranges and excluded from current fitting because fixed Soul costs replaced variable Soul costs in 1.3.2.0. Totem's three card values cannot be reconciled with the historical 40-per-second wording without an exact lifetime and tick interval. Radiance is deliberately excluded because enchantment-healing lineage is unproven. Fishing Rod and Gong add qualitative/history evidence but no current paired table; Shock Powder, Death Cap and Iron Hide stay frozen as runtime fixtures.

## Minimal future measurements (not requested in this phase)

- Powershaker: record Power, one/many targets, exact melee action count, explosion count and damage to distinguish target-granularity and coefficient mapping.
- Totem: record Power, max HP, zone start/end, tick timestamps, per-tick and total heal to resolve unit and duration together.
- Wind Horn: test the four published boundaries plus one 109+ item; record push distance and whether slow changes movement, attacks or both.

These plans are optional last-resort work. Phase 2-2E does not ask the user to measure anything.
