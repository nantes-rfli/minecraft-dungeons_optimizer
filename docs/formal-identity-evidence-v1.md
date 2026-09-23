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

The audit keeps the four representative assertions grounded exactly as before and provides narrow horizontal grounding paths for 24 reviewed Melee identities and 21 reviewed Ranged identities. Each breadth assertion requires an explicit category-specific alias with `status=accepted`, `confidence=high`, the exact expected `canonicalEntity`, the exact category, the exact Raw identity, the exact scoped package in `assetPaths`, and a reviewed basis string already present in the alias artifact. For the Ranged wave, allowed bases are `serialized-item-id + exact-catalog-slug + catalog-category-evidence`, `asset-index-entity + exact-catalog-slug + catalog-category-evidence`, `serialized-item-id + reviewed-alias + catalog-category-evidence`, and `asset-index-entity + reviewed-alias + catalog-category-evidence`. Raw candidate status, package/name similarity, family, icon ordinal, or slug derivation never creates a Formal assertion.

The 45 breadth observations (24 Melee plus 21 Ranged) are read from the committed Raw Structural Inventory shards rather than requiring new full Raw snapshots. The adapter verifies each selected shard's compressed and uncompressed SHA-256, binary-searches the deterministic package ordering, requires the exact scoped package and one CDO, and reads only `ItemIdName` plus `ItemId.SerializedId`. Raw evidence retains the shard path, dataset ID, parser run ID, package path/hash, and shard-local node pointer. The four representative identities continue to use their existing full-Raw path, so their assertions, semantic results, EvidenceRefs, and provenance remain unchanged.

Generate and verify with:

```bash
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/formalIdentityEvidence.test.ts tests/formalIdentitySourceGrounding.test.ts
```

The committed artifact now contains 49 matched identities. Formal matched Melee remains 25 total: Fighter's Bindings plus the 24 reviewed Melee additions. Formal matched Ranged is 22 total: the existing Scatter Crossbow result plus 21 reviewed Ranged additions. The 34 ambiguous Ranged identities and 15 Ranged identities needing additional identity evidence remain outside the Formal population. Formal Identity schema v1 is unchanged; Value/Availability v2, Serialized Relation, Application, Optimizer, Raw Structural Inventory, and Native Analysis are unchanged by this expansion.
