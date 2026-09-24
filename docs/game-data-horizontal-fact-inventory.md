# Horizontal Raw Fact Inventory v1

[`research/raw/game-data-horizontal-fact-inventory-v1.json.gz`](../research/raw/game-data-horizontal-fact-inventory-v1.json.gz) is a deterministic, source-backed observation layer for the current 271 equipment catalog entries. It reads the committed Raw Structural Inventory graph and does not re-extract game packages.

## Authority and identity boundary

The collection contract is [`research/mechanics/pre-breadth-source-closure.json`](../research/mechanics/pre-breadth-source-closure.json), [`docs/pre-breadth-source-closure.md`](pre-breadth-source-closure.md), and the Raw Structural Inventory under `research/raw/game-data-raw-structural-inventory/`. The inventory manifest and compressed shard hashes are verified during generation.

Raw candidate status (`exact`, `provisional`, `ambiguous`, or `not-found`) describes candidate mapping evidence only. It does not set Formal Identity or prove canonical identity. Candidate observations stay attached to their own candidate package; ambiguous candidates are never combined. Formal Identity remains read-only and is not an input to the collector.

## Artifact shape and availability

The artifact contains one item row per catalog identity. Candidate rows keep role and mapping status, and hold fact/relation references with candidate-specific traversal paths. Shared serialized occurrences are stored once in the top-level `sourceFacts` and `sourceRelations` tables; each candidate reference resolves to those records and retains its own candidate package and path provenance.

Each source fact records the dataset identity, Structural Inventory manifest and shard, source package hash, source object, property pointer/path, property order and array indexes, decoded type/value/state, and candidate-to-source edge sequence. Relation targets retain resolved, null, native, out-of-scope, missing, and parser-boundary outcomes. Gzip output is written with a stable header and canonical JSON payload.

Availability states are kept distinct:

- `known`: a serialized value or explicit null was decoded. Explicit zero and false remain known values.
- `not-observed`: the selected source closure contained no occurrence for that selector.
- `parser-boundary`: the needed value or behavior is outside the committed parser output.
- `empirical-required`: configured facts do not establish effective gameplay behavior.
- `not-found`: no Raw candidate was assigned to the catalog item.

An absent fact has no value field; it is never rewritten as `0`, `false`, or `[]`. Configured or serialized values do not assert effective gameplay behavior.

## Traversal and category contract

Traversal is breadth-first and has no fixed depth limit, but follows category-relevant serialized relation edges only. The collectors follow local package targets for GearActor, attack/effect/projectile/actor/animation/notify relations and super/template inheritance. Decorative assets and unrelated dependencies are not pulled into the collection. Every retained property fact has a candidate-to-source edge path, and relation occurrences keep the source pointer and target boundary.

The retained facts include:

- **Melee:** configured attack variants, damage/type, ordered sequence/effect references, attack timing, cooldown/reset, loop, and continuous interval fields. Animation timeline timing and effective release/continuous cadence remain parser-boundary or empirical-required.
- **Ranged:** `AttackDefinition` and serialized `AttackDefintion`, attack/charge fields, projectile definition and damage fields, delay/count/angle fields, animation and notify data. Notify names are not treated as package relations; unavailable notify timeline timing remains parser-boundary.
- **Armor:** GearActor and effect/enchantment relations, serialized damage/modifier/attack-speed/cooldown/target/ownership facts when present. Absence is not interpreted as a zero modifier.
- **Artifact:** effect, item/tome actor, projectile/spawn, activation animation, damage/heal/duration/range/tick/loop and cooldown-named source facts. Base cooldown and cooldown-start semantics remain separately classified.

The Artifact base-cooldown partition is carried forward unchanged from the pre-breadth closure: `static-known 0 / static-relation-traversal 0 / parser-boundary 5 / not-observed 40`. Published/Wiki values are not substituted for missing Raw observations. The Shivering Bow provisional storable candidate remains distinct from an absent instance-role candidate.

This artifact is **not Formal truth**. It is the horizontal observation layer between Raw Game Sources and a future Formal handoff. No Formal Identity, Value, Relation, Application, Optimizer, support, or Native artifact is generated from it.

## Regeneration, audit, and tests

```sh
npm run generate:game-data-horizontal-fact-inventory
npm run audit:game-data-horizontal-fact-inventory
npx vitest run tests/horizontalRawFactInventory.test.ts
```

The audit checks exact catalog population and metadata, candidate package/status stability, separated ambiguous observations, fact and relation provenance, valid targets or explicit boundaries, Formal matched population 52, Shivering Bow role distinction, the Artifact cooldown partition, deterministic regeneration, and Raw snapshot agreement for Fighter's Bindings, Scatter Crossbow, Battle Robe, and Death Cap Mushroom.
