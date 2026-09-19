# Game Data Model Differences — Phase 6.5F

Primary Gap differences and retained-fact differences are separate partitions. A zero Gap count does not mean the kind is absent from game assets.

## Taxonomy

- **exact-match**: Accepted exact entity/property mapping compatible with the closure gates.
- **rename-or-alias**: Equivalent names requiring an explicit alias; closure is a separate axis.
- **structural-transform**: A nested value or reference needs normalization, not merely renaming.
- **game-only-property**: Observed retained field without a Gap property; not a whole-game inventory.
- **optimizer-only-expected-property**: Expected property has no current direct evidence; absence is not proven.
- **semantic-ambiguity**: A raw value exists but its effective meaning is unresolved.
- **native-or-runtime-only**: Static evidence does not determine final runtime/scaled values.
- **empirical-required**: Observation, measurement or controlled interaction remains necessary.
- **parser-unsupported**: A demonstrated property-specific parser limitation blocks evidence.
- **inheritance-unresolved**: Empty declared CDO leaves inherited/native/reference storage unresolved.
- **version-boundary**: Root-label version claim cannot establish version history.
- **source-conflict**: Conflicting public sources or direct evidence require reconciliation.
- **implementation-required**: A software implementation decision remains required.
- **objective-required**: A product objective decision remains required.
- **entity-resolution-failed**: No exact canonical entity or authoritative alias was resolved.
- **no-game-data-match**: No match under current parser + candidate + semantic-rule scope.

## Gap differences

| Metric | Value |
| --- | --- |
| exact-match | 17 |
| rename-or-alias | 0 |
| structural-transform | 22 |
| game-only-property | 0 |
| optimizer-only-expected-property | 0 |
| semantic-ambiguity | 38 |
| native-or-runtime-only | 82 |
| empirical-required | 1165 |
| parser-unsupported | 0 |
| inheritance-unresolved | 0 |
| version-boundary | 126 |
| source-conflict | 6 |
| implementation-required | 271 |
| objective-required | 29 |
| entity-resolution-failed | 0 |
| no-game-data-match | 349 |

## Retained-fact differences

| Metric | Value |
| --- | --- |
| exact-match | 0 |
| rename-or-alias | 44 |
| structural-transform | 8 |
| game-only-property | 89 |
| optimizer-only-expected-property | 0 |
| semantic-ambiguity | 19 |
| native-or-runtime-only | 97 |
| empirical-required | 0 |
| parser-unsupported | 0 |
| inheritance-unresolved | 1 |
| version-boundary | 0 |
| source-conflict | 0 |
| implementation-required | 0 |
| objective-required | 0 |
| entity-resolution-failed | 633 |
| no-game-data-match | 0 |

## Dispositions

| Metric | Value |
| --- | --- |
| already-resolved | 17 |
| phase-6.6-model-alignment | 0 |
| deeper-game-data-research | 0 |
| phase-7-observe | 303 |
| phase-7-measure | 498 |
| phase-7-experiment | 506 |
| implementation | 271 |
| objective-design | 29 |
| version-public-research | 132 |
| parser-hardening | 0 |
| manual-review | 349 |

## Decision rules

Precedence: unchanged closed → implementation/objective → version/conflict → original empirical protocol → partial/evidence normalization → scoped no-match/manual review. Reasons and evidence IDs are attached to every Gap. Native/scaling flags describe an evidence boundary, not proof that a property exists only in executable code. Parser-hardening requires a demonstrated property-specific blocker; aggregate diagnostics and entity coincidence are insufficient.

## Phase 6.6 change candidates


**canonical-property-aliases**

| Metric | Value |
| --- | --- |
| title | Explicit aliases for configured counts and angles |
| affectedGapCount | 39 |
| directEvidenceCount | 44 |
| complexity | medium |
| expectedClosePotential | unproven; no forecast of new closures |
| recommendation | Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition. |
| proposedChange | alias |


**structural-reference-mapping**

| Metric | Value |
| --- | --- |
| title | Normalize artifact/armor GameplayEffect references |
| affectedGapCount | 0 |
| directEvidenceCount | 22 |
| complexity | high |
| expectedClosePotential | unproven; no forecast of new closures |
| recommendation | Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition. |
| proposedChange | add-structural-reference |


**new-game-property-review**

| Metric | Value |
| --- | --- |
| title | Review configured animation durations as research metadata |
| affectedGapCount | 0 |
| directEvidenceCount | 315 |
| complexity | medium |
| expectedClosePotential | unproven; no forecast of new closures |
| recommendation | Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition. |
| proposedChange | add-canonical-property |


**entity-alias-cleanup**

| Metric | Value |
| --- | --- |
| title | Review unresolved canonical entity identities |
| affectedGapCount | 0 |
| directEvidenceCount | 633 |
| complexity | medium |
| expectedClosePotential | unproven; no forecast of new closures |
| recommendation | Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition. |
| proposedChange | alias |


**semantic-rule-expansion**

| Metric | Value |
| --- | --- |
| title | Review raw timing semantics before approved rule expansion |
| affectedGapCount | 38 |
| directEvidenceCount | 19 |
| complexity | medium |
| expectedClosePotential | unproven; no forecast of new closures |
| recommendation | Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition. |
| proposedChange | split-property |


**missingExpectedPropertyReview**

| Metric | Value |
| --- | --- |
| id | missing-optimizer-property-review |
| title | Review expected fields with no current semantic match; deprecation is not authorized |
| affectedGapCount | 349 |
| affectedGapIds | See machine-readable decision artifact for all Gap IDs. |
| expectedClosePotential | unknown; absence is not evidence of obsolescence |
| directEvidenceCount | 0 |
| complexity | medium |
| recommendation | Compare expected-property meaning to the public source model and candidate/rule selection. Preserve public-research/source-extractable provenance; require positive evidence before adding or deprecating a canonical field. |

Review useful game-only fields and missing expected fields without assuming missing means obsolete. Add/split/merge/deprecation require approved semantics. Runtime-only and empirical-only flags are research-boundary candidates, never automatic runtime changes.

## ROI and readiness

| Metric | Value |
| --- | --- |
| status | optional |
| highPotentialGapCount | 0 |
| mediumPotentialGapCount | 60 |
| reason | No property-specific high-potential blocker is proven. 60 remaining Gaps have partial/timing evidence. GameplayEffect references and empty CDOs justify a bounded feasibility study, but entity-level association must not inflate closure ROI. Prioritize Phase 6.6 review and preserve empirical protocols; no Phase 6.7 is scheduled. |

| Metric | Value |
| --- | --- |
| phase66CanStart | true |
| canonicalAndRuntimeModelChanged | false |
| phase67Scheduled | false |


Full Gap records, retained-fact records, traceable change candidates and deterministic partitions are in [game-data-model-differences.json](../research/analysis/game-data-model-differences.json).
