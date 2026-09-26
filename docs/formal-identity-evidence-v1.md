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

The 124 inventory-backed horizontal observations comprise 24 Melee, 21 Ranged, 3 reviewed bridges, 6 ready-direct Artifacts, and 70 Armor identities. They are read from the committed Raw Structural Inventory shards rather than requiring new full Raw snapshots. The adapter verifies each selected shard's compressed and uncompressed SHA-256, binary-searches the deterministic package ordering, requires the exact scoped package and one CDO, and reads only `ItemIdName` plus `ItemId.SerializedId`. Raw evidence retains the shard path, dataset ID, parser run ID, package path/hash, and shard-local node pointer. The four representative identities continue to use their existing full-Raw path, so their assertions, semantic results, EvidenceRefs, and provenance remain unchanged.

Each ready-direct Artifact definition is fail-closed against its existing `accepted/high` `artifact:<rawIdentity>` alias: category, raw identity, canonical entity, and exact application-scope package path must match. Its Structural observation must resolve that exact package's single CDO, with both identity fields equal to the alias `rawIdentity`. The artifact alias file is not modified, and display names or generated icon metadata do not establish identity.

Generate and verify with:

```bash
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/formalIdentityEvidence.test.ts tests/formalIdentitySourceGrounding.test.ts
```

The committed artifact now contains 128 matched identities: 27 Melee, 23 Ranged, 71 Armor, and 7 Artifacts. The original 52 definitions remain first and are protected by a compatibility fingerprint over their assertions, semantic identities, and provenance. The six ready-direct Artifacts from Phase A remain appended after those 52, and the 70 Armor identities are added after Phase A; this retains Battle Robe within the original set and brings the Armor population to 71. Outside this implementation, 143 identities remain: 37 are ready-with-small-reviewed-bridge, 73 are ambiguous, 30 need additional identity evidence, and 3 are raw-unavailable. Formal Identity schema v1 is unchanged; Value/Availability v2, Serialized Relation, Application, Optimizer, Raw Structural Inventory artifacts, and Native Analysis are unchanged by this expansion.
