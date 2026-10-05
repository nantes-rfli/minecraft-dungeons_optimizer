# Formal Value / Availability v2

Value v2 is the committed source-backed configured-value boundary. It is generated as
[`research/domain/formal/value-availability-v2.json`](../research/domain/formal/value-availability-v2.json)
by `npm run generate:formal-value-availability` and verified by
`npm run audit:formal-value-availability`.

## Semantic shape

The semantic container is horizontal by category and matched Formal domain identity:

```text
semantic
  → melee
    → <domainId>
  → ranged
    → <domainId>
  → artifact
    → <reviewed domainId>
```

Each domain value remains a typed category semantic, not an arbitrary fact bag or Raw-field mirror.
The committed artifact populates all 31 matched Melee domains, all 27 matched Ranged domains,
and the four reviewed Artifact domains described below. Armor (including `battle-robe`) has no
Value lane; `death-cap-mushroom` is outside the narrow Artifact Value set. These are configured
values, not runtime support counts. The canonical artifact and the Value/integration audits are
the scope authority; [Project Status](../PROJECT_STATUS.md) provides the generated overview.

Every asserted value keeps `value`, `projectionRef`, one or more `evidenceRefs`, and an optional
`relationProjectionRef`. Value evidence continues to identify the Raw observation independently
of semantic location. The integrity validator recomputes each EvidenceRef from its complete
Raw provenance as well as checking the content fingerprint. Updating a fingerprint alone
cannot retain an EvidenceRef after changing its source locator, run, dataset, or package hash.

The offline Value provenance verifier rejects full-Raw snapshots with an unsupported or
missing schema version, snapshot kind, parser ID, or parser schema version before resolving
the occurrence. These compatibility checks use the existing Raw extractor/parser constants;
matching dataset/run/package provenance alone does not establish format compatibility.

## Value occurrence and stable projection identity

v2 serializes either a scope occurrence:

```ts
{ domainId, scopeRef }
```

or an indexed collection occurrence:

```ts
{ domainId, collectionRef, sourceIndex }
```

`sourceIndex` is the Raw collection element index and remains occurrence identity. Array position
is not substituted. Missing, negative, or duplicate source indices make the parent collection
unavailable. Reordering the source collection can change semantic output order without changing the
ProjectionRef for a given sourceIndex.

The v2 occurrence shape does not remint existing representative ProjectionRefs. Projection identity
continues to use mapping ID plus domain/scope for scope values, and mapping ID plus domain/sourceIndex
for collection children. Existing Fighter's Bindings and Scatter Crossbow mapping IDs are unchanged.

## Availability and evidence

Only known source-backed configured values enter semantic output. Unknown, unsupported, parse-failed,
and not-extracted Raw states remain unavailable projection records. A failed child does not remove
siblings. A failed parent collection does not invent child occurrences. Decoded `0`, `false`, and
`[]` remain known values.

Projection still requires a matched Formal Identity from the same Raw source. Candidate Raw identity
alone is insufficient. Identity review decisions and the Identity schema are unchanged.

## Configured collection fields

Every Melee configured attack is indexed by its recorded Raw `elementIndex` and carries:

```text
Damage
AttackAnimationTimeDurationSeconds
AttackRange
ConeAngleDegrees
ConeOffsetUnits
DamageSplashMultiplier
DamageDelaySeconds
AttackVariantType
VariantLoopAmount
```

Every Ranged configured projectile definition is indexed by its recorded Raw `elementIndex` and
carries `NumberOfProjectiles`, `DelaySeconds`, `DelaySecondsPerProjectile`, and `AngleSpan`.
These are configured source values; the fields do not assert effective combat behavior.

The 56 non-representative Melee/Ranged domains use source facts joined to their exact Raw Structural
Inventory shard occurrences. The existing Fighter's Bindings and Scatter Crossbow domains retain
their representative full-Raw snapshot lane, including Scatter Crossbow's narrow relation-backed
pushback and friendly-fire values.

Scatter Crossbow's three referenced-projectile configured fields remain a narrow relation-dependent
extension. They use the preserved representative projection in [Serialized Relation v2](./formal-serialized-relation-v2.md) through `relationProjectionRef`.
Source Relation EvidenceRefs must be non-empty and distinct, and each referenced source
or target EvidenceRef must resolve to exactly one provenance record. Empty or ambiguous
references fail closed before target-dependent fields are read; source-side configured
values remain available.
If the relation, target resolution, or target snapshot dependency fails, Value records
`failureKind: dependency` without fabricating Raw Value evidence. Serialized Relation itself is
not reinterpreted by Value v2; its v1-to-v2 migration preserves that projection identity.

## Boundaries

Value v2 does not assert final damage, effective cadence, effective projectile behavior, gameplay
effects, armor properties, enchantments, native behavior, or generic dependency paths. Configured
serialized values remain distinct from effective gameplay semantics.

`npm run audit:formal-integration` checks all 58 Melee/Ranged and four narrow Artifact
Identity ↔ Value same-source joins. It also preserves the existing Scatter Crossbow relation
sourceIndex/target-provenance checks. Relation horizontalization is implemented under its own
[v2 contract](./formal-serialized-relation-v2.md); it does not automatically introduce new
relation-dependent Values. The Value audit regenerates v2, preserves the original 17
representative projection/evidence records exactly, and byte-compares the result with the
committed artifact.

## Application consumer

The shared [Formal Value browser reader](../src/screens/dataBrowser/formalValuesBrowserModel.ts)
exposes all existing Value-lane domains in the Melee, Ranged, and Artifact data pages. It reads
validated Domain artifacts, preserves projection/evidence references and Raw `sourceIndex`, and
shows unavailable states and dependency failures without numeric fallback. Domains without a
Value lane receive no invented values. This inspection consumer does not adopt configured values
into Optimizer runtime or establish effective gameplay behavior.

## Additive narrow Artifact lane

`schemaVersion: 2` also includes `semantic.artifact: Record<string,
FormalArtifactConfiguredValues>`. Only the following reviewed independent root CDO
configuration fields are populated; multiple fields may share a domain, and each uses `{ domainId, scopeRef: "source" }`
and has no Relation dependency.

| Domain | Formal field | Raw property | Mapping ID | Unit |
| --- | --- | --- | --- | --- |
| corrupted-seeds | configuredTargetCount | TargetCount | corrupted-seeds:configured-target-count@1 | count |
| enchanted-grass | configuredIncreasedMaxHealthMultiplier | IncreasedMaxHealthMultiplier | enchanted-grass:configured-max-health-multiplier@1 | dimensionless multiplier |
| powershaker | configuredAttackStacks | AttackStacks | powershaker:configured-attack-stacks@1 | count |
| vexing-chant | configuredCoolDownForEachPetDeath | CoolDownForEachPetDeath | vexing-chant:configured-cooldown-for-each-pet-death@1 | boolean flag |
| vexing-chant | configuredPetAmountCap | PetAmountCap | vexing-chant:configured-pet-cap@1 | count |

The reader requires the committed matched Identity, its exact selected Horizontal
candidate package, a unique root CDO occurrence, and verified Structural/Horizontal
provenance. Drift or missing observations produce unavailable records; undecoded
properties retain their actual Raw availability state. Missing facts use the
verified root property or CDO inventory as evidence, never an invented value or
locator. Identity/provenance integrity failures stop generation.

The mapping registry, generator, semantic occurrence enumeration, required scope
coverage, evidence/projection audit and integration audit all recognize this lane.
The other 19 Artifact domains receive no Value records. No generic damage,
duration, heal, range, base cooldown or effective gameplay semantics are introduced.
Existing Melee/Ranged Value records and Identity/Relation artifacts are preserved;
`tests/fixtures/artifact-narrow-value-baseline.json` captures full baseline hashes.

The Powershaker stack-count extension reuses the same root scalar adapter. `AttackStacks = 5`
is the serialized count configuration only; it does not assert how stacks are consumed,
triggered, replenished, or scaled during play. `ShockwaveDamage` remains outside this lane.

The Vexing Chant boolean extension uses the same verified root scalar reader with a
`BoolProperty` / boolean guard. Serialized `CoolDownForEachPetDeath = false` is known;
it does not establish effective cooldown start/reset behavior or pet death triggers.
Each reviewed field requires its own mapping/projection even when another field on
the domain is unavailable. Unavailable flags have no boolean or numeric fallback.
