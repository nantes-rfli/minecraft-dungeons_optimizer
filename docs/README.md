# Documentation index

`docs/` contains current operating guidance, model specifications, generated research reports, architecture decisions, and frozen history. A filename containing an old Phase number does **not** by itself mean the document is historical: several Phase-named files are still active inputs or current technical references.

The current flat layout is intentionally preserved until producer / consumer links are inventoried. Use this page as the navigation layer instead of inferring importance from filename or age.

## Start here

For normal development and current project decisions:

- [Roadmap](../ROADMAP.md) — current goal and generated Research / Product work units
- [Data update workflow](data-update-workflow.md) — Source → Research / Canonical → Evidence → Runtime promotion
- [Runtime limitations](runtime-limitations.md) — current support boundaries and close conditions
- [Combined Evidence & Coverage](combined-evidence-coverage.md) — current cross-category coverage view
- [Runtime Promotion Pipeline](runtime-promotion-pipeline.md) — adoption-to-runtime contract
- [Personal Research Quest](phase7-personal-research-quest.md) — evidence acquisition workflow
- [Evidence intake and validation](phase8-evidence-intake.md) — Evidence repository / validation flow
- [Changes](changes.md) — curated meaningful changes; Git history is the detailed source of truth
- [Research artifact layout](../research/README.md) — classification and future migration rules for machine-readable research artifacts

## Architecture / policy

Documents that define boundaries rather than a single game mechanic:

- [Catalog / Evidence / Runtime separation](catalog-evidence-runtime-separation.md)
- [External Evidence model ADR](adr/0001-external-evidence-model-redesign.md)
- [Public-use readiness](public-use-readiness.md)
- [Personal UX information architecture](personal-ux-information-architecture.md)
- [Enchantment UX](enchantment-ux.md)
- [Equipment icons](equipment-icons.md)

## Current model specifications

These describe active model behavior or constraints. Keep them current when the corresponding implementation changes.

### Damage / state

- [Damage modifiers](damage-modifiers.md)
- [Enemy-state damage](enemy-state-damage.md)
- [Damage events](damage-events.md)
- [DoT and explosion damage](dot-and-explosion-damage.md)
- [Charge / consume enchantments](charge-consume-enchantments.md)
- [Temporal enchantments](temporal-enchantments.md)
- [CC utility](cc-utility.md)
- [Soul subsystem](soul-subsystem.md)
- [Soul resource scheduler](soul-resource-scheduler.md)
- [Combat state](combat-state.md)
- [Enemy debuffs](enemy-debuffs.md)
- [Potion state](potion-state.md)
- [Power scaling](power-scaling.md)

### Equipment domains

- Armor: [model](armor-model.md) · [health](armor-health-model.md) · [runtime support](armor-runtime-support.md)
- Artifact: [model](artifact-model.md) · [runtime support](artifact-runtime-support.md) · [stacking](artifact-stacking.md)
- Ranged: [runtime](ranged-runtime.md)
- Melee: [runtime support](melee-runtime-support.md)
- [Enchantment model](enchantment-model.md)

## Evidence / measurement specifications

These define what qualifies as Evidence or how measurements are interpreted:

- [Model regression](model-regression.md)
- [Measurement protocols](measurement-protocols.md)
- [Attack profile measurement](attack-profile-measurement.md)
- [Void Strike measurement](void-strike-measurement.md)
- [Evidence adapter](evidence-adapter.md)
- [Phase 8C Limited DR validation](phase8c-limited-dr-validation.md)

Phase labels in these filenames identify the development lineage. They remain current references while their contracts are still used.

## Generated / audit reports

Many documents are deterministic or semi-deterministic views of checked-in research artifacts. Prefer changing their source data / generator rather than editing generated tables directly.

Major families include:

- Source / coverage: `source-harvest.md`, `evidence-coverage.md`, `evidence-gap-map.md`, `coverage-priority.md`
- Equipment audits: `*-audit.md`, runtime support reports, expansion reports
- Game-data research: `game-data-*.md`
- External comparison: `external-community-research.md`, `attack-event-comparison.md`, `dr-modifier-comparison.md`, `scenario-optimizer-comparison.md`

Whether a report is generated is an **attribute**, not a reason to put it in a generic historical bucket. Active CI can depend on generated report content and links.

## Historical

Currently the explicit frozen history is:

- [Historical Roadmap](historical-roadmap.md)

Do not move a Phase-named technical document here merely because its original implementation phase is complete. Historical means the document is no longer the current contract, current model reference, active evidence workflow, or generator output used by the project.

## Future directory cleanup

A possible target shape is:

```text
docs/
  README.md
  architecture/
  models/
  workflows/
  reports/
  history/
  adr/
```

This is a navigation target, not a bulk-move instruction. Moving generated reports or model specs changes links embedded in scripts, tests, other Markdown, and research artifacts.

Use the same migration rule as `research/`:

1. choose one coherent document family
2. enumerate generator, readers, links, tests, and machine-readable refs
3. move and update all references in one PR
4. run the family audit plus CI
5. do not leave duplicate compatibility copies
