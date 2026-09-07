# Direct Game Data Final Coverage — Phase 6.5F

## Executive Summary

Current explicit semantic rules and conservative closure gates prove 17 closed Gaps. A further 60 received partial structural support or direct evidence. The remaining count does not imply game files contain no useful data.

## What Phase 6.5 proved

The selected gameplay assets are largely readable; semantic normalization and effective runtime behavior are separate limits. Inventory is path/size identity, not authentication of every byte or version.

## Coverage Funnel

### source

| Metric | Value |
| --- | --- |
| totalFiles | 134806 |
| logicalPackages | 49394 |
| uassetPackages | 45311 |
| umapPackages | 4083 |

**gameplayResearchRoots**

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Actors/Equipment/Armor |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Actors/Equipment/MeleeWeapons |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Actors/Equipment/RangedWeapons |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Actors/Items |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Components/Enchantments |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/Components/ArmorProperties |
| present | true |

| Metric | Value |
| --- | --- |
| path | Dungeons/Content/DataTables |
| present | true |

### gameplayCandidate

| Metric | Value |
| --- | --- |
| candidateAssets | 1026 |
| policy | paired BP mechanics classes under gameplay roots, including DLC/Patch branches |
| boundary | Selected gameplay mechanics candidates, not whole-game coverage. |

### parser

| Metric | Value |
| --- | --- |
| parsedAssets | 1018 |
| failedAssets | 8 |
| skippedAssets | 0 |
| gameplayCandidateParseCoverage | 0.9922027290448343 |
| fatalParseRate | 0.007797270955165692 |

**byRoot**


**Armor**

| Metric | Value |
| --- | --- |
| candidates | 164 |
| parsed | 164 |
| failed | 0 |
| records | 0 |
| parseSuccessRate | 1 |
| fatalParseRate | 0 |


**MeleeWeapons**

| Metric | Value |
| --- | --- |
| candidates | 168 |
| parsed | 164 |
| failed | 4 |
| records | 586 |
| parseSuccessRate | 0.9761904761904762 |
| fatalParseRate | 0.023809523809523808 |


**RangedWeapons**

| Metric | Value |
| --- | --- |
| candidates | 215 |
| parsed | 215 |
| failed | 0 |
| records | 199 |
| parseSuccessRate | 1 |
| fatalParseRate | 0 |


**Items**

| Metric | Value |
| --- | --- |
| candidates | 215 |
| parsed | 213 |
| failed | 2 |
| records | 18 |
| parseSuccessRate | 0.9906976744186047 |
| fatalParseRate | 0.009302325581395349 |


**Enchantments**

| Metric | Value |
| --- | --- |
| candidates | 225 |
| parsed | 223 |
| failed | 2 |
| records | 61 |
| parseSuccessRate | 0.9911111111111112 |
| fatalParseRate | 0.008888888888888889 |


**ArmorProperties**

| Metric | Value |
| --- | --- |
| candidates | 39 |
| parsed | 39 |
| failed | 0 |
| records | 27 |
| parseSuccessRate | 1 |
| fatalParseRate | 0 |

### structural

| Metric | Value |
| --- | --- |
| totalParsedProperties | 19905 |
| retainedFacts | 891 |
| syntheticStructuralObservations | 61 |
| semanticRuleRecognizedPropertyCount | 830 |
| retentionRatio | 0.04476262245666918 |
| semanticRuleFilteringRatio | 0.041698065812609895 |
| boundary | Filtering ratio, not quality; retained facts include synthetic empty-CDO observations, which are not parsed properties. |

### semantic

| Metric | Value |
| --- | --- |
| accepted | 451 |
| tentative | 29 |
| unresolved | 388 |
| rejected | 23 |

**rates**

| Metric | Value |
| --- | --- |
| accepted | 0.5061728395061729 |
| tentative | 0.03254769921436588 |
| unresolved | 0.43546576879910215 |
| rejected | 0.025813692480359147 |


**byCategory**


**armor-property**

| Metric | Value |
| --- | --- |
| accepted | 4 |
| tentative | 0 |
| unresolved | 0 |
| rejected | 23 |


**artifact**

| Metric | Value |
| --- | --- |
| accepted | 18 |
| tentative | 0 |
| unresolved | 0 |
| rejected | 0 |


**enchantment**

| Metric | Value |
| --- | --- |
| accepted | 0 |
| tentative | 0 |
| unresolved | 61 |
| rejected | 0 |


**melee-weapon**

| Metric | Value |
| --- | --- |
| accepted | 293 |
| tentative | 0 |
| unresolved | 293 |
| rejected | 0 |


**ranged-weapon**

| Metric | Value |
| --- | --- |
| accepted | 136 |
| tentative | 29 |
| unresolved | 34 |
| rejected | 0 |

### gap

| Metric | Value |
| --- | --- |
| baselineGapCount | 2105 |
| closedCount | 17 |
| partialCount | 22 |
| evidenceAddedCount | 38 |
| conflictCount | 0 |
| blockedCount | 300 |
| noMatchCount | 1728 |
| remainingGapCount | 2088 |
| closedRate | 0.008076009501187649 |
| directEvidenceTouchedCount | 77 |
| directEvidenceTouchedRate | 0.03657957244655582 |

## Semantic Rule Coverage

10 explicit rules. Raw parser coverage is not semantic normalization coverage.

| Metric | Value |
| --- | --- |
| ruleId | armor-property-effect-class-v1 |
| category | armor-property |
| matchedFacts | 4 |
| resolvedEntities | 1 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | artifact-instance-effect-class-v1 |
| category | artifact |
| matchedFacts | 18 |
| resolvedEntities | 7 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | enchantment-empty-cdo-v1 |
| category | enchantment |
| matchedFacts | 61 |
| resolvedEntities | 1 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | melee-instance-animation-duration-v1 |
| category | melee-weapon |
| matchedFacts | 293 |
| resolvedEntities | 24 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | presentation-priority-negative-control-v1 |
| category | armor-property |
| matchedFacts | 23 |
| resolvedEntities | 1 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | ranged-instance-angle-span-v1 |
| category | ranged-weapon |
| matchedFacts | 68 |
| resolvedEntities | 22 |
| mappedGaps | 22 |
| closedGaps | 0 |
| partialGaps | 22 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | ranged-instance-attack-rate-v1 |
| category | ranged-weapon |
| matchedFacts | 29 |
| resolvedEntities | 19 |
| mappedGaps | 38 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 38 |

| Metric | Value |
| --- | --- |
| ruleId | ranged-instance-projectile-count-v1 |
| category | ranged-weapon |
| matchedFacts | 68 |
| resolvedEntities | 22 |
| mappedGaps | 17 |
| closedGaps | 17 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | raw-damage-negative-control-v1 |
| category | melee-weapon |
| matchedFacts | 293 |
| resolvedEntities | 24 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

| Metric | Value |
| --- | --- |
| ruleId | raw-ranged-damage-negative-control-v1 |
| category | ranged-weapon |
| matchedFacts | 34 |
| resolvedEntities | 9 |
| mappedGaps | 0 |
| closedGaps | 0 |
| partialGaps | 0 |
| evidenceAddedGaps | 0 |

## Parser Diagnostics

| Metric | Value |
| --- | --- |
| hardeningRecommendation | First retain diagnostic property paths and safe-skip flags in a bounded future probe; investigate Map/Set/struct and malformed tags only with a canonical entity/property link. Current aggregates do not demonstrate high closure ROI. |
| boundary | Aggregate unsupported diagnostics cannot be assigned to individual Gaps. Fatal assets identify entity exposure only. |

**summary**

| Metric | Value |
| --- | --- |
| code | struct-parse-failed |
| propertyType | StructProperty |
| count | 39 |
| fatal | false |

| Metric | Value |
| --- | --- |
| code | trailing-bytes |
| count | 22 |
| fatal | false |

| Metric | Value |
| --- | --- |
| code | malformed-property-tag |
| count | 17 |
| fatal | true |

| Metric | Value |
| --- | --- |
| code | unsupported-property-type |
| propertyType | MapProperty |
| count | 6 |
| fatal | false |

| Metric | Value |
| --- | --- |
| code | unsupported-property-type |
| propertyType | SetProperty |
| count | 5 |
| fatal | false |

| Metric | Value |
| --- | --- |
| code | trailing-bytes |
| propertyType | ArrayProperty |
| count | 4 |
| fatal | false |


**classification**

| Metric | Value |
| --- | --- |
| fatal | 17 |
| potentiallyRelevant | 50 |
| relevanceUnknown | 26 |

**safeSkipped**

| Metric | Value |
| --- | --- |
| count | null |
| basis | Bulk summary does not retain per-diagnostic skipped flags. Nonfatal is not automatically equivalent to safely skipped. |


**likelyIrrelevant**

| Metric | Value |
| --- | --- |
| count | 0 |
| basis | No retained property context proves irrelevance. |


**failedAssets**

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Actors/Items/Arrow/Player/BP_BurningArrowGameplayEffect |
| gameplayRoot | Items |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Components/Enchantments/Snowing/BP_SnowingGameplayEffect |
| gameplayRoot | Enchantments |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No canonical category resolver for enchantment |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Components/Enchantments/Stunning/BP_StunningGameplayEffect |
| gameplayRoot | Enchantments |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No canonical category resolver for enchantment |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Content_DLC3/Actors/Items/CorruptedBeacon_Spooky1/BP_CorruptedBeacon_Spooky1GameplayEffect |
| gameplayRoot | Items |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword_Unique1/BP_ChainSwordUniqueActiveGameplayEffect |
| gameplayRoot | MeleeWeapons |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword_Unique1/BP_ChainSwordUniqueBreakGameplayEffect |
| gameplayRoot | MeleeWeapons |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword/BP_ChainSwordActiveGameplayEffect |
| gameplayRoot | MeleeWeapons |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

| Metric | Value |
| --- | --- |
| assetPath | Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Chainsword/BP_ChainSwordBreakGameplayEffect |
| gameplayRoot | MeleeWeapons |
| failureReason | incomplete-cdo-property-stream |
| affectedGapCount | 0 |
| boundary | Entity-level exposure only; no property-specific blocking is proven. |

**entityResolution**

| Metric | Value |
| --- | --- |
| status | unresolved |
| reason | No exact canonical identity or explicit alias matched |


**affectedGapIds**: none

## Gap Reconciliation Coverage


**touchedByCategory**

| Metric | Value |
| --- | --- |
| ranged-weapon | 77 |


**touchedByProperty**

| Metric | Value |
| --- | --- |
| projectileCount | 17 |
| recoverySeconds | 19 |
| shotsPerSecond | 19 |
| spread | 22 |


**highRuntimeRelevance**

| Metric | Value |
| --- | --- |
| closed | 0 |
| partial | 0 |
| evidence-added | 0 |
| conflict | 0 |
| blocked | 0 |
| no-match | 124 |


**rankAccuracy**

| Metric | Value |
| --- | --- |
| closed | 0 |
| partial | 0 |
| evidence-added | 0 |
| conflict | 0 |
| blocked | 0 |
| no-match | 124 |

| Metric | Value |
| --- | --- |
| status | passed |
| closed | 17 |
| partialAndEvidenceAdded | 60 |
| chain | Gap → mapping → provenance record → indexed asset path → SHA256 → dataset → source path-size fingerprint |

## Why only 17 Gaps closed

Exact NumberOfProjectiles → ranged.projectileCount → projectileCount proves configured static counts. AngleSpan supports spread but does not prove effective behavior; AttackRateSeconds does not establish effective cadence. High-runtime-relevance and rank-accuracy results above describe current rule scope, not the usefulness of game data in general. Blocked implementation/objective records are not direct-evidence hits.

## Model Differences

See [the decision report](./game-data-model-differences.md) for every taxonomy, retained-fact differences and workstream. Melee configured animation duration is a retained field without Gap linkage; Effect references require structural normalization. Expected powerScaling, ownership, distribution and version history are not established by current static facts. No-match alone never justifies deprecating an expected field.

## Remaining Gap Disposition

| Metric | Value |
| --- | --- |
| already-resolved | 0 |
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

## Phase 6.6 Workstreams

- canonical-property-aliases: Explicit aliases for configured counts and angles; 39 traced Gaps, 44 mappings; closure potential unproven.
- structural-reference-mapping: Normalize artifact/armor GameplayEffect references; 0 traced Gaps, 22 mappings; closure potential unproven.
- new-game-property-review: Review configured animation durations as research metadata; 0 traced Gaps, 315 mappings; closure potential unproven.
- entity-alias-cleanup: Review unresolved canonical entity identities; 0 traced Gaps, 633 mappings; closure potential unproven.
- semantic-rule-expansion: Review raw timing semantics before approved rule expansion; 38 traced Gaps, 19 mappings; closure potential unproven.

## Deep Game Data Follow-up Recommendation

| Metric | Value |
| --- | --- |
| status | optional |
| highPotentialGapCount | 0 |
| mediumPotentialGapCount | 60 |
| reason | No property-specific high-potential blocker is proven. 60 remaining Gaps have partial/timing evidence. GameplayEffect references and empty CDOs justify a bounded feasibility study, but entity-level association must not inflate closure ROI. Prioritize Phase 6.6 review and preserve empirical protocols; no Phase 6.7 is scheduled. |

## What Phase 7 should contain

After Phase 6.6 alignment, regenerate the handoff for remaining Observe / Measure / Experiment. Partial evidence does not replace an empirical protocol.

## Runtime boundary

Web source model → direct game-data structural model → Optimizer canonical model are distinct evidence layers. Direct assets strongly support serialized counts, configured values, references, enums and booleans. Final damage, Power scaling, native curves, proc ownership, stacking, cadence and interactions need runtime or empirical evidence.

Raw Game Property → Canonical Research Property → Runtime Optimizer Property is the Phase 6.6 direction. UI need not expose raw UE names. Runtime promotion not performed; catalog, score and worker unchanged.

## Known limitations

Full unknown property trees were not retained. Synthetic empty-CDO observations are counted separately from parsed properties. Aggregate diagnostics cannot prove a particular Gap is blocked. Failed-asset entity exposure is not a closure estimate. Deep reference magnitudes and inheritance remain unproven; version is a root-label claim. No new harvest, semantic rules or Gap closures.
