# Game Data Gap Reconciliation — Phase 6.5E

## Baseline

The immutable Phase 5 baseline contains 2105 Gaps, derived from `research/evidence-gap-map.json`; the count is not hardcoded by the reconciliation engine.

## Result

| Status | Count |
| --- | ---: |
| closed | 17 |
| partial | 22 |
| evidence-added | 38 |
| conflict | 0 |
| blocked | 300 |
| no-match | 1728 |
| remaining | 2088 |

## Closed by category

| Category | Closed | Partial | Evidence added |
| --- | ---: | ---: | ---: |
| ranged-weapon | 17 | 22 | 38 |

## Closed by property

| Property | Closed |
| --- | ---: |
| projectileCount | 17 |

Every closed Gap traces through an accepted semantic mapping and extracted record to an asset content hash, dataset ID, and source fingerprint. The only empirical replacement rule is the exact static `projectileCount` configuration.

## Partial / evidence-added

Accepted angle-span facts remain partial for categorical `spread` Gaps. Tentative `AttackRateSeconds` facts add evidence but do not replace effective cadence measurement. Structural effect-class links and empty CDO observations do not stand in for magnitude, duration, stacking, or runtime behavior.

## Conflicts

No duplicate exact entity/property mapping produced different normalized values.

## What direct game data could not solve

Implementation (271) and objective-design (29) Gaps remain blocked by definition. Version research, public conflicts, Power curves, proc ownership, damage distribution, effective cadence, stacking, and native/runtime behavior remain open unless an exact accepted static rule proves the requested fact.

Bulk semantic mappings: 891 total — 451 accepted, 29 tentative, 388 unresolved, 23 rejected.

Runtime promotion was not performed. Runtime catalogs, Optimizer values, support manifests, score models, and objective weights remain unchanged.

## Next: 6.5F

Phase 6.5F — Audit / Report / Coverage will consolidate final direct-game-data coverage and impact.
