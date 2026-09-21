# Formal Value / Availability v1

This boundary promotes only source-backed known configured values. Fighter's Bindings still uses its temporary field reader. Formal Scatter uses separate source and target readers; the temporary Scatter projector is not a relation authority. Unknown, unsupported, parse-failed, and not-extracted Raw states remain in value projection records and provenance.

The committed artifact is [`research/domain/formal/value-availability-v1.json`](../research/domain/formal/value-availability-v1.json). Generate it with `npm run generate:formal-value-availability` and verify it with `npm run audit:formal-value-availability`.

## Semantic shape

Every asserted value has a value, one projection reference, and one or more Value evidence references. Collection values contain the ordered `sourceIndex` list, including a valid empty list. Scatter `sourceIndex` must be the nonnegative integer Raw `element.index`, unique within the parent. An invalid or duplicate index makes the whole collection unavailable; array position is never substituted.

Fighter's Bindings asserts the configured attack collection plus configured damage and animation duration for each valid occurrence. Scatter Crossbow asserts projectile velocity, the configured projectile definition collection, projectile count, angle span, per-projectile delay, pushback enabled, pushback strength, and ignore-friendly-fire.

Battle Robe armor-property ownership and Death Cap Mushroom GameplayEffect semantics are absent from the artifact. No unknown, empty, or unavailable semantic placeholders are emitted for either slice.

## Availability and integrity

A projected collection is required before child occurrences are enumerated. A failed child remains an unavailable projection record while sibling values remain projected. The three Scatter target-side fields require one projected Relation occurrence, resolved target, and a supplied target Raw snapshot matching the Relation target evidence provenance. Value does not revalidate the serialized reference. If this dependency fails, the records have `failureKind: dependency`, a reason, and `relationProjectionRef` when an occurrence exists. They have no Value Raw evidence because no target field was read. A target field read that fails has `failureKind: raw` and Value Raw evidence. Source-side Scatter values remain independent of Relation failure. Failure before definition enumeration creates no child records.

The boundary audit enforces one record per `(mappingId, occurrence)`, a bijection between projected records and semantic value occurrences, no semantic values for unavailable records, matching semantic/projection links, Raw evidence for Raw reads, and no invented Raw evidence for dependency failures. Projection references identify mapping occurrences; Value evidence references independently identify Raw observations, so multiple projection occurrences can cite the same Raw observation.

`npm run audit:formal-integration` checks the joins across committed Identity, Value, and Relation artifacts by Raw provenance (`artifactPath`, `packagePath`, `datasetId`, `extractionRunId`, and package hash algorithm/value). Identity, Value, and Relation EvidenceRefs remain separate namespaces.
