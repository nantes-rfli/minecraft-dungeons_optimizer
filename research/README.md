# Research artifacts

`research/` contains checked-in Evidence, extracted facts, normalized research data, derived analysis, and runtime-adoption artifacts. The current layout is transitional: files are intentionally not bulk-moved until their producers and consumers are updated together.

## Current snapshot

As of 2026-09-19:

- 99 tracked files
- about 45.6 MB total
- 61 files / about 43.1 MB are directly under `research/` after the first Runtime Promotion slice migration
- the size itself is not the problem; the main issue is that semantic role is difficult to infer from a flat root

Large artifacts such as `coverage-priority.json`, `source-harvest.json`, `game-data-asset-index.json`, and the alignment / gap artifacts are active inputs or generated audit outputs. They must not be deleted or archived only because they are large.

## Classification model

Use **semantic layer** as the primary classification. Treat generation and lifecycle as separate attributes.

| Layer | Meaning | Current examples |
| --- | --- | --- |
| Source / Evidence | What was observed or retrieved, plus provenance | `source-harvest/snapshots/`, `external-community/`, `artifact-evidence/sources.json`, `ranged-source-snapshot.json`, `game-data-source-provenance.json` |
| Extracted Raw Facts | Machine-extracted facts before project semantic adoption | `game-data-inventory.json`, `game-data-asset-index.json`, `game-data-extractor-samples.json`, `game-data-bulk-harvest.json`, `game-data-validation/`, `game-data-timing/`, `game-data-capabilities/` |
| Domain / Canonical | Normalized identities, properties, mappings, and audited game-domain facts | `game-data-canonical-properties.json`, `game-data-canonical-mappings.json`, `game-data-entity-aliases.json`, semantic mappings, equipment / enchantment / artifact audit manifests |
| Analysis / Decision | Derived gap, coverage, priority, alignment, comparison, and validation results | `evidence-gap-map.json`, `evidence-coverage*.json`, `coverage-priority.json`, model differences / alignment review, comparison artifacts |
| Runtime / Promotion | What the application may use and the gates for changing that boundary | runtime support manifests, `runtime-backlog.json`, `phase8c-limited-dr-validation.json`, `runtime/runtime-promotion-*.json` |
| Workflow / Protocol | Acquisition and validation workflow state, not game truth itself | `measurement-protocols.json`, `phase7-research-quest.json`, `phase7-research-handoff.json`, `evidence-intake.json`, `phase8-gap-reassessment.json` |

### Secondary attributes

These are metadata, not top-level semantic directories:

- **generated / hand-maintained** — whether a script deterministically regenerates the artifact
- **active / historical** — whether current code, audit, or documentation still consumes it
- **source / derived** — whether it preserves observation/provenance or computes a result from other artifacts
- **frozen / replaceable** — whether future regeneration is expected

Do not create a generic `generated/` directory: generated artifacts exist at several semantic layers. Do not move an artifact to `historical/` until current producers and consumers no longer depend on it.

## Target shape

This is a target classification, not a request for a bulk rename.

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
- Evidence Coverage / Gap Map sharing `research/evidence-coverage*.json`, `research/evidence-gap-map.json`, and `research/measurement-protocols.json`
- game-data harvest / reconciliation reading and writing multiple root-level `research/game-data-*.json` paths
- Phase 8 reading the aligned gap disposition and Phase 7 handoff by literal path
- Runtime Promotion imports its regression source from `research/runtime/` and embeds canonical research paths in its manifest; future moves must update both code and stored refs

Therefore directory moves are **code changes**, not cosmetic Git moves.

## Suggested migration order

Use small slices with clear ownership:

1. **Completed pilot: Runtime Promotion slice** — `runtime/runtime-promotion-manifest.json` + `runtime/runtime-promotion-regression.json` now live under the Runtime / Promotion layer with generator, test, docs, and stored refs updated together.
2. **Workflow state** — Phase 7 / Phase 8 intake and handoff artifacts, after all cross-references are enumerated.
3. **Runtime support manifests / backlog** — after UI and audit readers are inventoried.
4. **Coverage / Gap / Priority chain** — move as a connected pipeline, not file by file, because the generators share artifacts.
5. **Large game-data chain** — last. Inventory → extraction → semantic mapping → alignment → gap reconciliation has many hard-coded paths and large generated outputs.

The existing nested source / game-data directories should be retained unless a specific dependency-safe migration improves clarity.

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

Only then perform the Git move and path updates in one PR.
