# Formal Identity / Evidence v1

This contract formalizes only equipment identity and its evidence boundary. It does not formalize gameplay values, attack configuration, projectiles, armor properties, or gameplay-effect semantics.

## Artifact boundary

The committed artifact is `research/domain/formal/identity-evidence-v1.json`. Its three same-artifact planes are:

```text
semantic.identities[]
  rawEvidence: known(value) | unavailable
  resolution: matched | unresolved
  presentation: present only when matched

identityAssertions[]
  reviewState: accepted | provisional
  confidence: high | omitted
  fixed Raw application scope

provenance.evidence[]
  reviewed support / limitation / conflict
  Raw observations and exact existing node/parent provenance
```

Assertion review and Raw resolution are independent. A provisional assertion can resolve as `matched`; a decoded value such as `Other` remains `known("Other")` while its resolution is `unresolved`. Detailed unavailable reasons stay in provenance rather than expanding the semantic observation state.

## Matching rules

The v1 projector accepts only Raw schema 2, the assertion's exact package path, exactly one CDO, and exact decoded `NameProperty` values at both `ItemIdName` and `ItemId.SerializedId`. Both values must equal `assertion.rawIdentity`. Missing or ambiguous nodes trace an existing parent or collection and never invent a node pointer.

For a match, `resolution.domainId` is materialized from the referenced assertion. An unresolved resolution has no `domainId` and exposes no presentation. The application-facing adapter reads only `semantic.identity.resolution` and never falls back to assertion, presentation, or repository catalog IDs.

## Evidence integrity

Every assertion, resolution, observation, and presentation `EvidenceRef` resolves within the same artifact. The audit rejects duplicate IDs, dangling refs, mismatched semantic/Raw observations, assertion/resolution evidence mixing, and evidence content changed without updating its stored fingerprint. Fingerprints are drift tripwires, not cryptographic authenticity claims.

The audit keeps the four representative assertions grounded exactly as before and preserves the existing horizontal paths for 24 reviewed Melee identities and 21 reviewed Ranged identities. It keeps the separate documented reviewed-bridge path for Bonehead Hammer, Sinister Sword, and Shrieking Crossbow: those three require the exact `accepted/high` alias, a single exact canonical candidate, the exact Raw identity and scoped instance package, basis `serialized-item-id + documented-entity-alias + catalog-category-evidence`, and the exact canonical-key → Raw-identity mapping in `scripts/equipment-icons.ts` `ENTITY_OVERRIDES`. Separately, Broken Sawblade and Mechanized Sawblade use a research-owned typed-relation bridge class. Each pins the exact canonical `research/source-harvest.json` record to the exact Raw instance/serialized identity through the reviewed `InventoryDropSound` `soft-object-property` edge and its exact dedicated cue target, then materializes basis `serialized-item-id + reviewed-typed-raw-relation + catalog-category-evidence`. These two Sawblade mappings are explicit: sound-cue names, spelling normalization, suffixes, slugs, fuzzy matching, or generic cue-name inference do not create identity mappings. The generated icon manifest is not treated as independent identity evidence.

The six additional reviewed typed-relation bridges are Chill Gale Knife, Resolute Tempest Knife, Bonebow, Twin Bow, Burst Gale Bow, and Echo of the Valley. Each uses its own explicit definition in `src/domain/formal/identityDefinitions.ts` and reviewed canonical source / exact package / typed edge bindings in `scripts/game-data-model-alignment.ts` `REVIEWED_TYPED_RELATION_ALIAS_BRIDGES`. The observed properties include `InventoryDropSound`, `ConfiguredAttackVariants[].HitSoundCue`, and `AnimNotifyStateData[].TriggerSound`; the registry pins the exact property and target for each candidate. These are candidate-specific identity evidence, not a generic sound-name matching policy or gameplay semantic evidence. The same exact scope, decoded identity, provenance and preservation gates apply.

The 148 inventory-backed observations comprise 24 ready Melee, 21 ready Ranged, 3 documented reviewed Melee/Ranged bridges, 2 reviewed typed-relation Sawblade bridges, 6 additional reviewed typed-relation Melee/Ranged bridges, 6 ready-direct Artifacts, 70 Armor identities, 15 documented reviewed Artifact bridges grounded by `ENTITY_OVERRIDES` and `documented-entity-alias`, and 1 independent-source Artifact bridge: `corrupted-seeds → CorruptedSeeds`. These observations are read from the committed Raw Structural Inventory shards rather than requiring new full Raw snapshots. The adapter verifies each selected shard's compressed and uncompressed SHA-256, binary-searches the deterministic package ordering, requires the exact scoped package and one CDO, and reads only `ItemIdName` plus `ItemId.SerializedId`. Raw evidence retains the shard path, dataset ID, parser run ID, package path/hash, and shard-local node pointer. The four representative identities continue to use their existing full-Raw path, so their assertions, semantic results, EvidenceRefs, and provenance remain unchanged.

Each ready-direct Artifact definition is fail-closed against its existing `accepted/high` `artifact:<rawIdentity>` alias: category, raw identity, canonical entity, and exact application-scope package path must match. Its Structural observation must resolve that exact package's single CDO, with both identity fields equal to the alias `rawIdentity`. All 15 documented Artifact bridges remain grounded by the exact `ENTITY_OVERRIDES` canonical-key-to-Raw-identity mapping and accepted/high `artifact:<rawIdentity>` alias under the `documented-entity-alias` evidence class; they also require one Structural candidate with role `instance`, one CDO, and byte-exact agreement between the bridge and both serialized identity fields. Separately, the Corrupted Seeds independent-source bridge is grounded by `research/artifact-audit.json` `internalGameIds`, the `wiki-corrupted-seeds` source, and the exact Raw Structural CDO, where `ItemIdName` and `ItemId.SerializedId` both equal `CorruptedSeeds`; it is not a `documented-entity-alias`. The generated icon manifest remains a presentation/search hint, not identity evidence. The three audited case-mismatch targets and Corrupted Seeds are included in this population; 21 slug-normalization-only targets remain outside Formal Identity.

Generate and verify with:

```bash
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/formalIdentityEvidence.test.ts tests/formalIdentitySourceGrounding.test.ts
```

## Current scope and preservation

The committed artifact contains 152 matched identities: 31 Melee, 27 Ranged, 71 Armor, and 23 Artifacts. Counts come from the canonical artifact and `scripts/audit-formal-identity-evidence.ts`; the generated [Project Status](../PROJECT_STATUS.md) provides the cross-layer overview. These matched domains are not a measure of gameplay or runtime coverage.

The audit preserves the earlier 144-definition prefix, the two Sawblade definitions at indices 144–145, and the six additional reviewed typed-relation definitions at indices 146–151. Existing assertion/semantic/EvidenceRef/provenance records and ordering remain guarded. Identity schema v1 is unchanged. Identity evidence alone does not unlock Value, Relation, or runtime adoption; each has its own source and dependency gates.

## Historical expansion snapshot

At the two-Sawblade expansion, the artifact contained 146 matched identities out of the 271-entry catalog: 29 Melee, 23 Ranged, 71 Armor, and 23 Artifacts. That iteration preserved the earlier 144 definitions and appended Broken Sawblade and Mechanized Sawblade after Corrupted Seeds. Its remaining population was 125: 21 Artifact slug-normalization-only records, 73 ambiguous, 28 Melee/Ranged needs-additional-identity-evidence records, and 3 raw-unavailable. This is a historical partition, not a current backlog; the later six-bridge expansion must not be subtracted from its readiness groups without re-auditing them. The Sawblade-only change left Value/Availability v2, Serialized Relation, Application, Optimizer, Raw Structural Inventory, and Native Analysis unchanged at that baseline.
