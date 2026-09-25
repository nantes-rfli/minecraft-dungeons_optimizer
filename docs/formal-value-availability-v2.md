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
```

Each domain value remains a typed category semantic, not an arbitrary fact bag or Raw-field mirror.
The committed artifact populates all 27 matched Melee domains and all 23 matched Ranged domains.
Armor (`battle-robe`) and Artifact (`death-cap-mushroom`) remain outside this Value wave.

Every asserted value keeps `value`, `projectionRef`, one or more `evidenceRefs`, and an optional
`relationProjectionRef`. Value evidence continues to identify the Raw observation independently
of semantic location.

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

## First-wave configured fields

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

The 48 additional Melee/Ranged domains use source facts joined to their exact Raw Structural
Inventory shard occurrences. The existing Fighter's Bindings and Scatter Crossbow domains retain
their representative full-Raw snapshot lane, including Scatter Crossbow's narrow relation-backed
pushback and friendly-fire values.

Scatter Crossbow's three referenced-projectile configured fields remain a narrow relation-dependent
extension. They use the existing Serialized Relation v1 projection through `relationProjectionRef`.
If the relation, target resolution, or target snapshot dependency fails, Value records
`failureKind: dependency` without fabricating Raw Value evidence. Serialized Relation itself is
not reinterpreted by Value v2.

## Boundaries

Value v2 does not assert final damage, effective cadence, effective projectile behavior, gameplay
effects, armor properties, enchantments, native behavior, or generic dependency paths. Configured
serialized values remain distinct from effective gameplay semantics.

`npm run audit:formal-integration` checks all 50 Melee/Ranged Identity ↔ Value same-source joins and
preserves the existing Scatter Crossbow relation sourceIndex/target-provenance checks. Relation
horizontalization remains deferred. The Value audit regenerates v2, preserves the original 17
representative projection/evidence records exactly, and byte-compares the result with the committed
artifact.
