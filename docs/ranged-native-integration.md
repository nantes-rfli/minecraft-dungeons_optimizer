# Ranged Native integration / observed calculation expansion

Baseline: main `e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a` (PR #218 merged). [#217](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/217) and [#218](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/218) are merged; [#219](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/pull/219) was open at head `f1a8c587fb823676eeb71fc0c62b488a392f19fd` when work began. No #219 changes/merge or dependency on its unmerged files. Its Armor aggregation findings remain cited research, not adopted runtime.

## Initial deliverable and calculation count (historical)

**Four additional equipment identities can evaluate/optimize through the existing observed single-arrow model:** Shortbow, Longbow, Power Bow (full-charge originally; also uncharged through the [mode follow-up](ranged-observed-modes.md)), Heavy Crossbow (single). Bow and Crossbow preserve their existing modes and results. Ranged support is Limited 6 / Research-only 65 / Full 0, enchant support unchanged. Newly calculated effects: **0**. No Power, charge-ratio, speed, projectile, enchant or interaction formula is promoted. R3/P3B remains candidate 1 / eligible 0 / promoted 0.

The narrow [reuse ledger](../research/runtime/ranged-observed-reuse.json) and `rangedReuseIsEligible` implement the separate Existing Limited Mechanic Reuse path in ADR 0002. They are an explicit additional bounded Ranged review, not application of the Armor-only validator or a broad reuse exemption. Independent review of this PR reviews that boundary. Source-derived classification is distinct from Limited support and from user observation provenance; nothing gains Measured/Verified or R3 accepted.

Every target requires its own neutral normal-arrow damage, complete cycle, finite available ammo, version/mode and source note. Strong Charged Attacks and Powerful Shots are included in the target observation; they are not additional inferred multipliers. Native base values or theoretical times cannot satisfy the observation. Rejected free-slot/fixed enchants, shared target/temporal interactions, special arrows, unique variants, Soul and unresolved Armor synergies retain existing rejection behavior. Existing Power/Critical Hit/Unchanting expected modifiers retain the original Limited assumptions, not new independent interaction verification.

## Independent reproduction

[Original report](../research/native/ranged-20261031/REPORT.md), Raw provenance, replay proof and source scripts are retained byte-for-byte with [SHA-256 manifest](../research/native/ranged-20261031/source-manifest.json). The original exploratory scripts retain historical private paths; run the new portable wrapper below, not the original loader/probe. No game binary, memory image, uasset/uexp, credentials or private payload is committed.

- Independently matched 23 Raw packages / 46 source files / 255 decoded leaves to committed Structural shards and original source size/hash/valueRange bytes. Native image SHA-256 `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`; executable hash in original report `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`. Official authenticity and Raw/exe same-build attribution remain unverified.
- Catalog support/labels change the Raw inventory's whole-file input hash. The [guarded input refresh](../research/native/scripts/refresh_ranged_catalog_input.ts) proves all 271 projected seed items and parser/code identity equal the baseline, then updates only input metadata. [Refresh proof](../research/native/ranged-20261031/catalog-input-refresh.json) and the refreshed Horizontal manifest reference preserve every Raw shard/package/run ID; no private reparse is claimed. CI repeats the equality checks.
- Replayed **4,158 instruction fragments**, exact equality to original proof: 7 descriptors, 9 pointers, 13 instruction checks, 10 hashed replay spans. Independent rational binary32 oracle, MXCSR 0x1f80; each span <=64 instructions/100 ms. Existing outer Watchdog: 60 s, normal exit, no forced kill, cleanup complete. [Independent replay](../research/native/ranged-20261031/integration-replay.json) is separate from original `verification.json`. Not a game/CRT/whole-object execution.
- Independently read **13 Function bodies across four projectile classes**. [Blueprint review](../research/native/ranged-20261031/blueprint-review.json) preserves source hashes, export/script byte ranges, hashes and decoded expression metadata without payload bytes. Shortbow/Longbow forward launch/reset/charge to their immediate parent; Power Bow forwards charge; Heavy Crossbow additionally activates/deactivates Audio/Particle components. The fail-closed reader rejects unknown opcodes, calls and contexts. [Epic EExprToken](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/CoreUObject/EExprToken) corroborates token names; its newer API is not a proof of the game VM version. This bounded source review supports observed reuse, not a general claim of complete Blueprint semantics or live effect absence.

## Conditional Native domain

[Derived Native model](../research/domain/ranged-native-model.json) joins the five existing matched Formal Identity assertions and exact configured Value/Serialized Relation projection/evidence references to Raw projectile targets and Native defaults. Formal v2 stays raw configured values/serialized relations; no Native-derived expression is relabeled as a Formal raw observation. `nativeRangedReference` provides typed access. Application uses this connection to validate the reuse scope; reference values do not feed DPS arithmetic. Public factual taxonomy and its unknown fields stay unchanged for the four additions, so support expansion does not close source Evidence gaps.

`F` means binary32 nearest/ties-even at each instruction. Normal land arrow, explicit G=1, no additional effects/event changes:

```text
W = F((chargeCompletionCallbackRan ? K : 1) * P)
H0 = F(F(G * W) * B)             # before ItemPower / events / target handling
r = F(F(1 / S_fire) * R)         # not one rounded R/S operation
c = F(C / S_charge)
nextAllowed = F(F(r + worldNow) + itemTypeDelay)
GetWeaponChargeTime = F(F(C + R) / S)
```

Charge completion is a boolean callback, not continuous held-time interpolation. The timer executes when its double clock **exceeds** expiry; weapon/owner gates use float32 `now >= deadline`. Pending/active timers, input/tick order, separate speed captures and owner action deadlines remain necessary for effective cadence. A fixed FPS/extra frame/ceil rule is not inferred. The five ItemTypes retain the inspected builder's zero additional delay; absence of an arbitrary Raw property never creates a zero.

| Equipment | Uncharged H0 | Charged H0 | R seconds | C seconds |
| --- | ---: | ---: | ---: | ---: |
| Bow | 50 | 125 | 0.41999998688697815 | 0.3499999940395355 |
| Shortbow | 37.5 | 61.874996185302734 | 0.20999999344348907 | 0.125 |
| Longbow | 60.000003814697266 | 180 | 0.41999998688697815 | 0.3499999940395355 |
| Power Bow | 100 | 300 | 0.41999998688697815 | 0.3499999940395355 |
| Heavy Crossbow | 135 (single) | not applicable | 1 (Native default) | 0 (Native default) |

Bow B=50 at `.uexp [810,814)`, R `[592,596)`, C `[621,625)`, K `[650,654)`. Native defaults at `0xb193e5/0xb193fa/0xb19404/0xb19418` are checked after listed Raw inheritance; the component copy at `0xa2ce00` and helper `0xa0b350` connect settings to the attack component. Product paths use damage multiplier `0xa19894`, collision product `0x83b7a8`, cooldown `0xa0fc6d`, charge `0xa1112e`, callback `0xa14e2c`. Per-value ranges and source hashes are in the domain/Raw artifacts; replay ranges and hashes are in the proof. Shortbow 61.875 and Longbow 60 would erase real binary32 distinctions. Power Bow projectile's B=50 is inherited from BowArrow, not an override or measured hit.

At speed 1 Bow settings give 0.42 s recovery and 0.35 s charge, API about 0.77 s; **none is a measured effective cycle**. Native-derived baselines add **zero** calculable equipment by themselves.

## Remaining inputs and next bounded Work Unit

No existing observation input is removed. Displayed Power does not uniquely determine internal float32 ItemPower. #217's power normalization/external math and #219's captured attribute/aggregation paths are retained in the report; host `pow` cannot replace the unverified game CRT. Even a correct Power scalar is not automatically the effective RangedAttackItemPowerFactor or final target damage. Signed custom magnitude is not final Health loss/UI rounding. Unknown finalProjectileDamage and effectiveShotCycleSeconds remain explicit in every profile.

Smallest next damage Work Unit: identify/hash the actual math provider and verify its exact output/FP conditions, with explicit internal ItemPower and captured attribute inputs; separately review R3/P3B before any runtime use. This needs no assumed Windows session/video. Smallest timing Work Unit: a tick/input/clock/action-state supplied transition model, tested against the already recovered strict-expiry and deadline gates; do not present it as live measured cadence. The [observed-mode follow-up](ranged-observed-modes.md) supplies a separate scope/intrinsic review for the three uncharged bows. Unique equipment still requires its own complete review.

## Reproduction and validation

```sh
python3 -B research/native/scripts/check_ranged_integration.py
python3 -B research/native/scripts/build_ranged_domain.py
node research/native/scripts/refresh_ranged_catalog_input.ts
python3 -B -m unittest discover -s research/native/scripts -p test_ranged_integration.py
python3 -B research/native/scripts/check_ranged_integration.py --local-root <private-local-game-data> --replay --output <new-output.json>
python3 -B research/native/scripts/check_ranged_blueprints.py --local-root <private-local-game-data>
npm run audit:ranged-runtime
npm run audit:game-data-native-analysis
npm run audit:formal-integration
npm run audit:runtime-promotion
```

The public Native audit runs provenance/model checks and six positive/negative/preservation Python tests without private inputs; normal full tests include the 20 new Ranged tests. Full Validate is run on GitHub's actual PR head, not duplicated locally. CI/review/head references are recorded in the PR after completion. Rollback: revert this PR; no local observations or schema migration is required. Per the updated project instructions, Site publication is deferred until after merge; this PR is intentionally left unmerged. Any later publication must reuse the existing project ID and preserve owner-only access.

## Conditional final-damage follow-up

The [final-damage integration](ranged-final-native-integration.md) adds an explicit-input Domain calculator and bounded pinned-CRT CLI. Its reference custom magnitudes are separate from this observed runtime: no new runtime equipment/effect or removed observation input, no R3/P3B promotion. The historical unknown fields above remain unchanged.

The [Rapid Crossbow follow-up](rapid-crossbow-runtime-reuse.md) uses a separate bounded source review and explicit target-owned consumption observation. Current observed runtime is Limited7/71 with 11 weapon/mode pairs. It adds no Native numeric profile: Native ResourceCost/final damage/effective cycle are not inferred. The historical five conditional Native models and their unknown effective values remain unchanged.
