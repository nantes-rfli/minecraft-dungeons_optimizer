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

The audit keeps the four representative assertions grounded exactly as before and adds a narrow horizontal grounding path for 24 reviewed Melee identities. Each added assertion requires an explicit `melee-weapon:<rawIdentity>` alias with `status=accepted`, `confidence=high`, the exact expected `canonicalEntity`, category `melee-weapon`, the exact Raw identity, the exact scoped package in `assetPaths`, and one of the reviewed basis strings already present in the alias artifact. Raw candidate status, package/name similarity, family, icon ordinal, or slug derivation never creates a Formal assertion.

The 24 added Melee observations are read from the committed Raw Structural Inventory shards rather than requiring new full Raw snapshots. The adapter verifies each selected shard's compressed and uncompressed SHA-256, binary-searches the deterministic package ordering, requires the exact scoped package and one CDO, and reads only `ItemIdName` plus `ItemId.SerializedId`. Raw evidence retains the shard path, dataset ID, parser run ID, package path/hash, and shard-local node pointer. The four representative identities continue to use their existing full-Raw path, so their assertions, semantic results, EvidenceRefs, and provenance remain unchanged.

Generate and verify with:

```bash
npm run generate:formal-identity-evidence
npm run audit:formal-identity-evidence
npx vitest run tests/formalIdentityEvidence.test.ts tests/formalIdentitySourceGrounding.test.ts
```

The committed artifact now contains 28 matched identities: the four representative results unchanged plus 24 new `accepted/high` Melee identities. Formal matched Melee is therefore 25 total: Fighter's Bindings plus the 24 reviewed additions. The 38 ambiguous Melee and 19 Melee needing additional identity evidence remain outside the Formal population. Ranged, Value/Availability, Relation, Application, and Optimizer population are unchanged by this expansion.
