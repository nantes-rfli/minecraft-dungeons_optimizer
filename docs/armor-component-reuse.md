# Dark Armor / Titan's Shroud — bounded Limited component reuse

The baseline is main `2fbab76c9d41d35ff4625d48b9c21ae59eb0580c` (PR #223). Armor runtime changes from 11/73 to 13/73; Armor Enchantments remain 7/41. This is reuse of existing Limited calculations, not R3 adoption or a new mechanic promotion.

## Target-owned source and scope

Both identities are accepted/high/matched in `research/domain/formal/identity-evidence-v1.json`: Dark Armor = `DarkArmor`, Titan's Shroud = `DarkArmor_Unique1`. Raw identity is an identity bridge, not evidence of effective gameplay values. The versioned published `research/armor-audit.json` entries provide each target's complete audited intrinsic set, built-in list, inheritance, Soul eligibility and source IDs for 1.17.0.0.

| Target | Complete audited intrinsic set | Existing Limited donor/channel | Not inherited |
| --- | --- | --- | --- |
| Dark Armor | 35% damage reduction; +50% souls gathered | Wither: sole Armor incoming DR; flat Soul resource multiplier | Wither's Life Steal |
| Titan's Shroud | inherited 35% damage reduction; inherited +50% souls gathered; unique +20% weapon damage boost aura | Wither DR/Soul; Mercenary self direct-melee aura | Life Steal; attack speed; any other donor effect |

Each non-neutral parameter has its own target-source-value-property-version Derived declaration. Derived does not mean independently Measured/Verified. Observed Armor card +HP remains mandatory; no new Power conversion or values are inferred from configured Raw fields.

## Foundation boundary

B3 is a new narrow validator for these two complete target sets. It does not relax B/B2 or A/P3B. A target allowlist, exact property ownership, donor/value/channel checks, matched identity, own source provenance, built-in/Soul checks, complete runtime intrinsic and numeric sets, non-inheritance, reject list and test references must all match. An arbitrary subset or union of donor properties is not eligible.

The runtime formulas are unchanged: DR affects incoming damage, +50% multiplies existing flat Gathering without creating gathering from zero or changing pickup count, and +20% aura enters self direct-melee damage. Aura → direct kills → Soul units already exists for Mercenary/Renegade with Soul Scythe; damage amplification with the 1.5 Soul multiplier already exists for Wither with supported direct modifiers. No new same-channel stacking rule is introduced.

All previous DR composition exclusions, Soul Siphon rejection, and Ranged/Soul/aura restrictions remain. No proc/DoT/explosion/party/ranged aura channel or Life Steal is added. Missing/unsupported effects are not assigned neutral values. Any extra intrinsic, wrong source/value/version/identity/ownership, built-in, unrelated donor effect or incomplete approval fails closed. Other Armor still requires its own supported boundary or A/P3B evidence.

## Runtime payoff and verification

Both Armor identities can flow through Inventory → evaluate → optimize, explanations, Evidence policy, equipment assessment and condition comparison. Dark Armor provides DR/Soul without Wither's Life Steal; Titan adds its own aura. Positive tests exercise actual numeric channels and optimizer candidates, negative tests enforce evidence/reuse and interaction boundaries, and existing historical/replica Armor results and inventory round trips remain protected.

The implementation adds 2 Armor identities, 5 target parameter bindings and 0 new effect formulas. Melee 4/82, Ranged 6/71 and Artifact 3/45 are unchanged by this Work Unit. R3/P3B remains candidate 1 / eligible 0 / promoted 0. Full Validate and independent architecture/code review must refer to the final PR head. Publication occurs after merge using the existing owner-private Site.
