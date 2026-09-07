# Game Data Bulk Harvest — Phase 6.5E

## Candidate selection

The Asset Index deterministically selects paired `.uasset + .uexp` Blueprint mechanics classes under the six gameplay roots, including DLC and Patch branches. Visual-only classes are excluded. Each logical asset is parsed and discarded before the next asset; full parse trees remain local-only.

## Parser coverage

- Candidate logical assets: 954
- Parsed: 946
- Skipped: 0
- Fatal failures: 8
- Fatal parse rate: 0.84%
- Maximum reference depth: 3; cycle key: `datasetId + logical asset path`

| Gameplay root | Candidates | Parsed | Failed | Selected facts |
| --- | ---: | ---: | ---: | ---: |
| Armor | 164 | 164 | 0 | 0 |
| MeleeWeapons | 168 | 164 | 4 | 586 |
| RangedWeapons | 143 | 143 | 0 | 165 |
| Items | 215 | 213 | 2 | 18 |
| Enchantments | 225 | 223 | 2 | 61 |
| ArmorProperties | 39 | 39 | 0 | 27 |

## Extracted Gap-relevant facts

857 compact structural facts were retained. Every record is `extracted`, has semantic confidence `unknown`, remains `research-only`, and links to a logical-asset SHA-256 content hash and dataset provenance. Full property trees and raw binaries are not committed.

## Semantic boundary

Only property paths recognized by the explicit Phase 6.5E rule registry are retained. Raw Damage scalars and presentation priority/color metadata are negative controls and are not promoted to gameplay magnitudes. Semantic mappings live in a separate artifact.

## Diagnostics

| Code | Property type | Count | Fatal |
| --- | --- | ---: | --- |
| struct-parse-failed | StructProperty | 30 | no |
| malformed-property-tag | — | 17 | yes |
| trailing-bytes | — | 13 | no |
| unsupported-property-type | MapProperty | 6 | no |
| unsupported-property-type | SetProperty | 5 | no |
| trailing-bytes | ArrayProperty | 4 | no |

Diagnostic volume alone is not a failure. Fatal package failures are separately gated at 5%; safe unsupported payloads remain explicit.

## Known limitations

- Effective inheritance and native executable behavior are not evaluated.
- GameplayEffect internals are retained only where an explicit rule establishes meaning.
- Static asset timing does not replace empirical cadence, stacking, ownership, distribution, or Power-curve protocols by default.
- Runtime catalogs, support manifests, Optimizer values, score models, and objective weights are unchanged.
