# Formal Value / Availability v1

This boundary promotes only source-backed known configured values from the temporary Fighter's Bindings and Scatter Crossbow projections. It does not introduce a generic semantic `known | unknown` union. Unknown, unsupported, parse-failed, and not-extracted states remain in value projection records and provenance.

The committed artifact is [`research/domain/formal/value-availability-v1.json`](../research/domain/formal/value-availability-v1.json). Generate it with `npm run generate:formal-value-availability` and verify it with `npm run audit:formal-value-availability`.

## Semantic shape

Every asserted value has a value, one projection reference, and one or more evidence references. Collection values contain the ordered `sourceIndex` list, including a valid empty list. Child fields use the source index as their slice-local occurrence. Missing or duplicate source indices make the collection unavailable; array position is never substituted.

Fighter's Bindings asserts the configured attack collection plus configured damage and animation duration for each valid occurrence. Scatter Crossbow asserts projectile velocity, the configured projectile definition collection, projectile count, angle span, per-projectile delay, pushback enabled, pushback strength, and ignore-friendly-fire.

Battle Robe armor-property ownership and Death Cap Mushroom GameplayEffect semantics are absent from the artifact. No unknown, empty, or unavailable semantic placeholders are emitted for either slice.

## Availability and integrity

A projected collection is required before child occurrences are enumerated. A failed child remains an unavailable projection record while sibling values remain projected. If a Scatter projectile definition occurrence is known but reference validation fails, its nested projectile configuration records remain present as unavailable dependency/reference failures. Failure before definition enumeration creates no child records.

The audit enforces one record per `(mappingId, occurrence)`, a bijection between projected records and semantic value occurrences, no semantic values for unavailable records, exact semantic/projection evidence equality, non-empty and resolvable evidence references, stable occurrence-derived projection IDs, and evidence fingerprints.
