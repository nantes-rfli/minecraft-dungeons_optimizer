# Game Data Model Alignment — Phase 6.6

## Before / After

Before: public/Web-derived Gap names and direct raw implementation fields shared an implicit normalization boundary. After: **Raw Game Property → Canonical Research Property → Runtime Optimizer Property**. A→B is reviewed here. B→C remains Phase 9. Phase 5 and 6.5 artifacts are immutable; their hashes and all five 6.5F workstream inputs are retained in the review artifact.

## Entity identity

Serialized identity takes precedence over indexed identity, followed by reviewed alias/exact catalog ID with public identity/category evidence. Missing indexed identity is not guessed from a filename. Shared enchantment names remain ambiguous. Unique/Spooky/Year/Winter/seasonal suffixes are preserved, never removed to match a base item. ArmorProperties components receive independent research identities; ItemCooldownDecrease → cool-down is rejected.

| Metric | Count |
| --- | --- |
| beforeUnresolved | 633 |
| resolvedIn66 | 49 |
| stillUnresolved | 584 |
| ambiguous | 3 |
| rejectedAliases | 1 |

Unresolved pattern counts: {"armor-property:unknown":1,"artifact:unknown":10,"artifact:visual-or-seasonal-unverified":1,"enchantment:unknown":35,"melee-weapon:unique-variant":364,"melee-weapon:unknown":14,"melee-weapon:visual-or-seasonal-unverified":32,"ranged-weapon:unique-variant":86,"ranged-weapon:unknown":30,"ranged-weapon:visual-or-seasonal-unverified":11}. Every retained fact and alias has a decision and trace.

## Canonical registry / aliases / renames

See [registry](./game-data-canonical-properties.md). NumberOfProjectiles is configured count. AngleSpan preserves ranged.angleSpanDegrees with an explicit alternate alias. AttackRateSeconds is renamed to ranged.configuredAttackIntervalSeconds, while effective cadence remains empirical. Approved A→B rules: 6; experimental: 1; rejected negative controls: 3. Historical 6.5 rules remain unchanged for audit reproducibility.

## Structural references

Effect normalizes as a GameplayEffect reference with its original objectName, package index and class. A full target asset path is unknown and is null, never invented. Class existence proves neither magnitude nor duration nor stacking. {"accepted":10,"unresolved":12}.

## Game-only useful fields

Every retained fact is reviewed, including all baseline game-only facts: {"add-canonical-property":88,"ignore-presentation-metadata":1}. Configured animation duration is useful research metadata, preserved per asset/variant index under its established ID. No variant average or final speed is generated. Empty CDO counts are structural metadata with unresolved value storage; raw damage remains unresolved/rejected for canonical magnitude, and presentation priority is excluded.

## Missing expected fields / split / merge / deprecate

349 baseline manual-review Gaps reviewed by all affected property families: {"D-empirical-only":67,"H-unknown":282}. Unknowns remain unknown; inherited/native existence is not asserted without evidence. Split configured timing from effective cadence/recovery requirements; retain all original Gap IDs. Reject merging intrinsic components with enchantments. No positive obsolescence evidence exists, so deprecations are zero. Review rows retain public source attempts.

## Runtime-only / empirical-only and source authority

Power scaling and health curves are runtime-required; effective cadence, ownership, stacking and interaction require original empirical protocols. Public sources remain necessary for history, runtime behavior, cross-checks and interpretation. No final damage scalar, reciprocal AttackRateSeconds, or GameplayEffect magnitude is adopted.

## Gap reconciliation impact

| Metric | Count |
| --- | --- |
| baselineGapCount | 2105 |
| closedCount | 17 |
| partialCount | 22 |
| evidenceAddedCount | 38 |
| conflictCount | 0 |
| blockedCount | 300 |
| noMatchCount | 1728 |
| remainingGapCount | 2088 |
| baselineClosed | 17 |
| newlyClosed | 0 |

New closures: none. Exact identity/property, accepted mapping, actual extraction confidence, compatible outcome, explicit empirical replacement and version/conflict/implementation/objective gates remain mandatory. Identity alignment is not closure. High runtime relevance: {"closed":0,"partial":0,"evidence-added":0,"conflict":0,"blocked":0,"no-match":124}. Rank accuracy: {"closed":0,"partial":0,"evidence-added":0,"conflict":0,"blocked":0,"no-match":124}.

## Phase 7 handoff

1307 remaining original protocols: {"experiment":506,"measure":498,"observe":303}. Only remaining Observe/Measure/Experiment dispositions enter the handoff; version/conflict and closed Gaps are excluded. Evidence context includes raw configured timing and animation metadata where relevant, so the static observation need not be repeated.

## Phase 6.7 recommendation

optional. No retained property-specific blocker proves static closure potential. Reference existence and entity matches alone do not justify Phase 6.7. High 0; medium 60; low 1596; none 432. Next: **Phase 7**. Optional deep traversal stays backlog, not a formal phase. Counts are artifact-derived; no closure improvement target.

## Reproduction / safety

Run npm run generate:game-data-model-alignment, then npm run audit:game-data-model-alignment. All nine JSON artifacts and both reports are deterministic without raw assets. The audit validates complete partitions, provenance, alias/category boundaries, negative controls and historical hashes. Runtime catalog, support manifests, scoring, workers and objective weights are unchanged. No raw asset committed.
