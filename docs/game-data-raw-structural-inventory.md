# Raw Structural Inventory + Dependency Graph

Minecraft Dungeons 1.17.0.0 の271 catalog entriesをRaw candidate seedとして分離し、実際のserialized referenceから `/Game` packageをBFSで展開した生成artifactです。ゲーム効果の解釈、Formal identity判定、runtime接続は行いません。

## Coverage

- Catalog seed rows: 271; candidate package seeds: 359
- Visited packages: 6086; parsed: 6086
- Serialized reference edges: 992099; resolved targets: 776045; unresolved targets: 0
- Native package boundaries: 22; outside-game target packages: 52; parser boundaries: 186; missing target packages: 0
- Reached DataTable / Curve-like packages: 5; cycle/reuse edges: 74966

- Structural inheritance chains: 1428; detected cycles: 0

## Catalog seed mapping

- exact: 146
- provisional: 49
- ambiguous: 74
- not-found: 2

Seed status describes only the catalog-to-Raw candidate association and remains separate from Formal Identity. Exact requires a unique candidate whose serialized ItemIdName or ItemId.SerializedId matches the repository catalog ID or internal ID. Provisional records one candidate supported by package-path or presentation search hints. Ambiguous retains all equally ranked candidates; not-found has none. The equipment icon manifest is recorded as a search hint and never establishes identity on its own.

## Representation and boundaries

Each package retains dataset-relative path, package-file and logical-package hashes, parser and code provenance, import/export relation tables, export class/super/template/outer references, traversed inheritance chains, CDO property paths/types/decode states/values/children, source byte ranges, diagnostics, and unavailable ranges. Edges preserve the serialized occurrence and the target object/package. Imports under `/Script` are native boundaries. Missing local `/Game` targets, parser failures, and out-of-scope targets have separate stop reasons. BFS is cycle-safe and has no fixed-depth cutoff.

DataTable/Curve packages are retained as graph nodes. The current parser does not decode their row payloads; those ranges remain explicit as unavailable instead of being inferred. Unsupported and partial CDO property streams count as parser boundaries and retain their diagnostics, states, paths, and byte ranges. Non-CDO export payloads are marked `not-extracted`. The artifact stores no game binaries, semantic effects, damage/Power scaling, cadence, stacking, proc, or native-behavior conclusions.

## Artifact files

The machine-readable artifact uses `research/raw/game-data-raw-structural-inventory/manifest.json` plus 96 deterministic gzip JSON shards. Each shard holds at most 64 packages and their source-owned edges; the manifest records each shard's compressed and uncompressed SHA-256.

## Reproduction

Run `npm run generate:game-data-raw-structural-inventory` with the local 1.17.0.0 dataset, then `npm run audit:game-data-raw-structural-inventory`. Catalog rows come from the repository equipment catalogs; candidate packages and serialized identifiers come from the local asset index and dataset. The equipment icon manifest is used only for candidate search hints. Generation is deterministic from those inputs, package bytes, dataset provenance, the separately recorded repository input identity, and parser/generator code identity.
