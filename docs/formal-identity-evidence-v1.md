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

The audit keeps the four representative assertions grounded exactly as before and preserves the existing horizontal paths for 24 reviewed Melee identities and 21 reviewed Ranged identities. It adds a separate, narrow reviewed-bridge path for Bonehead Hammer, Sinister Sword, and Shrieking Crossbow. Those three require the exact `accepted/high` alias, a single exact canonical candidate, the exact Raw identity and scoped instance package, basis `serialized-item-id + documented-entity-alias + catalog-category-evidence`, and the exact canonical-key → Raw-identity mapping in `scripts/equipment-icons.ts` `ENTITY_OVERRIDES`. The generated icon manifest is not treated as independent identity evidence. Raw candidate status, package/name similarity, family, icon ordinal, `_Spooky1` suffix, or slug derivation never creates a Formal assertion.

The 142 inventory-backed observations comprise 24 ready-direct Melee, 21 ready-direct Ranged, 3 documented reviewed Melee/Ranged bridges, 2 reviewed typed-relation Melee bridges, 6 ready-direct Artifacts, 70 Armor identities, 15 documented reviewed Artifact bridges grounded by `ENTITY_OVERRIDES` and `documented-entity-alias`, and 1 independent-source Artifact bridge: `corrupted-seeds → CorruptedSeeds`. These observations are read from the committed Raw Structural Inventory shards rather than requiring new full Raw snapshots. The adapter verifies each selected shard's compressed and uncompressed SHA-256, binary-searches the deterministic package ordering, requires the exact scoped package and one CDO, and reads only `ItemIdName` plus `ItemId.SerializedId`. Raw evidence retains the shard path, dataset ID, parser run ID, package path/hash, and shard-local node pointer. The four representative identities continue to use their existing full-Raw path, so their assertions, semantic results, EvidenceRefs, and provenance remain unchanged.

The Sawblade pair uses a third, separate bridge class. `broken-sawblade → Chainsword` and `mechanized-sawblade → Chainsword_Unique1` are owned by the explicit research mapping `REVIEWED_MELEE_TYPED_RELATION_ALIAS_BRIDGES`. Each mapping binds the exact canonical `research/source-harvest.json` identity record, exact instance package, exact serialized `ItemIdName` / `ItemId.SerializedId`, and the exact `InventoryDropSound` `soft-object-property` edge to its dedicated cue target. Their alias basis is `serialized-item-id + reviewed-typed-raw-relation + catalog-category-evidence`. The implementation does not normalize `brokensawblade` / `mechanisedsawblade`, parse cue names into catalog slugs, or introduce any generic sound-cue identity inference.

Each ready-direct Artifact definition is fail-closed against its existing `accepted/high` `artifact:<rawIdentity>` alias: category, raw identity, canonical entity, and exact application-scope package path must match. Its Structural observation must resolve that exact package's single CDO, with both identity fields equal to the alias `rawIdentity`. All 15 documented Artifact bridges remain grounded by the exact `ENTITY_OVERRIDES` canonical-key-to-Raw-identity mapping and accepted/high `artifact:<rawIdentity>` alias under the `documented-entity-alias` evidence class; they also require one Structural candidate with role `instance`, one CDO, and byte-exact agreement between the bridge and both serialized identity fields. Separately, the Corrupted Seeds independent-source bridge is grounded by `research/artifact-audit.json` `internalGameIds`, the `wiki-corrupted-seeds` source, and the exact Raw Structural CDO, where `ItemIdName` and `ItemId.SerializedId` both equal `CorruptedSeeds`; it is not a `documented-entity-alias`. The generated icon manifest remains a presentation/search hint, not identity evidence. The three audited case-mismatch targets and Corrupted Seeds are included in this population; 21 slug-normalization-only targets remain outside Formal Identity.

Generate and verify with:

```bash
npm run generate:game-data-model-alignment
npm run audit:game-data-model-alignment
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/gameDataModelAlignment.test.ts tests/formalIdentityEvidence.test.ts tests/formalIdentitySourceGrounding.test.ts
```

The committed artifact contains 146 matched identities out of 271: 29 Melee, 23 Ranged, 71 Armor, and 23 Artifacts. The existing 144 definitions, including their assertions, semantic identities, EvidenceRefs, and evidence/provenance, remain unchanged and in order; the two Sawblade identities are appended after the independent-source Corrupted Seeds bridge. The original 52 definitions, six ready-direct Artifacts, 70 horizontally populated Armor identities, 15 documented Artifact bridges, and Corrupted Seeds keep their previous positions. Outside this implementation, 125 identities remain: 21 Artifact slug-normalization-only records, 73 ambiguous, 28 remaining Melee/Ranged needs-additional-identity-evidence, and 3 raw-unavailable. The partition sums to 125 (21 + 73 + 28 + 3). Of the 45 Artifacts, 22 remain: 21 slug-only and one ambiguous identity, fireworks-arrow. Formal Identity schema v1 is unchanged; Value/Availability v2, Serialized Relation v2, Application, Optimizer, Raw Structural Inventory artifacts, and Native Analysis are unchanged by this expansion.
