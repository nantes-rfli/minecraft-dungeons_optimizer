# Current common blocker census

Baseline `6bf212dc5ea8f686f981c9882657874264e41791`. Current registered catalog: M35/82, R11/71, Armor13/73, Artifact3/45. Research only; no runtime promotion.

| Candidate | Unsupported affected | Important qualification |
|---|---:|---|
| Artifact damage Power | 17 | Target, event, cost still required |
| Artifact duration-only | 7 | Target/state/objective are separate |
| Armor hit negation | 11 | Discrete hit semantics, not scalar DR |
| Armor DR | 15 | Other intrinsics coexist |
| Armor arrows/bundle | 3 | All three obtainable; other intrinsic blockers remain |
| Ranged complete cycle | 60 | Shared foundation, not 60 unlocks |
| Ranged Wind pull | 3 | Two variants add other fixed effects |
| Ranged simultaneous projectiles | 8 | Fixed Multishot 1 is a separate cohort |
| Ranged Punch | 1 | Doom Crossbow; cannot silently ignore pushback |
| Melee Chains | 2 | Flail and Jailor; explicit no other eligible Chain candidate condition |

All finite IDs and current Raw seed/Formal identity/value/relation locators are in candidate-census.json. Cohorts overlap. Automatic runtime unlock is zero. Historical audit blockers are not authoritative runtime counts; the baseline snapshot executes the current catalog.

The seven duration-only unsupported artifacts are Boots of Swiftness, Fishing Rod, Ghost Cloak, Gong of Weakening, Light Feather, Shadow Shifter, Totem of Shielding. Native DurationIncrease alone is insufficient to grant any of them.

Reproduce: regenerate baseline-catalog.json with catalog_snapshot.mjs, then run `python3 -B research/native/coverage-20261114/candidate_census.py`.
