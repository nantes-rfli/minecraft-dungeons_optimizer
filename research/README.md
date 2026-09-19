# Research artifacts

`research/` contains checked-in Evidence, extracted facts, normalized research data, derived analysis, and runtime-adoption artifacts. The pre-redesign cleanup has established semantic ownership for the remaining artifacts. Root-level legacy audit files are intentionally retained when a path-only move would create broad producer/consumer churn without improving meaning.

## Current snapshot

As of 2026-09-19:

- 100 tracked files
- about 43.5 MB total
- 26 files / about 10.6 MB are directly under `research/`; 25 are data artifacts plus this README
- the remaining root-level data files are an intentional legacy compatibility surface with semantic roles recorded below, not an unclassified cleanup backlog

Large artifacts such as `analysis/coverage-priority.json`, `source-harvest.json`, `raw/game-data-asset-index.json`, and the alignment / gap artifacts are active inputs or generated audit outputs. They must not be deleted or archived only because they are large. Human-readable generated melee coverage reports now live under `docs/` rather than the research data root.

## Classification model

Use **semantic layer** as the primary classification. Treat generation and lifecycle as separate attributes.

| Layer | Meaning | Current examples |
| --- | --- | --- |
| Source / Evidence | What was observed or retrieved, plus provenance | `source-harvest/snapshots/`, `external-community/`, `artifact-evidence/sources.json`, `sources/ranged-source-snapshot.json`, `sources/game-data-source-provenance.json` |
| Extracted Raw Facts | Machine-extracted facts before project semantic adoption | `raw/game-data-inventory.json`, `raw/game-data-asset-index.json`, `raw/game-data-extractor-samples.json`, `raw/game-data-bulk-harvest.json`, `raw/game-data-semantic-source-samples.json`, `game-data-validation/`, `game-data-timing/`, `game-data-capabilities/` |
| Domain / Canonical | Normalized identities, properties, mappings, and audited game-domain facts | `domain/game-data-canonical-properties.json`, `domain/game-data-canonical-mappings.json`, `domain/game-data-entity-aliases.json`, `domain/game-data-semantic-mappings.json`, `domain/game-data-bulk-semantic-mappings.json`, `domain/game-data-aligned-semantic-mappings.json`, equipment / enchantment / artifact audit manifests |
| Analysis / Decision | Derived gap, coverage, priority, alignment, comparison, and validation results | `analysis/evidence-coverage*.json`, `analysis/coverage-priority.json`, `analysis/game-data-gap-reconciliation.json`, `analysis/game-data-final-coverage.json`, `analysis/game-data-model-differences.json`, `analysis/game-data-gap-property-alignment.json`, `analysis/game-data-aligned-gap-*.json`, `analysis/game-data-model-alignment-review.json`, `evidence-gap-map.json` |
| Runtime / Promotion | What the application may use and the gates for changing that boundary | `runtime/melee-runtime-support.json`, `runtime/armor-runtime-support.json`, `runtime/artifact-runtime-support.json`, `runtime/runtime-backlog.json`, `runtime/phase8c-limited-dr-validation.json`, `runtime/runtime-promotion-*.json` |
| Workflow / Protocol | Acquisition and validation workflow state, not game truth itself | `workflow/measurement-protocols.json`, `workflow/phase7-research-quest.json`, `workflow/phase7-research-handoff.json`, `workflow/evidence-intake.json`, `workflow/phase8-gap-reassessment.json` |

### Secondary attributes

These are metadata, not top-level semantic directories:

- **generated / hand-maintained** — whether a script deterministically regenerates the artifact
- **active / historical** — whether current code, audit, or documentation still consumes it
- **source / derived** — whether it preserves observation/provenance or computes a result from other artifacts
- **frozen / replaceable** — whether future regeneration is expected

Do not create a generic `generated/` directory: generated artifacts exist at several semantic layers. Do not move an artifact to `historical/` until current producers and consumers no longer depend on it.

## Cleanup classification shape

This is a research-artifact classification used for cleanup, not the final application architecture. In particular, it does **not** replace the upcoming Raw Game Sources → Game Domain → Application redesign. It is not a request for a bulk rename.

```text
research/
  sources/       # retrieved Evidence, snapshots, provenance
  raw/           # extracted facts before semantic adoption
  domain/        # normalized / canonical game-domain artifacts
  analysis/      # coverage, gaps, priorities, alignment, comparisons
  runtime/       # support manifests, limitations, promotion gates
  workflow/      # measurement, intake, handoff, validation workflow state
```

Existing focused subdirectories such as `external-community/`, `artifact-evidence/`, `game-data-validation/`, and `game-data-timing/` already provide useful grouping. Do not flatten them merely to match this sketch.

## Pre-redesign disposition of remaining root artifacts

The 25 root-level JSON artifacts are classified. **Do not move these files only to make the directory tree look cleaner before the architecture redesign.** Their current paths remain canonical until a redesign change updates the producer, every consumer, tests, docs, and embedded provenance together.

| Semantic role | Root artifacts | Pre-redesign decision |
| --- | --- | --- |
| Source / Evidence | `source-harvest.json`, `source-harvest-browser.json` | Keep at root. These are large generated Source Harvest snapshots with broad consumers. Revisit when Raw Game Sources is redesigned. |
| Domain / Canonical legacy audit surface | `armor-*.json`, `artifact-audit.json`, `artifact-control-debuff-audit.json`, `artifact-event-healing-control-audit.json`, `artifact-soul-batch-audit.json`, `cc-subsystem-audit.json`, `charge-consume-enchantment-audit.json`, `damage-event-audit.json`, `dot-damage-event-audit.json`, `melee-*-audit.json`, `ranged-*-audit.json`, `soul-subsystem-audit.json`, `temporal-enchantment-audit.json`, `void-strike-audit.json` | Keep at root as one tightly coupled legacy audit surface. The semantic owner is Game Domain; physical relocation belongs with the new domain model, not a cleanup-only PR. |
| Analysis / Decision | `artifact-curve-audit.json`, `artifact-expansion-plan.json`, `dps-regression-audit.json`, `evidence-gap-map.json` | Keep at root until their analysis contracts are redesigned. In particular, moving Gap Map alone forces regeneration of the multi-megabyte Coverage Priority artifact solely to update its embedded provenance path. |

Existing focused directories such as `artifact-evidence/`, `external-community/`, `source-harvest/`, `game-data-validation/`, `game-data-timing/`, `game-data-capabilities/`, `game-data-mechanics/`, and `game-data-native-stage2/` are also intentionally retained. They already group a producer/consumer slice and should be reconsidered by semantic responsibility during redesign rather than flattened now.

### Redesign entry condition

For the research area, pre-redesign cleanup is complete when:

- every retained artifact has a known semantic role;
- moved generated artifacts have their writers, readers, tests, docs links, and stored refs updated together;
- there are no duplicate compatibility copies;
- generated human-readable reports live under `docs/`;
- CI is green;
- no remaining move is justified only by directory aesthetics.

Once those conditions hold, additional path movement is redesign work rather than cleanup work.

## Migration rules

1. **No bulk move.** Move one producer/consumer slice at a time.
2. **Update the writer first.** Generated artifacts move together with the script that writes and drift-checks them.
3. **Update every consumer in the same change.** This includes `src/` imports/readers, audit scripts, tests, docs links, and machine-readable refs stored inside other artifacts.
4. **Do not leave duplicate compatibility copies.** A duplicate file creates another source-of-truth problem. Use one canonical path after the migration.
5. **Preserve provenance and history.** Moving a file must not rewrite Evidence meaning, confidence, source identity, or historical decisions.
6. **Keep unknown / unsupported semantics unchanged.** Layout cleanup must never convert missing data to zero, one, or supported runtime behavior.
7. **Validate narrowly, then CI.** Run the affected generator/audit and related tests locally; let main CI perform the full repository validation.
8. **Historical is an explicit decision.** A file is historical only when no current runtime, audit, research workflow, or generated report depends on it.

## Dependency risk observed today

Current scripts use literal repository paths extensively. Examples include:

- Source Harvest writers targeting `research/source-harvest*.json`
- Evidence Coverage snapshots now live under `research/analysis/`; Gap Map remains at root as `research/evidence-gap-map.json`; Priority and Coverage snapshots live under `research/analysis/`, while measurement protocols live under `research/workflow/`
- game-data reconciliation and Model Alignment outputs are split by semantic role: normalized mappings under `research/domain/`, gap/alignment decisions under `research/analysis/`
- Phase 8 reads the aligned gap disposition from `research/analysis/`, while its Phase 7 handoff uses the canonical `research/workflow/` path
- Runtime Promotion imports its regression source from `research/runtime/` and embeds canonical research paths in its manifest; future moves must update both code and stored refs

Therefore directory moves are **code changes**, not cosmetic Git moves.

## Suggested migration order

Use small slices with clear ownership:

1. **Completed pilot: Runtime Promotion slice** — `runtime/runtime-promotion-manifest.json` + `runtime/runtime-promotion-regression.json` now live under the Runtime / Promotion layer with generator, test, docs, and stored refs updated together.
2. **Completed: Workflow state** — measurement protocols, Phase 7 quest/handoff, and Phase 8 intake/reassessment artifacts now live under `workflow/`, with their generators/readers updated together.
3. **Completed: Runtime support manifests / backlog** — melee / armor / artifact support manifests, Armor core runtime audit, and the structured backlog now live under `runtime/`, with Core, Coverage, audit, docs, and tests updated together.
4. **Closed for pre-redesign cleanup: Coverage / Gap / Priority chain** — Evidence Coverage snapshot/dashboard and Coverage Priority live under `analysis/`. Gap Map remains canonically at root for now; moving it would require atomic regeneration of Coverage Priority only to change embedded provenance. Revisit that path as part of the analysis/domain redesign rather than a cleanup-only move.
5. **Completed: Large game-data core chain** — Inventory, extraction, semantic mappings, reconciliation, final coverage, and Model Alignment outputs are classified across `raw/`, `domain/`, `analysis/`, and `workflow/`, with producers and downstream readers updated together.

The existing nested source / game-data directories should be retained unless a specific dependency-safe migration improves clarity. `sources/` is now established for clearly classified standalone source snapshots such as the ranged factual snapshot. `raw/` is established for machine-extracted representative facts that have not yet been adopted into Domain / Canonical data. `domain/` is established for normalized research artifacts, including the canonical property registry, entity aliases, canonical mappings, and representative semantic mappings.

## Before each move

For the selected slice, record:

- canonical destination
- writer / generator
- direct readers
- tests
- docs links
- machine-readable references from other JSON artifacts
- exact audit command
- rollback path

Only then perform the Git move and path updates in one PR. For the intentionally retained root artifacts above, do not start another cleanup-only move; wait until the architecture redesign provides a semantic reason.
