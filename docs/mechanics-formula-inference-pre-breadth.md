# Mechanics Formula Inference Pre-Breadth Audit

Audited: 2026-09-24
Game scope: Minecraft Dungeons 1.17.0.0
Baseline: `e90d35822c452341b76c24029356e39387e2a8df` (latest `main` at audit start)

The requested baseline `05211ca1f44326911592652f4adc53fa04692220` was one commit behind latest `main`. The intervening merge adds three reviewed identity bridges; it does not change the mechanics conclusions below.

This is a research/design audit only. It does **not** change Formal schemas, Raw extraction, generated Formal artifacts, Application code, Optimizer scoring, runtime support, or Native research.

Machine-readable companion: [formula-inference-pre-breadth.json](../research/mechanics/formula-inference-pre-breadth.json).

## Decision

**PRE-BREADTH FACT GAP REMAINS**

The formulas themselves do **not** need to be finished before breadth. Two per-item input-preservation gates do:

1. **Linked timing source closure.** Horizontal collection must retain timing facts not only from the item instance but also from reachable attack-sequence / animation / notify / effect sources where the instance points to them.
2. **Artifact base-cooldown source closure.** For every Artifact, breadth must locate source-backed base cooldown/start semantics in committed Raw/linked packages or record an explicit unavailable / parser-boundary state.

Both gates can be closed from the committed Raw Structural Inventory and relation graph. They do not require Native D-3, Windows runtime capture, or a new Raw extraction.

## Evidence policy

Evidence remains separated by authority:

- **A** — current Raw / repository evidence
- **B** — current Formal contracts
- **C** — public game-derived database
- **D** — Wiki quantitative data
- **E** — Shin / ShinkuNY measurements
- **F** — Pancakecat measurements
- **G** — other community quantitative measurements
- **H** — derived formula hypothesis

Community measurement is not a game-file fact. A community formula is not a confirmed game formula. A good fit is not proof of the implementation.

## 1. Gear-power curve

**Classification: `inference-ready-needs-more-observations`**

### Current inference

Public dungeons.tools material states that weapon-relative Power ratings ride one common gear-power curve and that the absolute curve is compiled into the executable rather than shipped in the paks. The public Sword table supplies same-item damage observations at many powers. That makes reconstruction **partially feasible**, but the exact current functional form is not established.

Preferred hypothesis:

```text
displayedAbsolute(item, occurrence, power)
≈ roll_or_round(itemRelativeCoefficient(occurrence) × G(power))
```

Treat `G(power)` as a discrete lookup/interpolated curve first. Do not force polynomial, exponential, or power-law form until observations justify it.

### Decision

| Question | Result |
| --- | --- |
| Curve reconstruction feasible | **partial** |
| Single common weapon curve supported | **plausible** |
| Candidate closed functional form identifiable | **no** |
| Preferred representation | discrete lookup / interpolated table |

### Horizontal impact

Per item, collect the configured source coefficient/value, occurrence, channel, and linked source relation. **Do not collect a separate full power table per item.**

The exact `G(power)`, rounding/roll behavior, and possible cross-category curve families are global/post-breadth work.

## 2. Damage scaling

**Classification: `model-ready-needs-population`**

The existing research already supports a multi-family damage model. It does not support collapsing every source into one scalar pipeline.

Conceptual model:

```text
source-backed damage event
  → source coefficient/value + channel + ownership
  → eligible additive family
  → eligible multiplicative/source family
  → indirect / elemental channel handling
  → eligible full/global multipliers
  → scenario result
```

A 2026 community formula is useful as a hypothesis:

```text
Full × [
  (1 + Additive)
  × (Base × Multiplicative + Dynamo)
  + Indirect
]
```

It is **not** promoted as the canonical game formula.

### Evidence that the event/channel split is necessary

Current Raw already exposes more than one source shape:

- Fighter's Bindings: per-attack `Damage`, `DamageType`, splash multiplier and active-effect relation.
- Scatter Crossbow: the weapon instance points to a projectile; the linked projectile package carries its own `damage` value.
- Battle Robe research records a +30% melee-damage intrinsic whose modifier ownership/stage is still unresolved.
- Existing Shin research separates flat physical, full physical, indirect, elemental-focus and full/global multiplier families, plus special eligibility cases.

### Must collect before breadth

**Melee:** every configured attack occurrence, Damage, DamageType/channel, splash/secondary coefficients, active-effect relation, and tick/loop cadence where present.

**Ranged:** AttackDefinition/projectile occurrences, projectile target relation, target projectile damage/channel, count/delay, and charge/variant multipliers when present.

**Armor:** intrinsic modifier values, ownership/target domain, built-in enchant/effect relations.

**Artifact:** linked actor/effect source, configured direct/indirect/elemental/heal values, and repeated-tick cadence where present.

Global modifier-family taxonomy, stacking order and eligibility are not per-item collection requirements.

## 3. Attack timing / effective HPS

**Classification: `model-ready-needs-population`**
**Key decision: C — weapon-family-specific transform is required.**

For ordinary fixed-combo melee families, configured durations are already strong enough to derive an unmodified configured cadence:

| Weapon | Audited fixed cadence |
| --- | ---: |
| Fighter's Bindings | 4 / 0.575 s = **6.9565 HPS** |
| Sword | 3 / 1.042 s = **2.8791 HPS** |
| Sickles | 6 / 1.7 s = **3.5294 HPS** |
| Master's Katana | 3 / 1.56 s = **1.9231 HPS** |
| Anchor / Encrusted Anchor | 1 / 2.5 s = **0.4 HPS** |

Fighter's Bindings Raw and the repository attack-profile audit agree on the four configured durations (approximately 0.15 / 0.15 / 0.15 / 0.125 seconds).

That does **not** establish one universal HPS formula. Raw also exposes timing controls outside the currently-Formal duration field:

- `DamageDelaySeconds`
- `CooldownSeconds`
- `AttackVariantResetMultiplier`
- `VariantLoopAmount`
- `AttackSequence`
- active-effect relations
- Ranged `AttackRateSeconds`
- bow/crossbow charge/load/fire/shoot notify-state relations

The sawblade family is direct counter-evidence to a fixed-combo-only model: the current melee audit intentionally leaves HPS un-derived because continuous attack, release, and overheat require a cycle model.

### Timing model

```text
fixed-combo:
  configuredHPS =
    effectiveHitCount / sum(effectiveVariantDurations)

general:
  familyHPS =
    F_family(
      animationDuration,
      attackRate,
      damageDelay,
      loopCount,
      reset/recovery,
      notify/release state,
      attackSpeedModifier
    )
```

Cancel windows, true recovery and continuous-release/overheat behavior remain empirical unless a source-backed serialized field is found.

### Breadth gate

The collector must preserve item-instance timing **and reachable linked timing facts**. Collecting only `configuredAnimationDuration` would force a second horizontal harvest later.

## 4. Cooldown

**Classification: `inference-ready-needs-more-observations`**

The model families are clear; the exact current 1.17 percentage composition is not.

Keep these as separate mechanics:

```text
base cooldown
→ percentage-reduction family
→ fixed-second reductions on trigger
→ reset / event-driven remaining-cooldown transitions
```

Candidate state model:

```text
C_percent = PercentCompose(C_base, armorIntrinsicSources, coolDownEnchantSources)

on Cooldown Shot trigger:
  remaining = max(0, remaining - tierSeconds)

on reset/reduction trigger:
  remaining = Transition(effect, remaining)
```

Do **not** linearly add displayed percentages, and do **not** merge fixed seconds into the percentage family.

### Current evidence

- Battle Robe: repository audit records **-40% artifact cooldown**.
- Repository Cool Down audit: game-file-derived **-18 / -29 / -37%**, stackable, up to four copies in the current model.
- Current Wiki page displays **-18 / -29 / -38%**, describes diminishing stacking and records the 1.17 four-copy behavior. This display conflict is a reason not to silently promote a formula.
- Cooldown Shot is a distinct fixed-seconds family: **0.5 / 1.0 / 1.5 s** after a charged shot.
- Older community formulas provide useful hypotheses but predate the current 1.17 four-copy state.

### Breadth gate

Artifact base cooldown is a per-item fact. The repository Artifact audit has source-backed public values, but the representative committed full Raw item/effect path does not establish a generic Raw location for that fact.

Before breadth, search the **committed** structural inventory and linked actor/effect/inheritance packages. Either retain a source-backed Raw path or explicitly record `not-observed` / parser boundary. Never substitute the Wiki/database value into Raw provenance.

## Current Formal impact

Current Formal Value/Availability v2 already expresses:

- narrow source-backed Melee configured damage;
- narrow configured Melee animation duration;
- narrow Ranged projectile configuration;
- representative serialized relations.

Semantic gaps remain for:

- global gear-power model and derived displayed values;
- damage channel/event ownership, modifier family and eligibility;
- timing delay/reset/recovery/loop/notify plus family-derived or empirical HPS;
- cooldown ownership, percentage/fixed/reset families and state transitions.

No schema change is made in this audit.

## Horizontal collection contract

| Category | Required before breadth | Global / not per-item | Empirical-only |
| --- | --- | --- | --- |
| Melee | attack occurrences/order; Damage + DamageType; animation duration; DamageDelay; reset multiplier; attack Cooldown; loop count; AttackSequence/effect relations; tick interval | gear-power curve; damage stacking equation; attack-speed transform | cancel/recovery; continuous/release calibration |
| Ranged | AttackDefinition; AttackRate; projectile occurrences/count/delay; projectile target + target damage/channel; charge/load/fire/release/notify relations; item-owned cooldown triggers | gear-power curve; cooldown equation; ranged family transforms | charge/cancel/reload cadence if not serialized |
| Armor | intrinsic values + ownership; artifact-CD intrinsic; damage modifier target; built-in enchant/effect relations | cooldown composition; damage-family ordering | composition validation |
| Artifact | linked actor/effect closure; base cooldown provenance; configured damage/heal/duration/range; tick interval/loop; owned trigger/reset effects | gear-power curve family; cooldown composition | runtime-only behavior when no configured source exists |

## What must happen before breadth starts

### Gate 1 — linked timing source closure

Using the existing committed Raw Structural Inventory, census timing-like facts reachable from the category seeds and freeze the traversal/retention rule. Exact paths or explicit unavailable/parser-boundary states are sufficient.

### Gate 2 — Artifact base-cooldown source closure

For every Artifact candidate, search the committed instance + linked actor/effect + inherited related packages for base cooldown/start facts. Freeze either the source-backed path or an explicit static-boundary result.

These are **collection-contract** gates, not formula-completion gates.

## Post-breadth work

1. Reconstruct/falsify the gear-power lookup from normalized same-item observations.
2. Populate and adjudicate damage modifier family/eligibility mappings.
3. Fit family-specific attack-speed/timing transforms against Shin/Pancakecat measurements.
4. Resolve current 1.17 percentage cooldown composition and validate fixed-second/reset state transitions.
5. Only then design Formal schema changes and Optimizer consumption.

## Public evidence used

- dungeons.tools damage comparison — https://www.dungeons.tools/damage-calculator
- Minecraft Wiki Sword — https://minecraft.wiki/w/Dungeons:Sword
- Minecraft Wiki Cool Down — https://minecraft.wiki/w/Dungeons:Cool_Down
- Minecraft Wiki Cooldown Shot — https://minecraft.wiki/w/Dungeons:Cooldown_Shot
- 2026 community damage-formula thread — https://www.reddit.com/r/MinecraftDungeons/comments/1u92q4y/
- 2021 cooldown-formula test — https://www.reddit.com/r/MinecraftDungeons/comments/lsky8r/

Existing Project/Library community research was used as the seed for Shin/Pancakecat evidence rather than recollecting it from scratch.
